import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Trash2, UserCog } from 'lucide-react';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import ConfirmSheet from '@/components/ConfirmSheet';
import Sheet from '@/components/Sheet';
import StatusBar from '@/components/StatusBar';
import { friendlyMessage } from '@/lib/errors';
import { setRole, wipeDevice } from '@/lib/device';
import { rpcErrorCode, supabase } from '@/lib/supabase';
import { useMatchStore } from '@/store/match';
import { useSession } from '@/store/session';
import type { HouseholdSettings, Player } from '@/types/db';
import Profile from './Profile';

export interface SettingsProps {
  onLinkTV: () => void;
}

type ConfirmKind = 'clear' | 'delete' | null;

const SECTION: CSSProperties = {
  padding: 16,
  background: 'var(--bg-2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius)',
};

/** Section 11.2 screen 7: profile, options, players, and the scary buttons. */
export default function Settings({ onLinkTV }: SettingsProps) {
  const navigate = useNavigate();
  const me = useSession((s) => s.players.find((p) => p.id === s.myPlayerId) ?? null);
  const players = useSession((s) => s.players);
  const online = useSession((s) => s.onlinePlayerIds);
  const tvOnline = useSession((s) => s.tvOnline);
  const household = useSession((s) => s.household);
  const householdId = useSession((s) => s.householdId);
  const pushToast = useSession((s) => s.pushToast);
  const setPlayers = useSession((s) => s.setPlayers);
  const resetIdentity = useSession((s) => s.resetIdentity);
  const setSettings = useSession((s) => s.setSettings);

  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);
  const [removing, setRemoving] = useState<Player | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  const settings: HouseholdSettings = household?.settings ?? {
    lastCardPenalty: true,
    sound: true,
    moveHints: true,
  };
  const onlineSet = new Set(online);

  const toggle = async (key: keyof HouseholdSettings): Promise<void> => {
    const next = { ...settings, [key]: !settings[key] };
    setSettings({ [key]: next[key] });
    if (!householdId) return;
    const { error } = await supabase.rpc('update_settings', {
      p_household: householdId,
      p_settings: { [key]: next[key] },
    });
    if (error) {
      setSettings({ [key]: settings[key] });
      pushToast(friendlyMessage(rpcErrorCode(error)), 'error');
    }
  };

  const saveProfile = async (values: { name: string; emoji: string; color: string }): Promise<boolean> => {
    if (!me) return false;
    setBusy(true);
    const { error } = await supabase
      .from('players')
      .update({ name: values.name, emoji: values.emoji, color: values.color })
      .eq('id', me.id);
    setBusy(false);
    if (error) {
      pushToast(friendlyMessage(rpcErrorCode(error)), 'error');
      return false;
    }
    setPlayers(
      players.map((p) =>
        p.id === me.id ? { ...p, name: values.name, emoji: values.emoji, color: values.color as Player['color'] } : p,
      ),
    );
    setEditing(false);
    return true;
  };

  const removePlayer = async (player: Player): Promise<void> => {
    setBusy(true);
    const { error } = await supabase.rpc('remove_player', { p_player: player.id });
    setBusy(false);
    if (error) {
      pushToast(friendlyMessage(rpcErrorCode(error)), 'error');
      return;
    }
    setRemoving(null);
    pushToast(`${player.name} is gone.`, 'success');
  };

  const clearHistory = async (): Promise<void> => {
    if (!householdId) return;
    setBusy(true);
    const { error } = await supabase.rpc('clear_history', { p_household: householdId });
    setBusy(false);
    if (error) {
      pushToast(friendlyMessage(rpcErrorCode(error)), 'error');
      return;
    }
    setConfirm(null);
    pushToast('Match history cleared.', 'success');
  };

  const deleteEverything = async (): Promise<void> => {
    if (!householdId) return;
    setBusy(true);
    const { error } = await supabase.rpc('delete_household', { p_household: householdId });
    setBusy(false);
    if (error) {
      pushToast(friendlyMessage(rpcErrorCode(error)), 'error');
      return;
    }
    wipeDevice();
    useMatchStore.getState().resetMatch();
    resetIdentity();
    setConfirm(null);
    setTyped('');
    pushToast('Everything is gone.', 'success');
  };

  const becomeTV = (): void => {
    setRole('tv');
    navigate('/tv', { replace: true });
  };

  if (editing && me) {
    return (
      <Profile
        title="Your player"
        submitLabel="Save"
        initial={{ name: me.name, emoji: me.emoji, color: me.color }}
        busy={busy}
        onSubmit={(values) => void saveProfile(values)}
        onCancel={() => setEditing(false)}
        cancelLabel="Cancel"
      />
    );
  }

  return (
    <div className="cc-phone-root">
      <StatusBar player={me} tvOnline={tvOnline} />

      <div className="cc-scroll-y flex flex-1 flex-col gap-4 px-4 py-5">
        <h1 className="font-display" style={{ fontSize: 32, color: 'var(--ink)' }}>
          Settings
        </h1>

        {/* Profile */}
        <div className="flex flex-col gap-3" style={SECTION}>
          <p className="font-display" style={{ fontSize: 18, color: 'var(--ink)' }}>
            Profile
          </p>
          <div className="flex items-center gap-3">
            {me ? <Avatar emoji={me.emoji} color={me.color} size={52} /> : null}
            <span className="min-w-0 flex-1">
              <span className="font-body block truncate" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
                {me?.name ?? 'No player yet'}
              </span>
              <span className="font-body block text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                Home code {household?.join_code ?? '------'}
              </span>
            </span>
            <Button variant="secondary" icon={<UserCog size={20} color="#FFF6E9" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </div>

        {/* Game options */}
        <div className="flex flex-col gap-1" style={SECTION}>
          <p className="font-display" style={{ fontSize: 18, color: 'var(--ink)' }}>
            Game options
          </p>
          {(
            [
              ['lastCardPenalty', 'Last-card penalty', 'Shouting LAST CARD in Wild Cards costs you.'],
              ['sound', 'Sounds on TV', 'Little blips and chimes while you play.'],
              ['moveHints', 'Show legal-move dots in chess', 'Tap a piece, see where it can go.'],
            ] as [keyof HouseholdSettings, string, string][]
          ).map(([key, label, hint]) => (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={settings[key]}
              onClick={() => void toggle(key)}
              className="flex items-center gap-3 text-left"
              style={{ minHeight: 56 }}
            >
              <span className="min-w-0 flex-1">
                <span className="font-body block" style={{ fontSize: 16, color: 'var(--ink)' }}>
                  {label}
                </span>
                <span className="font-body block text-[13px]" style={{ color: 'var(--ink-dim)' }}>
                  {hint}
                </span>
              </span>
              <span
                className="relative block shrink-0 rounded-full"
                style={{
                  width: 56,
                  height: 32,
                  background: settings[key] ? 'var(--ok)' : 'var(--bg-3)',
                  border: '1px solid var(--line)',
                  transition: 'background 140ms ease',
                }}
              >
                <span
                  className="absolute block rounded-full"
                  style={{
                    top: 3,
                    left: settings[key] ? 26 : 3,
                    width: 24,
                    height: 24,
                    background: 'var(--ink)',
                    transition: 'left 140ms ease',
                  }}
                />
              </span>
            </button>
          ))}
        </div>

        {/* Link a TV */}
        <div className="flex flex-col gap-3" style={SECTION}>
          <p className="font-display" style={{ fontSize: 18, color: 'var(--ink)' }}>
            Link a TV
          </p>
          <p className="font-body -mt-1 text-[14px]" style={{ color: 'var(--ink-dim)' }}>
            Got a second TV, or did this one forget itself? Enter its code.
          </p>
          <Button full variant="secondary" onClick={onLinkTV}>
            Enter a TV code
          </Button>
        </div>

        {/* Players */}
        <div className="flex flex-col gap-2" style={SECTION}>
          <p className="font-display" style={{ fontSize: 18, color: 'var(--ink)' }}>
            Players
          </p>
          {players.length === 0 ? (
            <p className="font-body text-[15px]" style={{ color: 'var(--ink-dim)' }}>
              Just you so far.
            </p>
          ) : (
            players.map((p) => (
              <div key={p.id} className="flex items-center gap-3" style={{ minHeight: 56 }}>
                <Avatar emoji={p.emoji} color={p.color} size={40} online={onlineSet.has(p.id)} />
                <span className="min-w-0 flex-1">
                  <span className="font-body block truncate" style={{ fontSize: 16, color: 'var(--ink)' }}>
                    {p.name}
                    {p.id === me?.id ? ' (you)' : ''}
                  </span>
                </span>
                {p.id === me?.id ? null : (
                  <Button variant="ghost" onClick={() => setRemoving(p)}>
                    Remove
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Your data */}
        <div style={SECTION}>
          <p className="font-display mb-1" style={{ fontSize: 18, color: 'var(--ink)' }}>
            Your data
          </p>
          <p className="font-body" style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-dim)' }}>
            We store your names, emojis and match history. Nothing else. No emails, no passwords, no IP addresses.
          </p>
        </div>

        {/* Clear match history */}
        <Button full variant="secondary" onClick={() => setConfirm('clear')}>
          Clear match history
        </Button>

        {/* Delete everything */}
        <div
          className="flex flex-col gap-3"
          style={{ ...SECTION, border: '1px solid rgba(255,77,77,.5)', background: 'rgba(255,77,77,.08)' }}
        >
          <p className="font-display" style={{ fontSize: 18, color: 'var(--danger)' }}>
            Delete everything
          </p>
          <p className="font-body -mt-1 text-[14px]" style={{ color: 'var(--ink-dim)' }}>
            Removes the home, its players, its devices and every match. The TV goes back to first run.
          </p>
          <Button full variant="danger" icon={<Trash2 size={20} color="#14101F" />} onClick={() => setConfirm('delete')}>
            Delete everything
          </Button>
        </div>

        {/* Use this device as the TV */}
        <Button full variant="ghost" icon={<Monitor size={20} color="#B9AED0" />} onClick={becomeTV}>
          Use this device as the TV
        </Button>
      </div>

      <ConfirmSheet
        open={confirm === 'clear'}
        danger
        title="Clear match history?"
        message="Every finished match is removed. Players and the TV stay."
        confirmLabel="Clear it"
        cancelLabel="Keep history"
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void clearHistory()}
      />

      <ConfirmSheet
        open={removing !== null}
        danger
        title="Remove this player?"
        message={removing ? `${removing.name} can re-join with their code later.` : ''}
        confirmLabel="Remove"
        cancelLabel="Keep them"
        busy={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) void removePlayer(removing);
        }}
      />

      <Sheet open={confirm === 'delete'} onClose={() => setConfirm(null)} danger title="Delete everything?">
        <p className="font-body mb-4 text-center text-[16px]" style={{ color: 'var(--ink-dim)' }}>
          Type <strong style={{ color: 'var(--ink)' }}>DELETE</strong> to wipe this home for good.
        </p>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-label="Type DELETE to confirm"
          className="font-display mb-4 w-full text-center"
          style={{
            minHeight: 56,
            fontSize: 22,
            letterSpacing: '0.18em',
            color: 'var(--ink)',
            background: 'var(--bg-1)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-sm)',
            outline: 'none',
          }}
        />
        <div className="flex flex-col gap-3">
          <Button
            full
            variant="danger"
            disabled={busy || typed !== 'DELETE'}
            onClick={() => void deleteEverything()}
          >
            {busy ? 'One moment.' : 'Delete everything'}
          </Button>
          <Button full variant="ghost" onClick={() => setConfirm(null)} disabled={busy}>
            Cancel
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
