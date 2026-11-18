package com.ranjithkb.radionative

import android.graphics.Bitmap
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
import org.junit.Assert.assertEquals
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

    @Composable private fun Stations(playing: Boolean, sortBy: String = "az") = Column(Modifier.fillMaxSize()) {
        Header(onSearch = {})
        LangTabs(listOf(LangTab(PICKS, "Velvet Selection", star = true), LangTab("malayalam", "Malayalam", true),
            LangTab("english", "English"), LangTab("tamil", "Tamil"), LangTab("_langs", "All languages", icon = true)), "malayalam", {}, {})
        CatRow(listOf(Triple("all", "All", 130), Triple("fav", "Favourites", 3), Triple("fm", "FM", -1), Triple("air", "Akashvani", -1),
            Triple("online", "Online", -1)), "all", {}, SORTS.first { it.first == sortBy }.second, {})
        val shown = Stats.sort(sts, sortBy, stats)
        val top = if (sortBy == "heard") Stats.top3(shown, stats) else emptySet()
        LazyColumn(Modifier.weight(1f)) {
            items(shown) { s ->
                val base = mapOf("fm" to "FM", "air" to "Akashvani", "online" to "Online")[s.category] ?: ""
                val sub = when (sortBy) { "heard" -> Stats.heardLabel(stats.week[s.key]) + " · " + base
                    "rated" -> Stats.ratedLabel(stats.ratings[s.key]) + " · " + base; else -> base }
                StationRow(s, sub, s.id == "radiomango", s.id == "radiomalabar", playing, {}, {}, badge = s.key in top) }
        }
        MiniPlayer(now(playing), null, true, {}, {}, CastUi(true, false), {}, {}) {}
        BottomNav(0, 12) {}
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
        rule.setContent { MaterialTheme(typography = PoppinsType) { Surface(Modifier.fillMaxSize(), color = Paper) { Player(true) } } }
        val pic = { rule.onAllNodes(SemanticsMatcher("next look") { n ->
            n.config.getOrNull(androidx.compose.ui.semantics.SemanticsActions.CustomActions)?.any { it.label == "Next radio look" } == true })[0] }
        val next = Eras.step(start, +1)
        pic().performTouchInput { swipeLeft(startX = right - 10f, endX = left + 10f) }
        rule.waitForIdle()
        assertEquals(next, Theme.look)
        rule.onNodeWithText(Eras.name(next)).assertExists()                        // its name shows
        capture("$prefix-swiped")
        pic().performTouchInput { swipeRight(startX = left + 10f, endX = right - 10f) }
        rule.waitForIdle(); assertEquals(start, Theme.look)
        pic().performTouchInput { swipeRight(startX = left + 10f, endX = right - 10f) }
        rule.waitForIdle(); assertEquals(Eras.step(start, -1), Theme.look)
        pic().performTouchInput { swipeLeft(startX = right - 10f, endX = right - 60f) }   // too short: nothing
        rule.waitForIdle(); assertEquals(Eras.step(start, -1), Theme.look)
        assertEquals("velvet", Theme.themeId)                                       // colours untouched
        rule.mainClock.advanceTimeBy(2000); rule.waitForIdle()
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
