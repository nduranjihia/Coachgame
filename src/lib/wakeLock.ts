/** Screen wake lock, requested while a match is running or the TV sits on Home. */

let sentinel: WakeLockSentinel | null = null;
let wanted = false;

function supported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export async function acquireWakeLock(): Promise<void> {
  wanted = true;
  if (!supported()) return;
  try {
    if (sentinel && !sentinel.released) return;
    sentinel = await (navigator as Navigator & { wakeLock: { request: (t: 'screen') => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch {
    /* denied or unsupported - ignore */
  }
}

export async function releaseWakeLock(): Promise<void> {
  wanted = false;
  try {
    if (sentinel && !sentinel.released) await sentinel.release();
  } catch {
    /* ignore */
  }
  sentinel = null;
}

/** Re-acquire after the tab comes back to the foreground. */
export async function refreshWakeLock(): Promise<void> {
  if (!wanted) return;
  if (document.visibilityState !== 'visible') return;
  try {
    if (sentinel && !sentinel.released) return;
  } catch {
    /* ignore */
  }
  sentinel = null;
  await acquireWakeLock();
}

export function isWakeLockHeld(): boolean {
  return Boolean(sentinel && !sentinel.released);
}
