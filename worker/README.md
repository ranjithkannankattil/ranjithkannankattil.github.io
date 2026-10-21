# Instant news refresh (optional)

`news-live.js` is a tiny Cloudflare Worker. When it is set up, the **Refresh** button on
ranjithkb.com/news.html also pulls stories published since the last 2-hourly edition, for the
place and languages on screen (marked "Just in"). Free plan: 100,000 requests a day.

1. Sign in at dash.cloudflare.com (free account) → **Workers & Pages** → **Create** → **Create Worker**.
2. Name it `news-live`, click **Deploy**, then **Edit code**.
3. Replace the code with the contents of `news-live.js`, click **Deploy**.
4. Copy the address it shows (like `https://news-live.yourname.workers.dev`) and send it to Claude —
   it goes into `LIVE_URL` in `scripts/news_config.py`.
