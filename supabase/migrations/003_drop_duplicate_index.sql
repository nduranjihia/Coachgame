-- 003: drop the index 002 duplicated ---------------------------------------
--
-- `one_active_match_per_household` has existed since 001. Migration 002 created
-- a second identical index under a different name by mistake; drop it.
--
-- Worth being clear about what that index does and does not do, because it
-- looks like a guarantee and is not one. It can only fire if two transactions
-- try to insert an active match for one home at the same instant. The real path
-- never does that: the TV's `drain()` awaits each pending command in id order,
-- so a second `start_match` is processed strictly after the first has already
-- inserted its match and committed. `create_match` abandons the active match and
-- inserts a new one inside a single transaction, which satisfies the index.
--
-- So the protection against a second start is `admitStartMatch` in
-- `useCommandProcessor`, which rejects the command before any SQL runs. The
-- index is a backstop for two TV sessions on one home, and nothing more.

drop index if exists public.matches_one_active_per_household;
