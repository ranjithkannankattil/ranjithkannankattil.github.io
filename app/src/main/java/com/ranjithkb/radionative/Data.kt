package com.ranjithkb.radionative

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder

/** One language list, e.g. Malayalam (js/collections.js on ranjithkb.com). */
data class Collection(val id: String, val name: String, val native: String, val group: String,
                      val cats: List<Pair<String, String>>)

/** One station (js/stations/<collection>.js). */
data class Station(val id: String, val name: String, val category: String, val streams: List<String>,
                   val col: String, val offline: Boolean = false) {
    val key get() = "$col:$id"
    fun toJson(): JSONObject = JSONObject().put("id", id).put("name", name).put("category", category)
        .put("streams", JSONArray(streams)).put("col", col)
    companion object {
        fun fromJson(o: JSONObject, col: String = o.optString("col")) = Station(
            o.getString("id"), o.getString("name"), o.optString("category"),
            List(o.getJSONArray("streams").length()) { o.getJSONArray("streams").getString(it) },
            col, o.optBoolean("offline") || o.optBoolean("hidden"))
    }
}

/**
 * Station data comes from the website (the same lists the twice-daily check keeps healthy),
 * cached on the phone so the app opens instantly and works on a weak signal.
 */
object Repo {
    private const val SITE = "https://ranjithkb.com"

    private fun fetch(url: String): String {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 10000; c.readTimeout = 15000
        c.setRequestProperty("User-Agent", "RanjithkbRadio-Android"); c.setRequestProperty("Referer", "https://ranjithkb.com/")
        return c.inputStream.bufferedReader().use { it.readText() }
    }

    /** The JSON array assigned in a `window.X = [...]` script. */
    private fun arrayIn(js: String, name: String): JSONArray {
        val start = js.indexOf("window.$name")
        val open = js.indexOf('[', start)
        var depth = 0; var inStr = false; var esc = false
        for (i in open until js.length) {
            val ch = js[i]
            if (inStr) { if (esc) esc = false else if (ch == '\\') esc = true else if (ch == '"') inStr = false; continue }
            when (ch) { '"' -> inStr = true; '[' -> depth++; ']' -> { depth--; if (depth == 0) return JSONArray(js.substring(open, i + 1)) } }
        }
        return JSONArray()
    }

    private suspend fun cached(ctx: Context, name: String, url: String, fresh: Boolean): String? = withContext(Dispatchers.IO) {
        val f = File(ctx.cacheDir, name)
        if (!fresh && f.exists() && System.currentTimeMillis() - f.lastModified() < 6 * 3600_000) return@withContext f.readText()
        try { fetch(url).also { f.writeText(it) } } catch (e: Exception) { if (f.exists()) f.readText() else null }
    }

    suspend fun collections(ctx: Context, fresh: Boolean = false): List<Collection> {
        val js = cached(ctx, "collections.js", "$SITE/js/collections.js?d=${System.currentTimeMillis() / 3600_000}", fresh) ?: return emptyList()
        val a = arrayIn(js, "RADIO_COLLECTIONS")
        return List(a.length()) { i ->
            val o = a.getJSONObject(i)
            val cats = o.optJSONArray("cats") ?: JSONArray()
            Collection(o.getString("id"), o.getString("name"), o.optString("native"), o.optString("group"),
                List(cats.length()) { cats.getJSONArray(it).getString(0) to cats.getJSONArray(it).getString(1) })
        }
    }

    suspend fun stations(ctx: Context, col: String, fresh: Boolean = false): List<Station> {
        val js = cached(ctx, "st-$col.js", "$SITE/js/stations/$col.js?d=${System.currentTimeMillis() / 3600_000}", fresh) ?: return emptyList()
        val a = arrayIn(js, "STATIONS")
        return List(a.length()) { Station.fromJson(a.getJSONObject(it), col) }.filter { it.streams.isNotEmpty() }
    }

    /** "Velvet Selection": the developer's favourite stations, from every language, in his order. */
    suspend fun picks(ctx: Context, fresh: Boolean = false): List<Station> {
        val keys = withContext(Dispatchers.IO) {
            val f = File(ctx.cacheDir, "picks.json")
            val text = if (!fresh && f.exists() && System.currentTimeMillis() - f.lastModified() < 3600_000) f.readText()
                else try { fetch("https://firestore.googleapis.com/v1/projects/ranjithkb-radio/databases/(default)/documents/picks/ranjith?key=AIzaSyDGsaqqamWbS6RCtyU9v54o-oqZqYzdDEo").also { f.writeText(it) } }
                     catch (e: Exception) { if (f.exists()) f.readText() else "{}" }
            val vals = JSONObject(text).optJSONObject("fields")?.optJSONObject("favs")?.optJSONObject("arrayValue")?.optJSONArray("values") ?: JSONArray()
            List(vals.length()) { vals.getJSONObject(it).optString("stringValue") }.filter { ':' in it }
        }
        val found = HashMap<String, Station>()
        keys.groupBy { it.substringBefore(':') }.forEach { (col, ks) ->
            val list = stations(ctx, col); ks.forEach { k -> list.find { it.key == k }?.let { found[k] = it } }
        }
        return keys.mapNotNull { found[it] }
    }

    /** Cover art for "Artist - Title" from Apple's free iTunes search (no key needed). */
    suspend fun artwork(artist: String, title: String): String? = withContext(Dispatchers.IO) {
        try {
            val term = URLEncoder.encode("$artist $title".trim(), "UTF-8")
            val r = JSONObject(fetch("https://itunes.apple.com/search?term=$term&entity=song&limit=1"))
            r.optJSONArray("results")?.optJSONObject(0)?.optString("artworkUrl100")
                ?.takeIf { it.isNotEmpty() }?.replace("100x100bb", "600x600bb")
        } catch (e: Exception) { null }
    }
}

/** Favourites from every language, in the listener's own order (same "<collection>:<id>" keys as the website). */
class Favs(ctx: Context) {
    private val p = ctx.getSharedPreferences("favs", Context.MODE_PRIVATE)
    fun all(): List<Station> {
        val a = JSONArray(p.getString("list", "[]"))
        return List(a.length()) { Station.fromJson(a.getJSONObject(it)) }
    }
    fun keys() = all().map { it.key }.toSet()
    private fun save(l: List<Station>) = p.edit().putString("list", JSONArray(l.map { it.toJson() }).toString()).apply()
    fun toggle(s: Station) { val l = all(); save(if (l.any { it.key == s.key }) l.filter { it.key != s.key } else l + s) }
    fun move(key: String, to: Int) {
        val l = all().toMutableList(); val i = l.indexOfFirst { it.key == key }; if (i < 0) return
        val s = l.removeAt(i); l.add(to.coerceIn(0, l.size), s); save(l)
    }
    fun remove(key: String) = save(all().filter { it.key != key })
    fun replaceAll(l: List<Station>) = save(l)
    fun insert(s: Station, at: Int) { val l = all().filter { it.key != s.key }.toMutableList(); l.add(at.coerceIn(0, l.size), s); save(l) }
}
