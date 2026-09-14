/**
 * Public configuration safe to ship in the browser bundle. Kept separate from
 * `config.ts` so no server-only secret is ever referenced from client code.
 */

export const clientCluster: "devnet" | "mainnet-beta" =
  process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";

/** Chain identifier expected by Privy's Solana signing hooks. */
export const privyChain: `solana:${string}` =
  clientCluster === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";

export const clientDemoMode =
  process.env.NEXT_PUBLIC_DEMO_MODE !== "false" && clientCluster === "devnet";

export const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function clientExplorerUrl(signature: string): string {
  const suffix = clientCluster === "devnet" ? "?cluster=devnet" : "";
  return `https://explorer.solana.com/tx/${signature}${suffix}`;
}
