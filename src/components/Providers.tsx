"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import * as React from "react";

import { LiveAnnouncerProvider } from "@/components/LiveAnnouncer";

export function Providers({ appId, children }: { appId: string; children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        // Email OTP and passkeys only: both avoid a browser extension and
        // neither ever shows the user a seed phrase.
        loginMethods: ["email", "passkey"],
        embeddedWallets: {
          solana: { createOnLogin: "users-without-wallets" },
          ethereum: { createOnLogin: "off" },
        },
        appearance: {
          theme: "dark",
          accentColor: "#38a3f1",
          walletChainType: "solana-only",
          landingHeader: "Sign in to Stocklana",
        },
      }}
    >
      <LiveAnnouncerProvider>{children}</LiveAnnouncerProvider>
    </PrivyProvider>
  );
}
