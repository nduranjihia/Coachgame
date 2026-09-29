/**
 * Tiny synthesised sound effects for the TV. No audio files.
 * The AudioContext is created lazily and every failure is swallowed.
 */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (ctx) return ctx;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Browsers block audio until a gesture; call this from the first user interaction. */
export function unlockAudio(): void {
  const c = getCtx();
  if (c && c.state === 'suspended') void c.resume().catch(() => undefined);
}

function tone(freq: number, startAt: number, durationMs: number, gainValue = 0.18): void {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + startAt;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainValue, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

/** Tap / move blip. */
export function sfxTap(enabled = true): void {
  if (!enabled) return;
  tone(660, 0, 90);
}

/** Your-turn chime. */
export function sfxYourTurn(enabled = true): void {
  if (!enabled) return;
  tone(523, 0, 120);
  tone(784, 0.13, 120);
}

/** Win arpeggio. */
export function sfxWin(enabled = true): void {
  if (!enabled) return;
  tone(523, 0, 140);
  tone(659, 0.15, 140);
  tone(784, 0.3, 140);
  tone(1047, 0.45, 200);
}
