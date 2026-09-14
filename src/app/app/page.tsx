"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useCreateWallet, useWallets } from "@privy-io/react-auth/solana";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { ConversationScreen } from "@/components/ConversationScreen";
import { useAnnouncer } from "@/components/LiveAnnouncer";
import { Button } from "@/components/ui/button";
import { clientDemoMode } from "@/lib/clientConfig";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-6">
      {children}
    </main>
  );
}

export default function AppPage() {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { ready: walletsReady, wallets } = useWallets();
  const { createWallet } = useCreateWallet();
  const { announce } = useAnnouncer();

  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const wallet = wallets[0] ?? null;
  const email = user?.email?.address ?? null;

  // Privy is configured to create the wallet on login, but a user who
  // dismissed that step would otherwise be stuck; retry once automatically.
  const attemptedRef = React.useRef(false);
  React.useEffect(() => {
    if (!ready || !authenticated || !walletsReady || wallet || attemptedRef.current) return;

    attemptedRef.current = true;
    setCreating(true);
    createWallet()
      .catch((error: unknown) => {
        setCreateError(
          error instanceof Error ? error.message : "Your wallet could not be created.",
        );
      })
      .finally(() => setCreating(false));
  }, [authenticated, createWallet, ready, wallet, walletsReady]);

  if (!ready) {
    return (
      <Centered>
        <p role="status" className="flex items-center gap-3 text-lg">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          Starting Stocklana…
        </p>
      </Centered>
    );
  }

  if (!authenticated) {
    return (
      <Centered>
        <div>
          <h1 className="text-3xl font-bold">Stocklana</h1>
          <p className="mt-3 text-lg text-mist-200">
            A wallet you can use with your eyes closed. Sign in with your email or a passkey and
            a Solana wallet is created for you. There is no seed phrase to write down and no
            browser extension to install.
          </p>
          {clientDemoMode ? (
            <p className="mt-3 text-base text-mist-400">
              This demo runs on a Solana test network. No real money is involved.
            </p>
          ) : null}
        </div>

        <Button
          size="xl"
          onClick={() => {
            announce("Opening sign in. Enter your email address to get a code.");
            login();
          }}
        >
          Sign in and create my wallet
        </Button>
      </Centered>
    );
  }

  if (!wallet) {
    return (
      <Centered>
        <p role="status" className="flex items-center gap-3 text-lg">
          {creating ? <Loader2 aria-hidden="true" className="size-5 animate-spin" /> : null}
          {creating ? "Creating your wallet. This takes a few seconds…" : "Preparing your wallet…"}
        </p>
        {createError ? (
          <>
            <p role="alert" className="text-danger-400">
              {createError}
            </p>
            <Button
              size="lg"
              onClick={() => {
                attemptedRef.current = false;
                setCreateError(null);
              }}
            >
              Try again
            </Button>
          </>
        ) : null}
      </Centered>
    );
  }

  return (
    <main>
      <ConversationScreen address={wallet.address} email={email} onLogout={() => void logout()} />
    </main>
  );
}
