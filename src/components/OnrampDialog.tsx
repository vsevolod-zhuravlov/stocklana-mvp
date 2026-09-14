"use client";

import { ExternalLink, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";

interface OnrampDialogProps {
  url: string;
  usdAmount: number;
  onClose: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), iframe, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Hosts the on-ramp widget in-app so focus stays inside a single document.
 *
 * `allow="payment"` is what lets the embedded provider raise the native Google
 * Pay or Apple Pay sheet, which is the only way to pay without reading a card
 * number aloud. When the system sheet takes over, focus returns here on
 * dismissal, and the caller then restores focus to the push-to-talk button and
 * announces the outcome.
 */
export function OnrampDialog({ url, usdAmount, onClose }: OnrampDialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((element) => element.offsetParent !== null || element.tagName === "IFRAME");
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/90 p-0 sm:items-center sm:p-6">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onramp-title"
        aria-describedby="onramp-description"
        className="flex h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-ink-900 ring-1 ring-ink-700 sm:h-[86vh] sm:rounded-3xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-800 p-4">
          <div>
            <h2 id="onramp-title" className="text-lg font-semibold">
              Pay {usdAmount} dollars
            </h2>
            <p id="onramp-description" className="mt-1 text-sm text-mist-400">
              Choose Apple Pay or Google Pay to pay without typing a card number. Close this when
              you are done and I will tell you when your SOL arrives.
            </p>
          </div>
          <Button
            ref={closeRef}
            variant="ghost"
            className="min-h-12 shrink-0 px-4"
            onClick={onClose}
            aria-label="Close payment and return to the assistant"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only sm:not-sr-only">Close</span>
          </Button>
        </div>

        <iframe
          src={url}
          title="Buy SOL with Apple Pay, Google Pay or a card"
          allow="accelerometer; autoplay; camera; gyroscope; payment; microphone"
          className="min-h-0 w-full flex-1 border-0 bg-white"
        />

        <div className="border-t border-ink-800 p-3">
          <a
            href={url}
            target="_blank"
            rel="noreferrer noopener"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl text-accent-400 underline underline-offset-4"
          >
            <ExternalLink aria-hidden="true" className="size-4" />
            Open the payment page in a new tab instead
          </a>
        </div>
      </div>
    </div>
  );
}
