#!/usr/bin/env node
// detector-contract.mjs — run representative inputs through classify() and
// verify the output contract:
//   - aiGenerated is tri-state: null propagates, never collapses to false
//   - provenance (toolGuess/pipeline) and generation (aiGenerated/scope) are
//     reported separately
//   - production method (React stack / raster image) alone never proves AI
//
// Representative inputs (mix of real dataset files + synthetic fixtures):
//   A. gamma-hosted page               -> ai_confirmed, scope.design=ai, text unknown
//   B. framer human site               -> human_likely, aiGenerated=false
//   C. hand-written React/Tailwind SPA -> uncertain, aiGenerated=null (method != AI)
//   D. websim artifact host            -> ai_confirmed
//   E. human-baseline / deckgallery    -> human_likely, aiGenerated=false
//   F. bare URL, no content            -> uncertain, aiGenerated=null
//   G. pitch.com deck URL              -> uncertain (human tool w/ AI features)
//
// Usage: node scripts/detector-contract.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from './detector-eval.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DS = path.join(ROOT, 'dataset');

function firstMeta(dir, pred = () => true) {
  const m = path.join(DS, dir, 'metadata.jsonl');
  if (!existsSync(m)) return null;
  for (const line of readFileSync(m, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      if (r.file && /\.html$/.test(r.file) && pred(r)) {
        const fp = path.join(DS, dir, r.file);
        if (existsSync(fp) && (r.bytes || 0) < 12_000_000)
          return { file: r.file, url: r.pageUrl || '', html: readFileSync(fp, 'utf8') };
      }
    } catch {}
  }
  return null;
}

const cases = [];
const push = (name, input, expect) => cases.push({ name, input, expect });

// A. gamma-hosted artifact (generator host; content authorship stays unknown)
{
  const g = firstMeta('gamma', r => /\.gamma\.site/.test(r.pageUrl || ''));
  if (g) push('A. gamma-hosted page (generator host)', { url: g.url, html: g.html },
    { verdict: 'ai_confirmed', aiGenerated: true, scopeDesign: 'ai', scopeText: 'unknown' });
}
// B. framer human site (designer-tool host — lean human, not AI)
{
  const fr = firstMeta('framer');
  if (fr) push('B. framer site (designer tool)', { url: fr.url, html: fr.html },
    { aiGeneratedNotTrue: true, verdictIn: ['human_likely', 'uncertain'] });
}
// C. synthetic hand-written React/Tailwind/Lucide SPA — no markers
{
  const html = `<!doctype html><html><head><title>My Portfolio</title></head><body>
<div id="root"></div>
<script type="module" src="/assets/index-a1b2c3.js"></script>
<div class="max-w-6xl mx-auto px-6 rounded-lg">
<svg class="lucide lucide-arrow" stroke-linecap="round" stroke-width="2"></svg>
</div></body></html>`;
  push('C. hand-written React/Tailwind SPA (no markers)', { url: 'https://jane-doe.dev/', html },
    { verdict: 'uncertain', aiGeneratedNull: true });
}
// D. websim artifact host
{
  const w = firstMeta('websim');
  if (w) push('D. websim artifact', { url: w.url, html: w.html },
    { verdictIn: ['ai_confirmed', 'ai_likely'], aiGenerated: true });
}
// E. human baseline / deckgallery
{
  const h1 = firstMeta('human-baseline') || firstMeta('deckgallery');
  if (h1) push('E. human baseline page', { url: h1.url, html: h1.html },
    { verdictIn: ['human_likely', 'uncertain'], aiGeneratedNotTrue: true });
}
// F. bare unknown URL, no content
push('F. bare URL no content', { url: 'https://example.org/', html: '' },
  { verdict: 'uncertain', aiGeneratedNull: true });
// G. pitch.com deck URL (human tool w/ AI features)
push('G. pitch.com deck URL only', { url: 'https://pitch.com/public/abc123', html: '' },
  { verdict: 'uncertain', aiGeneratedNull: true });
// H. generic hosts are NOT evidence
push('H. vercel.app generic host', { url: 'https://my-app.vercel.app/', html: '' },
  { verdict: 'uncertain', aiGeneratedNull: true });

let fail = 0;
for (const c of cases) {
  const r = classify(c.input);
  const checks = [];
  if (c.expect.verdict) checks.push([r.verdict === c.expect.verdict, `verdict=${r.verdict} want ${c.expect.verdict}`]);
  if (c.expect.verdictIn) checks.push([c.expect.verdictIn.includes(r.verdict), `verdict=${r.verdict} want ${c.expect.verdictIn.join('|')}`]);
  if ('aiGenerated' in (c.expect)) checks.push([r.aiGenerated === c.expect.aiGenerated, `aiGenerated=${r.aiGenerated}`]);
  if (c.expect.aiGeneratedNull) checks.push([r.aiGenerated === null, `aiGenerated=${r.aiGenerated} want null`]);
  if (c.expect.aiGeneratedNotTrue) checks.push([r.aiGenerated !== true, `aiGenerated=${r.aiGenerated} want !true`]);
  if (c.expect.scopeDesign) checks.push([r.scope?.design === c.expect.scopeDesign, `scope.design=${r.scope?.design}`]);
  if (c.expect.scopeText) checks.push([r.scope?.text === c.expect.scopeText, `scope.text=${r.scope?.text}`]);
  const ok = checks.every(([p]) => p);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name}`);
  console.log(`      -> verdict=${r.verdict} aiGenerated=${r.aiGenerated} tool=${r.toolGuess} pipe=${r.pipeline} conf=${r.conf}`);
  if (r.scope) console.log(`      scope=${JSON.stringify(r.scope)}`);
  for (const [p, msg] of checks) if (!p) console.log(`      x ${msg}`);
  if (!ok) fail++;
}
console.log(`\n${cases.length - fail}/${cases.length} contract checks passed`);
process.exit(fail ? 1 : 0);
