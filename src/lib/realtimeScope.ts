/**
 * Realtime `postgres_changes` filters name a real column of the table they
 * filter, and getting that wrong fails *silently*: the channel still reports
 * SUBSCRIBED and still gets a subscription id back, but the server stops
 * delivering every `postgres_changes` event for the whole channel. The app
 * looks correctly synced while it has gone deaf - the phone stops seeing the
 * opponent's moves and the board only refreshs on a manual reload.
 *
 * `households` is the one table in this schema keyed by `id`; every table that
 * hangs off it carries `household_id`.
 */

/** Filter for a row of the `households` table itself. */
export const householdRowScope = (householdId: string): string => `id=eq.${householdId}`;

/** Filter for any table that carries a `household_id` foreign key. */
export const householdChildScope = (householdId: string): string => `household_id=eq.${householdId}`;
