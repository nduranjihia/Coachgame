import { Chess } from 'chess.js';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'react-chessboard/dist/chessboard/types';
import Avatar from '@/components/Avatar';
import type { Player } from '@/types/db';
import type { ChessState } from '@/types/games';
import PromotionSheet from './PromotionSheet';

export interface ChessPhoneBoardProps {
  state: ChessState;
  players: Player[];
  myPlayerId: string;
  moveHints: boolean;
  disabled: boolean;
  onMove: (from: string, to: string, promotion?: string) => void;
}

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_GLYPH: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };

function useBoardWidth(min: number): [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(min);
  useLayoutEffect(() => {
    const measure = (): void => {
      const available = Math.min(window.innerWidth - 24, 480);
      setWidth(Math.max(min, Math.floor(available)));
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [min]);
  return [ref, width];
}

function material(captured: string[], against: string[]): number {
  const sum = (list: string[]): number => list.reduce((a, p) => a + (PIECE_VALUE[p] ?? 0), 0);
  return sum(captured) - sum(against);
}

function Bar({
  player,
  captured,
  turn,
  myTurn,
  label,
  lead,
}: {
  player: Player | undefined;
  captured: string[];
  turn: boolean;
  myTurn: boolean;
  label: string;
  lead: number;
}) {
  if (!player) return null;
  return (
    <div
      className="flex items-center gap-3 rounded-3xl px-3 py-2"
      style={{
        background: 'var(--bg-2)',
        border: `1px solid ${turn ? `var(--${player.color})` : 'var(--line)'}`,
        boxShadow: turn ? `0 0 18px var(--${player.color})` : 'none',
      }}
    >
      <Avatar emoji={player.emoji} color={player.color} size={36} online={false} />
      <div className="min-w-0 flex-1">
        <div className="font-body truncate" style={{ fontSize: 16, fontWeight: 600 }}>
          {player.name}
        </div>
        <div className="font-body truncate" style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
          {label}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {captured.map((p, i) => (
          <span key={`${p}-${i}`} style={{ fontSize: 15, color: 'var(--ink-dim)' }}>
            {PIECE_GLYPH[p] ?? p}
          </span>
        ))}
        {lead > 0 ? (
          <span className="font-display ml-1" style={{ fontSize: 13, color: 'var(--sun)' }}>
            +{lead}
          </span>
        ) : null}
        {turn ? (
          <span className="font-display ml-1" style={{ fontSize: 13, color: 'var(--sun)' }}>
            {myTurn ? 'Your move' : 'Thinking…'}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Section 11.4 phone board, always oriented with the player's colour at the bottom. */
export default function ChessPhoneBoard({
  state,
  players,
  myPlayerId,
  moveHints,
  disabled,
  onMove,
}: ChessPhoneBoardProps) {
  const [wrapRef, boardWidth] = useBoardWidth(240);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: string; to: string } | null>(null);

  const myColour: 'w' | 'b' = state.white === myPlayerId ? 'w' : 'b';
  const myTurn = state.turn === myColour && !disabled;
  const playerById = (id: string | undefined): Player | undefined => players.find((p) => p.id === id);
  const white = playerById(state.white);
  const black = playerById(state.black);
  const me = myColour === 'w' ? white : black;
  const opponent = myColour === 'w' ? black : white;

  const mine = myColour === 'w' ? state.captured.w : state.captured.b;
  const theirs = myColour === 'w' ? state.captured.b : state.captured.w;
  const myLead = material(mine, theirs);
  const theirLead = material(theirs, mine);

  // A throwaway board from the FEN, used only to compute the legal moves.
  const chess = useMemo(() => {
    try {
      const c = new Chess();
      c.load(state.fen);
      return c;
    } catch {
      return new Chess();
    }
  }, [state.fen]);

  const legalTargets = useMemo(() => {
    if (!selected || !myTurn) return [] as Square[];
    try {
      return chess.moves({ square: selected, verbose: true }).map((m) => m.to as Square);
    } catch {
      return [] as Square[];
    }
  }, [chess, myTurn, selected]);

  useEffect(() => {
    setSelected(null);
    setPromotion(null);
  }, [state.fen, myTurn]);

  const squareStyles: Record<string, Record<string, string>> = {};
  const last = state.lastMove;
  if (last) {
    squareStyles[last.from] = { backgroundColor: 'rgba(255,200,87,.35)' };
    squareStyles[last.to] = { backgroundColor: 'rgba(255,200,87,.45)' };
  }
  if (selected) squareStyles[selected] = { backgroundColor: 'rgba(255,200,87,.75)' };
  if (moveHints) {
    for (const to of legalTargets) {
      if (squareStyles[to]) continue;
      squareStyles[to] = {
        backgroundImage: 'radial-gradient(circle, rgba(20,16,31,.38) 22%, rgba(20,16,31,0) 25%)',
      };
    }
  }

  const handleSquare = (square: Square, piece: string | undefined): void => {
    if (!myTurn) return;
    if (selected && legalTargets.includes(square)) {
      // The moving piece is the one we selected, not whatever stands on the
      // destination. The old check read `chess.get(square)` - the arrival
      // square - so a promotion move into an empty last-rank square (the usual
      // case) never saw a pawn there, never opened the sheet, and silently sent
      // a queen. Reading the selected square is what makes the sheet appear.
      const moving = selected ? chess.get(selected as never) : undefined;
      if (moving?.type === 'p') {
        const rank = square[1];
        const promoting = (myColour === 'w' && rank === '8') || (myColour === 'b' && rank === '1');
        if (promoting) {
          setPromotion({ from: selected, to: square });
          return;
        }
      }
      onMove(selected, square);
      setSelected(null);
      return;
    }
    const own = piece?.[0] === (myColour === 'w' ? 'w' : 'b');
    if (own) {
      setSelected((prev) => (prev === square ? null : square));
      return;
    }
    setSelected(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-2">
      <Bar
        player={opponent}
        captured={theirs}
        turn={!myTurn && !disabled}
        myTurn={myTurn}
        label={myColour === 'w' ? 'Black' : 'White'}
        lead={theirLead}
      />

      <div ref={wrapRef} className="flex items-center justify-center">
        <Chessboard
          id="cc-chess-phone"
          position={state.fen}
          boardOrientation={myColour === 'w' ? 'white' : 'black'}
          arePiecesDraggable={false}
          areArrowsAllowed={false}
          showBoardNotation={false}
          animationDuration={200}
          boardWidth={boardWidth}
          customSquareStyles={squareStyles}
          customDarkSquareStyle={{ backgroundColor: '#B9855E' }}
          customLightSquareStyle={{ backgroundColor: '#F4E3C3' }}
          customBoardStyle={{ borderRadius: 16, boxShadow: '0 8px 0 rgba(0,0,0,.35)' }}
          onSquareClick={(square, piece) => handleSquare(square as Square, piece as string | undefined)}
        />
      </div>

      <Bar
        player={me}
        captured={mine}
        turn={myTurn}
        myTurn={myTurn}
        label={myColour === 'w' ? 'White' : 'Black'}
        lead={myLead}
      />

      <p className="font-body text-center" style={{ fontSize: 12, color: 'var(--ink-dim)' }}>
        {myTurn
          ? selected
            ? 'Tap a highlighted square to move.'
            : 'Tap one of your pieces.'
          : opponent
            ? `${opponent.name} is thinking…`
            : 'Waiting…'}
      </p>

      {promotion ? (
        <PromotionSheet
          open
          colour={myColour}
          onCancel={() => {
            setPromotion(null);
            setSelected(null);
          }}
          onPick={(piece) => {
            onMove(promotion.from, promotion.to, piece);
            setPromotion(null);
            setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}
