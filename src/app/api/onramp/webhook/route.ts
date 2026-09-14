import { NextResponse } from "next/server";

import { onramper } from "@/lib/config";
import { getSession, updateSession } from "@/lib/payments";

export const runtime = "nodejs";

interface OnramperWebhookPayload {
  /** Onramper echoes the value we passed as `partnerContext`. */
  partnerContext?: string;
  status?: string;
  outAmount?: number;
  txHash?: string;
  failureReason?: string;
}

/**
 * Real settlement notifications from Onramper. The client also polls
 * `/api/onramp/status`, which picks up whatever this handler recorded.
 */
export async function POST(request: Request) {
  if (onramper.webhookSecret) {
    const provided =
      request.headers.get("x-onramper-signature") ?? request.headers.get("authorization");
    if (provided !== onramper.webhookSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: OnramperWebhookPayload;
  try {
    payload = (await request.json()) as OnramperWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const sessionId = payload.partnerContext;
  if (!sessionId || !getSession(sessionId)) {
    // Acknowledge unknown sessions so the provider stops retrying.
    return NextResponse.json({ received: true });
  }

  const status = (payload.status ?? "").toLowerCase();

  if (["completed", "success", "paid", "delivered"].includes(status)) {
    updateSession(sessionId, {
      status: "completed",
      solDelivered: payload.outAmount ?? null,
      signature: payload.txHash ?? null,
    });
  } else if (["failed", "cancelled", "canceled", "expired"].includes(status)) {
    updateSession(sessionId, {
      status: "failed",
      failureReason: payload.failureReason ?? "The provider declined the payment.",
    });
  } else {
    updateSession(sessionId, { status: "processing" });
  }

  return NextResponse.json({ received: true });
}
