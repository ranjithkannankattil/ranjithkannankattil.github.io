package com.ranjithkb.radionative

import android.content.Context
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
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
import androidx.compose.material.icons.outlined.Radio
import androidx.compose.material3.*
import androidx.compose.runtime.*
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

/* The "Maison, easy to read" look: cream paper, velvet plum and gold; serif station names, big text and
   big buttons (every button at least 48 dp) so it's comfortable for every age. Dark mode follows the phone. */

val Serif = FontFamily(
    Font(R.font.cormorant_medium, FontWeight.Medium),
    Font(R.font.cormorant_semibold, FontWeight.SemiBold),
    Font(R.font.cormorant_semibold, FontWeight.Bold),
    Font(R.font.cormorant_semibold_italic, FontWeight.SemiBold, FontStyle.Italic),
    Font(R.font.cormorant_semibold_italic, FontWeight.Medium, FontStyle.Italic))

internal val Title get() = if (Theme.dark) Color(0xFFF1E9EE) else Color(0xFF2A1424)
internal val AccentText get() = if (Theme.dark) Color(0xFFD9A9CB) else Color(0xFF6B2D5C)
internal val Line get() = if (Theme.dark) Color(0xFF3A2A35) else Color(0xFFDED7C9)
internal val Soft get() = if (Theme.dark) Color(0xFFC9BBC5) else Color(0xFF4A4A4C)
internal val BarBg get() = if (Theme.dark) Color(0xFF241520) else Color(0xFF2A1424)
internal val PlayerBg get() = if (Theme.dark) Color(0xFF140D12) else Color(0xFFF0EDE6)
internal val ArtBg get() = if (Theme.dark) Color(0xFF241520) else Color(0xFF2A1424)
internal val GoldC = Color(0xFFC9A86A)
private val Cream = Color(0xFFF0EDE6)
private val BarSoft = Color(0xFFB9A8B4)
private val BarIcon = Color(0xFFE8E3EA)

private val Pad = 24.dp

/** Tagline and the name in the serif, with a search button. */
@Composable
fun Header(onSearch: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(start = Pad, end = 10.dp, top = 10.dp), verticalAlignment = Alignment.Bottom) {
        Column(Modifier.weight(1f)) {
            Text("Elegant sounds, always free", fontSize = 13.sp, fontStyle = FontStyle.Italic, color = AccentText)
            Text("Radio Velvet", fontFamily = Serif, fontWeight = FontWeight.Medium, fontSize = 32.sp, lineHeight = 36.sp,
                color = Title)
        }
        IconButton(onSearch, Modifier.size(52.dp)) { Icon(Icons.Filled.Search, "Search all stations", Modifier.size(28.dp), tint = Title) }
    }
}

class LangTab(val id: String, val label: String, val pinned: Boolean = false, val star: Boolean = false, val icon: Boolean = false)

/** Languages as words with a plum underline under the one you're on. Press and hold to pin, move or remove. */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun LangTabs(tabs: List<LangTab>, selected: String, onClick: (LangTab) -> Unit, onLong: (LangTab) -> Unit) {
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    Column {
        LazyRow(Modifier.padding(top = 6.dp), contentPadding = PaddingValues(horizontal = Pad),
            horizontalArrangement = Arrangement.spacedBy(18.dp)) {
            items(tabs, key = { it.id }) { t ->
                val on = t.id == selected
                Column(Modifier.width(IntrinsicSize.Max).heightIn(min = 48.dp).combinedClickable(onClick = { onClick(t) },
                    onLongClickLabel = "Pin, move or remove", onLongClick = {
                        haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress); onLong(t) }),
                    verticalArrangement = Arrangement.Bottom) {
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 8.dp)) {
                        if (t.star) { Icon(Icons.Filled.Star, null, Modifier.size(16.dp), tint = GoldC); Spacer(Modifier.width(6.dp)) }
                        if (t.icon) { Icon(Icons.Filled.Language, null, Modifier.size(18.dp), tint = AccentText); Spacer(Modifier.width(6.dp)) }
                        if (t.pinned) { Icon(Icons.Filled.PushPin, "Pinned", Modifier.size(13.dp), tint = AccentText); Spacer(Modifier.width(4.dp)) }
                        Text(t.label, fontSize = 15.sp, fontWeight = if (on || t.star) FontWeight.Medium else FontWeight.Normal,
                            color = if (on) Title else if (t.star || t.icon) AccentText else Soft)
                    }
                    Box(Modifier.height(2.dp).fillMaxWidth().background(if (on) AccentText else Color.Transparent))
                }
            }
        }
        HorizontalDivider(Modifier.padding(horizontal = Pad), color = Line)
    }
}

/** All · FM · Akashvani · Online (and your favourites in this language), with the A–Z switch. */
@Composable
fun CatRow(cats: List<Triple<String, String, Int>>, selected: String, onSelect: (String) -> Unit, az: Boolean, onAz: () -> Unit) {
    Row(Modifier.fillMaxWidth().padding(start = Pad - 10.dp, end = 10.dp, top = 2.dp), verticalAlignment = Alignment.CenterVertically) {
        LazyRow(Modifier.weight(1f)) {
            items(cats, key = { it.first }) { (k, label, n) ->
                val on = k == selected
                Box(Modifier.heightIn(min = 48.dp).clip(RoundedCornerShape(8.dp)).clickable { onSelect(k) }.padding(horizontal = 10.dp),
                    contentAlignment = Alignment.Center) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (k == "fav") { Icon(Icons.Filled.Favorite, null, Modifier.size(15.dp), tint = AccentText); Spacer(Modifier.width(5.dp)) }
                        Text(if (n >= 0) "$label $n" else label, fontSize = 15.sp, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal,
                            color = if (on) Title else Soft)
                    }
                }
            }
        }
        Box(Modifier.heightIn(min = 48.dp).clip(RoundedCornerShape(8.dp)).clickable(onClickLabel = if (az) "Show in the usual order" else "Sort A to Z", onClick = onAz)
            .padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                if (az) { Icon(Icons.Filled.Check, null, Modifier.size(16.dp), tint = AccentText); Spacer(Modifier.width(4.dp)) }
                Text("A–Z", fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = if (az) AccentText else Soft)
            }
        }
    }
}

/** One station: big serif name, a plain line below, ♡ on the right. The playing one is plum with a gold dot. */
@Composable
fun StationRow(s: Station, sub: String, fav: Boolean, current: Boolean, playing: Boolean, onPlay: () -> Unit, onFav: () -> Unit,
               highlight: String = "") {
    Column {
        Row(Modifier.fillMaxWidth().heightIn(min = 58.dp).clickable(onClickLabel = "Play ${s.name}", onClick = onPlay)
            .padding(start = Pad, end = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(8.dp).clip(CircleShape).background(if (current) GoldC else Color.Transparent))
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f).padding(vertical = 6.dp)) {
                val nameColor = if (current) AccentText else if (s.offline) Soft else Title
                Text(highlighted(s.name, highlight), fontFamily = Serif, fontWeight = FontWeight.SemiBold, fontSize = 21.sp, lineHeight = 23.sp,
                    color = nameColor, maxLines = 2, overflow = TextOverflow.Ellipsis)
                val note = listOf(if (current) (if (playing) "Now playing" else "Paused") else "", sub,
                    if (s.offline) "Not working today" else s.geoNote).filter { it.isNotBlank() }.joinToString(" · ")
                if (note.isNotBlank()) Text(note, fontSize = 13.sp, color = if (current) AccentText else Soft,
                    fontWeight = if (current) FontWeight.Medium else FontWeight.Normal, maxLines = 1, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 1.dp))
            }
            IconButton(onFav, Modifier.size(48.dp)) {
                Icon(if (fav) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                    if (fav) "Remove ${s.name} from favourites" else "Add ${s.name} to favourites",
                    Modifier.size(24.dp), tint = if (fav) AccentText else Soft)
            }
        }
        HorizontalDivider(Modifier.padding(horizontal = Pad), color = Line)
    }
}

private fun catLabel(c: String) = mapOf("fm" to "FM", "air" to "Akashvani", "am" to "AM").getOrElse(c) { c.replaceFirstChar { it.uppercase() } }

private fun highlighted(name: String, q: String) = buildAnnotatedString {
    val i = if (q.isBlank()) -1 else name.indexOf(q, ignoreCase = true)
    if (i < 0) append(name) else {
        append(name.substring(0, i))
        withStyle(SpanStyle(background = if (Theme.dark) Color(0xFF4A2A40) else Color(0xFFEEDFE8))) { append(name.substring(i, i + q.length)) }
        append(name.substring(i + q.length))
    }
}

/** Station, song and the big play button on top; ♡ ⏮ ⏭ Cast below (✕ appears only while paused). Swipe to change station. */
@Composable
fun MiniPlayer(now: NowState, c: androidx.media3.session.MediaController?, isFav: Boolean, onFav: () -> Unit, onClose: () -> Unit,
               cast: CastUi, onCast: () -> Unit, onSleep: () -> Unit, open: () -> Unit) {
    var drag by remember { mutableFloatStateOf(0f) }
    val station = now.md.station?.toString() ?: ""
    val song = now.md.title?.toString() ?: ""
    val hasSong = song.isNotBlank() && song != station
    val artist = (now.md.artist?.toString() ?: "").split(" · ").filter { it != station }.joinToString(" · ")
    Surface(color = BarBg, shadowElevation = 10.dp) {
        Column(Modifier.fillMaxWidth()) {
            Row(Modifier.fillMaxWidth().clickable(onClickLabel = "Open the player", onClick = open)
                .pointerInput(c) { detectHorizontalDragGestures(onDragEnd = {
                    if (drag < -120) c?.seekToNextMediaItem() else if (drag > 120) c?.seekToPreviousMediaItem(); drag = 0f },
                    onDragCancel = { drag = 0f }) { _, d -> drag += d } }
                .padding(start = Pad, end = 16.dp, top = 10.dp, bottom = 0.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f).padding(end = 12.dp)) {
                    Text(if (cast.connected) "$station · on your TV / speaker" else station, fontSize = 14.sp, fontWeight = FontWeight.Medium,
                        color = GoldC, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    val status = now.error ?: if (now.buffering) "Connecting…" else null
                    Text(buildAnnotatedString {
                        append(if (hasSong) song else status ?: "Live radio")
                        if (hasSong && artist.isNotBlank()) withStyle(SpanStyle(fontStyle = FontStyle.Italic, color = BarSoft)) { append(" — $artist") }
                    }, fontFamily = Serif, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, lineHeight = 23.sp, color = Color(0xFFF1E9EE),
                        maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 1.dp))
                    if (hasSong && status != null) Text(status, fontSize = 13.sp, color = BarSoft, maxLines = 1)
                }
                val dark = Theme.dark
                Box(Modifier.size(52.dp).clip(CircleShape).background(if (dark) GoldC else Cream).border(2.dp, GoldC, CircleShape)
                    .clickable(onClickLabel = if (now.playing) "Pause" else "Play") {
                        c?.let { if (it.isPlaying) it.pause() else { it.prepare(); it.play() } } },
                    contentAlignment = Alignment.Center) {
                    Icon(if (now.playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (now.playing) "Pause" else "Play",
                        Modifier.size(28.dp), tint = Color(0xFF2A1424))
                }
            }
            Row(Modifier.fillMaxWidth().height(50.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                @Composable fun Cell(label: String, onClick: () -> Unit, content: @Composable () -> Unit) =
                    Box(Modifier.weight(1f).fillMaxHeight().clip(RoundedCornerShape(12.dp)).clickable(onClickLabel = label, onClick = onClick),
                        contentAlignment = Alignment.Center) { content() }
                Cell(if (isFav) "Remove from favourites" else "Add to favourites", onFav) {
                    Icon(if (isFav) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                        if (isFav) "Remove from favourites" else "Add to favourites", Modifier.size(28.dp), tint = if (isFav) GoldC else BarIcon) }
                Cell("Previous station", { c?.seekToPreviousMediaItem() }) {
                    Icon(Icons.Filled.SkipPrevious, "Previous station", Modifier.size(34.dp), tint = BarIcon) }
                Cell("Next station", { c?.seekToNextMediaItem() }) {
                    Icon(Icons.Filled.SkipNext, "Next station", Modifier.size(34.dp), tint = BarIcon) }
                val sleepOn = SleepTimer.at > 0
                Cell(if (sleepOn) "Sleep timer on" else "Sleep timer", onSleep) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(painterResource(R.drawable.ic_sleep), if (sleepOn) "Sleep timer on" else "Sleep timer", Modifier.size(26.dp),
                            tint = if (sleepOn) GoldC else BarIcon)
                        if (sleepOn) Text(sleepLeft(), color = GoldC, fontSize = 11.sp, lineHeight = 12.sp)
                    } }
                if (cast.available) Cell(if (cast.connected) "Casting: change or stop" else "Cast to a TV or speaker", onCast) {
                    Icon(if (cast.connected) Icons.Filled.CastConnected else Icons.Filled.Cast,
                        if (cast.connected) "Casting" else "Cast", Modifier.size(27.dp), tint = if (cast.connected) GoldC else BarIcon) }
                // ✕ only while paused, so a stray tap can't stop the radio
                if (!now.playing && !now.buffering) Cell("Stop and close the player", onClose) {
                    Icon(Icons.Filled.Close, "Stop and close the player", Modifier.size(26.dp), tint = BarIcon.copy(alpha = 0.8f)) }
            }
        }
    }
}

/** Stations · Favourites · Info, with words under the icons. */
@Composable
fun BottomNav(tab: Int, favCount: Int, go: (Int) -> Unit) {
    Column(Modifier.background(Paper).navigationBarsPadding()) {
        HorizontalDivider(color = Line)
        Row(Modifier.fillMaxWidth().height(64.dp)) {
            listOf(Triple(Icons.Outlined.Radio, "Stations", 0), Triple(Icons.Filled.FavoriteBorder, "Favourites ($favCount)", 1),
                Triple(Icons.Outlined.Info, "Info", 2)).forEach { (icon, label, i) ->
                val on = tab == i
                Column(Modifier.weight(1f).fillMaxHeight().clickable(onClickLabel = label) { go(i) },
                    horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Icon(if (on && i == 1) Icons.Filled.Favorite else if (on && i == 0) Icons.Filled.Radio else if (on) Icons.Filled.Info else icon,
                        null, Modifier.size(26.dp), tint = if (on) AccentText else Soft)
                    Text(label, fontSize = 13.sp, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal, color = if (on) AccentText else Soft,
                        modifier = Modifier.padding(top = 2.dp))
                }
            }
        }
    }
}

/** The big player: cover, song, rating, play controls and Share · Spotify · Sleep · Cast. Fills the screen evenly. */
@Composable
fun PlayerContent(now: NowState, c: androidx.media3.session.MediaController?, language: String, cast: CastUi,
                  onCast: () -> Unit, onShare: () -> Unit, onSpotify: (() -> Unit)?, onSleep: () -> Unit,
                  onCloseAll: () -> Unit, collapse: () -> Unit, rating: @Composable () -> Unit) {
    val station = now.md.station?.toString() ?: ""
    val song = now.md.title?.toString() ?: ""
    val hasSong = song.isNotBlank() && song != station
    val artist = (now.md.artist?.toString() ?: "").split(" · ").filter { it != station }.joinToString(" · ")
    BoxWithConstraints(Modifier.fillMaxSize().background(PlayerBg).statusBarsPadding().navigationBarsPadding()) {
        val h = maxHeight
        val art = minOf(280f, maxWidth.value - 64f, h.value * 0.36f).coerceAtLeast(120f)
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).heightIn(min = h)
            .padding(start = Pad, end = Pad, top = 8.dp, bottom = 18.dp),
            verticalArrangement = Arrangement.SpaceBetween, horizontalAlignment = Alignment.CenterHorizontally) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                IconButton(collapse, Modifier.size(52.dp).offset(x = (-12).dp)) {
                    Icon(Icons.Filled.KeyboardArrowDown, "Back to the stations", Modifier.size(32.dp), tint = Title) }
                Text(if (language.isNotBlank()) "Now playing · $language" else "Now playing", Modifier.weight(1f),
                    fontSize = 15.sp, fontWeight = FontWeight.Medium, color = Soft, textAlign = TextAlign.Center, maxLines = 1)
                if (!now.playing && !now.buffering) IconButton(onCloseAll, Modifier.size(52.dp).offset(x = 12.dp)) {
                    Icon(Icons.Filled.Close, "Stop and close the player", Modifier.size(26.dp), tint = Soft) }
                else Spacer(Modifier.size(52.dp))
            }
            Box(Modifier.padding(top = 10.dp).size(art.dp).shadow(24.dp, ambientColor = Color(0x66000000), spotColor = Color(0x66000000))
                .background(ArtBg), contentAlignment = Alignment.Center) {
                val bmp = artBitmap(now.md.artworkUri?.toString())
                if (bmp != null) Image(bmp.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
                else Box(Modifier.fillMaxSize().padding(11.dp).border(1.dp, GoldC.copy(alpha = 0.55f)), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(painterResource(R.drawable.ic_logo_mark), null, Modifier.size((art * 0.3f).dp), tint = GoldC)
                        Text(station, Modifier.padding(top = 10.dp, start = 12.dp, end = 12.dp), fontSize = 14.sp, color = BarSoft,
                            textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            Column(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                if (hasSong) Text("on $station", fontSize = 16.sp, fontWeight = FontWeight.Medium, color = AccentText, textAlign = TextAlign.Center,
                    maxLines = 1, overflow = TextOverflow.Ellipsis)
                val big = if (hasSong) song else station
                Text(big, fontFamily = Serif, fontWeight = FontWeight.SemiBold, fontSize = if (big.length > 24) 28.sp else 34.sp,
                    lineHeight = if (big.length > 24) 32.sp else 38.sp, color = Title, textAlign = TextAlign.Center, maxLines = 2,
                    overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 4.dp))
                val second = now.error ?: if (now.buffering) "Connecting…" else if (hasSong) artist else if (cast.connected) "Playing on your TV / speaker" else "Live radio"
                if (second.isNotBlank()) Text(second, fontFamily = Serif, fontStyle = FontStyle.Italic, fontWeight = FontWeight.SemiBold,
                    fontSize = 20.sp, lineHeight = 23.sp, color = Soft, textAlign = TextAlign.Center, maxLines = 2, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 2.dp))
                rating()
            }
            Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(34.dp)) {
                IconButton({ c?.seekToPreviousMediaItem() }, Modifier.size(64.dp)) {
                    Icon(Icons.Filled.SkipPrevious, "Previous station", Modifier.size(40.dp), tint = Title) }
                val dark = Theme.dark
                Box(Modifier.size(92.dp).clip(CircleShape).background(if (dark) GoldC else Color(0xFF6B2D5C)).border(3.dp, GoldC, CircleShape)
                    .clickable(onClickLabel = if (now.playing) "Pause" else "Play") { c?.let { if (it.isPlaying) it.pause() else { it.prepare(); it.play() } } },
                    contentAlignment = Alignment.Center) {
                    Icon(if (now.playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (now.playing) "Pause" else "Play",
                        Modifier.size(44.dp), tint = if (dark) Color(0xFF140D12) else Cream)
                }
                IconButton({ c?.seekToNextMediaItem() }, Modifier.size(64.dp)) {
                    Icon(Icons.Filled.SkipNext, "Next station", Modifier.size(40.dp), tint = Title) }
            }
            Row(Modifier.fillMaxWidth().padding(top = 16.dp).drawBehind {
                drawLine(Line, Offset(0f, 0f), Offset(size.width, 0f), 1.dp.toPx())
                drawLine(Line, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) }.height(80.dp)) {
                @Composable fun Cell(label: String, enabled: Boolean, first: Boolean, onClick: () -> Unit, icon: @Composable () -> Unit) =
                    Column(Modifier.weight(1f).fillMaxHeight().drawBehind { if (!first) drawLine(Line, Offset(0f, 0f), Offset(0f, size.height), 1.dp.toPx()) }
                        .clickable(enabled = enabled, onClickLabel = label, onClick = onClick),
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                        Box(Modifier.alpha(if (enabled) 1f else 0.35f)) { icon() }
                        Text(label, fontSize = 14.sp, fontWeight = FontWeight.Medium, color = Title.copy(alpha = if (enabled) 1f else 0.4f),
                            modifier = Modifier.padding(top = 6.dp), maxLines = 1)
                    }
                Cell("Share", true, true, onShare) { Icon(Icons.Filled.Share, null, Modifier.size(24.dp), tint = Title) }
                Cell("Spotify", onSpotify != null, false, { onSpotify?.invoke() }) { Icon(Icons.Filled.PlayCircle, null, Modifier.size(24.dp), tint = Title) }
                val sleepOn = SleepTimer.at > 0
                Cell(if (sleepOn) sleepLeft() else "Sleep", true, false, onSleep) {
                    Icon(painterResource(R.drawable.ic_sleep), null, Modifier.size(24.dp), tint = if (sleepOn) GoldC else Title) }
                if (cast.available) Cell(if (cast.connected) "Casting" else "Cast", true, false, onCast) {
                    Icon(if (cast.connected) Icons.Filled.CastConnected else Icons.Filled.Cast, null, Modifier.size(24.dp),
                        tint = if (cast.connected) GoldC else Title) }
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
    Column(Modifier.fillMaxSize().background(Paper).statusBarsPadding().navigationBarsPadding().imePadding()) {
        Row(Modifier.padding(start = 10.dp, end = 20.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(close, Modifier.size(52.dp)) { Icon(Icons.Filled.ChevronLeft, "Back", Modifier.size(32.dp), tint = Title) }
            Text("Search", fontFamily = Serif, fontWeight = FontWeight.SemiBold, fontSize = 32.sp, color = Title)
        }
        Row(Modifier.padding(start = Pad, end = Pad, top = 10.dp).fillMaxWidth().height(60.dp).clip(RoundedCornerShape(14.dp))
            .background(Paper2).drawBehind { drawLine(GoldC, Offset(0f, size.height - 1.dp.toPx()), Offset(size.width, size.height - 1.dp.toPx()), 2.dp.toPx()) }
            .padding(start = 18.dp, end = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Search, null, Modifier.size(24.dp), tint = Title)
            Spacer(Modifier.width(12.dp))
            val focus = remember { androidx.compose.ui.focus.FocusRequester() }
            LaunchedEffect(Unit) { try { focus.requestFocus() } catch (e: Exception) { } }
            Box(Modifier.weight(1f)) {
                if (q.isEmpty()) Text(cat?.second ?: "Station name", fontSize = 18.sp, color = Soft)
                BasicTextField(q, { q = it; cat = null }, Modifier.fillMaxWidth().focusRequester(focus), singleLine = true,
                    textStyle = TextStyle(fontSize = 18.sp, color = Title, fontFamily = Poppins), cursorBrush = SolidColor(AccentText))
            }
            if (q.isNotEmpty() || cat != null) IconButton({ q = ""; cat = null }, Modifier.size(52.dp)) {
                Icon(Icons.Filled.Close, "Clear search", Modifier.size(22.dp), tint = Title) }
            else if (onVoice != null) IconButton(onVoice, Modifier.size(52.dp)) {
                Icon(Icons.Filled.Mic, "Search by voice", Modifier.size(26.dp), tint = AccentText) }
        }
        val searching = q.isNotBlank() || cat != null
        androidx.compose.foundation.lazy.LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
            item {
                Text(when {
                    all == null -> "Loading every station…"
                    searching -> "${results.size} station${if (results.size == 1) "" else "s"} found"
                    else -> "Search all ${"%,d".format(all.size)} stations, any language."
                }, Modifier.padding(start = Pad, end = Pad, top = 12.dp), fontSize = 14.sp, color = Soft)
            }
            if (!searching) {
                if (recent.isNotEmpty()) {
                    item { Text("Recent searches", Modifier.padding(start = Pad, top = 26.dp, bottom = 4.dp), fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = AccentText) }
                    items(recent, key = { "r|$it" }) { r ->
                        Row(Modifier.fillMaxWidth().heightIn(min = 52.dp).clickable { q = r }.padding(start = Pad, end = 8.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.History, null, Modifier.size(22.dp), tint = Soft); Spacer(Modifier.width(14.dp))
                            Text(r, Modifier.weight(1f), fontFamily = Serif, fontWeight = FontWeight.SemiBold, fontSize = 20.sp, color = Title, maxLines = 1)
                            IconButton({ saveRecent(recent - r) }, Modifier.size(48.dp)) { Icon(Icons.Filled.Close, "Remove $r from recent searches", Modifier.size(18.dp), tint = Soft) }
                        }
                        HorizontalDivider(Modifier.padding(horizontal = Pad), color = Line)
                    }
                }
                item {
                    Text("Try", Modifier.padding(start = Pad, top = 26.dp, bottom = 12.dp), fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = AccentText)
                    FlowRow(Modifier.padding(horizontal = Pad), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        @Composable fun Chip(label: String, gold: Boolean = false, onClick: () -> Unit) =
                            Surface(shape = RoundedCornerShape(24.dp), color = Color.Transparent, border = BorderStroke(1.dp, if (gold) GoldC else Line),
                                modifier = Modifier.heightIn(min = 48.dp).clip(RoundedCornerShape(24.dp)).clickable(onClick = onClick)) {
                                Row(Modifier.padding(horizontal = 18.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                                    if (gold) { Icon(Icons.Filled.Star, null, Modifier.size(15.dp), tint = GoldC); Spacer(Modifier.width(6.dp)) }
                                    Text(label, fontSize = 16.sp, color = Title)
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
                    item { Text(currentLang, Modifier.padding(start = Pad, top = 20.dp), fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = AccentText) }
                    items(here, key = { "h|" + it.key }) { s ->
                        StationRow(s, catLabel(s.category), s.key in favKeys, "st|${s.key}" == nowId, playing,
                            onPlay = { pick(s) }, onFav = { onFav(s) }, highlight = q.trim())
                    }
                }
                if (other.isNotEmpty()) {
                    item { Text(if (here.isEmpty()) "Results" else "Other languages", Modifier.padding(start = Pad, top = 20.dp), fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold, color = AccentText) }
                    items(other, key = { "o|" + it.key }) { s ->
                        StationRow(s, langOf(s), s.key in favKeys, "st|${s.key}" == nowId, playing,
                            onPlay = { pick(s) }, onFav = { onFav(s) }, highlight = q.trim())
                    }
                }
                if (all != null && results.isEmpty()) item {
                    Text("No station by that name. Try part of the name, like \"Mango\" or \"AIR\".", Modifier.padding(Pad), fontSize = 16.sp, color = Soft)
                }
            }
        }
    }
}
