// Station ratings and comments, on Firestore. No imports: the caller passes in Firebase
// (auth, db and the Auth/Firestore module namespaces A and F), so the same code runs in the
// browser (js/radio-ratings.js, js/radio-admin.js) and in the Node tests (scripts/rules-test).
// Data: ratings/{key}/votes/{uid}, comments/{key}__{uid}, limits/{uid}. Rules: firestore.rules.

export const keyFor = (collectionId, stationId) => `${collectionId}~${stationId}`;

const MIN_FOR_AVG = 3;
const WAITING_CAP = 200;   // the approval page shows at most this many at once
const fail = (code, cause) => Object.assign(new Error(code), { code, cause });
const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : 0);
const okStars = (s) => Number.isInteger(s) && s >= 1 && s <= 5;

export function createRatings({ auth, db, A, F }) {
  let signing = null;

  // the live account: Google if signed in, else an anonymous ID made on first use.
  // Nothing is cached, so signing in or out never leaves a stale ID behind.
  async function settled() { if (typeof auth.authStateReady === "function") await auth.authStateReady(); }
  async function ready() {
    if (auth.currentUser) return auth.currentUser.uid;
    if (!signing) {
      signing = (async () => {
        await settled();
        if (auth.currentUser) return auth.currentUser.uid;
        const cred = await A.signInAnonymously(auth);
        return cred.user.uid;
      })().finally(() => { signing = null; });
    }
    try { return await signing; } catch (e) { throw fail("unavailable", e); }
  }

  // run a Firestore call; permission errors keep their code, anything else is "unavailable"
  async function call(fn, deniedAs = "permission-denied") {
    try { return await fn(); } catch (e) {
      if (e && e.code && /permission-denied/.test(e.code)) throw fail(deniedAs, e);
      if (e && (e.code === "unavailable" || e.code === "too-fast")) throw e;
      throw fail("unavailable", e);
    }
  }

  const comments = () => F.collection(db, "comments");
  const shape = (d) => { const x = d.data(); return { id: d.id, key: x.key, stars: x.stars, text: x.text, ts: x.ts, status: x.status }; };
  const page = (list, after, limit) => (after ? list.filter((c) => ms(c.ts) < ms(after)) : list).slice(0, limit);

  return {
    ready,

    async summary(key) {
      const snap = await call(() => F.getAggregateFromServer(F.collection(db, "ratings", key, "votes"),
        { n: F.count(), avg: F.average("stars") }));
      const { n, avg } = snap.data();
      return { count: n, avg: n >= MIN_FOR_AVG ? avg : null };
    },

    // what this browser gave the station; never creates an account just to look
    async mine(key) {
      await settled();
      if (!auth.currentUser) return { stars: null, comment: null };
      const uid = auth.currentUser.uid;
      const [v, c] = await call(() => Promise.all([
        F.getDoc(F.doc(db, "ratings", key, "votes", uid)),
        F.getDoc(F.doc(db, "comments", `${key}__${uid}`)),
      ]));
      const cd = c.exists() ? c.data() : null;
      return {
        stars: v.exists() ? v.data().stars : null,
        comment: cd ? { text: cd.text, stars: cd.stars, status: cd.status } : null,
      };
    },

    async rate(key, stars) {
      if (!okStars(stars)) throw fail("bad-stars");
      const uid = await ready();
      await call(() => {
        const b = F.writeBatch(db);
        b.set(F.doc(db, "ratings", key, "votes", uid), { stars, ts: F.serverTimestamp() });
        b.set(F.doc(db, "limits", uid), { last: F.serverTimestamp() }, { merge: true });
        return b.commit();
      }, "too-fast");
    },

    async comment(key, stars, text) {
      if (!okStars(stars)) throw fail("bad-stars");
      const uid = await ready();
      const t = String(text || "").trim().slice(0, 300);
      await call(() => {
        const b = F.writeBatch(db);
        b.set(F.doc(db, "comments", `${key}__${uid}`), { key, uid, stars, text: t, ts: F.serverTimestamp(), status: "waiting" });
        b.set(F.doc(db, "limits", uid), { lastComment: F.serverTimestamp() }, { merge: true });
        return b.commit();
      }, "too-fast");
    },

    // equality-only queries need no composite index; sorting and paging happen here
    async approved(key, { after, limit = 5 } = {}) {
      const snap = await call(() => F.getDocs(F.query(comments(), F.where("key", "==", key), F.where("status", "==", "approved"))));
      const list = snap.docs.map(shape).sort((a, b) => ms(b.ts) - ms(a.ts));
      return page(list, after, limit).map(({ stars, text, ts }) => ({ stars, text, ts }));
    },

    async waiting() {
      await ready();
      const snap = await call(() => F.getDocs(F.query(comments(), F.where("status", "==", "waiting"), F.limit(WAITING_CAP))));
      return snap.docs.map(shape).sort((a, b) => ms(a.ts) - ms(b.ts)).map(({ status, ...c }) => c);
    },

    async published({ after, limit = 50 } = {}) {
      await ready();
      const snap = await call(() => F.getDocs(F.query(comments(), F.where("status", "==", "approved"))));
      const list = snap.docs.map(shape).sort((a, b) => ms(b.ts) - ms(a.ts));
      return page(list, after, limit).map(({ status, ...c }) => c);
    },

    async setStatus(id, status) {
      await ready();
      await call(() => F.updateDoc(F.doc(db, "comments", id), { status }));
    },
  };
}

// Inside the Radio apps there are no popups and Google refuses sign-in in an app's built-in
// browser, so the app signs in through Apple's secure sign-in sheet (iPhone) or a secure Chrome
// tab (Android) — its RadioAuth plugin, which opens auth-app.html — and hands back Google
// tokens to sign in with here.
function inApp() {
  const C = globalThis.Capacitor;
  return !!(C && C.isNativePlatform && C.isNativePlatform() && C.getPlatform && ["ios", "android"].includes(C.getPlatform()));
}
async function appCredential(A) {
  const C = globalThis.Capacitor;
  if (!C.isPluginAvailable || !C.isPluginAvailable("RadioAuth")) {
    const e = new Error("This version of the app can't sign in"); e.code = "app/update-needed"; throw e;
  }
  let r;
  try { r = await C.nativePromise("RadioAuth", "signIn", {}); }
  catch (e) { const x = new Error("cancelled"); x.code = "auth/popup-closed-by-user"; x.cause = e; throw x; }
  if (!r || (!r.idToken && !r.accessToken)) { const x = new Error("cancelled"); x.code = "auth/popup-closed-by-user"; throw x; }
  return A.GoogleAuthProvider.credential(r.idToken || null, r.accessToken || null);
}

// Google sign-in from a browser that already has an anonymous ID: link the two, so ratings
// and comments made anonymously stay with the person. If that Google account already exists
// elsewhere, sign in to it instead. A blocked popup falls back to a full-page redirect.
export async function upgradeToGoogle(auth, A, provider) {
  const anon = auth.currentUser && auth.currentUser.isAnonymous;
  if (inApp()) {
    let cred;
    try { cred = await appCredential(A); }
    catch (e) { if (e.code === "auth/popup-closed-by-user") return; throw e; }
    try {
      if (anon) await A.linkWithCredential(auth.currentUser, cred);
      else await A.signInWithCredential(auth, cred);
    } catch (e) {
      const code = e && e.code;
      if (anon && (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use")) {
        await A.signInWithCredential(auth, A.GoogleAuthProvider.credentialFromError(e) || cred);
      } else throw e;
    }
    return;
  }
  try {
    if (anon) await A.linkWithPopup(auth.currentUser, provider);
    else await A.signInWithPopup(auth, provider);
  } catch (e) {
    const code = e && e.code;
    if (anon && (code === "auth/credential-already-in-use" || code === "auth/email-already-in-use")) {
      const cred = A.GoogleAuthProvider.credentialFromError(e);
      if (cred) { await A.signInWithCredential(auth, cred); return; }
      await A.signInWithPopup(auth, provider);
    } else if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      if (anon) await A.linkWithRedirect(auth.currentUser, provider);
      else await A.signInWithRedirect(auth, provider);
    } else if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
      throw e;
    }
  }
}
