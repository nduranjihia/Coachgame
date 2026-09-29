/** Random helpers built on the Web Crypto API. */

/** A cryptographically strong float in [0, 1). */
export function randomFloat(): number {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    // 2^32 is not exactly representable, so divide by 2^32 for a [0,1) value.
    c.getRandomValues(buf);
    return buf[0] / 4294967296;
  }
  return Math.random();
}

/** Fisher-Yates shuffle on a copy of `list`. */
export function shuffle<T>(list: readonly T[], rng: () => number = randomFloat): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Pick one element. */
export function pick<T>(list: readonly T[], rng: () => number = randomFloat): T {
  return list[Math.floor(rng() * list.length)];
}
