#!/usr/bin/env node
// Deterministic implementation of .devin/skills/ai-design-detector rules,
// evaluated against the collected dataset with a leakage-controlled split.
// No model calls, no credits — regex/DOM-marker scoring only.
//
// Ground truth = collector provenance (which directory / pageUrl the file came
// from), NOT per-item generation ground truth — hosting on a tool's domain
// does not prove the artifact's content was AI-generated. Metrics therefore
// report provenance identification and generation-evidence rates separately.
// Dirs whose content is the tool's own marketing/gallery chrome are labeled
// 'toolpage' and kept out of the ai/human confusion matrix.
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
  manus: 'ai', wegic: 'ai', 'lovable.app': 'ai',
  slidescarnival: 'human', deckgallery: 'human', webflow: 'human', wix: 'human',
  'human-baseline': 'human',
  v0: 'toolpage', decktopus: 'toolpage', slidebean: 'toolpage',
  slidesai: 'toolpage', beautifulai: 'toolpage', pitch: 'toolpage',
  'blink.new': 'toolpage', 'bolt.new': 'toolpage', 'trickle.so': 'toolpage',
  'v0.app': 'toolpage', 'gamma.app': 'toolpage', 'v0 by vercel': 'toolpage',
  framer: 'skip', replit: 'skip', mixed: 'skip', 'sites-mixed': 'skip',
  hostinger: 'skip', softr: 'skip', createxyz: 'skip',
  'websim.com': 'skip', canva: 'skip', 'misc-deployed': 'skip', storyd: 'skip',
};

// ---- feature extraction ---------------------------------------------------
// Host rules give PROVENANCE only. Being hosted/published/rendered on a
// surface — including a generator's own artifact domain — does NOT prove the
// individual artifact's design was AI-generated: most surfaces also serve
// imported, manually authored, or manually edited content. Generation requires
// per-item evidence (in-artifact generator markers, generation records,
// author claims, asset metadata) handled by probeHTML tiers below.
//
// [hostRe, pathRe|null, tool, kind]
//   'prov'     — pipeline/surface identified; authorship undetermined
//   'toolpage' — the tool's own marketing/editor UI, not an artifact
const HOST_RULES = [
  [/\.blinkusercontent\.com$/, null, 'blink', 'prov'],
  [/\.lovable\.app$/, null, 'lovable', 'prov'],
  [/\.c\.websim\.com$/, null, 'websim', 'prov'],
  [/\.on\.websim\.com$/, null, 'websim', 'prov'], // deployed artifact surface; internals carry __websim* + v1/project/<id> records
  [/^websim\.com$|^websim\.ai$/, /^\/@[^/]+\//, 'websim', 'prov'], // project page; artifact iframe carries globals
  [/\.gamma\.site$/, null, 'gamma', 'prov'],
  [/\.manus\.space$/, null, 'manus', 'prov'],
  [/\.base44\.app$/, null, 'base44', 'prov'],
  [/\.grok\.me$/, null, 'grok', 'prov'],
  [/\.emergent\.host$/, null, 'emergent', 'prov'],
  [/\.butternut\.ai$/, null, 'butternut', 'prov'],
  [/\.trickle\.host$/, null, 'trickle', 'prov'],
  [/\.chatgpt\.site$/, null, 'chatgpt', 'prov'],
  [/\.bolt\.host$/, null, 'bolt', 'prov'],
  [/\.polsia\.app$|^polsia\.io$/, null, 'polsia', 'prov'],
  [/\.durable\.co$/, null, 'durable', 'prov'],
  [/\.mixo\.io$/, null, 'mixo', 'prov'],
  [/^websim\.com$|^websim\.ai$/, null, 'websim-shell', 'toolpage'],
  [/^v0\.app$|^v0\.dev$/, null, 'v0-toolpage', 'toolpage'],
  [/^presenton\.ai$/, /^\/community\/presentations\//, 'presenton', 'prov'],
  [/\.wegic\.net$/, null, 'wegic', 'prov'],
  [/\.framer\.ai$/, null, 'framer', 'prov'],
  [/\.framer\.website$|\.framer\.site$/, null, 'framer', 'prov'],
  [/\.my\.canva\.site$|\.canva\.com$/, null, 'canva', 'prov'],
  [/\.beautiful\.ai$/, null, 'beautifulai', 'prov'],
  [/\.decktopus\.com$/, null, 'decktopus', 'prov'],
  [/^tome\.app$/, null, 'tome', 'prov'],
  [/(^|\.)pitch\.com$/, null, 'pitch', 'prov'],
  [/\.replit\.app$/, null, 'replit', 'prov'],
  [/\.ai\.studio$/, null, 'aistudio', 'prov'],
  [/\.webflow\.io$/, null, 'webflow', 'prov'],
  // 2026-09 refresh (web-verified hosts; all provenance-only)
  [/\.lovable\.dev$|\.lovableproject\.com$/, null, 'lovable', 'prov'],
  [/\.wegic\.app$/, null, 'wegic', 'prov'],
  [/\.vusercontent\.net$/, null, 'v0', 'prov'],
  [/^claude\.site$/, /^\/artifacts\//, 'claude-artifact', 'prov'],
  [/^chatgpt\.com$/, /^\/share\//, 'chatgpt', 'prov'],
  [/^g\.co$/, /^\/gemini\/share/, 'gemini', 'prov'],
  [/^aistudio\.google\.com$/, /^\/apps\/drive\//, 'aistudio', 'prov'],
  [/\.figma\.site$/, null, 'figma', 'prov'],
  [/\.created\.app$/, null, 'anything', 'prov'],
  [/\.hf\.space$|\.static\.hf\.space$/, null, 'huggingface', 'prov'],
  [/^deepsite\.hf\.co$/, null, 'deepsite', 'prov'],
  [/^chat\.z\.ai$/, /-ppt$/, 'zai-slides', 'prov'],
  [/\.mocha\.app$/, null, 'mocha', 'prov'],
  [/\.capacity\.studio$/, null, 'capacity', 'prov'],
  [/\.floot\.app$/, null, 'floot', 'prov'],
  [/\.orchids\.app$/, null, 'orchids', 'prov'],
  [/\.hostingersite\.com$|\.cdn\.hstgr\.net$/, null, 'hostinger', 'prov'],
  // *.10web.site intentionally omitted — pattern unverified (EVIDENCE.md)
  [/\.hocoos\.com$/, null, 'hocoos', 'prov'],
  [/\.softr\.io$|\.softr\.app$/, null, 'softr', 'prov'],
  [/\.bubbleapps\.io$/, null, 'bubble', 'prov'],
  [/\.dora\.run$/, null, 'dora', 'prov'],
  [/\.gradio\.live$/, null, 'gradio', 'prov'],
  [/\.notion\.site$/, null, 'notion', 'prov'],
  [/^gamma\.app$/, /^\/(docs|public)\//, 'gamma', 'prov'],
  [/^gamma\.app$/, null, 'gamma-toolpage', 'toolpage'],
  [/^app\.getalai\.com$/, /^\/view\//, 'alai', 'prov'],
  [/^app\.chroniclehq\.com$/, /^\/share\//, 'chronicle', 'prov'],
  [/\.storydoc\.com$/, null, 'storydoc', 'prov'],
  [/^wonderslide\.com$/, /^\/s\//, 'wonderslide', 'prov'],
  [/^my\.visme\.co$/, /^\/view\//, 'visme', 'prov'],
  [/^view\.genial\.ly$|^view\.genially\.com$/, null, 'genially', 'prov'],
  [/^prezi\.com$/, /^\/p\//, 'prezi', 'prov'],
  [/\.ludus\.one$/, null, 'ludus', 'prov'],
  [/^show\.zoho\.(com|eu|in|jp)$/, null, 'zoho-show', 'prov'],
  [/^kimi\.com$/, /^\/slides/, 'kimi', 'prov'],
  [/^notebooklm\.google\.com$/, null, 'notebooklm', 'prov'],
  [/^opal\.google$/, null, 'opal', 'prov'],
  // tool marketing/login domains — surface identification only (toolpage),
  // EXCEPT manus.im/share/* which wraps a per-item artifact (prov).
  [/^manus\.im$/, /^\/share\//, 'manus', 'prov'],
  [/^manus\.im$/, null, 'manus', 'toolpage'],
  [/^emergent\.sh$/, null, 'emergent', 'toolpage'],
  [/^blink\.new$/, null, 'blink', 'toolpage'],
  [/^bolt\.new$/, null, 'bolt', 'toolpage'],
  [/^trickle\.so$/, null, 'trickle', 'toolpage'],
  [/(^|\.)slidesai\.io$/, null, 'slidesai', 'toolpage'],
  [/(^|\.)genspark\.ai$/, null, 'genspark', 'toolpage'],
  [/^replit\.com$/, null, 'replit', 'toolpage'],
  [/^vercel\.com$/, null, 'vercel', 'toolpage'],
  [/(^|\.)storyd\.ai$/, null, 'storyd', 'prov'],
];

function hostOf(url) { try { return new URL(url).hostname.toLowerCase(); } catch { return ''; } }

// Cheap substring/regex probes. Each returns {name, tier, tool?} when hit.
// Tiers:
//   G  — per-item generation evidence: markers emitted only in generator
//        output (artifact badge scripts/globals, project-id metas, per-item
//        "generated/built by X" claims, generation records). Decisive alone.
//   G- — weaker generator-output markers (design-system classes) -> ai_likely.
//   P  — provenance/pipeline only: identifies the tool or surface the page
//        was built/served with, NOT how the content was authored. Never
//        escalates a verdict by itself.
//   H  — human-side content evidence (template signatures, CMS-authored
//        placeholder copy). Still a lean, not a confirmation.
// NOTE: a page that *provides* AI features or names a model it uses
// ("Powered by GPT-4") is NOT evidence the page itself was generated by it.
function probeHTML(html) {
  const hits = [];
  const has = (re, name, tier, tool) => { if (re.test(html)) hits.push({ name, tier, tool }); };
  // G — artifact-level generation markers
  has(/blink-badge|blink-picker|blink-edit-hover|blink-seo-text/, 'blink artifact badge classes', 'G', 'blink');
  has(/auto-engineer\.js\?projectId=/, 'blink generation stub (projectId)', 'G', 'blink');
  has(/og:title" content="Blink App"|An app built with Blink\./, 'blink "built with" claim', 'G', 'blink');
  has(/bolt\.new\/badge\.js|Made in Bolt/i, 'bolt artifact badge', 'G', 'bolt');
  has(/lovable-badge|gpt-engineer-file-uploads|gpteng\.co/, 'lovable artifact badge', 'G', 'lovable');
  has(/v0-built-with-button-|Built with v0/i, 'v0 "built with" badge', 'G', 'v0');
  has(/<meta name="generator" content="v0\.app"/, 'generator=v0.app meta (per-item claim)', 'G', 'v0');
  has(/id="emergent-badge"|emergent\.sh\/\?utm_source=emergent-badge/, 'emergent artifact badge', 'G', 'emergent');
  has(/A product of emergent\.sh/, 'emergent "product of" claim', 'G', 'emergent');
  has(/wegic-branding-badge|wegic-badge|cdn\.wegic\.ai/, 'wegic artifact badge', 'G', 'wegic');
  has(/base44-edit-badge|base44-scale-in|media\.base44\.com|app\.base44\.com/, 'base44 artifact markers', 'G', 'base44');
  has(/<meta name="grok-project-id"/, 'grok project-id meta (generation record)', 'G', 'grok');
  has(/files\.manuscdn\.com|manus-content-root|__manus_space_editor_info|__manus__global_env/, 'manus artifact shell', 'G', 'manus');
  // websim artifact internals: injected runtime class + per-item project
  // record URLs (websim.com/v1/project/<id>/revision/<n>) — both only exist
  // inside websim-generated artifacts
  has(/__websim_origin|__websim_route|__websim|websim-injected|websim\.com\/v1\/project\/|websim\.postComment/, 'websim artifact internals', 'G', 'websim');
  // trickle injected badge div + "Built with Trickle AI" link (verified in
  // trickle/*.trickle.host captures) — per-item generator output marker
  has(/proto-trickle-badge-element|Built with Trickle AI/, 'trickle artifact badge', 'G', 'trickle');
  // butternut in-artifact badge anchor "Built on <span>Butternut AI</span>"
  has(/Built on\s*<[^>]*>\s*Butternut AI|Built on Butternut AI/, 'butternut artifact badge', 'G', 'butternut');
  // emergent runtime assets survive on off-platform deploys (netlify etc.)
  has(/assets\.emergent\.sh\/scripts\/emergent-main\.js|ap\.emergent\.sh\/static\//, 'emergent runtime scripts (off-host)', 'G', 'emergent');
  has(/v0-gray-|v0-alpha-|v0-blue-|v0-caveat-/, 'v0 design-system classes', 'G-', 'v0');
  // P — provenance / pipeline only (tool identified, authorship undetermined)
  has(/Made with Gamma|css-1fr8asy/, 'gamma publish badge (on all published docs)', 'P', 'gamma');
  // camelCase flag names only — bare 'imagen'/'ideogram' appear in prose
  has(/generatorGPT4|prefer-openai-dalle|baseten-generate-flux-schnell|recraftModel|leonardoPhoenix|lumaPhoton|gpt4oMiniGenerate/, 'gamma app-config pool', 'P', 'gamma');
  has(/gamma-moveable-wrapper|gamma-sites-|assets\.gammahosted\.com|gamma-app\.workers\.dev/, 'gamma DOM/CDN', 'P', 'gamma');
  has(/data-framer-|framerusercontent\.com|__framer__/, 'framer markup/cdn', 'P', 'framer');
  has(/<meta name="generator" content="Framer/, 'generator=Framer (tool claim)', 'P', 'framer');
  has(/<meta name="generator" content="Webflow/, 'generator=Webflow (tool claim)', 'P', 'webflow');
  has(/<meta name="generator" content="Wix\.com/, 'generator=Wix (tool claim)', 'P', 'wix');
  has(/data-wf-site|data-wf-page|webflow\.css/, 'webflow markup', 'P', 'webflow');
  has(/wixstatic\.com|X-Wix/, 'wix assets', 'P', 'wix');
  has(/pitch\.com\/static\/platform\/asset\/|pitch-assets-|\| Pitch</, 'pitch assets', 'P', 'pitch');
  has(/cdn\.prod\.website-files\.com/, 'webflow cdn', 'P', 'webflow');
  has(/media-prod\.butternut\.ai/, 'butternut media cdn (covers custom domains)', 'P', 'butternut');
  has(/[a-z0-9-]+\.lovable\.cloud|[a-z0-9-]+-prod\.lovable\.cloud/, 'lovable cloud storage back-ref', 'P', 'lovable');
  has(/blink\.new\/preview-access/, 'blink gated preview wall', 'P', 'blink');
  has(/polsia\.com\/api\/beacon|polsia_vid/, 'polsia beacon', 'P', 'polsia');
  has(/<meta name="netlify-deploy"|netlify\.new\/\?utm_campaign/, 'netlify deploy meta (pipeline only)', 'P', null);
  has(/squarespace|static\.squarespace/, 'squarespace markup', 'P', 'squarespace');
  has(/wp-content|wp-includes|woocommerce/i, 'wordpress markup', 'P', 'wordpress');
  // unattributed stack = production method note, not authorship evidence
  const vibe = /id="root"/.test(html) && /\/assets\/index-[A-Za-z0-9_-]+\.js/.test(html)
    && /(lucide|stroke-linecap="round")/.test(html) && /max-w-\d|mx-auto|rounded-lg/.test(html);
  if (vibe) hits.push({ name: 'vite+react+tailwind+lucide (unmarked)', tier: 'P', tool: null });
  // H — human-side content evidence
  has(/Here is where your presentation begins|presentation begins/i, 'SlidesGo/Carnival template signature', 'H', 'slidesgo-template');
  return hits;
}

// ---- verdict ---------------------------------------------------------------
// Contract (see SKILL.md):
//   verdict     = graded call on AI GENERATION of the artifact's content.
//   aiGenerated = tri-state true|false|null — null = undetermined or
//                 provenance-only; consumers must NOT read null as human.
//   provenance  = tool/pipeline identification (host, markup, badges) —
//                 orthogonal to authorship; can be set while aiGenerated=null.
//   scope       = which components the evidence covers. design='ai' only when
//                 per-item generation evidence exists — never from hosting
//                 alone. text/images stay 'unknown' without per-asset evidence.
const AI_V = new Set(['ai_confirmed', 'ai_likely']);
const HU_V = new Set(['human_likely', 'human_confirmed']);
const aiGen = v => AI_V.has(v) ? true : HU_V.has(v) ? false : null;
const scopeFor = verdict =>
  AI_V.has(verdict)
    ? { design: 'ai', text: 'unknown', images: 'unknown' } // generation evidence covers the artifact's design; per-asset authorship unprobed
    : HU_V.has(verdict)
      ? { design: 'human', text: 'unknown', images: 'unknown' }
      : { design: 'unknown', text: 'unknown', images: 'unknown' };
// Element-level evidence tags — WHERE the AI signal lives, independent of the
// overall verdict (a human page can still contain an injected AI badge/image).
function elementsFor(html, hits) {
  const el = new Set();
  const n = new Set(hits.map(h => h.name));
  if (hits.some(h => /badge/i.test(h.name))) el.add('badge');
  if (hits.some(h => /meta|record|stub|shell|globals|project-id|editor_info/i.test(h.name))) el.add('genrecord');
  if (/Made with NotebookLM/i.test(html)) el.add('watermark');
  if (/<img[^>]+prompt="/i.test(html)) el.add('genrecord'); // presenton per-asset prompt records
  if (/images\.openai\.com|oaidalleapiprodscus|dalle-|seedream|imagefx|imagen-|media-prod\.butternut|lovable-uploads|gptengineer.*uploads/i.test(html)) el.add('images');
  if (/lucide(-react)?['"\/]|class="lucide|stroke-linecap="round"/.test(html)) el.add('icons');
  if (/font-family[^;]*(Inter|Geist|Space Grotesk)/i.test(html) || /@font-face[^}]*?(Inter|Geist|Space Grotesk)/i.test(html)) el.add('font');
  if (/is not set in the (server )?environment|process\.env\.[A-Z_]+ (is|was) (not|missing)|__NEXT_DATA__.*error/i.test(html)) el.add('corrupt');
  if (!el.size) el.add('none');
  return [...el];
}
const out = (verdict, toolGuess, conf, ev, pipeline, provenance, elements) =>
  ({ verdict, aiGenerated: aiGen(verdict), toolGuess, provenance, conf, ev, pipeline, scope: scopeFor(verdict), elements });

function classify({ url, html }) {
  const host = hostOf(url);
  let pathName = '';
  try { pathName = new URL(url).pathname; } catch {}
  const ev = [];
  let provenance = null;
  for (const [re, pathRe, tool, kind] of HOST_RULES) {
    if (re.test(host) && (!pathRe || pathRe.test(pathName))) {
      ev.push(`A1: host ${host}${pathRe ? ' + path ' + pathName : ''}`);
      if (kind === 'toolpage')
        return { verdict: 'toolpage', aiGenerated: null, toolGuess: tool, provenance: { tool, certainty: 'confirmed', via: 'host' }, conf: 0.95, ev, pipeline: null, scope: null };
      provenance = { tool, certainty: 'confirmed', via: 'host' };
      break;
    }
  }
  const hits = html ? probeHTML(html) : [];
  const g = hits.filter(x => x.tier === 'G');          // per-item generation evidence
  const gWeak = hits.filter(x => x.tier === 'G-');     // weaker generator-output markers
  const p = hits.filter(x => x.tier === 'P');          // provenance only
  const hTier = hits.filter(x => x.tier === 'H');      // human-side evidence
  for (const x of hits) ev.push(`${x.tier}: ${x.name}`);
  const elements = html ? elementsFor(html, hits) : ['none'];
  // markup can also establish provenance (weaker than host evidence)
  if (!provenance) {
    const pt = g[0]?.tool || gWeak[0]?.tool || p.find(x => x.tool)?.tool;
    if (pt) provenance = { tool: pt, certainty: 'likely', via: 'markup' };
  }
  const toolGuess = g[0]?.tool || gWeak[0]?.tool || provenance?.tool || p.find(x => x.tool)?.tool || null;
  // generation evidence decides; provenance alone never does
  if (g.length) return out('ai_confirmed', toolGuess, g.length > 1 ? 0.95 : 0.9, ev, pipelineOf(toolGuess), provenance, elements);
  if (gWeak.length) return out('ai_likely', toolGuess, 0.7, ev, pipelineOf(toolGuess), provenance, elements);
  // human-side content evidence (template signatures etc.) — a lean, not proof
  if (hTier.length) return out('human_likely', toolGuess, 0.4, ev, toolGuess ? pipelineOf(toolGuess) : null, provenance, elements);
  // provenance only — pipeline/surface identified, authorship undetermined
  if (provenance || p.some(x => x.tool))
    return out('uncertain', toolGuess, 0.5, ev, toolGuess ? pipelineOf(toolGuess) : null, provenance, elements);
  if (p.length) return out('uncertain', null, 0.45, ev, 'codegen-style stack (method only)', provenance, elements);
  return out('uncertain', null, 0.2, ev.length ? ev : ['no signals'], null, provenance, elements);
}

// production-method family of the identified tool — a pipeline/provenance
// guess, NOT an AI-authorship claim (a hand-written React app is also codegen
// method; a hand-exported slide raster is also image-pipeline).
function pipelineOf(tool) {
  if (/^(gamma|genspark|decktopus|slidebean|slidesai|beautifulai|tome|canva|presenton|chatgpt-slides)$/.test(tool)) return 'mixed/imagegen+codegen';
  if (/^(chatgpt)$/.test(tool)) return 'imagegen-or-codegen';
  if (/^(webflow|wix|framer|pitch|squarespace|wordpress|slidesgo-template)$/.test(tool)) return 'designer-tool';
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
console.log(`NOTE: dir labels are collector PROVENANCE (which tool a capture came`);
console.log(`from), not per-item generation ground truth. "generation-evidence"`);
console.log(`counts = items where in-artifact markers proved generation;`);
console.log(`"provenance-only" = tool identified, authorship undetermined (null).`);
console.log(`ai-labeled   : n=${aiN}  generation-evidence=${aiCaught} (${(100 * aiCaught / aiN).toFixed(1)}%)  provenance-only=${pred('ai', 'uncertain')}  human-verdict=${miss}`);
console.log(`human-labeled: n=${huN}  ai-verdict(FP)=${fp} (${huN ? (100 * fp / huN).toFixed(1) : 0}%)  uncertain=${pred('human', 'uncertain')}  human-evidence=${pred('human', 'human_likely') + pred('human', 'human_confirmed')}`);
console.log(`toolpages    : n=${tpN}  (kept out of matrix)`);
// provenance identification accuracy: how often toolGuess names the source tool
const provCorrect = Object.entries(toolConf).filter(([k]) => k.split('->')[0] === k.split('->')[1]).reduce((s, [, v]) => s + v, 0);
const provTotal = Object.values(toolConf).reduce((s, v) => s + v, 0);
console.log(`provenance   : toolGuess matched source dir on ${provCorrect}/${provTotal} flagged items`);
const nhCaught = (confNoHost['ai->ai_confirmed'] || 0) + (confNoHost['ai->ai_likely'] || 0);
const nhFP = (confNoHost['human->ai_confirmed'] || 0) + (confNoHost['human->ai_likely'] || 0);
console.log(`\n== no-host mode (in-artifact evidence only, no URL) ==`);
console.log(`ai-labeled: generation-evidence=${nhCaught}/${aiN} (${(100 * nhCaught / aiN).toFixed(1)}%)  human-labeled ai-verdict=${nhFP}/${huN}`);
for (const k of Object.keys(confNoHost).sort()) console.log(`  ${k.padEnd(28)} ${confNoHost[k]}`);
console.log(`\n== per-dir verdict distribution ==`);
for (const k of Object.keys(perDir).sort()) console.log(`  ${k.padEnd(24)} ${JSON.stringify(perDir[k])}`);
console.log(`\n== tool attribution (dir -> guessed tool) ==`);
for (const k of Object.keys(toolConf).sort()) console.log(`  ${k.padEnd(30)} ${toolConf[k]}`);
}

export { classify, probeHTML, pipelineOf };
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
