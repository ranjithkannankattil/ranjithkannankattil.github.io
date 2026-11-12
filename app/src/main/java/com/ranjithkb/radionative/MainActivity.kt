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
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.painterResource
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

/** Follows the phone's dark mode: light paper by day, dark velvet (plum, black, gold) at night. */
object Theme { var dark by mutableStateOf(false) }
internal val Paper get() = if (Theme.dark) Color(0xFF140D12) else Color(0xFFF0EDE6)
internal val Paper2 get() = if (Theme.dark) Color(0xFF241520) else Color(0xFFE7E2D6)
internal val Ink get() = if (Theme.dark) Color(0xFFF1E9EE) else Color(0xFF2A1424)
internal val InkSoft get() = if (Theme.dark) Color(0xFFC9BBC5) else Color(0xFF4A4A4C)
internal val Accent get() = if (Theme.dark) Color(0xFFB0609C) else Color(0xFF6B2D5C)      // velvet plum
internal val AccentSoft get() = if (Theme.dark) Color(0xFF35202F) else Color(0xFFEEDFE8)
internal val Velvet get() = if (Theme.dark) Color(0xFF0D070B) else Color(0xFF2A1424)
private val Gold = Color(0xFFC9A86A)

/** Signed-in name (null = signed out) and a counter that bumps when favourites change from the account. */
object Session { var name by mutableStateOf<String?>(null); var favsVersion by mutableIntStateOf(0); var busy by mutableStateOf(false); var noteShown = false }

/** Jost (Futura style): the app's one typeface, light to semibold. */
val Poppins = FontFamily(
    Font(R.font.jost_light, FontWeight.Light),
    Font(R.font.jost_regular, FontWeight.Normal),
    Font(R.font.jost_medium, FontWeight.Medium),
    Font(R.font.jost_semibold, FontWeight.SemiBold),
    Font(R.font.jost_semibold, FontWeight.Bold))
private val T = Typography()
val PoppinsType = Typography(
    displayLarge = T.displayLarge.copy(fontFamily = Poppins), displayMedium = T.displayMedium.copy(fontFamily = Poppins),
    displaySmall = T.displaySmall.copy(fontFamily = Poppins), headlineLarge = T.headlineLarge.copy(fontFamily = Poppins),
    headlineMedium = T.headlineMedium.copy(fontFamily = Poppins), headlineSmall = T.headlineSmall.copy(fontFamily = Poppins),
    titleLarge = T.titleLarge.copy(fontFamily = Poppins), titleMedium = T.titleMedium.copy(fontFamily = Poppins),
    titleSmall = T.titleSmall.copy(fontFamily = Poppins), bodyLarge = T.bodyLarge.copy(fontFamily = Poppins, fontSize = 15.sp, lineHeight = 22.sp),
    bodyMedium = T.bodyMedium.copy(fontFamily = Poppins, fontSize = 14.sp), bodySmall = T.bodySmall.copy(fontFamily = Poppins),
    labelLarge = T.labelLarge.copy(fontFamily = Poppins), labelMedium = T.labelMedium.copy(fontFamily = Poppins),
    labelSmall = T.labelSmall.copy(fontFamily = Poppins))

class MainActivity : ComponentActivity() {
    private var controller by mutableStateOf<MediaController?>(null)

    override fun onNewIntent(intent: android.content.Intent) { super.onNewIntent(intent); handleSignIn(intent) }

    private fun handleSignIn(intent: android.content.Intent?) {
        val u = intent?.data ?: return
        if (u.scheme?.startsWith("com.ranjithkb.radio") != true || u.host != "auth") return
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
            Theme.dark = androidx.compose.foundation.isSystemInDarkTheme()
            val scheme = if (Theme.dark) darkColorScheme(primary = Accent, onPrimary = Color.White, background = Paper,
                surface = Paper, onSurface = Ink, onBackground = Ink, secondaryContainer = AccentSoft, onSecondaryContainer = Ink,
                surfaceVariant = Paper2, onSurfaceVariant = InkSoft, outline = InkSoft, surfaceContainer = Paper2,
                surfaceContainerHigh = Paper2, surfaceContainerHighest = AccentSoft)
                else lightColorScheme(primary = Accent, onPrimary = Color.White, background = Paper,
                surface = Paper, onSurface = Ink, onBackground = Ink, secondaryContainer = AccentSoft,
                surfaceVariant = Paper2, outline = InkSoft)
            MaterialTheme(typography = PoppinsType, colorScheme = scheme) {
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
    AppNote()
    val scope = rememberCoroutineScope()
    fun refreshFavs() {
        favList = favs.all()
        if (Account.signedIn(ctx)) scope.launch { try { Account.saveFavs(ctx, favList.map { it.key }) } catch (e: Exception) { } }
    }
    LaunchedEffect(Session.favsVersion) { favList = favs.all() }
    LaunchedEffect(Unit) {
        if (Account.signedIn(ctx)) try { Account.sync(ctx, favs); favList = favs.all() } catch (e: Exception) { }
        // favourites whose station has been taken off the lists (e.g. it played the wrong language) are removed
        val gone = ArrayList<Station>()
        favs.all().groupBy { it.col }.forEach { (c, l) ->
            val fresh = Repo.stations(ctx, c, fresh = true)
            if (fresh.isNotEmpty()) gone += l.filter { s -> fresh.none { it.id == s.id } }
        }
        if (gone.isNotEmpty()) {
            gone.forEach { favs.remove(it.key) }; refreshFavs()
            android.widget.Toast.makeText(ctx, "Removed from favourites (no longer listed): " + gone.joinToString(", ") { it.name },
                android.widget.Toast.LENGTH_LONG).show()
        }
    }
    var update by remember { mutableStateOf<Update?>(null) }
    LaunchedEffect(Unit) { update = checkUpdate(ctx) }
    var cols by remember { mutableStateOf<List<Collection>>(emptyList()) }
    var colId by remember { mutableStateOf(prefs.getString("col", "malayalam")!!) }
    var lastCol by remember { mutableStateOf(prefs.getString("lastCol", "malayalam")!!) }
    LaunchedEffect(lastCol) { prefs.edit().putString("lastCol", lastCol).apply() }
    // languages you've listened to, most recent first (shown as quick buttons on Stations)
    var recent by remember { mutableStateOf(prefs.getString("recent", "")!!.split(',').filter { it.isNotBlank() }) }
    // languages pinned to the row, in the listener's own order (always shown)
    var pinned by remember { mutableStateOf(prefs.getString("pinned", "")!!.split(',').filter { it.isNotBlank() }) }
    fun savePins(l: List<String>) { pinned = l; prefs.edit().putString("pinned", l.joinToString(",")).apply() }
    fun saveRecent(l: List<String>) { recent = l; prefs.edit().putString("recent", l.joinToString(",")).apply() }
    LaunchedEffect(colId) {
        if (colId != PICKS && colId != ALL) saveRecent((listOf(colId) + recent.filter { it != colId }).take(5))
    }
    var pillMenu by remember { mutableStateOf<Collection?>(null) }
    var arrangePins by remember { mutableStateOf(false) }
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
        stations = when (colId) { PICKS -> Repo.picks(ctx); ALL -> Repo.allStations(ctx, cols.ifEmpty { Repo.collections(ctx) }); else -> Repo.stations(ctx, colId) }; loading = false
        // show the saved copy at once, then fetch today's list (stations are added, fixed and removed every day)
        if (colId != PICKS && colId != ALL) { val id = colId; val fresh = Repo.stations(ctx, id, fresh = true)
            if (id == colId && fresh.isNotEmpty() && fresh != stations) stations = fresh }
        else if (colId == PICKS) { val fresh = Repo.picks(ctx, fresh = true); if (colId == PICKS && fresh.isNotEmpty()) stations = fresh }
    }
    val col = when (colId) { PICKS -> PICKS_COL; ALL -> ALL_COL; else -> cols.find { it.id == colId } }
    fun langOf(s: Station) = cols.find { it.id == s.col }?.name ?: ""
    fun play(list: List<Station>, s: Station) {
        val ctl = c ?: return
        val live = list.filter { !it.offline || it.key == s.key }
        ctl.setMediaItems(live.map { it.toItem(langOf(it)) }, live.indexOfFirst { it.key == s.key }.coerceAtLeast(0), 0)
        ctl.prepare(); ctl.play()
    }

    fun go(t: Int) { tab = t; prefs.edit().putInt("tab", t).apply() }
    var az by remember { mutableStateOf(prefs.getBoolean("az", true)) }
    var search by remember { mutableStateOf(false) }
    var barSleep by remember { mutableStateOf(false) }
    if (barSleep) SleepDialog { barSleep = false }
    val cast = rememberCast()
    val favKeys = favList.map { it.key }.toSet()
    // ✕ (shown only while paused): stop, clear and remove the notification
    fun closeAll() {
        full = false
        val ctl = c ?: return
        try { ctl.sendCustomCommand(androidx.media3.session.SessionCommand(PlaybackService.CLOSE, Bundle.EMPTY), Bundle.EMPTY) }
        catch (e: Exception) { SleepTimer.off(); ctl.stop(); ctl.clearMediaItems() }
    }
    fun toggleFavKey(key: String?) {
        val st = favList.find { it.key == key } ?: stations.find { it.key == key }
        if (st != null) { favs.toggle(st); refreshFavs() }
        else if (key != null) scope.launch {
            Repo.stations(ctx, key.substringBefore(':')).find { it.key == key }?.let { favs.toggle(it); refreshFavs() } }
    }
    Column(Modifier.fillMaxSize().statusBarsPadding()) {
        Header(onSearch = { search = true })
        update?.let { u ->
            Row(Modifier.fillMaxWidth().padding(top = 10.dp).background(AccentSoft).padding(start = 24.dp, end = 12.dp, top = 6.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Text("Radio Velvet ${u.version} is out", Modifier.weight(1f), fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                TextButton({ go(2) }) { Text("What's new") }
                UpdateButton(u, "Update")
            }
        }
        Box(Modifier.weight(1f)) {
            if (tab == 2) InfoTab(cols.size, update, onSignIn = { openUrl(ctx, Account.SIGN_IN_URL) },
                onSignOut = { Account.signOut(ctx); Session.name = null })
            else if (tab == 0) {
                // A–Z in every list except the Velvet Selection (hand-picked order) and Favourites (your own order)
                val shown = stations.filter { cat == "all" || it.category == cat || (cat == "fav" && it.key in favKeys) }
                    .let { l -> if (az && colId != PICKS) l.sortedBy { it.name.trimStart('(', '"', '\'', ' ').lowercase() } else l }
                    .sortedBy { it.offline }
                Column {
                    val tabs = listOf(LangTab(PICKS, "Velvet Selection", star = true)) +
                        (pinned + recent.filter { it !in pinned }).mapNotNull { id -> cols.find { it.id == id } }.map { LangTab(it.id, it.name, it.id in pinned) } +
                        (if (colId == ALL) listOf(LangTab(ALL, "Every station")) else emptyList()) +
                        listOf(LangTab("_langs", "All languages", icon = true))
                    LangTabs(tabs, colId, onClick = { t -> if (t.id == "_langs") pickLang = true else colId = t.id },
                        onLong = { t -> cols.find { it.id == t.id }?.let { pillMenu = it } })
                    val favHere = stations.count { it.key in favKeys }
                    val cats = buildList {
                        add(Triple("all", "All", stations.size))
                        if (favHere > 0) add(Triple("fav", "Favourites", favHere))
                        col?.cats?.filter { (k, _) -> stations.any { it.category == k } }?.forEach { (k, label) -> add(Triple(k, label, -1)) }
                    }
                    if (colId != PICKS) CatRow(cats, cat, { cat = it }, az, { az = !az; prefs.edit().putBoolean("az", az).apply() })
                    else Text(if (!loading && stations.isEmpty()) "The Velvet Selection is coming soon." else
                        "Hand-picked by the developer, from every language.", Modifier.padding(24.dp, 12.dp, 24.dp, 4.dp), color = InkSoft, fontSize = 15.sp)
                    if (loading) LinearProgressIndicator(Modifier.fillMaxWidth().padding(top = 8.dp), color = Accent)
                    val stState = rememberLazyListState()
                    LaunchedEffect(colId, cat, az) { stState.scrollToItem(0) }
                    Box(Modifier.fillMaxSize()) {
                        LazyColumn(state = stState, contentPadding = PaddingValues(bottom = 16.dp)) {
                            items(shown, key = { it.key }) { s ->
                                StationRow(s, if (colId == PICKS || colId == ALL) langOf(s) else col?.cats?.find { it.first == s.category }?.second ?: "",
                                    s.key in favKeys, "st|${s.key}" == now.id, now.playing,
                                    onPlay = { play(shown, s) }, onFav = { favs.toggle(s); refreshFavs() })
                            }
                        }
                        ScrollButtons(stState, Modifier.align(Alignment.BottomEnd))
                    }
                }
            } else {
                Column {
                    if (Session.name == null) Row(Modifier.fillMaxWidth().padding(top = 10.dp).background(AccentSoft).padding(24.dp, 10.dp),
                        verticalAlignment = Alignment.CenterVertically) {
                        Text(if (Session.busy) "Signing in…" else "Sign in to keep your favourites on every device and on ranjithkb.com.",
                            Modifier.weight(1f), fontSize = 15.sp)
                        if (!Session.busy) Button({ openUrl(ctx, Account.SIGN_IN_URL) }, Modifier.heightIn(min = 48.dp)) { Text("Sign in") }
                    }
                    FavsTab(favList, now, langOf = ::langOf, onPlay = { s -> play(favList, s) },
                        onChanged = { refreshFavs() }, favs = favs, onPicks = { if (colId != PICKS) lastCol = colId; colId = PICKS; go(0) })
                }
            }
        }
        if (now.id != null) {
            val key = now.id?.removePrefix("st|")
            MiniPlayer(now, c, isFav = favList.any { it.key == key }, onFav = { toggleFavKey(key) }, onClose = { closeAll() },
                cast = cast, onCast = { Cast.open(ctx, Theme.dark) }, onSleep = { barSleep = true }) { full = true }
        }
        BottomNav(tab, favList.size, ::go)
    }
    pillMenu?.let { c ->
        val isPin = c.id in pinned; val i = pinned.indexOf(c.id)
        fun done() { pillMenu = null }
        AlertDialog(onDismissRequest = { done() }, title = { Text(c.name) },
            text = { Column {
                TextButton({ savePins(if (isPin) pinned - c.id else pinned + c.id); done() }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                    Icon(Icons.Filled.PushPin, null); Spacer(Modifier.width(10.dp))
                    Text(if (isPin) "Unpin" else "Pin, so it always stays in the row", Modifier.weight(1f)) }
                if (isPin && i > 0) TextButton({ savePins(pinned.toMutableList().apply { add(i - 1, removeAt(i)) }); done() },
                    Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                    Icon(Icons.Filled.ChevronLeft, null); Spacer(Modifier.width(10.dp)); Text("Move left", Modifier.weight(1f)) }
                if (isPin && i < pinned.size - 1) TextButton({ savePins(pinned.toMutableList().apply { add(i + 1, removeAt(i)) }); done() },
                    Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                    Icon(Icons.Filled.ChevronRight, null); Spacer(Modifier.width(10.dp)); Text("Move right", Modifier.weight(1f)) }
                if (pinned.size > 1) TextButton({ done(); arrangePins = true }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                    Icon(Icons.Filled.DragHandle, null); Spacer(Modifier.width(10.dp)); Text("Arrange pinned languages", Modifier.weight(1f)) }
                TextButton({ savePins(pinned - c.id); saveRecent(recent - c.id); done() }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                    Icon(Icons.Filled.Close, null); Spacer(Modifier.width(10.dp)); Text("Remove from the row", Modifier.weight(1f)) }
            } },
            confirmButton = { TextButton({ done() }) { Text("Cancel") } })
    }
    if (arrangePins) ArrangePins(pinned.mapNotNull { id -> cols.find { it.id == id } }, onSave = { savePins(it) }) { arrangePins = false }
    if (pickLang) LanguageDialog(cols, colId, { if (it == PICKS && colId != PICKS) lastCol = colId; colId = it; go(0); pickLang = false }) { pickLang = false }
    if (full) FullPlayer(now, c, cast, onCloseAll = { closeAll() }) { full = false }
    if (search) {
        var all by remember { mutableStateOf<List<Station>?>(null) }
        LaunchedEffect(Unit) { all = Repo.allStations(ctx, cols.ifEmpty { Repo.collections(ctx) }) }
        var voice by remember { mutableStateOf<String?>(null) }
        val voiceIntent = remember { android.content.Intent(android.speech.RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(android.speech.RecognizerIntent.EXTRA_LANGUAGE_MODEL, android.speech.RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(android.speech.RecognizerIntent.EXTRA_PROMPT, "Say a station name") }
        val canVoice = remember { voiceIntent.resolveActivity(ctx.packageManager) != null }
        val listen = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.StartActivityForResult()) { r ->
            voice = r.data?.getStringArrayListExtra(android.speech.RecognizerIntent.EXTRA_RESULTS)?.firstOrNull() }
        androidx.activity.compose.BackHandler { search = false }
        Box(Modifier.fillMaxSize()) {
            SearchContent(all, if (colId == PICKS || colId == ALL) "" else col?.name ?: "", ::langOf, favKeys, now.id, now.playing,
                onPlay = { _, s, _ -> play((all ?: emptyList()).filter { it.col == s.col }, s); search = false },
                onFav = { favs.toggle(it); refreshFavs() },
                onPicks = { if (colId != PICKS) lastCol = colId; colId = PICKS; go(0); search = false },
                onSurprise = { (all ?: emptyList()).filter { !it.offline }.randomOrNull()?.let { s ->
                    play((all ?: emptyList()).filter { it.col == s.col }, s); search = false } },
                onVoice = if (canVoice) ({ listen.launch(voiceIntent) }) else null, voiceText = voice, close = { search = false })
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
            onChanged: () -> Unit, favs: Favs, onPicks: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
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
        if (list.isEmpty()) OutlinedButton(onPicks, Modifier.padding(horizontal = 16.dp).heightIn(min = 48.dp)) {
            Icon(Icons.Filled.Star, null, tint = Accent); Spacer(Modifier.width(8.dp)); Text("Start with the Velvet Selection")
        }
        if (Account.isOwner(ctx) && list.isNotEmpty() && !edit) {
            var busy by remember { mutableStateOf(false) }
            TextButton({ if (!busy) scope.launch { busy = true
                val msg = try { Account.publishPicks(ctx, list.map { it.key }); "Shared: everyone now sees these ${list.size} stations as the Velvet Selection." }
                    catch (e: Exception) { "Couldn't share the picks. " + (if (e.message?.contains("403") == true) "The database rules need publishing first." else "Try again.") }
                busy = false; android.widget.Toast.makeText(ctx, msg, android.widget.Toast.LENGTH_LONG).show() } },
                Modifier.padding(horizontal = 8.dp).heightIn(min = 48.dp)) {
                Icon(Icons.Filled.Star, null, tint = Accent); Spacer(Modifier.width(6.dp))
                Text(if (busy) "Sharing…" else "Share this list as the Velvet Selection", color = Accent)
            }
        }
        undo?.let { (s, at) ->
            Row(Modifier.fillMaxWidth().background(AccentSoft).padding(16.dp, 4.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Removed ${s.name}", Modifier.weight(1f))
                TextButton({ favs.insert(s, at); undo = null; onChanged() }) { Text("Undo") }
            }
        }
        Box(Modifier.fillMaxSize()) {
LazyColumn(state = listState, contentPadding = PaddingValues(bottom = 72.dp)) {
            if (!edit) itemsIndexed(list, key = { _, s -> s.key }) { i, s ->
                StationRow(s, langOf(s), true, "st|${s.key}" == now.id, now.playing,
                    onPlay = { onPlay(s) }, onFav = { undo = s to i; favs.remove(s.key); onChanged() })
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
ScrollButtons(listState, Modifier.align(Alignment.BottomEnd))
}
    }
}

@Composable
fun LanguageDialog(cols: List<Collection>, current: String, onPick: (String) -> Unit, onClose: () -> Unit) {
    var q by remember { mutableStateOf("") }
    val ctx = LocalContext.current
    // number of stations in each language (loaded in the background; cached for a few hours)
    var counts by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
    LaunchedEffect(cols) { if (cols.isNotEmpty()) counts = Repo.counts(ctx, cols) }
    Dialog(onClose, DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.fillMaxSize(), color = Paper) {
            Column(Modifier.statusBarsPadding()) {
                Row(Modifier.padding(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClose) { Icon(Icons.Filled.Close, "Close") }
                    OutlinedTextField(q, { q = it }, Modifier.weight(1f), placeholder = { Text("Find a language") }, singleLine = true)
                }
                LazyColumn {
                    if (q.isBlank()) item {
                        Row(Modifier.fillMaxWidth().clickable { onPick(PICKS) }.heightIn(min = 60.dp)
                            .background(if (current == PICKS) AccentSoft else Color.Transparent).padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.Star, null, tint = Accent); Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text("Velvet Selection", fontWeight = FontWeight.SemiBold)
                                Text("Hand-picked stations from every language", fontSize = 13.sp, color = InkSoft)
                            }
                        }
                    }
                    val shown = cols.filter { q.isBlank() || it.name.contains(q, true) || it.native.contains(q, true) }
                    val first = shown.filter { it.id == "malayalam" } + shown.filter { it.group.equals("English", true) }
                    val rest = shown.filter { it !in first }
                    @Composable fun LangRow(c: Collection) {
                        Row(Modifier.fillMaxWidth().clickable { onPick(c.id) }.heightIn(min = 52.dp)
                            .background(if (c.id == current) AccentSoft else Color.Transparent).padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(c.name, fontWeight = FontWeight.SemiBold)
                                if (c.native.isNotBlank()) Text(c.native, color = InkSoft, fontSize = 13.sp)
                            }
                            counts[c.id]?.let { Text("$it", color = Accent, fontWeight = FontWeight.SemiBold, fontSize = 14.sp) }
                        }
                    }
                    items(first, key = { it.id }) { LangRow(it) }
                    if (q.isBlank()) item {
                        Row(Modifier.fillMaxWidth().clickable { onPick(ALL) }.heightIn(min = 60.dp)
                            .background(if (current == ALL) AccentSoft else Color.Transparent).padding(horizontal = 16.dp),
                            verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Filled.Language, null, tint = Accent); Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text("Every station", fontWeight = FontWeight.SemiBold)
                                Text("All languages in one list", fontSize = 13.sp, color = InkSoft)
                            }
                            if (counts.isNotEmpty()) Text("${counts.values.sum()}", color = Accent, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        }
                    }
                    rest.groupBy { it.group.ifBlank { "Languages" } }.forEach { (g, cs) ->
                        item { Text(g.uppercase(), Modifier.padding(16.dp, 14.dp, 16.dp, 4.dp), fontSize = 12.sp, color = InkSoft, letterSpacing = 1.sp) }
                        items(cs, key = { it.id }) { LangRow(it) }
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

/** The big player as a full screen, with the share and sleep menus on top of it. */
@Composable
fun FullPlayer(now: NowState, c: MediaController?, cast: CastUi, onCloseAll: () -> Unit, close: () -> Unit) {
    val scope = rememberCoroutineScope()
    val ctx = LocalContext.current
    var share by remember { mutableStateOf(false) }
    var sleep by remember { mutableStateOf(false) }
    val station = now.md.station?.toString() ?: ""
    val song = now.md.title?.toString() ?: ""
    val hasSong = song.isNotBlank() && song != station
    val artist = (now.md.artist?.toString() ?: "").split(" · ").filter { it != station }.joinToString(" · ")
    // drawn over the main screen (not a separate window) so it fits between the phone's status bar and navigation bar
    androidx.activity.compose.BackHandler(onBack = close)
    Box(Modifier.fillMaxSize()) {
        PlayerContent(now, c, now.md.extras?.getString("lang") ?: "", cast, onCast = { Cast.open(ctx, Theme.dark) },
            onShare = { share = true }, onSpotify = if (hasSong) ({ scope.launch { openInSpotify(ctx, song, artist) } }) else null,
            onSleep = { sleep = true }, onCloseAll = onCloseAll, collapse = close) {
            now.id?.removePrefix("st|")?.let { RatingRow(it) }
        }
        if (share) ShareMenu(now) { share = false }
        if (sleep) SleepDialog { sleep = false }
    }
}

@Composable
fun InfoTab(languages: Int, update: Update?, onSignIn: () -> Unit, onSignOut: () -> Unit) {
    val ctx = LocalContext.current
    LazyColumn(contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(18.dp)) {
        item {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.size(64.dp).clip(RoundedCornerShape(14.dp)).background(Color(0xFF2A1424)), contentAlignment = Alignment.Center) {
                    Icon(painterResource(R.drawable.ic_logo_mark), null, Modifier.size(46.dp), tint = Gold) }
                Column(Modifier.padding(start = 14.dp)) {
                    Text("RADIO VELVET", fontSize = 16.sp, letterSpacing = 5.sp, fontWeight = FontWeight.Medium, color = Title)
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
            Section("Your listening") { ListeningSection() }
        }
        item {
            Section("Which stations play") {
                Text("${if (languages > 0) "$languages lists" else "70+ languages"} and over 5,000 live stations, each tested twice a day. " +
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
            Section("Credits") {
                TextButton({ openUrl(ctx, "https://www.facebook.com/share/1CFLUukqxQ/") }, contentPadding = PaddingValues(0.dp)) {
                    Text("Logo by Jai Sachith Chittilapilly", color = Accent) }
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
        Label(title, AccentText, 10, Modifier.padding(bottom = 8.dp))
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

const val PICKS = "picks"
val PICKS_COL = Collection(PICKS, "Velvet Selection", "", "", emptyList())

/** Station rating in the player: the average (shared with ranjithkb.com) and five stars to give your own. */
@Composable
fun RatingRow(stKey: String) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var sum by remember(stKey) { mutableStateOf<Ratings.Summary?>(null) }
    var mine by remember(stKey) { mutableStateOf<Int?>(null) }
    var note by remember(stKey) { mutableStateOf<String?>(null) }
    LaunchedEffect(stKey) { sum = Ratings.summary(stKey); mine = Ratings.mine(ctx, stKey) }
    Column(Modifier.padding(top = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(when {
            sum?.avg != null -> "★ " + String.format(java.util.Locale.UK, "%.1f", sum!!.avg) + " · ${sum!!.count} ratings"
            (sum?.count ?: 0) > 0 -> "${sum!!.count} rating${if (sum!!.count == 1) "" else "s"} so far"
            else -> "Be the first to rate this station"
        }, color = InkSoft, fontSize = 14.sp)
        Row {
            (1..5).forEach { n ->
                IconButton({ scope.launch {
                    val old = mine; mine = n
                    note = Ratings.rate(ctx, stKey, n)
                    if (note != null) mine = old else { note = "Thanks for rating"; sum = Ratings.summary(stKey) }
                } }, Modifier.size(44.dp)) {
                    Icon(painterResource(if ((mine ?: 0) >= n) R.drawable.ln_star_fill else R.drawable.ln_star),
                        "Rate $n out of 5", tint = Gold, modifier = Modifier.size(19.dp))
                }
            }
        }
        note?.let { Text(it, color = InkSoft, fontSize = 13.sp) }
    }
}

/** Floating jump buttons for long lists: ↑ to the top, ↓ to the bottom (like the website's scroll arrows). */
@Composable
fun ScrollButtons(state: androidx.compose.foundation.lazy.LazyListState, modifier: Modifier = Modifier) {
    val scope = rememberCoroutineScope()
    val total = state.layoutInfo.totalItemsCount
    if (total < 15) return
    val atTop = state.firstVisibleItemIndex == 0 && state.firstVisibleItemScrollOffset == 0
    val atEnd = !state.canScrollForward
    Column(modifier.padding(end = 60.dp, bottom = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {   // clear of the ♡ buttons
        if (!atTop) SmallFloatingActionButton({ scope.launch { state.animateScrollToItem(0) } },
            containerColor = Paper, contentColor = Accent, modifier = Modifier.size(48.dp)) {
            Icon(Icons.Filled.KeyboardArrowUp, "Back to the top") }
        if (!atEnd) SmallFloatingActionButton({ scope.launch { state.scrollToItem((total - 1).coerceAtLeast(0)) } },
            containerColor = Paper, contentColor = Accent, modifier = Modifier.size(48.dp)) {
            Icon(Icons.Filled.KeyboardArrowDown, "Jump to the bottom") }
    }
}

/** A language button: tap to open, press and hold to pin, move or remove it. */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun LangPill(label: String, selected: Boolean, pinned: Boolean, onClick: () -> Unit, onLongClick: () -> Unit) {
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    Surface(shape = RoundedCornerShape(8.dp), color = if (selected) Accent else Color.Transparent,
        border = if (selected) null else BorderStroke(1.dp, Color(0x33000000)),
        modifier = Modifier.heightIn(min = 44.dp).padding(vertical = 4.dp).clip(RoundedCornerShape(8.dp))
            .combinedClickable(onClick = onClick, onLongClickLabel = "Pin, move or remove", onLongClick = {
                haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress); onLongClick() })) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            if (pinned) { Icon(Icons.Filled.PushPin, "Pinned", Modifier.size(14.dp), tint = if (selected) Gold else Accent); Spacer(Modifier.width(5.dp)) }
            Text(label, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = if (selected) Color.White else Ink)
        }
    }
}

const val ALL = "all"
val ALL_COL = Collection(ALL, "Every station", "", "", emptyList())

/** Time left on the sleep timer, e.g. "25 min" or "1 h 05 min"; ticks while shown. */
@Composable
fun sleepLeft(): String {
    var nowMs by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(SleepTimer.at) { while (SleepTimer.at > 0) { nowMs = System.currentTimeMillis(); delay(10_000) } }
    val min = ((SleepTimer.at - nowMs).coerceAtLeast(0) / 60_000 + 1).toInt()
    return if (min >= 60) "${min / 60} h ${"%02d".format(min % 60)} min" else "$min min"
}

/** Sleep timer buttons: 15 / 30 / 60 minutes, Custom, and Off while it's running. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SleepChoices(onCustom: () -> Unit, dark: Boolean, after: () -> Unit = {}) {
    val fg = if (dark) Color.White else Ink
    val line = if (dark) Color(0x66FFFFFF) else Color(0x33000000)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(top = 8.dp, bottom = 12.dp)) {
        listOf(15, 30, 60).forEach { m ->
            OutlinedButton({ SleepTimer.set(m); after() }, Modifier.heightIn(min = 48.dp), border = BorderStroke(1.dp, line),
                contentPadding = PaddingValues(horizontal = 12.dp)) { Text("$m min", color = fg) }
        }
        OutlinedButton(onCustom, Modifier.heightIn(min = 48.dp), border = BorderStroke(1.dp, line),
            contentPadding = PaddingValues(horizontal = 12.dp)) { Text("Custom", color = fg) }
        if (SleepTimer.at > 0) OutlinedButton({ SleepTimer.off(); after() }, Modifier.heightIn(min = 48.dp), border = BorderStroke(1.dp, Gold),
            contentPadding = PaddingValues(horizontal = 12.dp)) { Text("Off", color = if (dark) Gold else Accent) }
    }
}

/** Sleep timer chooser (from the bottom bar), with a custom length from 5 minutes to 4 hours. */
@Composable
fun SleepDialog(customOnly: Boolean = false, close: () -> Unit) {
    var custom by remember { mutableStateOf(customOnly) }
    var mins by remember { mutableFloatStateOf(45f) }
    AlertDialog(onDismissRequest = close,
        title = { Text(if (custom) "Stop the radio after" else "Sleep timer") },
        text = { Column(horizontalAlignment = Alignment.CenterHorizontally) {
            if (!custom) {
                Text(if (SleepTimer.at > 0) "Stops in ${sleepLeft()}" else "Turn the radio off by itself after:", color = InkSoft)
                SleepChoices(onCustom = { custom = true }, dark = false, after = close)
            } else {
                val m = (mins.toInt() / 5) * 5
                Text(if (m >= 60) "${m / 60} h ${"%02d".format(m % 60)} min" else "$m min", fontSize = 28.sp, fontWeight = FontWeight.SemiBold, color = Accent)
                Slider(mins, { mins = it }, valueRange = 5f..240f, steps = 46, modifier = Modifier.padding(top = 8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(-15, -5, 5, 15).forEach { d ->
                        OutlinedButton({ mins = (mins + d).coerceIn(5f, 240f) }, Modifier.heightIn(min = 44.dp),
                            contentPadding = PaddingValues(horizontal = 10.dp)) { Text((if (d > 0) "+" else "−") + "${kotlin.math.abs(d)}") }
                    }
                }
            }
        } },
        confirmButton = { if (custom) Button({ SleepTimer.set((mins.toInt() / 5) * 5); close() }) { Text("Start") } },
        dismissButton = { TextButton(close) { Text("Cancel") } })
}

/** Share the song or station: picture card, text with a link, or copy the text and link. */
@Composable
fun ShareMenu(now: NowState, close: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val station = now.md.station?.toString() ?: ""
    val song = now.md.title?.toString() ?: ""
    val hasSong = song.isNotBlank() && song != station
    val artist = (now.md.artist?.toString() ?: "").split(" · ").filter { it != station }.joinToString(" · ")
    val link = now.id?.removePrefix("st|")?.let { stationLink(it) } ?: "https://ranjithkb.com/radio.html"
    val text = if (hasSong) "Listening to $song${if (artist.isNotBlank()) " by $artist" else ""} on $station · Radio Velvet\n$link"
        else "Listening to $station live on Radio Velvet\n$link"
    AlertDialog(onDismissRequest = close,
        title = { Text(if (hasSong) "Share this song" else "Share this station") },
        text = { Column {
            TextButton({ close(); scope.launch {
                if (hasSong) shareSongCard(ctx, song, artist, station, now.md.artworkUri?.toString(), link)
                else shareSongCard(ctx, station, "Live radio", station, null, link) } }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Icon(Icons.Filled.Image, null); Spacer(Modifier.width(10.dp)); Text("Picture card", Modifier.weight(1f)) }
            TextButton({ close(); shareTextOnly(ctx, text) }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Icon(Icons.Filled.Share, null); Spacer(Modifier.width(10.dp)); Text("Text with link", Modifier.weight(1f)) }
            TextButton({ close(); copyText(ctx, text) }, Modifier.fillMaxWidth().heightIn(min = 48.dp)) {
                Icon(Icons.Filled.ContentCopy, null); Spacer(Modifier.width(10.dp)); Text("Copy text and link", Modifier.weight(1f)) }
        } },
        confirmButton = { TextButton(close) { Text("Cancel") } })
}

/** Drag the pinned languages into the order they appear in the row. */
@Composable
fun ArrangePins(list: List<Collection>, onSave: (List<String>) -> Unit, close: () -> Unit) {
    var order by remember { mutableStateOf(list) }
    val state = rememberLazyListState()
    val re = rememberReorderableLazyListState(state) { from, to -> order = order.toMutableList().apply { add(to.index, removeAt(from.index)) } }
    Dialog({ onSave(order.map { it.id }); close() }) {
        Surface(shape = RoundedCornerShape(16.dp), color = Paper) {
            Column(Modifier.padding(vertical = 16.dp)) {
                Text("Arrange pinned languages", Modifier.padding(horizontal = 20.dp), fontWeight = FontWeight.SemiBold, fontSize = 18.sp)
                Text("Drag ≡ to change the order in the row.", Modifier.padding(20.dp, 4.dp), color = InkSoft, fontSize = 14.sp)
                LazyColumn(state = state, modifier = Modifier.heightIn(max = 420.dp)) {
                    items(order, key = { it.id }) { c ->
                        ReorderableItem(re, key = c.id) { dragging ->
                            Surface(color = if (dragging) AccentSoft else Paper, shadowElevation = if (dragging) 6.dp else 0.dp) {
                                Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).padding(horizontal = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                                    Icon(Icons.Filled.DragHandle, "Drag to move ${c.name}", tint = Accent,
                                        modifier = Modifier.draggableHandle().size(52.dp).padding(14.dp))
                                    Text(c.name, fontWeight = FontWeight.SemiBold)
                                }
                            }
                        }
                    }
                }
                Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp), horizontalArrangement = Arrangement.End) {
                    Button({ onSave(order.map { it.id }); close() }, Modifier.heightIn(min = 48.dp)) { Text("Done") }
                }
            }
        }
    }
}

/** 🎲 Spin: tap for a random station from the list you're on; press and hold for one from anywhere. */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun SpinPill(onClick: () -> Unit, onLongClick: () -> Unit) {
    val haptic = androidx.compose.ui.platform.LocalHapticFeedback.current
    Surface(shape = RoundedCornerShape(8.dp), color = Color.Transparent, border = BorderStroke(1.dp, Gold),
        modifier = Modifier.heightIn(min = 44.dp).padding(vertical = 4.dp).clip(RoundedCornerShape(8.dp))
            .combinedClickable(onClick = onClick, onLongClickLabel = "Random station from anywhere", onLongClick = {
                haptic.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.LongPress); onLongClick() })) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Filled.Casino, null, Modifier.size(18.dp), tint = Gold); Spacer(Modifier.width(6.dp))
            Text("Spin", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Ink)
        }
    }
}

/** Listening time: yours (this device, or every device when signed in) and everyone's total. */
@Composable
fun ListeningSection() {
    val ctx = LocalContext.current
    var mine by remember { mutableStateOf(Listen.local(ctx)) }
    var synced by remember { mutableStateOf(false) }
    var all by remember { mutableStateOf<Long?>(null) }
    LaunchedEffect(Session.name) {
        Listen.account(ctx)?.let { mine = it; synced = true }
        all = Listen.everyone()
    }
    Text(if (mine.total < 60_000) "Nothing yet — your listening time starts counting now." else "You've listened for ${Listen.hm(mine.total)}",
        fontWeight = FontWeight.SemiBold)
    if (mine.total >= 60_000) Text("This week: ${Listen.hm(mine.week)}" + if (synced) " · all your devices" else " · on this phone",
        color = InkSoft, fontSize = 14.sp)
    if (mine.top.isNotEmpty()) {
        Text("Your top stations", Modifier.padding(top = 8.dp), fontWeight = FontWeight.Medium, fontSize = 14.sp)
        mine.top.forEach { (n, ms) -> Text("$n · ${Listen.hm(ms)}", fontSize = 14.sp, color = InkSoft) }
    }
    all?.let { m -> Text("Listeners have enjoyed ${"%,d".format(m / 60)} hours of radio on Radio Velvet.",
        Modifier.padding(top = 10.dp), color = Accent, fontSize = 14.sp, fontWeight = FontWeight.Medium) }
}

/**
 * Messages for app users, read from ranjithkb.com/radio-notes.json so new ones need no app update.
 * Each note: id, title, text, optional button + link, "to" (web / play / all), "times" (how often it
 * may show, once per app start), optional "until" (yyyy-mm-dd) and "sayTimes" (adds "shown N times").
 * A link "whatsapp:<message>" opens a WhatsApp chat with the owner; the number comes from a private
 * build secret, never from the code or the website. One note shows per app start, the first one due.
 */
@Composable
fun AppNote() {
    val ctx = LocalContext.current
    val prefs = remember { ctx.getSharedPreferences("notes", Context.MODE_PRIVATE) }
    var note by remember { mutableStateOf<org.json.JSONObject?>(null) }
    var n by remember { mutableStateOf(0) }
    LaunchedEffect(Unit) {
        if (Session.noteShown) return@LaunchedEffect
        val arr = try { org.json.JSONObject(Repo.notes() ?: return@LaunchedEffect).optJSONArray("notes") } catch (e: Exception) { null } ?: return@LaunchedEffect
        val today = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.ROOT).format(java.util.Date())
        val me = if (BuildConfig.SELF_UPDATE) "web" else "play"
        for (k in 0 until arr.length()) {
            val o = arr.optJSONObject(k) ?: continue
            val id = o.optString("id"); if (id.isBlank()) continue
            val to = o.optString("to", "all"); if (to != "all" && to != me) continue
            val until = o.optString("until"); if (until.isNotBlank() && today > until) continue
            val times = o.optInt("times", 1); val seen = prefs.getInt(id, 0); if (seen >= times) continue
            if (o.optString("link").startsWith("whatsapp:") && BuildConfig.WA_NUMBER.isBlank()) continue
            n = seen + 1; prefs.edit().putInt(id, n).apply(); Session.noteShown = true; note = o; break
        }
    }
    val o = note ?: return
    val close = { note = null }
    val times = o.optInt("times", 1)
    AlertDialog(onDismissRequest = close,
        title = { Text(o.optString("title")) },
        text = { Column {
            o.optString("text").split("\n\n").filter { it.isNotBlank() }.forEachIndexed { i, para ->
                Text(para, if (i > 0) Modifier.padding(top = 10.dp) else Modifier) }
            if (o.optBoolean("sayTimes")) Text("This note is shown only $times times (this is $n of $times).",
                Modifier.padding(top = 10.dp), color = InkSoft, fontSize = 13.sp)
        } },
        confirmButton = {
            val link = o.optString("link"); val label = o.optString("button")
            if (link.isNotBlank() && label.isNotBlank()) Button({
                val url = if (link.startsWith("whatsapp:"))
                    "https://wa.me/${BuildConfig.WA_NUMBER}?text=" + android.net.Uri.encode(link.removePrefix("whatsapp:")) else link
                try { ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                    .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) } catch (e: Exception) { openUrl(ctx, url) }
                close()
            }, Modifier.heightIn(min = 44.dp)) { Text(label) }
            else TextButton(close, Modifier.heightIn(min = 44.dp)) { Text("OK") }
        },
        dismissButton = { if (o.optString("link").isNotBlank() && o.optString("button").isNotBlank())
            TextButton(close, Modifier.heightIn(min = 44.dp)) { Text("Not now") } })
}
