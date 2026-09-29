import { STORAGE } from './constants';

export type Role = 'tv' | 'phone';

const TV_UA =
  /SmartTV|SMART-TV|Tizen|Web0S|WebOS|NetCast|HbbTV|BRAVIA|VIDAA|Roku|AFTM|AFTB|AFTT|AFTS|AFTN|CrKey|AppleTV|GoogleTV|Android TV|Hisense|Philips|Opera TV|Xbox|PlayStation|NintendoBrowser/i;

/**
 * Decide whether this device is the TV or a controller.
 * Detection happens once at load; resizing never switches roles.
 */
export function detectRole(): Role {
  const q = new URLSearchParams(location.search).get('role');
  if (q === 'tv' || q === 'phone') {
    localStorage.setItem(STORAGE.role, q);
    return q;
  }
  const stored = localStorage.getItem(STORAGE.role);
  if (stored === 'tv' || stored === 'phone') return stored;
  if (TV_UA.test(navigator.userAgent)) return 'tv';
  const noTouch = (navigator.maxTouchPoints ?? 0) === 0;
  const landscape = window.innerWidth > window.innerHeight;
  const wide = window.innerWidth >= 900 || window.screen.width * (window.devicePixelRatio || 1) >= 1900;
  return noTouch && landscape && wide ? 'tv' : 'phone';
}

export function setRole(role: Role): void {
  localStorage.setItem(STORAGE.role, role);
}

export function getRole(): Role | null {
  const r = localStorage.getItem(STORAGE.role);
  return r === 'tv' || r === 'phone' ? r : null;
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

/** True on iOS/Android style touch devices. */
export function isTouchDevice(): boolean {
  return (navigator.maxTouchPoints ?? 0) > 0 || 'ontouchstart' in window;
}
