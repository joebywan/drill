// Large text in Chrome itself: Chrome for Android's own setting, Settings › Accessibility › Default zoom ("Make text and
// images larger or smaller for all sites you visit", 50 to 300 %). Chrome 133 has no text-only scaling and doesn't follow
// the phone's font size (font_scale), so this is how a browser shows the page larger. It zooms the whole page, like a
// desktop browser's zoom: the page is laid out narrower in CSS px (412 / zoom) and drawn bigger, so the app sees a narrow
// phone, not larger text (--text-scale stays unset). Set by real taps on Chrome's screen (`uiautomator`), toured at 150 %
// and 200 % with the large-text tour (lib/fits.js), and put back to 100 % at the end.
import { textTour, uiNode } from './lib/fits.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async (h) => {
  if (h.browser !== 'chrome') return console.log(`  zoom: Chrome's own Default zoom setting; ${h.browser} follows the phone's font size instead, which text.js plays (PHONE_FONT=1.3, 2.0)`);
  const { page, adb, screenXml, shot, calibrate, check } = h;
  const sh = (c) => adb('shell', c);
  /** Taps the first of Chrome's own views matching `re`, scrolling down a few times to find it. */
  const tapUi = async (re, scrolls = 0) => {
    for (let i = 0; i <= scrolls; i++) {
      const n = uiNode(await screenXml(), re);
      if (n) { sh(`input tap ${n.at.join(' ')}`); await sleep(1500); return; }
      sh('input swipe 540 1800 540 700 400'); await sleep(1000);
    }
    throw new Error(`Chrome's screen has no ${re}`);
  };
  /** Chrome's menu › Settings › Accessibility › Default zoom, − or + until it reads `pct` %, then back to the page. */
  const zoom = async (pct) => {
    await tapUi(/^(More options|Customize and control Google Chrome)$/);
    await tapUi(/^Settings$/, 3);
    await tapUi(/^Accessibility$/, 6);
    for (let i = 0; i < 20; i++) {
      const now = Number(uiNode(await screenXml(), /^\d+ %$/)?.text.slice(0, -2));
      if (now === pct) break;
      await tapUi(now < pct ? /^Increase zoom$/ : /^Decrease zoom$/);
    }
    const reads = uiNode(await screenXml(), /^\d+ %$/)?.text;
    await shot(`setting-${pct}`);
    check(`Default zoom reads ${pct} %`, reads === `${pct} %`, reads);
    sh('input keyevent KEYCODE_BACK'); await sleep(1000);
    sh('input keyevent KEYCODE_BACK'); await sleep(1500);
    await page.reload({ waitUntil: 'networkidle' });
    await calibrate(); // devicePixelRatio is the zoom times the screen's
  };
  const measure = () => page.evaluate(() => ({ w: innerWidth, dpr: devicePixelRatio, scale: getComputedStyle(document.documentElement).getPropertyValue('--text-scale') }));

  const before = await measure();
  try {
    for (const pct of [150, 200]) {
      await zoom(pct);
      const m = await measure();
      console.log(`  zoom ${pct} %: ${JSON.stringify(m)}`);
      check(`zoom ${pct} %: the page is laid out ${pct / 100}× narrower`, Math.abs(m.w - (before.w * 100) / pct) <= 2, `${before.w} → ${m.w} CSS px`);
      check(`zoom ${pct} %: --text-scale stays unset (everything grows together)`, !m.scale);
      await textTour(h, check, `zoom ${pct}`, { reach: pct === 200 }); // 206px is past what the app promises: nothing lost, all reachable
    }
  } finally {
    await zoom(100).catch((e) => check('Default zoom put back to 100 %', false, e.message.split('\n')[0]));
  }
};
