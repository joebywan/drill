import { esc } from '../html.js';
import { subjects } from '../subjects.js';
import { readRecovery } from './keys.js';
import { ANIMALS, CHEERS, WORDS, displayName } from './presets.js';
import { available, cheer, claim, forget, friendAction, friends, join, lookOf, pairCode, profile, sync, withLook } from './sync.js';

/**
 * The ⋯ menu's sync screens: Use on another device, Recovery code, Friends, Delete my data.
 * `ctx` is { app, progress() (the current progress), adopt(p) (take merged progress and save it),
 * back() (the ⋯ screen), focusOn(sel) }. Every screen works without sync, and says so plainly when
 * the server can't be reached; nothing here blocks using Drill.
 */
export const SYNC_MENU = [
  ['device', 'Use on another device'],
  ['recovery', 'Recovery code'],
  ['friends', 'Friends'],
  ['delete', 'Delete my data'],
];

export const syncMenuHtml = () => (!available() ? '' : `<h2>Other devices and friends</h2>
  ${SYNC_MENU.map(([id, label]) => `<button class="choice" data-sync="${id}">${esc(label)}</button>`).join('')}`);

export function openSync(which, ctx) {
  ({ device, recovery, friends: friendsView, delete: deleteView })[which](ctx);
}

const OFFLINE = "Drill's server can't be reached just now. Everything else works as usual.";
const say = (e) => (e?.status === 0 ? OFFLINE : e?.status === 429 ? 'That was a lot at once. Try again in a few minutes.' : 'Something went wrong on the server. Try again later.');

/** 'subject:index' of the latest unit with a lesson done, on a learning path: the card's "current unit". */
export function currentUnit(progress) {
  for (const s of subjects.filter((x) => x.kind === 'learn'))
    for (let i = s.units.length - 1; i >= 0; i--)
      if (s.units[i].lessons.some((l) => progress.done[`${s.id}:${l.id}`])) return `${s.id}:${i}`;
  return null;
}
const unitTitle = (unit) => {
  const [id, i] = String(unit).split(':');
  return subjects.find((s) => s.id === id)?.units[Number(i)]?.title;
};

const ABOUT = `<p class="said about">Turning this on sends a copy of your progress to Drill's server, locked on this
  device first with a code only your devices have, so the server can't read it. Friends see a card: a
  preset name and animal, your streak and how many lessons you've done. No email, no password.
  <a href="privacy.html">How Drill handles your data</a></p>`;

function screen(ctx, html, back = ctx.back) {
  ctx.app.innerHTML = `<main class="survey sync">${html}<p class="said" role="status"></p><button class="choice" data-back>Back</button></main>`;
  ctx.app.querySelector('[data-back]').addEventListener('click', back);
  ctx.focusOn('h1');
  const status = ctx.app.querySelector('[role="status"]');
  return { $: (sel) => ctx.app.querySelector(sel), status: (text) => { status.textContent = text; } };
}

/** Runs `job` with every button disabled, so one tap is one request. */
async function busy(ctx, job) {
  const buttons = [...ctx.app.querySelectorAll('button, input')];
  for (const b of buttons) b.disabled = true;
  try { return await job(); } finally { for (const b of buttons) b.disabled = false; }
}

async function turnOn(ctx, recoveryCode) {
  ctx.adopt(await join(ctx.progress(), recoveryCode, currentUnit(ctx.progress())));
}

function device(ctx) {
  const on = !!profile();
  const s = screen(ctx, `
    <h1>Use on another device</h1>
    <p class="said">Show a code here, then enter it on the other device: ⋯, Use on another device, Enter a code.
      Both devices keep everything either one did.</p>
    ${on ? '' : ABOUT}
    <div class="pair" hidden></div>
    <button class="next" data-show>Show a code</button>
    <button class="choice" data-enter>Enter a code</button>`);
  s.$('[data-enter]').addEventListener('click', () => enterCode(ctx));
  s.$('[data-show]').addEventListener('click', () => busy(ctx, async () => {
    try {
      if (!profile()) await turnOn(ctx);
      const code = await pairCode();
      const pair = s.$('.pair');
      pair.hidden = false;
      s.$('.about')?.remove();
      s.$('[data-show]').textContent = 'Show a new code';
      pair.innerHTML = `<p class="code" aria-label="Code ${code.split('').join(' ')}">${code.slice(0, 3)} ${code.slice(3)}</p>
        <p class="said">Works once, for 10 minutes.</p>`;
      s.status('');
    } catch (e) { s.status(say(e)); }
  }));
}

/** A typed code that's complete is used at once: no button to press. */
function autoSubmit(input, ready, go) {
  input.addEventListener('input', () => { if (ready(input.value)) go(input.value); });
}

function enterCode(ctx) {
  const s = screen(ctx, `
    <h1>Enter a code</h1>
    <p class="said">The 6 digits shown on your other device.</p>
    <input class="code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="7" aria-label="Code from your other device">
    <button class="link" data-recovery>Use a recovery code instead</button>`, () => device(ctx));
  const input = s.$('input');
  input.focus();
  s.$('[data-recovery]').addEventListener('click', () => enterRecovery(ctx));
  autoSubmit(input, (v) => /^\d{6}$/.test(v.replace(/\s/g, '')), (v) => busy(ctx, async () => {
    try {
      s.status('Linking…');
      await turnOn(ctx, await claim(v.replace(/\s/g, '')));
      linked(ctx);
    } catch (e) {
      s.status(e?.status === 404 || e?.name === 'OperationError' ? "That code didn't work. A code works once, for 10 minutes: show a new one on the other device." : say(e));
      input.value = '';
    }
  }));
}

function enterRecovery(ctx) {
  const s = screen(ctx, `
    <h1>Use a recovery code</h1>
    <p class="said">The code you kept, like 7K3M-…: it brings back progress from your other devices and joins it to what's here.</p>
    <input class="code-input" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="29" aria-label="Recovery code">`, () => recovery(ctx));
  const input = s.$('input');
  input.focus();
  autoSubmit(input, (v) => !!readRecovery(v), (v) => busy(ctx, async () => {
    try {
      s.status('Linking…');
      await turnOn(ctx, readRecovery(v));
      linked(ctx);
    } catch (e) { s.status(say(e)); }
  }));
}

function linked(ctx) {
  const p = ctx.progress();
  const n = Object.keys(p.done).length;
  screen(ctx, `<h1>This device is linked</h1>
    <p class="said">Everything from your other devices is here too: ${n} lesson${n === 1 ? '' : 's'} done. From now on they keep each other up to date.</p>`);
}

function recovery(ctx) {
  const me = profile();
  const s = screen(ctx, me ? `
    <h1>Recovery code</h1>
    <p class="said">If Drill is on none of your devices any more, this code brings your progress back to a new one. Keep it somewhere safe, like a password manager or on paper. Anyone with it can see your progress, so keep it to yourself.</p>
    <p class="code recovery">${esc(me.recovery)}</p>
    <button class="next" data-copy>Copy</button>
    <button class="choice" data-use>Use a recovery code</button>` : `
    <h1>Recovery code</h1>
    <p class="said">A recovery code brings your progress back to a new device, even with none of the old ones to hand. It comes with sync.</p>
    ${ABOUT}
    <button class="next" data-on>Turn on sync</button>
    <button class="choice" data-use>Use a recovery code</button>`);
  s.$('[data-use]').addEventListener('click', () => enterRecovery(ctx));
  s.$('[data-copy]')?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(me.recovery); s.status('Copied.'); } catch { s.status('Copying isn\'t allowed here: write it down instead.'); }
  });
  s.$('[data-on]')?.addEventListener('click', () => busy(ctx, async () => {
    try { await turnOn(ctx); recovery(ctx); } catch (e) { s.status(say(e)); }
  }));
}

const face = (card) => `<span class="avatar" aria-hidden="true">${esc(ANIMALS[card?.animal]?.[0] ?? '🙂')}</span>`;
const nameOf = (card) => esc(displayName(card) || 'A friend');

function friendsView(ctx) {
  if (!profile()) {
    const s = screen(ctx, `<h1>Friends</h1>
      <p class="said">Swap codes with people you know and see each other's streak. Send a cheer once a day.</p>
      ${ABOUT}
      <button class="next" data-on>Turn on sync</button>`);
    s.$('[data-on]').addEventListener('click', () => busy(ctx, async () => {
      try { await turnOn(ctx); friendsView(ctx); } catch (e) { s.status(say(e)); }
    }));
    return;
  }
  const me = { ...profile(), ...lookOf(ctx.progress()) };
  const s = screen(ctx, `<h1>Friends</h1>
    <div class="me">${face(me)}<b>${nameOf(me)}</b></div>
    <details class="look"><summary>Change your name and animal</summary>
      <div class="opts" role="group" aria-label="Name">${WORDS.map((w) => `<button class="opt" data-word="${w}" aria-pressed="${w === me.word}">${w}</button>`).join('')}</div>
      <div class="opts" role="group" aria-label="Animal">${Object.entries(ANIMALS).map(([id, [icon, name]]) => `<button class="opt" data-animal="${id}" aria-pressed="${id === me.animal}" aria-label="${name}">${icon}</button>`).join('')}</div>
    </details>
    <p class="said">Your friend code: <b class="friend-code">${esc(me.code ?? '')}</b></p>
    <label class="said" for="add">Add a friend: their code</label>
    <input id="add" class="code-input" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="8">
    <div class="friends"><p class="said">Loading…</p></div>`);
  for (const b of ctx.app.querySelectorAll('[data-word], [data-animal]')) {
    b.addEventListener('click', async () => {
      ctx.adopt(withLook(ctx.progress(), b.dataset.word ? { word: b.dataset.word } : { animal: b.dataset.animal }));
      const look = lookOf(ctx.progress());
      for (const x of ctx.app.querySelectorAll('[data-word]')) x.setAttribute('aria-pressed', x.dataset.word === look.word);
      for (const x of ctx.app.querySelectorAll('[data-animal]')) x.setAttribute('aria-pressed', x.dataset.animal === look.animal);
      s.$('.me').innerHTML = `${face(look)}<b>${nameOf(look)}</b>`;
      try { ctx.adopt(await sync(ctx.progress(), currentUnit(ctx.progress()))); } catch (e) { s.status(say(e)); }
    });
  }
  autoSubmit(s.$('#add'), (v) => /^[A-Z2-9]{8}$/i.test(v.trim()), (v) => busy(ctx, async () => {
    try {
      await friendAction('add', v.trim().toUpperCase());
      s.$('#add').value = '';
      s.status("Asked. You're friends once they accept, or add your code too.");
      await list(ctx, s);
    } catch (e) { s.status(e?.status === 404 ? 'No one has that code. Check it with your friend.' : e?.status === 400 ? "That's your own code." : say(e)); }
  }));
  list(ctx, s);
}

async function list(ctx, s) {
  const box = s.$('.friends');
  let data;
  try { data = await friends(); } catch (e) { box.innerHTML = `<p class="said">${esc(say(e))}</p>`; return; }
  const byCode = new Map([...data.friends, ...data.asks].map((f) => [f.code, f.card]));
  box.innerHTML = `
    ${data.cheers.length ? `<h2>Cheers</h2><ul class="cheers">${data.cheers.map((c) => `<li>${face(byCode.get(c.code))}<span><b>${nameOf(byCode.get(c.code))}</b> ${esc(CHEERS[c.cheer] ?? '')}</span></li>`).join('')}</ul>` : ''}
    ${data.asks.map((f) => `<div class="friend" data-code="${esc(f.code)}">
      <p>${face(f.card)}<span><b>${nameOf(f.card)}</b> would like to be friends</span></p>
      <div class="row"><button class="next" data-act="accept">Accept</button><button class="choice" data-act="remove">Not now</button><button class="link" data-act="block">Block</button></div>
    </div>`).join('')}
    <h2>Your friends</h2>
    ${data.friends.length ? data.friends.map((f) => `<div class="friend" data-code="${esc(f.code)}">
      <p>${face(f.card)}<span><b>${nameOf(f.card)}</b><br><small>${esc(cardLine(f.card))}</small></span></p>
      ${f.cheered ? '<p class="said">Cheered today</p>' : `<div class="opts" role="group" aria-label="Send a cheer">${Object.entries(CHEERS).map(([id, text]) => `<button class="opt" data-cheer="${id}">${esc(text)}</button>`).join('')}</div>`}
      <div class="row"><button class="link" data-act="remove">Unfriend</button><button class="link" data-act="block">Block</button></div>
    </div>`).join('') : '<p class="said">No friends here yet. Swap codes with someone you know.</p>'}`;
  for (const b of box.querySelectorAll('[data-act], [data-cheer]')) {
    const code = b.closest('[data-code]').dataset.code;
    b.addEventListener('click', () => busy(ctx, async () => {
      try {
        if (b.dataset.cheer) await cheer(code, b.dataset.cheer);
        else await friendAction(b.dataset.act, code);
        s.status(b.dataset.cheer ? 'Cheer sent.' : '');
        await list(ctx, s);
      } catch (e) { s.status(say(e)); }
    }));
  }
}

function cardLine(card) {
  if (!card) return '';
  const unit = card.unit && unitTitle(card.unit);
  return [`${card.streak}-day streak`, `${card.lessons} lesson${card.lessons === 1 ? '' : 's'}`, unit].filter(Boolean).join(' · ');
}

function deleteView(ctx) {
  const on = !!profile();
  const s = screen(ctx, on ? `<h1>Delete my data</h1>
    <p class="said">This deletes everything Drill's server keeps for you: your locked progress, your card, your friends and cheers.
      Your progress on this device stays, and sync turns off here. Other linked devices keep their own progress too.</p>
    <button class="next danger" data-delete>Delete it</button>` : `<h1>Delete my data</h1>
    <p class="said">Sync is off on this device, so it has sent nothing to Drill's server. Your progress lives only here:
      clearing this site's data in your browser removes it.</p>
    <p class="said">To delete what another device synced, use Delete my data there, or the recovery code on <a href="privacy.html#delete">this page</a>.</p>`);
  s.$('[data-delete]')?.addEventListener('click', () => busy(ctx, async () => {
    try {
      await forget();
      screen(ctx, `<h1>Deleted</h1><p class="said">Nothing of yours is left on Drill's server. Your progress is still on this device.</p>`);
    } catch (e) { s.status(say(e)); }
  }));
}
