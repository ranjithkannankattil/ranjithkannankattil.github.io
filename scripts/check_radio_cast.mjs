// Browser check for the radio cast button, using simulated casting support.
// Run: serve the repo on :8765, then NODE_PATH=/opt/node-tools/node_modules node scripts/check_radio_cast.mjs
import { chromium } from 'playwright';

const URL = 'http://localhost:8765/radio.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
let failed = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) failed++; };

async function page(init) {
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  p.on('pageerror', (e) => { if (/firebase|gstatic/.test(e.message)) return; console.log('pageerror', e.message); failed++; });
  await p.route(/fonts\.g|firestore|gstatic|visits|^https?:\/\/(?!localhost)/, (r) => r.abort());
  await p.addInitScript(init);
  await p.goto(URL);
  await p.waitForTimeout(600);
  // start a station so the player bar is showing
  await p.click('#grid li >> nth=0');
  await p.waitForTimeout(200);
  return p;
}

// Chrome-style Remote Playback, scriptable from the test
const chromeFake = () => {
  const remote = new EventTarget();
  remote.state = 'disconnected';
  remote._cb = null;
  remote.watchAvailability = (cb) => { remote._cb = cb; setTimeout(() => cb(true), 50); return Promise.resolve(1); };
  remote.prompt = () => { window.__prompted = (window.__prompted || 0) + 1; return Promise.resolve(); };
  Object.defineProperty(HTMLMediaElement.prototype, 'remote', { get() { return remote; } });
  window.__remote = remote;
};
const noCast = () => {
  try { delete HTMLMediaElement.prototype.remote; } catch (e) { /* ignore */ }
  Object.defineProperty(HTMLMediaElement.prototype, 'remote', { get() { return undefined; } });
};
const safariFake = () => {
  Object.defineProperty(HTMLMediaElement.prototype, 'remote', { get() { return undefined; } });
  window.WebKitPlaybackTargetAvailabilityEvent = function () {};
  HTMLMediaElement.prototype.webkitShowPlaybackTargetPicker = function () { window.__picker = (window.__picker || 0) + 1; };
};

// 1. no casting support: no button
{
  const p = await page(noCast);
  ok(await p.$eval('#castBtn', (x) => x.hidden), 'hidden when the browser cannot cast');
  await p.close();
}
// 2. Chrome: button appears when a device is available, prompts, shows casting state
{
  const p = await page(chromeFake);
  await p.waitForTimeout(150);
  ok(!(await p.$eval('#castBtn', (x) => x.hidden)), 'Chrome: visible when a cast device is available');
  await p.click('#castBtn');
  ok((await p.evaluate(() => window.__prompted)) === 1, 'Chrome: tapping opens the cast picker');
  await p.evaluate(() => { window.__remote.state = 'connected'; window.__remote.dispatchEvent(new Event('connect')); });
  ok(await p.$eval('#castBtn', (x) => x.classList.contains('on')), 'Chrome: button highlighted while casting');
  ok(/casting/i.test(await p.textContent('#castBtn')), 'Chrome: label says Casting');
  // the session drops right after a station change: ask to tap again
  await p.click('#nextBtn');
  await p.evaluate(() => { window.__remote.state = 'disconnected'; window.__remote.dispatchEvent(new Event('disconnect')); });
  await p.waitForTimeout(400);   // reconnect messages must not wipe it straight away
  ok(/tap cast again/i.test(await p.textContent('#npStatus')), 'Chrome: asks to tap cast again when the speaker drops on a station change');
  ok(!(await p.$eval('#castBtn', (x) => x.classList.contains('on'))), 'Chrome: highlight cleared after disconnect');
  // device goes away: button hides
  await p.evaluate(() => window.__remote._cb(false));
  ok(await p.$eval('#castBtn', (x) => x.hidden), 'Chrome: hidden again when no device is around');
  await p.close();
}
// 3. Chrome: a station the speaker cannot play
{
  const p = await page(() => {
    const remote = new EventTarget(); remote.state = 'disconnected';
    remote.watchAvailability = (cb) => { setTimeout(() => cb(true), 50); return Promise.resolve(1); };
    remote.prompt = () => Promise.reject(Object.assign(new Error('x'), { name: 'NotSupportedError' }));
    Object.defineProperty(HTMLMediaElement.prototype, 'remote', { get() { return remote; } });
  });
  await p.waitForTimeout(150);
  await p.click('#castBtn'); await p.waitForTimeout(400);
  ok(/can.t be cast/i.test(await p.textContent('#npStatus')), "Chrome: says when a station can't be cast");
  await p.close();
}
// 4. Safari: AirPlay picker
{
  const p = await page(safariFake);
  await p.evaluate(() => { const e = new Event('webkitplaybacktargetavailabilitychanged'); e.availability = 'available'; document.querySelector('#audio').dispatchEvent(e); });
  ok(!(await p.$eval('#castBtn', (x) => x.hidden)), 'Safari: visible when an AirPlay device is available');
  await p.click('#castBtn');
  ok((await p.evaluate(() => window.__picker)) === 1, 'Safari: tapping opens the AirPlay picker');
  await p.evaluate(() => { const a = document.querySelector('#audio'); Object.defineProperty(a, 'webkitCurrentPlaybackTargetIsWireless', { value: true, configurable: true }); a.dispatchEvent(new Event('webkitcurrentplaybacktargetiswirelesschanged')); });
  ok(await p.$eval('#castBtn', (x) => x.classList.contains('on')), 'Safari: highlighted while on AirPlay');
  await p.close();
}

await b.close();
console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
