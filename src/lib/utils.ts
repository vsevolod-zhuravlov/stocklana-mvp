import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 1) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

/**
 * Screen readers read a raw address as one long token. Splitting it into
 * spaced characters makes the shortened form intelligible when spoken.
 */
export function spellForSpeech(value: string): string {
  return value.split("").join(" ");
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSol(value: number): string {
  return `${value.toFixed(value < 1 ? 4 : 3)} SOL`;
}
