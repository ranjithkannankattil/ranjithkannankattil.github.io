// Browser check for the "Around <place>" block on news.html, with sample data.
// Serve the repo on :8767, then run from a folder where 'playwright' resolves.
import { chromium } from 'playwright';
const BASE = process.env.SITE || 'http://localhost:8767';
const now = Math.floor(Date.now() / 1000);
const st = (t, src = 'The Hindu') => ({ t, u: 'https://example.com/' + encodeURIComponent(t), src, ts: now - 3600, s: '' });
const index = {
  updated: now, every: 7200, live: '', topics: [],
  langs: { en: { name: 'English', native: 'English' }, ml: { name: 'Malayalam', native: 'മലയാളം' } },
  outlets: { en: ['The Hindu'], ml: ['Mathrubhumi'] },
  places: [
    { id: 'world', name: 'World', kind: 'world', parent: null, langs: ['en'] },
    { id: 'kerala', name: 'Kerala', kind: 'region', parent: 'world', langs: ['en', 'ml'] },
    { id: 'thrissur', name: 'Thrissur', kind: 'city', parent: 'kerala', langs: ['en', 'ml'] },
    { id: 'kodungallur', name: 'Kodungallur', kind: 'city', parent: 'kerala', langs: ['en', 'ml'] },
  ],
};
const files = {
  'index.json': index,
  'p/kodungallur.json': { id: 'kodungallur', updated: now, news: { en: [st('Muziris boat tour opens')], ml: [] }, other: {},
    around: { from: 'thrissur', news: { en: [st('Thrissur pooram plan'), st('Thrissur rail works')] } } },
  'p/thrissur.json': { id: 'thrissur', updated: now, news: { en: [st('Thrissur pooram plan')], ml: [] }, other: {} },
};
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failed = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };
for (const [w, label] of [[1280, 'desktop'], [390, 'phone']]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  p.on('pageerror', (e) => { console.log('pageerror', e.message); failed++; });
  await p.route('https://raw.githubusercontent.com/**', (r) => {
    const path = new URL(r.request().url()).pathname.split('/news-data/')[1];
    r.fulfill({ status: files[path] ? 200 : 404, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(files[path] || {}) });
  });
  await p.route(/fonts\.g|firestore|gstatic|visits/, (r) => r.abort());
  await p.goto(BASE + '/news.html?p=kodungallur'); await p.waitForTimeout(900);
  const blocks = await p.$$('.around');
  ok(blocks.length === 1, `${label}: one Around block on a thin place (${blocks.length})`);
  if (blocks.length) {
    ok(/Around Kodungallur — from Thrissur/.test(await blocks[0].textContent()), `${label}: heading names the place and where the stories come from`);
    ok((await blocks[0].$$('.story')).length === 2, `${label}: holds the 2 borrowed stories`);
  }
  await p.goto(BASE + '/news.html?p=thrissur'); await p.waitForTimeout(900);
  ok((await p.$$('.around')).length === 0, `${label}: no Around block when the data has none`);
  if (w === 390) await p.goto(BASE + '/news.html?p=kodungallur').then(() => p.waitForTimeout(900)).then(() => p.screenshot({ path: process.env.SHOT || 'around-phone.png', fullPage: true }));
  await p.close();
}
await b.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
