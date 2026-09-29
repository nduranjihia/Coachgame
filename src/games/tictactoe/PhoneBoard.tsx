import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { TttState } from '@/types/games';

export interface TttPhoneBoardProps {
  state: TttState;
  myMark: 'X' | 'O';
  myTurn: boolean;
  /** Disabled when the TV is offline or the match is over. */
  disabled: boolean;
  onMove: (cell: number) => void;
}

function Mark({ mark, dim }: { mark: 'X' | 'O'; dim: boolean }) {
  const color = mark === 'X' ? 'var(--coral)' : 'var(--sky)';
  if (mark === 'X') {
    return (
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true" style={{ opacity: dim ? 0.4 : 1 }}>
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
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true" style={{ opacity: dim ? 0.4 : 1 }}>
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

/** Section 11.3 phone board. Tapping an empty cell sends `move`. */
export default function TttPhoneBoard({
  state,
  myMark,
  myTurn,
  disabled,
  onMove,
}: TttPhoneBoardProps) {
  const [pendingCell, setPendingCell] = useState<number | null>(null);

  // The pending-state highlight clears as soon as the board reflects the move (or the turn passes).
  useEffect(() => {
    if (pendingCell === null) return;
    if (state.board[pendingCell] !== null || !myTurn) setPendingCell(null);
  }, [myTurn, pendingCell, state.board]);

  const interactive = myTurn && !disabled;

  return (
    <div
      className="mx-auto w-full max-w-[420px] px-3"
      style={{
        borderRadius: 24,
        boxShadow: interactive ? '0 0 0 2px rgba(255,200,87,.45), 0 18px 40px rgba(0,0,0,.35)' : 'none',
        transition: 'box-shadow 220ms ease',
      }}
    >
      <div
        className="grid w-full gap-2"
        style={{ gridTemplateColumns: 'repeat(3, 1fr)', aspectRatio: '1 / 1' }}
      >
        {state.board.map((mark, i) => {
          const empty = mark === null;
          const isPending = pendingCell === i;
          return (
            <button
              key={i}
              type="button"
              aria-label={`Square ${i + 1}`}
              disabled={!interactive || !empty}
              onClick={() => {
                setPendingCell(i);
                onMove(i);
              }}
              className="flex items-center justify-center"
              style={{
                borderRadius: 20,
                background: isPending ? 'rgba(255,200,87,.16)' : 'var(--bg-2)',
                border: '1px solid var(--line)',
                boxShadow: isPending
                  ? 'inset 0 0 0 2px rgba(255,200,87,.75), 0 5px 0 rgba(0,0,0,.35)'
                  : '0 5px 0 rgba(0,0,0,.35)',
                cursor: interactive && empty ? 'pointer' : 'default',
                opacity: interactive || !empty ? 1 : 0.65,
                overflow: 'hidden',
                touchAction: 'manipulation',
                WebkitTapHighlightColor: 'transparent',
                transition: 'background 140ms ease, box-shadow 140ms ease',
              }}
              aria-busy={isPending || undefined}
            >
              {mark ? <Mark mark={mark} dim={false} /> : null}
            </button>
          );
        })}
      </div>
      <p className="font-body mt-3 text-center" style={{ fontSize: 13, color: 'var(--ink-dim)' }}>
        You are {myMark}
      </p>
    </div>
  );
}
