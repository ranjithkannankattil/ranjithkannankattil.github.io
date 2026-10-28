// MOVIES — the owner's private film log. Only the Firebase account in window.MOVIES_OWNER can
// sign in here; anyone else is signed straight back out, and firestore.rules refuses them anyway.
// Stored in Firestore (EU, eur3) under movielog/{owner uid}/:
//   watches/{auto id}   { tmdb, date "YYYY-MM-DD"|null, rating 0.5–5|null, rewatch, liked, where, with, notes,
//                         film: {id, imdb, t, ot, y, rt, l, g[], c[], d[{id,name}], a[{id,name}], p, iv, tv}, created }
//   watchlist/{tmdb}    { id, t, y, l, p, v, added }
// The small `film` summary is saved with each watch so the dashboard never has to call the API.
const cfg = window.FIREBASE_CONFIG;
const OWNER = window.MOVIES_OWNER;
const App = window.MoviesApp;
const esc = App.esc;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const changed = () => window.dispatchEvent(new CustomEvent("movielog:change"));
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtDate = (d, opts) => (d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", opts || { day: "numeric", month: "short", year: "numeric" }) : "Date unknown");

const Log = (window.MovieLog = { pending: true, owner: false });
let watches = [], watchlist = [];
const byDateDesc = (a, b) => String(b.date || "0000").localeCompare(String(a.date || "0000")) || String(b.createdAt || "").localeCompare(String(a.createdAt || ""));

Log.watches = () => watches;
Log.watchedIds = () => new Set(watches.map((w) => w.tmdb));
Log.watchesFor = (id) => watches.filter((w) => w.tmdb === Number(id));
Log.inWatchlist = (id) => watchlist.some((w) => w.id === Number(id));
Log.watchlistCards = () => watchlist.slice().sort((a, b) => String(b.added || "").localeCompare(String(a.added || ""))).map((w) => ({ id: w.id, t: w.t, y: w.y, l: w.l, p: w.p, v: w.v }));

if (!cfg || !cfg.apiKey || !OWNER) {
  Log.pending = false;
  Log.signIn = () => App.alert("Sign-in isn't set up on this site.");
} else {
  const V = "10.12.2";
  const [{ initializeApp, getApps, getApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  const app = getApps().length ? getApp() : initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const col = (name) => F.collection(db, "movielog", OWNER, name);
  let unsub = [];

  Log.signIn = async () => {
    try { await A.signInWithPopup(auth, provider); }
    catch (e) {
      if (e && (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment")) return A.signInWithRedirect(auth, provider);
      if (e && e.code !== "auth/popup-closed-by-user" && e.code !== "auth/cancelled-popup-request") App.alert("Couldn't sign in — please try again.");
    }
  };
  Log.signOut = () => A.signOut(auth);

  const denied = (e) => {
    App.alert(e && e.code === "permission-denied"
      ? "The database refused this — publish the movielog block of firestore.rules in the Firebase console."
      : "Couldn't save — check the connection and try again.", 9000);
  };

  function listen() {
    unsub.forEach((u) => u()); unsub = [];
    unsub.push(F.onSnapshot(col("watches"), (snap) => {
      watches = snap.docs.map((d) => { const x = d.data(); return { ...x, id: d.id, tmdb: Number(x.tmdb), createdAt: x.created && x.created.toMillis ? String(x.created.toMillis()).padStart(15, "0") : "" }; }).sort(byDateDesc);
      changed();
    }, denied));
    unsub.push(F.onSnapshot(col("watchlist"), (snap) => { watchlist = snap.docs.map((d) => ({ ...d.data(), id: Number(d.id) })); changed(); }, denied));
  }

  A.getRedirectResult(auth).catch(() => {});
  A.onAuthStateChanged(auth, async (u) => {
    if (u && !u.isAnonymous && u.uid !== OWNER) {
      await A.signOut(auth);
      App.alert("This log is private to the site owner — you've been signed out.", 7000);
      return;
    }
    const isOwner = !!(u && u.uid === OWNER);
    Log.pending = false;
    if (isOwner === Log.owner) { changed(); return; }
    Log.owner = isOwner;
    if (isOwner) listen(); else { unsub.forEach((x) => x()); unsub = []; watches = []; watchlist = []; }
    changed();
  });

  // ---------------------------------------------------------- writing
  Log.toggleWatchlist = async (m) => {
    const ref = F.doc(col("watchlist"), String(m.id));
    try {
      if (Log.inWatchlist(m.id)) await F.deleteDoc(ref);
      else await F.setDoc(ref, { id: m.id, t: m.title || m.t, y: m.year || m.y || null, l: m.olang || m.l || null, p: m.poster || m.p || null, v: (m.ratings && m.ratings.tmdb ? m.ratings.tmdb.v : m.v) || null, added: today() });
    } catch (e) { denied(e); }
  };

  async function saveWatch(film, form, editId) {
    const prev = editId ? watches.find((w) => w.id === editId) : null;
    let summary = prev && prev.film;
    if (!summary || !prev) {
      try { summary = await App.api(`/lite/${film.id}?r=1`); } catch { summary = null; }
      if (!summary) summary = { id: film.id, imdb: film.imdb || null, t: film.title || film.t, y: film.year || film.y || null, l: film.olang || film.l || null, p: film.poster || film.p || null, g: (film.genres || []).map((g) => g.name), c: film.countries || [], d: film.directors || [], a: (film.cast || []).slice(0, 6).map((c) => ({ id: c.id, name: c.name })), rt: film.runtime || null, iv: film.ratings && film.ratings.imdb ? film.ratings.imdb.v : null, tv: film.ratings && film.ratings.tmdb ? film.ratings.tmdb.v : null };
    }
    const data = {
      tmdb: Number(film.id),
      date: form.unknown ? null : form.date || today(),
      rating: form.rating > 0 ? form.rating : null,
      rewatch: !!form.rewatch, liked: !!form.liked,
      where: form.where || "", with: form.with || "", notes: form.notes || "",
      film: summary,
    };
    try {
      if (prev) await F.updateDoc(F.doc(col("watches"), editId), data);
      else {
        await F.addDoc(col("watches"), { ...data, created: F.serverTimestamp() });
        if (Log.inWatchlist(film.id)) await F.deleteDoc(F.doc(col("watchlist"), String(film.id)));
      }
      return true;
    } catch (e) { denied(e); return false; }
  }
  async function deleteWatch(id) { try { await F.deleteDoc(F.doc(col("watches"), id)); } catch (e) { denied(e); } }

  // ---------------------------------------------------------- the "Watched" sheet
  const WHERE = ["Cinema", "Netflix", "Prime Video", "Disney+", "Apple TV+", "JioHotstar", "SonyLIV", "ZEE5", "Sky / NOW", "MUBI", "YouTube", "TV", "Flight", "Other"];
  Log.openSheet = ({ film, edit }) => {
    const sheet = $("#sheet");
    const prev = edit ? watches.find((w) => w.id === edit) : null;
    const others = Log.watchesFor(film.id).filter((w) => w.id !== edit);
    const v = prev || { date: today(), rating: null, rewatch: others.length > 0, liked: false, where: "", with: "", notes: "" };
    sheet.innerHTML = `<form method="dialog" class="mv-sheet-f" id="sheetForm">
      <header><h2 id="sheetTitle">${prev ? "Edit watch" : "I watched"} <i>${esc(film.title || film.t)}${film.year || film.y ? " (" + (film.year || film.y) + ")" : ""}</i></h2>
        <button type="button" class="mv-x" value="cancel" aria-label="Close" data-close>×</button></header>
      <label class="mv-f"><span>Date watched</span><input type="date" name="date" value="${esc(v.date || today())}" max="${today()}" ${v.date === null ? "disabled" : ""}></label>
      <label class="mv-c"><input type="checkbox" name="unknown" ${v.date === null && prev ? "checked" : ""}> I don't know the date</label>
      <div class="mv-f"><span>My rating <b id="starOut">${v.rating ? App.stars(v.rating) + " " + v.rating : "No rating"}</b></span>
        <input type="range" name="rating" min="0" max="5" step="0.5" value="${v.rating || 0}" aria-label="Rating out of 5, in half stars"></div>
      <div class="mv-row2">
        <label class="mv-c"><input type="checkbox" name="liked" ${v.liked ? "checked" : ""}> ♥ Liked it</label>
        <label class="mv-c"><input type="checkbox" name="rewatch" ${v.rewatch ? "checked" : ""}> ↻ Rewatch</label>
      </div>
      <label class="mv-f"><span>Where</span><input name="where" list="whereList" value="${esc(v.where)}" placeholder="Cinema, Netflix, flight…"></label>
      <datalist id="whereList">${WHERE.map((w) => `<option value="${esc(w)}">`).join("")}</datalist>
      <label class="mv-f"><span>With</span><input name="with" value="${esc(v.with)}" placeholder="Who you watched with"></label>
      <label class="mv-f"><span>Notes</span><textarea name="notes" rows="3" maxlength="2000" placeholder="Only you can see this">${esc(v.notes)}</textarea></label>
      <footer>${prev ? '<button type="button" class="mv-btn ghost danger" data-del>Delete</button>' : ""}<span></span>
        <button type="button" class="mv-btn ghost" data-close>Cancel</button><button type="submit" class="mv-btn">${prev ? "Save" : "Log it"}</button></footer>
    </form>`;
    const f = $("#sheetForm", sheet);
    f.rating.oninput = () => { const r = Number(f.rating.value); $("#starOut", sheet).textContent = r ? App.stars(r) + " " + r : "No rating"; };
    f.unknown.onchange = () => { f.date.disabled = f.unknown.checked; };
    $$("[data-close]", sheet).forEach((b) => (b.onclick = () => sheet.close()));
    const del = $("[data-del]", sheet);
    if (del) del.onclick = async () => { if (confirm("Delete this watch from your log?")) { await deleteWatch(edit); sheet.close(); } };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('button[type="submit"]', f); btn.disabled = true; btn.textContent = "Saving…";
      const ok = await saveWatch(film, { date: f.date.value, unknown: f.unknown.checked, rating: Number(f.rating.value), rewatch: f.rewatch.checked, liked: f.liked.checked, where: f.where.value.trim(), with: f.with.value.trim(), notes: f.notes.value.trim() }, edit);
      if (ok) { sheet.close(); App.alert(prev ? "Saved." : "Logged."); } else { btn.disabled = false; btn.textContent = prev ? "Save" : "Log it"; }
    };
    sheet.showModal();
  };

  // ---------------------------------------------------------- diary and watchlist pages
  Log.render = (name, view) => (name === "watchlist" ? renderWatchlist(view) : renderDiary(view));

  function renderDiary(view) {
    const films = new Set(watches.map((w) => w.tmdb)).size;
    const counts = `${watches.length} watch${watches.length === 1 ? "" : "es"} · ${films} film${films === 1 ? "" : "s"}`;
    // already on the diary: update in place, so an import summary or a search stays put
    const open = $('.mv-mypage[data-p="diary"]', view);
    if (open && open._draw) { $("#dCount", view).textContent = counts; open._draw(); return; }
    view.innerHTML = `<section class="mv-mypage" data-p="diary">
      <div class="mv-my-h"><h1 class="mv-h1">Diary</h1><p class="mv-meta" id="dCount">${counts}</p></div>
      <div class="mv-tools">
        <label class="mv-find"><span class="sr">Find in diary</span><input type="search" id="dFind" placeholder="Find a film, person, place…"></label>
        <label class="mv-btn ghost mv-file">Import CSV<input type="file" id="imp" accept=".csv,text/csv" multiple hidden></label>
        <button class="mv-btn ghost" type="button" id="expCsv">Export CSV</button>
        <button class="mv-btn ghost" type="button" id="expJson">Export JSON</button>
      </div>
      <div id="impOut"></div>
      <div id="diary"></div></section>`;
    const out = $("#diary", view);
    const draw = () => {
      const t = $("#dFind", view).value.trim().toLowerCase();
      const list = watches.filter((w) => !t || [w.film?.t, w.film?.ot, w.where, w.with, w.notes, ...(w.film?.d || []).map((d) => d.name), ...(w.film?.a || []).map((a) => a.name)].join(" ").toLowerCase().includes(t));
      if (!watches.length) { out.innerHTML = '<div class="mv-empty"><h2>Nothing logged yet</h2><p>Open any film and tap <b>✓ Watched</b>, or import your Letterboxd or IMDb export above.</p></div>'; return; }
      const groups = new Map();
      for (const w of list) { const k = w.date ? w.date.slice(0, 7) : "unknown"; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(w); }
      out.innerHTML = [...groups].map(([k, arr]) => `<section class="mv-month"><h2>${k === "unknown" ? "Date unknown" : fmtDate(k + "-15", { month: "long", year: "numeric" })} <i>${arr.length}</i></h2><ol>` + arr.map((w) => {
        const f = w.film || {};
        return `<li><span class="mv-day">${w.date ? Number(w.date.slice(8)) : "–"}</span>
          <a class="mv-dp" href="#/m/${w.tmdb}">${f.p ? `<img loading="lazy" src="${esc(App.img(f.p, "w92"))}" alt="">` : ""}</a>
          <span class="mv-dt"><a href="#/m/${w.tmdb}"><b>${esc(f.t || "Film " + w.tmdb)}</b></a> <i>${f.y || ""}</i>
            <small>${[w.rating != null ? '<span class="mv-st">' + App.stars(w.rating) + "</span>" : "", w.liked ? "♥" : "", w.rewatch ? "↻ rewatch" : "", esc(w.where), w.with ? "with " + esc(w.with) : ""].filter(Boolean).join(" · ")}</small>
            ${w.notes ? `<span class="mv-dn">${esc(w.notes)}</span>` : ""}</span>
          <button class="mv-icon" type="button" data-edit="${esc(w.id)}" aria-label="Edit">✎</button></li>`;
      }).join("") + "</ol></section>").join("") || '<p class="mv-none">Nothing matches.</p>';
      $$("[data-edit]", out).forEach((b) => (b.onclick = () => { const w = watches.find((x) => x.id === b.dataset.edit); Log.openSheet({ film: { id: w.tmdb, t: w.film?.t, y: w.film?.y, ...w.film }, edit: w.id }); }));
    };
    $("#dFind", view).oninput = draw;
    $("#expCsv", view).onclick = exportCsv;
    $("#expJson", view).onclick = () => download("movie-log.json", JSON.stringify({ exported: new Date().toISOString(), watches: watches.map(({ createdAt, ...w }) => w), watchlist }, null, 1), "application/json");
    $("#imp", view).onchange = (e) => { importFiles([...e.target.files], $("#impOut", view)); e.target.value = ""; };
    $(".mv-mypage", view)._draw = draw;
    draw();
  }

  function renderWatchlist(view) {
    const list = Log.watchlistCards();
    view.innerHTML = `<section class="mv-mypage"><div class="mv-my-h"><h1 class="mv-h1">Watchlist</h1><p class="mv-meta">${list.length} film${list.length === 1 ? "" : "s"} to watch</p></div>
      ${list.length ? `<div class="mv-grid">${list.map((m) => `<div class="mv-wl">${App.cardHTML(m)}<div class="mv-wl-a"><button type="button" class="mv-btn small" data-log="${m.id}">✓ Watched</button><button type="button" class="mv-btn ghost small" data-rm="${m.id}">Remove</button></div></div>`).join("")}</div>`
        : '<div class="mv-empty"><h2>Your watchlist is empty</h2><p>Tap <b>+ Watchlist</b> on any film to keep it here.</p></div>'}</section>`;
    $$("[data-rm]", view).forEach((b) => (b.onclick = () => Log.toggleWatchlist({ id: Number(b.dataset.rm) })));
    $$("[data-log]", view).forEach((b) => (b.onclick = () => { const m = watchlist.find((x) => x.id === Number(b.dataset.log)); Log.openSheet({ film: { id: m.id, t: m.t, y: m.y, l: m.l, p: m.p } }); }));
  }

  // ---------------------------------------------------------- export
  function download(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const csvCell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  function exportCsv() {
    const head = ["Watched Date", "Name", "Year", "Rating", "Rewatch", "Liked", "Where", "With", "Notes", "TMDB ID", "IMDb ID"];
    const rows = watches.slice().reverse().map((w) => [w.date || "", w.film?.t || "", w.film?.y || "", w.rating ?? "", w.rewatch ? "Yes" : "", w.liked ? "Yes" : "", w.where, w.with, w.notes, w.tmdb, w.film?.imdb || ""]);
    download("movie-diary.csv", [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\n"), "text/csv");
  }

  // ---------------------------------------------------------- import (Letterboxd, IMDb, this site's own export)
  function parseCsv(text) {
    const rows = []; let row = [], cell = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const head = (rows.shift() || []).map((h) => h.replace(/^﻿/, "").trim());
    return rows.filter((r) => r.some((x) => x.trim())).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] || "").trim()])));
  }
  const isoDate = (s) => { const m = String(s || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : null; };

  // what kind of file it is, and what each row turns into
  function readFile(name, rows) {
    const h = new Set(Object.keys(rows[0] || {}));
    if (h.has("TMDB ID")) return { kind: "this site's export", list: rows.map((r) => ({ tmdb: Number(r["TMDB ID"]), title: r.Name, year: r.Year, date: isoDate(r["Watched Date"]), rating: Number(r.Rating) || null, rewatch: r.Rewatch === "Yes", liked: r.Liked === "Yes", where: r.Where, with: r.With, notes: r.Notes })) };
    if (h.has("Const") && h.has("Your Rating")) return { kind: "IMDb ratings", list: rows.map((r) => ({ imdb: r.Const, title: r.Title, year: r.Year, date: isoDate(r["Date Rated"]), rating: r["Your Rating"] ? Math.round(Number(r["Your Rating"])) / 2 : null, iv: Number(r["IMDb Rating"]) || null, ifNew: true })) };
    if (h.has("Const") && h.has("Position")) return { kind: "IMDb watchlist", watchlist: true, list: rows.map((r) => ({ imdb: r.Const, title: r.Title, year: r.Year, date: isoDate(r.Created) })) };
    if (h.has("Letterboxd URI") && h.has("Watched Date")) return { kind: "Letterboxd diary", list: rows.map((r) => ({ title: r.Name, year: r.Year, date: isoDate(r["Watched Date"]) || isoDate(r.Date), rating: Number(r.Rating) || null, rewatch: r.Rewatch === "Yes", notes: r.Tags ? "Tags: " + r.Tags : "" })) };
    if (h.has("Letterboxd URI") && /watchlist/i.test(name)) return { kind: "Letterboxd watchlist", watchlist: true, list: rows.map((r) => ({ title: r.Name, year: r.Year, date: isoDate(r.Date) })) };
    if (h.has("Letterboxd URI")) return { kind: h.has("Rating") ? "Letterboxd ratings" : "Letterboxd watched", list: rows.map((r) => ({ title: r.Name, year: r.Year, date: isoDate(r.Date), rating: Number(r.Rating) || null, ifNew: true })) };
    return null;
  }

  async function importFiles(files, out) {
    // a diary file goes first, so ratings/watched files only add films the diary doesn't have
    const parsed = [];
    for (const f of files) { const rows = parseCsv(await f.text()); const r = readFile(f.name, rows); parsed.push({ name: f.name, r }); }
    const bad = parsed.filter((p) => !p.r);
    const good = parsed.filter((p) => p.r).sort((a, b) => (a.r.kind.includes("diary") ? -1 : 0) - (b.r.kind.includes("diary") ? -1 : 0));
    if (!good.length) { out.innerHTML = `<p class="mv-fix">That doesn't look like a Letterboxd, IMDb or Movies export${bad.length ? " (" + bad.map((b) => esc(b.name)).join(", ") + ")" : ""}.</p>`; return; }
    const total = good.reduce((s, p) => s + p.r.list.length, 0);
    out.innerHTML = `<div class="mv-imp"><b>Importing ${total} rows</b> from ${good.map((p) => esc(p.r.kind)).join(", ")}<div class="mv-bar"><i id="impBar"></i></div><span id="impNow"></span></div>`;
    const bar = $("#impBar", out), now = $("#impNow", out);
    const have = new Set(watches.map((w) => w.tmdb + "|" + (w.date || ""))), haveFilm = new Set(watches.map((w) => w.tmdb));
    const haveWl = new Set(watchlist.map((w) => w.id));
    let done = 0, added = 0, wlAdded = 0, skipped = 0;
    const missed = [];
    const writes = [];
    for (const p of good) {
      const queue = p.r.list.slice();
      const worker = async () => {
        while (queue.length) {
          const row = queue.shift();
          try {
            let id = row.tmdb;
            if (!id) { const m = await App.api(`/match?${row.imdb ? "imdb=" + encodeURIComponent(row.imdb) + "&" : ""}title=${encodeURIComponent(row.title || "")}&year=${encodeURIComponent(row.year || "")}`); id = m && m.id; }
            if (!id) { missed.push(row); continue; }
            if (p.r.watchlist) {
              if (haveWl.has(id) || haveFilm.has(id)) { skipped++; continue; }
              haveWl.add(id);
              const s = await App.api(`/lite/${id}`);
              writes.push({ wl: true, id, data: { id, t: s?.t || row.title, y: s?.y || Number(row.year) || null, l: s?.l || null, p: s?.p || null, v: s?.tv || null, added: row.date || today() } });
              wlAdded++;
            } else {
              const key = id + "|" + (row.date || "");
              if (have.has(key) || (row.ifNew && haveFilm.has(id))) { skipped++; continue; }
              have.add(key); haveFilm.add(id);
              const s = (await App.api(`/lite/${id}`)) || { id, t: row.title, y: Number(row.year) || null };
              if (row.iv && !s.iv) s.iv = row.iv;
              writes.push({ data: { tmdb: id, date: row.date || null, rating: row.rating || null, rewatch: !!row.rewatch, liked: !!row.liked, where: row.where || "", with: row.with || "", notes: row.notes || "", film: s, created: F.serverTimestamp() } });
              added++;
            }
          } catch { missed.push(row); }
          finally { done++; bar.style.width = (100 * done / total).toFixed(1) + "%"; now.textContent = `${done} / ${total}`; }
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);
    }
    now.textContent = "Saving…";
    try {
      for (let i = 0; i < writes.length; i += 400) {
        const b = F.writeBatch(db);
        for (const w of writes.slice(i, i + 400)) b.set(w.wl ? F.doc(col("watchlist"), String(w.id)) : F.doc(col("watches")), w.data);
        await b.commit();
      }
    } catch (e) { denied(e); out.innerHTML = '<p class="mv-fix">Import stopped — nothing after the last saved batch was written.</p>'; return; }
    out.innerHTML = `<div class="mv-imp done"><b>Imported.</b> ${added} watch${added === 1 ? "" : "es"} added${wlAdded ? `, ${wlAdded} to the watchlist` : ""}${skipped ? `, ${skipped} already in the log` : ""}.
      ${missed.length ? `<details><summary>${missed.length} couldn't be matched — tap one to search for it and log it by hand</summary><ul>${missed.map((m) => `<li><a href="#/s/${encodeURIComponent((m.title || "") + (m.year ? " " + m.year : ""))}">${esc(m.title || m.imdb)} ${esc(m.year || "")}</a>${m.date ? " · " + esc(m.date) : ""}${m.rating ? " · " + m.rating + "★" : ""}</li>`).join("")}</ul></details>` : ""}</div>`;
  }
}
changed();
