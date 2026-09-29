import { Tv } from 'lucide-react';
import type { Player } from '@/types/db';
import Avatar from './Avatar';

export interface StatusBarProps {
  player: Player | null;
  tvOnline: boolean;
  /** Replaces the "TV connected" chip with something else when given. */
  rightLabel?: string;
  left?: React.ReactNode;
}

/** Slim persistent bar at the top of every phone screen. */
export default function StatusBar({ player, tvOnline, rightLabel, left }: StatusBarProps) {
  return (
    <div
      className="flex shrink-0 items-center justify-between gap-3 px-4"
      style={{ height: 56, background: 'var(--bg-1)', borderBottom: '1px solid var(--line)' }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {left}
        {player ? (
          <>
            <Avatar emoji={player.emoji} color={player.color} size={34} />
            <span className="font-body truncate" style={{ fontSize: 16, fontWeight: 600 }}>
              {player.name}
            </span>
          </>
        ) : (
          <span className="font-body" style={{ fontSize: 16, color: 'var(--ink-dim)' }}>
            Couch Clash
          </span>
        )}
      </div>
      <div
        className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5"
        style={{
          background: tvOnline ? 'rgba(61,220,151,.16)' : 'rgba(255,77,77,.16)',
          border: `1px solid ${tvOnline ? 'rgba(61,220,151,.4)' : 'rgba(255,77,77,.4)'}`,
          color: tvOnline ? 'var(--ok)' : 'var(--danger)',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <Tv size={15} />
        {rightLabel ?? (tvOnline ? 'TV connected' : 'TV offline')}
      </div>
    </div>
  );
}
