package com.ranjithkb.radionative

import android.content.ComponentName
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors

/**
 * Radio Velvet on Android TV and Google TV (Nov 2026). Same app and same player service as the phone; this is the
 * big-screen, remote-control face of it: rows of stations (Velvet Selection, Favourites, then every language,
 * Malayalam first), arrows to move, OK to play, and a full-screen player. The remote's play / pause / next / previous
 * keys go straight to the player, like on the phone's lock screen. Always the dark look: TVs are watched in dim rooms.
 */
class TvActivity : ComponentActivity() {
    private var controller by mutableStateOf<MediaController?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Theme.tvDark = true
        Theme.load(this); DataSaver.load(this); DataUse.init(this); Lang.load(this)
        setContent {
            MaterialTheme(typography = PoppinsType, colorScheme = darkColorScheme(primary = Accent, background = Paper, surface = Paper,
                onSurface = Title, onBackground = Title)) {
                Surface(Modifier.fillMaxSize(), color = Paper) { TvApp(controller) }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        val f = MediaController.Builder(this, SessionToken(this, ComponentName(this, PlaybackService::class.java))).buildAsync()
        f.addListener({ controller = f.get() }, MoreExecutors.directExecutor())
    }

    override fun onStop() { controller?.release(); controller = null; super.onStop() }
}

/** One row on the TV home screen. */
data class TvRow(val id: String, val title: String)

/** The rows, in order: Velvet Selection, Favourites (when there are any), then every language in the site's order. Pure. */
fun tvRows(cols: List<Collection>, hasFavs: Boolean): List<TvRow> =
    listOf(TvRow(PICKS, t("Velvet Selection"))) + (if (hasFavs) listOf(TvRow("_favs", t("Favourites"))) else emptyList()) +
        cols.map { TvRow(it.id, it.name) }

@Composable
fun TvApp(c: MediaController?) {
    val ctx = LocalContext.current
    val now = rememberNow(c)
    var cols by remember { mutableStateOf<List<Collection>>(emptyList()) }
    var favs by remember { mutableStateOf(Favs(ctx).all()) }
    var player by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { cols = Repo.collections(ctx) }
    fun langOf(s: Station) = cols.find { it.id == s.col }?.name ?: ""
    fun play(list: List<Station>, s: Station) {
        val ctl = c ?: return
        val live = list.filter { !it.offline || it.key == s.key }
        ctl.setMediaItems(live.map { it.toItem(langOf(it)) }, live.indexOfFirst { it.key == s.key }.coerceAtLeast(0), 0)
        ctl.prepare(); ctl.play()
        player = true
    }
    Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF2A1424), Paper)))) {
        if (player && now.id != null) {
            BackHandler { player = false }
            TvPlayer(now, c, isFav = favs.any { "st|${it.key}" == now.id }, onFav = {
                val key = now.id?.removePrefix("st|")
                (Favs(ctx).all().find { it.key == key } ?: run {
                    // not a favourite yet: build it from what's playing
                    val ex = c?.currentMediaItem?.mediaMetadata?.extras
                    val streams = ex?.getStringArrayList("streams")
                    if (key == null || streams == null) null
                    else Station(key.substringAfter(':'), ex.getString("station") ?: "", "", streams, col = key.substringBefore(':'))
                })?.let { Favs(ctx).toggle(it); favs = Favs(ctx).all() }
            })
        } else TvHome(cols, favs, now, onOpenPlayer = { player = true }) { list, s -> play(list, s) }
    }
}

@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
@Composable
fun TvHome(cols: List<Collection>, favs: List<Station>, now: NowState, onOpenPlayer: () -> Unit,
           load: (suspend (String) -> List<Station>)? = null, play: (List<Station>, Station) -> Unit) {
    val ctx = LocalContext.current
    val first = remember { FocusRequester() }
    // A TV is driven by the remote: make sure Compose is in remote (keyboard) mode, where tiles can take focus,
    // even on boxes that report a touchscreen.
    val input = androidx.compose.ui.platform.LocalInputModeManager.current
    LaunchedEffect(Unit) { runCatching {
        input.requestInputMode(androidx.compose.ui.input.InputMode.Keyboard) } }
    val rows = remember(cols, favs.isNotEmpty()) { tvRows(cols, favs.isNotEmpty()) }
    Column(Modifier.fillMaxSize().padding(start = 34.dp, top = 28.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(start = 14.dp, end = 48.dp)) {
            Icon(painterResource(R.drawable.ic_logo_mark), null, Modifier.size(40.dp), tint = GoldC)
            Text("RADIO VELVET", Modifier.padding(start = 14.dp), fontSize = 22.sp, letterSpacing = 8.sp, color = Title, fontWeight = FontWeight.Medium)
            Spacer(Modifier.weight(1f))
            if (now.id != null) TvChip((if (now.playing) "▶  " else "❚❚  ") + (now.md.extras?.getString("station") ?: now.md.station ?: ""), onOpenPlayer)
        }
        LazyColumn(Modifier.fillMaxSize().padding(top = 18.dp), contentPadding = PaddingValues(bottom = 60.dp),
            verticalArrangement = Arrangement.spacedBy(22.dp)) {
            items(rows, key = { it.id }) { r ->
                var list by remember(r.id) { mutableStateOf<List<Station>?>(null) }
                LaunchedEffect(r.id, favs) {
                    list = (if (r.id == "_favs") favs else load?.invoke(r.id) ?: if (r.id == PICKS) Repo.picks(ctx) else Repo.stations(ctx, r.id)).filter { !it.offline }
                }
                Column {
                    Text(r.title, fontSize = 20.sp, color = Title, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 14.dp, bottom = 4.dp))
                    val l = list
                    if (l == null) Text(t("Loading…"), color = Soft, fontSize = 15.sp, modifier = Modifier.padding(start = 14.dp).height(96.dp))
                    else LazyRow(horizontalArrangement = Arrangement.spacedBy(16.dp), contentPadding = PaddingValues(start = 14.dp, end = 48.dp, top = 10.dp, bottom = 10.dp)) {
                        items(l, key = { it.key }) { s ->
                            val isFirst = r.id == rows.first().id && s == l.first()
                            TvCard(s, r.title, playing = now.id == "st|${s.key}", mod = if (isFirst) Modifier.focusRequester(first) else Modifier) { play(l, s) }
                            // the remote starts on the very first station (asked from that card, which is always on screen)
                            if (isFirst) LaunchedEffect(Unit) { runCatching { first.requestFocus() } }
                        }
                    }
                }
            }
        }
    }
}

/** A station tile: grows a little and lights up in gold when the remote is on it. */
@Composable
fun TvCard(s: Station, row: String, playing: Boolean, mod: Modifier = Modifier, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val k by animateFloatAsState(if (focused) 1.08f else 1f, label = "tvcard")
    Column(mod.width(220.dp).height(112.dp).scale(k).clip(RoundedCornerShape(14.dp))
        .background(if (focused) AccentSoft else Paper2)
        .border(if (focused) 3.dp else 1.dp, if (focused) GoldC else Line, RoundedCornerShape(14.dp))
        .onFocusChanged { focused = it.isFocused }
        .clickable(onClickLabel = t("Play")) { onClick() }
        .semantics { contentDescription = s.name + (if (playing) ", " + t("Now playing") else "") }
        .padding(16.dp), verticalArrangement = Arrangement.SpaceBetween) {
        Text(s.name, fontSize = 18.sp, color = Title, maxLines = 2, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Medium)
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (playing) Box(Modifier.size(8.dp).clip(CircleShape).background(GoldC))
            Text(listOf(if (playing) t("Now playing") else "", s.geoNote)
                .filter { it.isNotBlank() }.joinToString(" · ").ifBlank { row },
                Modifier.padding(start = if (playing) 8.dp else 0.dp), fontSize = 13.sp, color = if (playing) GoldC else Soft, maxLines = 1)
        }
    }
}

@Composable
fun TvChip(text: String, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    Box(Modifier.clip(RoundedCornerShape(24.dp)).background(if (focused) AccentSoft else Paper2)
        .border(if (focused) 2.dp else 1.dp, if (focused) GoldC else Line, RoundedCornerShape(24.dp))
        .onFocusChanged { focused = it.isFocused }.clickable(onClickLabel = t("Open the player")) { onClick() }
        .padding(horizontal = 18.dp, vertical = 10.dp)) { Text(text, color = Title, fontSize = 15.sp, maxLines = 1) }
}

/** The full-screen player: cover, station, song and big buttons for the remote. Back returns to the rows. */
@OptIn(androidx.compose.ui.ExperimentalComposeUiApi::class)
@Composable
fun TvPlayer(now: NowState, c: MediaController?, isFav: Boolean, onFav: () -> Unit) {
    val playBtn = remember { FocusRequester() }
    val input = androidx.compose.ui.platform.LocalInputModeManager.current
    LaunchedEffect(Unit) { runCatching {
        input.requestInputMode(androidx.compose.ui.input.InputMode.Keyboard); playBtn.requestFocus() } }
    val station = now.md.extras?.getString("station") ?: now.md.station?.toString() ?: ""
    val song = now.md.title?.toString()?.takeIf { it != station }
    Row(Modifier.fillMaxSize().padding(64.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(340.dp).clip(RoundedCornerShape(20.dp)).background(ArtBg), contentAlignment = Alignment.Center) {
            val bmp = artBitmap(now.md.artworkUri?.toString()?.takeUnless(CarArt::isStationArt))   // song covers only, never station logos
            if (bmp != null) androidx.compose.foundation.Image(bmp.asImageBitmap(), null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            else Icon(painterResource(R.drawable.ic_logo_mark), null, Modifier.size(150.dp), tint = GoldC)
        }
        Column(Modifier.padding(start = 56.dp).weight(1f)) {
            Text((now.md.extras?.getString("lang") ?: "").uppercase(), fontSize = 16.sp, letterSpacing = 4.sp, color = GoldC)
            Text(station, fontSize = 44.sp, color = Title, fontWeight = FontWeight.Medium, maxLines = 2, modifier = Modifier.padding(top = 6.dp))
            Text(song ?: when { now.buffering -> t("Connecting…"); now.playing -> t("Live"); else -> "" }, fontSize = 24.sp,
                color = InkSoft, maxLines = 2, modifier = Modifier.padding(top = 10.dp))
            now.error?.let { Text(t(it), fontSize = 18.sp, color = AccentText, modifier = Modifier.padding(top = 10.dp)) }
            Row(Modifier.padding(top = 36.dp), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                TvButton("⏮", t("Previous station")) { c?.seekToPrevious() }
                TvButton(if (now.playing) "❚❚" else "▶", if (now.playing) t("Pause") else t("Play"), Modifier.focusRequester(playBtn), big = true) {
                    if (c?.isPlaying == true) c.pause() else { c?.prepare(); c?.play() } }
                TvButton("⏭", t("Next station")) { c?.seekToNext() }
                TvButton(if (isFav) "♥" else "♡", if (isFav) t("Remove from favourites") else t("Add to favourites"), onClick = onFav)
            }
        }
    }
}

@Composable
fun TvButton(icon: String, label: String, mod: Modifier = Modifier, big: Boolean = false, onClick: () -> Unit) {
    var focused by remember { mutableStateOf(false) }
    val size = if (big) 96.dp else 76.dp
    Box(mod.size(size).scale(if (focused) 1.1f else 1f).clip(CircleShape).background(if (focused) GoldC else Paper2)
        .border(1.dp, if (focused) GoldC else Line, CircleShape)
        .onFocusChanged { focused = it.isFocused }.clickable(onClickLabel = label) { onClick() }
        .semantics { contentDescription = label }, contentAlignment = Alignment.Center) {
        Text(icon, fontSize = if (big) 34.sp else 26.sp, color = if (focused) Color(0xFF2A1424) else Title)
    }
}
