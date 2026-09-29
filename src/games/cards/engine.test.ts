import { describe, expect, it } from 'vitest';
import { cardsEngine, advance } from './engine';
import { isPlayable, makeDeck, sortHand } from './deck';
import type { Card, CardsSecrets, CardsState, EngineCtx, EngineResult } from '@/types/games';
import type { CommandType } from '@/types/db';
import { DEFAULT_SETTINGS } from '@/types/db';

const P1 = 'p1';
const P2 = 'p2';
const P3 = 'p3';
const P4 = 'p4';

/** Deterministic RNG so tests never flake. */
function seeded(seed = 1): () => number {
  let x = seed >>> 0;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
}

interface Fixture {
  ctx: EngineCtx<CardsState>;
  hands: Record<string, Card[]>;
  secrets: CardsSecrets;
}

function setup(seats: string[], seed = 7): Fixture {
  const { state, hands, secrets } = cardsEngine.createInitial(seats, seeded(seed));
  return {
    ctx: { seats, state, hands: hands!, secrets: secrets!, settings: DEFAULT_SETTINGS, nameOf: (id) => id.toUpperCase() },
    hands: hands!,
    secrets: secrets!,
  };
}

function run(f: Fixture, playerId: string, type: CommandType, payload: any = {}): EngineResult<CardsState> {
  const res = cardsEngine.applyCommand(f.ctx, { playerId, type, payload });
  if (res.ok) {
    const hands = { ...f.hands };
    for (const [id, cards] of Object.entries(res.hands ?? {})) hands[id] = cards;
    f.hands = hands;
    f.secrets = res.secrets ?? f.secrets;
    f.ctx = {
      ...f.ctx,
      state: res.state,
      hands: f.hands,
      secrets: f.secrets,
    };
  }
  return res;
}

/** Overwrite a hand with a controlled set of cards. */
function setHand(f: Fixture, playerId: string, cards: Card[]): void {
  f.hands[playerId] = cards;
  f.ctx = { ...f.ctx, hands: f.hands };
  f.ctx.state = {
    ...f.ctx.state,
    handCounts: { ...f.ctx.state.handCounts, [playerId]: cards.length },
  };
}

function card(id: string, kind: Card['kind'], color: Card['color'], value?: number): Card {
  return value === undefined ? { id, kind, color } : { id, kind, color, value };
}

describe('deck', () => {
  it('has 108 cards with the right per-colour counts', () => {
    const deck = makeDeck();
    expect(deck).toHaveLength(108);
    expect(new Set(deck.map((c) => c.id)).size).toBe(108);
    expect(deck[0].id).toBe('c001');
    expect(deck[107].id).toBe('c108');

    for (const color of ['red', 'yellow', 'green', 'blue'] as const) {
      const mine = deck.filter((c) => c.color === color);
      expect(mine).toHaveLength(25);
      expect(mine.filter((c) => c.kind === 'number' && c.value === 0)).toHaveLength(1);
      for (let v = 1; v <= 9; v++) {
        expect(mine.filter((c) => c.kind === 'number' && c.value === v)).toHaveLength(2);
      }
      for (const kind of ['skip', 'reverse', 'draw2'] as const) {
        expect(mine.filter((c) => c.kind === kind)).toHaveLength(2);
      }
    }
    expect(deck.filter((c) => c.kind === 'wild')).toHaveLength(4);
    expect(deck.filter((c) => c.kind === 'wild4')).toHaveLength(4);
    expect(deck.filter((c) => c.color === null)).toHaveLength(8);
  });

  it('sorts a hand by colour then number/kind', () => {
    const hand = [
      card('a', 'wild', null),
      card('b', 'number', 'blue', 3),
      card('c', 'skip', 'red'),
      card('d', 'number', 'red', 10 % 10),
      card('e', 'number', 'red', 1),
      card('f', 'wild4', null),
    ];
    // Red first, numbers before action cards, then blue, then the wild cards.
    expect(sortHand(hand).map((c) => c.id)).toEqual(['d', 'e', 'c', 'b', 'a', 'f']);
  });
});

describe('setup', () => {
  it('deals 7 cards to each seat and starts on a number card', () => {
    for (const seats of [[P1, P2], [P1, P2, P3], [P1, P2, P3, P4]]) {
      const { state, hands, secrets } = cardsEngine.createInitial(seats, seeded(3));
      for (const s of seats) expect(hands![s]).toHaveLength(7);
      expect(state.topCard.kind).toBe('number');
      expect(state.currentColor).toBe(state.topCard.color);
      expect(state.direction).toBe(1);
      expect(state.turnIndex).toBe(0);
      expect(state.drawCount).toBe(secrets!.drawPile.length);
      expect(state.discardCount).toBe(0);
      expect(state.pendingDraw).toBeNull();
      expect(state.handCounts[seats[0]]).toBe(7);

      // Every dealt card is unique across the table.
      const all = Object.values(hands!).flat().map((c) => c.id);
      expect(new Set(all).size).toBe(all.length);
      expect(all).not.toContain(state.topCard.id);
    }
  });
});

describe('isPlayable', () => {
  const top = card('top', 'number', 'red', 7);
  const wildTop = card('wtop', 'wild', null);

  it('wild is always playable', () => {
    expect(isPlayable(card('w', 'wild', null), wildTop, 'red', [])).toBe(true);
    expect(isPlayable(card('w', 'wild', null), top, 'red', [card('r', 'number', 'red', 1)])).toBe(true);
  });

  it('wild4 is only playable without a card of the current colour', () => {
    expect(isPlayable(card('w4', 'wild4', null), top, 'red', [card('b', 'number', 'blue', 1)])).toBe(true);
    expect(isPlayable(card('w4', 'wild4', null), top, 'red', [card('r', 'number', 'red', 1)])).toBe(false);
    // Other wild cards do not count.
    expect(
      isPlayable(card('w4', 'wild4', null), top, 'red', [card('w', 'wild', null), card('w4b', 'wild4', null)]),
    ).toBe(true);
  });

  it('matches on colour', () => {
    expect(isPlayable(card('r', 'number', 'red', 1), top, 'red', [])).toBe(true);
    expect(isPlayable(card('b', 'number', 'blue', 1), top, 'red', [])).toBe(false);
  });

  it('matches action cards on kind', () => {
    const skipTop = card('st', 'skip', 'blue');
    expect(isPlayable(card('s', 'skip', 'red'), skipTop, 'green', [])).toBe(true);
    expect(isPlayable(card('d2', 'draw2', 'red'), skipTop, 'green', [])).toBe(false);
    expect(isPlayable(card('d2', 'draw2', 'green'), skipTop, 'green', [])).toBe(true); // colour match
  });

  it('matches number cards on value against a number top card', () => {
    expect(isPlayable(card('n', 'number', 'blue', 7), top, 'green', [])).toBe(true);
    expect(isPlayable(card('n', 'number', 'blue', 8), top, 'green', [])).toBe(false);
    // Against a non-number top card the value does not match.
    expect(isPlayable(card('n', 'number', 'blue', 0), wildTop, 'green', [])).toBe(false);
  });
});

describe('advance', () => {
  it('wraps in both directions for 2, 3 and 4 seats', () => {
    expect(advance(0, 1, 1, 2)).toBe(1);
    expect(advance(1, 1, 1, 2)).toBe(0);
    expect(advance(0, -1, 1, 2)).toBe(1);
    expect(advance(2, 1, 1, 3)).toBe(0);
    expect(advance(0, -1, 1, 3)).toBe(2);
    expect(advance(3, 1, 2, 4)).toBe(1);
    expect(advance(0, -1, 2, 4)).toBe(2);
  });
});

describe('play', () => {
  it('rejects out of turn, foreign cards and unplayable cards in the documented order', () => {
    const f = setup([P1, P2]);
    expect(run(f, P2, 'play', { cardId: f.hands[P1][0].id })).toEqual({ ok: false, reason: 'not_your_turn' });
    expect(run(f, P1, 'play', { cardId: 'nope' })).toEqual({ ok: false, reason: 'bad_request' });

    setHand(f, P1, [card('blue1', 'number', 'blue', 1)]);
    expect(run(f, P1, 'play', { cardId: 'blue1' })).toEqual({ ok: false, reason: 'card_not_playable' });
  });

  it('rejects wild4 with wild4_not_allowed when the colour is held', () => {
    const f = setup([P1, P2]);
    setHand(f, P1, [card('w4', 'wild4', null), card('r1', 'number', 'red', 1)]);
    f.ctx.state = { ...f.ctx.state, currentColor: 'red', topCard: card('t', 'number', 'red', 3) };
    expect(run(f, P1, 'play', { cardId: 'w4', chosenColor: 'blue' })).toEqual({
      ok: false,
      reason: 'wild4_not_allowed',
    });
  });

  it('requires a colour for wild cards', () => {
    const f = setup([P1, P2]);
    setHand(f, P1, [card('w', 'wild', null)]);
    expect(run(f, P1, 'play', { cardId: 'w' })).toEqual({ ok: false, reason: 'color_required' });
    expect(run(f, P1, 'play', { cardId: 'w', chosenColor: 'purple' })).toEqual({ ok: false, reason: 'color_required' });
  });

  it('plays a matching card, updates the colour and advances the turn', () => {
    const f = setup([P1, P2]);
    setHand(f, P1, [card('b7', 'number', 'blue', 7), card('g2', 'number', 'green', 2), card('r3', 'number', 'red', 3)]);
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'red', 7), currentColor: 'red' };
    const res = run(f, P1, 'play', { cardId: 'b7' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.status).toBe('active');
    expect(res.state.topCard.id).toBe('b7');
    expect(res.state.currentColor).toBe('blue');
    expect(res.state.turnIndex).toBe(1);
    expect(res.state.handCounts[P1]).toBe(2);
    expect(res.state.discardCount).toBe(1);
    expect(res.hands?.[P1]).toHaveLength(2);
    expect(res.secrets?.discardPile).toHaveLength(1);
    expect(res.state.log[res.state.log.length - 1]).toBe('P1 played 7.');
  });

  it('a wild card sets the chosen colour and keeps the card colourless', () => {
    const f = setup([P1, P2]);
    setHand(f, P1, [card('w', 'wild', null)]);
    const res = run(f, P1, 'play', { cardId: 'w', chosenColor: 'green' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.currentColor).toBe('green');
    expect(res.state.topCard.color).toBeNull();
    expect(res.state.topCard.kind).toBe('wild');
  });

  it('skip makes the next player lose a turn', () => {
    const f = setup([P1, P2, P3]);
    setHand(f, P1, [card('s', 'skip', 'red'), card('k', 'number', 'red', 4)]);
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'red', 1), currentColor: 'red' };
    const res = run(f, P1, 'play', { cardId: 's' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.turnIndex).toBe(2);
    expect(res.state.lastAction?.victimId).toBe(P2);
  });

  it('reverse acts as a skip with two players', () => {
    const f = setup([P1, P2]);
    setHand(f, P1, [card('r', 'reverse', 'red'), card('k', 'number', 'red', 4)]);
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'red', 1), currentColor: 'red' };
    const res = run(f, P1, 'play', { cardId: 'r' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.direction).toBe(1);
    expect(res.state.turnIndex).toBe(0);
  });

  it('reverse flips the direction with three or four players', () => {
    for (const seats of [[P1, P2, P3], [P1, P2, P3, P4]]) {
      const f = setup(seats);
      setHand(f, P1, [card('r', 'reverse', 'red'), card('k', 'number', 'red', 4)]);
      f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'red', 1), currentColor: 'red' };
      const res = run(f, P1, 'play', { cardId: 'r' });
      expect(res.ok).toBe(true);
      if (!res.ok) continue;
      expect(res.state.direction).toBe(-1);
      expect(res.state.turnIndex).toBe(seats.length - 1);
    }
  });

  it('draw2 makes the next player draw two and is not stacked', () => {
    const f = setup([P1, P2]);
    setHand(f, P1, [card('d2', 'draw2', 'red'), card('x', 'number', 'red', 1), card('w', 'number', 'red', 8)]);
    setHand(f, P2, [card('y', 'number', 'blue', 2), card('z', 'number', 'blue', 3)]);
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'red', 1), currentColor: 'red' };
    const res = run(f, P1, 'play', { cardId: 'd2' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.turnIndex).toBe(0);
    expect(res.state.handCounts[P2]).toBe(4);
    expect(res.hands?.[P2]).toHaveLength(4);
    expect(res.state.lastAction?.penalty).toBeUndefined();
  });

  it('wild4 makes the next player draw four', () => {
    const f = setup([P1, P2]);
    setHand(f, P1, [card('w4', 'wild4', null), card('k', 'number', 'blue', 1)]);
    setHand(f, P2, [card('y', 'number', 'blue', 2)]);
    const res = run(f, P1, 'play', { cardId: 'w4', chosenColor: 'yellow' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.handCounts[P2]).toBe(5);
    expect(res.state.turnIndex).toBe(0);
  });

  it('applies the last-card penalty when the shout is missing', () => {
    const f = setup([P1, P2]);
    setHand(f, P1, [card('a', 'number', 'red', 1), card('b', 'number', 'red', 2)]);
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'red', 5), currentColor: 'red' };
    const res = run(f, P1, 'play', { cardId: 'a' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.handCounts[P1]).toBe(3);
    expect(res.state.lastAction?.penalty).toBe(2);
    expect(res.state.log[res.state.log.length - 1]).toContain('forgot to shout');
  });

  it('keeps the last card when the player shouts', () => {
    const f = setup([P1, P2]);
    setHand(f, P1, [card('a', 'number', 'red', 1), card('b', 'number', 'red', 2)]);
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'red', 5), currentColor: 'red' };
    const res = run(f, P1, 'play', { cardId: 'a', shout: true });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.handCounts[P1]).toBe(1);
    expect(res.state.lastAction?.penalty).toBeUndefined();
    expect(res.state.log[res.state.log.length - 1]).toContain('shouted LAST CARD');
  });

  it('does not apply the last-card penalty when the setting is off', () => {
    const f = setup([P1, P2]);
    f.ctx.settings = { ...DEFAULT_SETTINGS, lastCardPenalty: false };
    setHand(f, P1, [card('a', 'number', 'red', 1), card('b', 'number', 'red', 2)]);
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'red', 5), currentColor: 'red' };
    const res = run(f, P1, 'play', { cardId: 'a' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.handCounts[P1]).toBe(1);
  });

  it('wins when the hand is emptied, after applying the played card effect', () => {
    const f = setup([P1, P2]);
    setHand(f, P1, [card('last', 'number', 'red', 9)]);
    setHand(f, P2, [card('y', 'number', 'blue', 2)]);
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'red', 5), currentColor: 'red' };
    const res = run(f, P1, 'play', { cardId: 'last' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.status).toBe('finished');
    expect(res.result).toBe('emptied_hand');
    expect(res.winnerId).toBe(P1);
  });

  it('a winning draw2 still makes the loser draw two', () => {
    const f = setup([P1, P2]);
    setHand(f, P1, [card('last', 'draw2', 'red')]);
    setHand(f, P2, [card('y', 'number', 'blue', 2)]);
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'red', 5), currentColor: 'red' };
    const res = run(f, P1, 'play', { cardId: 'last' });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.status).toBe('finished');
    expect(res.winnerId).toBe(P1);
    expect(res.state.handCounts[P2]).toBe(3);
  });
});

describe('draw and pass', () => {
  it('draws a card and, when playable, keeps the turn and sets pendingDraw', () => {
    const f = setup([P1, P2]);
    // The whole draw pile is one playable card, so the result is deterministic.
    const playable = card('good', 'number', 'blue', 9);
    f.secrets = { drawPile: [playable], discardPile: [] };
    f.ctx = { ...f.ctx, secrets: f.secrets };
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'blue', 9), currentColor: 'blue' };

    const res = run(f, P1, 'draw');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.pendingDraw).toEqual({ playerId: P1, cardId: 'good' });
    expect(res.state.turnIndex).toBe(0);
    expect(res.hands?.[P1]?.some((c) => c.id === 'good')).toBe(true);
  });

  it('advances automatically when the drawn card is not playable', () => {
    const f = setup([P1, P2]);
    f.secrets = { drawPile: [card('bad', 'number', 'green', 1)], discardPile: [] };
    f.ctx = { ...f.ctx, secrets: f.secrets };
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'blue', 9), currentColor: 'blue' };

    const res = run(f, P1, 'draw');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.pendingDraw).toBeNull();
    expect(res.state.turnIndex).toBe(1);
  });

  it('rejects a second draw in the same turn with already_drawn', () => {
    const f = setup([P1, P2]);
    f.secrets = {
      drawPile: [card('a', 'number', 'blue', 9), card('b', 'number', 'blue', 4)],
      discardPile: [],
    };
    f.ctx = { ...f.ctx, secrets: f.secrets };
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'blue', 9), currentColor: 'blue' };
    expect(run(f, P1, 'draw').ok).toBe(true);
    expect(run(f, P1, 'draw')).toEqual({ ok: false, reason: 'already_drawn' });
  });

  it('rejects a draw out of turn', () => {
    const f = setup([P1, P2]);
    expect(run(f, P2, 'draw')).toEqual({ ok: false, reason: 'not_your_turn' });
  });

  it('pass clears pendingDraw and advances the turn', () => {
    const f = setup([P1, P2]);
    f.secrets = { drawPile: [card('a', 'number', 'blue', 9)], discardPile: [] };
    f.ctx = { ...f.ctx, secrets: f.secrets };
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'blue', 9), currentColor: 'blue' };
    expect(run(f, P1, 'draw').ok).toBe(true);
    const res = run(f, P1, 'pass');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.state.pendingDraw).toBeNull();
    expect(res.state.turnIndex).toBe(1);
  });

  it('rejects pass without a pending draw', () => {
    const f = setup([P1, P2]);
    expect(run(f, P1, 'pass')).toEqual({ ok: false, reason: 'cannot_pass' });
  });

  it('requires the drawn card to be played while pendingDraw is set', () => {
    const f = setup([P1, P2]);
    setHand(f, P1, [card('keep', 'number', 'blue', 3)]);
    f.secrets = { drawPile: [card('a', 'number', 'blue', 9)], discardPile: [] };
    f.ctx = { ...f.ctx, secrets: f.secrets };
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'blue', 9), currentColor: 'blue' };
    expect(run(f, P1, 'draw').ok).toBe(true);
    expect(run(f, P1, 'play', { cardId: 'keep' })).toEqual({ ok: false, reason: 'must_play_drawn' });
    expect(run(f, P1, 'play', { cardId: 'a' }).ok).toBe(true);
  });
});

describe('reshuffling', () => {
  it('recycles the discard pile when the draw pile is empty', () => {
    const f = setup([P1, P2]);
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'blue', 9), currentColor: 'blue' };
    // Everything except the top card is in the discard pile.
    const discard: Card[] = Array.from({ length: 20 }, (_, i) => card(`d${i}`, 'number', 'blue', (i % 9) + 1));
    f.secrets = { drawPile: [], discardPile: discard };
    f.ctx = { ...f.ctx, secrets: f.secrets };
    f.ctx.state = { ...f.ctx.state, drawCount: 0, discardCount: 20 };

    const res = run(f, P1, 'draw');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.secrets?.drawPile.length).toBeGreaterThan(0);
    expect(res.secrets?.discardPile).toHaveLength(0);
    expect(res.state.drawCount).toBe(res.secrets?.drawPile.length);
  });

  it('gives as many cards as exist when the whole table runs out', () => {
    const f = setup([P1, P2]);
    f.secrets = { drawPile: [card('only', 'number', 'green', 3)], discardPile: [] };
    f.ctx = { ...f.ctx, secrets: f.secrets };
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'blue', 9), currentColor: 'blue' };
    const res = run(f, P1, 'draw');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.secrets?.drawPile).toHaveLength(0);
  });
});

describe('misc', () => {
  it('rejects a non-seat player', () => {
    const f = setup([P1, P2]);
    expect(run(f, 'stranger', 'draw')).toEqual({ ok: false, reason: 'not_a_seat' });
  });

  it('rejects command types that do not belong to the game', () => {
    const f = setup([P1, P2]);
    const types: CommandType[] = ['move', 'resign', 'offer_draw', 'start_match'];
    for (const type of types) {
      expect(run(f, P1, type)).toEqual({ ok: false, reason: 'bad_request' });
    }
  });

  it('keeps at most 12 log lines', () => {
    const f = setup([P1, P2]);
    f.secrets = {
      drawPile: Array.from({ length: 40 }, (_, i) => card(`x${i}`, 'number', 'green', (i % 9) + 1)),
      discardPile: [],
    };
    f.ctx = { ...f.ctx, secrets: f.secrets };
    f.ctx.state = { ...f.ctx.state, topCard: card('t', 'number', 'blue', 9), currentColor: 'blue' };

    for (let i = 0; i < 20; i++) {
      f.ctx.state = { ...f.ctx.state, turnIndex: 0, pendingDraw: null, log: [...f.ctx.state.log, `line ${i}`] };
      const res = run(f, P1, 'draw');
      expect(res.ok).toBe(true);
    }
    expect(f.ctx.state.log.length).toBeLessThanOrEqual(12);
  });
});
