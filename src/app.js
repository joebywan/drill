import { subjects } from './subjects.js';
import { emptyProgress, finishSession, currentStreak, dueKeys } from './progress.js';
import { coach } from './cast/coach.js';
import { rosa } from './cast/rosa.js';
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

function home() {
  const due = dueKeys(progress).filter((k) => items.has(k));
  app.innerHTML = `
    <header class="bar">
      <h1>Drill</h1>
      <span class="stat" title="Day streak">🔥 ${currentStreak(progress)}</span>
      <span class="stat" title="Total XP">⭐ ${progress.xp}</span>
      <button class="sound" aria-pressed="${soundOn()}" aria-label="Sound">${soundOn() ? '🔊' : '🔇'}</button>
    </header>
    <main class="home">
      ${due.length ? `<button class="review" data-review>Review ${Math.min(due.length, REVIEW_SIZE)} of ${due.length} due</button>` : ''}
      ${subjects.map(subjectPath).join('')}
    </main>`;
  app.querySelector('.sound').addEventListener('click', () => { setSound(!soundOn()); home(); });
  app.querySelector('[data-review]')?.addEventListener('click', () =>
    run(null, due.slice(0, REVIEW_SIZE).map((k) => ({ key: k, ...items.get(k) }))));
  for (const btn of app.querySelectorAll('[data-lesson]')) {
    btn.addEventListener('click', () => {
      const [sid, lid] = btn.dataset.lesson.split('|');
      const subject = subjects.find((s) => s.id === sid);
      const lesson = subject.units.flatMap((u) => u.lessons).find((l) => l.id === lid);
      run(`${sid}:${lid}`, lesson.items.map((item) => ({ key: `${sid}:${item.id}`, ...items.get(`${sid}:${item.id}`) })));
    });
  }
}

/**
 * One subject's units. A unit opens when the previous unit's first lesson is done, so a
 * beginner can move across topics without first clearing every hard tier; within a unit,
 * lessons open in order.
 */
function subjectPath(subject) {
  let unitOpen = true;
  const units = subject.units.map((unit) => {
    let open = unitOpen;
    unitOpen = !!progress.done[`${subject.id}:${unit.lessons[0].id}`];
    return `
    <section class="unit">
      <h2>${esc(unit.title)}</h2>
      <div class="lessons">
        ${unit.lessons.map((l) => {
          const done = progress.done[`${subject.id}:${l.id}`];
          const state = done ? 'done' : open ? 'open' : 'locked';
          if (!done) open = false;
          return `<button class="lesson ${state}" data-lesson="${subject.id}|${l.id}" ${state === 'locked' ? 'disabled' : ''}>
            <span class="badge">${done ? '✓' : state === 'locked' ? '🔒' : '▶'}</span>${esc(l.title)}</button>`;
        }).join('')}
      </div>
    </section>`;
  }).join('');
  return `<h2 class="subject">${esc(subject.title)}</h2>${units}`;
}

/**
 * Plays a session: a lesson (lessonId set) or a review (null). An item missed the first time
 * comes back once at the end; only the first try counts toward review scheduling.
 */
function run(lessonId, queue) {
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

  const finish = () => {
    const before = progress.xp;
    progress = finishSession(progress, lessonId, results);
    save();
    const right = results.filter((r) => r.correct).length;
    const perfect = results.length > 0 && right === results.length;
    const xp = progress.xp - before;
    app.innerHTML = `
      <main class="summary">
        <div class="hero"></div>
        <h1>${lessonId ? 'Lesson complete' : 'Review done'}</h1>
        <p class="said">${esc(line(!lessonId ? 'review' : perfect ? 'perfect' : 'complete'))}</p>
        <div class="stats">
          <div><b class="xp">+${xp}</b><span>XP</span></div>
          <div><b>${right}/${results.length}</b><span>first try</span></div>
          <div><b>🔥 ${currentStreak(progress)}</b><span>day streak</span></div>
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
