"use client";

import * as React from "react";

/**
 * Minimal local shape of the Web Speech API. Declared here rather than relying
 * on lib.dom so the build does not depend on the TypeScript version shipping
 * these types, and so the vendor-prefixed constructor is handled explicitly.
 */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { readonly length: number; [index: number]: SpeechRecognitionResultLike };
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

/** Browser support never changes during a session, so there is nothing to watch. */
const subscribeToNothing = () => () => {};

function getConstructor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

export type SpeechErrorKind = "permission" | "no-speech" | "network" | "unsupported" | "unknown";

export function speechErrorMessage(kind: SpeechErrorKind): string {
  switch (kind) {
    case "permission":
      return "I can't hear you because microphone access is blocked. Allow the microphone in your browser settings, or use the buttons on screen instead.";
    case "no-speech":
      return "I didn't hear anything. Tap the big button and speak, or use the buttons on screen.";
    case "network":
      return "Speech recognition needs an internet connection and it couldn't reach the service. You can still use the buttons on screen.";
    case "unsupported":
      return "This browser can't listen to speech. You can type or use the buttons on screen instead. Chrome on Android works best.";
    default:
      return "I couldn't catch that. Tap the big button and try again, or use the buttons on screen.";
  }
}

interface Options {
  onFinalTranscript: (transcript: string) => void;
  onError: (kind: SpeechErrorKind) => void;
  /** Hard stop so a stuck recogniser can never hold the mic open. */
  maxDurationMs?: number;
}

export interface SpeechRecognitionApi {
  supported: boolean;
  listening: boolean;
  /** Live partial transcript, shown on screen for sighted users. */
  interim: string;
  start: () => void;
  stop: () => void;
}

export function useSpeechRecognition({
  onFinalTranscript,
  onError,
  maxDurationMs = 15_000,
}: Options): SpeechRecognitionApi {
  // Read through useSyncExternalStore rather than an effect so the server and
  // the first client render agree (the server can never see the API), without
  // an extra render pass.
  const supported = React.useSyncExternalStore(
    subscribeToNothing,
    () => getConstructor() !== null,
    () => false,
  );
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState("");

  const recognitionRef = React.useRef<SpeechRecognitionLike | null>(null);
  const timeoutRef = React.useRef<number | null>(null);
  const finalRef = React.useRef("");
  const gotResultRef = React.useRef(false);

  // Kept in refs so the recogniser's handlers never close over stale props.
  const onFinalRef = React.useRef(onFinalTranscript);
  const onErrorRef = React.useRef(onError);
  React.useEffect(() => {
    onFinalRef.current = onFinalTranscript;
    onErrorRef.current = onError;
  }, [onFinalTranscript, onError]);

  const clearTimer = React.useCallback(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stop = React.useCallback(() => {
    clearTimer();
    recognitionRef.current?.stop();
  }, [clearTimer]);

  const start = React.useCallback(() => {
    const Ctor = getConstructor();
    if (!Ctor) {
      onErrorRef.current("unsupported");
      return;
    }
    if (recognitionRef.current) return;

    const recognition = new Ctor();
    recognition.lang = "en-US";
    // Turn-based rather than always-on: the recogniser closes itself after a
    // natural pause, which is far more reliable than interrupt handling and
    // avoids holding the mic open while the screen reader is speaking.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    finalRef.current = "";
    gotResultRef.current = false;

    recognition.onstart = () => {
      setListening(true);
      setInterim("");
    };

    recognition.onresult = (event) => {
      let partial = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) {
          finalRef.current += text;
          gotResultRef.current = true;
        } else {
          partial += text;
        }
      }
      setInterim(partial);
    };

    recognition.onerror = (event) => {
      if (event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        onErrorRef.current("permission");
      } else if (event.error === "no-speech") {
        onErrorRef.current("no-speech");
      } else if (event.error === "network") {
        onErrorRef.current("network");
      } else {
        onErrorRef.current("unknown");
      }
    };

    recognition.onend = () => {
      clearTimer();
      recognitionRef.current = null;
      setListening(false);
      setInterim("");

      const transcript = finalRef.current.trim();
      if (transcript) onFinalRef.current(transcript);
      else if (!gotResultRef.current) onErrorRef.current("no-speech");
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      timeoutRef.current = window.setTimeout(() => recognition.stop(), maxDurationMs);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      onErrorRef.current("unknown");
    }
  }, [clearTimer, maxDurationMs]);

  React.useEffect(
    () => () => {
      clearTimer();
      recognitionRef.current?.abort();
    },
    [clearTimer],
  );

  return { supported, listening, interim, start, stop };
}
