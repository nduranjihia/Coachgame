import { create } from 'zustand';
import type { Household, Player, PlayerColor } from '@/types/db';
import { DEFAULT_SETTINGS } from '@/types/db';
import type { Role } from '@/lib/device';
import {
  getHouseholdId,
  getPlayerId,
  getRole,
  setHouseholdId as setHouseholdIdInStorage,
  setPlayerId,
  setRole,
} from '@/lib/device';
import { useMatchStore } from './match';

export type SessionPhase =
  | 'booting'
  | 'setup-needed'
  | 'ready';

export interface Toast {
  id: number;
  message: string;
  tone: 'info' | 'error' | 'success';
}

interface SessionState {
  phase: SessionPhase;
  role: Role | null;
  uid: string | null;
  householdId: string | null;
  household: Household | null;
  players: Player[];
  myPlayerId: string | null;
  onlinePlayerIds: string[];
  tvOnline: boolean;
  loading: boolean;
  homeGone: boolean;
  toasts: Toast[];

  init: (role: Role, uid: string) => void;
  setPhase: (phase: SessionPhase) => void;
  setLoading: (loading: boolean) => void;
  /**
   * Point this device at a home, in localStorage *and* in the store.
   *
   * Both halves matter: `bootstrap` reads `householdId` back out of the store,
   * so writing only localStorage leaves the store stale and the very next
   * `bootstrap()` bails as if this device had no home at all.
   */
  setHouseholdId: (householdId: string | null) => void;
  setHousehold: (household: Household | null) => void;
  setPlayers: (players: Player[]) => void;
  setPresence: (onlinePlayerIds: string[], tvOnline: boolean) => void;
  setMyPlayerId: (id: string | null) => void;
  resetIdentity: () => void;
  markHomeGone: () => void;
  setSettings: (patch: Partial<typeof DEFAULT_SETTINGS>) => void;
  pushToast: (message: string, tone?: Toast['tone']) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useSession = create<SessionState>((set, get) => ({
  phase: 'booting',
  role: null,
  uid: null,
  householdId: getHouseholdId(),
  household: null,
  players: [],
  myPlayerId: getPlayerId(),
  onlinePlayerIds: [],
  tvOnline: false,
  loading: false,
  homeGone: false,
  toasts: [],

  init: (role, uid) =>
    set({
      role,
      uid,
      phase: 'ready',
      householdId: getHouseholdId(),
      myPlayerId: getPlayerId(),
    }),

  setPhase: (phase) => set({ phase }),

  setLoading: (loading) => set({ loading }),

  setHouseholdId: (householdId) => {
    setHouseholdIdInStorage(householdId);
    set({ householdId });
  },

  setHousehold: (household) =>
    set({ household, householdId: household ? household.id : null, homeGone: false }),

  setPlayers: (players) => {
    const my = get().myPlayerId;
    set({ players });
    if (my) {
      // If our own profile was removed, drop the stale player id.
      if (my && !players.some((p) => p.id === my)) set({ myPlayerId: null });
    }
  },

  setPresence: (onlinePlayerIds, tvOnline) => set({ onlinePlayerIds, tvOnline }),

  setMyPlayerId: (id) => {
    setPlayerId(id);
    set({ myPlayerId: id });
  },

  resetIdentity: () => {
    setHouseholdIdInStorage(null);
    setPlayerId(null);
    set({
      householdId: null,
      household: null,
      players: [],
      myPlayerId: null,
      onlinePlayerIds: [],
      tvOnline: false,
      homeGone: true,
    });
    useMatchStore.getState().resetMatch();
  },

  markHomeGone: () => get().resetIdentity(),

  setSettings: (patch) => {
    const h = get().household;
    if (!h) return;
    set({ household: { ...h, settings: { ...h.settings, ...patch } } });
  },

  pushToast: (message, tone = 'info') => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, message, tone }] }));
    window.setTimeout(() => {
      get().dismissToast(id);
    }, 4200);
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience selectors. */
export const useRole = (): Role | null => useSession((s) => s.role);
export const useUid = (): string | null => useSession((s) => s.uid);
export const useHouseholdId = (): string | null => useSession((s) => s.householdId);
export const useMyPlayerId = (): string | null => useSession((s) => s.myPlayerId);
export const useMyPlayer = (): Player | null =>
  useSession((s) => s.players.find((p) => p.id === s.myPlayerId) ?? null);
export const usePlayers = (): Player[] => useSession((s) => s.players);
export const useSettings = () => useSession((s) => s.household?.settings ?? DEFAULT_SETTINGS);
export const usePlayerById = (id: string | null | undefined): Player | null =>
  useSession((s) => s.players.find((p) => p.id === id) ?? null);

export function persistRole(role: Role): void {
  setRole(role);
}

export function getStoredRole(): Role | null {
  return getRole();
}

/** Player colour -> CSS var name. */
export function colorVar(color: PlayerColor): string {
  return `var(--${color})`;
}
