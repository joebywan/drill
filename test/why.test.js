import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { subjects } from '../src/subjects.js';
import { ROOM, explanation, kind, words } from '../src/chess/items.js';
import { GENERAL, why } from '../src/chess/why.js';

// Every sentence why.js says about a real-game puzzle is checked here against the board, by rules written
// separately from the ones that found it: correct is decided by the rules, here as everywhere in the course.

const chess = subjects.find((s) => s.id === 'chess');
const puzzles = chess.units.flatMap((u) => u.lessons.filter((l) => !l.mix).flatMap((l) => l.items)).filter((i) => kind(i) === 'find' && i.theme);

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
const NAME = { pawn: 'p', knight: 'n', bishop: 'b', rook: 'r', queen: 'q', king: 'k' };
const PIECE = Object.fromEntries(Object.entries(NAME).map(([n, t]) => [t, n]));
const step = (from, to) => [Math.sign(to.charCodeAt(0) - from.charCodeAt(0)), Math.sign(to[1] - from[1])];
const shift = (sq, [dx, dy]) => String.fromCharCode(sq.charCodeAt(0) + dx) + (Number(sq[1]) + dy);

/** The squares strictly between two squares on one straight or diagonal line, or null if they aren't on one. */
function between(a, b) {
  const dx = b.charCodeAt(0) - a.charCodeAt(0), dy = b[1] - a[1];
  if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) || (dx === 0 && dy === 0)) return null;
  const out = [];
  for (let sq = shift(a, step(a, b)); sq !== b; sq = shift(sq, step(a, b))) out.push(sq);
  return out;
}

/** Whether a piece of `type` on `a` slides along the line to `b` with nothing in between on `game`. */
function sees(game, a, b) {
  const gap = between(a, b);
  if (!gap || gap.some((sq) => game.get(sq))) return false;
  const straight = a[0] === b[0] || a[1] === b[1];
  const { type } = game.get(a);
  return type === 'q' || (type === 'r' && straight) || (type === 'b' && !straight);
}

function replay(item) {
  const game = new Chess(item.fen);
  const boards = [new Chess(game.fen())];
  const moves = item.moves.map((m) => {
    const move = game.move({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m[4] });
    boards.push(new Chess(game.fen()));
    return move;
  });
  return { boards, moves, us: moves[1].color };
}

/** Whether the piece standing on `sq` on board `at` is captured later by the player, followed as it moves. */
function takenLater({ boards, moves, us }, at, sq) {
  for (let j = at; j < moves.length; j++) {
    if (moves[j].color !== us && moves[j].from === sq) sq = moves[j].to;
    else if (moves[j].color === us && moves[j].to === sq) return !!moves[j].captured;
  }
  return false;
}

const CHECK = {
  fork({ boards, us }, c, text, p) {
    const g = boards[c.at];
    assert.equal(g.get(c.from).color, us);
    assert.ok(c.targets.length >= 2);
    for (const t of c.targets) {
      assert.ok(g.get(t).color !== us && g.get(t).type !== 'p', `${t} is an enemy piece`);
      assert.ok(g.attackers(t, us).includes(c.from), `${c.from} attacks ${t}`);
    }
    assert.equal(/checked the king/.test(text), c.targets.some((t) => g.get(t).type === 'k'));
    assert.ok(c.targets.some((t) => g.get(t).type !== 'k' && takenLater(p, c.at, t)), 'the line takes one of them');
  },
  free({ boards, moves, us }, c) {
    const m = moves[c.at];
    assert.ok(m.color === us && m.to === c.square && m.captured, 'the move takes there');
    assert.deepEqual(boards[c.at].attackers(c.square, m.color === 'w' ? 'b' : 'w'), [], 'nothing defends it');
  },
  pin({ boards, us }, c, text, p) {
    const g = boards[c.at];
    assert.equal(g.get(c.pinner).color, us);
    assert.ok(g.get(c.pinned).color !== us && g.get(c.behind).color !== us);
    assert.ok(sees(g, c.pinner, c.pinned), 'the pinner looks at the pinned piece');
    assert.deepEqual(step(c.pinner, c.pinned), step(c.pinned, c.behind), 'all three on one line');
    assert.ok(between(c.pinned, c.behind).every((sq) => !g.get(sq)), 'nothing between the pinned piece and what is behind it');
    const behind = g.get(c.behind).type, pinned = g.get(c.pinned).type;
    assert.ok(behind === 'k' || VALUE[behind] > VALUE[pinned]);
    if (c.stuck) {
      const takes = (game) => game.moves({ verbose: true }).some((m) => m.from === c.pinned && m.to === c.stuck);
      const loose = new Chess(g.fen());
      loose.remove(c.pinner);
      assert.ok(!takes(g) && takes(loose), `only the pin stops it taking on ${c.stuck}`);
      assert.match(text, new RegExp(`couldn't take on ${c.stuck}`));
    } else assert.ok(takenLater(p, c.at, c.pinned) || c.at === p.moves.length, 'the pin matters');
  },
  skewer({ boards, moves, us }, c, text, p) {
    const g = boards[c.at];
    assert.equal(g.get(c.from).color, us);
    assert.ok(sees(g, c.from, c.front), 'it attacks the piece in front');
    assert.deepEqual(step(c.from, c.front), step(c.front, c.back));
    assert.ok(between(c.front, c.back).every((sq) => !g.get(sq)), 'the one behind is right behind');
    const front = g.get(c.front).type, back = g.get(c.back).type;
    assert.ok(g.get(c.back).color !== us && (front === 'k' || VALUE[front] > VALUE[back]));
    assert.equal(moves[c.at].from, c.front, 'the piece in front moves');
    assert.ok(takenLater(p, c.at, c.back), 'the one behind is taken');
  },
  discovered({ boards, moves, us }, c, text, p) {
    const g = boards[c.at];
    assert.equal(moves[c.at - 1].from, c.mover);
    assert.equal(g.get(c.behind).color, us);
    assert.ok(g.get(c.target).color !== us);
    assert.ok(sees(g, c.behind, c.target), 'the piece behind now sees the target');
    assert.ok(between(c.behind, c.target).includes(c.mover), 'the piece that moved stood in between');
    if (g.get(c.target).type === 'k') assert.ok(g.inCheck() && /a check from/.test(text));
    else assert.ok(takenLater(p, c.at, c.target), 'the line takes the target');
  },
  double({ boards, us }, c, text) {
    const g = boards[c.at];
    const king = g.board().flat().find((x) => x?.type === 'k' && x.color !== us).square;
    assert.deepEqual([...g.attackers(king, us)].sort(), [...c.checkers].sort());
    assert.ok(c.checkers.length >= 2);
    assert.equal(/checkmate/.test(text), g.isCheckmate());
  },
  trapped({ boards, us }, c, text, p) {
    const g = boards[c.at];
    const piece = g.get(c.square);
    assert.ok(piece.color !== us && !['k', 'p'].includes(piece.type));
    assert.ok(g.attackers(c.square, us).length, 'it is attacked');
    for (const m of g.moves({ square: c.square, verbose: true })) {
      const after = new Chess(g.fen());
      after.move(m);
      assert.ok(after.attackers(m.to, us).length, `${m.san} lands on an attacked square`);
    }
    assert.ok(takenLater(p, c.at, c.square), 'the line takes it');
  },
  deflection({ boards, moves, us }, c) {
    const g = boards[c.at];
    const them = us === 'w' ? 'b' : 'w';
    assert.equal(c.forcing, g.inCheck() ? 'check' : moves[c.at - 1].captured ? 'capture' : null);
    assert.equal(moves[c.at].from, c.defender);
    assert.ok(g.attackers(c.guarded, them).includes(c.defender), 'it guarded the square');
    assert.ok(!boards[c.at + 1].attackers(c.guarded, them).includes(moves[c.at].to), 'and no longer does');
    assert.equal(moves[c.at + 1].to, c.guarded, 'the next move goes there');
  },
  attraction({ boards, moves, us }, c, text) {
    assert.equal(moves[c.at - 1].to, c.square);
    assert.ok(moves[c.at].to === c.square && moves[c.at].captured, 'they take on the square');
    const g = boards[c.at + 2];
    assert.ok(g.get(c.square).color !== us && g.attackers(c.square, us).length, 'the next move hits it there');
    if (moves[c.at].piece === 'k') assert.ok(g.inCheck());
    assert.equal(/checkmate/.test(text), g.isCheckmate());
  },
  promotion({ moves, us }, c) {
    const m = moves[c.at - 1];
    assert.ok(m.color === us && m.promotion === c.piece && m.to === c.square && '18'.includes(c.square[1]));
  },
  mate({ boards, moves, us }, c, text) {
    const g = boards[moves.length];
    assert.ok(g.isCheckmate());
    const them = us === 'w' ? 'b' : 'w';
    assert.deepEqual([...g.attackers(c.king, us)].sort(), [...c.checkers].sort());
    const lifted = new Chess(g.fen());
    lifted.remove(c.king);
    const near = [-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => String.fromCharCode(c.king.charCodeAt(0) + dx) + (Number(c.king[1]) + dy)))
      .filter((sq) => /^[a-h][1-8]$/.test(sq) && sq !== c.king);
    for (const sq of near) {
      const own = g.get(sq)?.color === them;
      assert.equal(c.own.includes(sq), own, `${sq} is his own piece`);
      if (!own) assert.ok(lifted.attackers(sq, us).some((by) => c.guards.includes(by)), `${sq} is guarded by a piece the sentence names`);
    }
    for (const sq of c.guards) {
      assert.equal(g.get(sq).color, us, `${sq} is yours`);
      assert.ok(near.some((n) => !c.own.includes(n) && lifted.attackers(n, us).includes(sq)), `${sq} guards a square beside the king`);
      if (!/your pieces/i.test(text)) assert.match(text, new RegExp(`your [a-z, ]*${PIECE[g.get(sq).type]}`, 'i'), `the sentence names the ${PIECE[g.get(sq).type]}`);
    }
    assert.equal(/his own/i.test(text), c.own.length > 0);
    const home = them === 'w' ? '1' : '8';
    if (/back rank/.test(text)) assert.ok(c.king[1] === home && c.checkers.every((sq) => sq[1] === home), 'on his back rank, checked along it');
  },
};

test('every real-game puzzle says why its line works, and every fact it states holds on the board', () => {
  for (const item of puzzles) {
    const said = why(item);
    assert.ok(said, item.id);
    if (!said.claim) {
      assert.equal(said.text, GENERAL[item.theme], `${item.id}: a general sentence is the theme's own`);
      continue;
    }
    const p = replay(item);
    const c = said.claim;
    try {
      CHECK[c.kind](p, c, said.text, p);
      // Every "the knight on f6" in either wording is that piece on that square, on the board the claim is about.
      for (const text of [said.text, said.short]) {
        for (const [, name, sq] of text.matchAll(/\b(pawn|knight|bishop|rook|queen|king) on ([a-h][1-8])/g)) {
          assert.equal(p.boards[c.at].get(sq)?.type, NAME[name], `${name} on ${sq}`);
        }
      }
    } catch (e) {
      throw new Error(`${item.id} (${item.theme}): "${said.text}" ${e.message}`);
    }
  }
});

test('the verdict says the line, then why in full, in fewer words if the line is long, or not at all if even that would not fit', () => {
  let shown = 0;
  for (const item of puzzles) {
    const said = why(item);
    const line = `${replay(item).moves.slice(1).map((m) => words(m.san, m.to)).join('. ')}.`;
    const text = explanation(item);
    assert.ok(text.startsWith(line), item.id);
    const tail = text.slice(line.length).trim();
    assert.ok([said.text, said.short, ''].includes(tail), `${item.id}: ${tail}`);
    if (tail) { shown++; assert.ok(text.length <= ROOM, `${item.id}: ${text.length} characters`); }
    if (tail === said.short) assert.ok(`${line} ${said.text}`.length > ROOM, `${item.id}: the full sentence fitted`);
    if (!tail) assert.ok(`${line} ${said.short ?? said.text}`.length > ROOM, `${item.id}: a sentence fitted`);
  }
  assert.ok(shown / puzzles.length > 0.95, `${shown} of ${puzzles.length} show why`);
});

test('most puzzles get a sentence worked out from their own position', () => {
  const worked = puzzles.filter((i) => why(i).claim).length;
  assert.ok(worked / puzzles.length > 0.95, `${worked} of ${puzzles.length}`);
});

test('a checker that lies is caught: a fork claim moved to another square fails', () => {
  const item = puzzles.find((i) => why(i).claim?.kind === 'fork');
  const c = why(item).claim;
  const p = replay(item);
  assert.throws(() => CHECK.fork(p, { ...c, targets: ['a1', 'h8'] }, why(item).text, p));
});
