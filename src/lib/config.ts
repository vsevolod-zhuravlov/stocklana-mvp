/**
 * Central configuration. Anything read from `process.env` lives here so that a
 * missing key surfaces as one clear error instead of an `undefined` deep in a
 * request handler.
 */

export type Cluster = "devnet" | "mainnet-beta";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const cluster: Cluster =
  env("NEXT_PUBLIC_SOLANA_CLUSTER") === "mainnet-beta" ? "mainnet-beta" : "devnet";

export const isDevnet = cluster === "devnet";

const defaultRpc =
  cluster === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com";

/** Server-side RPC. Use Helius/QuickNode — the public endpoint is rate limited. */
export const rpcUrl = env("SOLANA_RPC_URL") ?? defaultRpc;

/** Client-side RPC, used only for confirming transactions the browser submits. */
export const publicRpcUrl = env("NEXT_PUBLIC_SOLANA_RPC_URL") ?? defaultRpc;

export const llm = {
  provider: (env("LLM_PROVIDER") ?? "anthropic") as "anthropic" | "openai",
  anthropicApiKey: env("ANTHROPIC_API_KEY"),
  anthropicModel: env("ANTHROPIC_MODEL") ?? "claude-sonnet-5",
  openaiApiKey: env("OPENAI_API_KEY"),
  openaiModel: env("OPENAI_MODEL") ?? "gpt-4.1",
  /** Point at any OpenAI-compatible endpoint (OpenRouter, a local model, a test double). */
  openaiBaseUrl: env("OPENAI_BASE_URL"),
};

export const onramper = {
  apiKey: env("NEXT_PUBLIC_ONRAMPER_API_KEY"),
  widgetBase: env("NEXT_PUBLIC_ONRAMPER_WIDGET_BASE") ?? "https://buy.onramper.com",
  webhookSecret: env("ONRAMPER_WEBHOOK_SECRET"),
};

export const jupiter = {
  apiKey: env("JUPITER_API_KEY"),
  baseUrl: env("JUPITER_API_BASE") ?? (env("JUPITER_API_KEY") ? "https://api.jup.ag" : "https://lite-api.jup.ag"),
};

export const privy = {
  appId: env("NEXT_PUBLIC_PRIVY_APP_ID"),
  appSecret: env("PRIVY_APP_SECRET"),
};

/**
 * Demo mode keeps the full conversational flow working without real money:
 * card settlement is simulated with a devnet airdrop, and the tokenized-stock
 * leg settles against a demo vault because xStocks only exist on mainnet.
 */
export const demoMode = env("NEXT_PUBLIC_DEMO_MODE") !== "false" && isDevnet;

export function explorerUrl(signature: string): string {
  const suffix = cluster === "devnet" ? "?cluster=devnet" : "";
  return `https://explorer.solana.com/tx/${signature}${suffix}`;
}
