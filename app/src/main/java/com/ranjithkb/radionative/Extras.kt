package com.ranjithkb.radionative

import androidx.compose.ui.graphics.toArgb

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
    // the card in the listener's own look: colour theme (light / dark), font and visualiser, as in the big player
    val pal = Theme.pal; val viz = Theme.viz; val font = Theme.font
    val bands = if (System.currentTimeMillis() - Viz.stamp < 2000) Viz.bands.copyOf() else null
    val file = withContext(Dispatchers.IO) {
        val art = artUrl?.let { try { URL(it).openStream().use(BitmapFactory::decodeStream) } catch (e: Exception) { null } }
        val bmp = drawSongCard(ctx, song, artist, station, art, link, pal, viz, font, bands)
        val dir = File(ctx.cacheDir, "cards").apply { mkdirs() }
        File(dir, "song-card.png").also { f -> f.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) } }
    }
    val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", file)
    val caption = if (song.isBlank() || song == station) "Listening to $station live on Radio Velvet\n$link"
        else "Listening to $song${if (artist.isNotBlank()) " by $artist" else ""} on $station · Radio Velvet\n$link"
    val send = Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri)
        .putExtra(Intent.EXTRA_TEXT, caption).putExtra(Intent.EXTRA_SUBJECT, "Radio Velvet")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        .apply { clipData = android.content.ClipData.newRawUri("card", uri) }
    ctx.startActivity(Intent.createChooser(send, "Share").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
}

/**
 * The share card picture (1080 × 1350): the cover colour of the chosen theme, its gold, the chosen font, and the
 * visualiser style from the big player (with the sound levels of the moment when the radio is playing).
 */
fun drawSongCard(ctx: Context, song: String, artist: String, station: String, art: Bitmap?, link: String,
                 pal: Pal, viz: String, font: String, bands: FloatArray?): Bitmap {
    val w = 1080; val h = 1350
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val cv = Canvas(bmp)
    val bg = pal.artBg
    val darkCard = Palettes.luma(bg) < 0.5f
    val ink = if (darkCard) 0xFFF1E9EE.toInt() else pal.ink.toArgb()
    val soft = if (darkCard) 0xFFC9BBC5.toInt() else pal.soft.toArgb()
    val goldC = if (Palettes.contrast(pal.gold, bg) >= 2.2f) pal.gold else androidx.compose.ui.graphics.Color(ink)
    val gold = goldC.toArgb()
    val vizC = (if (Palettes.contrast(pal.accentText, bg) >= 2f) pal.accentText else androidx.compose.ui.graphics.Color(ink)).toArgb()
    fun alpha(c: Int, a: Int) = (c and 0x00FFFFFF) or (a shl 24)
    cv.drawColor(bg.toArgb())
    val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = alpha(gold, 0x88); style = Paint.Style.STROKE; strokeWidth = 2f }
    cv.drawRect(RectF(48f, 48f, w - 48f, h - 48f), line)

    val band = viz == "bars" || viz == "waves"
    val box = if (band) RectF(270f, 140f, 810f, 680f) else RectF(240f, 170f, 840f, 770f)
    val logo = androidx.core.content.ContextCompat.getDrawable(ctx, R.drawable.ic_logo_mark)?.mutate()
    if (art != null) cv.drawBitmap(art, null, box, Paint(Paint.FILTER_BITMAP_FLAG).apply { if (viz == "circle") alpha = 90 })
    else {
        cv.drawRect(box, line)
        val s = box.width() * 0.42f
        logo?.let { d -> d.setTint(gold); d.setBounds((box.centerX() - s / 2).toInt(), (box.centerY() - s / 2).toInt(),
            (box.centerX() + s / 2).toInt(), (box.centerY() + s / 2).toInt()); d.draw(cv) }
    }
    // the visualiser: the moment's sound levels when playing, otherwise a calm pattern
    val v = bands ?: FloatArray(Viz.N) { i -> (0.3f + 0.4f * (0.5f + 0.5f * kotlin.math.sin(i * 0.55f)) * (0.6f + 0.4f * kotlin.math.cos(i * 0.21f))) * (1f - i / 60f) }
    val vp = Paint(Paint.ANTI_ALIAS_FLAG).apply { strokeCap = Paint.Cap.ROUND }
    when (viz) {
        "bars" -> {
            val r = RectF(box.left, box.bottom + 24f, box.right, box.bottom + 144f); val bw = r.width() / Viz.N
            v.forEachIndexed { i, x -> vp.color = alpha(if (i % 7 == 3) gold else vizC, (140 + 115 * x).toInt().coerceIn(0, 255))
                val bh = r.height() * (0.08f + 0.92f * x)
                cv.drawRect(r.left + i * bw + bw * 0.19f, r.bottom - bh, r.left + i * bw + bw * 0.81f, r.bottom, vp) }
        }
        "waves" -> {
            val r = RectF(box.left, box.bottom + 24f, box.right, box.bottom + 144f)
            listOf(Triple(1f, 0f, vizC), Triple(0.6f, 1.6f, gold)).forEach { (sc, ph, c) ->
                val path = android.graphics.Path()
                for (k in 0..96) { val x = r.left + r.width() * k / 96f; val amp = v[k * (Viz.N - 1) / 96] * r.height() * 0.45f * sc
                    val y = r.centerY() + amp * kotlin.math.sin(k / 96f * 6.2832f * 3 + ph)
                    if (k == 0) path.moveTo(x, y) else path.lineTo(x, y) }
                cv.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = c; style = Paint.Style.STROKE; strokeWidth = if (sc == 1f) 5f else 3f; strokeCap = Paint.Cap.ROUND })
            }
        }
        "circle" -> {
            val cx = box.centerX(); val cy = box.centerY(); val r0 = box.width() * 0.30f; val n = Viz.N * 2
            vp.strokeWidth = 6f
            for (k in 0 until n) { val x = v[k % Viz.N]; val a = k / n.toFloat() * 6.2832f - 1.5708f; val r1 = r0 + x * box.width() * 0.17f
                vp.color = alpha(if (k % 8 == 3) gold else vizC, (128 + 127 * x).toInt().coerceIn(0, 255))
                cv.drawLine(cx + r0 * kotlin.math.cos(a), cy + r0 * kotlin.math.sin(a), cx + r1 * kotlin.math.cos(a), cy + r1 * kotlin.math.sin(a), vp) }
            cv.drawCircle(cx, cy, r0 - 8f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = alpha(gold, 0xB0); style = Paint.Style.STROKE; strokeWidth = 2f })
        }
    }

    val fc = FONTS.firstOrNull { it.id == font } ?: FONTS[0]
    fun face(light: Boolean): Typeface? = try {
        fc.res?.let { r -> androidx.core.content.res.ResourcesCompat.getFont(ctx, if (light) r[0] else r[2]) }
            ?: Typeface.create(Typeface.SANS_SERIF, if (light) Typeface.NORMAL else Typeface.BOLD)
    } catch (e: Exception) { null }
    val light = face(true); val med = face(false)
    val grow = fc.scale
    fun paint(size: Float, color: Int, tf: Typeface?, spacing: Float = 0f) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color; textSize = size * grow; textAlign = Paint.Align.CENTER; typeface = tf ?: Typeface.SANS_SERIF; letterSpacing = spacing }
    fun text(s: String, y: Float, p: Paint) {
        var t = s; while (p.measureText(t) > 880 && t.length > 4) t = t.dropLast(2)
        if (t != s) t = t.trimEnd() + "…"
        cv.drawText(t, 540f, y, p)
    }
    val hasSong = song.isNotBlank() && song != station
    var y = if (band) 920f else 900f
    if (hasSong) { text("ON " + station.uppercase(), y, paint(30f, gold, med, 0.18f)); y += 88f }
    // title wraps onto a second line instead of being cut short
    val tp = paint(64f, ink, light)
    val title = if (hasSong) song else station
    val words = title.split(' '); var l1 = ""; var cut = words.size
    for ((k, wd) in words.withIndex()) { val t = if (l1.isEmpty()) wd else "$l1 $wd"; if (tp.measureText(t) > 880 && l1.isNotEmpty()) { cut = k; break }; l1 = t }
    text(l1, y, tp); val l2 = words.drop(cut).joinToString(" ")
    if (l2.isNotBlank()) { y += 74f; text(l2, y, tp) }
    val second = if (hasSong) artist else "Live radio"
    if (second.isNotBlank()) { y += 66f; text(second, y, paint(38f, soft, light)) }
    text("RADIO VELVET", 1222f, paint(30f, gold, med, 0.32f))
    text(link.removePrefix("https://"), 1270f, paint(25f, alpha(ink, 0x99), light))
    return bmp
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
