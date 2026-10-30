import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RETRIES, checkpoint, comeBack, dropEchoes, echoes, fresh, marked, warmUps, withCheckpoint } from '../src/repeat.js';
import { Chess } from 'chess.js';
import { subjects } from '../src/subjects.js';
import { kind, line, problem as chessProblem, solutions } from '../src/chess/items.js';
import { problem as quizProblem } from '../src/quiz/items.js';

const chess = subjects.find((s) => s.id === 'chess');
const random = () => 0.3;

test('warm-ups are the course cards closest to slipping, never from this lesson', () => {
  const cards = { 'c:a': { due: '2026-01-03' }, 'c:b': { due: '2026-01-01' }, 'c:c': { due: '2026-01-02' }, 'x:d': { due: '2025-01-01' } };
  assert.deepEqual(warmUps(cards, (k) => k.startsWith('c:'), ['c:b']), ['c:c', 'c:a']);
  assert.deepEqual(warmUps({}, () => true, []), []);
});

test('echoes skip teach cards and anything with no worthwhile repeat', () => {
  const subject = { vary: (i) => (i.id === 'no' ? null : { ...i, fresh: true }) };
  const items = [{ id: 't', type: 'teach' }, { id: 'no', type: 'x' }, { id: 'a', type: 'x' }];
  assert.deepEqual(echoes(subject, items, random).map((e) => [e.source.id, e.item.fresh]), [['a', true]]);
  assert.deepEqual(echoes({}, items, random), [], 'a subject with no vary');
  assert.equal(fresh({}, items[2]), items[2]);
});

test('a unit gains a checkpoint of its marked items; a tiny unit does not', () => {
  const big = { lessons: [{ id: 'a', items: Array(3).fill({ type: 'x' }) }, { id: 'b', items: [{ type: 'teach' }, { type: 'x' }] }] };
  const unit = withCheckpoint(big);
  assert.equal(unit.lessons.at(-1).mix, true);
  assert.equal(unit.lessons.at(-1).items.length, 4);
  assert.ok(unit.lessons.at(-1).items.every(marked));
  assert.equal(withCheckpoint({ lessons: [{ id: 'a', items: [{ type: 'x' }] }] }).lessons.length, 1);
  assert.equal(checkpoint({}, unit.lessons.at(-1).items, random, 2).length, 2);
});

test('every chess stars puzzle mirrors into a puzzle that can still be solved, in plain words', () => {
  const stars = chess.units.flatMap((u) => u.lessons.flatMap((l) => l.items)).filter((i) => i.type === 'stars');
  assert.ok(stars.length > 10);
  for (const item of stars) {
    const m = chess.vary(item);
    assert.equal(chessProblem(m), null, item.id);
    assert.equal(m.demo, undefined);
    assert.notDeepEqual(m.stars, item.stars, item.id);
  }
  assert.equal(chess.vary({ type: 'find', fen: '' }), null);
});

const flip = (sq) => String.fromCharCode(201 - sq.charCodeAt(0)) + sq[1];
const shipped = (subject) => subject.units.flatMap((u) => u.lessons.filter((l) => !l.mix).flatMap((l) => l.items));

test('every shipped move item mirrors into the same question, its goal squares and words flipped', () => {
  const moves = shipped(chess).filter((i) => i.type === 'move');
  assert.ok(moves.length >= 11);
  for (const item of moves) {
    const m = chess.vary(item);
    assert.ok(m, `${item.id} has a mirror`);
    assert.equal(chessProblem(m), null, item.id);
    assert.equal(m.fen.split(' ')[2], '-');
    assert.notEqual(m.fen, item.fen, item.id);
    if (item.to) assert.equal(m.to, flip(item.to));
    if (item.targets) assert.deepEqual(m.targets, item.targets.map(flip));
    // The answers are the originals, square for square.
    const answers = (i, f = (x) => x) => solutions(i).map((s) => f(s.from) + f(s.to)).sort();
    assert.deepEqual(answers(m), answers(item, flip), item.id);
    for (const key of ['prompt', 'explain']) {
      const squares = (t) => [...t.matchAll(/\b[a-h][1-8]\b/g)].map(([x]) => x);
      assert.deepEqual(squares(m[key]), squares(item[key]).map(flip), `${item.id} ${key}`);
      assert.doesNotMatch(item[key], /\b[a-h]-(?!file|pawn)\w/, `${item.id} names a file the mirror can't flip`);
    }
  }
  assert.equal(chess.vary({ ...moves[0], fen: moves[0].fen.replace(' - - ', ' K - ') }), null, 'castling rights');
  assert.equal(chess.vary({ ...moves[0], prompt: 'Castle kingside.' }), null, 'a one-sided word');
});

test('every real-game puzzle that does not castle mirrors into a line that replays, and never echoes', () => {
  const finds = shipped(chess).filter((i) => kind(i) === 'find');
  let mirrored = 0;
  for (const item of finds) {
    const m = chess.vary(item);
    if (!m) {
      assert.ok(line(item).some((san) => san.startsWith('O-O')) || new Chess(item.fen).move({ from: item.moves[0].slice(0, 2), to: item.moves[0].slice(2, 4), promotion: item.moves[0][4] }).san.startsWith('O-O'), `${item.id} has no reason to stay as written`);
      continue;
    }
    mirrored++;
    assert.equal(chessProblem(m), null, item.id);
    assert.equal(m.fen.split(' ')[2], '-');
    assert.deepEqual(m.moves.map((u) => flip(u.slice(0, 2)) + flip(u.slice(2, 4)) + u.slice(4)), item.moves);
    assert.deepEqual(line(m).map((san) => san.replace(/[a-h]/g, '')), line(item).map((san) => san.replace(/[a-h]/g, '')), item.id);
  }
  assert.ok(mirrored > finds.length * 0.9, `${mirrored} of ${finds.length}`);
  assert.deepEqual(echoes(chess, finds.slice(0, 5), random), [], 'no echo in the same session');
  assert.ok(checkpoint(chess, finds.slice(0, 5), random, 5).some((e) => e.item !== e.source && e.item.fen !== e.source.fen), 'a checkpoint plays a mirror');
});

test('Japanese repeats ask a real other question, always correct, using only what is taught by then', () => {
  const japanese = subjects.find((s) => s.id === 'japanese');
  const taught = new Set();
  const kanaIn = (v) => [...JSON.stringify(v)].filter((c) => /[\u3040-\u309f]/.test(c));
  const seen = new Set();
  let n = 7;
  const rand = () => { n = (n * 16807) % 2147483647; return n / 2147483647; };
  for (const item of shipped(japanese)) {
    if (item.type === 'teach') { for (const c of kanaIn(item.show)) taught.add(c); continue; }
    for (let i = 0; i < 12; i++) {
      const v = japanese.vary(item, rand);
      assert.equal(quizProblem(v), null, item.id);
      assert.equal(v.id, item.id);
      for (const c of kanaIn([v.show, v.options, v.answer, v.tiles, v.pairs, v.speak])) assert.ok(taught.has(c), `${item.id}: ${c} not taught yet`);
      if (item.type === 'pick') {
        assert.notEqual(v.prompt, item.prompt, item.id);
        seen.add(v.listen ? 'heard' : /[\u3040-\u309f]/.test(v.answer) ? 'to kana' : 'to sound');
        const kana = /[\u3040-\u309f]/.test(v.answer) ? v.answer : v.show;
        assert.equal(kana, /[\u3040-\u309f]/.test(item.answer) ? item.answer : item.show, 'still the same kana');
        assert.equal(v.speak, kana);
      }
      if (item.type === 'build') assert.deepEqual(v.answer, item.answer);
    }
  }
  assert.deepEqual([...seen].sort(), ['heard', 'to kana', 'to sound']);
  const unknown = { id: 'nope', type: 'pick', show: 'あ', prompt: 'x', options: ['a', 'i'], answer: 'a' };
  assert.equal(japanese.vary(unknown), unknown, 'an unknown item stays as written');
});

test('a miss comes back until it has landed, and takes its echo with it', () => {
  const remake = () => 'fresh';
  const q = [{ key: 'a' }, { key: 'b' }, { key: 'a', echo: true }, { key: 'b', echo: true }];
  assert.equal(comeBack(q, 0, q[0], true, remake), false);
  assert.equal(q.length, 4, 'right first time: nothing extra');
  comeBack(q, 1, q[1], false, remake);
  assert.deepEqual(q.map((e) => [e.key, !!e.echo, !!e.retry]), [['a', false, false], ['b', false, false], ['a', true, false], ['b', false, true]]);
  comeBack(q, 3, q[3], true, remake);
  assert.equal(q.length, 4, 'landed after one miss');
  const once = { key: 'c', once: true, echo: true };
  assert.equal(comeBack([once], 0, once, false, remake), false, 'a step back never returns');
  const echo = { key: 'd', echo: true };
  const eq = [echo];
  comeBack(eq, 0, echo, false, remake);
  assert.deepEqual([eq[1].retry, eq[1].echo], [true, false], 'a missed echo comes back too');
});

test('a session stops adding repeats at RETRIES and says it has left the rest for review', () => {
  const q = Array.from({ length: RETRIES + 2 }, (_, i) => ({ key: `k${i}` }));
  const before = q.length;
  const left = [...q].map((e, i) => comeBack(q, i, e, false, () => 'x'));
  assert.equal(q.length, before + RETRIES);
  assert.deepEqual(left.slice(-2), [true, true]);
  assert.equal(left[0], false);
  const p = [{ key: 'a', echo: true }, { key: 'b', echo: true, once: true }, { key: 'c' }];
  dropEchoes(p, 0);
  assert.deepEqual(p.map((e) => e.key), ['b', 'c'], 'dropping echoes keeps a step back');
});

test('warm-ups do not open two lessons in a row with the same card', () => {
  const cards = { 'c:a': { due: '2026-01-01' }, 'c:b': { due: '2026-01-02' }, 'c:c': { due: '2026-01-03' } };
  assert.deepEqual(warmUps(cards, () => true, [], 2, {}, ['c:a']), ['c:b', 'c:c']);
  assert.deepEqual(warmUps(cards, () => true, [], 2, { 'c:a': 5 }, ['c:a', 'c:b', 'c:c']), [], 'nothing rather than the same card');
});
