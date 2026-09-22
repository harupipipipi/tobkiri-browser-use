#!/usr/bin/env node
// blindset-build2b.mjs — imagegen-focused supplement to blindset2.
//
// Goal: enlarge the *image-model* evaluation pool with confirmed-provenance
// items while isolating author/model/deck duplicates.
//
// Pools:
//  - civitai   confirmed AI images; filename carries baseModel+author ->
//              one sample per (model,author) group, excluding files used in v2
//  - xmedia    X/Twitter media with explicit provenance claims in tweet text
//              (ai-claimed imagegen + hand-drawn human control)
//  - genspark  AI slide decks: one named cover slide per deck DIRECTORY
//              (dir name = deck identity, so dedup is reliable)
//  - decktopus/slidesai  template-mimic hard cases (AI decks that look human)
//  - human / slidescarnival / deckgallery  human image+design controls
//
// Usage: node scripts/blindset-build2b.mjs
import { readdirSync, statSync, copyFileSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'dataset', '_tmp', 'blindset2b');
const KEY = path.join(ROOT, 'dataset', '_tmp', 'blindset2b-key.json');

const sha1file = f => createHash('sha1').update(readFileSync(f)).digest('hex');

// exclude every source sha already used in v1 + v2 sets
const usedSha = new Set();
const usedName = new Set();
for (const kf of ['blindset-key.json', 'blindset2-key.json']) {
  try {
    const k = JSON.parse(readFileSync(path.join(ROOT, 'dataset', '_tmp', kf), 'utf8'));
    for (const v of Object.values(k)) { usedSha.add(v.sha1); usedName.add(v.dir + '/' + v.file); }
  } catch { /* optional */ }
}
// also exclude eval copies if present
try {
  const k = JSON.parse(readFileSync(path.join(ROOT, 'eval', 'blindset', 'blindset-key.json'), 'utf8'));
  for (const v of Object.values(k)) usedName.add(v.dir + '/' + v.file);
} catch { }

const POOLS = [
  // —— confirmed imagegen ——
  { dir: 'civitai', label: 'ai', pipe: 'imagegen', re: /\.(png|jpe?g|webp)$/i, n: 20,
    group: f => f.match(/^(.+?)-(\d+)-([^.]+)\./i)?.slice(1).join(':') || f },   // model:id:author -> per-author cap
  { dir: 'xmedia', label: 'ai', pipe: 'imagegen', re: /^x-ai-.*\.jpe?g$/i, n: 2, group: f => f },
  // —— AI slide decks (mixed: generated layout + generated images) ——
  { dir: 'genspark', label: 'ai', pipe: 'mixed', re: /^01-.*\.png$/i, n: 8, deep: true },
  { dir: 'decktopus', label: 'ai', pipe: 'mixed', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'slidesai', label: 'ai', pipe: 'mixed', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  // —— human controls ——
  { dir: 'xmedia', label: 'human', pipe: 'human', re: /^x-human-.*\.jpe?g$/i, n: 1, group: f => f },
  { dir: 'human', label: 'human', pipe: 'human', re: /\.(png|jpe?g|webp)$/i, n: 10 },
  { dir: 'slidescarnival', label: 'human', pipe: 'human', re: /\.jpe?g$/i, n: 6,
    group: f => f.replace(/-\d+x\d+\.jpe?g$/i, '') },
  { dir: 'deckgallery', label: 'human', pipe: 'human', re: /\.webp$/i, n: 6,
    group: f => f.replace(/-\d{3}\.webp$/i, '') },
];

mkdirSync(OUT, { recursive: true });
const contentSeen = new Map();
const picked = [];

for (const p of POOLS) {
  const d = path.join(ROOT, 'dataset', p.dir);
  if (!existsSync(d)) { console.log(`skip ${p.dir} (missing)`); continue; }
  const seenGroup = new Set();
  const cand = [];
  const push = (fp, f, g) => {
    if (usedName.has(p.dir + '/' + f)) return;
    const h = sha1file(fp);
    if (contentSeen.has(h) || usedSha.has(h.slice(0, 12))) return;
    if (seenGroup.has(g)) return;
    seenGroup.add(g);
    cand.push({ f: p.deep ? path.relative(d, fp) : f, fp, h });
  };
  if (p.deep) {
    // one slide per deck subdirectory (deck dir = group identity)
    for (const sub of readdirSync(d)) {
      const sd = path.join(d, sub);
      try { if (!statSync(sd).isDirectory()) continue; } catch { continue; }
      const g = p.dir + ':' + sub;
      for (const f of readdirSync(sd)) {
        if (!p.re.test(f)) continue;
        const fp = path.join(sd, f);
        try { if (statSync(fp).size < 8000) continue; } catch { continue; }
        push(fp, sub + '/' + f, g);
        break; // one per deck
      }
    }
  } else {
    for (const f of readdirSync(d)) {
      if (!p.re.test(f) || (p.ex && p.ex.test(f))) continue;
      const fp = path.join(d, f);
      try { if (statSync(fp).size < 8000) continue; } catch { continue; }
      const g = p.group ? p.dir + ':' + p.group(f) : p.dir + ':' + f;
      push(fp, f, g);
    }
  }
  const sha = s => createHash('sha1').update(s).digest('hex');
  cand.sort((a, b) => sha(p.dir + a.f).localeCompare(sha(p.dir + b.f)));
  let n = 0;
  for (const c of cand) {
    if (n >= p.n) break;
    if (contentSeen.has(c.h)) continue;
    contentSeen.set(c.h, p.dir + '/' + c.f);
    picked.push({ dir: p.dir, file: c.f, label: p.label, pipe: p.pipe, sha1: c.h.slice(0, 12) });
    n++;
  }
  if (n < p.n) console.log(`  ${p.dir}: only ${n}/${p.n} after dedup`);
}

let seed = 0x1a9e2c;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let i = picked.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [picked[i], picked[j]] = [picked[j], picked[i]]; }

const key = {};
picked.forEach((r, i) => {
  const ext = r.file.match(/\.(png|jpe?g|webp|gif)$/i)?.[0] || '.bin';
  const name = `v2b_${String(i + 1).padStart(3, '0')}${ext}`;
  copyFileSync(path.join(ROOT, 'dataset', r.dir, r.file), path.join(OUT, name));
  key[name] = r;
});
writeFileSync(KEY, JSON.stringify(key, null, 1));
const dist = picked.reduce((a, r) => (a[r.label + '/' + r.pipe] = (a[r.label + '/' + r.pipe] || 0) + 1, a), {});
console.log(`blindset2b: ${picked.length} images -> ${path.relative(ROOT, OUT)}`);
console.log('dist:', JSON.stringify(dist));
