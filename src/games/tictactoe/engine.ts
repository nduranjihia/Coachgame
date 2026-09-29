import type { EngineApi, EngineCommand, EngineCtx, EngineResult, TttState } from '@/types/games';

/** The 8 winning lines on a 3x3 board, in cell indices. */
export const WIN_LINES: number[][] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

function emptyState(seats: string[]): TttState {
  return {
    board: [null, null, null, null, null, null, null, null, null],
    turn: seats[0],
    winLine: null,
    moveCount: 0,
  };
}

function winningLine(board: TttState['board']): number[] | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

function createInitial(seats: string[]): { state: TttState } {
  return { state: emptyState(seats) };
}

function applyCommand(ctx: EngineCtx<TttState>, cmd: EngineCommand): EngineResult<TttState> {
  const { seats, state } = ctx;
  if (cmd.type !== 'move') return { ok: false, reason: 'bad_request' };
  if (!seats.includes(cmd.playerId)) return { ok: false, reason: 'not_a_seat' };
  if (state.turn !== cmd.playerId) return { ok: false, reason: 'not_your_turn' };

  const cell = cmd.payload?.cell;
  if (typeof cell !== 'number' || !Number.isInteger(cell) || cell < 0 || cell > 8) {
    return { ok: false, reason: 'bad_request' };
  }
  if (state.board[cell] !== null) return { ok: false, reason: 'cell_taken' };

  const board = state.board.slice() as TttState['board'];
  board[cell] = seats[0] === cmd.playerId ? 'X' : 'O';

  const moveCount = state.moveCount + 1;
  const line = winningLine(board);

  if (line) {
    return {
      ok: true,
      state: { ...state, board, moveCount, winLine: line },
      status: 'finished',
      winnerId: cmd.playerId,
      result: 'three_in_row',
    };
  }

  if (moveCount === 9) {
    return {
      ok: true,
      state: { ...state, board, moveCount, winLine: null },
      status: 'finished',
      winnerId: null,
      result: 'draw',
    };
  }

  const other = seats.find((s) => s !== cmd.playerId);
  return {
    ok: true,
    state: { board, turn: other ?? state.turn, winLine: null, moveCount },
    status: 'active',
    winnerId: null,
    result: null,
  };
}

export const tictactoeEngine: EngineApi<TttState> = { createInitial, applyCommand };

export default tictactoeEngine;
