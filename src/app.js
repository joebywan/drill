import { subjects } from './subjects.js';
import { emptyProgress, finishSession, currentStreak, dueKeys, light, needsRepair, soonestKeys } from './progress.js';
import { coach } from './cast/coach.js';
import { rosa } from './cast/rosa.js';
import { lumi } from './cast/lumi.js';
import { lamp } from './cast/lamp.js';
import { reducedMotion } from './cast/kit.js';
import { line } from './cast/lines.js';
import { buzz, play, setSound, soundOn } from './feel.js';

const STORE = 'drill.progress';
const REVIEW_SIZE = 8;
const app = document.getElementById('app');

let progress = load();

function load() {
  try { return JSON.parse(localStorage.getItem(STORE)) || emptyProgress(); } catch { return emptyProgress(); }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(progress)); } catch { /* private mode: progress lasts the visit */ }
}

// Every item by key, so a review can find what it is reviewing.
const items = new Map();
for (const s of subjects)
  for (const u of s.units)
    for (const l of u.lessons)
      for (const item of l.items) items.set(`${s.id}:${item.id}`, { subject: s, item, topic: u.title });

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

let stopHome = () => {};

/**
 * Home: every subject as a winding path of street lamps. Finished lessons are lit; the current
 * lamp carries today's light, with Lumi beside it and any review due. One Continue button.
 */
function home() {
  stopHome();
  const due = dueKeys(progress).filter((k) => items.has(k));
  // A repair needs a review even when nothing is due yet: then the soonest cards stand in.
  const repair = needsRepair(progress);
  const reviewKeys = (due.length ? due : repair ? soonestKeys(progress).filter((k) => items.has(k)) : []).slice(0, REVIEW_SIZE);
  const units = subjects.flatMap(unitsOf);
  const current = units.flatMap((u) => u.nodes).find((n) => n.state === 'open');
  const todays = light(progress);
  const minutes = `about ${Math.max(1, Math.round(reviewKeys.length * 0.4))} min`;
  const dueChip = !reviewKeys.length ? ''
    : repair ? `<button class="due" data-review>${esc(line('repair'))} · ${minutes}</button>`
    : `<button class="due" data-review>${due.length} to review · ${minutes}</button>`;

  const node = (n, i) => {
    const x = Math.round(Math.sin((i * Math.PI) / 3) * 64);
    const here = n === current;
    const state = here ? todays : n.state === 'done' ? 'lit' : 'off';
    return `<li class="${n.state}${here ? ' here' : ''}" style="--x:${x}px">
      ${here ? dueChip : ''}
      <button class="lamp" data-lesson="${n.id}" ${n.state === 'locked' ? 'disabled' : ''}
        aria-label="${esc(n.lesson.title)}${n.state === 'done' ? ', done' : n.state === 'locked' ? ', locked' : ''}">${lamp(state)}</button>
      ${here ? `<div class="guide ${x > 0 ? 'left' : 'right'}"></div>` : ''}
      <span class="label">${esc(n.lesson.title)}</span>
    </li>`;
  };

  app.innerHTML = `
    <header class="bar">
      <h1>Drill</h1>
      <span class="stat" title="Day streak">🔥 ${currentStreak(progress)}</span>
      <button class="sound" aria-pressed="${soundOn()}" aria-label="Sound">${soundOn() ? '🔊' : '🔇'}</button>
    </header>
    <main class="home">
      ${current ? '' : dueChip}
      ${units.map((u) => `
        <section class="street">
          <h2>${esc(u.title)}</h2>
          <ol class="path">${u.nodes.map(node).join('')}</ol>
        </section>`).join('')}
    </main>
    ${current ? `<footer class="cta"><button class="next" data-lesson="${current.id}">Continue · ${esc(current.lesson.title)}</button></footer>` : ''}`;

  const guide = app.querySelector('.guide');
  if (guide) {
    // Lumi rests once today is done, and is content otherwise: never sad, whatever the light.
    const late = new Date().getHours() >= 21;
    const lumiCoach = coach(guide, lumi);
    lumiCoach.set(todays === 'bright' ? (late ? 'sleepy' : 'complete') : 'teach');
    stopHome = lumiCoach.stop;
  }
  app.querySelector('.here')?.scrollIntoView({ block: 'center' });
  app.querySelector('.sound').addEventListener('click', () => { setSound(!soundOn()); home(); });
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
 * One subject's units, each lesson marked done, open or locked. A unit opens when the previous
 * unit's first lesson is done, so a beginner can move across topics without first clearing every
 * hard tier; within a unit, lessons open in order.
 */
function unitsOf(subject) {
  let unitOpen = true;
  return subject.units.map((unit) => {
    let open = unitOpen;
    unitOpen = !!progress.done[`${subject.id}:${unit.lessons[0].id}`];
    const nodes = unit.lessons.map((lesson) => {
      const id = `${subject.id}:${lesson.id}`;
      const state = progress.done[id] ? 'done' : open ? 'open' : 'locked';
      if (state !== 'done') open = false;
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
  app.innerHTML = `
    <header class="bar">
      <button class="close" aria-label="Quit lesson">✕</button>
      <div class="meter"><div class="fill"></div></div>
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
  const [topic, bubble, stage, fill, foot, next] = ['.topic', '.bubble', '.stage', '.fill', '.foot', '.next'].map($);
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

  const meter = () => { fill.style.width = `${(100 * at) / queue.length}%`; };
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
        meter();
        let kind = 'plain';
        if (correct === true) {
          streak++;
          kind = streak === 5 ? 'run5' : streak === 3 ? 'run3' : 'correct';
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
    const before = progress.xp;
    const relit = needsRepair(progress);
    progress = finishSession(progress, lessonId, results);
    const said = !lessonId ? (relit && !needsRepair(progress) ? 'relit' : 'review') : perfectRun() ? 'perfect' : 'complete';
    save();
    const right = results.filter((r) => r.correct).length;
    const perfect = perfectRun();
    const xp = progress.xp - before;
    app.innerHTML = `
      <main class="summary">
        <div class="hero"></div>
        <p class="kicker">${lessonId ? 'Lesson complete' : 'Review done'}</p>
        <h1>${esc(lessonId ? title : `${right} of ${results.length} recalled`)}</h1>
        <p class="said">${esc(line(said))}</p>
        <div class="stats">
          <div><b>${right}/${results.length}</b><span>${lessonId ? 'first try' : 'recalled'}</span></div>
          <div><b>🔥 ${currentStreak(progress)}</b><span>day streak</span></div>
          <div><b class="xp">+${xp}</b><span>XP</span></div>
        </div>
        <button class="next">Continue</button>
      </main>`;
    const hero = coach(app.querySelector('.hero'), rosa);
    hero.set('complete');
    hero.hop();
    play('done');
    buzz('done');
    const stopParty = celebrate(app.querySelector('.xp'), xp, perfect);
    app.querySelector('.summary').addEventListener('click', stopParty);
    app.querySelector('.next').addEventListener('click', () => { stopParty(); hero.stop(); home(); });
  };

  step();
}

/**
 * The lesson-complete moment: XP counts up and, on a perfect lesson, confetti falls. About 2.6 s,
 * skipped by a tap (the returned function) and by reduced motion.
 */
function celebrate(xpEl, xp, confetti) {
  if (reducedMotion()) return () => {};
  const t0 = performance.now();
  let frame = requestAnimationFrame(function tick(now) {
    const k = Math.min(1, (now - t0) / 900);
    xpEl.textContent = `+${Math.round(xp * (1 - (1 - k) ** 3))}`;
    if (k < 1) frame = requestAnimationFrame(tick);
  });
  const layer = document.createElement('div');
  layer.className = 'confetti';
  if (confetti) {
    const colours = ['#F5A524', '#4caf73', '#6E82A8', '#F28C8C', '#FFD978'];
    for (let i = 0; i < 40; i++) {
      const bit = document.createElement('i');
      bit.style.left = `${Math.random() * 100}%`;
      bit.style.background = colours[i % colours.length];
      layer.append(bit);
      bit.animate([
        { transform: `translateY(0) rotate(0)` },
        { transform: `translateY(${window.innerHeight + 40}px) rotate(${360 + Math.random() * 360}deg)` },
      ], { duration: 1800 + Math.random() * 800, delay: Math.random() * 300, easing: 'cubic-bezier(.3,.6,.5,1)', fill: 'forwards' });
    }
    document.body.append(layer);
  }
  const timer = setTimeout(() => layer.remove(), 2600);
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    xpEl.textContent = `+${xp}`;
    layer.remove();
  };
}

home();
