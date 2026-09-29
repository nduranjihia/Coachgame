import { motion } from 'framer-motion';
import { getGame } from '@/games/registry';
import type { Match, Player } from '@/types/db';

export interface TvMatchProps {
  match: Match;
  players: Player[];
  /** Drives the "TV online" pulse in the top strip. */
  online: boolean;
}

/** Section 11.1 screen 4: a thin strip plus the game's own TV view. */
export default function TvMatch({ match, players, online }: TvMatchProps) {
  const meta = getGame(match.game);
  const View = meta.TvView;

  return (
    <div className="cc-tv-root">
      <div
        className="flex shrink-0 items-center justify-between"
        style={{ paddingBottom: '1.2vh' }}
      >
        <span className="font-display" style={{ fontSize: '2.8vh', color: 'var(--ink-dim)' }}>
          {meta.label}
        </span>
        <span className="flex items-center gap-[0.8vh]" style={{ fontSize: '2.4vh', color: 'var(--ink-dim)' }}>
          TV online
          <motion.span
            className="block rounded-full"
            style={{ width: '1.4vh', height: '1.4vh', background: online ? 'var(--ok)' : 'var(--danger)' }}
            animate={online ? { opacity: [1, 0.25, 1] } : undefined}
            transition={online ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : undefined}
          />
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <View state={match.state} seats={match.seats} players={players} />
      </div>
    </div>
  );
}
