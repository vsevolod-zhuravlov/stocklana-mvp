import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import { ServiceWorker } from "@/components/ServiceWorker";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Stocklana — the wallet that talks back",
  description:
    "A voice-first Solana wallet you can use with your eyes closed. Create a wallet, buy SOL and buy tokenized stocks by talking to an AI guide.",
  manifest: "/manifest.webmanifest",
  applicationName: "Stocklana",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Stocklana" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#05070c",
  width: "device-width",
  initialScale: 1,
  // Never block zoom: low-vision users rely on it, and it is a WCAG failure.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
