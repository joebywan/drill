import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, finishPractice, finishSession, logToday, noteFeel, track, writeJournal, currentStreak } from '../src/progress.js';
import { derive, newPairCode, newRecovery, open, readRecovery, seal, unwrap, wrap } from '../src/sync/keys.js';
import { merge } from '../src/sync/merge.js';
import { card, lookOf, withLook } from '../src/sync/sync.js';
import { checkCard } from '../src/sync/presets.js';
import { createHash } from 'node:crypto';
import { qr, qrSvg } from '../src/sync/qr.js';
import { matrixOf, readQr } from './qr-read.js';

const json = (p) => JSON.parse(JSON.stringify(p)); // as stored: dates are strings
const at = (date, hour = 9) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
const lesson = (p, id, date, correct = true) => json(finishSession(p, `chess:${id}`, [{ key: `chess:${id}-1`, correct }], at(date), { title: id, mins: 3 }));
const calm = (p, date, title = 'Breathe') => json(finishPractice(p, 'calm', null, at(date), { title, mins: 2 }));

test('a recovery code round-trips, read forgivingly', () => {
  const code = newRecovery();
  assert.match(code, /^([0-9A-HJKMNP-TV-Z]{4}-){4}[0-9A-HJKMNP-TV-Z]{4}$/);
  assert.equal(readRecovery(code.toLowerCase().replace(/-/g, ' ')), code);
  assert.equal(readRecovery('0000-1111-2222-3333-4444'), '0000-1111-2222-3333-4444');
  assert.equal(readRecovery('oooo-iiii-llll-3333-4444'), '0000-1111-1111-3333-4444');
  assert.equal(readRecovery('too short'), null);
  assert.equal(readRecovery('UUUU-1111-2222-3333-4444'), null);
});

test('progress sealed with a recovery code opens with it and with nothing else', async () => {
  const code = newRecovery();
  const { key, token } = await derive(code);
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal((await derive(code)).token, token, 'the same code gives the same token on every device');
  assert.notEqual((await derive(newRecovery())).token, token);
  const p = lesson(emptyProgress(), 'a', '2026-10-01');
  const blob = await seal(key, p);
  assert.doesNotMatch(atob(blob), /chess/, 'nothing readable on the way');
  assert.deepEqual(await open(key, blob), p);
  assert.deepEqual(await open((await derive(code)).key, blob), p);
  await assert.rejects(open((await derive(newRecovery())).key, blob));
  const tampered = blob.slice(0, 20) + (blob[20] === 'A' ? 'B' : 'A') + blob.slice(21);
  await assert.rejects(open(key, tampered));
});

test('a big progress seals and opens', async () => {
  const { key } = await derive(newRecovery());
  const p = { ...emptyProgress(), done: Object.fromEntries(Array.from({ length: 30000 }, (_, i) => [`x:${i}`, true])) };
  assert.deepEqual(await open(key, await seal(key, p)), p);
});

test('a pairing code wraps the recovery code for a new device', async () => {
  const code = newPairCode();
  assert.match(code, /^\d{6}$/);
  const recovery = newRecovery();
  const wrapped = await wrap(code, recovery);
  assert.doesNotMatch(wrapped, new RegExp(recovery));
  assert.equal(await unwrap(code, wrapped), recovery);
  await assert.rejects(unwrap(code === '000000' ? '000001' : '000000', wrapped));
});

test('merging a copy with itself, or again, changes nothing', () => {
  let p = lesson(emptyProgress(), 'a', '2026-10-01');
  p = calm(p, '2026-10-02');
  p = writeJournal(p, { good: 'tea' }, at('2026-10-02'));
  assert.deepEqual(merge(p, p), p);
  const q = calm(lesson(emptyProgress(), 'b', '2026-10-03'), '2026-10-03');
  const m = merge(p, q);
  assert.deepEqual(merge(m, m), m);
  assert.deepEqual(merge(p, m), m, 'syncing the merged copy back changes nothing');
  assert.deepEqual(merge(m, p), m);
  assert.deepEqual(merge(m, q), m);
});

test('merging is the same from either side', () => {
  const a = calm(lesson(emptyProgress(), 'a', '2026-10-01'), '2026-10-02');
  const b = calm(lesson(emptyProgress(), 'b', '2026-10-03'), '2026-10-04', 'Sigh');
  const ab = merge(a, b);
  const ba = merge(b, a);
  assert.deepEqual(ab.habits, ba.habits);
  assert.deepEqual(ab.done, ba.done);
  assert.deepEqual(ab.cards, ba.cards);
  assert.deepEqual(new Set(ab.log.map(JSON.stringify)), new Set(ba.log.map(JSON.stringify)));
});

test('FSRS cards merge per card: the latest review wins', () => {
  const base = lesson(emptyProgress(), 'a', '2026-10-01');
  const phone = lesson(base, 'a', '2026-10-05', true); // reviewed later, on the phone
  const laptop = lesson(lesson(base, 'b', '2026-10-03'), 'a', '2026-10-03', false);
  const m = merge(laptop, phone);
  assert.deepEqual(m.cards['chess:a-1'], phone.cards['chess:a-1']);
  assert.deepEqual(m.cards['chess:b-1'], laptop.cards['chess:b-1'], 'a card only one side has is kept');
  assert.deepEqual(merge(phone, laptop).cards, m.cards);
});

test('the log is a union: shared sessions once, each side\'s own kept, oldest first', () => {
  const base = calm(emptyProgress(), '2026-10-01');
  const a = calm(calm(base, '2026-10-02'), '2026-10-02'); // two identical sessions on one device
  const b = calm(base, '2026-10-03', 'Sigh');
  const m = merge(a, b);
  assert.deepEqual(m.log.map((e) => `${e.date} ${e.title}`), ['2026-10-01 Breathe', '2026-10-02 Breathe', '2026-10-02 Breathe', '2026-10-03 Sigh']);
  // "How do you feel?" answered on the other device is not a second session.
  const felt = noteFeel(base, 'calm', 'better');
  assert.deepEqual(merge(base, felt).log, felt.log);
  assert.deepEqual(merge(felt, base).log, felt.log);
});

test('streaks are replayed from the merged log', () => {
  // Mon, Wed, Fri on one device, Tue and Thu on the other: five days in a row together.
  let a = emptyProgress();
  let b = emptyProgress();
  for (const d of ['05', '07', '09']) a = calm(a, `2026-10-${d}`);
  for (const d of ['06', '08']) b = calm(b, `2026-10-${d}`);
  assert.ok(a.habits.calm.count < 5);
  const m = merge(a, b);
  assert.equal(m.habits.calm.count, 5);
  assert.equal(m.habits.calm.last, '2026-10-09');
  assert.equal(m.habits.calm.days, 5);
  assert.deepEqual(m.habits.calm.forgiven, []);
  assert.equal(currentStreak(m, at('2026-10-09'), 'calm'), 5);
  // Learning: a lesson in a repairable gap waits for a review, wherever the review was done.
  let x = lesson(lesson(emptyProgress(), 'a', '2026-10-01'), 'b', '2026-10-02');
  x = lesson(x, 'c', '2026-10-05'); // two missed days: waits for a review
  assert.equal(x.habits.learn.count, 2);
  const y = finishSession(x, null, [{ key: 'chess:a-1', correct: true }], at('2026-10-05'), { title: 'Review', mins: 2 });
  assert.equal(merge(x, y).habits.learn.count, 3);
});

test('a streak older than the log is never lowered by a merge', () => {
  const long = { ...calm(emptyProgress(), '2026-10-01'), habits: { learn: { count: 0, last: null, forgiven: [], days: 0 }, calm: { count: 400, last: '2026-10-01', forgiven: [], days: 420 } } };
  const other = calm(emptyProgress(), '2026-10-02');
  const m = merge(long, other);
  assert.equal(m.habits.calm.count, 401);
  assert.equal(m.habits.calm.days, 421);
  // A save from before the log: no log to replay, so the later streak is kept as it is.
  const old = { ...emptyProgress(), habits: { learn: { count: 12, last: '2026-09-30', forgiven: [], days: 12 } } };
  assert.deepEqual(merge(old, emptyProgress()).habits.learn, old.habits.learn);
});

test('done, garden, journal, tracked and timings merge as unions', () => {
  let a = lesson(emptyProgress(), 'a', '2026-10-01');
  let b = lesson(emptyProgress(), 'b', '2026-10-02');
  a = { ...a, garden: { earned: { first: '2026-10-01', week: '2026-10-08' } }, timings: { calm: { breaths: 6 } }, picked: ['calm'] };
  b = { ...b, garden: { earned: { first: '2026-10-02', tree: '2026-10-02' } }, timings: { calm: { hold: 3, breaths: 4 }, move: { reps: 5 } } };
  a = writeJournal(a, { good: 'tea', learned: 'forks' }, at('2026-10-01'));
  b = writeJournal(b, { good: 'a walk' }, at('2026-10-01'));
  b = writeJournal(b, { tomorrow: 'rest' }, at('2026-10-02'));
  a = logToday(track(a, { id: 'walk' }), 'walk', 'Walk', at('2026-10-01'));
  b = track(track(b, { id: 'walk', hidden: true }), { id: 'water' });
  const m = merge(a, b);
  assert.deepEqual(m.done, { 'chess:a': true, 'chess:b': true });
  assert.deepEqual(m.garden.earned, { first: '2026-10-01', week: '2026-10-08', tree: '2026-10-02' });
  assert.deepEqual(m.journal, { '2026-10-01': { good: 'tea\na walk', learned: 'forks' }, '2026-10-02': { tomorrow: 'rest' } });
  assert.deepEqual(m.tracked.map((t) => t.id), ['walk', 'water']);
  assert.deepEqual(m.timings, { calm: { hold: 3, breaths: 6 }, move: { reps: 5 } });
  assert.deepEqual(m.picked, ['calm']);
  assert.equal(m.habits.walk.count, 1);
  assert.deepEqual(merge(m, m), m);
});

test('a habit of your own made on each device before linking stays two habits', () => {
  let a = track(emptyProgress(), { name: 'Piano', icon: '🎹' });
  let b = track(emptyProgress(), { name: 'Water', icon: '💧' });
  a = logToday(a, 'own-1', 'Piano', at('2026-10-01'));
  b = logToday(b, 'own-1', 'Water', at('2026-10-02'));
  const m = merge(a, b);
  assert.deepEqual(m.tracked.map((t) => [t.id, t.name]), [['own-1', 'Piano'], ['own-2', 'Water']]);
  assert.deepEqual(m.log.map((e) => [e.habit, e.title]), [['own-1', 'Piano'], ['own-2', 'Water']]);
  assert.equal(m.habits['own-2'].count, 1);
  // The other device, merging the result back, finds its Water under the new id: no copy.
  const back = merge(b, m);
  assert.deepEqual(back.tracked.map((t) => t.name).sort(), ['Piano', 'Water']);
  assert.equal(back.log.length, 2);
  assert.deepEqual(merge(m, back), m, 'and the first device, merging that, is where it was');
});

test('merge refuses what isn\'t progress', () => {
  assert.equal(merge(emptyProgress(), { nope: 1 }), null);
  assert.equal(merge(null, emptyProgress()), null);
});

test('the public card carries numbers and presets only, never the journal or the log', () => {
  let p = lesson(lesson(emptyProgress(), 'a', '2026-10-01'), 'b', '2026-10-02');
  p = writeJournal(p, { good: 'secret words' }, at('2026-10-02'));
  const c = card(withLook(p, { word: 'Sunny', animal: 'fox' }), at('2026-10-02'));
  assert.deepEqual(Object.keys(c).sort(), ['animal', 'lessons', 'streak', 'unit', 'word']);
  assert.equal(c.lessons, 2);
  assert.equal(c.streak, 2);
  assert.ok(checkCard(c));
  assert.doesNotMatch(JSON.stringify(c), /secret|Lesson|chess:a/);
  assert.equal(checkCard({ ...c, word: 'Rude' }), null);
  assert.equal(checkCard({ ...c, unit: 'anything at all' }), null);
});

test('sessions split across two devices merge to what one device would have', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  for (let round = 0; round < 50; round++) {
    let one = emptyProgress();
    let a = emptyProgress();
    let b = emptyProgress();
    for (let d = 1; d <= 60; d++) {
      if (rand() < 0.35) continue; // a day off
      const date = `2026-0${d <= 30 ? 8 : 9}-${String(((d - 1) % 30) + 1).padStart(2, '0')}`;
      one = calm(one, date);
      if (rand() < 0.5) a = calm(a, date); else b = calm(b, date);
    }
    const m = merge(a, b);
    assert.deepEqual(m.habits.calm ?? null, one.habits.calm ?? null, `round ${round}`);
    assert.deepEqual(m.log, one.log);
  }
});

test('the card\'s name and animal live in progress and sync: the latest pick wins', () => {
  const base = { ...emptyProgress(), look: { word: 'Calm', animal: 'otter', at: new Date(0).toISOString() } };
  const phone = withLook(base, { word: 'Brave' }, at('2026-10-02'));
  const laptop = withLook(base, { animal: 'koala' }, at('2026-10-03')); // picked later
  assert.deepEqual(lookOf(merge(phone, laptop)), { word: 'Calm', animal: 'koala' });
  assert.deepEqual(merge(phone, laptop).look, merge(laptop, phone).look);
  assert.deepEqual(merge(phone, base).look, phone.look, 'a real pick beats the first random one');
  assert.deepEqual(merge(emptyProgress(), phone).look, phone.look, 'a device without one takes it');
  // Two first random looks, both at time zero: every device settles on the same one.
  const a = { ...emptyProgress(), look: { word: 'Sunny', animal: 'fox', at: new Date(0).toISOString() } };
  assert.deepEqual(merge(a, base).look, merge(base, a).look);
  // Anything outside the presets reads as the default, never as free text.
  assert.deepEqual(lookOf({ look: { word: 'Rude words', animal: 'owl' } }), { word: 'Sunny', animal: 'fox' });
});

const LONG = 'https://joebywan.github.io/drill/some/longer/path/here/too/so/it/needs/more/room/#pair=123456';

test('the QR encoder matches a reference encoder bit for bit, across versions and masks', () => {
  // SHA-256 of each matrix from python-qrcode (level M, byte mode, mask forced), computed once.
  const reference = {
    hi: ['043e4c6b95be7301', '38bf539942cd0442', 'add69b2b9199b2da', '80a9f3b98d70bedc'],
    'https://example.test/#pair=012345': ['d22a6a2ca4e18fed', 'dac449892116b43c', 'd7190a11b0f53140', '983905e29c7384ce'],
    'https://www.knowhowit.com.au/drill/index.html#pair=987654': ['a5ca318ab8587224', '4450ee665a7e86e8', '19924c95e9ff1aca', 'a1ba20d0deffaba1'],
    [LONG]: ['2274fb79a26e3f52', 'eac8b433dabd491f', 'cfdd27ea61c5bb43', 'e23f4f6fc22cf23b'],
  };
  for (const [text, hashes] of Object.entries(reference)) [0, 3, 5, 7].forEach((mask, i) => {
    const rows = qr(text, mask).map((r) => r.map(Number).join('')).join('\n');
    assert.equal(createHash('sha256').update(rows).digest('hex').slice(0, 16), hashes[i], `${text} mask ${mask}`);
  });
});

test('a pairing link reads back from the drawn svg, and text too long says so', () => {
  for (const text of ['https://example.test/#pair=012345', LONG]) assert.equal(readQr(matrixOf(qrSvg(text, 'x'))).text, text);
  assert.throws(() => qr('x'.repeat(107)), /too long/);
  assert.equal(readQr(qr('x'.repeat(106))).text, 'x'.repeat(106));
});
