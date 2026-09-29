import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { bindThenSubscribe, type ChannelBinder } from '@/lib/channel';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import type { Household, Player } from '@/types/db';
import { useHealthCheck } from './useHealthCheck';

export interface HouseholdHooks {
  /** Any INSERT/UPDATE on `matches`, plus a resync after every reconnect. */
  onMatchEvent?: () => void;
  /** Realtime channel status: SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED. */
  onChannelStatus?: (status: string) => void;
  /**
   * Extra listeners for the shared channel, run inside `startChannel` *before*
   * `subscribe()`. See `bindThenSubscribe` for why this cannot be an effect.
   */
  bind?: ChannelBinder;
}

export interface HouseholdApi {
  /** Load household + players and (re)start the realtime subscriptions. */
  bootstrap: () => Promise<void>;
  refetch: () => Promise<void>;
  reload: () => Promise<void>;
  /** The shared `hh:<id>` channel, or `null` until the household is known. */
  channel: RealtimeChannel | null;
  /** Why the last bootstrap gave up, or `null` while it has not. */
  error: string | null;
  /** Try the last failed bootstrap again. */
  retry: () => Promise<void>;
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
  const setHouseholdId = useSession((s) => s.setHouseholdId);
  const setPlayers = useSession((s) => s.setPlayers);
  const setLoading = useSession((s) => s.setLoading);
  const markHomeGone = useSession((s) => s.markHomeGone);

  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const bootstrapped = useRef(false);
  const matchEventRef = useRef(hooks.onMatchEvent);
  matchEventRef.current = hooks.onMatchEvent;
  const statusRef = useRef(hooks.onChannelStatus);
  statusRef.current = hooks.onChannelStatus;
  // Kept in a ref so a new binder identity never re-subscribes the channel.
  const bindRef = useRef<ChannelBinder | undefined>(hooks.bind);
  bindRef.current = hooks.bind;

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

      bindThenSubscribe(
        next,
        bindRef.current,
        (ch) => {
          ch.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: scope }, () => {
            void refetch();
          });
          ch.on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: scope }, () => {
            void fetchPlayers(id);
          });
          ch.on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: scope }, () => {
            void matchEventRef.current?.();
          });
        },
        (status) => {
          statusRef.current?.(status);
          if (status === 'SUBSCRIBED') {
            // Safety net: refetch everything after every (re)connect.
            void refetch();
            void matchEventRef.current?.();
          }
        },
      );
      channelRef.current = next;
      setChannel(next);
    },
    [fetchPlayers, refetch],
  );

  const bootstrap = useCallback(async () => {
    const authUid = uid;
    if (!authUid) return;
    setLoading(true);
    setError(null);
    try {
      const store = useSession.getState();
      let id = store.householdId;

      if (id) {
        const ok = await verify(id, authUid);
        if (!ok) {
          setHouseholdId(null);
          id = null;
        }
      }

      if (!id && role === 'tv') {
        const { data, error: rpcError } = await supabase.rpc('create_tv_household');
        if (rpcError || !data) {
          setError(rpcError ? `Could not create a home: ${rpcError.message}` : 'Could not create a home.');
          setLoading(false);
          return;
        }
        const created = (Array.isArray(data) ? data[0] : data) as Household;
        setHouseholdId(created.id);
        id = created.id;
      }

      if (!id) {
        setError('This device is not part of a home yet.');
        setLoading(false);
        return;
      }

      const { data, error: readError } = await supabase
        .from('households')
        .select('id, join_code, settings, created_at')
        .eq('id', id)
        .maybeSingle();
      if (readError || !data) {
        setError(readError ? `Could not load your home: ${readError.message}` : 'Could not load your home.');
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
  }, [fetchPlayers, role, setHousehold, setHouseholdId, setLoading, startChannel, uid, verify]);

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
    error,
    retry: bootstrap,
  };
}

export default useHousehold;
