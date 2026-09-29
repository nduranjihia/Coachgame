import { useState } from 'react';
import { motion } from 'framer-motion';
import Button from '@/components/Button';
import StatusBar from '@/components/StatusBar';
import { EMOJIS, PLAYER_COLORS, PLAYER_COLOR_HEX } from '@/lib/constants';
import { useMyPlayer, useSession } from '@/store/session';
import type { PlayerColor } from '@/types/db';

export interface ProfileValues {
  name: string;
  emoji: string;
  color: PlayerColor;
}

export interface ProfileProps {
  title?: string;
  submitLabel?: string;
  initial?: Partial<ProfileValues>;
  busy?: boolean;
  error?: string | null;
  onSubmit: (values: ProfileValues) => void;
  onCancel?: () => void;
  cancelLabel?: string;
}

/** Section 11.2 screen 2: name, a face and a colour. Also used by Settings. */
export default function Profile({
  title = 'Who are you?',
  submitLabel = "Let's go",
  initial,
  busy = false,
  error,
  onSubmit,
  onCancel,
  cancelLabel = 'Back',
}: ProfileProps) {
  const me = useMyPlayer();
  const tvOnline = useSession((s) => s.tvOnline);
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? EMOJIS[0]);
  const [color, setColor] = useState<PlayerColor>(initial?.color ?? 'coral');

  const ready = name.trim().length > 0 && name.trim().length <= 20;

  const pickFirstFreeColor = (): void => {
    if (initial?.color) return;
    const used = new Set(useSession.getState().players.map((p) => p.color));
    const free = PLAYER_COLORS.find((c) => !used.has(c));
    if (free) setColor(free);
  };

  return (
    <div className="cc-phone-root">
      <StatusBar player={me} tvOnline={tvOnline} />
      <div className="cc-scroll-y flex flex-1 flex-col gap-6 px-6 py-6">
        <h1 className="font-display" style={{ fontSize: 32, color: 'var(--ink)' }}>
          {title}
        </h1>

        <div className="flex items-center gap-4">
          <motion.div
            key={`${emoji}-${color}`}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 18 }}
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 76,
              height: 76,
              fontSize: 38,
              lineHeight: 1,
              background: PLAYER_COLOR_HEX[color],
              boxShadow: 'inset 0 -4px 0 rgba(0,0,0,.22)',
            }}
          >
            <span aria-hidden="true">{emoji}</span>
          </motion.div>
          <input
            value={name}
            onFocus={pickFirstFreeColor}
            onChange={(e) => setName(e.target.value.slice(0, 20))}
            placeholder="Your name"
            maxLength={20}
            autoComplete="off"
            aria-label="Your name"
            className="font-body w-full"
            style={{
              minHeight: 56,
              fontSize: 18,
              color: 'var(--ink)',
              background: 'var(--bg-2)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius-sm)',
              padding: '0 16px',
              outline: 'none',
            }}
          />
        </div>

        <div>
          <p className="font-body mb-2 text-[15px]" style={{ color: 'var(--ink-dim)' }}>
            Pick a face
          </p>
          <div className="grid grid-cols-4 gap-2">
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                aria-label={`Face ${e}`}
                aria-pressed={emoji === e}
                className="flex items-center justify-center rounded-[18px] text-[30px]"
                style={{
                  minHeight: 56,
                  background: emoji === e ? 'var(--bg-3)' : 'var(--bg-2)',
                  border: `2px solid ${emoji === e ? 'var(--sun)' : 'var(--line)'}`,
                  lineHeight: 1,
                }}
              >
                <span aria-hidden="true">{e}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="font-body mb-2 text-[15px]" style={{ color: 'var(--ink-dim)' }}>
            Pick a colour
          </p>
          <div className="flex flex-wrap gap-2">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
                aria-pressed={color === c}
                className="flex items-center justify-center rounded-full"
                style={{ width: 56, height: 56, background: 'transparent', border: 0 }}
              >
                <span
                  className="block rounded-full"
                  style={{
                    width: 44,
                    height: 44,
                    background: PLAYER_COLOR_HEX[c],
                    border: color === c ? '3px solid var(--ink)' : '3px solid transparent',
                    boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.22)',
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="font-body text-center text-[15px]" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        ) : null}

        <div className="mt-auto flex flex-col gap-3">
          <Button full disabled={!ready || busy} onClick={() => onSubmit({ name: name.trim(), emoji, color })}>
            {busy ? 'One moment.' : submitLabel}
          </Button>
          {onCancel ? (
            <Button full variant="ghost" onClick={onCancel} disabled={busy}>
              {cancelLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
