/**
 * Short tones that mark microphone state.
 *
 * These are deliberately not spoken. The screen reader's own voice plays
 * through the speaker, so announcing "listening" at the moment the mic opens
 * gets transcribed back as user input. A tone conveys the same state without
 * polluting the transcript, and it is audible with the screen off.
 */

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  if (!context) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
  }

  // Mobile browsers suspend the context until a user gesture; every caller
  // here runs inside a tap handler.
  if (context.state === "suspended") void context.resume();

  return context;
}

function tone(frequency: number, durationMs: number, gainValue = 0.08): void {
  const ctx = getContext();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  const now = ctx.currentTime;
  const duration = durationMs / 1000;

  // Ramped envelope: an abrupt start or stop clicks unpleasantly in headphones.
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(gainValue, now + 0.015);
  gain.gain.setValueAtTime(gainValue, now + duration - 0.03);
  gain.gain.linearRampToValueAtTime(0, now + duration);

  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

/** Rising tone: the microphone is now open. */
export function earconListenStart(): void {
  tone(660, 120);
  window.setTimeout(() => tone(880, 130), 110);
}

/** Falling tone: the microphone closed and the request is on its way. */
export function earconListenStop(): void {
  tone(880, 110);
  window.setTimeout(() => tone(620, 130), 100);
}

/** Two-note chime: money moved successfully. */
export function earconSuccess(): void {
  tone(784, 140);
  window.setTimeout(() => tone(1175, 220), 130);
}

/** Low buzz: something failed. Always paired with a spoken explanation. */
export function earconError(): void {
  tone(300, 260, 0.06);
}
