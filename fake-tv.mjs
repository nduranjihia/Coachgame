// Temporary diagnostic: a fake TV (plus one auto-playing rival) so the phone
// tab can be exercised on its own. Mirrors useCommandProcessor for tictactoe.
//
// State is persisted to fake-tv-state.json so a restart keeps the same TV device
// row (and therefore the same household) - that keeps the browser join valid.
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

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
const STATE_FILE = new URL('./fake-tv-state.json', import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(`[fake-tv]`, ...a);

const opts = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  realtime: { params: { eventsPerSecond: 20 } },
};

const tv = createClient(URL_, KEY, opts);
let hh;
let rivalPlayer;

if (existsSync(STATE_FILE) && !process.argv.includes('--fresh')) {
  const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const { data, error } = await tv.auth.setSession({
    access_token: saved.access_token,
    refresh_token: saved.refresh_token,
  });
  if (error) throw new Error('setSession: ' + error.message);
  log('resumed as uid', data.user.id.slice(0, 8));
  hh = { id: saved.household_id, join_code: saved.join_code };
  const { data: pl } = await tv.from('players').select('*').eq('household_id', hh.id).eq('name', 'Rival').limit(1);
  rivalPlayer = pl?.[0];
  log('JOIN CODE', hh.join_code, 'household', hh.id, 'rival', rivalPlayer?.id);
} else {
  const { data: auth, error: authErr } = await tv.auth.signInAnonymously();
  if (authErr) throw new Error(authErr.message);
  const { data: hhRows, error: hhErr } = await tv.rpc('create_tv_household');
  if (hhErr) throw new Error(hhErr.message);
  hh = Array.isArray(hhRows) ? hhRows[0] : hhRows;
  log('JOIN CODE', hh.join_code);
  log('HOUSEHOLD', hh.id);

  const rival = createClient(URL_, KEY, opts);
  await rival.auth.signInAnonymously();
  const { data: rRows, error: rErr } = await rival.rpc('join_household', {
    p_code: hh.join_code, p_name: 'Rival', p_emoji: '🐯', p_color: 'sky',
  });
  if (rErr) throw new Error(rErr.message);
  rivalPlayer = Array.isArray(rRows) ? rRows[0] : rRows;
  log('RIVAL PLAYER', rivalPlayer.id);

  const { data: sess } = await tv.auth.getSession();
  writeFileSync(
    STATE_FILE,
    JSON.stringify({
      access_token: sess.session.access_token,
      refresh_token: sess.session.refresh_token,
      join_code: hh.join_code,
      household_id: hh.id,
      rival_id: rivalPlayer.id,
    }),
  );
  log('saved state to fake-tv-state.json');
}

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const scope = `household_id=eq.${hh.id}`;
const ch = tv.channel(`hh:${hh.id}`);
ch.on(
  'postgres_changes',
  { event: 'INSERT', schema: 'public', table: 'commands', filter: scope },
  (p) => void handle(p.new),
);
ch.subscribe((s) => log('channel', s));
await sleep(800);
await ch.track({ kind: 'tv' });
log('TV presence tracked');

// A second socket for the rival's presence, so it is not overwritten by the
// TV's: realtime-js picks the presence key per socket.
const rivalClient = createClient(URL_, KEY, opts);
await rivalClient.auth.signInAnonymously();
const rch = rivalClient.channel(`hh:${hh.id}`);
rch.subscribe((s) => log('rival channel', s));
await sleep(600);
await rch.track({ kind: 'phone', playerId: rivalPlayer.id });
log('Rival presence tracked');

let match = null;

async function commit(nextState, status, winner, result, commandId) {
  const { data, error } = await tv.rpc('commit_turn', {
    p_match: match.id,
    p_expected_version: match.version,
    p_state: nextState,
    p_status: status,
    p_winner: winner,
    p_result: result,
    p_hands: null,
    p_secrets: null,
    p_command_id: commandId ?? null,
  });
  if (error) {
    log('commit error', error.message);
    return false;
  }
  match = { ...match, state: nextState, version: data, status };
  log('committed ->', status, 'v', data);
  return true;
}

async function createMatch(seats, commandId) {
  const state = { board: Array(9).fill(null), turn: seats[0], winLine: null, moveCount: 0 };
  const { data, error } = await tv.rpc('create_match', {
    p_household: hh.id,
    p_game: 'tictactoe',
    p_seats: seats,
    p_state: state,
    p_hands: null,
    p_secrets: null,
    p_command_id: commandId ?? null,
  });
  if (error) return log('create_match error', error.message);
  match = Array.isArray(data) ? data[0] : data;
  log('created match', match.id, 'seats', seats.map((s) => s.slice(0, 8)).join(','));
}

async function rivalTurn() {
  await sleep(1500);
  if (!match || match.status !== 'active') return;
  if (match.state.turn !== rivalPlayer.id) return;
  const state = { ...match.state, board: [...match.state.board] };
  const empty = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => state.board[i] === null);
  if (!empty.length) return;
  state.board[empty[0]] = 'O';
  state.moveCount += 1;
  const line = LINES.find(
    ([a, b, c]) => state.board[a] && state.board[a] === state.board[b] && state.board[b] === state.board[c],
  );
  if (line) {
    state.winLine = line;
    await commit(state, 'finished', rivalPlayer.id, 'three_in_row');
    return;
  }
  const mine = match.seats[0] === rivalPlayer.id ? 1 : 0;
  state.turn = match.seats[mine];
  await commit(state, 'active', null, null);
  log('rival moved to cell', empty[0]);
}

async function handle(cmd) {
  log('command', cmd.type, 'id', cmd.id, 'from', cmd.player_id.slice(0, 8));
  if (cmd.type === 'start_match') {
    await createMatch(cmd.payload.seats, cmd.id);
    void rivalTurn();
    return;
  }
  if (cmd.type === 'move' && match) {
    const cell = cmd.payload.cell;
    const state = { ...match.state, board: [...match.state.board] };
    if (state.board[cell] !== null || state.turn !== cmd.player_id) {
      await tv.rpc('resolve_command', { p_id: cmd.id, p_status: 'rejected', p_reason: 'not_your_turn' });
      return log('rejected move (not their turn)');
    }
    state.board[cell] = match.seats[0] === cmd.player_id ? 'X' : 'O';
    state.moveCount += 1;
    const line = LINES.find(
      ([a, b, c]) => state.board[a] && state.board[a] === state.board[b] && state.board[b] === state.board[c],
    );
    if (line) {
      state.winLine = line;
      await commit(state, 'finished', cmd.player_id, 'three_in_row', cmd.id);
      return;
    }
    const mine = match.seats[0] === cmd.player_id ? 1 : 0;
    state.turn = match.seats[mine];
    const ok = await commit(state, 'active', null, null, cmd.id);
    if (ok) void rivalTurn();
  }
}

import { createServer } from 'node:http';
createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  res.setHeader('content-type', 'application/json');
  if (url.pathname === '/who') {
    res.end(JSON.stringify({
      joinCode: hh.join_code,
      householdId: hh.id,
      rivalId: rivalPlayer.id,
      match: match && { id: match.id, version: match.version, state: match.state, status: match.status },
    }));
    return;
  }
  if (url.pathname === '/players') {
    void (async () => {
      const { data } = await tv.from('players').select('id,name,created_at').eq('household_id', hh.id);
      res.end(JSON.stringify(data));
    })();
    return;
  }
  if (url.pathname === '/reset') {
    void (async () => {
      await tv.from('commands').delete().eq('household_id', hh.id);
      match = null;
      res.end('{"ok":true}');
    })();
    return;
  }
  res.statusCode = 404;
  res.end('{}');
}).listen(8899, '127.0.0.1', () => log('control server on http://127.0.0.1:8899'));
