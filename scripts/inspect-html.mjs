// Inspect saved share/space HTML for artifact URLs + generator fingerprints.
import { readFileSync } from 'node:fs';
const f = process.argv[2];
const t = readFileSync(f, 'utf8');
console.log('len', t.length);
const urls = [...new Set([...t.matchAll(/https?:[^"'\s)<>\\]+/g)].map(m => m[0]))]
  .filter(u => /manuscdn|space|file|download|artifact|\.pptx|\.pdf|\.html|replay|api\./.test(u));
console.log(urls.slice(0, 50).join('\n'));
console.log('gen meta:', (t.match(/<meta[^>]*(?:generator|framework)[^>]*>/gi) || []).slice(0, 5));
console.log('title:', (t.match(/<title>[^<]*<\/title>/) || [''])[0]);
console.log('globals:', (t.match(/window\.__[A-Z_]+/g) || []).slice(0, 15));
