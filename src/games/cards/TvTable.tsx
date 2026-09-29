import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import CardView, { CardBack } from './CardView';
import { COLOR_HEX } from './deck';
import type { Player } from '@/types/db';
import type { CardsState } from '@/types/games';

export interface CardsTvTableProps {
  state: CardsState;
  seats: string[];
  players: Player[];
}

const MAX_FAN = 10;

/** Seat position on the table ellipse, starting at the top. */
function seatAngle(index: number, total: number): number {
  return (-90 + (360 / total) * index) * (Math.PI / 180);
}

/** Section 11.5 TV table. It never shows anyone's hand. */
export default function CardsTvTable({ state, seats, players }: CardsTvTableProps) {
  const [logLine, setLogLine] = useState<string | null>(null);
  const latest = state.log.length > 0 ? state.log[state.log.length - 1] : null;

  useEffect(() => {
    if (!latest) return undefined;
    setLogLine(latest);
    const t = window.setTimeout(() => setLogLine(null), 3000);
    return () => window.clearTimeout(t);
  }, [latest]);

  const playerById = (id: string): Player | undefined => players.find((p) => p.id === id);
  const total = seats.length;

  return (
    <div
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[3rem]"
      style={{
        background: 'radial-gradient(60% 60% at 50% 45%, var(--bg-1), var(--bg-0) 78%)',
        border: '1px solid var(--line)',
      }}
    >
      {/* direction ring */}
      <motion.div
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{ width: '46vh', height: '46vh', marginLeft: '-23vh', marginTop: '-23vh' }}
        animate={{ rotate: state.direction === 1 ? 360 : -360 }}
        transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
      >
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }} aria-hidden="true">
          <circle cx={50} cy={50} r={46} fill="none" stroke="rgba(255,246,233,.16)" strokeWidth={1.4} strokeDasharray="4 6" />
          <path d="M50 2 L45 10 L55 10 Z" fill="var(--sun)" />
        </svg>
      </motion.div>

      {/* piles */}
      <div className="absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-[3vw]">
        <div className="relative">
          <CardBack width="13vh" />
          <CardBack width="13vh" style={{ position: 'absolute', left: '0.7vh', top: '-0.7vh' }} />
          <div
            className="font-display absolute -right-3 -top-2 flex items-center justify-center rounded-full px-2"
            style={{
              height: '4.6vh',
              background: 'var(--sun)',
              color: 'var(--bg-0)',
              fontSize: '2.4vh',
              boxShadow: 'var(--shadow-hard)',
            }}
          >
            {state.drawCount}
          </div>
        </div>

        <div style={{ borderRadius: '2.2vh', boxShadow: `0 0 4vh ${COLOR_HEX[state.currentColor]}, 0 0 0 0.6vh ${COLOR_HEX[state.currentColor]}` }}>
          <CardView card={state.topCard} width="30vh" />
        </div>
      </div>

      {/* seats */}
      {seats.map((seatId, i) => {
        const player = playerById(seatId);
        const count = state.handCounts[seatId] ?? 0;
        const isTurn = seats[state.turnIndex] === seatId;
        const last = count === 1;
        if (!player) return null;
        const angle = seatAngle(i, total);
        const left = 50 + 41 * Math.cos(angle);
        const top = 50 + 33 * Math.sin(angle);
        const shown = Math.min(count, MAX_FAN);
        return (
          <div
            key={seatId}
            className="absolute z-20 flex flex-col items-center"
            style={{ left: `${left}%`, top: `${top}%`, transform: 'translate(-50%, -50%)' }}
          >
            <div
              className="flex flex-col items-center gap-[0.6vh] rounded-[2rem] px-[1.1vw] py-[1vh]"
              style={{
                background: 'var(--bg-2)',
                border: `1px solid ${isTurn ? `var(--${player.color})` : 'var(--line)'}`,
                boxShadow: isTurn ? `0 0 2.6vh var(--${player.color})` : 'none',
              }}
            >
              <Avatar emoji={player.emoji} color={player.color} size="8.5vh" online={false} />
              <div className="font-body" style={{ fontSize: '2.6vh', fontWeight: 600 }}>
                {player.name}
              </div>
              <div className="flex items-end" style={{ height: '5vh' }}>
                {Array.from({ length: shown }).map((_, k) => (
                  <CardBack
                    key={k}
                    width="1.7vh"
                    style={{
                      marginLeft: k === 0 ? 0 : '-1.2vh',
                      transform: `rotate(${(k - shown / 2) * 4}deg)`,
                    }}
                  />
                ))}
                {count > MAX_FAN ? (
                  <span className="font-display" style={{ fontSize: '2.2vh', color: 'var(--sun)', marginLeft: '0.4vw' }}>
                    +{count - MAX_FAN}
                  </span>
                ) : null}
              </div>
              <div className="font-display" style={{ fontSize: '2.6vh', color: 'var(--ink)' }}>
                {count}
              </div>
              {last ? (
                <motion.div
                  className="font-display rounded-full px-[0.8vw] py-[0.3vh]"
                  style={{ fontSize: '2.2vh', background: 'var(--sun)', color: 'var(--bg-0)' }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                >
                  LAST CARD!
                </motion.div>
              ) : null}
            </div>
          </div>
        );
      })}

      {/* log toast */}
      {logLine ? (
        <motion.div
          className="font-body absolute bottom-[3vh] left-1/2 z-30 -translate-x-1/2 rounded-full px-[1.4vw] py-[0.8vh] text-center"
          style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', fontSize: '2.6vh', maxWidth: '70vw' }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {logLine}
        </motion.div>
      ) : null}
    </div>
  );
}
