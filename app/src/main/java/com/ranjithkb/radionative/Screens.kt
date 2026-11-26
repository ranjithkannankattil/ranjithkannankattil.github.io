package com.ranjithkb.radionative

import android.content.Intent
import android.os.Build
import android.provider.Settings as AndroidSettings
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.foundation.combinedClickable
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import java.util.Calendar
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

private val Pad = 24.dp

/** A full page drawn over the app (not a separate window), with ← and a spaced-capitals title. */
@Composable
fun SubPage(title: String, close: () -> Unit, scroll: Boolean = true, scrollState: androidx.compose.foundation.ScrollState? = null,
            action: (@Composable () -> Unit)? = null, body: @Composable ColumnScope.() -> Unit) {
    BackHandler(onBack = close)
    Column(Modifier.fillMaxSize().background(Paper).pointerInput(Unit) { detectTapGestures { } }
        .statusBarsPadding().navigationBarsPadding().imePadding()) {
        Row(Modifier.padding(start = 10.dp, end = 20.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(close, Modifier.size(52.dp)) { LineIcon(R.drawable.ln_back, "Back", 24) }
            Label(title, Title, 13, weight = FontWeight.Medium)
            if (action != null) { Spacer(Modifier.weight(1f)); action() }      // e.g. Save, always in reach
        }
        val own = rememberScrollState()
        Column((if (scroll) Modifier.verticalScroll(scrollState ?: own) else Modifier).fillMaxWidth()
            .padding(start = Pad, end = Pad, bottom = 28.dp), content = body)
    }
}

@Composable fun SectionHead(t: String) = Label(t, Soft, 10, Modifier.padding(top = 24.dp, bottom = 10.dp))

/** Two to four choices side by side; the chosen one filled. */
@Composable
fun Segmented(options: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    Row(Modifier.fillMaxWidth().border(1.dp, Line)) {
        options.forEachIndexed { i, o ->
            val on = i == selected
            Box(Modifier.weight(1f).heightIn(min = 48.dp).background(if (on) Title else Color.Transparent)
                .semantics { role = Role.RadioButton; this.selected = on }
                .clickable(onClickLabel = o) { onSelect(i) }.padding(horizontal = 4.dp, vertical = 8.dp), contentAlignment = Alignment.Center) {
                // a little smaller when the text size is large, so "Comfortable" still fits on a small phone
                Text(o, fontSize = (if (Theme.text >= 2) 12 else if (Theme.text == 1) 13 else 14).sp, color = if (on) Paper else Title,
                    maxLines = 2, lineHeight = 17.sp,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        }
    }
}

@Composable
fun SettingRow(title: String, sub: String? = null, value: String? = null, onClick: (() -> Unit)? = null, trailing: (@Composable () -> Unit)? = null) {
    Column {
        Row(Modifier.fillMaxWidth().heightIn(min = 56.dp).then(if (onClick != null) Modifier.clickable(onClickLabel = title, onClick = onClick) else Modifier)
            .padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 16.sp, color = Title)
                if (sub != null) Text(sub, fontSize = 13.sp, color = Soft, modifier = Modifier.padding(top = 2.dp))
            }
            if (value != null) Text(value, fontSize = 14.sp, color = Soft, modifier = Modifier.padding(start = 8.dp))
            trailing?.invoke()
            if (onClick != null && trailing == null) Text("›", fontSize = 20.sp, color = Soft, modifier = Modifier.padding(start = 8.dp))
        }
        HorizontalDivider(color = Line)
    }
}

@Composable
fun VelvetSwitch(on: Boolean, label: String, onChange: (Boolean) -> Unit) =
    Switch(on, onChange, Modifier.semantics { contentDescription = label },
        colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = Accent, uncheckedThumbColor = Soft,
            uncheckedTrackColor = Paper2, uncheckedBorderColor = Line))

@Composable
fun Swatch(t: ThemeDef, size: Int, on: Boolean) {
    val p = Palettes.of(t.id, false)
    Box(Modifier.size(size.dp).clip(CircleShape).background(p.paper).border(if (on) 2.dp else 1.dp, if (on) Title else Line, CircleShape),
        contentAlignment = Alignment.Center) {
        Row(horizontalArrangement = Arrangement.spacedBy((size / 18).dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size((size * 0.27).dp).clip(CircleShape).background(Color(t.accent)))
            Box(Modifier.size((size * 0.16).dp).clip(CircleShape).background(Color(t.hi)))
        }
    }
}

/**
 * A tiny version of the real screen in one theme: header, three stations (one playing, with the gold mark),
 * and the player bar. Light or dark follows the app's current choice.
 */
@Composable
fun ThemePreview(t: ThemeDef, on: Boolean, w: Int, modifier: Modifier = Modifier) {
    val p = Palettes.of(t.id, Theme.dark)
    val h = (w * 1.62f).toInt()
    val u = w / 76f   // scale: the box is drawn for 76 dp wide
    Column(modifier.width(w.dp).height(h.dp).clip(RoundedCornerShape((6 * u).dp)).background(p.paper)
        .border(if (on) 2.dp else 1.dp, if (on) p.accent else Line, RoundedCornerShape((6 * u).dp))) {
        Row(Modifier.padding(start = (6 * u).dp, top = (7 * u).dp, end = (6 * u).dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(androidx.compose.ui.res.painterResource(R.drawable.ic_logo_mark), null, Modifier.size((8 * u).dp), tint = if (Theme.dark) p.gold else p.ink)
            Spacer(Modifier.width((3 * u).dp))
            Box(Modifier.width((26 * u).dp).height((2 * u).dp).background(p.ink))
        }
        Box(Modifier.padding(start = (6 * u).dp, top = (6 * u).dp).width((22 * u).dp).height((1.5f * u).dp).background(p.accent))
        listOf(true, false, false).forEach { playing ->
            Row(Modifier.padding(start = (6 * u).dp, end = (6 * u).dp, top = (7 * u).dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.width((1.5f * u).dp).height((9 * u).dp).background(if (playing) p.gold else Color.Transparent))
                Spacer(Modifier.width((3 * u).dp))
                Column(Modifier.weight(1f)) {
                    Box(Modifier.width(((if (playing) 34 else 30) * u).dp).height((2.5f * u).dp).background(if (playing) p.accentText else p.ink))
                    Spacer(Modifier.height((2.5f * u).dp))
                    Box(Modifier.width((20 * u).dp).height((1.5f * u).dp).background(p.soft))
                }
                Box(Modifier.size((5 * u).dp).clip(CircleShape).background(if (playing) p.accent else Color.Transparent)
                    .border((0.8f * u).dp, p.soft, CircleShape))
            }
            Box(Modifier.padding(start = (6 * u).dp, end = (6 * u).dp, top = (5 * u).dp).fillMaxWidth().height(1.dp).background(p.line))
        }
        Spacer(Modifier.weight(1f))
        Row(Modifier.fillMaxWidth().background(p.bar).padding(horizontal = (6 * u).dp, vertical = (7 * u).dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Box(Modifier.width((16 * u).dp).height((1.5f * u).dp).background(if (Palettes.contrast(p.gold, p.bar) >= 2.6f) p.gold else p.barInk))
                Spacer(Modifier.height((3 * u).dp))
                Box(Modifier.width((30 * u).dp).height((2.5f * u).dp).background(p.barInk))
            }
            Box(Modifier.size((13 * u).dp).clip(CircleShape).border((1 * u).dp, if (Palettes.contrast(p.gold, p.bar) >= 2.6f) p.gold else p.barInk, CircleShape))
        }
    }
}

/** A theme as a box with its name under it: tap to use it. */
@Composable
fun ThemeChoice(t: ThemeDef, w: Int, onPick: () -> Unit) {
    val on = t.id == Theme.themeId
    Column(Modifier.width(w.dp).semantics { selected = on; role = Role.RadioButton; contentDescription = "${t.name} ${t.en} colour theme" }
        .clickable(onClick = onPick), horizontalAlignment = Alignment.CenterHorizontally) {
        ThemePreview(t, on, w)
        Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            if (on) Text("◆ ", color = GoldC, fontSize = 11.sp)
            Text(t.name, fontSize = 13.sp, color = if (on) AccentText else Title, fontWeight = if (on) FontWeight.Medium else FontWeight.Normal, maxLines = 1)
        }
        if (t.ml.isNotBlank()) Text(t.ml, fontSize = 12.sp, color = Soft, maxLines = 1, fontFamily = Manjari)
        if (t.en != t.name) Text(t.en, fontSize = 11.sp, color = Soft, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

// ------------------------------------------------------------------ Settings

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SettingsScreen(close: () -> Unit, scroll: androidx.compose.foundation.ScrollState? = null, update: Update? = null, open: (String) -> Unit) {
    val ctx = LocalContext.current
    fun save() = Theme.save(ctx)
    // 2.10: grouped cards, one look per kind of item. The scroll position is kept by the caller, so coming back
    // from Data saver, Colour theme… lands where you were.
    SubPage(t("Settings"), close, scrollState = scroll) {
        Group(t("Language")) {
            PickItem(t("App language"), Lang.CODES.map { Lang.NAMES_EN[it] ?: it }, Lang.CODES.indexOf(Lang.code),
                icon = Icons.Outlined.Language) { Lang.set(ctx, Lang.CODES[it]) }
        }
        Group(t("Look")) {
            NavItem(t("Colour theme"), (THEMES.find { it.id == Theme.themeId }?.name ?: "Velvet") + " · " +
                when (Theme.mode) { "light" -> t("Light"); "dark" -> t("Dark"); else -> t("follows the phone") },
                icon = Icons.Outlined.Palette) { open("themes") }
            RowLine()
            NavItem(t("Player look"), Eras.byId(Theme.look)?.name ?: "Standard", drawable = R.drawable.ln_radio) { open("look") }
            RowLine()
            NavItem(t("Text and font"), (FONTS.find { it.id == Theme.font }?.name ?: "Jost") + " · " +
                listOf(t("Normal"), t("Large"), t("Extra large"))[Theme.text.coerceIn(0, 2)],
                icon = Icons.Outlined.TextFields) { open("text") }
            RowLine()
            NavItem(t("Visualiser"), if (Theme.viz == "off") t("Off") else Theme.viz.replaceFirstChar { it.uppercase() },
                icon = Icons.Outlined.GraphicEq) { open("viz") }
            RowLine()
            PickItem(t("Row size"), listOf(t("Compact"), t("Comfortable"), t("Expanded")), Theme.spacing,
                icon = Icons.Outlined.ViewAgenda) { Theme.spacing = it; save() }
        }
        Group(t("Favourites")) {
            PickItem(t("Show favourites as"), listOf(t("List"), t("Tiles")), if (Theme.favTiles) 1 else 0,
                drawable = R.drawable.ln_heart) { Theme.favTiles = it == 1; save() }
            RowLine()
            val own = remember { OwnStations.list(ctx).size }
            NavItem(t("Your own stations"), if (own > 0) "$own" else t("Add a link"), icon = Icons.Outlined.AddLink) { open("own") }
        }
        Group(t("Sound")) {
            NavItem(t("Equaliser"), if (Eq.on(ctx)) Eq.preset(ctx) else t("Off"), icon = Icons.Outlined.Tune) { open("eq") }
            RowLine()
            var even by remember { mutableStateOf(EvenVolume.on.also { EvenVolume.load(ctx) }) }
            ToggleItem(t("Even volume"), even, icon = Icons.Outlined.GraphicEq,
                sub = t("Every station at about the same loudness, so changing station never jumps")) { even = it; EvenVolume.set(ctx, it) }
        }
        Group(t("Data and playback")) {
            NavItem(t("Data saver"), when (DataSaver.mode) { DataSaver.ON -> t("Always"); DataSaver.MOBILE -> t("On mobile data"); else -> t("Off") } +
                " · " + DataUse.size(DataUse.thisMonth(ctx).let { it.first + it.second }) + " " + t("this month"),
                icon = Icons.Outlined.DataSaverOn) { open("data") }
            RowLine()
            ToggleItem(t("Carry on after videos"), Theme.resume, icon = Icons.Outlined.Replay,
                sub = t("The radio comes back after a video in another app. Never during calls.")) { Theme.resume = it; save() }
            RowLine()
            ToggleItem(t("Play the last station on opening"), Theme.autoPlay, icon = Icons.Outlined.PlayCircle,
                sub = t("Opening the app, on the phone or in the car, starts the station you last played")) { Theme.autoPlay = it; save() }
        }
        InfoText(t("Data saver plays each station's lightest link and skips song pictures, for ships, villages and patchy signal."))
        Group(t("Feedback")) {
            NavItem(t("Suggest a station"), sub = t("A link, or just its name"), icon = Icons.Outlined.AddCircleOutline) { open("request") }
            RowLine()
            NavItem(t("Request a feature"), sub = t("Something you wish the app did"), icon = Icons.Outlined.Lightbulb) { open("feature") }
            RowLine()
            NavItem(t("Send a thank-you note"), sub = t("A few words to the person who makes it"), drawable = R.drawable.ln_heart) { open("thanks") }
            RowLine()
            NavItem(t("Rate on Google Play"), sub = t("Helps others find Radio Velvet"), drawable = R.drawable.ln_star) {
                openUrl(ctx, "https://play.google.com/store/apps/details?id=com.ranjithkb.radio") }
        }
        InfoText(t("Radio Velvet is one person's hobby, made in spare time, so a reply can take a few days. Every message is read."))
        VersionCard(update)
        Box(Modifier.fillMaxWidth().padding(top = 14.dp), contentAlignment = Alignment.Center) {
            TextButton({ Theme.themeId = "velvet"; Theme.mode = "phone"; Theme.text = 0; Theme.font = "jost"; Theme.spacing = 1; Theme.viz = "off"
                Theme.look = "std"; Theme.lookColours = "original"; save() }, Modifier.heightIn(min = 48.dp)) {
                Text(t("Reset to the original look"), color = Soft, fontSize = 14.sp) }
        }
    }
}

/** Bottom of Settings: the app icon, version, and whether it's up to date (with the update when there is one). */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun VersionCard(update: Update?) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var log by remember { mutableStateOf(false) }
    var news by remember { mutableStateOf(false) }
    var checking by remember { mutableStateOf(false) }
    var found by remember { mutableStateOf(update) }
    var checkedAt by remember { mutableStateOf(System.currentTimeMillis()) }
    Group(t("App version")) {
        Row(Modifier.fillMaxWidth()
            .combinedClickable(onClick = {}, onLongClickLabel = "Show what the radio did lately", onLongClick = { log = true })
            .padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(52.dp).clip(RoundedCornerShape(13.dp)).background(ArtBg), contentAlignment = Alignment.Center) {
                Icon(androidx.compose.ui.res.painterResource(R.drawable.ic_logo_mark), null, Modifier.size(36.dp), tint = GoldC) }
            Column(Modifier.padding(start = 14.dp).weight(1f)) {
                Text("Radio Velvet ${appVersion(ctx)}", fontSize = 17.sp, fontWeight = FontWeight.Medium, color = Title)
                val hm = java.text.SimpleDateFormat("HH:mm", java.util.Locale.UK).format(java.util.Date(checkedAt))
                Text(if (found == null) "✓ " + t("Up to date") + " · " + t("checked") + " $hm" else t("A new version is ready"),
                    fontSize = 14.sp, color = if (found == null) Color(0xFF2E7D4F) else AccentText)
            }
        }
        found?.let { u ->
            Row(Modifier.fillMaxWidth().padding(horizontal = 12.dp).clip(RoundedCornerShape(16.dp)).background(Accent).padding(14.dp),
                verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("${u.version} " + t("is ready"), color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Medium)
                    u.notes.firstOrNull()?.let { Text(it, color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp, maxLines = 2) }
                }
                Spacer(Modifier.width(10.dp))
                if (BuildConfig.SELF_UPDATE) UpdateButton(u, t("Update"))
                else Button({ openUrl(ctx, "https://play.google.com/store/apps/details?id=com.ranjithkb.radio") },
                    Modifier.heightIn(min = 44.dp)) { Text(t("Update")) }
            }
            Spacer(Modifier.height(8.dp))
        }
        RowLine()
        NavItem(t("What's new"), sub = t("What changed in this version"), icon = Icons.Outlined.NewReleases) { news = true }
        RowLine()
        NavItem(if (checking) t("Checking…") else t("Check for updates"), icon = Icons.Outlined.Refresh) {
            if (!BuildConfig.SELF_UPDATE) openUrl(ctx, "https://play.google.com/store/apps/details?id=com.ranjithkb.radio")
            else if (!checking) scope.launch { checking = true; found = checkUpdate(ctx); checkedAt = System.currentTimeMillis(); checking = false }
        }
    }
    InfoText(t("Google Play keeps the app up to date by itself."))
    if (news) AlertDialog(onDismissRequest = { news = false }, title = { Text(t("What's new")) },
        text = { Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState())) {
            WHATS_NEW.forEach { Text("• " + t(it), fontSize = 14.sp, lineHeight = 20.sp, modifier = Modifier.padding(top = 6.dp)) } } },
        confirmButton = { TextButton({ news = false }) { Text(t("OK")) } })
    // for testers: hold the version line to see what started or stopped the radio, and who asked
    if (log) AlertDialog(onDismissRequest = { log = false }, title = { Text("What the radio did lately") },
        text = { Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState())) {
            (PlayLog.all(ctx) + listOf("— alarms —") + AlarmLog.all(ctx)).forEach { Text(it, fontSize = 12.sp, lineHeight = 16.sp) } } },
        confirmButton = { TextButton({ log = false }) { Text(t("OK")) } },
        dismissButton = { TextButton({
            val cm = ctx.getSystemService(android.content.ClipboardManager::class.java)
            cm?.setPrimaryClip(android.content.ClipData.newPlainText("Radio Velvet log", (PlayLog.all(ctx) + AlarmLog.all(ctx)).joinToString("\n")))
        }) { Text("Copy") } })
}

/** Shown under Settings → App version → What's new. */
val WHATS_NEW = listOf(
    "A new, clearer look: settings in cards, every kind of item looks like what it does.",
    "In the car: next and previous stay in the list you started from, and the radio pauses when you leave the car.",
    "Most heard now counts all listening since the start.",
    "Row size: Compact, Comfortable or Expanded.",
    "Feedback: suggest a station, request a feature or send a thank-you note.",
    "TV channels carry a small TV tag.",
    "Even volume: every station at about the same loudness.",
    "Your listening: week, month, year and all time, with a picture to share.",
    "Add your own station, kept private on your phone.",
    "Pin the languages you want in your top row; Malayalam can be unpinned too.",
    "A heart beside the station name in the big player.",
    "Help and FAQ, in English, Malayalam and Hindi.",
    "Play the last station when you open the app (Settings → Data and playback), on the phone and in the car.")

/** Settings → Text and font: text size and the font, each shown in itself. */
@Composable
fun TextFontScreen(close: () -> Unit) {
    val ctx = LocalContext.current
    fun save() = Theme.save(ctx)
    SubPage(t("Text and font"), close) {
        Group(t("Text size")) {
            PickItem(null, listOf(t("Normal"), t("Large"), t("Extra large")), Theme.text) { Theme.text = it; save() }
        }
        GroupHead(t("Font"))
        FONTS.chunked(2).forEach { pair ->
            Row(Modifier.fillMaxWidth().padding(bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                pair.forEach { f ->
                    val on = f.id == Theme.font
                    Column(Modifier.weight(1f).heightIn(min = 72.dp).clip(RoundedCornerShape(16.dp))
                        .background(if (on) AccentSoft else CardBg).border(if (on) 1.5.dp else 0.dp, if (on) Accent else Color.Transparent, RoundedCornerShape(16.dp))
                        .semantics { selected = on; role = Role.RadioButton }.clickable(onClickLabel = "Use ${f.name}") { Theme.font = f.id; save() }
                        .padding(horizontal = 14.dp, vertical = 10.dp), verticalArrangement = Arrangement.Center) {
                        Text("Radio Velvet", fontFamily = f.family, fontSize = (17 * (if (f.scale > 1f) 1.1f else 1f)).sp,
                            color = Title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(f.name + "  ·  " + f.kind, fontSize = 12.sp, color = if (on) AccentText else Soft, maxLines = 1, fontFamily = FONTS[0].family)
                    }
                }
                if (pair.size == 1) Spacer(Modifier.weight(1f))
            }
        }
    }
}

/** Settings → Feedback → Request a feature / Send a thank-you note: a short note to Ranjith (kept with station requests). */
@Composable
fun FeedbackScreen(kind: String, close: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val feature = kind == "feature"
    var text by remember { mutableStateOf("") }; var mail by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }; var msg by remember { mutableStateOf<String?>(null) }; var sent by remember { mutableStateOf(false) }
    SubPage(if (feature) t("Request a feature") else t("Send a thank-you note"), close) {
        Text(if (feature) t("What would make Radio Velvet better for you?") else t("A few kind words make a hobby project worth it. Thank you!"),
            fontSize = 15.sp, color = Title, lineHeight = 22.sp, modifier = Modifier.padding(top = 6.dp))
        Field(if (feature) "Your idea" else "Your note", text, if (feature) "e.g. a sleep timer that fades out" else "e.g. I listen every morning in the car", 300) { text = it; sent = false }
        Field("Your email (only if you'd like a reply)", mail, "name@example.com", 80) { mail = it }
        ActionButton(if (busy) t("Sending…") else if (sent) t("Sent") else t("Send"), modifier = Modifier.padding(top = 24.dp), enabled = !busy && !sent) {
            if (text.trim().length < 2) { msg = t("Please write a few words first."); return@ActionButton }
            scope.launch { busy = true
                msg = Requests.send(ctx, if (feature) "Feature request" else "Thank-you note", mail, "", text)
                busy = false; if (msg == null) { sent = true; text = ""; mail = "" } }
        }
        InfoText(t("Only Ranjith reads these. Radio Velvet is a hobby project, so a reply can take a few days."))
        if (sent) Text("◆ " + t("Thank you! Sent."), fontSize = 15.sp, color = AccentText, modifier = Modifier.padding(top = 16.dp))
        msg?.let { Text(it, fontSize = 14.sp, color = AccentText, modifier = Modifier.padding(top = 14.dp)) }
    }
}

@Composable
fun ThemesScreen(close: () -> Unit) {
    val ctx = LocalContext.current
    SubPage(t("Colour theme"), close) {
        Text(t("Each theme has a light and a dark version; Settings → Appearance chooses which."), fontSize = 13.sp, color = Soft,
            modifier = Modifier.padding(top = 4.dp))
        THEMES.groupBy { it.group }.forEach { (g, list) ->
            SectionHead(g)
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val w = ((maxWidth.value - 2 * 14) / 3).toInt().coerceAtMost(110)
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    list.chunked(3).forEach { row ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                            row.forEach { t -> ThemeChoice(t, w) { Theme.themeId = t.id; Theme.save(ctx) } }
                        }
                    }
                }
            }
        }
    }
}

// ------------------------------------------------------------------ Equaliser

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun EqualiserScreen(close: () -> Unit) {
    val ctx = LocalContext.current
    var on by remember { mutableStateOf(Eq.on(ctx)) }
    var preset by remember { mutableStateOf(Eq.preset(ctx)) }
    var bands by remember { mutableStateOf(Eq.bands(ctx).toList()) }
    fun save() = Eq.save(ctx, on, preset, bands.toIntArray())
    SubPage(t("Equaliser"), close) {
        SettingRow(t("Equaliser on"), trailing = { VelvetSwitch(on, "Equaliser on") { on = it; save() } })
        SectionHead(t("Presets"))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            (Eq.PRESETS.keys + "Custom").forEach { name ->
                val sel = name == preset
                Box(Modifier.heightIn(min = 44.dp).border(1.dp, if (sel) Title else Line).background(if (sel) Title else Color.Transparent)
                    .semantics { selected = sel; role = Role.RadioButton }
                    .clickable(onClickLabel = name) {
                        preset = name; Eq.PRESETS[name]?.let { bands = it.toList() }; if (!on) on = true; save() }
                    .padding(horizontal = 14.dp, vertical = 10.dp), contentAlignment = Alignment.Center) {
                    Text(name, fontSize = 14.sp, color = if (sel) Paper else Title)
                }
            }
        }
        SectionHead(t("Fine-tune"))
        Row(Modifier.fillMaxWidth().padding(top = 6.dp).then(if (on) Modifier else Modifier.background(Color.Transparent))) {
            listOf("60 Hz", "230 Hz", "910 Hz", "3.6 kHz", "14 kHz").forEachIndexed { i, f ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(t("%+d").format(bands[i]), fontSize = 13.sp, color = Soft)
                    VSlider(bands[i], f, enabled = on) { v -> bands = bands.toMutableList().also { it[i] = v }; preset = "Custom"; save() }
                    Label(f, Soft, 8)
                }
            }
        }
        Text(t("Works on the phone speaker, headphones, Bluetooth and in the car. Turned off while casting to a TV or speaker. Not on the website: browsers can't change other sites' sound."), fontSize = 13.sp, color = Soft, lineHeight = 19.sp,
            modifier = Modifier.padding(top = 24.dp))
    }
}

/** A tall slider from -12 to +12 dB: drag, or tap a point. Works with TalkBack (swipe up / down). */
@Composable
fun VSlider(value: Int, label: String, enabled: Boolean, onChange: (Int) -> Unit) {
    val h = 190.dp
    val col = if (enabled) Accent else Soft
    Box(Modifier.width(48.dp).height(h).padding(vertical = 10.dp)
        .semantics {
            contentDescription = "$label level"; stateDescription = "%+d decibels".format(value)
            progressBarRangeInfo = ProgressBarRangeInfo(value.toFloat(), -12f..12f, 23)
            setProgress { v -> onChange(v.toInt().coerceIn(-12, 12)); true }
        }
        .pointerInput(enabled) {
            if (!enabled) return@pointerInput
            fun at(y: Float) = (12 - (y / size.height * 24f)).toInt().coerceIn(-12, 12)
            detectTapGestures { onChange(at(it.y)) }
        }
        .pointerInput(enabled) {
            if (!enabled) return@pointerInput
            detectVerticalDragGestures { ch, _ -> onChange((12 - (ch.position.y / size.height * 24f)).toInt().coerceIn(-12, 12)) }
        }) {
        Canvas(Modifier.fillMaxSize()) {
            val cx = size.width / 2; val mid = size.height / 2
            val y = size.height * (12 - value) / 24f
            drawLine(Line, Offset(cx, 0f), Offset(cx, size.height), 2.dp.toPx())
            drawLine(col, Offset(cx, mid), Offset(cx, y), 4.dp.toPx())
            drawLine(Soft.copy(alpha = 0.5f), Offset(cx - 8.dp.toPx(), mid), Offset(cx + 8.dp.toPx(), mid), 1.dp.toPx())
            drawCircle(Paper, 11.dp.toPx(), Offset(cx, y)); drawCircle(col, 11.dp.toPx(), Offset(cx, y), style = Stroke(1.5.dp.toPx()))
        }
    }
}

// ------------------------------------------------------------------ Visualiser

val VIZ_STYLES = listOf("bars", "waves", "circle", "off")

@Composable
fun VisualiserScreen(close: () -> Unit) {
    val ctx = LocalContext.current
    SubPage(t("Visualiser"), close) {
        Text(t("Moves with the music in the big player, in your theme's colours. Uses only the radio's own sound: no microphone. Off saves a little battery."), fontSize = 14.sp, color = Soft, lineHeight = 20.sp, modifier = Modifier.padding(top = 4.dp))
        SectionHead(t("Style"))
        Segmented(listOf(t("Bars"), t("Waves"), t("Circle"), t("Off")), VIZ_STYLES.indexOf(Theme.viz)) { Theme.viz = VIZ_STYLES[it]; Theme.save(ctx) }
        if (Theme.viz != "off") Box(Modifier.padding(top = 24.dp).fillMaxWidth().height(180.dp).background(ArtBg), contentAlignment = Alignment.Center) {
            VizView(Theme.viz, playing = true, Modifier.fillMaxSize().padding(14.dp), demo = true)
        }
    }
}

/**
 * The visualiser itself. Real sound levels from the player when they're coming in; otherwise (casting, or before
 * the first sound) a gentle movement that follows play / pause.
 */
@Composable
fun VizView(style: String, playing: Boolean, modifier: Modifier, demo: Boolean = false) {
    if (style == "off") return
    DisposableEffect(Unit) { Viz.watching = true; onDispose { Viz.watching = false } }
    var t by remember { mutableFloatStateOf(0f) }
    var shown by remember { mutableStateOf(FloatArray(Viz.N)) }
    LaunchedEffect(playing) {
        var last = 0L
        while (true) {
            withFrameNanos { n ->
                if (last != 0L) t += (n - last) / 1e9f
                last = n
                val live = !demo && System.currentTimeMillis() - Viz.stamp < 600
                val target = if (live) Viz.bands else FloatArray(Viz.N) { i ->
                    if (!playing) 0.04f else (0.25f + 0.35f * (0.5f + 0.5f * sin(t * 2.1f + i * 0.45f)) * (0.6f + 0.4f * cos(t * 1.3f + i * 0.17f)))
                        .let { it * (1f - i / (Viz.N * 1.6f)) } }
                shown = FloatArray(Viz.N) { i -> shown[i] + (target[i] - shown[i]) * (if (!playing) 0.08f else 0.35f) }
            }
        }
    }
    val a = AccentText; val g = GoldC
    val fg = if (Palettes.contrast(a, ArtBg) >= 2f) a else Theme.pal.barInk
    Canvas(modifier.semantics { contentDescription = Lang.tr("Visualiser") }) {
        val v = shown
        when (style) {
            "bars" -> {
                val w = size.width / Viz.N
                v.forEachIndexed { i, x ->
                    val bh = (size.height * (0.06f + 0.94f * x))
                    drawLine(if (i % 7 == 3) g else fg, Offset(i * w + w / 2, size.height), Offset(i * w + w / 2, size.height - bh),
                        (w * 0.62f).coerceAtLeast(2f), cap = StrokeCap.Butt, alpha = 0.55f + 0.45f * x)
                }
            }
            "waves" -> {
                fun wave(scale: Float, phase: Float): Path = Path().apply {
                    val mid = size.height / 2
                    for (s in 0..96) {
                        val x = size.width * s / 96f
                        val amp = v[(s * (Viz.N - 1) / 96)] * size.height * 0.42f * scale
                        val y = mid + amp * sin(s / 96f * 2 * PI.toFloat() * 3 + t * 2.4f + phase)
                        if (s == 0) moveTo(x, y) else lineTo(x, y)
                    }
                }
                drawPath(wave(1f, 0f), fg, style = Stroke(2.2.dp.toPx(), cap = StrokeCap.Round))
                drawPath(wave(0.6f, 1.6f), g, style = Stroke(1.4.dp.toPx(), cap = StrokeCap.Round), alpha = 0.85f)
            }
            else -> {   // circle
                val c = Offset(size.width / 2, size.height / 2); val r0 = minOf(size.width, size.height) * 0.30f
                val n = Viz.N * 2
                for (k in 0 until n) {
                    val x = v[k % Viz.N]; val ang = (k / n.toFloat()) * 2 * PI.toFloat() - PI.toFloat() / 2
                    val r1 = r0 + x * minOf(size.width, size.height) * 0.18f
                    drawLine(if (k % 8 == 3) g else fg, Offset(c.x + r0 * cos(ang), c.y + r0 * sin(ang)), Offset(c.x + r1 * cos(ang), c.y + r1 * sin(ang)),
                        2.2.dp.toPx(), cap = StrokeCap.Round, alpha = 0.5f + 0.5f * x)
                }
                drawCircle(g, r0 - 3.dp.toPx(), c, style = Stroke(1.dp.toPx()), alpha = 0.7f)
            }
        }
    }
}

/** BARS · WAVES · CIRCLE · OFF under the cover in the big player. */
@Composable
fun VizSwitcher() {
    val ctx = LocalContext.current
    val pr = Theme.prefs(ctx)
    fun pick(st: String) {
        if (st == "off" && Theme.viz != "off") pr.edit().putString("vizLast", Theme.viz).apply()   // remembered for next time
        Theme.viz = st; Theme.save(ctx)
    }
    if (Theme.viz == "off") {
        // off: one quiet little switch under the cover (three small bars and the word), so it's there but doesn't draw the eye
        Row(Modifier.padding(top = 4.dp).heightIn(min = 44.dp).alpha(0.75f)
            .clickable(onClickLabel = t("Turn on the visualiser")) { pick(pr.getString("vizLast", "bars")!!.takeIf { it in VIZ_STYLES && it != "off" } ?: "bars") }
            .padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Canvas(Modifier.size(12.dp, 10.dp)) {
                val w = size.width / 5
                listOf(0.5f, 1f, 0.7f).forEachIndexed { i, f ->
                    drawLine(Soft, Offset(w * (i * 2 + 0.5f), size.height), Offset(w * (i * 2 + 0.5f), size.height * (1 - f)), 1.3.dp.toPx())
                }
            }
            Spacer(Modifier.width(7.dp))
            Label(t("Visualiser"), Soft, 8)
        }
        return
    }
    Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        VIZ_STYLES.forEach { st ->
            val on = st == Theme.viz
            Box(Modifier.heightIn(min = 44.dp).semantics { selected = on }.clickable(onClickLabel = "Visualiser: $st") { pick(st) }
                .padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
                Label(st, if (on) AccentText else Soft, 9, weight = if (on) FontWeight.SemiBold else FontWeight.Medium,
                    modifier = Modifier.drawBehind { if (on) drawLine(AccentText, Offset(0f, size.height + 3.dp.toPx()), Offset(size.width, size.height + 3.dp.toPx()), 1.dp.toPx()) })
            }
        }
    }
}

// ------------------------------------------------------------------ Sort

val SORTS = listOf("usual" to "Usual order", "az" to "A–Z", "heard" to "Most heard", "rated" to "Top rated", "light" to "Lightest first")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SortSheet(current: String, onPick: (String) -> Unit, close: () -> Unit, picks: Boolean = false) {
    ModalBottomSheet(onDismissRequest = close, containerColor = Paper, scrimColor = Color.Black.copy(alpha = 0.35f),
        dragHandle = { Box(Modifier.padding(top = 12.dp, bottom = 8.dp).size(36.dp, 3.dp).background(Line)) }) {
        Column(Modifier.padding(start = Pad, end = Pad, bottom = 24.dp)) {
            Label(t("Sort stations"), Soft, 10, Modifier.padding(bottom = 6.dp))
            listOf((if (picks) "Velvet's order" else "Usual order") to (if (picks) "The hand-picked order" else "As the stations are listed"), "A–Z" to "By name",
                "Most heard" to "Hours listened by everyone, since the start", "Top rated" to "Average stars, from 3 ratings up",
                "Lightest first" to "Least data an hour first (good for Data saver)").forEachIndexed { i, (en, de) ->
                val t = Lang.tr(en); val d = Lang.tr(de)
                val id = SORTS[i].first; val on = id == current
                Row(Modifier.fillMaxWidth().heightIn(min = 60.dp).semantics { selected = on; role = Role.RadioButton }
                    .clickable(onClickLabel = t) { onPick(id); close() }, verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(t, fontSize = 17.sp, color = if (on) AccentText else Title, fontWeight = if (on) FontWeight.Medium else FontWeight.Normal)
                        Text(d, fontSize = 13.sp, color = Soft)
                    }
                    if (on) Text("◆", color = GoldC, fontSize = 18.sp)
                }
                HorizontalDivider(color = Line)
            }
            Text(t("Counted anonymously: only minutes per station, never who listened. Updated every night. Favourites keep your own order."),
                fontSize = 13.sp, color = Soft, lineHeight = 19.sp, modifier = Modifier.padding(top = 14.dp))
        }
    }
}

// ------------------------------------------------------------------ Alarm

/** Alarms: a list (workdays, weekend…), each opening its own page. [choices] are the stations to wake up to. */
@Composable
fun AlarmScreen(choices: List<Pair<Station, String>>, close: () -> Unit) {
    val ctx = LocalContext.current
    var list by remember { mutableStateOf(Alarm.all(ctx)) }
    var editing by remember { mutableStateOf<Alarm.Setup?>(null) }
    var isNew by remember { mutableStateOf(false) }
    var exact by remember { mutableStateOf(Alarm.canExact(ctx)) }
    val is24 = android.text.format.DateFormat.is24HourFormat(ctx)
    val life = androidx.compose.ui.platform.LocalLifecycleOwner.current
    DisposableEffect(life) {
        val o = androidx.lifecycle.LifecycleEventObserver { _, e -> if (e == androidx.lifecycle.Lifecycle.Event.ON_RESUME) { exact = Alarm.canExact(ctx); Alarm.schedule(ctx) } }
        life.lifecycle.addObserver(o); onDispose { life.lifecycle.removeObserver(o) }
    }
    fun refresh() { list = Alarm.all(ctx) }
    SubPage(t("Alarms"), close) {
        if (list.any { it.on } && !exact && Build.VERSION.SDK_INT >= 31) ExactNote(ctx)
        val up = Alarm.upcoming(java.util.Calendar.getInstance(), list)
        Text(if (up == null) t("No alarm on") else t("Next: ") + Alarm.whenLabel(java.util.Calendar.getInstance(), up.second, is24) +
            (up.first.name.takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""),
            fontSize = 14.sp, color = Soft, modifier = Modifier.padding(top = 6.dp, bottom = 6.dp))
        if (list.isEmpty()) Text(t("Wake up to your radio. Set one for workdays and another for the weekend."),
            fontSize = 15.sp, color = Title, lineHeight = 22.sp, modifier = Modifier.padding(vertical = 14.dp))
        list.forEach { a ->
            Column {
                Row(Modifier.fillMaxWidth().heightIn(min = 76.dp).clickable(onClickLabel = t("Edit the alarm")) { editing = a; isNew = false }
                    .padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(Alarm.timeLabel(a.hour, a.minute, is24), fontSize = 34.sp, fontWeight = FontWeight.Light, color = if (a.on) Title else Soft)
                        Text(listOf(a.name.takeIf { !it.equals(Alarm.daysLabel(a.days), true) } ?: "", Alarm.daysLabel(a.days), a.station?.optString("name")?.ifBlank { null } ?: "Last station played")
                            .filter { it.isNotBlank() }.joinToString(" · "), fontSize = 13.sp, color = Soft, maxLines = 2)
                    }
                    VelvetSwitch(a.on, "Alarm " + Alarm.timeLabel(a.hour, a.minute, is24) + " on") { Alarm.save(ctx, a.copy(on = it)); refresh() }
                }
                HorizontalDivider(color = Line)
            }
        }
        Box(Modifier.padding(top = 22.dp).fillMaxWidth().heightIn(min = 52.dp).border(1.dp, Title)
            .clickable(onClickLabel = t("Add an alarm")) { editing = Alarm.fresh(ctx); isNew = true }, contentAlignment = Alignment.Center) {
            Label(t("+  Add an alarm"), Title, 11) }
        Text(t("Each alarm plays even after the phone restarts. If its station doesn't answer, another one plays, and if none does, the phone's alarm sound rings, so you always wake up. Stop or snooze it from the notification."),
            fontSize = 13.sp, color = Soft, lineHeight = 19.sp, modifier = Modifier.padding(top = 16.dp))
    }
    editing?.let { e ->
        AlarmEdit(e, isNew, choices, close = { editing = null; refresh() })
    }
}

@Composable
private fun ExactNote(ctx: android.content.Context) {
    Column(Modifier.padding(top = 12.dp).fillMaxWidth().border(1.dp, GoldC).padding(14.dp)) {
        Text(t("To ring exactly on time, allow Radio Velvet to set alarms. Without it an alarm may be a few minutes late."),
            fontSize = 14.sp, color = Title, lineHeight = 20.sp)
        TextButton({ ctx.startActivity(Intent(AndroidSettings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
            android.net.Uri.parse("package:${ctx.packageName}"))) }, Modifier.heightIn(min = 48.dp)) { Text(t("Allow alarms"), color = AccentText) }
    }
}

/** One alarm's page. Nothing changes until "Save alarm"; ← leaves it as it was. */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AlarmEdit(start: Alarm.Setup, isNew: Boolean, choices: List<Pair<Station, String>>, close: () -> Unit) {
    val ctx = LocalContext.current
    var s by remember(start.id) { mutableStateOf(start) }
    var pickTime by remember { mutableStateOf(false) }
    var pickStation by remember { mutableStateOf(false) }
    var pickBackup by remember { mutableStateOf(false) }
    val is24 = android.text.format.DateFormat.is24HourFormat(ctx)
    Box(Modifier.fillMaxSize()) {
    // Save sits in the top bar, so it's there without scrolling (his note, 21 Nov 2026)
    SubPage(t(if (isNew) "New alarm" else "Alarm"), close, action = {
        Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(22.dp)).background(Title)
            .clickable(onClickLabel = t("Save alarm")) { Alarm.save(ctx, s.copy(on = true)); close() }
            .padding(horizontal = 22.dp), contentAlignment = Alignment.Center) { Label(t("Save"), Paper, 11) }
    }) {
        Text(Alarm.timeLabel(s.hour, s.minute, is24), Modifier.fillMaxWidth().padding(top = 10.dp)
            .clickable(onClickLabel = t("Change the time")) { pickTime = true }, fontSize = 64.sp, fontWeight = FontWeight.Light,
            color = Title, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Label(t("Tap the time to change it"), Soft, 9, Modifier.align(Alignment.CenterHorizontally))
        Field(t("Name (optional)"), s.name, t("e.g. Work, Weekend"), 30) { s = s.copy(name = it) }
        SectionHead(t("Repeat") + " · " + Alarm.daysLabel(s.days))
        val quick = listOf("Workdays" to Alarm.WORKDAYS, "Weekend" to Alarm.WEEKEND, "Every day" to Alarm.EVERY_DAY, "Once" to emptySet())
        Segmented(quick.map { t(it.first) }, quick.indexOfFirst { it.second == s.days }) { s = s.copy(days = quick[it].second) }
        val letters = when (Lang.code) { "ml" -> listOf("തി", "ചൊ", "ബു", "വ്യാ", "വെ", "ശ", "ഞാ"); "hi" -> listOf("सो", "मं", "बु", "गु", "शु", "श", "र")
            else -> listOf("M", "T", "W", "T", "F", "S", "S") }
        val order = listOf(Calendar.MONDAY, Calendar.TUESDAY, Calendar.WEDNESDAY, Calendar.THURSDAY, Calendar.FRIDAY, Calendar.SATURDAY,
            Calendar.SUNDAY).zip(letters)
        val full = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
        Row(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            order.forEachIndexed { i, (d, l) ->
                val on = d in s.days
                Box(Modifier.size(44.dp).clip(CircleShape).background(if (on) Title else Color.Transparent).border(1.dp, if (on) Title else Line, CircleShape)
                    .semantics { selected = on; contentDescription = full[i] }
                    .clickable { s = s.copy(days = if (on) s.days - d else s.days + d) }, contentAlignment = Alignment.Center) {
                    Text(l, fontSize = 14.sp, color = if (on) Paper else Title)
                }
            }
        }
        SectionHead(t("Wake up to"))
        val name = s.station?.optString("name")?.takeIf { it.isNotBlank() }
        SettingRow(name ?: "The last station I played", sub = s.station?.optString("lang")?.takeIf { it.isNotBlank() }, onClick = { pickStation = true })
        SectionHead(t("If it doesn't play"))
        SettingRow(backupLabel(s.backup), sub = t("The phone's alarm sound rings within 20 seconds if nothing plays"), onClick = { pickBackup = true })
        SectionHead(t("Fade in"))
        Segmented(listOf(t("Off"), t("30 s"), t("1 min"), t("2 min")), listOf(0, 30, 60, 120).indexOf(s.fadeSec).coerceAtLeast(0)) {
            s = s.copy(fadeSec = listOf(0, 30, 60, 120)[it]) }
        SectionHead(t("Volume") + " · ${s.volume}%")
        Slider(s.volume.toFloat(), { s = s.copy(volume = (it / 5).toInt() * 5) },
            valueRange = 20f..100f, colors = SliderDefaults.colors(thumbColor = Accent, activeTrackColor = Accent, inactiveTrackColor = Line))
        if (!isNew) Box(Modifier.padding(top = 22.dp).fillMaxWidth().heightIn(min = 52.dp)
            .clickable(onClickLabel = t("Delete alarm")) { Alarm.remove(ctx, s.id); close() }, contentAlignment = Alignment.Center) {
            Label(t("Delete alarm"), AccentText, 11) }
    }
    if (pickTime) {
        val st = rememberTimePickerState(s.hour, s.minute, is24Hour = is24)
        AlertDialog(onDismissRequest = { pickTime = false }, containerColor = Paper,
            confirmButton = { TextButton({ s = s.copy(hour = st.hour, minute = st.minute); pickTime = false }) { Text(t("Set"), color = AccentText) } },
            dismissButton = { TextButton({ pickTime = false }) { Text(t("Cancel"), color = Soft) } },
            text = { TimePicker(st, colors = TimePickerDefaults.colors(selectorColor = Accent, clockDialColor = Paper2,
                timeSelectorSelectedContainerColor = AccentSoft, periodSelectorSelectedContainerColor = AccentSoft)) })
    }
    if (pickStation) {
        SubPage(t("Wake up to"), { pickStation = false }) {
            SettingRow(t("The last station I played"), onClick = { s = s.copy(station = null); pickStation = false })
            if (choices.isEmpty()) Text(t("Add favourites (♡) to choose a station here."), fontSize = 14.sp, color = Soft, modifier = Modifier.padding(top = 12.dp))
            choices.forEach { (st, lang) ->
                SettingRow(st.name, sub = lang.ifBlank { null }, onClick = { s = s.copy(station = Alarm.stationJson(st, lang)); pickStation = false })
            }
        }
    }
    if (pickBackup) {
        SubPage(t("If it doesn't play"), { pickBackup = false }) {
            Text(t("First the station's other links are tried. Then:"), fontSize = 14.sp, color = Soft, modifier = Modifier.padding(top = 4.dp, bottom = 6.dp))
            SettingRow(t("A favourite that's working"), sub = t("Your favourites in order, then stations you played lately"),
                onClick = { s = s.copy(backup = "auto"); pickBackup = false })
            SettingRow(t("The phone's alarm sound"), sub = t("No other station"), onClick = { s = s.copy(backup = "tone"); pickBackup = false })
            if (choices.isNotEmpty()) SectionHead(t("Or this station"))
            choices.filter { it.first.key != s.station?.let { o -> o.optString("col") + ":" + o.optString("id") } }.forEach { (st, lang) ->
                SettingRow(st.name, sub = lang.ifBlank { null },
                    onClick = { s = s.copy(backup = Alarm.stationJson(st, lang).toString()); pickBackup = false })
            }
        }
    }
    }
}

private fun backupLabel(b: String) = when (b) {
    "auto" -> t("A favourite that's working")
    "tone" -> t("The phone's alarm sound")
    else -> runCatching { org.json.JSONObject(b).optString("name") }.getOrNull()?.ifBlank { null } ?: "A favourite that's working"
}

// ------------------------------------------------------------------ Request a station

@Composable
fun Field(label: String, value: String, hint: String, max: Int, onChange: (String) -> Unit) {
    Column(Modifier.padding(top = 18.dp)) {
        Label(label, Soft, 9, Modifier.padding(bottom = 4.dp))
        Box(Modifier.fillMaxWidth().heightIn(min = 48.dp).drawBehind {
            drawLine(GoldC, Offset(0f, size.height), Offset(size.width, size.height), 1.dp.toPx()) }, contentAlignment = Alignment.CenterStart) {
            if (value.isEmpty()) Text(hint, fontSize = 16.sp, color = Soft)
            BasicTextField(value, { onChange(it.take(max)) }, Modifier.fillMaxWidth().semantics { contentDescription = label },
                textStyle = TextStyle(fontSize = 16.sp, color = Title, fontFamily = Poppins), cursorBrush = SolidColor(AccentText))
        }
    }
}

@Composable
fun RequestScreen(close: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }; var place by remember { mutableStateOf("") }
    var link by remember { mutableStateOf("") }; var note by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }; var msg by remember { mutableStateOf<String?>(null) }; var sent by remember { mutableStateOf(false) }
    SubPage(t("Request a station"), close) {
        Text(t("Missing a station you love? Tell us and we'll try to add it."), fontSize = 15.sp, color = Title, lineHeight = 22.sp,
            modifier = Modifier.padding(top = 6.dp))
        Field("Station name", name, "e.g. Radio Macfast 90.4", 80) { name = it; sent = false }
        Field("City / country", place, "e.g. Changanassery, Kerala", 80) { place = it }
        Field("Link (if you know it)", link, "https://…", 300) { link = it }
        Field("Anything else", note, "e.g. it plays old film songs", 300) { note = it }
        Box(Modifier.padding(top = 26.dp).fillMaxWidth().heightIn(min = 52.dp).background(if (busy || sent) Soft else Title)
            .clickable(enabled = !busy && !sent, onClickLabel = t("Send the request")) {
                scope.launch { busy = true; msg = Requests.send(ctx, name, place, link, note); busy = false
                    if (msg == null) { sent = true; name = ""; place = ""; link = ""; note = "" } } },
            contentAlignment = Alignment.Center) { Label(if (busy) "Sending…" else if (sent) "Sent" else "Send request", Paper, 11) }
        Text(t("Only Ranjith reads requests. No name or email needed."), fontSize = 13.sp, color = Soft, modifier = Modifier.padding(top = 12.dp))
        if (sent) Row(Modifier.padding(top = 18.dp).fillMaxWidth().border(1.dp, Line).padding(14.dp)) {
            Text("◆ ", color = GoldC); Text(t("Thank you! Sent. New stations usually appear within a few days."), fontSize = 14.sp, color = Title, lineHeight = 20.sp) }
        msg?.let { Text(it, fontSize = 14.sp, color = AccentText, modifier = Modifier.padding(top = 14.dp)) }
    }
}

// ------------------------------------------------------------------ Comments

@Composable
fun CommentsScreen(stKey: String, stationName: String, close: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var list by remember { mutableStateOf<List<Comments.Comment>?>(null) }
    var failed by remember { mutableStateOf(false) }
    var sum by remember { mutableStateOf<Ratings.Summary?>(null) }
    var stars by remember { mutableIntStateOf(0) }
    var text by remember { mutableStateOf("") }
    var mine by remember { mutableStateOf<Comments.Mine?>(null) }
    var busy by remember { mutableStateOf(false) }; var msg by remember { mutableStateOf<String?>(null) }
    LaunchedEffect(stKey) {
        list = Comments.approved(stKey).also { failed = it == null } ?: emptyList()
        sum = Ratings.summary(stKey)
        mine = Comments.mine(ctx, stKey); mine?.let { stars = it.stars; text = it.text }
        if (stars == 0) stars = Ratings.mine(ctx, stKey) ?: 0
    }
    SubPage("$stationName · Comments", close) {
        Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.Bottom) {
            Text(sum?.avg?.let { String.format(java.util.Locale.UK, "%.1f", it) } ?: "–", fontSize = 34.sp, fontWeight = FontWeight.Light, color = Title)
            Text("  " + when { sum == null -> ""; sum!!.count == 0 -> "No ratings yet"; sum!!.avg == null -> "${sum!!.count} rating${if (sum!!.count == 1) "" else "s"} so far"
                else -> "${sum!!.count} ratings" }, fontSize = 13.sp, color = Soft, modifier = Modifier.padding(bottom = 8.dp))
        }
        SectionHead(t("What listeners say"))
        when {
            list == null -> Text(t("Loading…"), fontSize = 14.sp, color = Soft)
            failed -> Text(t("Couldn't load comments. Check the internet."), fontSize = 14.sp, color = Soft)
            list!!.isEmpty() -> Text(t("No comments yet. Be the first."), fontSize = 14.sp, color = Soft)
            else -> list!!.take(30).forEach { c ->
                Column(Modifier.fillMaxWidth().padding(vertical = 12.dp)) {
                    Row { Text("★".repeat(c.stars.coerceIn(0, 5)), color = GoldC, letterSpacing = 2.sp)
                        Text("★".repeat(5 - c.stars.coerceIn(0, 5)), color = Line, letterSpacing = 2.sp, modifier = Modifier.weight(1f))
                        if (c.at > 0) Text(Recent.whenLabel(c.at).replace("Just now", "Today"), fontSize = 12.sp, color = Soft) }
                    Text(c.text, fontSize = 15.sp, color = Title, lineHeight = 21.sp, modifier = Modifier.padding(top = 4.dp))
                }
                HorizontalDivider(color = Line)
            }
        }
        SectionHead(if (mine != null) "Your comment" else "Your rating")
        mine?.takeIf { it.status == "waiting" }?.let { Text(t("Waiting for a quick check before it appears."), fontSize = 13.sp, color = Soft) }
        Row {
            (1..5).forEach { n ->
                IconButton({ stars = n }, Modifier.size(48.dp)) {
                    LineIcon(if (stars >= n) R.drawable.ln_star_fill else R.drawable.ln_star, "$n star${if (n > 1) "s" else ""}", 26, GoldC) }
            }
        }
        Field("Say something about this station (optional)", text, "What do you like about it?", 300) { text = it }
        Text("${text.length} / 300", fontSize = 11.sp, color = Soft, modifier = Modifier.align(Alignment.End).padding(top = 4.dp))
        Box(Modifier.padding(top = 18.dp).fillMaxWidth().heightIn(min = 52.dp).background(if (busy || stars == 0) Soft else Title)
            .clickable(enabled = !busy && stars > 0, onClickLabel = t("Post")) {
                scope.launch { busy = true
                    msg = if (text.isBlank()) Ratings.rate(ctx, stKey, stars) ?: "Thanks for rating."
                        else Comments.post(ctx, stKey, stars, text) ?: "Thank you! It will appear after a quick check."
                    busy = false; mine = Comments.mine(ctx, stKey); sum = Ratings.summary(stKey) } },
            contentAlignment = Alignment.Center) { Label(if (busy) "Sending…" else if (text.isBlank()) "Rate" else "Post", Paper, 11) }
        msg?.let { Text(it, fontSize = 14.sp, color = AccentText, modifier = Modifier.padding(top = 12.dp)) }
        Text(t("Comments appear after a quick check. Please be kind; no phone numbers or links."), fontSize = 12.sp, color = Soft,
            modifier = Modifier.padding(top = 12.dp))
    }
}

// ------------------------------------------------------------------ Recently played

@Composable
fun RecentStrip(items: List<Recent.Item>, nowKey: String?, onPlay: (Recent.Item) -> Unit) {
    if (items.isEmpty()) return
    // wide, short screens (phone sideways, car stereos): one slim row of names, so the favourites below stay visible
    if (androidx.compose.ui.platform.LocalConfiguration.current.screenHeightDp < 480) {
        androidx.compose.foundation.lazy.LazyRow(Modifier.padding(top = 8.dp), contentPadding = PaddingValues(horizontal = Pad),
            horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            item { Label(t("Recently played"), Soft, 9) }
            items(items.size, key = { items[it].station.key }) { i ->
                val it0 = items[i]; val on = it0.station.key == nowKey
                Box(Modifier.heightIn(min = 44.dp).clip(RoundedCornerShape(22.dp)).background(if (on) AccentSoft else Paper2)
                    .clickable(onClickLabel = "Play ${it0.station.name}") { onPlay(it0) }.padding(horizontal = 14.dp),
                    contentAlignment = Alignment.Center) {
                    Text(it0.station.name, fontSize = 14.sp, color = if (on) AccentText else Title, maxLines = 1)
                }
            }
        }
        return
    }
    Column {
        Label(t("Recently played"), Soft, 10, Modifier.padding(start = Pad, top = 14.dp, bottom = 10.dp))
        androidx.compose.foundation.lazy.LazyRow(contentPadding = PaddingValues(horizontal = Pad), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            items(items.size, key = { items[it].station.key }) { i ->
                val it0 = items[i]; val on = it0.station.key == nowKey
                Column(Modifier.width(96.dp).clickable(onClickLabel = "Play ${it0.station.name}") { onPlay(it0) }) {
                    Box(Modifier.size(96.dp).background(Paper2).border(if (on) 1.dp else 0.dp, if (on) GoldC else Color.Transparent),
                        contentAlignment = Alignment.Center) {
                        Icon(androidx.compose.ui.res.painterResource(R.drawable.ic_logo_mark), null, Modifier.size(40.dp), tint = if (on) AccentText else Title)
                    }
                    Text(it0.station.name, fontSize = 13.sp, color = Title, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
                    Text(if (on) "Now" else Recent.whenLabel(it0.at), fontSize = 11.sp, color = Soft, maxLines = 1)
                }
            }
        }
    }
}
