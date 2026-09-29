/** Phone haptics. Silently does nothing where the Vibration API is missing. */

export function hapticTick(): void {
  try {
    navigator.vibrate?.(15);
  } catch {
    /* not supported */
  }
}

export function hapticReject(): void {
  try {
    navigator.vibrate?.([30, 40, 30]);
  } catch {
    /* not supported */
  }
}

export function hapticWin(): void {
  try {
    navigator.vibrate?.([20, 60, 20, 60, 40]);
  } catch {
    /* not supported */
  }
}
