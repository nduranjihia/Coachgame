import { useCallback, useEffect, useRef } from 'react';
import type { ChannelBinder } from '@/lib/channel';
import { COMMAND_TIMEOUT_MS } from '@/lib/constants';
import { friendlyMessage, FALLBACK_MESSAGE, TV_OFFLINE_MESSAGE } from '@/lib/errors';
import { hapticReject } from '@/lib/haptics';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import type { CommandType } from '@/types/db';

export interface SendCommandOptions {
  householdId: string | null;
  playerId: string | null;
  /** Id of the active match, or `null` for `start_match`. */
  activeMatchId: string | null;
  /**
   * Changes whenever the TV committed anything (new match, new version, or a
   * finished match). That is the "answer" a phone waits for.
   */
  answerKey: string | null;
  ready: boolean;
}

export interface SendCommandApi {
  /** A channel binder for the `commands` table. See `bindThenSubscribe`. */
  bind: ChannelBinder;
  send: (type: CommandType, payload?: Record<string, any>, matchId?: string | null) => Promise<boolean>;
  hasPending: () => boolean;
}

/**
 * Section 8.2. The phone only ever inserts a row into `commands` and then waits:
 * it never assumes the move happened. A rejection toast, or the 4 second
 * "TV didn't answer" nudge, is the only feedback.
 */
export function useSendCommand({
  householdId,
  playerId,
  activeMatchId,
  answerKey,
  ready,
}: SendCommandOptions): SendCommandApi {
  const pushToast = useSession((s) => s.pushToast);
  const pending = useRef(new Set<number>());
  const timers = useRef(new Map<number, number>());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      for (const t of timers.current.values()) window.clearTimeout(t);
      timers.current.clear();
      pending.current.clear();
    };
  }, []);

  const forget = useCallback((id: number) => {
    pending.current.delete(id);
    const t = timers.current.get(id);
    if (t !== undefined) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  // Any change to the match rows means the TV accepted what it was working on.
  useEffect(() => {
    if (!ready) return;
    for (const id of Array.from(pending.current)) forget(id);
  }, [answerKey, forget, ready]);

  // A command row turning accepted or rejected is the phone's answer. Bound
  // before the channel subscribes, because `postgres_changes` cannot be added
  // to a channel that has already joined.
  const bind = useCallback<ChannelBinder>(
    (channel) => {
      if (!householdId) return;
      const filter = `household_id=eq.${householdId}`;
      const onUpdate = (payload: {
        new: { id: number; player_id: string; status: string; reason: string | null };
      }): void => {
        const row = payload?.new;
        if (!row || row.player_id !== playerId) return;
        if (row.status === 'rejected') {
          pushToast(friendlyMessage(row.reason), 'error');
          hapticReject();
          forget(row.id);
        } else if (row.status === 'accepted') {
          forget(row.id);
        }
      };
      channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'commands', filter }, onUpdate);
    },
    [forget, householdId, playerId, pushToast],
  );

  const send = useCallback(
    async (type: CommandType, payload: Record<string, any> = {}, matchId?: string | null): Promise<boolean> => {
      if (!householdId || !playerId) return false;
      const target = matchId === undefined ? activeMatchId : matchId;
      const { data, error } = await supabase
        .from('commands')
        .insert({
          household_id: householdId,
          player_id: playerId,
          match_id: target,
          type,
          payload,
        })
        .select('id')
        .single();
      if (error || !data) {
        pushToast(FALLBACK_MESSAGE, 'error');
        return false;
      }
      const id = Number(data.id);
      if (!mounted.current) return true;
      pending.current.add(id);
      timers.current.set(
        id,
        window.setTimeout(() => {
          if (pending.current.has(id)) {
            pending.current.delete(id);
            timers.current.delete(id);
            pushToast(TV_OFFLINE_MESSAGE, 'error');
          }
        }, COMMAND_TIMEOUT_MS),
      );
      return true;
    },
    [activeMatchId, householdId, playerId, pushToast],
  );

  return { bind, send, hasPending: () => pending.current.size > 0 };
}

export default useSendCommand;
