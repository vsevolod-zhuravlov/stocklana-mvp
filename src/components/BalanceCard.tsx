"use client";

import { RefreshCw } from "lucide-react";

import { Card, CardTitle } from "@/components/ui/card";
import type { BalanceSnapshot } from "@/lib/types";
import { formatSol, formatUsd, shortenAddress, spellForSpeech } from "@/lib/utils";

interface BalanceCardProps {
  address: string;
  snapshot: BalanceSnapshot | null;
  loading: boolean;
}

export function BalanceCard({ address, snapshot, loading }: BalanceCardProps) {
  return (
    <Card aria-labelledby="balance-heading">
      <div className="flex items-center justify-between gap-3">
        <CardTitle id="balance-heading">Your wallet</CardTitle>
        {loading ? (
          <RefreshCw aria-hidden="true" className="size-4 animate-spin text-mist-400" />
        ) : null}
        <span className="sr-only" aria-live="off">
          {loading ? "Refreshing balance" : ""}
        </span>
      </div>

      <p className="mt-3 text-3xl font-bold tabular-nums">
        {snapshot ? formatSol(snapshot.sol) : "—"}
      </p>
      <p className="text-base text-mist-400">
        {snapshot?.solUsdValue !== null && snapshot?.solUsdValue !== undefined
          ? `worth about ${formatUsd(snapshot.solUsdValue)}`
          : "value unavailable"}
      </p>

      {snapshot && snapshot.tokens.length > 0 ? (
        <ul className="mt-4 space-y-2 border-t border-ink-800 pt-4">
          {snapshot.tokens.map((token) => (
            <li key={token.mint} className="flex items-baseline justify-between gap-3">
              <span className="font-semibold">{token.symbol}</span>
              <span className="text-mist-200 tabular-nums">
                {token.amount.toFixed(4)}
                {token.usdValue !== null ? ` · ${formatUsd(token.usdValue)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 border-t border-ink-800 pt-3 text-sm text-mist-400">
        <span aria-hidden="true">
          {shortenAddress(address)} on {snapshot?.cluster ?? "Solana"}
        </span>
        {/* Spelled out so the screen reader reads the address character by
            character rather than as one unintelligible word. */}
        <span className="sr-only">
          Wallet address starts {spellForSpeech(address.slice(0, 4))} and ends{" "}
          {spellForSpeech(address.slice(-4))}, on the {snapshot?.cluster ?? "Solana"} network.
        </span>
      </p>
    </Card>
  );
}
