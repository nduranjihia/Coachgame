import { useCallback, useEffect, useRef } from 'react';
import { RESULT_HOLD_MS } from '@/lib/constants';
import { supabase } from '@/lib/supabase';
import { useMatchStore } from '@/store/match';
import type { Match } from '@/types/db';

const MATCH_COLUMNS =
  'id, household_id, game, status, seats, state, version, winner_id, result, created_at, updated_at, finished_at';

export interface ActiveMatchApi {
  reload: () => Promise<void>;
}

function finishedRecently(row: Match | null): boolean {
  if (!row?.finished_at) return false;
  const at = new Date(row.finished_at).getTime();
  return Number.isFinite(at) && Date.now() - at < RESULT_HOLD_MS;
}

/**
 * Keeps `activeMatch` (and the freshly finished match, used by the TV result
 * overlay) in sync with the database. Called by the realtime handler in
 * `useHousehold` and on every `visibilitychange`.
 */
export function useActiveMatch(householdId: string | null): ActiveMatchApi {
  const setMatchLoading = useMatchStore((s) => s.setMatchLoading);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!householdId) {
      useMatchStore.getState().setActiveMatch(null);
      return;
    }
    const store = useMatchStore.getState();

    const [{ data: active }, { data: finished }] = await Promise.all([
      supabase
        .from('matches')
        .select(MATCH_COLUMNS)
        .eq('household_id', householdId)
        .eq('status', 'active')
        .limit(1),
      supabase
        .from('matches')
        .select(MATCH_COLUMNS)
        .eq('household_id', householdId)
        .eq('status', 'finished')
        .order('finished_at', { ascending: false })
        .limit(1),
    ]);

    if (!mounted.current) return;

    const activeRow = (active?.[0] as Match | undefined) ?? null;
    const finishedRow = (finished?.[0] as Match | undefined) ?? null;
    const prevActive = store.activeMatch;

    store.setActiveMatch(activeRow);

    if (activeRow) {
      // A new match supersedes any result overlay.
      store.setLastMatch(null);
    } else if (finishedRow && (prevActive?.id === finishedRow.id || finishedRecently(finishedRow))) {
      store.setLastMatch(finishedRow);
    } else {
      store.setLastMatch(null);
    }
  }, [householdId]);

  useEffect(() => {
    if (!householdId) {
      setMatchLoading(false);
      return undefined;
    }
    setMatchLoading(true);
    void reload().finally(() => {
      if (mounted.current) setMatchLoading(false);
    });

    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [householdId, reload, setMatchLoading]);

  return { reload };
}

export default useActiveMatch;
