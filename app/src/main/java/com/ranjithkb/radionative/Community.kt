package com.ranjithkb.radionative

import android.content.Context
import android.os.Build
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject

private const val BASE = "projects/ranjithkb-radio/databases/(default)/documents"
private fun str(v: String) = JSONObject().put("stringValue", v)
private fun int(v: Long) = JSONObject().put("integerValue", v.toString())
private fun nowTs(field: String) = JSONArray().put(JSONObject().put("fieldPath", field).put("setToServerValue", "REQUEST_TIME"))
/** The limits/{uid} stamp that goes with a write, so the rules can space them out. */
private fun limitStamp(uid: String, field: String) = JSONObject()
    .put("update", JSONObject().put("name", "$BASE/limits/$uid").put("fields", JSONObject()))
    .put("updateMask", JSONObject().put("fieldPaths", JSONArray())).put("updateTransforms", nowTs(field))

/** Listener comments on stations (shared with the website; shown once Ranjith approves them). */
object Comments {
    data class Comment(val stars: Int, val text: String, val at: Long)
    data class Mine(val stars: Int, val text: String, val status: String)

    suspend fun approved(stationKey: String): List<Comment>? = withContext(Dispatchers.IO) {
        try {
            fun eq(f: String, v: String) = JSONObject().put("fieldFilter", JSONObject().put("field", JSONObject().put("fieldPath", f))
                .put("op", "EQUAL").put("value", str(v)))
            val q = JSONObject().put("structuredQuery", JSONObject().put("from", JSONArray().put(JSONObject().put("collectionId", "comments")))
                .put("where", JSONObject().put("compositeFilter", JSONObject().put("op", "AND")
                    .put("filters", JSONArray().put(eq("key", Ratings.keyOf(stationKey))).put(eq("status", "approved"))))))
            val c = java.net.URL("${Account.DOCS}:runQuery?key=${Account.KEY}").openConnection() as java.net.HttpURLConnection
            c.requestMethod = "POST"; c.connectTimeout = 10000; c.readTimeout = 10000; c.doOutput = true
            c.setRequestProperty("Content-Type", "application/json"); c.setRequestProperty("Referer", "https://ranjithkb.com/")
            c.outputStream.use { it.write(q.toString().toByteArray()) }
            parse(JSONArray(c.inputStream.bufferedReader().use { it.readText() }))
        } catch (e: Exception) { null }
    }

    internal fun parse(rows: JSONArray): List<Comment> = (0 until rows.length()).mapNotNull { i ->
        val f = rows.getJSONObject(i).optJSONObject("document")?.optJSONObject("fields") ?: return@mapNotNull null
        val text = f.optJSONObject("text")?.optString("stringValue").orEmpty().trim()
        if (text.isEmpty()) return@mapNotNull null
        val ts = f.optJSONObject("ts")?.optString("timestampValue")?.let { runCatching { java.time.Instant.parse(it).toEpochMilli() }.getOrNull() } ?: 0L
        Comment(f.optJSONObject("stars")?.optString("integerValue")?.toIntOrNull() ?: 0, text, ts)
    }.sortedByDescending { it.at }

    suspend fun mine(ctx: Context, stationKey: String): Mine? = withContext(Dispatchers.IO) {
        try {
            if (!Account.signedIn(ctx) && ctx.getSharedPreferences("anon", Context.MODE_PRIVATE).getString("uid", null) == null) return@withContext null
            val (uid, t) = Ratings.who(ctx)
            val f = Account.http("${Account.DOCS}/comments/${Ratings.keyOf(stationKey)}__$uid", "GET", null, bearer = t).optJSONObject("fields")
                ?: return@withContext null
            Mine(f.optJSONObject("stars")?.optString("integerValue")?.toIntOrNull() ?: 0,
                f.optJSONObject("text")?.optString("stringValue").orEmpty(), f.optJSONObject("status")?.optString("stringValue").orEmpty())
        } catch (e: Exception) { null }
    }

    /** Post (or replace) this listener's comment. Returns null when saved, or a short message. */
    suspend fun post(ctx: Context, stationKey: String, stars: Int, text: String): String? = withContext(Dispatchers.IO) {
        if (stars !in 1..5) return@withContext "Choose 1 to 5 stars first."
        val t = text.trim().take(300)
        try {
            val (uid, tok) = Ratings.who(ctx)
            val key = Ratings.keyOf(stationKey)
            val doc = JSONObject().put("update", JSONObject().put("name", "$BASE/comments/${key}__$uid").put("fields", JSONObject()
                .put("key", str(key)).put("uid", str(uid)).put("stars", int(stars.toLong())).put("text", str(t)).put("status", str("waiting"))))
                .put("updateTransforms", nowTs("ts"))
            Account.http("${Account.DOCS}:commit", "POST", JSONObject().put("writes", JSONArray().put(doc).put(limitStamp(uid, "lastComment"))).toString(), bearer = tok)
            null
        } catch (e: Exception) {
            if (e.message?.contains("403") == true) "Please wait half a minute between comments." else "Couldn't send. Check the internet and try again."
        }
    }
}

/** "Request a station": saved for Ranjith only (requests/{uid}__{time}). */
object Requests {
    suspend fun send(ctx: Context, name: String, place: String, link: String, note: String): String? = withContext(Dispatchers.IO) {
        val n = name.trim()
        if (n.length < 2) return@withContext "Please type the station's name."
        try {
            val (uid, tok) = Ratings.who(ctx)
            val f = JSONObject().put("uid", str(uid)).put("name", str(n.take(80))).put("from", str("app"))
            place.trim().take(80).takeIf { it.isNotEmpty() }?.let { f.put("place", str(it)) }
            link.trim().take(300).takeIf { it.isNotEmpty() }?.let { f.put("link", str(it)) }
            note.trim().take(300).takeIf { it.isNotEmpty() }?.let { f.put("note", str(it)) }
            val doc = JSONObject().put("update", JSONObject().put("name", "$BASE/requests/${uid}__${System.currentTimeMillis()}").put("fields", f))
                .put("updateTransforms", nowTs("ts"))
                .put("currentDocument", JSONObject().put("exists", false))
            Account.http("${Account.DOCS}:commit", "POST", JSONObject().put("writes", JSONArray().put(doc).put(limitStamp(uid, "lastRequest"))).toString(), bearer = tok)
            null
        } catch (e: Exception) {
            if (e.message?.contains("403") == true) "Please wait a minute before sending another." else "Couldn't send. Check the internet and try again."
        }
    }
}

/**
 * Crash reports to Ranjith's own Firebase (crashes/{id}): the error, the app version, the phone model and Android
 * version. No personal data. Saved on the phone when the app crashes and sent the next time it opens.
 */
object Crash {
    private fun p(ctx: Context) = ctx.getSharedPreferences("crash", Context.MODE_PRIVATE)
    @Volatile private var installed = false

    fun install(ctx: Context) {
        if (installed) return; installed = true
        val app = ctx.applicationContext
        val prev = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { t, e ->
            try { record(app, e) } catch (_: Throwable) { }
            prev?.uncaughtException(t, e)
        }
    }

    internal fun summary(e: Throwable): Pair<String, String> {
        val root = generateSequence(e) { it.cause }.last()
        val error = "${root.javaClass.simpleName}: ${root.message ?: ""}".trim().trimEnd(':').take(300)
        val trace = android.util.Log.getStackTraceString(e).lines().take(60).joinToString("\n").take(4000)
        return error to trace
    }

    fun record(ctx: Context, e: Throwable) {
        val (error, trace) = summary(e)
        p(ctx).edit().putString("error", error).putString("trace", trace).putLong("at", System.currentTimeMillis()).commit()
    }

    fun sendSaved(ctx: Context, scope: CoroutineScope) {
        install(ctx)
        val pr = p(ctx); val error = pr.getString("error", null) ?: return
        scope.launch(Dispatchers.IO) {
            try {
                val (uid, tok) = Ratings.who(ctx)
                val f = JSONObject().put("app", str(ctx.getString(R.string.app_name))).put("version", str(appVersion(ctx).take(30)))
                    .put("phone", str("${Build.MANUFACTURER} ${Build.MODEL}".take(80))).put("android", int(Build.VERSION.SDK_INT.toLong()))
                    .put("error", str(error.ifBlank { "Unknown" }.take(300))).put("trace", str(pr.getString("trace", "")!!.take(4000)))
                    .put("at", int(pr.getLong("at", 0)))
                val doc = JSONObject().put("update", JSONObject().put("name", "$BASE/crashes/${uid}__${System.currentTimeMillis()}").put("fields", f))
                    .put("updateTransforms", nowTs("ts"))
                Account.http("${Account.DOCS}:commit", "POST", JSONObject().put("writes", JSONArray().put(doc).put(limitStamp(uid, "lastCrash"))).toString(), bearer = tok)
                pr.edit().clear().apply()
            } catch (e: Exception) {
                // keep it for next time, but give up after a week
                if (System.currentTimeMillis() - pr.getLong("at", 0) > 7 * 86_400_000L) pr.edit().clear().apply()
            }
        }
    }
}

/** Most heard / Top rated: the nightly totals file from the website (js/station-stats.json), kept for 6 hours. */
object Stats {
    data class Data(val week: Map<String, Int>, val ratings: Map<String, Pair<Double, Int>>, val updated: String)
    @Volatile private var mem: Data? = null
    const val MIN_RATINGS = 3

    internal fun parse(j: JSONObject): Data {
        val w = j.optJSONObject("week") ?: JSONObject()
        val r = j.optJSONObject("ratings") ?: JSONObject()
        return Data(w.keys().asSequence().associateWith { w.optInt(it) },
            r.keys().asSequence().mapNotNull { k -> r.optJSONArray(k)?.let { a -> k to (a.optDouble(0) to a.optInt(1)) } }.toMap(),
            j.optString("updated"))
    }

    suspend fun get(ctx: Context): Data? = withContext(Dispatchers.IO) {
        mem?.let { return@withContext it }
        val p = ctx.getSharedPreferences("stats", Context.MODE_PRIVATE)
        val cached = p.getString("json", null)
        if (cached != null && System.currentTimeMillis() - p.getLong("at", 0) < 6 * 3_600_000L) return@withContext parse(JSONObject(cached)).also { mem = it }
        try {
            val c = java.net.URL("https://ranjithkb.com/js/station-stats.json").openConnection() as java.net.HttpURLConnection
            c.connectTimeout = 10000; c.readTimeout = 15000
            val text = c.inputStream.bufferedReader().use { it.readText() }
            p.edit().putString("json", text).putLong("at", System.currentTimeMillis()).apply()
            parse(JSONObject(text)).also { mem = it }
        } catch (e: Exception) { cached?.let { parse(JSONObject(it)) } }
    }

    /** Sort a list. mode: usual · az · heard · rated. Stations with no data keep their usual order after the rest. */
    fun sort(list: List<Station>, mode: String, d: Data?): List<Station> = when (mode) {
        "az" -> list.sortedBy { it.name.trimStart('(', '"', '\'', ' ').lowercase() }
        "heard" -> list.sortedByDescending { d?.week?.get(it.key) ?: 0 }
        "rated" -> list.sortedWith(compareByDescending<Station> { s -> d?.ratings?.get(s.key)?.takeIf { it.second >= MIN_RATINGS }?.first ?: -1.0 }
            .thenByDescending { s -> d?.ratings?.get(s.key)?.second ?: 0 })
        else -> list
    }

    /** "185 hrs this week" (minutes below an hour), or "Still collecting". */
    fun heardLabel(min: Int?): String = when {
        min == null || min <= 0 -> "Still collecting"
        min < 60 -> "$min min this week"
        min < 120 -> "1 hr this week"
        else -> "%,d hrs this week".format(java.util.Locale.UK, min / 60)
    }
    fun ratedLabel(r: Pair<Double, Int>?): String = if (r == null || r.second < MIN_RATINGS) "Not enough ratings yet"
        else "★ " + String.format(java.util.Locale.UK, "%.1f", r.first) + " · ${r.second} ratings"
    /** Top 3 most heard in the list (gold ◆). */
    fun top3(list: List<Station>, d: Data?): Set<String> =
        list.filter { (d?.week?.get(it.key) ?: 0) >= 60 }.sortedByDescending { d?.week?.get(it.key) ?: 0 }.take(3).map { it.key }.toSet()
}

/** Recently played stations (on this phone only), newest first. */
object Recent {
    data class Item(val station: Station, val lang: String, val at: Long)
    private fun p(ctx: Context) = ctx.getSharedPreferences("recentplay", Context.MODE_PRIVATE)

    fun add(ctx: Context, item: androidx.media3.common.MediaItem) {
        val key = item.mediaId.removePrefix("st|"); if (!key.contains(':')) return
        val md = item.mediaMetadata
        val streams = md.extras?.getStringArrayList("streams") ?: return
        val o = JSONObject().put("key", key).put("name", md.extras?.getString("station") ?: md.station?.toString() ?: return)
            .put("lang", md.extras?.getString("lang") ?: "").put("streams", JSONArray(streams)).put("at", System.currentTimeMillis())
        val old = JSONArray(p(ctx).getString("list", "[]"))
        val out = JSONArray().put(o)
        for (i in 0 until old.length()) { val x = old.getJSONObject(i); if (x.optString("key") != key && out.length() < 12) out.put(x) }
        p(ctx).edit().putString("list", out.toString()).apply()
    }

    fun all(ctx: Context): List<Item> = try {
        val a = JSONArray(p(ctx).getString("list", "[]"))
        (0 until a.length()).map { i -> val o = a.getJSONObject(i); val k = o.getString("key")
            Item(Station(k.substringAfter(':'), o.getString("name"), "", o.getJSONArray("streams").let { s -> (0 until s.length()).map { s.getString(it) } },
                col = k.substringBefore(':')), o.optString("lang"), o.optLong("at")) }
    } catch (e: Exception) { emptyList() }

    fun clear(ctx: Context) = p(ctx).edit().remove("list").apply()

    /** "Now", "Today", "Yesterday", or the weekday / date. */
    fun whenLabel(at: Long, now: Long = System.currentTimeMillis()): String {
        val a = java.util.Calendar.getInstance().apply { timeInMillis = at }; val n = java.util.Calendar.getInstance().apply { timeInMillis = now }
        val days = ((n.apply { set(java.util.Calendar.HOUR_OF_DAY, 0); set(java.util.Calendar.MINUTE, 0) }.timeInMillis -
            (a.clone() as java.util.Calendar).apply { set(java.util.Calendar.HOUR_OF_DAY, 0); set(java.util.Calendar.MINUTE, 0) }.timeInMillis) / 86_400_000L).toInt()
        return when {
            now - at < 15 * 60_000 -> "Just now"
            days <= 0 -> "Today"
            days == 1 -> "Yesterday"
            days < 7 -> java.text.SimpleDateFormat("EEE", java.util.Locale.UK).format(java.util.Date(at))
            else -> java.text.SimpleDateFormat("d MMM", java.util.Locale.UK).format(java.util.Date(at))
        }
    }
}
