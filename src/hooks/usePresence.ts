import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useSession } from '@/store/session';
import type { ChannelBinder } from './useHousehold';

export interface PresenceOptions {
  role: 'tv' | 'phone';
  uid: string | null;
}

interface PresenceEntry {
  kind?: 'tv' | 'phone';
  playerId?: string | null;
}

function collect(entries: PresenceEntry[]): { players: string[]; tv: boolean } {
  const players: string[] = [];
  let tv = false;
  for (const e of entries) {
    if (e?.kind === 'tv') tv = true;
    else if (e?.playerId) players.push(e.playerId);
  }
  return { players, tv };
}

/**
 * Section 6.6. Shares the `hh:<id>` channel with `useHousehold`: the presence
 * key is the device's auth uid, tracked as `{kind:'tv'}` or
 * `{kind:'phone', playerId}`.
 *
 * Returns a binder rather than listening to the channel itself. Supabase throws
 * on `presence` bindings added after `subscribe()`, and the channel is already
 * subscribed by the time any component can see it - an effect that reacted to
 * it would crash the app. The binder is applied inside `startChannel` instead.
 */
export function usePresence({ role, uid }: PresenceOptions): ChannelBinder {
  const setPresence = useSession((s) => s.setPresence);
  const channelRef = useRef<RealtimeChannel | null>(null);

  /** Announce this device. Safe to repeat: it upserts the same presence key. */
  const track = useCallback((): void => {
    const channel = channelRef.current;
    if (!channel || !uid) return;
    const payload: PresenceEntry =
      role === 'tv' ? { kind: 'tv' } : { kind: 'phone', playerId: useSession.getState().myPlayerId };
    void channel.track(payload, { uid }).catch(() => undefined);
  }, [role, uid]);

  const read = useCallback((): void => {
    const channel = channelRef.current;
    if (!channel) return;
    const state = channel.presenceState<PresenceEntry>();
    const entries: PresenceEntry[] = [];
    for (const key of Object.keys(state)) {
      for (const meta of state[key]) if (meta) entries.push(meta);
    }
    const { players, tv } = collect(entries);
    setPresence(players, tv);
  }, [setPresence]);

  useEffect(() => {
    const onVisible = (): void => {
      if (document.visibilityState !== 'visible') return;
      // Coming back from a suspend: re-announce and re-read, because the
      // server drops presence for a client that was away.
      read();
      track();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [read, track]);

  return useCallback<ChannelBinder>(
    (channel) => {
      channelRef.current = channel;

      // `sync` is the only event that is guaranteed to arrive after a join or
      // a reconnect, and the channel is only pushable once it has joined - so
      // this is where the device announces itself.
      channel.on('presence', { event: 'sync' }, () => {
        read();
        track();
      });
      channel.on('presence', { event: 'join' }, read);
      channel.on('presence', { event: 'leave' }, read);
    },
    [read, track],
  );
}

export default usePresence;
