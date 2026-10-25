// Browser checks for the Photography pages (cards → place → month), sharing and the viewer.
// Run: serve the repo on :8766, then node scripts/check_photography.mjs (with playwright resolvable)
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8766';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };

async function open(path, { width = 1280, height = 900, init } = {}) {
  const p = await b.newPage({ viewport: { width, height } });
  p.setDefaultTimeout(3000);
  p.on('pageerror', (e) => { if (/firebase|gstatic/.test(e.message)) return; console.log('pageerror', e.message); failed++; });
  await p.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  if (init) await p.addInitScript(init);
  await p.goto(BASE + path);
  await p.waitForTimeout(500);
  return p;
}
const viewer = (p) => p.evaluate(() => ({ open: document.querySelector('#lb').open, no: document.querySelector('#lbNo').textContent, cap: document.querySelector('#lbCap').textContent }));

const checks = {
  async 'cards link to places'() {
    const p = await open('/photography/');
    const cards = await p.$$eval('.pl-card', (a) => a.map((x) => [x.getAttribute('href'), x.querySelector('.pl-name').textContent]));
    ok(cards.length === 5 && cards[0][0] === '/photography/tenby/', `5 cards, newest first (${cards.map((c) => c[1]).join(', ')})`);
    await p.click('.pl-card >> text=Swansea');
    await p.waitForTimeout(300);
    ok(p.url().endsWith('/photography/swansea/'), 'card opens the place');
    await p.close();
  },
  async 'location page shows all visits'() {
    const p = await open('/photography/swansea/');
    ok((await p.locator('.ph-set').count()) === 1 && (await p.locator('.ph').count()) === 26, 'Swansea: 1 visit, 26 photos');
    ok((await p.getAttribute('.ph-set-title a', 'href')) === '/photography/swansea/2026-05/', 'visit heading links to the month page');
    await p.close();
  },
  async 'visit page only its photos'() {
    const p = await open('/photography/gower/2026-06/');
    ok((await p.locator('.ph').count()) === 7, 'Gower June 2026: 7 photos');
    ok((await p.textContent('h1')) === 'Gower · June 2026', 'title "Gower · June 2026"');
    await p.close();
  },
  async 'hash opens viewer'() {
    const p = await open('/photography/tenby/2026-08/#4');
    const v = await viewer(p);
    ok(v.open && /04 \/ 19/.test(v.no) && v.cap === 'Cannon and a quiet seat, Castle Hill', `#4 opens photo 4 (${v.no} ${v.cap})`);
    await p.keyboard.press('ArrowRight');
    ok(p.url().endsWith('#5'), 'moving on updates the address to #5');
    await p.close();
    const q = await open('/photography/tenby/#v2026-08-2');
    const w = await viewer(q);
    ok(w.open && /02 \/ 19/.test(w.no) && w.no.startsWith('August 2026'), `location page #v2026-08-2 (${w.no})`);
    await q.close();
  },
  async 'viewer stays in visit'() {
    const p = await open('/photography/gower/2026-06/#7');
    await p.keyboard.press('ArrowRight');
    const v = await viewer(p);
    ok(/01 \/ 7/.test(v.no), `after the last photo comes the first of the same visit (${v.no})`);
    await p.close();
  },
  async 'out of range hash'() {
    const p = await open('/photography/gower/2026-06/#99');
    ok(!(await viewer(p)).open && (await p.locator('.ph').count()) === 7, '#99: page normal, no viewer');
    await p.close();
  },
  async 'share copies link'() {
    const p = await open('/photography/swansea/2026-05/', { init: () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copied = t; } }, configurable: true });
    } });
    await p.click('.ph-place .ph-share');
    await p.waitForTimeout(150);
    ok((await p.evaluate(() => window.__copied)) === 'https://ranjithkb.com/photography/swansea/2026-05/', 'Share copies the month address');
    ok((await p.textContent('#phMsg')) === 'Link copied' && await p.isVisible('#phMsg'), 'shows "Link copied"');
    await p.close();
    const q = await open('/photography/swansea/', { width: 390, height: 844, init: () => {
      Object.defineProperty(navigator, 'share', { value: async (d) => { window.__shared = d; }, configurable: true });
    } });
    await q.click('.ph-set-head .ph-share');
    await q.waitForTimeout(150);
    const d = await q.evaluate(() => window.__shared || {});
    ok(d.url === 'https://ranjithkb.com/photography/swansea/2026-05/' && d.title === 'Swansea · May 2026', 'phone: share sheet with the month link');
    await q.close();
  },
  async 'share fallback shows address'() {
    const p = await open('/photography/milan/', { init: () => {
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('blocked'); } }, configurable: true });
    } });
    await p.click('.ph-place .ph-share');
    await p.waitForTimeout(150);
    ok((await p.inputValue('#phMsg input')) === 'https://ranjithkb.com/photography/milan/', 'clipboard blocked: the address is shown in a box to copy');
    await p.waitForTimeout(11000);
    ok(await p.isVisible('#phMsg input'), 'the address stays up (still there after 11 s)');
    await p.click('#phMsg .ph-msg-x');
    ok(!(await p.isVisible('#phMsg input')), 'Close hides it');
    ok((await p.getAttribute('#phMsg', 'role')) === 'status' && (await p.$eval('#phMsg', (e) => !e.hidden)), 'status area stays in the page for screen readers');
    await p.close();
  },
  async 'phone fits'() {
    for (const path of ['/photography/', '/photography/swansea/', '/photography/gower/2026-06/']) {
      const p = await open(path, { width: 390, height: 844 });
      const r = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: innerWidth }));
      ok(r.sw <= r.w, `${path} fits a 390 px phone (${r.sw})`);
      if (path === '/photography/') {
        const xs = await p.$$eval('.pl-card', (a) => a.slice(0, 2).map((x) => Math.round(x.getBoundingClientRect().left)));
        ok(xs[0] === xs[1], 'cards in one column on phones');
        await p.screenshot({ path: 'pl-390.png', fullPage: false });
      }
      await p.close();
    }
    const d = await open('/photography/');
    await d.screenshot({ path: 'pl-1280.png' });
    await d.close();
    const e = await open('/photography/swansea/');
    await e.screenshot({ path: 'place-1280.png' });
    await e.close();
  },
};

checks['old link forwards'] = async () => {
  const p = await open('/photography.html#tenby-4');
  await p.waitForTimeout(600);
  const v = await viewer(p);
  ok(p.url().endsWith('/photography/tenby/2026-08/#4') && v.open && /04 \/ 19/.test(v.no), `photography.html#tenby-4 → Tenby photo 4 (${p.url()})`);
  await p.close();
  const q = await open('/photography.html#9');
  await q.waitForTimeout(600);
  ok(q.url().endsWith('/photography/florence/2026-04/#7') && (await viewer(q)).cap === 'Coronas Café, Firenze', `old Florence #9 → same photo, now #7 (${q.url()})`);
  await q.close();
  const r = await open('/photography.html');
  await r.waitForTimeout(600);
  ok(r.url().endsWith('/photography/'), `photography.html → /photography/ (${r.url()})`);
  await r.close();
};

for (const [name, fn] of Object.entries(checks)) {
  try { await fn(); } catch (e) { ok(false, `${name}: ${e.message.split('\n')[0]}`); }
}
await b.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
