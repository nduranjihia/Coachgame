/* Shared game-engine types. Engines are pure TypeScript: no React, no Supabase. */

import type { CommandType, HouseholdSettings, RejectReason } from './db';

/* ------------------------------------------------------------------ Tic-Tac-Toe */

export interface TttState {
  board: ('X' | 'O' | null)[];
  turn: string;
  winLine: number[] | null;
  moveCount: number;
}

/* ----------------------------------------------------------------------- Chess */

export interface ChessMove {
  from: string;
  to: string;
  promotion?: string;
}

export interface ChessState {
  /** Source of truth. The position is always rebuilt by replaying this list. */
  moves: ChessMove[];
  fen: string;
  turn: 'w' | 'b';
  white: string;
  black: string;
  inCheck: boolean;
  lastMove: { from: string; to: string } | null;
  san: string[];
  /** Pieces captured BY that colour, lowercase types 'p','n','b','r','q'. */
  captured: { w: string[]; b: string[] };
  drawOfferFrom: string | null;
}

/* ------------------------------------------------------------------- Wild Cards */

export type CardColor = 'red' | 'yellow' | 'green' | 'blue';

export type CardKind = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface Card {
  id: string;
  kind: CardKind;
  color: CardColor | null;
  value?: number;
}

export interface CardsSecrets {
  drawPile: Card[];
  /** Every card under the top card. */
  discardPile: Card[];
}

export interface CardsState {
  topCard: Card;
  currentColor: CardColor;
  direction: 1 | -1;
  turnIndex: number;
  handCounts: Record<string, number>;
  drawCount: number;
  discardCount: number;
  /** Set after drawing a playable card. */
  pendingDraw: { playerId: string; cardId: string } | null;
  lastAction: {
    playerId: string;
    type: 'play' | 'draw' | 'pass';
    card?: Card;
    chosenColor?: CardColor;
    victimId?: string;
    penalty?: number;
    shout?: boolean;
  } | null;
  /** Last 12 short lines. */
  log: string[];
}

/* ------------------------------------------------------------------ Engine API */

export interface EngineOk<S> {
  ok: true;
  state: S;
  status: 'active' | 'finished';
  /** null together with status 'finished' means a draw. */
  winnerId: string | null;
  result: string | null;
  /** cards game only: FULL replacement hands for players who changed. */
  hands?: Record<string, Card[]>;
  /** cards game only. */
  secrets?: CardsSecrets;
}

export interface EngineErr {
  ok: false;
  reason: RejectReason;
}

export type EngineResult<S> = EngineOk<S> | EngineErr;

export interface EngineCommand {
  playerId: string;
  type: CommandType;
  payload: any;
}

export interface EngineCtx<S> {
  seats: string[];
  state: S;
  hands?: Record<string, Card[]>;
  secrets?: CardsSecrets;
  settings: HouseholdSettings;
  /** Resolves a player id to a display name, used for the human-readable log lines. */
  nameOf?: (playerId: string) => string;
}

export type Rng = () => number;

export interface EngineApi<S> {
  createInitial(seats: string[], rng?: Rng): { state: S; hands?: Record<string, Card[]>; secrets?: CardsSecrets };
  applyCommand(ctx: EngineCtx<S>, cmd: EngineCommand): EngineResult<S>;
}
