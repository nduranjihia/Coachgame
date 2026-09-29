import { useCallback, useEffect, useRef, useState } from 'react';
import { useActiveMatch } from '@/hooks/useActiveMatch';
import { useCommandProcessor } from '@/hooks/useCommandProcessor';
import { useHousehold } from '@/hooks/useHousehold';
import { usePresence } from '@/hooks/usePresence';
import { useStats } from '@/hooks/useStats';
import { RESULT_HOLD_MS } from '@/lib/constants';
import { sfxTap, sfxWin, sfxYourTurn, unlockAudio } from '@/lib/sound';
import { acquireWakeLock, refreshWakeLock } from '@/lib/wakeLock';
import { useMatchStore } from '@/store/match';
import { useSession } from '@/store/session';
import type { Match } from '@/types/db';
import type { CardsState, ChessState, TttState } from '@/types/games';
import TvBoot from './TvBoot';
import TvHome from './TvHome';
import TvMatch from './TvMatch';
import TvOffline from './TvOffline';
import TvPairing from './TvPairing';
import TvResult from './TvResult';

/** The seat whose turn it is, whatever the game. */
function turnSeat(match: Match): string | null {
  if (match.game === 'tictactoe') return (match.state as TttState).turn ?? null;
  if (match.game === 'chess') {
    const s = match.state as ChessState;
    return s.turn === 'w' ? s.white : s.black;
  }
  const s = match.state as CardsState;
  return match.seats[s.turnIndex] ?? null;
}

const DEAD_STATUSES = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

/** The TV role. Wires the data hooks together and picks the screen. */
export default function TvApp() {
  const uid = useSession((s) => s.uid);
  const householdId = useSession((s) => s.householdId);
  const household = useSession((s) => s.household);
  const players = useSession((s) => s.players);
  const onlinePlayerIds = useSession((s) => s.onlinePlayerIds);
  const loading = useSession((s) => s.loading);
  const homeGone = useSession((s) => s.homeGone);
  const soundOn = household?.settings.sound ?? true;

  const activeMatch = useMatchStore((s) => s.activeMatch);
  const lastMatch = useMatchStore((s) => s.lastMatch);

  const match = useActiveMatch(householdId);
  const stats = useStats(householdId);

  const [status, setStatus] = useState('JOINING');
  const onMatchEvent = useCallback(() => void match.reload(), [match]);
  const onChannelStatus = useCallback((next: string) => setStatus(next), []);

  const { channel, bootstrap } = useHousehold('tv', uid, { onMatchEvent, onChannelStatus });
  const ready = Boolean(householdId && channel);

  usePresence({ channel, role: 'tv', uid, myPlayerId: null, ready });
  useCommandProcessor({
    householdId,
    channel,
    ready,
    onCommitted: useCallback(() => {
      sfxTap(soundOn);
      void match.reload();
    }, [match, soundOn]),
  });

  // Records are shown on the game cards and on the result overlay.
  const matchId = activeMatch?.id ?? null;
  const matchVersion = activeMatch?.version ?? 0;
  const lastId = lastMatch?.id ?? null;
  const reloadStats = stats.reload;
  useEffect(() => {
    void reloadStats();
  }, [lastId, matchId, matchVersion, reloadStats]);

  // The home was deleted under us: go straight back to first run.
  useEffect(() => {
    if (homeGone) void bootstrap();
  }, [bootstrap, homeGone]);

  // The result overlay holds for 30 seconds unless a new match supersedes it.
  useEffect(() => {
    if (!lastMatch) return undefined;
    const timer = window.setTimeout(() => {
      useMatchStore.getState().setLastMatch(null);
    }, RESULT_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [lastMatch]);

  // Sounds: a blip per accepted command, a chime on each new turn, a fanfare.
  const seen = useRef<{ id: string | null; version: number; turn: string | null }>({
    id: null,
    version: 0,
    turn: null,
  });
  useEffect(() => {
    const prev = seen.current;
    const id = activeMatch?.id ?? null;
    const version = activeMatch?.version ?? 0;
    const turn = activeMatch ? turnSeat(activeMatch) : null;

    if (id !== prev.id) {
      if (prev.id && !id) sfxWin(soundOn);
      else if (!prev.id && id) sfxYourTurn(soundOn);
    } else if (id) {
      if (version !== prev.version) sfxTap(soundOn);
      if (turn && turn !== prev.turn) sfxYourTurn(soundOn);
    }
    seen.current = { id, version, turn };
  }, [activeMatch, soundOn]);

  // Keep the screen awake, and unlock audio on the first interaction.
  useEffect(() => {
    void acquireWakeLock();
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void refreshWakeLock();
    };
    const onFirstGesture = (): void => {
      unlockAudio();
      window.removeEventListener('pointerdown', onFirstGesture);
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pointerdown', onFirstGesture);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pointerdown', onFirstGesture);
    };
  }, []);

  const offline = DEAD_STATUSES.has(status);
  const code = household?.join_code ?? '';

  let screen = <TvBoot />;
  if (household && !loading) {
    if (players.length === 0) {
      screen = <TvPairing code={code} players={players} />;
    } else if (activeMatch) {
      screen = (
        <TvMatch match={activeMatch} players={players} online={!offline} />
      );
    } else if (lastMatch) {
      screen = <TvResult match={lastMatch} players={players} byGame={stats.byGame} />;
    } else {
      screen = (
        <TvHome
          code={code}
          players={players}
          onlinePlayerIds={onlinePlayerIds}
          byGame={stats.byGame}
          activeMatch={activeMatch}
        />
      );
    }
  }

  return (
    <>
      {screen}
      {offline ? <TvOffline /> : null}
    </>
  );
}
