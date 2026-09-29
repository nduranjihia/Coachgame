import { describe, expect, it } from 'vitest';
import { decideRole, type RoleSignals } from './device';

/** A 4K LG webOS television, as it actually reports itself. */
const WEBOS_4K: RoleSignals = {
  ua: 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.270 Safari/537.36 WebAppManager',
  uaIsTv: true,
  touch: false,
  cssWidth: 1920,
  cssHeight: 1080,
  longEdgePx: 3840,
  landscape: true,
  stored: null,
  requested: null,
};

/** An iPhone held in portrait. */
const IPHONE: RoleSignals = {
  ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  uaIsTv: false,
  touch: true,
  cssWidth: 393,
  cssHeight: 852,
  longEdgePx: 1290,
  landscape: false,
  stored: null,
  requested: null,
};

/** A 15" laptop: no touch, landscape, and as wide as a television. */
const LAPTOP: RoleSignals = {
  ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  uaIsTv: false,
  touch: false,
  cssWidth: 1512,
  cssHeight: 945,
  longEdgePx: 3024,
  landscape: true,
  stored: null,
  requested: null,
};

const withSignals = (patch: Partial<RoleSignals>): RoleSignals => ({ ...WEBOS_4K, ...patch });

describe('decideRole', () => {
  it('sends a webOS television to the TV role', () => {
    expect(decideRole(WEBOS_4K).role).toBe('tv');
  });

  it('sends a phone to the phone role', () => {
    expect(decideRole(IPHONE).role).toBe('phone');
  });

  // The bug: one tap of "Not a TV? Use as a controller" latched `cc.role` to
  // `phone` and every later load on that television showed the code entry.
  it('overrules a stale stored "phone" on a television', () => {
    const decision = decideRole(withSignals({ stored: 'phone' }));
    expect(decision.role).toBe('tv');
    expect(decision.overrodeStored).toBe(true);
  });

  it('overrules a stale stored "tv" on a touch device', () => {
    const decision = decideRole({ ...IPHONE, stored: 'tv' });
    expect(decision.role).toBe('phone');
    expect(decision.overrodeStored).toBe(true);
  });

  it('lets an explicit ?role= outrank the hardware', () => {
    expect(decideRole(withSignals({ requested: 'phone' })).role).toBe('phone');
    expect(decideRole({ ...IPHONE, requested: 'tv' }).role).toBe('tv');
  });

  it('falls back to the size heuristic when the user agent gives nothing away', () => {
    // A 1080p television pretending to be a plain desktop browser.
    const anonymousTV: RoleSignals = {
      ...WEBOS_4K,
      ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      uaIsTv: false,
      cssWidth: 1920,
      cssHeight: 1080,
      longEdgePx: 1920,
    };
    expect(decideRole(anonymousTV).role).toBe('tv');
  });

  it('will not call a phone-sized no-touch device a TV', () => {
    // A small window on a big monitor: no touch, but nowhere near furniture.
    const smallWindow: RoleSignals = {
      ...LAPTOP,
      cssWidth: 700,
      cssHeight: 900,
      landscape: false,
    };
    expect(decideRole(smallWindow).role).toBe('phone');
  });

  it('keeps the stored role when the hardware is inconclusive', () => {
    const vagueDesktop: RoleSignals = {
      ...LAPTOP,
      cssWidth: 900,
      cssHeight: 700,
      longEdgePx: 1200,
    };
    expect(decideRole({ ...vagueDesktop, stored: 'tv' }).reason).toBe('stored-tv');
    expect(decideRole({ ...vagueDesktop, stored: 'phone' }).reason).toBe('stored-phone');
  });

  it('defaults to phone when nothing has ever been stored', () => {
    const neverSeenBefore: RoleSignals = { ...IPHONE, touch: false, stored: null };
    expect(decideRole(neverSeenBefore).reason).toBe('default-phone');
  });

  // Known limitation, pinned by a test so it cannot regress silently: a
  // desktop browser really is indistinguishable from a television by size.
  it('cannot tell a full-screen laptop from a television, and picks the TV', () => {
    expect(decideRole(LAPTOP).role).toBe('tv');
  });

  it('treats an unrecognised stored value as absent', () => {
    // `Role` excludes this, so widen through the wire type on purpose.
    const corrupt = { ...IPHONE, stored: 'toaster' as unknown as RoleSignals['stored'] };
    expect(decideRole(corrupt).role).toBe('phone');
  });
});
