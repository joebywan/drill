/**
 * Hands: play the app by sight, a command at a time. Knows nothing about the app.
 * Opens it as a first visit (real sessions: warm-ups and echoes on, the clock running), then loops:
 * a screenshot of the whole screen to `$HANDS_DIR/screen.png` (and `screen-half.png`, half size: multiply by 2),
 * every one also kept as `shots/NNNN.png`; `state.txt` is the count of screens so far. Then it waits for
 * `cmd.txt`, does it with a real touch on this run's emulator, and logs it with the time in `log.txt`:
 *   tap x y | swipe x1 y1 x2 y2 [ms] | type some text | back | wait s (real time) | ff s (fast-forward the page's
 *   clock, for a long timed routine) | shot | stop
 * Coordinates are the full screenshot's pixels. It waits on a person, so it does nothing without HANDS_DIR
 * (a plain `npm run phone` passes over it): `HANDS_DIR=<folder> npm run phone -- hands`.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const DIR = process.env.HANDS_DIR;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async ({ page, adb, device, fresh }) => {
  if (!DIR) { console.log('  hands: set HANDS_DIR to play by sight; skipped'); return; }
  mkdirSync(`${DIR}/shots`, { recursive: true });
  // As a learner meets it: the runner's plain sessions off, the clock running on its own.
  await page.addInitScript(() => { delete window.WINGBEAT_PLAIN; });
  await page.clock.resume();
  await fresh();
  const log = (line) => appendFileSync(`${DIR}/log.txt`, `${new Date().toISOString()} ${line}\n`);
  let count = 0;
  const show = async () => {
    await sleep(600);
    const file = `${DIR}/shots/${String(count).padStart(4, '0')}.png`;
    await device.screenshot({ path: file });
    writeFileSync(`${DIR}/screen.png`, readFileSync(file));
    execFileSync('convert', [file, '-resize', '50%', `${DIR}/screen-half.png`]);
    writeFileSync(`${DIR}/state.txt`, String(++count));
  };
  rmSync(`${DIR}/cmd.txt`, { force: true });
  log('start');
  await show();
  for (;;) {
    if (!existsSync(`${DIR}/cmd.txt`)) { await sleep(200); continue; }
    const line = readFileSync(`${DIR}/cmd.txt`, 'utf8').trim();
    rmSync(`${DIR}/cmd.txt`);
    log(line);
    const [verb, ...rest] = line.split(/\s+/);
    const n = rest.map(Number);
    if (verb === 'stop') break;
    else if (verb === 'tap') adb('shell', 'input', 'tap', String(n[0]), String(n[1]));
    else if (verb === 'swipe') adb('shell', 'input', 'swipe', ...rest.slice(0, 4), rest[4] || '400');
    else if (verb === 'type') adb('shell', 'input', 'text', line.slice(5).replaceAll(' ', '%s'));
    else if (verb === 'back') adb('shell', 'input', 'keyevent', '4');
    else if (verb === 'wait') await sleep(n[0] * 1000);
    else if (verb === 'ff') await page.clock.fastForward(n[0] * 1000);
    else if (verb !== 'shot') log(`unknown command: ${line}`);
    await show();
  }
  log('stop');
};
