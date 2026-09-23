#!/usr/bin/env node
// Injection test: take human-side (non-AI-builder) HTML artifacts, inject
// controlled AI elements, verify the detector fires ONLY on the injected
// evidence — element-level precision, not whole-artifact overclaim.
// Usage: node scripts/injection-test.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { classify, probeHTML } from './detector-eval.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const OUT = path.join(ROOT, 'dataset', '_tmp', 'injection');
const BASES = [
  'webflow/8020.webflow.io-df4abb1437.html',
  'webflow/agency-portfolioo.webflow.io-b740a9115f.html',
  'framer/analytics-tycoon.netlify.app-887f2a3485.html',
  'framer/apiarium.dev-968ce028e1.html',
];

const INJECTIONS = {
  badge: h => h.replace(/<\/body>/i,
    `<div id="lovable-badge"><a href="https://lovable.dev/projects/x?utm_source=lovable-badge" target="_blank">Edit with Lovable</a></div></body>`),
  meta: h => h.replace(/<head>/i,
    `<head><meta name="generator" content="v0.app"><script src="https://cdn.gpteng.co/gptengineer.js"></script>`),
  websimGlobals: h => h.replace(/<head>/i,
    `<head><script>window.__websim_origin="https://websim.com";window.__websim_route="/p/abc123";</script>`),
  copy: h => h.replace(/<h1[^>]*>.*?<\/h1>/is,
    `<h1>Unlock the Future of Seamless Workflows — It's Not Just a Tool, It's a Revolution</h1>`),
  combo: h => INJECTIONS.copy(INJECTIONS.meta(INJECTIONS.badge(h))),
};

await mkdir(OUT, { recursive: true });
let pass = 0, fail = 0;
for (const base of BASES) {
  const html = await readFile(path.join(ROOT, 'dataset', base), 'utf8');
  const file = 'file:///' + path.join(ROOT, 'dataset', base).replace(/\\/g, '/');
  const v0 = classify({ url: file, html });
  console.log(`\n=== ${base}`);
  console.log(`  baseline: ${v0.verdict} aiGenerated=${v0.aiGenerated} (want: not ai)`);
  if (v0.aiGenerated === true) { console.log('  !! baseline already ai — skip'); continue; }
  for (const [name, inject] of Object.entries(INJECTIONS)) {
    const mod = inject(html);
    const fn = path.join(OUT, path.basename(base, '.html') + '.' + name + '.html');
    await writeFile(fn, mod);
    const v = classify({ url: 'file:///' + fn.replace(/\\/g, '/'), html: mod });
    const markers = probeHTML(mod).filter(p => p.cls === 'G');
    // expectation: badge/meta/websimGlobals/combo -> aiGenerated=true (G marker);
    // copy alone -> null (style is not generation evidence)
    const wantAI = name !== 'copy';
    const ok = wantAI ? v.aiGenerated === true : v.aiGenerated === null;
    if (ok) pass++; else fail++;
    console.log(`  ${name.padEnd(14)} -> ${v.verdict} aiGenerated=${v.aiGenerated} markers=[${markers.map(m => m.m).join(', ')}] ${ok ? 'OK' : 'MISMATCH'}`);
  }
}
console.log(`\n${pass}/${pass + fail} injection expectations met`);
process.exit(fail ? 1 : 0);
