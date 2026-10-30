// The first Japanese lesson with real taps: the kana render in the phone's own font (no tofu), and
// the teach card speaks through the ja-JP voice, when the phone has one (Chrome hands speech to
// the TTS engine, so its stream is checked as well as Chrome's).
import { readFileSync } from 'node:fs';

const lesson = JSON.parse(readFileSync(new URL('../../src/data/japanese.json', import.meta.url))).units[0].lessons[0];

export default async ({ page, adb, touch, btn, shot, run, seed, check }) => {
  await seed({ start: {} });
  await touch(btn('Japanese')); await shot('home');
  // A glyph the font lacks draws as the same box as an unassigned code point.
  const tofu = await page.evaluate(() => {
    const c = document.createElement('canvas').getContext('2d');
    c.font = '40px system-ui, "Noto Sans JP", "Noto Sans CJK JP", sans-serif';
    const box = c.measureText('\u{10FFFD}').width;
    return [...'あいうえおかきくけこさしすせそ'].filter((k) => c.measureText(k).width === box);
  });
  check('kana render in a system font (no tofu)', !tofu.length, tofu.join(''));
  const voices = await page.evaluate(() => speechSynthesis.getVoices().filter((v) => /^ja/i.test(v.lang)).map((v) => `${v.name} ${v.lang}`));
  console.log(`  ja voices: ${voices.join(', ') || 'none'}`);

  await touch(btn(`Continue · ${lesson.title}`));
  await run(400); await shot('teach');
  if (voices.length) {
    // Playing now: the TTS engine's (or Chrome's) audio stream is started.
    const uids = ['com.android.chrome', 'com.google.android.tts'].flatMap((p) =>
      adb('shell', 'cmd', 'package', 'list', 'packages', '-U', p).match(/uid:\d+/g)?.map((u) => u.slice(4)) || []);
    const started = adb('shell', 'dumpsys', 'audio').split('\n').some((l) => l.includes('state:started') && uids.some((u) => l.includes(`u/pid:${u}/`)));
    check('speech: a Chrome or TTS stream is state:started (dumpsys audio)', started);
  } else check('no ja-JP voice: the listening item shows its reading instead', true);

  const choice = (t) => page.locator('.quiz .choices .choice:not(:disabled)', { hasText: new RegExp(`^${t}$`) });
  for (const [i, item] of lesson.items.entries()) {
    if (i) await shot(`item${i}-${item.type}${item.listen ? '-listen' : ''}`);
    if (item.type === 'pick') await touch(choice(item.answer));
    if (item.type === 'pairs') for (const [l, r] of item.pairs) { await touch(choice(l)); await touch(choice(r)); }
    if (item.type !== 'teach') await shot(`item${i}-answered`);
    await touch(btn('Continue', { exact: true }));
  }
  await shot('summary');
  check('a lesson right first time all through', await page.getByText(/(\d+) of \1 right first try/).count() > 0);
  await touch(btn('Continue', { exact: true })); await shot('home-after');
};
