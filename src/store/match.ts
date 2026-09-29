import { create } from 'zustand';
import type { GameKey, Match } from '@/types/db';
import type { Card } from '@/types/games';

interface MatchState {
  activeMatch: Match | null;
  /** The most recently finished match, kept so the TV can show the result overlay. */
  lastMatch: Match | null;
  myHand: Card[];
  matchLoading: boolean;
  handLoading: boolean;
  /** Bumped every time a phones hand is refetched, used to clear stale selections. */
  handVersion: number;

  setActiveMatch: (match: Match | null) => void;
  setLastMatch: (match: Match | null) => void;
  setMyHand: (cards: Card[]) => void;
  setMatchLoading: (v: boolean) => void;
  setHandLoading: (v: boolean) => void;
  resetMatch: () => void;
}

export const useMatchStore = create<MatchState>((set) => ({
  activeMatch: null,
  lastMatch: null,
  myHand: [],
  matchLoading: false,
  handLoading: false,
  handVersion: 0,

  setActiveMatch: (match) => set({ activeMatch: match }),
  setLastMatch: (match) => set({ lastMatch: match }),
  setMyHand: (cards) => set((s) => ({ myHand: cards, handVersion: s.handVersion + 1 })),
  setMatchLoading: (matchLoading) => set({ matchLoading }),
  setHandLoading: (handLoading) => set({ handLoading }),
  resetMatch: () =>
    set({ activeMatch: null, lastMatch: null, myHand: [], matchLoading: false, handLoading: false, handVersion: 0 }),
}));

/** Convenience: is the given match the one the TV/phone is showing? */
export function isSameMatch(a: Match | null, b: Match | null): boolean {
  return Boolean(a && b && a.id === b.id);
}

export type { GameKey };
