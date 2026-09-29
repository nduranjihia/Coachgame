import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { setHouseholdId } from '@/lib/device';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import type { Household, Player } from '@/types/db';
import { useHealthCheck } from './useHealthCheck';

export interface HouseholdHooks {
  /** Any INSERT/UPDATE on `matches`, plus a resync after every reconnect. */
  onMatchEvent?: () => void;
  /** Realtime channel status: SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED. */
  onChannelStatus?: (status: string) => void;
}

export interface HouseholdApi {
  /** Load household + players and (re)start the realtime subscriptions. */
  bootstrap: () => Promise<void>;
  refetch: () => Promise<void>;
  reload: () => Promise<void>;
  /** The shared `hh:<id>` channel, or `null` until the household is known. */
  channel: RealtimeChannel | null;
}

function settingsOrDefaults(raw: unknown): Household['settings'] {
  const base = { lastCardPenalty: true, sound: true, moveHints: true };
  if (raw && typeof raw === 'object') return { ...base, ...(raw as Household['settings']) };
  return base;
}

/**
 * The core data hook: owns the household row, the player list, the realtime
 * channel and the "TV first run" flow (section 6.2).
 */
export function useHousehold(role: 'tv' | 'phone', uid: string | null, hooks: HouseholdHooks = {}): HouseholdApi {
  const householdId = useSession((s) => s.householdId);
  const setHousehold = useSession((s) => s.setHousehold);
  const setPlayers = useSession((s) => s.setPlayers);
  const setLoading = useSession((s) => s.setLoading);
  const markHomeGone = useSession((s) => s.markHomeGone);

  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const bootstrapped = useRef(false);
  const matchEventRef = useRef(hooks.onMatchEvent);
  matchEventRef.current = hooks.onMatchEvent;
  const statusRef = useRef(hooks.onChannelStatus);
  statusRef.current = hooks.onChannelStatus;

  const fetchPlayers = useCallback(
    async (id: string) => {
      const { data } = await supabase
        .from('players')
        .select('id, household_id, auth_uid, name, emoji, color, created_at')
        .eq('household_id', id)
        .order('created_at', { ascending: true });
      if (!data) return;
      setPlayers(data as Player[]);
    },
    [setPlayers],
  );

  const refetch = useCallback(async () => {
    const id = useSession.getState().householdId;
    if (!id) return;
    const { data, error } = await supabase
      .from('households')
      .select('id, join_code, settings, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return;
    const row = data as Household;
    setHousehold({ ...row, settings: settingsOrDefaults(row.settings) });
    await fetchPlayers(id);
  }, [fetchPlayers, setHousehold]);

  /** Verify the stored household still exists and this device is still a member. */
  const verify = useCallback(async (id: string, authUid: string): Promise<boolean> => {
    const { data: hh } = await supabase.from('households').select('id').eq('id', id).maybeSingle();
    if (!hh) return false;
    const { data: dev } = await supabase
      .from('devices')
      .select('id')
      .eq('household_id', id)
      .eq('auth_uid', authUid)
      .maybeSingle();
    return Boolean(dev);
  }, []);

  const startChannel = useCallback(
    (id: string) => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setChannel(null);

      const next = supabase.channel(`hh:${id}`);
      const scope = `household_id=eq.${id}`;

      next.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: scope }, () => {
        void refetch();
      });
      next.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players', filter: scope },
        () => {
          void fetchPlayers(id);
        },
      );
      next.on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: scope }, () => {
        void matchEventRef.current?.();
      });

      next.subscribe((status) => {
        statusRef.current?.(status);
        if (status === 'SUBSCRIBED') {
          // Safety net: refetch everything after every (re)connect.
          void refetch();
          void matchEventRef.current?.();
        }
      });
      channelRef.current = next;
      setChannel(next);
    },
    [fetchPlayers, refetch],
  );

  const bootstrap = useCallback(async () => {
    const authUid = uid;
    if (!authUid) return;
    setLoading(true);
    try {
      const store = useSession.getState();
      let id = store.householdId;

      if (id) {
        const ok = await verify(id, authUid);
        if (!ok) {
          setHouseholdId(null);
          id = null;
          useSession.setState({ householdId: null });
        }
      }

      if (!id && role === 'tv') {
        const { data, error } = await supabase.rpc('create_tv_household');
        if (error || !data) {
          setLoading(false);
          return;
        }
        const created = (Array.isArray(data) ? data[0] : data) as Household;
        setHouseholdId(created.id);
        useSession.setState({ householdId: created.id });
        id = created.id;
      }

      if (!id) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('households')
        .select('id, join_code, settings, created_at')
        .eq('id', id)
        .maybeSingle();
      if (error || !data) {
        setLoading(false);
        return;
      }
      const row = data as Household;
      setHousehold({ ...row, settings: settingsOrDefaults(row.settings) });
      await fetchPlayers(id);
      startChannel(id);
    } finally {
      setLoading(false);
    }
  }, [fetchPlayers, role, setHousehold, setLoading, startChannel, uid, verify]);

  const reload = useCallback(async () => {
    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setChannel(null);
    await bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    // `uid` arrives one effect tick after the role subtree mounts (App's auth
    // boot runs after its children), so only bootstrap once it is available.
    if (bootstrapped.current || !uid) return;
    bootstrapped.current = true;
    void bootstrap();
  }, [bootstrap, uid]);

  useEffect(
    () => () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    },
    [],
  );

  // Section 6.5: poll, and resync whenever the tab becomes visible again.
  useHealthCheck({ householdId, uid, role, onGone: markHomeGone, onAlive: refetch });

  return {
    bootstrap,
    refetch,
    reload,
    channel,
  };
}

export default useHousehold;
