#!/usr/bin/env node
// blindset-build4.mjs — contract-v3 evaluation set with per-item label BASIS.
//
// Unlike v1-v3 (collector-dir labels), every item records WHY its truth label
// is believed:
//   basis 'genrecord'    — per-item generation record (civitai baseModel+post,
//                          genspark slide-agent path, presenton prompt page)
//   basis 'marker'       — shot joined to its captured HTML which carries a
//                          G-tier artifact marker (verified per-item, not
//                          assumed from the host)
//   basis 'template'     — human template publisher / gallery provenance
//   basis 'real'         — real photos/brands/docs (human-baseline, human)
//   basis 'tool-gallery' — designer-tool showcase (human-operated; weaker:
//                          provenance-level, kept as a separate bucket)
//   truth 'unknown'      — host-only items: gamma.site/aistudio shots where no
//                          per-item generation record exists. Scored for
//                          abstention correctness, never as ai/human.
//
// Isolation: sha1 byte-dedup + every file used in v1/v2/v2b/v3 excluded;
// one item per author / deck / host / template family.
//
// Usage: node scripts/blindset-build4.mjs
import { readdirSync, statSync, copyFileSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { probeHTML } from './detector-eval.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dataset', '_tmp', 'blindset4');
const KEY = path.join(ROOT, 'dataset', '_tmp', 'blindset4-key.json');

const sha1file = f => createHash('sha1').update(readFileSync(f)).digest('hex');

// ---- exclusion: every source file used in prior sets -----------------------
const usedSha = new Set(), usedName = new Set();
for (const kf of ['blindset-key.json', 'blindset2-key.json', 'blindset2b-key.json', 'blindset3-key.json']) {
  for (const base of [path.join(ROOT, 'dataset', '_tmp'), path.join(ROOT, 'eval', 'blindset')]) {
    try {
      const k = JSON.parse(readFileSync(path.join(base, kf), 'utf8'));
      for (const v of Object.values(k)) { usedSha.add(v.sha1); usedName.add(v.dir + '/' + v.file); }
    } catch { }
  }
}

// ---- metadata index: dir -> rows (memoized) --------------------------------
const metaCache = new Map();
function metaRows(dir) {
  if (metaCache.has(dir)) return metaCache.get(dir);
  const m = path.join(ROOT, 'dataset', dir, 'metadata.jsonl');
  const out = [];
  if (existsSync(m)) {
    for (const line of readFileSync(m, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      try { out.push(JSON.parse(line)); } catch {}
    }
  }
  metaCache.set(dir, out);
  return out;
}

// shot filename embeds the artifact host: "<host>-<8+hex>.<ext>"
const shotHost = f => {
  const m = f.match(/^(.+?)-[0-9a-f]{8,}\.(?:png|jpe?g|webp)$/i);
  return m ? m[1].toLowerCase() : null;
};

// codegen pools: verify per-item G marker by joining shot -> html via host.
// Items whose HTML is missing or carries no G marker are NOT silently
// AI-labeled — they are dropped (or available for the unknown pool).
function markerVerified(dir, file) {
  const host = shotHost(file);
  if (!host) return null;
  const rows = metaRows(dir).filter(r => /\.html$/i.test(r.file || '') && (r.pageUrl || '').toLowerCase().includes(host));
  for (const r of rows) {
    const fp = path.join(ROOT, 'dataset', dir, r.file);
    try {
      if (!existsSync(fp) || (r.bytes || 0) >= 12_000_000) continue;
      const hits = probeHTML(readFileSync(fp, 'utf8'));
      const g = hits.filter(h => h.tier === 'G' || h.tier === 'G-');
      if (g.length) return g.map(h => h.name).join('; ');
    } catch {}
  }
  return null;
}

const strip = f => f.replace(/-\d+x\d+\.(jpe?g|png|webp)$/i, '').replace(/[-_]\d{3}\.(webp|png|jpe?g)$/i, '').replace(/\.(webp|png|jpe?g)$/i, '');

// non-anime civitai models for the subtle/realistic track
const REALISM = /Krea|Flux|SDXL|SD 1\.5|Hunyuan|Chroma|Qwen|OpenAI|MiniMax|ZImage|RealVis/i;

const POOLS = [
  // —— AI genrecord: imagegen ——
  { dir: 'civitai', label: 'ai', pipe: 'imagegen', basis: 'genrecord', re: /\.(png|jpe?g|webp)$/i, n: 15,
    filter: f => { const r = metaRows('civitai').find(x => x.file === f); return r && REALISM.test(r.baseModel || ''); },
    group: f => f.match(/-([^.]+)\.[\w]+$/)?.[1] || f,                       // author
    detail: f => { const r = metaRows('civitai').find(x => x.file === f); return r ? `civitai post ${r.postId} by ${r.username}, baseModel=${r.baseModel}` : ''; } },
  // —— AI genrecord: mixed decks (generation-only pipeline paths) ——
  { dir: 'genspark', label: 'ai', pipe: 'mixed', basis: 'genrecord', re: /^01-.*\.png$/i, n: 8, deep: true,
    detail: (f, sub) => `genspark slide-agent deck ${sub} (blob CDN generation path)` },
  { dir: 'presenton', label: 'ai', pipe: 'mixed', basis: 'genrecord', re: /community_presentations.*\.(png|jpe?g)$/i, n: 5,
    group: f => f.match(/community_presentations_(\d+)/)?.[1] || f,
    detail: f => `presenton community page ${f.match(/community_presentations_(\d+)/)?.[1]} (embeds generation prompt)` },
  // —— AI marker-verified: codegen ——
  { dir: 'lovable', label: 'ai', pipe: 'codegen', basis: 'marker', re: /lovable\.app-[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 6 },
  { dir: 'websim', label: 'ai', pipe: 'codegen', basis: 'marker', re: /\.c\.websim\.com-[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 6 },
  { dir: 'blink', label: 'ai', pipe: 'codegen', basis: 'marker', re: /blinkusercontent\.com-[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 5 },
  { dir: 'bolt', label: 'ai', pipe: 'codegen', basis: 'marker', re: /\.bolt\.host-[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 4 },
  { dir: 'v0', label: 'ai', pipe: 'codegen', basis: 'marker', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'base44', label: 'ai', pipe: 'codegen', basis: 'marker', re: /\.base44\.app-[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 3 },
  { dir: 'grok', label: 'ai', pipe: 'codegen', basis: 'marker', re: /\.grok\.me-[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 3 },
  { dir: 'emergent', label: 'ai', pipe: 'codegen', basis: 'marker', re: /\.emergent\.host-[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 3 },
  // trickle dropped from marker pools: 'trickle' substrings are prose-level,
  // no verified per-item marker → host-only would be circular labeling
  // —— human: verified-ish bases ——
  { dir: 'slidescarnival', label: 'human', pipe: 'human', basis: 'template', re: /\.jpe?g$/i, n: 10,
    group: f => f.replace(/-\d+x\d+\.jpe?g$/i, ''), detail: () => 'SlidesCarnival human template publisher' },
  { dir: 'deckgallery', label: 'human', pipe: 'human', basis: 'template', re: /\.webp$/i, n: 8,
    group: f => f.replace(/-\d{3}\.webp$/i, ''), detail: () => 'deck.gallery human-made deck showcase' },
  { dir: 'human', label: 'human', pipe: 'human', basis: 'real', re: /\.(png|jpe?g|webp)$/i, n: 10 },
  { dir: 'human-baseline/shots', label: 'human', pipe: 'human', basis: 'real', re: /\.(png|jpe?g|webp)$/i, n: 4 },
  // —— human: designer-tool provenance (weaker basis — separate bucket) ——
  { dir: 'framer', label: 'human', pipe: 'designer', basis: 'tool-gallery', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 5 },
  { dir: 'webflow', label: 'human', pipe: 'designer', basis: 'tool-gallery', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'wix', label: 'human', pipe: 'designer', basis: 'tool-gallery', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 3 },
  { dir: 'canva', label: 'human', pipe: 'designer', basis: 'tool-gallery', re: /\.(png|jpe?g)$/i, ex: /-img\d/i, n: 4 },
  { dir: 'beautifulai', label: 'human', pipe: 'designer', basis: 'tool-gallery', re: /\.(png|jpe?g)$/i, n: 4 },
  { dir: 'pitch', label: 'human', pipe: 'designer', basis: 'tool-gallery', re: /\.(png|jpe?g)$/i, n: 3 },
  // —— unknown: host-only, no per-item generation record ——
  { dir: 'gamma', label: 'unknown', pipe: 'mixed', basis: 'host-only', re: /gamma\.site.*\.(png|jpe?g)$/i, ex: /-img\d/i, n: 8,
    detail: () => 'gamma.site host only — generated vs imported/manual undetermined' },
  { dir: 'aistudio', label: 'unknown', pipe: 'codegen', basis: 'host-only', re: /\.ai\.studio-[0-9a-f]{8,}\.(png|jpe?g|webp)$/i, n: 4,
    detail: () => 'ai.studio host only — no self-marker known' },
  { dir: 'decktopus', label: 'unknown', pipe: 'mixed', basis: 'host-only', re: /\.(png|jpe?g|webp)$/i, n: 4,
    detail: () => 'decktopus page — output vs marketplace template undetermined' },
];

mkdirSync(OUT, { recursive: true });
const contentSeen = new Map();
const picked = [];

for (const p of POOLS) {
  const d = path.join(ROOT, 'dataset', p.dir);
  if (!existsSync(d)) { console.log(`skip ${p.dir} (missing)`); continue; }
  const sha = s => createHash('sha1').update(s).digest('hex');
  const seenGroup = new Set();
  // deterministic candidate order by hash of rel path; files hashed lazily
  const cand = [];
  if (p.deep) {
    for (const sub of readdirSync(d)) {
      const sd = path.join(d, sub);
      try { if (!statSync(sd).isDirectory()) continue; } catch { continue; }
      for (const f of readdirSync(sd)) {
        if (!p.re.test(f)) continue;
        const fp = path.join(sd, f);
        try { if (statSync(fp).size < 8000) continue; } catch { continue; }
        cand.push({ rel: sub + '/' + f, fp, g: p.dir + ':' + sub });
        break;
      }
    }
  } else {
    for (const f of readdirSync(d)) {
      if (!p.re.test(f) || (p.ex && p.ex.test(f))) continue;
      if (p.filter && !p.filter(f)) continue;
      const fp = path.join(d, f);
      try { if (statSync(fp).size < 8000) continue; } catch { continue; }
      cand.push({ rel: f, fp, g: p.group ? p.dir + ':' + p.group(f) : p.dir + ':' + (shotHost(f) || strip(f)) });
    }
  }
  cand.sort((a, b) => sha(p.dir + a.rel).localeCompare(sha(p.dir + b.rel)));
  let n = 0;
  for (const c of cand) {
    if (n >= p.n) break;
    if (seenGroup.has(c.g) || usedName.has(p.dir + '/' + c.rel)) continue;
    const h = sha1file(c.fp);
    if (contentSeen.has(h) || usedSha.has(h.slice(0, 12))) continue;
    let basis = p.basis, basisDetail = p.detail ? p.detail(c.rel, c.rel.split('/')[0]) : '';
    if (basis === 'marker') {
      const g = markerVerified(p.dir, c.rel.split('/').pop());
      if (!g) continue;                       // no per-item marker -> skip entirely
      basisDetail = 'in-artifact markers: ' + g;
    }
    if (basis === 'genrecord' && p.dir === 'civitai') basisDetail = p.detail(c.rel);
    seenGroup.add(c.g);
    contentSeen.set(h, p.dir + '/' + c.rel);
    picked.push({ dir: p.dir, file: c.rel, label: p.label, pipe: p.pipe, sha1: h.slice(0, 12), basis, basisDetail });
    n++;
  }
  if (n < p.n) console.log(`  ${p.dir}: only ${n}/${p.n} after dedup/marker-check`);
}

let seed = 0xc04ac7;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let i = picked.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [picked[i], picked[j]] = [picked[j], picked[i]]; }

const key = {};
picked.forEach((r, i) => {
  const ext = r.file.match(/\.(png|jpe?g|webp|gif)$/i)?.[0] || '.bin';
  const name = `v4_${String(i + 1).padStart(3, '0')}${ext}`;
  copyFileSync(path.join(ROOT, 'dataset', r.dir, r.file), path.join(OUT, name));
  key[name] = r;
});
writeFileSync(KEY, JSON.stringify(key, null, 1));
const dist = picked.reduce((a, r) => (a[`${r.label}/${r.pipe}/${r.basis}`] = (a[`${r.label}/${r.pipe}/${r.basis}`] || 0) + 1, a), {});
console.log(`blindset4: ${picked.length} images -> ${path.relative(ROOT, OUT)}`);
console.log('dist:', JSON.stringify(dist, null, 1));
