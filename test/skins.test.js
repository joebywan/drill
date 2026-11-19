import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOODS } from '../src/cast/kit.js';
import { flap, lumi } from '../src/cast/lumi.js';
import { SKINS, skinOf, worn } from '../src/cast/skins.js';
import { SKIN_WORDS } from '../src/cast/lines.js';
import { EVENTS, lessonOf } from '../src/garden/events.js';
import { SKIN_RULES, award, garden } from '../src/garden/model.js';
import { emptyProgress, finishPractice, finishSession, migrate } from '../src/progress.js';
import { subjects } from '../src/subjects.js';

const day = (d) => new Date(2026, 9, d, 12);
const skins = (p, d = 28) => award(p, day(d)).newly.filter((r) => r.skin).map((r) => r.skin);
const practise = (p, habit, days) => {
  for (let d = 1; d <= days; d++) p = finishPractice(p, habit, null, day(d));
  return p;
};

test('seven skins, each with a name, a reason, and a rule of its own', () => {
  assert.deepEqual(SKINS.map((s) => s.id), SKIN_RULES.map(([id]) => id));
  assert.equal(SKINS.length, 7);
  for (const s of SKINS) assert.ok(SKIN_WORDS.names[s.id], s.id);
  assert.deepEqual(EVENTS.map((e) => e.skin), ['crown', 'sunglasses', 'strawhat', 'beanie']);
  assert.deepEqual(SKIN_RULES.map(([, , from]) => from).slice(2, 6), ['From the Spring market', 'From the Park tournament', 'From the Harvest', 'From the Winter festival']);
});

test('each skin is given by its own condition, and only then', () => {
  assert.deepEqual(skins(emptyProgress()), []);
  // A daisy for 7 days practised in all.
  assert.deepEqual(skins(practise(emptyProgress(), 'calm', 6)), []);
  assert.deepEqual(skins(practise(emptyProgress(), 'calm', 7)), ['daisy']);
  // A bow tie for full wings.
  assert.deepEqual(skins({ ...emptyProgress(), wings: Array(13).fill('learn') }), []);
  assert.deepEqual(skins({ ...emptyProgress(), wings: Array(14).fill('learn') }), ['bowtie']);
  // An event's skin comes with its landmark, for finishing its set.
  for (const e of EVENTS) {
    const { newly } = award({ ...emptyProgress(), done: { [lessonOf(e)]: true } }, day(9));
    assert.deepEqual(newly.map((r) => r.id).sort(), [`garden:${e.gift}`, `skin:${e.skin}`].sort(), e.id);
  }
  // The costume for the first butterfly raised: a whole course, finished in a day.
  const chess = subjects.find((s) => s.id === 'chess');
  let p = emptyProgress();
  for (const u of chess.units.slice(0, -1)) for (const l of u.lessons) p = finishSession(p, `chess:${l.id}`, [], day(3));
  assert.deepEqual(skins(p), [], 'a chrysalis is not yet');
  for (const l of chess.units.at(-1).lessons) p = finishSession(p, `chess:${l.id}`, [], day(3));
  assert.deepEqual(skins(p), ['costume']);
});

test('a skin is dated, never taken back, and never drawn as a landmark', () => {
  let p = { ...emptyProgress(), wings: Array(14).fill('learn') };
  p = award(p, day(4)).progress;
  assert.equal(p.garden.earned['skin:bowtie'], '2026-10-04');
  const later = award({ ...p, wings: [] }, day(9)).progress;
  assert.equal(later.garden.earned['skin:bowtie'], '2026-10-04');
  assert.deepEqual(garden(later, day(9)).landmarks, []);
});

test('the choice is kept, worn only once given, and migrate() accepts it', () => {
  const given = { ...emptyProgress(), garden: { earned: { 'skin:crown': '2026-10-01' } } };
  assert.equal(worn({ ...given, skin: 'crown' }), 'crown');
  assert.equal(worn({ ...given, skin: 'beanie' }), null, 'not given yet: just Lumi');
  assert.equal(worn(given), null);
  const back = migrate(JSON.parse(JSON.stringify({ ...given, skin: 'crown' })));
  assert.equal(back.skin, 'crown');
  assert.equal(worn(back), 'crown');
  const odd = migrate({ ...given, skin: 7 });
  assert.ok(odd, 'a bad skin drops the field, never the file');
  assert.equal('skin' in odd, false);
  assert.equal('skin' in migrate(emptyProgress()), false);
});

const WINGS = Array(14).fill('#4CAF73');
test('every mood renders in every skin, within the kit\'s size budget', () => {
  for (const s of SKINS) for (const m of MOODS) {
    const svg = lumi(m, s.id, WINGS);
    const at = `${s.id} ${m}`;
    assert.match(svg, /^<svg [^>]*viewBox="0 0 100 120"/, at);
    assert.doesNotMatch(svg, /undefined|NaN|null|\[object/, at);
    assert.ok(svg.length < 10 * 1024, `${at}: ${svg.length} bytes`);
    assert.equal(svg.match(/data-part="eyes"/g).length, 1, `${at}: one face to blink`);
    assert.equal(svg.match(/data-arm=/g).length, 2, `${at}: two flippers to flap`);
    assert.doesNotMatch(svg, /data-part="(wings|body)"[^]*data-part="body"/, `${at}: the costume's parts are nameless`);
    // A hat or glasses goes in her head group, so it nods with her.
    if (s.head) {
      const head = svg.slice(svg.indexOf('data-part="head"'), svg.indexOf('data-part="arms"'));
      assert.ok(head.includes(s.head.slice(0, 60)), `${at}: on her head`);
    }
  }
  for (const s of SKINS) assert.equal(new Set(MOODS.map((m) => lumi(m, s.id, WINGS))).size, MOODS.length, `${s.id}: moods still differ`);
  assert.equal(lumi('teach', 'cape'), lumi('teach'), 'an unknown skin is just Lumi');
  assert.equal(skinOf('cape'), null);
});

test("the costume's wings are the learner's own colours, and Lumi has none of her own", () => {
  assert.ok(lumi('teach', 'costume', ['#ABCDEF']).includes('#ABCDEF'));
  for (const s of SKINS.filter((k) => k.id !== 'costume')) assert.doesNotMatch(lumi('teach', s.id, ['#ABCDEF']), /#ABCDEF|clip-path/, s.id);
  assert.doesNotMatch(lumi('teach'), /clip-path/);
});

test('flap() beats both flippers, straps and all', () => {
  const arms = ['left', 'right'].map((arm) => ({ dataset: { arm }, style: {}, calls: [], animate(f) { this.calls.push(f); } }));
  flap({ querySelectorAll: (q) => (q === '[data-arm]' ? arms : []) });
  assert.deepEqual(arms.map((a) => a.style.transformOrigin), ['25px 62px', '75px 62px']);
  assert.match(arms[0].calls[0][1].transform, /-50deg/);
  assert.match(arms[1].calls[0][1].transform, /\(50deg/);
});
