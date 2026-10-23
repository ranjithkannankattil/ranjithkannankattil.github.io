// Browser checks for station sharing, share links and the station panel (ratings and comments).
// Ratings are faked: js/radio-ratings.js is replaced by a module whose answers each check sets.
// Run: serve the repo on :8765, then node scripts/check_radio_panel.mjs (with playwright resolvable)
import { chromium } from 'playwright';

const BASE = 'http://localhost:8765';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };
const only = process.argv[2];   // optional: run checks whose name contains this

// the fake ratings module: answers come from window.__fake (set by each check before load)
const FAKE = `
const f = window.__fake || {};
const calls = window.__calls = [];
const wrap = (name, dflt) => async (...a) => { calls.push([name, ...a]); const v = f[name];
  if (v && v.throw) throw Object.assign(new Error(v.throw), { code: v.throw });
  return typeof v === 'function' ? v(...a) : (v === undefined ? dflt : v); };
window.RadioRatings = {
  keyFor: (c, s) => c + '~' + s,
  ready: wrap('ready', 'anon-test-uid'), summary: wrap('summary', { count: 0, avg: null }),
  mine: wrap('mine', { stars: null, comment: null }), rate: wrap('rate'), comment: wrap('comment'),
  approved: wrap('approved', []), waiting: wrap('waiting', []), published: wrap('published', []), setStatus: wrap('setStatus'),
};
window.dispatchEvent(new CustomEvent('radio:ratings-ready'));`;

async function open(path = '/radio.html', { width = 1280, height = 900, fake = {}, init, slowStations = 0 } = {}) {
  const p = await b.newPage({ viewport: { width, height } });
  p.on('pageerror', (e) => { if (/firebase|gstatic/.test(e.message)) return; console.log('pageerror', e.message); failed++; });
  await p.route(/fonts\.g|firestore|gstatic|visits|^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.route(/js\/radio-ratings\.js/, (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
  if (slowStations) await p.route(/js\/stations\/malayalam\.js/, async (r) => { await new Promise((x) => setTimeout(x, slowStations)); r.continue(); });
  await p.addInitScript(`window.__fake = ${JSON.stringify(fake)};`);
  if (init) await p.addInitScript(init);
  await p.goto(BASE + path);
  await p.waitForTimeout(600 + slowStations);
  return p;
}
const first = async (p) => p.evaluate(() => (window.STATIONS || []).find((s) => !s.hidden));
const statusText = (p) => p.textContent('#npStatus');

const checks = {};

checks['share copies link on desktop'] = async () => {
  const p = await open('/radio.html?c=malayalam', { init: () => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => { window.__copied = t; } }, configurable: true });
  } });
  const s = await first(p);
  await p.click('#grid li >> nth=0');
  await p.evaluate(() => window.RadioApp.share());
  await p.waitForTimeout(100);
  const copied = await p.evaluate(() => window.__copied || '');
  ok(copied === `${BASE}/radio.html?c=malayalam&s=${encodeURIComponent(s.id)}`, `share copies link on desktop (${copied})`);
  ok((await statusText(p)) === 'Link copied', 'status reads Link copied');
  await p.close();
};

checks['share uses the share sheet on phones'] = async () => {
  const p = await open('/radio.html?c=malayalam', { width: 390, height: 844, init: () => {
    Object.defineProperty(navigator, 'share', { value: async (d) => { window.__shared = d; }, configurable: true });
  } });
  const s = await first(p);
  await p.click('#grid li >> nth=0');
  await p.evaluate(() => window.RadioApp.share());
  await p.waitForTimeout(100);
  const d = await p.evaluate(() => window.__shared || {});
  ok(d.url === `${BASE}/radio.html?c=malayalam&s=${encodeURIComponent(s.id)}` && d.title === s.name
    && d.text === `${s.name} on ranjithkb.com radio`, 'share uses the share sheet on phones');
  await p.close();
};

async function stationOf(id) {
  const p = await open('/radio.html?c=malayalam');
  const s = await first(p);
  await p.close();
  return s;
}

checks['deep link opens the station'] = async () => {
  const s = await stationOf();
  const p = await open(`/radio.html?c=malayalam&s=${encodeURIComponent(s.id)}`);
  ok((await p.textContent('#npName')) === s.name && !(await p.isHidden('#player')), 'deep link opens the station');
  ok((await statusText(p)) === 'Tap play to start', 'deep link: status says Tap play to start');
  await p.close();
};

checks['deep link waits for the collection'] = async () => {
  const s = await stationOf();
  const p = await open(`/radio.html?c=malayalam&s=${encodeURIComponent(s.id)}`, { slowStations: 1500 });
  ok((await p.textContent('#npName')) === s.name, 'deep link waits for the collection');
  await p.close();
};

checks['unknown station message'] = async () => {
  const p = await open('/radio.html?c=malayalam&s=nope');
  // shown in the player bar when a station is there, otherwise in a note above the list
  const t = await p.evaluate(() => {
    const n = document.querySelector('#radioNote'), pl = document.querySelector('#player');
    return (n && !n.hidden && n.textContent) || (!pl.hidden && document.querySelector('#npStatus').textContent) || '';
  });
  ok(t === "That station isn't available any more", `unknown station message (${t})`);
  await p.close();
};

for (const [name, fn] of Object.entries(checks)) {
  if (only && !name.includes(only)) continue;
  try { await fn(); } catch (e) { ok(false, `${name}: ${e.message.split('\n')[0]}`); }
}
await b.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
