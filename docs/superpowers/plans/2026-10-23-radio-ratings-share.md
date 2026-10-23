# Radio Ratings, Comments and Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Anyone can rate a radio station (no sign-in), add a comment that goes public only after the owner approves it, and share a link that opens that station.

**Architecture:** Firestore rules are the only protection, and they are tested against the local Firebase emulator. A new data module, `js/radio-ratings-core.js`, takes its Firebase objects as parameters, so the same code runs in the browser (loaded from gstatic) and in Node tests (npm `firebase`). `radio.js` gains a station panel, sharing and a `?s=` deep link, and talks to the module through `window.RadioRatings`. A separate `radio-admin.html` handles approvals.

**Tech Stack:** Firebase JS SDK 10.12.2 (browser, same as `radio-sync.js`) and npm `firebase@10.12.2` (tests); `firebase-tools` emulator and `@firebase/rules-unit-testing@3` (they need Java, which is installed); Playwright (browser checks); vanilla JS/CSS.

**Spec:** `docs/superpowers/specs/2026-10-23-radio-ratings-share-design.md`

## Global Constraints

- Project `ranjithkb-radio`; existing `js/firebase-config.js`; free tier; no server.
- The approver is identified only by uid: the `OWNER_UID` constant in `firestore.rules`, empty until the owner sends it. No email in any file.
- Stars are integers 1–5; comments are at most 300 characters; at least 12 s between rating writes per uid; an average is shown only when count ≥ 3.
- Comment status is `waiting`, `approved` or `rejected`. Document ids: `ratings/{key}/votes/{uid}`, `comments/{key}__{uid}`, `limits/{uid}`. `key` is `<collection>~<station id>`.
- Exact copy from the spec: `Not rated yet`, `2 ratings so far`, `★ 4.3 · 18 ratings`, `Saved ✓`, `Thanks — your comment will appear once it's approved.`, `Ratings unavailable right now`, `Slow down a little — try again in a few seconds.`, `Link copied`, `That station isn't available any more`, `This page is for the site owner.`, `Your account ID:`.
- The phone controls row is unchanged: `scripts/check_radio_cast.mjs` must keep passing (26 checks).
- Commits: author `Claude <noreply@anthropic.com>`, both attribution lines, and `git pull --rebase` before every push.

## Review Focus

1. Someone opens a shared link while the station list for that language is still loading: the panel must open once it has loaded, not fail silently. Task 3 test `deep link waits for the collection`.
2. Anonymous sign-in is switched off in the console, or blocked by a privacy extension: the panel shows `Ratings unavailable right now` and nothing throws. Task 4 test `auth failure shows unavailable`.
3. Someone rates, then edits their comment: the edited comment must go back to waiting, not stay approved. Task 1 rules test `author edit resets to waiting`.
4. A comment with HTML or a script tag must show as plain text, both on the panel and on the admin page. Task 4 test `comment text is escaped`; Task 5 test `admin escapes text`.
5. While `OWNER_UID` is empty, nobody can approve and nothing errors. Task 1 rules test `no approver before uid is set`.

---

### Task 1: Security rules, tested against the emulator

**Files:**
- Modify: `firestore.rules` (add the ratings, comments and limits blocks; keep `users`, `stats` and the default deny)
- Create: `scripts/rules-test/package.json` (`firebase-tools`, `@firebase/rules-unit-testing@3`, `firebase@10.12.2`), `scripts/rules-test/firebase.json` (Firestore emulator on port 8080, rules path `../../firestore.rules`), `scripts/rules-test/rules.test.mjs`
- Modify: `.gitignore` (`scripts/rules-test/node_modules`)

**Interfaces:**
- Produces:
  - In `firestore.rules`, `function isOwner() { return request.auth != null && request.auth.uid == OWNER_UID_VALUE; }`, with the literal `''` until the owner sends the uid.
  - For tests, an environment variable `OWNER_UID_TEST`. The test harness swaps the literal for it before loading the rules.

- [ ] **Step 1: Write the failing tests** in `rules.test.mjs`. Use `initializeTestEnvironment`, with `authenticatedContext('anon1')`, `authenticatedContext('anon2')`, `authenticatedContext('owner')` and `unauthenticatedContext()`. Each test asserts `assertSucceeds` or `assertFails`:
  - `anon can rate 1-5`: a batch `votes/anon1 {stars:4, ts:serverTimestamp()}` plus `limits/anon1 {last:serverTimestamp()}` succeeds.
  - `stars outside 1-5 refused`: 0, 6, 3.5 and "4" all fail.
  - `cannot write another uid's vote`: anon1 writing `votes/anon2` fails.
  - `rating too fast refused`: the second batch within 12 s fails. Seed `limits/anon1.last` at now−5 s with `withSecurityRulesDisabled`; seeding at now−20 s succeeds.
  - `vote without limits update refused`: a vote written alone (not in a batch) fails.
  - `anyone can read and aggregate votes`: unauthenticated `getCountFromServer` on `ratings/k/votes` succeeds.
  - `comment starts waiting`: create `comments/k__anon1` with status `waiting` succeeds; with `approved` it fails.
  - `comment id must match key and uid`: `comments/k__anon2` written by anon1 fails.
  - `over 300 chars refused`; `extra fields refused`.
  - `waiting comment hidden from others`: anon2 get fails, the author get succeeds, the owner get succeeds.
  - `approved comment readable by anyone`: seeded approved → unauthenticated get and a list query `where status == approved` succeed.
  - `owner can approve and reject`: the owner updating only `status` to `approved` or `rejected` succeeds; changing `text` fails.
  - `author edit resets to waiting`: seeded approved → the author updates the text with status `waiting` → succeeds; keeping `approved` fails.
  - `non-owner cannot change status`.
  - `no approver before uid is set`: with `OWNER_UID_TEST` unset, the owner context approving fails.
  - `existing users and stats rules unchanged`: a write to `users/anon1 {favs:[], def:'x', updated:ts}` by anon1 succeeds; stats `+1` succeeds.
- [ ] **Step 2: Run it and watch it fail:** `cd scripts/rules-test && npm i && npx firebase emulators:exec --only firestore --project demo-radio "node --test rules.test.mjs"` → the new tests fail, because the current rules deny everything new.
- [ ] **Step 3: Write the rules.** Rating batches use `getAfter(/databases/$(database)/documents/limits/$(uid)).data.last == request.time`. The previous-limit check is `!exists(limits) || get(limits).data.last < request.time - duration.value(12, 's')`.
- [ ] **Step 4: Run it** → all pass.
- [ ] **Step 5: Commit** — `"Radio ratings: Firestore rules with emulator tests"`.

### Task 2: Data module

**Files:**
- Create: `js/radio-ratings-core.js` (ES module, no imports), `js/radio-ratings.js` (ES module: imports Firebase 10.12.2 from gstatic like `radio-sync.js`, calls the core, sets `window.RadioRatings`, dispatches `radio:ratings-ready`)
- Test: `scripts/rules-test/core.test.mjs` (runs under the emulator with npm `firebase`)

**Interfaces:**
- Produces: `createRatings({ auth, db, A, F }) -> RadioRatings`, where `A` and `F` are the Auth and Firestore module namespaces. Methods (all async; failures throw `Error` with `code`):
  - `ready() -> uid`: reuses `auth.currentUser` (Google or anonymous), else `A.signInAnonymously`. Failure throws `code: 'unavailable'`.
  - `summary(key) -> { count: number, avg: number|null }`: `F.getAggregateFromServer` with `count()` and `average('stars')`. `avg` is `null` when `count < 3`.
  - `mine(key) -> { stars: number|null, comment: { text, stars, status }|null }`.
  - `rate(key, stars)`: the batch from Task 1. A rules refusal within 12 s throws `code: 'too-fast'`.
  - `comment(key, stars, text)`: sets `comments/{key}__{uid}` with status `waiting`; `text` is trimmed and limited to 300 characters.
  - `approved(key, { after?: Timestamp, limit = 5 }) -> [{ stars, text, ts }]`, newest first.
  - For the admin page: `waiting() -> [{ id, key, stars, text, ts }]` oldest first; `published({ after?, limit = 50 })`; `setStatus(id, status)`.
- `keyFor(collectionId, stationId) -> string` returns `` `${c}~${s}` `` (exported from core).

- [ ] **Step 1: Write failing tests:** `rate then summary` (3 uids rate 5, 4, 3 → `{count:3, avg:4}`); `summary hides avg below 3` (2 votes → `avg:null`); `too fast throws too-fast`; `comment then mine shows waiting`; `approved lists only approved, newest first`; `keyFor joins with ~`.
- [ ] **Step 2: Run them and watch them fail** (same emulator command, `node --test core.test.mjs`) → module not found.
- [ ] **Step 3: Implement the core and the browser loader.**
- [ ] **Step 4: Run the tests** → pass.
- [ ] **Step 5: Commit** — `"Radio ratings: data module"`.

### Task 3: Share and deep link

**Files:**
- Modify: `js/radio.js` (start-up block; `openCollection`; new `shareStation(s, cId)`; new exported `RadioApp.openStation(cId, sid)`)
- Create: `scripts/check_radio_panel.mjs` (Playwright; this task adds the share and link cases, Task 4 adds panel cases)

**Interfaces:**
- Produces:
  - `shareUrl(cId, s) -> string`, equal to `` `${location.origin}/radio.html?c=${cId}&s=${encodeURIComponent(s.id)}` ``.
  - `shareStation(s, cId)`: `navigator.share({ title: s.name, text: `${s.name} on ranjithkb.com radio`, url })` when `navigator.share` exists, else `navigator.clipboard.writeText(url)` then `status('Link copied', 4000)`.
  - Start-up with `?s=`: await `openCollection(c)`, find the station by id among the not-hidden ones, `showNowPlaying` with status `Tap play to start`, then `openPanel()` (Task 4; a no-op until then). If the station is not found: `status("That station isn't available any more", 6000)`.

- [ ] **Step 1: Write failing checks:**
  - `share copies link on desktop`: stub `navigator.share` as undefined and spy on the clipboard → the text equals `/radio.html?c=malayalam&s=<first station id>` and the status reads `Link copied`.
  - `share uses the share sheet on phones`: stub `navigator.share` → called with that url.
  - `deep link opens the station`: `radio.html?c=malayalam&s=<id>` → `#npName` shows that station's name.
  - `deep link waits for the collection`: delay the `js/stations/malayalam.js` route by 1.5 s → the name still shows.
  - `unknown station message`: `?s=nope` → the status shows `That station isn't available any more`.
- [ ] **Step 2: Run them and watch them fail.**
- [ ] **Step 3: Implement.** The Share button lives in the panel (Task 4). For this task, expose `RadioApp.share()` so the check can call it.
- [ ] **Step 4: Run them** → pass. Run `check_radio_cast.mjs` → 26 pass.
- [ ] **Step 5: Commit** — `"Radio: share a station; links open it"`.

### Task 4: Station panel

**Files:**
- Modify: `radio.html` (panel markup `#stPanel` after the player; load `js/radio-ratings.js` as a module), `js/radio.js` (`openPanel()`, `closePanel()`, rendering), `css/radio.css` (a sheet on screens ≤ 640 px, a card above the bar otherwise)
- Test: `scripts/check_radio_panel.mjs`. The check serves a fake `js/radio-ratings.js` through `page.route`. The fake sets `window.RadioRatings` from an in-page object whose methods the test controls.

**Interfaces:**
- Consumes: the `RadioRatings` methods (Task 2), `shareStation` (Task 3).
- Produces: `openPanel()` opens for `current`/`currentCol`. Tapping `#npTile` or `#npName` opens it; Esc, a tap on the backdrop or `#stClose` closes it. Elements:
  - `#stAvg` (average text)
  - `#stStars`: 5 buttons, `role="radiogroup"`, each `role="radio"` with `aria-checked`
  - `#stSaved`
  - `#stText` (`maxlength="300"`) and `#stCount`
  - `#stSend`, `#stNote`
  - `#stList`, `#stMore`
  - `#stShare`
- Average text rules: count 0 → `Not rated yet`; count 1–2 → `` `${count} rating${count > 1 ? 's' : ''} so far` ``; count ≥ 3 → `` `★ ${avg.toFixed(1)} · ${count} ratings` ``.

- [ ] **Step 1: Write failing checks:**
  - `panel opens from the bar` at 1280 px and at 390 px, where it is a sheet (`#stPanel` bottom edge equals the viewport height).
  - `Not rated yet`, `2 ratings so far`, and `★ 4.3 · 18 ratings`, from the fake's summary.
  - `tap a star saves`: the fake's `rate` is called with `(key, 4)` and `Saved ✓` shows.
  - `too fast message`: the fake throws `too-fast` → `Slow down a little — try again in a few seconds.`
  - `send comment`: the note reads `Thanks — your comment will appear once it's approved.`
  - `existing comment shows its state`.
  - `comment text is escaped`: an approved text of `<img src=x onerror=alert(1)>` renders as text, with no `img` in `#stList`.
  - `show more loads 10`.
  - `auth failure shows unavailable`: the fake's `ready` throws → `Ratings unavailable right now`, stars disabled, Share still works.
  - `share button shares`.
  - `keyboard`: ←/→ move between stars.
- [ ] **Step 2: Run them and watch them fail.**
- [ ] **Step 3: Implement.** Rendering uses `textContent` only.
- [ ] **Step 4: Run** `check_radio_panel.mjs` and `check_radio_cast.mjs` → all pass. Take screenshots at 390 and 1280 px and look at both.
- [ ] **Step 5: Commit** — `"Radio: station panel with ratings and comments"`.

### Task 5: Approval page

**Files:**
- Create: `radio-admin.html` (`noindex`, site header, Google sign-in button), `js/radio-admin.js` (module: same Firebase init as `radio-sync.js`, `createRatings` from the core)
- Test: `scripts/check_radio_admin.mjs` (Playwright with the faked module, as in Task 4)

**Interfaces:**
- Consumes: `waiting`, `published`, `setStatus` and `ready` (Task 2). Owner detection: try `waiting()`. A permission error means not the owner. Show `This page is for the site owner.` and `` `Your account ID: ${uid}` `` with a Copy button, and never the email.
- Shows station names by loading `js/stations/<collection>.js` for each key's collection, once per collection.

- [ ] **Step 1: Write failing checks:**
  - `not owner sees account ID`: the fake's `waiting` throws `permission-denied` → `Your account ID: anon-test-uid` and a Copy button; the page text contains no `@`.
  - `owner sees waiting oldest first`.
  - `approve moves to published`: `setStatus(id, 'approved')` is called and the item moves lists.
  - `reject removes`; `remove from published sets rejected`.
  - `admin escapes text`.
  - `waiting count in heading`.
- [ ] **Step 2: Run them and watch them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them** → pass.
- [ ] **Step 5: Commit** — `"Radio: approval page for comments"`.

### Task 6: Privacy page and publishing

**Files:**
- Modify: `privacy.html` (add the Radio paragraph, wording from the spec's "Privacy page" section); bump the `radio.js`/`radio.css` versions in `radio.html`

- [ ] **Step 1: Add the paragraph.** Run all three browser checks and the rules tests → all pass.
- [ ] **Step 2: Commit and push**, wait for the Pages deploy (`completed success`), and confirm the live `radio.html` loads `radio-ratings.js`.
- [ ] **Step 3: Give the owner the three steps, with exact clicks:**
  1. Firebase console → Authentication → Sign-in method → Anonymous → Enable.
  2. Open `ranjithkb.com/radio-admin.html`, sign in, and send the account ID.
  3. With `OWNER_UID` filled in (commit `"Radio ratings: approver ID"`), paste `firestore.rules` into Firestore → Rules → Publish.

### Task 7: End-to-end check with the owner

- [ ] **Step 1:** After the rules are published, rate a station and send a comment from a private browser window with no sign-in, using the Playwright check pointed at the live site with the real module. Confirm the panel shows `Saved ✓` and the comment note.
- [ ] **Step 2:** The owner approves it on the approval page. Then confirm that the live panel shows the comment to an unsigned-in visitor, and that the waiting list is empty.
- [ ] **Step 3:** Report the results; delete the test comment if the owner wants.
