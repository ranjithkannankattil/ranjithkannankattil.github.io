# Radio: station ratings, comments and sharing — design

Date: 2026-10-23 · Status: approved in chat, awaiting review of this document

## Why

Listeners should be able to say which stations are good, read what others think,
and send a station to someone. Ratings and approved comments are public; nobody has
to sign in to rate.

## Decisions (from the conversation)

- Ratings and comments are visible to everyone.
- Rating needs no sign-in: Firebase **anonymous** sign-in gives each browser an ID.
  Visitors already signed in with Google (for favourites) rate under that account, so
  their rating follows them across devices.
- Comments appear only after the owner approves them, and are shown **without a name**.
- Averages are computed by Firestore when a station's panel opens (aggregation query);
  station cards in the list do not show stars (a twice-daily summary can be added later).
- Approver: the Google account **ranjeethkkb@gmail.com** (verified email).

## Constraints

- Existing Firebase project `ranjithkb-radio` (Firestore, eur3), free tier.
- Static site on GitHub Pages; no server. Rules are the only protection.
- The owner does three manual steps: enable Anonymous sign-in, publish the new rules,
  open the approval page once.
- The phone controls row stays exactly as it is (no new buttons there).
- If Firebase is unreachable, playback and sharing keep working.

## Success criteria

1. A visitor who never signed in can rate a station in one tap, and the average and
   count update when the panel is reopened.
2. A comment is invisible to everyone but the owner until approved; once approved
   it shows for all, nameless, with date and stars.
3. A share link opens radio.html on that station, player ready, panel open.
4. Rules tests prove: no one but the approver can read waiting comments or change a
   status; stars outside 1–5 are refused; a browser cannot write another browser's
   rating or comment; ratings faster than one per 12 s per browser are refused.

## Listener side

### Station panel

Opened by tapping the station tile or name in the now-playing bar (a sheet from
the bottom on phones ≤ 640 px, a card above the bar on desktop; Esc / tap outside
closes). Contents, top to bottom:

- Average: `★ 4.3 · 18 ratings` when count ≥ 3, otherwise `Not rated yet` (or
  `2 ratings so far` for 1–2).
- Your rating: five star buttons (radio-group semantics, keyboard ←/→). Tapping saves
  immediately and shows `Saved ✓`; tapping another star changes it.
- Optional comment: textarea, 300-character limit with counter, **Send**. After
  sending: `Thanks — your comment will appear once it's approved.` If the browser
  already has a comment for this station, the box shows it with its state
  (waiting / published / not published) and editing it sends it back to waiting.
- Approved comments: newest 5 (date, stars, text), `Show more` loads 10 more.
- **Share** button.

### Sharing

- Link: `https://ranjithkb.com/radio.html?c=<collection id>&s=<station id>`.
- `navigator.share({ title, text: "<station> on ranjithkb.com radio", url })` where
  available (phones); otherwise copy to clipboard and show `Link copied`.
- Opening a link: select that collection, show that station in the player bar
  (not auto-playing — browsers block it), open its panel. Unknown or hidden station:
  open the collection normally and show `That station isn't available any more`.
- The link preview is the generic Radio card (static site, no per-station preview).

### Errors

- Firebase unreachable / offline: panel shows `Ratings unavailable right now`;
  stars and Send disabled; Share works.
- Rule refusal for rating too fast: `Slow down a little — try again in a few seconds.`
- Anonymous sign-in disabled in the console: same as unreachable, logged to console.

## Data (Firestore)

```
ratings/{key}/votes/{uid}   { stars: int 1..5, ts: timestamp }
comments/{key}__{uid}       { key, uid, stars: int 1..5, text: string ≤300, ts, status }
limits/{uid}                { last: timestamp }
```

`key` is the existing favourites key `<collection>:<station id>` with `:` replaced by
`~` (Firestore ids cannot contain `/`; `~` keeps keys readable). `status` is
`waiting | approved | rejected`.

Every rating write is a batch: the vote plus `limits/{uid}.last = request.time`.

## Rules (added to firestore.rules)

- `ratings/{key}/votes/{uid}`: read and list for everyone (needed for aggregation);
  create/update only by `request.auth.uid == uid`, keys exactly `stars, ts`,
  `stars` an int 1–5, `ts == request.time`, and the batch's
  `getAfter(limits/uid).last == request.time` with the previous `last` (if any)
  at least 12 s before `request.time`. Delete by the owner only.
- `limits/{uid}`: write only by that uid, key `last` only, `last == request.time`;
  read by that uid.
- `comments/{id}`:
  - read: `resource.data.status == 'approved'` for everyone; all documents for the
    approver; the author may read their own.
  - create/update by the author: `id == key + '__' + uid`, `uid == request.auth.uid`,
    keys exactly `key, uid, stars, text, ts, status`, `text` string ≤ 300,
    `stars` int 1–5, `ts == request.time`, `status == 'waiting'`.
  - update by the approver: only `status` changes, to `approved` or `rejected`.
  - delete: author or approver.
- Approver test: `request.auth.token.email == 'ranjeethkkb@gmail.com' &&
  request.auth.token.email_verified == true`.
- Existing `users/{uid}` and `stats/site` rules unchanged; default deny stays.

Note: `firestore.rules` is in the public repo, so the approver email is visible there.

## Owner side — `radio-admin.html`

`noindex`, not linked from the site. Google sign-in (existing `radio-sync.js` setup).
If the signed-in account is not the approver: `This page is for the site owner.`
Otherwise two lists:

- **Waiting** (oldest first): station name (resolved from the station files), stars,
  text, date; **Approve** / **Reject**.
- **Published** (newest first, 50 at a time): same fields; **Remove** (sets `rejected`).

A heading shows the waiting count. No notifications.

## Privacy page

Add under Radio: ratings and comments are stored in Google Firebase (EU) under an
anonymous ID created by the browser; comments are published without a name only after
review; to have one removed, contact the owner. The anonymous ID can be cleared by
clearing site data.

## Code layout

- `js/radio-ratings.js` (new, ES module like `radio-sync.js`): Firebase init with
  anonymous sign-in fallback, `getSummary(key)`, `getMine(key)`, `rate(key, stars)`,
  `comment(key, stars, text)`, `listApproved(key, after)`. Talks to `radio.js` through
  `window.RadioApp` and custom events, as `radio-sync.js` does.
- `js/radio.js`: panel UI, share, `?c=&s=` deep link.
- `radio.html` / `css/radio.css`: panel markup and styles.
- `radio-admin.html` + `js/radio-admin.js` (new).
- `firestore.rules`, `privacy.html`.

## Testing

- Rules: `firebase emulators:exec` with `@firebase/rules-unit-testing` (Node), file
  `scripts/test_firestore_rules.mjs`, covering criterion 4 and: approved comment
  readable by anyone, waiting comment unreadable by others, author can read own,
  approver can approve/reject, author edit resets to waiting, extra fields refused,
  >300 chars refused.
- Browser: `scripts/check_radio_panel.mjs` (Playwright) with `radio-ratings.js`
  replaced by a fake module: panel opens from the bar on phone and desktop, stars save
  and show `Saved ✓`, comment flow messages, `Not rated yet` below 3, share calls
  `navigator.share` or copies, deep link opens the right station and panel, offline
  message, phone controls still pass `check_radio_cast.mjs`.
- After the owner's three steps: one real rating and comment end to end, checked by
  the owner on the approval page.

## Out of scope

Stars on station cards, notifications for new comments, App Check (can be added if
abuse appears), per-station link previews, replies to comments.
