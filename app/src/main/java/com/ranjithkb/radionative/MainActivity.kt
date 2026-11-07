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
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextAlign
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState
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
import androidx.lifecycle.lifecycleScope
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
private val Accent = Color(0xFF6B2D5C)      // velvet plum
private val AccentSoft = Color(0xFFEEDFE8)
private val Velvet = Color(0xFF2A1424)
private val Gold = Color(0xFFC9A86A)

/** Signed-in name (null = signed out) and a counter that bumps when favourites change from the account. */
object Session { var name by mutableStateOf<String?>(null); var favsVersion by mutableIntStateOf(0); var busy by mutableStateOf(false) }

val Poppins = FontFamily(
    Font(R.font.poppins_regular, FontWeight.Normal),
    Font(R.font.poppins_medium, FontWeight.Medium),
    Font(R.font.poppins_semibold, FontWeight.SemiBold),
    Font(R.font.poppins_semibold, FontWeight.Bold),
    Font(R.font.poppins_italic, FontWeight.Normal, FontStyle.Italic))
private val T = Typography()
val PoppinsType = Typography(
    displayLarge = T.displayLarge.copy(fontFamily = Poppins), displayMedium = T.displayMedium.copy(fontFamily = Poppins),
    displaySmall = T.displaySmall.copy(fontFamily = Poppins), headlineLarge = T.headlineLarge.copy(fontFamily = Poppins),
    headlineMedium = T.headlineMedium.copy(fontFamily = Poppins), headlineSmall = T.headlineSmall.copy(fontFamily = Poppins),
    titleLarge = T.titleLarge.copy(fontFamily = Poppins), titleMedium = T.titleMedium.copy(fontFamily = Poppins),
    titleSmall = T.titleSmall.copy(fontFamily = Poppins), bodyLarge = T.bodyLarge.copy(fontFamily = Poppins),
    bodyMedium = T.bodyMedium.copy(fontFamily = Poppins), bodySmall = T.bodySmall.copy(fontFamily = Poppins),
    labelLarge = T.labelLarge.copy(fontFamily = Poppins), labelMedium = T.labelMedium.copy(fontFamily = Poppins),
    labelSmall = T.labelSmall.copy(fontFamily = Poppins))

class MainActivity : ComponentActivity() {
    private var controller by mutableStateOf<MediaController?>(null)

    override fun onNewIntent(intent: android.content.Intent) { super.onNewIntent(intent); handleSignIn(intent) }

    private fun handleSignIn(intent: android.content.Intent?) {
        val u = intent?.data ?: return
        if (u.scheme != "com.ranjithkb.radio" || u.host != "auth") return
        val q = android.net.Uri.parse("x://x?" + (u.encodedFragment ?: ""))
        val id = q.getQueryParameter("id_token") ?: ""; val at = q.getQueryParameter("access_token") ?: ""
        if (id.isEmpty() && at.isEmpty()) { android.widget.Toast.makeText(this, "Sign-in cancelled", android.widget.Toast.LENGTH_SHORT).show(); return }
        Session.busy = true
        lifecycleScope.launch {
            try {
                Account.finishSignIn(this@MainActivity, id, at)
                Account.sync(this@MainActivity, Favs(this@MainActivity))
                Session.name = Account.name(this@MainActivity); Session.favsVersion++
                android.widget.Toast.makeText(this@MainActivity, "Signed in — favourites saved to your account", android.widget.Toast.LENGTH_LONG).show()
            } catch (e: Exception) {
                android.widget.Toast.makeText(this@MainActivity, "Couldn't sign in — please try again", android.widget.Toast.LENGTH_LONG).show()
            } finally { Session.busy = false }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        Session.name = Account.name(this)
        handleSignIn(intent)
        setContent {
            MaterialTheme(typography = PoppinsType, colorScheme = lightColorScheme(primary = Accent, onPrimary = Color.White, background = Paper,
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
    val scope = rememberCoroutineScope()
    fun refreshFavs() {
        favList = favs.all()
        if (Account.signedIn(ctx)) scope.launch { try { Account.saveFavs(ctx, favList.map { it.key }) } catch (e: Exception) { } }
    }
    LaunchedEffect(Session.favsVersion) { favList = favs.all() }
    LaunchedEffect(Unit) { if (Account.signedIn(ctx)) try { Account.sync(ctx, favs); favList = favs.all() } catch (e: Exception) { } }
    var update by remember { mutableStateOf<Update?>(null) }
    LaunchedEffect(Unit) { update = checkUpdate(ctx) }
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

    fun go(t: Int) { tab = t; prefs.edit().putInt("tab", t).apply() }
    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Column(Modifier.padding(start = 20.dp, top = 14.dp, bottom = 10.dp, end = 20.dp)) {
            Text("Radio Velvet", fontSize = 26.sp, fontWeight = FontWeight.SemiBold, color = Velvet, letterSpacing = 0.2.sp)
            Text("Elegant sounds, always free", fontSize = 13.sp, fontStyle = FontStyle.Italic, color = Accent, letterSpacing = 0.6.sp)
        }
        update?.let { u ->
            Row(Modifier.fillMaxWidth().background(AccentSoft).padding(16.dp, 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Radio Velvet ${u.version} is out", Modifier.weight(1f), fontWeight = FontWeight.SemiBold)
                TextButton({ go(2) }) { Text("What's new") }
                UpdateButton(u, "Update")
            }
        }
        Box(Modifier.weight(1f)) {
            if (tab == 2) InfoTab(cols.size, update, onSignIn = { openUrl(ctx, Account.SIGN_IN_URL) },
                onSignOut = { Account.signOut(ctx); Session.name = null })
            else if (tab == 0) {
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
                Column {
                    if (Session.name == null) Row(Modifier.fillMaxWidth().background(AccentSoft).padding(16.dp, 10.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Text(if (Session.busy) "Signing in…" else "Sign in to keep your favourites on every device and on ranjithkb.com.",
                            Modifier.weight(1f), fontSize = 14.sp)
                        if (!Session.busy) Button({ openUrl(ctx, Account.SIGN_IN_URL) }, Modifier.heightIn(min = 48.dp)) { Text("Sign in") }
                    }
                    FavsTab(favList, now, langOf = ::langOf, onPlay = { s -> play(favList, s) },
                        onChanged = { refreshFavs() }, favs = favs)
                }
            }
        }
        if (now.id != null) MiniPlayer(now, c) { full = true }
        NavigationBar(containerColor = Paper2) {
            NavigationBarItem(tab == 0, { go(0) }, { Icon(Icons.Filled.Radio, null) }, label = { Text("Stations") })
            NavigationBarItem(tab == 1, { go(1) }, { Icon(Icons.Filled.Favorite, null) }, label = { Text("Favourites (${favList.size})") })
            NavigationBarItem(tab == 2, { go(2) }, { Icon(Icons.Filled.Info, null) }, label = { Text("Info") })
        }
    }
    if (pickLang) LanguageDialog(cols, colId, { colId = it; go(0); pickLang = false }) { pickLang = false }
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
    // while editing, the list is reordered here and saved when a drag ends
    var order by remember(list, edit) { mutableStateOf(list) }
    val listState = rememberLazyListState()
    val reorder = rememberReorderableLazyListState(listState) { from, to ->
        order = order.toMutableList().apply { add(to.index, removeAt(from.index)) }
    }
    fun commit() { favs.replaceAll(order); onChanged() }
    Column {
        Row(Modifier.fillMaxWidth().padding(16.dp, 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(if (list.isEmpty()) "No favourites yet. Tap ♡ on any station, in any language."
                 else if (edit) "Drag ≡ to move a station" else "${list.size} favourites", Modifier.weight(1f), color = InkSoft)
            if (list.isNotEmpty()) {
                if (edit) Button({ edit = false }, Modifier.heightIn(min = 48.dp)) { Text("Done") }
                else OutlinedButton({ edit = true }, Modifier.heightIn(min = 48.dp)) { Text("Reorder / remove") }
            }
        }
        undo?.let { (s, at) ->
            Row(Modifier.fillMaxWidth().background(AccentSoft).padding(16.dp, 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Removed ${s.name}", Modifier.weight(1f))
                TextButton({ favs.insert(s, at); undo = null; onChanged() }) { Text("Undo") }
            }
        }
        LazyColumn(state = listState) {
            if (!edit) itemsIndexed(list, key = { _, s -> s.key }) { i, s ->
                StationRow(s, langOf(s), true, "st|${s.key}" == now.id, now.playing,
                    onPlay = { onPlay(s) }, onFav = { undo = s to i; favs.remove(s.key); onChanged() })
                HorizontalDivider(color = Paper2)
            } else itemsIndexed(order, key = { _, s -> s.key }) { i, s ->
                ReorderableItem(reorder, key = s.key) { dragging ->
                    Surface(color = if (dragging) AccentSoft else Paper, shadowElevation = if (dragging) 8.dp else 0.dp) {
                        Row(Modifier.fillMaxWidth().heightIn(min = 64.dp).padding(start = 4.dp, end = 4.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.DragHandle, "Drag to move ${s.name}", tint = Accent,
                                modifier = Modifier.draggableHandle(onDragStopped = { commit() }).size(56.dp).padding(14.dp))
                            Text("${i + 1}", color = Accent, fontWeight = FontWeight.SemiBold, modifier = Modifier.width(30.dp))
                            Column(Modifier.weight(1f)) {
                                Text(s.name, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(langOf(s), fontSize = 13.sp, color = InkSoft)
                            }
                            IconButton({ order = listOf(s) + order.filter { it.key != s.key }; commit() }, enabled = i > 0,
                                modifier = Modifier.size(48.dp)) { Icon(Icons.Filled.VerticalAlignTop, "Move ${s.name} to the top") }
                            IconButton({ order = order.filter { it.key != s.key } + s; commit() }, enabled = i < order.size - 1,
                                modifier = Modifier.size(48.dp)) { Icon(Icons.Filled.VerticalAlignBottom, "Move ${s.name} to the bottom") }
                            IconButton({ undo = s to i; favs.remove(s.key); onChanged() }, Modifier.size(48.dp)) {
                                Icon(Icons.Filled.Close, "Remove ${s.name}", tint = Color(0xFF9B2C2C)) }
                        }
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
    Row(Modifier.fillMaxWidth().background(Velvet).clickable(onClick = open)
        .padding(12.dp, 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Art(now, 48)
        val station = now.md.station?.toString() ?: ""
        val song = now.md.title?.toString() ?: ""
        val hasSong = song.isNotBlank() && song != station
        val artist = (now.md.artist?.toString() ?: "").split(" · ").filter { it != station }.joinToString(" · ")
        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
            if (hasSong) Text(station, color = Gold, fontSize = 11.sp, fontWeight = FontWeight.Medium, letterSpacing = 0.5.sp,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(if (hasSong) song else station.ifBlank { song }, color = Color.White, fontWeight = FontWeight.SemiBold,
                maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(now.error ?: if (now.buffering) "Connecting…" else if (hasSong) artist else now.md.artist?.toString() ?: "",
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
    val ctx = LocalContext.current
    var sleepAt by remember { mutableLongStateOf(0L) }
    var left by remember { mutableStateOf("") }
    LaunchedEffect(sleepAt) {
        while (sleepAt > 0) {
            val ms = sleepAt - System.currentTimeMillis()
            if (ms <= 0) { c?.pause(); sleepAt = 0; left = ""; break }
            left = "Stops in ${ms / 60000 + 1} min"; delay(15000)
        }
    }
    val station = now.md.station?.toString() ?: ""
    val song = now.md.title?.toString() ?: ""
    Dialog(close, DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Surface(Modifier.fillMaxSize(), color = Velvet) {
            BoxWithConstraints(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
                val art = minOf(maxWidth.value * 0.72f, maxHeight.value * 0.38f, 320f).toInt()
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 24.dp, vertical = 12.dp),
                    horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.fillMaxWidth()) {
                        IconButton(close, Modifier.align(Alignment.CenterStart)) { Icon(Icons.Filled.KeyboardArrowDown, "Close", tint = Color.White) }
                        Text(station, color = Color(0xFFBDBDBD), modifier = Modifier.align(Alignment.Center))
                    }
                    Spacer(Modifier.height(20.dp))
                    Art(now, art)
                    Spacer(Modifier.height(22.dp))
                    Text(song, color = Color.White, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, maxLines = 2,
                        overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center)
                    val hasSong = song.isNotBlank() && song != station
                    Text(now.error ?: if (now.buffering) "Connecting…"
                        else if (hasSong) (now.md.artist?.toString() ?: "").split(" · ").filter { it != station }.joinToString(" · ")
                        else now.md.artist?.toString() ?: "",
                        color = Color(0xFFBDBDBD), fontSize = 15.sp, maxLines = 2, textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 4.dp))
                    if (hasSong) Text("on $station", color = Gold, fontSize = 14.sp, fontWeight = FontWeight.Medium,
                        textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp))
                    Spacer(Modifier.height(22.dp))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(24.dp)) {
                        IconButton({ c?.seekToPreviousMediaItem() }, Modifier.size(64.dp)) {
                            Icon(Icons.Filled.SkipPrevious, "Previous station", Modifier.size(40.dp), tint = Color.White) }
                        FilledIconButton({ c?.let { if (it.isPlaying) it.pause() else { it.prepare(); it.play() } } }, Modifier.size(80.dp),
                            shape = CircleShape, colors = IconButtonDefaults.filledIconButtonColors(containerColor = Paper, contentColor = Ink)) {
                            Icon(if (now.playing) Icons.Filled.Pause else Icons.Filled.PlayArrow, if (now.playing) "Pause" else "Play", Modifier.size(42.dp))
                        }
                        IconButton({ c?.seekToNextMediaItem() }, Modifier.size(64.dp)) {
                            Icon(Icons.Filled.SkipNext, "Next station", Modifier.size(40.dp), tint = Color.White) }
                    }
                    Spacer(Modifier.height(18.dp))
                    if (song.isNotBlank() && song != station) {
                        OutlinedButton({ scope.launch {
                            val artist = (now.md.artist?.toString() ?: "").split(" · ").filter { it != station }.joinToString(" · ")
                            shareSongCard(ctx, song, artist, station, now.md.artworkUri?.toString()) } },
                            Modifier.heightIn(min = 48.dp), border = BorderStroke(1.dp, Gold)) {
                            Icon(Icons.Filled.Share, null, tint = Gold); Spacer(Modifier.width(8.dp)); Text("Share song card", color = Color.White)
                        }
                        Spacer(Modifier.height(18.dp))
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Filled.Bedtime, null, tint = Gold, modifier = Modifier.size(18.dp))
                        Text(left.ifEmpty { "Sleep timer" }, color = Color.White, fontSize = 14.sp, modifier = Modifier.padding(start = 6.dp))
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp, bottom = 12.dp)) {
                        listOf(15, 30, 60).forEach { m ->
                            OutlinedButton({ sleepAt = System.currentTimeMillis() + m * 60_000L }, Modifier.heightIn(min = 48.dp),
                                border = BorderStroke(1.dp, Color(0x66FFFFFF)), contentPadding = PaddingValues(horizontal = 14.dp)) {
                                Text("$m min", color = Color.White) }
                        }
                        if (sleepAt > 0) OutlinedButton({ sleepAt = 0; left = "" }, Modifier.heightIn(min = 48.dp),
                            border = BorderStroke(1.dp, Gold)) { Text("Off", color = Gold) }
                    }
                }
            }
        }
    }
}

@Composable
fun InfoTab(languages: Int, update: Update?, onSignIn: () -> Unit, onSignOut: () -> Unit) {
    val ctx = LocalContext.current
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(androidx.compose.ui.res.painterResource(R.drawable.velvet_logo), null, Modifier.size(64.dp))
                Column(Modifier.padding(start = 14.dp)) {
                    Text("Radio Velvet", fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = Velvet)
                    Text("Elegant sounds, always free", color = InkSoft)
                    Text("Version ${appVersion(ctx)}", fontSize = 13.sp, color = InkSoft)
                }
            }
        }
        update?.let { u -> item {
            Column(Modifier.fillMaxWidth().background(AccentSoft).padding(16.dp)) {
                Text("New version ${u.version}", fontWeight = FontWeight.SemiBold)
                u.notes.forEach { Text("• $it", fontSize = 14.sp, modifier = Modifier.padding(top = 4.dp)) }
                Box(Modifier.padding(top = 10.dp)) { UpdateButton(u, "Download and install") }
                Text("Open the downloaded file and allow the install. Your favourites stay.", fontSize = 12.sp, color = InkSoft)
            }
        } }
        item {
            Section("Your account") {
                if (Session.name != null) {
                    Text("Signed in as ${Session.name}. Favourites are saved to your account and match ranjithkb.com.")
                    var ask by remember { mutableStateOf(false) }
                    var msg by remember { mutableStateOf<String?>(null) }
                    val scope = rememberCoroutineScope()
                    Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        OutlinedButton(onSignOut, Modifier.heightIn(min = 48.dp)) { Text("Sign out") }
                        TextButton({ ask = true }, Modifier.padding(start = 8.dp).heightIn(min = 48.dp)) { Text("Delete account", color = InkSoft) }
                    }
                    if (ask) AlertDialog(onDismissRequest = { ask = false },
                        title = { Text("Delete your account?") },
                        text = { Text("This removes your saved favourites and your sign-in from Radio Velvet and ranjithkb.com. Favourites on this phone stay until you remove them.") },
                        confirmButton = { TextButton({ ask = false; scope.launch {
                            msg = Account.deleteAccount(ctx) ?: "Your account is deleted."; Session.name = null } }) { Text("Delete") } },
                        dismissButton = { TextButton({ ask = false }) { Text("Cancel") } })
                } else {
                    Text("Sign in with Google to keep favourites on every device and on the website.")
                    Button(onSignIn, Modifier.padding(top = 8.dp).heightIn(min = 48.dp)) { Text("Sign in") }
                }
            }
        }
        item {
            Section("Which stations play") {
                Text("${if (languages > 0) "$languages lists" else "70+ languages"} and about 2,200 live stations, each tested twice a day. " +
                    "Stations marked \"Not working today\" failed the last test. A few broadcasters only stream to listeners in their own " +
                    "country, so a station can be silent where you are even when it's working.")
                Text("If a station doesn't start, Radio Velvet tries its other sources, then you can skip to the next one.",
                    Modifier.padding(top = 6.dp), color = InkSoft, fontSize = 14.sp)
            }
        }
        item {
            Section("Good to know") {
                Text("• Plays with the screen off; controls on the lock screen, headphones and Bluetooth.")
                Text("• Pauses for calls and comes back on afterwards.")
                Text("• Song name and cover appear when the station sends them. Share them as a song card from the player.")
                Text("• Works in Android Auto: Favourites and every language list.")
            }
        }
        item {
            Section("On the web") {
                TextButton({ openUrl(ctx, "https://ranjithkb.com/radio.html") }) { Text("Radio on ranjithkb.com") }
                TextButton({ openUrl(ctx, "https://ranjithkb.com/") }) { Text("ranjithkb.com") }
                TextButton({ openUrl(ctx, "https://ranjithkb.com/privacy.html#radio-velvet") }) { Text("Privacy policy") }
                TextButton({ ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_SENDTO,
                    android.net.Uri.parse("mailto:hello@ranjithkb.com?subject=Radio%20Velvet"))) }) { Text("Suggest a station: hello@ranjithkb.com") }
            }
        }
    }
}

@Composable
fun Section(title: String, body: @Composable ColumnScope.() -> Unit) {
    Column {
        Text(title.uppercase(), fontSize = 12.sp, letterSpacing = 1.sp, color = Accent, fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 6.dp))
        body()
    }
}


@Composable
fun UpdateButton(u: Update, label: String) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val p = Updater.progress
    when {
        p != null && p >= 0 -> Column(Modifier.width(150.dp)) {
            Text("Downloading $p%", fontSize = 13.sp)
            LinearProgressIndicator(progress = { p / 100f }, Modifier.fillMaxWidth(), color = Accent)
        }
        else -> Button({ scope.launch { Updater.install(ctx, u.url) } }, Modifier.heightIn(min = 48.dp)) {
            Text(if (p == -1) "Try again" else label)
        }
    }
}
