import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAsk } from '../src/keep.js';

const ok = { asks: true, asked: false, entries: 1, kept: false };
test('asks the person once, at home, with something to keep', () => {
  assert.equal(shouldAsk(ok), true);
  for (const off of [{ asks: false }, { asked: true }, { entries: 0 }, { kept: true }]) {
    assert.equal(shouldAsk({ ...ok, ...off }), false, JSON.stringify(off));
  }
});

test('storage not yet known still counts as something to ask', () => assert.equal(shouldAsk({ ...ok, kept: undefined }), true));
