import { Chess } from 'chess.js';
import { uci } from './puzzle.js';

/**
 * Lesson items. `type` says how one is played; a Lichess puzzle has none and is 'find'.
 *
 *   teach      { text, fen?, side? }                       a card to read: not marked, not reviewed
 *   tap        { fen, square, prompt, explain }            tap every enemy piece the piece on `square` attacks
 *   pick       { fen, prompt, options, answer, explain }   choose the move (SAN) from the options
 *   truefalse  { fen, move, targets, prompt, explain }     "after `move`, the piece attacks every target"
 *   find       { fen, moves, explain? }                    play the line on the board
 *
 * Tap and true/false answers are worked out from the position by chess.js, never stored, so a
 * typo in the course can't make a right answer wrong.
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

/** The right answer: a sorted square list (tap), a boolean (truefalse) or a SAN move (pick). */
export function answer(item) {
  switch (kind(item)) {
    case 'tap': return attacked(item.fen, item.square);
    case 'truefalse': {
      const game = new Chess(item.fen);
      const { to } = game.move(item.move);
      const hits = attacked(game.fen(), to);
      return item.targets.every((t) => hits.includes(t));
    }
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
        for (const o of item.options) new Chess(item.fen).move(o);
        return item.options.includes(item.answer) ? null : 'answer is not an option';
      }
      case 'truefalse': answer(item); return item.targets.length ? null : 'no targets';
      case 'find': line(item); return null;
    }
    return 'unknown type';
  } catch (e) {
    return e.message;
  }
}
