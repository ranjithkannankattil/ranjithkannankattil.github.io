package com.ranjithkb.radionative

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.compose.ui.graphics.toArgb
import org.json.JSONObject
import java.io.File
import java.net.URL

/**
 * Station pictures for the Android Auto screen only (car tiles and the car's now-playing screen):
 * the station's own logo, unchanged, inside a Velvet frame, or, without a logo, a two-letter Radio Velvet badge.
 * The phone's own screens ignore these pictures (see [isStationArt]); the lock screen may show them too.
 * Logos come from js/station-logos.json on the website (collected by a weekly GitHub job).
 */
object CarArt {
    @Volatile var authority: String? = null
    fun init(ctx: Context) { authority = ctx.packageName + ".carart" }

    /** content://…carart/st/<collection:station>?n=<name> (Android Auto only loads pictures from content:// addresses). */
    fun uriFor(key: String, name: String): Uri? = authority?.let {
        Uri.Builder().scheme("content").authority(it).appendPath("st").appendPath(key).appendQueryParameter("n", name).build() }

    fun isStationArt(u: String?) = u != null && u.startsWith("content://") && u.contains(".carart/")

    /** Two letters for the badge: the first letters of the first two words ("Radio Mango" → RM), or of one word ("Hit 96.7" → HI). */
    fun letters(name: String): String {
        val clean = name.replace(Regex("\\(.*?\\)"), " ")
        val words = clean.split(Regex("[\\s\\-–—_/|·.,:]+")).filter { w -> w.isNotEmpty() && w[0].isLetter() && !w.equals("the", true) }
        val s = when {
            words.size >= 2 -> "${words[0].first()}${words[1].first()}"
            words.size == 1 -> words[0].filter { it.isLetter() }.take(2)
            else -> clean.filter { it.isLetterOrDigit() }.take(2)
        }
        return s.uppercase().ifEmpty { "RV" }
    }

    /** "94.3" when the name has a frequency, for the small gold line under the letters. */
    fun frequency(name: String): String? = Regex("\\b(\\d{2,3}[.,]\\d)\\b").find(name)?.groupValues?.get(1)

    // ---- logos list (cached for a day)
    @Volatile private var logos: Map<String, String>? = null
    @Volatile private var loadedAt = 0L
    fun logoUrl(ctx: Context, key: String): String? {
        val now = System.currentTimeMillis()
        if (logos == null || now - loadedAt > 86_400_000L) {
            val f = File(ctx.cacheDir, "station-logos.json")
            val text = try {
                if (f.exists() && now - f.lastModified() < 86_400_000L) f.readText()
                else (URL("https://ranjithkb.com/js/station-logos.json").openConnection().apply { connectTimeout = 8000; readTimeout = 15000 })
                    .getInputStream().bufferedReader().use { it.readText() }.also { f.writeText(it) }
            } catch (e: Exception) { if (f.exists()) f.readText() else null }
            logos = text?.let { t -> runCatching { JSONObject(t).optJSONObject("logos")?.let { o -> o.keys().asSequence().associateWith { o.getString(it) } } }.getOrNull() }
                ?: emptyMap()
            loadedAt = now
        }
        return logos?.get(key)
    }

    /** Draw the 512 × 512 picture: the theme's cover colour, a thin gold line, then the logo on white, or the badge. */
    fun draw(ctx: Context, name: String, logo: Bitmap?, pal: Pal): Bitmap {
        val n = 512
        val b = Bitmap.createBitmap(n, n, Bitmap.Config.ARGB_8888)
        val c = Canvas(b)
        val bg = pal.artBg
        c.drawColor(bg.toArgb())
        val gold = (if (Palettes.contrast(pal.gold, bg) >= 2.2f) pal.gold else pal.barInk).toArgb()
        c.drawRect(RectF(26f, 26f, n - 26f, n - 26f), Paint(Paint.ANTI_ALIAS_FLAG).apply { color = gold; style = Paint.Style.STROKE; strokeWidth = 2.5f })
        if (logo != null) {
            val inner = RectF(52f, 52f, n - 52f, n - 52f)
            c.drawRect(inner, Paint().apply { color = android.graphics.Color.WHITE })
            val pad = inner.width() * 0.05f
            val w = inner.width() - 2 * pad; val s = minOf(w / logo.width, w / logo.height)
            val dw = logo.width * s; val dh = logo.height * s
            c.drawBitmap(logo, null, RectF(inner.centerX() - dw / 2, inner.centerY() - dh / 2, inner.centerX() + dw / 2, inner.centerY() + dh / 2),
                Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
        } else {
            val ink = if (Palettes.luma(bg) < 0.5f) 0xFFF1E9EE.toInt() else pal.ink.toArgb()
            val font = try { androidx.core.content.res.ResourcesCompat.getFont(ctx, R.font.jost_regular) } catch (e: Exception) { null }
            val med = try { androidx.core.content.res.ResourcesCompat.getFont(ctx, R.font.jost_medium) } catch (e: Exception) { null }
            val freq = frequency(name)
            val p = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ink; textSize = 200f; textAlign = Paint.Align.CENTER; typeface = font; letterSpacing = 0.06f }
            val y = if (freq != null) 300f else 326f
            c.drawText(letters(name), n / 2f, y, p)
            if (freq != null) c.drawText(freq, n / 2f, 392f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = gold; textSize = 40f; textAlign = Paint.Align.CENTER; typeface = med; letterSpacing = 0.3f })
        }
        return b
    }
}

/** Hands Android Auto the station pictures (read-only; only pictures this app draws). */
class CarArtProvider : ContentProvider() {
    override fun onCreate(): Boolean { context?.let { CarArt.init(it) }; return true }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor? {
        if (mode != "r") return null
        val ctx = context ?: return null
        val seg = uri.pathSegments
        if (seg.size != 2 || seg[0] != "st") return null
        val key = seg[1].take(160)
        val name = uri.getQueryParameter("n")?.take(120) ?: key.substringAfter(':')
        Theme.load(ctx)
        val pal = Palettes.of(Theme.themeId, false)
        val logoUrl = CarArt.logoUrl(ctx, key)
        val dir = File(ctx.cacheDir, "carart").apply { mkdirs() }
        val file = File(dir, "${(key + "|" + name + "|" + Theme.themeId + "|" + logoUrl).hashCode().toUInt()}.png")
        if (!file.exists() || file.length() == 0L) {
            val logo = logoUrl?.let { u -> try { URL(u).openStream().use(BitmapFactory::decodeStream) } catch (e: Exception) { null } }
            val bmp = CarArt.draw(ctx, name, logo, pal)
            val tmp = File(dir, file.name + ".tmp")
            tmp.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
            tmp.renameTo(file)
            trim(dir)
        }
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
    }

    /** Keep at most 800 pictures (about one per station in the car lists looked at), dropping the oldest. */
    private fun trim(dir: File) {
        val files = dir.listFiles { f -> f.name.endsWith(".png") } ?: return
        if (files.size <= 800) return
        files.sortedBy { it.lastModified() }.take(files.size - 700).forEach { it.delete() }
    }

    override fun getType(uri: Uri) = "image/png"
    override fun query(uri: Uri, p: Array<out String>?, s: String?, a: Array<out String>?, o: String?): Cursor? = null
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, s: String?, a: Array<out String>?) = 0
    override fun update(uri: Uri, v: ContentValues?, s: String?, a: Array<out String>?) = 0
}
