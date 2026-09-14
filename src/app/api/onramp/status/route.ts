import { NextResponse } from "next/server";

import { getSolUsdPrice } from "@/lib/jupiter";
import { getOrRecoverSession, markSheetClosed, resolvePaymentStatus } from "@/lib/payments";

export const runtime = "nodejs";

/**
 * Polled by the client after the payment sheet opens. Returns the settlement
 * state plus a ready-to-speak line for the aria-live region, so a settled
 * payment is announced without the user asking.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sessionId = params.get("sessionId");
  const address = params.get("address");

  if (!sessionId || !address) {
    return NextResponse.json({ error: "Missing sessionId or address" }, { status: 400 });
  }

  const usdAmount = Number(params.get("usd") ?? "0");
  const sheetClosed = params.get("sheetClosed") === "true";

  try {
    let session = getOrRecoverSession(sessionId, {
      walletAddress: address,
      usdAmount: Number.isFinite(usdAmount) ? usdAmount : 0,
    });

    if (sheetClosed) session = markSheetClosed(session);

    session = await resolvePaymentStatus(session, await getSolUsdPrice());

    // Announcements are spoken verbatim, so they are assembled from known-good
    // sentences rather than interpolating error text or addresses.
    const delivered = session.solDelivered;
    const announcement =
      session.status === "completed"
        ? delivered
          ? `Your payment went through and ${delivered.toFixed(4)} SOL has landed in your wallet. Would you like to buy a stock with it now?`
          : "Your payment went through and your SOL has landed in your wallet. Would you like to buy a stock with it now?"
        : session.status === "failed"
          ? `That payment didn't go through and nothing was charged. ${session.failureReason ?? ""} Would you like to try again?`.replace(
              /\s+/g,
              " ",
            )
          : null;

    return NextResponse.json({
      status: session.status,
      solDelivered: session.solDelivered,
      signature: session.signature,
      announcement,
    });
  } catch (error) {
    console.error("[onramp/status] failed", error);
    return NextResponse.json({ error: "Status check failed" }, { status: 502 });
  }
}
