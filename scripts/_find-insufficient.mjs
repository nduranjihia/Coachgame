import { Chess } from 'chess.js';

/** Small reproducible PRNG so results are stable across runs. */
function makeRng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

/**
 * Play a random legal game, preferring captures at the given rate. Returns the
 * move list the moment the position becomes insufficient material while not
 * being checkmate or stalemate (matching the engine's precedence).
 */
function playout(rng, captureBias) {
  const chess = new Chess();
  const moves = [];
  for (let ply = 0; ply < 400; ply++) {
    if (chess.isGameOver()) return null;
    const all = chess.moves({ verbose: true });
    if (all.length === 0) return null;
    const caps = all.filter((m) => m.captured);
    const pool = caps.length && rng() < captureBias ? caps : all;
    const m = pool[(rng() * pool.length) | 0];
    chess.move(m);
    moves.push(m.promotion ? { from: m.from, to: m.to, promotion: m.promotion } : { from: m.from, to: m.to });
    if (chess.isInsufficientMaterial() && !chess.isCheckmate() && !chess.isStalemate()) {
      return { moves, fen: chess.fen() };
    }
  }
  return null;
}

const trials = Number(process.argv[2] ?? 40000);
let best = null;
let found = 0;
for (let t = 0; t < trials; t++) {
  const rng = makeRng(90001 + t * 2654435761);
  const captureBias = 0.55 + 0.45 * ((t % 9) / 8); // 0.55 .. 1.0
  const g = playout(rng, captureBias);
  if (g) {
    found++;
    if (!best || g.moves.length < best.moves.length) {
      best = g;
      process.stderr.write(`best ${g.moves.length} plies - ${g.fen}\n`);
    }
  }
}
process.stderr.write(`found ${found} / ${trials}\n`);
process.stdout.write(JSON.stringify(best) + '\n');
