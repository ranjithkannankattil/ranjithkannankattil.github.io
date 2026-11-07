package com.ranjithkb.radionative

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/**
 * Sign in with Google to keep favourites in the same account as ranjithkb.com.
 * Google doesn't allow sign-in inside an app, so the app opens ranjithkb.com/auth-app.html in a
 * secure Chrome tab; it signs in as on the website and hands the Google token back through
 * com.ranjithkb.radio://auth. Here it becomes a Firebase session (project ranjithkb-radio) and
 * favourites are read and written at users/{uid} — the same document the website uses.
 */
object Account {
    private const val KEY = "AIzaSyDGsaqqamWbS6RCtyU9v54o-oqZqYzdDEo"   // public web key, as on the website
    const val SIGN_IN_URL = "https://ranjithkb.com/auth-app.html?start=1"
    private const val DOCS = "https://firestore.googleapis.com/v1/projects/ranjithkb-radio/databases/(default)/documents"

    private fun prefs(ctx: Context) = ctx.getSharedPreferences("account", Context.MODE_PRIVATE)
    fun name(ctx: Context): String? = prefs(ctx).getString("name", null)
    fun signedIn(ctx: Context) = prefs(ctx).getString("refresh", null) != null
    fun signOut(ctx: Context) = prefs(ctx).edit().clear().apply()

    private fun http(url: String, method: String, body: String?, type: String = "application/json", bearer: String? = null): JSONObject {
        val c = URL(url).openConnection() as HttpURLConnection
        c.requestMethod = method; c.connectTimeout = 15000; c.readTimeout = 15000
        c.setRequestProperty("Referer", "https://ranjithkb.com/")
        bearer?.let { c.setRequestProperty("Authorization", "Bearer $it") }
        if (body != null) { c.doOutput = true; c.setRequestProperty("Content-Type", type); c.outputStream.use { it.write(body.toByteArray()) } }
        val ok = c.responseCode in 200..299
        val text = (if (ok) c.inputStream else c.errorStream)?.bufferedReader()?.use { it.readText() } ?: "{}"
        if (!ok) throw RuntimeException("HTTP ${c.responseCode}: ${text.take(200)}")
        return JSONObject(text)
    }

    /** Google tokens from auth-app.html -> Firebase session. */
    suspend fun finishSignIn(ctx: Context, idToken: String, accessToken: String) = withContext(Dispatchers.IO) {
        val post = if (idToken.isNotEmpty()) "id_token=$idToken&providerId=google.com" else "access_token=$accessToken&providerId=google.com"
        val r = http("https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=$KEY", "POST",
            JSONObject().put("postBody", post).put("requestUri", "https://ranjithkb.com")
                .put("returnSecureToken", true).toString())
        prefs(ctx).edit().putString("uid", r.getString("localId")).putString("refresh", r.getString("refreshToken"))
            .putString("token", r.getString("idToken"))
            .putLong("exp", System.currentTimeMillis() + r.optString("expiresIn", "3600").toLong() * 1000 - 60_000)
            .putString("name", r.optString("displayName").ifBlank { r.optString("email") }).apply()
    }

    private fun token(ctx: Context): Pair<String, String>? {
        val p = prefs(ctx)
        val uid = p.getString("uid", null) ?: return null
        if (System.currentTimeMillis() < p.getLong("exp", 0)) return uid to p.getString("token", "")!!
        val refresh = p.getString("refresh", null) ?: return null
        val r = http("https://securetoken.googleapis.com/v1/token?key=$KEY", "POST",
            "grant_type=refresh_token&refresh_token=${URLEncoder.encode(refresh, "UTF-8")}", "application/x-www-form-urlencoded")
        p.edit().putString("token", r.getString("id_token")).putString("refresh", r.getString("refresh_token"))
            .putLong("exp", System.currentTimeMillis() + r.optString("expires_in", "3600").toLong() * 1000 - 60_000).apply()
        return uid to r.getString("id_token")
    }

    /** Favourite keys saved in the account ("<collection>:<id>", in order). */
    suspend fun remoteFavs(ctx: Context): List<String>? = withContext(Dispatchers.IO) {
        val (uid, t) = token(ctx) ?: return@withContext null
        try {
            val d = http("$DOCS/users/$uid", "GET", null, bearer = t)
            val vals = d.optJSONObject("fields")?.optJSONObject("favs")?.optJSONObject("arrayValue")?.optJSONArray("values") ?: JSONArray()
            List(vals.length()) { vals.getJSONObject(it).getString("stringValue") }
        } catch (e: RuntimeException) { if (e.message?.startsWith("HTTP 404") == true) emptyList() else throw e }
    }

    suspend fun saveFavs(ctx: Context, keys: List<String>) = withContext(Dispatchers.IO) {
        val (uid, t) = token(ctx) ?: return@withContext
        val arr = JSONArray(keys.map { JSONObject().put("stringValue", it) })
        http("$DOCS/users/$uid?updateMask.fieldPaths=favs", "PATCH",
            JSONObject().put("fields", JSONObject().put("favs", JSONObject().put("arrayValue", JSONObject().put("values", arr)))).toString(),
            bearer = t)
    }

    /** Merge the account's favourites with the phone's (account order first) and save both. */
    suspend fun sync(ctx: Context, favs: Favs) {
        val remote = remoteFavs(ctx) ?: return
        val local = favs.all()
        val byKey = local.associateBy { it.key }.toMutableMap()
        // look up stations the phone doesn't have details for yet
        remote.filter { it !in byKey }.groupBy { it.substringBefore(':') }.forEach { (col, keys) ->
            val list = Repo.stations(ctx, col)
            keys.forEach { k -> list.find { it.key == k }?.let { byKey[k] = it } }
        }
        val order = (remote + local.map { it.key }).distinct().mapNotNull { byKey[it] }
        favs.replaceAll(order)
        saveFavs(ctx, (remote + local.map { it.key }).distinct())
    }
}
