import { Chess } from 'chess.js';

// Beam search for a short legal sequence from the start position that reaches a
// bare-kings position (chess.isInsufficientMaterial() === true).

const KING_TARGET = { w: 32, b: 96 };

function evaluate(c) {
  let w = 0;
  let b = 0;
  let kw = null;
  let kb = null;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = c.board()[r][f];
      if (!p) continue;
      const v =
        p.type === 'q' ? 90 : p.type === 'r' ? 50 : p.type === 'b' ? 33 : p.type === 'n' ? 32 : p.type === 'p' ? 10 : 0;
      if (p.color === 'w') {
        w += v;
        if (p.type === 'k') kw = [r, f];
      } else {
        b += v;
        if (p.type === 'k') kb = [r, f];
      }
    }
  }
  // Strongly reward low material, and reward centralising both kings so that
  // captures become easy.
  const dist = (k) => (k ? Math.abs(k[0] - 3.5) + Math.abs(k[1] - 3.5) : 0);
  return -(w + b) * 10 - (dist(kw) + dist(kb)) * 6 + (w === 0 && b === 0 ? 5000 : 0);
}

function search(maxPlies, beam) {
  let states = [{ c: new Chess(), moves: [] }];
  for (let ply = 0; ply < maxPlies; ply++) {
    const next = [];
    for (const st of states) {
      if (st.c.isInsufficientMaterial()) return st.moves;
      if (st.c.isGameOver()) continue;
      for (const m of st.c.moves({ verbose: true })) {
        const clone = new Chess();
        clone.load(st.c.fen());
        clone.move({ from: m.from, to: m.to, promotion: m.promotion });
        next.push({ c: clone, moves: [...st.moves, [m.from, m.to, m.promotion || undefined]] });
      }
    }
    if (next.length === 0) return null;
    next.sort((a, b) => evaluate(a.c) - evaluate(b.c));
    states = next.slice(0, beam);
    // Cheap early exit
    for (const st of states) {
      if (st.c.isInsufficientMaterial()) return st.moves;
    }
  }
  return null;
}

for (const [maxPlies, beam] of [
  [40, 400],
  [50, 600],
  [60, 900],
  [80, 1400],
]) {
  const t0 = Date.now();
  const found = search(maxPlies, beam);
  if (found) {
    console.log(`found in ${found.length} plies (searched up to ${maxPlies}, beam ${beam}, ${Date.now() - t0}ms)`);
    // Verify
    const c = new Chess();
    for (const [f, t, p] of found) c.move({ from: f, to: t, promotion: p });
    console.log('fen', c.fen(), 'insufficient', c.isInsufficientMaterial());
    console.log('uci', found.map(([f, t, p]) => f + t + (p || '')).join(' '));
    break;
  } else {
    console.log(`no result up to ${maxPlies} plies (beam ${beam}, ${Date.now() - t0}ms)`);
  }
}
