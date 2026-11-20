// The installed Android app (android/, the debug build), for what only the app has: its launcher icon and
// no INTERNET, a first day in the WebView (butterfly.js and calm.js, played through the app, sound and
// haptics checked for its own package), Japanese through Android's TTS, the widget placed on the home
// screen through the launcher and seen flying, basking, resting and with a quiet habit, the daily note in
// the shade, the system bars in light, dark and Wind down, back, and the phone's large text.
// Build the APK first (CLAUDE.md, Android); with none, it says so and does nothing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import butterfly from './butterfly.js';
import calm from './calm.js';

const PKG = 'com.joebywan.wingbeat';
const APK = process.env.APP_APK || new URL('../../android/app/build/outputs/apk/debug/app-debug.apk', import.meta.url).pathname;
const OUT = new URL('../../test-results/phone/app/', import.meta.url).pathname;
const japanese = JSON.parse(readFileSync(new URL('../../src/data/japanese.json', import.meta.url))).units[0].lessons[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const day = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.toLocaleDateString('en-CA'); };
const hex = (rgb) => `#${rgb.match(/\d+/g).slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('')}`;
// What the note must never say: absence, loss or a streak at stake.
const ABSENCE = /miss|lost|lose|gone|away|absen|forgot|been a while|streak|come back|haven't/i;

export default async ({ adb, attach, check, screenXml, shot }) => {
  if (!existsSync(APK)) { console.log(`  no APK at ${APK}: build it first (CLAUDE.md, Android)`); return; }
  mkdirSync(OUT, { recursive: true });
  const keep = (name, text) => writeFileSync(`${OUT}${name}`, text);
  const sh = (cmd) => adb('shell', cmd);
  const [W, H] = sh('wm size').match(/(\d+)x(\d+)\s*$/).slice(1).map(Number);
  const key = async (k) => { sh(`input keyevent ${k}`); await sleep(1200); };
  const front = () => /mCurrentFocus=.*com\.joebywan\.wingbeat/.test(sh('dumpsys window | grep mCurrentFocus'));
  const logs = () => adb('logcat', '-d', '-v', 'brief', 'WingbeatBridge:*', 'WingbeatDaily:*', 'AndroidRuntime:E', '*:S');
  let earlier = ''; // the run's log before each clear, for the check at the end
  const clearLogs = () => { earlier += logs(); sh('logcat -c'); };
  /** The centre of the first on-screen node whose text or description matches. */
  const node = async (re, save) => {
    const xml = await screenXml();
    if (save) keep(`ui-${save}.xml`, xml);
    for (const [tag] of xml.matchAll(/<node [^>]*>/g)) {
      const [t, d] = [/ text="([^"]*)"/, / content-desc="([^"]*)"/].map((r) => tag.match(r)?.[1] ?? '');
      if (!re.test(t) && !re.test(d)) continue;
      const b = tag.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/).slice(1).map(Number);
      return [(b[0] + b[2]) >> 1, (b[1] + b[3]) >> 1];
    }
    return null;
  };
  const tap = async ([x, y]) => { sh(`input tap ${x} ${y}`); await sleep(1500); };
  /** One screen pixel as #rrggbb, from a raw screencap (its header is whatever precedes W*H*4 bytes of RGBA). */
  const pixel = (x, y) => '#' + sh(`screencap /sdcard/s.raw && s=$(stat -c %s /sdcard/s.raw) && dd if=/sdcard/s.raw bs=1 skip=$((s - ${W * H * 4} + ${(y * W + x) * 4})) count=3 2>/dev/null | od -An -tx1`).trim().split(/\s+/).join('');
  let app = null;
  /** Starts the app (from cold when `cold`) and attaches to its WebView. */
  const launch = async (cold) => {
    if (cold) sh(`am force-stop ${PKG}`);
    sh(`am start -W -n ${PKG}/.MainActivity`); await sleep(2500);
    app = await attach(PKG);
    return app;
  };

  // 1. Install and first launch.
  adb('install', '-r', APK);
  const pkgInfo = sh(`dumpsys package ${PKG}`);
  keep('dumpsys-package.txt', pkgInfo);
  check('no INTERNET permission', !pkgInfo.includes('android.permission.INTERNET'));
  clearLogs();
  await key('KEYCODE_HOME');
  sh(`input swipe ${W >> 1} ${H - 300} ${W >> 1} ${H >> 2} 300`); await sleep(1500); // the app drawer
  await shot('launcher-drawer');
  const icon = await node(/^Wingbeat$/, 'drawer');
  check('the launcher lists Wingbeat', !!icon);
  if (icon) await tap(icon); else sh(`am start -W -n ${PKG}/.MainActivity`);
  const opened = Date.now();
  await shot('first-launch');
  let shown = false;
  while (!(shown = /Small beats go a long way/.test(await screenXml())) && Date.now() - opened < 30000) await sleep(500);
  check('first launch: the intro shows within 10 s of the tap', shown && Date.now() - opened < 10000, `${((Date.now() - opened) / 1000).toFixed(1)} s`);
  await shot('first-launch-intro');
  check('first launch: the app is in front', front());
  app = await attach(PKG); // clears storage and reloads: a first visit again

  // 2. A first day: the intro, a lesson, its wingbeat and home's butterfly; then a Calm routine, heard and felt.
  await butterfly({ ...app, check });
  await calm({ ...app, check });

  // 7. Voice: Japanese speaks through the phone's TTS, or offers to get a voice, once.
  await app.seed({ start: {} });
  const hasVoice = await app.page.evaluate(() => WingbeatBridge.hasVoice('ja-JP'));
  console.log(`  ja-JP voice: ${hasVoice}; TTS engine: ${sh('settings get secure tts_default_synth').trim()}`);
  await app.touch(app.btn(/^Learning(,|$)/)); await app.touch(app.btn('Japanese'));
  await app.touch(app.btn(`Continue · ${japanese.title}`)); await app.run(400); await app.shot('japanese-teach');
  const getVoice = app.page.getByRole('button', { name: 'Get a Japanese voice' });
  if (hasVoice) {
    await app.touch(app.btn('Hear it again'));
    const engines = sh('cmd package list packages -U').split('\n').filter((l) => /tts|pico|speech/i.test(l)).flatMap((l) => l.match(/uid:(\d+)/)?.[1] ?? []);
    let started = false;
    for (let i = 0; i < 20 && !started; i++) { started = sh('dumpsys audio').split('\n').some((l) => l.includes('state:started') && engines.some((u) => l.includes(`u/pid:${u}/`))); if (!started) await sleep(250); }
    check('voice: the TTS engine plays after "Hear it again" (dumpsys audio)', started);
  } else {
    check('no ja-JP voice: "Get a Japanese voice" is offered', await getVoice.isVisible());
    await app.touch(getVoice); await sleep(2000); await shot('voice-install-screen');
    check('it opens the engine\'s own screen', !front());
    sh(`am start -W -n ${PKG}/.MainActivity`); await sleep(1500);
    await app.seed({ start: {} });
    await app.touch(app.btn(/^Learning(,|$)/)); await app.touch(app.btn('Japanese'));
    await app.touch(app.btn(`Continue · ${japanese.title}`)); await app.run(400); await app.shot('japanese-teach-again');
    check('the offer is made once', !(await getVoice.count()));
  }

  // 3. The widget, placed through the launcher: long-press the home screen, Widgets, Wingbeat, add.
  await key('KEYCODE_HOME');
  sh(`input swipe ${W >> 1} ${H >> 1} ${W >> 1} ${H >> 1} 1500`); await sleep(1500); await shot('home-long-press');
  const widgets = await node(/^Widgets$/, 'home-menu');
  if (widgets) {
    await tap(widgets); await shot('widget-list');
    let entry = await node(/^Wingbeat$/, 'widget-list');
    for (let i = 0; i < 6 && !entry; i++) { sh(`input swipe ${W >> 1} ${H * 0.8} ${W >> 1} ${H * 0.3} 400`); await sleep(1000); entry = await node(/^Wingbeat$/); }
    if (entry) { await tap(entry); await shot('widget-wingbeat'); }
    const preview = await node(/Wingbeat streak/, 'widget-entry');
    if (preview) {
      await tap(preview); await shot('widget-tapped');
      const add = await node(/^Add/, 'widget-tapped');
      if (add) await tap(add);
      else { sh(`input draganddrop ${preview.join(' ')} ${W >> 1} ${H >> 1} 2000`); await sleep(2000); }
    }
  }
  await sleep(1500); await shot('widget-placed');
  const hosted = sh('dumpsys appwidget');
  keep('dumpsys-appwidget.txt', hosted);
  const placed = /Widgets:[\s\S]*com\.joebywan\.wingbeat/.test(hosted);
  check('the widget is on the home screen (dumpsys appwidget)', placed);

  /** The widget's own views, as the launcher's UI tree has them: streak and line (a GONE view is absent). */
  const widgetText = async (name) => {
    const xml = await screenXml(); keep(`ui-widget-${name}.xml`, xml);
    const of = (id) => xml.match(new RegExp(`text="([^"]*)" resource-id="${PKG}:id/${id}"`))?.[1] ?? null;
    return { streak: of('streak'), line: of('line') };
  };
  const states = [
    ['flying', { learn: { count: 4, last: day(0), forgiven: [] } }, 'bright 4', true],
    ['basking', { learn: { count: 4, last: day(1), forgiven: [] } }, 'soft 4', true],
    ['resting', { learn: { count: 4, last: day(3), forgiven: [] } }, 'ember 4', true],
    ['quiet-calm', { learn: { count: 0, last: null, forgiven: [] }, calm: { count: 4, last: day(0), forgiven: [] } }, 'bright null', false],
    ['quiet-reflect', { learn: { count: 0, last: null, forgiven: [] }, reflect: { count: 3, last: day(1), forgiven: [] } }, 'soft null', false],
  ];
  for (const [name, habits, want, numbered] of states) {
    sh(`am start -W -n ${PKG}/.MainActivity`); clearLogs();
    await app.seed({ habits });
    await key('KEYCODE_HOME'); await sleep(1000);
    await shot(`widget-${name}`);
    const drawn = logs().match(/widget: .*/g)?.at(-1) ?? '';
    check(`widget ${name}: ${want}`, drawn.includes(`widget: ${want} `), drawn);
    if (placed) {
      const { streak, line } = await widgetText(name);
      check(`widget ${name}: ${numbered ? 'the streak number shows' : 'no number'}, and a line`, (numbered ? streak === '4' : streak === null) && !!line, `streak ${streak}, "${line}"`);
    }
  }

  // 4. The daily note: on in ⋯, permission granted, fired on a day with nothing done yet.
  sh(`pm grant ${PKG} android.permission.POST_NOTIFICATIONS`);
  sh(`am start -W -n ${PKG}/.MainActivity`);
  await app.seed({ habits: { learn: { count: 4, last: day(1), forgiven: [] } } });
  await app.touch(app.btn('Settings'));
  const toggle = app.page.locator('[data-remind]');
  await app.touch(toggle); await app.shot('daily-note-on');
  check('the daily note is on, and says so', await toggle.getAttribute('aria-pressed') === 'true'
    && await toggle.evaluate((b) => getComputedStyle(b, '::after').content) === '" · On"');
  await app.touch(app.btn('Back'));
  await key('KEYCODE_HOME'); clearLogs();
  const fire = async () => { sh(`am broadcast -n ${PKG}/.Ticker -a ${PKG}.REMIND --ez force true`); await sleep(2000); return logs().match(/note: .*/g)?.at(-1) ?? ''; };
  const said = (await fire()).match(/note: posted "(.*)"/)?.[1];
  check('the note is posted', !!said, said);
  check('its words never mention absence', !!said && !ABSENCE.test(said), said);
  keep('dumpsys-notification.txt', sh('dumpsys notification --noredact'));
  sh('cmd statusbar expand-notifications'); await sleep(1500); await shot('note-in-shade');
  const note = said && await node(new RegExp(said.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'shade');
  check('the note is in the shade', !!note);
  if (note) {
    clearLogs(); await tap(note); await sleep(1500);
    check('tapping it opens the app', front());
    check('the app hears it was opened', /note: opened/.test(logs()));
    await shot('note-opened');
  } else sh('cmd statusbar collapse');
  sh(`am start -W -n ${PKG}/.MainActivity`);
  await app.seed({ habits: { learn: { count: 4, last: day(0), forgiven: [] } } });
  await key('KEYCODE_HOME'); clearLogs();
  const quiet = await fire();
  check('with something done today, nothing is posted, forced or not', quiet.includes('note: none (today is done)'), quiet);

  // 5. The system bars take the page's colour: light, Wind down's night palette, dark.
  sh('cmd uimode night no');
  sh(`am start -W -n ${PKG}/.MainActivity`);
  await app.seed({ picked: [] });
  const bars = async (name) => {
    await sleep(800);
    const want = hex(await app.page.evaluate(() => getComputedStyle(document.body).backgroundColor));
    const [top, bottom] = [pixel(W >> 1, 6), pixel(8, H - 4)];
    check(`bars ${name}: status and navigation bars are the page's ${want}`, top === want && bottom === want, `status ${top}, navigation ${bottom}`);
    await app.shot(`bars-${name}`);
  };
  await bars('light');
  await app.touch(app.btn(/^Wind down(,|$)/));
  await app.touch(app.btn('Continue · Lights low'));
  await bars('wind-down');
  await app.touch(app.page.locator('.close, .back, [data-back]').first());
  sh('cmd uimode night yes'); await sleep(2000);
  console.log(`  ${sh('cmd uimode night').trim()}; uiMode ${sh('dumpsys activity configuration | grep -m1 -o "mUiMode=[^ ]*\\|uimode=[^ ]*\\|night[^ ]*"; true').trim()}`);
  const dark = await app.page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  check('dark theme reaches the open app (prefers-color-scheme)', dark);
  await bars('dark');
  if (!dark) { await launch(true); await app.seed({ picked: [] }); check('dark theme after a fresh start', await app.page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)); await bars('dark-fresh'); }
  sh('cmd uimode night no'); await sleep(1500);

  // 6. Back: from a routine to home; on home it leaves, except within a second of the back that landed there.
  await app.seed();
  await app.touch(app.btn(/^Calm(,|$)/));
  await app.touch(app.btn('Continue · The long out-breath'));
  await app.touch(app.btn('Start')); await app.run(1500); await app.shot('back-routine');
  sh('input keyevent KEYCODE_BACK'); await sleep(300);
  sh('input keyevent KEYCODE_BACK'); await sleep(1500); await app.run(500);
  await app.shot('back-home');
  check('back from a routine lands on home, and a quick second back stays there', front() && await app.btn(/^Calm(,|$)/).isVisible());
  sh('input keyevent KEYCODE_BACK'); await sleep(1500);
  check('back on home leaves the app', !front());

  // 8. Large text: the phone's font size at 1.3, on the screens with the most text.
  const probe = () => app.page.evaluate(() => {
    const s = Object.assign(document.createElement('span'), { textContent: 'Mg' });
    s.style.cssText = 'font:16px sans-serif;position:absolute';
    document.body.append(s); const h = s.getBoundingClientRect().height; s.remove(); return h;
  });
  await launch(true);
  const normal = await probe();
  sh('settings put system font_scale 1.3');
  await launch(true);
  const large = await probe();
  check('the WebView takes the phone\'s font size', large > normal * 1.2, `16px text ${normal.toFixed(1)}px tall at 1.0, ${large.toFixed(1)}px at 1.3`);
  const done = { learn: { count: 3, last: day(0), forgiven: [] }, calm: { count: 2, last: day(1), forgiven: [] } };
  await app.seed({ start: {}, habits: done, wings: ['learn', 'learn', 'calm'] });
  await app.shot('large-home');
  for (const course of ['Chess', 'Maths']) {
    await app.touch(app.btn(/^Learning(,|$)/)); await app.touch(app.page.getByRole('button', { name: course, exact: true })); await app.touch(app.btn(/^Continue · /)); await app.run(400); await app.shot(`large-lesson-${course.toLowerCase()}`);
    await app.seed({ start: {}, habits: done, wings: ['learn', 'learn', 'calm'] });
  }
  await app.touch(app.btn(/^Calm(,|$)/));
  await app.touch(app.btn(/^Continue · /)); await app.shot('large-routine-teach');
  await app.touch(app.btn('Start')); await app.run(1500); await app.shot('large-routine');
  await app.run(60000); await app.shot('large-end');
  await app.seed({ start: {}, habits: done, wings: ['learn', 'learn', 'calm'] });
  await app.run(1500); await app.touch(app.page.locator('.yours-link')); await app.shot('large-your-butterfly');
  check('"Your butterfly" opens from home', await app.page.locator('.yours-page').count() === 1);
  await app.seed({ start: {}, habits: done, wings: ['learn', 'learn', 'calm'] });
  await app.touch(app.btn(/^Your garden/));
  await app.touch(app.page.locator('.guide-link')); await app.shot('large-field-guide');
  sh('settings put system font_scale 1.0');

  // 1 again, over the whole run: nothing from the bridge or the widget's side went wrong.
  const all = earlier + logs();
  keep('logcat.txt', all);
  const bad = all.split('\n').filter((l) => /^[EF]\/|^W\/Wingbeat/.test(l));
  check('logcat: no error from WingbeatBridge or WingbeatDaily, no crash', !bad.length, bad.slice(0, 3).join(' | '));
};
