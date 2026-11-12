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
import androidx.compose.ui.test.captureToImage
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onRoot
import androidx.compose.ui.unit.sp
import androidx.media3.common.MediaMetadata
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode
import java.io.File

/** Draws the main screens (no phone needed) so the look can be checked: build/screens/*.png */
@RunWith(RobolectricTestRunner::class)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
@Config(sdk = [34], qualifiers = "w390dp-h844dp-xxhdpi")
class ScreensTest {
    @get:Rule val rule = createComposeRule()

    private val sts = listOf(
        Station("radiomalabar", "Radio Malabar", "online", listOf("x"), "malayalam"),
        Station("radiomango", "Radio Mango", "fm", listOf("x"), "malayalam"),
        Station("homefm", "Home FM", "fm", listOf("x"), "malayalam"),
        Station("hit967", "Hit 96.7", "fm", listOf("x"), "malayalam", geo = "AE"),
        Station("airananthapuri", "AIR Ananthapuri", "air", listOf("x"), "malayalam"),
        Station("clubfm", "Club FM 94.3 Thrissur (a very long station name)", "fm", listOf("x"), "malayalam"),
        Station("old", "Radio Old Songs", "online", listOf("x"), "malayalam", offline = true))

    private fun now(playing: Boolean = true, song: Boolean = true) = NowState(null).apply {
        this.playing = playing; id = "st|malayalam:radiomalabar"
        md = MediaMetadata.Builder().setStation("Radio Malabar").setTitle(if (song) "Karunamaya" else "Radio Malabar")
            .setArtist(if (song) "K. S. Chithra · Radio Malabar" else "Malayalam")
            .setExtras(android.os.Bundle().apply { putString("lang", "Malayalam") }).build()
    }

    private fun shot(name: String, dark: Boolean, content: @Composable () -> Unit) {
        Theme.dark = dark
        rule.setContent { MaterialTheme(typography = PoppinsType) { Surface(Modifier.fillMaxSize(), color = Paper) { content() } } }
        rule.waitForIdle()
        val dir = File("build/screens").apply { mkdirs() }
        File(dir, "$name.png").outputStream().use { rule.onRoot().captureToImage().asAndroidBitmap().compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    @Composable private fun Stations(playing: Boolean) = Column(Modifier.fillMaxSize()) {
        Header {}
        LangTabs(listOf(LangTab(PICKS, "Velvet Selection", star = true), LangTab("malayalam", "Malayalam", true),
            LangTab("english", "English"), LangTab("tamil", "Tamil"), LangTab("_langs", "All languages", icon = true)), "malayalam", {}, {})
        CatRow(listOf(Triple("all", "All", 130), Triple("fav", "Favourites", 3), Triple("fm", "FM", -1), Triple("air", "Akashvani", -1),
            Triple("online", "Online", -1)), "all", {}, true, {})
        LazyColumn(Modifier.weight(1f)) {
            items(sts) { s -> StationRow(s, mapOf("fm" to "FM", "air" to "Akashvani", "online" to "Online")[s.category] ?: "",
                s.id == "radiomango", s.id == "radiomalabar", playing, {}, {}) }
        }
        MiniPlayer(now(playing), null, true, {}, {}, CastUi(true, false), {}) {}
        BottomNav(0, 12) {}
    }

    @Composable private fun Player(playing: Boolean, song: Boolean = true) = PlayerContent(now(playing, song), null, "Malayalam", CastUi(true, false),
        {}, {}, if (song) ({}) else null, {}, {}, {}) { Text("★★★★☆  4.2 · 38 ratings", fontSize = 15.sp, color = Soft) }

    @Test fun stations_light() = shot("1-stations-light", false) { Stations(true) }
    @Test fun stations_dark() = shot("2-stations-dark", true) { Stations(true) }
    @Test fun stations_paused() = shot("3-stations-paused", false) { Stations(false) }
    @Test @Config(qualifiers = "w360dp-h740dp-xxhdpi") fun stations_small() = shot("4-stations-360", false) { Stations(true) }
    @Test fun player_light() = shot("5-player-light", false) { Player(true) }
    @Test fun player_dark() = shot("6-player-dark", true) { Player(true) }
    @Test fun player_paused_nosong() = shot("7-player-paused", false) { Player(false, song = false) }
    @Test @Config(qualifiers = "w360dp-h640dp-xxhdpi") fun player_small() = shot("8-player-360x640", false) { Player(true) }
    @Test fun search_empty() = shot("9-search", false) {
        SearchContent(sts, "Malayalam", { "Malayalam" }, emptySet(), null, false, { _, _, _ -> }, {}, {}, {}, {}, null) {} }
    @Test fun search_dark() = shot("10-search-dark", true) {
        SearchContent(sts, "Malayalam", { "Malayalam" }, setOf("malayalam:radiomango"), null, false, { _, _, _ -> }, {}, {}, {}, {}, "radio") {} }
}
