"use client";

import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import bs58 from "bs58";
import { Send } from "lucide-react";
import * as React from "react";

import { BalanceCard } from "@/components/BalanceCard";
import { ConfirmBar } from "@/components/ConfirmBar";
import { useAnnouncer } from "@/components/LiveAnnouncer";
import { OnrampDialog } from "@/components/OnrampDialog";
import { PushToTalk } from "@/components/PushToTalk";
import { Transcript, type UiMessage } from "@/components/Transcript";
import { Button } from "@/components/ui/button";
import {
  speechErrorMessage,
  useSpeechRecognition,
  type SpeechErrorKind,
} from "@/hooks/useSpeechRecognition";
import { clientDemoMode, clientExplorerUrl, privyChain } from "@/lib/clientConfig";
import { earconError, earconListenStart, earconListenStop, earconSuccess } from "@/lib/earcons";
import type {
  BalanceSnapshot,
  ChatResponseBody,
  ClientAction,
  PendingAction,
} from "@/lib/types";

const GREETING_PROMPT =
  "[The app just opened and this person's wallet is ready. They may be blind and listening with the screen off, and they may never have used crypto. Greet them in two or three short sentences: say their wallet is ready and needs no seed phrase, say you can explain anything or help them buy SOL and then a stock, and ask what they would like to do.]";

const QUICK_ACTIONS = [
  { label: "What is this?", utterance: "What is this app and what can you do for me?" },
  { label: "Check my balance", utterance: "What is my balance?" },
  { label: "Buy $10 of SOL", utterance: "I want to buy 10 dollars of SOL" },
  { label: "Buy $5 of Apple", utterance: "I want to buy 5 dollars of Apple stock" },
  { label: "Is this safe?", utterance: "Is this safe? Who can access my money?" },
];

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let messageCounter = 0;
function nextId(): string {
  messageCounter += 1;
  return `m${messageCounter}`;
}

interface ConversationScreenProps {
  address: string;
  email: string | null;
  onLogout: () => void;
}

export function ConversationScreen({ address, email, onLogout }: ConversationScreenProps) {
  const { announce } = useAnnouncer();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();

  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [pendingAction, setPendingAction] = React.useState<PendingAction | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [snapshot, setSnapshot] = React.useState<BalanceSnapshot | null>(null);
  const [balanceLoading, setBalanceLoading] = React.useState(false);
  const [onramp, setOnramp] = React.useState<{
    url: string;
    sessionId: string;
    usdAmount: number;
  } | null>(null);
  const [typed, setTyped] = React.useState("");

  const pushToTalkRef = React.useRef<HTMLButtonElement>(null);
  const pollRef = React.useRef<number | null>(null);

  // Mirrors of state for use inside callbacks that must not re-create on every
  // keystroke; the speech recogniser holds onto its handlers for its lifetime.
  // Synced after commit, which is always before any event handler can read them.
  const messagesRef = React.useRef(messages);
  const pendingRef = React.useRef(pendingAction);
  const busyRef = React.useRef(busy);
  const sessionRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    messagesRef.current = messages;
    pendingRef.current = pendingAction;
    busyRef.current = busy;
  }, [busy, messages, pendingAction]);

  const refreshBalance = React.useCallback(async () => {
    setBalanceLoading(true);
    try {
      const response = await fetch(`/api/balance?address=${address}`);
      if (response.ok) setSnapshot((await response.json()) as BalanceSnapshot);
    } catch {
      // A stale balance card is not worth interrupting the user over; the
      // assistant reads balances from the server on demand anyway.
    } finally {
      setBalanceLoading(false);
    }
  }, [address]);

  const appendAssistant = React.useCallback((content: string) => {
    setMessages((current) => [...current, { id: nextId(), role: "assistant", content }]);
  }, []);

  const signAndSend = React.useCallback(
    async (action: Extract<ClientAction, { type: "sign_and_send" }>) => {
      const wallet = wallets[0];
      if (!wallet) {
        earconError();
        const message = "Your wallet isn't ready to sign yet. Please try again in a moment.";
        appendAssistant(message);
        announce(message);
        return;
      }

      try {
        const { signature } = await signAndSendTransaction({
          transaction: base64ToBytes(action.transactionBase64),
          wallet,
          chain: privyChain,
        });

        earconSuccess();
        appendAssistant(action.successMessage);
        announce(action.successMessage);

        const encoded = bs58.encode(signature);
        console.info("[stocklana] transaction confirmed", clientExplorerUrl(encoded));
        void refreshBalance();
      } catch (error) {
        earconError();
        const rejected =
          error instanceof Error && /reject|denied|cancel/i.test(error.message);
        const message = rejected
          ? "That was cancelled, so nothing was bought and nothing was charged."
          : "The purchase didn't go through, so nothing was bought. Would you like to try again?";
        appendAssistant(message);
        announce(message);
      }
    },
    [announce, appendAssistant, refreshBalance, signAndSendTransaction, wallets],
  );

  const handleClientAction = React.useCallback(
    async (action: ClientAction) => {
      if (action.type === "open_onramp") {
        sessionRef.current = action.sessionId;
        setOnramp({ url: action.url, sessionId: action.sessionId, usdAmount: action.usdAmount });
        return;
      }
      await signAndSend(action);
    },
    [signAndSend],
  );

  const sendToAgent = React.useCallback(
    async (text: string, options?: { hidden?: boolean }) => {
      if (busyRef.current) return;

      const outgoing: UiMessage = {
        id: nextId(),
        role: "user",
        content: text,
        hidden: options?.hidden,
      };
      const history = [...messagesRef.current, outgoing];

      setMessages(history);
      setBusy(true);
      busyRef.current = true;

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map(({ role, content }) => ({ role, content })),
            wallet: { address, email },
            pendingAction: pendingRef.current,
            lastPaymentSessionId: sessionRef.current,
          }),
        });

        if (!response.ok) throw new Error(`chat failed with ${response.status}`);

        const data = (await response.json()) as ChatResponseBody;

        appendAssistant(data.reply);
        announce(data.reply);
        setPendingAction(data.pendingAction);
        pendingRef.current = data.pendingAction;

        if (data.clientAction) await handleClientAction(data.clientAction);
      } catch {
        earconError();
        const message =
          "I couldn't reach the assistant just then. Nothing was bought. Please check your connection and try again.";
        appendAssistant(message);
        announce(message);
      } finally {
        setBusy(false);
        busyRef.current = false;
      }
    },
    [address, announce, appendAssistant, email, handleClientAction],
  );

  const handleSpeechError = React.useCallback(
    (kind: SpeechErrorKind) => {
      earconError();
      announce(speechErrorMessage(kind));
    },
    [announce],
  );

  const handleFinalTranscript = React.useCallback(
    (transcript: string) => {
      earconListenStop();
      void sendToAgent(transcript);
    },
    [sendToAgent],
  );

  const speech = useSpeechRecognition({
    onFinalTranscript: handleFinalTranscript,
    onError: handleSpeechError,
  });

  const toggleListening = React.useCallback(() => {
    if (speech.listening) {
      speech.stop();
      return;
    }
    if (!speech.supported) {
      handleSpeechError("unsupported");
      document.getElementById("typed-input")?.focus();
      return;
    }
    earconListenStart();
    speech.start();
  }, [handleSpeechError, speech]);

  // Proactive greeting: the app starts talking the moment the wallet exists,
  // so a user with the screen off knows where they are without exploring.
  const greetedRef = React.useRef(false);
  React.useEffect(() => {
    if (greetedRef.current || !address) return;
    greetedRef.current = true;
    void sendToAgent(GREETING_PROMPT, { hidden: true });
    void refreshBalance();
  }, [address, refreshBalance, sendToAgent]);

  const stopPolling = React.useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /**
   * Once the payment sheet closes the user has no way to see that their
   * deposit landed, so the app watches for settlement and announces it
   * unprompted rather than waiting to be asked.
   */
  const watchPayment = React.useCallback(
    (sessionId: string, usdAmount: number) => {
      stopPolling();

      const startedAt = Date.now();
      const query = `sessionId=${sessionId}&address=${address}&usd=${usdAmount}&sheetClosed=true`;

      pollRef.current = window.setInterval(async () => {
        if (Date.now() - startedAt > 120_000) {
          stopPolling();
          announce(
            "Your payment is still processing. Ask me to check it again in a minute.",
            "polite",
          );
          return;
        }

        try {
          const response = await fetch(`/api/onramp/status?${query}`);
          if (!response.ok) return;

          const data = (await response.json()) as {
            status: string;
            announcement: string | null;
          };

          if (data.status === "completed" || data.status === "failed") {
            stopPolling();
            if (data.status === "completed") earconSuccess();
            else earconError();
            if (data.announcement) {
              appendAssistant(data.announcement);
              announce(data.announcement);
            }
            void refreshBalance();
          }
        } catch {
          // Transient network blips are expected while the payment sheet is
          // still tearing down; the next tick retries.
        }
      }, 3000);
    },
    [address, announce, appendAssistant, refreshBalance, stopPolling],
  );

  React.useEffect(() => stopPolling, [stopPolling]);

  const closeOnramp = React.useCallback(() => {
    const session = onramp;
    setOnramp(null);
    // Focus must come back into the app: after a system payment sheet closes,
    // the screen reader's cursor is otherwise left on the dismissed dialog.
    window.setTimeout(() => pushToTalkRef.current?.focus(), 50);

    if (session) {
      announce("Checking your payment. I'll tell you as soon as your SOL arrives.", "polite");
      watchPayment(session.sessionId, session.usdAmount);
    }
  }, [announce, onramp, watchPayment]);

  const submitTyped = React.useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const text = typed.trim();
      if (!text) return;
      setTyped("");
      void sendToAgent(text);
    },
    [sendToAgent, typed],
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-4 p-4 pb-6">
      <a
        href="#push-to-talk-region"
        className="sr-only focus:not-sr-only focus:block focus:rounded-xl focus:bg-accent-500 focus:p-3 focus:text-ink-950"
      >
        Skip to the talk button
      </a>

      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Stocklana</h1>
          <p className="text-sm text-mist-400">
            {clientDemoMode ? "Test network — no real money" : "Live network"}
          </p>
        </div>
        <Button variant="ghost" className="min-h-12 px-4 text-sm" onClick={onLogout}>
          Sign out
        </Button>
      </header>

      <BalanceCard address={address} snapshot={snapshot} loading={balanceLoading} />

      <Transcript messages={messages} interim={speech.interim} />

      {pendingAction ? (
        <ConfirmBar
          pending={pendingAction}
          disabled={busy}
          onConfirm={() => void sendToAgent("Yes, I confirm. Go ahead.")}
          onCancel={() => void sendToAgent("No, cancel that.")}
        />
      ) : null}

      <div id="push-to-talk-region" className="flex flex-col gap-3">
        <PushToTalk
          ref={pushToTalkRef}
          listening={speech.listening}
          busy={busy}
          supported={speech.supported}
          onToggle={toggleListening}
        />
        <p id="push-to-talk-hint" className="text-center text-sm text-mist-400">
          {speech.supported
            ? "Tap once to start speaking, tap again to send. You can also type or use the buttons below."
            : "Speech isn't available in this browser. Type your message or use the buttons below."}
        </p>

        <nav aria-label="Suggested things to say" className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.label}
              variant="ghost"
              className="min-h-12 flex-1 basis-[45%] px-3 text-sm"
              disabled={busy}
              onClick={() => void sendToAgent(action.utterance)}
            >
              {action.label}
            </Button>
          ))}
        </nav>

        <form onSubmit={submitTyped} className="flex gap-2">
          <label htmlFor="typed-input" className="sr-only">
            Type a message to the assistant
          </label>
          <input
            id="typed-input"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Or type here"
            autoComplete="off"
            disabled={busy}
            className="min-h-14 flex-1 rounded-2xl bg-ink-850 px-4 text-base text-mist-50 ring-1 ring-ink-700 placeholder:text-mist-400/70"
          />
          <Button type="submit" disabled={busy || !typed.trim()} aria-label="Send message">
            <Send aria-hidden="true" className="size-5" />
          </Button>
        </form>
      </div>

      {onramp ? (
        <OnrampDialog url={onramp.url} usdAmount={onramp.usdAmount} onClose={closeOnramp} />
      ) : null}
    </div>
  );
}
