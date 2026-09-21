// Harvest manus ListCommunityUsecases (random-sample API, dedupe by recordUid).
import { writeFileSync } from 'node:fs';
const ROUNDS = parseInt(process.argv[2] || '25', 10);
const acc = new Map();
let total = 0;
for (let i = 0; i < ROUNDS; i++) {
  try {
    const r = await fetch('https://api.manus.im/session.v1.SessionPublicService/ListCommunityUsecases', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 100 }), signal: AbortSignal.timeout(20000),
    });
    const t = await r.json();
    total = t.total || total;
    for (const u of t.usecases || []) acc.set(u.recordUid, u);
    console.log(`round ${i}: +${(t.usecases||[]).length} unique=${acc.size}/${total}`);
    if (acc.size >= total) break;
    await new Promise(r => setTimeout(r, 500));
  } catch (e) { console.log('round', i, 'ERR', e.message); await new Promise(r => setTimeout(r, 1500)); }
}
writeFileSync('dataset/_work/manus-usecases.json', JSON.stringify([...acc.values()], null, 1));
console.log('SAVED unique:', acc.size, 'of', total);
