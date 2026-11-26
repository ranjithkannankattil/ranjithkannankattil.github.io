package com.ranjithkb.radionative

import android.content.Context
import android.media.AudioManager
import android.media.audiofx.Equalizer
import androidx.media3.common.C
import androidx.media3.common.Player
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.exoplayer.audio.TeeAudioProcessor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.ln
import kotlin.math.sqrt

/** Equaliser settings: off by default; presets and five bands (dB, -12..+12). Applied by the player service. */
object Eq {
    val FREQS = intArrayOf(60, 230, 910, 3600, 14000)
    val PRESETS = linkedMapOf(
        "Normal" to intArrayOf(0, 0, 0, 0, 0),
        "Voice & news" to intArrayOf(-3, -1, 3, 4, 1),
        "Bass boost" to intArrayOf(6, 4, 0, 0, 0),
        "Music" to intArrayOf(3, 1, 0, 2, 2),
        "Classical" to intArrayOf(3, 2, -1, 2, 3),
        "Small speaker" to intArrayOf(-4, -1, 2, 4, 3))
    private fun p(ctx: Context) = ctx.getSharedPreferences("settings", Context.MODE_PRIVATE)
    fun on(ctx: Context) = p(ctx).getBoolean("eqOn", false)
    fun preset(ctx: Context) = p(ctx).getString("eqPreset", "Normal")!!
    fun bands(ctx: Context): IntArray = p(ctx).getString("eqBands", null)?.split(',')?.mapNotNull { it.trim().toIntOrNull()?.coerceIn(-12, 12) }
        ?.takeIf { it.size == 5 }?.toIntArray() ?: (PRESETS[preset(ctx)] ?: PRESETS["Normal"]!!).copyOf()
    fun save(ctx: Context, on: Boolean, preset: String, bands: IntArray) =
        p(ctx).edit().putBoolean("eqOn", on).putString("eqPreset", preset).putString("eqBands", bands.joinToString(",")).apply()

    /** Level (dB) for any frequency, read off the five bands on a log scale. */
    fun levelAt(hz: Int, bands: IntArray): Float {
        val x = ln(hz.coerceAtLeast(1).toFloat())
        val xs = FREQS.map { ln(it.toFloat()) }
        if (x <= xs.first()) return bands.first().toFloat()
        if (x >= xs.last()) return bands.last().toFloat()
        val i = xs.indexOfLast { it <= x }
        val t = (x - xs[i]) / (xs[i + 1] - xs[i])
        return bands[i] + (bands[i + 1] - bands[i]) * t
    }
}

/**
 * Applies the equaliser to the phone player's sound (headphones, speaker, Bluetooth, car).
 *
 * Uses Android's DynamicsProcessing (Android 9+): exact gains with no hidden volume drop, so "Normal" sounds
 * exactly like the equaliser being off (it is switched off then: the sound passes through untouched).
 * Boosts go through a gentle limiter instead of turning everything down. Every change glides over about
 * a quarter of a second instead of jumping, so moving a slider or picking a preset never clicks or drops out.
 * Older phones (Android 8) fall back to the basic Equalizer, also bypassed on "Normal".
 */
class EqEngine(private val ctx: Context) {
    companion object {
        /** Upper edges of the 10 bands the five sliders are spread over (Hz). */
        val EDGES = floatArrayOf(45f, 90f, 180f, 355f, 710f, 1400f, 2800f, 5600f, 11200f, 20000f)
        /** Middle of each band, where the five-slider curve is read. */
        val CENTRES = intArrayOf(32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000)
        const val STEP_MS = 16L
        const val GLIDE_MS = 240f
        /** The gains (dB) for each band, from the five sliders; all zeros means "leave the sound alone". */
        fun target(on: Boolean, bands: IntArray): FloatArray =
            if (!on) FloatArray(CENTRES.size) else FloatArray(CENTRES.size) { Eq.levelAt(CENTRES[it], bands) }
        fun flat(g: FloatArray) = g.all { kotlin.math.abs(it) < 0.05f }
        /** One glide step from [cur] towards [to]: a fixed share of the way, so every change takes the same time. */
        fun step(cur: FloatArray, to: FloatArray, start: FloatArray, elapsedMs: Float): FloatArray {
            val t = (elapsedMs / GLIDE_MS).coerceIn(0f, 1f)
            val e = t * t * (3 - 2 * t)   // smooth start and end
            return FloatArray(cur.size) { start[it] + (to[it] - start[it]) * e }
        }
    }

    private val main = android.os.Handler(android.os.Looper.getMainLooper())
    private var session = C.AUDIO_SESSION_ID_UNSET
    private var dp: android.media.audiofx.DynamicsProcessing? = null
    private var legacy: Equalizer? = null
    private var cur = FloatArray(CENTRES.size)
    private var from = FloatArray(CENTRES.size)
    private var to = FloatArray(CENTRES.size)
    private var startedAt = 0L
    private var gliding = false

    fun attach(sessionId: Int) {
        if (sessionId == session) { apply(); return }
        release(); session = sessionId; cur = FloatArray(CENTRES.size)
        apply()
    }

    /** Read the settings and glide to them. Called often (every slider move); cheap. */
    fun apply() {
        main.removeCallbacks(debounced); main.postDelayed(debounced, 30)
    }
    private val debounced = Runnable {
        to = target(Eq.on(ctx), Eq.bands(ctx))
        if (session == C.AUDIO_SESSION_ID_UNSET || session == 0) return@Runnable
        if (flat(to) && flat(cur) && !gliding) { bypass(); return@Runnable }
        if (!ensure()) return@Runnable
        from = cur.copyOf(); startedAt = android.os.SystemClock.uptimeMillis()
        if (!gliding) { gliding = true; main.post(tick) }
    }
    private val tick = object : Runnable {
        override fun run() {
            val el = (android.os.SystemClock.uptimeMillis() - startedAt).toFloat()
            cur = step(cur, to, from, el)
            push(cur)
            if (el < GLIDE_MS) main.postDelayed(this, STEP_MS)
            else { cur = to.copyOf(); push(cur); gliding = false; if (flat(cur)) bypass() }
        }
    }

    /** Make sure the effect exists and is switched on. False if this phone won't allow it (the radio plays on unchanged). */
    private fun ensure(): Boolean {
        try {
            if (android.os.Build.VERSION.SDK_INT >= 28) {
                val d = dp ?: run {
                    val eq = android.media.audiofx.DynamicsProcessing.Eq(true, true, EDGES.size)
                    EDGES.forEachIndexed { i, f -> eq.setBand(i, android.media.audiofx.DynamicsProcessing.EqBand(true, f, 0f)) }
                    // limiter only catches peaks from boosts (no squashing of normal sound): -1 dB ceiling, fast attack, gentle release
                    val lim = android.media.audiofx.DynamicsProcessing.Limiter(true, true, 0, 1f, 80f, 10f, -1f, 0f)
                    val cfg = android.media.audiofx.DynamicsProcessing.Config.Builder(
                        android.media.audiofx.DynamicsProcessing.VARIANT_FAVOR_FREQUENCY_RESOLUTION, 2,
                        true, EDGES.size, false, 0, false, 0, true)
                        .setPreEqAllChannelsTo(eq).setLimiterAllChannelsTo(lim).build()
                    android.media.audiofx.DynamicsProcessing(0, session, cfg).also { dp = it; push(cur) }
                }
                if (!d.enabled) d.enabled = true
            } else {
                val e = legacy ?: Equalizer(0, session).also { legacy = it }
                if (!e.enabled) e.enabled = true
            }
            return true
        } catch (t: Throwable) { release(); return false }
    }

    private fun push(g: FloatArray) {
        try {
            dp?.let { d -> g.forEachIndexed { i, v ->
                d.setPreEqBandAllChannelsTo(i, android.media.audiofx.DynamicsProcessing.EqBand(true, EDGES[i], v)) } }
            legacy?.let { e ->
                val (lo, hi) = e.bandLevelRange.let { it[0].toInt() to it[1].toInt() }
                for (i in 0 until e.numberOfBands) {
                    val hz = e.getCenterFreq(i.toShort()) / 1000
                    val k = CENTRES.indices.minBy { kotlin.math.abs(kotlin.math.ln(CENTRES[it].toFloat() / hz.coerceAtLeast(1))) }
                    e.setBandLevel(i.toShort(), (g[k] * 100).toInt().coerceIn(lo, hi).toShort())
                }
            }
        } catch (t: Throwable) { }
    }

    /** Flat: switch the effect off so the sound passes through exactly as broadcast. */
    private fun bypass() {
        try { dp?.enabled = false } catch (_: Throwable) { }
        try { legacy?.enabled = false } catch (_: Throwable) { }
    }

    fun release() {
        main.removeCallbacks(debounced); main.removeCallbacks(tick); gliding = false
        try { dp?.release() } catch (_: Throwable) { }; dp = null
        try { legacy?.release() } catch (_: Throwable) { }; legacy = null
    }
}

/**
 * Visualiser: the player's own sound (a copy taken inside the app, so no microphone permission) turned into
 * 32 bars, about 30 times a second, only while the big player is on screen with the visualiser switched on.
 */
object Viz {
    const val N = 32
    @Volatile var watching = false
    @Volatile var bands = FloatArray(N)
    @Volatile var peak = 0f                   // loudest sample in the last frame (0..1), for checks
    @Volatile var stamp = 0L                  // when the last real sound frame came in (0 = never; casting has none)
    private var rate = 44100; private var channels = 2; private var pcm16 = true
    private val buf = FloatArray(1024); private var fill = 0
    private var last = 0L

    val sink = object : TeeAudioProcessor.AudioBufferSink {
        override fun flush(sampleRateHz: Int, channelCount: Int, encoding: Int) {
            rate = sampleRateHz; channels = channelCount.coerceAtLeast(1); pcm16 = encoding == C.ENCODING_PCM_16BIT; fill = 0
        }
        override fun handleBuffer(buffer: ByteBuffer) {
            if (!watching || !pcm16) return
            val b = buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN)
            val frames = b.remaining() / (2 * channels)
            for (f in 0 until frames) {
                var s = 0f
                for (c in 0 until channels) s += b.short.toFloat()
                buf[fill++] = s / (channels * 32768f)
                if (fill == buf.size) { fill = 0; val now = System.currentTimeMillis(); if (now - last >= 33) { last = now; analyse() } }
            }
        }
    }

    private fun analyse() {
        val n = buf.size
        peak = buf.maxOf { kotlin.math.abs(it) }
        val re = FloatArray(n) { buf[it] * (0.5f - 0.5f * kotlin.math.cos(2 * Math.PI * it / (n - 1)).toFloat()) }
        val im = FloatArray(n)
        fft(re, im)
        bands = toBands(re, im, rate)
        stamp = System.currentTimeMillis()
    }

    /** 32 bands spread on a log scale from 40 Hz to 16 kHz, each 0..1, smoothed. */
    internal fun toBands(re: FloatArray, im: FloatArray, sampleRate: Int): FloatArray {
        val n = re.size; val out = FloatArray(N); val old = bands
        val lo = ln(40.0); val hi = ln(16000.0.coerceAtMost(sampleRate / 2.0 - 1))
        for (k in 0 until N) {
            val f0 = kotlin.math.exp(lo + (hi - lo) * k / N); val f1 = kotlin.math.exp(lo + (hi - lo) * (k + 1) / N)
            val a = (f0 * n / sampleRate).toInt().coerceIn(1, n / 2 - 1); val z = (f1 * n / sampleRate).toInt().coerceIn(a, n / 2 - 1)
            var m = 0f
            for (i in a..z) m = maxOf(m, sqrt(re[i] * re[i] + im[i] * im[i]))
            val db = 20 * kotlin.math.log10((m / (n / 4f)).coerceAtLeast(1e-6f))      // about -60..0 dB
            val v = ((db + 60f) / 60f).coerceIn(0f, 1f)
            out[k] = if (v > old.getOrElse(k) { 0f }) v else old.getOrElse(k) { 0f } * 0.82f + v * 0.18f     // fast up, slow fall
        }
        return out
    }

    internal fun fft(re: FloatArray, im: FloatArray) {
        val n = re.size
        var j = 0
        for (i in 1 until n) { var bit = n shr 1; while (j and bit != 0) { j = j xor bit; bit = bit shr 1 }; j = j xor bit
            if (i < j) { var t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t } }
        var len = 2
        while (len <= n) {
            val ang = -2 * Math.PI / len; val wr = kotlin.math.cos(ang).toFloat(); val wi = kotlin.math.sin(ang).toFloat()
            var i = 0
            while (i < n) {
                var cr = 1f; var ci = 0f
                for (k in 0 until len / 2) {
                    val ur = re[i + k]; val ui = im[i + k]
                    val vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci; val vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr
                    re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi
                    val nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr
                }
                i += len
            }
            len = len shl 1
        }
    }
}

/** Next / previous station from the phone app and the widget: always moves, and wraps round at the ends of the list
 *  (the car's buttons already do, in the player service). */
fun androidx.media3.common.Player.nextStation() { val n = mediaItemCount; if (n > 1) seekToDefaultPosition((currentMediaItemIndex + 1) % n) }
fun androidx.media3.common.Player.prevStation() { val n = mediaItemCount; if (n > 1) seekToDefaultPosition((currentMediaItemIndex - 1 + n) % n) }

/** ExoPlayer with the visualiser's copy of the sound. */
class VelvetRenderers(ctx: Context) : DefaultRenderersFactory(ctx) {
    override fun buildAudioSink(context: Context, enableFloatOutput: Boolean, enableAudioTrackPlaybackParams: Boolean): AudioSink =
        DefaultAudioSink.Builder(context).setAudioProcessors(arrayOf(EvenVolumeProcessor(), TeeAudioProcessor(Viz.sink)))
            .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams).build()
}

/**
 * Carry on after another app's sound: when a video (Facebook, WhatsApp, YouTube…) takes the sound for good,
 * Android stops the radio. If the listener didn't pause it themselves, start again once the phone has been quiet
 * for a few seconds, only within 10 minutes, and never while a call is on.
 */
class ResumeWatcher(private val ctx: Context, private val scope: CoroutineScope, private val player: () -> Player) {
    private var job: Job? = null
    private val am = ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    /** Pure decision, so it can be tested: should the radio start again now? */
    companion object {
        const val WINDOW_MS = 10 * 60_000L
        const val QUIET_MS = 4_000L
        const val LONG_MS = 5 * 60_000L
        fun shouldResume(enabled: Boolean, elapsed: Long, quietFor: Long, inCall: Boolean, userPaused: Boolean, hasItem: Boolean) =
            enabled && !userPaused && hasItem && !inCall && elapsed <= WINDOW_MS && quietFor >= QUIET_MS
    }

    fun inCall() = am.mode == AudioManager.MODE_IN_CALL || am.mode == AudioManager.MODE_IN_COMMUNICATION || am.mode == AudioManager.MODE_RINGTONE

    /** Called when the player stops because another app took the sound for good. */
    fun lostForGood() {
        if (!Theme.prefs(ctx).getBoolean("resume", true)) return
        job?.cancel()
        val start = System.currentTimeMillis()
        job = scope.launch {
            var quietSince = 0L; var busySince = 0L
            delay(1500)
            while (true) {
                val now = System.currentTimeMillis()
                val p = player()
                if (p.playWhenReady || now - start > WINDOW_MS) break
                val busy = am.isMusicActive || inCall()
                if (busy) { quietSince = 0L; if (busySince == 0L) busySince = now } else { busySince = 0L; if (quietSince == 0L) quietSince = now }
                // another app playing for more than 5 minutes is the listener's choice (music, a film): don't come back over it later
                if (busySince != 0L && now - busySince > LONG_MS) break
                if (shouldResume(true, now - start, if (quietSince == 0L) 0 else now - quietSince, inCall(), false, p.mediaItemCount > 0)) {
                    PlayLog.who = "resume-after-other-app"; p.prepare(); p.play(); break
                }
                delay(1000)
            }
            job = null
        }
    }
    /** The listener paused, chose another station or closed: forget about resuming. */
    fun cancel() { job?.cancel(); job = null }
}
