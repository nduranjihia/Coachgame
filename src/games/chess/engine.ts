import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type { ChessMove, ChessState, EngineApi, EngineCommand, EngineCtx, EngineResult } from '@/types/games';

export function createInitialState(seats: [string, string]): ChessState {
  const chess = new Chess();
  return {
    moves: [],
    fen: chess.fen(),
    turn: 'w',
    white: seats[0],
    black: seats[1],
    inCheck: false,
    lastMove: null,
    san: [],
    captured: { w: [], b: [] },
    drawOfferFrom: null,
  };
}

interface ReplayResult {
  chess: Chess;
  san: string[];
  captured: { w: string[]; b: string[] };
  lastMove: { from: string; to: string } | null;
  applied: boolean;
}

/**
 * The move list is the single source of truth. Position, SAN, captured pieces
 * and last move are always rebuilt from scratch, so threefold repetition keeps
 * working after a reload.
 */
export function replay(moves: ChessMove[]): ReplayResult {
  const chess = new Chess();
  const san: string[] = [];
  const captured: { w: string[]; b: string[] } = { w: [], b: [] };
  let lastMove: { from: string; to: string } | null = null;
  let applied = true;

  for (const m of moves) {
    try {
      const move = chess.move({
        from: m.from as Square,
        to: m.to as Square,
        promotion: m.promotion as PieceSymbol | undefined,
      });
      san.push(move.san);
      lastMove = { from: move.from, to: move.to };
      // chess.js v1 reports `captured` as the lowercase piece type.
      if (move.captured) captured[move.color].push(move.captured);
    } catch {
      applied = false;
      break;
    }
  }

  return { chess, san, captured, lastMove, applied };
}

function rebuild(state: ChessState): ChessState {
  const r = replay(state.moves);
  return {
    ...state,
    fen: r.chess.fen(),
    turn: r.chess.turn() as 'w' | 'b',
    inCheck: r.chess.isCheck(),
    san: r.san,
    captured: r.captured,
    lastMove: r.lastMove,
  };
}

function createInitial(seats: string[]): { state: ChessState } {
  return { state: createInitialState([seats[0], seats[1]]) };
}

function playerForTurn(state: ChessState): string {
  return state.turn === 'w' ? state.white : state.black;
}

function opponentOf(state: ChessState, playerId: string): string {
  if (playerId === state.white) return state.black;
  if (playerId === state.black) return state.white;
  return '';
}

function doMove(state: ChessState, playerId: string, payload: any): EngineResult<ChessState> {
  if (playerId !== playerForTurn(state)) return { ok: false, reason: 'not_your_turn' };

  const from = typeof payload.from === 'string' ? payload.from : '';
  const to = typeof payload.to === 'string' ? payload.to : '';
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return { ok: false, reason: 'bad_request' };

  const r = replay(state.moves);
  if (!r.applied) return { ok: false, reason: 'bad_request' };
  const chess = r.chess;

  const piece = chess.get(from as Square);
  let promotion = typeof payload.promotion === 'string' ? (payload.promotion as string) : undefined;

  // A pawn reaching the last rank without an explicit promotion defaults to a queen.
  if (piece && piece.type === 'p') {
    const lastRank = piece.color === 'w' ? to[1] === '8' : to[1] === '1';
    if (lastRank && !promotion) promotion = 'q';
  }

  try {
    chess.move({ from: from as Square, to: to as Square, promotion: promotion as PieceSymbol | undefined });
  } catch {
    return { ok: false, reason: 'illegal_move' };
  }

  const moves: ChessMove[] = [...state.moves, promotion ? { from, to, promotion } : { from, to }];
  const next = rebuild({ ...state, moves, drawOfferFrom: null });

  // Draw / win detection, in the order given by the spec.
  if (chess.isCheckmate()) {
    return { ok: true, state: next, status: 'finished', winnerId: playerId, result: 'checkmate' };
  }
  if (chess.isStalemate()) {
    return { ok: true, state: next, status: 'finished', winnerId: null, result: 'stalemate' };
  }
  if (chess.isInsufficientMaterial()) {
    return { ok: true, state: next, status: 'finished', winnerId: null, result: 'insufficient' };
  }
  if (chess.isThreefoldRepetition()) {
    return { ok: true, state: next, status: 'finished', winnerId: null, result: 'threefold' };
  }
  if (chess.isDraw()) {
    return { ok: true, state: next, status: 'finished', winnerId: null, result: 'fifty_move' };
  }
  return { ok: true, state: next, status: 'active', winnerId: null, result: null };
}

function applyCommand(ctx: EngineCtx<ChessState>, cmd: EngineCommand): EngineResult<ChessState> {
  const { state } = ctx;

  if (!state.white || !state.black || state.white === state.black) return { ok: false, reason: 'bad_request' };
  if (cmd.playerId !== state.white && cmd.playerId !== state.black) return { ok: false, reason: 'not_a_seat' };

  switch (cmd.type) {
    case 'move':
      return doMove(state, cmd.playerId, cmd.payload ?? {});

    case 'resign': {
      const winner = opponentOf(state, cmd.playerId);
      return {
        ok: true,
        state: rebuild({ ...state, drawOfferFrom: null }),
        status: 'finished',
        winnerId: winner || null,
        result: 'resign',
      };
    }

    case 'offer_draw': {
      if (state.drawOfferFrom) return { ok: false, reason: 'bad_request' };
      return {
        ok: true,
        state: { ...rebuild(state), drawOfferFrom: cmd.playerId },
        status: 'active',
        winnerId: null,
        result: null,
      };
    }

    case 'respond_draw': {
      if (!state.drawOfferFrom) return { ok: false, reason: 'no_draw_offer' };
      if (state.drawOfferFrom === cmd.playerId) return { ok: false, reason: 'bad_request' };
      const accept = cmd.payload?.accept === true;
      const next = { ...rebuild(state), drawOfferFrom: null as string | null };
      if (accept) {
        return { ok: true, state: next, status: 'finished', winnerId: null, result: 'draw_agreed' };
      }
      return { ok: true, state: next, status: 'active', winnerId: null, result: null };
    }

    default:
      return { ok: false, reason: 'bad_request' };
  }
}

export const chessEngine: EngineApi<ChessState> = { createInitial, applyCommand };

export default chessEngine;
