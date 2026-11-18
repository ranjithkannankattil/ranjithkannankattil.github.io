package com.ranjithkb.radionative

import android.content.Context
import android.media.AudioManager
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/*
 * Player looks: the big player drawn as a radio from one era (1930s cathedral … 1990s digital tuner).
 * Each look comes in the radio's original materials or in the listener's colour theme, and the page round it
 * follows light / dark like the rest of the app. Needles, meters, lamps and speakers move with the music
 * (the same sound data as the visualiser); the knobs work: tuning changes station, volume is the phone's
 * media volume, bass / mid / treble are the equaliser.
 */
object Eras {
    /** One radio. [w] × [h]: its drawing size in design units (scaled to fit the screen). */
    class Era(val id: String, val name: String, val decade: String, val w: Float, val h: Float)

    val LIST = listOf(
        Era("cathedral", "Cathedral", "1930s", 300f, 412f),
        Era("valve", "Valve radio", "1950s", 340f, 346f),
        Era("transistor", "Transistor", "1960s", 312f, 270f),
        Era("receiver", "Hi-fi receiver", "1970s", 340f, 300f),
        Era("boombox", "Boombox", "1980s", 340f, 184f),
        Era("digital", "Digital tuner", "1990s", 340f, 300f),
    )
    val IDS = listOf("std") + LIST.map { it.id }
    /** Radios with bass / mid / treble knobs (they get a Reset knobs button). */
    fun hasTone(id: String) = id == "receiver" || id == "digital"
    fun byId(id: String) = LIST.firstOrNull { it.id == id }
    fun name(id: String) = byId(id)?.let { "${it.decade} · ${it.name}" } ?: "Standard player"
    /** Swiping through the looks in order (Standard first), round and round. */
    fun step(id: String, dir: Int): String {
        val i = IDS.indexOf(id).coerceAtLeast(0)
        return IDS[((i + dir) % IDS.size + IDS.size) % IDS.size]
    }

    /** The radio's own colours. */
    class Skin(val bodyTop: Color, val bodyBottom: Color, val body2: Color, val panel: Color, val panelInk: Color, val metal: Color,
               val needle: Color, val glow: Color, val grille: Color, val grilleBg: Color)
    private fun c(v: Long) = Color(v)
    private val ORIGINAL = mapOf(
        "cathedral" to Skin(c(0xFF7A4A26), c(0xFF4A2A12), c(0xFF3A200C), c(0xFFF3E6C8), c(0xFF2B1A0E), c(0xFFC59A4A), c(0xFFB23A1E), c(0xFFFFB347), c(0xFF3A200C), c(0xFFD8C29A)),
        "valve" to Skin(c(0xFF5A3A28), c(0xFF2E1C12), c(0xFF24160E), c(0xFFF3E6C8), c(0xFF2B1A12), c(0xFFD8C29A), c(0xFFC23A1E), c(0xFFFFB347), c(0xFF3A2414), c(0xFFE3D2A8)),
        "transistor" to Skin(c(0xFFB07A46), c(0xFF7A4E28), c(0xFF4A2E16), c(0xFFF7F2E6), c(0xFF2A2420), c(0xFFD9D9D9), c(0xFFD23A2A), c(0xFFFFB347), c(0xFF5A5A5A), c(0xFFC8C8C8)),
        "receiver" to Skin(c(0xFFD7D9DC), c(0xFFA9ADB2), c(0xFF2A2C30), c(0xFF1A3B5C), c(0xFFBFE3FF), c(0xFF2A2C30), c(0xFFFF6A3A), c(0xFF7FC8FF), c(0xFF2A2C30), c(0xFF9AA0A6)),
        "boombox" to Skin(c(0xFF2C2C2C), c(0xFF141414), c(0xFF0C0C0C), c(0xFF9FB59A), c(0xFF1C2A1A), c(0xFFC8C8C8), c(0xFFE8463A), c(0xFFF2C230), c(0xFF3A3A3A), c(0xFF2A2A2A)),
        "digital" to Skin(c(0xFF26262A), c(0xFF16161A), c(0xFF2E2E34), c(0xFF061108), c(0xFF7CF08E), c(0xFF8A8A92), c(0xFFE8463A), c(0xFF7CF08E), c(0xFF26262A), c(0xFF16161A)),
    )
    /** Velvet exactly as designed. */
    private val VELVET = Skin(c(0xFF6B2D5C), c(0xFF3A1430), c(0xFF2A1424), c(0xFFF3E6C8), c(0xFF2A1424), c(0xFFC9A86A), c(0xFFE8463A), c(0xFFFFB347), c(0xFF2A1424), c(0xFFD9C49A))

    /** The radio in its original materials, or in a colour theme (the theme's colour for the cabinet, its gold for the metal). */
    fun skin(era: String, original: Boolean, themeId: String): Skin {
        if (original) return ORIGINAL[era] ?: VELVET
        val t = THEMES.firstOrNull { it.id == themeId }
        if (t == null || t.id == "velvet") return VELVET
        val acc = Color(t.accent); val ink = Color(t.ink); val hi = Color(t.hi)
        val panel = lerp(Color(0xFFFFF8EC), hi, 0.16f)
        return Skin(acc, lerp(acc, ink, 0.55f), ink, panel, ink, hi, Color(0xFFE8463A), Color(0xFFFFB347), ink, lerp(panel, hi, 0.45f))
    }

    /** The page round an original radio: light and dark for every era. ink and accent always readable on it. */
    class Page(val page: Color, val ink: Color, val soft: Color, val accent: Color)
    private val PAGES = mapOf(
        "cathedral" to (Page(c(0xFFE9DFCB), c(0xFF2B1A0E), c(0xFF6E5A3A), c(0xFF7E5016)) to Page(c(0xFF1A120B), c(0xFFEFE3CF), c(0xFFB3A08A), c(0xFFD8A85A))),
        "valve" to (Page(c(0xFFEFE6D2), c(0xFF2B1A12), c(0xFF6E5A4A), c(0xFF8A4A1E)) to Page(c(0xFF1A130E), c(0xFFEFE6D2), c(0xFFB3A08A), c(0xFFE0A060))),
        "transistor" to (Page(c(0xFFF2EBDD), c(0xFF2A2420), c(0xFF6A625A), c(0xFFA0521E)) to Page(c(0xFF17130F), c(0xFFF2EBDD), c(0xFFADA294), c(0xFFE09A5A))),
        "receiver" to (Page(c(0xFFECEEF1), c(0xFF1A1C20), c(0xFF5A6068), c(0xFF1E5A8A)) to Page(c(0xFF111214), c(0xFFECECEC), c(0xFF9AA0A6), c(0xFF7FB8E8))),
        "boombox" to (Page(c(0xFFEDEBE6), c(0xFF161616), c(0xFF5E5E5E), c(0xFFB8322A)) to Page(c(0xFF141414), c(0xFFF0F0F0), c(0xFFA0A0A0), c(0xFFE8463A))),
        "digital" to (Page(c(0xFFE9EBEA), c(0xFF141614), c(0xFF5A605A), c(0xFF1A6A2C)) to Page(c(0xFF0E0E10), c(0xFFEDEDED), c(0xFF9A9AA0), c(0xFF7CF08E))),
    )
    fun page(era: String, dark: Boolean): Page? = PAGES[era]?.let { if (dark) it.second else it.first }

    /** The app's colours while the big player shows an original radio: the period page instead of the theme's. */
    fun pagePal(era: String, dark: Boolean, base: Pal): Pal {
        val p = page(era, dark) ?: return base
        return base.copy(paper = p.page, paper2 = lerp(p.page, p.ink, 0.06f), ink = p.ink, inkSoft = p.soft, accent = p.accent, accentText = p.accent,
            accentSoft = lerp(p.page, p.accent, 0.12f), line = lerp(p.page, p.ink, 0.14f), soft = p.soft, playerBg = p.page,
            artBg = ORIGINAL[era]?.body2 ?: base.artBg, gold = p.accent, highlight = lerp(p.page, p.accent, 0.16f))
    }

    /** An FM frequency in the station's name (87.5–108), if there is one. */
    fun freq(name: String): Float? = Regex("""(?<![\d.])(\d{2,3}(?:\.\d{1,2})?)(?![\d.])""").findAll(name)
        .mapNotNull { it.value.toFloatOrNull() }.firstOrNull { it in 87.5f..108f }

    /** Where the needle sits on the dial (0..1) and what the display shows: the station's frequency, or its place in the list. */
    fun dial(name: String, index: Int, count: Int): Pair<Float, String> {
        freq(name)?.let { f -> return ((f - 88f) / 20f).coerceIn(0.02f, 0.98f) to
            (if (f % 1f == 0f) String.format(Locale.US, "%.0f", f) else String.format(Locale.US, "%.1f", f)) }
        val pos = if (count <= 1 || index < 0) 0.5f else 0.06f + 0.88f * index.coerceAtMost(count - 1) / (count - 1)
        return pos to String.format(Locale.US, "CH %02d", (index.coerceAtLeast(0) + 1) % 100)
    }

    /** Knob angle (degrees, 0 = straight up) for a value 0..1. */
    fun angle(v: Float) = -135f + 270f * v.coerceIn(0f, 1f)
    /** Equaliser band (dB) ↔ knob value. */
    fun eqToKnob(db: Int) = (db + 12) / 24f
}

/**
 * Turning a knob. Round the knob: the change in angle of the finger about the knob's centre (clockwise +).
 * Near the centre, or on a straight wheel: a straight swipe (right or up = clockwise). Degrees in both cases.
 */
object Rotary {
    fun angleDelta(c: Offset, a: Offset, b: Offset): Float {
        var d = Math.toDegrees((kotlin.math.atan2(b.y - c.y, b.x - c.x) - kotlin.math.atan2(a.y - c.y, a.x - c.x)).toDouble()).toFloat()
        while (d > 180f) d -= 360f; while (d < -180f) d += 360f
        return d
    }
    /** [minR] px: closer than this to the centre counts as a straight swipe. [pxPerDeg]: straight-swipe speed. */
    fun turn(c: Offset, prev: Offset, now: Offset, minR: Float, pxPerDeg: Float, wheel: Boolean = false): Float {
        val straight = ((now.x - prev.x) - (now.y - prev.y)) / pxPerDeg
        if (wheel) return straight
        val r = minOf((prev - c).getDistance(), (now - c).getDistance())
        if (r < minR) return straight
        // moving round the knob (across the radius) = turning it; moving towards or away from the centre = a swipe
        val u = (now - c) / (now - c).getDistance(); val v = now - prev
        val across = u.x * v.y - u.y * v.x; val along = u.x * v.x + u.y * v.y
        return if (kotlin.math.abs(across) >= kotlin.math.abs(along)) angleDelta(c, prev, now) else straight
    }
    /** Whole steps in [acc] degrees, and what's left over. */
    fun steps(acc: Float, perStep: Float): Pair<Int, Float> { val n = (acc / perStep).toInt(); return n to (acc - n * perStep) }
}

/** Everything a radio drawing shows at one moment. */
class RadioVals(val levels: FloatArray, val t: Float, val playing: Boolean, val pos: Float, val freqLabel: String, val station: String,
                val vol: Float, val bass: Int, val mid: Int, val treble: Int, val turn: Map<String, Float> = emptyMap()) {
    /** A knob's drawn angle: its value, plus how far the finger has turned it towards the next step. */
    fun k(ctl: String, base: Float) = base + (turn[ctl] ?: 0f)
    val vuL get() = (levels.take(12).average().toFloat() * 1.35f).coerceIn(0f, 1f)
    val vuR get() = (levels.drop(8).take(14).average().toFloat() * 1.6f).coerceIn(0f, 1f)
    val level get() = ((vuL + vuR) / 2f)
    companion object {
        /** A still picture (the Settings tiles). */
        fun still(playing: Boolean = true) = RadioVals(FloatArray(Viz.N) { i -> 0.25f + 0.3f * abs(sin(i * 0.55f) * cos(i * 0.2f)) },
            1.2f, playing, 0.38f, "91.9", "Radio Mango", 0.6f, 2, 0, 1)
    }
}

/** The moving parts: the visualiser's sound data when there is some, a gentle made-up movement otherwise, still when paused. */
@Composable
private fun rememberLevels(playing: Boolean): Motion {
    DisposableEffect(Unit) { Viz.watching = true; onDispose { Viz.watching = false } }
    val m = remember { Motion() }
    var t by m.t
    var shown by m.shown
    LaunchedEffect(playing) {
        var last = 0L
        while (true) {
            withFrameNanos { n ->
                if (last != 0L) t += (n - last) / 1e9f
                last = n
                val live = System.currentTimeMillis() - Viz.stamp < 600
                val target = if (!playing) FloatArray(Viz.N) else if (live) Viz.bands else FloatArray(Viz.N) { i ->
                    (0.25f + 0.35f * (0.5f + 0.5f * sin(t * 2.1f + i * 0.45f)) * (0.6f + 0.4f * cos(t * 1.3f + i * 0.17f))) * (1f - i / (Viz.N * 1.6f)) }
                shown = FloatArray(Viz.N) { i -> shown[i] + (target[i] - shown[i]) * (if (!playing) 0.06f else 0.3f) }
            }
            // paused: once everything has settled, stop drawing frames (saves battery)
            if (!playing && shown.all { it < 0.004f }) { shown = FloatArray(Viz.N); break }
        }
    }
    return m
}

/** The moving values. Read only while drawing, so each frame repaints the picture without rebuilding the screen. */
class Motion { val t = mutableFloatStateOf(0f); val shown = mutableStateOf(FloatArray(Viz.N)) }

private enum class Ctl { TUNE, VOLUME, BASS, MID, TREBLE, PREV, PLAY, STOP, NEXT }
/** A control on the drawing, in design units: centre and half-size. */
private class Zone(val ctl: Ctl, val cx: Float, val cy: Float, val hw: Float, val hh: Float = hw, val wheel: Boolean = false)

private fun zones(era: String): List<Zone> = when (era) {
    "cathedral" -> listOf(Zone(Ctl.TUNE, 61f, 331f, 31f), Zone(Ctl.VOLUME, 239f, 331f, 31f))
    "valve" -> listOf(Zone(Ctl.TUNE, 49f, 285f, 31f), Zone(Ctl.VOLUME, 291f, 285f, 31f))
    "transistor" -> listOf(Zone(Ctl.TUNE, 76f, 239f, 60f, 16f, wheel = true), Zone(Ctl.VOLUME, 302f, 85f, 12f, 45f, wheel = true))
    "receiver" -> listOf(Ctl.TUNE, Ctl.VOLUME, Ctl.BASS, Ctl.TREBLE).mapIndexed { i, k -> Zone(k, 14f + 312f * (i + 0.5f) / 4, 224f, 30f) }
    "boombox" -> listOf(Ctl.PREV, Ctl.PLAY, Ctl.STOP, Ctl.NEXT).mapIndexed { i, k -> Zone(k, 37f + i * 56f, 153f, 23f, 13f) }
    "digital" -> listOf(Ctl.BASS, Ctl.MID, Ctl.TREBLE, Ctl.VOLUME).mapIndexed { i, k -> Zone(k, 14f + 312f * (i + 0.5f) / 4, 255f, 28f) }
    else -> emptyList()
}

/** The big player's radio: the drawing plus its working controls. */
@Composable
fun EraRadio(era: Eras.Era, now: NowState, c: androidx.media3.session.MediaController?, modifier: Modifier, onSwipe: ((Int) -> Unit)? = null) {
    val ctx = LocalContext.current
    val skin = Eras.skin(era.id, Theme.lookColours == "original", Theme.themeId)
    val motion = rememberLevels(now.playing)
    val station = now.md.station?.toString() ?: now.md.title?.toString() ?: ""
    val (pos, label) = Eras.dial(station, c?.currentMediaItemIndex ?: -1, c?.mediaItemCount ?: 0)
    // the needle glides to the new station, like turning a real dial
    val shownPos = androidx.compose.animation.core.animateFloatAsState(pos, androidx.compose.animation.core.tween(650), label = "dial")
    val am = remember { ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager }
    val max = remember { am.getStreamMaxVolume(AudioManager.STREAM_MUSIC).coerceAtLeast(1) }
    var vol by remember { mutableIntStateOf(am.getStreamVolume(AudioManager.STREAM_MUSIC)) }
    // the knob follows the phone's own volume buttons too
    DisposableEffect(Unit) {
        val r = object : android.content.BroadcastReceiver() {
            override fun onReceive(c: Context?, i: android.content.Intent?) { vol = am.getStreamVolume(AudioManager.STREAM_MUSIC) } }
        androidx.core.content.ContextCompat.registerReceiver(ctx, r, android.content.IntentFilter("android.media.VOLUME_CHANGED_ACTION"),
            androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED)
        onDispose { runCatching { ctx.unregisterReceiver(r) } }
    }
    var bands by remember { mutableStateOf(if (Eq.on(ctx)) Eq.bands(ctx) else IntArray(5)) }
    val playing = now.playing
    val turn = remember { mutableStateMapOf<String, Float>() }           // live, part-way turns of each knob
    val view = androidx.compose.ui.platform.LocalView.current
    fun tick() { view.performHapticFeedback(android.view.HapticFeedbackConstants.CLOCK_TICK) }
    val tm = rememberTextMeasurer()

    fun setVol(v: Int) { vol = v.coerceIn(0, max); am.setStreamVolume(AudioManager.STREAM_MUSIC, vol, 0) }
    fun setBand(i: Int, v: Int) {
        val b = (if (Eq.on(ctx)) Eq.bands(ctx) else IntArray(5)).copyOf(); b[i] = v.coerceIn(-12, 12)
        bands = b; Eq.save(ctx, true, Eq.PRESETS.entries.firstOrNull { it.value.contentEquals(b) }?.key ?: "Custom", b)
    }
    fun bandOf(k: Ctl) = when (k) { Ctl.BASS -> 0; Ctl.MID -> 2; else -> 4 }

    Column(modifier, horizontalAlignment = Alignment.CenterHorizontally) {
    BoxWithConstraints(Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
        val s = minOf(maxWidth.value / era.w, maxHeight.value / era.h)
        val w = era.w * s; val h = era.h * s
        Box(Modifier.size(w.dp, h.dp)) {
            Canvas(Modifier.fillMaxSize().let { if (onSwipe != null) it.themeSwipe(onSwipe) else it }.semantics { contentDescription = "${era.name} radio, ${era.decade}" }) {
                withTransform({ scale(size.width / era.w, size.height / era.h, Offset.Zero) }) {
                    drawEra(era.id, skin, RadioVals(motion.shown.value, motion.t.floatValue, playing, shownPos.value, label, station,
                        vol / max.toFloat(), bands[0], bands[2], bands[4], turn.toMap()), tm) }
            }
            zones(era.id).forEach { z ->
                // every control at least 48 dp to touch, centred on the drawn knob
                val minSize = if (z.ctl in listOf(Ctl.PREV, Ctl.PLAY, Ctl.STOP, Ctl.NEXT) || z.wheel) 48f else 68f
                val zw = maxOf(z.hw * 2 * s, minSize); val zh = maxOf(z.hh * 2 * s, minSize)
                val name = when (z.ctl) { Ctl.TUNE -> "Tuning"; Ctl.VOLUME -> "Volume"; Ctl.BASS -> "Bass"; Ctl.MID -> "Mid"; Ctl.TREBLE -> "Treble"
                    Ctl.PREV -> "Previous station"; Ctl.PLAY -> "Play"; Ctl.STOP -> "Pause"; Ctl.NEXT -> "Next station" }
                var m = Modifier.offset((z.cx * s - zw / 2).dp, (z.cy * s - zh / 2).dp).size(zw.dp, zh.dp)
                m = when (z.ctl) {
                    Ctl.PREV -> m.clickable(onClickLabel = name) { c?.prevStation() }.semantics { contentDescription = name; role = Role.Button }
                    Ctl.NEXT -> m.clickable(onClickLabel = name) { c?.nextStation() }.semantics { contentDescription = name; role = Role.Button }
                    Ctl.PLAY -> m.clickable(onClickLabel = name) { c?.let { it.prepare(); it.play() } }.semantics { contentDescription = name; role = Role.Button }
                    Ctl.STOP -> m.clickable(onClickLabel = name) { c?.pause() }.semantics { contentDescription = name; role = Role.Button }
                    Ctl.TUNE -> m.knob(z.wheel, 40f, "TUNE", turn, ::tick, restartOn = c) { n -> repeat(abs(n)) { if (n > 0) c?.nextStation() else c?.prevStation() } }
                        .pointerInput(c) { detectTapGestures { o -> if (o.x > size.width / 2) c?.nextStation() else c?.prevStation() } }
                        .semantics { contentDescription = "Tuning knob: turn or tap the right side for the next station, the left side for the previous"
                            customActions = listOf(CustomAccessibilityAction("Next station") { c?.nextStation(); true },
                                CustomAccessibilityAction("Previous station") { c?.prevStation(); true }) }
                    Ctl.VOLUME -> m.knob(z.wheel, (270f / max).coerceIn(10f, 30f), "VOLUME", turn, ::tick) { n -> setVol(vol + n) }
                        .pointerInput(Unit) { detectTapGestures { o -> setVol(vol + if (o.x > size.width / 2) 1 else -1) } }
                        .semantics { contentDescription = "Volume knob"; stateDescription = "${vol * 100 / max} percent"
                            customActions = listOf(CustomAccessibilityAction("Louder") { setVol(vol + 1); true },
                                CustomAccessibilityAction("Quieter") { setVol(vol - 1); true }) }
                    else -> { val i = bandOf(z.ctl)
                        m.knob(z.wheel, 11f, z.ctl.name, turn, ::tick) { n -> setBand(i, bands[i] + n) }
                            .pointerInput(Unit) { detectTapGestures { o -> setBand(i, bands[i] + if (o.x > size.width / 2) 2 else -2) } }
                            .semantics { contentDescription = "$name knob"; stateDescription = "%+d dB".format(bands[i])
                                customActions = listOf(CustomAccessibilityAction("More $name") { setBand(i, bands[i] + 2); true },
                                    CustomAccessibilityAction("Less $name") { setBand(i, bands[i] - 2); true }) } }
                }
                Box(m)
            }
        }
    }
    // tone knobs back to flat (the hi-fi receiver and the digital tuner); volume and tuning are left as they are
    if (Eras.hasTone(era.id)) {
        val turned = bands.any { it != 0 }
        Row(Modifier.height(44.dp).alpha(if (turned) 1f else 0.4f)
            .clickable(enabled = turned, onClickLabel = "Reset the knobs") {
                bands = IntArray(5); turn.clear(); Eq.save(ctx, false, "Normal", IntArray(5)); tick() }
            .semantics(mergeDescendants = true) { contentDescription = "Reset knobs: bass, mid and treble back to flat" }
            .padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("↺  Reset knobs", fontSize = 13.sp, color = Soft, letterSpacing = 0.6.sp)
        }
    }
    }
}

/** Turning gesture for a knob: [perStep] degrees per step; [onSteps] gets whole steps (+ clockwise); the part-way turn is drawn. */
private fun Modifier.knob(wheel: Boolean, perStep: Float, key: String, turn: MutableMap<String, Float>, tick: () -> Unit,
                          restartOn: Any? = null, onSteps: (Int) -> Unit) = pointerInput(key, perStep, wheel, restartOn) {
    val minR = 14.dp.toPx(); val pxPerDeg = 0.85.dp.toPx()
    val c = Offset(size.width / 2f, size.height / 2f)
    var acc = 0f
    detectDragGestures(onDragStart = { acc = 0f }, onDragEnd = { acc = 0f; turn.remove(key) }, onDragCancel = { acc = 0f; turn.remove(key) }) { ch, _ ->
        ch.consume()
        acc += Rotary.turn(c, ch.previousPosition, ch.position, minR, pxPerDeg, wheel)
        val (n, rest) = Rotary.steps(acc, perStep)
        if (n != 0) { onSteps(n); tick() }
        acc = rest
        turn[key] = rest
    }
}

/** A still radio for the Settings tiles. */
@Composable
fun EraPicture(eraId: String, original: Boolean, modifier: Modifier) {
    val era = Eras.byId(eraId) ?: return
    val skin = Eras.skin(era.id, original, Theme.themeId)
    val tm = rememberTextMeasurer()
    val v = remember { RadioVals.still() }
    Canvas(modifier) {
        val s = minOf(size.width / era.w, size.height / era.h)
        withTransform({ translate((size.width - era.w * s) / 2, (size.height - era.h * s) / 2); scale(s, s, Offset.Zero) }) { drawEra(era.id, skin, v, tm) }
    }
}

// ------------------------------------------------------------------ drawing (design units)

private fun DrawScope.drawEra(id: String, s: Eras.Skin, v: RadioVals, tm: TextMeasurer) = when (id) {
    "cathedral" -> cathedral(s, v, tm)
    "valve" -> valve(s, v, tm)
    "transistor" -> transistor(s, v, tm)
    "receiver" -> receiver(s, v, tm)
    "boombox" -> boombox(s, v, tm)
    else -> digital(s, v, tm)
}

private val labelFont get() = FONTS[0].family
private val monoFont get() = FONTS.first { it.id == "plexmono" }.family

/** Text in design units: [x] is the centre (or the left edge when [left]), [y] the top. */
private fun DrawScope.txt(tm: TextMeasurer, text: String, x: Float, y: Float, size: Float, color: Color, left: Boolean = false, right: Boolean = false,
                          caps: Boolean = false, mono: Boolean = false, italic: Boolean = false, spacing: Float = 0f, weight: FontWeight = FontWeight.Medium) {
    val st = TextStyle(color = color, fontSize = (size / 1f).toSp(), fontFamily = if (mono) monoFont else labelFont, fontWeight = weight,
        fontStyle = if (italic) FontStyle.Italic else FontStyle.Normal, letterSpacing = (if (caps) size * 0.15f else spacing).toSp())
    val r = tm.measure(if (caps) text.uppercase() else text, st, maxLines = 1)
    drawText(r, topLeft = Offset(if (left) x else if (right) x - r.size.width else x - r.size.width / 2f, y))
}

private fun DrawScope.body(s: Eras.Skin, x: Float, y: Float, w: Float, h: Float, top: Float, bottom: Float) {
    val p = Path().apply { addRoundRect(RoundRect(x, y, x + w, y + h, CornerRadius(top), CornerRadius(top), CornerRadius(bottom), CornerRadius(bottom))) }
    drawPath(p, Color.Black.copy(alpha = 0.18f), style = Stroke(6f))   // a soft edge so the radio sits on the page
    drawPath(p, Brush.verticalGradient(listOf(s.bodyTop, s.bodyBottom), y, y + h))
}

private fun DrawScope.knob(tm: TextMeasurer, cx: Float, cy: Float, r: Float, ang: Float, label: String, s: Eras.Skin) {
    for (a in -135..135 step 27) {
        val rad = Math.toRadians((a - 90).toDouble())
        drawLine(s.metal.copy(alpha = 0.7f), Offset(cx + cos(rad).toFloat() * r * 1.15f, cy + sin(rad).toFloat() * r * 1.15f),
            Offset(cx + cos(rad).toFloat() * r * 1.32f, cy + sin(rad).toFloat() * r * 1.32f), 1f)
    }
    drawCircle(s.body2, r, Offset(cx, cy))
    drawCircle(s.metal, r, Offset(cx, cy), style = Stroke(1.4f))
    drawCircle(s.metal.copy(alpha = 0.35f), r * 0.8f, Offset(cx, cy), style = Stroke(1f))
    val rad = Math.toRadians((ang - 90).toDouble())
    drawLine(s.metal, Offset(cx, cy), Offset(cx + cos(rad).toFloat() * r * 0.8f, cy + sin(rad).toFloat() * r * 0.8f), 2.2f, StrokeCap.Round)
    txt(tm, label, cx, cy + r * 1.36f, 7.5f, s.metal, caps = true)
}

/** The long station dial: scale 88–108, the station's name over the needle. */
private fun DrawScope.hdial(tm: TextMeasurer, x: Float, y: Float, w: Float, h: Float, v: RadioVals, s: Eras.Skin, frame: Float) {
    drawRect(s.panel, Offset(x, y), Size(w, h))
    drawRect(s.glow.copy(alpha = 0.10f + 0.18f * v.level), Offset(x, y), Size(w, h))   // the lamp behind the dial breathes with the music
    for (i in 0..24) {
        val px = x + 6 + i * (w - 12) / 24
        drawLine(s.panelInk.copy(alpha = 0.8f), Offset(px, y + h), Offset(px, y + h - if (i % 4 == 0) 12 else 6), 1f)
        if (i % 4 == 0) txt(tm, "${88 + i * 20 / 24}", px, y + h - 27, 9.5f, s.panelInk, weight = FontWeight.Normal)
    }
    val nx = x + 6 + v.pos * (w - 12)
    txt(tm, v.station.take(18), nx.coerceIn(x + 50, x + w - 50), y + 5, 7f, s.panelInk, caps = true)
    drawRect(s.needle.copy(alpha = 0.25f), Offset(nx - 3, y), Size(6f, h))
    drawRect(s.needle, Offset(nx - 1, y), Size(2f, h))
    if (frame > 0) drawRect(s.metal, Offset(x, y), Size(w, h), style = Stroke(frame))
}

private fun DrawScope.lamp(cx: Float, cy: Float, r: Float, c: Color, on: Float) {
    drawCircle(c.copy(alpha = 0.25f * on), r * 2.4f, Offset(cx, cy))
    drawCircle(c.copy(alpha = 0.35f + 0.65f * on), r, Offset(cx, cy))
}

private fun DrawScope.cathedral(s: Eras.Skin, v: RadioVals, tm: TextMeasurer) {
    body(s, 0f, 0f, 300f, 412f, 150f, 18f)
    val g = Path().apply { addRoundRect(RoundRect(24f, 24f, 276f, 274f, CornerRadius(126f), CornerRadius(126f), CornerRadius(8f), CornerRadius(8f))) }
    drawPath(g, s.grilleBg)
    drawPath(g, s.glow.copy(alpha = 0.08f + 0.22f * v.level))     // the warm light through the cloth
    for (i in 0 until 5) {
        val ah = 150f - abs(i - 2) * 28f; val ax = 54f + i * 52f - 15f
        drawPath(Path().apply { addRoundRect(RoundRect(ax, 274f - ah, ax + 30f, 274f, CornerRadius(15f), CornerRadius(15f), CornerRadius.Zero, CornerRadius.Zero)) },
            s.grille.copy(alpha = 0.9f))
    }
    drawPath(g, s.metal, style = Stroke(3f))
    // the round dial
    val cx = 150f; val cy = 336f; val r = 48f
    drawCircle(s.panel, r, Offset(cx, cy))
    drawCircle(s.glow.copy(alpha = 0.15f + 0.3f * v.level), r - 4, Offset(cx, cy), style = Stroke(8f))
    drawCircle(s.metal, r, Offset(cx, cy), style = Stroke(4f))
    for (a in 150..390 step 12) {
        val rad = Math.toRadians(a.toDouble())
        drawLine(s.panelInk, Offset(cx + cos(rad).toFloat() * 30, cy + sin(rad).toFloat() * 30), Offset(cx + cos(rad).toFloat() * 38, cy + sin(rad).toFloat() * 38), 1f)
    }
    val na = Math.toRadians((150 + 240 * v.pos).toDouble())
    drawLine(s.needle, Offset(cx, cy), Offset(cx + cos(na).toFloat() * 36, cy + sin(na).toFloat() * 36), 2f, StrokeCap.Round)
    drawCircle(s.panelInk, 4f, Offset(cx, cy))
    txt(tm, v.freqLabel, cx, cy + 14, 8f, s.panelInk)
    knob(tm, 61f, 331f, 22.4f, v.k("TUNE", Eras.angle(v.pos)), "Tune", s)
    knob(tm, 239f, 331f, 22.4f, v.k("VOLUME", Eras.angle(v.vol)), "Volume", s)
}

private fun DrawScope.valve(s: Eras.Skin, v: RadioVals, tm: TextMeasurer) {
    body(s, 0f, 0f, 340f, 346f, 26f, 14f)
    drawRoundRect(s.grilleBg, Offset(18f, 18f), Size(304f, 144f), CornerRadius(12f))
    for (i in 0 until 12) drawRoundRect(s.grille, Offset(34f, 32f + i * 8f), Size(272f, 3f), CornerRadius(2f))
    txt(tm, "VELVET", 170f, 130f, 15f, s.grille, spacing = 4.8f, weight = FontWeight.Normal)
    drawRoundRect(s.metal, Offset(18f, 18f), Size(304f, 144f), CornerRadius(12f), style = Stroke(2f))
    hdial(tm, 18f, 176f, 304f, 66f, v, s, 2f)
    knob(tm, 49f, 285f, 22.4f, v.k("TUNE", Eras.angle(v.pos)), "Tune", s)
    knob(tm, 291f, 285f, 22.4f, v.k("VOLUME", Eras.angle(v.vol)), "Volume", s)
    lamp(170f, 276f, 7f, s.glow, if (v.playing) 0.55f + 0.45f * v.level else 0f)
    txt(tm, "On air", 170f, 292f, 7.5f, s.metal, caps = true)
}

private fun DrawScope.transistor(s: Eras.Skin, v: RadioVals, tm: TextMeasurer) {
    drawRoundRect(s.metal, Offset(292f, 40f), Size(20f, 90f), CornerRadius(6f))         // the volume wheel on the side
    for (i in 0 until 14) drawLine(s.body2.copy(alpha = 0.5f), Offset(294f, 44f + i * 6f + ((v.vol * 5f + v.k("VOLUME", 0f) / 8f) % 6f + 6f) % 6f), Offset(310f, 44f + i * 6f + ((v.vol * 5f + v.k("VOLUME", 0f) / 8f) % 6f + 6f) % 6f), 1f)
    body(s, 0f, 0f, 300f, 270f, 18f, 18f)
    drawRoundRect(s.grilleBg, Offset(16f, 16f), Size(268f, 96f), CornerRadius(10f))
    for (row in 0 until 6) for (col in 0 until 19) drawCircle(s.grille, 3.5f, Offset(25f + col * 13.9f, 28f + row * 14.2f))
    drawRoundRect(s.metal, Offset(16f, 16f), Size(268f, 96f), CornerRadius(10f), style = Stroke(2f))
    txt(tm, "Velvet", 16f, 122f, 17f, s.metal, left = true, italic = true, weight = FontWeight.Normal)
    txt(tm, "7 TRANSISTOR", 76f, 128f, 9f, s.metal, left = true, spacing = 1.8f)
    lamp(279f, 134f, 5f, s.glow, if (v.playing) 0.5f + 0.5f * v.level else 0f)
    hdial(tm, 16f, 156f, 268f, 56f, v, s, 1.5f)
    // the thumb wheel: its ribs roll with the dial
    drawRoundRect(s.body2, Offset(16f, 226f), Size(120f, 26f), CornerRadius(13f))
    val off = ((v.pos * 60f + v.k("TUNE", 0f) / 6f) % 6f + 6f) % 6f
    var x = 18f + off; while (x < 134f) { drawLine(s.metal, Offset(x, 228f), Offset(x, 250f), 2.2f); x += 6f }
    drawRoundRect(s.metal, Offset(16f, 226f), Size(120f, 26f), CornerRadius(13f), style = Stroke(1f))
    txt(tm, "◀ Tune ▶", 284f, 233f, 7.5f, s.metal, caps = true)
}

private fun DrawScope.vu(tm: TextMeasurer, x: Float, y: Float, w: Float, h: Float, value: Float, label: String, s: Eras.Skin) {
    drawRect(s.panel, Offset(x, y), Size(w, h))
    drawRect(s.glow.copy(alpha = 0.18f), Offset(x, y), Size(w, h))
    val cx = x + w / 2; val cy = y + h * 0.95f; val r = h * 0.8f
    for (d in -50..50 step 10) {
        val rad = Math.toRadians((d - 90).toDouble())
        drawLine(if (d > 25) s.needle else s.panelInk, Offset(cx + cos(rad).toFloat() * r * 0.86f, cy + sin(rad).toFloat() * r * 0.86f),
            Offset(cx + cos(rad).toFloat() * r * 0.95f, cy + sin(rad).toFloat() * r * 0.95f), 1.2f)
    }
    val a = Math.toRadians((-50 + 100 * value - 90).toDouble())
    drawLine(s.panelInk, Offset(cx, cy), Offset(cx + cos(a).toFloat() * r * 0.93f, cy + sin(a).toFloat() * r * 0.93f), 1.6f)
    txt(tm, "VU", cx, y + h * 0.42f, 10f, s.panelInk, spacing = 3f)
    txt(tm, label, x + 5, y + h - 13, 7f, s.panelInk, left = true, caps = true)
}

private fun DrawScope.receiver(s: Eras.Skin, v: RadioVals, tm: TextMeasurer) {
    body(s, 0f, 0f, 340f, 300f, 6f, 6f)
    drawRect(s.metal, Offset(3f, 0f), Size(334f, 3f))
    vu(tm, 14f, 14f, 150f, 92f, v.vuL, "Left", s)
    vu(tm, 176f, 14f, 150f, 92f, v.vuR, "Right", s)
    hdial(tm, 14f, 118f, 312f, 64f, v, s, 1f)
    val angles = listOf(v.k("TUNE", Eras.angle(v.pos)), v.k("VOLUME", Eras.angle(v.vol)), v.k("BASS", Eras.angle(Eras.eqToKnob(v.bass))), v.k("TREBLE", Eras.angle(Eras.eqToKnob(v.treble))))
    listOf("Tuning", "Volume", "Bass", "Treble").forEachIndexed { i, l -> knob(tm, 14f + 312f * (i + 0.5f) / 4, 224f, 21.6f, angles[i], l, s) }
    listOf(s.needle, s.glow, Color(0xFF5BC46A)).forEachIndexed { i, c -> lamp(124f + i * 16f, 282f, 4f, c, if (v.playing) 1f else 0.15f) }
    txt(tm, "Stereo · Live", 176f, 276f, 7.5f, s.metal, left = true, caps = true)
}

private fun DrawScope.boombox(s: Eras.Skin, v: RadioVals, tm: TextMeasurer) {
    val handle = Path().apply { moveTo(40f, 22f); lineTo(40f, 10f); quadraticBezierTo(40f, 2f, 50f, 2f); lineTo(290f, 2f)
        quadraticBezierTo(300f, 2f, 300f, 10f); lineTo(300f, 22f) }
    drawPath(handle, s.metal, style = Stroke(4f))
    body(s, 0f, 14f, 340f, 170f, 14f, 14f)
    for (cx in listOf(64f, 276f)) {
        val p = 1f + 0.07f * v.level * (if (v.playing) 1f else 0f)   // the cones push out with the beat
        drawCircle(s.body2, 50f, Offset(cx, 78f))
        drawCircle(s.metal, 50f * 0.64f, Offset(cx, 78f), style = Stroke(2f))
        drawCircle(s.grille, 50f * 0.6f * p, Offset(cx, 78f))
        drawCircle(s.body2, 50f * 0.3f * p, Offset(cx, 78f))
        drawCircle(s.metal.copy(alpha = 0.6f), 50f, Offset(cx, 78f), style = Stroke(1.5f))
    }
    drawRect(s.panel, Offset(124f, 30f), Size(92f, 30f))
    drawRect(s.metal, Offset(124f, 30f), Size(92f, 30f), style = Stroke(2f))
    txt(tm, if (v.freqLabel.startsWith("CH")) v.freqLabel else "FM ${v.freqLabel}".take(9), 170f, 33f, 16f, s.panelInk, mono = true)
    drawRoundRect(s.body2, Offset(124f, 68f), Size(92f, 44f), CornerRadius(4f))
    drawRoundRect(s.metal, Offset(124f, 68f), Size(92f, 44f), CornerRadius(4f), style = Stroke(2f))
    for (cx in listOf(148f, 192f)) rotate(if (v.playing) v.t * 120f else 0f, Offset(cx, 90f)) {
        drawCircle(s.metal, 9f, Offset(cx, 90f), style = Stroke(3f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 3f))))
    }
    listOf("◀◀", "▶", "■", "▶▶").forEachIndexed { i, k ->
        drawRoundRect(s.metal, Offset(14f + i * 56f, 140f), Size(46f, 26f), CornerRadius(3f))
        txt(tm, k, 37f + i * 56f, 146f, 8f, s.body2)
    }
    val lit = (v.level * 10f).toInt()
    for (i in 0 until 8) drawRect(if (i < lit) (if (i > 5) s.needle else s.glow) else s.body2,
        Offset(258f + i * 9f, 166f - (8 + i * 3)), Size(6f, (8 + i * 3).toFloat()))
}

private fun DrawScope.digital(s: Eras.Skin, v: RadioVals, tm: TextMeasurer) {
    body(s, 0f, 0f, 340f, 300f, 8f, 8f)
    drawRoundRect(s.panel, Offset(14f, 14f), Size(312f, 104f), CornerRadius(5f))
    var gx = 14f; while (gx < 326f) { drawLine(s.panelInk.copy(alpha = 0.2f), Offset(gx, 14f), Offset(gx, 118f), 1f); gx += 30f }
    val wave = Path()
    for (i in 0..104) {
        val x = 14f + i * 3f
        val a = v.levels[(i * (Viz.N - 1)) / 104] * 40f + (if (v.playing) 3f else 0f)
        val y = 66f + a * sin(i / 5.5f + v.t * 3f)
        if (i == 0) wave.moveTo(x, y) else wave.lineTo(x, y)
    }
    drawPath(wave, s.glow, style = Stroke(2f))
    drawRoundRect(s.metal, Offset(14f, 14f), Size(312f, 104f), CornerRadius(5f), style = Stroke(1f))
    txt(tm, "${v.freqLabel}${if (v.freqLabel.startsWith("CH")) "" else " MHz"}", 318f, 19f, 10f, if (Palettes.luma(s.panel) > 0.5f) s.panelInk else s.glow, mono = true, right = true)
    for (k in 0 until 20) {
        val lvl = v.levels[(k * (Viz.N - 1)) / 19]
        val on = (lvl * 13f).toInt().coerceIn(if (v.playing) 1 else 0, 12)
        for (i in 0 until 12) drawRect(if (i < on) (if (i >= 10) s.needle else s.glow) else s.body2,
            Offset(14f + k * 15.6f + 2.3f, 210f - i * 7f), Size(11f, 5f))
    }
    val angles = listOf(v.k("BASS", Eras.angle(Eras.eqToKnob(v.bass))), v.k("MID", Eras.angle(Eras.eqToKnob(v.mid))), v.k("TREBLE", Eras.angle(Eras.eqToKnob(v.treble))), v.k("VOLUME", Eras.angle(v.vol)))
    listOf("Bass", "Mid", "Treble", "Volume").forEachIndexed { i, l -> knob(tm, 14f + 312f * (i + 0.5f) / 4, 255f, 20f, angles[i], l, s) }
}

// ------------------------------------------------------------------ Settings → Player look

@Composable
fun PlayerLookScreen(close: () -> Unit) {
    val ctx = LocalContext.current
    SubPage("Player look", close) {
        Text("How the big player looks. Needles, meters and lamps move with the music, and the knobs work: tuning changes the station, " +
            "volume is the phone's volume, bass and treble are the equaliser.", fontSize = 13.sp, color = Soft, lineHeight = 19.sp,
            modifier = Modifier.padding(top = 4.dp))
        SectionHead("Colours")
        Segmented(listOf("Original radio", "My colour theme"), if (Theme.lookColours == "original") 0 else 1) {
            Theme.lookColours = if (it == 0) "original" else "theme"; Theme.save(ctx) }
        Text("Original radio: walnut, bakelite, leather, aluminium… as the radio really was. My colour theme: the same radio in your " +
            "colour theme. Every look has a light and a dark page, following Settings → Appearance.", fontSize = 12.5.sp, color = Soft,
            lineHeight = 18.sp, modifier = Modifier.padding(top = 8.dp))
        SectionHead("Radio looks")
        BoxWithConstraints(Modifier.fillMaxWidth()) {
            val w = ((maxWidth.value - 2 * 12) / 3).coerceAtMost(124f)
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Eras.IDS.chunked(3).forEach { row ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        row.forEach { id -> LookTile(id, w) { Theme.look = id; Theme.save(ctx) } }
                    }
                }
            }
        }
    }
}

@Composable
private fun LookTile(id: String, w: Float, pick: () -> Unit) {
    val on = Theme.look == id
    val era = Eras.byId(id)
    val original = Theme.lookColours == "original"
    val bg = if (era != null && original) Eras.page(id, Theme.dark)!!.page else PlayerBg
    Column(Modifier.width(w.dp).semantics(mergeDescendants = true) { selected = on; role = Role.RadioButton }
        .clickable(onClickLabel = "Use ${era?.name ?: "Standard"}", onClick = pick)) {
        Box(Modifier.fillMaxWidth().height((w * 1.15f).dp).background(bg).border(if (on) 2.dp else 1.dp, if (on) AccentText else Line),
            contentAlignment = Alignment.Center) {
            if (era == null) Box(Modifier.size((w * 0.45f).dp).background(ArtBg), contentAlignment = Alignment.Center) {
                Text("◆", color = GoldC, fontSize = 14.sp) }
            else EraPicture(id, original, Modifier.fillMaxSize().padding(10.dp))
        }
        Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            if (on) Text("◆ ", color = GoldC, fontSize = 10.sp)
            Text(era?.name ?: "Standard", fontSize = 13.sp, color = if (on) AccentText else Title, fontWeight = if (on) FontWeight.Medium else FontWeight.Normal,
                maxLines = 1)
        }
        Text(era?.decade ?: "Today's player", fontSize = 11.sp, color = Soft)
    }
}
