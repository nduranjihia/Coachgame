/**
 * Whether a `start_match` command is allowed to run, and why not if it isn't.
 *
 * This was a block of inline checks inside `useCommandProcessor`, which is
 * almost impossible to test because reaching it needs a live Supabase client
 * and a running TV. The one rule it was missing - never end a running match
 * without an explicit confirmation - is the rule that let two phones tapping
 * "Let's go" in the same lobby each succeed, the second abandoning the match
 * the first had just created.
 *
 * Seat order is deliberately not decided here. The caller shuffles, so no
 * player can pick their own seat or guarantee themselves the first turn.
 */

export interface StartMatchRequest {
  /** Seats as they arrived from the phone: untrusted, possibly malformed. */
  seats: unknown;
  /** Who asked. RLS already forces this to be the sender's own player row. */
  playerId: string;
  /** Every player row in this home, so seats cannot name a stranger. */
  knownPlayerIds: readonly string[];
  /** Presence, so a game cannot start with somebody who has left. */
  onlinePlayerIds: readonly string[];
  /** Is a match already running in this home? */
  activeMatch: boolean;
  /** The phone confirmed "End it and play" on a confirm sheet. */
  replace: boolean;
  minPlayers: number;
  maxPlayers: number;
}

export type StartMatchVerdict = { ok: true; seats: string[] } | { ok: false; reason: string };

export function admitStartMatch(req: StartMatchRequest): StartMatchVerdict {
  const { seats, playerId, knownPlayerIds, onlinePlayerIds, activeMatch, replace, minPlayers, maxPlayers } = req;

  if (!Array.isArray(seats)) return { ok: false, reason: 'bad_request' };
  const seatsIn = seats as string[];
  if (seatsIn.length < minPlayers || seatsIn.length > maxPlayers) return { ok: false, reason: 'bad_request' };
  // Whoever asks is always playing: a phone cannot nominate someone else.
  if (!seatsIn.includes(playerId)) return { ok: false, reason: 'not_a_seat' };
  if (new Set(seatsIn).size !== seatsIn.length) return { ok: false, reason: 'bad_request' };

  const known = new Set(knownPlayerIds);
  if (!seatsIn.every((id) => known.has(id))) return { ok: false, reason: 'not_a_seat' };

  const online = new Set(onlinePlayerIds);
  if (!seatsIn.every((id) => online.has(id))) return { ok: false, reason: 'player_offline' };

  // A running match is never ended by accident. `rematch` already carried this
  // check and `start_match` did not; the index in migration 002 is the backstop
  // for the case where two commands are in flight at the same instant.
  //
  // `=== true`, not truthiness: `payload` is untrusted JSON, so `"yes"` and `1`
  // must not be able to end somebody's game.
  if (activeMatch && replace !== true) return { ok: false, reason: 'match_in_progress' };

  return { ok: true, seats: seatsIn };
}
