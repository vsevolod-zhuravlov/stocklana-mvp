import { onramper } from "@/lib/config";

export interface OnrampSessionInput {
  sessionId: string;
  walletAddress: string;
  email: string | null;
  usdAmount: number;
  redirectOrigin: string;
}

/**
 * Builds the Onramper widget URL.
 *
 * Apple Pay / Google Pay are requested first on purpose: dictating a card
 * number to a speech recogniser is both unreliable and a PCI problem, so the
 * native payment sheet is the only fully eyes-free path. Card entry stays
 * enabled as a fallback and the widget's own inputs carry `autocomplete`
 * attributes for browser autofill.
 */
export function buildOnrampUrl(input: OnrampSessionInput): string {
  const params = new URLSearchParams({
    apiKey: onramper.apiKey ?? "",
    mode: "buy",
    defaultCrypto: "sol_solana",
    onlyCryptos: "sol_solana",
    defaultFiat: "usd",
    defaultAmount: String(input.usdAmount),
    wallets: `sol_solana:${input.walletAddress}`,
    networkWallets: `solana:${input.walletAddress}`,
    onlyPaymentMethods: "applepay,googlepay,creditcard",
    partnerContext: input.sessionId,
    successRedirectUrl: `${input.redirectOrigin}/app?onramp=success&session=${input.sessionId}`,
    failureRedirectUrl: `${input.redirectOrigin}/app?onramp=failed&session=${input.sessionId}`,
  });

  if (input.email) params.set("email", input.email);

  return `${onramper.widgetBase}?${params.toString()}`;
}

export function onrampConfigured(): boolean {
  return Boolean(onramper.apiKey);
}
