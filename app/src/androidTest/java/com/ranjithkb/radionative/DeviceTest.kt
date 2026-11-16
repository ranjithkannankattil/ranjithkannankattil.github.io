package com.ranjithkb.radionative

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.os.Bundle
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.session.MediaBrowser
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionToken
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.FixMethodOrder
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.MethodSorters
import java.util.concurrent.TimeUnit

/**
 * The real app on a real Android system (emulator): the player service as Android Auto and the phone app use it,
 * real streams over the internet, losing the signal, another app taking the sound, the alarm, the widget,
 * the equaliser and visualiser, car pictures and crash reports. Each step logs "VELVET-TEST" lines.
 */
@RunWith(AndroidJUnit4::class)
@FixMethodOrder(MethodSorters.NAME_ASCENDING)
class DeviceTest {
    private val inst = InstrumentationRegistry.getInstrumentation()
    private val ctx: Context = inst.targetContext
    private lateinit var b: MediaBrowser

    private fun log(s: String) = Log.i("VELVET-TEST", s)
    private fun <T> main(block: () -> T): T { var r: Any? = null; inst.runOnMainSync { r = block() }; @Suppress("UNCHECKED_CAST") return r as T }
    private fun waitFor(ms: Long, what: String, cond: () -> Boolean): Boolean {
        val end = System.currentTimeMillis() + ms
        while (System.currentTimeMillis() < end) { if (main(cond)) return true; Thread.sleep(250) }
        log("timed out waiting for: $what"); return false
    }
    private fun shell(cmd: String): String = inst.uiAutomation.executeShellCommand(cmd).let { pfd ->
        android.os.ParcelFileDescriptor.AutoCloseInputStream(pfd).bufferedReader().use { it.readText() } }

    @Before fun connect() {
        val tok = SessionToken(ctx, ComponentName(ctx, PlaybackService::class.java))
        b = main { MediaBrowser.Builder(ctx, tok).buildAsync() }.get(20, TimeUnit.SECONDS)
    }
    @After fun done() { main { b.pause(); b.release() } }

    private fun children(id: String): List<MediaItem> = main { b.getChildren(id, 0, 500, null) }.get(40, TimeUnit.SECONDS).value!!.toList()

    /** Plays the first station in [col] that really starts within 20 s. Returns the list and where it is. */
    private fun playSomething(col: String = "col|english-news"): Pair<List<MediaItem>, Int> {
        val list = children(col)
        assertTrue("$col has stations", list.size >= 5)
        for (i in 0 until minOf(10, list.size)) {
            main { b.setMediaItem(list[i]); b.prepare(); b.play() }
            if (waitFor(20_000, "${list[i].mediaMetadata.title} to play") { b.isPlaying }) {
                log("playing ${list[i].mediaMetadata.title}"); return list to i
            }
            log("did not play: ${list[i].mediaMetadata.title}")
        }
        fail("none of the first 10 stations in $col played"); throw IllegalStateException()
    }

    /** Connects the way Android Auto and Bluetooth do (the older media browser). */
    private fun carController(): android.support.v4.media.session.MediaControllerCompat {
        var mb: android.support.v4.media.MediaBrowserCompat? = null
        val done = java.util.concurrent.CountDownLatch(1)
        inst.runOnMainSync {
            mb = android.support.v4.media.MediaBrowserCompat(ctx, ComponentName(ctx, PlaybackService::class.java),
                object : android.support.v4.media.MediaBrowserCompat.ConnectionCallback() { override fun onConnected() { done.countDown() } }, null)
            mb!!.connect()
        }
        assertTrue("car-style connection", done.await(20, TimeUnit.SECONDS))
        return android.support.v4.media.session.MediaControllerCompat(ctx, mb!!.sessionToken)
    }

    @Test fun t01_car_browse_tree() {
        val root = main { b.getLibraryRoot(null) }.get(20, TimeUnit.SECONDS).value!!
        val top = children(root.mediaId)
        log("top folders: ${top.size} (${top.take(5).map { it.mediaMetadata.title }})")
        assertTrue(top.any { it.mediaId == "favs" } && top.any { it.mediaId == "picks" })
        assertTrue("languages listed", top.count { it.mediaId.startsWith("col|") } >= 60)
        val ml = children("col|malayalam")
        log("malayalam in the car: ${ml.size} stations")
        assertTrue(ml.size >= 50)
        assertTrue(ml.all { it.mediaMetadata.isPlayable == true && it.mediaId.startsWith("st|malayalam:") })
    }

    @Test fun t02_car_pictures_open() {
        val ml = children("col|malayalam")
        var logos = 0; var badges = 0
        for (it in ml.take(40)) {
            val u = it.mediaMetadata.artworkUri ?: fail("no picture for ${it.mediaMetadata.title}").let { return }
            assertTrue(CarArt.isStationArt(u.toString()))
            val bmp = ctx.contentResolver.openInputStream(u)!!.use { s -> BitmapFactory.decodeStream(s) }
            assertNotNull("picture decodes: $u", bmp); assertEquals(512, bmp.width); assertEquals(512, bmp.height)
            // a framed logo has a white middle; a badge has the theme colour there
            if (bmp.getPixel(256, 60) == android.graphics.Color.WHITE) logos++ else badges++
        }
        log("car pictures: $logos logos, $badges badges in the first 40 Malayalam stations")
        assertTrue("some real logos", logos > 0); assertTrue("some badges", badges > 0)
        // anything else is refused
        assertNull(runCatching { ctx.contentResolver.openInputStream(android.net.Uri.parse("content://${ctx.packageName}.carart/etc/passwd")) }.getOrNull())
    }

    @Test fun t03_plays_and_car_next_previous() {
        val (list, i) = playSomething()
        val first = main { b.currentMediaItem!!.mediaId }
        main { b.seekToNextMediaItem() }
        assertTrue("next changes station", waitFor(5_000, "next") { b.currentMediaItem?.mediaId != first })
        val second = main { b.currentMediaItem!!.mediaId }
        log("next: ${first} -> ${second}")
        main { b.seekToPreviousMediaItem() }
        assertTrue("previous goes back (not restart)", waitFor(5_000, "previous") { b.currentMediaItem?.mediaId == first })
        assertTrue("plays again after previous", waitFor(25_000, "replay") { b.isPlaying })
        // the phone app's and widget's ⏭ / ⏮: wrap round at the ends of the list
        main { b.seekToDefaultPosition(b.mediaItemCount - 1) }
        assertTrue(waitFor(5_000, "at last") { b.currentMediaItemIndex == b.mediaItemCount - 1 })
        main { b.nextStation() }
        assertTrue("app ⏭ from the last goes to the first", waitFor(5_000, "wrap") { b.currentMediaItemIndex == 0 })
        main { b.prevStation() }
        assertTrue("app ⏮ from the first goes to the last", waitFor(5_000, "wrap back") { b.currentMediaItemIndex == b.mediaItemCount - 1 })
        // the car's and Bluetooth buttons (Android Auto talks to the player the older way, MediaControllerCompat)
        val compat = carController()
        compat.transportControls.skipToNext()
        assertTrue("car ⏭ from the last goes to the first", waitFor(5_000, "car wrap") { b.currentMediaItemIndex == 0 })
        compat.transportControls.skipToPrevious()
        assertTrue("car ⏮ goes back a station (not restart)", waitFor(5_000, "car prev") { b.currentMediaItemIndex == b.mediaItemCount - 1 })
        log("list ${list.size}, started at $i, wrap ok (app and car)")
    }

    @Test fun t04_lost_signal_comes_back() {
        playSomething()
        shell("cmd connectivity airplane-mode enable"); log("airplane mode ON")
        Thread.sleep(40_000)
        log("after 40 s without signal: playing=${main { b.isPlaying }} state=${main { b.playbackState }}")
        shell("cmd connectivity airplane-mode disable"); log("airplane mode OFF")
        assertTrue("plays again by itself once the signal is back", waitFor(60_000, "reconnect") { b.isPlaying })
        log("reconnected by itself")
    }

    @Test fun t05_short_dropout_is_bridged() {
        playSomething()
        shell("cmd connectivity airplane-mode enable"); Thread.sleep(6_000); shell("cmd connectivity airplane-mode disable")
        assertTrue("still or again playing after a 6 s drop-out", waitFor(30_000, "after short drop") { b.isPlaying })
    }

    @Test fun t06_resumes_after_another_apps_video() {
        playSomething()
        val am = ctx.getSystemService(AudioManager::class.java)
        val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MOVIE).build())
            .setOnAudioFocusChangeListener { }.build()
        assertEquals(AudioManager.AUDIOFOCUS_REQUEST_GRANTED, am.requestAudioFocus(req))
        assertTrue("radio stops for the video", waitFor(5_000, "stop for video") { !b.playWhenReady })
        Thread.sleep(4_000)
        am.abandonAudioFocusRequest(req)
        assertTrue("radio comes back after the video", waitFor(20_000, "resume after video") { b.isPlaying })
        log("resumed after another app's sound")
    }

    @Test fun t07_own_pause_is_respected() {
        playSomething()
        main { b.pause() }
        Thread.sleep(15_000)
        assertFalse("stays paused", main { b.playWhenReady })
    }

    @Test fun t08_equaliser_on_off_keeps_playing() {
        playSomething()
        for ((on, preset) in listOf(true to "Bass boost", true to "Voice & news", true to "Normal", false to "Bass boost", true to "Classical", false to "Normal")) {
            Eq.save(ctx, on, preset, Eq.PRESETS[preset]!!)
            Thread.sleep(1_500)
            assertTrue("still playing with equaliser $on / $preset", main { b.isPlaying })
        }
        // rapid slider moves
        repeat(30) { k -> Eq.save(ctx, true, "Custom", intArrayOf(k % 12, -k % 12, 0, 3, -3)); Thread.sleep(40) }
        Thread.sleep(1_500)
        assertTrue("still playing after fast slider moves", main { b.isPlaying })
        Eq.save(ctx, false, "Normal", Eq.PRESETS["Normal"]!!)
    }

    @Test fun t09_visualiser_hears_the_music() {
        playSomething()
        Viz.watching = true
        try {
            Thread.sleep(3_000)
            val fresh = System.currentTimeMillis() - Viz.stamp < 1_000
            val level = Viz.bands.max(); val peak = Viz.peak
            log("visualiser: fresh=$fresh, loudest band=$level, loudest sample=$peak")
            assertTrue("sound levels arrive", fresh)
            // the bars follow the sound: loud sound gives tall bars, near silence low ones
            if (peak > 0.05f) assertTrue("bars rise with real sound (peak $peak, bars $level)", level > 0.3f)
            else log("the stream was nearly silent in the emulator (peak $peak): bars correctly stay low ($level)")
        } finally { Viz.watching = false }
    }

    @Test fun t10_alarm_rings_and_fades_in() {
        val (list, i) = playSomething()
        val st = list[i]
        main { b.pause() }
        val ex = st.mediaMetadata.extras!!
        val station = Alarm.stationJson(Station(st.mediaId.removePrefix("st|").substringAfter(':'), ex.getString("station")!!, "",
            ex.getStringArrayList("streams")!!, col = st.mediaId.removePrefix("st|").substringBefore(':')), "English")
        main { b.sendCustomCommand(SessionCommand(PlaybackService.ALARM, Bundle.EMPTY),
            Bundle().apply { putString("station", station.toString()); putInt("fade", 30); putInt("volume", 80) }) }
        assertTrue("alarm starts the station", waitFor(25_000, "alarm") { b.isPlaying })
        // scheduling: next alarm is set with the system (exact alarms allowed for the test)
        shell("appops set ${ctx.packageName} SCHEDULE_EXACT_ALARM allow")
        Alarm.save(ctx, Alarm.Setup(true, 6, 30, (2..6).toSet(), station, 60, 70))
        val next = ctx.getSystemService(android.app.AlarmManager::class.java).nextAlarmClock
        log("next alarm clock: ${next?.triggerTime}")
        assertNotNull("alarm is set with Android", next)
        Alarm.save(ctx, Alarm.load(ctx).copy(on = false))
        assertNull("alarm off clears it", ctx.getSystemService(android.app.AlarmManager::class.java).nextAlarmClock)
    }

    @Test fun t11_widget_play_button() {
        playSomething(); main { b.pause() }
        assertTrue(waitFor(5_000, "paused") { !b.isPlaying })
        ctx.sendBroadcast(Intent(ctx, VelvetWidget::class.java).setAction(VelvetWidget.PLAY))
        assertTrue("widget ▶ starts playing", waitFor(25_000, "widget play") { b.isPlaying })
        ctx.sendBroadcast(Intent(ctx, VelvetWidget::class.java).setAction(VelvetWidget.PLAY))
        assertTrue("widget ⏸ pauses", waitFor(8_000, "widget pause") { !b.isPlaying })
        val p = ctx.getSharedPreferences("widget", 0)
        log("widget shows: ${p.getString("station", null)} playing=${p.getBoolean("playing", true)}")
        assertNotNull(p.getString("station", null))
    }

    @Test fun t12_crash_report_saved_and_sent() {
        Crash.record(ctx, IllegalStateException("TEST crash from the automated device check — please delete"))
        assertTrue(ctx.getSharedPreferences("crash", 0).contains("error"))
        main { Crash.sendSaved(ctx, kotlinx.coroutines.GlobalScope) }
        assertTrue("sent and cleared", waitFor(30_000, "crash sent") { !ctx.getSharedPreferences("crash", 0).contains("error") })
    }

    @Test fun t13_stats_and_logos_files_load() {
        val d = kotlinx.coroutines.runBlocking { Stats.get(ctx) }
        assertNotNull("station-stats.json loads", d); log("stats: ${d!!.week.size} heard, ${d.ratings.size} rated")
        assertNotNull("logo list has Radio Macfast", CarArt.logoUrl(ctx, "malayalam:radiomacfast"))
    }
}
