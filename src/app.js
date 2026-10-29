import { subjects } from './subjects.js';
import { emptyProgress, finishSession, currentStreak, dueKeys, light, migrate, needsRepair, soonestKeys, today } from './progress.js';
import { coach } from './cast/coach.js';
import { rosa } from './cast/rosa.js';
import { lumi } from './cast/lumi.js';
import { reducedMotion } from './cast/kit.js';
import { STREAK_LABEL, accuracyLabel, finished, headline, line, paceLabel, rightAnswer } from './cast/lines.js';
import { buzz, move, play, setSound, soundOn } from './feel.js';

const STORE = 'drill.progress';
const REVIEW_SIZE = 8;
const app = document.getElementById('app');

let progress = load();

function load() {
  let raw = null;
  try { raw = localStorage.getItem(STORE); } catch { /* private mode */ }
  if (raw == null) return emptyProgress();
  let p = null;
  try { p = migrate(JSON.parse(raw)); } catch { /* not JSON */ }
  // Unreadable progress is set aside, not overwritten by the next save.
  if (!p) try { localStorage.setItem(`${STORE}.unreadable`, raw); } catch { /* nowhere to keep it */ }
  return p || emptyProgress();
}
let persistAsked = false;
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch { /* private mode: progress lasts the visit */ }
  // Ask the browser, quietly and once a visit, not to evict progress (Safari clears it after a week away).
  if (persistAsked) return;
  persistAsked = true;
  try { navigator.storage?.persisted?.().then((kept) => kept || navigator.storage.persist()).catch(() => {}); } catch { /* unsupported */ }
}

// Every item by key, so a review can find what it is reviewing.
const items = new Map();
for (const s of subjects)
  for (const u of s.units)
    for (const l of u.lessons)
      for (const item of l.items) items.set(`${s.id}:${item.id}`, { subject: s, item, topic: u.title });

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

let stopHome = () => {};

const ROW = 112; // px from one node to the next; the drawn path assumes it
const SWAY = 70; // px a node sits off centre at most

/**
 * Home: every unit as a winding path of quest markers, joined by a drawn line. A finished lesson
 * shows a tick; the next one a gold "!" with Lumi beside it; locked ones a grey "!". Reviews due
 * and one Continue button sit at the bottom. Today's light colours the streak chip.
 */
function home(arrived = null) {
  stopHome();
  const due = dueKeys(progress).filter((k) => items.has(k));
  // A repair needs a review even when nothing is due yet: then the soonest cards stand in.
  const repair = needsRepair(progress);
  const reviewKeys = (due.length ? due : repair ? soonestKeys(progress).filter((k) => items.has(k)) : []).slice(0, REVIEW_SIZE);
  const units = subjects.flatMap(unitsOf);
  // The next lesson, from the placement survey's starting unit on.
  const from = Math.max(0, units.findIndex((u) => u.title === progress.start));
  const current = [...units.slice(from), ...units].flatMap((u) => u.nodes).find((n) => n.state === 'open');
  const todays = light(progress);
  const minutes = `about ${Math.max(1, Math.round(reviewKeys.length * 0.4))} min`;
  const dueChip = !reviewKeys.length ? ''
    : repair ? `<button class="due" data-review>${esc(line('repair'))} · ${minutes}</button>`
    : `<button class="due" data-review>${due.length} to review · ${minutes}</button>`;
  const xAt = (i) => Math.round(Math.sin((i * Math.PI) / 3) * SWAY);

  const node = (n, i) => {
    const here = n === current;
    const mark = n.state === 'done' ? '✓' : '!';
    const status = n.state === 'done' ? ', done' : n.state === 'locked' ? ', locked' : '';
    return `<li style="--x:${xAt(i)}px">
      <button class="node ${n.state}${here ? ' here' : ''}" data-lesson="${n.id}" ${n.state === 'locked' ? 'disabled' : ''}
        aria-label="${esc(n.lesson.title)}${status}"><span aria-hidden="true">${mark}</span></button>
      ${here ? `<div class="guide ${xAt(i) > 0 ? 'left' : 'right'}"></div>` : ''}
      <span class="label">${esc(n.lesson.title)}</span>
    </li>`;
  };

  // The line through every node centre; the stretch up to the last finished node is drawn in green.
  const trail = (nodes) => {
    const pts = nodes.map((_, i) => [xAt(i), i * ROW + 32]);
    const d = (to) => pts.slice(0, to).map(([x, y], i) => {
      if (!i) return `M${x} ${y}`;
      const [px, py] = pts[i - 1];
      return `C${px} ${py + ROW / 2} ${x} ${y - ROW / 2} ${x} ${y}`;
    }).join(' ');
    const walked = nodes.filter((n) => n.state === 'done').length + 1;
    const h = (nodes.length - 1) * ROW + 64;
    return `<svg class="trail" viewBox="-160 0 320 ${h}" width="320" height="${h}" aria-hidden="true">
      <path d="${d(pts.length)}" class="ahead"/>${walked > 1 ? `<path d="${d(Math.min(walked, pts.length))}" class="walked"/>` : ''}
    </svg>`;
  };

  app.innerHTML = `
    <header class="bar">
      <h1>Drill</h1>
      <span class="stat streak-${todays}" title="Day streak">🔥 ${currentStreak(progress)}</span>
      <button class="sound" aria-pressed="${soundOn()}" aria-label="Sound">${soundOn() ? '🔊' : '🔇'}</button>
      <button class="menu" aria-label="Your progress">⋯</button>
    </header>
    <main class="home">
      ${units.map((u) => `
        <section class="street">
          <h2>${esc(u.title)}</h2>
          <div class="trailhead">${trail(u.nodes)}<ol class="path">${u.nodes.map(node).join('')}</ol></div>
        </section>`).join('')}
    </main>
    <footer class="cta">
      ${dueChip}
      ${current ? `<button class="next" data-lesson="${current.id}">Continue · ${esc(current.lesson.title)}</button>` : ''}
    </footer>`;

  const guide = app.querySelector('.guide');
  if (guide) {
    // Lumi rests once today is done, and is content otherwise: never sad, whatever the light.
    const late = new Date().getHours() >= 21;
    const lumiCoach = coach(guide, lumi);
    const settle = () => lumiCoach.set(todays === 'bright' ? (late ? 'sleepy' : 'complete') : 'teach');
    const from = arrived && app.querySelector(`.node[data-lesson="${arrived}"]`);
    app.querySelector('.here').scrollIntoView({ block: 'center' });
    const walk = from && walkTo(guide, from, app.querySelector('.node.here'));
    if (walk) {
      lumiCoach.set('correct');
      walk.finished.then(settle, () => {});
    } else settle();
    stopHome = () => { walk?.cancel(); lumiCoach.stop(); };
  } else app.querySelector('.here')?.scrollIntoView({ block: 'center' });
  app.querySelector('.sound').addEventListener('click', () => { setSound(!soundOn()); home(); });
  app.querySelector('.menu').addEventListener('click', () => { stopHome(); keep(); });
  app.querySelector('[data-review]')?.addEventListener('click', () =>
    run(null, reviewKeys.map((k) => ({ key: k, ...items.get(k) })), 'Review'));
  for (const btn of app.querySelectorAll('[data-lesson]')) {
    btn.addEventListener('click', () => {
      const n = units.flatMap((u) => u.nodes).find((x) => x.id === btn.dataset.lesson);
      run(n.id, n.lesson.items.map((item) => ({ key: `${n.subject.id}:${item.id}`, ...items.get(`${n.subject.id}:${item.id}`) })), n.lesson.title);
    });
  }
}

/**
 * Lumi hops along the path from the lesson just finished to the next one, and that lesson's tick
 * pops in: the learner sees themselves move forward. Skipped under reduced motion (null).
 */
function walkTo(guide, fromNode, toNode) {
  const a = fromNode.getBoundingClientRect();
  const b = toNode.getBoundingClientRect();
  const dx = a.left - b.left;
  const dy = a.top - b.top;
  move(fromNode, [{ transform: 'scale(.6)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 500, easing: 'ease-out' });
  const HOPS = 3;
  const frames = [];
  for (let i = 0; i <= HOPS * 2; i++) {
    const k = i / (HOPS * 2);
    const lift = i % 2 ? -14 : 0; // up on the odd frames: a hop between each landing
    frames.push({ transform: `translate(${dx * (1 - k)}px, ${dy * (1 - k) + lift}px)` });
  }
  return move(guide, frames, { duration: 1300, delay: 350, easing: 'ease-in-out', fill: 'backwards' });
}

/**
 * One subject's units, each lesson marked done, open or locked. A unit opens when the previous
 * unit's first lesson is done, so a beginner can move across topics without first clearing every
 * hard tier; within a unit, lessons open in order. Units before the placement survey's starting
 * point are open all through, to go back to.
 */
function unitsOf(subject) {
  const start = subject.units.findIndex((u) => u.title === progress.start);
  let unitOpen = true;
  return subject.units.map((unit, i) => {
    let open = unitOpen || i <= start;
    unitOpen = !!progress.done[`${subject.id}:${unit.lessons[0].id}`];
    const nodes = unit.lessons.map((lesson) => {
      const id = `${subject.id}:${lesson.id}`;
      const state = progress.done[id] ? 'done' : open ? 'open' : 'locked';
      if (state !== 'done' && i >= start) open = false;
      return { id, subject, lesson, state };
    });
    return { title: unit.title, nodes };
  });
}

/**
 * Plays a session: a lesson (lessonId set) or a review (null). An item missed the first time
 * comes back once at the end; only the first try counts toward review scheduling.
 */
function run(lessonId, queue, title) {
  stopHome();
  const results = [];
  let at = 0;
  let streak = 0; // right answers in a row, this session
  let cleanup = () => {};
  const started = Date.now();
  app.innerHTML = `
    <header class="bar">
      <button class="close" aria-label="Quit lesson">✕</button>
      <div class="meter" data-heat="0"><div class="fill"><i class="shine"></i></div><span class="flare" aria-hidden="true"></span></div>
    </header>
    <main class="play">
      <p class="topic"></p>
      <div class="coach">
        <button class="who" aria-label="Rosa"></button>
        <p class="bubble" aria-live="polite"></p>
      </div>
      <div class="stage"></div>
    </main>
    <footer class="foot" aria-live="polite">
      <div class="verdict"><strong></strong><p></p></div>
      <button class="next">Continue</button>
    </footer>`;
  const $ = (sel) => app.querySelector(sel);
  const [topic, bubble, stage, foot, next] = ['.topic', '.bubble', '.stage', '.foot', '.next'].map($);
  const rosaCoach = coach($('.who'), rosa);
  let said = '';
  const quit = () => { cleanup(); rosaCoach.stop(); };
  $('.close').addEventListener('click', () => { quit(); home(); });

  // Tapping Rosa: a hop and a line, then back to the question.
  let aside;
  $('.who').addEventListener('click', () => {
    play('tap');
    rosaCoach.hop();
    bubble.textContent = line('tapped');
    clearTimeout(aside);
    aside = setTimeout(() => { bubble.textContent = said; }, 2500);
  });

  // The bar warms with the run: green, then gold at three in a row, then an orange glow at five.
  const meterEl = $('.meter');
  const meter = () => {
    meterEl.style.setProperty('--at', `${(100 * at) / queue.length}%`);
    meterEl.dataset.heat = streak >= 5 ? 2 : streak >= 3 ? 1 : 0;
  };
  const shine = () => move($('.shine'), [{ transform: 'translateX(-100%)' }, { transform: 'translateX(350%)' }], { duration: 650, easing: 'ease-out' });
  const flare = (text) => {
    const el = $('.flare');
    el.textContent = text;
    move(el, [
      { opacity: 0, transform: 'translate(-50%, 6px) scale(.6)' },
      { opacity: 1, transform: 'translate(-50%, 0) scale(1.1)', offset: 0.2 },
      { opacity: 1, transform: 'translate(-50%, 0) scale(1)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-50%, -4px) scale(1)' },
    ], { duration: 1600, easing: 'ease-out' });
  };
  const step = () => {
    cleanup();
    meter();
    foot.className = 'foot';
    if (at === queue.length) { rosaCoach.stop(); return finish(); }
    const entry = queue[at];
    topic.textContent = entry.topic;
    rosaCoach.set('think');
    cleanup = entry.subject.mount(stage, entry.item, {
      say: (text, mood) => {
        said = bubble.textContent = text;
        if (mood) rosaCoach.set(mood);
      },
      done: (correct, text = '') => {
        if (correct !== null && !entry.retry) results.push({ key: entry.key, correct });
        if (correct === false && !entry.retry) queue.push({ ...entry, retry: true });
        at++;
        let kind = 'plain';
        if (correct === true) {
          streak++;
          kind = rightAnswer(streak);
          if (kind !== 'correct') flare(`${streak} in a row`);
          rosaCoach.set('correct');
          rosaCoach.hop();
          play(kind === 'correct' ? 'right' : 'run');
          buzz('right');
        } else if (correct === false) {
          streak = 0;
          kind = 'wrong';
          rosaCoach.set('wrong');
          rosaCoach.sway();
          play('wrong');
          buzz('wrong');
        }
        meter();
        shine();
        foot.className = `foot show ${correct === null ? 'plain' : correct ? 'right' : 'wrong'}`;
        foot.querySelector('strong').textContent = kind === 'plain' ? '' : line(kind);
        foot.querySelector('p').textContent = text;
        next.focus();
      },
    });
  };
  next.addEventListener('click', step);

  const perfectRun = () => results.length > 0 && results.every((r) => r.correct);
  const finish = () => {
    const relit = needsRepair(progress);
    const firstTime = lessonId && !progress.done[lessonId];
    progress = finishSession(progress, lessonId, results);
    save();
    const right = results.filter((r) => r.correct).length;
    const perfect = perfectRun();
    const seconds = Math.round((Date.now() - started) / 1000);
    const missed = results.some((r) => !r.correct);
    // Speed is only praised when it wasn't bought with mistakes.
    const pace = missed ? 'STEADY' : paceLabel(seconds / queue.length);
    const kind = finished({
      review: !lessonId, perfect, relit: relit && !needsRepair(progress),
      fast: pace !== 'STEADY', missed,
    });
    const percent = results.length ? Math.round((100 * right) / results.length) : null;
    const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    const chip = (tone, label, value) => `<div class="chip ${tone}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
    app.innerHTML = `
      <main class="summary">
        <div class="duo">
          <div class="hero rosa"></div>
          <i class="spark" aria-hidden="true">✦</i>
          <div class="hero lumi"></div>
          <p class="cheer">${esc(line('lumi'))}</p>
        </div>
        <p class="kicker">${esc(lessonId ? title : 'Review done')}</p>
        <h1>${esc(headline(kind))}</h1>
        <p class="said">${esc(line(kind))}</p>
        <div class="chips">
          ${percent === null ? '' : chip('acc', accuracyLabel(percent), `${percent}%`)}
          ${chip('time', pace, clock)}
          ${chip('fire', STREAK_LABEL, `🔥 ${currentStreak(progress)}`)}
        </div>
        <p class="learned">${Object.keys(progress.cards).length} learned so far · ${right} of ${results.length} ${lessonId ? 'right first try' : 'recalled'}</p>
      </main>
      <footer class="cta"><button class="next">Continue</button></footer>`;
    const [rosaEl, lumiEl] = app.querySelectorAll('.duo .hero');
    const cast = [coach(rosaEl, rosa), coach(lumiEl, lumi)];
    let left = false;
    for (const c of cast) c.set('correct');
    // The high five: both lean in and hop, a spark where the hands meet, then a proud bounce.
    const meet = (el, dx) => move(el, [
      { transform: 'translate(0, 0)' },
      { transform: `translate(${dx}px, -10px)`, offset: 0.45 },
      { transform: `translate(${dx}px, 0)`, offset: 0.6 },
      { transform: 'translate(0, 0)' },
    ], { duration: 900, delay: 200, easing: 'ease-in-out' });
    const leanIn = meet(rosaEl, 22);
    meet(lumiEl, -22);
    move(app.querySelector('.spark'), [
      { opacity: 0, transform: 'scale(.3) rotate(0)' },
      { opacity: 1, transform: 'scale(1.4) rotate(45deg)', offset: 0.4 },
      { opacity: 0, transform: 'scale(1.8) rotate(90deg)' },
    ], { duration: 500, delay: 560, easing: 'ease-out' });
    move(app.querySelector('.cheer'), [{ opacity: 0, transform: 'scale(.5)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 260, delay: 560, easing: 'ease-out', fill: 'backwards' });
    app.querySelectorAll('.chip').forEach((el, i) =>
      move(el, [{ opacity: 0, transform: 'translateY(12px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: 700 + i * 140, easing: 'ease-out', fill: 'backwards' }));
    const settle = () => {
      if (left) return;
      for (const c of cast) c.set('complete');
      cast[0].hop();
      setTimeout(() => !left && cast[1].hop(), 140);
    };
    if (leanIn) leanIn.finished.then(settle, () => {}); else settle();
    play('done');
    buzz('done');
    const stopParty = perfect ? confetti() : () => {};
    app.querySelector('.summary').addEventListener('click', stopParty);
    app.querySelector('.next').addEventListener('click', () => {
      left = true;
      stopParty();
      for (const c of cast) c.stop();
      home(firstTime ? lessonId : null);
    });
  };

  step();
}

/**
 * Confetti for a lesson right first time all through. About 2.6 s, skipped by a tap (the returned
 * function) and by reduced motion.
 */
function confetti() {
  if (reducedMotion()) return () => {};
  const layer = document.createElement('div');
  layer.className = 'confetti';
  const colours = ['#F5A524', '#4caf73', '#6E82A8', '#F28C8C', '#FFD978'];
  for (let i = 0; i < 40; i++) {
    const bit = document.createElement('i');
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colours[i % colours.length];
    layer.append(bit);
    bit.animate([
      { transform: 'translateY(0) rotate(0)' },
      { transform: `translateY(${window.innerHeight + 40}px) rotate(${360 + Math.random() * 360}deg)` },
    ], { duration: 1800 + Math.random() * 800, delay: Math.random() * 300, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'forwards' });
  }
  document.body.append(layer);
  const timer = setTimeout(() => layer.remove(), 2600);
  return () => { clearTimeout(timer); layer.remove(); };
}

/** A first visit with nothing done yet: ask once where to start. */
const PLACEMENT = [
  ["I've never played", 'The board'],
  ['I know how the pieces move', 'Capturing'],
  ['I play now and then', 'Forks'],
  ['I play often and know some tactics', 'Mate in one'],
];

function survey() {
  app.innerHTML = `
    <main class="survey">
      <div class="hero"></div>
      <h1>Have you played chess before?</h1>
      <p class="said">Pick the closest. It only sets where you start: every earlier lesson stays open.</p>
      ${PLACEMENT.map(([label], i) => `<button class="choice" data-i="${i}">${esc(label)}</button>`).join('')}
    </main>`;
  const guide = coach(app.querySelector('.hero'), lumi);
  guide.set('teach');
  for (const b of app.querySelectorAll('[data-i]')) {
    b.addEventListener('click', () => { guide.stop(); suggest(PLACEMENT[b.dataset.i][1]); });
  }
}

function suggest(unit) {
  const first = subjects[0].units[0].title;
  if (unit === first) return place(first);
  app.innerHTML = `
    <main class="survey">
      <div class="hero"></div>
      <h1>Start at ${esc(unit)}?</h1>
      <p class="said">That's where Lumi suggests you begin. The lessons before it stay open, if you want a refresher.</p>
      <button class="next" data-start>Start at ${esc(unit)}</button>
      <button class="choice" data-first>Start from the beginning</button>
    </main>`;
  const guide = coach(app.querySelector('.hero'), lumi);
  guide.set('correct');
  guide.hop();
  app.querySelector('[data-start]').addEventListener('click', () => { guide.stop(); place(unit); });
  app.querySelector('[data-first]').addEventListener('click', () => { guide.stop(); place(first); });
}

function place(unit) {
  progress = { ...progress, start: unit };
  save();
  home();
}

/** Save progress to a file, or load one back: for a new device, or a browser that cleared it. */
function keep(note = '') {
  app.innerHTML = `
    <main class="survey">
      <h1>Your progress</h1>
      <p class="said">Keep a copy in a file, or load one from another device.</p>
      <button class="choice" data-save>Save to a file</button>
      <button class="choice" data-load>Load from a file</button>
      <input type="file" accept=".json,application/json" hidden>
      <p class="said" role="status">${esc(note)}</p>
      <button class="choice" data-back>Back</button>
    </main>`;
  const status = app.querySelector('[role="status"]');
  const input = app.querySelector('input');
  app.querySelector('[data-back]').addEventListener('click', () => home());
  app.querySelector('[data-save]').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(progress)], { type: 'application/json' }));
    a.download = `drill-progress-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    status.textContent = 'Saved.';
  });
  app.querySelector('[data-load]').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    let p = null;
    try { p = migrate(JSON.parse(await input.files[0].text())); } catch { /* not JSON */ }
    input.value = ''; // the same file can be picked again
    if (p) confirmLoad(p);
    else status.textContent = "That file isn't Drill progress, so nothing changed.";
  });
}

const tally = (p) => {
  const n = Object.keys(p.done).length;
  return `${n} lesson${n === 1 ? '' : 's'} done, a ${currentStreak(p)}-day streak`;
};

function confirmLoad(p) {
  app.innerHTML = `
    <main class="survey">
      <h1>Use this file?</h1>
      <p class="said">The file has ${tally(p)}. It replaces what's here now: ${tally(progress)}.</p>
      <button class="next" data-use>Use this file</button>
      <button class="choice" data-keep>Keep what's here</button>
    </main>`;
  app.querySelector('[data-use]').addEventListener('click', () => { progress = p; save(); home(); });
  app.querySelector('[data-keep]').addEventListener('click', () => keep('Nothing changed.'));
}

const fresh = progress.start == null && !Object.keys(progress.done).length && !Object.keys(progress.cards).length;
if (fresh) survey(); else home();
