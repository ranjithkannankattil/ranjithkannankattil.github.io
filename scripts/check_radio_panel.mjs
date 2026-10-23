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
if (f.fail) { window.dispatchEvent(new CustomEvent('radio:ratings-failed')); } else {
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
window.dispatchEvent(new CustomEvent('radio:ratings-ready')); }`;

async function open(path = '/radio.html', { width = 1280, height = 900, fake = {}, init, slowStations = 0 } = {}) {
  const p = await b.newPage({ viewport: { width, height } });
  p.setDefaultTimeout(3000);
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

// ---------------------------------------------------------- the station panel
async function withPanel(opts = {}) {
  const p = await open('/radio.html?c=malayalam', opts);
  const s = await first(p);
  await p.click('#grid li >> nth=0');
  await p.click('#npName');
  await p.waitForTimeout(250);
  return { p, s, key: `malayalam~${s.id}` };
}
const calls = (p, name) => p.evaluate((n) => window.__calls.filter((c) => c[0] === n), name);

checks['panel opens from the bar'] = async () => {
  {
    const { p } = await withPanel();
    ok(await p.isVisible('#stPanel'), 'panel opens from the bar (1280 px)');
    const r = await p.locator('#stPanel').boundingBox(), bar = await p.locator('#player').boundingBox();
    ok(r.y + r.height <= bar.y + 1, 'desktop: the card sits above the player bar');
    await p.close();
  }
  {
    const { p } = await withPanel({ width: 390, height: 844 });
    ok(await p.isVisible('#stPanel'), 'panel opens from the bar (390 px)');
    const r = await p.locator('#stPanel').boundingBox();
    ok(Math.abs(r.y + r.height - 844) < 2 && r.width >= 389, `phone: a sheet from the bottom (${Math.round(r.y + r.height)})`);
    await p.screenshot({ path: 'panel-390.png' });
    await p.close();
  }
};

checks['average text'] = async () => {
  for (const [sum, want] of [[{ count: 0, avg: null }, 'Not rated yet'], [{ count: 2, avg: null }, '2 ratings so far'],
    [{ count: 1, avg: null }, '1 rating so far'], [{ count: 18, avg: 4.31 }, '★ 4.3 · 18 ratings']]) {
    const { p } = await withPanel({ fake: { summary: sum } });
    const t = await p.textContent('#stAvg');
    ok(t === want, `average text: ${want} (${t})`);
    if (sum.count === 18) await p.screenshot({ path: 'panel-1280.png' });
    await p.close();
  }
};

checks['tap a star saves'] = async () => {
  const { p, key } = await withPanel();
  await p.click('#stStars [data-v="4"]');
  await p.waitForTimeout(150);
  const c = await calls(p, 'rate');
  ok(c.length === 1 && c[0][1] === key && c[0][2] === 4, 'tap a star saves (rate called with key, 4)');
  ok((await p.textContent('#stSaved')) === 'Saved ✓', 'Saved ✓ shows');
  ok((await p.getAttribute('#stStars [data-v="4"]', 'aria-checked')) === 'true', 'the star is checked');
  await p.close();
};

checks['too fast message'] = async () => {
  const { p } = await withPanel({ fake: { rate: { throw: 'too-fast' } } });
  await p.click('#stStars [data-v="2"]');
  await p.waitForTimeout(150);
  ok((await p.textContent('#stSaved')) === 'Slow down a little — try again in a few seconds.', 'too fast message');
  await p.close();
};

checks['send comment'] = async () => {
  const { p, key } = await withPanel({ fake: { mine: { stars: 4, comment: null } } });
  await p.fill('#stText', 'Great evening songs');
  ok((await p.textContent('#stCount')) === '19/300', 'character counter');
  await p.click('#stSend');
  await p.waitForTimeout(150);
  const c = await calls(p, 'comment');
  ok(c.length === 1 && c[0][1] === key && c[0][2] === 4 && c[0][3] === 'Great evening songs', 'comment sent with key, stars, text');
  ok((await p.textContent('#stNote')) === "Thanks — your comment will appear once it's approved.", 'send comment note');
  await p.close();
};

checks['comment needs a rating first'] = async () => {
  const { p } = await withPanel();
  await p.fill('#stText', 'Hello');
  await p.click('#stSend');
  await p.waitForTimeout(100);
  ok((await calls(p, 'comment')).length === 0 && (await p.textContent('#stNote')) === 'Choose a star rating first.', 'comment needs a rating first');
  await p.close();
};

checks['existing comment shows its state'] = async () => {
  for (const [status, label] of [['waiting', 'Waiting for approval'], ['approved', 'Published'], ['rejected', 'Not published']]) {
    const { p } = await withPanel({ fake: { mine: { stars: 3, comment: { text: 'Nice', stars: 3, status } } } });
    ok((await p.inputValue('#stText')) === 'Nice' && (await p.textContent('#stState')) === label, `existing comment shows its state: ${label}`);
    ok((await p.getAttribute('#stStars [data-v="3"]', 'aria-checked')) === 'true', `existing rating checked (${status})`);
    await p.close();
  }
};

checks['comment text is escaped'] = async () => {
  const { p } = await withPanel({ fake: { approved: [{ stars: 5, text: '<img src=x onerror=alert(1)>', ts: 1.7e12 }] } });
  ok((await p.locator('#stList img').count()) === 0 && (await p.textContent('#stList')).includes('<img src=x'), 'comment text is escaped');
  await p.close();
};

checks['show more loads 10'] = async () => {
  const { p } = await withPanel({ init: () => {
    window.__fake.approved = (k, o) => Array.from({ length: o && o.after ? 10 : 5 }, (_, i) => ({ stars: 4, text: 'c' + i, ts: 2e12 - i * 1e6 }));
  } });
  ok((await p.locator('#stList li').count()) === 5 && await p.isVisible('#stMore'), 'five comments and Show more');
  await p.click('#stMore');
  await p.waitForTimeout(150);
  const c = await calls(p, 'approved');
  ok((await p.locator('#stList li').count()) === 15 && c[1][2].limit === 10 && !!c[1][2].after, 'show more loads 10');
  await p.close();
};

checks['auth failure shows unavailable'] = async () => {
  // sign-in blocked: the average and comments still show; saving says ratings are unavailable
  {
    const { p } = await withPanel({ fake: { ready: { throw: 'unavailable' }, rate: { throw: 'unavailable' }, summary: { count: 4, avg: 4.5 } } });
    ok((await p.textContent('#stAvg')) === '★ 4.5 · 4 ratings', 'sign-in blocked: the average still shows');
    await p.click('#stStars [data-v="3"]');
    await p.waitForTimeout(100);
    ok((await p.textContent('#stSaved')) === 'Ratings unavailable right now', 'sign-in blocked: saving says unavailable');
    await p.close();
  }
  // Firebase can't be reached at all
  for (const fake of [{ summary: { throw: 'unavailable' } }, { fail: true }]) {
    const { p } = await withPanel({ fake, init: () => {
      Object.defineProperty(navigator, 'share', { value: async (d) => { window.__shared = d; }, configurable: true });
    } });
    ok((await p.textContent('#stAvg')) === 'Ratings unavailable right now', `unavailable shown (${fake.fail ? 'module failed' : 'unreachable'})`);
    ok(await p.isDisabled('#stStars [data-v="1"]') && await p.isDisabled('#stSend'), 'stars and Send disabled');
    await p.click('#stShare');
    await p.waitForTimeout(100);
    ok(!!(await p.evaluate(() => window.__shared)), 'Share still works');
    await p.close();
  }
};

checks['opening the panel creates no account'] = async () => {
  const { p } = await withPanel();
  ok((await calls(p, 'ready')).length === 0, 'opening the panel does not sign in');
  await p.close();
};

checks['panel reloads when the account changes'] = async () => {
  const { p } = await withPanel();
  const before = (await calls(p, 'mine')).length;
  await p.evaluate(() => window.dispatchEvent(new CustomEvent('radio:ratings-account')));
  await p.waitForTimeout(150);
  ok((await calls(p, 'mine')).length === before + 1, 'panel reloads when the account changes');
  await p.close();
};

checks['play from the panel'] = async () => {
  const s = await stationOf();
  const p = await open(`/radio.html?c=malayalam&s=${encodeURIComponent(s.id)}`, { width: 390, height: 844 });
  ok(await p.isVisible('#stPlay'), 'shared link: Play button in the panel');
  await p.click('#stPlay');
  await p.waitForTimeout(200);
  // streams can't connect in this test (outside requests are blocked), so check that playing was attempted
  const st = await statusText(p);
  ok(st !== 'Tap play to start', `Play in the panel starts the station (status: ${st})`);
  await p.close();
};

checks['share button shares'] = async () => {
  const { p, s } = await withPanel({ init: () => {
    Object.defineProperty(navigator, 'share', { value: async (d) => { window.__shared = d; }, configurable: true });
  } });
  await p.click('#stShare');
  await p.waitForTimeout(100);
  const d = await p.evaluate(() => window.__shared || {});
  ok(d.url && d.url.endsWith(`&s=${encodeURIComponent(s.id)}`), 'share button shares');
  await p.close();
};

checks['keyboard'] = async () => {
  const { p } = await withPanel();
  await p.focus('#stStars [data-v="1"]');
  await p.keyboard.press('ArrowRight');
  ok((await p.evaluate(() => document.activeElement.dataset.v)) === '2', 'ArrowRight moves to the next star');
  await p.keyboard.press('ArrowLeft');
  ok((await p.evaluate(() => document.activeElement.dataset.v)) === '1', 'ArrowLeft moves back');
  await p.keyboard.press('Enter');
  await p.waitForTimeout(100);
  ok((await calls(p, 'rate')).length === 1, 'Enter saves the focused star');
  await p.keyboard.press('Escape');
  ok(await p.isHidden('#stPanel'), 'Esc closes the panel');
  await p.close();
};

checks['closing'] = async () => {
  const { p } = await withPanel();
  await p.click('#stClose');
  ok(await p.isHidden('#stPanel'), 'close button closes');
  await p.click('#npTile');
  await p.waitForTimeout(100);
  ok(await p.isVisible('#stPanel'), 'tile opens it too');
  await p.mouse.click(640, 120);
  ok(await p.isHidden('#stPanel'), 'tap outside closes');
  await p.close();
};

checks['shared link opens the panel'] = async () => {
  const s = await stationOf();
  const p = await open(`/radio.html?c=malayalam&s=${encodeURIComponent(s.id)}`);
  ok(await p.isVisible('#stPanel'), 'shared link opens the panel');
  await p.close();
};

for (const [name, fn] of Object.entries(checks)) {
  if (only && !name.includes(only)) continue;
  try { await fn(); } catch (e) { ok(false, `${name}: ${e.message.split('\n')[0]}`); }
}
await b.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
