// The installed Android app (android/, the debug build), for what only the app has: its launcher icon and
// no INTERNET, a first day in the WebView (butterfly.js and calm.js, played through the app, sound and
// haptics checked for its own package), Japanese through Android's TTS, the widget placed on the home
// screen through the launcher and seen flying, basking, resting and with a quiet habit, the daily note in
// the shade, the system bars in light, dark and Wind down, back, and the phone's large text.
// Build the APK first (CLAUDE.md, Android); with none, it says so and does nothing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import butterfly from './butterfly.js';
import calm from './calm.js';
import { fitter, textTour, uiNode } from './lib/fits.js';

const PKG = 'com.joebywan.wingbeat';
const APK = process.env.APP_APK || new URL('../../android/app/build/outputs/apk/debug/app-debug.apk', import.meta.url).pathname;
const OUT = new URL('../../test-results/phone/app/', import.meta.url).pathname;
const japanese = JSON.parse(readFileSync(new URL('../../src/data/japanese.json', import.meta.url))).units[0].lessons[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const day = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.toLocaleDateString('en-CA'); };
const LIGHT_BG = '#f6f7f9', DARK_BG = '#151a22'; // the page's background, and the window's (android/app/src/main/res/values*/themes.xml)
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
    return uiNode(xml, re)?.at ?? null;
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
  if (icon) sh(`input tap ${icon.join(' ')}`); else sh(`am start -n ${PKG}/.MainActivity`);
  const opened = Date.now();
  // While the WebView starts, the window shows the page's own background, never white.
  const loading = [];
  for (const at of [1, 3]) {
    await sleep(opened + at * 1000 - Date.now()); await shot(`first-launch-${at}s`);
    loading.push(pixel(12, H >> 1));
  }
  check('first launch: the page\'s light background while it loads, at 1 s and 3 s', loading.every((c) => c === LIGHT_BG), loading.join(', '));
  let shown = false;
  while (!(shown = /Small beats go a long way/.test(await screenXml())) && Date.now() - opened < 30000) await sleep(500);
  check('first launch: the intro shows within 15 s of the tap on a cold emulator', shown && Date.now() - opened < 15000, `${((Date.now() - opened) / 1000).toFixed(1)} s`);
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
    // The engine logs each utterance it starts (MainActivity's UtteranceProgressListener): count them.
    const spoken = () => (logs().match(/voice: speaking/g) || []).length;
    const before = spoken();
    console.log(`  utterances so far: ${before} (${logs().match(/voice: engine .*/)?.[0] ?? 'no engine line'})`);
    await app.touch(app.btn('Hear it again'));
    let heard = false;
    for (let i = 0; i < 20 && !heard; i++) { heard = spoken() > before; if (!heard) await sleep(250); }
    check('voice: "Hear it again" is spoken by the TTS engine (logcat)', heard);
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

  /** The widget's box on screen [left, top, right, bottom], from the launcher's UI tree. */
  const widgetBox = (xml) => xml.match(new RegExp(`resource-id="${PKG}:id/root"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`))?.slice(1).map(Number);
  if (placed) {
    // It lands one row high, and the resize frame is up: stretch it a row taller by its bottom handle.
    const xml = await screenXml(); keep('ui-widget-placed.xml', xml);
    const box = widgetBox(xml);
    const none = !new RegExp(`resource-id="${PKG}:id/streak"`).test(xml);
    check('the widget lands one row high, and a new learner sees no number', !!box && box[3] - box[1] < H / 8 && none, `${box?.join(',')}${none ? '' : ', a number shows'}`);
    if (box) {
      const cx = (box[0] + box[2]) >> 1;
      sh(`input swipe ${cx} ${box[3]} ${cx} ${box[3] + (box[3] - box[1]) + 60} 1500`); await sleep(1500);
      const tall = widgetBox(await screenXml());
      await shot('widget-two-rows');
      check('it stretches to two rows', !!tall && tall[3] - tall[1] > (box[3] - box[1]) * 1.5, `${tall?.join(',')}`);
      sh(`input swipe ${cx} ${tall?.[3] ?? box[3]} ${cx} ${box[3]} 1500`); await sleep(1500); // back to one row for the rest
      await shot('widget-one-row');
    }
  }

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
  // Home has no title bar: the garden strip starts the page, and it and ⋯ on its corner sit clear of the status bar.
  await app.page.evaluate(() => scrollTo(0, 0)); await app.shot('home-top');
  const statusBar = +(sh('dumpsys window').match(/type=statusBars frame=\[0,0\]\[\d+,(\d+)\]/)?.[1] ?? NaN);
  const top = async (re) => { const xml = await screenXml(); for (const [tag] of xml.matchAll(/<node [^>]*>/g)) if (re.test(tag.match(/ content-desc="([^"]*)"/)?.[1] ?? '') || re.test(tag.match(/ text="([^"]*)"/)?.[1] ?? '')) return +tag.match(/bounds="\[\d+,(\d+)\]/)[1]; return NaN; };
  const [stripTop, menuTop] = [await top(/^Your garden/), await top(/^Settings$/)];
  check('home: the strip and ⋯ sit below the status bar', stripTop >= statusBar && menuTop >= statusBar, `status bar to ${statusBar}, strip at ${stripTop}, ⋯ at ${menuTop}`);
  await app.touch(app.btn('Settings'));
  check('home: ⋯ opens Settings with a tap', await app.page.getByRole('heading', { name: 'Settings' }).isVisible());
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
  // Dark: the phone switched to night mode with the app open (it handles uiMode itself, so it isn't recreated)…
  const isDark = () => app.page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  sh('cmd uimode night yes'); await sleep(2500);
  check('dark: a live switch reaches the open page (prefers-color-scheme)', await isDark());
  await bars('dark-live');
  check('dark: the page is dark', hex(await app.page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === DARK_BG);
  // …and back to light, live.
  sh('cmd uimode night no'); await sleep(2500);
  check('light again: a live switch back reaches the page', !(await isDark()));
  await bars('light-again');
  // A cold start in night mode, with nothing driving the page: the window, then the page, are dark.
  sh('cmd uimode night yes'); sh(`am force-stop ${PKG}`);
  sh(`am start -n ${PKG}/.MainActivity`);
  const started = Date.now(), cold = [];
  for (const at of [1, 3, 8]) {
    await sleep(started + at * 1000 - Date.now()); await shot(`dark-cold-${at}s`);
    cold.push(pixel(12, H >> 1));
  }
  check('dark: a cold start is dark from the first second, page included (adb, no driver)', cold.every((c) => c === DARK_BG), cold.join(', '));
  await launch(false); await app.seed({ picked: [] });
  check('dark: after a cold start, prefers-color-scheme is dark', await isDark());
  await bars('dark-cold');
  sh('cmd uimode night no'); await sleep(2500);

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

  // 8. Large text: the WebView follows the phone's font size. At 1.3 and at 2.0 (Android's largest), every screen
  // with much text fits (misfits() in lib/fits.js).
  const probe = () => app.page.evaluate(() => {
    const s = Object.assign(document.createElement('span'), { textContent: 'Mg' });
    s.style.cssText = 'font:16px sans-serif;position:absolute';
    document.body.append(s); const h = s.getBoundingClientRect().height; s.remove(); return h;
  });
  const fits = (tag, name) => fitter(app, check)(tag, name); // `app` is the WebView as last launched
  await launch(true);
  const normal = await probe();
  for (const scale of ['1.3', '2.0']) {
    sh(`settings put system font_scale ${scale}`);
    await launch(true);
    const big = await probe();
    check(`text ${scale}: the WebView takes the phone's font size`, big > normal * (+scale - 0.1), `16px text ${normal.toFixed(1)}px tall at 1.0, ${big.toFixed(1)}px at ${scale}`);
    await fits(`text ${scale}`, 'intro');
    await butterfly({ ...app, check }); // a first lesson to its end screen, home, then "Your butterfly"
    await fits(`text ${scale}`, 'your-butterfly');
    await textTour(app, check, `text ${scale}`);
  }
  sh('settings put system font_scale 1.0');

  // 1 again, over the whole run: nothing from the bridge or the widget's side went wrong.
  const all = earlier + logs();
  keep('logcat.txt', all);
  // Errors and warnings from the app's own tags, and a crash of the app's process (not uiautomator's, say).
  const bad = all.split('\n').filter((l) => /^[EFW]\/Wingbeat|Process: com\.joebywan\.wingbeat/.test(l));
  check('logcat: no error from WingbeatBridge or WingbeatDaily, no crash', !bad.length, bad.slice(0, 3).join(' | '));
};
