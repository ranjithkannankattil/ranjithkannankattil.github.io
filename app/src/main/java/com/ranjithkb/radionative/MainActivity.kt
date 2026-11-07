package com.ranjithkb.radionative

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.URL

private val Paper = Color(0xFFF0EDE6)
private val Paper2 = Color(0xFFE7E2D6)
private val Ink = Color(0xFF1B1B1F)
private val InkSoft = Color(0xFF4A4A4C)
private val Accent = Color(0xFF2F6B4F)
private val AccentSoft = Color(0xFFDCE9E1)

class MainActivity : ComponentActivity() {
    private var controller by mutableStateOf<MediaController?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Accent, onPrimary = Color.White, background = Paper,
                surface = Paper, onSurface = Ink, onBackground = Ink, secondaryContainer = AccentSoft,
                surfaceVariant = Paper2, outline = InkSoft)) {
                Surface(Modifier.fillMaxSize(), color = Paper) { App(controller) }
            }
        }
    }

    override fun onStart() {
        super.onStart()
        val token = SessionToken(this, ComponentName(this, PlaybackService::class.java))
        val f = MediaController.Builder(this, token).buildAsync()
        f.addListener({ controller = f.get() }, MoreExecutors.directExecutor())
    }

    override fun onStop() {
        controller?.release(); controller = null
        super.onStop()
    }
}

/** What the player is doing, as Compose state. */
class NowState(val c: MediaController?) {
    var playing by mutableStateOf(c?.isPlaying == true)
    var buffering by mutableStateOf(false)
    var md by mutableStateOf(c?.mediaMetadata ?: MediaMetadata.EMPTY)
    var id by mutableStateOf(c?.currentMediaItem?.mediaId)
    var error by mutableStateOf<String?>(null)
}

@Composable
fun rememberNow(c: MediaController?): NowState {
    val s = remember(c) { NowState(c) }
    DisposableEffect(c) {
        val l = object : Player.Listener {
            override fun onEvents(p: Player, e: Player.Events) {
                s.playing = p.isPlaying; s.md = p.mediaMetadata; s.id = p.currentMediaItem?.mediaId
                s.buffering = p.playbackState == Player.STATE_BUFFERING
                s.error = p.playerError?.let { "Station not answering — try another" }
            }
        }
        c?.addListener(l)
        onDispose { c?.removeListener(l) }
    }
    return s
}

@Composable
fun App(c: MediaController?) {
    val ctx = LocalContext.current
    val prefs = remember { ctx.getSharedPreferences("app", Context.MODE_PRIVATE) }
    val favs = remember { Favs(ctx) }
    var favList by remember { mutableStateOf(favs.all()) }
    fun refreshFavs() { favList = favs.all() }
    var cols by remember { mutableStateOf<List<Collection>>(emptyList()) }
    var colId by remember { mutableStateOf(prefs.getString("col", "malayalam")!!) }
    var stations by remember { mutableStateOf<List<Station>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var tab by remember { mutableIntStateOf(prefs.getInt("tab", 0)) }
    var cat by remember { mutableStateOf("all") }
    var q by remember { mutableStateOf("") }
    var pickLang by remember { mutableStateOf(false) }
    var full by remember { mutableStateOf(false) }
    val now = rememberNow(c)

    LaunchedEffect(Unit) { cols = Repo.collections(ctx) }
    LaunchedEffect(colId) {
        loading = true; cat = "all"; prefs.edit().putString("col", colId).apply()
        stations = Repo.stations(ctx, colId); loading = false
    }
    val col = cols.find { it.id == colId }
    fun langOf(s: Station) = cols.find { it.id == s.col }?.name ?: ""
    fun play(list: List<Station>, s: Station) {
        val ctl = c ?: return
        val live = list.filter { !it.offline || it.key == s.key }
        ctl.setMediaItems(live.map { it.toItem(langOf(it)) }, live.indexOfFirst { it.key == s.key }.coerceAtLeast(0), 0)
        ctl.prepare(); ctl.play()
    }

    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Text("Radio", fontSize = 28.sp, fontWeight = FontWeight.SemiBold, color = Ink,
            modifier = Modifier.padding(start = 20.dp, top = 12.dp, bottom = 8.dp))
        TabRow(selectedTabIndex = tab, containerColor = Paper, contentColor = Ink) {
            Tab(tab == 0, { tab = 0; prefs.edit().putInt("tab", 0).apply() }, text = { Text("Stations") })
            Tab(tab == 1, { tab = 1; prefs.edit().putInt("tab", 1).apply() },
                text = { Text("♥ Favourites  ${favList.size}") })
        }
        Box(Modifier.weight(1f)) {
            if (tab == 0) {
                val shown = stations.filter { (cat == "all" || it.category == cat) && (q.isBlank() || it.name.contains(q, true)) }
                    .sortedBy { it.offline }
                Column {
                    Row(Modifier.padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                        OutlinedButton({ pickLang = true }, Modifier.heightIn(min = 48.dp)) {
                            Text(col?.name ?: "Language", fontWeight = FontWeight.SemiBold)
                            Icon(Icons.Filled.ArrowDropDown, null)
                        }
                        Spacer(Modifier.width(10.dp))
                        OutlinedTextField(q, { q = it }, Modifier.weight(1f), placeholder = { Text("Search") }, singleLine = true,
                            leadingIcon = { Icon(Icons.Filled.Search, null) })
                    }
                    if (col != null && col.cats.isNotEmpty()) LazyRow(contentPadding = PaddingValues(horizontal = 16.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        item { FilterChip(cat == "all", { cat = "all" }, { Text("All ${stations.size}") }) }
                        items(col.cats.filter { (k, _) -> stations.any { it.category == k } }) { (k, label) ->
                            FilterChip(cat == k, { cat = k }, { Text("$label ${stations.count { it.category == k }}") })
                        }
                    }
                    if (loading) LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 8.dp), color = Accent)
                    val fk = favList.map { it.key }.toSet()
                    LazyColumn(contentPadding = PaddingValues(bottom = 12.dp)) {
                        items(shown, key = { it.key }) { s ->
                            StationRow(s, col?.cats?.find { it.first == s.category }?.second ?: "", s.key in fk,
                                "st|${s.key}" == now.id, now.playing,
                                onPlay = { play(shown, s) }, onFav = { favs.toggle(s); refreshFavs() })
                        }
                    }
                }
            } else {
                FavsTab(favList, now, langOf = ::langOf, onPlay = { s -> play(favList, s) },
                    onChanged = { refreshFavs() }, favs = favs)
            }
        }
        if (now.id != null) MiniPlayer(now, c) { full = true }
    }
    if (pickLang) LanguageDialog(cols, colId, { colId = it; tab = 0; pickLang = false }) { pickLang = false }
    if (full) FullPlayer(now, c) { full = false }
}

@Composable
fun StationRow(s: Station, sub: String, fav: Boolean, current: Boolean, playing: Boolean, onPlay: () -> Unit, onFav: () -> Unit) {
    Row(Modifier.fillMaxWidth().background(if (current) AccentSoft else Color.Transparent).clickable(onClick = onPlay)
        .padding(start = 16.dp, end = 4.dp, top = 8.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Tile(s.name, current && playing)
        Column(Modifier.weight(1f).padding(start = 12.dp)) {
            Text(s.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis,
                color = if (s.offline) InkSoft else Ink)
            Text(listOf(sub, if (s.offline) "Not working today" else "").filter { it.isNotBlank() }.joinToString(" · "),
                fontSize = 13.sp, color = InkSoft, maxLines = 1)
        }
        IconButton(onFav, Modifier.size(48.dp)) {
            Icon(if (fav) Icons.Filled.Favorite else Icons.Outlined.FavoriteBorder,
                if (fav) "Remove from favourites" else "Add to favourites", tint = if (fav) Accent else InkSoft)
        }
    }
}

@Composable
fun Tile(name: String, on: Boolean, size: Int = 44) {
    val ini = name.split(Regex("[^\\p{L}\\p{N}]+")).filter { it.isNotEmpty() }.take(2).joinToString("") { it.take(1) }.uppercase()
    Box(Modifier.size(size.dp).clip(RoundedCornerShape(4.dp)).background(if (on) Accent else AccentSoft), contentAlignment = Alignment.Center) {
        if (on) Icon(Icons.Filled.GraphicEq, null, tint = Color.White)
        else Text(ini, color = Accent, fontWeight = FontWeight.SemiBold, fontSize = (size / 3).sp)
    }
}

@Composable
fun FavsTab(list: List<Station>, now: NowState, langOf: (Station) -> String, onPlay: (Station) -> Unit,
            onChanged: () -> Unit, favs: Favs) {
    var edit by remember { mutableStateOf(false) }
    var undo by remember { mutableStateOf<Pair<Station, Int>?>(null) }
    LaunchedEffect(undo) { if (undo != null) { delay(8000); undo = null } }
    Column {
        Row(Modifier.fillMaxWidth().padding(16.dp, 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(if (list.isEmpty()) "No favourites yet. Tap ♡ on any station, in any language."
                 else "${list.size} favourites", Modifier.weight(1f), color = InkSoft)
            if (list.isNotEmpty()) {
                if (edit) Button({ edit = false }, Modifier.heightIn(min = 48.dp)) { Text("Done") }
                else OutlinedButton({ edit = true }, Modifier.heightIn(min = 48.dp)) { Text("Edit order / remove") }
            }
        }
        undo?.let { (s, at) ->
            Row(Modifier.fillMaxWidth().background(AccentSoft).padding(16.dp, 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Removed ${s.name}", Modifier.weight(1f))
                TextButton({ favs.insert(s, at); undo = null; onChanged() }) { Text("Undo") }
            }
        }
        LazyColumn {
            itemsIndexed(list, key = { _, s -> s.key }) { i, s ->
                if (!edit) StationRow(s, langOf(s), true, "st|${s.key}" == now.id, now.playing,
                    onPlay = { onPlay(s) }, onFav = { undo = s to i; favs.remove(s.key); onChanged() })
                else Column(Modifier.fillMaxWidth().padding(16.dp, 8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.size(30.dp).background(AccentSoft), contentAlignment = Alignment.Center) {
                            Text("${i + 1}", color = Accent, fontWeight = FontWeight.SemiBold)
                        }
                        Column(Modifier.padding(start = 10.dp)) {
                            Text(s.name, fontWeight = FontWeight.SemiBold); Text(langOf(s), fontSize = 13.sp, color = InkSoft)
                        }
                    }
                    Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton({ favs.move(s.key, i - 1); onChanged() }, enabled = i > 0) { Text("↑ Up") }
                        OutlinedButton({ favs.move(s.key, i + 1); onChanged() }, enabled = i < list.size - 1) { Text("↓ Down") }
                        OutlinedButton({ favs.move(s.key, 0); onChanged() }, enabled = i > 0) { Text("Top") }
                        Spacer(Modifier.weight(1f))
                        OutlinedButton({ undo = s to i; favs.remove(s.key); onChanged() },
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF9B2C2C))) { Text("Remove") }
                    }
                }
                HorizontalDivider(color = Paper2)
            }
        }
    }
}

@Composable
fun LanguageDialog(cols: List<Collection>, current: String, onPick: (String) -> Unit, onClose: () -> Unit) {
    var q by remember { mutableStateOf("") }
    Dialog(onClose, DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = Paper) {
            Column(Modifier.statusBarsPadding()) {
                Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClose) { Icon(Icons.Filled.Close, "Close") }
                    OutlinedTextField(q, { q = it }, Modifier.weight(1f), placeholder = { Text("Find a language") }, singleLine = true)
                }
                LazyColumn {
                    val shown = cols.filter { q.isBlank() || it.name.contains(q, true) || it.native.contains(q, true) }
                    shown.groupBy { it.group.ifBlank { "Languages" } }.forEach { (g, cs) ->
                        item { Text(g.uppercase(), Modifier.padding(16.dp, 14.dp, 16.dp, 4.dp), fontSize = 12.sp, color = InkSoft, letterSpacing = 1.sp) }
                        items(cs, key = { it.id }) { c ->
                            Row(Modifier.fillMaxWidth().clickable { onPick(c.id) }.heightIn(min = 52.dp)
                                .background(if (c.id == current) AccentSoft else Color.Transparent).padding(horizontal = 16.dp),
                                verticalAlignment = Alignment.CenterVertically) {
                                Text(c.name, Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                                if (c.native.isNotBlank()) Text(c.native, color = InkSoft)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun artBitmap(uri: String?): Bitmap? {
    val b by produceState<Bitmap?>(null, uri) {
        value = if (uri == null) null else withContext(Dispatchers.IO) {
            try { URL(uri).openStream().use { BitmapFactory.decodeStream(it) } } catch (e: Exception) { null }
        }
    }
    return b
}

@Composable
fun Art(now: NowState, size: Int) {
    val bmp = artBitmap(now.md.artworkUri?.toString())
    if (bmp != null) Image(bmp.asImageBitmap(), null, Modifier.size(size.dp).clip(RoundedCornerShape(6.dp)), contentScale = ContentScale.Crop)
    else Tile(now.md.station?.toString() ?: now.md.title?.toString() ?: "", false, size)
}

@Composable
fun MiniPlayer(now: NowState, c: MediaController?, open: () -> Unit) {
    Row(Modifier.fillMaxWidth().background(Ink).clickable(onClick = open).navigationBarsPadding()
        .padding(12.dp, 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Art(now, 48)
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text(now.md.title?.toString() ?: "", color = Color.White, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(now.error ?: if (now.buffering) "Connecting…" else now.md.artist?.toString() ?: "",
                color = Color(0xFFBDBDBD), fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        IconButton({ c?.seekToPreviousMediaItem() }, Modifier.size(48.dp)) { Icon(Icons.Filled.SkipPrevious, "Previous station", tint = Color.White) }
        FilledIconButton({ c?.let { if (it.isPlaying) it.pause() else { it.prepare(); it.play() } } }, Modifier.size(52.dp),
            colors = IconButtonDefaults.filledIconButtonColors(containerColor = Paper, contentColor = Ink)) {
            Icon(if (now.playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (now.playing) "Pause" else "Play")
        }
        IconButton({ c?.seekToNextMediaItem() }, Modifier.size(48.dp)) { Icon(Icons.Filled.SkipNext, "Next station", tint = Color.White) }
    }
}

@Composable
fun FullPlayer(now: NowState, c: MediaController?, close: () -> Unit) {
    val scope = rememberCoroutineScope()
    var sleepAt by remember { mutableLongStateOf(0L) }
    var left by remember { mutableStateOf("") }
    LaunchedEffect(sleepAt) {
        while (sleepAt > 0) {
            val ms = sleepAt - System.currentTimeMillis()
            if (ms <= 0) { c?.pause(); sleepAt = 0; left = ""; break }
            left = "Stops in ${ms / 60000 + 1} min"; delay(15000)
        }
    }
    Dialog(close, DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = Ink) {
            Column(Modifier.statusBarsPadding().navigationBarsPadding().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Row(Modifier.fillMaxWidth()) {
                    IconButton(close) { Icon(Icons.Filled.KeyboardArrowDown, "Close", tint = Color.White) }
                    Spacer(Modifier.weight(1f))
                    Text(now.md.station?.toString() ?: "", color = Color(0xFFBDBDBD), modifier = Modifier.align(Alignment.CenterVertically))
                    Spacer(Modifier.weight(1f)); Spacer(Modifier.width(48.dp))
                }
                Spacer(Modifier.weight(1f))
                Art(now, 280)
                Spacer(Modifier.height(28.dp))
                Text(now.md.title?.toString() ?: "", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.SemiBold, maxLines = 2)
                Text(now.error ?: if (now.buffering) "Connecting…" else now.md.artist?.toString() ?: "",
                    color = Color(0xFFBDBDBD), fontSize = 16.sp, maxLines = 2, modifier = Modifier.padding(top = 6.dp))
                Spacer(Modifier.weight(1f))
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                    IconButton({ c?.seekToPreviousMediaItem() }, Modifier.size(64.dp)) {
                        Icon(Icons.Filled.SkipPrevious, "Previous station", Modifier.size(40.dp), tint = Color.White) }
                    FilledIconButton({ c?.let { if (it.isPlaying) it.pause() else { it.prepare(); it.play() } } }, Modifier.size(84.dp),
                        shape = CircleShape, colors = IconButtonDefaults.filledIconButtonColors(containerColor = Paper, contentColor = Ink)) {
                        Icon(if (now.playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (now.playing) "Pause" else "Play", Modifier.size(44.dp))
                    }
                    IconButton({ c?.seekToNextMediaItem() }, Modifier.size(64.dp)) {
                        Icon(Icons.Filled.SkipNext, "Next station", Modifier.size(40.dp), tint = Color.White) }
                }
                Spacer(Modifier.height(24.dp))
                Text(left.ifEmpty { "Sleep timer" }, color = Color(0xFFBDBDBD), fontSize = 13.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
                    listOf(15, 30, 60).forEach { m ->
                        OutlinedButton({ scope.launch { sleepAt = System.currentTimeMillis() + m * 60_000L } }) { Text("$m min", color = Color.White) }
                    }
                    if (sleepAt > 0) TextButton({ sleepAt = 0; left = "" }) { Text("Off", color = Color.White) }
                }
            }
        }
    }
}
