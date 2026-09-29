import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Chessboard } from 'react-chessboard';
import Avatar from '@/components/Avatar';
import type { Player } from '@/types/db';
import type { ChessState } from '@/types/games';

export interface ChessTvBoardProps {
  state: ChessState;
  players: Player[];
}

const PIECE_VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const PIECE_GLYPH: Record<string, string> = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };

/** Square of the king belonging to the side to move, from a FEN. */
function kingToMove(fen: string): string | null {
  const [placement, turn] = fen.split(' ');
  const white = turn !== 'b';
  const rows = (placement ?? '').split('/');
  for (let r = 0; r < rows.length; r++) {
    let file = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) {
        file += Number(ch);
        continue;
      }
      const square = `${'abcdefgh'[file]}${8 - r}`;
      if (ch.toLowerCase() === 'k' && (ch === 'K') === white) return square;
      file += 1;
    }
  }
  return null;
}

function useBoardWidth<T extends HTMLElement>(min: number): [RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(min);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = (): void => {
      const box = el.getBoundingClientRect();
      const cap = Math.min(box.width, window.innerHeight * 0.88);
      setWidth(Math.max(min, Math.floor(cap)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [min]);
  return [ref, width];
}

function Captured({ pieces }: { pieces: string[] }) {
  if (pieces.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-[0.3vw]">
      {pieces.map((p, i) => (
        <span key={`${p}-${i}`} style={{ fontSize: '2.8vh', color: 'var(--ink-dim)', lineHeight: 1 }}>
          {PIECE_GLYPH[p] ?? p}
        </span>
      ))}
    </div>
  );
}

function material(state: ChessState, colour: 'w' | 'b'): number {
  const sum = (list: string[]): number => list.reduce((a, p) => a + (PIECE_VALUE[p] ?? 0), 0);
  return colour === 'w'
    ? sum(state.captured.b) - sum(state.captured.w)
    : sum(state.captured.w) - sum(state.captured.b);
}

function Panel({
  player,
  side,
  state,
  active,
  captured,
}: {
  player: Player | undefined;
  side: 'w' | 'b';
  state: ChessState;
  active: boolean;
  captured: string[];
}) {
  if (!player) return null;
  const diff = material(state, side);
  return (
    <div
      className="flex items-center gap-[1.2vw] rounded-[2rem] px-[1.4vw] py-[1.2vh]"
      style={{
        background: 'var(--bg-2)',
        border: `1px solid ${active ? `var(--${player.color})` : 'var(--line)'}`,
        boxShadow: active ? `0 0 2vh var(--${player.color})` : 'none',
      }}
    >
      <Avatar emoji={player.emoji} color={player.color} size="9vh" online={false} />
      <div className="flex min-w-0 flex-col">
        <div className="font-body flex items-center gap-[0.6vw]" style={{ fontSize: '3.2vh', fontWeight: 600 }}>
          {player.name}
          <span style={{ fontSize: '2.4vh', color: 'var(--ink-dim)' }}>{side === 'w' ? 'White' : 'Black'}</span>
        </div>
        <div className="flex items-center gap-[0.6vw]">
          <Captured pieces={captured} />
          {diff > 0 ? (
            <span className="font-display" style={{ fontSize: '2.6vh', color: 'var(--sun)' }}>
              +{diff}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Section 11.4 TV board. White is always at the bottom. */
export default function ChessTvBoard({ state, players }: ChessTvBoardProps) {
  const [wrapRef, boardWidth] = useBoardWidth<HTMLDivElement>(200);
  const listRef = useRef<HTMLDivElement>(null);
  const playerById = (id: string | undefined): Player | undefined => players.find((p) => p.id === id);
  const whiteToMove = state.turn === 'w';

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.san.length]);

  const last = state.lastMove;
  const squareStyles: Record<string, Record<string, string>> = {};
  if (last) {
    squareStyles[last.from] = { backgroundColor: 'rgba(255,200,87,.55)' };
    squareStyles[last.to] = { backgroundColor: 'rgba(255,200,87,.55)' };
  }
  if (state.inCheck) {
    const square = kingToMove(state.fen);
    if (square) {
      squareStyles[square] = {
        ...(squareStyles[square] ?? {}),
        backgroundImage: 'radial-gradient(circle, rgba(255,77,77,.9), rgba(255,77,77,0) 72%)',
      };
    }
  }

  const banner = state.inCheck
    ? 'Check!'
    : state.drawOfferFrom
      ? `${playerById(state.drawOfferFrom)?.name ?? 'Someone'} offers a draw`
      : '';

  const pairs: string[] = [];
  for (let i = 0; i < state.san.length; i += 2) {
    pairs.push(`${i / 2 + 1}. ${state.san[i]}${state.san[i + 1] ? ` ${state.san[i + 1]}` : ''}`);
  }
  const visiblePairs = pairs.slice(-10);

  return (
    <div className="flex min-h-0 flex-1 items-stretch gap-[2.5vw]">
      <div ref={wrapRef} className="flex min-h-0 flex-1 items-center justify-center">
        <Chessboard
          id="cc-chess-tv"
          position={state.fen}
          boardOrientation="white"
          arePiecesDraggable={false}
          areArrowsAllowed={false}
          showBoardNotation={false}
          animationDuration={200}
          boardWidth={boardWidth}
          customSquareStyles={squareStyles as never}
          customDarkSquareStyle={{ backgroundColor: '#B9855E' }}
          customLightSquareStyle={{ backgroundColor: '#F4E3C3' }}
          customBoardStyle={{ borderRadius: 16, boxShadow: '0 8px 0 rgba(0,0,0,.35)' }}
        />
      </div>

      <div className="flex w-[34vw] shrink-0 flex-col gap-[1.4vh]">
        <Panel player={playerById(state.black)} side="b" state={state} active={!whiteToMove} captured={state.captured.b} />

        <div
          ref={listRef}
          className="cc-scroll-y flex-1 rounded-[2rem] px-[1.2vw] py-[1.2vh]"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
        >
          {visiblePairs.length === 0 ? (
            <p className="font-body" style={{ fontSize: '2.6vh', color: 'var(--ink-dim)' }}>
              No moves yet
            </p>
          ) : (
            visiblePairs.map((line, i) => {
              const latest = i === visiblePairs.length - 1;
              return (
                <p
                  key={`${line}-${i}`}
                  className="font-body"
                  style={{
                    fontSize: '2.6vh',
                    fontWeight: latest ? 700 : 500,
                    color: latest ? 'var(--sun)' : 'var(--ink-dim)',
                    padding: '0.2vh 0',
                  }}
                >
                  {line}
                </p>
              );
            })
          )}
        </div>

        <Panel player={playerById(state.white)} side="w" state={state} active={whiteToMove} captured={state.captured.w} />

        <div style={{ minHeight: '4.2vh' }}>
          {banner ? (
            <div
              className="font-display rounded-full px-[1.2vw] py-[0.6vh] text-center"
              style={{ fontSize: '2.6vh', background: 'var(--sun)', color: 'var(--bg-0)' }}
            >
              {banner}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
