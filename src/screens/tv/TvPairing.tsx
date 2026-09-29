import { motion } from 'framer-motion';
import Avatar from '@/components/Avatar';
import QrTile from '@/components/QrTile';
import { MAX_PLAYERS } from '@/lib/constants';
import type { Player } from '@/types/db';
import TvControllerLink from './TvControllerLink';

export interface TvPairingProps {
  code: string;
  /** Fills in live as phones join (section 11.1, screen 2). */
  players: Player[];
}

const STEPS = ['Point your camera at the code', 'Pick a name and a face', 'Choose a game on your phone'];

/** Section 11.1 screen 2: the QR, the code and three friendly steps. */
export default function TvPairing({ code, players }: TvPairingProps) {
  return (
    <div className="cc-tv-root">
      <div className="flex min-h-0 flex-1 items-center justify-center gap-[5vw]">
        {/* Left: the white QR tile. */}
        <div
          className="flex shrink-0 items-center justify-center rounded-[3rem]"
          style={{ background: '#ffffff', padding: '3vh', boxShadow: 'var(--shadow-soft)' }}
        >
          <QrTile code={code} size="36vh" codeSize="9vh" />
        </div>

        {/* Right: headline and the three numbered steps. */}
        <div className="flex min-w-0 flex-col justify-center">
          <h1 className="font-display" style={{ fontSize: '7vh', color: 'var(--ink)', lineHeight: 1.05 }}>
            Grab your phone
          </h1>
          <ol className="mt-[3.2vh] flex flex-col gap-[2.2vh]">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-[1.8vh]">
                <span
                  className="font-display flex shrink-0 items-center justify-center rounded-full"
                  style={{
                    width: '5.4vh',
                    height: '5.4vh',
                    fontSize: '3.2vh',
                    background: i === 0 ? 'var(--sun)' : 'var(--bg-3)',
                    color: 'var(--bg-0)',
                    boxShadow: 'var(--shadow-hard)',
                  }}
                >
                  {i + 1}
                </span>
                <span className="font-body" style={{ fontSize: '3vh', color: 'var(--ink-dim)' }}>
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* Player slots: dashed circles that fill with avatars as people join. */}
      <div className="flex shrink-0 items-center justify-center gap-[2.2vh]" style={{ paddingBottom: '1vh' }}>
        {Array.from({ length: MAX_PLAYERS }, (_, i) => {
          const player = players[i];
          if (player) {
            return (
              <motion.div
                key={player.id}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 340, damping: 18 }}
                className="flex flex-col items-center gap-[0.6vh]"
                style={{ width: '13vh' }}
              >
                <Avatar emoji={player.emoji} color={player.color} size="9.5vh" />
                <span
                  className="font-body truncate"
                  style={{ fontSize: '2.4vh', color: 'var(--ink)', maxWidth: '13vh' }}
                >
                  {player.name}
                </span>
              </motion.div>
            );
          }
          return (
            <div
              key={`empty-${i}`}
              className="flex items-center justify-center rounded-full"
              style={{
                width: '9.5vh',
                height: '9.5vh',
                border: '0.4vh dashed rgba(255,246,233,.28)',
                color: 'rgba(255,246,233,.28)',
              }}
            >
              <span className="font-display" style={{ fontSize: '4vh', lineHeight: 1 }}>
                +
              </span>
            </div>
          );
        })}
      </div>

      <TvControllerLink />
    </div>
  );
}
