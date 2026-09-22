#!/usr/bin/env node
// imagegen-harvest.mjs — pull confirmed image-model outputs from the public
// Civitai API. Each item carries baseModel + username + postId, so provenance
// is per-item (not dir-level). Lightweight: images only, ~150KB each.
//
// Usage: node scripts/imagegen-harvest.mjs [--per-model 8] [--models "Flux.1 D,SDXL 1.0"]
import { writeFileSync, appendFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dataset', 'civitai');
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const PER = +arg('--per-model', 8);
const MODELS = arg('--models', 'Flux.1 D,SDXL 1.0,Illustrious,Pony,NoobAI,SD 1.5,Hunyuan').split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));

mkdirSync(OUT, { recursive: true });
const metaFile = path.join(OUT, 'metadata.jsonl');
const have = new Set();
const userCount = {};
if (existsSync(metaFile))
  for (const l of readFileSync(metaFile, 'utf8').trim().split('\n')) {
    try { const m = JSON.parse(l); have.add(m.id); userCount[m.username] = (userCount[m.username] || 0) + 1; } catch {}
  }

let saved = 0, authors = new Set(Object.keys(userCount));
const maxPerUser = +arg('--max-per-user', 3);
for (const model of MODELS) {
  // paginate via nextCursor; global per-author cap for author diversity
  let got = 0, cursor = null, pages = 0;
  for (const sort of ['Newest', 'Most Reactions']) {
    cursor = null; pages = 0;
    while (got < PER && pages++ < 6) {
      const u = `https://civitai.com/api/v1/images?limit=60&nsfw=false&sort=${encodeURIComponent(sort)}` +
        `&baseModel=${encodeURIComponent(model.trim())}` + (cursor ? `&cursor=${encodeURIComponent(cursor)}` : '');
      const j = await fetch(u).then(r => r.json()).catch(() => null);
      if (!j?.items?.length) break;
      for (const it of j.items) {
        if (got >= PER) break;
        if (have.has(it.id)) continue;
        if ((userCount[it.username] || 0) >= maxPerUser) continue;
        if (!it.url || it.nsfw) continue;
        const img = await fetch(it.url).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
        if (!img || img.byteLength < 8000) continue;
        const ext = it.url.includes('.mp4') ? 'mp4' : it.url.match(/\.(jpe?g|png|webp)/i)?.[0] || '.jpeg';
        const fn = `${(it.baseModel || model).replace(/[^\w.]+/g, '_')}-${it.id}-${(it.username || 'anon').replace(/[^\w-]+/g, '_')}${ext}`;
        writeFileSync(path.join(OUT, fn), Buffer.from(img));
        appendFileSync(metaFile, JSON.stringify({
          id: it.id, file: fn, url: it.url, postId: it.postId,
          username: it.username, baseModel: it.baseModel || model.trim(),
          prompt: it.meta?.prompt?.slice(0, 300) || null, label: 'ai', pipe: 'imagegen',
        }) + '\n');
        userCount[it.username] = (userCount[it.username] || 0) + 1;
        authors.add(it.username); got++; saved++;
        await sleep(150);
      }
      cursor = j.metadata?.nextCursor || null;
      if (!cursor) break;
      await sleep(350);
    }
    if (got >= PER) break;
  }
  console.log(`${model}: +${got}`);
}
console.log(`DONE saved=${saved} authors=${authors.size}`);
