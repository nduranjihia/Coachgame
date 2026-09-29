import { Chess } from 'chess.js';

function tryLine(name, seq) {
  const c = new Chess();
  const sans = [];
  for (const [from, to, promo] of seq) {
    try {
      const m = c.move({ from, to, promotion: promo });
      sans.push(m.san);
    } catch (e) {
      console.log(`${name}: FAILED at ${from}${to} -> ${e.message}`);
      console.log(`  played: ${sans.join(' ')}`);
      return null;
    }
  }
  console.log(`${name}: ${sans.join(' ')}`);
  console.log(
    `   checkmate=${c.isCheckmate()} stalemate=${c.isStalemate()} insufficient=${c.isInsufficientMaterial()} threefold=${c.isThreefoldRepetition()} draw=${c.isDraw()} check=${c.isCheck()}`,
  );
  return c;
}

const promoLine = (piece) => [
  ['b2', 'b4'],
  ['b8', 'c6'],
  ['a2', 'a3'],
  ['a7', 'a5'],
  ['c2', 'c3'],
  ['a5', 'b4'],
  ['a3', 'a4'],
  ['a8', 'b8'],
  ['a4', 'a5'],
  ['h7', 'h6'],
  ['a5', 'a6'],
  ['h6', 'h5'],
  ['a6', 'a7'],
  ['g7', 'g6'],
  ['a7', 'a8', piece],
];

tryLine('promo-Q', promoLine('q'));
tryLine('promo-N', promoLine('n'));

tryLine('stalemate-queen-sac', [
  ['e2', 'e3'],
  ['a7', 'a5'],
  ['d1', 'h5'],
  ['a8', 'a6'],
  ['h5', 'a5'],
  ['h7', 'h5'],
  ['a5', 'c7'],
  ['a6', 'h6'],
  ['h2', 'h4'],
  ['f7', 'f6'],
  ['c7', 'd7'],
  ['e8', 'f7'],
  ['d7', 'b7'],
  ['d8', 'd3'],
  ['b7', 'b8'],
  ['d3', 'h7'],
  ['b8', 'c8'],
  ['f7', 'g6'],
  ['c8', 'e6'],
]);

{
  const c = new Chess();
  const cycle = [
    ['g1', 'f3'],
    ['g8', 'f6'],
    ['f3', 'g1'],
    ['f6', 'g8'],
  ];
  for (let i = 0; i < 3; i++) {
    for (const [from, to] of cycle) {
      const m = c.move({ from, to });
      if (c.isThreefoldRepetition()) {
        console.log(`threefold after ${m.san} (ply ${i * 4 + cycle.findIndex((x) => x[0] === from) + 1})`);
        i = 99;
        break;
      }
    }
  }
}

{
  const c = new Chess();
  c.load('8/8/8/4k3/8/8/8/4K3 w - - 0 1');
  console.log(`bare kings insufficient=${c.isInsufficientMaterial()}`);
  const d = new Chess();
  d.load('8/8/8/4k3/8/8/8/3QK3 w - - 0 1');
  console.log(`K+Q vs K insufficient=${d.isInsufficientMaterial()}`);
}
