import { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import Avatar from '@/components/Avatar';
import { headToHead, matchSummary, type StatsByGame } from '@/hooks/useStats';
import type { Match, Player } from '@/types/db';

export interface TvResultProps {
  match: Match;
  players: Player[];
  byGame: StatsByGame;
}

function reduced(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Section 11.1 screen 5: the winner takes the couch. Shown for 30 seconds. */
export default function TvResult({ match, players, byGame }: TvResultProps) {
  const [shown, setShown] = useState(false);
  const winner = match.winner_id ? players.find((p) => p.id === match.winner_id) : null;

  useEffect(() => {
    setShown(true);
  }, [match.id]);

  // Three bursts from both bottom corners, only when somebody actually won.
  useEffect(() => {
    if (!winner || reduced()) return undefined;
    const burst = (): void => {
      void confetti({ particleCount: 70, spread: 75, angle: 55, origin: { x: 0, y: 1 }, disableForReducedMotion: true });
      void confetti({ particleCount: 70, spread: 75, angle: 125, origin: { x: 1, y: 1 }, disableForReducedMotion: true });
    };
    burst();
    const t1 = window.setTimeout(burst, 420);
    const t2 = window.setTimeout(burst, 900);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [winner]);

  const seats = match.seats
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p));

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-[2.4vh] px-[6vw] text-center"
      style={{ background: 'rgba(20,16,31,.92)', backdropFilter: 'blur(6px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: shown ? 1 : 0 }}
      transition={{ duration: 0.3 }}
    >
      {winner ? (
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Avatar emoji={winner.emoji} color={winner.color} size="11vh" />
        </motion.div>
      ) : (
        <div className="flex items-center" style={{ gap: '2.4vh' }}>
          {seats.slice(0, 2).map((p) => (
            <Avatar key={p.id} emoji={p.emoji} color={p.color} size="10vh" />
          ))}
        </div>
      )}

      <h1 className="font-display" style={{ fontSize: '11vh', color: 'var(--sun)', lineHeight: 1 }}>
        {winner ? `${winner.name} wins!` : "It's a draw!"}
      </h1>

      <p className="font-body" style={{ fontSize: '3.4vh', color: 'var(--ink)' }}>
        {matchSummary(match, players)}
      </p>

      <p
        className="font-body"
        style={{ fontSize: '2.8vh', color: 'var(--sun)', background: 'rgba(255,200,87,.12)', border: '1px solid rgba(255,200,87,.28)', borderRadius: 999, padding: '0.8vh 2vh' }}
      >
        {headToHead(byGame[match.game], players)}
      </p>

      <p className="font-body" style={{ fontSize: '2.8vh', color: 'var(--ink-dim)' }}>
        Rematch on your phone
      </p>
    </motion.div>
  );
}
