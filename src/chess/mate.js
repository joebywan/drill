import { Chess } from 'chess.js';
import { words } from './items.js';
import { uci } from './puzzle.js';

/**
 * Mate, ported from Daybook: a forced checkmate in 2, 3 or 4 against the best defence, and its
 * teacher. The searches are prover.js; this holds what is pure around them. Any mate within the
 * moves counts, because the prover and chess.js decide it, never a stored answer.
 */
export const TIERS = [2, 3, 4];

/** A line of mate.json, "<fen without clocks> <last move uci>", as { fen, last }. */
export const entry = (line) => {
  const cut = line.lastIndexOf(' ');
  return { fen: `${line.slice(0, cut)} 0 1`, last: line.slice(cut + 1) };
};

/** The day's board for a tier: a pure function of the date on this device (FNV-1a). */
export function dailyIndex(date, tier, size) {
  let h = 0x811C9DC5;
  for (const c of `${date}|${tier}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return (h >>> 0) % size;
}

export const sideName = (fen) => (fen.split(' ')[1] === 'w' ? 'White' : 'Black');
const other = (fen) => (fen.split(' ')[1] === 'w' ? 'Black' : 'White');
const PIECE = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const said = (fen, m) => words(new Chess(fen).move(uci(m)).san).replace(/, check(mate)?$/, '');
const pick = (fen, keys) => keys.find((k) => new Chess(fen).move(uci(k)).san.endsWith('+')) ?? keys[0];

/**
 * The hint on a position with a forced mate (`res` from forcedMate): first a nudge, then the
 * explanation; the player still makes the move. Prefers a key that checks, as Daybook does.
 */
export function teach(fen, res) {
  const key = pick(fen, res.keys);
  const game = new Chess(fen);
  const from = key.slice(0, 2);
  const move = said(fen, key);
  const piece = PIECE[game.get(from).type];
  const after = new Chess(fen);
  after.move(uci(key));
  if (res.inMoves === 1) {
    return { from, to: key.slice(2, 4), nudge: 'One move ends it. Where can that king go?', explain: `${move} is checkmate: check, the king has no safe square, and nothing can take the checker or block it.` };
  }
  const n = after.moves().length;
  const left = res.inMoves - 1;
  const opening = after.inCheck() ? `${move} is check` : `${move} is quiet, not a check, but it`;
  return {
    from, to: key.slice(2, 4),
    nudge: `Look at the ${piece} on ${from}.`,
    explain: `${opening} ${after.inCheck() ? 'and ' : ''}leaves ${sideName(after.fen())} ${n === 1 ? 'only one reply' : `${n} replies`}. ${n === 1 ? 'It allows' : 'Each allows'} mate ${left === 1 ? 'next move' : `within ${left} more moves`}.`,
  };
}

/** Why a move gave the mate up. `movesLeft`: what the player had left after it. */
export function mistake(before, m, movesLeft) {
  const move = said(before, m);
  const game = new Chess(before);
  game.move(uci(m));
  if (game.isStalemate()) return `${move} is stalemate: ${other(before)} has no move but is not in check. Undo and look again.`;
  if (!movesLeft) return `${move} was the last move allowed, and it is not mate. Undo and look again.`;
  return `${move} lets ${other(before)} out: no forced mate in ${movesLeft} from here. Undo and look again.`;
}
