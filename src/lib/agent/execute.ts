import { cluster, demoMode } from "@/lib/config";
import { explanations } from "@/lib/agent/explanations";
import type { ExplainTopic } from "@/lib/agent/tools";
import { getSolUsdPrice, getUsdPrices } from "@/lib/jupiter";
import { buildOnrampUrl, onrampConfigured } from "@/lib/onramper";
import {
  createSession,
  getOrRecoverSession,
  resolvePaymentStatus,
} from "@/lib/payments";
import { prepareStockPurchase } from "@/lib/solana/buildTransaction";
import { getBalanceSnapshot } from "@/lib/solana/rpc";
import { findStock, supportedTickerList, TOKENIZED_STOCKS } from "@/lib/solana/tokens";
import type { ClientAction, PendingAction, WalletContext } from "@/lib/types";

/** Leaves room for network fees and rent so a buy never drains the wallet. */
const FEE_BUFFER_SOL = 0.005;

export interface ToolContext {
  wallet: WalletContext;
  pendingAction: PendingAction | null;
  /** Origin of the incoming request, used to build on-ramp redirect URLs. */
  origin: string;
  /** Most recent payment session known to the client. */
  lastPaymentSessionId: string | null;
}

export interface ToolOutcome {
  result: Record<string, unknown>;
  /** `undefined` leaves the pending action untouched; `null` clears it. */
  pendingAction?: PendingAction | null;
  clientAction?: ClientAction;
}

function requireWallet(ctx: ToolContext): string | null {
  return ctx.wallet.address ?? null;
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

async function runGetBalance(ctx: ToolContext): Promise<ToolOutcome> {
  const address = requireWallet(ctx);
  if (!address) {
    return { result: { error: "no_wallet", message: "The wallet is not ready yet." } };
  }

  const mints = TOKENIZED_STOCKS.map((s) => s.mint);
  const [solPrice, stockPrices] = await Promise.all([getSolUsdPrice(), getUsdPrices(mints)]);
  const snapshot = await getBalanceSnapshot(address, solPrice, stockPrices);

  return {
    result: {
      network: cluster,
      is_test_network: demoMode,
      sol: round(snapshot.sol, 6),
      sol_usd_value: snapshot.solUsdValue === null ? null : round(snapshot.solUsdValue, 2),
      holdings: snapshot.tokens.map((token) => ({
        ticker: token.symbol,
        amount: round(token.amount, 6),
        usd_value: token.usdValue === null ? null : round(token.usdValue, 2),
      })),
      wallet_is_empty: snapshot.sol === 0 && snapshot.tokens.length === 0,
    },
  };
}

async function runStartOnramp(
  input: { usd_amount?: unknown },
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const address = requireWallet(ctx);
  if (!address) {
    return { result: { error: "no_wallet", message: "The wallet is not ready yet." } };
  }

  const usdAmount = Number(input.usd_amount);
  if (!Number.isFinite(usdAmount) || usdAmount < 5 || usdAmount > 500) {
    return {
      result: {
        error: "invalid_amount",
        message: "Ask the person for an amount between 5 and 500 dollars.",
      },
    };
  }

  if (!onrampConfigured()) {
    return {
      result: {
        error: "onramp_unavailable",
        message: "The card payment provider is not configured in this deployment.",
      },
    };
  }

  const sessionId = crypto.randomUUID();
  createSession({ sessionId, walletAddress: address, usdAmount });

  const widgetUrl = buildOnrampUrl({
    sessionId,
    walletAddress: address,
    email: ctx.wallet.email,
    usdAmount,
    redirectOrigin: ctx.origin,
  });

  const solPrice = await getSolUsdPrice();
  const estimatedSol = solPrice && solPrice > 0 ? round(usdAmount / solPrice, 4) : null;

  return {
    result: {
      prepared: true,
      requires_confirmation: true,
      usd_amount: usdAmount,
      estimated_sol: estimatedSol,
      payment_methods: "Apple Pay or Google Pay, with card entry as a fallback",
      sandbox: demoMode,
      next_step:
        "Tell the person the amount and that their phone will open its payment sheet, then ask them to say yes to confirm or no to cancel. Do not call confirm_pending_action yet.",
    },
    pendingAction: {
      kind: "onramp",
      summary: `Buy ${usdAmount} dollars of SOL`,
      usdAmount,
      sessionId,
      widgetUrl,
    },
  };
}

async function runBuyStock(
  input: { ticker?: unknown; usd_amount?: unknown },
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const address = requireWallet(ctx);
  if (!address) {
    return { result: { error: "no_wallet", message: "The wallet is not ready yet." } };
  }

  const stock = findStock(String(input.ticker ?? ""));
  if (!stock) {
    return {
      result: {
        error: "unsupported_asset",
        message: `That asset is not supported. Supported assets are ${supportedTickerList}.`,
      },
    };
  }

  const usdAmount = Number(input.usd_amount);
  if (!Number.isFinite(usdAmount) || usdAmount < 1 || usdAmount > 500) {
    return {
      result: {
        error: "invalid_amount",
        message: "Ask the person for an amount between 1 and 500 dollars.",
      },
    };
  }

  const [solPrice, stockPrices] = await Promise.all([
    getSolUsdPrice(),
    getUsdPrices([stock.mint]),
  ]);

  if (!solPrice || solPrice <= 0) {
    return {
      result: { error: "price_unavailable", message: "The SOL price feed is unavailable." },
    };
  }

  const solAmount = round(usdAmount / solPrice, 6);
  const snapshot = await getBalanceSnapshot(address, solPrice);

  if (snapshot.sol < solAmount + FEE_BUFFER_SOL) {
    return {
      result: {
        error: "insufficient_balance",
        message: "There is not enough SOL in the wallet for this purchase.",
        sol_balance: round(snapshot.sol, 6),
        sol_needed: solAmount,
        usd_shortfall: round(Math.max(0, usdAmount - snapshot.sol * solPrice), 2),
        next_step: "Offer to buy SOL first with start_onramp.",
      },
    };
  }

  const sharePrice = stockPrices.get(stock.mint) ?? null;
  const estimatedShares = sharePrice && sharePrice > 0 ? round(usdAmount / sharePrice, 6) : 0;

  return {
    result: {
      prepared: true,
      requires_confirmation: true,
      ticker: stock.ticker,
      company: stock.name,
      usd_amount: usdAmount,
      sol_amount: solAmount,
      price_per_share_usd: sharePrice === null ? null : round(sharePrice, 2),
      estimated_shares: estimatedShares,
      settles_against_demo_vault: demoMode,
      next_step:
        "Tell the person the company, the dollar amount and roughly how much of a share that buys, then ask them to say yes to confirm or no to cancel. Do not call confirm_pending_action yet.",
    },
    pendingAction: {
      kind: "buy_stock",
      summary: `Buy ${usdAmount} dollars of ${stock.name}`,
      ticker: stock.ticker,
      name: stock.name,
      mint: stock.mint,
      usdAmount,
      solAmount,
      estimatedShares,
      pricePerShareUsd: sharePrice,
    },
  };
}

async function runCheckPaymentStatus(
  input: { session_id?: unknown },
  ctx: ToolContext,
): Promise<ToolOutcome> {
  const address = requireWallet(ctx);
  const sessionId =
    (typeof input.session_id === "string" && input.session_id) || ctx.lastPaymentSessionId;

  if (!sessionId || !address) {
    return {
      result: {
        error: "no_session",
        message: "There is no card payment in progress.",
      },
    };
  }

  const solPrice = await getSolUsdPrice();
  const session = await resolvePaymentStatus(
    getOrRecoverSession(sessionId, { walletAddress: address, usdAmount: 0 }),
    solPrice,
  );

  return {
    result: {
      status: session.status,
      usd_amount: session.usdAmount || null,
      sol_delivered: session.solDelivered,
      failure_reason: session.failureReason,
      message:
        session.status === "completed"
          ? "The payment settled and the SOL is in the wallet."
          : session.status === "failed"
            ? "The payment did not go through and nothing was charged. Say so plainly and offer to try again. Do not read out any technical detail."
            : "The payment has not settled yet. Tell the person you will announce it the moment it lands.",
    },
  };
}

async function runConfirm(ctx: ToolContext): Promise<ToolOutcome> {
  const pending = ctx.pendingAction;
  if (!pending) {
    return {
      result: {
        error: "nothing_pending",
        message: "There is no prepared action to confirm. Ask what they would like to do.",
      },
    };
  }

  if (pending.kind === "onramp") {
    return {
      result: {
        executed: true,
        action: "opened_payment_sheet",
        usd_amount: pending.usdAmount,
        message:
          "The payment sheet is opening on the device. Tell the person to complete the payment with Apple Pay or Google Pay, and that you will announce it when the SOL arrives.",
      },
      pendingAction: null,
      clientAction: {
        type: "open_onramp",
        url: pending.widgetUrl,
        sessionId: pending.sessionId,
        usdAmount: pending.usdAmount,
      },
    };
  }

  const address = requireWallet(ctx);
  if (!address) {
    return { result: { error: "no_wallet", message: "The wallet is not ready yet." } };
  }

  const stock = findStock(pending.ticker);
  if (!stock) {
    return { result: { error: "unsupported_asset", message: "That asset is no longer supported." } };
  }

  try {
    const prepared = await prepareStockPurchase({
      userPublicKey: address,
      stock,
      solAmount: pending.solAmount,
    });

    const shares = pending.estimatedShares
      ? `about ${pending.estimatedShares.toFixed(4)} of a share of `
      : "";

    return {
      result: {
        executed: true,
        action: "awaiting_signature",
        ticker: pending.ticker,
        usd_amount: pending.usdAmount,
        message:
          "The purchase is built and the wallet is signing it now. Tell the person it is going through and that you will confirm when it settles.",
      },
      pendingAction: null,
      clientAction: {
        type: "sign_and_send",
        transactionBase64: prepared.transactionBase64,
        label: pending.summary,
        successMessage: `Done. You bought ${shares}${pending.name} for ${pending.usdAmount} dollars. Would you like to hear your balance?`,
      },
    };
  } catch (error) {
    return {
      result: {
        error: "build_failed",
        message:
          error instanceof Error
            ? `Building the purchase failed: ${error.message}`
            : "Building the purchase failed.",
      },
      pendingAction: null,
    };
  }
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolOutcome> {
  switch (name) {
    case "explain": {
      const topic = String(input.topic ?? "") as ExplainTopic;
      const text = explanations[topic];
      return {
        result: text
          ? { topic, explanation: text, instruction: "Rephrase this in your own spoken words." }
          : { error: "unknown_topic", message: "Answer from your own knowledge, staying in scope." },
      };
    }
    case "get_balance":
      return runGetBalance(ctx);
    case "start_onramp":
      return runStartOnramp(input, ctx);
    case "check_payment_status":
      return runCheckPaymentStatus(input, ctx);
    case "buy_stock":
      return runBuyStock(input, ctx);
    case "confirm_pending_action":
      return runConfirm(ctx);
    case "cancel_action":
      return {
        result: {
          cancelled: true,
          message: "The action was discarded. Confirm out loud that nothing was bought.",
        },
        pendingAction: null,
      };
    default:
      return { result: { error: "unknown_tool", message: `No tool named ${name}.` } };
  }
}
