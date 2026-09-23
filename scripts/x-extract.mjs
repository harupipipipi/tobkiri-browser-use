#!/usr/bin/env node
// Extract AI-artifact/share URLs + media URLs from harvested tweet JSONL.
// Reads dataset/<dir>/tweets-*.jsonl (+media.jsonl), emits a collect-site
// listfile of fresh artifact URLs and a media URL list, deduped against
// dataset/_tmp/seen-urls.txt.
// Usage: node scripts/x-extract.mjs [tweetsDir] [--out prefix]
import { readdir, readFile, writeFile, mkdir, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DIR = path.resolve(ROOT, process.argv[2] || 'dataset/twitter-v5');
const OUTPFX = process.argv.includes('--out') ? process.argv[process.argv.indexOf('--out') + 1] : 'x5';
const TMP = path.join(ROOT, 'dataset', '_tmp');

// Artifact surfaces: deployed AI-builder hosts + chatbot share links + deck
// hosts. Broadened per 2026 research (claude.site, gensparkspace, manus.space,
// ok.kimi.link, blinkpowered, storydoc, genially, magicslides, hf.space…).
const ARTIFACT = [
  /claude\.site\/(artifacts|public)\//i, /claude\.ai\/share\//i, /claude\.ai\/public\/artifacts/i,
  /chatgpt\.com\/share\//i, /g\.co\/gemini\/share/i, /gemini\.google\.com\/share/i,
  /grok\.com\/share\//i, /chat\.deepseek\.com\/share/i, /perplexity\.ai\/(page|search)\//i,
  /manus\.im\/share/i, /manus\.space/i, /kimi\.com\/(share|preview)/i, /ok\.kimi\.link/i,
  /copilot\.microsoft\.com\/shares/i, /notebooklm\.google\.com\/notebook/i,
  /([a-z0-9-]+\.)*(lovable\.app|lovable\.dev|lovableproject\.com)/i, /lovable\.dev\/projects\//i,
  /v0\.(app|dev)\/(t|chat)\//i, /([a-z0-9-]+\.)*bolt\.host/i, /([a-z0-9-]+\.)*blinkusercontent\.com/i,
  /blink\.new\/p\//i, /([a-z0-9-]+\.)*blinkpowered\.com/i, /sites\.blink\.new/i,
  /websim\.(com|ai)\/(p|c)\//i, /websim\.com\/@[\w-]+\/[\w-]+/i, /([a-z0-9-]+\.)*c\.websim\.com/i,
  /([a-z0-9-]+\.)*on\.websim\.com/i, /([a-z0-9-]+\.)*base44\.app/i, /([a-z0-9-]+\.)*emergent\.host/i,
  /([a-z0-9-]+\.)*wegic\.(net|app)/i, /([a-z0-9-]+\.)*(polsia\.(app|io)|trickle\.host|butternut\.ai|durable\.co|durable\.site|mixo\.io|create\.xyz|created\.app|same\.new|magicpath\.app|rork\.app|dora\.run|softr\.app|a0\.dev|tempo\.new|hocoos\.com|hostingersite\.com|zyrosite\.com)/i,
  /([a-z0-9-]+\.)*replit\.(app|dev)/i, /([a-z0-9-]+\.)*grok\.me/i, /([a-z0-9-]+\.)*chatgpt\.site/i,
  /([a-z0-9-]+\.)*ai\.studio/i, /([a-z0-9-]+\.)*hf\.space/i,
  /gamma\.app\/(docs|embed)\//i, /([a-z0-9-]+\.)*gamma\.site/i, /([a-z0-9-]+\.)*gensparkspace\.com/i,
  /genspark\.ai\/(slides_wrapper|agents)/i, /presenton\.ai\/community/i, /app\.getalai\.com\/view/i,
  /app\.chroniclehq\.com\/share/i, /stories\.storydoc\.com/i, /([a-z0-9-]+\.)*storydoc\.com\//i,
  /pitch\.com\/v\//i, /prezi\.com\/(p|i)\//i, /view\.genial\.ly/i, /(share|my)\.visme\.co\//i,
  /magicslides\.app\//i, /app\.ludus\.one\//i, /app\.presentations\.ai\//i,
  /slidesai\.io\//i, /decktopus\.com\//i, /beautiful\.ai\/player/i, /my\.canva\.site/i,
  /canva\.com\/design\//i, /tome\.app\//i, /napkin\.ai\//i, /mylens\.ai\//i,
];
const URL_RE = /https?:\/\/[^\s"'<>\])}，。、]+/g;

const seenUrls = new Set();
try { for (const l of (await readFile(path.join(TMP, 'seen-urls.txt'), 'utf8')).split(/\r?\n/)) { const u = l.split(/\t/)[0].trim(); if (u) seenUrls.add(u); } } catch {}

const rows = [], media = new Set(), allLinks = new Set();
for (const f of await readdir(DIR)) {
  if (!f.endsWith('.jsonl')) continue;
  for (const line of (await readFile(path.join(DIR, f), 'utf8')).split(/\r?\n/)) {
    if (!line.trim()) continue;
    let t; try { t = JSON.parse(line); } catch { continue; }
    const cand = [];
    for (const l of t.links || []) { cand.push(l.href, l.text); }
    if (t.text) for (const m of t.text.matchAll(URL_RE)) cand.push(m[0]);
    for (const p of t.photos || []) media.add(p);
    for (const c of cand) {
      if (!c || !/^https?:/i.test(c)) continue;
      const u = c.trim().replace(/[.,;:!?)'"\]]+$/, '');
      if (seenUrls.has(u) || allLinks.has(u)) continue;
      if (/t\.co\//.test(u)) { allLinks.add(u); rows.push({ url: u, src: `tco:${t.id}` }); continue; }
      if (ARTIFACT.some(r => r.test(u))) { allLinks.add(u); rows.push({ url: u, src: `tweet:${t.id}` }); }
    }
  }
}
await mkdir(TMP, { recursive: true });
const lf = path.join(TMP, `${OUTPFX}-artifact-urls.txt`);
await writeFile(lf, rows.map(r => `${r.url}\tauto`).join('\n') + '\n');
await writeFile(path.join(TMP, `${OUTPFX}-media-urls.txt`), [...media].join('\n') + '\n');
console.log(`extracted ${rows.length} fresh urls (${rows.filter(r => r.src.startsWith('tco')).length} t.co) + ${media.size} media urls -> ${lf}`);
