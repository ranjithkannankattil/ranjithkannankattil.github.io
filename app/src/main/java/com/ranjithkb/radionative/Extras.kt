package com.ranjithkb.radionative

import android.content.Context
import android.content.Intent
import android.graphics.*
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

fun openUrl(ctx: Context, url: String) {
    try { CustomTabsIntent.Builder().setShowTitle(true).build().launchUrl(ctx, Uri.parse(url)) }
    catch (e: Exception) { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

fun appVersion(ctx: Context): String =
    try { ctx.packageManager.getPackageInfo(ctx.packageName, 0).versionName ?: "" } catch (e: Exception) { "" }

data class Update(val version: String, val notes: List<String>, val url: String)

/** Newer Radio app release on GitHub (tags radio-app-v<version>), if there is one. */
suspend fun checkUpdate(ctx: Context): Update? = withContext(Dispatchers.IO) {
    if (!BuildConfig.SELF_UPDATE) return@withContext null      // Play version: Play updates it
    try {
        val c = URL("https://api.github.com/repos/ranjithkannankattil/ranjithkannankattil.github.io/releases?per_page=20").openConnection() as HttpURLConnection
        c.setRequestProperty("Accept", "application/vnd.github+json"); c.connectTimeout = 10000
        val a = JSONArray(c.inputStream.bufferedReader().use { it.readText() })
        val rel = (0 until a.length()).map { a.getJSONObject(it) }
            .filter { it.getString("tag_name").startsWith("radio-app-v") && !it.optBoolean("draft") && !it.optBoolean("prerelease") }
            .maxByOrNull { it.getString("published_at") } ?: return@withContext null
        val v = rel.getString("tag_name").removePrefix("radio-app-v")
        if (!newer(v, appVersion(ctx))) return@withContext null
        val notes = rel.optString("body").lines().filter { it.trimStart().startsWith("- ") }.map { it.trim().removePrefix("- ") }
        Update(v, notes, "https://github.com/ranjithkannankattil/ranjithkannankattil.github.io/releases/latest/download/Radio.apk")
    } catch (e: Exception) { null }
}

private fun newer(a: String, b: String): Boolean {
    val x = a.split('.').map { it.toIntOrNull() ?: 0 }; val y = b.split('.').map { it.toIntOrNull() ?: 0 }
    for (i in 0 until 3) { val d = x.getOrElse(i) { 0 } - y.getOrElse(i) { 0 }; if (d != 0) return d > 0 }
    return false
}

/** A shareable picture of the song that's playing: cover, song, artist, station, app name. */
suspend fun shareSongCard(ctx: Context, song: String, artist: String, station: String, artUrl: String?, link: String = "https://ranjithkb.com/radio.html") {
    // Velvet card in the app's look: gold frame, the logo, the cover (when there is one), Jost; the station link goes with it as text
    val file = withContext(Dispatchers.IO) {
        val w = 1080; val h = 1350
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val cv = Canvas(bmp)
        val gold = 0xFFC9A86A.toInt()
        cv.drawColor(0xFF2A1424.toInt())
        cv.drawRect(RectF(48f, 48f, w - 48f, h - 48f), Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x88C9A86A.toInt(); style = Paint.Style.STROKE; strokeWidth = 2f })
        val art = artUrl?.let { try { URL(it).openStream().use(BitmapFactory::decodeStream) } catch (e: Exception) { null } }
        val box = RectF(240f, 200f, 840f, 800f)
        if (art != null) cv.drawBitmap(art, null, box, Paint(Paint.FILTER_BITMAP_FLAG))
        else {
            cv.drawRect(box, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x88C9A86A.toInt(); style = Paint.Style.STROKE; strokeWidth = 2f })
            androidx.core.content.ContextCompat.getDrawable(ctx, R.drawable.ic_logo_mark)?.mutate()?.let { d ->
                d.setTint(gold); d.setBounds(390, 350, 690, 650); d.draw(cv) }
        }
        val light = try { androidx.core.content.res.ResourcesCompat.getFont(ctx, R.font.jost_light) } catch (e: Exception) { null }
        val med = try { androidx.core.content.res.ResourcesCompat.getFont(ctx, R.font.jost_medium) } catch (e: Exception) { null }
        fun paint(size: Float, color: Int, tf: Typeface?, spacing: Float = 0f) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color; textSize = size; textAlign = Paint.Align.CENTER; typeface = tf ?: Typeface.SANS_SERIF; letterSpacing = spacing }
        fun text(s: String, y: Float, p: Paint) {
            var t = s; while (p.measureText(t) > 880 && t.length > 4) t = t.dropLast(2)
            if (t != s) t = t.trimEnd() + "…"
            cv.drawText(t, 540f, y, p)
        }
        val hasSong = song.isNotBlank() && song != station
        var y = 900f
        if (hasSong) { text("ON " + station.uppercase(), y, paint(30f, gold, med, 0.18f)); y += 90f }
        // title wraps onto a second line instead of being cut short
        val tp = paint(66f, 0xFFF1E9EE.toInt(), light)
        val title = if (hasSong) song else station
        val words = title.split(' '); var l1 = ""; var cut = words.size
        for ((k, wd) in words.withIndex()) { val t = if (l1.isEmpty()) wd else "$l1 $wd"; if (tp.measureText(t) > 880 && l1.isNotEmpty()) { cut = k; break }; l1 = t }
        text(l1, y, tp); val l2 = words.drop(cut).joinToString(" ")
        if (l2.isNotBlank()) { y += 78f; text(l2, y, tp) }
        val second = if (hasSong) artist else "Live radio"
        if (second.isNotBlank()) { y += 70f; text(second, y, paint(40f, 0xFFB9A8B4.toInt(), light)) }
        text("RADIO VELVET", 1215f, paint(30f, gold, med, 0.32f))
        text(link.removePrefix("https://"), 1265f, paint(26f, 0x99F1E9EE.toInt(), light))
        val dir = File(ctx.cacheDir, "cards").apply { mkdirs() }
        File(dir, "song-card.png").also { f -> f.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) } }
    }
    val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", file)
    val caption = if (song.isBlank() || song == station) "Listening to $station live on Radio Velvet\n$link"
        else "Listening to $song${if (artist.isNotBlank()) " by $artist" else ""} on $station · Radio Velvet\n$link"
    val send = Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri)
        .putExtra(Intent.EXTRA_TEXT, caption).putExtra(Intent.EXTRA_SUBJECT, "Radio Velvet")
        .setClipData(android.content.ClipData.newRawUri("card", uri))
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    ctx.startActivity(Intent.createChooser(send, "Share").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
}

/** Link that opens this station on the Radio page (same format the website shares). */
fun stationLink(stationKey: String) =
    "https://ranjithkb.com/radio.html?c=${stationKey.substringBefore(':')}&s=${Uri.encode(stationKey.substringAfter(':'))}"

fun shareTextOnly(ctx: Context, text: String) {
    ctx.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), "Share")
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
}

fun copyText(ctx: Context, text: String) {
    val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
    cm.setPrimaryClip(android.content.ClipData.newPlainText("Radio Velvet", text))
    if (android.os.Build.VERSION.SDK_INT < 33) android.widget.Toast.makeText(ctx, "Copied", android.widget.Toast.LENGTH_SHORT).show()
}

/**
 * Open the song that's playing in Spotify. The exact song when it can be found (iTunes gives the
 * song's ID, song.link turns it into the Spotify link; neither needs a key), otherwise Spotify search.
 * The Spotify app opens if it's installed, otherwise Spotify on the web.
 */
suspend fun openInSpotify(ctx: Context, song: String, artist: String) {
    val q = (song + " " + artist.substringBefore(',').substringBefore(" · ")).trim()
    val exact = withContext(Dispatchers.IO) {
        try {
            fun get(u: String) = (URL(u).openConnection() as HttpURLConnection).run {
                connectTimeout = 6000; readTimeout = 8000; setRequestProperty("User-Agent", "RadioVelvet-Android")
                inputStream.bufferedReader().use { it.readText() } }
            val track = org.json.JSONObject(get("https://itunes.apple.com/search?entity=song&limit=1&term=" + Uri.encode(q)))
                .optJSONArray("results")?.optJSONObject(0)?.optString("trackViewUrl")?.takeIf { it.isNotEmpty() }
                ?: return@withContext null
            org.json.JSONObject(get("https://api.song.link/v1-alpha.1/links?url=" + Uri.encode(track)))
                .optJSONObject("linksByPlatform")?.optJSONObject("spotify")?.optString("url")?.takeIf { it.isNotEmpty() }
        } catch (e: Exception) { null }
    }
    val link = exact ?: ("https://open.spotify.com/search/" + Uri.encode(q))
    // open.spotify.com links open in the Spotify app when it's installed
    try { ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(link)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    catch (e: Exception) { openUrl(ctx, link) }
}

/**
 * Sleep timer for the whole app: lives as long as the radio is playing (not tied to a screen),
 * so it still stops the radio with the app closed. The player service fills in [pause].
 */
object SleepTimer {
    var at by androidx.compose.runtime.mutableLongStateOf(0L)
    var pause: (() -> Unit)? = null
    private val scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + Dispatchers.Main)
    private var job: kotlinx.coroutines.Job? = null
    fun set(minutes: Int) {
        job?.cancel(); at = System.currentTimeMillis() + minutes * 60_000L
        job = scope.launch { kotlinx.coroutines.delay(minutes * 60_000L); pause?.invoke(); at = 0 }
    }
    fun off() { job?.cancel(); at = 0 }
}

/** Download progress of an app update: null = idle, 0..100 = downloading, -1 = failed. */
object Updater {
    var progress by androidx.compose.runtime.mutableStateOf<Int?>(null)

    /** Download the new APK inside the app (no browser), then hand it to Android's installer. */
    suspend fun install(ctx: Context, url: String) {
        // Android asks once to allow installs from this app; open that setting if needed
        if (android.os.Build.VERSION.SDK_INT >= 26 && !ctx.packageManager.canRequestPackageInstalls()) {
            ctx.startActivity(Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + ctx.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            android.widget.Toast.makeText(ctx, "Allow installs from Radio Velvet, then come back and tap Update again",
                android.widget.Toast.LENGTH_LONG).show()
            return
        }
        progress = 0
        val file = withContext(Dispatchers.IO) {
            try {
                var link = url; var c: HttpURLConnection
                var hops = 0
                while (true) {          // follow GitHub's redirects to its download server
                    c = URL(link).openConnection() as HttpURLConnection
                    c.instanceFollowRedirects = false; c.connectTimeout = 15000; c.readTimeout = 30000
                    c.setRequestProperty("User-Agent", "RadioVelvet-Android")
                    if (c.responseCode in 300..399 && hops++ < 6) { link = c.getHeaderField("Location"); c.disconnect(); continue }
                    break
                }
                if (c.responseCode != 200) throw RuntimeException("HTTP ${c.responseCode}")
                val total = c.contentLengthLong
                val dir = File(ctx.cacheDir, "updates").apply { mkdirs() }
                val f = File(dir, "Radio-Velvet.apk")
                c.inputStream.use { inp -> f.outputStream().use { out ->
                    val buf = ByteArray(64 * 1024); var done = 0L; var n: Int
                    while (inp.read(buf).also { n = it } > 0) {
                        out.write(buf, 0, n); done += n
                        if (total > 0) withContext(Dispatchers.Main) { progress = (done * 100 / total).toInt() }
                    }
                } }
                f
            } catch (e: Exception) { null }
        }
        if (file == null) { progress = -1; return }
        progress = null
        val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", file)
        ctx.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
