// Browser checks for radio-admin.html (approving comments), with the ratings module faked.
// Run: serve the repo on :8765, then node scripts/check_radio_admin.mjs (with playwright resolvable)
import { chromium } from 'playwright';

const BASE = 'http://localhost:8765';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };

const FAKE = `
const f = window.__fake || {};
const calls = window.__calls = [];
const wrap = (name, dflt) => async (...a) => { calls.push([name, ...a]); const v = f[name];
  if (v && v.throw) throw Object.assign(new Error(v.throw), { code: v.throw });
  return typeof v === 'function' ? v(...a) : (v === undefined ? dflt : v); };
window.RadioRatings = {
  keyFor: (c, s) => c + '~' + s,
  account: wrap('account', { uid: 'anon-test-uid', anonymous: false }), signInGoogle: wrap('signInGoogle'), signOut: wrap('signOut'),
  ready: wrap('ready', 'anon-test-uid'), waiting: wrap('waiting', []), published: wrap('published', []), setStatus: wrap('setStatus'),
};
window.dispatchEvent(new CustomEvent('radio:ratings-ready'));`;

let STATION;
async function open(fake = {}, init) {
  const p = await b.newPage({ viewport: { width: 1100, height: 900 } });
  p.setDefaultTimeout(3000);
  p.on('pageerror', (e) => { if (/firebase|gstatic/.test(e.message)) return; console.log('pageerror', e.message); failed++; });
  await p.route(/fonts\.g|firestore|gstatic|visits|^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.route(/js\/radio-ratings\.js/, (r) => r.fulfill({ contentType: 'text/javascript', body: FAKE }));
  await p.addInitScript(`window.__fake = ${JSON.stringify(fake)};`);
  if (init) await p.addInitScript(init);
  await p.goto(BASE + '/radio-admin.html');
  await p.waitForTimeout(700);
  return p;
}
const calls = (p, name) => p.evaluate((n) => window.__calls.filter((c) => c[0] === n), name);

// a real station, so the page can show its name
{
  const p = await b.newPage();
  await p.goto(BASE + '/js/stations/malayalam.js');
  const src = await p.textContent('body');
  await p.close();
  const m = src.match(/"id":\s*"([^"]+)",\s*"name":\s*"([^"]+)"/) || src.match(/id:\s*"([^"]+)",\s*name:\s*"([^"]+)"/);
  STATION = { id: m[1], name: m[2] };
}
const KEY = `malayalam~${STATION.id}`;
const item = (uid, text, ts, stars = 4) => ({ id: `${KEY}__${uid}`, key: KEY, stars, text, ts });
const two = [item('a', 'First comment', 1.7e12), item('b', 'Second comment', 1.71e12, 2)];

const checks = {
  async 'signed out shows sign-in'() {
    for (const account of [null, { uid: 'x', anonymous: true }]) {
      const p = await open({ account });
      ok(await p.isVisible('#adIn'), `sign-in button (${account ? 'anonymous' : 'signed out'})`);
      await p.click('#adIn');
      await p.waitForTimeout(100);
      ok((await calls(p, 'signInGoogle')).length === 1, 'sign-in button calls Google sign-in');
      ok((await calls(p, 'waiting')).length === 0, 'no lists asked for before sign-in');
      await p.close();
    }
  },
  async 'not owner sees account ID'() {
    const p = await open({ waiting: { throw: 'permission-denied' } });
    const text = await p.textContent('main');
    ok(text.includes('This page is for the site owner.'), 'not owner: says the page is for the owner');
    ok((await p.textContent('#adUid')) === 'Your account ID: anon-test-uid' && await p.isVisible('#adCopy'), 'not owner sees account ID and Copy');
    ok(!(await p.textContent('body')).includes('@'), 'no email anywhere on the page');
    await p.close();
  },
  async 'owner sees waiting oldest first'() {
    const p = await open({ waiting: two });
    const t = await p.locator('#adWait li .ad-text').allTextContents();
    ok(t.join('|') === 'First comment|Second comment', 'owner sees waiting oldest first');
    ok((await p.textContent('#adWait li >> nth=0')).includes(STATION.name), `station name shown (${STATION.name})`);
    ok((await p.textContent('#adWaitH')) === 'Waiting (2)', 'waiting count in heading');
    await p.close();
  },
  async 'approve moves to published'() {
    const p = await open({ waiting: two });
    await p.click('#adWait li >> nth=0 >> text=Approve');
    await p.waitForTimeout(150);
    const c = await calls(p, 'setStatus');
    ok(c.length === 1 && c[0][1] === `${KEY}__a` && c[0][2] === 'approved', 'approve calls setStatus(id, approved)');
    ok((await p.locator('#adWait li').count()) === 1 && (await p.textContent('#adPub')).includes('First comment'), 'approved item moves to published');
    ok((await p.textContent('#adWaitH')) === 'Waiting (1)', 'count goes down');
    await p.close();
  },
  async 'reject removes'() {
    const p = await open({ waiting: two });
    await p.click('#adWait li >> nth=1 >> text=Reject');
    await p.waitForTimeout(150);
    const c = await calls(p, 'setStatus');
    ok(c.length === 1 && c[0][1] === `${KEY}__b` && c[0][2] === 'rejected' && (await p.locator('#adWait li').count()) === 1
      && !(await p.textContent('#adPub')).includes('Second comment'), 'reject removes');
    await p.close();
  },
  async 'remove from published sets rejected'() {
    const p = await open({ published: [item('c', 'Old published', 1.6e12)] });
    await p.click('#adPub li >> nth=0 >> text=Remove');
    await p.waitForTimeout(150);
    const c = await calls(p, 'setStatus');
    ok(c.length === 1 && c[0][2] === 'rejected' && (await p.locator('#adPub li').count()) === 0, 'remove from published sets rejected');
    await p.close();
  },
  async 'admin escapes text'() {
    const p = await open({ waiting: [item('a', '<img src=x onerror=alert(1)>', 1.7e12)] });
    ok((await p.locator('#adWait img').count()) === 0 && (await p.textContent('#adWait')).includes('<img'), 'admin escapes text');
    await p.close();
  },
  async 'failed action keeps the item'() {
    const p = await open({ waiting: two, setStatus: { throw: 'unavailable' } });
    await p.click('#adWait li >> nth=0 >> text=Approve');
    await p.waitForTimeout(150);
    ok((await p.locator('#adWait li').count()) === 2 && (await p.textContent('#adMsg')).length > 0, 'failed action keeps the item and says so');
    await p.close();
  },
};

for (const [name, fn] of Object.entries(checks)) {
  try { await fn(); } catch (e) { ok(false, `${name}: ${e.message.split('\n')[0]}`); }
}
await b.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
