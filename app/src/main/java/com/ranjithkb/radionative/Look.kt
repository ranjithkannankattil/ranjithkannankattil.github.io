package com.ranjithkb.radionative

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.Radio
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.onSizeChanged
import kotlinx.coroutines.launch
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* The Prada-style look in Radio Velvet colours: Jost throughout, small letter-spaced capitals for labels,
   hairline dividers, fine-line icons, gold used sparingly. Compact, with every button still 44–48 dp. */

val Serif = Poppins    // one typeface everywhere (Jost)

internal val Title get() = Theme.pal.ink
internal val AccentText get() = Theme.pal.accentText
internal val Line get() = Theme.pal.line
internal val Soft get() = Theme.pal.soft
internal val BarBg get() = Theme.pal.bar
internal val PlayerBg get() = Theme.pal.playerBg
internal val ArtBg get() = Theme.pal.artBg
internal val GoldC get() = Theme.pal.gold
private val BarInk get() = Theme.pal.barInk
private val BarSoft get() = Theme.pal.barSoft
/** Gold on the bottom bar, or the bar's own text colour where gold wouldn't stand out (pale bars). */
private val BarGold get() = if (Palettes.contrast(GoldC, BarBg) >= 2.6f) GoldC else BarInk

private val Pad = 24.dp

/** Small letter-spaced capitals, the label style used across every page. */
@Composable
fun Label(text: String, color: Color = Soft, size: Int = 10, modifier: Modifier = Modifier, weight: FontWeight = FontWeight.Medium) =
    // 2 points larger than the design's sizes and a third less spacing: easier to read, same width
    Text(text.uppercase(), modifier, fontSize = (size + 2).sp, letterSpacing = ((size + 2) * 0.15f).sp, fontWeight = weight, color = color,
        maxLines = 1, overflow = TextOverflow.Ellipsis)

@Composable
fun LineIcon(id: Int, desc: String?, size: Int = 22, tint: Color = Title) =
    Icon(painterResource(id), desc, Modifier.size(size.dp), tint = tint)

/** The small logo and RADIO VELVET in spaced capitals, with search. */
@Composable
fun Header(onSearch: () -> Unit, onSettings: () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(start = Pad, end = 10.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(painterResource(R.drawable.ic_logo_mark), null, Modifier.size(30.dp), tint = if (Theme.dark) GoldC else Title)
        Spacer(Modifier.width(10.dp))
        Text("RADIO VELVET", Modifier.weight(1f), fontSize = 13.sp, letterSpacing = 4.4.sp, fontWeight = FontWeight.Medium, color = Title)
        IconButton(onSettings, Modifier.size(48.dp)) { LineIcon(R.drawable.ln_gear, "Settings", 22) }
        IconButton(onSearch, Modifier.size(48.dp)) { LineIcon(R.drawable.ln_search, "Search all stations", 22) }
    }
}

/** The Velvet Selection mark: the Velvet logo in the ink colour (gold in dark mode) with a big gold star. */
@Composable
fun VelvetStar(label: String?, size: Int) = Box(Modifier.size(size.dp).then(if (label != null) Modifier.semantics { contentDescription = label } else Modifier)) {
    Icon(painterResource(R.drawable.ic_logo_star), null, Modifier.fillMaxSize(), tint = if (Theme.dark) GoldC else Title)
    Icon(painterResource(R.drawable.ic_star_sel), null, Modifier.fillMaxSize(), tint = GoldC)
}

/** Inside the star tab: one quiet line saying where you are (the tab itself has no words), the same height as the
 *  ALL · FM · … row on the language tabs, so the list starts in the same place. */
@Composable
fun PicksHeading(empty: Boolean) = Row(Modifier.fillMaxWidth().heightIn(min = 44.dp).padding(horizontal = Pad)
    .semantics(mergeDescendants = true) { heading() }, verticalAlignment = Alignment.CenterVertically) {
    Label("Velvet Selection", Title, 9, weight = FontWeight.SemiBold)
    Text("  ·  " + (if (empty) "coming soon" else "hand-picked stations"), fontSize = 13.sp, color = Soft, maxLines = 1,
        overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
}

class LangTab(val id: String, val label: String, val pinned: Boolean = false, val star: Boolean = false, val icon: Boolean = false)

/** Languages in spaced capitals; a fine line under the one you're on. Press and hold to pin, move or remove. */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun LangTabs(tabs: List<LangTab>, selected: String, onClick: (LangTab) -> Unit, onLong: (LangTab) -> Unit) {
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    val ctx = androidx.compose.ui.platform.LocalContext.current
    Column(Modifier.padding(horizontal = Pad)) {
        LazyRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
            items(tabs, key = { it.id }) { t ->
                val on = t.id == selected
                Column((if (t.star) Modifier.tourTarget("star") else Modifier).width(IntrinsicSize.Max).heightIn(min = 44.dp).widthIn(min = if (t.star) 44.dp else 0.dp)
                    .combinedClickable(onClick = { onClick(t) },
                    onLongClickLabel = if (t.star) "Show its name" else "Pin, move or remove", onLongClick = {
                        haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress)
                        // the star tab is just the logo: holding it says what it is
                        if (t.star) android.widget.Toast.makeText(ctx, t.label, android.widget.Toast.LENGTH_SHORT).show() else onLong(t) }),
                    verticalArrangement = Arrangement.Bottom, horizontalAlignment = Alignment.CenterHorizontally) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = if (t.star) 6.dp else 9.dp)) {
                        // the Velvet Selection: the Velvet logo with a star (TalkBack still reads its name)
                        if (t.star) VelvetStar(t.label, 28)
                        else {
                            if (t.pinned) { Icon(Icons.Filled.PushPin, "Pinned", Modifier.size(11.dp), tint = Soft); Spacer(Modifier.width(4.dp)) }
                            Label(t.label, if (on) Title else Soft, 10, weight = if (on) FontWeight.SemiBold else FontWeight.Medium)
                        }
                    }
                    Box(Modifier.height(1.dp).fillMaxWidth().background(if (on) Title else Color.Transparent))
                }
            }
        }
        HorizontalDivider(color = Line)
    }
}

/** ALL · FM · AKASHVANI · ONLINE (and favourites in this language), with A–Z. */
@Composable
fun CatRow(cats: List<Triple<String, String, Int>>, selected: String, onSelect: (String) -> Unit, sortLabel: String, onSort: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(start = Pad - 8.dp, end = Pad - 8.dp), verticalAlignment = Alignment.CenterVertically) {
        LazyRow(Modifier.weight(1f)) {
            items(cats, key = { it.first }) { (k, label, n) ->
                val on = k == selected
                Box(Modifier.heightIn(min = 44.dp).clickable { onSelect(k) }.padding(horizontal = 8.dp), contentAlignment = Alignment.Center) {
                    Label(if (k == "fav") "♥ $label" + (if (n >= 0) " $n" else "") else if (n >= 0) "$label $n" else label,
                        if (on) Title else Soft, 9, weight = if (on) FontWeight.SemiBold else FontWeight.Medium)
                }
            }
        }
        Box(Modifier.heightIn(min = 44.dp).clickable(onClickLabel = "Sort: $sortLabel. Change", onClick = onSort)
            .padding(horizontal = 8.dp), contentAlignment = Alignment.Center) {
            Row(Modifier.border(1.dp, Line).padding(horizontal = 8.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("⇅ ", fontSize = 12.sp, color = AccentText)
                Label(sortLabel, AccentText, 9, weight = FontWeight.SemiBold)
            }
        }
    }
}

/** One station: clean name, a small capitals line below, ♡ on the right. The playing one has a thin gold bar. */
@Composable
fun StationRow(s: Station, sub: String, fav: Boolean, current: Boolean, playing: Boolean, onPlay: () -> Unit, onFav: () -> Unit,
               highlight: String = "", badge: Boolean = false) {
    val pad = when (Theme.spacing) { 1 -> 11.dp; 2 -> 17.dp; else -> 7.dp }
    Column(Modifier.padding(horizontal = Pad)) {
        Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min).heightIn(min = Theme.rowHeight.dp).clickable(onClickLabel = "Play ${s.name}", onClick = onPlay),
            verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.width(3.dp).fillMaxHeight().padding(vertical = 12.dp).background(if (current) GoldC else Color.Transparent))
            Spacer(Modifier.width(13.dp))
            Column(Modifier.weight(1f).padding(vertical = pad)) {
                Text(highlighted(s.name, highlight, badge), fontSize = 16.5.sp, lineHeight = 20.sp,
                    fontWeight = if (current) FontWeight.Medium else FontWeight.Normal,
                    color = if (current) AccentText else if (s.offline) Soft else Title, maxLines = 2, overflow = TextOverflow.Ellipsis)
                val note = listOf(if (current) (if (playing) "Now playing" else "Paused") else "", sub,
                    if (s.offline) "Not working today" else s.geoNote).filter { it.isNotBlank() }.joinToString(" · ")
                if (note.isNotBlank()) Label(note, if (current) AccentText else Soft, 9, Modifier.padding(top = 3.dp))
            }
            IconButton(onFav, Modifier.size(44.dp).offset(x = 12.dp)) {
                LineIcon(if (fav) R.drawable.ln_heart_fill else R.drawable.ln_heart,
                    if (fav) "Remove ${s.name} from favourites" else "Add ${s.name} to favourites", 20, if (fav) AccentText else Soft)
            }
        }
        HorizontalDivider(color = Line)
    }
}

private fun catLabel(c: String) = mapOf("fm" to "FM", "air" to "Akashvani", "am" to "AM").getOrElse(c) { c.replaceFirstChar { it.uppercase() } }

private fun highlighted(name: String, q: String, badge: Boolean = false) = buildAnnotatedString {
    val i = if (q.isBlank()) -1 else name.indexOf(q, ignoreCase = true)
    if (i < 0) append(name) else {
        append(name.substring(0, i))
        withStyle(SpanStyle(background = Theme.pal.highlight)) { append(name.substring(i, i + q.length)) }
        append(name.substring(i + q.length))
    }
    // gold ◆: one of the three most heard this week in this list
    if (badge) withStyle(SpanStyle(color = GoldC, fontSize = 11.sp)) { append("  ◆") }
}

/** Station and song with an outlined gold play button; ♡ ⏮ ⏭ sleep cast below (✕ appears only while paused). Swipe to change station. */
@Composable
fun MiniPlayer(now: NowState, c: androidx.media3.session.MediaController?, isFav: Boolean, onFav: () -> Unit, onClose: () -> Unit,
               cast: CastUi, onCast: () -> Unit, onSleep: () -> Unit, open: () -> Unit) {
    var drag by remember { mutableFloatStateOf(0f) }
    val station = now.md.station?.toString() ?: ""
    val song = now.md.title?.toString() ?: ""
    val hasSong = song.isNotBlank() && song != station
    val artist = (now.md.artist?.toString() ?: "").split(" · ").filter { it != station }.joinToString(" · ")
    Surface(color = BarBg, shadowElevation = 8.dp) {
        Column(Modifier.fillMaxWidth()) {
            Row(Modifier.fillMaxWidth().clickable(onClickLabel = "Open the player", onClick = open)
                .pointerInput(c) { detectHorizontalDragGestures(onDragEnd = {
                    if (drag < -120) c?.nextStation() else if (drag > 120) c?.prevStation(); drag = 0f },
                    onDragCancel = { drag = 0f }) { _, d -> drag += d } }
                .padding(start = Pad, end = 18.dp, top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f).padding(end = 12.dp)) {
                    Label(if (cast.connected) "$station · on your TV / speaker" else station, BarGold, 9)
                    val status = now.error ?: if (now.buffering) "Connecting…" else null
                    Text(buildAnnotatedString {
                        append(if (hasSong) song else status ?: "Live radio")
                        if (hasSong && artist.isNotBlank()) withStyle(SpanStyle(fontWeight = FontWeight.Light, color = BarSoft)) { append(" — $artist") }
                    }, fontSize = 16.sp, color = BarInk, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 3.dp))
                    if (hasSong && status != null) Text(status, fontSize = 12.sp, color = BarSoft, maxLines = 1)
                }
                Box(Modifier.size(48.dp).clip(CircleShape).border(1.dp, BarGold, CircleShape)
                    .clickable(onClickLabel = if (now.playing) "Pause" else "Play") {
                        c?.let { if (it.isPlaying) it.pause() else { it.prepare(); it.play() } } },
                    contentAlignment = Alignment.Center) {
                    LineIcon(if (now.playing) R.drawable.ln_pause else R.drawable.ln_play, if (now.playing) "Pause" else "Play", 20, BarGold)
                }
            }
            Row(Modifier.fillMaxWidth().height(48.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                @Composable fun Cell(label: String, onClick: () -> Unit, content: @Composable () -> Unit) =
                    Box(Modifier.weight(1f).fillMaxHeight().clickable(onClickLabel = label, onClick = onClick), contentAlignment = Alignment.Center) { content() }
                Cell(if (isFav) "Remove from favourites" else "Add to favourites", onFav) {
                    LineIcon(if (isFav) R.drawable.ln_heart_fill else R.drawable.ln_heart,
                        if (isFav) "Remove from favourites" else "Add to favourites", 20, if (isFav) BarGold else BarInk) }
                Cell("Previous station", { c?.prevStation() }) { LineIcon(R.drawable.ln_prev, "Previous station", 20, BarInk) }
                Cell("Next station", { c?.nextStation() }) { LineIcon(R.drawable.ln_next, "Next station", 20, BarInk) }
                val sleepOn = SleepTimer.at > 0
                Cell(if (sleepOn) "Sleep timer on" else "Sleep timer", onSleep) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        LineIcon(R.drawable.ln_sleep, if (sleepOn) "Sleep timer on" else "Sleep timer", 20, if (sleepOn) BarGold else BarInk)
                        if (sleepOn) Text(sleepLeft(), color = BarGold, fontSize = 9.sp, lineHeight = 10.sp)
                    } }
                if (cast.available) Cell(if (cast.connected) "Casting: change or stop" else "Cast to a TV or speaker", onCast) {
                    LineIcon(R.drawable.ln_cast, if (cast.connected) "Casting" else "Cast", 20, if (cast.connected) BarGold else BarInk) }
                // ✕ only while paused, so a stray tap can't stop the radio
                if (!now.playing && !now.buffering) Cell("Stop and close the player", onClose) {
                    LineIcon(R.drawable.ln_close, "Stop and close the player", 18, BarInk.copy(alpha = 0.8f)) }
            }
        }
    }
}

/** STATIONS · FAVOURITES · INFO, with fine-line icons. */
@Composable
fun BottomNav(tab: Int, favCount: Int, go: (Int) -> Unit) {
    Column(Modifier.background(Paper).navigationBarsPadding()) {
        HorizontalDivider(color = Line)
        Row(Modifier.fillMaxWidth().height(58.dp)) {
            listOf(Triple(R.drawable.ln_radio, "Stations", 0), Triple(R.drawable.ln_heart, if (Theme.text >= 2) "Favourites" else "Favourites $favCount", 1),
                Triple(R.drawable.ln_info, "Info", 2)).forEach { (icon, label, i) ->
                val on = tab == i
                // the tab you're on sits in a soft pill of the theme's colour, so it's easy to see at a glance
                val pillInk = if (Theme.dark) GoldC else AccentText
                Column(Modifier.weight(1f).fillMaxHeight().clickable(onClickLabel = label) { go(i) }
                    .semantics { selected = on },
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Box(Modifier.size(58.dp, 30.dp).clip(RoundedCornerShape(15.dp))
                        .background(if (on) pillInk.copy(alpha = if (Theme.dark) 0.20f else 0.13f) else Color.Transparent),
                        contentAlignment = Alignment.Center) {
                        LineIcon(if (on && i == 1) R.drawable.ln_heart_fill else icon, null, 21, if (on) pillInk else Soft)
                    }
                    Label(label, if (on) pillInk else Soft, 9, Modifier.padding(top = 3.dp), if (on) FontWeight.SemiBold else FontWeight.Medium)
                }
            }
        }
    }
}

/** The big player: cover, song, rating, controls and SHARE · SPOTIFY · SLEEP · CAST. Fills the screen evenly. */
@Composable
fun PlayerContent(now: NowState, c: androidx.media3.session.MediaController?, language: String, cast: CastUi,
                  onCast: () -> Unit, onShare: () -> Unit, onSpotify: (() -> Unit)?, onSleep: () -> Unit,
                  onCloseAll: () -> Unit, collapse: () -> Unit, rating: @Composable () -> Unit) {
    val station = now.md.station?.toString() ?: ""
    val song = now.md.title?.toString() ?: ""
    val hasSong = song.isNotBlank() && song != station
    val artist = (now.md.artist?.toString() ?: "").split(" · ").filter { it != station }.joinToString(" · ")
    BoxWithConstraints(Modifier.fillMaxSize().background(PlayerBg).pointerInput(Unit) { detectTapGestures { } }
        .statusBarsPadding().navigationBarsPadding()) {
        val h = maxHeight; val fullW = maxWidth
        val art = minOf(260f, maxWidth.value - 80f, h.value * 0.32f).coerceAtLeast(110f)
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).heightIn(min = h)
            .padding(start = Pad, end = Pad, top = 6.dp, bottom = 18.dp),
            verticalArrangement = Arrangement.SpaceBetween, horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(collapse, Modifier.size(48.dp).offset(x = (-12).dp)) { LineIcon(R.drawable.ln_down, "Back to the stations", 24) }
                Box(Modifier.weight(1f), contentAlignment = Alignment.Center) {
                    Label(if (language.isNotBlank()) "Now playing · $language" else "Now playing", Soft, 10) }
                if (!now.playing && !now.buffering) IconButton(onCloseAll, Modifier.size(48.dp).offset(x = 12.dp)) {
                    LineIcon(R.drawable.ln_close, "Stop and close the player", 20, Soft) }
                else Spacer(Modifier.size(48.dp))
            }
            val era = Eras.byId(Theme.look)
            // swiping the cover (or the radio, away from its knobs) flips through the player looks: Standard and the six radios
            val ctx = androidx.compose.ui.platform.LocalContext.current
            var shown by remember { mutableStateOf<String?>(null) }
            LaunchedEffect(shown) { if (shown != null) { kotlinx.coroutines.delay(1400); shown = null } }
            val flip: (Int) -> Unit = { dir -> Theme.look = Eras.step(Theme.look, dir); Theme.save(ctx); shown = Eras.name(Theme.look) }
            val slide = rememberLookSlide()
            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Column(Modifier.fillMaxWidth().lookSlide(slide), horizontalAlignment = Alignment.CenterHorizontally) {
            if (era != null) {
                // a radio from one era: it takes the cover's place (its own needles and meters replace the visualiser)
                val rw = fullW.value - 48f
                val rh = minOf(h.value * 0.44f, rw * era.h / era.w).coerceAtLeast(150f)
                    .let { if (Eras.hasTone(era.id)) it + 44f else it }   // room for "Reset knobs" under the radio
                Box(Modifier.padding(top = 10.dp).fillMaxWidth().height(rh.dp), contentAlignment = Alignment.Center) {
                    EraRadio(era, now, c, Modifier.fillMaxSize(), onSwipe = flip, slide = slide)
                }
            } else {
                Box(Modifier.padding(top = 10.dp).size(art.dp).background(ArtBg).themeSwipe(flip, slide), contentAlignment = Alignment.Center) {
                    val bmp = artBitmap(now.md.artworkUri?.toString()?.takeUnless(CarArt::isStationArt))
                    if (bmp != null) Image(bmp.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop,
                        alpha = if (Theme.viz == "circle") 0.35f else 1f)
                    // the visualiser gets its own space on the cover, so it never runs over the logo or the station's name
                    val band = Theme.viz == "bars" || Theme.viz == "waves"
                    val nameColor = if (Palettes.luma(ArtBg) < 0.5f) Color(0xFFE6DCE2) else Title
                    if (bmp == null) Box(Modifier.fillMaxSize().padding(12.dp).border(1.dp, GoldC.copy(alpha = 0.5f))) {
                        Column(Modifier.fillMaxSize().padding(horizontal = 10.dp, vertical = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            Spacer(Modifier.weight(1f))
                            Icon(painterResource(R.drawable.ic_logo_mark), null, Modifier.size((art * (if (band) 0.2f else 0.26f)).dp), tint = GoldC)
                            // the station name on the cover (not with the circle, which draws round the logo; it's shown below anyway)
                            if (Theme.viz != "circle") Label(station, nameColor, 9, Modifier.padding(top = 10.dp, start = 4.dp, end = 4.dp))
                            Spacer(Modifier.weight(1f))
                            if (band) VizView(Theme.viz, now.playing, Modifier.fillMaxWidth().height((art * 0.30f).dp).padding(horizontal = 4.dp))
                        }
                        if (Theme.viz == "circle") VizView("circle", now.playing, Modifier.fillMaxSize().padding(4.dp))
                    } else {
                        if (Theme.viz == "circle") VizView("circle", now.playing, Modifier.fillMaxSize().padding(8.dp))
                        else if (band) Box(Modifier.align(Alignment.BottomCenter).fillMaxWidth().height((art * 0.34f).dp)
                            .background(ArtBg.copy(alpha = 0.72f))) {   // a soft band over the song's cover picture
                            VizView(Theme.viz, now.playing, Modifier.fillMaxSize().padding(horizontal = 14.dp, vertical = 8.dp))
                        }
                    }
                }
                VizSwitcher()   // off: a quiet "Visualiser" switch; on: Bars · Waves · Circle · Off
            }
            }
            ThemeToast(slide.peek ?: shown)   // one name pop-up over both: the coming look while sliding, then the new one
            }
            Column(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                if (hasSong) Label("On $station", AccentText, 10)
                val big = if (hasSong) song else station
                Text(big, fontSize = if (big.length > 24) 22.sp else 26.sp, lineHeight = if (big.length > 24) 27.sp else 31.sp,
                    fontWeight = FontWeight.Light, letterSpacing = 0.5.sp, color = Title, textAlign = TextAlign.Center, maxLines = 2,
                    overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 8.dp))
                val second = now.error ?: if (now.buffering) "Connecting…" else if (hasSong) artist else if (cast.connected) "Playing on your TV / speaker" else "Live radio"
                if (second.isNotBlank()) Text(second, fontSize = 15.sp, fontWeight = FontWeight.Light, color = Soft, textAlign = TextAlign.Center,
                    maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 3.dp))
                rating()
            }
            Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(40.dp)) {
                IconButton({ c?.prevStation() }, Modifier.size(56.dp)) { LineIcon(R.drawable.ln_prev, "Previous station", 26) }
                val ring = if (Theme.dark) GoldC else Title
                Box(Modifier.size(80.dp).clip(CircleShape).border(1.dp, ring, CircleShape)
                    .clickable(onClickLabel = if (now.playing) "Pause" else "Play") { c?.let { if (it.isPlaying) it.pause() else { it.prepare(); it.play() } } },
                    contentAlignment = Alignment.Center) {
                    LineIcon(if (now.playing) R.drawable.ln_pause else R.drawable.ln_play, if (now.playing) "Pause" else "Play", 26, ring)
                }
                IconButton({ c?.nextStation() }, Modifier.size(56.dp)) { LineIcon(R.drawable.ln_next, "Next station", 26) }
            }
            Row(Modifier.fillMaxWidth().padding(top = 14.dp).drawBehind {
                drawLine(Line, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx())
                drawLine(Line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) }.height(66.dp)) {
                @Composable fun Cell(label: String, enabled: Boolean, first: Boolean, onClick: () -> Unit, icon: Int, tint: Color = Title) =
                    Column(Modifier.weight(1f).fillMaxHeight().drawBehind { if (!first) drawLine(Line, Offset(0f, 0f), Offset(0f, size.height), 1.dp.toPx()) }
                        .clickable(enabled = enabled, onClickLabel = label, onClick = onClick).alpha(if (enabled) 1f else 0.35f),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        LineIcon(icon, null, 20, tint)
                        Label(label, Title, 9, Modifier.padding(top = 7.dp))
                    }
                Cell("Share", true, true, onShare, R.drawable.ln_share)
                Cell("Spotify", onSpotify != null, false, { onSpotify?.invoke() }, R.drawable.ln_spotify)
                val sleepOn = SleepTimer.at > 0
                Cell(if (sleepOn) sleepLeft() else "Sleep", true, false, onSleep, R.drawable.ln_sleep, if (sleepOn) GoldC else Title)
                if (cast.available) Cell(if (cast.connected) "Casting" else "Cast", true, false, onCast, R.drawable.ln_cast, if (cast.connected) GoldC else Title)
            }
        }
    }
}

/** Search every station in every language. Recent searches and quick ideas before you type. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SearchContent(all: List<Station>?, currentLang: String, langOf: (Station) -> String, favKeys: Set<String>, nowId: String?, playing: Boolean,
                  onPlay: (List<Station>, Station, String) -> Unit, onFav: (Station) -> Unit, onPicks: () -> Unit, onSurprise: () -> Unit,
                  onVoice: (() -> Unit)?, voiceText: String?, close: () -> Unit) {
    val ctx = LocalContext.current
    val prefs = remember { ctx.getSharedPreferences("app", Context.MODE_PRIVATE) }
    var recent by remember { mutableStateOf(prefs.getString("searches", "")!!.split('\n').filter { it.isNotBlank() }) }
    fun saveRecent(l: List<String>) { recent = l; prefs.edit().putString("searches", l.joinToString("\n")).apply() }
    var q by remember { mutableStateOf("") }
    var cat by remember { mutableStateOf<Pair<String, String>?>(null) }     // quick idea: (category, label)
    LaunchedEffect(voiceText) { if (!voiceText.isNullOrBlank()) { q = voiceText; cat = null } }
    val results = remember(q, cat, all) {
        val l = all ?: emptyList()
        when {
            cat != null -> l.filter { (it.category == cat!!.first || (cat!!.first == "news" && it.col.contains("news"))) && !it.offline }
            q.isBlank() -> emptyList()
            else -> l.filter { it.name.contains(q.trim(), true) }.sortedWith(compareBy({ it.offline }, { !it.name.startsWith(q.trim(), true) }, { it.name.lowercase() }))
        }.take(150)
    }
    Column(Modifier.fillMaxSize().background(Paper).pointerInput(Unit) { detectTapGestures { } }
        .statusBarsPadding().navigationBarsPadding().imePadding()) {
        Row(Modifier.padding(start = 10.dp, end = 20.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(close, Modifier.size(52.dp)) { LineIcon(R.drawable.ln_back, "Back", 24) }
            Label("Search", Title, 13, weight = FontWeight.Medium)
        }
        Row(Modifier.padding(start = Pad, end = Pad, top = 8.dp).fillMaxWidth().height(52.dp)
            .drawBehind { drawLine(Title, Offset(0f, size.height - 0.5.dp.toPx()), Offset(size.width, size.height - 0.5.dp.toPx()), 1.dp.toPx()) }
            .padding(start = 2.dp, end = 0.dp), verticalAlignment = Alignment.CenterVertically) {
            LineIcon(R.drawable.ln_search, null, 20)
            Spacer(Modifier.width(12.dp))
            val focus = remember { androidx.compose.ui.focus.FocusRequester() }
            LaunchedEffect(Unit) { try { focus.requestFocus() } catch (e: Exception) { } }
            Box(Modifier.weight(1f)) {
                if (q.isEmpty()) Text(cat?.second ?: "Station name", fontSize = 17.sp, fontWeight = FontWeight.Light, color = Soft)
                BasicTextField(q, { q = it; cat = null }, Modifier.fillMaxWidth().focusRequester(focus), singleLine = true,
                    textStyle = TextStyle(fontSize = 17.sp, color = Title, fontFamily = Poppins), cursorBrush = SolidColor(AccentText))
            }
            if (q.isNotEmpty() || cat != null) IconButton({ q = ""; cat = null }, Modifier.size(52.dp)) {
                LineIcon(R.drawable.ln_close, "Clear search", 18) }
            else if (onVoice != null) IconButton(onVoice, Modifier.size(52.dp)) {
                Icon(Icons.Outlined.Mic, "Search by voice", Modifier.size(22.dp), tint = AccentText) }
        }
        val searching = q.isNotBlank() || cat != null
        androidx.compose.foundation.lazy.LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                Text(when {
                    all == null -> "Loading every station…"
                    searching -> "${results.size} station${if (results.size == 1) "" else "s"} found"
                    else -> "Search all ${"%,d".format(all.size)} stations, any language."
                }, Modifier.padding(start = Pad, end = Pad, top = 12.dp), fontSize = 13.sp, color = Soft)
            }
            if (!searching) {
                if (recent.isNotEmpty()) {
                    item { Label("Recent searches", AccentText, 10, Modifier.padding(start = Pad, top = 26.dp, bottom = 4.dp)) }
                    items(recent, key = { "r|$it" }) { r ->
                        Row(Modifier.fillMaxWidth().heightIn(min = 52.dp).clickable { q = r }.padding(start = Pad, end = 8.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.History, null, Modifier.size(22.dp), tint = Soft); Spacer(Modifier.width(14.dp))
                            Text(r, Modifier.weight(1f), fontSize = 16.5.sp, color = Title, maxLines = 1)
                            IconButton({ saveRecent(recent - r) }, Modifier.size(48.dp)) { Icon(Icons.Filled.Close, "Remove $r from recent searches", Modifier.size(18.dp), tint = Soft) }
                        }
                        HorizontalDivider(Modifier.padding(horizontal = Pad), color = Line)
                    }
                }
                item {
                    Label("Try", AccentText, 10, Modifier.padding(start = Pad, top = 26.dp, bottom = 12.dp))
                    FlowRow(Modifier.padding(horizontal = Pad), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        @Composable fun Chip(label: String, gold: Boolean = false, onClick: () -> Unit) =
                            Surface(shape = RoundedCornerShape(0.dp), color = Color.Transparent, border = BorderStroke(1.dp, if (gold) GoldC else Line),
                                modifier = Modifier.heightIn(min = 44.dp).clickable(onClick = onClick)) {
                                Row(Modifier.padding(horizontal = 18.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                                    if (gold) { Icon(Icons.Filled.Star, null, Modifier.size(15.dp), tint = GoldC); Spacer(Modifier.width(6.dp)) }
                                    Label(label, Title, 10)
                                }
                            }
                        Chip("Velvet Selection", gold = true, onClick = onPicks)
                        Chip("Akashvani") { cat = "air" to "Akashvani stations" }
                        Chip("Devotional") { cat = "devotional" to "Devotional stations" }
                        Chip("News") { cat = "news" to "News stations" }
                        Chip("Surprise me", onClick = onSurprise)
                    }
                }
            } else {
                val here = results.filter { langOf(it) == currentLang && currentLang.isNotBlank() }
                val other = results - here.toSet()
                fun pick(s: Station) { if (q.isNotBlank()) saveRecent((listOf(q.trim()) + recent.filter { !it.equals(q.trim(), true) }).take(5)); onPlay(results, s, q) }
                if (here.isNotEmpty()) {
                    item { Label(currentLang, AccentText, 10, Modifier.padding(start = Pad, top = 20.dp)) }
                    items(here, key = { "h|" + it.key }) { s ->
                        StationRow(s, catLabel(s.category), s.key in favKeys, "st|${s.key}" == nowId, playing,
                            onPlay = { pick(s) }, onFav = { onFav(s) }, highlight = q.trim())
                    }
                }
                if (other.isNotEmpty()) {
                    item { Label(if (here.isEmpty()) "Results" else "Other languages", AccentText, 10, Modifier.padding(start = Pad, top = 20.dp)) }
                    items(other, key = { "o|" + it.key }) { s ->
                        StationRow(s, langOf(s), s.key in favKeys, "st|${s.key}" == nowId, playing,
                            onPlay = { pick(s) }, onFav = { onFav(s) }, highlight = q.trim())
                    }
                }
                if (all != null && results.isEmpty()) item {
                    Text("No station by that name. Try part of the name, like \"Mango\" or \"AIR\".", Modifier.padding(Pad), fontSize = 15.sp, color = Soft)
                }
            }
        }
    }
}

/**
 * The player look follows the finger while swiping (smooth and fluid, his ask Nov 2026): it slides and fades a little
 * with the drag; let go past the threshold (or flick) and the next look glides in from that side with a soft spring;
 * a short swipe springs back. [x] is the slide in pixels, [peek] the name of the look that's coming.
 */
class LookSlide(val scope: kotlinx.coroutines.CoroutineScope) {
    val x = androidx.compose.animation.core.Animatable(0f)
    var width = 1f
    var peek by mutableStateOf<String?>(null)
    /** How far along the slide is, 0…1 (for the fade and the slight shrink). */
    val frac get() = (kotlin.math.abs(x.value) / width).coerceIn(0f, 1f)
    fun drag(d: Float, next: (Int) -> String?) = scope.launch {
        x.snapTo(x.value + d * (if (kotlin.math.abs(x.value) > width * 0.5f) 0.4f else 0.85f))   // a little resistance further out
        peek = if (kotlin.math.abs(x.value) > width * 0.12f) next(if (x.value < 0) +1 else -1) else null
    }
    /** Let go: [dir] is the look change (0 = none). The new look enters from the side the finger went towards. */
    fun release(dir: Int) = scope.launch {
        peek = null
        if (dir != 0) x.snapTo(dir * width * 0.42f)
        x.animateTo(0f, androidx.compose.animation.core.spring(dampingRatio = 0.86f, stiffness = 380f))
    }
}

@Composable
fun rememberLookSlide(): LookSlide { val sc = rememberCoroutineScope(); return remember { LookSlide(sc) } }

/** The slide on whatever shows the look (the cover or a radio). */
fun Modifier.lookSlide(s: LookSlide?): Modifier = if (s == null) this else this
    .onSizeChanged { s.width = it.width.toFloat().coerceAtLeast(1f) }
    .graphicsLayer {
        translationX = s.x.value
        val f = s.frac
        alpha = 1f - 0.65f * f
        scaleX = 1f - 0.05f * f; scaleY = 1f - 0.05f * f
    }

/** Sideways swipe of at least 64 dp (or a flick): left = next player look, right = previous. TalkBack gets the same as actions. */
fun Modifier.themeSwipe(flip: (Int) -> Unit, slide: LookSlide? = null): Modifier = this
    .pointerInput(slide) {
        var drag = 0f
        val th = 64.dp.toPx()
        val flick = 900.dp.toPx()                     // px per second
        val vt = androidx.compose.ui.input.pointer.util.VelocityTracker()
        detectHorizontalDragGestures(onDragStart = { drag = 0f; vt.resetTracking() },
            onDragEnd = {
                val v = vt.calculateVelocity().x
                val dir = when { drag < -th || (v < -flick && drag < 0) -> +1; drag > th || (v > flick && drag > 0) -> -1; else -> 0 }
                if (dir != 0) flip(dir)
                slide?.release(dir); drag = 0f
            },
            onDragCancel = { drag = 0f; slide?.release(0) }) { ch, d ->
            ch.consume(); drag += d
            vt.addPosition(ch.uptimeMillis, ch.position)
            slide?.drag(d) { Eras.name(Eras.step(Theme.look, it)) }
        }
    }
    .semantics { customActions = listOf(CustomAccessibilityAction("Next radio look") { flip(+1); true },
        CustomAccessibilityAction("Previous radio look") { flip(-1); true }) }

/** The new look's name, shown for a moment over the cover. */
@Composable
fun BoxScope.ThemeToast(t: String?) {
    androidx.compose.animation.AnimatedVisibility(t != null, Modifier.align(Alignment.Center),
        enter = androidx.compose.animation.fadeIn(), exit = androidx.compose.animation.fadeOut()) {
        val d = t ?: return@AnimatedVisibility
        Box(Modifier.background(Color(0xE6140D12)).padding(horizontal = 20.dp, vertical = 12.dp)) {
            Text(d, color = Color(0xFFF3E6C8), fontSize = 17.sp)
        }
    }
}
