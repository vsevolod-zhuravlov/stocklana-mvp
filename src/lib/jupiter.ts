import { jupiter } from "@/lib/config";
import { WSOL_MINT } from "@/lib/solana/tokens";

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: unknown[];
}

function headers(): Record<string, string> {
  const base: Record<string, string> = { "Content-Type": "application/json" };
  if (jupiter.apiKey) base["x-api-key"] = jupiter.apiKey;
  return base;
}

async function jupFetch(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${jupiter.baseUrl}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers ?? {}) },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Jupiter ${path} failed (${response.status}): ${body.slice(0, 300)}`);
  }

  return response.json();
}

/**
 * USD prices keyed by mint. Prices always come from mainnet, even when the
 * wallet runs on devnet, so the assistant quotes real-world numbers.
 */
export async function getUsdPrices(mints: string[]): Promise<Map<string, number | null>> {
  const prices = new Map<string, number | null>();
  if (mints.length === 0) return prices;

  try {
    const payload = (await jupFetch(`/price/v3?ids=${mints.join(",")}`)) as Record<
      string,
      unknown
    >;
    // v3 returns a flat map; older deployments nest the map under `data`.
    const entries = (payload?.data as Record<string, unknown>) ?? payload;

    for (const mint of mints) {
      const entry = entries?.[mint] as { usdPrice?: number; price?: number | string } | undefined;
      const raw = entry?.usdPrice ?? entry?.price;
      const value = typeof raw === "string" ? Number.parseFloat(raw) : raw;
      prices.set(mint, typeof value === "number" && Number.isFinite(value) ? value : null);
    }
  } catch {
    for (const mint of mints) prices.set(mint, null);
  }

  return prices;
}

export async function getSolUsdPrice(): Promise<number | null> {
  return (await getUsdPrices([WSOL_MINT])).get(WSOL_MINT) ?? null;
}

export async function getQuote(params: {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps?: number;
}): Promise<JupiterQuote> {
  const query = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: String(Math.round(params.amount)),
    slippageBps: String(params.slippageBps ?? 100),
    restrictIntermediateTokens: "true",
  });

  return (await jupFetch(`/swap/v1/quote?${query.toString()}`)) as JupiterQuote;
}

/** Returns a base64 unsigned versioned transaction for the browser to sign. */
export async function buildSwapTransaction(
  quote: JupiterQuote,
  userPublicKey: string,
): Promise<string> {
  const payload = (await jupFetch("/swap/v1/swap", {
    method: "POST",
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: { maxLamports: 1_000_000, priorityLevel: "veryHigh" },
      },
    }),
  })) as { swapTransaction?: string };

  if (!payload.swapTransaction) {
    throw new Error("Jupiter did not return a swap transaction");
  }

  return payload.swapTransaction;
}
