import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import Avatar from '@/components/Avatar';
import Button from '@/components/Button';
import type { Player } from '@/types/db';
import type { Card, CardsState, CardColor } from '@/types/games';
import CardView from './CardView';
import ColorSheet from './ColorSheet';
import { COLOR_HEX, COLOR_NAME, isCardColor, isPlayable, sortHand } from './deck';

export interface PhoneHandProps {
  state: CardsState;
  seats: string[];
  players: Player[];
  myPlayerId: string;
  hand: Card[];
  lastCardPenalty: boolean;
  /** True when the TV is offline or the match is over - disables every control. */
  disabled: boolean;
  onPlay: (payload: { cardId: string; chosenColor?: CardColor; shout?: boolean }) => void;
  onDraw: () => void;
  onPass: () => void;
}

const CARD_W = 'max(22vw, 84px)';

function StatusRow({
  state,
  seats,
  players,
  myPlayerId,
  topWidth,
}: {
  state: CardsState;
  seats: string[];
  players: Player[];
  myPlayerId: string;
  topWidth: string;
}) {
  const others = seats.filter((s) => s !== myPlayerId);
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-1.5 rounded-2xl px-2 py-1.5"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
      >
        <div style={{ width: topWidth }}>
          <CardView card={state.topCard} width={topWidth} />
        </div>
        <span
          className="block rounded-full"
          style={{ width: 14, height: 14, background: COLOR_HEX[state.currentColor], boxShadow: '0 0 0 2px rgba(0,0,0,.3)' }}
          aria-label={`Colour ${COLOR_NAME[state.currentColor]}`}
        />
      </div>

      <div
        className="font-display rounded-2xl px-2 py-1.5"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', fontSize: 15 }}
      >
        {state.drawCount}
      </div>

      <div className="flex flex-1 items-center justify-end gap-1.5">
        {others.map((id) => {
          const player = players.find((p) => p.id === id);
          if (!player) return null;
          return (
            <div key={id} className="flex flex-col items-center">
              <Avatar emoji={player.emoji} color={player.color} size={26} online={false} />
              <span className="font-display" style={{ fontSize: 12 }}>
                {state.handCounts[id] ?? 0}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Section 11.5 phone view: status row, banner, hand and the three actions. */
export default function PhoneHand({
  state,
  seats,
  players,
  myPlayerId,
  hand,
  lastCardPenalty,
  disabled,
  onPlay,
  onDraw,
  onPass,
}: PhoneHandProps) {
  const sorted = useMemo(() => sortHand(hand), [hand]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [colorFor, setColorFor] = useState<Card | null>(null);
  const [shout, setShout] = useState(false);

  const myTurn = seats[state.turnIndex] === myPlayerId && !disabled;
  const pending = state.pendingDraw;
  const pendingMine = pending?.playerId === myPlayerId;

  const playable = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const c of sorted) map[c.id] = isPlayable(c, state.topCard, state.currentColor, hand);
    return map;
  }, [hand, sorted, state.currentColor, state.topCard]);

  // A selection that is no longer valid (played, redrawn, turn over) is dropped.
  useEffect(() => {
    if (selectedId && !hand.some((c) => c.id === selectedId)) setSelectedId(null);
  }, [hand, selectedId]);

  // The drawn card is highlighted and auto-selected.
  useEffect(() => {
    if (pendingMine && pending) setSelectedId(pending.cardId);
  }, [pending, pendingMine]);

  useEffect(() => {
    if (!myTurn) setSelectedId(null);
  }, [myTurn]);

  const selected = hand.find((c) => c.id === selectedId) ?? null;
  const isWild = selected?.kind === 'wild' || selected?.kind === 'wild4';
  const canPlay = Boolean(selected) && myTurn && (playable[selectedId ?? ''] ?? false);

  const doPlay = (card: Card, chosenColor?: CardColor): void => {
    onPlay({ cardId: card.id, chosenColor, shout: shout ? true : undefined });
    setSelectedId(null);
    setShout(false);
  };

  const handlePlay = (): void => {
    if (!selected) return;
    if (isWild) {
      setColorFor(selected);
      return;
    }
    doPlay(selected);
  };

  const turnPlayer = players.find((p) => p.id === seats[state.turnIndex]);
  const showLastCardToggle = lastCardPenalty && hand.length === 2;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-3 pt-2">
        <StatusRow state={state} seats={seats} players={players} myPlayerId={myPlayerId} topWidth="34px" />
      </div>

      <div className="px-3 pt-3">
        <div
          className="font-display rounded-3xl py-2.5 text-center"
          style={{
            fontSize: 20,
            background: myTurn ? 'var(--sun)' : 'var(--bg-2)',
            color: myTurn ? 'var(--bg-0)' : 'var(--ink-dim)',
            border: '1px solid var(--line)',
          }}
        >
          {myTurn ? 'Your turn!' : `${turnPlayer?.name ?? 'They'}'s turn`}
        </div>
      </div>

      <div className="cc-scroll-x flex min-h-0 flex-1 items-center px-3 pt-3" style={{ overflowY: 'hidden' }}>
        {sorted.length === 0 ? (
          <p className="font-body px-2" style={{ fontSize: 14, color: 'var(--ink-dim)' }}>
            No cards left — nice one!
          </p>
        ) : (
          sorted.map((card) => {
            const isSelected = card.id === selectedId;
            const isDrawn = pending?.cardId === card.id;
            const dim = !playable[card.id];
            return (
              <motion.button
                key={card.id}
                type="button"
                disabled={!myTurn || dim}
                onClick={() => setSelectedId(isSelected ? null : card.id)}
                className="shrink-0"
                style={{ marginRight: 8, opacity: dim ? 0.4 : 1, cursor: myTurn && !dim ? 'pointer' : 'default' }}
                animate={{ y: isSelected ? -24 : 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                aria-pressed={isSelected}
                aria-label={card.kind === 'number' ? String(card.value) : card.kind}
              >
                <div style={{ position: 'relative', width: CARD_W }}>
                  <div style={{ width: CARD_W }}>
                    <CardView card={card} width={CARD_W} />
                  </div>
                  {isDrawn ? (
                    <span
                      className="font-body absolute -top-1 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5"
                      style={{ background: 'var(--mint)', color: '#14101F', fontSize: 10, fontWeight: 700 }}
                    >
                      DRAWN
                    </span>
                  ) : null}
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 pb-3 pt-3" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
        <Button
          full
          variant="secondary"
          disabled={!myTurn || pendingMine}
          onClick={onDraw}
        >
          DRAW
        </Button>
        <Button full variant="primary" disabled={!canPlay} onClick={handlePlay}>
          PLAY
        </Button>
        {pendingMine ? (
          <Button full variant="ghost" onClick={onPass}>
            PASS
          </Button>
        ) : null}
        {showLastCardToggle && myTurn ? (
          <Button
            full
            variant={shout ? 'primary' : 'ghost'}
            onClick={() => setShout((s) => !s)}
          >
            {shout ? 'LAST CARD! ✓' : 'LAST CARD!'}
          </Button>
        ) : null}
      </div>

      <ColorSheet
        open={Boolean(colorFor)}
        onCancel={() => setColorFor(null)}
        onPick={(c) => {
          if (colorFor && isCardColor(c)) doPlay(colorFor, c);
          setColorFor(null);
        }}
      />
    </div>
  );
}
