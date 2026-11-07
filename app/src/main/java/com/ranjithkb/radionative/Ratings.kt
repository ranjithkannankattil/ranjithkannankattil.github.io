package com.ranjithkb.radionative

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

/**
 * Station ratings, shared with the Radio page on ranjithkb.com (ratings/{collection~station}/votes/{uid}).
 * Anyone can rate without signing in: like the website, the app gets an anonymous ID the first time.
 * When signed in with Google, the Google account rates instead. Average shown from 3 ratings up.
 */
object Ratings {
    private const val MIN_FOR_AVG = 3
    fun keyOf(stationKey: String) = stationKey.replaceFirst(':', '~')

    data class Summary(val count: Int, val avg: Double?)

    private fun prefs(ctx: Context) = ctx.getSharedPreferences("anon", Context.MODE_PRIVATE)

    /** Signed-in account if there is one, otherwise an anonymous one (created once, kept on the phone). */
    private fun who(ctx: Context): Pair<String, String> {
        Account.token(ctx)?.let { return it }
        val p = prefs(ctx)
        val uid = p.getString("uid", null)
        if (uid != null && System.currentTimeMillis() < p.getLong("exp", 0)) return uid to p.getString("token", "")!!
        val r = if (uid == null) Account.http("https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${Account.KEY}", "POST",
                JSONObject().put("returnSecureToken", true).toString())
            else Account.http("https://securetoken.googleapis.com/v1/token?key=${Account.KEY}", "POST",
                "grant_type=refresh_token&refresh_token=" + java.net.URLEncoder.encode(p.getString("refresh", ""), "UTF-8"),
                "application/x-www-form-urlencoded")
        val id = r.optString("localId").ifEmpty { r.optString("user_id") }.ifEmpty { uid!! }
        val tok = r.optString("idToken").ifEmpty { r.getString("id_token") }
        val ref = r.optString("refreshToken").ifEmpty { r.getString("refresh_token") }
        val exp = (r.optString("expiresIn").ifEmpty { r.optString("expires_in", "3600") }).toLong()
        p.edit().putString("uid", id).putString("token", tok).putString("refresh", ref)
            .putLong("exp", System.currentTimeMillis() + exp * 1000 - 60_000).apply()
        return id to tok
    }

    /** Number of ratings and the average (null below 3 ratings). Anyone can read these. */
    suspend fun summary(stationKey: String): Summary? = withContext(Dispatchers.IO) {
        try {
            val q = JSONObject().put("structuredAggregationQuery", JSONObject()
                .put("structuredQuery", JSONObject().put("from", JSONArray().put(JSONObject().put("collectionId", "votes"))))
                .put("aggregations", JSONArray()
                    .put(JSONObject().put("alias", "n").put("count", JSONObject()))
                    .put(JSONObject().put("alias", "avg").put("avg", JSONObject().put("field", JSONObject().put("fieldPath", "stars"))))))
            val url = "${Account.DOCS}/ratings/${keyOf(stationKey)}:runAggregationQuery?key=${Account.KEY}"
            val c = java.net.URL(url).openConnection() as java.net.HttpURLConnection
            c.requestMethod = "POST"; c.connectTimeout = 10000; c.readTimeout = 10000; c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("Referer", "https://ranjithkb.com/")
            c.outputStream.use { it.write(q.toString().toByteArray()) }
            val a = JSONArray(c.inputStream.bufferedReader().use { it.readText() })
            val f = a.getJSONObject(0).getJSONObject("result").getJSONObject("aggregateFields")
            val n = f.getJSONObject("n").optString("integerValue", "0").toInt()
            val avg = f.optJSONObject("avg")?.let { if (it.has("doubleValue")) it.getDouble("doubleValue") else it.optString("integerValue").toDoubleOrNull() }
            Summary(n, if (n >= MIN_FOR_AVG) avg else null)
        } catch (e: Exception) { null }
    }

    /** The stars this listener gave the station, if any (only when they already have an ID). */
    suspend fun mine(ctx: Context, stationKey: String): Int? = withContext(Dispatchers.IO) {
        try {
            if (!Account.signedIn(ctx) && prefs(ctx).getString("uid", null) == null) return@withContext null
            val (uid, t) = who(ctx)
            Account.http("${Account.DOCS}/ratings/${keyOf(stationKey)}/votes/$uid", "GET", null, bearer = t)
                .optJSONObject("fields")?.optJSONObject("stars")?.optString("integerValue")?.toIntOrNull()
        } catch (e: Exception) { null }
    }

    /** Rate 1-5. Returns null when saved, or a short message. One rating every 12 seconds, like the website. */
    suspend fun rate(ctx: Context, stationKey: String, stars: Int): String? = withContext(Dispatchers.IO) {
        try {
            val (uid, t) = who(ctx)
            val base = "projects/ranjithkb-radio/databases/(default)/documents"
            val now = JSONArray().put(JSONObject().put("fieldPath", "ts").put("setToServerValue", "REQUEST_TIME"))
            val writes = JSONArray()
                .put(JSONObject().put("update", JSONObject().put("name", "$base/ratings/${keyOf(stationKey)}/votes/$uid")
                    .put("fields", JSONObject().put("stars", JSONObject().put("integerValue", stars.toString()))))
                    .put("updateTransforms", now))
                .put(JSONObject().put("update", JSONObject().put("name", "$base/limits/$uid").put("fields", JSONObject()))
                    .put("updateMask", JSONObject().put("fieldPaths", JSONArray()))
                    .put("updateTransforms", JSONArray().put(JSONObject().put("fieldPath", "last").put("setToServerValue", "REQUEST_TIME"))))
            Account.http("${Account.DOCS}:commit", "POST", JSONObject().put("writes", writes).toString(), bearer = t)
            null
        } catch (e: Exception) {
            if (e.message?.contains("403") == true) "Please wait a few seconds between ratings." else "Couldn't save your rating. Check the internet and try again."
        }
    }
}
