import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAsk } from '../src/keep.js';

const ok = { asks: true, asked: false, entries: 1, kept: false };
test('asks the person once, at home, with something to keep', () => {
  assert.equal(shouldAsk(ok), true);
  for (const off of [{ asks: false }, { asked: true }, { entries: 0 }, { kept: true }, { kept: undefined }]) {
    assert.equal(shouldAsk({ ...ok, ...off }), false, JSON.stringify(off));
  }
});
