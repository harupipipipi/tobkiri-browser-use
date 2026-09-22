#!/usr/bin/env node
// Build a blind visual-eval set: copies sampled artifact images to neutral
// names (img_NNN.ext) under dataset/_tmp/blindset/, and writes the answer key
// to dataset/_tmp/blindset-key.json — DO NOT READ THE KEY until judging ends.
//
// Leakage controls:
//  - only screenshot/og-image files (*-imgN content images excluded)
//  - per-artifact dedup: slide decks collapse to deck identity (a 30-slide deck
//    contributes at most one sample)
//  - deterministic sha1 ordering -> reproducible; shuffle is a fixed-seed LCG
//
// Usage: node scripts/blindset-build.mjs [--total 90]
import { readdirSync, statSync, copyFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'dataset', '_tmp', 'blindset');
const KEY = path.join(ROOT, 'dataset', '_tmp', 'blindset-key.json');

// dir, truth label, pipeline, filename filter (screenshot-like only), n
const POOLS = [
  // —— AI codegen artifacts (real page captures) ——
  { dir: 'blink',        label: 'ai', pipe: 'codegen', re: /\.shot\.(webp|png|jpg)$/i, n: 10 },
  { dir: 'lovable',      label: 'ai', pipe: 'codegen', re: /lovable\.app-[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 8 },
  { dir: 'websim',       label: 'ai', pipe: 'codegen', re: /websim\.com.*[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 6 },
  { dir: 'v0',           label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'bolt',         label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'base44',       label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
  { dir: 'aistudio',     label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
  { dir: 'chatgpt',      label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
  { dir: 'grok',         label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 2 },
  { dir: 'trickle',      label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 2 },
  { dir: 'polsia',       label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 2 },
  { dir: 'emergent',     label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 2 },
  // —— AI slide/imagegen artifacts ——
  { dir: 'gamma',        label: 'ai', pipe: 'mixed',   re: /gamma\.site.*\.(png|jpe?g)$/i, ex: /-img\d/i, n: 5 },
  { dir: 'presenton',    label: 'ai', pipe: 'mixed',   re: /community_presentations.*\.(png|jpe?g)$/i, ex: /-img\d/i, n: 5, group: /community_presentations_(\d+)/ },
  { dir: 'chatgpt-slides', label: 'ai', pipe: 'imagegen', re: /\.(png|jpe?g)$/i, n: 5, group: /^([0-9a-f]+)/ },
  { dir: 'reddit-ai',    label: 'ai', pipe: 'mixed',   re: /\.(png|jpe?g)$/i, n: 3 },
  // —— human-made ——
  { dir: 'human',        label: 'human', pipe: 'human', re: /\.(png|jpe?g|webp)$/i, n: 14 },
  { dir: 'slidescarnival', label: 'human', pipe: 'human', re: /\.jpe?g$/i, n: 8, group: /^(.*?)-\d+x\d+\.jpe?g$/i },
  { dir: 'deckgallery',  label: 'human', pipe: 'human', re: /\.webp$/i, n: 8, group: /-\d{3}\.webp/ },
  { dir: 'webflow',      label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'pitch',        label: 'human', pipe: 'designer', re: /pitch-front-slide-\d+\./i, n: 3 },
  { dir: 'beautifulai',  label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, n: 2 },
  { dir: 'wix',          label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 2 },
];

const sha = s => createHash('sha1').update(s).digest('hex');
mkdirSync(OUT, { recursive: true });

const picked = [];
for (const p of POOLS) {
  const d = path.join(ROOT, 'dataset', p.dir);
  if (!existsSync(d)) { console.log(`skip ${p.dir} (missing)`); continue; }
  const seenGroup = new Set();
  const cand = [];
  for (const f of readdirSync(d)) {
    if (!p.re.test(f) || (p.ex && p.ex.test(f))) continue;
    try { if (statSync(path.join(d, f)).size < 8000) continue; } catch { continue; }
    // deck/template dedup: derive group key
    let g = f;
    if (p.group) { const m = f.match(p.group); if (m) g = p.dir + ':' + (m[1] ?? f); }
    else g = p.dir + ':' + f.replace(/-\d+x\d+\.(jpe?g|png|webp)$/i, '').replace(/[-_]\d{3}\.(webp|png|jpe?g)$/i, '');
    if (seenGroup.has(g)) continue;
    seenGroup.add(g);
    cand.push(f);
  }
  cand.sort((a, b) => sha(p.dir + a).localeCompare(sha(p.dir + b)));
  for (const f of cand.slice(0, p.n)) picked.push({ dir: p.dir, file: f, label: p.label, pipe: p.pipe });
}

// fixed-seed shuffle (LCG) — reproducible blind order
let seed = 0xC0FFEE;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let i = picked.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [picked[i], picked[j]] = [picked[j], picked[i]]; }

const key = {};
picked.forEach((r, i) => {
  const ext = r.file.match(/\.(png|jpe?g|webp|gif)$/i)[0];
  const name = `img_${String(i + 1).padStart(3, '0')}${ext}`;
  copyFileSync(path.join(ROOT, 'dataset', r.dir, r.file), path.join(OUT, name));
  key[name] = r;
});
writeFileSync(KEY, JSON.stringify(key, null, 1));
console.log(`blindset: ${picked.length} images -> ${path.relative(ROOT, OUT)}`);
console.log('labels:', picked.reduce((a, r) => (a[r.label] = (a[r.label] || 0) + 1, a), {}));
console.log('names:', Object.keys(key).slice(0, 5).join(', '), '...');
