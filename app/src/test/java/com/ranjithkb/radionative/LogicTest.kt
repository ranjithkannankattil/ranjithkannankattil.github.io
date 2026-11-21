package com.ranjithkb.radionative

import androidx.compose.ui.graphics.Color
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.util.Calendar
import java.util.TimeZone
import kotlin.math.PI
import kotlin.math.sin

/** The rules behind the new features, checked case by case. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class LogicTest {
    private fun cal(y: Int, m: Int, d: Int, h: Int, min: Int) = Calendar.getInstance(TimeZone.getTimeZone("Europe/Rome")).apply {
        clear(); set(y, m - 1, d, h, min, 0) }

    // ---------------- alarm
    // His report 21 Nov 2026: a 7:50 "Once" alarm switched itself off but made no sound. Whatever the player does,
    // the guard 40 s later must ring the phone's alarm sound from the notification itself.
    @Test fun alarm_guard_rings_when_nothing_played() {
        val ctx = RuntimeEnvironment.getApplication()
        val s = Alarm.fresh(ctx).copy(days = emptySet()); Alarm.save(ctx, s)
        try {
            Alarm.markFired(ctx, s.id)
            assertTrue(Alarm.guardShouldRing(ctx, s.id))
            AlarmReceiver().onReceive(ctx, android.content.Intent(ctx, AlarmReceiver::class.java).setAction(AlarmReceiver.GUARD).putExtra("id", s.id))
            val nm = ctx.getSystemService(android.app.NotificationManager::class.java)
            val n = org.robolectric.Shadows.shadowOf(nm).getNotification(Alarm.NOTE_ID)
            assertNotNull("the alarm notification is up", n)
            assertTrue("it keeps ringing until Stop", n.flags and android.app.Notification.FLAG_INSISTENT != 0)
            assertEquals("alarm_sound", n.channelId)
            assertFalse("rings once, not again", Alarm.guardShouldRing(ctx, s.id))
            assertTrue(AlarmLog.all(ctx).any { it.contains("guard ${s.id}: nothing played") })
            // the radio came on (or Stop was pressed): the guard stays quiet
            Alarm.markFired(ctx, s.id); Alarm.markAnswered(ctx)
            assertFalse(Alarm.guardShouldRing(ctx, s.id))
            // an old firing (10 min ago) never rings late
            Alarm.markFired(ctx, s.id)
            assertFalse(Alarm.guardShouldRing(ctx, s.id, System.currentTimeMillis() + 10 * 60_000L))
            // another alarm's guard doesn't ring for this one
            assertFalse(Alarm.guardShouldRing(ctx, s.id + 1))
        } finally { Alarm.remove(ctx, s.id); Alarm.clearRinging(ctx) }
    }

    @Test fun alarm_later_today() {      // Sat 14 Nov 2026, 06:00 → 07:00 same day (every day)
        val n = Alarm.next(cal(2026, 11, 14, 6, 0), 7, 0, (1..7).toSet())
        assertEquals(14, n.get(Calendar.DAY_OF_MONTH)); assertEquals(7, n.get(Calendar.HOUR_OF_DAY)); assertEquals(0, n.get(Calendar.MINUTE))
    }
    @Test fun alarm_time_passed_goes_to_tomorrow() {
        val n = Alarm.next(cal(2026, 11, 14, 7, 0), 7, 0, emptySet())   // exactly now counts as passed
        assertEquals(15, n.get(Calendar.DAY_OF_MONTH))
    }
    @Test fun alarm_weekdays_skip_weekend() {   // Saturday morning, Mon–Fri → Monday 16 Nov
        val n = Alarm.next(cal(2026, 11, 14, 6, 0), 7, 0, (2..6).toSet())
        assertEquals(16, n.get(Calendar.DAY_OF_MONTH)); assertEquals(Calendar.MONDAY, n.get(Calendar.DAY_OF_WEEK))
    }
    @Test fun alarm_friday_evening_to_monday() {
        val n = Alarm.next(cal(2026, 11, 13, 22, 0), 7, 0, (2..6).toSet())
        assertEquals(Calendar.MONDAY, n.get(Calendar.DAY_OF_WEEK)); assertEquals(16, n.get(Calendar.DAY_OF_MONTH))
    }
    @Test fun alarm_only_sunday() {
        val n = Alarm.next(cal(2026, 11, 15, 8, 0), 7, 30, setOf(Calendar.SUNDAY))      // Sunday 08:00, 07:30 passed → next Sunday
        assertEquals(22, n.get(Calendar.DAY_OF_MONTH)); assertEquals(30, n.get(Calendar.MINUTE))
    }
    @Test fun alarm_year_end_rollover() {
        val n = Alarm.next(cal(2026, 12, 31, 23, 59), 0, 1, emptySet())
        assertEquals(2027, n.get(Calendar.YEAR)); assertEquals(1, n.get(Calendar.DAY_OF_MONTH))
    }
    @Test fun alarm_always_in_future_for_every_combination() {
        val now = cal(2026, 3, 29, 1, 30)   // the night the clocks go forward in Europe
        for (mask in 0 until 128) {
            val days = (1..7).filter { mask and (1 shl (it - 1)) != 0 }.toSet()
            for (h in listOf(0, 1, 2, 3, 23)) {
                val n = Alarm.next(now, h, 15, days)
                assertTrue("mask $mask h $h", n.after(now))
                assertTrue(n.timeInMillis - now.timeInMillis <= 8 * 86_400_000L)
                if (days.isNotEmpty()) assertTrue(n.get(Calendar.DAY_OF_WEEK) in days)
            }
        }
    }
    @Test fun alarm_days_labels() {
        assertEquals("Once", Alarm.daysLabel(emptySet()))
        assertEquals("Every day", Alarm.daysLabel((1..7).toSet()))
        assertEquals("Workdays", Alarm.daysLabel((2..6).toSet()))
        assertEquals("Weekend", Alarm.daysLabel(setOf(1, 7)))
        assertEquals("Mon, Wed, Sun", Alarm.daysLabel(setOf(2, 4, 1)))
    }
    @Test fun alarm_save_and_load() {
        val ctx = RuntimeEnvironment.getApplication()
        val st = Station("radiomango", "Radio Mango", "fm", listOf("https://a", "https://b"), "malayalam")
        Alarm.save(ctx, Alarm.Setup(true, 6, 45, setOf(2, 3), Alarm.stationJson(st, "Malayalam"), 30, 85))
        val l = Alarm.load(ctx)
        assertTrue(l.on); assertEquals(6, l.hour); assertEquals(45, l.minute); assertEquals(setOf(2, 3), l.days)
        assertEquals("Radio Mango", l.station!!.getString("name")); assertEquals(2, l.station!!.getJSONArray("streams").length())
        assertEquals(30, l.fadeSec); assertEquals(85, l.volume)
    }

    // ---------------- several alarms (2.7)
    private fun alarmPrefs() = RuntimeEnvironment.getApplication().getSharedPreferences("alarm", android.content.Context.MODE_PRIVATE)
    @Test fun alarms_old_single_alarm_is_kept() {      // someone on 2.6 with one alarm updates: it becomes the first of the list
        val ctx = RuntimeEnvironment.getApplication()
        alarmPrefs().edit().clear().putBoolean("on", true).putInt("hour", 5).putInt("minute", 50).putString("days", "2,3,4,5,6")
            .putString("station", """{"id":"radiomango","col":"malayalam","name":"Radio Mango","streams":["https://a"]}""")
            .putInt("fade", 30).putInt("volume", 60).commit()
        val l = Alarm.all(ctx)
        assertEquals(1, l.size); val a = l[0]
        assertTrue(a.on); assertEquals(5, a.hour); assertEquals(50, a.minute); assertEquals(Alarm.WORKDAYS, a.days)
        assertEquals("Radio Mango", a.station!!.getString("name")); assertEquals(30, a.fadeSec); assertEquals(60, a.volume)
        assertEquals("auto", a.backup)
        assertEquals(1, Alarm.all(ctx).size)            // read twice: still one, not copied again
    }
    @Test fun alarms_none_for_new_people() {
        alarmPrefs().edit().clear().commit()
        assertTrue(Alarm.all(RuntimeEnvironment.getApplication()).isEmpty())
    }
    @Test fun alarms_workdays_and_weekend_side_by_side() {
        val ctx = RuntimeEnvironment.getApplication(); alarmPrefs().edit().clear().commit()
        val work = Alarm.fresh(ctx).copy(hour = 6, minute = 30, days = Alarm.WORKDAYS, name = "Work"); Alarm.save(ctx, work)
        val wknd = Alarm.fresh(ctx).copy(hour = 8, minute = 15, days = Alarm.WEEKEND, name = "Weekend", backup = "tone"); Alarm.save(ctx, wknd)
        assertNotEquals(work.id, wknd.id)
        val l = Alarm.all(ctx)
        assertEquals(listOf("Work", "Weekend"), l.map { it.name })         // in time order
        assertEquals("tone", l[1].backup)
        // Saturday 07:00 → the weekend one (8:15 today); Friday 07:00 → the workday one on Monday? no: Saturday 8:15
        assertEquals("Weekend", Alarm.upcoming(cal(2026, 11, 14, 7, 0), l)!!.first.name)
        val fri = Alarm.upcoming(cal(2026, 11, 13, 7, 0), l)!!
        assertEquals("Weekend", fri.first.name); assertEquals(14, fri.second.get(Calendar.DAY_OF_MONTH))
        val sunNight = Alarm.upcoming(cal(2026, 11, 15, 22, 0), l)!!
        assertEquals("Work", sunNight.first.name); assertEquals(16, sunNight.second.get(Calendar.DAY_OF_MONTH))
        // editing one leaves the other alone
        Alarm.save(ctx, l[0].copy(hour = 7)); assertEquals(8, Alarm.byId(ctx, wknd.id)!!.hour); assertEquals(7, Alarm.byId(ctx, work.id)!!.hour)
        // switched off: not "next"
        Alarm.save(ctx, Alarm.byId(ctx, wknd.id)!!.copy(on = false))
        assertEquals("Work", Alarm.upcoming(cal(2026, 11, 13, 8, 0), Alarm.all(ctx))!!.first.name)
        Alarm.remove(ctx, work.id); assertEquals(listOf(wknd.id), Alarm.all(ctx).map { it.id })
        assertNull(Alarm.upcoming(cal(2026, 11, 13, 8, 0), Alarm.all(ctx)))
    }
    @Test fun alarms_many_ids_unique() {
        val ctx = RuntimeEnvironment.getApplication(); alarmPrefs().edit().clear().commit()
        repeat(6) { Alarm.save(ctx, Alarm.fresh(ctx).copy(hour = it)) }
        assertEquals(6, Alarm.all(ctx).map { it.id }.toSet().size)
    }
    @Test fun alarm_setup_json_roundtrip_and_bad_values() {
        val s = Alarm.Setup(true, 23, 59, setOf(1, 7), null, 120, 100, id = 9, name = "Late", backup = "tone")
        assertEquals(s, Alarm.Setup.fromJson(s.toJson()))
        val bad = Alarm.Setup.fromJson(JSONObject("""{"hour":30,"minute":-4,"days":[0,9,3],"volume":5,"fade":9999,"backup":""}"""))
        assertEquals(23, bad.hour); assertEquals(0, bad.minute); assertEquals(setOf(3), bad.days); assertEquals(20, bad.volume)
        assertEquals(300, bad.fadeSec); assertEquals("auto", bad.backup)
    }
    @Test fun alarm_when_labels() {
        val now = cal(2026, 11, 13, 22, 0)   // Friday night
        assertEquals("Today 23:30", Alarm.whenLabel(now, Alarm.next(now, 23, 30, emptySet()), true))
        assertEquals("Tomorrow, Saturday 08:15", Alarm.whenLabel(now, Alarm.next(now, 8, 15, Alarm.WEEKEND), true))
        assertEquals("Monday 6:30 am", Alarm.whenLabel(now, Alarm.next(now, 6, 30, Alarm.WORKDAYS), false))
        assertEquals("12:05 pm", Alarm.timeLabel(12, 5, false)); assertEquals("12:00 am", Alarm.timeLabel(0, 0, false))
    }
    @Test fun alarm_quiet_check_is_only_fresh() {
        val ctx = RuntimeEnvironment.getApplication(); alarmPrefs().edit().clear().commit()
        assertFalse(Alarm.knownDown(ctx, 3))
        Alarm.markChecked(ctx, 3, false); assertTrue(Alarm.knownDown(ctx, 3))
        alarmPrefs().edit().putLong("checked_3", System.currentTimeMillis() - 30 * 60_000L).commit()
        assertFalse("an old check doesn't count", Alarm.knownDown(ctx, 3))
        Alarm.markChecked(ctx, 3, true); assertFalse(Alarm.knownDown(ctx, 3))
    }

    // ---------------- Data saver
    @Test fun data_saver_plays_the_lightest_link_first() {
        val st = listOf("https://a/128", "https://b/32", "https://c/unknown", "https://d/64")
        assertEquals(listOf("https://b/32", "https://d/64", "https://c/unknown", "https://a/128"), DataSaver.order(st, listOf(128, 32, 0, 64)))
        assertEquals(st, DataSaver.order(st, emptyList()))                           // no weights known: same links
        assertEquals(32, DataSaver.lightest(listOf(128, 32, 0))); assertEquals(0, DataSaver.lightest(emptyList()))
        assertEquals("32 kbps · ~14 MB/hour", DataSaver.label(32)); assertEquals("128 kbps · ~58 MB/hour", DataSaver.label(128))
        assertEquals("", DataSaver.label(0))
    }
    @Test fun data_saver_station_weights_come_from_the_site() {
        val o = JSONObject("""{"id":"x","name":"X FM","streams":["https://a","https://b"],"br":[128,48]}""")
        val s = Station.fromJson(o, "malayalam"); assertEquals(listOf(128, 48), s.br)
        assertEquals(listOf(128, 48), Station.fromJson(s.toJson()).br)               // kept in the phone's cache too
        assertEquals(emptyList<Int>(), Station.fromJson(JSONObject("""{"id":"y","name":"Y","streams":["https://a"]}"""), "m").br)
    }
    @Test fun data_saver_lightest_first_sort() {
        fun st(id: String, br: List<Int>) = Station(id, id, "", listOf("https://$id"), "m", br = br)
        val l = listOf(st("heavy", listOf(192)), st("none", emptyList()), st("light", listOf(128, 24)), st("mid", listOf(64)))
        assertEquals(listOf("light", "mid", "heavy", "none"), Stats.sort(l, "light", null).map { it.id })
    }
    @Test fun data_saver_setting_and_mobile_only() {
        val ctx = RuntimeEnvironment.getApplication()
        DataSaver.save(ctx, DataSaver.ON); assertTrue(DataSaver.isOn)
        DataSaver.save(ctx, DataSaver.OFF); assertFalse(DataSaver.isOn)
        DataSaver.save(ctx, DataSaver.MOBILE); assertEquals(DataSaver.metered(ctx), DataSaver.isOn)
        DataSaver.load(ctx); assertEquals(DataSaver.MOBILE, DataSaver.mode)
        DataSaver.save(ctx, DataSaver.OFF)
    }
    @Test fun data_use_counts_per_month() {
        val ctx = RuntimeEnvironment.getApplication(); DataUse.init(ctx)
        ctx.getSharedPreferences("datause", 0).edit().clear().commit()
        val m = DataUse.monthKey()
        DataUse.add(ctx, m, 5_000_000, 1_000_000); DataUse.add(ctx, m, 3_000_000, 0)
        assertEquals(8_000_000L to 1_000_000L, DataUse.thisMonth(ctx))
        DataUse.add(ctx, "1999-01", 7, 7)                                            // another month starts from zero
        assertEquals(0L to 0L, DataUse.thisMonth(ctx))
        assertEquals("1.2 GB", DataUse.size(1_234_000_000)); assertEquals("340 MB", DataUse.size(340_200_000)); assertEquals("0 MB", DataUse.size(0))
    }

    // ---------------- app language
    @Test fun lang_words_follow_his_choices() {
        try {
            Lang.code = "ml"
            assertEquals("നിലയങ്ങൾ", t("Stations")); assertEquals("ഫോണ്ട്", t("Font")); assertEquals("വിവരം", t("Info"))
            assertEquals("Radio Mango", t("Radio Mango"))                 // anything without a translation stays as it is
            Lang.code = "hi"; assertEquals("सेटिंग्स", t("Settings"))
            Lang.code = "en"; assertEquals("Settings", t("Settings"))
        } finally { Lang.code = "en" }
    }
    @Test fun lang_setting_is_remembered() {
        val ctx = RuntimeEnvironment.getApplication()
        try { Lang.set(ctx, "ml"); Lang.code = "en"; Lang.load(ctx); assertEquals("ml", Lang.code)
            Lang.set(ctx, "xx"); assertEquals("en", Lang.code) } finally { Lang.set(ctx, "en") }
    }
    @Test fun lang_alarm_days_in_malayalam() {
        try { Lang.code = "ml"; assertEquals("പ്രവൃത്തി ദിവസങ്ങൾ", Alarm.daysLabel(Alarm.WORKDAYS)); assertEquals("വാരാന്ത്യം", Alarm.daysLabel(Alarm.WEEKEND)) }
        finally { Lang.code = "en" }
    }

    // ---------------- Android TV
    @Test fun tv_stays_dark_when_the_player_rereads_the_settings() {
        val ctx = RuntimeEnvironment.getApplication()
        Theme.prefs(ctx).edit().putString("mode", "light").commit()
        try {
            Theme.tvDark = true; Theme.load(ctx); assertEquals("dark", Theme.mode)
            Theme.tvDark = false; Theme.load(ctx); assertEquals("light", Theme.mode)    // phones keep their own choice
        } finally { Theme.tvDark = false; Theme.prefs(ctx).edit().remove("mode").commit(); Theme.load(ctx) }
    }

    @Test fun tv_rows_selection_favourites_then_languages() {
        val cols = listOf(Collection("malayalam", "Malayalam", "", "", emptyList()), Collection("tamil", "Tamil", "", "", emptyList()))
        assertEquals(listOf(PICKS, "_favs", "malayalam", "tamil"), tvRows(cols, true).map { it.id })
        assertEquals(listOf(PICKS, "malayalam", "tamil"), tvRows(cols, false).map { it.id })      // no favourites row when empty
    }

    // ---------------- first-time tour (2.7)
    @Test fun tour_has_eight_steps_with_welcome_first() {
        assertEquals(8, Tour.COUNT); assertNull(Tour.STEPS[0].target)
        assertEquals(listOf("star", "langs", "sort", "row", "header", "player", "nav"), Tour.STEPS.drop(1).map { it.target })
        assertTrue(Tour.STEPS.all { it.text.length in 30..200 })
    }
    @Test fun tour_once_only() {
        val ctx = RuntimeEnvironment.getApplication()
        ctx.getSharedPreferences("tour", 0).edit().clear().commit()
        Tour.done(ctx); assertFalse(Tour.shouldShow(ctx))
    }

    // ---------------- most heard / top rated
    private val a = Station("a", "Zeta FM", "fm", listOf("x"), "malayalam")
    private val b = Station("b", "Alpha", "fm", listOf("x"), "malayalam")
    private val c = Station("c", "mango", "fm", listOf("x"), "malayalam")
    private val d = Station("d", "(Beta)", "fm", listOf("x"), "malayalam")
    private val data = Stats.Data(mapOf("malayalam:a" to 600, "malayalam:c" to 30, "malayalam:d" to 6000),
        mapOf("malayalam:a" to (4.2 to 10), "malayalam:b" to (5.0 to 2), "malayalam:c" to (4.9 to 3), "malayalam:d" to (4.2 to 40)), "x")

    @Test fun sort_usual_keeps_order() = assertEquals(listOf(a, b, c, d), Stats.sort(listOf(a, b, c, d), "usual", data))
    @Test fun sort_az_ignores_case_and_brackets() = assertEquals(listOf(b, d, c, a), Stats.sort(listOf(a, b, c, d), "az", data))
    @Test fun sort_heard() = assertEquals(listOf(d, a, c, b), Stats.sort(listOf(a, b, c, d), "heard", data))
    @Test fun sort_rated_needs_three_ratings_then_more_ratings_win_ties() =
        assertEquals(listOf(c, d, a, b), Stats.sort(listOf(a, b, c, d), "rated", data))
    @Test fun sort_without_data_is_stable() = assertEquals(listOf(a, b, c, d), Stats.sort(listOf(a, b, c, d), "heard", null))
    @Test fun top3_needs_an_hour() = assertEquals(setOf("malayalam:d", "malayalam:a"), Stats.top3(listOf(a, b, c, d), data))
    @Test fun labels() {
        assertEquals("Still collecting", Stats.heardLabel(null)); assertEquals("Still collecting", Stats.heardLabel(0))
        assertEquals("45 min this week", Stats.heardLabel(45)); assertEquals("1 hr this week", Stats.heardLabel(60)); assertEquals("2 hrs this week", Stats.heardLabel(150))
        assertEquals("1,240 hrs this week", Stats.heardLabel(1240 * 60 + 59))
        assertEquals("Not enough ratings yet", Stats.ratedLabel(5.0 to 2)); assertEquals("★ 4.6 · 38 ratings", Stats.ratedLabel(4.6 to 38))
        assertEquals("Not enough ratings yet", Stats.ratedLabel(null))
    }
    @Test fun stats_file_parses() {
        val j = JSONObject("""{"updated":"2026-11-14T20:59Z","week":{"malayalam:ahaliafm":185},"total":{},"ratings":{"english-news:bbc-live-news":[3.33,3]},"days":[]}""")
        val p = Stats.parse(j)
        assertEquals(185, p.week["malayalam:ahaliafm"]); assertEquals(3.33 to 3, p.ratings["english-news:bbc-live-news"])
        val empty = Stats.parse(JSONObject("{}")); assertTrue(empty.week.isEmpty() && empty.ratings.isEmpty())
    }

    // ---------------- per-station listening minutes
    @Test fun listens_ready_rules() {
        val sp = JSONObject().put("malayalam:a", 119_999).put("malayalam:b", 120_000).put("malayalam:c", 45 * 60_000L)
            .put("bad key", 600_000).put("x/y:z", 600_000)
        assertEquals(listOf("malayalam:b" to 2, "malayalam:c" to 30), Listen.readyStations(sp, false).sortedBy { it.first })
        assertEquals(listOf("malayalam:a" to 1, "malayalam:b" to 2, "malayalam:c" to 30), Listen.readyStations(sp, true).sortedBy { it.first })
    }
    @Test fun listens_key_matches_firestore_rule() {
        // firestore.rules: key.matches('^[A-Za-z0-9-]+:.{1,100}$')
        assertTrue(Listen.STATION_KEY.matches("english-news:bbc-live-news")); assertFalse(Listen.STATION_KEY.matches("nocolon"))
        assertFalse(Listen.STATION_KEY.matches("a:" + "x".repeat(101)))
    }

    // ---------------- equaliser
    @Test fun eq_levels() {
        val b = intArrayOf(6, 0, -6, 0, 12)
        assertEquals(6f, Eq.levelAt(20, b), 0.01f); assertEquals(12f, Eq.levelAt(20000, b), 0.01f)
        assertEquals(0f, Eq.levelAt(230, b), 0.01f); assertEquals(-6f, Eq.levelAt(910, b), 0.01f)
        val mid = Eq.levelAt(457, b); assertTrue(mid < 0f && mid > -6f)
    }
    @Test fun eq_presets_in_range() = Eq.PRESETS.values.forEach { p -> assertEquals(5, p.size); p.forEach { assertTrue(it in -12..12) } }
    @Test fun eq_save_load_and_garbage() {
        val ctx = RuntimeEnvironment.getApplication()
        Eq.save(ctx, true, "Custom", intArrayOf(1, 2, 3, 4, 5)); assertArrayEquals(intArrayOf(1, 2, 3, 4, 5), Eq.bands(ctx)); assertTrue(Eq.on(ctx))
        ctx.getSharedPreferences("settings", 0).edit().putString("eqBands", "99,x").putString("eqPreset", "Bass boost").commit()
        assertArrayEquals(Eq.PRESETS["Bass boost"], Eq.bands(ctx))
    }

    @Test fun eq_normal_and_off_mean_untouched_sound() {
        assertTrue(EqEngine.flat(EqEngine.target(true, Eq.PRESETS["Normal"]!!)))
        assertTrue(EqEngine.flat(EqEngine.target(false, Eq.PRESETS["Bass boost"]!!)))
        assertFalse(EqEngine.flat(EqEngine.target(true, Eq.PRESETS["Bass boost"]!!)))
    }
    @Test fun eq_curve_follows_the_sliders() {
        val g = EqEngine.target(true, Eq.PRESETS["Bass boost"]!!)
        assertEquals(10, g.size); assertEquals(6f, g[0], 0.01f); assertTrue(g[1] > g[4]); assertEquals(0f, g[9], 0.01f)
        g.forEach { assertTrue(it in -12f..12f) }
    }
    @Test fun eq_glide_is_smooth_and_always_the_same_length() {
        val from = FloatArray(10); val to = FloatArray(10) { 6f }
        var prev = from; var maxJump = 0f
        var t = 0f
        while (t <= EqEngine.GLIDE_MS) {
            val n = EqEngine.step(prev, to, from, t)
            maxJump = maxOf(maxJump, kotlin.math.abs(n[0] - prev[0])); prev = n; t += EqEngine.STEP_MS
        }
        assertEquals(6f, EqEngine.step(prev, to, from, EqEngine.GLIDE_MS)[0], 0.001f)
        assertTrue("largest step $maxJump dB", maxJump < 0.8f)   // 6 dB spread over ~15 small steps, no jump
        assertEquals(0f, EqEngine.step(from, to, from, 0f)[0], 0.001f)
        // a glide downwards and a small change take the same time
        assertEquals(1f, EqEngine.step(to, FloatArray(10) { 1f }, to, EqEngine.GLIDE_MS)[0], 0.001f)
    }

    // ---------------- visualiser
    @Test fun fft_finds_the_tone() {
        val n = 1024; val rate = 44100; val hz = 1000.0
        val re = FloatArray(n) { sin(2 * PI * hz * it / rate).toFloat() }; val im = FloatArray(n)
        Viz.fft(re, im)
        val peak = (1 until n / 2).maxBy { re[it] * re[it] + im[it] * im[it] }
        assertEquals((hz * n / rate).toInt().toDouble(), peak.toDouble(), 1.0)
    }
    @Test fun bands_are_0_to_1_and_loud_tone_lights_its_band() {
        val n = 1024; val rate = 44100
        val re = FloatArray(n) { 0.9f * sin(2 * PI * 1000.0 * it / rate).toFloat() }; val im = FloatArray(n)
        Viz.fft(re, im)
        val b = Viz.toBands(re, im, rate)
        assertEquals(Viz.N, b.size); b.forEach { assertTrue(it in 0f..1f) }
        assertTrue(b.max() > 0.6f)
        val silent = Viz.toBands(FloatArray(n), FloatArray(n), rate); silent.forEach { assertTrue(it in 0f..1f) }
    }

    // ---------------- resume after other apps
    @Test fun resume_rules() {
        assertTrue(ResumeWatcher.shouldResume(true, 30_000, 5_000, false, false, true))
        assertFalse("setting off", ResumeWatcher.shouldResume(false, 30_000, 5_000, false, false, true))
        assertFalse("in a call", ResumeWatcher.shouldResume(true, 30_000, 5_000, true, false, true))
        assertFalse("listener paused", ResumeWatcher.shouldResume(true, 30_000, 5_000, false, true, true))
        assertFalse("nothing to play", ResumeWatcher.shouldResume(true, 30_000, 5_000, false, false, false))
        assertFalse("too late", ResumeWatcher.shouldResume(true, ResumeWatcher.WINDOW_MS + 1, 5_000, false, false, true))
        assertFalse("not quiet long enough", ResumeWatcher.shouldResume(true, 30_000, 3_999, false, false, true))
    }

    @Test fun reconnect_waits_grow_and_stop_after_15_minutes() {
        val w = (0..20).map { PlaybackService.Reconnect.delayMs(it) }
        assertEquals(1_500L, w[0]); assertTrue(w.zipWithNext().all { (a, b) -> b >= a }); assertEquals(30_000L, w.last())
        assertTrue("first minute covers several tries", w.take(6).sum() < 60_000)
        var t = 0L; var n = 0; while (t < PlaybackService.Reconnect.LIMIT_MS) { t += w[minOf(n, 20)]; n++ }
        assertTrue("about $n tries in 15 minutes", n in 30..60)
    }

    @Test fun car_badge_letters() {
        assertEquals("RM", CarArt.letters("Radio Mango")); assertEquals("AF", CarArt.letters("Ahalia FM"))
        assertEquals("CF", CarArt.letters("Club FM 94.3")); assertEquals("BR", CarArt.letters("BBC Radio 4"))
        assertEquals("AT", CarArt.letters("Akashvani Thrissur")); assertEquals("HI", CarArt.letters("Hit 96.7"))
        assertEquals("RM", CarArt.letters("The Radio Mattoli (Wayanad)")); assertEquals("94", CarArt.letters("94.3"))
        assertEquals("94.3", CarArt.frequency("Club FM 94.3")); assertNull(CarArt.frequency("Radio Mango"))
        CarArt.letters("ക്ലബ് എഫ്എം").let { assertTrue(it.isNotEmpty()) }
    }
    @Test fun phone_screens_ignore_the_car_picture() {
        CarArt.init(RuntimeEnvironment.getApplication())
        val u = CarArt.uriFor("malayalam:radiomango", "Radio Mango")!!.toString()
        assertTrue(u.startsWith("content://") && CarArt.isStationArt(u))
        assertFalse(CarArt.isStationArt("https://is1-ssl.mzstatic.com/image/song.jpg")); assertFalse(CarArt.isStationArt(null))
        val item = Station("radiomango", "Radio Mango", "fm", listOf("https://x"), "malayalam").toItem("Malayalam")
        assertEquals(u, item.mediaMetadata.artworkUri.toString())
    }

    // ---------------- rate us
    @Test fun review_rules() {
        val day = 86_400_000L; val now = 100 * day
        assertTrue(ReviewRule.ready(now - 5 * day, now, 4 * 3_600_000L, 0, false))
        assertFalse(ReviewRule.ready(now - 2 * day, now, 4 * 3_600_000L, 0, false))
        assertFalse(ReviewRule.ready(now - 5 * day, now, 3_600_000L, 0, false))
        assertFalse(ReviewRule.ready(now - 5 * day, now, 4 * 3_600_000L, now - day, false))
        assertFalse(ReviewRule.ready(now - 5 * day, now, 4 * 3_600_000L, 0, true))
    }

    // ---------------- themes: every theme readable in light and dark
    @Test fun every_theme_is_readable() {
        THEMES.forEach { t -> listOf(false, true).forEach { dark ->
            val p = Palettes.of(t.id, dark); val w = "${t.id} ${if (dark) "dark" else "light"}"
            assertTrue("$w ink ${Palettes.contrast(p.ink, p.paper)}", Palettes.contrast(p.ink, p.paper) >= 7f)
            assertTrue("$w accent text ${Palettes.contrast(p.accentText, p.paper)}", Palettes.contrast(p.accentText, p.paper) >= 4.5f)
            assertTrue("$w soft ${Palettes.contrast(p.soft, p.paper)}", Palettes.contrast(p.soft, p.paper) >= 3.5f)
            assertTrue("$w bar ${Palettes.contrast(p.barInk, p.bar)}", Palettes.contrast(p.barInk, p.bar) >= 4.5f)
            assertTrue("$w player ${Palettes.contrast(p.ink, p.playerBg)}", Palettes.contrast(p.ink, p.playerBg) >= 7f)
        } }
    }
    @Test fun velvet_is_exactly_as_before() {
        val l = Palettes.of("velvet", false); val d = Palettes.of("velvet", true)
        assertEquals(Color(0xFFF0EDE6), l.paper); assertEquals(Color(0xFF2A1424), l.ink); assertEquals(Color(0xFF6B2D5C), l.accent)
        assertEquals(Color(0xFF140D12), d.paper); assertEquals(Color(0xFFF1E9EE), d.ink); assertEquals(Color(0xFFC9A86A), d.gold)
        assertEquals(l, Palettes.of("no-such-theme", false))
    }
    @Test fun fifteen_themes_with_unique_ids_and_names() {
        assertEquals(15, THEMES.size); assertEquals(15, THEMES.map { it.id }.toSet().size)
        assertEquals(setOf("Elegant", "Subtle", "Vibrant"), THEMES.map { it.group }.toSet())
        THEMES.filter { it.id != "velvet" }.forEach { assertTrue(it.ml.isNotBlank()); assertTrue(it.en.isNotBlank()) }
    }
    @Test fun fonts_list_is_complete() {
        assertEquals("jost", FONTS[0].id); assertTrue(FONTS.any { it.id == "poppins" }); assertEquals(FONTS.size, FONTS.map { it.id }.toSet().size)
        FONTS.forEach { f -> if (f.id != "phone") assertEquals(4, f.res!!.size) }
        val ctx = RuntimeEnvironment.getApplication()
        FONTS.forEach { f -> Theme.prefs(ctx).edit().putString("font", f.id).commit(); Theme.load(ctx); assertEquals(f.id, Theme.font) }
        Theme.prefs(ctx).edit().clear().commit(); Theme.load(ctx)
    }
    @Test fun settings_survive_bad_values() {
        val ctx = RuntimeEnvironment.getApplication()
        Theme.prefs(ctx).edit().putString("theme", "nope").putString("mode", "purple").putInt("text", 9).putString("font", "comic")
            .putInt("spacing", -3).putString("viz", "laser").commit()
        Theme.load(ctx)
        assertEquals("velvet", Theme.themeId); assertEquals("phone", Theme.mode); assertEquals(2, Theme.text)
        assertEquals("jost", Theme.font); assertEquals(0, Theme.spacing); assertEquals("off", Theme.viz)
        Theme.themeId = "kadal"; Theme.mode = "dark"; Theme.text = 1; Theme.save(ctx); Theme.themeId = "velvet"; Theme.load(ctx)
        assertEquals("kadal", Theme.themeId); assertEquals("dark", Theme.mode); assertEquals(1, Theme.text)
        Theme.prefs(ctx).edit().clear().commit(); Theme.load(ctx); assertEquals("velvet", Theme.themeId); assertEquals("off", Theme.viz)
        assertTrue(Theme.resume)
    }

    // ---------------- comments, recently played, crash reports
    @Test fun comments_parse_sorted_newest_first_and_skip_empty() {
        fun doc(stars: Int, text: String, ts: String) = JSONObject().put("document", JSONObject().put("fields", JSONObject()
            .put("stars", JSONObject().put("integerValue", "$stars")).put("text", JSONObject().put("stringValue", text))
            .put("ts", JSONObject().put("timestampValue", ts))))
        val rows = JSONArray().put(doc(4, "older", "2026-11-01T10:00:00Z")).put(doc(5, "newer", "2026-11-10T10:00:00.123456Z"))
            .put(doc(3, "   ", "2026-11-12T10:00:00Z")).put(JSONObject().put("readTime", "x"))
        val l = Comments.parse(rows)
        assertEquals(listOf("newer", "older"), l.map { it.text }); assertEquals(5, l[0].stars)
    }
    @Test fun recent_keeps_12_newest_without_repeats() {
        val ctx = RuntimeEnvironment.getApplication(); Recent.clear(ctx)
        (1..15).forEach { i -> Recent.add(ctx, Station("s$i", "S$i", "fm", listOf("u$i"), "malayalam").toItem("Malayalam")) }
        Recent.add(ctx, Station("s3", "S3", "fm", listOf("u3"), "malayalam").toItem("Malayalam"))
        val l = Recent.all(ctx)
        assertEquals(12, l.size); assertEquals("s3", l[0].station.id); assertEquals(1, l.count { it.station.id == "s3" })
        assertEquals("malayalam", l[0].station.col); assertEquals(listOf("u3"), l[0].station.streams)
    }
    @Test fun recent_when_labels() {
        val now = cal(2026, 11, 14, 12, 0).timeInMillis
        assertEquals("Just now", Recent.whenLabel(now - 60_000, now))
        assertEquals("Today", Recent.whenLabel(now - 3 * 3_600_000L, now))
        assertEquals("Yesterday", Recent.whenLabel(now - 24 * 3_600_000L, now))
        assertEquals("d MMM".let { "2 Nov" }, Recent.whenLabel(cal(2026, 11, 2, 9, 0).timeInMillis, now))
    }
    @Test fun crash_summary_uses_root_cause_and_limits() {
        val e = RuntimeException("outer", IllegalStateException("x".repeat(500)))
        val (err, trace) = Crash.summary(e)
        assertTrue(err.startsWith("IllegalStateException: ")); assertTrue(err.length <= 300); assertTrue(trace.length <= 4000)
        assertEquals("NullPointerException", Crash.summary(NullPointerException()).first)
    }

    // ---- player looks
    @Test fun era_dial_reads_the_frequency_or_the_place_in_the_list() {
        assertEquals("91.9", Eras.dial("Radio Mango 91.9", 0, 10).second)
        assertEquals(((91.9f - 88f) / 20f), Eras.dial("Radio Mango 91.9", 0, 10).first, 0.001f)
        assertEquals("96.7", Eras.dial("Hit 96.7", 3, 10).second)
        assertEquals("104", Eras.dial("Fever 104 FM", 3, 10).second)
        assertEquals(null, Eras.freq("Radio 2024 Hits"))           // a year is not a frequency
        assertEquals(null, Eras.freq("Station 5"))
        assertEquals("CH 01", Eras.dial("Radio Malabar", 0, 10).second)
        assertEquals(0.06f, Eras.dial("Radio Malabar", 0, 10).first, 0.001f)
        assertEquals(0.94f, Eras.dial("Radio Malabar", 9, 10).first, 0.001f)
        assertEquals(0.5f, Eras.dial("Radio Malabar", -1, 0).first, 0.001f)  // not playing from a list
        assertEquals(0.5f, Eras.dial("Radio Malabar", 0, 1).first, 0.001f)
        for (n in 0 until 300) { val p = Eras.dial("X", n, 300).first; assertTrue(p in 0f..1f) }
    }
    @Test fun era_knob_angles() {
        assertEquals(-135f, Eras.angle(0f), 0.01f); assertEquals(135f, Eras.angle(1f), 0.01f); assertEquals(0f, Eras.angle(0.5f), 0.01f)
        assertEquals(-135f, Eras.angle(-3f), 0.01f); assertEquals(0.5f, Eras.eqToKnob(0), 0.001f); assertEquals(1f, Eras.eqToKnob(12), 0.001f)
    }
    @Test fun era_pages_are_readable_light_and_dark() {
        Eras.LIST.forEach { e -> listOf(false, true).forEach { dk ->
            val p = Eras.page(e.id, dk)!!
            assertTrue("${e.id} ink", Palettes.contrast(p.ink, p.page) >= 7f)
            assertTrue("${e.id} soft", Palettes.contrast(p.soft, p.page) >= 4.5f)
            assertTrue("${e.id} accent", Palettes.contrast(p.accent, p.page) >= 4.5f)
            assertEquals("${e.id} light/dark", dk, Palettes.luma(p.page) < 0.5f)
        } }
    }
    @Test fun era_page_colours_only_while_the_player_is_open_with_original_colours() {
        Theme.themeId = "kadal"; Theme.mode = "light"
        val theme = Palettes.of("kadal", false)
        Theme.look = "boombox"; Theme.lookColours = "original"; Theme.playerOpen = false
        assertEquals(theme, Theme.pal)                                     // the rest of the app keeps the theme
        Theme.playerOpen = true
        assertEquals(Eras.page("boombox", false)!!.page, Theme.pal.playerBg)
        Theme.lookColours = "theme"; assertEquals(theme, Theme.pal)        // "My colour theme": the theme's page
        Theme.lookColours = "original"; Theme.look = "std"; assertEquals(theme, Theme.pal)
        Theme.playerOpen = false; Theme.mode = "phone"; Theme.themeId = "velvet"
    }
    @Test fun era_skins_for_every_theme() {
        Eras.LIST.forEach { e -> THEMES.forEach { t ->
            val s = Eras.skin(e.id, false, t.id)
            assertEquals(Color(t.accent), if (t.id == "velvet") Color(0xFF6B2D5C) else s.bodyTop)
            assertTrue("${e.id}/${t.id} dial", Palettes.contrast(s.panelInk, s.panel) >= 4.5f)
        }
            val o = Eras.skin(e.id, true, "kadal")
            assertTrue("${e.id} original dial", Palettes.contrast(o.panelInk, o.panel) >= 4.5f)
            assertTrue("${e.id} original differs from theme", o.bodyTop != Eras.skin(e.id, false, "kadal").bodyTop)
        }
    }
    @Test fun player_look_saved_and_bad_values_ignored() {
        val ctx = RuntimeEnvironment.getApplication()
        Theme.look = "digital"; Theme.lookColours = "theme"; Theme.save(ctx)
        Theme.look = "std"; Theme.lookColours = "original"; Theme.load(ctx)
        assertEquals("digital", Theme.look); assertEquals("theme", Theme.lookColours)
        Theme.prefs(ctx).edit().putString("look", "gramophone").putString("lookColours", "neon").apply(); Theme.load(ctx)
        assertEquals("std", Theme.look); assertEquals("original", Theme.lookColours)
        Theme.prefs(ctx).edit().clear().apply(); Theme.load(ctx)
        assertEquals("std", Theme.look)                                    // new installs: today's player
    }

    // ---- turning knobs
    private fun circle(c: androidx.compose.ui.geometry.Offset, r: Float, from: Float, to: Float, n: Int = 36): Float {
        var acc = 0f; var prev = c + androidx.compose.ui.geometry.Offset(r * kotlin.math.cos(Math.toRadians(from.toDouble())).toFloat(), r * kotlin.math.sin(Math.toRadians(from.toDouble())).toFloat())
        for (k in 1..n) { val a = from + (to - from) * k / n
            val p = c + androidx.compose.ui.geometry.Offset(r * kotlin.math.cos(Math.toRadians(a.toDouble())).toFloat(), r * kotlin.math.sin(Math.toRadians(a.toDouble())).toFloat())
            acc += Rotary.turn(c, prev, p, 20f, 2f); prev = p }
        return acc
    }
    @Test fun knob_follows_a_finger_going_round() {
        val c = androidx.compose.ui.geometry.Offset(100f, 100f)
        assertEquals(90f, circle(c, 60f, -90f, 0f), 2f)        // a quarter turn clockwise, from the top
        assertEquals(-90f, circle(c, 60f, 0f, -90f), 2f)       // and back
        assertEquals(300f, circle(c, 60f, 0f, 300f, 60), 3f)   // most of a turn, past the start line
        assertEquals(-180f, circle(c, 45f, 90f, -90f, 40), 3f)
    }
    @Test fun knob_takes_straight_swipes_too() {
        val c = androidx.compose.ui.geometry.Offset(100f, 100f)
        var acc = 0f; var x = 40f
        while (x < 160f) { acc += Rotary.turn(c, androidx.compose.ui.geometry.Offset(x, 100f), androidx.compose.ui.geometry.Offset(x + 4f, 100f), 20f, 2f); x += 4f }
        assertTrue("swipe right through the middle turns clockwise: $acc", acc > 50f)
        acc = 0f; var y = 160f
        while (y > 40f) { acc += Rotary.turn(c, androidx.compose.ui.geometry.Offset(100f, y), androidx.compose.ui.geometry.Offset(100f, y - 4f), 20f, 2f); y -= 4f }
        assertTrue("swipe up turns clockwise: $acc", acc > 50f)
        // a thumb wheel only takes straight swipes, even off-centre
        assertEquals(10f, Rotary.turn(c, androidx.compose.ui.geometry.Offset(150f, 40f), androidx.compose.ui.geometry.Offset(170f, 40f), 20f, 2f, wheel = true), 0.01f)
        assertEquals(Pair(2, 5f), Rotary.steps(85f, 40f)); assertEquals(Pair(-1, -5f), Rotary.steps(-45f, 40f)); assertEquals(Pair(0, 30f), Rotary.steps(30f, 40f))
    }

    @Test fun look_swipe_goes_round_standard_and_all_six_radios() {
        assertEquals("cathedral", Eras.step("std", +1))
        assertEquals("digital", Eras.step("std", -1))
        assertEquals("std", Eras.step("digital", +1))
        var id = "std"; val seen = mutableSetOf<String>()
        repeat(Eras.IDS.size) { id = Eras.step(id, +1); seen += id }
        assertEquals(7, seen.size); assertEquals("std", id)
        assertEquals("cathedral", Eras.step("gramophone", +1))
        assertEquals("1950s · Valve radio", Eras.name("valve")); assertEquals("Standard player", Eras.name("std"))
    }

    @Test fun knob_taps_only_count_on_its_sides() {
        assertEquals(1, side(95f, 100)); assertEquals(-1, side(5f, 100))
        assertEquals(0, side(50f, 100)); assertEquals(0, side(40f, 100)); assertEquals(0, side(60f, 100))
        assertEquals(1, side(67f, 100)); assertEquals(-1, side(33f, 100))
    }
}
