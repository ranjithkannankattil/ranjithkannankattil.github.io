// The ratings data module (js/radio-ratings-core.js) against the emulator, with the real rules.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import * as F from "firebase/firestore";
import { createRatings, keyFor } from "../../js/radio-ratings-core.js";

const RULES = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8")
  .replace(/return '';(\s*\}\s*\/\/ OWNER_UID)/, "return 'owner';$1");
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
const K = "malayalam~club-fm";

let env;
before(async () => { env = await initializeTestEnvironment({ projectId: "demo-radio-core", firestore: { rules: RULES, host, port: +port } }); });
after(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const R = (uid) => createRatings({ auth: { currentUser: { uid } }, db: env.authenticatedContext(uid).firestore(), A: {}, F });
const seed = (id, data) => env.withSecurityRulesDisabled((c) => F.setDoc(F.doc(c.firestore(), "comments", id), data));
const ts = (ms) => F.Timestamp.fromMillis(ms);

test("keyFor joins with ~", () => {
  assert.equal(keyFor("malayalam", "club-fm"), "malayalam~club-fm");
});

test("rate then summary", async () => {
  await R("a").rate(K, 5);
  await R("b").rate(K, 4);
  await R("c").rate(K, 3);
  assert.deepEqual(await R("d").summary(K), { count: 3, avg: 4 });
});

test("summary hides avg below 3", async () => {
  await R("a").rate(K, 5);
  await R("b").rate(K, 4);
  assert.deepEqual(await R("d").summary(K), { count: 2, avg: null });
  assert.deepEqual(await R("d").summary("other~x"), { count: 0, avg: null });
});

test("too fast throws too-fast", async () => {
  const r = R("a");
  await r.rate(K, 5);
  await assert.rejects(r.rate(K, 3), (e) => e.code === "too-fast");
});

test("comment then mine shows waiting", async () => {
  const r = R("a");
  assert.deepEqual(await r.mine(K), { stars: null, comment: null });
  await r.rate(K, 4);
  await r.comment(K, 4, "  Great morning show  ");
  const m = await r.mine(K);
  assert.equal(m.stars, 4);
  assert.deepEqual({ ...m.comment }, { text: "Great morning show", stars: 4, status: "waiting" });
});

test("comment text limited to 300 characters", async () => {
  const r = R("a");
  await r.comment(K, 4, "x".repeat(400));
  assert.equal((await r.mine(K)).comment.text.length, 300);
});

test("approved lists only approved, newest first", async () => {
  await seed(`${K}__a`, { key: K, uid: "a", stars: 5, text: "old", ts: ts(1e12), status: "approved" });
  await seed(`${K}__b`, { key: K, uid: "b", stars: 2, text: "hidden", ts: ts(1.5e12), status: "waiting" });
  await seed(`${K}__c`, { key: K, uid: "c", stars: 4, text: "new", ts: ts(2e12), status: "approved" });
  await seed(`x~y__d`, { key: "x~y", uid: "d", stars: 4, text: "elsewhere", ts: ts(2e12), status: "approved" });
  const list = await R("z").approved(K);
  assert.deepEqual(list.map((c) => c.text), ["new", "old"]);
  const more = await R("z").approved(K, { after: list[0].ts, limit: 5 });
  assert.deepEqual(more.map((c) => c.text), ["old"]);
});

test("owner lists waiting oldest first and sets status", async () => {
  await seed(`${K}__a`, { key: K, uid: "a", stars: 5, text: "second", ts: ts(2e12), status: "waiting" });
  await seed(`${K}__b`, { key: K, uid: "b", stars: 3, text: "first", ts: ts(1e12), status: "waiting" });
  const o = R("owner");
  const w = await o.waiting();
  assert.deepEqual(w.map((c) => c.text), ["first", "second"]);
  assert.equal(w[0].key, K);
  await o.setStatus(w[0].id, "approved");
  assert.deepEqual((await o.published()).map((c) => c.text), ["first"]);
  assert.deepEqual((await o.waiting()).map((c) => c.text), ["second"]);
});

test("non-owner waiting throws permission-denied", async () => {
  await assert.rejects(R("a").waiting(), (e) => e.code === "permission-denied");
});

test("ready signs in anonymously when nobody is signed in", async () => {
  const auth = { currentUser: null };
  const A = { signInAnonymously: async (a) => { a.currentUser = { uid: "anon-new" }; return { user: a.currentUser }; } };
  assert.equal(await createRatings({ auth, db: null, A, F }).ready(), "anon-new");
});

test("ready failure throws unavailable", async () => {
  const A = { signInAnonymously: async () => { throw Object.assign(new Error("x"), { code: "auth/operation-not-allowed" }); } };
  await assert.rejects(createRatings({ auth: { currentUser: null }, db: null, A, F }).ready(), (e) => e.code === "unavailable");
});
