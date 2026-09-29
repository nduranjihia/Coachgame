// Temporary diagnostic probe. Not part of the app.
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

const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

function client(name) {
  const c = createClient(URL_, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond: 20 } },
  });
  c.__name = name;
  return c;
}

const tv = client('tv');
const phone = client('phone');

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 23)}]`, ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function signIn(c) {
  const { data, error } = await c.auth.signInAnonymously();
  if (error) {
    console.error(`${c.__name} signInAnonymously FAILED:`, error.message);
    process.exit(1);
  }
  log(`${c.__name} signed in uid=${data.user.id.slice(0, 8)}`);
  return data.user.id;
}

const tvUid = await signIn(tv);
const phoneUid = await signIn(phone);

// --- create household as the TV ---
const { data: hhRows, error: hhErr } = await tv.rpc('create_tv_household');
if (hhErr) {
  console.error('create_tv_household failed:', hhErr.message);
  process.exit(1);
}
const hh = Array.isArray(hhRows) ? hhRows[0] : hhRows;
log('household', hh.id, hh.join_code);

const { data: plRows, error: plErr } = await phone.rpc('join_household', {
  p_code: hh.join_code,
  p_name: 'Probe',
  p_emoji: '🦊',
  p_color: 'coral',
});
if (plErr) {
  console.error('join_household failed:', plErr.message);
  process.exit(1);
}
const player = Array.isArray(plRows) ? plRows[0] : plRows;
log('player', player.id);

// --- subscribe both sides ---
const phoneEvents = [];
const tvEvents = [];
const scope = `household_id=eq.${hh.id}`;

const phoneCh = phone.channel(`hh:${hh.id}`);
phoneCh.on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: scope }, (p) => {
  phoneEvents.push({ table: 'matches', type: p.eventType, status: p.new?.status, version: p.new?.version });
  log('PHONE <- matches', p.eventType, 'status=', p.new?.status, 'v=', p.new?.version);
});
phoneCh.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'commands', filter: scope }, (p) => {
  log('PHONE <- commands UPDATE', p.new?.id, p.new?.status);
});
phoneCh.on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: scope }, (p) => {
  log('PHONE <- players', p.eventType);
});
phoneCh.on('postgres_changes', { event: '*', schema: 'public', table: 'hands', filter: scope }, (p) => {
  log('PHONE <- hands', p.eventType);
});
phoneCh.on('presence', { event: 'sync' }, () => log('PHONE <- presence sync'));
phoneCh.subscribe((s) => log('phone channel status', s));

const tvCh = tv.channel(`hh:${hh.id}`);
tvCh.on('postgres_changes', { event: '*', schema: 'public', table: 'commands', filter: scope }, (p) => {
  tvEvents.push(p);
  log('TV <- commands', p.eventType, p.new?.type, 'id=', p.new?.id);
});
tvCh.on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: scope }, (p) => {
  log('TV <- matches', p.eventType, 'status=', p.new?.status, 'v=', p.new?.version);
});
tvCh.subscribe((s) => log('tv channel status', s));

await sleep(2500);

// --- phone sends a command ---
const { data: cmd, error: cmdErr } = await phone
  .from('commands')
  .insert({ household_id: hh.id, player_id: player.id, match_id: null, type: 'start_match', payload: { game: 'tictactoe', seats: [player.id] } })
  .select('id')
  .single();
if (cmdErr) {
  console.error('command insert failed:', cmdErr.message);
  process.exit(1);
}
log('PHONE sent command id=', cmd.id);

await sleep(3000);
log('TV received command events:', tvEvents.length);
log('PHONE received match events so far:', phoneEvents.length);

// --- TV creates a match (what the command processor does) ---
const state = { board: [null, null, null, null, null, null, null, null, null], turn: player.id, winLine: null, moveCount: 0 };
const { data: mRows, error: mErr } = await tv.rpc('create_match', {
  p_household: hh.id,
  p_game: 'tictactoe',
  p_seats: [player.id],
  p_state: state,
  p_hands: null,
  p_secrets: null,
  p_command_id: cmd.id,
});
if (mErr) {
  console.error('create_match failed:', mErr.message);
  process.exit(1);
}
const match = Array.isArray(mRows) ? mRows[0] : mRows;
log('TV created match', match.id, 'v', match.version);

await sleep(3000);
log('PHONE match events after INSERT:', JSON.stringify(phoneEvents));

// --- TV commits a turn (a move) ---
const moved = { ...state, board: ['X', null, null, null, null, null, null, null, null], moveCount: 1, turn: player.id };
const { data: ver, error: ctErr } = await tv.rpc('commit_turn', {
  p_match: match.id,
  p_expected_version: match.version,
  p_state: moved,
  p_status: 'active',
  p_winner: null,
  p_result: null,
  p_hands: null,
  p_secrets: null,
  p_command_id: null,
});
if (ctErr) {
  console.error('commit_turn failed:', ctErr.message);
} else {
  log('TV committed turn, new version', ver);
}

await sleep(4000);
log('FINAL phone match events:', JSON.stringify(phoneEvents));
log('FINAL tv events:', tvEvents.length);

// cleanup
await tv.rpc('delete_household', { p_household: hh.id });
log('cleaned up household');
process.exit(0);
