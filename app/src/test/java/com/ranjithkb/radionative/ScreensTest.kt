package com.ranjithkb.radionative

import android.graphics.Bitmap
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.*
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.sp
import androidx.media3.common.MediaMetadata
import org.junit.Rule
import org.junit.Assert.*
import androidx.compose.ui.geometry.Offset
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Draws the main screens (no phone needed) so the look can be checked: PNG files in build/screens. */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w390dp-h844dp-xxhdpi")
class ScreensTest {
    @get:Rule val rule = createAndroidComposeRule<androidx.activity.ComponentActivity>()

    private val sts = listOf(
        Station("radiomalabar", "Radio Malabar", "online", listOf("x"), "malayalam"),
        Station("radiomango", "Radio Mango", "fm", listOf("x"), "malayalam"),
        Station("homefm", "Home FM", "fm", listOf("x"), "malayalam"),
        Station("hit967", "Hit 96.7", "fm", listOf("x"), "malayalam", geo = "AE"),
        Station("airananthapuri", "AIR Ananthapuri", "air", listOf("x"), "malayalam"),
        Station("clubfm", "Club FM 94.3", "fm", listOf("x"), "malayalam"),
        Station("radiosuno", "Radio Suno", "fm", listOf("x"), "malayalam"),
        Station("sunobahrain", "Suno Bahrain", "fm", listOf("x"), "malayalam"),
        Station("radiolemon", "Radio Lemon UK", "online", listOf("x"), "malayalam"),
        Station("akashvanikochi", "AIR Kochi FM", "air", listOf("x"), "malayalam"))
    // the real catalogue size, so the search screen reads "Search all 5,3xx stations"
    private val every = sts + (1..5310).map { Station("s$it", "Station $it", "online", listOf("x"), "other") }

    private fun now(playing: Boolean = true, song: Boolean = true) = NowState(null).apply {
        this.playing = playing; id = "st|malayalam:radiomalabar"
        md = MediaMetadata.Builder().setStation("Radio Malabar").setTitle(if (song) "Karunamaya" else "Radio Malabar")
            .setArtist(if (song) "K. S. Chithra · Radio Malabar" else "Malayalam")
            .setExtras(android.os.Bundle().apply { putString("lang", "Malayalam") }).build()
    }

    private fun shot(name: String, dark: Boolean, theme: String = "velvet", text: Int = 0, font: String = "jost", spacing: Int = 0,
                     viz: String = "off", animated: Boolean = false, look: String = "std", lookColours: String = "original",
                     content: @Composable () -> Unit) {
        Theme.look = look; Theme.lookColours = lookColours; Theme.playerOpen = look != "std"
        Theme.mode = "phone"; Theme.sysDark = dark; Theme.themeId = theme; Theme.text = text; Theme.font = font; Theme.spacing = spacing; Theme.viz = viz
        if (animated) rule.mainClock.autoAdvance = false
        rule.setContent {
            val d = androidx.compose.ui.platform.LocalDensity.current
            androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalDensity provides
                androidx.compose.ui.unit.Density(d.density, d.fontScale * Theme.textScale)) {
                MaterialTheme(typography = PoppinsType) { Surface(Modifier.fillMaxSize(), color = Paper) { content() } }
            }
        }
        if (animated) rule.mainClock.advanceTimeBy(1200) else rule.waitForIdle()
        capture(name)
    }

    private fun capture(name: String) {
        val root = rule.activity.window.decorView.rootView
        val bmp = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888)
        root.draw(android.graphics.Canvas(bmp))
        val dir = File("build/screens").apply { mkdirs() }
        File(dir, "$name.png").outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private val stats = Stats.Data(mapOf("malayalam:radiomalabar" to 11100, "malayalam:radiomango" to 3000, "malayalam:homefm" to 480,
        "malayalam:clubfm" to 45), mapOf("malayalam:radiomango" to (4.6 to 38), "malayalam:clubfm" to (4.5 to 7), "malayalam:homefm" to (5.0 to 2),
        "malayalam:radiomalabar" to (4.8 to 12)), "2026-11-15")

    @Composable private fun Stations(playing: Boolean, sortBy: String = "az", tab: Int = 0) = Column(Modifier.fillMaxSize()) {
        Box(Modifier.tourTarget("header")) { Header(onSearch = {}) }
        Box(Modifier.tourTarget("langs")) {
        LangTabs(listOf(LangTab(PICKS, t("Velvet Selection"), star = true), LangTab("malayalam", "Malayalam", true),
            LangTab("english", "English"), LangTab("tamil", "Tamil"), LangTab("_langs", t("All languages"), icon = true)), "malayalam", {}, {}) }
        Box(Modifier.tourTarget("sort")) {
        CatRow(listOf(Triple("all", t("All"), 130), Triple("fav", t("Favourites"), 3), Triple("fm", "FM", -1), Triple("air", "Akashvani", -1),
            Triple("online", "Online", -1)), "all", {}, t(SORTS.first { it.first == sortBy }.second), {}) }
        val shown = Stats.sort(sts, sortBy, stats)
        val top = if (sortBy == "heard") Stats.top3(shown, stats) else emptySet()
        LazyColumn(Modifier.weight(1f)) {
            items(shown) { s ->
                val base = mapOf("fm" to "FM", "air" to "Akashvani", "online" to "Online")[s.category] ?: ""
                val sub = when (sortBy) { "heard" -> Stats.heardLabel(stats.week[s.key]) + " · " + base
                    "rated" -> Stats.ratedLabel(stats.ratings[s.key]) + " · " + base; else -> base }
                Box(if (s == shown.first()) Modifier.tourTarget("row") else Modifier) {
                StationRow(s, sub, s.id == "radiomango", s.id == "radiomalabar", playing, {}, {}, badge = s.key in top) } }
        }
        Box(Modifier.tourTarget("player")) { MiniPlayer(now(playing), null, true, {}, {}, CastUi(true, false), {}, {}) {} }
        Box(Modifier.tourTarget("nav")) { BottomNav(tab, 12) {} }
    }

    private fun hasClickLabel(l: String) = SemanticsMatcher("click label $l") {
        it.config.getOrNull(androidx.compose.ui.semantics.SemanticsActions.OnClick)?.label == l }

    // ---- 2.7: star tab, soft pill, several alarms, first-time tour
    private fun twoAlarms() {
        val ctx = rule.activity
        ctx.getSharedPreferences("alarm", 0).edit().clear().commit()
        val mango = Alarm.stationJson(sts[1], "Malayalam")
        Alarm.save(ctx, Alarm.Setup(true, 6, 30, Alarm.WORKDAYS, mango, 60, 70, id = 1, name = "Work"))
        Alarm.save(ctx, Alarm.Setup(true, 8, 15, Alarm.WEEKEND, Alarm.stationJson(sts[0], "Malayalam"), 120, 60, id = 2, name = "Weekend", backup = "tone"))
        Alarm.save(ctx, Alarm.Setup(false, 22, 0, emptySet(), null, 0, 50, id = 3))
    }
    @Composable private fun Picks(dark: Boolean = false) = Column(Modifier.fillMaxSize()) {
        Header(onSearch = {})
        LangTabs(listOf(LangTab(PICKS, t("Velvet Selection"), star = true), LangTab("malayalam", "Malayalam", true),
            LangTab("english", "English"), LangTab("tamil", "Tamil"), LangTab("_langs", t("All languages"), icon = true)), PICKS, {}, {})
        PicksHeading(false)
        LazyColumn(Modifier.weight(1f)) { items(sts.take(7)) { s ->
            StationRow(s, if (s.id == "hit967") "Malayalam · Only plays in the UAE" else "Malayalam", s.id == "radiomango", s.id == "radiomalabar", true, {}, {}) } }
        MiniPlayer(now(true), null, true, {}, {}, CastUi(true, false), {}, {}) {}
        BottomNav(0, 12) {}
    }
    @Test fun v31_velvet_selection() = shot("v31-velvet-selection", false) { Picks() }
    @Test fun v32_velvet_selection_dark() = shot("v32-velvet-selection-dark", true) { Picks() }
    // ---- Google Play phone screenshots: the real screen at true phone proportions, 1080 × 2160 (Play's tallest allowed, 2:1)
    private fun exactOk() { org.robolectric.shadows.ShadowAlarmManager.setCanScheduleExactAlarms(true) }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p01() = shot("play-p01-stations", false) { Stations(true, "heard") }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p02() = shot("play-p02-velvet-selection", false) { Picks() }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p03() = shot("play-p03-player-bars", false, viz = "bars", animated = true) { Player(true) }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p04() = shot("play-p04-player-waves-dark", true, viz = "waves", animated = true) { Player(true) }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p05() = shot("play-p05-valve-radio", false, look = "valve", animated = true) { Player(true) }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p06() = shot("play-p06-boombox-dark", true, look = "boombox", animated = true) { Player(true) }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p07() = shot("play-p07-colour-themes", false) { ThemesScreen {} }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p08() { Eq.save(rule.activity, true, "Music", Eq.PRESETS["Music"]!!.copyOf())
        shot("play-p08-equaliser", false) { EqualiserScreen {} } }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p09() { exactOk(); twoAlarms()
        shot("play-p09-alarms", false) { AlarmScreen(sts.map { it to "Malayalam" }) {} } }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p10() { exactOk(); twoAlarms()
        shot("play-p10-alarm-edit", false) { AlarmEdit(Alarm.byId(rule.activity, 1)!!, false, sts.map { it to "Malayalam" }) {} } }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p11() = shot("play-p11-visualiser", false, viz = "circle", animated = true) { VisualiserScreen {} }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p12() = shot("play-p12-stations-kaavu-dark", true, theme = "kaavu") { Stations(true) }
    @Test @Config(qualifiers = "w360dp-h720dp-xxhdpi") fun p13() = shot("play-p13-player-sandhya", false, theme = "sandhya", viz = "bars", animated = true) { Player(true) }

    @Test fun v40_data_saver() { DataSaver.save(rule.activity, DataSaver.MOBILE)
        rule.activity.getSharedPreferences("datause", 0).edit().clear().commit()
        DataUse.add(rule.activity, DataUse.monthKey(), 412_000_000, 1_830_000_000)
        shot("v40-data-saver", false) { DataSaverScreen {} }; DataSaver.save(rule.activity, DataSaver.OFF) }
    @Test fun v41_data_saver_dark() { DataSaver.save(rule.activity, DataSaver.ON)
        shot("v41-data-saver-dark", true) { DataSaverScreen {} }; DataSaver.save(rule.activity, DataSaver.OFF) }
    // ---- the tidier Info tab
    @Composable private fun Info() = Column(Modifier.fillMaxSize()) { Box(Modifier.weight(1f)) { InfoTab(73, null, {}, {}, {}) }; BottomNav(2, 12) {} }
    @Test fun v50_info_tab() = shot("v50-info", false) { Info() }
    @Test fun v51_info_tab_dark() = shot("v51-info-dark", true) { Info() }
    @Test fun v52_info_tab_scrolled() { shot("v52-info-x", false) { Info() }
        rule.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("Credits")); rule.waitForIdle(); capture("v52-info-scrolled") }
    @Test fun v53_info_about_page() { shot("v53-info-y", false) { Info() }
        rule.onNode(hasScrollToNodeAction()).performScrollToNode(hasText("What the app can do"))
        rule.onNodeWithText("What the app can do").performClick(); rule.waitForIdle(); capture("v53-info-what-it-can-do")
        rule.onNodeWithText("Data saver", substring = true).assertExists() }
    @Test @Config(qualifiers = "w360dp-h740dp-xxhdpi") fun v54_info_large_text_360() = shot("v54-info-large-360", false, text = 2) { Info() }
    // ---- the app in Malayalam and Hindi
    private fun inLang(c: String, name: String, dark: Boolean = false, body: @Composable () -> Unit) {
        Lang.code = c; try { shot(name, dark, content = body) } finally { Lang.code = "en" } }
    @Test fun v60_ml_stations() = inLang("ml", "v60-ml-stations") { Stations(true) }
    @Test fun v61_ml_info() = inLang("ml", "v61-ml-info") { Info() }
    @Test fun v62_ml_settings() = inLang("ml", "v62-ml-settings") { SettingsScreen({}) {} }
    @Test fun v63_ml_alarm_edit() { twoAlarms(); inLang("ml", "v63-ml-alarm-edit") { AlarmEdit(Alarm.byId(rule.activity, 1)!!, false, sts.map { it to "Malayalam" }) {} } }
    @Test fun v64_ml_tour() { var st by androidx.compose.runtime.mutableIntStateOf(1)
        inLang("ml", "v64-ml-tour") { Box(Modifier.fillMaxSize()) { Stations(true); TourOverlay(st, { st = it }) {} } } }
    @Test fun v65_ml_data_saver_dark() = inLang("ml", "v65-ml-data-saver-dark", true) { DataSaverScreen {} }
    @Test fun v66_hi_stations() = inLang("hi", "v66-hi-stations") { Stations(true) }
    @Test fun v67_hi_settings() = inLang("hi", "v67-hi-settings") { SettingsScreen({}) {} }
    @Test @Config(qualifiers = "w360dp-h740dp-xxhdpi") fun v68_ml_info_360_large() { Lang.code = "ml"; try { shot("v68-ml-info-360-large", false, text = 2) { Info() } } finally { Lang.code = "en" } }

    // ---- Android TV / Google TV
    private val tvCols = listOf(Collection("malayalam", "Malayalam", "മലയാളം", "", emptyList()), Collection("english-news", "English news", "", "", emptyList()),
        Collection("tamil", "Tamil", "", "", emptyList()), Collection("hindi", "Hindi", "", "", emptyList()))
    @Composable private fun Tv() = Box(Modifier.fillMaxSize().background(Paper)) {
        TvHome(tvCols, sts.take(3), now(true), {}, load = { sts }) { _, _ -> } }
    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tv01_home() = shot("tv01-home", true) { Tv() }
    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tv02_player() = shot("tv02-player", true) { Box(Modifier.fillMaxSize().background(Paper)) { TvPlayer(now(true), null, isFav = true) {} } }
    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tv03_home_malayalam() = inLang("ml", "tv03-home-ml", true) { Tv() }
    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tv04_player_hindi() = inLang("hi", "tv04-player-hi", true) { Box(Modifier.fillMaxSize().background(Paper)) { TvPlayer(now(false), null, isFav = false) {} } }
    @Test @Config(qualifiers = "w960dp-h540dp-land-television-xhdpi") fun tv05_first_station_has_focus() {
        shot("tv05-x", true) { Tv() }
        rule.waitForIdle()
        assertTrue("the remote starts on the first station", rule.onAllNodes(androidx.compose.ui.test.isFocused()).fetchSemanticsNodes().isNotEmpty())
    }

    @Test fun v01_pill_light() = shot("v01-pill-light", false) { Stations(true) }
    @Test fun v02_pill_dark() = shot("v02-pill-dark", true) { Stations(true) }
    @Test fun v03_pill_favourites_dark_rosewood() = shot("v03-pill-favs-rosewood-dark", true, theme = "rosewood") { Stations(true, tab = 1) }
    @Test fun v04_alarms_list() { twoAlarms(); shot("v04-alarms-list", false) { AlarmScreen(sts.map { it to "Malayalam" }) {} } }
    @Test fun v05_alarms_list_dark() { twoAlarms(); shot("v05-alarms-list-dark", true) { AlarmScreen(sts.map { it to "Malayalam" }) {} } }
    @Test fun v06_alarms_empty() { rule.activity.getSharedPreferences("alarm", 0).edit().clear().commit()
        shot("v06-alarms-empty", false) { AlarmScreen(sts.map { it to "Malayalam" }) {} } }
    @Test fun v07_alarm_edit() { twoAlarms(); shot("v07-alarm-edit", false) {
        AlarmEdit(Alarm.byId(rule.activity, 2)!!, false, sts.map { it to "Malayalam" }) {} } }
    @Test @Config(qualifiers = "w360dp-h740dp-xxhdpi") fun v08_alarm_edit_large_360() { twoAlarms()
        shot("v08-alarm-edit-large-360", false, text = 2) { AlarmEdit(Alarm.byId(rule.activity, 1)!!, false, sts.map { it to "Malayalam" }) {} } }
    @Test fun v09_add_weekend_alarm_by_touch() {
        twoAlarms()
        shot("v09a-before-add", false) { AlarmScreen(sts.map { it to "Malayalam" }) {} }
        rule.onNode(hasClickLabel("Add an alarm")).performScrollTo().performClick(); rule.waitForIdle()
        rule.onNodeWithText("Weekend").performClick(); rule.waitForIdle()
        rule.onNodeWithText("The last station I played").assertExists()
        capture("v09b-new-alarm-weekend")
        rule.onNodeWithText("A favourite that's working").performClick(); rule.waitForIdle()
        capture("v09c-backup-choices")
        rule.onNodeWithText("The phone's alarm sound").performClick(); rule.waitForIdle()
        rule.onNode(hasClickLabel("Save alarm")).assertIsDisplayed().performClick(); rule.waitForIdle()
        val l = Alarm.all(rule.activity)
        assertEquals(4, l.size)
        val n = l.first { it.id == 4 }
        assertEquals(Alarm.WEEKEND, n.days); assertEquals("tone", n.backup); assertTrue(n.on)
        capture("v09d-list-after-add")
    }
    @Test fun v10_back_leaves_alarm_unchanged() {
        twoAlarms()
        shot("v10-x", false) { AlarmScreen(sts.map { it to "Malayalam" }) {} }
        rule.onAllNodes(hasClickLabel("Edit the alarm"))[0].performClick(); rule.waitForIdle()
        rule.onNodeWithText("Every day").performClick(); rule.waitForIdle()
        rule.onAllNodes(hasContentDescription("Back")).onLast().performClick(); rule.waitForIdle()
        assertEquals(Alarm.WORKDAYS, Alarm.byId(rule.activity, 1)!!.days)
    }
    @Test fun v11_delete_alarm() {
        twoAlarms()
        shot("v11-x", false) { AlarmScreen(sts.map { it to "Malayalam" }) {} }
        rule.onAllNodes(hasClickLabel("Edit the alarm"))[1].performClick(); rule.waitForIdle()
        rule.onNode(hasClickLabel("Delete alarm")).performScrollTo().performClick(); rule.waitForIdle()
        assertNull(Alarm.byId(rule.activity, 2)); assertEquals(2, Alarm.all(rule.activity).size)
    }
    @Test fun v12_switch_alarm_off_in_list() {
        twoAlarms()
        shot("v12-x", false) { AlarmScreen(sts.map { it to "Malayalam" }) {} }
        rule.onNode(hasContentDescription(":15", substring = true)).performClick(); rule.waitForIdle()
        assertFalse(Alarm.byId(rule.activity, 2)!!.on)
    }

    /** One tour step drawn over the Stations screen (the overlay finds the parts by their measured place). */
    private fun tourShot(step: Int, dark: Boolean = false) {
        var st by androidx.compose.runtime.mutableIntStateOf(step)
        shot("v2${step}-tour-${step + 1}" + if (dark) "-dark" else "", dark) {
            Box(Modifier.fillMaxSize()) { Stations(true); if (st >= 0) TourOverlay(st, { st = it }) { st = -1 } } }
    }
    @Test fun v20_tour_1() = tourShot(0)
    @Test fun v21_tour_2() = tourShot(1)
    @Test fun v22_tour_3() = tourShot(2)
    @Test fun v23_tour_4() = tourShot(3)
    @Test fun v24_tour_5() = tourShot(4)
    @Test fun v25_tour_6() = tourShot(5)
    @Test fun v26_tour_7() = tourShot(6)
    @Test fun v27_tour_8() = tourShot(7)
    @Test fun v28_tour_dark() = tourShot(1, dark = true)
    @Test fun v29_tour_walk_through_and_skip() {
        var st by androidx.compose.runtime.mutableIntStateOf(0); var ended = 0
        shot("v29-x", false) { Box(Modifier.fillMaxSize()) { Stations(true); if (st >= 0) TourOverlay(st, { st = it }) { st = -1; ended++ } } }
        rule.onNode(hasClickLabel("Show me")).performClick(); rule.waitForIdle(); assertEquals(1, st)
        repeat(6) { rule.onNode(hasClickLabel("Next")).performClick(); rule.waitForIdle() }
        assertEquals(7, st)
        rule.onNode(hasClickLabel("Back")).performClick(); rule.waitForIdle(); assertEquals(6, st)
        rule.onNode(hasClickLabel("Next")).performClick(); rule.waitForIdle()
        rule.onNode(hasClickLabel("Done")).performClick(); rule.waitForIdle()
        assertEquals(-1, st); assertEquals(1, ended)
        // and once more, skipping half way
        st = 3; rule.waitForIdle()
        rule.onNode(hasClickLabel("Skip the tour")).performClick(); rule.waitForIdle()
        assertEquals(-1, st); assertEquals(2, ended)
        // "No thanks" on the welcome
        st = 0; rule.waitForIdle()
        rule.onNode(hasClickLabel("No thanks")).performClick(); rule.waitForIdle()
        assertEquals(-1, st); assertEquals(3, ended)
    }
    @Test fun v30_tour_lights_the_right_parts() {
        shot("v30-x", false) { Stations(true) }
        listOf("star", "langs", "sort", "row", "header", "player", "nav").forEach {
            assertTrue("$it is measured", Tour.targets[it]?.let { r -> r.width > 0 && r.height > 0 } == true) }
        val star = Tour.targets["star"]!!; val langs = Tour.targets["langs"]!!
        assertTrue("star inside the language row", langs.contains(star.center))
        assertTrue("nav at the bottom", Tour.targets["nav"]!!.top > Tour.targets["player"]!!.top)
    }

    @Composable private fun Player(playing: Boolean, song: Boolean = true) = PlayerContent(now(playing, song), null, "Malayalam", CastUi(true, false),
        {}, {}, if (song) ({}) else null, {}, {}, {}) { Text("★★★★☆  4.2 · 38 ratings", fontSize = 15.sp, color = Soft) }

    // ---- next update: sort, settings, sound, alarm, request, comments, recently played, widget, every theme
    @Test fun n01_most_heard() = shot("n01-most-heard", false) { Stations(true, "heard") }
    @Test fun n02_top_rated() = shot("n02-top-rated", false) { Stations(true, "rated") }
    @Test fun n03_most_heard_dark() = shot("n03-most-heard-dark", true) { Stations(true, "heard") }
    @Test fun n04_settings() = shot("n04-settings", false) { SettingsScreen({}) {} }
    @Test fun n05_settings_dark() = shot("n05-settings-dark", true) { SettingsScreen({}) {} }
    @Test fun n06_themes() = shot("n06-themes", false) { ThemesScreen {} }
    @Test fun n07_equaliser() = shot("n07-equaliser", false) { EqualiserScreen {} }
    @Test fun n08_visualiser_settings() = shot("n08-visualiser", false, viz = "bars", animated = true) { VisualiserScreen {} }
    @Test fun n09_player_bars() = shot("n09-player-bars", false, viz = "bars", animated = true) { Player(true) }
    @Test fun n10_player_waves_dark() = shot("n10-player-waves-dark", true, viz = "waves", animated = true) { Player(true) }
    @Test fun n11_player_circle() = shot("n11-player-circle", false, viz = "circle", animated = true) { Player(true) }
    @Test fun n12_alarm() = shot("n12-alarm", false) { AlarmScreen(sts.map { it to "Malayalam" }) {} }
    @Test fun n13_request() = shot("n13-request", false) { RequestScreen {} }
    @Test fun n14_comments() = shot("n14-comments", false) { CommentsScreen("malayalam:radiomango", "Radio Mango") {} }
    @Test fun n15_favourites_recent() = shot("n15-favourites-recent", false) { Column(Modifier.fillMaxSize()) {
        Header(onSearch = {})
        FavsTab(sts.take(4), now(), { "Malayalam" }, {}, recent = sts.take(5).mapIndexed { i, s -> Recent.Item(s, "Malayalam",
            System.currentTimeMillis() - i * 30 * 3_600_000L) }, onRecent = {}, onChanged = {}, favs = Favs(rule.activity), onPicks = {}) } }
    // Settings → Data saver → back: Settings stays where you were (it jumped to the top before, his report 21 Nov 2026)
    @Test fun s01_settings_keeps_its_place_after_a_sub_page() {
        var page by androidx.compose.runtime.mutableStateOf("settings")
        val sc = androidx.compose.foundation.ScrollState(0)
        rule.setContent { Box(Modifier.fillMaxSize()) { when (page) {
            "settings" -> SettingsScreen({}, sc) { page = it }
            "data" -> DataSaverScreen { page = "settings" }
        } } }
        rule.onNodeWithText("Data saver").performScrollTo().performClick(); rule.waitForIdle()
        val y = sc.value
        assertTrue("Settings should have scrolled down to Data saver", y > 0)
        rule.onNodeWithText("Always").performClick()                 // change the setting, as he did
        rule.onNodeWithContentDescription("Back").performClick(); rule.waitForIdle()
        rule.onNodeWithText("Data saver").assertExists()
        assertEquals(y, sc.value)
        DataSaver.save(rule.activity, DataSaver.OFF)
    }

    // ---- Favourites as tiles (Settings → Favourites → Tiles)
    private fun tiles(name: String, dark: Boolean, lang: String = "en") {
        Theme.favTiles = true; Lang.code = lang
        try { shot(name, dark) { Column(Modifier.fillMaxSize()) { Header(onSearch = {})
            FavsTab(sts, now(true), { "Malayalam" }, {}, recent = emptyList(), onRecent = {}, onChanged = {}, favs = Favs(rule.activity), onPicks = {}) } } }
        finally { Theme.favTiles = false; Lang.code = "en" }
    }
    @Test fun f01_fav_tiles() = tiles("f01-fav-tiles", false)
    @Test fun f02_fav_tiles_dark() = tiles("f02-fav-tiles-dark", true)
    @Test @Config(qualifiers = "w360dp-h740dp-xxhdpi") fun f03_fav_tiles_360() = tiles("f03-fav-tiles-360", false)
    @Test fun f04_fav_tiles_malayalam() = tiles("f04-fav-tiles-ml", false, "ml")
    @Test fun f05_fav_tiles_tap_plays_and_heart_removes() {
        Theme.favTiles = true
        var played: String? = null; var removed: String? = null
        try {
            rule.setContent { FavTiles(sts, now(false), { "Malayalam" }, { played = it.name }) { _, s -> removed = s.name } }
            rule.onNodeWithContentDescription(sts[1].name + ", Malayalam").performClick()
            assertEquals(sts[1].name, played)
            rule.onNodeWithContentDescription("Remove from favourites " + sts[2].name).performClick()
            assertEquals(sts[2].name, removed)
        } finally { Theme.favTiles = false }
    }
    @Test @Config(qualifiers = "w360dp-h740dp-xxhdpi") fun n16_extra_large_text_360() = shot("n16-extra-large-360", false, text = 2) { Stations(true, "heard") }
    @Test fun n17_classic_serif_spacious() = shot("n17-serif-spacious", false, font = "serif", spacing = 2) { Stations(true) }
    @Test @Config(qualifiers = "w360dp-h740dp-xxhdpi") fun n18_settings_large_360() = shot("n18-settings-large-360", false, text = 2) { SettingsScreen({}) {} }
    /** One screen drawn in every theme (light and dark): the screen is set once and the theme changed between pictures. */
    private fun everyTheme(prefix: String, darkToo: Boolean, viz: String, content: @Composable () -> Unit) {
        Theme.look = "std"; Theme.playerOpen = false
        Theme.viz = viz; Theme.text = 0; Theme.font = "jost"; Theme.spacing = 0
        rule.mainClock.autoAdvance = false
        Theme.mode = "phone"
        rule.setContent {
            MaterialTheme(typography = PoppinsType) { Surface(Modifier.fillMaxSize(), color = Paper) { content() } }
        }
        THEMES.forEach { t -> (if (darkToo) listOf(false, true) else listOf(false)).forEach { dk ->
            // changed from outside the screen, the way Settings changes them: everything must repaint
            Theme.themeId = t.id; Theme.sysDark = dk
            androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications()
            rule.mainClock.advanceTimeBy(900)
            capture("$prefix-${t.id}-${if (dk) "dark" else "light"}")
        } }
    }
    @Test fun n22_force_dark_on_light_phone() {
        Theme.sysDark = false; Theme.themeId = "velvet"; Theme.viz = "off"; Theme.text = 0; Theme.font = "jost"; Theme.spacing = 0
        Theme.mode = "phone"
        rule.mainClock.autoAdvance = false
        rule.setContent { MaterialTheme(typography = PoppinsType) { Surface(Modifier.fillMaxSize(), color = Paper) { Stations(true) } } }
        rule.mainClock.advanceTimeBy(500); capture("n22-a-phone-light")
        Theme.mode = "dark"; androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications(); rule.mainClock.advanceTimeBy(500)
        capture("n22-b-forced-dark")
        val root = rule.activity.window.decorView.rootView
        val bmp = Bitmap.createBitmap(root.width, root.height, Bitmap.Config.ARGB_8888); root.draw(android.graphics.Canvas(bmp))
        val px = bmp.getPixel(root.width / 2, root.height / 2)
        val lum = (android.graphics.Color.red(px) + android.graphics.Color.green(px) + android.graphics.Color.blue(px)) / 3
        org.junit.Assert.assertTrue("forced dark should paint a dark page, got $lum", lum < 80)
        Theme.mode = "phone"
    }
    @Test fun n23_share_cards() {
        val ctx = rule.activity
        listOf(Triple("velvet", false, "off"), Triple("velvet", true, "bars"), Triple("kadal", false, "waves"), Triple("ila", true, "circle"),
            Triple("kasavu", false, "bars"), Triple("manju", false, "off")).forEachIndexed { i, (t, dk, vz) ->
            val font = listOf("jost", "jost", "serif", "jost", "phone", "jost")[i]
            val b = drawSongCard(ctx, "Yaar Intha Saalaiyoram", "G. V. Prakash Kumar, Saindhavi", "Radio Mango", null,
                "ranjithkb.com/radio.html?c=malayalam&s=radiomango", Palettes.of(t, dk), vz, font, null)
            File(File("build/screens").apply { mkdirs() }, "n23-card-$t-${if (dk) "dark" else "light"}-$vz-$font.png")
                .outputStream().use { b.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
    @Test fun n24_player_visualiser_off_switch() = shot("n24-player-viz-off", false, viz = "off") { Player(true) }
    @Test fun n25_every_font() {
        rule.mainClock.autoAdvance = false
        Theme.mode = "phone"; Theme.sysDark = false; Theme.themeId = "velvet"; Theme.viz = "off"; Theme.text = 0; Theme.spacing = 0
        rule.setContent {
            val d = androidx.compose.ui.platform.LocalDensity.current
            androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalDensity provides
                androidx.compose.ui.unit.Density(d.density, d.fontScale * Theme.textScale)) {
                MaterialTheme(typography = PoppinsType) { Surface(Modifier.fillMaxSize(), color = Paper) { Stations(true) } } }
        }
        FONTS.forEach { f -> Theme.font = f.id; androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications()
            rule.mainClock.advanceTimeBy(600); capture("n25-font-${f.id}") }
        Theme.font = "jost"
    }
    @Test fun n26_settings_fonts() = shot("n26-settings-fonts", false) { SettingsScreen({}) {} }
    @Test fun n27_car_pictures() {
        val ctx = rule.activity
        // a stand-in logo (a red circle on white with a word), drawn here: real logos come from the weekly job
        val logo = Bitmap.createBitmap(400, 400, Bitmap.Config.ARGB_8888).apply { eraseColor(android.graphics.Color.WHITE)
            val c = android.graphics.Canvas(this); val p = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFD62828.toInt() }
            c.drawCircle(200f, 170f, 110f, p); p.color = 0xFF222222.toInt(); p.textSize = 54f; p.textAlign = android.graphics.Paint.Align.CENTER
            c.drawText("LOGO FM", 200f, 360f, p) }
        listOf(Triple("Radio Mango", null, "velvet"), Triple("Club FM 94.3", null, "velvet"), Triple("Ahalia FM", logo, "velvet"),
            Triple("BBC Radio 4", null, "kadal"), Triple("Hit 96.7", logo, "kasavu")).forEachIndexed { i, (n, l, t) ->
            val b = CarArt.draw(ctx, n, l, Palettes.of(t, false))
            File(File("build/screens").apply { mkdirs() }, "n27-car-$i-${n.replace(' ', '_')}-$t.png").outputStream().use { b.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
    }
    // ---- player looks: every era, original and theme colours, light and dark
    private fun everyEra(prefix: String, theme: String, content: @Composable () -> Unit) {
        Theme.viz = "off"; Theme.text = 0; Theme.font = "jost"; Theme.spacing = 0; Theme.mode = "phone"; Theme.themeId = theme
        Theme.playerOpen = true
        rule.mainClock.autoAdvance = false
        rule.setContent { MaterialTheme(typography = PoppinsType) { Surface(Modifier.fillMaxSize(), color = Paper) { content() } } }
        Eras.LIST.forEach { e -> listOf("original", "theme").forEach { col -> listOf(false, true).forEach { dk ->
            Theme.look = e.id; Theme.lookColours = col; Theme.sysDark = dk
            androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications()
            rule.mainClock.advanceTimeBy(900)
            capture("$prefix-${e.id}-$col-${if (dk) "dark" else "light"}")
        } } }
        Theme.look = "std"; Theme.playerOpen = false
    }
    @Test fun n28_every_era() = everyEra("era", "velvet") { Player(true) }
    @Test fun n29_every_era_kadal_theme() = everyEra("erak", "kadal") { Player(true) }
    @Test @Config(qualifiers = "w360dp-h640dp-xxhdpi") fun n30_every_era_small_phone() = everyEra("eras", "velvet") { Player(true) }
    @Test fun n31_player_look_settings() = shot("n31-player-look", false, look = "receiver") { Theme.playerOpen = false; PlayerLookScreen {} }
    @Test fun n32_player_look_settings_dark_theme_colours() = shot("n32-player-look-dark", true, look = "boombox", lookColours = "theme") {
        Theme.playerOpen = false; PlayerLookScreen {} }
    @Test fun n33_era_paused_no_song() = shot("n33-era-paused", false, look = "valve") { Player(false, song = false) }
    @Test fun n34_settings_with_look_row() = shot("n34-settings-look", false, look = "cathedral") { Theme.playerOpen = false; SettingsScreen({}) {} }
    // ---- swiping the cover changes the player look (Standard and the six radios)
    private fun swipeLook(start: String, prefix: String) {
        Theme.themeId = "velvet"; Theme.look = start; Theme.lookColours = "original"; Theme.playerOpen = true
        Theme.viz = "off"; Theme.mode = "light"; Theme.sysDark = false
        rule.mainClock.autoAdvance = false   // the radio moves while music plays: the test moves the clock itself
        // state changed by a gesture reaches the screen once the change is announced (Android does this by itself in the app)
        val tick = { androidx.compose.runtime.snapshots.Snapshot.sendApplyNotifications(); rule.mainClock.advanceTimeBy(600) }
        rule.setContent { MaterialTheme(typography = PoppinsType) { Surface(Modifier.fillMaxSize(), color = Paper) { Player(true) } } }
        val pic = { rule.onAllNodes(SemanticsMatcher("next look") { n ->
            n.config.getOrNull(androidx.compose.ui.semantics.SemanticsActions.CustomActions)?.any { it.label == "Next radio look" } == true })[0] }
        tick()
        val next = Eras.step(start, +1)
        // half-way through a swipe: the look follows the finger, and the coming look's name shows
        pic().performTouchInput { down(center); moveBy(Offset(-width * 0.18f, 0f)); moveBy(Offset(-width * 0.18f, 0f)) }
        tick()
        assertEquals("not changed until you let go", start, Theme.look)
        assertTrue("the coming look's name shows while sliding",
            rule.onAllNodesWithText(Eras.name(next), useUnmergedTree = true).fetchSemanticsNodes().isNotEmpty())
        capture("$prefix-mid-swipe")
        pic().performTouchInput { moveBy(Offset(width * 0.36f, 0f)); up() }        // back where it started: springs back
        tick(); assertEquals(start, Theme.look)
        pic().performTouchInput { swipeLeft(startX = right - 10f, endX = left + 10f) }
        tick()
        assertEquals(next, Theme.look)
        // its name shows (on failure: print what is on screen)
        val found = rule.onAllNodesWithText(Eras.name(next), useUnmergedTree = true).fetchSemanticsNodes().size
        if (found != 1) println("LOOKSWIPE " + rule.onRoot(useUnmergedTree = true).printToString())
        assertEquals("pop-up with ${Eras.name(next)}", 1, found)
        capture("$prefix-swiped")
        pic().performTouchInput { swipeRight(startX = left + 10f, endX = right - 10f) }
        tick(); assertEquals(start, Theme.look)
        pic().performTouchInput { swipeRight(startX = left + 10f, endX = right - 10f) }
        tick(); assertEquals(Eras.step(start, -1), Theme.look)
        pic().performTouchInput { swipeLeft(startX = right - 10f, endX = right - 60f) }   // too short: nothing
        tick(); assertEquals(Eras.step(start, -1), Theme.look)
        assertEquals("velvet", Theme.themeId)                                       // colours untouched
        rule.mainClock.advanceTimeBy(2000); tick()
        rule.onNodeWithText(Eras.name(Eras.step(start, -1))).assertDoesNotExist()   // the name goes away
        Theme.look = "std"; Theme.playerOpen = false; Theme.mode = "phone"
    }
    @Test fun n35_swipe_standard_cover_to_a_radio() = swipeLook("std", "n35-cover")
    @Test fun n36_swipe_between_radios() = swipeLook("valve", "n36-radio")
    @Test fun n19_every_theme() = everyTheme("t", true, "off") { Stations(true, "heard") }
    @Test fun n20_every_theme_player() = everyTheme("tp", false, "bars") { Player(true) }
    @Test fun n21_widgets() {
        val ctx = rule.activity
        listOf(false, true).forEach { playing ->
            VelvetWidget.update(ctx, "Radio Mango", if (playing) "Malare · Vijay Yesudas" else null, playing)
            listOf(R.layout.widget_large to VelvetWidget::class.java, R.layout.widget_small to VelvetWidgetSmall::class.java).forEach { (lay, cls) ->
                val v = VelvetWidget.views(ctx, lay, cls).apply(ctx, android.widget.FrameLayout(ctx))
                val w = (if (lay == R.layout.widget_large) 360 else 300) * 3; val h = (if (lay == R.layout.widget_large) 130 else 64) * 3
                v.measure(android.view.View.MeasureSpec.makeMeasureSpec(w, android.view.View.MeasureSpec.EXACTLY),
                    android.view.View.MeasureSpec.makeMeasureSpec(h, android.view.View.MeasureSpec.EXACTLY))
                v.layout(0, 0, w, h)
                val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888); bmp.eraseColor(0xFF3A4458.toInt())
                v.draw(android.graphics.Canvas(bmp))
                File(File("build/screens").apply { mkdirs() }, "n21-widget-${if (lay == R.layout.widget_large) "large" else "small"}-${if (playing) "playing" else "paused"}.png")
                    .outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
            }
        }
    }

    @Test fun stations_light() = shot("1-stations-light", false) { Stations(true) }
    @Test fun stations_dark() = shot("2-stations-dark", true) { Stations(true) }
    @Test fun stations_paused() = shot("3-stations-paused", false) { Stations(false) }
    @Test @Config(qualifiers = "w360dp-h740dp-xxhdpi") fun stations_small() = shot("4-stations-360", false) { Stations(true) }
    @Test fun player_light() = shot("5-player-light", false) { Player(true) }
    @Test fun player_dark() = shot("6-player-dark", true) { Player(true) }
    @Test fun player_paused_nosong() = shot("7-player-paused", false) { Player(false, song = false) }
    @Test @Config(qualifiers = "w360dp-h640dp-xxhdpi") fun player_small() = shot("8-player-360x640", false) { Player(true) }
    @Test fun search_empty() = shot("9-search", false) {
        SearchContent(every, "Malayalam", { "Malayalam" }, emptySet(), null, false, { _, _, _ -> }, {}, {}, {}, {}, null) {} }
    @Test fun search_dark() = shot("10-search-dark", true) {
        SearchContent(sts, "Malayalam", { "Malayalam" }, setOf("malayalam:radiomango"), null, false, { _, _, _ -> }, {}, {}, {}, {}, "radio") {} }
}
