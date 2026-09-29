import { useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import StatusBar from '@/components/StatusBar';
import { headToHead, matchSummary, type StatsByGame } from '@/hooks/useStats';
import { useSession } from '@/store/session';
import type { Match } from '@/types/db';
import type { Send } from './PhoneHome';

export interface PhoneResultProps {
  match: Match;
  send: Send;
  byGame: StatsByGame;
  onBackToMenu: () => void;
}

/** Section 11.2 screen 5: the same story as the TV, only smaller. */
export default function PhoneResult({ match, send, byGame, onBackToMenu }: PhoneResultProps) {
  const me = useSession((s) => s.players.find((p) => p.id === s.myPlayerId) ?? null);
  const players = useSession((s) => s.players);
  const tvOnline = useSession((s) => s.tvOnline);
  const [busy, setBusy] = useState(false);

  const winner = match.winner_id ? players.find((p) => p.id === match.winner_id) : null;
  const seats = match.seats
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const rematch = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    await send('rematch', {}, match.id);
    setBusy(false);
  };

  return (
    <div className="cc-phone-root">
      <StatusBar player={me} tvOnline={tvOnline} />

      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-6 text-center">
        {winner ? (
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Avatar emoji={winner.emoji} color={winner.color} size={86} />
          </motion.div>
        ) : (
          <div className="flex items-center" style={{ gap: 14 }}>
            {seats.slice(0, 2).map((p) => (
              <Avatar key={p.id} emoji={p.emoji} color={p.color} size={72} />
            ))}
          </div>
        )}

        <h1 className="font-display" style={{ fontSize: 36, color: 'var(--sun)', lineHeight: 1.05 }}>
          {winner ? `${winner.name} wins!` : "It's a draw!"}
        </h1>

        <p className="font-body" style={{ fontSize: 17, color: 'var(--ink)' }}>
          {matchSummary(match, players)}
        </p>

        <p
          className="font-body"
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--sun)',
            background: 'rgba(255,200,87,.12)',
            border: '1px solid rgba(255,200,87,.28)',
            borderRadius: 999,
            padding: '8px 16px',
          }}
        >
          {headToHead(byGame[match.game], players)}
        </p>

        <div className="mt-4 flex w-full flex-col gap-3">
          <Button
            full
            icon={<RotateCcw size={22} color="#14101F" />}
            disabled={busy || !tvOnline}
            onClick={() => void rematch()}
          >
            {busy ? 'One moment.' : 'Rematch'}
          </Button>
          <Button full variant="secondary" onClick={onBackToMenu}>
            Back to menu
          </Button>
        </div>
      </div>
    </div>
  );
}
