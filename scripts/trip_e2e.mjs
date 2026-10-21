import { chromium } from 'playwright';
const b = await chromium.launch();
const cases = [
  ['sicily', 'https://ranjithkb.com/trip.html?e2e=3#d=Sicily&f=Milan&b=&e=&eb=&dt=2026-10-26&days=5&mode=pt&walk=moderate&pace=balanced&likes=must,museum,history&t0=09:00&t1=18:00&l=1'],
  ['florence', 'https://ranjithkb.com/trip.html?e2e=3#d=Florence&f=Milan&b=&dt=2026-10-24&days=1&mode=walk&walk=moderate&pace=balanced&likes=must,museum,history&t0=09:00&t1=18:00&l=1'],
];
for (const [name, url] of cases) {
  const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(url);
  try { await p.waitForFunction(() => !document.getElementById('out').hidden && document.querySelectorAll('#days button').length, null, { timeout: 90000 }); } catch {}
  await p.waitForTimeout(3000);
  const res = await p.evaluate(async () => {
    const days = [];
    const btns = [...document.querySelectorAll('#days button')];
    for (let i = 0; i < btns.length; i++) {
      btns[i].click(); await new Promise(r => setTimeout(r, 400));
      days.push({ tab: btns[i].innerText.replace(/\n/g, ' '), items: [...document.querySelectorAll('.tl > li')].map(li => li.className.replace('tl-', '') + ': ' + li.innerText.replace(/\s+/g, ' ').slice(0, 110)) });
    }
    return { status: document.getElementById('status').textContent, sum: document.getElementById('sum').innerText.slice(0, 400), days };
  });
  console.log('=====', name, JSON.stringify({ ...res, errs }, null, 1));
  await p.screenshot({ path: `shot-${name}.png`, fullPage: false });
}
await b.close();
