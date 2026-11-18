package com.ranjithkb.radionative

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight

/** One colour theme as designed (light version). The dark version is worked out from it. */
data class ThemeDef(val id: String, val name: String, val ml: String, val en: String, val group: String,
                    val bg: Long, val ink: Long, val soft: Long, val accent: Long, val bar: Long, val barInk: Long, val hi: Long)

/** Swiping through the themes in order, round and round. */
object ThemeSwipe {
    fun step(id: String, dir: Int): String {
        val i = THEMES.indexOfFirst { it.id == id }.coerceAtLeast(0)
        return THEMES[((i + dir) % THEMES.size + THEMES.size) % THEMES.size].id
    }
}

val THEMES = listOf(
    ThemeDef("velvet", "Velvet", "", "Velvet", "Elegant", 0xFFF0EDE6, 0xFF2A1424, 0xFF6A6266, 0xFF6B2D5C, 0xFF2A1424, 0xFFF1E9EE, 0xFFC9A86A),
    ThemeDef("nilavu", "Nilavu", "നിലാവ്", "Moonlight", "Elegant", 0xFFEEF0F4, 0xFF14203A, 0xFF5E6577, 0xFF2B4C8C, 0xFF14203A, 0xFFEEF0F4, 0xFFD8C29A),
    ThemeDef("kaavu", "Kaavu", "കാവ്", "Sacred grove", "Elegant", 0xFFEEF2EC, 0xFF12321F, 0xFF5B6A60, 0xFF1F6B45, 0xFF12321F, 0xFFEEF2EC, 0xFFC9A86A),
    ThemeDef("mashi", "Mashi", "മഷി", "Ink", "Elegant", 0xFFF5F3EE, 0xFF111111, 0xFF5F5F5F, 0xFF111111, 0xFF111111, 0xFFF5F3EE, 0xFFC9A86A),
    ThemeDef("kasavu", "Kasavu", "കസവ്", "Golden border", "Elegant", 0xFFFBF7EC, 0xFF3A2E1A, 0xFF6E6452, 0xFF9A6B16, 0xFFFBF7EC, 0xFF3A2E1A, 0xFFC99A2E),
    ThemeDef("manju", "Manju", "മഞ്ഞ്", "Mist", "Subtle", 0xFFF1F3F4, 0xFF2E3A40, 0xFF6B767B, 0xFF5D7480, 0xFFDDE3E6, 0xFF2E3A40, 0xFF8FA6B2),
    ThemeDef("chandanam", "Chandanam", "ചന്ദനം", "Sandalwood", "Subtle", 0xFFF6F0E7, 0xFF3E3226, 0xFF7A6D5E, 0xFF9C7A57, 0xFFE9DDCC, 0xFF3E3226, 0xFFB89470),
    ThemeDef("aambal", "Aambal", "ആമ്പൽ", "Water lily", "Subtle", 0xFFF7F1F3, 0xFF3D2A33, 0xFF7A6A71, 0xFFA0687F, 0xFFEBDDE3, 0xFF3D2A33, 0xFFC79AAE),
    ThemeDef("kaayal", "Kaayal", "കായൽ", "Backwaters", "Subtle", 0xFFEFF4F2, 0xFF22372F, 0xFF66776F, 0xFF4F7F6E, 0xFFDCE7E2, 0xFF22372F, 0xFF86A99B),
    ThemeDef("mazha", "Mazha", "മഴ", "Rain", "Subtle", 0xFFF0F1F3, 0xFF262B33, 0xFF6B707A, 0xFF5A6372, 0xFFDADDE3, 0xFF262B33, 0xFF8C95A6),
    ThemeDef("ila", "Ila", "ഇല", "Leaf", "Vibrant", 0xFFF2F8EE, 0xFF123B1C, 0xFF4E6B55, 0xFF1E9E45, 0xFF1E9E45, 0xFFFFFFFF, 0xFFFFC21A),
    ThemeDef("sandhya", "Sandhya", "സന്ധ്യ", "Dusk", "Vibrant", 0xFFFFF3EF, 0xFF3B1220, 0xFF7A5560, 0xFFE8454F, 0xFFC2185B, 0xFFFFFFFF, 0xFFFFB347),
    ThemeDef("kadal", "Kadal", "കടൽ", "Sea", "Vibrant", 0xFFEEF9F9, 0xFF0B3440, 0xFF4E6E75, 0xFF0FA3A8, 0xFF0B6E8A, 0xFFFFFFFF, 0xFFFFD43B),
    ThemeDef("maambazham", "Maambazham", "മാമ്പഴം", "Ripe mango", "Vibrant", 0xFFFFF8E6, 0xFF3D2400, 0xFF7A6440, 0xFFF08A00, 0xFFF2A900, 0xFF3D2400, 0xFFD9480F),
    ThemeDef("peeli", "Peeli", "പീലി", "Peacock feather", "Vibrant", 0xFFEEF5F8, 0xFF0D2340, 0xFF566577, 0xFF0E7C86, 0xFF1B3A8C, 0xFFFFFFFF, 0xFF2EC4B6),
)

/** Every colour the screens use, for one theme in light or dark. */
data class Pal(val paper: Color, val paper2: Color, val ink: Color, val inkSoft: Color, val accent: Color, val accentText: Color,
               val accentSoft: Color, val line: Color, val soft: Color, val bar: Color, val barInk: Color, val barSoft: Color,
               val playerBg: Color, val artBg: Color, val gold: Color, val highlight: Color)

object Palettes {
    /** The original Radio Velvet colours, exactly as before. */
    private val velvetLight = Pal(Color(0xFFF0EDE6), Color(0xFFE7E2D6), Color(0xFF2A1424), Color(0xFF4A4A4C), Color(0xFF6B2D5C), Color(0xFF6B2D5C),
        Color(0xFFEEDFE8), Color(0xFFDED7C9), Color(0xFF6A6266), Color(0xFF2A1424), Color(0xFFF1E9EE), Color(0xFFB9A8B4),
        Color(0xFFF0EDE6), Color(0xFF2A1424), Color(0xFFC9A86A), Color(0xFFEEDFE8))
    private val velvetDark = Pal(Color(0xFF140D12), Color(0xFF241520), Color(0xFFF1E9EE), Color(0xFFC9BBC5), Color(0xFFB0609C), Color(0xFFD9A9CB),
        Color(0xFF35202F), Color(0xFF33242F), Color(0xFFB9A8B4), Color(0xFF241520), Color(0xFFF1E9EE), Color(0xFFB9A8B4),
        Color(0xFF140D12), Color(0xFF2A1424), Color(0xFFC9A86A), Color(0xFF4A2A40))

    fun of(id: String, dark: Boolean): Pal {
        if (id == "velvet" || THEMES.none { it.id == id }) return if (dark) velvetDark else velvetLight
        val t = THEMES.first { it.id == id }
        val bg = Color(t.bg); val ink = Color(t.ink); val soft = Color(t.soft); val acc = Color(t.accent)
        val barInk = Color(t.barInk); val hi = Color(t.hi)
        // the bottom bar's text must stay easy to read: deepen a bright bar (e.g. leaf green) until it is
        val bar = Color(t.bar).let { b -> if (contrast(barInk, b) >= 4.5f) b else
            (1..20).map { lerp(b, if (luma(barInk) > 0.5f) Color.Black else Color.White, it / 20f) }.first { contrast(barInk, it) >= 4.5f } }
        if (!dark) return Pal(bg, lerp(bg, ink, 0.06f), ink, lerp(soft, ink, 0.35f), acc, readable(acc, bg, ink), lerp(bg, acc, 0.12f),
            lerp(bg, ink, 0.12f), soft, bar, barInk, lerp(barInk, bar, 0.3f), bg, if (luma(bar) < 0.5f) bar else ink, hi, lerp(bg, acc, 0.16f))
        // dark: a near-black tinted with the theme's colour, light text, the accent lifted so it reads on dark
        val base = Color(0xFF0D0C0D)
        val paper = lerp(base, acc, 0.10f)
        return Pal(paper, lerp(base, acc, 0.20f), lerp(Color.White, acc, 0.06f), lerp(Color(0xFFC4C4C4), acc, 0.12f),
            lerp(acc, Color.White, 0.25f), lerp(acc, Color.White, 0.55f), lerp(base, acc, 0.28f), lerp(base, acc, 0.26f),
            lerp(Color(0xFFB4B4B4), acc, 0.15f), lerp(base, acc, 0.18f), lerp(Color.White, acc, 0.06f), lerp(Color(0xFFB4B4B4), acc, 0.15f),
            paper, lerp(base, acc, 0.30f), hi, lerp(base, acc, 0.38f))
    }
    fun luma(c: Color) = 0.2126f * c.red + 0.7152f * c.green + 0.0722f * c.blue
    /** Accent for text: some bright accents (mango, leaf) are too light to read on a pale page; darken those. */
    private fun readable(acc: Color, bg: Color, ink: Color): Color = if (contrast(acc, bg) >= 4.5f) acc else
        (1..10).map { lerp(acc, ink, it / 10f) }.first { contrast(it, bg) >= 4.5f }
    fun contrast(a: Color, b: Color): Float {
        fun lin(v: Float) = if (v <= 0.03928f) v / 12.92f else Math.pow(((v + 0.055f) / 1.055f).toDouble(), 2.4).toFloat()
        fun l(c: Color) = 0.2126f * lin(c.red) + 0.7152f * lin(c.green) + 0.0722f * lin(c.blue)
        val x = l(a); val y = l(b); return (maxOf(x, y) + 0.05f) / (minOf(x, y) + 0.05f)
    }
}

/** The look the listener chose (Settings), as Compose state. Defaults = the app exactly as before. */
object Theme {
    /** The phone's own light / dark setting (set by the activity). */
    var sysDark by mutableStateOf(false)
    /** Dark or light right now: the listener's choice, or the phone's. Worked out, never stored, so it always follows both. */
    val dark: Boolean get() = when (mode) { "light" -> false; "dark" -> true; else -> sysDark }
    var themeId by mutableStateOf("velvet")
    var mode by mutableStateOf("phone")          // phone · light · dark
    var text by mutableStateOf(0)                // 0 normal · 1 large · 2 extra large
    var font by mutableStateOf("jost")           // one of FONTS (jost, poppins, … , phone)
    var spacing by mutableStateOf(0)             // 0 compact · 1 comfortable · 2 spacious
    var viz by mutableStateOf("off")             // bars · waves · circle · off
    var resume by mutableStateOf(true)           // carry on after another app's video
    var look by mutableStateOf("std")            // the big player: std (today's) or a radio from Eras.LIST
    var lookColours by mutableStateOf("original") // original (the radio's own materials) · theme (the colour theme)
    /** True while the big player is on screen (it covers everything else). */
    var playerOpen by mutableStateOf(false)
    /** The colours on screen: the theme's, or, while the big player shows an original radio, that radio's page. */
    val pal: Pal get() = Palettes.of(themeId, dark).let { if (playerOpen && look != "std" && lookColours == "original") Eras.pagePal(look, dark, it) else it }
    val textScale: Float get() = (when (text) { 1 -> 1.15f; 2 -> 1.3f; else -> 1f }) * (FONTS.firstOrNull { it.id == font }?.scale ?: 1f)
    val rowHeight: Int get() = when (spacing) { 1 -> 64; 2 -> 76; else -> 56 }

    fun prefs(ctx: Context) = ctx.getSharedPreferences("settings", Context.MODE_PRIVATE)
    fun load(ctx: Context) {
        val p = prefs(ctx)
        themeId = p.getString("theme", "velvet")!!.let { id -> if (THEMES.any { it.id == id }) id else "velvet" }
        mode = p.getString("mode", "phone")!!.let { if (it in listOf("phone", "light", "dark")) it else "phone" }
        text = p.getInt("text", 0).coerceIn(0, 2); font = p.getString("font", "jost")!!.let { f -> if (FONTS.any { it.id == f }) f else "jost" }
        spacing = p.getInt("spacing", 0).coerceIn(0, 2)
        viz = p.getString("viz", "off")!!.let { if (it in listOf("bars", "waves", "circle", "off")) it else "off" }
        resume = p.getBoolean("resume", true)
        look = p.getString("look", "std")!!.let { if (it in Eras.IDS) it else "std" }
        lookColours = p.getString("lookColours", "original")!!.let { if (it in listOf("original", "theme")) it else "original" }
    }
    fun save(ctx: Context) {
        prefs(ctx).edit().putString("theme", themeId).putString("mode", mode).putInt("text", text).putString("font", font)
            .putInt("spacing", spacing).putString("viz", viz).putBoolean("resume", resume)
            .putString("look", look).putString("lookColours", lookColours).apply()
    }
}

/** A typeface the listener can choose. [res]: light, regular, medium, semibold (null = the phone's own font). */
class FontChoice(val id: String, val name: String, val kind: String, val res: IntArray?, val scale: Float = 1f) {
    val family: FontFamily by lazy {
        if (res == null) FontFamily.Default else FontFamily(
            Font(res[0], FontWeight.Light), Font(res[1], FontWeight.Normal), Font(res[2], FontWeight.Medium),
            Font(res[3], FontWeight.SemiBold), Font(res[3], FontWeight.Bold))
    }
}

/** Jost first (the app's own look); modern sans-serifs, classic serifs, terminal / typewriter, then the phone's font. */
val FONTS = listOf(
    FontChoice("jost", "Jost", "Modern", intArrayOf(R.font.jost_light, R.font.jost_regular, R.font.jost_medium, R.font.jost_semibold)),
    FontChoice("poppins", "Poppins", "Modern", intArrayOf(R.font.poppins_light, R.font.poppins_regular, R.font.poppins_medium, R.font.poppins_semibold), 0.95f),
    FontChoice("montserrat", "Montserrat", "Modern", intArrayOf(R.font.montserrat_light, R.font.montserrat_regular, R.font.montserrat_medium, R.font.montserrat_semibold), 0.95f),
    FontChoice("raleway", "Raleway", "Modern", intArrayOf(R.font.raleway_light, R.font.raleway_regular, R.font.raleway_medium, R.font.raleway_semibold)),
    FontChoice("serif", "Cormorant", "Classic", intArrayOf(R.font.cormorant_regular, R.font.cormorant_regular, R.font.cormorant_medium, R.font.cormorant_semibold), 1.1f),
    FontChoice("playfair", "Playfair", "Classic", intArrayOf(R.font.playfair_regular, R.font.playfair_regular, R.font.playfair_medium, R.font.playfair_semibold)),
    FontChoice("lora", "Lora", "Classic", intArrayOf(R.font.lora_regular, R.font.lora_regular, R.font.lora_medium, R.font.lora_semibold)),
    FontChoice("plexmono", "IBM Plex Mono", "Terminal", intArrayOf(R.font.plexmono_light, R.font.plexmono_regular, R.font.plexmono_medium, R.font.plexmono_semibold), 0.9f),
    FontChoice("courier", "Courier Prime", "Typewriter", intArrayOf(R.font.courier_regular, R.font.courier_regular, R.font.courier_regular, R.font.courier_bold), 0.92f),
    FontChoice("phone", "Phone font", "Phone", null),
)

/** The app's typeface: the one chosen in Settings (Jost unless changed). */
val Poppins: FontFamily get() = (FONTS.firstOrNull { it.id == Theme.font } ?: FONTS[0]).family
