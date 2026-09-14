import { ArrowRight, Ear, Hand, MessageSquare, ShieldCheck } from "lucide-react";
import Link from "next/link";

const demoVideoId = process.env.NEXT_PUBLIC_DEMO_VIDEO_ID;

const pillars = [
  {
    icon: MessageSquare,
    title: "A conversation, not a menu",
    body: "Claude drives the app through tool calling. Ask what a wallet is, ask whether it is safe, or say you want ten dollars of Apple — the same conversation handles all three. Nothing is a fixed voice command mapped to a fixed screen.",
  },
  {
    icon: Ear,
    title: "Your screen reader, your voice",
    body: "Replies land in an aria-live region, so TalkBack and VoiceOver read them in the voice and at the speed you already chose. No second synthetic voice talking over your own.",
  },
  {
    icon: ShieldCheck,
    title: "Nothing moves without a yes",
    body: "Every payment is read back to you with the exact amount before it happens, and it waits for a spoken yes or a tap on Confirm. The signing key never touches our servers.",
  },
  {
    icon: Hand,
    title: "Never only one way in",
    body: "Speech, a big tap target, suggestion buttons and a text box all reach the same assistant. Card payments go through Apple Pay or Google Pay so you never read a card number out loud.",
  },
];

const steps = [
  "Sign in with an email code or a passkey. A Solana wallet is created for you, with no seed phrase to write down.",
  "The app greets you out loud and explains what just happened before you have to ask anything.",
  "Say how much SOL you want. Your phone's own payment sheet opens, and the deposit is announced the moment it lands.",
  "Say which stock you want. You hear the amount and the share price, say yes, and the wallet signs it.",
];

export default function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:py-20">
      <header>
        <p className="text-sm font-semibold tracking-[0.2em] text-accent-400 uppercase">
          Stocklana
        </p>
        <h1 className="mt-4 text-4xl font-bold text-balance sm:text-6xl">
          The wallet that talks back.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-mist-200 sm:text-xl">
          Buying a tokenized share of Apple on Solana currently takes a browser extension, a seed
          phrase written on paper, and a dozen unlabelled buttons. If you are blind, that is not a
          bad experience — it is a closed door. Stocklana replaces the whole thing with a
          conversation you can have with the screen off.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/app"
            className="inline-flex min-h-16 items-center gap-2 rounded-2xl bg-accent-500 px-8 text-lg font-semibold text-ink-950 transition-colors hover:bg-accent-400"
          >
            Open the app
            <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
          <p className="text-sm text-mist-400">
            Runs on Solana devnet. Works best in Chrome on Android, installed to your home screen.
          </p>
        </div>
      </header>

      <section aria-labelledby="demo-heading" className="mt-16">
        <h2 id="demo-heading" className="text-2xl font-bold">
          Watch the demo
        </h2>
        <div className="mt-5 overflow-hidden rounded-3xl bg-ink-900 ring-1 ring-ink-800">
          {demoVideoId ? (
            <iframe
              className="aspect-video w-full"
              src={`https://www.youtube.com/embed/${demoVideoId}`}
              title="Stocklana demo: buying a tokenized stock entirely by voice"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <p className="flex aspect-video items-center justify-center p-8 text-center text-mist-400">
              Demo video coming soon. Set NEXT_PUBLIC_DEMO_VIDEO_ID to embed it here.
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="how-heading" className="mt-16">
        <h2 id="how-heading" className="text-2xl font-bold">
          How a session goes
        </h2>
        <ol className="mt-5 space-y-4">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-4 rounded-2xl bg-ink-900 p-5 ring-1 ring-ink-800">
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-500 font-bold text-ink-950"
              >
                {index + 1}
              </span>
              <p className="text-mist-200">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="pillars-heading" className="mt-16">
        <h2 id="pillars-heading" className="text-2xl font-bold">
          What makes it different
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {pillars.map((pillar) => (
            <article key={pillar.title} className="rounded-3xl bg-ink-900 p-6 ring-1 ring-ink-800">
              <pillar.icon aria-hidden="true" className="size-7 text-accent-400" />
              <h3 className="mt-4 text-lg font-semibold">{pillar.title}</h3>
              <p className="mt-2 leading-relaxed text-mist-200">{pillar.body}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="mt-16 border-t border-ink-800 pt-8 text-sm leading-relaxed text-mist-400">
        <p>
          Hackathon demo. It runs on Solana devnet with the card provider in sandbox mode, so no
          real money moves. Tokenized stocks are issued by Backed Finance and exist on Solana
          mainnet; on devnet the stock leg settles against a demo vault so the full signing and
          confirmation path can be exercised safely.
        </p>
        <p className="mt-3">Not investment advice.</p>
      </footer>
    </div>
  );
}
