export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface WalletContext {
  address: string | null;
  email: string | null;
}

export interface TokenBalance {
  symbol: string;
  mint: string;
  amount: number;
  usdValue: number | null;
}

export interface BalanceSnapshot {
  address: string;
  cluster: string;
  sol: number;
  solUsdValue: number | null;
  tokens: TokenBalance[];
}

/**
 * An action the assistant has proposed but not yet executed. It is held on the
 * client and echoed back with each turn so the API routes stay stateless and
 * survive serverless cold starts.
 */
export type PendingAction =
  | {
      kind: "onramp";
      /** Spoken one-line description used for the confirmation prompt. */
      summary: string;
      usdAmount: number;
      sessionId: string;
      widgetUrl: string;
    }
  | {
      kind: "buy_stock";
      summary: string;
      ticker: string;
      name: string;
      mint: string;
      usdAmount: number;
      solAmount: number;
      estimatedShares: number;
      pricePerShareUsd: number | null;
    };

/** Instruction returned to the browser: work that must happen client-side. */
export type ClientAction =
  | { type: "open_onramp"; url: string; sessionId: string; usdAmount: number }
  | {
      type: "sign_and_send";
      transactionBase64: string;
      label: string;
      /** Spoken after the transaction confirms on-chain. */
      successMessage: string;
    };

export interface ChatRequestBody {
  messages: ChatMessage[];
  wallet: WalletContext;
  pendingAction: PendingAction | null;
}

export interface ChatResponseBody {
  /** Natural-language reply, announced through the aria-live region. */
  reply: string;
  pendingAction: PendingAction | null;
  clientAction: ClientAction | null;
  /** Names of tools the model invoked, shown in the visual transcript. */
  toolsUsed: string[];
}

export type PaymentStatus = "pending" | "processing" | "completed" | "failed";

export interface PaymentSession {
  sessionId: string;
  walletAddress: string;
  usdAmount: number;
  status: PaymentStatus;
  createdAt: number;
  /** Set once the user dismisses the payment sheet; drives demo settlement. */
  settleAfter: number | null;
  solDelivered: number | null;
  signature: string | null;
  failureReason: string | null;
}
