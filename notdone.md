# Couch Clash — things that are NOT done (or need a human)

Everything in `context.md` is implemented and `npm run test` (67 tests) and
`npm run build` are green. This file lists the work that cannot be done from
inside the code editor, plus the small, deliberate deviations from the letter of
the spec.

---

## 1. Required manual steps (do these in order)

1. **Turn on anonymous sign-ins.**
   Supabase dashboard → Authentication → Sign In / Providers → enable
   **Allow anonymous sign-ins**. Without this the app deliberately shows the
   full-screen "One quick setup step" screen.

2. **Create `.env`** (copy `.env.example`) with the project's values from
   Supabase → Project Settings → API:
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_ANON_KEY=...`
   - Optional `VITE_PUBLIC_APP_URL=https://your-deployed-url` (used inside the
     QR join links; when empty `window.location.origin` is used).

3. **Run the SQL migration.**
   Apply `supabase/migrations/001_init.sql` to the project (SQL editor, or
   `supabase db push` / the Supabase integration). See the warning in section 2
   below before re-running it.

4. **Deploy before testing with phones.**
   Deploy the built app (Bolt "Publish", Netlify, or any static host that serves
   `dist/`). A preview/editor URL cannot be opened from a phone. Then:
   - open `/tv` on the big screen,
   - scan the QR with a phone.

5. **Verify `public/_redirects` shipped.**
   It contains exactly `/* /index.html 200` so deep links such as
   `/join/K7P2QX` work on Netlify. On hosts other than Netlify, configure the
   equivalent SPA fallback.

6. **Run the manual acceptance checklist** (section 18 of `context.md`,
   items 1–8) on the deployed URL. These require two real devices and a live
   Supabase project, so they were not run here.

---

## 2. Database notes / gotchas

- **`alter publication supabase_realtime add table ...` is not idempotent.**
  It is the last statement in `001_init.sql`. If you re-run the whole file
  (e.g. to apply a change) that line raises an error and any statements after it
  would not run. Apply the file once, or comment that line out on re-runs, or
  replace it with the `do $$ ... if not exists ... $$` form.
- The migration assumes the `supabase_realtime` publication already exists
  (it does on every Supabase project).
- `supabase/.temp/` is a Supabase CLI artifact and is now git-ignored.

---

## 3. Deliberate, documented deviations from the spec

These do **not** change behaviour, routes, tables, columns, commands or files;
they are only the minimum needed to make the code compile / behave correctly.

1. **`src/games/registry.ts` is `src/games/registry.tsx`.**
   The registry exports `GameIcon`, which contains JSX. A `.ts` file cannot hold
   JSX, so the file was renamed to `.tsx`. It lives in the same folder, exports
   the same names (`getGame`, `getEngine`, `isGameKey`, `GAME_KEYS`, `GameIcon`,
   default `registry`), and every `@/games/registry` import still resolves.

2. **TV Pairing shows four player slots, not the literal "two".**
   Section 11.1 says "two empty player slots". Wild Cards seats up to four
   players and the TV pairing screen is the live "who has joined" view, so it
   renders four dashed slots (2×2). The copy and layout are otherwise unchanged.

3. **Chess "insufficient material" is unit-tested at the predicate level.**
   There is no clean 2-seat full-game move list that *only* reaches insufficient
   material without passing through another terminal condition, so the test
   asserts `new Chess(bareKingsFen).isInsufficientMaterial() === true` directly
   and separately checks the engine's terminal-condition ordering. The engine
   code path itself (`isInsufficientMaterial()` → `result: 'insufficient'`) is
   implemented exactly as specified.

4. **Internal-only signatures** (not user-visible, no new features):
   - `EngineCtx<S>` has an optional `nameOf?` so the cards engine can write
     human log lines like "Sam played Skip" while staying pure.
   - The cards engine's `applyCommand` takes an optional third `rng` argument
     (default `Math.random`) and `createInitial` an optional `rng`, purely to
     make the tests deterministic.
   - `QrTile` gained an optional `codeSize` prop (the pairing screen needs a
     larger code).
   - Realtime listeners use the `filter` **string** form
     (`household_id=eq.<id>`), which is what `@supabase/supabase-js@2` /
     `realtime-js` currently accept; the object form is the older API.

---

## 4. Known runtime limitation (by design)

- **Two TVs in the same home / stale state:** handled by the version-conflict
  retry in `useCommandProcessor` (section 8.3). Not covered by an automated test
  because it needs a live database; verify manually if you edit the processor.
