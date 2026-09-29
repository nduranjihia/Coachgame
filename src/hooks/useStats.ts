import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { GameKey, Match, Player } from '@/types/db';

export interface GameStats {
  wins: Record<string, number>;
  draws: number;
  total: number;
}

export type StatsByGame = Record<GameKey, GameStats>;

export interface RecentMatch {
  id: string;
  game: GameKey;
  seats: string[];
  winner_id: string | null;
  result: string | null;
  finished_at: string | null;
}

export interface StatsApi {
  byGame: StatsByGame;
  recent: RecentMatch[];
  loading: boolean;
  reload: () => Promise<void>;
}

const GAMES: GameKey[] = ['tictactoe', 'chess', 'cards'];

function emptyByGame(): StatsByGame {
  const out = {} as StatsByGame;
  for (const g of GAMES) out[g] = { wins: {}, draws: 0, total: 0 };
  return out;
}

const MATCH_COLUMNS = 'id, game, seats, winner_id, result, finished_at';

/** Section 10.4: stats are computed on the client from the last 500 finished matches. */
export function useStats(householdId: string | null): StatsApi {
  const [byGame, setByGame] = useState<StatsByGame>(emptyByGame);
  const [recent, setRecent] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!householdId) {
      setByGame(emptyByGame());
      setRecent([]);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('matches')
      .select(MATCH_COLUMNS)
      .eq('household_id', householdId)
      .eq('status', 'finished')
      .order('finished_at', { ascending: false })
      .limit(500);
    if (!mounted.current) return;
    const rows = (data ?? []) as RecentMatch[];
    const next = emptyByGame();
    for (const row of rows) {
      const bucket = next[row.game];
      if (!bucket) continue;
      bucket.total += 1;
      if (row.winner_id) bucket.wins[row.winner_id] = (bucket.wins[row.winner_id] ?? 0) + 1;
      else bucket.draws += 1;
    }
    setByGame(next);
    setRecent(rows);
    setLoading(false);
  }, [householdId]);

  useEffect(() => {
    if (!householdId) {
      setByGame(emptyByGame());
      setRecent([]);
      return undefined;
    }
    void reload();
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [householdId, reload]);

  return { byGame, recent, loading, reload };
}

/** `Alex 7 · Sam 5 · Draws 2` - draws are hidden when there are none. */
export function headToHead(stats: GameStats | undefined, players: Player[]): string {
  if (!stats || stats.total === 0) return 'No matches yet';
  const parts: string[] = [];
  const known = players.slice(0, 4);
  for (const p of known) {
    const n = stats.wins[p.id] ?? 0;
    if (n > 0) parts.push(`${p.name} ${n}`);
  }
  if (parts.length === 0) parts.push(stats.draws > 0 ? 'Draws only' : 'No wins yet');
  if (stats.draws > 0 && parts[0] !== 'Draws only') parts.push(`Draws ${stats.draws}`);
  return parts.join(' · ');
}

export function gameStatsLabel(game: GameKey): string {
  if (game === 'tictactoe') return 'Tic-Tac-Toe';
  if (game === 'chess') return 'Chess';
  return 'Wild Cards';
}

/**
 * The "how it ended" line shared by the TV result overlay, the phone result
 * screen and the stats list: "Checkmate in 23 moves", "Three in a row",
 * "First to empty their hand" and friends.
 */
export function matchSummary(match: Match<unknown> | RecentMatch, players: Player[]): string {
  const nameOf = (id: string | null): string =>
    id ? (players.find((p) => p.id === id)?.name ?? 'Former player') : 'Draw';
  const state = (match as { state?: { san?: string[]; moveCount?: number } }).state;
  const san = state?.san;
  const moveCount = Array.isArray(san) ? Math.ceil(san.length / 2) : 0;
  const result = match.result;

  if (match.game === 'chess') {
    if (result === 'checkmate') return `Checkmate in ${Math.max(moveCount, 1)} ${Math.max(moveCount, 1) === 1 ? 'move' : 'moves'}`;
    if (result === 'stalemate') return 'Stalemate';
    if (result === 'insufficient') return 'Not enough pieces left';
    if (result === 'threefold') return 'Same position three times';
    if (result === 'fifty_move') return 'Fifty moves with no capture';
    if (result === 'draw_agreed') return 'Draw agreed';
    if (result === 'resign') return `${nameOf(match.winner_id)} wins by resignation`;
    return 'A draw';
  }
  if (match.game === 'tictactoe') return result === 'draw' ? 'A draw' : 'Three in a row';
  if (match.game === 'cards') {
    if (result === 'emptied_hand') return 'First to empty their hand';
    if (result === 'quit') return 'Match quit';
    return `${nameOf(match.winner_id)} wins`;
  }
  if (result === 'quit') return 'Match quit';
  return match.winner_id ? `${nameOf(match.winner_id)} wins` : 'A draw';
}

export default useStats;
