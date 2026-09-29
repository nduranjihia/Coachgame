import { useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useSession } from '@/store/session';

export interface PresenceOptions {
  channel: RealtimeChannel | null;
  role: 'tv' | 'phone';
  uid: string | null;
  myPlayerId: string | null;
  ready: boolean;
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
 */
export function usePresence({ channel, role, uid, myPlayerId, ready }: PresenceOptions): void {
  const setPresence = useSession((s) => s.setPresence);
  const myPlayerIdRef = useRef(myPlayerId);
  myPlayerIdRef.current = myPlayerId;

  useEffect(() => {
    if (!ready || !channel || !uid) return undefined;
    let cancelled = false;

    const read = (): void => {
      if (cancelled) return;
      const state = channel.presenceState<PresenceEntry>();
      const entries: PresenceEntry[] = [];
      for (const key of Object.keys(state)) {
        for (const meta of state[key]) if (meta) entries.push(meta);
      }
      const { players, tv } = collect(entries);
      setPresence(players, tv);
    };

    const trackSelf = (): void => {
      const payload: PresenceEntry =
        role === 'tv' ? { kind: 'tv' } : { kind: 'phone', playerId: myPlayerIdRef.current };
      void channel.track(payload, { uid }).catch(() => undefined);
    };

    channel.on('presence', { event: 'sync' }, read);
    channel.on('presence', { event: 'join' }, read);
    channel.on('presence', { event: 'leave' }, read);
    trackSelf();
    read();

    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        read();
        trackSelf();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [channel, ready, role, setPresence, uid]);
}

export default usePresence;
