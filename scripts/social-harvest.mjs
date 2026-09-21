#!/usr/bin/env node
// Social/discovery harvester: finds AI-generated artifact URLs and tweet posts
// without paid APIs — HN Algolia (public), GitHub repo search (10/min), Bing
// HTML (gentle), Twitter syndication CDN (tweet JSON by id). Artifact URLs go
// to a queue file for collect-site.mjs; post metadata lands in dataset/.
// Usage: node scripts/social-harvest.mjs [--queue outfile] [--bing N] [--skip-social]
import { writeFile, appendFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const TMP = path.join(ROOT, 'dataset', '_tmp');
const UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

let QUEUE = path.join(TMP, 'social-urls.txt'), BING_Q = Infinity, SKIP_SOCIAL = false;
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--queue') QUEUE = path.resolve(argv[++i]);
  else if (argv[i] === '--bing') BING_Q = +argv[++i];
  else if (argv[i] === '--skip-social') SKIP_SOCIAL = true;
}

// Hosts that are decisively AI-builder output (match collect-site.mjs fingerprints).
const AI_HOST = /\.(lovable\.app|lovable\.dev|v0\.app|bolt\.host|websim\.com|websim\.ai|trickle\.host|butternut\.ai|framer\.website|create\.xyz|same\.new|replit\.app|base44\.app|durable\.co|mixo\.io|softr\.app|blink\.new|blinkusercontent\.com|builtwithdots\.com|magicpath\.app|a0\.dev|tempo\.new|we-web\.io|creatie\.ai|uizard\.io|hostingersite\.com|10web\.io|dora\.run|framer\.ai|typedream\.site|unicornplatform\.com|carrrd\.co|webflow\.io|wixsite\.com|site123\.com|siteground\.site|googleapis\.com\/storage)|gamma\.app\/|pitch\.com\/|tome\.app|beautiful\.ai|presenton\.ai|slidesai\.io|decktopus\.com|slidebean\.com|canva\.com\/design|prezi\.com|visme\.co|storydoc\.com|aippt\.|wonderslide\.|plusdocs\.com|chatgpt\.com\/|share\.grok\.com|grok\.com\/share|claude\.ai\/share|notion\.site|substack\.com|github\.io|netlify\.app|vercel\.app|surge\.sh|pages\.dev|fly\.dev|onrender\.com|railway\.app|render\.com/i;
const TWEET_RE = /(?:twitter\.com|x\.com)\/[A-Za-z0-9_]{1,20}\/status(?:es)?\/(\d{6,25})/g;

const artifactUrls = new Set();
const tweetIds = new Set();
const pick = (text) => {
  for (const m of text.matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) {
    const u = m[0].replace(/[.,;!?'")\]]+$/, '');
    if (AI_HOST.test(u)) artifactUrls.add(u);
  }
  for (const m of text.matchAll(TWEET_RE)) tweetIds.add(m[1]);
};

// ---------- HN Algolia: stories + comments mentioning AI builders ----------
const HN_TERMS = ['lovable.app', 'v0.dev', 'bolt.new', 'gamma.app', 'websim', 'trickle.host', 'butternut', 'base44', 'same.new', 'create.xyz', 'durable.co', 'mixo.io', 'built with lovable', 'made with v0', 'replit agent', 'websim.ai', 'magicpath', 'framer site ai', '10web', 'dora.run ai'];
async function harvestHN() {
  let n = 0;
  for (const term of HN_TERMS) {
    for (const tags of ['story', 'comment']) {
      try {
        const r = await fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(term)}&tags=${tags}&hitsPerPage=100`, { headers: UA, signal: AbortSignal.timeout(20000) });
        if (!r.ok) { console.log(`hn ${term}/${tags}: HTTP ${r.status}`); break; }
        const j = await r.json();
        for (const h of j.hits || []) {
          const text = [h.url, h.story_url, h.title, h.story_text, h.comment_text].filter(Boolean).join(' ');
          pick(text);
          if (tags === 'story' && h.url) {
            const rec = { pageUrl: `https://news.ycombinator.com/item?id=${h.objectID}`, tool: 'hackernews', kind: 'post', title: h.title, points: h.points, comments: h.num_comments, author: h.author, artifactUrl: h.url, postedAt: h.created_at, capturedAt: new Date().toISOString() };
            await appendFile(path.join(ROOT, 'dataset', 'hackernews', 'metadata.jsonl'), JSON.stringify(rec) + '\n');
            n++;
          }
        }
        await sleep(400);
      } catch (e) { console.log(`hn ${term}: ${e.message.slice(0, 60)}`); }
    }
  }
  console.log(`hn: ${n} story records`);
}

// ---------- GitHub repo search: homepages/READMEs pointing at AI artifacts ----------
const GH_Q = ['lovable.app in:readme', 'v0.dev in:readme', 'v0.app in:readme', 'bolt.new in:readme', 'websim in:readme', 'gamma.app in:readme', 'trickle.host in:readme', 'butternut.ai in:readme', 'made with lovable', 'built with v0', 'created with bolt', 'base44 in:readme', 'same.new in:readme', 'websim.ai in:readme', 'a0.dev in:readme', 'dora.run in:readme'];
async function harvestGitHub() {
  let n = 0;
  for (const q of GH_Q) {
    try {
      const r = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&per_page=100`, { headers: { ...UA, accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(20000) });
      if (r.status === 403 || r.status === 429) { console.log(`github: rate limited at "${q}" — stopping`); break; }
      if (!r.ok) { console.log(`github "${q}": HTTP ${r.status}`); continue; }
      const j = await r.json();
      for (const repo of j.items || []) {
        const text = [repo.html_url, repo.homepage, repo.description].filter(Boolean).join(' ');
        pick(text);
        if (repo.homepage && AI_HOST.test(repo.homepage)) artifactUrls.add(repo.homepage);
        const rec = { pageUrl: repo.html_url, tool: 'github-links', kind: 'repo', name: repo.full_name, description: repo.description, homepage: repo.homepage, stars: repo.stargazers_count, capturedAt: new Date().toISOString() };
        await appendFile(path.join(ROOT, 'dataset', 'github-links', 'metadata.jsonl'), JSON.stringify(rec) + '\n');
        n++;
      }
      console.log(`github "${q}": ${(j.items || []).length} repos`);
      await sleep(7000); // unauthenticated search = 10/min
    } catch (e) { console.log(`github "${q}": ${e.message.slice(0, 60)}`); await sleep(10000); }
  }
  console.log(`github: ${n} repo records`);
}

// ---------- Bing HTML: tweets + artifact mentions ----------
const BING_QS = [
  'site:x.com "lovable.app"', 'site:x.com "v0.dev"', 'site:x.com "bolt.new"', 'site:x.com "websim"',
  'site:x.com "gamma.app" presentation', 'site:x.com "made with lovable"', 'site:x.com "built with v0"',
  'site:twitter.com "lovable.app"', 'site:twitter.com "v0.dev"', 'site:twitter.com "bolt.new"',
  '"made with lovable"', '"built with v0"', '"made with bolt.new"', '"created with websim"',
  '"built with gamma" ai', '"butternut.ai"', '"trickle.host"', '"same.new" app', '"base44" app',
  'site:producthunt.com "built with lovable" OR "v0.dev"',
];
async function harvestBing() {
  let n = 0, queries = 0;
  for (const q of BING_QS.slice(0, BING_Q)) {
    try {
      const r = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(q)}&count=30`, { headers: UA, signal: AbortSignal.timeout(20000) });
      if (!r.ok) { console.log(`bing "${q}": HTTP ${r.status}`); if (r.status === 429) break; await sleep(8000); continue; }
      const html = await r.text();
      if (/unusual traffic|verify you are|captcha/i.test(html)) { console.log(`bing "${q}": captcha — stopping`); break; }
      const before = artifactUrls.size;
      pick(html);
      for (const m of html.matchAll(TWEET_RE)) tweetIds.add(m[1]);
      queries++; n += artifactUrls.size - before;
      console.log(`bing "${q}": +${artifactUrls.size - before} artifacts, ${tweetIds.size} tweets total`);
      await sleep(5000 + Math.random() * 3000);
    } catch (e) { console.log(`bing "${q}": ${e.message.slice(0, 60)}`); await sleep(8000); }
  }
  console.log(`bing: ${queries} queries, ${n} new artifacts`);
}

// ---------- Twitter syndication: fetch tweet JSON for harvested ids ----------
async function harvestTweets() {
  await mkdir(path.join(ROOT, 'dataset', 'twitter'), { recursive: true });
  const meta = path.join(ROOT, 'dataset', 'twitter', 'metadata.jsonl');
  let n = 0;
  for (const id of tweetIds) {
    try {
      const r = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=x`, { headers: UA, signal: AbortSignal.timeout(15000) });
      if (!r.ok) { await sleep(300); continue; }
      const j = await r.json();
      if (!j || !j.text) continue;
      const file = `tweet-${id}.json`;
      await writeFile(path.join(ROOT, 'dataset', 'twitter', file), JSON.stringify(j, null, 2));
      const text = [j.text, ...(j.entities?.urls || []).map(u => u.expanded_url || u.url)].join(' ');
      pick(text);
      await appendFile(meta, JSON.stringify({ pageUrl: `https://x.com/i/status/${id}`, tool: 'twitter', kind: 'post', file, author: j.user?.screen_name, text: j.text?.slice(0, 300), likes: j.favorite_count, capturedAt: new Date().toISOString() }) + '\n');
      n++;
      await sleep(250);
    } catch { await sleep(400); }
  }
  console.log(`twitter: ${n}/${tweetIds.size} tweet JSONs saved`);
}

console.log('social-harvest starting');
await mkdir(path.join(ROOT, 'dataset', 'hackernews'), { recursive: true });
await mkdir(path.join(ROOT, 'dataset', 'github-links'), { recursive: true });
await harvestHN();
await harvestGitHub();
await harvestBing();
await harvestTweets();

const urls = [...artifactUrls];
await writeFile(QUEUE, urls.join('\n') + '\n');
console.log(`DONE artifacts=${urls.length} tweets=${tweetIds.size} -> ${QUEUE}`);
