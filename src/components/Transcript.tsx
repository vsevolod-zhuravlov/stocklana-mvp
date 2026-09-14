"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Prompts the app sends on the user's behalf are not shown or read back. */
  hidden?: boolean;
}

interface TranscriptProps {
  messages: UiMessage[];
  interim: string;
}

export function Transcript({ messages, interim }: TranscriptProps) {
  const endRef = React.useRef<HTMLDivElement>(null);
  const visible = messages.filter((message) => !message.hidden);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [visible.length, interim]);

  return (
    /*
      `aria-live="off"` is deliberate. New replies are announced once through
      the dedicated live region in LiveAnnouncer; if this log announced them
      too, every answer would be spoken twice. `role="log"` keeps the history
      fully navigable for anyone who wants to review it.
    */
    <div
      role="log"
      aria-live="off"
      aria-label="Conversation history"
      className="flex flex-1 flex-col gap-3 overflow-y-auto"
    >
      {visible.map((message) => (
        <div
          key={message.id}
          className={cn(
            "max-w-[90%] rounded-2xl px-4 py-3 text-base leading-relaxed",
            message.role === "user"
              ? "self-end bg-ink-700 text-mist-50"
              : "self-start bg-ink-850 text-mist-50 ring-1 ring-ink-800",
          )}
        >
          <span className="sr-only">{message.role === "user" ? "You said:" : "Assistant:"}</span>
          {message.content}
        </div>
      ))}

      {interim ? (
        <div
          className="max-w-[90%] self-end rounded-2xl bg-ink-800/60 px-4 py-3 text-base text-mist-400 italic"
          aria-hidden="true"
        >
          {interim}
        </div>
      ) : null}

      <div ref={endRef} />
    </div>
  );
}
