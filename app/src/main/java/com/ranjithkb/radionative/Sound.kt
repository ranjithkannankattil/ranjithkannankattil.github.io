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

/** Applies the equaliser to the phone player's sound (headphones, speaker, Bluetooth, car). */
class EqEngine(private val ctx: Context) {
    private var eq: Equalizer? = null
    private var session = C.AUDIO_SESSION_ID_UNSET

    fun attach(sessionId: Int) {
        if (sessionId == session && eq != null) { apply(); return }
        release(); session = sessionId
        apply()
    }
    fun apply() {
        val on = Eq.on(ctx)
        if (!on) { eq?.enabled = false; return }
        if (session == C.AUDIO_SESSION_ID_UNSET || session == 0) return
        try {
            val e = eq ?: Equalizer(0, session).also { eq = it }
            val (lo, hi) = e.bandLevelRange.let { it[0].toInt() to it[1].toInt() }
            val b = Eq.bands(ctx)
            for (i in 0 until e.numberOfBands) {
                val hz = e.getCenterFreq(i.toShort()) / 1000
                val mb = (Eq.levelAt(hz, b) * 100).toInt().coerceIn(lo, hi)
                e.setBandLevel(i.toShort(), mb.toShort())
            }
            e.enabled = true
        } catch (t: Throwable) { release() }     // some phones don't allow it; the radio plays on unchanged
    }
    fun release() { try { eq?.release() } catch (_: Throwable) { }; eq = null }
}

/**
 * Visualiser: the player's own sound (a copy taken inside the app, so no microphone permission) turned into
 * 32 bars, about 30 times a second, only while the big player is on screen with the visualiser switched on.
 */
object Viz {
    const val N = 32
    @Volatile var watching = false
    @Volatile var bands = FloatArray(N)
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

/** ExoPlayer with the visualiser's copy of the sound. */
class VelvetRenderers(ctx: Context) : DefaultRenderersFactory(ctx) {
    override fun buildAudioSink(context: Context, enableFloatOutput: Boolean, enableAudioTrackPlaybackParams: Boolean): AudioSink =
        DefaultAudioSink.Builder(context).setAudioProcessors(arrayOf(TeeAudioProcessor(Viz.sink)))
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
            var quietSince = 0L
            delay(1500)
            while (true) {
                val now = System.currentTimeMillis()
                val p = player()
                if (p.playWhenReady || now - start > WINDOW_MS) break
                val busy = am.isMusicActive || inCall()
                if (busy) quietSince = 0L else if (quietSince == 0L) quietSince = now
                if (shouldResume(true, now - start, if (quietSince == 0L) 0 else now - quietSince, inCall(), false, p.mediaItemCount > 0)) {
                    p.prepare(); p.play(); break
                }
                delay(1000)
            }
            job = null
        }
    }
    /** The listener paused, chose another station or closed: forget about resuming. */
    fun cancel() { job?.cancel(); job = null }
}
