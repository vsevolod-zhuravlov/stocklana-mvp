import { cluster, demoMode } from "@/lib/config";
import type { ExplainTopic } from "@/lib/agent/tools";

/**
 * Grounding notes for the `explain` tool. The model rewrites these into spoken
 * language; keeping the facts here stops explanations drifting between turns.
 */
export const explanations: Record<ExplainTopic, string> = {
  wallet:
    "A wallet is an account that holds digital money and proves it belongs to you. This one was created automatically when you signed in, so there is no seed phrase to memorise or write down. The key that authorises payments is held in secure hardware tied to your login, not by Stocklana, and nothing can leave the wallet without your confirmation.",
  sol: "SOL is the native currency of the Solana network. It does two jobs here: it pays the tiny network fee for each transaction, usually a fraction of a cent, and it is what you trade for a tokenized stock. Its price moves up and down like any currency.",
  solana:
    "Solana is a public payment network that anyone can use. Transactions usually settle in under a second and cost a fraction of a cent, which is what makes buying a few dollars of something worthwhile. It runs continuously, including at weekends.",
  tokenized_stock:
    "A tokenized stock is a token that tracks the price of a real share, issued by a regulated company that holds the actual shares in custody. Buying one gives you price exposure to that company and you can buy a fraction of a share. It is not the same as owning the share directly, so you generally do not get shareholder voting rights.",
  security:
    "Three things keep this safe. The key that signs payments never reaches Stocklana's servers, so no one here can move your money. Every payment needs your spoken or tapped confirmation first, and you always hear the exact amount before it happens. And you can leave at any time by exporting your wallet to another app.",
  fees: "There are two kinds of cost. The Solana network fee is tiny, normally well under a cent per transaction. When you buy SOL with a card, the payment provider takes a percentage fee, and when you swap SOL for a stock token there is a small price spread. You always hear the amount you are spending before you confirm.",
  onramp:
    "Buying SOL with money means handing the card payment to a regulated payment provider. Your phone's own payment sheet, Apple Pay or Google Pay, handles it, so you never have to read a card number out loud. Once the payment settles, the SOL arrives in your wallet and you will be told out loud.",
  test_network: demoMode
    ? `This demo runs on Solana ${cluster}, a free test network. The SOL is test SOL with no real value, the card payment runs in the provider's sandbox, and the stock purchase settles against a demo vault because tokenized stocks only exist on the main network. Nothing here involves real money.`
    : `This is running on Solana ${cluster} with real funds, so every amount you confirm is real money.`,
};
