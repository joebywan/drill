import { test } from 'node:test';
import assert from 'node:assert/strict';
import basics from '../src/data/basics.json' with { type: 'json' };
import forks from '../src/data/forks.json' with { type: 'json' };
import chess from '../src/data/chess.json' with { type: 'json' };
import tactics from '../src/data/tactics.json' with { type: 'json' };
import { subjects } from '../src/subjects.js';
import { Chess } from 'chess.js';
import { uci } from '../src/chess/puzzle.js';
import { answer, attacked, explanation, grade, hop, kind, meets, problem, solutions, starPath, starsPrompt, words } from '../src/chess/items.js';
import { helpFor } from '../src/adapt.js';
import terms from '../src/data/chess-terms.json' with { type: 'json' };

const all = [...basics.units, forks, ...chess.units].flatMap((u) => u.lessons.flatMap((l) => l.items)).concat(Object.values(tactics).flat());

test('every item in the course passes the rules check', () => {
  for (const item of all) assert.equal(problem(item), null, item.id);
});

test('item ids are unique across the whole course', () => {
  assert.equal(new Set(all.map((i) => i.id)).size, all.length);
});

test('every marked item has an explanation', () => {
  for (const item of all.filter((i) => kind(i) !== 'teach')) assert.ok(explanation(item).length && explanation(item).every(Boolean), item.id);
});

test('attacked() finds the enemy pieces a knight hits, and nothing else', () => {
  assert.deepEqual(attacked('7k/3q1r2/6p1/4N3/8/8/8/6K1 w - - 0 1', 'e5'), ['d7', 'f7', 'g6']);
});

const byId = Object.fromEntries(all.map((i) => [i.id, i]));

test('tap is graded as a set, in any order, with no extras', () => {
  const tap = byId['fork-0-tap'];
  assert.ok(grade(tap, ['g6', 'd7', 'f7']));
  assert.ok(!grade(tap, ['d7', 'f7']));
  assert.ok(!grade(tap, ['d7', 'f7', 'g6', 'h8']));
});

test('true/false is decided by the board, not by the author', () => {
  const tf = byId['fork-0-tf'];
  assert.equal(answer(tf), true);
  assert.equal(answer({ ...tf, targets: ['h8', 'a8'] }), false);
  assert.ok(grade(tf, true) && !grade(tf, false));
});

test('a move item accepts any move that meets the goal, and only legal ones', () => {
  const fork = byId['fork-1-pick'];
  assert.equal(meets(fork, 'Nf7+').correct, true);
  assert.equal(meets(fork, 'Ne6').correct, false);
  assert.equal(meets(fork, { from: 'g5', to: 'g7' }).legal, false);
  assert.deepEqual(solutions(fork).map((m) => m.san), ['Nf7+']);
});

test('a move goal the position cannot meet is caught', () => {
  assert.equal(problem({ ...byId['fork-1-pick'], targets: ['h8', 'a1'] }), 'no legal move meets the goal');
});

test('tap can ask for a named square or every square a piece reaches', () => {
  assert.deepEqual(answer({ type: 'tap', rule: 'name', answer: 'e4' }), ['e4']);
  assert.deepEqual(answer({ type: 'tap', rule: 'moves', fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1', square: 'a1' }),
    ['a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8', 'b1', 'c1', 'd1']);
});

test('ends asks only for the furthest square along each line', () => {
  const rook = { type: 'tap', rule: 'ends', fen: '7k/8/8/8/8/8/8/R3K3 w - - 0 1', square: 'a1' };
  assert.deepEqual(answer(rook), ['a8', 'd1']);
  const knight = { type: 'tap', rule: 'ends', fen: '4k3/8/8/8/3N4/8/8/4K3 w - - 0 1', square: 'd4' };
  assert.equal(answer(knight).length, 8, 'every knight jump is its own direction');
});

test('true/false can claim check and mate, judged by the board', () => {
  assert.equal(answer({ type: 'truefalse', claim: 'check', fen: '4k3/8/8/8/8/8/8/4R1K1 b - - 0 1' }), true);
  assert.equal(answer({ type: 'truefalse', claim: 'mate', fen: '4k3/8/8/8/8/8/8/4R1K1 b - - 0 1' }), false);
});

test('moves read as words', () => {
  assert.equal(words('Nxf7+'), 'Knight takes on f7, check');
  assert.equal(words('e8=Q#'), 'Pawn to e8, becomes a queen, checkmate');
  assert.equal(words('O-O-O'), 'Castles');
  assert.equal(words('O-O+', 'g1'), 'Castles, king to g1, check', 'given where the king goes, it says so: never "kingside"');
});

test('a puzzle with no written explanation explains with its line', () => {
  const { explain, ...bare } = byId['fork-0-find'];
  assert.deepEqual(explanation(bare), ['Knight to c7, check.']);
});

test('a fork claim the board does not back up is caught', () => {
  assert.equal(problem({ ...byId['fork-1-find-a'], targets: ['g8', 'a8'] }), 'the move misses a target');
});

const rook = { type: 'stars', fen: 'R7/8/8/8/8/8/8/8 w - - 0 1', stars: ['h8', 'h1'], moves: 2 };

test('a stars move keeps the turn with the player, and illegal ones are refused', () => {
  const { fen, played } = hop(rook.fen, { from: 'a8', to: 'h8' });
  assert.equal(played.san, 'Rh8');
  assert.equal(fen.split(' ')[1], 'w', 'the other side never gets a move');
  assert.ok(hop(fen, { from: 'h8', to: 'h1' }), 'and the rook can go again');
  assert.equal(hop(rook.fen, { from: 'a8', to: 'b6' }), null);
});

test('stars are collected by landing on them, within the move budget', () => {
  const path = starPath(rook);
  assert.deepEqual(path.map((m) => m.to), ['h8', 'h1']);
  let fen = rook.fen;
  const left = new Set(rook.stars);
  for (const m of path) { fen = hop(fen, m).fen; left.delete(m.to); }
  assert.equal(left.size, 0);
  assert.equal(starPath({ ...rook, moves: 1 }), null, 'two stars on different lines need two moves');
  assert.match(problem({ ...rook, moves: 1 }), /can't all be collected in 1 moves/);
  assert.equal(problem(rook), null);
});

test('a stars item is checked for its own pieces on stars and an illegal demo', () => {
  assert.match(problem({ ...rook, stars: ['a8'] }), /own piece/);
  assert.match(problem({ ...rook, demo: ['a8', 'b6'] }), /demo/);
  assert.equal(problem({ ...rook, demo: ['a8', 'a1', 'h1'] }), null);
});

test('a stars item with no written explanation explains with a way that works', () => {
  assert.deepEqual(explanation(rook), ['One way: Rook to h8, then Rook to h1.']);
});

// Nothing assumed: the whole chess path, in the order the learner meets it.
const path = subjects.find((s) => s.id === 'chess').units.flatMap((u) => u.lessons.flatMap((l) => l.items));
const taughtText = (i) => [i.text, i.intro, i.prompt].filter(Boolean).join(' ');
const before = (index) => path.slice(0, index).map(taughtText).join(' ');

// Everything the learner reads, in path order: each item's words and its explanation as shown (a real-game puzzle's is worked
// out), with each unit's and lesson's help (adapt.js) where it could first come, at the first marked item.
const shown = (i) => [taughtText(i), ...(kind(i) === 'teach' ? [] : explanation(i))].join(' '); // every wording the page might pick
const read = subjects.find((s) => s.id === 'chess').units.flatMap((u) => u.lessons.flatMap((l) => {
  const at = l.items.findIndex((i) => kind(i) !== 'teach');
  const help = [l === u.lessons[0] && helpFor('chess', u.title, ''), helpFor('chess', '', l.id)].filter(Boolean).map((text) => ({ id: `help:${l.id}`, said: text }));
  return l.items.flatMap((i, n) => [...(n === at ? help : []), { id: i.id, said: shown(i), teaches: taughtText(i) }]);
}));

test('every chess word is taught on a card before anything leans on it (src/data/chess-terms.json)', () => {
  for (const { term, pattern, taught } of terms.terms) {
    const word = new RegExp(pattern, 'i');
    const first = read.findIndex((e) => word.test(e.said));
    if (taught === null) {
      assert.equal(first, -1, `"${term}" is said in ${read[first]?.id}: ${read[first]?.said}`);
      continue;
    }
    const card = read.findIndex((e) => e.id === taught);
    assert.ok(card >= 0, `${taught} is on the path`);
    assert.match(read[card].teaches, word, `${taught} teaches "${term}"`);
    assert.ok(first >= card, `"${term}" is said in ${read[first].id} before ${taught} teaches it: ${read[first].said}`);
  }
});

test('every stars prompt says how many moves it allows', () => {
  for (const i of path.filter((x) => kind(x) === 'stars' && x.prompt)) {
    assert.match(i.prompt, new RegExp(`\\b${i.moves}\\b`), i.id);
  }
});

test('a pawn attack is taught before the king is asked to avoid one', () => {
  const at = (id) => path.findIndex((i) => i.id === id);
  assert.ok(at('moves-3-attack') < at('moves-1-king-guard'));
  assert.ok(at('moves-3-capture') < at('moves-3-take'));
});

test('every tactics unit opens by teaching its theme', () => {
  const units = subjects.find((s) => s.id === 'chess').units;
  for (const u of units.slice(units.findIndex((x) => x.title === 'Mate in one'))) assert.equal(u.lessons[0].items[0].type, 'teach', u.title);
});

test('a puzzle using a rare rule comes after the card that teaches it', () => {
  const rules = [['e', /en passant/i], ['k', /castling/i], ['q', /castling/i]];
  path.forEach((p, index) => {
    if (kind(p) !== 'find') return;
    const game = new Chess(p.fen);
    for (const m of p.moves) {
      const played = game.move(uci(m));
      for (const [flag, card] of rules) if (played.flags.includes(flag)) assert.match(before(index), card, `${p.id} plays ${played.san}`);
      if (played.promotion) assert.match(before(index), /any piece but a king/, `${p.id} promotes`);
    }
  });
});

test('the teach boards show what their cards say', () => {
  const card = (id) => path.find((i) => i.id === id);
  const asBlack = (fen) => new Chess(fen.replace(' w ', ' b '));
  assert.deepEqual(asBlack(card('pin-teach').fen).moves({ square: 'e6' }), [], 'the pinned knight has no legal move');
  const skewer = new Chess(card('skewer-teach').fen);
  assert.ok(skewer.inCheck() && skewer.moves().every((m) => m.startsWith('K')), 'only the king can answer the skewer');
  assert.equal(new Chess(card('double-teach').fen).attackers('e8', 'w').length, 2, 'double check');
  assert.ok(new Chess(card('enpassant-teach').fen).moves({ verbose: true }).some((m) => m.flags.includes('e') && m.to === 'e6'));
  assert.ok(new Chess(card('castling-teach').fen).moves({ verbose: true }).some((m) => m.flags.includes('k')));
  assert.ok(new Chess(card('capture-0-turns').fen).attackers('d4', 'b').includes('c5'), 'the knight is defended by the pawn');
  assert.ok(new Chess(card('discovered-teach').fen.replace('4N3', '8')).attackers('e8', 'w').includes('e1'), 'the rook is behind the knight');
  // A line a card walks through: each move of ours is legal, each reply is their only move, and it ends as the card says.
  const forced = (id, ours, end) => {
    const game = new Chess(card(id).fen);
    ours.forEach((san, n) => {
      game.move(san);
      if (n < ours.length - 1) { assert.equal(game.moves().length, 1, `${id}: one reply to ${san}`); game.move(game.moves()[0]); }
    });
    end(game);
  };
  forced('mate1-teach', ['Qg7'], (g) => assert.ok(g.isCheckmate(), 'queen to g7 mates'));
  assert.deepEqual(new Chess(card('mate1-teach').fen).moves().filter((m) => m.endsWith('#')), ['Qg7#'], 'and is the only mate');
  forced('mate2-teach', ['Re8+', 'Rxe8#'], (g) => assert.ok(g.isCheckmate()));
  forced('mate3-teach', ['Re8+', 'Rxe8+', 'Qxe8#'], (g) => assert.ok(g.isCheckmate()));
  forced('deflection-teach', ['Re8+', 'Rxd5'], (g) => assert.equal(g.history({ verbose: true }).at(-1).captured, 'q', 'the queen falls'));
  forced('attraction-teach', ['Rf8+', 'Nd7+'], (g) => assert.deepEqual(attacked(g.fen(), 'd7').filter((sq) => ['f8', 'e5'].includes(sq)), ['e5', 'f8'], 'the knight forks king and queen'));
  const trap = new Chess(card('trapped-teach').fen);
  trap.move('Be4');
  assert.ok(trap.attackers('a8', 'w').length, 'the bishop attacks the knight');
  for (const m of trap.moves({ square: 'a8', verbose: true })) assert.ok(trap.attackers(m.to, 'w').length, `the knight's ${m.to} is attacked`);
});

test('a teach card that walks through a move has a board to show it on', () => {
  for (const i of path.filter((x) => kind(x) === 'teach' && /\bto [a-h][1-8]\b/.test(x.text))) assert.ok(i.fen, i.id);
});

test('a stars item\'s arrows go through the squares its first sentence names, in order', () => {
  for (const item of all.filter((i) => kind(i) === 'stars' && i.explain)) {
    const names = (item.explain.split(/\.\s/)[0].match(/\b[a-h][1-8]\b/g) || []).filter((sq, i, a) => sq !== a[i - 1]);
    const path = starPath(item);
    const route = [path[0].from, ...path.map((m) => m.to)];
    let at = 0;
    for (const sq of names) {
      at = route.indexOf(sq, at);
      assert.ok(at >= 0, `${item.id}: "${item.explain}" names ${sq}, the arrows go ${route.join(' ')}`);
      at++;
    }
    assert.equal(problem(item), null, item.id);
  }
});

test('a stars prompt reads naturally for one, two and more stars', () => {
  const p = (n) => starsPrompt({ stars: ['a1', 'a2', 'a3', 'a4'].slice(0, n), moves: 2 });
  assert.equal(p(1), 'Collect the star in 2 moves.');
  assert.equal(p(2), 'Collect both stars in 2 moves.');
  assert.equal(p(3), 'Collect all 3 stars in 2 moves.');
});
