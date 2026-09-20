#!/usr/bin/env node
// Batch asset collector for the AI-design dataset. Dependency-free.
// Usage: node scripts/batch-fetch.mjs <manifest.json> <outdir> [--tool <name>] [--page <pageUrl>] [--conc N]
// manifest.json: [{ "title": str, "prefix": str, "files": [str] }]  OR  [{ "url": str, "name": str, "pageUrl": str }]
// Saves <outdir>/<deckSlug>/<file> and appends JSON lines to <outdir>/metadata.jsonl
import { createHash } from 'node:crypto';
import { writeFile, mkdir, appendFile } from 'node:fs/promises';
import path from 'node:path';

const [manifestPath, outdir, ...rest] = process.argv.slice(2);
if (!manifestPath || !outdir) { console.error('usage: batch-fetch.mjs <manifest.json> <outdir> [--tool n] [--page u] [--conc N]'); process.exit(2); }
const opt = {};
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const CONC = parseInt(opt.conc || '8', 10);
const TOOL = opt.tool || 'unknown';
const PAGE = opt.page || null;

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'text/html': 'html', 'application/pdf': 'pdf', 'video/mp4': 'mp4', 'application/json': 'json', 'text/css': 'css', 'text/javascript': 'js', 'application/javascript': 'js' };

const manifest = JSON.parse(await (await import('node:fs/promises')).readFile(manifestPath, 'utf8'));

// Expand to flat job list
const jobs = [];
for (const entry of manifest) {
  if (entry.url) { jobs.push({ url: entry.url, sub: entry.sub || '', name: entry.name || null, pageUrl: entry.pageUrl || PAGE, title: entry.title || null }); continue; }
  const slug = (entry.prefix || '').split('/').filter(Boolean).pop() || 'deck';
  for (const f of entry.files || []) {
    jobs.push({ url: `${entry.prefix}/thumbnails/${f}`, sub: slug, name: f.replace(/\.[^.]+$/, ''), pageUrl: PAGE, title: entry.title || null });
  }
}
console.log(`jobs: ${jobs.length}`);

await mkdir(outdir, { recursive: true });
const metaPath = path.join(outdir, 'metadata.jsonl');
let done = 0, ok = 0, fail = 0;
const errors = [];

async function one(j) {
  try {
    const res = await fetch(j.url, {
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) tobkiri-dataset/1.0', accept: '*/*' },
      redirect: 'follow', signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 200) throw new Error(`too small (${buf.length}B)`);
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim();
    let ext = EXT[ct] || path.extname(new URL(j.url).pathname).slice(1) || 'bin';
    if (!/^[a-z0-9]{1,5}$/i.test(ext)) ext = 'bin';
    const hash = createHash('sha1').update(buf).digest('hex').slice(0, 16);
    const base = (j.name || hash).replace(/[^a-z0-9_.-]/gi, '_').slice(0, 120);
    const dir = j.sub ? path.join(outdir, j.sub) : outdir;
    await mkdir(dir, { recursive: true });
    const file = j.sub ? `${j.sub}/${base}.${ext}` : `${base}.${ext}`;
    await writeFile(path.join(outdir, file), buf);
    const rec = { file, bytes: buf.length, contentType: ct, assetUrl: j.url, pageUrl: j.pageUrl, tool: TOOL, title: j.title, capturedAt: new Date().toISOString() };
    await appendFile(metaPath, JSON.stringify(rec) + '\n');
    ok++;
  } catch (e) {
    fail++;
    errors.push({ url: j.url, error: String(e.message || e) });
  }
  done++;
  if (done % 100 === 0) console.log(`progress ${done}/${jobs.length} ok=${ok} fail=${fail}`);
}

const queue = [...jobs];
const workers = Array.from({ length: CONC }, async () => {
  while (queue.length) { const j = queue.shift(); if (j) await one(j); }
});
await Promise.all(workers);
if (errors.length) await writeFile(path.join(outdir, 'errors.json'), JSON.stringify(errors, null, 1));
console.log(`DONE ok=${ok} fail=${fail} out=${outdir}`);
