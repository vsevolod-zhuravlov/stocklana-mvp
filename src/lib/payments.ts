import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";

import { demoMode } from "@/lib/config";
import { getConnection, requestDevnetAirdrop } from "@/lib/solana/rpc";
import { LAMPORTS_PER_SOL } from "@/lib/solana/tokens";
import type { PaymentSession } from "@/lib/types";

/**
 * In-memory session store. Good enough for a hackathon demo; a production
 * deployment on serverless needs Redis/KV because instances are not shared.
 * Every read path therefore tolerates a missing session and rebuilds it from
 * parameters the client supplies.
 */
const sessions = new Map<string, PaymentSession>();

/** How long after the payment sheet closes the demo settlement fires. */
const DEMO_SETTLE_DELAY_MS = 4_000;

export function createSession(input: {
  sessionId: string;
  walletAddress: string;
  usdAmount: number;
}): PaymentSession {
  const session: PaymentSession = {
    ...input,
    status: "pending",
    createdAt: Date.now(),
    settleAfter: null,
    solDelivered: null,
    signature: null,
    failureReason: null,
  };
  sessions.set(input.sessionId, session);
  return session;
}

export function getSession(sessionId: string): PaymentSession | undefined {
  return sessions.get(sessionId);
}

/**
 * Recovers a session dropped by a cold start using values the client still
 * holds, so polling never dead-ends at "unknown session".
 */
export function getOrRecoverSession(
  sessionId: string,
  fallback: { walletAddress: string; usdAmount: number },
): PaymentSession {
  const existing = sessions.get(sessionId);
  if (existing) return existing;
  return createSession({ sessionId, ...fallback });
}

export function updateSession(
  sessionId: string,
  patch: Partial<PaymentSession>,
): PaymentSession | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  const next = { ...session, ...patch };
  sessions.set(sessionId, next);
  return next;
}

/** Called when the user dismisses the payment sheet. */
export function markSheetClosed(session: PaymentSession): PaymentSession {
  if (session.status === "completed" || session.status === "failed") return session;
  return (
    updateSession(session.sessionId, {
      status: "processing",
      settleAfter: session.settleAfter ?? Date.now() + DEMO_SETTLE_DELAY_MS,
    }) ?? session
  );
}

function loadTreasury(): Keypair | null {
  const raw = process.env.DEMO_TREASURY_SECRET_KEY;
  if (!raw) return null;
  try {
    const bytes = Uint8Array.from(JSON.parse(raw) as number[]);
    return Keypair.fromSecretKey(bytes);
  } catch {
    return null;
  }
}

/**
 * Delivers devnet SOL to stand in for a settled card payment. Prefers a
 * pre-funded treasury keypair because the public devnet faucet is aggressively
 * rate limited and will otherwise break a live demo.
 */
async function deliverDemoSol(
  walletAddress: string,
  sol: number,
): Promise<{ signature: string; delivered: number }> {
  const amount = Math.min(sol, 1);
  const treasury = loadTreasury();

  if (treasury) {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasury.publicKey,
        toPubkey: new PublicKey(walletAddress),
        lamports: Math.round(amount * LAMPORTS_PER_SOL),
      }),
    );
    const connection = getConnection();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = treasury.publicKey;
    transaction.sign(treasury);

    const signature = await connection.sendRawTransaction(transaction.serialize());
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
    return { signature, delivered: amount };
  }

  return { signature: await requestDevnetAirdrop(walletAddress, amount), delivered: amount };
}

/**
 * Resolves the current state of a payment. Real settlement arrives via the
 * Onramper webhook; in demo mode the deposit is simulated once the payment
 * sheet has closed.
 */
export async function resolvePaymentStatus(
  session: PaymentSession,
  solUsdPrice: number | null,
): Promise<PaymentSession> {
  if (session.status === "completed" || session.status === "failed") return session;

  const ready = session.settleAfter !== null && Date.now() >= session.settleAfter;
  if (!demoMode || !ready) return session;

  const sol = solUsdPrice && solUsdPrice > 0 ? session.usdAmount / solUsdPrice : 0.05;

  try {
    const { signature, delivered } = await deliverDemoSol(session.walletAddress, sol);
    return (
      updateSession(session.sessionId, {
        status: "completed",
        solDelivered: delivered,
        signature,
      }) ?? session
    );
  } catch (error) {
    // The detail goes to the server log only. It contains wallet addresses and
    // RPC jargon, and everything in `failureReason` may end up being spoken.
    console.error("[payments] demo settlement failed", error);
    return (
      updateSession(session.sessionId, {
        status: "failed",
        failureReason:
          "The test network faucet is rate limited, so the test SOL could not be delivered.",
      }) ?? session
    );
  }
}
