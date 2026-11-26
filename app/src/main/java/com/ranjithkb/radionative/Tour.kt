package com.ranjithkb.radionative

import android.content.Context
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.*
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * A first-time look around the whole app: 8 short steps, each lighting up one part of the screen.
 * Shown once, on a fresh install (not to people updating); skip it at any step; replay it from Info → Quick tour.
 */
object Tour {
    data class Step(val target: String?, val title: String, val text: String)

    val STEPS = listOf(
        Step(null, "Welcome to Radio Velvet", "Free radio from Kerala and around the world. Shall I show you around? It takes half a minute."),
        Step("star", "Velvet Selection", "The star is the Velvet Selection: stations hand-picked from every language. Hold it to see its name."),
        Step("langs", "Languages", "Your languages sit in this row. ALL LANGUAGES opens the full list of 70+; hold a language to pin it."),
        Step("sort", "Sort", "⇅ sorts the stations: A–Z, the list's own order, most heard, or top rated."),
        Step("row", "Play and keep", "Tap a station to play it. Tap ♡ to keep it in your Favourites."),
        Step("header", "Search and Settings", "Search every station by name, or say it. ⚙ Settings has the app language, colour themes, text size, data saver, the equaliser and alarms."),
        Step("player", "The player", "Play and pause here. Tap the bar for the big player: swipe its cover to change the player look, from a 1930s radio to a 1990s tuner."),
        Step("nav", "Stations, Favourites, Info", "Favourites keeps your stations in your own order, as a list or as tiles. Info has what's new, sharing, and this tour again."),
    )
    val COUNT = STEPS.size

    /** Where each part of the screen is, filled in as the screen is drawn. */
    val targets = mutableStateMapOf<String, Rect>()

    /** Raise this when the tour has something new worth showing to everyone once more (2 = 2.9: language, data saver, tiles). */
    const val VERSION = 2
    private fun p(ctx: Context) = ctx.getSharedPreferences("tour", Context.MODE_PRIVATE)
    fun done(ctx: Context) = p(ctx).edit().putBoolean("done", true).putInt("seen", VERSION).apply()

    /** Once on a fresh install, and once more for everyone when [VERSION] goes up (his wish, 21 Nov 2026). */
    fun shouldShow(ctx: Context): Boolean = p(ctx).getInt("seen", 0) < VERSION
}

fun Modifier.tourTarget(id: String) = onGloballyPositioned { c ->
    val r = c.boundsInRoot()
    if (r.width > 0 && r.height > 0) Tour.targets[id] = r else Tour.targets.remove(id)
}

/** The tour over the app: the screen dimmed except the part being explained, and a card saying what it is. */
@Composable
fun TourOverlay(step: Int, onStep: (Int) -> Unit, onEnd: () -> Unit) {
    val s = Tour.STEPS.getOrNull(step) ?: run { onEnd(); return }
    val hole = s.target?.let { Tour.targets[it] }
    val density = LocalDensity.current
    val pad = with(density) { 6.dp.toPx() }
    val glow by animateFloatAsState(if (hole != null) 1f else 0f, label = "tour")
    var box by remember { mutableStateOf(Size.Zero) }
    var card by remember { mutableIntStateOf(0) }
    androidx.activity.compose.BackHandler { onEnd() }
    Box(Modifier.fillMaxSize().onSizeChanged { box = Size(it.width.toFloat(), it.height.toFloat()) }
        .semantics { paneTitle = "Quick tour" }
        .pointerInput(step) { detectTapGestures { } }) {       // the app underneath doesn't take taps during the tour
        val ink = Color(0xFF1C1218)
        Canvas(Modifier.fillMaxSize()) {
            // the dim layer with a hole cut out (even-odd fill), so the lit part shows exactly as it is
            val dim = androidx.compose.ui.graphics.Path().apply {
                fillType = androidx.compose.ui.graphics.PathFillType.EvenOdd
                addRect(Rect(Offset.Zero, size))
                if (hole != null) addRoundRect(androidx.compose.ui.geometry.RoundRect(
                    Rect(hole.left - pad, hole.top - pad, hole.right + pad, hole.bottom + pad), CornerRadius(pad * 2)))
            }
            drawPath(dim, ink.copy(alpha = 0.72f))
            if (hole != null) {
                val r = Rect(hole.left - pad, hole.top - pad, hole.right + pad, hole.bottom + pad)
                drawRoundRect(GoldC.copy(alpha = glow), r.topLeft, r.size, CornerRadius(pad * 2), style = Stroke(with(density) { 2.dp.toPx() }))
            }
        }
        // the card goes below the lit part when it's in the top half, above it otherwise; centred when there's nothing to light
        val gap = with(density) { 16.dp.roundToPx() }
        val y = when {
            hole == null || box.height == 0f -> ((box.height - card) / 2).toInt()
            hole.center.y < box.height / 2 -> (hole.bottom + pad).toInt() + gap
            else -> (hole.top - pad).toInt() - gap - card
        }.coerceIn(gap, (box.height.toInt() - card - gap).coerceAtLeast(gap))
        Column(Modifier.offset { IntOffset(0, y) }.padding(horizontal = 20.dp).fillMaxWidth()
            .onSizeChanged { card = it.height }
            .clip(RoundedCornerShape(14.dp)).background(Paper).border(1.dp, GoldC, RoundedCornerShape(14.dp)).padding(20.dp)
            .semantics(mergeDescendants = false) { liveRegion = LiveRegionMode.Polite }) {
            if (step > 0) Row(Modifier.padding(bottom = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                (1 until Tour.COUNT).forEach { i ->
                    Box(Modifier.size(if (i == step) 18.dp else 6.dp, 6.dp).clip(CircleShape).background(if (i <= step) GoldC else Line)) }
                Spacer(Modifier.weight(1f))
                Label("$step of ${Tour.COUNT - 1}", Soft, 9)
            }
            Text(t(s.title), fontSize = 19.sp, fontWeight = FontWeight.Medium, color = Title, modifier = Modifier.semantics { heading() })
            Text(t(s.text), fontSize = 15.sp, lineHeight = 22.sp, color = InkSoft, modifier = Modifier.padding(top = 6.dp))
            Row(Modifier.padding(top = 16.dp).fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.heightIn(min = 48.dp).clickable(onClickLabel = if (step == 0) "No thanks" else "Skip the tour") { onEnd() }
                    .padding(horizontal = 6.dp), contentAlignment = Alignment.Center) {
                    Label(t(if (step == 0) "No thanks" else "Skip"), Soft, 11) }
                Spacer(Modifier.weight(1f))
                if (step > 1) Box(Modifier.heightIn(min = 48.dp).clickable(onClickLabel = t("Back")) { onStep(step - 1) }
                    .padding(horizontal = 14.dp), contentAlignment = Alignment.Center) { Label(t("Back"), AccentText, 11) }
                val last = step == Tour.COUNT - 1
                val label = when { step == 0 -> "Show me"; last -> "Done"; else -> "Next" }
                Box(Modifier.heightIn(min = 48.dp).widthIn(min = 96.dp).clip(RoundedCornerShape(24.dp)).background(Title)
                    .clickable(onClickLabel = label) { if (last) onEnd() else onStep(step + 1) }.padding(horizontal = 20.dp),
                    contentAlignment = Alignment.Center) { Label(t(label), Paper, 11) }
            }
        }
    }
}
