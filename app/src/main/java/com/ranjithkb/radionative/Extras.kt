package com.ranjithkb.radionative

import android.content.Context
import android.content.Intent
import android.graphics.*
import android.net.Uri
import androidx.browser.customtabs.CustomTabsIntent
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
        text("on $station", 1190f, 36f, 0xFFC9A86A.toInt(), false)
        text("Radio Velvet · ranjithkb.com/radio", 1290f, 30f, 0x99FFFFFF.toInt(), false)
        val dir = File(ctx.cacheDir, "cards").apply { mkdirs() }
        File(dir, "song-card.png").also { f -> f.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) } }
    }
    val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", file)
    val send = Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri)
        .putExtra(Intent.EXTRA_TEXT, "Listening to $song${if (artist.isNotBlank()) " by $artist" else ""} on $station — Radio Velvet, https://ranjithkb.com/radio.html")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    ctx.startActivity(Intent.createChooser(send, "Share song card"))
}
