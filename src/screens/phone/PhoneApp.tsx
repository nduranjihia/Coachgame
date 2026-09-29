import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Home, Settings as SettingsIcon } from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { RealtimeChannel } from '@supabase/supabase-js';
import Toast from '@/components/Toast';
import { useActiveMatch } from '@/hooks/useActiveMatch';
import { useHousehold } from '@/hooks/useHousehold';
import { useMyHand } from '@/hooks/useMyHand';
import { usePresence } from '@/hooks/usePresence';
import { useSendCommand } from '@/hooks/useSendCommand';
import { useStats } from '@/hooks/useStats';
import { normaliseCode } from '@/lib/codes';
import { hapticTick } from '@/lib/haptics';
import { acquireWakeLock, refreshWakeLock } from '@/lib/wakeLock';
import { useMatchStore } from '@/store/match';
import { useSession } from '@/store/session';
import type { CardsState, ChessState, TttState } from '@/types/games';
import EnterCode from './EnterCode';
import JoinFlow from './JoinFlow';
import PhoneHome from './PhoneHome';
import PhoneMatch from './PhoneMatch';
import PhoneResult from './PhoneResult';
import Settings from './Settings';
import Stats from './Stats';

type Tab = 'home' | 'stats' | 'settings';

const TABS: { key: Tab; label: string; Icon: typeof Home }[] = [
  { key: 'home', label: 'Home', Icon: Home },
  { key: 'stats', label: 'Stats', Icon: BarChart3 },
  { key: 'settings', label: 'Settings', Icon: SettingsIcon },
];

/** Whose turn is it, for the haptic tick. */
function turnSeat(match: NonNullable<ReturnType<typeof useMatchStore.getState>['activeMatch']>): string | null {
  if (match.game === 'tictactoe') return (match.state as TttState).turn ?? null;
  if (match.game === 'chess') {
    const s = match.state as ChessState;
    return s.turn === 'w' ? s.white : s.black;
  }
  const s = match.state as CardsState;
  return match.seats[s.turnIndex] ?? null;
}

/** The phone role: the lobby, the games, stats and settings. */
export default function PhoneApp() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();

  const uid = useSession((s) => s.uid);
  const householdId = useSession((s) => s.householdId);
  const myPlayerId = useSession((s) => s.myPlayerId);
  const household = useSession((s) => s.household);
  const loading = useSession((s) => s.loading);

  const activeMatch = useMatchStore((s) => s.activeMatch);
  const lastMatch = useMatchStore((s) => s.lastMatch);

  const match = useActiveMatch(householdId);
  const stats = useStats(householdId);
  const onMatchEvent = useCallback(() => void match.reload(), [match]);

  // Declared before the channel exists so `useHousehold` can apply them to the
  // fresh channel before it calls `subscribe()`.
  const bindPresence = usePresence({ role: 'phone', uid });
  const bind = useCallback((channel: RealtimeChannel) => bindPresence(channel), [bindPresence]);

  const { channel, bootstrap } = useHousehold('phone', uid, { onMatchEvent, bind });
  const ready = Boolean(householdId && channel);

  useMyHand({
    channel,
    householdId,
    matchId: activeMatch?.id ?? null,
    playerId: myPlayerId,
    ready,
  });

  // A phone learns the TV answered because the match rows moved.
  const answerKey = `${activeMatch?.id ?? ''}:${activeMatch?.version ?? ''}:${lastMatch?.id ?? ''}`;
  const { send } = useSendCommand({
    householdId,
    playerId: myPlayerId,
    channel,
    activeMatchId: activeMatch?.id ?? null,
    answerKey,
    ready,
  });

  const [linkMode, setLinkMode] = useState(false);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [continueAsked, setContinueAsked] = useState(false);

  const routeCode = params.code ? normaliseCode(params.code) : null;
  // Coming back after a join lands us on /play; the router no longer has a code.
  useEffect(() => {
    if (routeCode) setLinkMode(false);
  }, [routeCode]);

  // A household we belong to but with no face yet: recover through the code flow.
  const recoveryCode = householdId && !myPlayerId ? (household?.join_code ?? null) : null;
  const joinCode = pendingCode ?? routeCode ?? recoveryCode;

  const finishJoin = useCallback(() => {
    setPendingCode(null);
    setLinkMode(false);
    if (location.pathname !== '/play') navigate('/play', { replace: true });
    void bootstrap();
  }, [bootstrap, location.pathname, navigate]);

  const iAmPlaying = Boolean(activeMatch && myPlayerId && activeMatch.seats.includes(myPlayerId));
  const showMatch = Boolean(activeMatch && (iAmPlaying || continueAsked));
  const iPlayedLast = Boolean(lastMatch && myPlayerId && lastMatch.seats.includes(myPlayerId));

  // A new match supersedes the "Continue" shortcut.
  useEffect(() => {
    setContinueAsked(false);
  }, [activeMatch?.id]);

  // Wake lock while a match runs, re-acquired when the tab comes back.
  useEffect(() => {
    if (activeMatch) void acquireWakeLock();
    const onVisible = (): void => {
      if (document.visibilityState === 'visible' && activeMatch) void refreshWakeLock();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [activeMatch]);

  // A small buzz the moment it becomes your turn.
  const lastTurn = useRef<string | null>(null);
  useEffect(() => {
    if (!activeMatch || !myPlayerId) return;
    const seat = turnSeat(activeMatch);
    if (seat === myPlayerId && lastTurn.current !== myPlayerId) hapticTick();
    lastTurn.current = seat;
  }, [activeMatch, myPlayerId]);

  const tabScreen = useMemo(() => {
    if (tab === 'stats') return <Stats />;
    if (tab === 'settings') return <Settings onLinkTV={() => setLinkMode(true)} />;
    return <PhoneHome send={send} onContinue={() => setContinueAsked(true)} />;
  }, [send, tab]);

  // 1. Joining or recovering a profile comes before everything else.
  if (joinCode) {
    return (
      <>
        <JoinFlow
          code={joinCode}
          onDone={finishJoin}
          onCancel={() => {
            setPendingCode(null);
            setLinkMode(false);
            if (routeCode) navigate('/play', { replace: true });
          }}
        />
        <Toast />
      </>
    );
  }

  // 2. No home yet (or deliberately linking a new TV).
  if (!householdId || linkMode) {
    return (
      <>
        <EnterCode
          onSubmit={(code) => {
            setLinkMode(false);
            setPendingCode(code);
          }}
        />
        <Toast />
      </>
    );
  }

  // 3. Waiting for the household row.
  if (!household || loading) {
    return (
      <div className="cc-phone-root items-center justify-center gap-4">
        <div className="cc-skeleton h-10 w-56 rounded-full" />
        <Toast />
      </div>
    );
  }

  // 4. A live match.
  if (showMatch && activeMatch) {
    return (
      <>
        <PhoneMatch match={activeMatch} send={send} />
        <Toast />
      </>
    );
  }

  // 5. The result overlay.
  if (!activeMatch && iPlayedLast && lastMatch) {
    return (
      <>
        <PhoneResult
          match={lastMatch}
          send={send}
          byGame={stats.byGame}
          onBackToMenu={() => setTab('home')}
        />
        <Toast />
      </>
    );
  }

  // 6. Home, stats and settings, with the bottom nav.
  return (
    <div className="cc-phone-shell">
      {tabScreen}
      <nav
        className="flex shrink-0 items-stretch"
        style={{ background: 'var(--bg-1)', borderTop: '1px solid var(--line)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map(({ key, label, Icon }) => {
          const on = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-current={on ? 'page' : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-1"
              style={{ minHeight: 60, color: on ? 'var(--sun)' : 'var(--ink-dim)' }}
            >
              <Icon size={22} />
              <span className="font-body" style={{ fontSize: 12, fontWeight: 600 }}>
                {label}
              </span>
            </button>
          );
        })}
      </nav>
      <Toast />
    </div>
  );
}
