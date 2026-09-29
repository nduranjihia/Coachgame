import type { ComponentType } from 'react';
import type { GameKey } from '@/types/db';
import type { EngineApi } from '@/types/games';

import tictactoeEngine from './tictactoe/engine';
import TttTvBoard from './tictactoe/TvBoard';
import TttPhoneBoard from './tictactoe/PhoneBoard';

import chessEngine from './chess/engine';
import ChessTvBoard from './chess/TvBoard';
import ChessPhoneBoard from './chess/PhoneBoard';

import cardsEngine from './cards/engine';
import CardsTvTable from './cards/TvTable';
import CardsPhoneHand from './cards/PhoneHand';

/** Section 12.6 game icons: 96x96 viewBox, chunky 6px strokes, drawn in code. */
export function GameIcon({ game, size = 40 }: { game: GameKey; size?: number | string }) {
  if (game === 'tictactoe') {
    return (
      <svg viewBox="0 0 96 96" style={{ width: size, height: size }} aria-hidden="true">
        <rect x="10" y="10" width="76" height="76" rx="10" fill="none" stroke="var(--ink-dim)" strokeWidth="6" />
        <path d="M35 12 V84 M61 12 V84 M12 35 H84 M12 61 H84" stroke="var(--ink-dim)" strokeWidth="6" strokeLinecap="round" />
        <path d="M24 24 L40 40 M40 24 L24 40" stroke="var(--coral)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="72" cy="72" r="9" fill="none" stroke="var(--sky)" strokeWidth="6" />
      </svg>
    );
  }
  if (game === 'chess') {
    return (
      <svg viewBox="0 0 96 96" style={{ width: size, height: size }} aria-hidden="true">
        <path
          d="M32 78 h32 a4 4 0 0 0 4-4 v-6 h-40 v6 a4 4 0 0 0 4 4 z"
          fill="var(--sun)"
        />
        <path
          d="M36 68 c-8-6-10-18-6-28 3-8 10-12 12-20 1-4 0-8-3-10 10 2 16 8 18 16 2 7 1 13-2 18 6 2 10 6 12 12 2 6 1 10 1 12 H36 z"
          fill="var(--ink)"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 96 96" style={{ width: size, height: size }} aria-hidden="true">
      <g transform="rotate(-14 40 50)">
        <rect x="14" y="24" width="42" height="56" rx="7" fill="var(--coral)" stroke="var(--ink)" strokeWidth="5" />
      </g>
      <g transform="rotate(12 62 50)">
        <rect x="38" y="20" width="42" height="56" rx="7" fill="var(--sky)" stroke="var(--ink)" strokeWidth="5" />
        <ellipse cx="59" cy="48" rx="13" ry="9" transform="rotate(-18 59 48)" fill="var(--sun)" />
      </g>
    </svg>
  );
}

export interface GameMeta<S = unknown> {
  key: GameKey;
  label: string;
  tagline: string;
  minPlayers: number;
  maxPlayers: number;
  engine: EngineApi<S>;
  TvView: ComponentType<any>;
  PhoneView: ComponentType<any>;
}

const registry: Record<GameKey, GameMeta<any>> = {
  tictactoe: {
    key: 'tictactoe',
    label: 'Tic-Tac-Toe',
    tagline: 'Three in a row. First to think of it.',
    minPlayers: 2,
    maxPlayers: 2,
    engine: tictactoeEngine,
    TvView: TttTvBoard,
    PhoneView: TttPhoneBoard,
  },
  chess: {
    key: 'chess',
    label: 'Chess',
    tagline: 'Slow, deep and worth the bragging rights.',
    minPlayers: 2,
    maxPlayers: 2,
    engine: chessEngine,
    TvView: ChessTvBoard,
    PhoneView: ChessPhoneBoard,
  },
  cards: {
    key: 'cards',
    label: 'Wild Cards',
    tagline: 'Shed fast, shout LAST CARD, dump the +4.',
    minPlayers: 2,
    maxPlayers: 4,
    engine: cardsEngine,
    TvView: CardsTvTable,
    PhoneView: CardsPhoneHand,
  },
};

export function getGame(key: GameKey): GameMeta<any> {
  return registry[key];
}

export function getEngine<S>(key: GameKey): EngineApi<S> {
  return registry[key].engine as EngineApi<S>;
}

export function isGameKey(value: unknown): value is GameKey {
  return value === 'tictactoe' || value === 'chess' || value === 'cards';
}

export const GAME_KEYS: GameKey[] = ['tictactoe', 'chess', 'cards'];

export default registry;
