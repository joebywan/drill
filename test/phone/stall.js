// Firefox for Android on the emulator stopped drawing home a month in: the page whole in the DOM, the screen its
// background only, then `screencap` never returning and Android's graphics composer and allocator at full CPU until
// system_server restarted. This loads that home again and again and times a screenshot each time, so the screen
// stalling shows as a number. STALL_STYLE='<css>' adds a style to every load, to find the rule that does it.
import { atTop, showTab, thirtyDays } from './lib/seed.js';

export default async (h) => {
  const { page, seed, touch, check, grab, shot } = h;
  const css = process.env.STALL_STYLE;
  if (css) await page.addInitScript((c) => addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = c; document.head.append(s); }), css);
  console.log(`  style added: ${css ?? 'none'}`);
  let stalled = 0, last = null;
  for (let i = 0; i < 8 && !stalled; i++) {
    await seed(thirtyDays(i % 3));
    for (const tab of ['calm', 'move', 'walk']) {
      await showTab({ page, touch }, tab); await atTop(page);
      const t = Date.now();
      let spread = null;
      try {
        const g = grab(), px = [];
        for (let y = 500; y < 2100; y += 13) for (let x = 40; x < 1040; x += 13) px.push(g.at(x, y).reduce((a, b) => a + b, 0));
        const mean = px.reduce((a, b) => a + b, 0) / px.length;
        spread = Math.round(Math.sqrt(px.reduce((a, b) => a + (b - mean) ** 2, 0) / px.length));
        // The same picture for a different tab is a screen that stopped changing.
        const same = last && last.sum === px.join() && last.tab !== tab;
        last = { sum: px.join(), tab };
        if (same) { stalled++; console.log(`  load ${i + 1} ${tab}: the screen still shows the tab before: it stopped changing`); break; }
      } catch (e) { stalled++; console.log(`  load ${i + 1} ${tab}: screencap gave up (${e.message.split('\n')[0].slice(0, 80)})`); break; }
      console.log(`  load ${i + 1} ${tab}: screencap ${Date.now() - t} ms, drawn ${spread}`);
      if (spread < 10) { stalled++; await shot(`blank-${i + 1}-${tab}`).catch(() => {}); break; }
    }
  }
  check(`home a month in is drawn on every load and tab (style: ${css ?? 'none'})`, !stalled);
};
