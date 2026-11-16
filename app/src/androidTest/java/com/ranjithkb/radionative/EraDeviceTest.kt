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
        rule.setContent { MaterialTheme { Surface { EraRadio(era, now, b, Modifier.fillMaxWidth().height(420.dp)) } } }
    }
    @After fun done() { Eq.save(ctx, false, "Normal", Eq.PRESETS["Normal"]!!); main { b.pause(); b.release() } }

    @Test fun e01_every_radio_draws_original_and_theme_light_and_dark() {
        for (e in Eras.LIST) for (col in listOf("original", "theme")) for (dk in listOf(false, true)) {
            main { era = e; Theme.lookColours = col; Theme.mode = if (dk) "dark" else "light" }
            rule.waitForIdle()
            val px = rule.onNodeWithContentDescription("${e.name} radio, ${e.decade}").captureToImage().toPixelMap()
            val colours = HashSet<Int>()
            for (y in 0 until px.height step 7) for (x in 0 until px.width step 7) colours.add(px[x, y].hashCode())
            log("${e.id} $col ${if (dk) "dark" else "light"}: ${px.width}x${px.height}, ${colours.size} colours")
            assertTrue("${e.id} $col draws a picture", colours.size > 12 && px.width > 300)
        }
        main { Theme.mode = "phone"; Theme.lookColours = "original" }
    }

    @Test fun e02_tuning_knob_changes_station_both_ways() {
        main { era = Eras.byId("receiver")!! }
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
        main { era = Eras.byId("cathedral")!! }
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
        main { era = Eras.byId("digital")!! }
        Eq.save(ctx, false, "Normal", Eq.PRESETS["Normal"]!!)
        rule.onNodeWithContentDescription("Bass knob").performTouchInput { swipeRight(durationMillis = 300) }
        rule.waitForIdle()
        assertTrue("equaliser turned on", Eq.on(ctx)); assertTrue("bass raised", Eq.bands(ctx)[0] > 0)
        rule.onNodeWithContentDescription("Treble knob").performTouchInput { swipeLeft(durationMillis = 300) }
        rule.waitForIdle()
        assertTrue("treble lowered", Eq.bands(ctx)[4] < 0)
        log("equaliser from knobs: ${Eq.bands(ctx).toList()} (${Eq.preset(ctx)})")
        Thread.sleep(1_500)
        assertTrue("still playing with knob equaliser", main { b.isPlaying })
    }

    @Test fun e05_boombox_keys() {
        main { era = Eras.byId("boombox")!! }
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
        main { era = Eras.byId("receiver")!! }
        Thread.sleep(3_000)
        val fresh = System.currentTimeMillis() - Viz.stamp < 1_000
        log("radio meters get sound: fresh=$fresh peak=${Viz.peak}")
        assertTrue("the radio's meters receive the sound", fresh)
        assertTrue("watching while the radio is on screen", Viz.watching)
    }
}
