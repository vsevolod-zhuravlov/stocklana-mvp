"use client";

import { Check, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import type { PendingAction } from "@/lib/types";

interface ConfirmBarProps {
  pending: PendingAction;
  disabled: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Dual modality by design: the assistant has already asked for confirmation
 * out loud and will accept a spoken "yes", but the same choice is always
 * available as two large buttons. Nobody is forced down the voice path if
 * recognition is struggling or they are in a quiet place.
 */
export function ConfirmBar({ pending, disabled, onConfirm, onCancel }: ConfirmBarProps) {
  const confirmRef = React.useRef<HTMLButtonElement>(null);

  // Moving focus here means the next swipe, tab or switch press lands on
  // "Confirm" rather than somewhere further up the page.
  React.useEffect(() => {
    confirmRef.current?.focus();
  }, [pending.summary]);

  return (
    <section
      aria-labelledby="confirm-heading"
      className="rounded-3xl bg-warn-400/10 p-4 ring-2 ring-warn-400/70"
    >
      <h2 id="confirm-heading" className="mb-1 text-sm font-semibold tracking-wide text-warn-400 uppercase">
        Waiting for your confirmation
      </h2>
      <p className="mb-4 text-lg font-semibold text-mist-50">{pending.summary}</p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          ref={confirmRef}
          variant="confirm"
          size="lg"
          className="flex-1"
          disabled={disabled}
          onClick={onConfirm}
          aria-label={`Confirm: ${pending.summary}`}
        >
          <Check aria-hidden="true" className="size-6" />
          Confirm
        </Button>
        <Button
          variant="danger"
          size="lg"
          className="flex-1"
          disabled={disabled}
          onClick={onCancel}
          aria-label={`Cancel: ${pending.summary}`}
        >
          <X aria-hidden="true" className="size-6" />
          Cancel
        </Button>
      </div>
    </section>
  );
}
