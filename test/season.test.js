import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEASONS, season, southern } from '../src/garden/season.js';
import { garden } from '../src/garden/model.js';
import { emptyProgress } from '../src/progress.js';
import { drawGarden, landmark, scene } from '../src/garden/art.js';
import { EVENTS, eventOn, lessonOf } from '../src/garden/events.js';
import { award } from '../src/garden/model.js';
import { finishSession } from '../src/progress.js';
import { subjects } from '../src/subjects.js';
import { problem as chessProblem } from '../src/chess/items.js';
import { problem as mathsProblem } from '../src/maths/items.js';
import { problem as codingProblem } from '../src/coding/program.js';

const on = (y, m, d) => new Date(y, m - 1, d); // local dates, as the device reads them

test('the season follows the month, meteorological, and flips south of the equator', () => {
  const north = [[1, 'winter'], [2, 'winter'], [3, 'spring'], [5, 'spring'], [6, 'summer'], [8, 'summer'], [9, 'autumn'], [11, 'autumn'], [12, 'winter']];
  const flip = { spring: 'autumn', autumn: 'spring', summer: 'winter', winter: 'summer' };
  for (const [m, s] of north) {
    assert.equal(season(on(2026, m, 15)), s, `north month ${m}`);
    assert.equal(season(on(2026, m, 15), true), flip[s], `south month ${m}`);
  }
  // The edges: the last day of a season and the first of the next.
  assert.equal(season(on(2026, 2, 28)), 'winter');
  assert.equal(season(on(2026, 3, 1)), 'spring');
  assert.equal(season(on(2026, 11, 30), true), 'spring');
  assert.equal(season(on(2026, 12, 1), true), 'summer');
  assert.equal(season(on(2027, 1, 1)), 'winter', 'the new year is still winter up north');
});

test('the hemisphere is guessed from the timezone: Australia is south, anything unknown is north', () => {
  for (const z of ['Australia/Sydney', 'Australia/Perth', 'Australia/Hobart', 'Australia/Darwin', 'Pacific/Auckland', 'America/Sao_Paulo', 'America/Argentina/Buenos_Aires', 'Africa/Johannesburg']) assert.ok(southern(z), z);
  for (const z of ['Europe/London', 'America/New_York', 'Asia/Tokyo', 'Pacific/Honolulu', 'UTC', 'Etc/GMT', '', undefined]) assert.ok(!southern(z), String(z));
});

test('the garden carries its season; plants and mood are untouched by it', () => {
  const p = emptyProgress();
  const winter = garden(p, on(2026, 7, 25), true); // past the event, which differs by hemisphere too
  const summer = garden(p, on(2026, 7, 25));
  assert.equal(winter.season, 'winter');
  assert.equal(summer.season, 'summer');
  assert.deepEqual({ ...winter, season: null }, { ...summer, season: null });
});

test('each season draws its own scene, and an unknown one is summer', () => {
  const drawn = SEASONS.map((s) => scene('sunlit', 'tall', s));
  assert.equal(new Set(drawn).size, 4);
  for (const [i, s] of SEASONS.entries()) assert.match(drawn[i], new RegExp(`season-${s}`));
  assert.equal(scene('sunlit', 'tall', 'monsoon'), scene('sunlit', 'tall', 'summer'));
  assert.equal(scene('sunlit', 'tall'), scene('sunlit', 'tall', 'summer'));
});

test('an event runs the 8th to the 21st of its month, 14 days a year, inside its own season, either hemisphere', () => {
  for (const south of [false, true]) {
    const seen = {};
    for (let d = on(2027, 1, 1); d.getFullYear() === 2027; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const e = eventOn(d, south);
      if (!e) continue;
      seen[e.id] = (seen[e.id] || 0) + 1;
      assert.equal(season(d, south), e.season, `${e.id} on ${d}`);
    }
    assert.deepEqual(seen, Object.fromEntries(EVENTS.map((e) => [e.id, 14])));
  }
  assert.equal(eventOn(on(2027, 1, 7)), null);
  assert.equal(eventOn(on(2027, 1, 8)).id, 'winter-festival');
  assert.equal(eventOn(on(2027, 1, 21)).id, 'winter-festival');
  assert.equal(eventOn(on(2027, 1, 22)), null);
});

test('Australia gets the flipped calendar: summer boards in January, the winter festival in July', () => {
  assert.equal(eventOn(on(2027, 1, 10), true).id, 'summer-tournament');
  assert.equal(eventOn(on(2027, 4, 10), true).id, 'autumn-harvest');
  assert.equal(eventOn(on(2027, 7, 10), true).id, 'winter-festival');
  assert.equal(eventOn(on(2027, 10, 10), true).id, 'spring-market');
  assert.equal(eventOn(on(2027, 7, 10), false).id, 'summer-tournament');
});

test('an event repaints the sky and the land in both themes, on both shapes, and changes nothing without one', () => {
  for (const e of EVENTS) for (const shape of ['strip', 'tall']) {
    const plain = scene('sunlit', shape, e.season);
    const dressed = scene('sunlit', shape, e.season, e.id);
    assert.notEqual(dressed, plain);
    assert.match(dressed, new RegExp(`event-${e.id}`));
    assert.ok(dressed.length > plain.length + 500, `${e.id} ${shape} barely changes`);
  }
  assert.equal(scene('sunlit', 'tall', 'winter', 'no-such-event'), scene('sunlit', 'tall', 'winter'));
  const p = garden(emptyProgress(), on(2027, 1, 10), true);
  assert.match(drawGarden(p, 'tall'), /event-summer-tournament/);
  assert.doesNotMatch(drawGarden(garden(emptyProgress(), on(2027, 1, 25), true), 'tall'), /event-/);
});

test('finishing a set grants its gift directly, for good, and leaves no review cards; missing one takes nothing', () => {
  for (const e of EVENTS) {
    const before = emptyProgress();
    assert.equal(award(before, on(2027, 1, 10)).newly.length, 0, 'nothing for an event not played');
    const after = finishSession(before, lessonOf(e), e.items.map(() => ({ correct: true })), on(2027, 1, 10), { title: e.title });
    const { progress, newly } = award(after, on(2027, 1, 10), (r) => r.habit === null);
    assert.ok(newly.some((r) => r.gift === e.gift), e.id);
    assert.deepEqual(after.cards, {});
    // Long past the event, the gift is still drawn.
    const later = garden(progress, on(2028, 5, 30));
    assert.ok(later.landmarks.some((l) => l.gift === e.gift));
    assert.match(landmark(e.gift), new RegExp(`landmark-${e.gift}`));
    assert.match(drawGarden(later, 'tall'), new RegExp(`data-landmark="${e.gift}"`));
  }
});

test("every event's set plays on its subject and passes that subject's own check", () => {
  const checks = { chess: chessProblem, maths: mathsProblem, coding: codingProblem };
  for (const e of EVENTS) {
    assert.ok(subjects.some((s) => s.id === e.subject), e.subject);
    assert.ok(e.items.length >= 2);
    for (const item of e.items) if (checks[e.subject]) assert.equal(checks[e.subject](item), null, item.id);
  }
});
