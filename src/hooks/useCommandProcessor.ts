import { useCallback, useEffect, useRef } from 'react';
import { COMMAND_POLL_MS, COMMAND_STALE_MS } from '@/lib/constants';
import { shuffle } from '@/lib/rng';
import { rpcErrorCode, supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import { getEngine, getGame, isGameKey } from '@/games/registry';
import type { Command, GameKey, Match } from '@/types/db';
import type { Card, CardsSecrets } from '@/types/games';
import type { ChannelBinder } from '@/lib/channel';

const COMMAND_COLUMNS =
  'id, household_id, player_id, match_id, type, payload, status, reason, created_at';

interface Cache {
  match: Match | null;
  hands: Record<string, Card[]> | null;
  secrets: CardsSecrets | null;
}

export interface CommandProcessorOptions {
  householdId: string | null;
  /** Called after every successful commit so the TV refetches its match. */
  onCommitted: () => void;
}

function emptyCache(): Cache {
  return { match: null, hands: null, secrets: null };
}

/**
 * Section 8.3. Runs only in the TV role. Commands are handled one at a time in
 * ascending id order through a single async queue, so two quick taps can never
 * interleave.
 *
 * Returns a binder for the shared channel. `postgres_changes` listeners cannot
 * be attached after `subscribe()`, so the realtime trigger is declared here and
 * applied by `useHousehold` before it subscribes; the poll below is the safety
 * net for when the socket is down.
 */
export function useCommandProcessor({
  householdId,
  onCommitted,
}: CommandProcessorOptions): ChannelBinder {
  const running = useRef(false);
  const queued = useRef(false);
  const cache = useRef<Cache>(emptyCache());
  const committed = useRef(onCommitted);
  committed.current = onCommitted;

  const reloadCache = useCallback(async (): Promise<void> => {
    if (!householdId) {
      cache.current = emptyCache();
      return;
    }
    const { data } = await supabase
      .from('matches')
      .select('id, household_id, game, status, seats, state, version, winner_id, result, created_at, updated_at, finished_at')
      .eq('household_id', householdId)
      .eq('status', 'active')
      .limit(1);
    const match = (data?.[0] as Match | undefined) ?? null;
    cache.current = { match, hands: null, secrets: null };
    if (!match || match.game !== 'cards') return;

    const [{ data: handRows }, { data: secretRow }] = await Promise.all([
      supabase.from('hands').select('player_id, cards').eq('match_id', match.id),
      supabase.from('match_secrets').select('data').eq('match_id', match.id).maybeSingle(),
    ]);
    const hands: Record<string, Card[]> = {};
    for (const row of handRows ?? []) {
      hands[row.player_id] = Array.isArray(row.cards) ? (row.cards as Card[]) : [];
    }
    cache.current.hands = hands;
    cache.current.secrets = (secretRow?.data as CardsSecrets | undefined) ?? { drawPile: [], discardPile: [] };
  }, [householdId]);

  const reject = useCallback(async (id: number, reason: string): Promise<void> => {
    await supabase.rpc('resolve_command', { p_id: id, p_status: 'rejected', p_reason: reason });
  }, []);

  /** Start a brand new match (from `start_match` or `rematch`). */
  const createMatch = useCallback(
    async (cmd: Command, game: GameKey, seats: string[]): Promise<void> => {
      if (!householdId) return;
      const engine = getEngine(game);
      const initial = engine.createInitial(seats);
      const hands = (initial.hands ?? null) as Record<string, Card[]> | null;
      const secrets = (initial.secrets ?? null) as CardsSecrets | null;

      const { error } = await supabase.rpc('create_match', {
        p_household: householdId,
        p_game: game,
        p_seats: seats,
        p_state: initial.state as unknown as Record<string, unknown>,
        p_hands: hands as unknown as Record<string, unknown> | null,
        p_secrets: secrets as unknown as Record<string, unknown> | null,
        p_command_id: cmd.id,
      });
      if (error) {
        await reject(cmd.id, rpcErrorCode(error));
        return;
      }
      await reloadCache();
      committed.current();
    },
    [committed, householdId, reject, reloadCache],
  );

  /** Abandon the active match. No stats, result `quit`. */
  const quitMatch = useCallback(
    async (cmd: Command, match: Match): Promise<void> => {
      const { error } = await supabase.rpc('commit_turn', {
        p_match: match.id,
        p_expected_version: match.version,
        p_state: match.state as Record<string, unknown>,
        p_status: 'abandoned',
        p_winner: null,
        p_result: 'quit',
        p_hands: null,
        p_secrets: null,
        p_command_id: cmd.id,
      });
      if (error) {
        const code = rpcErrorCode(error);
        if (code !== 'version_conflict') await reject(cmd.id, code);
        return;
      }
      await reloadCache();
      committed.current();
    },
    [committed, reject, reloadCache],
  );

  /** Run one engine command against the active match and commit the result. */
  const runEngine = useCallback(
    async (cmd: Command, match: Match, retry: boolean): Promise<void> => {
      const store = useSession.getState();
      const engine = getEngine(match.game);
      const isCards = match.game === 'cards';
      const settings = store.household?.settings ?? { lastCardPenalty: true, sound: true, moveHints: true };
      const nameOf = (id: string): string => store.players.find((p) => p.id === id)?.name ?? 'Someone';

      const result = engine.applyCommand(
        {
          seats: match.seats,
          state: match.state,
          hands: isCards ? (cache.current.hands ?? {}) : undefined,
          secrets: isCards ? (cache.current.secrets ?? { drawPile: [], discardPile: [] }) : undefined,
          settings,
          nameOf,
        },
        { playerId: cmd.player_id, type: cmd.type, payload: cmd.payload ?? {} },
      );

      if (!result.ok) {
        await reject(cmd.id, result.reason);
        return;
      }

      if (isCards) {
        if (result.hands) cache.current.hands = { ...(cache.current.hands ?? {}), ...result.hands };
        if (result.secrets) cache.current.secrets = result.secrets;
      }

      const { data, error } = await supabase.rpc('commit_turn', {
        p_match: match.id,
        p_expected_version: match.version,
        p_state: result.state as unknown as Record<string, unknown>,
        p_status: result.status,
        p_winner: result.winnerId,
        p_result: result.result,
        p_hands: (isCards ? (result.hands ?? null) : null) as Record<string, unknown> | null,
        p_secrets: (isCards ? (result.secrets ?? null) : null) as Record<string, unknown> | null,
        p_command_id: cmd.id,
      });

      if (error) {
        const code = rpcErrorCode(error);
        if (code === 'version_conflict') {
          await reloadCache();
          if (retry) await runEngine(cmd, cache.current.match ?? match, false);
          return;
        }
        if (code === 'match_over') {
          await reject(cmd.id, 'match_over');
          return;
        }
        await reject(cmd.id, code === 'unknown' ? 'bad_request' : code);
        return;
      }

      const nextVersion = typeof data === 'number' ? data : match.version + 1;
      cache.current.match = {
        ...match,
        state: result.state,
        version: nextVersion,
        status: result.status,
        winner_id: result.winnerId,
        result: result.result,
        updated_at: new Date().toISOString(),
      };
      if (result.status !== 'active') await reloadCache();
      committed.current();
    },
    [committed, reject, reloadCache],
  );

  const process = useCallback(
    async (cmd: Command): Promise<void> => {
      const store = useSession.getState();
      if (!householdId) return;

      // 1. Stale commands.
      const age = Date.now() - new Date(cmd.created_at).getTime();
      if (Number.isFinite(age) && age > COMMAND_STALE_MS) {
        await reject(cmd.id, 'stale');
        return;
      }

      if (cmd.type === 'start_match') {
        const game = cmd.payload?.game as GameKey;
        const seatsIn = Array.isArray(cmd.payload?.seats) ? (cmd.payload.seats as string[]) : [];
        if (!isGameKey(game)) return reject(cmd.id, 'bad_request');
        const meta = getGame(game);
        if (seatsIn.length < meta.minPlayers || seatsIn.length > meta.maxPlayers) return reject(cmd.id, 'bad_request');
        if (!seatsIn.includes(cmd.player_id)) return reject(cmd.id, 'not_a_seat');
        if (new Set(seatsIn).size !== seatsIn.length) return reject(cmd.id, 'bad_request');
        const known = new Set(store.players.map((p) => p.id));
        if (!seatsIn.every((id) => known.has(id))) return reject(cmd.id, 'not_a_seat');
        const online = new Set(store.onlinePlayerIds);
        if (!seatsIn.every((id) => online.has(id))) return reject(cmd.id, 'player_offline');
        const seats = shuffle(seatsIn);
        await createMatch(cmd, game, seats);
        return;
      }

      if (cmd.type === 'rematch') {
        if (!cmd.match_id) return reject(cmd.id, 'no_active_match');
        const { data } = await supabase
          .from('matches')
          .select('id, household_id, game, status, seats, state, version, winner_id, result, created_at, updated_at, finished_at')
          .eq('id', cmd.match_id)
          .maybeSingle();
        const previous = data as Match | null;
        if (!previous) return reject(cmd.id, 'no_active_match');
        if (previous.status !== 'finished') return reject(cmd.id, 'bad_request');
        if (cache.current.match) return reject(cmd.id, 'no_active_match');
        if (!previous.seats.includes(cmd.player_id)) return reject(cmd.id, 'not_a_seat');
        const seats = [...previous.seats.slice(1), previous.seats[0]];
        await createMatch(cmd, previous.game, seats);
        return;
      }

      // Everything below acts on a match row.
      if (!cmd.match_id) return reject(cmd.id, 'no_active_match');
      let match = cache.current.match;
      if (!match) {
        await reloadCache();
        match = cache.current.match;
      }
      if (!match) return reject(cmd.id, 'no_active_match');
      if (match.id !== cmd.match_id) {
        const { data } = await supabase
          .from('matches')
          .select('id, household_id, game, status, seats, state, version, winner_id, result, created_at, updated_at, finished_at')
          .eq('id', cmd.match_id)
          .maybeSingle();
        const row = data as Match | null;
        if (!row) return reject(cmd.id, 'no_active_match');
        if (row.status === 'finished' || row.status === 'abandoned') return reject(cmd.id, 'match_over');
        return reject(cmd.id, 'no_active_match');
      }

      if (!match.seats.includes(cmd.player_id)) return reject(cmd.id, 'not_a_seat');

      if (cmd.type === 'quit_match') {
        await quitMatch(cmd, match);
        return;
      }

      await runEngine(cmd, match, true);
    },
    [createMatch, householdId, quitMatch, reject, reloadCache, runEngine],
  );

  const drain = useCallback(async (): Promise<void> => {
    if (!householdId) return;
    if (running.current) {
      queued.current = true;
      return;
    }
    running.current = true;
    try {
      let again = true;
      while (again) {
        again = false;
        const { data } = await supabase
          .from('commands')
          .select(COMMAND_COLUMNS)
          .eq('household_id', householdId)
          .eq('status', 'pending')
          .order('id', { ascending: true })
          .limit(1);
        const cmd = (data?.[0] as Command | undefined) ?? null;
        if (cmd) {
          await process(cmd);
          again = true;
        }
        if (queued.current) {
          queued.current = false;
          again = true;
        }
      }
    } finally {
      running.current = false;
    }
  }, [householdId, process]);

  const onInsert = useCallback((): void => {
    void drain();
  }, [drain]);

  // Load the cached context once when the household becomes known.
  useEffect(() => {
    if (!householdId) return;
    void reloadCache();
  }, [householdId, reloadCache]);

  // The 5 second poll safety net: it also covers a TV whose socket never
  // connected, which the realtime trigger alone would not.
  useEffect(() => {
    if (!householdId) return undefined;
    const timer = window.setInterval(() => {
      void drain();
    }, COMMAND_POLL_MS);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void drain();
    };
    document.addEventListener('visibilitychange', onVisible);
    void drain();

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [drain, householdId]);

  return useCallback<ChannelBinder>(
    (channel) => {
      if (!householdId) return;
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'commands', filter: `household_id=eq.${householdId}` },
        onInsert,
      );
    },
    [householdId, onInsert],
  );
}

export default useCommandProcessor;
