import { useCallback, useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import Sheet from '@/components/Sheet';
import StatusBar from '@/components/StatusBar';
import { friendlyMessage } from '@/lib/errors';
import { getHouseholdId, getPlayerId, setHouseholdId } from '@/lib/device';
import { rpcErrorCode, supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import type { HouseholdPreview, Player, PreviewPlayer } from '@/types/db';
import Profile, { type ProfileValues } from './Profile';

export interface JoinFlowProps {
  code: string;
  onDone: () => void;
  onCancel: () => void;
}

type Stage = 'preview' | 'error' | 'link' | 'other' | 'who' | 'profile';

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  const tvOnline = useSession((s) => s.tvOnline);
  return (
    <div className="cc-phone-root">
      <StatusBar player={null} tvOnline={tvOnline} />
      <div className="flex flex-1 flex-col justify-center gap-6 px-6">
        <h1 className="font-display text-center" style={{ fontSize: 28, color: 'var(--ink)' }}>
          No luck
        </h1>
        <p className="font-body text-center text-[17px]" style={{ color: 'var(--ink-dim)' }}>
          {message}
        </p>
        <Button full onClick={onRetry}>
          Try another code
        </Button>
      </div>
    </div>
  );
}

function WhoScreen({
  players,
  busyId,
  onPick,
  onNew,
  onCancel,
}: {
  players: PreviewPlayer[];
  busyId: string | null;
  onPick: (p: PreviewPlayer) => void;
  onNew: () => void;
  onCancel: () => void;
}) {
  const me = useSession((s) => s.players.find((p) => p.id === s.myPlayerId) ?? null);
  const tvOnline = useSession((s) => s.tvOnline);

  return (
    <div className="cc-phone-root">
      <StatusBar player={me} tvOnline={tvOnline} />
      <div className="cc-scroll-y flex flex-1 flex-col gap-4 px-6 py-6">
        <div>
          <h1 className="font-display" style={{ fontSize: 32, color: 'var(--ink)' }}>
            Who are you?
          </h1>
          <p className="font-body mt-2 text-[16px]" style={{ color: 'var(--ink-dim)' }}>
            Pick your face to hop straight back in.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {players.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={busyId !== null}
              onClick={() => onPick(p)}
              className="flex items-center gap-4 rounded-[22px] text-left"
              style={{
                minHeight: 72,
                padding: '8px 16px',
                background: 'var(--bg-2)',
                border: '1px solid var(--line)',
                boxShadow: 'var(--shadow-hard)',
              }}
            >
              <Avatar emoji={p.emoji} color={p.color} size={52} />
              <span className="font-body text-[19px]" style={{ fontWeight: 600, color: 'var(--ink)' }}>
                {busyId === p.id ? 'One moment…' : p.name}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <Button full onClick={onNew} disabled={busyId !== null}>
            I&apos;m someone new
          </Button>
          <Button full variant="ghost" onClick={onCancel}>
            Not this TV
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Section 6.3: preview the code, decide what to do, then claim or create a profile. */
export default function JoinFlow({ code, onDone, onCancel }: JoinFlowProps) {
  const tvOnline = useSession((s) => s.tvOnline);
  const setMyPlayerId = useSession((s) => s.setMyPlayerId);

  const [stage, setStage] = useState<Stage>('preview');
  const [preview, setPreview] = useState<HouseholdPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = useCallback((message: string) => {
    setError(message);
    setStage('error');
  }, []);

  const previewHousehold = useCallback(async (): Promise<void> => {
    setStage('preview');
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('preview_household', { p_code: code });
    if (rpcError || !data) {
      fail(friendlyMessage(rpcError ? rpcErrorCode(rpcError) : 'invalid_code'));
      return;
    }
    const next = data as HouseholdPreview;
    setPreview(next);

    const local = getHouseholdId();
    if (local === next.household_id && getPlayerId()) {
      onDone();
      return;
    }
    if (local && local !== next.household_id) {
      setStage(next.has_players ? 'other' : 'link');
      return;
    }
    setStage(next.players.length > 0 ? 'who' : 'profile');
  }, [code, fail, onDone]);

  useEffect(() => {
    void previewHousehold();
  }, [previewHousehold]);

  const adopt = (player: Player, householdId: string): void => {
    setHouseholdId(householdId);
    setMyPlayerId(player.id);
    onDone();
  };

  const claim = async (p: PreviewPlayer): Promise<void> => {
    if (!preview) return;
    setBusyId(p.id);
    const { data, error: rpcError } = await supabase.rpc('claim_player', {
      p_code: code,
      p_player_id: p.id,
    });
    if (rpcError || !data) {
      setBusyId(null);
      fail(friendlyMessage(rpcError ? rpcErrorCode(rpcError) : 'invalid_player'));
      return;
    }
    adopt(data as Player, preview.household_id);
  };

  const create = async (values: ProfileValues): Promise<void> => {
    if (!preview) return;
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc('join_household', {
      p_code: code,
      p_name: values.name,
      p_emoji: values.emoji,
      p_color: values.color,
    });
    setBusy(false);
    if (rpcError || !data) {
      const reason = rpcError ? rpcErrorCode(rpcError) : 'unknown';
      if (reason === 'already_joined') {
        // The device already owns a face here - let them pick it.
        setStage(preview.players.length > 0 ? 'who' : 'profile');
        return;
      }
      fail(friendlyMessage(reason));
      return;
    }
    adopt(data as Player, preview.household_id);
  };

  const linkTv = async (): Promise<void> => {
    if (!preview) return;
    const local = getHouseholdId();
    if (!local) return;
    setBusy(true);
    const { error: rpcError } = await supabase.rpc('link_tv', {
      p_source: preview.household_id,
      p_target: local,
    });
    setBusy(false);
    if (rpcError) {
      fail(friendlyMessage(rpcErrorCode(rpcError)));
      return;
    }
    onDone();
  };

  if (stage === 'error') {
    return <ErrorScreen message={error ?? 'Something went wrong.'} onRetry={onCancel} />;
  }

  if (stage === 'preview') {
    return (
      <div className="cc-phone-root">
        <StatusBar player={null} tvOnline={tvOnline} />
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <div className="cc-skeleton h-16 w-64 rounded-full" />
          <p className="font-body text-[16px]" style={{ color: 'var(--ink-dim)' }}>
            Looking for that TV…
          </p>
        </div>
      </div>
    );
  }

  if (stage === 'link') {
    return (
      <div className="cc-phone-root">
        <StatusBar player={null} tvOnline={tvOnline} />
        <Sheet open onClose={onCancel} title="New TV spotted">
          <p className="mb-5 text-center text-[16px] leading-snug" style={{ color: 'var(--ink-dim)' }}>
            Move it into your home?
          </p>
          <div className="flex flex-col gap-3">
            <Button
              full
              disabled={busy}
              onClick={() => {
                void linkTv();
              }}
            >
              Yes, link this TV
            </Button>
            <Button full variant="ghost" onClick={onCancel} disabled={busy}>
              No
            </Button>
          </div>
        </Sheet>
      </div>
    );
  }

  if (stage === 'other') {
    return (
      <div className="cc-phone-root">
        <StatusBar player={null} tvOnline={tvOnline} />
        <Sheet open onClose={onCancel} title="Another home?">
          <p className="mb-5 text-center text-[16px] leading-snug" style={{ color: 'var(--ink-dim)' }}>
            This TV belongs to another home. Join it as a new player?
          </p>
          <div className="flex flex-col gap-3">
            <Button
              full
              onClick={() => {
                setStage(preview && preview.players.length > 0 ? 'who' : 'profile');
              }}
            >
              Join
            </Button>
            <Button full variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </Sheet>
      </div>
    );
  }

  if (stage === 'who') {
    return (
      <WhoScreen
        players={preview?.players ?? []}
        busyId={busyId}
        onPick={(p) => void claim(p)}
        onNew={() => setStage('profile')}
        onCancel={onCancel}
      />
    );
  }

  return (
    <Profile
      title="Create your player"
      submitLabel="Join the couch"
      busy={busy}
      error={error}
      onSubmit={(values) => void create(values)}
      onCancel={onCancel}
      cancelLabel="Not this TV"
    />
  );
}
