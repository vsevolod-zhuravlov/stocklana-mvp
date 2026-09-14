import type { Metadata } from "next";

import { Providers } from "@/components/Providers";
import { privyAppId } from "@/lib/clientConfig";

export const metadata: Metadata = {
  title: "Stocklana",
  // The app itself is a private session; keep it out of search results.
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  if (!privyAppId) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-bold">Setup needed</h1>
        <p className="text-mist-200">
          Set <code className="rounded bg-ink-850 px-1.5 py-0.5">NEXT_PUBLIC_PRIVY_APP_ID</code> in
          your environment and reload. See the README for the full list of keys.
        </p>
      </main>
    );
  }

  return <Providers appId={privyAppId}>{children}</Providers>;
}
