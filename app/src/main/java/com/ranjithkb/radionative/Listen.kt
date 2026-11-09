package com.ranjithkb.radionative

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.UUID

/**
 * Listening time. Counted only while a station is actually playing, kept on the phone, and — when
 * signed in — saved per device to the account (users/{uid}.listen.<device>) so the app and the
 * website add up. Separately, whole minutes are added to one anonymous total (stats/listening)
 * that holds nothing but the number.
 */
object Listen {
    private fun p(ctx: Context) = ctx.getSharedPreferences("listen", Context.MODE_PRIVATE)
    private var playingKey: String? = null
    private var playingName = ""
    private var mark = 0L

    fun weekKey(): String { val c = Calendar.getInstance(); return "${c.get(Calendar.YEAR)}-${c.get(Calendar.WEEK_OF_YEAR)}" }
    fun device(ctx: Context): String = p(ctx).getString("device", null)
        ?: ("a" + UUID.randomUUID().toString().replace("-", "").take(12)).also { p(ctx).edit().putString("device", it).apply() }

    fun start(ctx: Context, key: String?, name: String) {
        add(ctx); playingKey = key; playingName = name; mark = System.currentTimeMillis()
    }
    fun stop(ctx: Context) { add(ctx); playingKey = null }
    /** Called every minute while the player runs; saves progress in case the app is closed. */
    suspend fun tick(ctx: Context) { add(ctx); if (playingKey != null) mark = System.currentTimeMillis(); flushGlobal(ctx) }

    private fun add(ctx: Context) {
        val key = playingKey ?: return
        val now = System.currentTimeMillis(); val ms = (now - mark).coerceIn(0, 120_000); mark = now
        if (ms <= 0) return
        val pr = p(ctx); val e = pr.edit()
        e.putLong("total", pr.getLong("total", 0) + ms)
        val wk = weekKey()
        e.putLong("week", (if (pr.getString("weekKey", "") == wk) pr.getLong("week", 0) else 0) + ms).putString("weekKey", wk)
        val top = JSONObject(pr.getString("top", "{}")!!)
        val o = top.optJSONObject(key) ?: JSONObject()
        top.put(key, o.put("n", playingName).put("ms", o.optLong("ms") + ms))
        e.putString("top", top.toString())
        e.putLong("pending", pr.getLong("pending", 0) + ms)
        e.apply()
    }

    data class Totals(val total: Long, val week: Long, val top: List<Pair<String, Long>>)

    fun local(ctx: Context): Totals {
        val pr = p(ctx)
        val week = if (pr.getString("weekKey", "") == weekKey()) pr.getLong("week", 0) else 0
        return Totals(pr.getLong("total", 0), week, topOf(listOf(JSONObject(pr.getString("top", "{}")!!))))
    }

    private fun topOf(maps: List<JSONObject>): List<Pair<String, Long>> {
        val sum = HashMap<String, Pair<String, Long>>()
        maps.forEach { m -> m.keys().forEach { k -> val o = m.optJSONObject(k) ?: return@forEach
            val prev = sum[k]; sum[k] = (o.optString("n").ifBlank { prev?.first ?: k }) to ((prev?.second ?: 0) + o.optLong("ms")) } }
        return sum.values.sortedByDescending { it.second }.take(5)
    }

    // ---- account (per device, so phone + website add up without overwriting each other)
    private fun fv(v: Any): JSONObject = when (v) {
        is Long, is Int -> JSONObject().put("integerValue", v.toString())
        is String -> JSONObject().put("stringValue", v)
        is JSONObject -> JSONObject().put("mapValue", JSONObject().put("fields", JSONObject().apply { v.keys().forEach { put(it, fv(v.get(it))) } }))
        else -> JSONObject().put("stringValue", v.toString())
    }
    private fun plain(f: JSONObject): Any = when {
        f.has("integerValue") -> f.getString("integerValue").toLong()
        f.has("doubleValue") -> f.getDouble("doubleValue").toLong()
        f.has("mapValue") -> JSONObject().apply { val fs = f.getJSONObject("mapValue").optJSONObject("fields") ?: JSONObject()
            fs.keys().forEach { put(it, plain(fs.getJSONObject(it))) } }
        else -> f.optString("stringValue")
    }

    /** Save this device's numbers to the account and return the totals of every device together. */
    suspend fun account(ctx: Context): Totals? = withContext(Dispatchers.IO) {
        try {
            val (uid, t) = Account.token(ctx) ?: return@withContext null
            val pr = p(ctx); val me = device(ctx); val l = local(ctx)
            val mine = JSONObject().put("total", l.total).put("weekKey", weekKey()).put("week", l.week)
                .put("top", JSONObject(pr.getString("top", "{}")!!).let { all -> JSONObject().apply {
                    // keep the 10 biggest stations, enough for the top 5 across devices
                    all.keys().asSequence().sortedByDescending { all.getJSONObject(it).optLong("ms") }.take(10)
                        .forEach { k -> put(k.replace('.', '_'), all.getJSONObject(k)) } } })
            Account.http("${Account.DOCS}/users/$uid?updateMask.fieldPaths=listen.$me", "PATCH",
                JSONObject().put("fields", JSONObject().put("listen", fv(JSONObject().put(me, mine)))).toString(), bearer = t)
            val d = Account.http("${Account.DOCS}/users/$uid", "GET", null, bearer = t)
            val devs = (d.optJSONObject("fields")?.optJSONObject("listen")?.let { plain(it) } as? JSONObject) ?: JSONObject()
            var total = 0L; var week = 0L; val tops = ArrayList<JSONObject>()
            devs.keys().forEach { k -> val o = devs.getJSONObject(k)
                total += o.optLong("total"); if (o.optString("weekKey") == weekKey()) week += o.optLong("week")
                o.optJSONObject("top")?.let { tops.add(it) } }
            Totals(total, week, topOf(tops))
        } catch (e: Exception) { null }
    }

    // ---- everyone's total (anonymous)
    private const val STATS = "projects/ranjithkb-radio/databases/(default)/documents/stats/listening"

    private suspend fun flushGlobal(ctx: Context) = withContext(Dispatchers.IO) {
        val pr = p(ctx); val min = (pr.getLong("pending", 0) / 60_000).toInt()
        if (min < 5) return@withContext
        val n = min.coerceAtMost(30)
        try {
            Account.http("${Account.DOCS}:commit?key=${Account.KEY}", "POST", JSONObject().put("writes", JSONArray().put(JSONObject()
                .put("transform", JSONObject().put("document", STATS).put("fieldTransforms", JSONArray().put(JSONObject()
                    .put("fieldPath", "minutes").put("increment", JSONObject().put("integerValue", n.toString())))))))).toString())
            pr.edit().putLong("pending", pr.getLong("pending", 0) - n * 60_000L).apply()
        } catch (e: Exception) { }
    }

    /** Minutes everyone has listened, or null if it can't be read. */
    suspend fun everyone(): Long? = withContext(Dispatchers.IO) {
        try {
            val c = java.net.URL("https://firestore.googleapis.com/v1/$STATS?key=${Account.KEY}").openConnection() as java.net.HttpURLConnection
            c.setRequestProperty("Referer", "https://ranjithkb.com/"); c.connectTimeout = 8000
            JSONObject(c.inputStream.bufferedReader().use { it.readText() }).optJSONObject("fields")
                ?.optJSONObject("minutes")?.optString("integerValue")?.toLongOrNull()
        } catch (e: Exception) { null }
    }

    fun hm(ms: Long): String { val m = ms / 60_000; return if (m >= 60) "${m / 60} h ${m % 60} min" else "$m min" }
}
