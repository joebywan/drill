import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// A long press on a tile selected its arrow and raised Android's Copy / Share toolbar over the buttons (phone run touch-press).
test('buttons and the board cannot be selected by a held finger', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /button, \.cm-chessboard \{[^}]*user-select: none/);
});

test('the page does not hand a pull down to the browser\'s pull-to-refresh', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /html, body \{ overscroll-behavior-y: none; \}/);
});
