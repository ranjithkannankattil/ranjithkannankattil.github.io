// Loads Firebase and the ratings module for radio.html, then sets window.RadioRatings and
// fires "radio:ratings-ready". Visitors who never signed in get an anonymous Firebase ID the
// first time they rate. If Firebase can't load, "radio:ratings-failed" fires instead.
import { createRatings, keyFor } from "./radio-ratings-core.js";

const cfg = window.FIREBASE_CONFIG;
try {
  if (!cfg || !cfg.apiKey) throw new Error("no Firebase config");
  const V = "10.12.2";
  const [App, A, F] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
  ]);
  // radio-sync.js uses the same default app; whichever module runs first creates it
  const app = App.getApps().length ? App.getApp() : App.initializeApp(cfg);
  const R = createRatings({ auth: A.getAuth(app), db: F.getFirestore(app), A, F });
  R.keyFor = keyFor;
  window.RadioRatings = R;
  window.dispatchEvent(new CustomEvent("radio:ratings-ready"));
} catch (e) {
  console.warn("Ratings unavailable:", e);
  window.dispatchEvent(new CustomEvent("radio:ratings-failed"));
}
