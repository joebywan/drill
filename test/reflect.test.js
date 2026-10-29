import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayDetail } from '../src/reflect/practice.js';
import { subjects } from '../src/subjects.js';

test("a day's own lines show in the habit view, safely, and an empty day adds nothing", () => {
  const progress = { journal: { '2026-10-30': { good: 'Tea <b>in</b> the sun', tomorrow: 'Call Sam' } } };
  const html = dayDetail(progress, '2026-10-30');
  assert.match(html, /Good<\/span> Tea &#60;b&#62;in&#60;\/b&#62; the sun/);
  assert.match(html, /Tomorrow<\/span> Call Sam/);
  assert.doesNotMatch(html, /Learned/);
  assert.equal(dayDetail(progress, '2026-10-29'), '');
  assert.equal(dayDetail({}, '2026-10-30'), '');
  assert.equal(subjects.find((s) => s.habit === 'reflect').dayDetail, dayDetail);
});
