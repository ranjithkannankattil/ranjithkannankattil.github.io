// Firestore rules for radio ratings, comments and limits. Run under the emulator:
//   npx firebase emulators:exec --only firestore --project demo-radio "node --test rules.test.mjs"
import { test, before, after, beforeEach } from "node:test";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  doc, setDoc, getDoc, updateDoc, writeBatch, serverTimestamp, Timestamp, collection,
  query, where, getDocs, getCountFromServer, increment,
} from "firebase/firestore";

const RULES = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
function withOwner(uid, rules = RULES) {
  const out = rules.replace(/return '';(\s*\}\s*\/\/ OWNER_UID)/, `return '${uid}';$1`);
  if (out === rules) throw new Error("OWNER_UID line not found in firestore.rules");
  return out;
}
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const K = "malayalam~club-fm";

let env, bare;
before(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-radio", firestore: { rules: withOwner("owner"), host, port: +port } });
  bare = await initializeTestEnvironment({ projectId: "demo-radio-noowner", firestore: { rules: RULES, host, port: +port } });
});
after(async () => { await env.cleanup(); await bare.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); await bare.clearFirestore(); });

const db = (uid, e = env) => (uid ? e.authenticatedContext(uid) : e.unauthenticatedContext()).firestore();
const seed = (fn, e = env) => e.withSecurityRulesDisabled((c) => fn(c.firestore()));
const ago = (s) => Timestamp.fromMillis(Date.now() - s * 1000);

function rateBatch(d, uid, stars, key = K) {
  const b = writeBatch(d);
  b.set(doc(d, `ratings/${key}/votes/${uid}`), { stars, ts: serverTimestamp() });
  b.set(doc(d, `limits/${uid}`), { last: serverTimestamp() });
  return b.commit();
}
const comment = (uid, extra = {}, key = K) =>
  ({ key, uid, stars: 4, text: "Lovely station", ts: serverTimestamp(), status: "waiting", ...extra });
const seedComment = (uid, status, key = K) =>
  seed((d) => setDoc(doc(d, `comments/${key}__${uid}`), { key, uid, stars: 4, text: "Seeded", ts: ago(60), status }));

test("anon can rate 1-5", async () => {
  for (const [i, s] of [1, 2, 3, 4, 5].entries()) await assertSucceeds(rateBatch(db(`u${i}`), `u${i}`, s));
});

test("stars outside 1-5 refused", async () => {
  for (const s of [0, 6, 3.5, "4"]) await assertFails(rateBatch(db("anon1"), "anon1", s));
});

test("cannot write another uid's vote", async () => {
  const d = db("anon1");
  const b = writeBatch(d);
  b.set(doc(d, `ratings/${K}/votes/anon2`), { stars: 4, ts: serverTimestamp() });
  b.set(doc(d, "limits/anon1"), { last: serverTimestamp() });
  await assertFails(b.commit());
});

test("rating too fast refused", async () => {
  await seed((d) => setDoc(doc(d, "limits/anon1"), { last: ago(5) }));
  await assertFails(rateBatch(db("anon1"), "anon1", 4));
  await seed((d) => setDoc(doc(d, "limits/anon1"), { last: ago(20) }));
  await assertSucceeds(rateBatch(db("anon1"), "anon1", 4));
});

test("vote without limits update refused", async () => {
  await assertFails(setDoc(doc(db("anon1"), `ratings/${K}/votes/anon1`), { stars: 4, ts: serverTimestamp() }));
});

test("anyone can read and aggregate votes", async () => {
  await seed((d) => setDoc(doc(d, `ratings/${K}/votes/x`), { stars: 5, ts: ago(60) }));
  const snap = await assertSucceeds(getCountFromServer(collection(db(null), `ratings/${K}/votes`)));
  if (snap.data().count !== 1) throw new Error("count " + snap.data().count);
});

test("comment starts waiting", async () => {
  await assertSucceeds(commentBatch(db("anon1"), "anon1", comment("anon1")));
  await assertFails(commentBatch(db("anon2"), "anon2", comment("anon2", { status: "approved" })));
});

test("comment id must match key and uid", async () => {
  await assertFails(commentBatch(db("anon1"), "anon1", comment("anon1"), K, `${K}__anon2`));
  await assertFails(commentBatch(db("anon1"), "anon1", comment("anon2")));
});

test("over 300 chars refused", async () => {
  await assertFails(commentBatch(db("anon1"), "anon1", comment("anon1", { text: "x".repeat(301) })));
  await assertSucceeds(commentBatch(db("anon1"), "anon1", comment("anon1", { text: "x".repeat(300) })));
});

test("extra fields refused", async () => {
  await assertFails(commentBatch(db("anon1"), "anon1", comment("anon1", { name: "Me" })));
});

test("waiting comment hidden from others", async () => {
  await seedComment("anon1", "waiting");
  await assertFails(getDoc(doc(db("anon2"), `comments/${K}__anon1`)));
  await assertFails(getDoc(doc(db(null), `comments/${K}__anon1`)));
  await assertSucceeds(getDoc(doc(db("anon1"), `comments/${K}__anon1`)));
  await assertSucceeds(getDoc(doc(db("owner"), `comments/${K}__anon1`)));
});

test("missing own comment can be checked", async () => {
  await assertSucceeds(getDoc(doc(db("anon1"), `comments/${K}__anon1`)));
});

test("approved comment readable by anyone", async () => {
  await seedComment("anon1", "approved");
  await assertSucceeds(getDoc(doc(db(null), `comments/${K}__anon1`)));
  await assertSucceeds(getDocs(query(collection(db(null), "comments"), where("key", "==", K), where("status", "==", "approved"))));
  await assertFails(getDocs(query(collection(db(null), "comments"), where("key", "==", K))));
});

test("owner can approve and reject", async () => {
  await seedComment("anon1", "waiting");
  const ref = doc(db("owner"), `comments/${K}__anon1`);
  await assertSucceeds(updateDoc(ref, { status: "approved" }));
  await assertSucceeds(updateDoc(ref, { status: "rejected" }));
  await assertFails(updateDoc(ref, { status: "waiting" }));
  await assertFails(updateDoc(ref, { text: "Edited by owner" }));
  await assertSucceeds(getDocs(query(collection(db("owner"), "comments"), where("status", "==", "waiting"))));
});

test("author edit resets to waiting", async () => {
  await seedComment("anon1", "approved");
  const ref = doc(db("anon1"), `comments/${K}__anon1`);
  await assertFails(setDoc(ref, comment("anon1", { text: "Changed", status: "approved" })));
  await assertSucceeds(commentBatch(db("anon1"), "anon1", comment("anon1", { text: "Changed" })));
});

test("non-owner cannot change status", async () => {
  await seedComment("anon1", "waiting");
  await assertFails(updateDoc(doc(db("anon2"), `comments/${K}__anon1`), { status: "approved" }));
  await assertFails(updateDoc(doc(db("anon1"), `comments/${K}__anon1`), { status: "approved" }));
  await assertFails(getDocs(query(collection(db("anon2"), "comments"), where("status", "==", "waiting"))));
});

test("no approver before uid is set", async () => {
  await seed((d) => setDoc(doc(d, `comments/${K}__anon1`), { key: K, uid: "anon1", stars: 4, text: "x", ts: ago(60), status: "waiting" }), bare);
  await assertFails(updateDoc(doc(db("owner", bare), `comments/${K}__anon1`), { status: "approved" }));
  await assertFails(getDocs(query(collection(db("owner", bare), "comments"), where("status", "==", "waiting"))));
  // the comment itself is still fine to write and read back for its author
  await assertSucceeds(getDoc(doc(db("anon1", bare), `comments/${K}__anon1`)));
});

test("existing users and stats rules unchanged", async () => {
  await assertSucceeds(setDoc(doc(db("anon1"), "users/anon1"), { favs: [], def: "x", updated: serverTimestamp() }));
  await assertFails(setDoc(doc(db("anon1"), "users/anon2"), { favs: [] }));
  await seed((d) => setDoc(doc(d, "stats/site"), { visits: 5 }));
  await assertSucceeds(updateDoc(doc(db(null), "stats/site"), { visits: increment(1) }));
  await assertFails(setDoc(doc(db(null), "other/x"), { a: 1 }));
});

// ---- found in the final review
function commentBatch(d, uid, data, key = K, id = `${key}__${uid}`) {
  const b = writeBatch(d);
  b.set(doc(d, `comments/${id}`), data);
  b.set(doc(d, `limits/${uid}`), { lastComment: serverTimestamp() }, { merge: true });
  return b.commit();
}

test("comment without limits update refused", async () => {
  await assertFails(setDoc(doc(db("anon1"), `comments/${K}__anon1`), comment("anon1")));
  await assertSucceeds(commentBatch(db("anon1"), "anon1", comment("anon1")));
});

test("comment too fast refused", async () => {
  await seed((d) => setDoc(doc(d, "limits/anon1"), { lastComment: ago(10) }));
  await assertFails(commentBatch(db("anon1"), "anon1", comment("anon1")));
  await seed((d) => setDoc(doc(d, "limits/anon1"), { lastComment: ago(40) }));
  await assertSucceeds(commentBatch(db("anon1"), "anon1", comment("anon1")));
});

test("rating then commenting straight away is fine", async () => {
  await assertSucceeds(rateBatch(db("anon1"), "anon1", 4));
  await assertSucceeds(commentBatch(db("anon1"), "anon1", comment("anon1")));
  await assertFails(rateBatch(db("anon1"), "anon1", 5));   // the vote limit still holds
});

test("comment key must look like a station key", async () => {
  for (const bad of ["x", "a b~c", "~station", "malayalam~"]) {
    await assertFails(commentBatch(db("anon1"), "anon1", comment("anon1", { key: bad }), bad));
  }
});

test("limits fields cannot be backdated", async () => {
  await assertFails(setDoc(doc(db("anon1"), "limits/anon1"), { last: ago(100) }));
  await assertFails(setDoc(doc(db("anon1"), "limits/anon1"), { lastComment: ago(100) }));
  await assertFails(setDoc(doc(db("anon1"), "limits/anon1"), { other: serverTimestamp() }));
});

test("harness still works once the real owner ID is filled in", () => {
  const filled = RULES.replace(/return '[^']*';(\s*\}\s*\/\/ OWNER_UID)/, "return 'RealOwnerId123';$1");
  const prev = RULES;
  if (!/return 'RealOwnerId123';/.test(filled)) throw new Error("could not fill");
  if (!/return 'owner';/.test(withOwner("owner", filled))) throw new Error("harness did not replace a filled-in ID");
  void prev;
});
