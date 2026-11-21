/**
 * Static file server for `npm start`; no dependencies. Loopback only, unless HOST is set
 * (`HOST=0.0.0.0 npm start` to try it from a phone on the same network).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.PORT) || 8124;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Answers one request with a file from this checkout, and gives its status. `head`, test-only, goes at the end of
 * every page's <head> (index.html, privacy.html): the phone runner's bridge (tools/bridge.js) is the one user, and `npm start` never passes it.
 */
export async function answer(req, res, head = '') {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/index.html';
  try {
    let body = await readFile(join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, '')));
    if (head && path.endsWith('.html')) body = String(body).replace('</head>', `${head}\n</head>`);
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
    return 200;
  } catch {
    res.writeHead(404).end('404 Not Found');
    return 404;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer((req, res) => answer(req, res)).listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`Wingbeat running at http://${process.env.HOST || 'localhost'}:${PORT}`));
}
