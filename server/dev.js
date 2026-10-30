/**
 * The sync worker on this machine, with an in-memory D1 and the migrations applied: for the
 * tests (`start()`), and `npm run dev` (PORT, default 8787) for trying Drill against it.
 * Nothing here talks to Cloudflare.
 */
import { Miniflare } from 'miniflare';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export async function start({ port } = {}) {
  const mf = new Miniflare({
    modules: true,
    scriptPath: here('./worker.js'),
    modulesRoot: here('..'), // the worker imports ../src/sync/presets.js
    modulesRules: [{ type: 'ESModule', include: ['**/*.js'] }],
    compatibilityDate: '2026-07-01',
    d1Databases: ['DB'],
    ...(port != null && { port, host: '127.0.0.1' }),
  });
  const db = await mf.getD1Database('DB');
  for (const f of readdirSync(here('./migrations')).sort())
    for (const sql of readFileSync(here(`./migrations/${f}`), 'utf8').replace(/--.*$/gm, '').split(';').map((s) => s.trim()).filter(Boolean))
      await db.prepare(sql).run();
  return { mf, url: String(await mf.ready).replace(/\/$/, ''), db };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await start({ port: Number(process.env.PORT) || 8787 });
  console.log(`Drill sync running at ${url}`);
}
