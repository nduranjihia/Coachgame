import { motion } from 'framer-motion';
import { PlayCircle, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PlayerChip from '@/components/PlayerChip';
import QrTile from '@/components/QrTile';
import { GameIcon, GAME_KEYS, getGame } from '@/games/registry';
import { headToHead, type StatsByGame } from '@/hooks/useStats';
import { MAX_PLAYERS } from '@/lib/constants';
import { setRole } from '@/lib/device';
import type { Match, Player } from '@/types/db';
import type { CardsState, ChessState, TttState } from '@/types/games';

export interface TvHomeProps {
  code: string;
  players: Player[];
  onlinePlayerIds: string[];
  byGame: StatsByGame;
  /** When set, a Resume banner is offered above the cards. */
  activeMatch: Match | null;
}

/** "Alex & Sam's place" / "Alex's place" / "Your place". */
export function householdTitle(players: Player[]): string {
  if (players.length === 0) return 'Your place';
  if (players.length === 1) return `${players[0].name}'s place`;
  if (players.length === 2) return `${players[0].name} & ${players[1].name}'s place`;
  return `${players[0].name}, ${players[1].name} & ${players[2].name}'s place`;
}

function moveCount(match: Match): number {
  if (match.game === 'tictactoe') return (match.state as TttState).moveCount ?? 0;
  if (match.game === 'chess') return (match.state as ChessState).san?.length ?? 0;
  return (match.state as CardsState).drawCount ?? 0;
}

/** Section 11.1 screen 3: the lounge. Display only - every game starts on a phone. */
export default function TvHome({ code, players, onlinePlayerIds, byGame, activeMatch }: TvHomeProps) {
  const navigate = useNavigate();
  const online = new Set(onlinePlayerIds);

  const becomeController = (): void => {
    setRole('phone');
    navigate('/play', { replace: true });
  };

  const resumeNames = activeMatch
    ? activeMatch.seats
        .map((id) => players.find((p) => p.id === id)?.name)
        .filter((n): n is string => Boolean(n))
        .join(' vs ')
    : '';

  return (
    <div className="cc-tv-root">
      {/* Top bar: household title on the left, player chips on the right. */}
      <div className="flex shrink-0 items-center justify-between gap-[2vw]">
        <h1 className="font-display truncate" style={{ fontSize: '5vh', color: 'var(--ink)' }}>
          {householdTitle(players)}
        </h1>
        <div className="flex shrink-0 items-center gap-[0.8vw]">
          {players.map((p) => (
            <PlayerChip
              key={p.id}
              player={p}
              online={online.has(p.id)}
              size="4.4rem"
              showDot={false}
            />
          ))}
        </div>
      </div>

      {/* Resume banner (also what the phones offer as "Continue"). */}
      {activeMatch ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex shrink-0 items-center gap-[1.4vh] rounded-[2rem] px-[2.4vh]"
          style={{
            marginTop: '1.6vh',
            padding: '1.4vh 2.4vh',
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <PlayCircle size="3.4vh" style={{ color: 'var(--sun)', flexShrink: 0 }} />
          <span className="font-display truncate" style={{ fontSize: '3.4vh', color: 'var(--ink)' }}>
            {getGame(activeMatch.game).label} in progress — {resumeNames} · move {moveCount(activeMatch)}
          </span>
        </motion.div>
      ) : null}

      {/* The three game cards. */}
      <div className="flex min-h-0 flex-1 items-center justify-center gap-[2.4vw]">
        {GAME_KEYS.map((key, i) => {
          const game = getGame(key);
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 * i, duration: 0.3 }}
              className="cc-panel flex shrink-0 flex-col items-center justify-between px-[1.6vw] py-[2.4vh] text-center"
              style={{ width: '28vw', height: '44vh' }}
            >
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[1.2vh]">
                <GameIcon game={key} size="13vh" />
                <h2 className="font-display" style={{ fontSize: '6vh', color: 'var(--ink)', lineHeight: 1 }}>
                  {game.label}
                </h2>
              </div>
              <p
                className="font-body"
                style={{ fontSize: '2.6vh', color: 'var(--ink-dim)', lineHeight: 1.25, marginBottom: '1.4vh' }}
              >
                {game.tagline}
              </p>
              <span
                className="font-body truncate"
                style={{
                  fontSize: '2.4vh',
                  fontWeight: 600,
                  color: 'var(--sun)',
                  background: 'rgba(255,200,87,.12)',
                  border: '1px solid rgba(255,200,87,.28)',
                  borderRadius: 999,
                  padding: '0.7vh 1.4vh',
                  maxWidth: '100%',
                }}
              >
                {headToHead(byGame[key], players)}
              </span>
            </motion.div>
          );
        })}
      </div>

      {/* "Pick a game on your phone" banner. */}
      <div
        className="flex shrink-0 items-center justify-center gap-[1.4vh] rounded-[2.4rem]"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow-soft)',
          padding: '1.6vh 2vw',
        }}
      >
        <motion.span
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          className="flex"
        >
          <Smartphone size="3.4vh" style={{ color: 'var(--sun)' }} />
        </motion.span>
        <span className="font-display" style={{ fontSize: '3.2vh', color: 'var(--ink)' }}>
          Pick a game on your phone
        </span>
      </div>

      {/* Bottom-right QR tile: "Add a phone", and a way back in if the TV forgets itself. */}
      {players.length < MAX_PLAYERS ? (
        <div
          className="absolute flex flex-col items-center rounded-[2.4rem]"
          style={{
            right: '3.5vw',
            bottom: '3vh',
            background: '#ffffff',
            padding: '1.4vh',
            boxShadow: 'var(--shadow-soft)',
          }}
        >
          <QrTile code={code} size="14vh" label="Add a phone" />
        </div>
      ) : null}

      <div className="flex shrink-0 justify-center" style={{ paddingTop: '1vh' }}>
        <button
          type="button"
          onClick={becomeController}
          className="font-body underline"
          style={{ fontSize: '2.4vh', color: 'var(--ink-dim)', background: 'none', border: 0 }}
        >
          Not a TV? Use as a controller
        </button>
      </div>
    </div>
  );
}
