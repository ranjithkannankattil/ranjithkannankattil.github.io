// Station ratings and comments, on Firestore. No imports: the caller passes in Firebase
// (auth, db and the Auth/Firestore module namespaces A and F), so the same code runs in the
// browser (js/radio-ratings.js, js/radio-admin.js) and in the Node tests (scripts/rules-test).
// Data: ratings/{key}/votes/{uid}, comments/{key}__{uid}, limits/{uid}. Rules: firestore.rules.

export const keyFor = (collectionId, stationId) => `${collectionId}~${stationId}`;

const MIN_FOR_AVG = 3;
const fail = (code, cause) => Object.assign(new Error(code), { code, cause });
const ms = (t) => (t && typeof t.toMillis === "function" ? t.toMillis() : 0);
const okStars = (s) => Number.isInteger(s) && s >= 1 && s <= 5;

export function createRatings({ auth, db, A, F }) {
  let signing = null;

  async function ready() {
    if (auth.currentUser) return auth.currentUser.uid;
    if (!signing) {
      signing = (async () => {
        if (typeof auth.authStateReady === "function") await auth.authStateReady();
        if (auth.currentUser) return auth.currentUser.uid;
        const cred = await A.signInAnonymously(auth);
        return cred.user.uid;
      })();
      signing.catch(() => { signing = null; });
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

    async mine(key) {
      const uid = await ready();
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
        b.set(F.doc(db, "limits", uid), { last: F.serverTimestamp() });
        return b.commit();
      }, "too-fast");
    },

    async comment(key, stars, text) {
      if (!okStars(stars)) throw fail("bad-stars");
      const uid = await ready();
      const t = String(text || "").trim().slice(0, 300);
      await call(() => F.setDoc(F.doc(db, "comments", `${key}__${uid}`),
        { key, uid, stars, text: t, ts: F.serverTimestamp(), status: "waiting" }));
    },

    // equality-only queries need no composite index; sorting and paging happen here
    async approved(key, { after, limit = 5 } = {}) {
      const snap = await call(() => F.getDocs(F.query(comments(), F.where("key", "==", key), F.where("status", "==", "approved"))));
      const list = snap.docs.map(shape).sort((a, b) => ms(b.ts) - ms(a.ts));
      return page(list, after, limit).map(({ stars, text, ts }) => ({ stars, text, ts }));
    },

    async waiting() {
      await ready();
      const snap = await call(() => F.getDocs(F.query(comments(), F.where("status", "==", "waiting"))));
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
