import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEASONS, season, southern } from '../src/garden/season.js';
import { garden } from '../src/garden/model.js';
import { emptyProgress } from '../src/progress.js';
import { scene } from '../src/garden/art.js';

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
  const winter = garden(p, on(2026, 7, 15), true);
  const summer = garden(p, on(2026, 7, 15));
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
