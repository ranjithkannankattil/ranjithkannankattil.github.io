package com.ranjithkb.radionative

import android.content.ComponentName
import android.content.Context
import android.media.AudioManager
import android.util.Log
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toPixelMap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.unit.dp
import androidx.media3.common.MediaItem
import androidx.media3.session.MediaBrowser
import androidx.media3.session.SessionToken
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.FixMethodOrder
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import java.util.concurrent.TimeUnit

/** The player looks on a real Android system: every radio draws, the knobs change station, volume and equaliser. */
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class EraDeviceTest {
    @get:Rule val rule = createAndroidComposeRule<androidx.activity.ComponentActivity>()
    private val inst = InstrumentationRegistry.getInstrumentation()
    private val ctx: Context = inst.targetContext
    private lateinit var b: MediaBrowser
    private val now = NowState(null)
    private var era by mutableStateOf(Eras.LIST[0])

    /** Lets the screen catch up: 0.8 s of frames. */
    private fun settle() = rule.mainClock.advanceTimeBy(800)
    private fun log(s: String) = Log.i("VELVET-TEST", s)
    private fun <T> main(block: () -> T): T { var r: Any? = null; inst.runOnMainSync { r = block() }; @Suppress("UNCHECKED_CAST") return r as T }
    private fun waitFor(ms: Long, what: String, cond: () -> Boolean): Boolean {
        val end = System.currentTimeMillis() + ms
        while (System.currentTimeMillis() < end) { if (main(cond)) return true; Thread.sleep(250) }
        log("timed out waiting for: $what"); return false
    }

    @Before fun connect() {
        b = main { MediaBrowser.Builder(ctx, SessionToken(ctx, ComponentName(ctx, PlaybackService::class.java))).buildAsync() }.get(20, TimeUnit.SECONDS)
        val list: List<MediaItem> = main { b.getChildren("col|english-news", 0, 500, null) }.get(40, TimeUnit.SECONDS).value!!.toList()
        main { b.setMediaItems(list, 2, 0); b.prepare(); b.play() }
        waitFor(25_000, "playing") { b.isPlaying }
        main { now.playing = b.isPlaying; now.md = b.mediaMetadata }
        rule.mainClock.autoAdvance = false     // the radio moves for as long as music plays; the test moves the clock itself
        rule.setContent { MaterialTheme { Surface { EraRadio(era, now, b, Modifier.fillMaxWidth().height(420.dp)) } } }
        settle()
    }
    @After fun done() { Eq.save(ctx, false, "Normal", Eq.PRESETS["Normal"]!!); main { b.pause(); b.release() } }

    @Test fun e01_every_radio_draws_original_and_theme_light_and_dark() {
        for (e in Eras.LIST) for (col in listOf("original", "theme")) for (dk in listOf(false, true)) {
            main { era = e; Theme.lookColours = col; Theme.mode = if (dk) "dark" else "light" }; settle()
            settle()
            val px = rule.onNodeWithContentDescription("${e.name} radio, ${e.decade}").captureToImage().toPixelMap()
            val colours = HashSet<Int>()
            for (y in 0 until px.height step 7) for (x in 0 until px.width step 7) colours.add(px[x, y].hashCode())
            log("${e.id} $col ${if (dk) "dark" else "light"}: ${px.width}x${px.height}, ${colours.size} colours")
            assertTrue("${e.id} $col draws a picture", colours.size > 12 && px.width > 300)
        }
        main { Theme.mode = "phone"; Theme.lookColours = "original" }
    }

    @Test fun e02_tuning_knob_changes_station_both_ways() {
        main { era = Eras.byId("receiver")!! }; settle()
        val start = main { b.currentMediaItemIndex }
        rule.onNodeWithContentDescription("Tuning knob", substring = true).performTouchInput { swipeRight(durationMillis = 300) }
        assertTrue("turning right tunes on", waitFor(6_000, "tune next") { b.currentMediaItemIndex > start })
        val after = main { b.currentMediaItemIndex }
        rule.onNodeWithContentDescription("Tuning knob", substring = true).performTouchInput { click(centerLeft + androidx.compose.ui.geometry.Offset(4f, 0f)) }
        assertTrue("tapping the left side tunes back", waitFor(6_000, "tune prev") { b.currentMediaItemIndex == after - 1 })
        log("tuning: $start -> $after -> ${main { b.currentMediaItemIndex }}")
        assertTrue("keeps playing after tuning", waitFor(25_000, "plays after tune") { b.isPlaying })
    }

    @Test fun e03_volume_knob_is_the_phone_volume() {
        main { era = Eras.byId("cathedral")!! }; settle()
        val am = ctx.getSystemService(AudioManager::class.java)
        am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC) / 2, 0)
        val v0 = am.getStreamVolume(AudioManager.STREAM_MUSIC)
        rule.onNodeWithContentDescription("Volume knob").performTouchInput { swipeUp(durationMillis = 300) }
        assertTrue("turning up is louder", waitFor(3_000, "louder") { am.getStreamVolume(AudioManager.STREAM_MUSIC) > v0 })
        rule.onNodeWithContentDescription("Volume knob").performTouchInput { click(centerLeft + androidx.compose.ui.geometry.Offset(4f, 0f)) }
        log("volume: $v0 -> ${am.getStreamVolume(AudioManager.STREAM_MUSIC)}")
        assertTrue("still playing", main { b.isPlaying })
    }

    @Test fun e04_bass_and_treble_knobs_are_the_equaliser_and_keep_playing() {
        main { era = Eras.byId("digital")!! }; settle()
        Eq.save(ctx, false, "Normal", Eq.PRESETS["Normal"]!!)
        rule.onNodeWithContentDescription("Bass knob").performTouchInput { swipeRight(durationMillis = 300) }
        settle()
        assertTrue("equaliser turned on", Eq.on(ctx)); assertTrue("bass raised", Eq.bands(ctx)[0] > 0)
        rule.onNodeWithContentDescription("Treble knob").performTouchInput { swipeLeft(durationMillis = 300) }
        settle()
        assertTrue("treble lowered", Eq.bands(ctx)[4] < 0)
        log("equaliser from knobs: ${Eq.bands(ctx).toList()} (${Eq.preset(ctx)})")
        Thread.sleep(1_500)
        assertTrue("still playing with knob equaliser", main { b.isPlaying })
    }

    @Test fun e05_boombox_keys() {
        main { era = Eras.byId("boombox")!! }; settle()
        val start = main { b.currentMediaItemIndex }
        rule.onNodeWithContentDescription("Next station").performClick()
        assertTrue("▶▶ next", waitFor(6_000, "next") { b.currentMediaItemIndex == start + 1 })
        rule.onNodeWithContentDescription("Previous station").performClick()
        assertTrue("◀◀ previous", waitFor(6_000, "prev") { b.currentMediaItemIndex == start })
        rule.onNodeWithContentDescription("Pause").performClick()
        assertTrue("■ pauses", waitFor(6_000, "pause") { !b.playWhenReady })
        rule.onNodeWithContentDescription("Play").performClick()
        assertTrue("▶ plays", waitFor(25_000, "play") { b.isPlaying })
    }

    @Test fun e06_meters_follow_the_music() {
        main { era = Eras.byId("receiver")!! }; settle()
        Thread.sleep(3_000)
        val fresh = System.currentTimeMillis() - Viz.stamp < 1_000
        log("radio meters get sound: fresh=$fresh peak=${Viz.peak}")
        assertTrue("the radio's meters receive the sound", fresh)
        assertTrue("watching while the radio is on screen", Viz.watching)
    }

    // ---- every control on every radio, both directions, taps, TalkBack actions, and the drawing following along
    private fun idx() = main { b.currentMediaItemIndex }
    private fun count() = main { b.mediaItemCount }
    /** For use inside waitFor (already on the main thread). */
    private fun moved(from: Int, steps: Int): Boolean { val n = b.mediaItemCount; val now = b.currentMediaItemIndex; return (now - from + n) % n == ((steps % n) + n) % n }
    private fun leftSide(): TouchInjectionScope.() -> Unit = { click(androidx.compose.ui.geometry.Offset(6f, centerY)) }
    private fun rightSide(): TouchInjectionScope.() -> Unit = { click(androidx.compose.ui.geometry.Offset(width - 6f, centerY)) }
    private fun action(node: SemanticsNodeInteraction, label: String) {
        val a = node.fetchSemanticsNode().config[androidx.compose.ui.semantics.SemanticsActions.CustomActions].first { it.label == label }
        main { a.action() }
    }
    private fun picture() = rule.onNode(hasContentDescription(" radio, ", substring = true)).captureToImage().toPixelMap()
    private fun differs(a: androidx.compose.ui.graphics.PixelMap, b: androidx.compose.ui.graphics.PixelMap): Int {
        var d = 0; for (y in 0 until minOf(a.height, b.height) step 2) for (x in 0 until minOf(a.width, b.width) step 2) if (a[x, y] != b[x, y]) d++; return d
    }

    @Test fun e07_every_knob_on_every_radio() {
        val am = ctx.getSystemService(AudioManager::class.java)
        val max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val expected = mapOf("cathedral" to listOf("Tuning", "Volume"), "valve" to listOf("Tuning", "Volume"), "transistor" to listOf("Tuning", "Volume"),
            "receiver" to listOf("Tuning", "Volume", "Bass", "Treble"), "boombox" to listOf("keys"), "digital" to listOf("Bass", "Mid", "Treble", "Volume"))
        for (e in Eras.LIST) {
            main { era = e }; settle()
            log("---- ${e.id}")
            for (k in expected[e.id]!!) when (k) {
                "Tuning" -> {
                    val n = rule.onNodeWithContentDescription("Tuning knob", substring = true)
                    var from = idx(); n.performTouchInput { swipeRight(durationMillis = 300) }
                    assertTrue("${e.id}: turn right tunes on", waitFor(6_000, "tune right") { b.currentMediaItemIndex != from })
                    val fwd = idx(); assertTrue("${e.id}: forwards", (fwd - from + count()) % count() in 1..4)
                    from = idx(); n.performTouchInput { swipeLeft(durationMillis = 300) }
                    assertTrue("${e.id}: turn left tunes back", waitFor(6_000, "tune left") { b.currentMediaItemIndex != from })
                    assertTrue("${e.id}: backwards", (from - idx() + count()) % count() in 1..4)
                    from = idx(); n.performTouchInput(rightSide()); assertTrue("${e.id}: tap right = next", waitFor(6_000, "tap r") { moved(from, 1) })
                    from = idx(); n.performTouchInput(leftSide()); assertTrue("${e.id}: tap left = previous", waitFor(6_000, "tap l") { moved(from, -1) })
                    from = idx(); action(n, "Next station"); assertTrue("${e.id}: TalkBack next", waitFor(6_000, "tb next") { moved(from, 1) })
                    from = idx(); action(n, "Previous station"); assertTrue("${e.id}: TalkBack previous", waitFor(6_000, "tb prev") { moved(from, -1) })
                    log("${e.id} tuning ok")
                }
                "Volume" -> {
                    val n = rule.onNodeWithContentDescription("Volume knob")
                    am.setStreamVolume(AudioManager.STREAM_MUSIC, max / 2, 0); settle()
                    var v = am.getStreamVolume(AudioManager.STREAM_MUSIC)
                    n.performTouchInput { swipeUp(durationMillis = 300) }; settle()
                    assertTrue("${e.id}: up = louder", am.getStreamVolume(AudioManager.STREAM_MUSIC) > v)
                    v = am.getStreamVolume(AudioManager.STREAM_MUSIC)
                    n.performTouchInput { swipeDown(durationMillis = 300) }; settle()
                    assertTrue("${e.id}: down = quieter", am.getStreamVolume(AudioManager.STREAM_MUSIC) < v)
                    v = am.getStreamVolume(AudioManager.STREAM_MUSIC)
                    n.performTouchInput(rightSide()); settle(); assertEquals("${e.id}: tap right +1", v + 1, am.getStreamVolume(AudioManager.STREAM_MUSIC))
                    n.performTouchInput(leftSide()); settle(); assertEquals("${e.id}: tap left -1", v, am.getStreamVolume(AudioManager.STREAM_MUSIC))
                    action(n, "Louder"); settle(); assertEquals("${e.id}: TalkBack louder", v + 1, am.getStreamVolume(AudioManager.STREAM_MUSIC))
                    // the phone's own volume buttons move the knob too
                    am.setStreamVolume(AudioManager.STREAM_MUSIC, 2, 0)
                    val pct = "${2 * 100 / max} percent"
                    var follows = false
                    repeat(10) { if (!follows) { Thread.sleep(300); settle()
                        follows = runCatching { rule.onNodeWithContentDescription("Volume knob").assert(androidx.compose.ui.test.SemanticsMatcher.expectValue(
                            androidx.compose.ui.semantics.SemanticsProperties.StateDescription, pct)); true }.getOrDefault(false) } }
                    assertTrue("${e.id}: knob follows the phone's volume ($pct)", follows)
                    am.setStreamVolume(AudioManager.STREAM_MUSIC, max / 2, 0)
                    log("${e.id} volume ok")
                }
                "keys" -> {
                    var from = idx(); rule.onNodeWithContentDescription("Next station").performClick()
                    assertTrue("▶▶", waitFor(6_000, "next") { moved(from, 1) })
                    from = idx(); rule.onNodeWithContentDescription("Previous station").performClick()
                    assertTrue("◀◀", waitFor(6_000, "prev") { moved(from, -1) })
                    rule.onNodeWithContentDescription("Pause").performClick(); assertTrue("■", waitFor(6_000, "pause") { !b.playWhenReady })
                    rule.onNodeWithContentDescription("Play").performClick(); assertTrue("▶", waitFor(25_000, "play") { b.isPlaying })
                    log("boombox keys ok")
                }
                else -> {
                    val band = mapOf("Bass" to 0, "Mid" to 2, "Treble" to 4)[k]!!
                    Eq.save(ctx, false, "Normal", Eq.PRESETS["Normal"]!!)
                    main { era = Eras.LIST[0] }; settle(); main { era = e }; settle()   // reread the equaliser
                    val n = rule.onNodeWithContentDescription("$k knob")
                    n.performTouchInput { swipeRight(durationMillis = 300) }; settle()
                    val up = Eq.bands(ctx)[band]
                    assertTrue("${e.id}: $k up turns the equaliser on and raises it ($up)", Eq.on(ctx) && up > 0)
                    assertTrue("${e.id}: $k only moves its own band", Eq.bands(ctx).filterIndexed { i, _ -> i != band }.all { it == 0 })
                    n.performTouchInput { swipeLeft(durationMillis = 300) }; n.performTouchInput { swipeLeft(durationMillis = 300) }; settle()
                    assertTrue("${e.id}: $k down lowers it", Eq.bands(ctx)[band] < up)
                    val v = Eq.bands(ctx)[band]
                    n.performTouchInput(rightSide()); settle(); assertEquals("${e.id}: $k tap +2", (v + 2).coerceAtMost(12), Eq.bands(ctx)[band])
                    action(n, "Less $k"); settle(); assertEquals("${e.id}: $k TalkBack less", v, Eq.bands(ctx)[band])
                    repeat(10) { n.performTouchInput { swipeRight(durationMillis = 200) } }; settle()
                    assertEquals("${e.id}: $k stops at +12", 12, Eq.bands(ctx)[band])
                    Thread.sleep(800); assertTrue("${e.id}: still playing after $k", main { b.isPlaying })
                    Eq.save(ctx, false, "Normal", Eq.PRESETS["Normal"]!!)
                    log("${e.id} $k ok")
                }
            }
        }
    }

    @Test fun e08_the_drawn_knob_turns() {
        val am = ctx.getSystemService(AudioManager::class.java)
        main { era = Eras.byId("valve")!!; b.pause() }; settle(); settle()
        main { now.playing = false }
        am.setStreamVolume(AudioManager.STREAM_MUSIC, 1, 0)
        Thread.sleep(2_500); settle()
        val before = picture()
        am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0)
        Thread.sleep(1_000); settle()
        val after = picture()
        val d = differs(before, after)
        log("volume knob redraw: $d pixels changed")
        assertTrue("the volume pointer moved on the picture", d > 20)
        val still = picture(); assertEquals("nothing else moves while paused", 0, differs(after, still))
        am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC) / 2, 0)
    }

    /** A finger going round the knob, [deg] degrees (clockwise +), close to its edge. */
    private fun turnRound(node: SemanticsNodeInteraction, deg: Float) = node.performTouchInput {
        val r = minOf(width, height) * 0.38f; val n = 24
        val pt = { a: Float -> center + androidx.compose.ui.geometry.Offset(r * kotlin.math.cos(Math.toRadians(a.toDouble())).toFloat(), r * kotlin.math.sin(Math.toRadians(a.toDouble())).toFloat()) }
        down(pt(-90f)); for (k in 1..n) { moveTo(pt(-90f + deg * k / n), delayMillis = 16) }; up()
    }

    @Test fun e09_turning_knobs_round_like_real_ones() {
        val am = ctx.getSystemService(AudioManager::class.java)
        // tuning: a half turn clockwise moves on, anticlockwise comes back
        for (id in listOf("cathedral", "valve", "receiver")) {
            main { era = Eras.byId(id)!! }; settle()
            val n = rule.onNodeWithContentDescription("Tuning knob", substring = true)
            var from = idx(); turnRound(n, 120f); settle()
            assertTrue("$id: turning round clockwise tunes on", waitFor(6_000, "round next") { b.currentMediaItemIndex != from })
            val fwd = (idx() - from + count()) % count(); assertTrue("$id: 120° = about 3 stations, got $fwd", fwd in 2..4)
            from = idx(); turnRound(n, -80f); settle()
            assertTrue("$id: anticlockwise tunes back", waitFor(6_000, "round prev") { b.currentMediaItemIndex != from })
            assertTrue("$id: backwards", (from - idx() + count()) % count() in 1..3)
            log("$id tuning by turning round ok")
        }
        // volume: clockwise louder, anticlockwise quieter
        for (id in listOf("cathedral", "valve", "receiver", "digital")) {
            main { era = Eras.byId(id)!! }; settle()
            am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC) / 2, 0); settle()
            val v0 = am.getStreamVolume(AudioManager.STREAM_MUSIC)
            turnRound(rule.onNodeWithContentDescription("Volume knob"), 90f); settle()
            assertTrue("$id: turning round clockwise is louder", am.getStreamVolume(AudioManager.STREAM_MUSIC) > v0)
            val v1 = am.getStreamVolume(AudioManager.STREAM_MUSIC)
            turnRound(rule.onNodeWithContentDescription("Volume knob"), -120f); settle()
            assertTrue("$id: anticlockwise is quieter", am.getStreamVolume(AudioManager.STREAM_MUSIC) < v1)
            log("$id volume by turning round ok: $v0 -> $v1 -> ${am.getStreamVolume(AudioManager.STREAM_MUSIC)}")
        }
        // bass on the digital tuner: a quarter turn = several dB
        main { era = Eras.byId("digital")!! }; settle()
        Eq.save(ctx, false, "Normal", Eq.PRESETS["Normal"]!!); main { era = Eras.LIST[0] }; settle(); main { era = Eras.byId("digital")!! }; settle()
        turnRound(rule.onNodeWithContentDescription("Bass knob"), 90f); settle()
        val bass = Eq.bands(ctx)[0]
        assertTrue("a quarter turn of bass raises it by several dB ($bass)", bass in 5..12)
        turnRound(rule.onNodeWithContentDescription("Bass knob"), -90f); settle()
        assertTrue("and back down", Eq.bands(ctx)[0] < bass)
        assertTrue("still playing", main { b.isPlaying })
        Eq.save(ctx, false, "Normal", Eq.PRESETS["Normal"]!!)
    }
}
