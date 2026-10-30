#!/usr/bin/env node
/**
 * Drafts candidate coach lines with the Claude API, for a person to review: never straight into
 * the pool. Run by hand only (never in tests or CI):
 *
 *   ANTHROPIC_API_KEY=… node tools/voice-draft.js moss light="not yet" hour=morning [--dares] [--n 12]
 *
 * It reads the coach's voice sheet and existing lines from src/cast/voice/<coach>.json, asks for
 * `n` new lines for that state, and writes them to drafts/voice/<coach>-<state>.json with any word
 * from the coach's never-list flagged. Copy the keepers into the coach's JSON by hand, then
 * `npm test`: the guardrail lint is the real gate.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const MODEL = 'claude-sonnet-5-5';
const args = process.argv.slice(2);
const coach = args[0];
const dares = args.includes('--dares');
const n = Number(args[args.indexOf('--n') + 1]) || 12;
const when = Object.fromEntries(args.filter((a) => a.includes('=')).map((a) => {
  const [k, v] = a.split('=');
  return [k, v === 'true' ? true : v];
}));
const key = process.env.ANTHROPIC_API_KEY;
if (!coach || !key) {
  console.error('Usage: ANTHROPIC_API_KEY=… node tools/voice-draft.js <coach> [key=value…] [--dares] [--n 12]');
  process.exit(1);
}

const voice = JSON.parse(readFileSync(new URL(`../src/cast/voice/${coach}.json`, import.meta.url)));
const existing = (dares ? voice.dares : voice.lines).flatMap((p) => p.lines);
const state = Object.entries(when).map(([k, v]) => `${k}: ${v}`).join(', ') || 'any (a general line)';

const system = `You write lines for ${voice.name}, a coach character in Drill, a gentle habits app.
Personality: ${voice.voice.personality}
How ${voice.name} encourages: ${voice.voice.encourages}
How ${voice.name} dares: ${voice.voice.dares}
Words ${voice.name} never uses: ${voice.voice.never.join(', ')}

Rules for every line: one or two short sentences, in character, plain words. Praise the doing,
never the person's ability. No guilt, loss, urgency or nagging. Never sad about the person being
away; a comeback is a warm welcome that doesn't count the days. No points or targets. No health
claims. A dare is a playful bet ("I bet you can't…", "Dare you to…"), winnable, never about a
streak or what wasn't done. Slots you may use, written exactly so: {habit}, {usualHour},
{count} (days in a row), {days} (days practised in all).`;

const prompt = `State: ${state}.
Write ${n} new ${dares ? 'dares' : 'lines'} for this state. Don't repeat these:
${existing.map((t) => `- ${t}`).join('\n')}

Answer with a JSON array of strings and nothing else.`;

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({ model: MODEL, max_tokens: 2000, system, messages: [{ role: 'user', content: prompt }] }),
});
if (!res.ok) {
  console.error(`The API said ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const text = (await res.json()).content.filter((c) => c.type === 'text').map((c) => c.text).join('');
const lines = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
const never = voice.voice.never;
const candidates = lines.map((line) => ({ line, uses: never.filter((w) => line.toLowerCase().includes(w.toLowerCase())) }));

mkdirSync(new URL('../drafts/voice/', import.meta.url), { recursive: true });
const slug = Object.values(when).join('-').replace(/[^\w-]+/g, '') || 'general';
const file = new URL(`../drafts/voice/${coach}-${dares ? 'dares-' : ''}${slug}.json`, import.meta.url);
writeFileSync(file, `${JSON.stringify({ coach, model: MODEL, when, dares, candidates }, null, 2)}\n`);
console.log(`${candidates.length} candidates for review in ${file.pathname}`);
for (const c of candidates) console.log(`${c.uses.length ? `✗ (${c.uses.join(', ')})` : '·'} ${c.line}`);
