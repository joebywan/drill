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

// A mask on the tabs row, which scrolls sideways, stopped Firefox for Android drawing home on the emulator for good: the
// screen kept the last tab shown, then screencap hung and Android's graphics service spun (phone run stall). #164 was the
// same in Chrome. Fades over a box that scrolls are plain gradients in its colour (scrollBox() in src/fit.js).
test('no box that scrolls has a CSS mask', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, sel, body]) => ({ sel: sel.split(',').map((s) => s.trim()), body }));
  const scrolls = new Set(rules.filter((r) => /overflow(-[xy])?:\s*(auto|scroll)/.test(r.body)).flatMap((r) => r.sel));
  const masked = rules.filter((r) => /mask(-image)?:\s*(?!none)/.test(r.body)).flatMap((r) => r.sel);
  assert.deepEqual(masked.filter((s) => scrolls.has(s) || [...scrolls].some((x) => x.endsWith(` ${s}`) || s.endsWith(` ${x}`))), []);
});
