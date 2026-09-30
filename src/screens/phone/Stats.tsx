import { useState } from 'react';
import Avatar from '@/components/Avatar';
import StatusBar from '@/components/StatusBar';
import { GameIcon, GAME_KEYS, getGame } from '@/games/registry';
import { gameStatsLabel, matchSummary, useStats, type RecentMatch } from '@/hooks/useStats';
import { useSession } from '@/store/session';
import type { GameKey } from '@/types/db';

/** "just now" · "5m ago" · "3h ago" · "2d ago" · "12 Mar" */
function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return '';
  const diff = Date.now() - at;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function Row({ row }: { row: RecentMatch }) {
  const players = useSession((s) => s.players);
  const me = useSession((s) => s.players.find((p) => p.id === s.myPlayerId) ?? null);
  const winner = row.winner_id ? players.find((p) => p.id === row.winner_id) : null;
  const mine = row.winner_id === me?.id;

  return (
    <li
      className="flex items-center gap-3 rounded-[18px]"
      style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', padding: '10px 12px' }}
    >
      {winner ? (
        <Avatar emoji={winner.emoji} color={winner.color} size={38} />
      ) : (
        <span
          className="flex shrink-0 items-center justify-center rounded-full"
          style={{ width: 38, height: 38, background: 'var(--bg-3)', fontSize: 18 }}
        >
          🤝
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="font-body block truncate" style={{ fontSize: 15, color: 'var(--ink)' }}>
          {row.winner_id ? `${mine ? 'You' : winner?.name ?? 'Winner'} won` : 'Draw'}
        </span>
        <span className="font-body block truncate text-[13px]" style={{ color: 'var(--ink-dim)' }}>
          {gameStatsLabel(row.game)} · {matchSummary(row, players)}
        </span>
      </span>
      <span className="font-body shrink-0 text-[13px]" style={{ color: 'var(--ink-dim)' }}>
        {relativeTime(row.finished_at)}
      </span>
    </li>
  );
}

/** Section 11.2 screen 6: the scoreboard. */
export default function Stats() {
  const me = useSession((s) => s.players.find((p) => p.id === s.myPlayerId) ?? null);
  const players = useSession((s) => s.players);
  const tvOnline = useSession((s) => s.tvOnline);
  const householdId = useSession((s) => s.householdId);
  const { byGame, recent } = useStats(householdId);
  const [tab, setTab] = useState<GameKey>('tictactoe');

  const stats = byGame[tab];
  const total = stats.total;
  const winners = players
    .map((p) => ({ player: p, wins: stats.wins[p.id] ?? 0 }))
    .filter((row) => row.wins > 0);
  // Wins by players whose rows were removed still belong in the bar: the widths
  // are fractions of `total`, so leaving them out left the bar under-filled.
  const formerWins = Object.entries(stats.wins)
    .filter(([id, n]) => n > 0 && !players.some((p) => p.id === id))
    .reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="cc-phone-root">
      <StatusBar player={me} tvOnline={tvOnline} />

      <div className="cc-scroll-y flex flex-1 flex-col gap-4 px-4 py-5">
        <h1 className="font-display" style={{ fontSize: 32, color: 'var(--ink)' }}>
          Stats
        </h1>

        {/* Segmented control. */}
        <div
          className="flex shrink-0 gap-1 rounded-full p-1"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
        >
          {GAME_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className="flex flex-1 items-center justify-center rounded-full"
              style={{
                minHeight: 48,
                fontSize: 15,
                fontWeight: 600,
                background: tab === key ? 'var(--bg-3)' : 'transparent',
                color: tab === key ? 'var(--ink)' : 'var(--ink-dim)',
                border: tab === key ? '1px solid var(--line)' : '1px solid transparent',
              }}
            >
              {getGame(key).label}
            </button>
          ))}
        </div>

        {/* Head-to-head bar. */}
        {total === 0 ? (
          <div
            className="cc-panel flex flex-col items-center gap-2 px-4 py-8 text-center"
            style={{ gap: 10 }}
          >
            <GameIcon game={tab} size={44} />
            <p className="font-body" style={{ fontSize: 16, color: 'var(--ink-dim)' }}>
              No {getGame(tab).label} matches yet.
            </p>
          </div>
        ) : (
          <div className="cc-panel flex flex-col gap-2" style={{ padding: 16 }}>
            <div className="flex items-center justify-between">
              <span className="font-display" style={{ fontSize: 19, color: 'var(--ink)' }}>
                {getGame(tab).label}
              </span>
              <span className="font-body" style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
                {total} played
              </span>
            </div>
            <div
              className="flex overflow-hidden rounded-full"
              style={{ height: 18, background: 'var(--bg-3)' }}
              role="img"
              aria-label={`${winners.map((w) => `${w.player.name} ${w.wins}`).join(', ')}${
                stats.draws > 0 ? `, draws ${stats.draws}` : ''
              }`}
            >
              {winners.map((row) => (
                <span
                  key={row.player.id}
                  style={{
                    width: `${(row.wins / total) * 100}%`,
                    background: `var(--${row.player.color})`,
                  }}
                />
              ))}              {formerWins > 0 ? (
                <span
                  style={{ width: `${(formerWins / total) * 100}%`, background: 'rgba(185,174,208,.55)' }}
                />
              ) : null}
              {stats.draws > 0 ? (
                <span
                  style={{ width: `${(stats.draws / total) * 100}%`, background: 'rgba(185,174,208,.35)' }}
                />
              ) : null}
            </div>
            <div className="font-body flex flex-wrap gap-x-4 gap-y-1" style={{ fontSize: 14 }}>
              {winners.map((row) => (
                <span key={row.player.id} className="flex items-center gap-1.5" style={{ color: 'var(--ink)' }}>
                  <span
                    className="block rounded-full"
                    style={{ width: 10, height: 10, background: `var(--${row.player.color})` }}
                  />
                  {row.player.name} {row.wins}
                </span>
              ))
              }
              {formerWins > 0 ? (
                <span style={{ color: 'var(--ink-dim)' }}>
                  Former players {formerWins}
                </span>
              ) : null}
              {stats.draws > 0 ? (
                <span style={{ color: 'var(--ink-dim)' }}>Draws {stats.draws}</span>
              ) : null}
            </div>
          </div>
        )}

        {/* The 15 most recent matches. */}
        <div>
          <p className="font-display mb-2" style={{ fontSize: 20, color: 'var(--ink)' }}>
            Recent
          </p>
          {recent.length === 0 ? (
            <p className="font-body" style={{ fontSize: 16, color: 'var(--ink-dim)' }}>
              Nothing played yet. Go pick a game!
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {recent.slice(0, 15).map((row) => (
                <Row key={row.id} row={row} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
