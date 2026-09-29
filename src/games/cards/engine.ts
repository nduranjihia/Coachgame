import { shuffle } from '@/lib/rng';
import type {
  Card,
  CardColor,
  CardsSecrets,
  CardsState,
  EngineApi,
  EngineCtx,
  EngineResult,
  Rng,
} from '@/types/games';
import { COLOR_NAME, cardLabel, isCardColor, isPlayable, makeDeck } from './deck';

const HAND_SIZE = 7;
const LOG_LIMIT = 12;

/** Advance `n` seats in `direction`, wrapping around any table size. */
export function advance(turnIndex: number, direction: 1 | -1, n: number, len: number): number {
  if (len <= 0) return 0;
  return ((turnIndex + direction * n) % len + len) % len;
}

function createInitial(seats: string[], rng: Rng = Math.random): {
  state: CardsState;
  hands: Record<string, Card[]>;
  secrets: CardsSecrets;
} {
  const deck = shuffle(makeDeck(), rng);
  const drawPile: Card[] = deck;
  const hands: Record<string, Card[]> = {};
  for (const seat of seats) hands[seat] = [];

  for (let round = 0; round < HAND_SIZE; round++) {
    for (const seat of seats) {
      const card = drawPile.pop();
      if (!card) throw new Error('Deck exhausted while dealing');
      hands[seat].push(card);
    }
  }

  // Flip cards from the draw pile until a number card shows up. The action cards
  // flipped on the way go back into the draw pile, which is then reshuffled once.
  const flipped: Card[] = [];
  let topCard: Card | null = null;
  for (;;) {
    const card = drawPile.pop();
    if (!card) throw new Error('Deck exhausted while looking for the first card');
    if (card.kind === 'number') {
      topCard = card;
      break;
    }
    flipped.push(card);
  }
  const reshuffled = shuffle([...drawPile, ...flipped], rng);
  drawPile.length = 0;
  drawPile.push(...reshuffled);

  const handCounts: Record<string, number> = {};
  for (const seat of seats) handCounts[seat] = hands[seat].length;

  const state: CardsState = {
    topCard: topCard as Card,
    currentColor: topCard!.color as CardColor,
    direction: 1,
    turnIndex: 0,
    handCounts,
    drawCount: drawPile.length,
    discardCount: 0,
    pendingDraw: null,
    lastAction: null,
    log: [],
  };

  return { state, hands, secrets: { drawPile, discardPile: [] } };
}

interface Work {
  hands: Record<string, Card[]>;
  changed: Set<string>;
  drawPile: Card[];
  discardPile: Card[];
}

function makeWork(ctx: EngineCtx<CardsState>, seats: string[]): Work {
  const hands: Record<string, Card[]> = {};
  for (const seat of seats) hands[seat] = (ctx.hands?.[seat] ?? []).slice();
  return {
    hands,
    changed: new Set<string>(),
    drawPile: (ctx.secrets?.drawPile ?? []).slice(),
    discardPile: (ctx.secrets?.discardPile ?? []).slice(),
  };
}

/** Shuffle the discard pile back into the draw pile when the draw pile runs dry. */
function refill(work: Work, rng: Rng): void {
  if (work.drawPile.length > 0) return;
  if (work.discardPile.length === 0) return;
  const moved = work.discardPile.splice(0, work.discardPile.length);
  work.drawPile.push(...shuffle(moved, rng));
}

function takeCards(work: Work, count: number, rng: Rng): Card[] {
  const out: Card[] = [];
  for (let i = 0; i < count; i++) {
    refill(work, rng);
    const card = work.drawPile.pop();
    if (!card) break; // the pile is genuinely empty
    out.push(card);
  }
  return out;
}

/** Append a line to the log, keeping only the last 12 entries. */
function makeSay(log: string[]): (line: string) => void {
  return (line: string) => {
    log.push(line);
    if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT);
  };
}

function handCountsOf(hands: Record<string, Card[]>, seats: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const seat of seats) out[seat] = hands[seat]?.length ?? 0;
  return out;
}

function changedHands(work: Work, seats: string[]): Record<string, Card[]> {
  const out: Record<string, Card[]> = {};
  for (const seat of seats) {
    if (work.changed.has(seat)) out[seat] = work.hands[seat].map((c) => ({ ...c }));
  }
  return out;
}

function applyCommand(
  ctx: EngineCtx<CardsState>,
  cmd: { playerId: string; type: string; payload: any },
  rng: Rng = Math.random,
): EngineResult<CardsState> {
  const { seats, state, settings } = ctx;
  if (!seats.includes(cmd.playerId)) return { ok: false, reason: 'not_a_seat' };
  const len = seats.length;
  if (len < 2) return { ok: false, reason: 'bad_request' };
  if (seats[state.turnIndex] !== cmd.playerId) return { ok: false, reason: 'not_your_turn' };

  const name = ctx.nameOf ?? ((id: string) => id);
  const work = makeWork(ctx, seats);
  const hand = work.hands[cmd.playerId];
  const me = name(cmd.playerId);

  const log: string[] = [...state.log];
  const say = makeSay(log);

  /* ------------------------------------------------------------------ play */
  if (cmd.type === 'play') {
    const cardId = cmd.payload?.cardId;
    if (typeof cardId !== 'string') return { ok: false, reason: 'bad_request' };
    if (state.pendingDraw && state.pendingDraw.cardId !== cardId) {
      return { ok: false, reason: 'must_play_drawn' };
    }
    const index = hand.findIndex((c) => c.id === cardId);
    if (index === -1) return { ok: false, reason: 'bad_request' };
    const card = hand[index];

    if (!isPlayable(card, state.topCard, state.currentColor, hand)) {
      return { ok: false, reason: card.kind === 'wild4' ? 'wild4_not_allowed' : 'card_not_playable' };
    }

    const isWild = card.kind === 'wild' || card.kind === 'wild4';
    const chosenColor = cmd.payload?.chosenColor;
    if (isWild && !isCardColor(chosenColor)) return { ok: false, reason: 'color_required' };
    if (!isWild && chosenColor !== undefined && !isCardColor(chosenColor)) {
      return { ok: false, reason: 'bad_request' };
    }

    const shout = cmd.payload?.shout === true;
    const newColor: CardColor = isWild ? (chosenColor as CardColor) : (card.color as CardColor);

    hand.splice(index, 1);
    work.changed.add(cmd.playerId);
    work.discardPile.push({ ...state.topCard });
    const topCard: Card = isWild ? { ...card, color: null } : { ...card };

    let direction: 1 | -1 = state.direction;
    let turnIndex = state.turnIndex;
    let victimId: string | undefined;
    let penalty: number | undefined;

    const nextSeat = advance(turnIndex, direction, 1, len);
    let advanceBy = 1;

    if (card.kind === 'skip') {
      advanceBy = 2;
      victimId = seats[nextSeat];
      say(`${me} played Skip — ${name(victimId)} loses a turn!`);
    } else if (card.kind === 'reverse') {
      if (len === 2) {
        advanceBy = 2;
        victimId = seats[nextSeat];
        say(`${me} played Reverse — ${name(victimId)} loses a turn!`);
      } else {
        direction = direction === 1 ? -1 : 1;
        advanceBy = 1;
        say(`${me} reversed the direction!`);
      }
    } else if (card.kind === 'draw2') {
      victimId = seats[nextSeat];
      const drawn = takeCards(work, 2, rng);
      if (drawn.length) {
        work.hands[victimId].push(...drawn);
        work.changed.add(victimId);
      }
      advanceBy = 2;
      say(`${me} played Draw Two — ${name(victimId)} draws ${drawn.length}.`);
    } else if (card.kind === 'wild4') {
      victimId = seats[nextSeat];
      const drawn = takeCards(work, 4, rng);
      if (drawn.length) {
        work.hands[victimId].push(...drawn);
        work.changed.add(victimId);
      }
      advanceBy = 2;
      say(`${me} played Wild Draw Four — ${name(victimId)} draws ${drawn.length}!`);
    } else if (card.kind === 'wild') {
      say(`${me} played Wild — colour ${COLOR_NAME[newColor]}.`);
    } else {
      say(`${me} played ${cardLabel(card)}.`);
    }

    // Last-card rule.
    if (hand.length === 1 && settings.lastCardPenalty) {
      if (shout) {
        say(`${me} shouted LAST CARD!`);
      } else {
        const drawn = takeCards(work, 2, rng);
        if (drawn.length) {
          work.hands[cmd.playerId].push(...drawn);
          work.changed.add(cmd.playerId);
        }
        penalty = 2;
        say(`${me} forgot to shout LAST CARD and draws 2.`);
      }
    }

    const emptied = hand.length === 0;
    if (!emptied) {
      turnIndex = advance(turnIndex, direction, advanceBy, len);
    }

    const nextState: CardsState = {
      topCard,
      currentColor: newColor,
      direction,
      turnIndex,
      handCounts: handCountsOf(work.hands, seats),
      drawCount: work.drawPile.length,
      discardCount: work.discardPile.length,
      pendingDraw: null,
      lastAction: {
        playerId: cmd.playerId,
        type: 'play',
        card: { ...card },
        chosenColor: isWild ? newColor : undefined,
        victimId,
        penalty,
        shout: shout || undefined,
      },
      log,
    };

    return {
      ok: true,
      state: nextState,
      status: emptied ? 'finished' : 'active',
      winnerId: emptied ? cmd.playerId : null,
      result: emptied ? 'emptied_hand' : null,
      hands: changedHands(work, seats),
      secrets: { drawPile: work.drawPile, discardPile: work.discardPile },
    };
  }

  /* ----------------------------------------------------------------- draw */
  if (cmd.type === 'draw') {
    if (state.pendingDraw) return { ok: false, reason: 'already_drawn' };
    const drawn = takeCards(work, 1, rng);
    if (drawn.length === 0) return { ok: false, reason: 'bad_request' };
    const card = drawn[0];
    hand.push(card);
    work.changed.add(cmd.playerId);

    const playable = isPlayable(card, state.topCard, state.currentColor, hand);
    const turnIndex = playable ? state.turnIndex : advance(state.turnIndex, state.direction, 1, len);
    say(playable ? `${me} drew a playable card.` : `${me} drew a card.`);

    const nextState: CardsState = {
      ...state,
      turnIndex,
      handCounts: handCountsOf(work.hands, seats),
      drawCount: work.drawPile.length,
      discardCount: work.discardPile.length,
      pendingDraw: playable ? { playerId: cmd.playerId, cardId: card.id } : null,
      lastAction: { playerId: cmd.playerId, type: 'draw', card: { ...card } },
      log,
    };

    return {
      ok: true,
      state: nextState,
      status: 'active',
      winnerId: null,
      result: null,
      hands: changedHands(work, seats),
      secrets: { drawPile: work.drawPile, discardPile: work.discardPile },
    };
  }

  /* ----------------------------------------------------------------- pass */
  if (cmd.type === 'pass') {
    if (!state.pendingDraw || state.pendingDraw.playerId !== cmd.playerId) {
      return { ok: false, reason: 'cannot_pass' };
    }
    say(`${me} passed.`);
    const nextState: CardsState = {
      ...state,
      turnIndex: advance(state.turnIndex, state.direction, 1, len),
      pendingDraw: null,
      lastAction: { playerId: cmd.playerId, type: 'pass' },
      log,
    };
    return {
      ok: true,
      state: nextState,
      status: 'active',
      winnerId: null,
      result: null,
      hands: changedHands(work, seats),
      secrets: { drawPile: work.drawPile, discardPile: work.discardPile },
    };
  }

  return { ok: false, reason: 'bad_request' };
}

export const cardsEngine: EngineApi<CardsState> = { createInitial, applyCommand };

export { cardLabel, COLOR_NAME, COLOR_HEX, sortHand, makeDeck, isCardColor } from './deck';
export default cardsEngine;
