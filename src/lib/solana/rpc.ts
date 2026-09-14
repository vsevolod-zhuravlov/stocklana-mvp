import { Connection, PublicKey } from "@solana/web3.js";

import { cluster, rpcUrl } from "@/lib/config";
import type { BalanceSnapshot, TokenBalance } from "@/lib/types";
import { LAMPORTS_PER_SOL, TOKENIZED_STOCKS } from "@/lib/solana/tokens";

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

let connection: Connection | null = null;

export function getConnection(): Connection {
  if (!connection) {
    connection = new Connection(rpcUrl, "confirmed");
  }
  return connection;
}

interface ParsedTokenAccount {
  account: {
    data: {
      parsed: {
        info: {
          mint: string;
          tokenAmount: { uiAmount: number | null };
        };
      };
    };
  };
}

async function readTokenBalances(owner: PublicKey): Promise<Map<string, number>> {
  const balances = new Map<string, number>();

  const results = await Promise.allSettled(
    [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].map((programId) =>
      getConnection().getParsedTokenAccountsByOwner(owner, { programId }),
    ),
  );

  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const { account } of result.value.value as unknown as ParsedTokenAccount[]) {
      const info = account.data.parsed.info;
      const amount = info.tokenAmount.uiAmount ?? 0;
      if (amount > 0) {
        balances.set(info.mint, (balances.get(info.mint) ?? 0) + amount);
      }
    }
  }

  return balances;
}

export async function getBalanceSnapshot(
  address: string,
  solUsdPrice: number | null,
  stockPrices: Map<string, number | null> = new Map(),
): Promise<BalanceSnapshot> {
  const owner = new PublicKey(address);

  const [lamports, tokenBalances] = await Promise.all([
    getConnection().getBalance(owner),
    readTokenBalances(owner),
  ]);

  const sol = lamports / LAMPORTS_PER_SOL;

  const tokens: TokenBalance[] = [];
  for (const stock of TOKENIZED_STOCKS) {
    const amount = tokenBalances.get(stock.mint);
    if (!amount) continue;
    const price = stockPrices.get(stock.mint) ?? null;
    tokens.push({
      symbol: stock.ticker,
      mint: stock.mint,
      amount,
      usdValue: price === null ? null : amount * price,
    });
  }

  return {
    address,
    cluster,
    sol,
    solUsdValue: solUsdPrice === null ? null : sol * solUsdPrice,
    tokens,
  };
}

/** Devnet-only faucet used to simulate on-ramp settlement during the demo. */
export async function requestDevnetAirdrop(address: string, sol: number): Promise<string> {
  const lamports = Math.round(sol * LAMPORTS_PER_SOL);
  const signature = await getConnection().requestAirdrop(new PublicKey(address), lamports);
  const blockhash = await getConnection().getLatestBlockhash();
  await getConnection().confirmTransaction({ signature, ...blockhash }, "confirmed");
  return signature;
}
