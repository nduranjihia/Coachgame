import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, PlayCircle } from 'lucide-react';
import StatusBar from '@/components/StatusBar';
import { GameIcon, GAME_KEYS, getGame } from '@/games/registry';
import { headToHead, useStats } from '@/hooks/useStats';
import { useMatchStore } from '@/store/match';
import { useSession } from '@/store/session';
import type { CommandType, GameKey, Match, Player } from '@/types/db';
import StartSheet from './StartSheet';

export type Send = (
  type: CommandType,
  payload?: Record<string, any>,
  matchId?: string | null,
) => Promise<boolean>;

export interface PhoneHomeProps {
  send: Send;
  onContinue: () => void;
}

function opponentNames(match: Match, players: Player[], me: string | null): string {
  const names = match.seats
    .filter((id) => id !== me)
    .map((id) => players.find((p) => p.id === id)?.name)
    .filter((n): n is string => Boolean(n));
  return names.length > 0 ? names.join(' vs ') : 'Everyone';
}

/** Section 11.2 screen 3: the lobby. Every match starts from here. */
export default function PhoneHome({ send, onContinue }: PhoneHomeProps) {
  const me = useSession((s) => s.players.find((p) => p.id === s.myPlayerId) ?? null);
  const players = useSession((s) => s.players);
  const online = useSession((s) => s.onlinePlayerIds);
  const tvOnline = useSession((s) => s.tvOnline);
  const householdId = useSession((s) => s.householdId);
  const activeMatch = useMatchStore((s) => s.activeMatch);
  const { byGame } = useStats(householdId);
  const [starting, setStarting] = useState<GameKey | null>(null);

  const onlineSet = useMemo(() => new Set(online), [online]);
  const others = players.filter((p) => p.id !== me?.id);
  const statusLine = others
    .map((p) => `${p.name} is ${onlineSet.has(p.id) ? 'online' : 'offline'}`)
    .join(' · ');

  return (
    <div className="cc-phone-root">
      <StatusBar player={me} tvOnline={tvOnline} />

      {!tvOnline ? (
        <div
          className="font-body flex shrink-0 items-center justify-center text-center"
          style={{
            background: 'rgba(255,77,77,.16)',
            color: 'var(--danger)',
            padding: '10px 16px',
            fontSize: 15,
          }}
        >
          Waiting for the TV…
        </div>
      ) : null}

      <div className="cc-scroll-y flex flex-1 flex-col gap-4 px-4 py-5">
        <h1 className="font-display" style={{ fontSize: 32, color: 'var(--ink)' }}>
          Hey {me?.name ?? 'there'}!
        </h1>
        <p className="font-body -mt-2 text-[15px]" style={{ color: 'var(--ink-dim)' }}>
          {others.length === 0 ? 'Waiting for someone to join.' : statusLine}
        </p>

        {activeMatch ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onContinue}
            className="cc-panel flex w-full items-center gap-3 text-left"
            style={{ padding: 14 }}
          >
            <span
              className="flex shrink-0 items-center justify-center rounded-full"
              style={{ width: 46, height: 46, background: 'rgba(255,200,87,.16)' }}
            >
              <PlayCircle size={26} style={{ color: 'var(--sun)' }} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-display block" style={{ fontSize: 19, color: 'var(--ink)' }}>
                {getGame(activeMatch.game).label} in progress
              </span>
              <span className="font-body block truncate text-[14px]" style={{ color: 'var(--ink-dim)' }}>
                {opponentNames(activeMatch, players, me?.id ?? null)}
              </span>
            </span>
            <span
              className="font-display shrink-0 rounded-full"
              style={{ background: 'var(--sun)', color: 'var(--bg-0)', padding: '10px 18px', fontSize: 16 }}
            >
              Continue
            </span>
          </motion.button>
        ) : null}

        <div className="mt-1 flex flex-col gap-3">
          {GAME_KEYS.map((key) => {
            const game = getGame(key);
            return (
              <motion.button
                key={key}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setStarting(key)}
                className="cc-panel flex w-full items-center gap-3 text-left"
                style={{ height: 96, padding: '0 14px' }}
              >
                <GameIcon game={key} size={46} />
                <span className="min-w-0 flex-1">
                  <span className="font-display block" style={{ fontSize: 21, color: 'var(--ink)' }}>
                    {game.label}
                  </span>
                  <span
                    className="font-body block truncate"
                    style={{ fontSize: 14, color: 'var(--ink-dim)', marginTop: 2 }}
                  >
                    {game.tagline}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className="font-body"
                    style={{ fontSize: 12, color: 'var(--ink-dim)', maxWidth: 110, textAlign: 'right' }}
                  >
                    {headToHead(byGame[key], players)}
                  </span>
                  <ChevronRight size={20} style={{ color: 'var(--ink-dim)' }} />
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <StartSheet game={starting} onClose={() => setStarting(null)} send={send} activeMatch={activeMatch} />
    </div>
  );
}
