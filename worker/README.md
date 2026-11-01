# Instant news refresh (optional)

`news-live.js` is a tiny Cloudflare Worker. When it is set up, the **Refresh** button on
ranjithkb.com/news.html also pulls stories published since the last 2-hourly edition, for the
place and languages on screen (marked "Just in"). Free plan: 100,000 requests a day.

1. Sign in at dash.cloudflare.com (free account) → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it `news-live`, click **Deploy**, then **Edit code**.
3. Replace the code with the contents of `news-live.js`, click **Deploy**.
4. Copy the address it shows (like `https://news-live.yourname.workers.dev`) and send it to Claude —
   it goes into `LIVE_URL` in `scripts/news_config.py`.

# Movies data service (needed for ranjithkb.com/movies.html)

`movies-api.js` is the Cloudflare Worker behind the Movies page. It keeps the film-database keys
secret, corrects misspelt searches, builds the "similar films" rows and caches answers at
Cloudflare's edge. Free plan: 100,000 requests a day.

1. **TMDB key** (free): sign up at themoviedb.org → Settings → API → request an API key
   (type "Personal", website ranjithkb.com). Copy the **API Read Access Token** (the long one).
2. **OMDb key** (free, 1,000 requests a day — answers are cached for a week): omdbapi.com/apikey.aspx →
   FREE → confirm the email it sends.
3. dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker** → name it `movies-api` →
   **Deploy** → **Edit code** → replace everything with the contents of `movies-api.js` → **Deploy**.
4. In the Worker: **Settings** → **Variables and Secrets** → **Add** → type **Secret**:
   `TMDB_KEY` = the TMDB token, then `OMDB_KEY` = the OMDb key. **Deploy** again.
5. Open the Worker's address with `/search?q=intersteller` on the end — it should answer with Interstellar.
   Send the address (like `https://movies-api.yourname.workers.dev`) to Claude, or paste it into
   `MOVIES_API` in `js/movies-config.js`.

**Private film log:** the diary, watchlist and dashboard live in the site's existing Firebase project
(Firestore, EU). Paste the whole of `firestore.rules` into Firebase console → Firestore Database →
Rules → **Publish** once, so the new `movielog` block is live. Only the owner account in
`js/movies-config.js` (`MOVIES_OWNER`) can sign in to it.

## Movie Friday newsletter (part of movies-api)

`newsletter.js` is uploaded with `movies-api.js` as a second module. It needs, on the movies-api Worker:
- **KV binding** `SUBS` → namespace `movies-newsletter` (the subscriber list; one key per address, metadata only)
- **Variables** `NEWS_FROM` = `Movie Friday <newsletter@ranjithkb.com>`, `SELF_URL` = the Worker's address
- **Secret** `RESEND_KEY` = a Resend API key with sending access (domain ranjithkb.com verified in Resend, EU region)
- **Cron triggers** `0 6 * * 5` and `0 7 * * 5` (UTC). The code sends only on the run that is 08:00 in Milan.

Routes: `POST /newsletter/subscribe {email}` (sends the confirmation), `/newsletter/confirm`, `/newsletter/unsubscribe`
(deletes the address), `/newsletter/preview?date=YYYY-MM-DD` (this week's issue as a web page) and
`POST /newsletter/send-test {email}` (this week's issue to one already-confirmed subscriber, at most every 10 minutes).
Resend DNS records on ranjithkb.com: TXT `resend._domainkey`, CNAME `rsend` and `send` (DNS only), TXT `_dmarc`.
Don't add Resend's MX record: the root MX records belong to Cloudflare Email Routing (hello@ranjithkb.com).
