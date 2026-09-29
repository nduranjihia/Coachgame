import { useState } from 'react';
import { MoreVertical } from 'lucide-react';
import Button from '@/components/Button';
import ConfirmSheet from '@/components/ConfirmSheet';
import Sheet from '@/components/Sheet';
import StatusBar from '@/components/StatusBar';
import { getGame } from '@/games/registry';
import { useMatchStore } from '@/store/match';
import { useSession } from '@/store/session';
import type { Match, Player } from '@/types/db';
import type { CardColor, CardsState, ChessState, TttState } from '@/types/games';
import type { Send } from './PhoneHome';

export interface PhoneMatchProps {
  match: Match;
  send: Send;
}

type ConfirmKind = 'quit' | 'resign' | null;

function ChessExtras({
  match,
  players,
  me,
  disabled,
  send,
  onConfirm,
}: {
  match: Match;
  players: Player[];
  me: Player | null;
  disabled: boolean;
  send: Send;
  onConfirm: (kind: ConfirmKind) => void;
}) {
  const state = match.state as ChessState;
  const offerFrom = state.drawOfferFrom;
  const waitingOnMe = Boolean(offerFrom && offerFrom !== me?.id);
  const offeredByName = offerFrom ? (players.find((p) => p.id === offerFrom)?.name ?? 'Someone') : '';

  return (
    <>
      <div className="flex shrink-0 gap-3 px-4" style={{ paddingTop: 10, paddingBottom: 12 }}>
        <Button
          full
          variant="secondary"
          disabled={disabled || waitingOnMe}
          onClick={() => void send('offer_draw', {}, match.id)}
        >
          Offer draw
        </Button>
        <Button
          full
          variant="secondary"
          disabled={disabled}
          onClick={() => onConfirm('resign')}
        >
          Resign
        </Button>
      </div>

      <Sheet
        open={waitingOnMe}
        onClose={() => void send('respond_draw', { accept: false }, match.id)}
        title={`${offeredByName} offers a draw`}
      >
        <p className="mb-5 text-center text-[16px]" style={{ color: 'var(--ink-dim)' }}>
          Call it a draw?
        </p>
        <div className="flex flex-col gap-3">
          <Button
            full
            disabled={disabled}
            onClick={() => void send('respond_draw', { accept: true }, match.id)}
          >
            Accept
          </Button>
          <Button
            full
            variant="ghost"
            disabled={disabled}
            onClick={() => void send('respond_draw', { accept: false }, match.id)}
          >
            Decline
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/** Section 11.2 screen 4: the live game, with the ⋯ menu on the right. */
export default function PhoneMatch({ match, send }: PhoneMatchProps) {
  const me = useSession((s) => s.players.find((p) => p.id === s.myPlayerId) ?? null);
  const players = useSession((s) => s.players);
  const tvOnline = useSession((s) => s.tvOnline);
  const lastCardPenalty = useSession((s) => s.household?.settings.lastCardPenalty ?? true);
  const moveHints = useSession((s) => s.household?.settings.moveHints ?? true);
  const myHand = useMatchStore((s) => s.myHand);

  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmKind>(null);

  const meta = getGame(match.game);
  const View = meta.PhoneView;
  const disabled = !tvOnline;
  const myIndex = me ? match.seats.indexOf(me.id) : -1;

  const body = (() => {
    if (match.game === 'tictactoe') {
      const state = match.state as TttState;
      return (
        <View
          state={state}
          myMark={myIndex === 0 ? 'X' : 'O'}
          myTurn={Boolean(me && state.turn === me.id)}
          disabled={disabled}
          onMove={(cell: number) => void send('move', { cell }, match.id)}
        />
      );
    }
    if (match.game === 'chess') {
      return (
        <>
          <View
            state={match.state as ChessState}
            players={players}
            myPlayerId={me?.id ?? ''}
            moveHints={moveHints}
            disabled={disabled}
            onMove={(from: string, to: string, promotion?: string) =>
              void send('move', { from, to, promotion }, match.id)
            }
          />
          {me ? (
            <ChessExtras
              match={match}
              players={players}
              me={me}
              disabled={disabled}
              send={send}
              onConfirm={setConfirm}
            />
          ) : null}
        </>
      );
    }
    return (
      <View
        state={match.state as CardsState}
        seats={match.seats}
        players={players}
        myPlayerId={me?.id ?? ''}
        hand={myHand}
        lastCardPenalty={lastCardPenalty}
        disabled={disabled}
        onPlay={(payload: { cardId: string; chosenColor?: CardColor; shout?: boolean }) =>
          void send('play', payload, match.id)
        }
        onDraw={() => void send('draw', {}, match.id)}
        onPass={() => void send('pass', {}, match.id)}
      />
    );
  })();

  return (
    <div className="cc-phone-root">
      <StatusBar player={me} tvOnline={tvOnline} />

      {!tvOnline ? (
        <div
          className="font-body flex shrink-0 items-center justify-center text-center"
          style={{
            background: 'rgba(255,77,77,.16)',
            color: 'var(--danger)',
            padding: '10px 16px',
            fontSize: 15,
          }}
        >
          Waiting for the TV…
        </div>
      ) : null}

      <div className="flex shrink-0 items-center justify-between px-4" style={{ paddingTop: 8, paddingBottom: 4 }}>
        <span className="font-display" style={{ fontSize: 19, color: 'var(--ink-dim)' }}>
          {meta.label}
        </span>
        <button
          type="button"
          aria-label="Match menu"
          onClick={() => setMenu(true)}
          className="flex items-center justify-center rounded-full"
          style={{ width: 48, height: 48, background: 'var(--bg-2)', border: '1px solid var(--line)' }}
        >
          <MoreVertical size={22} style={{ color: 'var(--ink)' }} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">{body}</div>

      <Sheet open={menu} onClose={() => setMenu(false)} title="Match">
        <div className="flex flex-col gap-3">
          {match.game === 'chess' ? (
            <>
              <Button
                full
                variant="secondary"
                disabled={disabled}
                onClick={() => {
                  setMenu(false);
                  void send('offer_draw', {}, match.id);
                }}
              >
                Offer draw
              </Button>
              <Button
                full
                variant="secondary"
                disabled={disabled}
                onClick={() => {
                  setMenu(false);
                  setConfirm('resign');
                }}
              >
                Resign
              </Button>
            </>
          ) : null}
          <Button
            full
            variant="danger"
            onClick={() => {
              setMenu(false);
              setConfirm('quit');
            }}
          >
            Quit match
          </Button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirm === 'quit'}
        danger
        title="Quit this match?"
        message="Nobody gets a win. The TV goes back to the menu."
        confirmLabel="Quit match"
        cancelLabel="Keep playing"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void send('quit_match', {}, match.id);
        }}
      />

      <ConfirmSheet
        open={confirm === 'resign'}
        title="Resign?"
        message={`${meta.label} is over and the other player wins.`}
        confirmLabel="Resign"
        cancelLabel="Keep playing"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          void send('resign', {}, match.id);
        }}
      />
    </div>
  );
}
