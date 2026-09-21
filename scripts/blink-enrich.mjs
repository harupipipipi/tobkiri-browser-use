#!/usr/bin/env node
// Enrich blink dataset from public showcase pages — no browser needed.
// For each slug:
//   GET blink.new/p/<slug>     -> og:image = official preview screenshot (webp)
//   GET blink.new/p/<slug>.md  -> provenance record (title, tech stack, creator, build stats)
// Saves <slug>.shot.webp + <slug>.showcase.md into dataset/blink/ with metadata rows.
// Idempotent: skips slugs whose artifacts already exist.
// usage: node scripts/blink-enrich.mjs <slugfile> [--jobs N]
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'dataset', 'blink');
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) tobkiri-dataset/1.0' };

const [slugfile, ...rest] = process.argv.slice(2);
if (!slugfile) { console.error('usage: blink-enrich.mjs <slugfile> [--jobs N]'); process.exit(2); }
const opt = {}; for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = rest[i + 1];
const JOBS = +(opt.jobs || 4);

const slugs = (await readFile(slugfile, 'utf8')).split(/\r?\n/).map(s => s.trim()).filter(s => /^[a-z0-9-]+$/i.test(s));
await mkdir(OUT, { recursive: true });
const todo = slugs.filter(s => !existsSync(path.join(OUT, s + '.showcase.md')));
console.log(`slugs=${slugs.length} todo=${todo.length} jobs=${JOBS}`);

const slugify = (s) => s.replace(/[^a-z0-9_.-]/gi, '_').slice(0, 110);
let done = 0, shots = 0, mds = 0;
async function worker() {
  while (todo.length) {
    const slug = todo.shift();
    const pageUrl = `https://blink.new/p/${slug}`;
    const common = { pageUrl, tool: 'blink', fingerprint: 'blink-showcase' };
    try {
      const r = await fetch(pageUrl, { headers: UA, redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (r.ok) {
        const html = await r.text();
        const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (og && /cdn\.blink\.new\//i.test(og[1])) {
          const ir = await fetch(og[1], { headers: UA, signal: AbortSignal.timeout(25000) });
          if (ir.ok) {
            const buf = Buffer.from(await ir.arrayBuffer());
            if (buf.length > 2000) {
              const file = slugify(slug) + '.shot.webp';
              await writeFile(path.join(OUT, file), buf);
              await appendFile(path.join(OUT, 'metadata.jsonl'), JSON.stringify({ ...common, file, contentType: 'image/webp', assetUrl: og[1], kind: 'screenshot', bytes: buf.length, capturedAt: new Date().toISOString() }) + '\n');
              shots++;
            }
          }
        }
      }
    } catch {}
    try {
      const r = await fetch(pageUrl + '.md', { headers: UA, signal: AbortSignal.timeout(20000) });
      if (r.ok) {
        const md = await r.text();
        if (md.length > 500) {
          const file = slugify(slug) + '.showcase.md';
          await writeFile(path.join(OUT, file), md);
          await appendFile(path.join(OUT, 'metadata.jsonl'), JSON.stringify({ ...common, file, contentType: 'text/markdown', assetUrl: pageUrl + '.md', kind: 'provenance', bytes: md.length, capturedAt: new Date().toISOString() }) + '\n');
          mds++;
        }
      }
    } catch {}
    done++;
    if (done % 300 === 0) console.log(`enrich ${done} shots=${shots} md=${mds}`);
    await new Promise(r => setTimeout(r, 120));
  }
}
await Promise.all(Array.from({ length: JOBS }, worker));
console.log(`DONE enriched=${done} screenshots=${shots} markdown=${mds}`);
