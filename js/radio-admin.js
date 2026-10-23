// radio-admin.html: approve or reject station comments. Only the approver account (its ID is
// set in firestore.rules) can read waiting comments; anyone else is shown their account ID,
// which is how the owner gets the ID to put in the rules. No email is ever shown.
(() => {
  const $ = (s) => document.querySelector(s);
  const show = (id, on) => { $(id).hidden = !on; };
  const msg = (t) => { $("#adMsg").textContent = t; };
  const names = {};          // "collection~station" -> station name
  const loadedCols = {};
  let R = null, waiting = [], pubAfter = null;

  function start() {
    if (R) return;
    R = window.RadioRatings;
    run().catch((e) => { console.warn(e); $("#adState").textContent = "Couldn't reach the comments right now. Try reloading."; });
  }
  window.addEventListener("radio:ratings-ready", start);
  window.addEventListener("radio:ratings-failed", () => { $("#adState").textContent = "Couldn't load Firebase. Check the connection or a blocker, then reload."; });
  if (window.RadioRatings) start();

  async function run() {
    const acct = await R.account();
    if (!acct || acct.anonymous) {
      $("#adState").textContent = "Approve or reject comments that listeners send about stations.";
      show("#adSign", true);
      $("#adIn").onclick = async () => {
        try { await R.signInGoogle(); show("#adSign", false); await run(); }
        catch (e) { console.warn(e); msg("Couldn't sign in — please try again."); }
      };
      return;
    }
    show("#adSign", false);
    try { waiting = await R.waiting(); }
    catch (e) {
      if (e && e.code === "permission-denied") return notOwner(acct.uid);
      throw e;
    }
    $("#adState").textContent = "Comments appear on the radio page only after you approve them.";
    show("#adOwner", true);
    const pub = await R.published({ limit: 50 });
    await nameStations([...waiting, ...pub]);
    drawWaiting();
    $("#adPub").innerHTML = "";
    addPublished(pub);
    $("#adOut2").onclick = signOut;
    $("#adPubMore").onclick = async () => {
      const more = await R.published({ after: pubAfter, limit: 50 });
      await nameStations(more);
      addPublished(more);
    };
  }

  function notOwner(uid) {
    $("#adState").textContent = "";
    show("#adNot", true);
    $("#adUid").textContent = `Your account ID: ${uid}`;
    $("#adCopy").onclick = async () => {
      try { await navigator.clipboard.writeText(uid); msg("Copied"); } catch { msg("Select the ID and copy it"); }
    };
    $("#adOut").onclick = signOut;
  }
  async function signOut() { try { await R.signOut(); } finally { location.reload(); } }

  // station names come from the station files, loaded once per collection
  function loadScript(src) {
    return new Promise((res, rej) => { const el = document.createElement("script"); el.src = src; el.onload = res; el.onerror = rej; document.body.append(el); });
  }
  async function nameStations(items) {
    for (const c of new Set(items.map((x) => x.key.split("~")[0]))) {
      if (loadedCols[c] || !/^[a-z0-9-]+$/.test(c)) continue;
      loadedCols[c] = true;
      window.STATIONS = null;
      try { await loadScript(`js/stations/${c}.js`); } catch { continue; }
      for (const s of window.STATIONS || []) names[`${c}~${s.id}`] = s.name;
    }
  }
  const colName = (c) => ((window.RADIO_COLLECTIONS || []).find((x) => x.id === c) || {}).name || c;
  const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : typeof t === "number" ? t : Date.parse(t) || 0);

  function row(c, buttons) {
    const li = document.createElement("li");
    const [col, sid] = c.key.split("~");
    const head = document.createElement("div");
    head.className = "ad-head";
    const st = document.createElement("b");
    st.textContent = names[c.key] || sid;
    const meta = document.createElement("span");
    meta.className = "ad-meta";
    meta.textContent = `${colName(col)} · ${"★".repeat(c.stars)}${"☆".repeat(5 - c.stars)} · ${new Date(ms(c.ts)).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
    head.append(st, meta);
    const t = document.createElement("p");
    t.className = "ad-text";
    t.textContent = c.text;
    const act = document.createElement("div");
    act.className = "ad-act";
    for (const [label, fn, cls] of buttons) {
      const bt = document.createElement("button");
      bt.className = "ad-btn small" + (cls ? " " + cls : "");
      bt.textContent = label;
      bt.onclick = async () => {
        act.querySelectorAll("button").forEach((x) => { x.disabled = true; });
        try { await fn(); msg(""); }
        catch (e) { console.warn(e); msg("That didn't go through — try again."); act.querySelectorAll("button").forEach((x) => { x.disabled = false; }); }
      };
      act.append(bt);
    }
    li.append(head, t, act);
    return li;
  }

  function drawWaiting() {
    const ul = $("#adWait");
    ul.innerHTML = "";
    $("#adWaitH").textContent = `Waiting (${waiting.length})`;
    if (!waiting.length) { const li = document.createElement("li"); li.className = "ad-empty"; li.textContent = "Nothing waiting."; ul.append(li); return; }
    for (const c of waiting) {
      ul.append(row(c, [
        ["Approve", async () => { await R.setStatus(c.id, "approved"); waiting = waiting.filter((x) => x !== c); drawWaiting(); prependPublished(c); }],
        ["Reject", async () => { await R.setStatus(c.id, "rejected"); waiting = waiting.filter((x) => x !== c); drawWaiting(); }, "quiet"],
      ]));
    }
  }
  function pubRow(c) {
    const li = row(c, [["Remove", async () => { await R.setStatus(c.id, "rejected"); li.remove(); }, "quiet"]]);
    return li;
  }
  function addPublished(list) {
    for (const c of list) $("#adPub").append(pubRow(c));
    if (list.length) pubAfter = list[list.length - 1].ts;
    $("#adPubMore").hidden = list.length < 50;
  }
  function prependPublished(c) { $("#adPub").prepend(pubRow(c)); }
})();
