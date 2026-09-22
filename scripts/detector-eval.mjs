#!/usr/bin/env node
// Deterministic implementation of .devin/skills/ai-design-detector rules,
// evaluated against the collected dataset with a leakage-controlled split.
// No model calls, no credits — regex/DOM-marker scoring only.
//
// Ground truth = collector provenance (which directory / pageUrl the file came
// from), NOT the same fingerprints used as features. Dirs whose content is the
// tool's own marketing/gallery chrome are labeled 'toolpage' and kept out of
// the ai/human confusion matrix.
//
// Split: sha1(file path) % 10 >= 7  -> TEST (30%). Deterministic, per-artifact
// (blink slug / lovable subdomain) since filenames are unique per artifact.
//
// Usage: node scripts/detector-eval.mjs [--cap 4000] [--split test|train|all]
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DS = path.join(ROOT, 'dataset');
let CAP = 4000, SPLIT = 'test';
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--cap') CAP = +argv[++i] || CAP;
  else if (argv[i] === '--split') SPLIT = argv[++i];
}

// ---- labels -------------------------------------------------------------
// ai     : the page IS the generated artifact (hosted on the tool's artifact
//          domain, or a public gallery of generated content)
// human  : human-authored content (template galleries, designer-tool pages)
// toolpage : the tool's own product/marketing/chat UI — detector should NOT
//          call these human-authored artifacts (separate category)
// skip   : ambiguous mixes — reported as an unlabeled sweep, not scored
const LABELS = {
  blink: 'ai', lovable: 'ai', websim: 'ai', base44: 'ai', bolt: 'ai',
  emergent: 'ai', grok: 'ai', polsia: 'ai', trickle: 'ai', butternut: 'ai',
  gamma: 'ai', chatgpt: 'ai', aistudio: 'ai', presenton: 'ai',
  slidescarnival: 'human', deckgallery: 'human', webflow: 'human', wix: 'human',
  'human-baseline': 'human',
  v0: 'toolpage', decktopus: 'toolpage', slidebean: 'toolpage',
  slidesai: 'toolpage', beautifulai: 'toolpage', pitch: 'toolpage',
  framer: 'skip', replit: 'skip', mixed: 'skip', 'sites-mixed': 'skip',
  hostinger: 'skip', softr: 'skip', createxyz: 'skip',
};

// ---- feature extraction ---------------------------------------------------
const HOST_RULES = [
  // [hostRe, pathRe|null, tool, verdict]
  [/\.blinkusercontent\.com$/, null, 'blink', 'ai_confirmed'],
  [/\.lovable\.app$/, null, 'lovable', 'ai_confirmed'],
  [/\.c\.websim\.com$/, null, 'websim', 'ai_confirmed'],
  [/^websim\.com$|^websim\.ai$/, /^\/@[^/]+\//, 'websim', 'ai_confirmed'], // project page: artifact in iframe
  [/\.gamma\.site$/, null, 'gamma', 'ai_confirmed'],
  [/\.manus\.space$/, null, 'manus', 'ai_confirmed'],
  [/\.base44\.app$/, null, 'base44', 'ai_confirmed'],
  [/\.grok\.me$/, null, 'grok', 'ai_confirmed'],
  [/\.emergent\.host$/, null, 'emergent', 'ai_confirmed'],
  [/\.butternut\.ai$/, null, 'butternut', 'ai_confirmed'],
  [/\.trickle\.host$/, null, 'trickle', 'ai_confirmed'],
  [/\.chatgpt\.site$/, null, 'chatgpt', 'ai_confirmed'],
  [/\.bolt\.host$/, null, 'bolt', 'ai_confirmed'],
  [/\.polsia\.app$|^polsia\.io$/, null, 'polsia', 'ai_confirmed'],
  [/\.durable\.co$/, null, 'durable', 'ai_confirmed'],
  [/\.mixo\.io$/, null, 'mixo', 'ai_confirmed'],
  [/^websim\.com$|^websim\.ai$/, null, 'websim-shell', 'toolpage'],
  [/^v0\.app$|^v0\.dev$/, null, 'v0-toolpage', 'toolpage'],
  [/^presenton\.ai$/, /^\/community\/presentations\//, 'presenton', 'ai_confirmed'],
  [/\.wegic\.net$/, null, 'wegic', 'ai_confirmed'],
  // human-operated tool hosts: pipeline proven, authorship undetermined —
  // never ai_confirmed, lean human only for pure designer tools
  [/\.framer\.ai$/, null, 'framer-ai', 'ai_likely'],          // Framer's AI surface
  [/\.framer\.website$|\.framer\.site$/, null, 'framer', 'human_likely'],
  [/\.my\.canva\.site$|\.canva\.com$/, null, 'canva', 'human_likely'],
  [/\.beautiful\.ai$/, null, 'beautifulai', 'uncertain'],
  [/\.decktopus\.com$/, null, 'decktopus', 'ai_likely'],
  [/^tome\.app$/, null, 'tome', 'ai_likely'],
  [/\.pitch\.com$/, null, 'pitch', 'uncertain'],
  [/\.replit\.app$/, null, 'replit', 'uncertain'],
  [/\.ai\.studio$/, null, 'aistudio', 'ai_likely'],
  [/\.webflow\.io$/, null, 'webflow', 'human_likely'],
];
const DESIGNER_TOOLS = new Set(['webflow', 'wix', 'squarespace', 'framer', 'pitch']);

function hostOf(url) { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } }

// Cheap substring/regex probes. Each returns {name, tier, tool?} when hit.
function probeHTML(html) {
  const hits = [];
  const has = (re, name, tier, tool) => { if (re.test(html)) hits.push({ name, tier, tool }); };
  // A2 badges
  has(/blink-badge|blink-picker|blink-edit-hover|blink-seo-text/, 'blink-badge DOM classes', 'A2', 'blink');
  has(/bolt\.new\/badge\.js|Made in Bolt/i, 'bolt badge script', 'A2', 'bolt');
  has(/lovable-badge|gpt-engineer-file-uploads|gpteng\.co/, 'lovable badge/gpteng', 'A2', 'lovable');
  has(/v0-built-with-button-|Built with v0/i, 'v0 badge', 'A2', 'v0');
  has(/id="emergent-badge"|emergent\.sh\/\?utm_source=emergent-badge/, 'emergent badge', 'A2', 'emergent');
  has(/wegic-branding-badge|wegic-badge|cdn\.wegic\.ai/, 'wegic badge', 'A2', 'wegic');
  has(/Made with Gamma|css-1fr8asy/, 'gamma badge', 'A2', 'gamma');
  has(/base44-edit-badge|base44-scale-in|media\.base44\.com|app\.base44\.com/, 'base44 badge/cdn', 'A2', 'base44');
  has(/<meta name="grok-project-id"/, 'grok-project-id meta', 'A2', 'grok');
  // A3 generator/meta
  has(/<meta name="generator" content="v0\.app"/, 'generator=v0.app', 'A3', 'v0');
  has(/<meta name="generator" content="Framer/, 'generator=Framer', 'A3', 'framer');
  has(/<meta name="generator" content="Webflow/, 'generator=Webflow', 'A3', 'webflow');
  has(/<meta name="generator" content="Wix\.com/, 'generator=Wix', 'A3', 'wix');
  has(/og:title" content="Blink App"|An app built with Blink\./, 'blink default OG', 'A3', 'blink');
  has(/A product of emergent\.sh/, 'emergent description meta', 'A3', 'emergent');
  has(/files\.manuscdn\.com|manus-content-root|__manus_space_editor_info|__manus__global_env/, 'manus shell', 'A3', 'manus');
  // A4 gamma config dump — camelCase flag names only (bare 'imagen'/'ideogram'
  // appear in prose and false-fire)
  has(/generatorGPT4|prefer-openai-dalle|baseten-generate-flux-schnell|recraftModel|leonardoPhoenix|lumaPhoton|gpt4oMiniGenerate/, 'gamma feature-flag pool', 'A4', 'gamma');
  // Blink stub shell
  has(/auto-engineer\.js\?projectId=/, 'blink auto-engineer stub', 'A3', 'blink');
  // Tier B stack fingerprints
  has(/gamma-moveable-wrapper|gamma-sites-|assets\.gammahosted\.com|gamma-app\.workers\.dev/, 'gamma DOM/CDN', 'B', 'gamma');
  has(/__websim_origin|__websim_route|__websim/, 'websim globals', 'B', 'websim');
  has(/data-framer-|framerusercontent\.com|__framer__/, 'framer attrs/cdn', 'B', 'framer');
  has(/v0-gray-|v0-alpha-|v0-blue-|v0-caveat-/, 'v0 design-system classes', 'B', 'v0');
  has(/data-wf-site|data-wf-page|webflow\.css/, 'webflow markup', 'B', 'webflow');
  has(/wixstatic\.com|X-Wix/, 'wix assets', 'B', 'wix');
  has(/pitch\.com\/static\/platform\/asset\/|pitch-assets-|\| Pitch</, 'pitch assets', 'B', 'pitch');
  has(/cdn\.prod\.website-files\.com/, 'webflow cdn', 'B', 'webflow');
  // unattributed vibe stack (never decisive alone)
  const vibe = /id="root"/.test(html) && /\/assets\/index-[A-Za-z0-9_-]+\.js/.test(html)
    && /(lucide|stroke-linecap="round")/.test(html) && /max-w-\d|mx-auto|rounded-lg/.test(html);
  if (vibe) hits.push({ name: 'vite+react+tailwind+lucide (unmarked)', tier: 'B', tool: null });
  // human-side signals
  has(/wp-content|wp-includes|woocommerce/i, 'wordpress markup', 'H', 'human');
  has(/Here is where your presentation begins|presentation begins/i, 'template placeholder copy', 'H', 'human');
  has(/squarespace|static\.squarespace/, 'squarespace markup', 'H', 'human');
  return hits;
}

// ---- verdict ---------------------------------------------------------------
// Two-axis contract (see SKILL.md): verdict = graded call; aiGenerated =
// tri-state true|false|null (null = undetermined, NOT a human finding);
// scope = which components the generation evidence covers.
const AI_V = new Set(['ai_confirmed', 'ai_likely']);
const HU_V = new Set(['human_likely', 'human_confirmed']);
const aiGen = v => AI_V.has(v) ? true : HU_V.has(v) ? false : null;
const GENERATOR = t => /^(gamma|genspark|decktopus|slidesai|slidebean|tome|presenton|manus|base44|grok|emergent|butternut|trickle|chatgpt|bolt|polsia|lovable|blink|v0|websim|durable|mixo|wegic|aistudio)$/.test(t);
const scopeFor = (tool, verdict) =>
  verdict === 'ai_confirmed' || verdict === 'ai_likely'
    ? GENERATOR(tool)
      ? { design: 'ai', text: 'unknown', images: 'unknown' } // hosted artifact IS generator output; content authorship undetermined
      : { design: 'unknown', text: 'unknown', images: 'unknown' }
    : { design: 'unknown', text: 'unknown', images: 'unknown' };
const out = (verdict, toolGuess, conf, ev, pipeline) =>
  ({ verdict, aiGenerated: aiGen(verdict), toolGuess, conf, ev, pipeline, scope: scopeFor(toolGuess, verdict) });

function classify({ url, html }) {
  const host = hostOf(url);
  let pathName = '';
  try { pathName = new URL(url).pathname; } catch {}
  const ev = [];
  for (const [re, pathRe, tool, verdict] of HOST_RULES) {
    if (re.test(host) && (!pathRe || pathRe.test(pathName))) {
      ev.push(`A1: host ${host}${pathRe ? ' + path ' + pathName : ''}`);
      if (verdict === 'toolpage') return { verdict: 'toolpage', aiGenerated: null, toolGuess: tool, conf: 0.95, ev, pipeline: null, scope: null };
      return out(verdict, tool, verdict === 'ai_confirmed' ? 0.97 : verdict === 'ai_likely' ? 0.7 : verdict === 'human_likely' ? 0.4 : 0.5, ev, pipelineOf(tool));
    }
  }
  const hits = html ? probeHTML(html) : [];
  const a = hits.filter(h => h.tier.startsWith('A'));
  const b = hits.filter(h => h.tier === 'B');
  const bAi = b.filter(x => x.tool && !DESIGNER_TOOLS.has(x.tool)); // tool-specific only; generic stack (tool:null) is a method note, not an AI tell
  const bDes = b.filter(x => DESIGNER_TOOLS.has(x.tool));
  const vibe = b.some(x => !x.tool);
  const h = hits.filter(h => h.tier === 'H');
  for (const x of hits) ev.push(`${x.tier}: ${x.name}`);
  if (a.length) {
    const tool = a[0].tool;
    if (/webflow|wix|framer|canva|pitch/.test(tool || '')) return out('human_likely', tool, 0.4, ev, 'designer-tool');
    if (/beautifulai|decktopus|tome/.test(tool || '')) return out('ai_likely', tool, 0.7, ev, pipelineOf(tool));
    return out('ai_confirmed', tool, 0.93, ev, pipelineOf(tool));
  }
  // designer-tool fingerprints never escalate toward AI — they point at a
  // human-pipeline (webflow/wix/etc built by hand)
  if (bAi.length >= 2) {
    const tools = [...new Set(bAi.map(x => x.tool))];
    return out('ai_likely', tools[0], 0.72, ev, pipelineOf(tools[0]));
  }
  if (bAi.length === 1)
    return out('uncertain', bAi[0].tool, 0.5, ev, pipelineOf(bAi[0].tool));
  if (bDes.length) return out('human_likely', bDes[0].tool, 0.4, ev, 'designer-tool');
  // generic vibe stack alone = production method observed, authorship undetermined
  if (vibe) return out('uncertain', null, 0.45, ev, 'codegen-style stack (method only)');
  if (h.length) return out('human_likely', null, 0.35, ev, null);
  return out('uncertain', null, 0.2, ev.length ? ev : ['no signals'], null);
}

// image-model-derived vs coding-model-derived pipeline guess
function pipelineOf(tool) {
  if (/^(gamma|genspark|decktopus|slidebean|slidesai|beautifulai|tome|canva|presenton|chatgpt-slides)$/.test(tool)) return 'mixed/imagegen+codegen';
  if (/^(chatgpt)$/.test(tool)) return 'imagegen-or-codegen';
  if (/^(webflow|wix|framer|pitch|squarespace)$/.test(tool)) return 'designer-tool';
  return 'codegen';
}

// ---- corpus ---------------------------------------------------------------
function* metaRows(dir) {
  const m = path.join(DS, dir, 'metadata.jsonl');
  if (!existsSync(m)) return;
  for (const line of readFileSync(m, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try { yield JSON.parse(line); } catch {}
  }
}

const isTest = f => (createHash('sha1').update(f).digest()[0] % 10) >= 7;

function run() {
const corpus = [];
for (const dir of Object.keys(LABELS)) {
  const label = LABELS[dir];
  const seenFile = new Set();
  for (const r of metaRows(dir)) {
    if (!r.file || !/\.html$/.test(r.file) || seenFile.has(r.file)) continue;
    seenFile.add(r.file);
    corpus.push({ dir, label, file: r.file, url: r.pageUrl || '', bytes: r.bytes || 0 });
  }
}
console.log(`corpus: ${corpus.length} html records across ${Object.keys(LABELS).length} dirs`);

// deterministic cap per dir (hash-sorted, so train/test stay balanced)
const byDir = {};
for (const r of corpus) (byDir[r.dir] ??= []).push(r);
for (const d in byDir) byDir[d].sort((a, b) => createHash('sha1').update(a.file).digest('hex').localeCompare(createHash('sha1').update(b.file).digest('hex')));

// ---- run -------------------------------------------------------------------
const conf = {}, confNoHost = {}; // [label->verdict]
const toolConf = {};
const perDir = {};
let scanned = 0, skippedRead = 0;
for (const dir in byDir) {
  const rows = byDir[dir].slice(0, CAP);
  for (const r of rows) {
    const test = isTest(r.dir + '/' + r.file);
    if (SPLIT === 'test' && !test) continue;
    if (SPLIT === 'train' && test) continue;
    const fp = path.join(DS, r.dir, r.file);
    let html = null;
    try { html = r.bytes < 12_000_000 ? readFileSync(fp, 'utf8') : null; } catch { skippedRead++; continue; }
    const res = classify({ url: r.url, html });
    // no-host pass: how much survives on content alone (export/screenshot case)
    const resNH = classify({ url: 'https://unknown.invalid/', html });
    const k = `${r.label}->${res.verdict}`;
    conf[k] = (conf[k] || 0) + 1;
    const k2 = `${r.label}->${resNH.verdict}`;
    confNoHost[k2] = (confNoHost[k2] || 0) + 1;
    const pk = `${r.dir}(${r.label})`;
    perDir[pk] ??= {}; perDir[pk][res.verdict] = (perDir[pk][res.verdict] || 0) + 1;
    if (res.toolGuess) { const tk = `${r.dir}->${res.toolGuess}`; toolConf[tk] = (toolConf[tk] || 0) + 1; }
    scanned++;
  }
}

console.log(`scanned: ${scanned} (split=${SPLIT}, unread=${skippedRead})\n`);
console.log('== confusion (label -> verdict) ==');
for (const k of Object.keys(conf).sort()) console.log(`  ${k.padEnd(28)} ${conf[k]}`);

// metrics on labeled classes only
const sum = k => Object.entries(conf).filter(([kk]) => kk.startsWith(k + '->')).reduce((s, [, v]) => s + v, 0);
const aiN = sum('ai'), huN = sum('human'), tpN = sum('toolpage');
const pred = (l, v) => conf[`${l}->${v}`] || 0;
const aiCaught = pred('ai', 'ai_confirmed') + pred('ai', 'ai_likely');
const fp = pred('human', 'ai_confirmed') + pred('human', 'ai_likely');
const miss = pred('ai', 'human_likely') + pred('ai', 'human_confirmed');
const abst = pred('ai', 'uncertain') + pred('human', 'uncertain');
console.log(`\n== metrics (${SPLIT}) ==`);
console.log(`ai artifacts : n=${aiN}  caught=${aiCaught} (${(100 * aiCaught / aiN).toFixed(1)}%)  missed=${miss}  abstain=${pred('ai', 'uncertain')}`);
console.log(`human        : n=${huN}  false-positive=${fp} (${huN ? (100 * fp / huN).toFixed(1) : 0}%)  abstain=${pred('human', 'uncertain')}`);
console.log(`toolpages    : n=${tpN}  (kept out of matrix)`);
const nhCaught = (confNoHost['ai->ai_confirmed'] || 0) + (confNoHost['ai->ai_likely'] || 0);
const nhFP = (confNoHost['human->ai_confirmed'] || 0) + (confNoHost['human->ai_likely'] || 0);
console.log(`\n== no-host mode (content fingerprints only) ==`);
console.log(`ai caught=${nhCaught}/${aiN} (${(100 * nhCaught / aiN).toFixed(1)}%)  human FP=${nhFP}/${huN}`);
for (const k of Object.keys(confNoHost).sort()) console.log(`  ${k.padEnd(28)} ${confNoHost[k]}`);
console.log(`\n== per-dir verdict distribution ==`);
for (const k of Object.keys(perDir).sort()) console.log(`  ${k.padEnd(24)} ${JSON.stringify(perDir[k])}`);
console.log(`\n== tool attribution (dir -> guessed tool) ==`);
for (const k of Object.keys(toolConf).sort()) console.log(`  ${k.padEnd(30)} ${toolConf[k]}`);
}

export { classify, probeHTML, pipelineOf };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
