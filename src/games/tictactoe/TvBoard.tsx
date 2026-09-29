import { motion } from 'framer-motion';
import type { Player } from '@/types/db';
import type { TttState } from '@/types/games';
import Avatar from '@/components/Avatar';

export interface TttTvBoardProps {
  state: TttState;
  seats: string[];
  players: Player[];
}

/** Cell size and gap in vh, exactly as specified in section 11.3. */
const CELL = 20;
const GAP = 1.6;
const BOARD = CELL * 3 + GAP * 2;

function centrePercent(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: ((col * (CELL + GAP) + CELL / 2) / BOARD) * 100,
    y: ((row * (CELL + GAP) + CELL / 2) / BOARD) * 100,
  };
}

function Mark({ mark, dim }: { mark: 'X' | 'O'; dim: boolean }) {
  const color = mark === 'X' ? 'var(--coral)' : 'var(--sky)';
  const opacity = dim ? 0.35 : 1;
  if (mark === 'X') {
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true" style={{ opacity }}>
        <motion.path
          d="M20 20 L80 80 M80 20 L20 80"
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          pathLength={1}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true" style={{ opacity }}>
      <motion.circle
        cx={50}
        cy={50}
        r={31}
        fill="none"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        pathLength={1}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
      />
    </svg>
  );
}

function PlayerPanel({
  player,
  mark,
  active,
}: {
  player: Player | undefined;
  mark: 'X' | 'O';
  active: boolean;
}) {
  if (!player) return null;
  return (
    <div
      className="flex flex-col items-center gap-[1.4vh] rounded-[2rem] px-[1.6vw] py-[1.8vh]"
      style={{
        background: 'var(--bg-2)',
        border: `1px solid ${active ? `var(--${player.color})` : 'var(--line)'}`,
        boxShadow: active ? `0 0 2.4vh var(--${player.color})` : 'none',
        minWidth: '18vw',
      }}
    >
      <Avatar emoji={player.emoji} color={player.color} size="14vh" online={false} />
      <div className="font-display" style={{ fontSize: '5vh', color: 'var(--ink)' }}>
        {player.name}
      </div>
      <div style={{ width: '7vh', height: '7vh' }}>
        <Mark mark={mark} dim={false} />
      </div>
      {active ? (
        <motion.div
          className="font-display rounded-full px-[1.2vw] py-[0.6vh]"
          style={{ fontSize: '2.4vh', background: `var(--${player.color})`, color: 'var(--bg-0)' }}
          animate={{ opacity: [0.75, 1, 0.75] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          Your move
        </motion.div>
      ) : null}
    </div>
  );
}

/** Section 11.3 TV board. Display only - the TV never takes input. */
export default function TttTvBoard({ state, seats, players }: TttTvBoardProps) {
  const playerById = (id: string | undefined): Player | undefined => players.find((p) => p.id === id);
  const activePlayer = playerById(state.turn);
  const winLine = state.winLine;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[2.4vh]">
      <div
        className="font-display"
        style={{ fontSize: '4.6vh', color: 'var(--ink)' }}
        aria-live="polite"
      >
        {activePlayer ? `${activePlayer.name}'s turn` : ''}
      </div>

      <div className="flex w-full items-center justify-center gap-[3vw]">
        <PlayerPanel player={playerById(seats[0])} mark="X" active={state.turn === seats[0]} />

        <div
          className="relative shrink-0"
          style={{
            width: `${BOARD}vh`,
            height: `${BOARD}vh`,
            display: 'grid',
            gridTemplateColumns: `repeat(3, ${CELL}vh)`,
            gridTemplateRows: `repeat(3, ${CELL}vh)`,
            gap: `${GAP}vh`,
          }}
        >
          {state.board.map((mark, i) => {
            const dim = winLine !== null && !winLine.includes(i);
            return (
              <div
                key={i}
                className="flex items-center justify-center overflow-hidden"
                style={{
                  background: 'var(--bg-2)',
                  borderRadius: '3vh',
                  boxShadow: '0 0.8vh 0 rgba(0,0,0,.35)',
                  border: '1px solid var(--line)',
                }}
              >
                {mark ? <Mark mark={mark} dim={dim} /> : null}
              </div>
            );
          })}

          {winLine ? (
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <motion.line
                x1={centrePercent(winLine[0]).x}
                y1={centrePercent(winLine[0]).y}
                x2={centrePercent(winLine[2]).x}
                y2={centrePercent(winLine[2]).y}
                stroke="var(--sun)"
                strokeWidth={3.2}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                pathLength={1}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{ filter: 'drop-shadow(0 0 1vh rgba(255,200,87,.7))' }}
              />
            </svg>
          ) : null}
        </div>

        <PlayerPanel player={playerById(seats[1])} mark="O" active={state.turn === seats[1]} />
      </div>

      <div className="font-body" style={{ fontSize: '2.4vh', color: 'var(--ink-dim)' }}>
        {winLine ? 'Three in a row!' : `${state.moveCount} of 9 played`}
      </div>
    </div>
  );
}
