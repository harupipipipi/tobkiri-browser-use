#!/usr/bin/env node
// v5 manifest builder: basis-classified truth labels for the SNS-primary
// collection. Probes sibling .html for in-artifact generation markers;
// upgrades host-only -> marker when found; classifies tool's own marketing
// pages as 'toolpage' (excluded from the ai/unknown confusion matrix).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const items = JSON.parse(readFileSync('dataset/_tmp/v5-candidates.json', 'utf8'));

// In-artifact generation markers (tight patterns — 'openai'/'gemini' prose
// matches are NOT markers, they appear in unrelated pages).
const PROBES = [
  ['blink', /auto-engineer\.js|blink-badge|__bpt|Made with Blink/i],
  ['base44', /base44-edit-badge|media\.base44\.com|app\.base44\.com/i],
  ['emergent', /emergent-badge|emergent\.sh|A product of emergent/i],
  ['bolt', /bolt\.new\/badge|Made in Bolt/i],
  ['websim', /websim-injected|websim\.com\/v1\/project\/|__websim/i],
  ['lovable', /lovable-badge|gpteng\.co|lovable-uploads|gpt-engineer-file-uploads/i],
  ['grok', /grok-project-id/i],
  ['v0', /v0-built-with-button-|Built with v0|generator" content="v0\.app/i],
  ['claude', /claude\.site\/(artifacts|public)|Made with Artifacts|Artifacts are user-generated/i],
  ['chatgpt-share', /chatgpt\.com\/share\//i],
  ['notebooklm', /notebooklm\.google\.com|Made with NotebookLM/i],
  ['manus', /files\.manuscdn\.com|__manus|Made with Manus|AI-generated \(possibly user-edited\)/i],
  ['replit', /Made with Replit|replit\.com\/referrals|__NEXT_DATA__.*replit/i],
  ['gamma', /Made with Gamma|gamma-moveable-wrapper|assets\.gammahosted\.com/i],
  ['trickle', /proto-trickle-badge-element|Built with Trickle AI/i],
  ['butternut', /Built on[^<]*<[^>]*>?\s*Butternut AI|media-prod\.butternut\.ai/i],
  ['wegic', /wegic-branding-badge|cdn\.wegic\.ai/i],
];
const GEN_SURFACE = /blinkusercontent\.com|blinkpowered\.com|base44\.app|bolt\.host|emergent\.host|wegic\.(net|app)|grok\.me|chatgpt\.site|c\.websim\.com|on\.websim\.com|websim\.(com|ai)\//i;
const GENRECORD = /v0\.app\/chat|v0\.dev\/chat|claude\.site\/(artifacts|public)|chatgpt\.com\/share|grok\.com\/share|manus\.im\/share|notebooklm\.google\.com\/notebook|presenton\.ai\/community|kimi\.com\/(share|preview)/i;
const TOOLPAGE = /^(https?:\/\/)?(www\.)?(presentations\.ai|presenton\.ai|create\.xyz|v0\.(app|dev)|vercel\.app|manus\.space|manus\.im\/invitation|genspark\.ai|github\.com|yourtechcompass\.com|notebooklm\.google\.com\/?$|1\.websim\.ai|websim\.ai\/?$|lovable\.app\/?$|base44\.app\/?$|chat\.deepseek\.com|pitch\.com|canva\.com|beautiful\.ai)\/?([?#].*)?$/i;
const HOSTONLY = /replit\.app|gamma\.(app|site)|perplexity\.ai|vercel\.app|netlify|github\.io|same\.new/i;

const out = [{
  _meta: {
    rulesVersion: 'contract-v3.1',
    built: '2026-10-04',
    note: 'SNS-primary collection (x-tweet resolved + backlog topup). truth: ai only via marker/gen-surface/genrecord basis; toolpage = tool marketing/gallery chrome, excluded; unknown = host-only/xmedia without per-item generation evidence. marker basis = sibling HTML carries generator markers.',
    counts: null,
  }
}];
for (const it of items) {
  const u = it.url;
  const htmlFile = 'dataset/' + it.f.replace(/\.(png|jpg|webp|jpeg)$/i, '.html');
  it.markerHits = existsSync(htmlFile) ? PROBES.filter(([, re]) => re.test(readFileSync(htmlFile, 'utf8'))).map(([n]) => n) : [];
  if (it.src === 'x-tweet-media') { it.basis = 'xmedia'; it.truth = 'unknown'; it.pipe = 'imagegen?'; }
  else if (TOOLPAGE.test(u)) { it.basis = 'toolpage'; it.truth = 'toolpage'; it.pipe = 'n/a'; }
  else if (it.markerHits.length) { it.basis = 'marker'; it.truth = 'ai'; it.pipe = 'codegen'; }
  else if (GENRECORD.test(u)) { it.basis = 'genrecord'; it.truth = 'ai'; it.pipe = /v0|claude|chatgpt|grok|manus|kimi/.test(u) ? 'codegen' : 'mixed'; }
  else if (GEN_SURFACE.test(u)) { it.basis = 'gen-surface'; it.truth = 'ai'; it.pipe = 'codegen'; }
  else { it.basis = 'host-only'; it.truth = 'unknown'; it.pipe = '?'; }
  out.push(it);
}
const c = {};
for (const i of out.slice(1)) { const k = i.truth + '/' + i.basis; c[k] = (c[k] || 0) + 1; }
out[0]._meta.counts = c;
writeFileSync('eval/blindset/v5-candidates.json', JSON.stringify(out, null, 1));
console.log(c);
const urls = new Set(out.slice(1).map(i => i.url));
console.log('unique artifacts:', urls.size, 'files:', out.length - 1);
