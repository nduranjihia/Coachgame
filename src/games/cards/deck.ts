import type { Card, CardColor, CardKind } from '@/types/games';

export const CARD_COLORS: CardColor[] = ['red', 'yellow', 'green', 'blue'];

export const COLOR_NAME: Record<CardColor, string> = {
  red: 'Red',
  yellow: 'Yellow',
  green: 'Green',
  blue: 'Blue',
};

export const COLOR_HEX: Record<CardColor, string> = {
  red: '#FF5A5F',
  yellow: '#FFC83D',
  green: '#34D399',
  blue: '#4DA3FF',
};

export const ACTION_KINDS: CardKind[] = ['skip', 'reverse', 'draw2'];

/** Build the standard 108-card deck with ids `c001` … `c108`. */
export function makeDeck(): Card[] {
  const cards: Card[] = [];
  let n = 0;
  const push = (kind: CardKind, color: CardColor | null, value?: number): void => {
    n += 1;
    cards.push({ id: `c${String(n).padStart(3, '0')}`, kind, color, value });
  };

  for (const color of CARD_COLORS) {
    push('number', color, 0);
    for (let v = 1; v <= 9; v++) {
      push('number', color, v);
      push('number', color, v);
    }
    for (const kind of ACTION_KINDS) {
      push(kind, color);
      push(kind, color);
    }
  }
  for (let i = 0; i < 4; i++) push('wild', null);
  for (let i = 0; i < 4; i++) push('wild4', null);

  return cards;
}

export function isCardColor(value: unknown): value is CardColor {
  return value === 'red' || value === 'yellow' || value === 'green' || value === 'blue';
}

const KIND_ORDER: Record<CardKind, number> = {
  number: 0,
  skip: 1,
  reverse: 2,
  draw2: 3,
  wild: 4,
  wild4: 5,
};

/**
 * A card can be played when it matches the current colour, or - for action and
 * number cards - the kind/number of the top card. Wild is always playable, and
 * Wild Draw Four only when the hand holds no card of the current colour.
 */
export function isPlayable(card: Card, top: Card, currentColor: CardColor, hand: Card[]): boolean {
  if (card.kind === 'wild') return true;
  if (card.kind === 'wild4') return !hand.some((c) => c.color === currentColor);
  if (card.color === currentColor) return true;
  if (ACTION_KINDS.includes(card.kind) && card.kind === top.kind) return true;
  if (card.kind === 'number' && top.kind === 'number' && card.value === top.value) return true;
  return false;
}

/** Hand order for the phone: red, yellow, green, blue, wild - then number / kind. */
export function sortHand(hand: Card[]): Card[] {
  const colorRank = (c: Card): number => (c.color === null ? 4 : CARD_COLORS.indexOf(c.color));
  return hand.slice().sort((a, b) => {
    const ca = colorRank(a);
    const cb = colorRank(b);
    if (ca !== cb) return ca - cb;
    const ka = KIND_ORDER[a.kind];
    const kb = KIND_ORDER[b.kind];
    if (ka !== kb) return ka - kb;
    return (a.value ?? -1) - (b.value ?? -1);
  });
}

/** Short label used in the log lines, e.g. "Skip", "Draw Two", "Wild", "7". */
export function cardLabel(card: Card): string {
  switch (card.kind) {
    case 'number':
      return String(card.value ?? 0);
    case 'skip':
      return 'Skip';
    case 'reverse':
      return 'Reverse';
    case 'draw2':
      return 'Draw Two';
    case 'wild':
      return 'Wild';
    case 'wild4':
      return 'Wild Draw Four';
    default:
      return 'Card';
  }
}
