"use client";

import * as React from "react";

type Politeness = "assertive" | "polite";

interface Announcement {
  id: number;
  text: string;
}

interface AnnouncerApi {
  /**
   * Writes text into an aria-live region so the user's own screen reader
   * speaks it in their configured voice, at their configured rate.
   *
   * This app deliberately has no `speechSynthesis` voice of its own: a custom
   * voice and TalkBack or VoiceOver end up talking over each other, and users
   * lose the voice and speed they have tuned for themselves.
   */
  announce: (text: string, politeness?: Politeness) => void;
}

const AnnouncerContext = React.createContext<AnnouncerApi | null>(null);

export function useAnnouncer(): AnnouncerApi {
  const context = React.useContext(AnnouncerContext);
  if (!context) throw new Error("useAnnouncer must be used inside LiveAnnouncerProvider");
  return context;
}

export function LiveAnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [assertive, setAssertive] = React.useState<Announcement | null>(null);
  const [polite, setPolite] = React.useState<Announcement | null>(null);
  const counter = React.useRef(0);

  const announce = React.useCallback((text: string, politeness: Politeness = "assertive") => {
    const trimmed = text.trim();
    if (!trimmed) return;

    counter.current += 1;
    const next = { id: counter.current, text: trimmed };
    if (politeness === "assertive") setAssertive(next);
    else setPolite(next);
  }, []);

  const api = React.useMemo(() => ({ announce }), [announce]);

  return (
    <AnnouncerContext.Provider value={api}>
      {children}
      {/*
        Both regions are rendered on first paint and never unmounted: a live
        region added to the DOM at the same time as its content is frequently
        missed by screen readers. Re-keying the child forces a DOM insertion so
        that repeating the same sentence is announced again.
      */}
      <div aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertive ? <p key={assertive.id}>{assertive.text}</p> : null}
      </div>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {polite ? <p key={polite.id}>{polite.text}</p> : null}
      </div>
    </AnnouncerContext.Provider>
  );
}
