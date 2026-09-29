import { describe, expect, it } from 'vitest';
import { WIN_LINES, tictactoeEngine } from './engine';
import type { EngineCtx, EngineResult, TttState } from '@/types/games';
import { DEFAULT_SETTINGS } from '@/types/db';

const A = 'player-a';
const B = 'player-b';

function ctx(state: TttState, seats: string[] = [A, B]): EngineCtx<TttState> {
  return { seats, state, settings: DEFAULT_SETTINGS };
}

function fresh(): EngineCtx<TttState> {
  return ctx(tictactoeEngine.createInitial([A, B]).state);
}

/** Play a sequence of `[playerId, cell]` pairs through the engine. */
function play(c: EngineCtx<TttState>, seq: [string, number][]): EngineResult<TttState> {
  let cur = c;
  let res: EngineResult<TttState> | null = null;
  for (const [playerId, cell] of seq) {
    res = tictactoeEngine.applyCommand(cur, { playerId, type: 'move', payload: { cell } });
    if (!res.ok) break;
    cur = ctx(res.state);
  }
  return res ?? { ok: false, reason: 'bad_request' };
}

describe('tictactoe engine', () => {
  it('starts empty with seats[0] to move', () => {
    const { state } = tictactoeEngine.createInitial([A, B]);
    expect(state.board).toEqual([null, null, null, null, null, null, null, null, null]);
    expect(state.turn).toBe(A);
    expect(state.moveCount).toBe(0);
    expect(state.winLine).toBeNull();
  });

  it('marks seats[0] as X and seats[1] as O', () => {
    const c = fresh();
    const r1 = tictactoeEngine.applyCommand(c, { playerId: A, type: 'move', payload: { cell: 0 } });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.state.board[0]).toBe('X');
    const c2 = ctx(r1.state);
    const r2 = tictactoeEngine.applyCommand(c2, { playerId: B, type: 'move', payload: { cell: 1 } });
    expect(r2.ok && r2.state.board[1]).toBe('O');
  });

  it('covers all 8 winning lines', () => {
    expect(WIN_LINES).toHaveLength(8);
    for (const line of WIN_LINES) {
      const outside = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => !line.includes(i));
      const res = play(fresh(), [
        [A, line[0]],
        [B, outside[0]],
        [A, line[1]],
        [B, outside[1]],
        [A, line[2]],
      ]);
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      expect(res.status).toBe('finished');
      expect(res.winnerId).toBe(A);
      expect(res.result).toBe('three_in_row');
      expect(res.state.winLine).toEqual(line);
    }
  });

  it('detects a draw on a full board', () => {
    // X O X
    // O X X
    // X O O
    const res = play(fresh(), [
      [A, 0],
      [B, 2],
      [A, 1],
      [B, 3],
      [A, 4],
      [B, 7],
      [A, 5],
      [B, 8],
      [A, 6],
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.board).toEqual(['X', 'X', 'O', 'O', 'X', 'X', 'X', 'O', 'O']);
    expect(res.state.moveCount).toBe(9);
    expect(res.state.winLine).toBeNull();
    expect(res.status).toBe('finished');
    expect(res.winnerId).toBeNull();
    expect(res.result).toBe('draw');
  });

  it('rejects a move on an occupied cell', () => {
    const c = play(fresh(), [
      [A, 4],
      [B, 0],
    ]);
    const after = ctx((c as { state: TttState }).state);
    const r = tictactoeEngine.applyCommand(after, { playerId: after.state.turn, type: 'move', payload: { cell: 4 } });
    expect(r).toEqual({ ok: false, reason: 'cell_taken' });
  });

  it('rejects a move out of turn', () => {
    const r = tictactoeEngine.applyCommand(fresh(), { playerId: B, type: 'move', payload: { cell: 0 } });
    expect(r).toEqual({ ok: false, reason: 'not_your_turn' });
  });

  it('rejects an out-of-range or non-integer cell as bad_request', () => {
    const c = fresh();
    for (const cell of [9, -1, 1.5, '4', null, undefined, {}]) {
      const r = tictactoeEngine.applyCommand(c, { playerId: A, type: 'move', payload: { cell } });
      expect(r).toEqual({ ok: false, reason: 'bad_request' });
    }
  });

  it('rejects a non-seat player', () => {
    const r = tictactoeEngine.applyCommand(fresh(), { playerId: 'stranger', type: 'move', payload: { cell: 0 } });
    expect(r).toEqual({ ok: false, reason: 'not_a_seat' });
  });

  it('rejects command types that do not belong to the game', () => {
    const c = fresh();
    for (const type of ['draw', 'pass', 'play', 'resign'] as const) {
      const r = tictactoeEngine.applyCommand(c, { playerId: A, type, payload: {} });
      expect(r).toEqual({ ok: false, reason: 'bad_request' });
    }
  });

  it('swaps the turn after a normal move', () => {
    const res = play(fresh(), [
      [A, 8],
      [B, 0],
    ]);
    expect(res.ok && res.state.turn).toBe(A);
  });
});
