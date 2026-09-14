import { TOKENIZED_STOCKS } from "@/lib/solana/tokens";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const EXPLAIN_TOPICS = [
  "wallet",
  "sol",
  "solana",
  "tokenized_stock",
  "security",
  "fees",
  "onramp",
  "test_network",
] as const;

export type ExplainTopic = (typeof EXPLAIN_TOPICS)[number];

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "explain",
    description:
      "Fetch the house explanation of a core concept so your answer stays accurate and consistent. Use it whenever the person asks what something is or whether it is safe. Rephrase the result in your own spoken words.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: [...EXPLAIN_TOPICS],
          description: "The concept to explain.",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "get_balance",
    description:
      "Read the person's live on-chain balance: their SOL, its US dollar value, and any tokenized stock they hold.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "start_onramp",
    description:
      "PREPARE a purchase of SOL with fiat. Does not charge anything; it only sets up the payment and returns a summary you must read back for confirmation. Requires an explicit dollar amount from the person.",
    inputSchema: {
      type: "object",
      properties: {
        usd_amount: {
          type: "number",
          description: "Amount in US dollars the person said they want to spend, between 5 and 500.",
        },
      },
      required: ["usd_amount"],
    },
  },
  {
    name: "check_payment_status",
    description:
      "Check whether a card payment has settled and the SOL has landed in the wallet. Use it when the person asks if their money has arrived.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: {
          type: "string",
          description: "Identifier of the payment session. Omit to use the most recent one.",
        },
      },
    },
  },
  {
    name: "buy_stock",
    description:
      "PREPARE a purchase of a tokenized stock using SOL already in the wallet. Does not execute; it prices the trade and returns a summary you must read back for confirmation.",
    inputSchema: {
      type: "object",
      properties: {
        ticker: {
          type: "string",
          description: `Which stock to buy. Accepts a ticker or a company name, for example ${TOKENIZED_STOCKS.map((s) => s.name).join(", ")}.`,
        },
        usd_amount: {
          type: "number",
          description: "Amount in US dollars to invest, between 1 and 500.",
        },
      },
      required: ["ticker", "usd_amount"],
    },
  },
  {
    name: "confirm_pending_action",
    description:
      "Execute the action you previously prepared. Call this ONLY after the person has clearly agreed on their own turn, for example by saying yes, confirm, do it, or go ahead.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "cancel_action",
    description:
      "Discard the prepared action. Call this if the person says no, stop, cancel, wait, or changes their mind.",
    inputSchema: { type: "object", properties: {} },
  },
];
