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
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
private val Manjari = FontFamily.Default   // the phone's Malayalam font (Manjari isn't bundled; names stay readable everywhere)

/** A full page drawn over the app (not a separate window), with ← and a spaced-capitals title. */
@Composable
fun SubPage(title: String, close: () -> Unit, scroll: Boolean = true, body: @Composable ColumnScope.() -> Unit) {
    BackHandler(onBack = close)
    Column(Modifier.fillMaxSize().background(Paper).pointerInput(Unit) { detectTapGestures { } }
        .statusBarsPadding().navigationBarsPadding().imePadding()) {
        Row(Modifier.padding(start = 10.dp, end = 20.dp, top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(close, Modifier.size(52.dp)) { LineIcon(R.drawable.ln_back, "Back", 24) }
            Label(title, Title, 13, weight = FontWeight.Medium)
        }
        Column((if (scroll) Modifier.verticalScroll(rememberScrollState()) else Modifier).fillMaxWidth()
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
                    Box(Modifier.width((if (playing) 34 else 30) * u.dp).height((2.5f * u).dp).background(if (playing) p.accentText else p.ink))
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
fun SettingsScreen(close: () -> Unit, open: (String) -> Unit) {
    val ctx = LocalContext.current
    fun save() = Theme.save(ctx)
    SubPage("Settings", close) {
        SectionHead("Appearance")
        Segmented(listOf("Phone", "Light", "Dark"), listOf("phone", "light", "dark").indexOf(Theme.mode)) {
            Theme.mode = listOf("phone", "light", "dark")[it]; save() }
        Text("Phone = follow the phone's light / dark setting.", fontSize = 12.sp, color = Soft, modifier = Modifier.padding(top = 6.dp))
        // every theme as a little screen, side by side: swipe and tap
        androidx.compose.foundation.lazy.LazyRow(Modifier.fillMaxWidth().padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp),
            state = androidx.compose.foundation.lazy.rememberLazyListState(THEMES.indexOfFirst { it.id == Theme.themeId }.coerceAtLeast(0))) {
            items(THEMES.size) { i -> ThemeChoice(THEMES[i], 76) { Theme.themeId = THEMES[i].id; save() } }
        }
        TextButton({ open("themes") }, Modifier.align(Alignment.End).heightIn(min = 48.dp)) {
            Text("All ${THEMES.size} colour themes ›", color = AccentText) }

        SectionHead("Text size")
        Segmented(listOf("Normal", "Large", "Extra large"), Theme.text) { Theme.text = it; save() }
        SectionHead("Font")
        Segmented(listOf("Jost", "Classic serif", "Phone font"), listOf("jost", "serif", "phone").indexOf(Theme.font)) {
            Theme.font = listOf("jost", "serif", "phone")[it]; save() }
        SectionHead("Station list")
        Segmented(listOf("Compact", "Comfortable", "Spacious"), Theme.spacing) { Theme.spacing = it; save() }

        SectionHead("Sound")
        SettingRow("Equaliser", value = if (Eq.on(ctx)) Eq.preset(ctx) else "Off", onClick = { open("eq") })
        SettingRow("Visualiser in the big player", sub = "Moving bars, waves or a circle with the music",
            value = Theme.viz.replaceFirstChar { it.uppercase() }, onClick = { open("viz") })
        SettingRow("Resume after other apps", sub = "After a video in Facebook, WhatsApp… within 10 minutes. Never during calls.",
            trailing = { VelvetSwitch(Theme.resume, "Resume after other apps") { Theme.resume = it; save() } })

        SectionHead("More")
        val a = remember { Alarm.load(ctx) }
        SettingRow("Alarm", value = if (a.on) "%02d:%02d · %s".format(a.hour, a.minute, Alarm.daysLabel(a.days)) else "Off", onClick = { open("alarm") })
        SettingRow("Request a station", sub = "Missing a station? Tell us", onClick = { open("request") })
        SettingRow("Reset to the original look", onClick = {
            Theme.themeId = "velvet"; Theme.mode = "phone"; Theme.text = 0; Theme.font = "jost"; Theme.spacing = 0; Theme.viz = "off"; save() })
    }
}

@Composable
fun ThemesScreen(close: () -> Unit) {
    val ctx = LocalContext.current
    SubPage("Colour theme", close) {
        Text("Each theme has a light and a dark version; Settings → Appearance chooses which.", fontSize = 13.sp, color = Soft,
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
    SubPage("Equaliser", close) {
        SettingRow("Equaliser on", trailing = { VelvetSwitch(on, "Equaliser on") { on = it; save() } })
        SectionHead("Presets")
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
        SectionHead("Fine-tune")
        Row(Modifier.fillMaxWidth().padding(top = 6.dp).then(if (on) Modifier else Modifier.background(Color.Transparent))) {
            listOf("60 Hz", "230 Hz", "910 Hz", "3.6 kHz", "14 kHz").forEachIndexed { i, f ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("%+d".format(bands[i]), fontSize = 13.sp, color = Soft)
                    VSlider(bands[i], f, enabled = on) { v -> bands = bands.toMutableList().also { it[i] = v }; preset = "Custom"; save() }
                    Label(f, Soft, 8)
                }
            }
        }
        Text("Works on the phone speaker, headphones, Bluetooth and in the car. Turned off while casting to a TV or speaker. " +
            "Not on the website: browsers can't change other sites' sound.", fontSize = 13.sp, color = Soft, lineHeight = 19.sp,
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
    SubPage("Visualiser", close) {
        Text("Moves with the music in the big player, in your theme's colours. Uses only the radio's own sound: " +
            "no microphone. Off saves a little battery.", fontSize = 14.sp, color = Soft, lineHeight = 20.sp, modifier = Modifier.padding(top = 4.dp))
        SectionHead("Style")
        Segmented(listOf("Bars", "Waves", "Circle", "Off"), VIZ_STYLES.indexOf(Theme.viz)) { Theme.viz = VIZ_STYLES[it]; Theme.save(ctx) }
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
    Canvas(modifier.semantics { contentDescription = "Visualiser" }) {
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
    Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        VIZ_STYLES.forEach { s ->
            val on = s == Theme.viz
            Box(Modifier.heightIn(min = 44.dp).semantics { selected = on }.clickable(onClickLabel = "Visualiser: $s") { Theme.viz = s; Theme.save(ctx) }
                .padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
                Label(s, if (on) AccentText else Soft, 9, weight = if (on) FontWeight.SemiBold else FontWeight.Medium,
                    modifier = Modifier.drawBehind { if (on) drawLine(AccentText, Offset(0f, size.height + 3.dp.toPx()), Offset(size.width, size.height + 3.dp.toPx()), 1.dp.toPx()) })
            }
        }
    }
}

// ------------------------------------------------------------------ Sort

val SORTS = listOf("usual" to "Usual order", "az" to "A–Z", "heard" to "Most heard", "rated" to "Top rated")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SortSheet(current: String, onPick: (String) -> Unit, close: () -> Unit) {
    ModalBottomSheet(onDismissRequest = close, containerColor = Paper, scrimColor = Color.Black.copy(alpha = 0.35f),
        dragHandle = { Box(Modifier.padding(top = 12.dp, bottom = 8.dp).size(36.dp, 3.dp).background(Line)) }) {
        Column(Modifier.padding(start = Pad, end = Pad, bottom = 24.dp)) {
            Label("Sort stations", Soft, 10, Modifier.padding(bottom = 6.dp))
            listOf("Usual order" to "As the stations are listed", "A–Z" to "By name",
                "Most heard" to "Hours listened this week, by everyone", "Top rated" to "Average stars, from 3 ratings up").forEachIndexed { i, (t, d) ->
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
            Text("Counted anonymously: only minutes per station, never who listened. Updated every night. Favourites keep your own order.",
                fontSize = 13.sp, color = Soft, lineHeight = 19.sp, modifier = Modifier.padding(top = 14.dp))
        }
    }
}

// ------------------------------------------------------------------ Alarm

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AlarmScreen(choices: List<Pair<Station, String>>, close: () -> Unit) {
    val ctx = LocalContext.current
    var s by remember { mutableStateOf(Alarm.load(ctx)) }
    var pickTime by remember { mutableStateOf(false) }
    var pickStation by remember { mutableStateOf(false) }
    var exact by remember { mutableStateOf(Alarm.canExact(ctx)) }
    val life = androidx.compose.ui.platform.LocalLifecycleOwner.current
    DisposableEffect(life) {
        val o = androidx.lifecycle.LifecycleEventObserver { _, e -> if (e == androidx.lifecycle.Lifecycle.Event.ON_RESUME) { exact = Alarm.canExact(ctx); Alarm.schedule(ctx) } }
        life.lifecycle.addObserver(o); onDispose { life.lifecycle.removeObserver(o) }
    }
    fun save(n: Alarm.Setup) { s = n; Alarm.save(ctx, n) }
    SubPage("Alarm", close) {
        SettingRow("Alarm on", trailing = { VelvetSwitch(s.on, "Alarm on") { save(s.copy(on = it)) } })
        if (s.on && !exact && Build.VERSION.SDK_INT >= 31) {
            Column(Modifier.padding(top = 12.dp).fillMaxWidth().border(1.dp, GoldC).padding(14.dp)) {
                Text("To ring exactly on time, allow Radio Velvet to set alarms. Without it the alarm may be a few minutes late.",
                    fontSize = 14.sp, color = Title, lineHeight = 20.sp)
                TextButton({ ctx.startActivity(Intent(AndroidSettings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
                    android.net.Uri.parse("package:${ctx.packageName}"))) }, Modifier.heightIn(min = 48.dp)) { Text("Allow alarms", color = AccentText) }
            }
        }
        Text("%02d:%02d".format(s.hour, s.minute), Modifier.fillMaxWidth().padding(top = 18.dp)
            .clickable(onClickLabel = "Change the time") { pickTime = true }, fontSize = 72.sp, fontWeight = FontWeight.Light,
            color = Title, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        Label("Tap the time to change it", Soft, 9, Modifier.align(Alignment.CenterHorizontally))
        SectionHead("Repeat · " + Alarm.daysLabel(s.days))
        val order = listOf(Calendar.MONDAY to "M", Calendar.TUESDAY to "T", Calendar.WEDNESDAY to "W", Calendar.THURSDAY to "T",
            Calendar.FRIDAY to "F", Calendar.SATURDAY to "S", Calendar.SUNDAY to "S")
        val full = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            order.forEachIndexed { i, (d, l) ->
                val on = d in s.days
                Box(Modifier.size(44.dp).clip(CircleShape).background(if (on) Title else Color.Transparent).border(1.dp, if (on) Title else Line, CircleShape)
                    .semantics { selected = on; contentDescription = full[i] }
                    .clickable { save(s.copy(days = if (on) s.days - d else s.days + d)) }, contentAlignment = Alignment.Center) {
                    Text(l, fontSize = 14.sp, color = if (on) Paper else Title)
                }
            }
        }
        SectionHead("Wake up to")
        val name = s.station?.optString("name")?.takeIf { it.isNotBlank() }
        SettingRow(name ?: "The last station I played", sub = s.station?.optString("lang")?.takeIf { it.isNotBlank() }, onClick = { pickStation = true })
        SectionHead("Fade in")
        Segmented(listOf("Off", "30 s", "1 min", "2 min"), listOf(0, 30, 60, 120).indexOf(s.fadeSec).coerceAtLeast(0)) {
            save(s.copy(fadeSec = listOf(0, 30, 60, 120)[it])) }
        SectionHead("Volume · ${s.volume}%")
        Slider(s.volume.toFloat(), { s = s.copy(volume = (it / 5).toInt() * 5) }, onValueChangeFinished = { save(s) },
            valueRange = 20f..100f, colors = SliderDefaults.colors(thumbColor = Accent, activeTrackColor = Accent, inactiveTrackColor = Line))
        Text("Plays even after the phone restarts. If the station doesn't answer, the phone's alarm tone rings instead, so you still wake up. " +
            "Pause it from the notification or the app.", fontSize = 13.sp, color = Soft, lineHeight = 19.sp, modifier = Modifier.padding(top = 16.dp))
    }
    if (pickTime) {
        val st = rememberTimePickerState(s.hour, s.minute, is24Hour = android.text.format.DateFormat.is24HourFormat(ctx))
        AlertDialog(onDismissRequest = { pickTime = false }, containerColor = Paper,
            confirmButton = { TextButton({ save(s.copy(hour = st.hour, minute = st.minute, on = true)); pickTime = false }) { Text("Set", color = AccentText) } },
            dismissButton = { TextButton({ pickTime = false }) { Text("Cancel", color = Soft) } },
            text = { TimePicker(st, colors = TimePickerDefaults.colors(selectorColor = Accent, clockDialColor = Paper2,
                timeSelectorSelectedContainerColor = AccentSoft, periodSelectorSelectedContainerColor = AccentSoft)) })
    }
    if (pickStation) {
        Box(Modifier.fillMaxSize()) {
            SubPage("Wake up to", { pickStation = false }) {
                SettingRow("The last station I played", onClick = { save(s.copy(station = null)); pickStation = false })
                if (choices.isEmpty()) Text("Add favourites (♡) to choose a station here.", fontSize = 14.sp, color = Soft, modifier = Modifier.padding(top = 12.dp))
                choices.forEach { (st, lang) ->
                    SettingRow(st.name, sub = lang.ifBlank { null }, onClick = { save(s.copy(station = Alarm.stationJson(st, lang))); pickStation = false })
                }
            }
        }
    }
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
    SubPage("Request a station", close) {
        Text("Missing a station you love? Tell us and we'll try to add it.", fontSize = 15.sp, color = Title, lineHeight = 22.sp,
            modifier = Modifier.padding(top = 6.dp))
        Field("Station name", name, "e.g. Radio Macfast 90.4", 80) { name = it; sent = false }
        Field("City / country", place, "e.g. Changanassery, Kerala", 80) { place = it }
        Field("Link (if you know it)", link, "https://…", 300) { link = it }
        Field("Anything else", note, "e.g. it plays old film songs", 300) { note = it }
        Box(Modifier.padding(top = 26.dp).fillMaxWidth().heightIn(min = 52.dp).background(if (busy || sent) Soft else Title)
            .clickable(enabled = !busy && !sent, onClickLabel = "Send the request") {
                scope.launch { busy = true; msg = Requests.send(ctx, name, place, link, note); busy = false
                    if (msg == null) { sent = true; name = ""; place = ""; link = ""; note = "" } } },
            contentAlignment = Alignment.Center) { Label(if (busy) "Sending…" else if (sent) "Sent" else "Send request", Paper, 11) }
        Text("Only Ranjith reads requests. No name or email needed.", fontSize = 13.sp, color = Soft, modifier = Modifier.padding(top = 12.dp))
        if (sent) Row(Modifier.padding(top = 18.dp).fillMaxWidth().border(1.dp, Line).padding(14.dp)) {
            Text("◆ ", color = GoldC); Text("Thank you! Sent. New stations usually appear within a few days.", fontSize = 14.sp, color = Title, lineHeight = 20.sp) }
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
        SectionHead("What listeners say")
        when {
            list == null -> Text("Loading…", fontSize = 14.sp, color = Soft)
            failed -> Text("Couldn't load comments. Check the internet.", fontSize = 14.sp, color = Soft)
            list!!.isEmpty() -> Text("No comments yet. Be the first.", fontSize = 14.sp, color = Soft)
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
        mine?.takeIf { it.status == "waiting" }?.let { Text("Waiting for a quick check before it appears.", fontSize = 13.sp, color = Soft) }
        Row {
            (1..5).forEach { n ->
                IconButton({ stars = n }, Modifier.size(48.dp)) {
                    LineIcon(if (stars >= n) R.drawable.ln_star_fill else R.drawable.ln_star, "$n star${if (n > 1) "s" else ""}", 26, GoldC) }
            }
        }
        Field("Say something about this station (optional)", text, "What do you like about it?", 300) { text = it }
        Text("${text.length} / 300", fontSize = 11.sp, color = Soft, modifier = Modifier.align(Alignment.End).padding(top = 4.dp))
        Box(Modifier.padding(top = 18.dp).fillMaxWidth().heightIn(min = 52.dp).background(if (busy || stars == 0) Soft else Title)
            .clickable(enabled = !busy && stars > 0, onClickLabel = "Post") {
                scope.launch { busy = true
                    msg = if (text.isBlank()) Ratings.rate(ctx, stKey, stars) ?: "Thanks for rating."
                        else Comments.post(ctx, stKey, stars, text) ?: "Thank you! It will appear after a quick check."
                    busy = false; mine = Comments.mine(ctx, stKey); sum = Ratings.summary(stKey) } },
            contentAlignment = Alignment.Center) { Label(if (busy) "Sending…" else if (text.isBlank()) "Rate" else "Post", Paper, 11) }
        msg?.let { Text(it, fontSize = 14.sp, color = AccentText, modifier = Modifier.padding(top = 12.dp)) }
        Text("Comments appear after a quick check. Please be kind; no phone numbers or links.", fontSize = 12.sp, color = Soft,
            modifier = Modifier.padding(top = 12.dp))
    }
}

// ------------------------------------------------------------------ Recently played

@Composable
fun RecentStrip(items: List<Recent.Item>, nowKey: String?, onPlay: (Recent.Item) -> Unit) {
    if (items.isEmpty()) return
    Column {
        Label("Recently played", Soft, 10, Modifier.padding(start = Pad, top = 14.dp, bottom = 10.dp))
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
