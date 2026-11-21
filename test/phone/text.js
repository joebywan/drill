// Large text through the phone's own font size, for a browser that passes it on (Firefox for Android does by default;
// Chrome 133 does not, see zoom.js): run with PHONE_FONT=1.3 or 2.0 (`npm run phone -- --browser firefox text`).
// Prints what the page sees (its width, devicePixelRatio, 1rem in px, --text-scale), then the large-text tour (lib/fits.js).
import { textTour } from './lib/fits.js';

export default async (h) => {
  const { page, seed, check, adb } = h;
  await seed();
  const font = adb('shell', 'settings get system font_scale').trim();
  const sees = await page.evaluate(() => ({
    width: innerWidth, dpr: devicePixelRatio, rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
    textScale: getComputedStyle(document.documentElement).getPropertyValue('--text-scale').trim() || null,
  }));
  console.log(`  font_scale ${font}: the page sees ${JSON.stringify(sees)}`);
  await textTour(h, check, `font-${font}`);
};
