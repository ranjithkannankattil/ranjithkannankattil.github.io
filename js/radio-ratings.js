// Loads Firebase and the ratings module for radio.html, then sets window.RadioRatings and
// fires "radio:ratings-ready". Visitors who never signed in get an anonymous Firebase ID the
// first time they rate (radio.html); radio-admin.html uses the same loader. If Firebase can't load, "radio:ratings-failed" fires instead.
import { createRatings, keyFor, upgradeToGoogle } from "./radio-ratings-core.js?v=2";

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
  const auth = A.getAuth(app);
  const R = createRatings({ auth, db: F.getFirestore(app), A, F });
  R.keyFor = keyFor;
  // for the approval page: who is signed in, and Google sign-in / out
  R.account = async () => {
    await auth.authStateReady();
    const u = auth.currentUser;
    return u ? { uid: u.uid, anonymous: u.isAnonymous } : null;
  };
  R.signInGoogle = () => {
    const provider = new A.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    return upgradeToGoogle(auth, A, provider);
  };
  R.signOut = () => A.signOut(auth);
  window.RadioRatings = R;
  // an open station panel reloads when someone signs in or out
  let firstAuth = true;
  A.onAuthStateChanged(auth, () => {
    if (firstAuth) { firstAuth = false; return; }
    window.dispatchEvent(new CustomEvent("radio:ratings-account"));
  });
  window.dispatchEvent(new CustomEvent("radio:ratings-ready"));
} catch (e) {
  console.warn("Ratings unavailable:", e);
  window.dispatchEvent(new CustomEvent("radio:ratings-failed"));
}
