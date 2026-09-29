import { STORAGE } from './constants';

export type Role = 'tv' | 'phone';

/**
 * TV platform fingerprints. Keep this list generous: a TV that misses this
 * regex has to survive on the size heuristic alone, and that heuristic cannot
 * tell a 55" panel from a 15" laptop.
 */
const TV_UA =
  /SmartTV|SMART-TV|SmartTv|Tizen|Web0S|WebOS|NetCast|HbbTV|BRAVIA|VIDAA|Roku|AFTM|AFTB|AFTT|AFTS|AFTN|CrKey|AppleTV|GoogleTV|Android TV|Hisense|Philips|Viera|Silk|KFSOWI|Opera TV|Xbox|PlayStation|NintendoBrowser/i;

/** CSS px of viewport width at which a remote-driven device is treated as a TV. */
const TV_CSS_WIDTH = 1100;
/** Device px on the panel's long edge at which a remote-driven device is a TV. */
const TV_LONG_EDGE = 1280;

/** Everything the decision is allowed to look at. Snapshotted once, then pure. */
export interface RoleSignals {
  /** The raw user agent, used only by `uaIsTv`. */
  ua: string;
  /** The user agent matched a known TV platform. */
  uaIsTv: boolean;
  /** The device reports real touch points, i.e. a person holds it. */
  touch: boolean;
  /** Viewport size in CSS px. */
  cssWidth: number;
  cssHeight: number;
  /** The panel's long edge in device px: the honest "how big is this" number. */
  longEdgePx: number;
  /** True when the viewport is wider than it is tall. */
  landscape: boolean;
  /** What this device was last used as. */
  stored: Role | null;
  /** An explicit `?role=` in the URL. */
  requested: Role | null;
}

export type RoleReason =
  | 'requested-tv'
  | 'requested-phone'
  | 'user-agent-tv'
  | 'touch-device'
  | 'size-and-remote'
  | 'stored-tv'
  | 'stored-phone'
  | 'default-phone';

export interface RoleDecision {
  role: Role;
  reason: RoleReason;
  /** True when hardware overruled a stale `cc.role` in localStorage. */
  overrodeStored: boolean;
}

function readStoredRole(): Role | null {
  try {
    const stored = localStorage.getItem(STORAGE.role);
    return stored === 'tv' || stored === 'phone' ? stored : null;
  } catch {
    return null;
  }
}

function readRequestedRole(): Role | null {
  try {
    const q = new URLSearchParams(window.location.search).get('role');
    return q === 'tv' || q === 'phone' ? q : null;
  } catch {
    return null;
  }
}

/** Read the browser's environment once. */
export function readRoleSignals(): RoleSignals {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;
  const ua = navigator.userAgent;
  // `screen` swaps width/height with the orientation, so take the long edge.
  const screenWidth = window.screen?.width || cssWidth;
  const screenHeight = window.screen?.height || cssHeight;

  return {
    ua,
    uaIsTv: TV_UA.test(ua),
    // `maxTouchPoints` only, never `'ontouchstart' in window`: desktop Chromium
    // exposes the TouchEvent API too, which would flag every PC as a phone.
    touch: (navigator.maxTouchPoints ?? 0) > 0,
    cssWidth,
    cssHeight,
    longEdgePx: Math.max(screenWidth, screenHeight) * dpr,
    landscape: cssWidth > cssHeight,
    stored: readStoredRole(),
    requested: readRequestedRole(),
  };
}

/**
 * The whole decision, as a pure function of its inputs.
 *
 * The ordering is the point. `cc.role` used to be consulted *before* any
 * hardware check, which made it a latch: one accidental tap of "Not a TV? Use
 * as a controller" on the big screen wrote `phone` and every later load on that
 * television went to the phone's code entry. Hardware is now allowed to
 * overrule the stored value, and the only thing that outranks hardware is a
 * person typing `?role=` in the URL.
 */
export function decideRole(s: RoleSignals): RoleDecision {
  // 1. A person in the URL outranks everything, including the hardware.
  if (s.requested) {
    return {
      role: s.requested,
      reason: s.requested === 'tv' ? 'requested-tv' : 'requested-phone',
      overrodeStored: s.stored !== null && s.stored !== s.requested,
    };
  }

  // 2. A known TV platform. Authoritative, and it beats a stale `cc.role`.
  if (s.uaIsTv) {
    return { role: 'tv', reason: 'user-agent-tv', overrodeStored: s.stored === 'phone' };
  }

  // 3. A finger on the glass is never the TV. Touchscreen TVs are caught above.
  if (s.touch) {
    return { role: 'phone', reason: 'touch-device', overrodeStored: s.stored === 'tv' };
  }

  // 4. Remote-driven, landscape, and big enough to be furniture.
  //    Size alone cannot separate a 55" TV from a 15" laptop, so this only runs
  //    once we already know nobody is holding the thing.
  if (s.landscape && s.cssWidth >= TV_CSS_WIDTH && s.longEdgePx >= TV_LONG_EDGE) {
    return { role: 'tv', reason: 'size-and-remote', overrodeStored: s.stored === 'phone' };
  }

  // 5. Inconclusive: keep whatever the device was last used as.
  if (s.stored) {
    return {
      role: s.stored,
      reason: s.stored === 'tv' ? 'stored-tv' : 'stored-phone',
      overrodeStored: false,
    };
  }

  return { role: 'phone', reason: 'default-phone', overrodeStored: false };
}

/** The decision for this page load. Resolved once, then left to `setRole`. */
let resolvedRole: Role | null = null;

/**
 * Whether this device is the TV or a controller.
 *
 * Runs at load, not on resize: a phone is never a TV and a TV is never a phone,
 * so a rotation or a window drag must not swap roles mid-game. The answer is
 * memoised for the page load, because `App` asks for it again after the router
 * has already moved - a second resolution would re-persist the value and fight
 * the `RoleRoute` that set the role for the screen actually being shown.
 */
export function detectRole(): Role {
  if (resolvedRole) return resolvedRole;
  const { role, reason, overrodeStored } = decideRole(readRoleSignals());
  setRole(role);
  resolvedRole = role;
  if (overrodeStored || new URLSearchParams(window.location.search).has('debug')) {
    console.info(`[couch-clash] role=${role} (${reason})`);
  }
  return role;
}

export function setRole(role: Role): void {
  try {
    localStorage.setItem(STORAGE.role, role);
  } catch {
    // Private mode with storage disabled: fall back to in-memory routing only.
  }
}

export function getRole(): Role | null {
  return readStoredRole();
}

export function getHouseholdId(): string | null {
  return localStorage.getItem(STORAGE.householdId);
}

export function setHouseholdId(id: string | null): void {
  if (id) localStorage.setItem(STORAGE.householdId, id);
  else localStorage.removeItem(STORAGE.householdId);
}

export function getPlayerId(): string | null {
  return localStorage.getItem(STORAGE.playerId);
}

export function setPlayerId(id: string | null): void {
  if (id) localStorage.setItem(STORAGE.playerId, id);
  else localStorage.removeItem(STORAGE.playerId);
}

/** Forget this device completely. Used by the health check and "Delete everything". */
export function wipeDevice(): void {
  localStorage.removeItem(STORAGE.householdId);
  localStorage.removeItem(STORAGE.playerId);
}

/** The public origin used inside QR join links. */
export function appUrl(): string {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim();
  return (configured || window.location.origin).replace(/\/+$/, '');
}

export function joinUrl(code: string): string {
  return `${appUrl()}/join/${code}`;
}

/** True when the device reports real touch points. */
export function isTouchDevice(): boolean {
  return (navigator.maxTouchPoints ?? 0) > 0;
}
