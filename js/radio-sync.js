// Sign in with Google to keep favourite stations (and the default language) in your account,
// so they follow you to other devices. Off until js/firebase-config.js has a config.
// Stored per person in Firestore at users/{uid}: { favs: [...], def: "malayalam", updated }.
const cfg = window.FIREBASE_CONFIG;
const box = document.getElementById("acct");

if (cfg && cfg.apiKey && box) {
  const note = document.getElementById("acctNote");
  if (note) note.hidden = false;
  const V = "10.12.2";
  const { upgradeToGoogle } = await import("./radio-ratings-core.js");
  const [{ initializeApp, getApps, getApp }, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  // js/radio-ratings.js shares this app; whichever module runs first creates it
  const app = getApps().length ? getApp() : initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  let user = null, saveTimer = null, applying = false;
  const send = (detail) => { applying = true; window.dispatchEvent(new CustomEvent("radio:remote-change", { detail })); applying = false; };

  function draw() {
    box.hidden = false;
    box.innerHTML = "";
    if (!user) {
      const b = document.createElement("button");
      b.className = "acct-in";
      b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14Z"/></svg><span>Sign in to save favourites</span>';
      b.onclick = signIn;
      box.append(b);
      return;
    }
    const who = document.createElement("span");
    who.className = "acct-who";
    who.textContent = user.displayName ? user.displayName.split(" ")[0] : (user.email || "Signed in");
    who.title = `Favourites are saved to ${user.email || "your account"}`;
    const ok = document.createElement("span");
    ok.className = "acct-ok"; ok.id = "acctState"; ok.textContent = "Favourites saved";
    const out = document.createElement("button");
    out.className = "acct-out"; out.textContent = "Sign out";
    out.onclick = () => A.signOut(auth);
    box.append(who, ok, out);
  }
  const state = (t) => { const el = document.getElementById("acctState"); if (el) el.textContent = t; };

  // keeps any station ratings made before signing in (see upgradeToGoogle)
  async function signIn() {
    try { await upgradeToGoogle(auth, A, provider); }
    catch { alertBox("Couldn't sign in — please try again."); return; }
    // linking an anonymous ID keeps the same account, so no sign-in event fires: pick it up here
    await onUser(auth.currentUser);
  }
  function alertBox(t) { const s = document.createElement("span"); s.className = "acct-err"; s.textContent = t; box.append(s); setTimeout(() => s.remove(), 5000); }

  async function save(favs, def) {
    if (!user) return;
    state("Saving…");
    try {
      await F.setDoc(F.doc(db, "users", user.uid), { favs, def, updated: F.serverTimestamp() }, { merge: true });
      state("Favourites saved");
    } catch { state("Couldn't save — will retry"); }
  }

  // first sign-in on a device: keep favourites from both this browser and the account
  async function mergeOnSignIn() {
    const local = window.RadioApp ? window.RadioApp.getFavs() : [];
    let remote = {};
    try { const snap = await F.getDoc(F.doc(db, "users", user.uid)); remote = snap.exists() ? snap.data() : {}; } catch { /* offline */ }
    const favs = [...new Set([...(remote.favs || []), ...local])];
    const def = remote.def || (window.RadioApp && window.RadioApp.getDefault()) || "malayalam";
    send({ favs, def });
    await save(favs, def);
  }

  window.addEventListener("radio:local-change", (e) => {
    if (!user || applying) return;
    clearTimeout(saveTimer);
    const { favs, def } = e.detail;
    saveTimer = setTimeout(() => save(favs, def), 600);
  });

  A.getRedirectResult(auth).catch(() => {});
  // an anonymous ID (made when someone rates a station) is not a signed-in account
  let seen = "";
  async function onUser(u) {
    const next = u && !u.isAnonymous ? u : null;
    const id = next ? next.uid : "";
    user = next;
    if (id === seen) return;
    seen = id;
    draw();
    if (user) await mergeOnSignIn();
  }
  draw();
  A.onAuthStateChanged(auth, onUser);
}
