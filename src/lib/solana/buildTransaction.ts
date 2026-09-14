import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import { isDevnet } from "@/lib/config";
import { buildSwapTransaction, getQuote, type JupiterQuote } from "@/lib/jupiter";
import { getConnection } from "@/lib/solana/rpc";
import { LAMPORTS_PER_SOL, WSOL_MINT, type TokenizedStock } from "@/lib/solana/tokens";

const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

/**
 * Where the devnet demo sends the SOL leg of a stock purchase. Defaults to the
 * Solana incinerator so the spend is real rather than a no-op self-transfer.
 */
const demoVault = new PublicKey(
  process.env.DEMO_VAULT_ADDRESS ?? "1nc1nerator11111111111111111111111111111111",
);

/**
 * Builds a devnet stand-in for the stock purchase: the quoted SOL really
 * leaves the wallet and a memo records the intended trade, so the signing,
 * confirmation and spoken-receipt path is exercised end to end. xStocks have
 * no devnet liquidity, so the real Jupiter swap only runs on mainnet.
 */
async function buildDemoPurchaseTransaction(
  userPublicKey: string,
  lamports: number,
  memo: string,
): Promise<string> {
  const payer = new PublicKey(userPublicKey);
  const { blockhash } = await getConnection().getLatestBlockhash("finalized");

  const instructions = [
    SystemProgram.transfer({ fromPubkey: payer, toPubkey: demoVault, lamports }),
    new TransactionInstruction({
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      programId: MEMO_PROGRAM_ID,
      data: Buffer.from(memo, "utf8"),
    }),
  ];

  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return Buffer.from(new VersionedTransaction(message).serialize()).toString("base64");
}

export interface PreparedPurchase {
  transactionBase64: string;
  /** True when the stock leg is a devnet stand-in rather than a Jupiter swap. */
  simulated: boolean;
  quote: JupiterQuote | null;
}

/**
 * Prepares the unsigned buy transaction. Called at confirmation time rather
 * than at quote time so the blockhash and route are fresh when the user signs.
 */
export async function prepareStockPurchase(params: {
  userPublicKey: string;
  stock: TokenizedStock;
  solAmount: number;
}): Promise<PreparedPurchase> {
  const lamports = Math.round(params.solAmount * LAMPORTS_PER_SOL);

  if (isDevnet) {
    const memo = `stocklana:BUY ${params.stock.ticker} ${params.solAmount.toFixed(6)} SOL`;
    return {
      transactionBase64: await buildDemoPurchaseTransaction(params.userPublicKey, lamports, memo),
      simulated: true,
      quote: null,
    };
  }

  const quote = await getQuote({
    inputMint: WSOL_MINT,
    outputMint: params.stock.mint,
    amount: lamports,
  });

  return {
    transactionBase64: await buildSwapTransaction(quote, params.userPublicKey),
    simulated: false,
    quote,
  };
}
