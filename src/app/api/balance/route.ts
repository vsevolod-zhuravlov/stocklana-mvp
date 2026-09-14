import { NextResponse } from "next/server";

import { getSolUsdPrice, getUsdPrices } from "@/lib/jupiter";
import { getBalanceSnapshot } from "@/lib/solana/rpc";
import { TOKENIZED_STOCKS } from "@/lib/solana/tokens";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  try {
    const [solPrice, stockPrices] = await Promise.all([
      getSolUsdPrice(),
      getUsdPrices(TOKENIZED_STOCKS.map((stock) => stock.mint)),
    ]);
    return NextResponse.json(await getBalanceSnapshot(address, solPrice, stockPrices));
  } catch (error) {
    console.error("[balance] lookup failed", error);
    return NextResponse.json({ error: "Balance lookup failed" }, { status: 502 });
  }
}
