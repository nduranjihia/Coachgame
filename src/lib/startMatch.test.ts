import { describe, expect, it } from 'vitest';
import { admitStartMatch, type StartMatchRequest } from './startMatch';

const ALICE = 'aaaaaaaa-0000-0000-0000-000000000001';
const BOB = 'bbbbbbbb-0000-0000-0000-000000000002';
const CARLA = 'cccccccc-0000-0000-0000-000000000003';
const DAVE = 'dddddddd-0000-0000-0000-000000000004';
const STRANGER = 'eeeeeeee-0000-0000-0000-000000000005';

const everyone = [ALICE, BOB, CARLA, DAVE];

function req(over: Partial<StartMatchRequest> = {}): StartMatchRequest {
  return {
    seats: [ALICE, BOB],
    playerId: ALICE,
    knownPlayerIds: everyone,
    onlinePlayerIds: everyone,
    activeMatch: false,
    replace: false,
    minPlayers: 2,
    maxPlayers: 2,
    ...over,
  };
}

describe('admitStartMatch', () => {
  it('admits a first game in an empty lobby', () => {
    const verdict = admitStartMatch(req());
    expect(verdict).toEqual({ ok: true, seats: [ALICE, BOB] });
  });

  // The bug this pins: two phones tapping "Let's go" in the same lobby both
  // used to succeed, and the second one abandoned the match the first had just
  // created. The first player's phone showed a game that vanished, and its
  // command was marked `accepted`, so nobody was ever told.
  it('refuses a second game while one is already running', () => {
    const verdict = admitStartMatch(req({ activeMatch: true }));
    expect(verdict).toEqual({ ok: false, reason: 'match_in_progress' });
  });

  it('lets the loser of the race hear about it', () => {
    const first = admitStartMatch(req());
    expect(first.ok).toBe(true);
    // Bob taps a moment later, while Alice's game is running.
    const second = admitStartMatch(req({ playerId: BOB, seats: [BOB, CARLA], activeMatch: true }));
    expect(second).toEqual({ ok: false, reason: 'match_in_progress' });
  });

  it('allows replacing a running game only when the phone confirmed it', () => {
    const verdict = admitStartMatch(req({ activeMatch: true, replace: true }));
    expect(verdict).toEqual({ ok: true, seats: [ALICE, BOB] });
  });

  it('ignores a replace flag that is not exactly true', () => {
    const verdict = admitStartMatch(req({ activeMatch: true, replace: 'yes' as unknown as boolean }));
    expect(verdict).toEqual({ ok: false, reason: 'match_in_progress' });
  });

  it('still refuses a malformed seat list even with replace set', () => {
    expect(admitStartMatch(req({ replace: true, seats: [ALICE] }))).toEqual({
      ok: false,
      reason: 'bad_request',
    });
  });

  it('requires the asker to be one of the seats', () => {
    expect(admitStartMatch(req({ seats: [BOB, CARLA] }))).toEqual({ ok: false, reason: 'not_a_seat' });
  });

  it('rejects a seat that is not in this home', () => {
    expect(admitStartMatch(req({ seats: [ALICE, STRANGER] }))).toEqual({ ok: false, reason: 'not_a_seat' });
  });

  it('rejects a seat that is not connected', () => {
    expect(admitStartMatch(req({ onlinePlayerIds: [ALICE] }))).toEqual({
      ok: false,
      reason: 'player_offline',
    });
  });

  it('rejects a duplicate seat', () => {
    expect(admitStartMatch(req({ seats: [ALICE, ALICE] }))).toEqual({ ok: false, reason: 'bad_request' });
  });

  it('rejects a seat list that is not an array', () => {
    expect(admitStartMatch(req({ seats: 'ALICE,BOB' }))).toEqual({ ok: false, reason: 'bad_request' });
  });

  it('honours the two player games', () => {
    expect(admitStartMatch(req({ seats: [ALICE] }))).toEqual({ ok: false, reason: 'bad_request' });
    expect(admitStartMatch(req({ seats: [ALICE, BOB, CARLA] }))).toEqual({
      ok: false,
      reason: 'bad_request',
    });
  });

  it('allows two to four players in Wild Cards', () => {
    expect(admitStartMatch(req({ seats: [ALICE, BOB, CARLA, DAVE], maxPlayers: 4 }))).toEqual({
      ok: true,
      seats: [ALICE, BOB, CARLA, DAVE],
    });
    expect(admitStartMatch(req({ seats: [ALICE, BOB, CARLA, DAVE, ALICE], maxPlayers: 4 }))).toEqual({
      ok: false,
      reason: 'bad_request',
    });
  });
});
