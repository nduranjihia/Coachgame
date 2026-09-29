import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { chessEngine, createInitialState, replay } from './engine';
import type { ChessState, EngineCtx, EngineResult } from '@/types/games';
import { DEFAULT_SETTINGS } from '@/types/db';

const W = 'white-player';
const B = 'black-player';

type Seq = [string, string, (string | undefined)?][];

function ctx(state: ChessState): EngineCtx<ChessState> {
  return { seats: [W, B], state, settings: DEFAULT_SETTINGS };
}

function fresh(): EngineCtx<ChessState> {
  return ctx(createInitialState([W, B]));
}

/** Apply moves, always by whoever is on move. Returns the last engine result. */
function run(c: EngineCtx<ChessState>, seq: Seq): EngineResult<ChessState> {
  let cur = c;
  let res: EngineResult<ChessState> = { ok: false, reason: 'bad_request' };
  for (const [from, to, promotion] of seq) {
    const who = cur.state.turn === 'w' ? W : B;
    res = chessEngine.applyCommand(cur, { playerId: who, type: 'move', payload: { from, to, promotion } });
    if (!res.ok) break;
    cur = ctx(res.state);
    if (res.status === 'finished') break;
  }
  return res;
}

const PROMO_LINE: Seq = [
  ['b2', 'b4'],
  ['b8', 'c6'],
  ['a2', 'a3'],
  ['a7', 'a5'],
  ['c2', 'c3'],
  ['a5', 'b4'],
  ['a3', 'a4'],
  ['a8', 'b8'],
  ['a4', 'a5'],
  ['h7', 'h6'],
  ['a5', 'a6'],
  ['h6', 'h5'],
  ['a6', 'a7'],
  ['g7', 'g6'],
  ['a7', 'a8'],
];

const STALEMATE_LINE: Seq = [
  ['e2', 'e3'],
  ['a7', 'a5'],
  ['d1', 'h5'],
  ['a8', 'a6'],
  ['h5', 'a5'],
  ['h7', 'h5'],
  ['a5', 'c7'],
  ['a6', 'h6'],
  ['h2', 'h4'],
  ['f7', 'f6'],
  ['c7', 'd7'],
  ['e8', 'f7'],
  ['d7', 'b7'],
  ['d8', 'd3'],
  ['b7', 'b8'],
  ['d3', 'h7'],
  ['b8', 'c8'],
  ['f7', 'g6'],
  ['c8', 'e6'],
];

describe('chess engine', () => {
  it('starts from the standard position with white (seats[0]) to move', () => {
    const { state } = chessEngine.createInitial([W, B]);
    expect(state.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(state.turn).toBe('w');
    expect(state.white).toBe(W);
    expect(state.black).toBe(B);
    expect(state.moves).toEqual([]);
    expect(state.san).toEqual([]);
    expect(state.inCheck).toBe(false);
    expect(state.lastMove).toBeNull();
    expect(state.captured).toEqual({ w: [], b: [] });
  });

  it('accepts a legal move and records SAN, FEN and lastMove', () => {
    const res = run(fresh(), [['e2', 'e4']]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.status).toBe('active');
    expect(res.state.san).toEqual(['e4']);
    expect(res.state.turn).toBe('b');
    expect(res.state.lastMove).toEqual({ from: 'e2', to: 'e4' });
    expect(res.state.moves).toEqual([{ from: 'e2', to: 'e4' }]);
    expect(res.state.fen.split(' ')[0]).toBe('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR');
  });

  it('rejects an illegal move', () => {
    const r = chessEngine.applyCommand(fresh(), { playerId: W, type: 'move', payload: { from: 'e2', to: 'e5' } });
    expect(r).toEqual({ ok: false, reason: 'illegal_move' });
  });

  it('rejects a move out of turn', () => {
    const r = chessEngine.applyCommand(fresh(), { playerId: B, type: 'move', payload: { from: 'e7', to: 'e5' } });
    expect(r).toEqual({ ok: false, reason: 'not_your_turn' });
  });

  it('rejects malformed squares and non-seats', () => {
    const c = fresh();
    expect(chessEngine.applyCommand(c, { playerId: W, type: 'move', payload: { from: 'z9', to: 'e4' } })).toEqual({
      ok: false,
      reason: 'bad_request',
    });
    expect(chessEngine.applyCommand(c, { playerId: 'stranger', type: 'move', payload: { from: 'e2', to: 'e4' } })).toEqual({
      ok: false,
      reason: 'not_a_seat',
    });
  });

  it('detects checkmate (fools mate)', () => {
    const res = run(fresh(), [
      ['f2', 'f3'],
      ['e7', 'e5'],
      ['g2', 'g4'],
      ['d8', 'h4'],
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.status).toBe('finished');
    expect(res.result).toBe('checkmate');
    expect(res.winnerId).toBe(B);
    expect(res.state.inCheck).toBe(true);
    expect(res.state.san).toEqual(['f3', 'e5', 'g4', 'Qh4#']);
  });

  it('detects stalemate', () => {
    const res = run(fresh(), STALEMATE_LINE);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.status).toBe('finished');
    expect(res.result).toBe('stalemate');
    expect(res.winnerId).toBeNull();
  });

  it('defaults a promotion to a queen', () => {
    const res = run(fresh(), PROMO_LINE);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.status).toBe('active');
    const last = res.state.moves[res.state.moves.length - 1];
    expect(last).toEqual({ from: 'a7', to: 'a8', promotion: 'q' });
    expect(res.state.san[res.state.san.length - 1]).toBe('a8=Q');
  });

  it('honours an explicit promotion piece', () => {
    const res = run(fresh(), [...PROMO_LINE.slice(0, -1), ['a7', 'a8', 'n']]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.moves[res.state.moves.length - 1]).toEqual({ from: 'a7', to: 'a8', promotion: 'n' });
    expect(res.state.san[res.state.san.length - 1]).toBe('a8=N');
  });

  it('detects insufficient material through the chess.js predicate the engine uses', () => {
    // The engine delegates to `chess.isInsufficientMaterial()`; a bare-kings
    // position is the canonical insufficient-material case.
    const bare = new Chess();
    bare.load('8/8/8/4k3/8/8/8/4K3 w - - 0 1');
    expect(bare.isInsufficientMaterial()).toBe(true);

    const kq = new Chess();
    kq.load('8/8/8/4k3/8/8/8/3QK3 w - - 0 1');
    expect(kq.isInsufficientMaterial()).toBe(false);
  });

  it('records captured pieces by the capturing colour', () => {
    const res = run(fresh(), [
      ['e2', 'e4'],
      ['d7', 'd5'],
      ['e4', 'd5'],
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.captured.w).toEqual(['p']);
    expect(res.state.captured.b).toEqual([]);
  });

  it('flags check on the king', () => {
    // White checks on the 5th ply, so the game stays active with black to move.
    const res = run(fresh(), [
      ['e2', 'e4'],
      ['e7', 'e5'],
      ['d1', 'h5'],
      ['b8', 'c6'],
      ['h5', 'e5'],
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.status).toBe('active');
    expect(res.state.san).toEqual(['e4', 'e5', 'Qh5', 'Nc6', 'Qxe5+']);
    expect(res.state.inCheck).toBe(true);
    expect(res.state.turn).toBe('b');
  });

  it('resign hands the win to the other player', () => {
    const res = chessEngine.applyCommand(fresh(), { playerId: W, type: 'resign', payload: {} });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.status).toBe('finished');
    expect(res.result).toBe('resign');
    expect(res.winnerId).toBe(B);
  });

  it('offer_draw records the offerer and refuses a second offer', () => {
    const offered = chessEngine.applyCommand(fresh(), { playerId: W, type: 'offer_draw', payload: {} });
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;
    expect(offered.state.drawOfferFrom).toBe(W);
    expect(offered.status).toBe('active');

    const twice = chessEngine.applyCommand(ctx(offered.state), { playerId: B, type: 'offer_draw', payload: {} });
    expect(twice).toEqual({ ok: false, reason: 'bad_request' });
  });

  it('a draw offer can be declined', () => {
    const offered = chessEngine.applyCommand(fresh(), { playerId: W, type: 'offer_draw', payload: {} });
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;
    const declined = chessEngine.applyCommand(ctx(offered.state), { playerId: B, type: 'respond_draw', payload: { accept: false } });
    expect(declined.ok).toBe(true);
    if (!declined.ok) return;
    expect(declined.status).toBe('active');
    expect(declined.state.drawOfferFrom).toBeNull();
  });

  it('accepting a draw finishes the match as a draw', () => {
    const offered = chessEngine.applyCommand(fresh(), { playerId: W, type: 'offer_draw', payload: {} });
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;
    const accepted = chessEngine.applyCommand(ctx(offered.state), { playerId: B, type: 'respond_draw', payload: { accept: true } });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.status).toBe('finished');
    expect(accepted.result).toBe('draw_agreed');
    expect(accepted.winnerId).toBeNull();
  });

  it('refuses to answer your own draw offer and to answer when there is none', () => {
    const none = chessEngine.applyCommand(fresh(), { playerId: B, type: 'respond_draw', payload: { accept: true } });
    expect(none).toEqual({ ok: false, reason: 'no_draw_offer' });

    const offered = chessEngine.applyCommand(fresh(), { playerId: W, type: 'offer_draw', payload: {} });
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;
    const own = chessEngine.applyCommand(ctx(offered.state), { playerId: W, type: 'respond_draw', payload: { accept: true } });
    expect(own).toEqual({ ok: false, reason: 'bad_request' });
  });

  it('a move clears a pending draw offer', () => {
    const offered = chessEngine.applyCommand(fresh(), { playerId: W, type: 'offer_draw', payload: {} });
    expect(offered.ok).toBe(true);
    if (!offered.ok) return;
    const moved = chessEngine.applyCommand(ctx(offered.state), { playerId: W, type: 'move', payload: { from: 'e2', to: 'e4' } });
    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.state.drawOfferFrom).toBeNull();
  });

  it('detects threefold repetition from a replayed move list', () => {
    const cycle: Seq = [
      ['g1', 'f3'],
      ['g8', 'f6'],
      ['f3', 'g1'],
      ['f6', 'g8'],
    ];
    let c = fresh();
    let last: EngineResult<ChessState> = { ok: false, reason: 'bad_request' };
    outer: for (let i = 0; i < 3; i++) {
      for (const step of cycle) {
        const who = c.state.turn === 'w' ? W : B;
        last = chessEngine.applyCommand(c, { playerId: who, type: 'move', payload: { from: step[0], to: step[1] } });
        expect(last.ok).toBe(true);
        if (!last.ok) break outer;
        c = ctx(last.state);
        if (last.status === 'finished') break outer;
      }
    }
    expect(last.ok).toBe(true);
    if (!last.ok) return;
    expect(last.status).toBe('finished');
    expect(last.result).toBe('threefold');
    expect(last.winnerId).toBeNull();
  });

  it('rebuilds an identical position from a serialised move list', () => {
    const live = run(fresh(), [
      ['e2', 'e4'],
      ['c7', 'c5'],
      ['g1', 'f3'],
    ]);
    expect(live.ok).toBe(true);
    if (!live.ok) return;
    const rebuilt = replay(live.state.moves);
    expect(rebuilt.chess.fen()).toBe(live.state.fen);
    expect(rebuilt.san).toEqual(live.state.san);
    expect(rebuilt.captured).toEqual(live.state.captured);
  });

  it('rejects command types that do not belong to the game', () => {
    const c = fresh();
    for (const type of ['play', 'draw', 'pass', 'start_match'] as const) {
      expect(chessEngine.applyCommand(c, { playerId: W, type, payload: {} })).toEqual({ ok: false, reason: 'bad_request' });
    }
  });
});
