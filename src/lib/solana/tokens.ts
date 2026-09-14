export const WSOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const LAMPORTS_PER_SOL = 1_000_000_000;

export interface TokenizedStock {
  ticker: string;
  /** Human name spoken aloud by the assistant. */
  name: string;
  /** Solana mainnet SPL mint for the xStocks tracker token. */
  mint: string;
  decimals: number;
  aliases: string[];
}

/**
 * xStocks (Backed Finance) tracker tokens. These exist on mainnet only, which
 * is why the devnet demo settles the stock leg against a vault instead — see
 * `buildBuyTransaction`.
 */
export const TOKENIZED_STOCKS: TokenizedStock[] = [
  {
    ticker: "AAPLX",
    name: "Apple",
    mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    decimals: 8,
    aliases: ["aapl", "aaplx", "apple", "apple stock", "apple inc"],
  },
  {
    ticker: "TSLAX",
    name: "Tesla",
    mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    decimals: 8,
    aliases: ["tsla", "tslax", "tesla", "tesla stock"],
  },
  {
    ticker: "NVDAX",
    name: "Nvidia",
    mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    decimals: 8,
    aliases: ["nvda", "nvdax", "nvidia", "nvidia stock"],
  },
  {
    ticker: "SPYX",
    name: "the S&P 500 index fund",
    mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
    decimals: 8,
    aliases: ["spy", "spyx", "s&p", "s and p", "sp500", "s&p 500", "index fund"],
  },
];

/** Resolves loose speech-to-text output ("apple", "A A P L") to a known asset. */
export function findStock(query: string): TokenizedStock | null {
  const needle = query.trim().toLowerCase().replace(/\s+/g, " ");
  if (!needle) return null;

  const direct = TOKENIZED_STOCKS.find(
    (s) => s.ticker.toLowerCase() === needle || s.aliases.includes(needle),
  );
  if (direct) return direct;

  // Speech recognition often spells tickers out: "a a p l" -> "aapl".
  const collapsed = needle.replace(/[^a-z0-9]/g, "");
  return (
    TOKENIZED_STOCKS.find(
      (s) =>
        s.ticker.toLowerCase().startsWith(collapsed) ||
        s.aliases.some((a) => a.replace(/[^a-z0-9]/g, "") === collapsed),
    ) ?? null
  );
}

export const supportedTickerList = TOKENIZED_STOCKS.map(
  (s) => `${s.ticker} (${s.name})`,
).join(", ");
