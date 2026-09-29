import { PLAYER_COLOR_HEX } from '@/lib/constants';
import type { PlayerColor } from '@/types/db';

export interface AvatarProps {
  emoji: string;
  color: PlayerColor;
  /** Diameter in px. TV screens pass rem values through `size`. */
  size?: number | string;
  online?: boolean | null;
  className?: string;
}

/** Emoji in a circle filled with the player's colour. */
export default function Avatar({ emoji, color, size = 48, online = null, className = '' }: AvatarProps) {
  const px = typeof size === 'number' ? `${size}px` : size;
  return (
    <div className={`relative inline-flex shrink-0 ${className}`.trim()} style={{ width: px, height: px }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full"
        style={{
          background: PLAYER_COLOR_HEX[color] ?? PLAYER_COLOR_HEX.coral,
          fontSize: `calc(${px} * 0.52)`,
          lineHeight: 1,
          boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.22)',
        }}
      >
        <span aria-hidden="true">{emoji}</span>
      </div>
      {online !== null ? (
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 block rounded-full"
          style={{
            width: 'calc(22% + 2px)',
            height: 'calc(22% + 2px)',
            minWidth: 8,
            minHeight: 8,
            background: online ? 'var(--ok)' : 'rgba(185,174,208,.45)',
            border: '2px solid var(--bg-0)',
          }}
        />
      ) : null}
    </div>
  );
}
