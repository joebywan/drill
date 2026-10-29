import { Chess } from 'chess.js';
import { uci } from './puzzle.js';

/**
 * Lesson items. `type` says how one is played; a Lichess puzzle has none and is 'find'.
 *
 *   teach      { text, fen?, side? }                       a card to read: not marked, not reviewed
 *   tap        { fen, square, prompt, explain }            tap every enemy piece the piece on `square` attacks
 *   pick       { fen, prompt, options, answer, targets?, explain }   choose the move (SAN)
 *   truefalse  { fen, move, targets, prompt, explain }     "after `move`, the piece attacks every target"
 *   find       { fen, moves, targets?, explain? }          play the line on the board
 *
 * Tap and true/false answers are worked out from the position by chess.js, never stored, so a
 * typo in the course can't make a right answer wrong. `targets` on a pick or find item is a
 * claim the rules check proves: the answer's piece attacks every target, and (for pick) no
 * wrong option does.
 */
export const kind = (item) => item.type || 'find';

/** Squares of the enemy pieces that the piece on `square` attacks, sorted. */
export function attacked(fen, square) {
  const game = new Chess(fen);
  const { color } = game.get(square);
  return game.board().flat()
    .filter((p) => p && p.color !== color && game.attackers(p.square, color).includes(square))
    .map((p) => p.square).sort();
}

/** The enemy pieces attacked by whatever moved last, after `moves` are played from `fen`. */
function hitsAfter(fen, ...moves) {
  const game = new Chess(fen);
  let move;
  for (const m of moves) move = game.move(m);
  return attacked(game.fen(), move.to);
}

const hitsAll = (hits, targets) => targets.every((t) => hits.includes(t));

/** The right answer: a sorted square list (tap), a boolean (truefalse) or a SAN move (pick). */
export function answer(item) {
  switch (kind(item)) {
    case 'tap': return attacked(item.fen, item.square);
    case 'truefalse': return hitsAll(hitsAfter(item.fen, item.move), item.targets);
    case 'pick': return item.answer;
  }
}

export const grade = (item, response) =>
  kind(item) === 'tap' ? [...response].sort().join() === answer(item).join() : response === answer(item);

/** The line a find item is solved by, in SAN, setup move left out. */
export function line(item) {
  const game = new Chess(item.fen);
  game.move(uci(item.moves[0]));
  return item.moves.slice(1).map((m) => game.move(uci(m)).san);
}

/** What is said after an answer. Every marked item has one; a puzzle falls back to its line. */
export const explanation = (item) => item.explain || `The line: ${line(item).join(' ')}.`;

/** Why an item can't be shipped, or null. chess.js checks every position and move. */
export function problem(item) {
  try {
    switch (kind(item)) {
      case 'teach': return item.text ? null : 'no text';
      case 'tap': return answer(item).length ? null : 'the piece attacks nothing';
      case 'pick': {
        if (!item.options.includes(item.answer)) return 'answer is not an option';
        const forks = item.options.filter((o) => hitsAll(hitsAfter(item.fen, o), item.targets || []));
        if (item.targets && (forks.length !== 1 || forks[0] !== item.answer)) return `options hitting every target: ${forks}`;
        return null;
      }
      case 'truefalse': answer(item); return item.targets.length ? null : 'no targets';
      case 'find':
        line(item);
        if (item.targets && !hitsAll(hitsAfter(item.fen, ...item.moves.slice(0, 2).map(uci)), item.targets)) return 'the move misses a target';
        return null;
    }
    return 'unknown type';
  } catch (e) {
    return e.message;
  }
}
