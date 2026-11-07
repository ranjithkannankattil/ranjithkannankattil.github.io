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
suspend fun shareSongCard(ctx: Context, song: String, artist: String, station: String, artUrl: String?) {
    val file = withContext(Dispatchers.IO) {
        val w = 1080; val h = 1350
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val cv = Canvas(bmp)
        cv.drawPaint(Paint().apply { shader = LinearGradient(0f, 0f, 0f, h.toFloat(), 0xFF5B2350.toInt(), 0xFF1E0B19.toInt(), Shader.TileMode.CLAMP) })
        val art = artUrl?.let { try { URL(it).openStream().use(BitmapFactory::decodeStream) } catch (e: Exception) { null } }
        val box = RectF(140f, 150f, 940f, 950f)
        if (art != null) {
            val path = Path().apply { addRoundRect(box, 36f, 36f, Path.Direction.CW) }
            cv.save(); cv.clipPath(path); cv.drawBitmap(art, null, box, Paint(Paint.FILTER_BITMAP_FLAG)); cv.restore()
        } else {
            cv.drawRoundRect(box, 36f, 36f, Paint().apply { color = 0x22FFFFFF })
            val wave = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFE8D9C5.toInt(); style = Paint.Style.STROKE; strokeWidth = 18f; strokeCap = Paint.Cap.ROUND }
            for (r in listOf(110f, 200f)) { cv.drawArc(RectF(540 - r, 550 - r, 540 + r, 550 + r), 135f, 90f, false, wave); cv.drawArc(RectF(540 - r, 550 - r, 540 + r, 550 + r), -45f, 90f, false, wave) }
            cv.drawCircle(540f, 550f, 34f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFC9A86A.toInt() })
        }
        fun text(s: String, y: Float, size: Float, color: Int, bold: Boolean) {
            val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; textSize = size; textAlign = Paint.Align.CENTER
                typeface = Typeface.create(Typeface.SANS_SERIF, if (bold) Typeface.BOLD else Typeface.NORMAL) }
            var t = s; while (p.measureText(t) > 900 && t.length > 4) t = t.dropLast(2)
            if (t != s) t = t.trimEnd() + "…"
            cv.drawText(t, 540f, y, p)
        }
        text(song, 1060f, 60f, 0xFFFFFFFF.toInt(), true)
        if (artist.isNotBlank()) text(artist, 1130f, 42f, 0xFFE8D9C5.toInt(), false)
        if (song != station) text("on $station", 1190f, 36f, 0xFFC9A86A.toInt(), false)
        text("Radio Velvet · ranjithkb.com/radio", 1290f, 30f, 0x99FFFFFF.toInt(), false)
        val dir = File(ctx.cacheDir, "cards").apply { mkdirs() }
        File(dir, "song-card.png").also { f -> f.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) } }
    }
    val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", file)
    val send = Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri)
        .putExtra(Intent.EXTRA_TEXT, if (song == station) "Listening to $station live on Radio Velvet, https://ranjithkb.com/radio.html"
            else "Listening to $song${if (artist.isNotBlank()) " by $artist" else ""} on $station — Radio Velvet, https://ranjithkb.com/radio.html")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    ctx.startActivity(Intent.createChooser(send, "Share song card"))
}

/** Find the song that's playing in Spotify: the app if installed, otherwise Spotify on the web. */
fun openInSpotify(ctx: Context, song: String, artist: String) {
    val q = (song + " " + artist.substringBefore(',').substringBefore(" · ")).trim()
    val app = Intent(Intent.ACTION_VIEW, Uri.parse("spotify:search:" + Uri.encode(q))).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try { ctx.startActivity(app) }
    catch (e: Exception) { openUrl(ctx, "https://open.spotify.com/search/" + Uri.encode(q)) }
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
