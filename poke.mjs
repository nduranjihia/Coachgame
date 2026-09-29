// Temporary diagnostic: pushes a match change into a household so the phone's
// realtime wiring can be observed from the browser.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('./.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const householdId = process.argv[2];
const op = process.argv[3] ?? 'create';
const cell = Number(process.argv[4] ?? 0);
if (!householdId) throw new Error('usage: node poke.mjs <householdId> [create|move] [cell]');

const tv = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const { error: authErr } = await tv.auth.signInAnonymously();
if (authErr) throw new Error(authErr.message);

const { data: players } = await tv.from('players').select('id,name').eq('household_id', householdId);
const { data: mine } = await tv.from('devices').select('id,kind').eq('household_id', householdId);
console.log('players', players.map((p) => p.name), 'devices', mine);

const { data: hh } = await tv.from('households').select('join_code').eq('id', householdId).single();
console.log('join code', hh.join_code);

if (op === 'create') {
  // Become a TV for this household is not possible here, so ask via RPC only if
  // we own it; otherwise report and stop.
  const { data, error } = await tv.rpc('create_match', {
    p_household: householdId,
    p_game: 'tictactoe',
    p_seats: players.map((p) => p.id),
    p_state: { board: Array(9).fill(null), turn: players[0].id, winLine: null, moveCount: 0 },
    p_hands: null,
    p_secrets: null,
    p_command_id: null,
  });
  console.log('create_match', error ? error.message : (Array.isArray(data) ? data[0] : data));
} else {
  const { data: rows } = await tv
    .from('matches')
    .select('*')
    .eq('household_id', householdId)
    .eq('status', 'active')
    .limit(1);
  const match = rows?.[0];
  if (!match) throw new Error('no active match');
  const state = { ...match.state, board: [...match.state.board] };
  state.board[cell] = 'X';
  state.moveCount += 1;
  const { data, error } = await tv.rpc('commit_turn', {
    p_match: match.id,
    p_expected_version: match.version,
    p_state: state,
    p_status: 'active',
    p_winner: null,
    p_result: null,
    p_hands: null,
    p_secrets: null,
    p_command_id: null,
  });
  console.log('commit_turn', error ? error.message : data);
}
