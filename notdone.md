# Couch Clash — status, manual steps and known limitations

`npm run test` (67 tests) and `npm run build` (`tsc --noEmit && vite build`) are
green. Everything in `context.md` is implemented. This file tracks the work that
needs a human, plus the small deliberate deviations from the letter of the spec.

---

## 1. What has already been done

- **Database migration applied.** `supabase/migrations/001_init.sql` was pushed
  to the linked project (`coachgame` / `varmhmmqzskdzpybalci`) with
  `npx supabase db push`. Output: `Finished supabase db push.`
- **`vercel.json` added** for SPA routing on Vercel (see section 3).
- **Phone layout fixes** (see section 5).

`npx supabase functions deploy` was **not** needed — this project has no Edge
Functions (`supabase/functions/` does not exist). All server logic lives in
Postgres RPCs.

---

## 2. What you still need to do

1. **Turn on anonymous sign-ins.** Supabase dashboard → Authentication →
   Sign In / Providers → enable **Allow anonymous sign-ins**. This cannot be
   done with the CLI link; it is a dashboard toggle. Without it the app shows the
   full-screen "One quick setup step" screen.

2. **Set the environment variables on Vercel** (Project → Settings →
   Environment Variables):
   - `VITE_SUPABASE_URL` = `https://varmhmmqzskdzpybalci.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your anon key
   - Optional `VITE_PUBLIC_APP_URL` = your deployed `https://…` URL (used inside
     the QR join links; if empty, `window.location.origin` is used — which is
     usually what you want, so you can leave it blank).
   Local dev already reads these from `.env`.

3. **Deploy on Vercel.** `vercel.json` is set up (framework `vite`, build
   `npm run build`, output `dist`, SPA fallback). A Bolt/editor preview URL
   cannot be opened from a phone, so test on the deployed URL: open `/tv` on the
   big screen, scan the QR with a phone.

4. **Run the manual acceptance checklist** (section 18 of `context.md`, items
   1–8) on the deployed URL. These need two real devices and a live Supabase
   project.

---

## 3. Vercel routing

`vercel.json` contains:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

The rewrite is the SPA fallback, so deep links such as `/join/K7P2QX` and `/tv`
load the app instead of a 404. Static files (JS/CSS/favicon) are served from the
filesystem before the rewrite, so they are unaffected. `public/_redirects` is
kept as well (it is the Netlify equivalent required by the spec) — it is
harmless on Vercel.

---

## 4. Database notes / gotchas

- **`alter publication supabase_realtime add table ...` is not idempotent.** It is
  the last statement in `001_init.sql`. It already ran once. If you re-run the
  whole file you will get an error on that line and later statements would not
  run — comment it out (or drop that line) on any re-run.
- **The `.env.example` template had a truncated last line** (`VITE_PUBLIC_AP`
  instead of `VITE_PUBLIC_APP_URL=`), which also made `supabase db push` fail
  with `failed to parse environment file: .env`. Fixed in both `.env` and
  `.env.example`.
- `supabase/.temp/` is a Supabase CLI artifact and is git-ignored.

---

## 5. Phone layout fixes (done)

- **Horizontal scroll on "Enter the TV code".** The six boxes were fixed at 56px
  each (6 × 56 + gaps + padding ≈ 424px), which overflowed a 360–390px phone.
  They are now a responsive 6-column grid with fluid width/height/font
  (`clamp`), so six boxes fit on a 360px screen with room to spare. Verified at
  360px: grid 312px, each box 45px wide, no overflow of its container.
- **Bottom nav pushed below the fold.** Each tab screen (Home / Stats /
  Settings) is `height:100dvh`, and the nav was rendered after it, making the
  page taller than the screen. The tab screens and nav now live inside a
  `.cc-phone-shell` flex column so the nav always sits on screen.
- Added a global `html, body { overflow-x: hidden }` guard so no phone screen
  can scroll sideways.

---

## 6. Deliberate, documented deviations from the spec

These do **not** change behaviour, routes, tables, columns, commands or files.

1. **`src/games/registry.ts` is `src/games/registry.tsx`.** The registry exports
   `GameIcon`, which contains JSX, and a `.ts` file cannot hold JSX. Same folder,
   same exports, all `@/games/registry` imports resolve.
2. **TV Pairing shows four player slots, not the literal "two".** Wild Cards
   seats up to four players and the pairing screen is the live "who has joined"
   view.
3. **Internal-only signatures** (no new features): optional `nameOf?` on
   `EngineCtx` for human log lines; optional `rng` in the cards engine for
   deterministic tests; optional `QrTile.codeSize`; realtime `filter` uses the
   string form (`household_id=eq.<id>`) required by the current
   `@supabase/supabase-js@2` / `realtime-js`.

---

## 7. Chess rules coverage (complete)

Every chess end condition in section 9 of the spec is exercised through the
engine's real replay path, not just the chess.js predicates:

- checkmate (fool's mate), stalemate, threefold repetition, draw by agreement,
  resignation, promotion (default queen and explicit piece).
- **insufficient material** now runs end to end. The test replays a real, legal
  **16.5-move (33-ply) "bare kings" game** — Ponzetto's refinement of Sam Loyd's
  classic problem (`src/games/chess/engine.test.ts`, `BARE_KINGS_LINE`) — and
  asserts the engine finishes with `result: 'insufficient'`, `winnerId: null`, the exact final FEN
  `8/4k3/8/8/8/8/5K2/8 b - - 0 17` and 30 captured pieces (kings excluded). A
  companion test stops two plies short and asserts the game is still `active`, so
  the branch cannot fire early. Source:
  <https://chess.stackexchange.com/questions/18258/fastest-king-vs-king-endgame>
  (the line was verified move-by-move with the installed `chess.js@1.4.0`).
