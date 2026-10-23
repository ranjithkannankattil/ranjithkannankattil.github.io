// Browser check for hands-free car mode on radio.html: favourites-only Next/Prev, spoken station
// names for car / headphone / lock-screen buttons only, and the "Say station names" switch.
// Serve the repo on :8765; run from a folder where 'playwright' resolves.
import { chromium } from 'playwright';
const URL = process.env.SITE || 'http://localhost:8765/radio.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failed = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) failed++; };

const init = () => {
  window.__said = []; window.__h = {};
  const ms = navigator.mediaSession;
  if (ms) ms.setActionHandler = (a, f) => { window.__h[a] = f; };
  window.speechSynthesis.speak = (u) => window.__said.push(u.text);
  window.speechSynthesis.cancel = () => {};
};
const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
p.on('pageerror', (e) => { if (!/firebase|gstatic/.test(e.message)) { console.log('pageerror', e.message); failed++; } });
// streams stay "connecting" (never answered) so the player's auto-skip past dead stations doesn't kick in
await p.route(/^https?:\/\/(?!localhost)/, (r) => { if (['media', 'other', 'xhr', 'fetch'].includes(r.request().resourceType()) && !/fonts\.g|firestore|gstatic|visits/.test(r.request().url())) return; r.abort(); });
await p.addInitScript(init);
await p.goto(URL); await p.waitForTimeout(700);
// favourites: the 2nd and 5th stations of the list
const names = await p.$$eval('#grid li .radio-card-name, #grid li h3, #grid li .name', (xs) => xs.map((x) => x.textContent.trim()));
const ids = await p.evaluate(() => (window.STATIONS || []).filter((s) => !s.hidden).map((s) => s.id));
const [favA, favB] = [ids[1], ids[4]];
await p.evaluate(([a, c]) => localStorage.setItem('mr-favs2', JSON.stringify(['malayalam:' + a, 'malayalam:' + c])), [favA, favB]);
await p.reload(); await p.waitForTimeout(700);
const nameOf = async () => (await p.textContent('#npName')).trim();
const card = (i) => p.click(`#grid li >> nth=${i}`);
const stationName = (id) => p.evaluate((id) => window.STATIONS.find((s) => s.id === id).name, id);

await card(1); await p.waitForTimeout(150);
const nA = await stationName(favA), nB = await stationName(favB);
ok((await nameOf()) === nA, 'playing favourite A');
await p.click('#nextBtn'); await p.waitForTimeout(150);
ok((await nameOf()) === nB, 'Next from a favourite goes to the next favourite (skips the stations between)');
await p.click('#nextBtn'); await p.waitForTimeout(150);
ok((await nameOf()) === nA, 'Next wraps round the favourites');
ok((await p.evaluate(() => window.__said.length)) === 0, 'screen taps are not spoken');

await p.evaluate(() => window.__h.nexttrack()); await p.waitForTimeout(150);
ok((await nameOf()) === nB, 'car/headphone Next also stays in favourites');
ok((await p.evaluate(() => window.__said.at(-1))) === nB, 'car/headphone Next says the station name');
await p.evaluate(() => window.__h.seekbackward()); await p.waitForTimeout(150);
ok((await p.evaluate(() => window.__said.at(-1))) === nA, 'car seek buttons are spoken too');

await card(0); await p.waitForTimeout(150);
const n0 = await stationName(ids[0]), n1 = await stationName(ids[1]);
await p.click('#nextBtn'); await p.waitForTimeout(150);
ok((await nameOf()) === n1, 'from a non-favourite, Next goes through the whole list');

await p.uncheck('#sayNames');
const before = await p.evaluate(() => window.__said.length);
await p.evaluate(() => window.__h.nexttrack()); await p.waitForTimeout(150);
ok((await p.evaluate(() => window.__said.length)) === before, 'switch off: nothing is spoken');
await p.reload(); await p.waitForTimeout(700);
ok(!(await p.isChecked('#sayNames')), 'the switch is remembered');
await p.check('#sayNames');
await b.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
