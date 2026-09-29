import { useCallback, useEffect, useRef } from 'react';
import type { ChannelBinder } from '@/lib/channel';
import { supabase } from '@/lib/supabase';
import { useMatchStore } from '@/store/match';
import type { Card } from '@/types/games';

export interface MyHandOptions {
  householdId: string | null;
  matchId: string | null;
  playerId: string | null;
  ready: boolean;
}

export interface MyHandApi {
  /** A channel binder for the `hands` table. See `bindThenSubscribe`. */
  bind: ChannelBinder;
  reload: () => Promise<void>;
  clear: () => void;
}

/**
 * The phone reads its own hand row only - row-level security means it can never
 * see anyone else's. Realtime is a convenience; the refetch after every match
 * update is the mechanism that always runs.
 */
export function useMyHand({ householdId, matchId, playerId, ready }: MyHandOptions): MyHandApi {
  const setHandLoading = useMatchStore((s) => s.setHandLoading);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!matchId || !playerId) {
      useMatchStore.getState().setMyHand([]);
      return;
    }
    const { data } = await supabase
      .from('hands')
      .select('cards')
      .eq('match_id', matchId)
      .eq('player_id', playerId)
      .maybeSingle();
    if (!mounted.current) return;
    useMatchStore.getState().setMyHand(Array.isArray(data?.cards) ? ((data?.cards ?? []) as Card[]) : []);
  }, [matchId, playerId]);

  const clear = useCallback(() => {
    useMatchStore.getState().setMyHand([]);
  }, []);

  useEffect(() => {
    if (!ready || !matchId || !playerId) {
      clear();
      return undefined;
    }
    setHandLoading(true);
    void reload().finally(() => {
      if (mounted.current) setHandLoading(false);
    });
    return undefined;
  }, [clear, matchId, playerId, ready, reload, setHandLoading]);

  useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const bind = useCallback<ChannelBinder>(
    (channel) => {
      if (!householdId) return;
      const filter = `household_id=eq.${householdId}`;
      const onChange = (): void => {
        void reload();
      };
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hands', filter }, onChange);
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hands', filter }, onChange);
    },
    [householdId, reload],
  );

  return { bind, reload, clear };
}

export default useMyHand;
