import type { CSSProperties } from 'react';
import type { Player } from '@/types/db';
import Avatar from './Avatar';

export interface PlayerChipProps {
  player: Player;
  online?: boolean | null;
  /** TV chips are sized in rem so they scale with `html { font-size: 2vh }`. */
  size?: number | string;
  showDot?: boolean;
}

/** Avatar + name + online dot, used in the TV top bar and match panels. */
export default function PlayerChip({ player, online = null, size = 44, showDot = true }: PlayerChipProps) {
  const px = typeof size === 'number' ? `${size}px` : size;
  const style: CSSProperties = {
    background: 'var(--bg-2)',
    border: '1px solid var(--line)',
    padding: `calc(${px} * 0.11) calc(${px} * 0.3)`,
  };
  return (
    <div className="flex items-center gap-2 rounded-full" style={style}>
      <Avatar emoji={player.emoji} color={player.color} size={px} />
      <span className="font-body truncate" style={{ fontSize: `calc(${px} * 0.4)`, fontWeight: 600 }}>
        {player.name}
      </span>
      {showDot ? (
        <span
          aria-hidden="true"
          className="block rounded-full"
          style={{
            width: `calc(${px} * 0.2)`,
            height: `calc(${px} * 0.2)`,
            minWidth: 7,
            minHeight: 7,
            background: online ? 'var(--ok)' : 'rgba(185,174,208,.45)',
          }}
        />
      ) : null}
    </div>
  );
}
