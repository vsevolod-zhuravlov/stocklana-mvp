import { NextResponse } from "next/server";
import { z } from "zod";

import { LlmNotConfiguredError, runAgent } from "@/lib/agent/run";
import type { ChatRequestBody } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const pendingActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("onramp"),
    summary: z.string(),
    usdAmount: z.number(),
    sessionId: z.string(),
    widgetUrl: z.string(),
  }),
  z.object({
    kind: z.literal("buy_stock"),
    summary: z.string(),
    ticker: z.string(),
    name: z.string(),
    mint: z.string(),
    usdAmount: z.number(),
    solAmount: z.number(),
    estimatedShares: z.number(),
    pricePerShareUsd: z.number().nullable(),
  }),
]);

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .min(1)
    // Voice sessions stay short; trimming keeps latency and token cost down.
    .max(40),
  wallet: z.object({
    address: z.string().nullable(),
    email: z.string().nullable(),
  }),
  pendingAction: pendingActionSchema.nullable(),
  lastPaymentSessionId: z.string().nullable().optional(),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const result = await runAgent(parsed as ChatRequestBody, {
      origin: new URL(request.url).origin,
      lastPaymentSessionId: parsed.lastPaymentSessionId ?? null,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof LlmNotConfiguredError) {
      return NextResponse.json(
        {
          reply:
            "The assistant is not connected yet because its API key is missing. Add it to the environment and reload.",
          pendingAction: parsed.pendingAction,
          clientAction: null,
          toolsUsed: [],
        },
        { status: 200 },
      );
    }

    console.error("[chat] agent failed", error);
    return NextResponse.json(
      {
        reply:
          "Something went wrong on my side and I couldn't finish that. Nothing was bought. Please try again.",
        pendingAction: null,
        clientAction: null,
        toolsUsed: [],
      },
      { status: 200 },
    );
  }
}
