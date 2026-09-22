#!/usr/bin/env node
// blindset-build2.mjs — v2 blind set with stronger isolation vs v1.
//
// Differences vs blindset-build.mjs:
//  - content-hash dedup (sha1 of file bytes) — near-dup detection beyond names
//  - excludes every source file already used in v1 (blindset-key.json)
//  - per-(dir,author|model|deck) caps via group keys
//  - extra pools: civitai (per-item provenance: baseModel+username),
//    gamma human-content pages, lovable real-brand clones, x-media
//
// Usage: node scripts/blindset-build2.mjs [--total 110]
import { readdirSync, statSync, copyFileSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'dataset', '_tmp', 'blindset2');
const KEY = path.join(ROOT, 'dataset', '_tmp', 'blindset2-key.json');
const V1KEY = path.join(ROOT, 'dataset', '_tmp', 'blindset-key.json');

// ---- v1 exclusion: every source file already seen ----
const used = new Set();
try {
  const k = JSON.parse(readFileSync(V1KEY, 'utf8'));
  for (const v of Object.values(k)) used.add(v.dir + '/' + v.file);
} catch { console.log('warn: no v1 key — v1 overlap not excluded'); }

const sha1file = f => createHash('sha1').update(readFileSync(f)).digest('hex');

// dir, truth label, pipeline, filter, n, group-from-filename
const POOLS = [
  // —— imagegen (model-generated raster artifacts) ——
  { dir: 'civitai',      label: 'ai', pipe: 'imagegen', re: /\.(png|jpe?g|webp)$/i, n: 16, group: /^[^-]+-(\d+)-([^.]+)/ }, // group by model+author token
  { dir: 'chatgpt-slides', label: 'ai', pipe: 'imagegen', re: /\.(png|jpe?g)$/i, n: 8 },
  // —— codegen / slide-tool AI ——
  { dir: 'blink',        label: 'ai', pipe: 'codegen', re: /\.shot\.(webp|png|jpg)$/i, n: 10 },
  { dir: 'lovable',      label: 'ai', pipe: 'codegen', re: /lovable\.app-[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 8 },
  { dir: 'websim',       label: 'ai', pipe: 'codegen', re: /websim\.com.*[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 6 },
  { dir: 'gamma',        label: 'ai', pipe: 'mixed',   re: /gamma\.site.*\.(png|jpe?g)$/i, ex: /-img\d/i, n: 8 },
  { dir: 'presenton',    label: 'ai', pipe: 'mixed',   re: /community_presentations.*\.(png|jpe?g)$/i, ex: /-img\d/i, n: 6, group: /community_presentations_(\d+)/ },
  { dir: 'bolt',         label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 5 },
  { dir: 'v0',           label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 5 },
  { dir: 'base44',       label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'trickle',      label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'emergent',     label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
  { dir: 'polsia',       label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
  { dir: 'grok',         label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
  { dir: 'aistudio',     label: 'ai', pipe: 'codegen', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
  { dir: 'slidesai',     label: 'ai', pipe: 'mixed',   re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'decktopus',    label: 'ai', pipe: 'mixed',   re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  // —— human ——
  { dir: 'human',        label: 'human', pipe: 'human', re: /\.(png|jpe?g|webp)$/i, n: 12 },
  { dir: 'slidescarnival', label: 'human', pipe: 'human', re: /\.jpe?g$/i, n: 8, group: /^(.*?)-\d+x\d+\.jpe?g$/i },
  { dir: 'deckgallery',  label: 'human', pipe: 'human', re: /\.webp$/i, n: 8, group: /-\d{3}\.webp/ },
  { dir: 'human-baseline/shots', label: 'human', pipe: 'human', re: /\.(png|jpe?g|webp)$/i, n: 6 },
  { dir: 'webflow',      label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'pitch',        label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, n: 3 },
  { dir: 'beautifulai',  label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, n: 4 },
  { dir: 'wix',          label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
  { dir: 'framer',       label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
  { dir: 'canva',        label: 'human', pipe: 'designer', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
];

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };
const TOTAL = arg('--total', 130);
const sha = s => createHash('sha1').update(s).digest('hex');
mkdirSync(OUT, { recursive: true });

const contentSeen = new Map(); // content hash -> picked filename
const picked = [];
for (const p of POOLS) {
  const d = path.join(ROOT, 'dataset', p.dir);
  if (!existsSync(d)) { console.log(`skip ${p.dir} (missing)`); continue; }
  const seenGroup = new Set();
  const cand = [];
  for (const f of readdirSync(d)) {
    if (!p.re.test(f) || (p.ex && p.ex.test(f))) continue;
    if (used.has(p.dir + '/' + f)) continue;                    // v1 exclusion
    const fp = path.join(d, f);
    try { if (statSync(fp).size < 8000) continue; } catch { continue; }
    let g = f;
    if (p.group) {
      const m = f.match(p.group);
      // group regex must actually capture; otherwise fall back to name-stripped key
      if (m && m.length > 1 && m[1]) g = p.dir + ':' + m.slice(1).join(':');
      else g = p.dir + ':' + f.replace(/-\d+x\d+\.(jpe?g|png|webp)$/i, '').replace(/[-_]\d{3}\.(webp|png|jpe?g)$/i, '').replace(/\.(webp|png|jpe?g)$/i, '');
    } else {
      g = p.dir + ':' + f.replace(/-\d+x\d+\.(jpe?g|png|webp)$/i, '').replace(/[-_]\d{3}\.(webp|png|jpe?g)$/i, '').replace(/\.(webp|png|jpe?g)$/i, '');
    }
    if (seenGroup.has(g)) continue;
    // content-hash dedup
    const h = sha1file(fp);
    if (contentSeen.has(h)) continue;
    seenGroup.add(g);
    cand.push({ f, h });
  }
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

let seed = 0xBADC0DE;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let i = picked.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [picked[i], picked[j]] = [picked[j], picked[i]]; }

const key = {};
picked.slice(0, TOTAL).forEach((r, i) => {
  const ext = r.file.match(/\.(png|jpe?g|webp|gif)$/i)?.[0] || '.bin';
  const name = `v2_${String(i + 1).padStart(3, '0')}${ext}`;
  copyFileSync(path.join(ROOT, 'dataset', r.dir, r.file), path.join(OUT, name));
  key[name] = r;
});
writeFileSync(KEY, JSON.stringify(key, null, 1));
const dist = picked.reduce((a, r) => (a[r.label + '/' + r.pipe] = (a[r.label + '/' + r.pipe] || 0) + 1, a), {});
console.log(`blindset2: ${Math.min(TOTAL, picked.length)} images -> ${path.relative(ROOT, OUT)}`);
console.log('dist:', JSON.stringify(dist));
