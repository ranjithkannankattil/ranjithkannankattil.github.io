/* Movies page settings.
   MOVIES_API: the address of the movies-api Cloudflare Worker (worker/movies-api.js),
   e.g. "https://movies-api.yourname.workers.dev". Empty = the page explains it isn't connected yet.
   MOVIES_OWNER: the Firebase account ID that may sign in and keep the private watch log
   (same owner ID as in firestore.rules). Anyone else who signs in is signed straight out. */
window.MOVIES_API = "";
window.MOVIES_OWNER = "oidT4ydQi7aRffo0v6qvf4mMNM72";
// placeholder until js/movies-log.js has loaded and checked who is signed in
window.MovieLog = window.MovieLog || { pending: true, owner: false };
