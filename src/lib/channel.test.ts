import { describe, expect, it, vi } from 'vitest';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { bindThenSubscribe } from './channel';

/**
 * A stand-in that copies the one rule that matters from
 * `@supabase/realtime-js/dist/main/RealtimeChannel.js`:
 *
 *   const stateCheck = isJoined() || isJoining();
 *   const typeCheck  = type === PRESENCE || type === POSTGRES_CHANGES;
 *   if (stateCheck && typeCheck) throw new Error('cannot add ... after `subscribe()`');
 */
class FakeChannel {
  private state: 'idle' | 'joining' | 'joined' = 'idle';
  readonly onCalls: string[] = [];
  /** How many listeners existed at the moment of each `subscribe()`. */
  readonly bindingsAtSubscribe: number[] = [];

  on(type: string): this {
    const subscribed = this.state === 'joining' || this.state === 'joined';
    if (subscribed && (type === 'presence' || type === 'postgres_changes')) {
      throw new Error(`cannot add \`${type}\` callbacks after \`subscribe()\`.`);
    }
    this.onCalls.push(type);
    return this;
  }

  subscribe(callback: (status: string) => void): this {
    this.state = 'joining';
    this.bindingsAtSubscribe.push(this.onCalls.length);
    callback('SUBSCRIBED');
    this.state = 'joined';
    return this;
  }
}

const cast = (fake: FakeChannel): RealtimeChannel => fake as unknown as RealtimeChannel;

describe('bindThenSubscribe', () => {
  // The bug this pins: listeners were attached from an effect on `channel`,
  // which by then was always already subscribed, so Supabase threw and React
  // unmounted the whole tree - a black television with no error on screen.
  it('binds every listener before it subscribes', () => {
    const fake = new FakeChannel();

    bindThenSubscribe(
      cast(fake),
      (channel) => {
        channel.on('presence', { event: 'sync' }, () => {});
        channel.on('presence', { event: 'join' }, () => {});
      },
      (channel) => {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {});
      },
      () => {},
    );

    expect(fake.onCalls).toEqual(['presence', 'presence', 'postgres_changes']);
    expect(fake.bindingsAtSubscribe).toEqual([3]);
  });

  it('does not let a throwing binder take down the channel', () => {
    const fake = new FakeChannel();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      bindThenSubscribe(
        cast(fake),
        () => {
          throw new Error('binder exploded');
        },
        () => {},
        () => {},
      ),
    ).not.toThrow();

    // The channel still subscribes, so the screen still comes up.
    expect(fake.bindingsAtSubscribe).toEqual([0]);
    spy.mockRestore();
  });

  it('still subscribes when there is nothing to bind', () => {
    const fake = new FakeChannel();
    bindThenSubscribe(cast(fake), undefined, () => {}, () => {});
    expect(fake.bindingsAtSubscribe).toEqual([0]);
  });
});
