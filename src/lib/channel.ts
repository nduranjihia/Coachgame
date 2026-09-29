import type { RealtimeChannel } from '@supabase/supabase-js';

/** Attaches listeners to a channel that has not been subscribed to yet. */
export type ChannelBinder = (channel: RealtimeChannel) => void;

/**
 * Attach every listener to the channel, then call `subscribe()` exactly once.
 *
 * Supabase's `RealtimeChannel.on()` throws for `presence` and `postgres_changes`
 * bindings added once the channel has joined or started joining, and a throw
 * inside a React effect tears down the whole tree down to the bare `body`
 * background. That is why listeners are declared up front and handed to
 * `useHousehold` as a `bind` option, rather than attached from an effect on the
 * `channel` value: by the time any component can observe the channel it is
 * already subscribed, so an effect is always too late.
 *
 * A binder that throws is logged and skipped rather than allowed to take the
 * screen down - a dead presence feed is recoverable, a blank television is not.
 */
export function bindThenSubscribe(
  channel: RealtimeChannel,
  bind: ChannelBinder | undefined,
  attach: (channel: RealtimeChannel) => void,
  onStatus: (status: string) => void,
): void {
  try {
    bind?.(channel);
    attach(channel);
  } catch (cause) {
    console.error('[couch-clash] channel binding failed', cause);
  }
  channel.subscribe(onStatus);
}
