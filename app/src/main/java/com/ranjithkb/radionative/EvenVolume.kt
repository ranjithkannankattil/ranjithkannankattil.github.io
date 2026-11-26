package com.ranjithkb.radionative

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.log10
import kotlin.math.pow
import kotlin.math.sqrt
import kotlin.math.tanh

/**
 * Even volume (tester's idea, 25 Nov 2026: "each station has a different volume; keep it the same when changing").
 * Settings → Sound → Even volume, on by default.
 *  - While a station plays, its loudness is followed slowly (about 6 seconds) and the sound is brought towards one
 *    level, never more than ±10 dB, and so gently that music doesn't "breathe".
 *  - Each station's usual level is remembered on the phone, so the next time it starts at the right volume at once.
 *  - A soft limiter keeps loud songs from distorting.
 * The maths is pure ([Leveller]) so it can be tested without a phone.
 */
object EvenVolume {
    @Volatile var on = true
    @Volatile private var key: String? = null
    private val levels = java.util.concurrent.ConcurrentHashMap<String, Float>()
    @Volatile internal var leveller = Leveller()
    private var loaded = false

    private fun p(ctx: Context) = ctx.getSharedPreferences("evenvolume", Context.MODE_PRIVATE)

    fun load(ctx: Context) {
        on = Theme.prefs(ctx).getBoolean("evenVolume", true)
        if (loaded) return
        loaded = true
        runCatching { val j = JSONObject(p(ctx).getString("levels", "{}")!!); j.keys().forEach { levels[it] = j.getDouble(it).toFloat() } }
    }

    /** A new station starts: remember the last one's level and start this one from its own remembered level. */
    fun switchTo(ctx: Context, newKey: String?) {
        load(ctx)
        val old = key
        if (old != null && leveller.heard) levels[old] = leveller.loudness
        key = newKey
        leveller.startAt(newKey?.let { levels[it] })
        if (levels.size > 400) levels.keys.take(levels.size - 400).forEach { levels.remove(it) }
        p(ctx).edit().putString("levels", JSONObject(levels.mapValues { it.value.toDouble() }).toString()).apply()
    }

    fun set(ctx: Context, v: Boolean) { on = v; Theme.prefs(ctx).edit().putBoolean("evenVolume", v).apply() }
}

/** Pure: follows loudness (dBFS) and works out the gain for each block of sound. */
class Leveller(private val target: Float = -18f, private val maxDb: Float = 10f, private val tau: Float = 6f) {
    var loudness = target; private set
    var heard = false; private set
    var gainDb = 0f; private set

    fun startAt(level: Float?) { heard = level != null; loudness = level ?: target; gainDb = (target - loudness).coerceIn(-maxDb, maxDb) }

    /** One block: its RMS level in dBFS and how many seconds it lasts. Returns the gain (dB) to use for it. */
    fun block(rmsDb: Float, seconds: Float): Float {
        if (rmsDb > -50f) {                               // ignore silence and talk pauses
            val a = (seconds / (if (heard) tau else 1.5f)).coerceAtMost(1f)   // first seconds of a new station: settle faster
            loudness += (rmsDb - loudness) * a; heard = true
        }
        val want = (target - loudness).coerceIn(-maxDb, maxDb)
        gainDb += (want - gainDb) * (seconds / 2f).coerceAtMost(1f)          // glide, never jump
        return gainDb
    }

    companion object {
        /** Soft limiter for one sample (-1..1 after gain): untouched up to 0.9, then rounded off below 1. */
        fun limit(y: Float): Float { val a = abs(y); return if (a <= 0.9f) y else Math.copySign(0.9f + 0.1f * tanh((a - 0.9f) / 0.1f).toFloat(), y) }
    }
}

/** The audio step in the player: 16-bit sound in, levelled sound out. Passes sound through untouched when off. */
class EvenVolumeProcessor : BaseAudioProcessor() {
    private var rate = 44100; private var channels = 2

    override fun onConfigure(input: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
        if (input.encoding != C.ENCODING_PCM_16BIT) return AudioProcessor.AudioFormat.NOT_SET
        rate = input.sampleRate; channels = input.channelCount
        return input
    }

    override fun queueInput(inputBuffer: ByteBuffer) {
        val n = inputBuffer.remaining()
        if (n == 0) return
        val out = replaceOutputBuffer(n)
        val inp = inputBuffer.order(ByteOrder.LITTLE_ENDIAN)
        if (!EvenVolume.on) { out.put(inp); out.flip(); return }
        val start = inp.position(); val samples = n / 2
        var sum = 0.0
        for (i in 0 until samples) { val v = inp.getShort(start + i * 2) / 32768.0; sum += v * v }
        val rms = sqrt(sum / samples.coerceAtLeast(1))
        val db = if (rms <= 1e-7) -120f else (20 * log10(rms)).toFloat()
        val g = 10.0.pow(EvenVolume.leveller.block(db, samples.toFloat() / channels / rate) / 20.0).toFloat()
        out.order(ByteOrder.LITTLE_ENDIAN)
        for (i in 0 until samples) {
            val y = Leveller.limit(inp.getShort(start + i * 2) / 32768f * g)
            out.putShort((y * 32767f).toInt().coerceIn(-32768, 32767).toShort())
        }
        inp.position(inp.limit())
        out.flip()
    }
}
