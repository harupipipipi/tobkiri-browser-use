#!/usr/bin/env node
// blindset-build3.mjs — FINAL held-out visual set (v3).
//
// Built AFTER v2/v2b tuning: isolates author / model / deck / template so the
// "designer-tool human vs AI-template-mimic" comparison is measured on unseen,
// non-duplicated items. v2/v2b are development sets — never reuse for final
// measurement.
//
// Isolation rules:
//  - sha1 byte-dedup + exclusion of every file used in v1, v2, v2b
//  - civitai: one item per AUTHOR (filename model-id-author)
//  - slidesai: one item per DECK (sai2-<deckid>-g<guid>_*)
//  - genspark: one cover per deck subdirectory
//  - presenton: one per community_presentation id
//  - mixed/-imgN: one per site host prefix
//  - hash-named dirs (chatgpt-slides) can't be grouped by name -> hard cap
//  - decktopus dt-img marketplace templates EXCLUDED (vendor/human provenance
//    ambiguity found in v2 audit — can't carry an AI label)
//
// Usage: node scripts/blindset-build3.mjs
import { readdirSync, statSync, copyFileSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'dataset', '_tmp', 'blindset3');
const KEY = path.join(ROOT, 'dataset', '_tmp', 'blindset3-key.json');

const sha1file = f => createHash('sha1').update(readFileSync(f)).digest('hex');

// exclude every source file used in any prior set (v1, v2, v2b)
const usedSha = new Set(), usedName = new Set();
for (const kf of ['blindset-key.json', 'blindset2-key.json', 'blindset2b-key.json']) {
  for (const base of [path.join(ROOT, 'dataset', '_tmp'), path.join(ROOT, 'eval', 'blindset')]) {
    try {
      const k = JSON.parse(readFileSync(path.join(base, kf), 'utf8'));
      for (const v of Object.values(k)) { usedSha.add(v.sha1); usedName.add(v.dir + '/' + v.file); }
    } catch { }
  }
}

const strip = f => f.replace(/-\d+x\d+\.(jpe?g|png|webp)$/i, '').replace(/[-_]\d{3}\.(webp|png|jpe?g)$/i, '').replace(/\.(webp|png|jpe?g)$/i, '');

const POOLS = [
  // —— imagegen, confirmed provenance ——
  { dir: 'civitai', label: 'ai', pipe: 'imagegen', re: /\.(png|jpe?g|webp)$/i, n: 20,
    group: f => f.match(/-([^.]+)\.[\w]+$/)?.[1] || f },                       // AUTHOR (not id)
  { dir: 'chatgpt-slides', label: 'ai', pipe: 'imagegen', re: /\.(png|jpe?g)$/i, n: 4, capOnly: true },
  // —— codegen AI ——
  { dir: 'blink', label: 'ai', pipe: 'codegen', re: /\.shot\.(webp|png|jpg)$/i, n: 6 },
  { dir: 'lovable', label: 'ai', pipe: 'codegen', re: /lovable\.app-[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 6 },
  { dir: 'websim', label: 'ai', pipe: 'codegen', re: /websim\.com.*[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 4 },
  { dir: 'bolt', label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'v0', label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'trickle', label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'emergent', label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
  { dir: 'base44', label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
  { dir: 'polsia', label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 2 },
  { dir: 'aistudio', label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 2 },
  { dir: 'grok', label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 2 },
  // —— mixed AI (decks: codegen skeleton + generated assets; incl. template-mimic hard cases) ——
  { dir: 'gamma', label: 'ai', pipe: 'mixed', re: /gamma\.site.*\.(png|jpe?g)$/i, ex: /-img\d/i, n: 6 },
  { dir: 'presenton', label: 'ai', pipe: 'mixed', re: /community_presentations.*\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4,
    group: f => f.match(/community_presentations_(\d+)/)?.[1] || f },
  { dir: 'genspark', label: 'ai', pipe: 'mixed', re: /^01-.*\.png$/i, n: 8, deep: true },
  { dir: 'slidesai', label: 'ai', pipe: 'mixed', re: /sai2-.*\.(png|jpe?g)$/i, n: 8,
    group: f => f.match(/sai2-([a-zA-Z0-9]+-g[0-9a-f]+)/)?.[1] || f },
  // —— human: designer-tool sites (the FP stress class) ——
  { dir: 'framer', label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 6 },
  { dir: 'webflow', label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 5 },
  { dir: 'wix', label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'pitch', label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, n: 4 },
  { dir: 'beautifulai', label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, n: 6 },
  { dir: 'canva', label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  // —— human: templates, photos, baselines ——
  { dir: 'human', label: 'human', pipe: 'human', re: /\.(png|jpe?g|webp)$/i, n: 12 },
  { dir: 'slidescarnival', label: 'human', pipe: 'human', re: /\.jpe?g$/i, n: 8,
    group: f => f.replace(/-\d+x\d+\.jpe?g$/i, '') },
  { dir: 'deckgallery', label: 'human', pipe: 'human', re: /\.webp$/i, n: 8,
    group: f => f.replace(/-\d{3}\.webp$/i, '') },
  { dir: 'human-baseline/shots', label: 'human', pipe: 'human', re: /\.(png|jpe?g|webp)$/i, n: 4 },
];

mkdirSync(OUT, { recursive: true });
const contentSeen = new Map();
const picked = [];

for (const p of POOLS) {
  const d = path.join(ROOT, 'dataset', p.dir);
  if (!existsSync(d)) { console.log(`skip ${p.dir} (missing)`); continue; }
  const seenGroup = new Set();
  const cand = [];
  const consider = (fp, rel, g) => {
    if (usedName.has(p.dir + '/' + rel)) return;
    const h = sha1file(fp);
    if (contentSeen.has(h) || usedSha.has(h.slice(0, 12))) return;
    if (seenGroup.has(g)) return;
    seenGroup.add(g);
    cand.push({ rel, fp, h });
  };
  if (p.deep) {
    for (const sub of readdirSync(d)) {
      const sd = path.join(d, sub);
      try { if (!statSync(sd).isDirectory()) continue; } catch { continue; }
      for (const f of readdirSync(sd)) {
        if (!p.re.test(f)) continue;
        const fp = path.join(sd, f);
        try { if (statSync(fp).size < 8000) continue; } catch { continue; }
        consider(fp, sub + '/' + f, p.dir + ':' + sub);
        break;
      }
    }
  } else {
    for (const f of readdirSync(d)) {
      if (!p.re.test(f) || (p.ex && p.ex.test(f))) continue;
      const fp = path.join(d, f);
      try { if (statSync(fp).size < 8000) continue; } catch { continue; }
      const g = p.group ? p.dir + ':' + p.group(f) : p.dir + ':' + strip(f);
      consider(fp, f, g);
    }
  }
  const sha = s => createHash('sha1').update(s).digest('hex');
  cand.sort((a, b) => sha(p.dir + a.rel).localeCompare(sha(p.dir + b.rel)));
  let n = 0;
  for (const c of cand) {
    if (n >= p.n) break;
    if (contentSeen.has(c.h)) continue;
    contentSeen.set(c.h, p.dir + '/' + c.rel);
    picked.push({ dir: p.dir, file: c.rel, label: p.label, pipe: p.pipe, sha1: c.h.slice(0, 12) });
    n++;
  }
  if (n < p.n) console.log(`  ${p.dir}: only ${n}/${p.n} after dedup`);
}

let seed = 0xf1a1c3;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let i = picked.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [picked[i], picked[j]] = [picked[j], picked[i]]; }

const key = {};
picked.forEach((r, i) => {
  const ext = r.file.match(/\.(png|jpe?g|webp|gif)$/i)?.[0] || '.bin';
  const name = `v3_${String(i + 1).padStart(3, '0')}${ext}`;
  copyFileSync(path.join(ROOT, 'dataset', r.dir, r.file), path.join(OUT, name));
  key[name] = r;
});
writeFileSync(KEY, JSON.stringify(key, null, 1));
const dist = picked.reduce((a, r) => (a[r.label + '/' + r.pipe] = (a[r.label + '/' + r.pipe] || 0) + 1, a), {});
console.log(`blindset3: ${picked.length} images -> ${path.relative(ROOT, OUT)}`);
console.log('dist:', JSON.stringify(dist));
