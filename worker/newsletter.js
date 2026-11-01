// Movie Friday — the weekly email from ranjithkb.com/movies.html.
// Every Friday at 08:00 Milan time: this week's new UK cinema releases in English, and last week's
// with their IMDb / Rotten Tomatoes scores by now, each with a poster, synopsis and links.
//
// Subscribers are kept in the Workers KV namespace bound as SUBS, one key per address:
//   key  "sub:<sha-256 of the address>"   metadata { e: address, s: "pending" | "active", t: token, d: date }
// Only confirmed addresses get mail. Unconfirmed sign-ups expire on their own after 7 days, and
// unsubscribing deletes the key. Mail is sent through Resend (secret RESEND_KEY) from NEWS_FROM.

const SITE = "https://ranjithkb.com/movies.html";
const DAY = 86400;
const enc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export async function sha(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const token = () => [...crypto.getRandomValues(new Uint8Array(18))].map((x) => x.toString(16).padStart(2, "0")).join("");
export const validEmail = (e) => /^[^\s@<>()",;]{1,64}@[^\s@<>()",;]{1,190}\.[a-z]{2,24}$/i.test(e);

// ---------------------------------------------------------------- dates (Europe/Rome and UK weeks)

// wall-clock parts of a moment in a time zone
function zoned(date, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hour12: false }).formatToParts(date).map((x) => [x.type, x.value]));
  return { ymd: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, wd: p.weekday };
}
const addDays = (ymd, n) => new Date(Date.parse(ymd + "T12:00:00Z") + n * DAY * 1000).toISOString().slice(0, 10);
// the Friday on or before a date, as YYYY-MM-DD (UK films open on Fridays)
export function fridayOf(ymd) {
  const wd = new Date(ymd + "T12:00:00Z").getUTCDay(); // 0 Sun … 5 Fri
  return addDays(ymd, -((wd + 2) % 7));
}
const nice = (ymd, opts) => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", ...(opts || { day: "numeric", month: "long" }) });

// ---------------------------------------------------------------- the issue

// h = helpers from movies-api.js: { tmdb, omdb, cached, img }
async function weekFilms(h, from, to, limit) {
  const d = await h.tmdb("/discover/movie", {
    region: "GB", with_release_type: "2|3", "release_date.gte": from, "release_date.lte": to,
    with_original_language: "en", include_adult: false, sort_by: "popularity.desc", page: 1,
  }, 6 * 3600);
  return (d?.results || []).filter((m) => m.poster_path && m.overview).slice(0, limit);
}

async function detail(h, m, withRatings) {
  const x = await h.tmdb(`/movie/${m.id}`, { append_to_response: "credits,videos,release_dates", language: "en-GB" }, DAY);
  if (!x) return null;
  const crew = x.credits?.crew || [];
  const gb = ((x.release_dates?.results || []).find((r) => r.iso_3166_1 === "GB")?.release_dates || []);
  const cert = gb.map((r) => r.certification).find(Boolean) || null;
  const vids = (x.videos?.results || []).filter((v) => v.site === "YouTube");
  const tr = vids.find((v) => v.type === "Trailer" && v.official) || vids.find((v) => v.type === "Trailer");
  const om = withRatings && x.imdb_id ? await h.omdb(x.imdb_id) : null;
  return {
    id: x.id, title: x.title, date: m.release_date, runtime: x.runtime || null, cert,
    genres: (x.genres || []).map((g) => g.name).slice(0, 3),
    director: crew.filter((c) => c.job === "Director").map((c) => c.name).slice(0, 2),
    cast: (x.credits?.cast || []).slice(0, 3).map((c) => c.name),
    overview: x.overview || "", poster: x.poster_path, tagline: x.tagline || "",
    trailer: tr ? `https://www.youtube.com/watch?v=${tr.key}` : null,
    imdb: om?.imdb || null, rt: om?.rt ?? null, mc: om?.mc ?? null,
    tmdb: x.vote_count >= 20 ? Math.round(x.vote_average * 10) / 10 : null,
  };
}

const OPENERS = [
  "Good morning, and happy Friday! A fresh week of films has just landed in UK cinemas, so here's what's new, and how last week's openers are faring now the reviews are in.",
  "Happy Friday! Before the weekend plans settle, here's a quick look at what opened in cinemas today, and what audiences made of last week's arrivals.",
  "Morning! It's Friday, which means new films on the big screen. Grab a coffee: here's this week's line-up and the verdict on last week's.",
  "Hello, and welcome to the weekend's front row. Here's everything new in UK cinemas this week, plus how last week's releases are scoring.",
  "Friday again, and the cinema listings have changed. Here's what's worth a look this weekend, and what people thought of last week's films.",
];

export async function buildIssue(h, issueDate) {
  const fri = fridayOf(issueDate);
  const thisFrom = addDays(fri, -2), thisTo = addDays(fri, 6);   // Wed–Thu window: catches early openers
  const lastFrom = addDays(fri, -9), lastTo = addDays(fri, -3);
  const [now, last] = await Promise.all([weekFilms(h, thisFrom, thisTo, 6), weekFilms(h, lastFrom, lastTo, 6)]);
  const nowD = (await Promise.all(now.map((m) => detail(h, m, false)))).filter(Boolean);
  const lastIds = new Set(nowD.map((x) => x.id));
  const lastD = (await Promise.all(last.filter((m) => !lastIds.has(m.id)).map((m) => detail(h, m, true)))).filter(Boolean);
  // last week's films, best-reviewed first
  const score = (f) => (f.imdb && f.imdb.n >= 500 ? f.imdb.v : 0) * 10 + (f.rt || 0) / 10;
  lastD.sort((a, b) => score(b) - score(a));
  const week = Math.floor(Date.parse(fri + "T12:00:00Z") / (7 * DAY * 1000));
  return { date: fri, opener: OPENERS[week % OPENERS.length], now: nowD, last: lastD, built: new Date().toISOString() };
}

// ---------------------------------------------------------------- the email

const C = { ink: "#1B1B1F", soft: "#5A5A5E", paper: "#F0EDE6", card: "#FFFFFF", line: "#DAD3C5", accent: "#8C2F39" };
const FONT = "font-family:Georgia,'Times New Roman',serif;";
const SANS = "font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";

function filmBlock(f, imgBase, kind) {
  const meta = [f.genres.join(", "), f.runtime ? `${Math.floor(f.runtime / 60)}h ${f.runtime % 60}m` : "", f.cert ? `Rated ${f.cert}` : ""].filter(Boolean).join(" · ");
  const who = [f.director.length ? `Directed by ${f.director.join(" & ")}` : "", f.cast.length ? `with ${f.cast.join(", ")}` : ""].filter(Boolean).join(", ");
  const syn = f.overview.length > 360 ? f.overview.slice(0, 360).replace(/\s+\S*$/, "") + "…" : f.overview;
  let scores = "";
  if (kind === "last") {
    const bits = [];
    if (f.imdb && f.imdb.n >= 500) bits.push(`<b>IMDb ${f.imdb.v.toFixed(1)}</b> <span style="color:${C.soft}">(${f.imdb.n.toLocaleString("en-GB")} votes)</span>`);
    if (f.rt != null) bits.push(`<b>Rotten Tomatoes ${f.rt}%</b>`);
    if (f.mc != null) bits.push(`<b>Metacritic ${f.mc}</b>`);
    scores = bits.length ? bits.join(" &nbsp;·&nbsp; ") : `<span style="color:${C.soft}">Still too early for a reliable IMDb score.</span>`;
  } else {
    scores = `<span style="color:${C.accent}">In cinemas from ${enc(nice(f.date, { weekday: "long", day: "numeric", month: "long" }))}</span>`;
  }
  const link = `${SITE}#/m/${f.id}`;
  return `<tr><td style="padding:0 0 22px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.card};border:1px solid ${C.line}">
    <tr><td width="112" valign="top" style="padding:14px 0 14px 14px"><a href="${link}"><img src="${imgBase}/img/w185${enc(f.poster)}" width="98" alt="${enc(f.title)}" style="display:block;width:98px;height:auto;border:0"></a></td>
    <td valign="top" style="padding:14px 16px 14px 16px">
      <a href="${link}" style="${SANS}font-size:18px;font-weight:700;color:${C.ink};text-decoration:none;line-height:1.25">${enc(f.title)}</a>
      <div style="${SANS}font-size:12px;color:${C.soft};margin:4px 0 6px">${enc(meta)}</div>
      <div style="${SANS}font-size:13px;margin:0 0 8px">${scores}</div>
      <div style="${FONT}font-size:15px;line-height:1.5;color:${C.ink}">${enc(syn)}</div>
      ${who ? `<div style="${FONT}font-size:13px;font-style:italic;color:${C.soft};margin-top:6px">${enc(who)}</div>` : ""}
      <div style="${SANS}font-size:12px;margin-top:10px"><a href="${link}" style="color:${C.accent};font-weight:600">All ratings &amp; similar films →</a>${f.trailer ? ` &nbsp;&nbsp;<a href="${enc(f.trailer)}" style="color:${C.accent}">▶ Trailer</a>` : ""}</div>
    </td></tr></table></td></tr>`;
}

export function renderEmail(issue, imgBase, unsubUrl) {
  const head = (t, sub) => `<tr><td style="padding:10px 0 12px"><div style="${SANS}font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.accent};font-weight:700">${enc(sub)}</div><div style="${SANS}font-size:22px;font-weight:700;color:${C.ink};margin-top:2px">${enc(t)}</div></td></tr>`;
  const thisRange = `${nice(addDays(issue.date, 0))} – ${nice(addDays(issue.date, 6))}`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Movie Friday</title></head>
<body style="margin:0;padding:0;background:${C.paper}">
<div style="display:none;max-height:0;overflow:hidden">${enc(issue.now.slice(0, 3).map((f) => f.title).join(", "))} and more, new in UK cinemas this week.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <tr><td style="padding:0 0 18px;border-bottom:2px solid ${C.ink}">
    <div style="${SANS}font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${C.soft}">ranjithkb.com · ${enc(nice(issue.date, { day: "numeric", month: "long", year: "numeric" }))}</div>
    <div style="${SANS}font-size:30px;font-weight:800;color:${C.ink};margin-top:4px">Movie Friday</div>
  </td></tr>
  <tr><td style="padding:20px 0 8px;${FONT}font-size:17px;line-height:1.6;color:${C.ink}">${enc(issue.opener)}</td></tr>
  ${issue.now.length ? head("New in cinemas this week", thisRange) + issue.now.map((f) => filmBlock(f, imgBase, "now")).join("") : ""}
  ${issue.last.length ? head("How last week's films are doing", "The verdict so far") + issue.last.map((f) => filmBlock(f, imgBase, "last")).join("") : ""}
  ${!issue.now.length && !issue.last.length ? `<tr><td style="${FONT}font-size:16px;padding:12px 0">A quiet week: no new English-language films in UK cinemas. A good excuse to catch up on something older. <a href="${SITE}" style="color:${C.accent}">Find one here</a>.</td></tr>` : ""}
  <tr><td style="padding:8px 0 0;${FONT}font-size:16px;line-height:1.6;color:${C.ink}">Enjoy the films, and have a lovely weekend.<br>Ranjith</td></tr>
  <tr><td style="padding:26px 0 0;border-top:1px solid ${C.line};${SANS}font-size:11px;line-height:1.6;color:${C.soft}">
    UK release dates and film details from TMDB; IMDb, Rotten Tomatoes and Metacritic scores via OMDb. This product uses the TMDB API but is not endorsed or certified by TMDB.<br>
    You're getting this because you signed up at <a href="${SITE}" style="color:${C.soft}">ranjithkb.com/movies</a>. <a href="${unsubUrl}" style="color:${C.soft}">Unsubscribe</a> in one click, and your address is deleted. Questions: <a href="mailto:hello@ranjithkb.com" style="color:${C.soft}">hello@ranjithkb.com</a>
  </td></tr>
</table></td></tr></table></body></html>`;
  const text = [`MOVIE FRIDAY · ${nice(issue.date, { day: "numeric", month: "long", year: "numeric" })}`, "", issue.opener, "",
    issue.now.length ? `NEW IN CINEMAS THIS WEEK (${thisRange})` : "", ...issue.now.map((f) => `- ${f.title}: ${f.overview.slice(0, 200)}\n  ${SITE}#/m/${f.id}`), "",
    issue.last.length ? "HOW LAST WEEK'S FILMS ARE DOING" : "", ...issue.last.map((f) => `- ${f.title}${f.imdb && f.imdb.n >= 500 ? ` (IMDb ${f.imdb.v})` : ""}${f.rt != null ? ` (RT ${f.rt}%)` : ""}\n  ${SITE}#/m/${f.id}`), "",
    "Have a lovely weekend. Ranjith", "", `Unsubscribe: ${unsubUrl}`].filter((x) => x !== undefined).join("\n");
  return { html, text, subject: issue.now.length ? `Movie Friday: ${issue.now.slice(0, 2).map((f) => f.title).join(", ")}${issue.now.length > 2 ? " and more" : ""}` : "Movie Friday: this week at the cinema" };
}

// ---------------------------------------------------------------- sending

async function resend(env, path, body) {
  const r = await fetch("https://api.resend.com" + path, {
    method: "POST", headers: { Authorization: `Bearer ${env.RESEND_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Resend ${r.status}: ${d.message || d.name || "error"}`);
  return d;
}
const fromAddr = (env) => env.NEWS_FROM || "Movie Friday <newsletter@ranjithkb.com>";

function confirmEmail(link) {
  return {
    subject: "Confirm your Movie Friday sign-up",
    html: `<div style="${SANS}max-width:520px;margin:0 auto;padding:24px;color:${C.ink}"><div style="font-size:26px;font-weight:800">Movie Friday</div>
      <p style="${FONT}font-size:16px;line-height:1.6">Thanks for signing up! One click to confirm, and you'll get a short email every Friday morning with the week's new films in UK cinemas and how last week's are rating.</p>
      <p><a href="${link}" style="display:inline-block;background:${C.accent};color:#fff;padding:12px 20px;text-decoration:none;font-weight:700">Yes, send me Movie Friday</a></p>
      <p style="font-size:12px;color:${C.soft}">If you didn't ask for this, ignore this email; nothing more will be sent and the address is forgotten within a week.</p></div>`,
    text: `Confirm your Movie Friday sign-up: ${link}\n\nIf you didn't ask for this, ignore this email.`,
  };
}

// ---------------------------------------------------------------- HTTP routes

const back = (status) => Response.redirect(`${SITE}#/newsletter?status=${status}`, 303);

export async function handle(req, env, url, h, cors, json, ctx) {
  const parts = url.pathname.split("/").filter(Boolean);
  const self = `${url.protocol}//${url.host}`;
  if (!env.SUBS) return json({ error: "newsletter storage is not set up" }, cors, 0, 500);

  if (parts[1] === "subscribe" && req.method === "POST") {
    let email = "";
    try { email = String((await req.json()).email || "").trim().toLowerCase(); } catch { /* not JSON */ }
    if (!validEmail(email)) return json({ ok: false, error: "That doesn't look like an email address." }, cors, 0, 400);
    // at most 5 sign-ups a day from one connection
    const ip = await sha("ip:" + (req.headers.get("CF-Connecting-IP") || "?") + new Date().toISOString().slice(0, 10));
    const n = Number((await env.SUBS.get("rate:" + ip)) || 0);
    if (n >= 5) return json({ ok: false, error: "Too many sign-ups from here today. Please try tomorrow." }, cors, 0, 429);
    ctx.waitUntil(env.SUBS.put("rate:" + ip, String(n + 1), { expirationTtl: DAY }));
    const key = "sub:" + (await sha(email));
    const cur = await env.SUBS.getWithMetadata(key);
    // the same answer whether or not the address is already on the list
    if (cur.metadata && cur.metadata.s === "active") return json({ ok: true }, cors);
    const t = token();
    await env.SUBS.put(key, "", { metadata: { e: email, s: "pending", t, d: new Date().toISOString().slice(0, 10) }, expirationTtl: 7 * DAY });
    const link = `${self}/newsletter/confirm?k=${key.slice(4)}&t=${t}`;
    try { await resend(env, "/emails", { from: fromAddr(env), to: [email], reply_to: "hello@ranjithkb.com", ...confirmEmail(link) }); }
    catch (e) { return json({ ok: false, error: "Couldn't send the confirmation email just now. Please try again later." }, cors, 0, 502); }
    return json({ ok: true }, cors);
  }

  if (parts[1] === "confirm" || parts[1] === "unsubscribe") {
    const k = url.searchParams.get("k") || "", t = url.searchParams.get("t") || "";
    if (!/^[0-9a-f]{64}$/.test(k)) return back("invalid");
    const key = "sub:" + k, cur = await env.SUBS.getWithMetadata(key);
    const m = cur.metadata;
    if (parts[1] === "confirm") {
      if (!m || m.t !== t) return back("expired");
      if (m.s !== "active") await env.SUBS.put(key, "", { metadata: { ...m, s: "active", d: new Date().toISOString().slice(0, 10) } });
      return back("confirmed");
    }
    // unsubscribe: GET from the email link, or POST from a mail app's one-click button
    if (m && m.t === t) await env.SUBS.delete(key);
    return req.method === "POST" ? new Response("", { status: 200 }) : back("unsubscribed");
  }

  if (parts[1] === "preview") {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") || "") ? url.searchParams.get("date") : zoned(new Date(), "Europe/Rome").ymd;
    const issue = await h.cached("issue:" + fridayOf(date), 6 * 3600, () => buildIssue(h, date));
    const { html } = renderEmail(issue, self, `${SITE}#/newsletter`);
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
  }

  // a test send of this week's issue, only to an address that is already a confirmed subscriber
  if (parts[1] === "send-test" && req.method === "POST") {
    let email = "";
    try { email = String((await req.json()).email || "").trim().toLowerCase(); } catch { /* not JSON */ }
    const key = "sub:" + (await sha(email)), cur = await env.SUBS.getWithMetadata(key);
    if (!cur.metadata || cur.metadata.s !== "active") return json({ ok: false, error: "Only confirmed subscribers can get a test issue." }, cors, 0, 403);
    if (await env.SUBS.get("test:" + key)) return json({ ok: false, error: "A test issue was sent in the last 10 minutes." }, cors, 0, 429);
    await env.SUBS.put("test:" + key, "1", { expirationTtl: 600 });
    const issue = await buildIssue(h, zoned(new Date(), "Europe/Rome").ymd);
    await sendIssue(env, issue, self, [{ key: key.slice(4), ...cur.metadata }]);
    return json({ ok: true, films: issue.now.length + issue.last.length }, cors);
  }
  return json({ error: "unknown route" }, cors, 0, 404);
}

async function sendIssue(env, issue, self, subs) {
  let sent = 0;
  for (let i = 0; i < subs.length; i += 100) {
    const batch = subs.slice(i, i + 100).map((s) => {
      const unsub = `${self}/newsletter/unsubscribe?k=${s.key}&t=${s.t}`;
      const mail = renderEmail(issue, self, unsub);
      return {
        from: fromAddr(env), to: [s.e], reply_to: "hello@ranjithkb.com", subject: mail.subject, html: mail.html, text: mail.text,
        headers: { "List-Unsubscribe": `<${unsub}>, <mailto:hello@ranjithkb.com?subject=unsubscribe>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      };
    });
    await resend(env, "/emails/batch", batch);
    sent += batch.length;
  }
  return sent;
}

// ---------------------------------------------------------------- the Friday run (cron)

// Cron fires at 06:00 and 07:00 UTC on Fridays; only the run that falls at 08:00 in Milan sends,
// so it is 8am there in both winter and summer time.
export async function scheduled(event, env, h, force) {
  const now = zoned(new Date(event.scheduledTime || Date.now()), "Europe/Rome");
  if (!force && (now.wd !== "Fri" || now.hour !== 8)) return { skipped: `Milan time is ${now.wd} ${now.hour}:00` };
  if (!env.SUBS || !env.RESEND_KEY) return { skipped: "storage or RESEND_KEY missing" };
  const sentKey = "sent:" + now.ymd;
  if (await env.SUBS.get(sentKey)) return { skipped: "already sent today" };
  const subs = [];
  let cursor;
  do {
    const page = await env.SUBS.list({ prefix: "sub:", cursor });
    for (const k of page.keys) if (k.metadata && k.metadata.s === "active") subs.push({ key: k.name.slice(4), ...k.metadata });
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);
  if (!subs.length) return { skipped: "no subscribers" };
  const issue = await buildIssue(h, now.ymd);
  const self = env.SELF_URL || "https://movies-api.ranjeethkkb.workers.dev";
  const sent = await sendIssue(env, issue, self, subs);
  await env.SUBS.put(sentKey, String(sent), { expirationTtl: 30 * DAY });
  return { sent };
}
