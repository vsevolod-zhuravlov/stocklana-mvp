"use client";

import { Loader2, Mic, Square } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

interface PushToTalkProps {
  listening: boolean;
  busy: boolean;
  supported: boolean;
  onToggle: () => void;
}

/**
 * The primary control. It is a single full-width target so it can be found and
 * hit reliably with the screen off, and it toggles rather than requiring a
 * press-and-hold, because hold gestures are intercepted by TalkBack and
 * VoiceOver. It doubles as the tap-only fallback when speech recognition is
 * unavailable or keeps mishearing.
 */
export const PushToTalk = React.forwardRef<HTMLButtonElement, PushToTalkProps>(
  function PushToTalk({ listening, busy, supported, onToggle }, ref) {
    const label = busy
      ? "Working, please wait"
      : listening
        ? "Listening. Activate to stop and send"
        : supported
          ? "Hold a conversation. Activate to start speaking"
          : "Speech is unavailable. Activate to type instead";

    return (
      <button
        ref={ref}
        type="button"
        onClick={onToggle}
        disabled={busy}
        aria-pressed={listening}
        aria-label={label}
        aria-describedby="push-to-talk-hint"
        className={cn(
          "relative flex min-h-32 w-full flex-col items-center justify-center gap-3 rounded-[2rem] px-6 py-8 text-center font-semibold transition-colors",
          busy && "bg-ink-800 text-mist-400",
          !busy && listening && "listening-ring bg-danger-400 text-ink-950",
          !busy && !listening && "bg-accent-500 text-ink-950 hover:bg-accent-400",
        )}
      >
        <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-ink-950/15">
          {busy ? (
            <Loader2 className="size-8 animate-spin" />
          ) : listening ? (
            <Square className="size-7 fill-current" />
          ) : (
            <Mic className="size-8" />
          )}
        </span>
        <span aria-hidden="true" className="text-2xl">
          {busy ? "Thinking…" : listening ? "Listening — tap to send" : "Tap and speak"}
        </span>
      </button>
    );
  },
);
