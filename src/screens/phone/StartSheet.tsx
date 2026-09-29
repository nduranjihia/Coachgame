import { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import Sheet from '@/components/Sheet';
import { getGame } from '@/games/registry';
import { useSession } from '@/store/session';
import type { GameKey, Match, Player } from '@/types/db';
import type { Send } from './PhoneHome';

export interface StartSheetProps {
  game: GameKey | null;
  onClose: () => void;
  send: Send;
  activeMatch: Match | null;
}

const ROW_MIN = 60;

/** Section 11.2 screen 3: who are we playing? Then `start_match`. */
export default function StartSheet({ game, onClose, send, activeMatch }: StartSheetProps) {
  const me = useSession((s) => s.players.find((p) => p.id === s.myPlayerId) ?? null);
  const players = useSession((s) => s.players);
  const online = useSession((s) => s.onlinePlayerIds);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const onlineSet = useMemo(() => new Set(online), [online]);
  const others = players.filter((p) => p.id !== me?.id);
  const onlineOthers = others.filter((p) => onlineSet.has(p.id));
  const multi = onlineOthers.length > 1;
  const isCards = game === 'cards';

  // Re-arm the chooser every time a tile is tapped.
  useEffect(() => {
    if (!game) return;
    setPicked(isCards ? onlineOthers.map((p) => p.id) : onlineOthers.length === 1 ? [onlineOthers[0].id] : []);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  if (!game) return null;
  const meta = getGame(game);
  const title = `Play ${meta.label}`;

  const seats = me ? [me.id, ...picked] : [];
  const enough = isCards ? seats.length >= 2 : seats.length === 2;
  const canGo = Boolean(me) && enough && !busy;
  const blocking = activeMatch;

  const toggle = (p: Player): void => {
    if (isCards) {
      setPicked((prev) => (prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]));
    } else {
      setPicked([p.id]);
    }
  };

  const go = async (): Promise<void> => {
    if (!canGo) return;
    setBusy(true);
    await send('start_match', { game, seats });
    setBusy(false);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={title}>
      {blocking ? (
        <p className="font-body mb-4 text-center text-[15px]" style={{ color: 'var(--sun)' }}>
          This ends the match in progress.
        </p>
      ) : null}

      {others.length === 0 ? (
        <p className="font-body mb-5 text-center text-[16px]" style={{ color: 'var(--ink-dim)' }}>
          Nobody else is here yet. Start a TV and scan its code.
        </p>
      ) : others.length === 1 ? (
        <>
          <p className="font-body mb-5 text-center text-[17px]" style={{ color: 'var(--ink)' }}>
            Play {meta.label} with {others[0].name}?
          </p>
          {onlineSet.has(others[0].id) ? null : (
            <p className="font-body mb-5 text-center text-[16px]" style={{ color: 'var(--ink-dim)' }}>
              {others[0].name} isn&apos;t connected yet.
            </p>
          )}
        </>
      ) : multi ? (
        <>
          <p className="font-body mb-3 text-center text-[16px]" style={{ color: 'var(--ink-dim)' }}>
            {isCards
              ? 'Pick everyone playing. Two to four.'
              : `Pick one opponent for ${meta.label}.`}
          </p>
          <div className="flex flex-col gap-2">
            {onlineOthers.map((p) => {
              const on = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggle(p)}
                  aria-pressed={on}
                  className="flex items-center gap-3 rounded-[20px]"
                  style={{
                    minHeight: ROW_MIN,
                    padding: '6px 14px',
                    background: on ? 'var(--bg-3)' : 'var(--bg-1)',
                    border: `2px solid ${on ? 'var(--sun)' : 'var(--line)'}`,
                  }}
                >
                  {isCards ? (
                    <span
                      className="flex shrink-0 items-center justify-center rounded-[8px]"
                      style={{
                        width: 26,
                        height: 26,
                        border: `2px solid ${on ? 'var(--sun)' : 'var(--ink-dim)'}`,
                        background: on ? 'var(--sun)' : 'transparent',
                      }}
                    >
                      {on ? <Check size={18} color="#14101F" /> : null}
                    </span>
                  ) : null}
                  <Avatar emoji={p.emoji} color={p.color} size={40} />
                  <span className="font-body text-[17px]" style={{ color: 'var(--ink)' }}>
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
          {others.length > onlineOthers.length ? (
            <p className="font-body mt-3 text-center text-[14px]" style={{ color: 'var(--ink-dim)' }}>
              {others
                .filter((p) => !onlineSet.has(p.id))
                .map((p) => `${p.name} isn't connected yet.`)
                .join(' ')}
            </p>
          ) : null}
        </>
      ) : (
        <p className="font-body mb-5 text-center text-[16px]" style={{ color: 'var(--ink-dim)' }}>
          {others
            .filter((p) => !onlineSet.has(p.id))
            .map((p) => `${p.name} isn't connected yet.`)
            .join(' ')}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3">
        <Button full disabled={!canGo} onClick={() => void go()}>
          {busy ? 'One moment.' : "Let's go"}
        </Button>
        <Button full variant="ghost" onClick={onClose} disabled={busy}>
          Not now
        </Button>
      </div>
    </Sheet>
  );
}
