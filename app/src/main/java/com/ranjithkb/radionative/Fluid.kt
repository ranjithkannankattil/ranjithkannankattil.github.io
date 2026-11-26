package com.ranjithkb.radionative

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/*
 * 2.10's "one look per kind of item" (agreed with Ranjith, 22 Nov 2026), used the same way on every screen:
 *   opens a page  = a row in a card: icon tile, title, its current choice in grey, ›
 *   on / off      = the same row with a switch; the whole row toggles it
 *   pick one      = a pill of two or three choices inside the card; the chosen one glides
 *   do it now     = a filled accent button (one per screen at most)
 *   information   = small grey text, no card, no icon
 * Colours always come from the chosen colour theme, light or dark.
 */

/** The raised surface of a card: a little lighter than the page in light themes, a touch lighter in dark ones. */
internal val CardBg: Color get() = if (Paper.luminance() > 0.5f) lerp(Paper, Color.White, 0.65f) else lerp(Paper, Color.White, 0.07f)
internal val TileBg: Color get() = AccentSoft

/** Group heading over a card: small gold-ish capitals. */
@Composable
fun GroupHead(text: String, modifier: Modifier = Modifier) =
    Label(text, GoldC, 10, modifier.padding(start = 6.dp, top = 22.dp, bottom = 8.dp), weight = FontWeight.SemiBold)

/** A card holding rows; rows are separated by hairlines. */
@Composable
fun Group(title: String? = null, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    Column(modifier.fillMaxWidth()) {
        if (title != null) GroupHead(title)
        Column(Modifier.fillMaxWidth().shadow(3.dp, RoundedCornerShape(18.dp), ambientColor = Accent.copy(alpha = 0.25f),
            spotColor = Accent.copy(alpha = 0.18f)).clip(RoundedCornerShape(18.dp)).background(CardBg), content = content)
    }
}

/** Thin line between two rows of a card. */
@Composable
fun RowLine() = Box(Modifier.fillMaxWidth().padding(start = 70.dp).height(1.dp).background(Line.copy(alpha = 0.6f)))

/** Square icon tile at the start of a row. */
@Composable
fun IconTile(icon: ImageVector?, drawable: Int? = null) {
    Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(TileBg), contentAlignment = Alignment.Center) {
        if (icon != null) Icon(icon, null, Modifier.size(22.dp), tint = AccentText)
        else if (drawable != null) LineIcon(drawable, null, 22, AccentText)
    }
}

/** A row that lifts a little under the finger. */
@Composable
private fun pressedScale(src: MutableInteractionSource): Float {
    val pressed by src.collectIsPressedAsState()
    return animateFloatAsState(if (pressed) 0.985f else 1f, spring(stiffness = 900f), label = "press").value
}

@Composable
private fun RowBody(icon: ImageVector?, drawable: Int?, title: String, sub: String?, trailing: @Composable RowScope.() -> Unit) {
    if (icon != null || drawable != null) { IconTile(icon, drawable); Spacer(Modifier.width(14.dp)) }
    Column(Modifier.weight(1f).padding(vertical = 4.dp)) {
        Text(title, fontSize = 16.5.sp, fontWeight = FontWeight.Medium, color = Title, lineHeight = 21.sp)
        if (!sub.isNullOrBlank()) Text(sub, fontSize = 14.sp, color = Soft, lineHeight = 19.sp, modifier = Modifier.padding(top = 1.dp))
    }
    trailing()
}

/** Opens a page: icon, title, current value in grey, ›. */
@Composable
fun NavItem(title: String, value: String? = null, icon: ImageVector? = null, drawable: Int? = null, sub: String? = null, onClick: () -> Unit) {
    val src = remember { MutableInteractionSource() }
    Row(Modifier.fillMaxWidth().scale(pressedScale(src)).heightIn(min = 64.dp)
        .clickable(src, androidx.compose.material3.ripple(), onClickLabel = title, onClick = onClick)
        .padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        RowBody(icon, drawable, title, if (value != null && sub == null) value else sub) {
            if (value != null && sub != null) Text(value, fontSize = 14.sp, color = Soft, modifier = Modifier.padding(start = 8.dp), maxLines = 1)
            Text("›", fontSize = 22.sp, color = Soft, modifier = Modifier.padding(start = 10.dp))
        }
    }
}

/** On / off: the whole row toggles the switch. */
@Composable
fun ToggleItem(title: String, on: Boolean, icon: ImageVector? = null, drawable: Int? = null, sub: String? = null, onChange: (Boolean) -> Unit) {
    val src = remember { MutableInteractionSource() }
    Row(Modifier.fillMaxWidth().scale(pressedScale(src)).heightIn(min = 64.dp)
        .clickable(src, androidx.compose.material3.ripple(), role = Role.Switch, onClickLabel = title) { onChange(!on) }
        .semantics { stateDescription = if (on) "On" else "Off" }
        .padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        RowBody(icon, drawable, title, sub) { Spacer(Modifier.width(10.dp)); FluidSwitch(on) }
    }
}

/** A switch whose knob springs across. Drawn only: the row it sits in does the toggling. */
@Composable
fun FluidSwitch(on: Boolean) {
    val x by animateDpAsState(if (on) 23.dp else 3.dp, spring(dampingRatio = 0.62f, stiffness = 520f), label = "knob")
    val track by animateColorAsState(if (on) Accent else Line, label = "track")
    Box(Modifier.size(52.dp, 32.dp).clip(CircleShape).background(track)) {
        Box(Modifier.offset(x = x, y = 3.dp).size(26.dp).clip(CircleShape).background(Color.White))
    }
}

/** Pick one of a few: a soft pill in the card; the chosen choice glides to its place. */
@Composable
fun PickItem(title: String?, options: List<String>, selected: Int, icon: ImageVector? = null, drawable: Int? = null, onSelect: (Int) -> Unit) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp)) {
        if (title != null) Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(bottom = 12.dp)) {
            if (icon != null || drawable != null) { IconTile(icon, drawable); Spacer(Modifier.width(14.dp)) }
            Text(title, fontSize = 16.5.sp, fontWeight = FontWeight.Medium, color = Title)
        }
        Pill(options, selected, onSelect)
    }
}

@Composable
fun Pill(options: List<String>, selected: Int, onSelect: (Int) -> Unit) {
    BoxWithConstraints(Modifier.fillMaxWidth().clip(RoundedCornerShape(13.dp)).background(lerp(Paper, Line, 0.35f)).padding(4.dp)) {
        val w = maxWidth / options.size.coerceAtLeast(1)
        val x by animateDpAsState(w * selected.coerceAtLeast(0), spring(dampingRatio = 0.8f, stiffness = 420f), label = "pill")
        Box(Modifier.offset(x = x).width(w).heightIn(min = 42.dp).height(42.dp).shadow(2.dp, RoundedCornerShape(10.dp))
            .clip(RoundedCornerShape(10.dp)).background(CardBg))
        Row(Modifier.fillMaxWidth()) {
            options.forEachIndexed { i, o ->
                val on = i == selected
                Box(Modifier.weight(1f).height(42.dp).clip(RoundedCornerShape(10.dp))
                    .semantics { role = Role.RadioButton; this.selected = on }
                    .clickable(onClickLabel = o) { onSelect(i) }, contentAlignment = Alignment.Center) {
                    Text(o, fontSize = (if (Theme.text >= 2) 13 else 15).sp, fontWeight = if (on) FontWeight.Medium else FontWeight.Normal,
                        color = if (on) AccentText else InkSoft, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 4.dp))
                }
            }
        }
    }
}

/** Do it now: a filled accent button. */
@Composable
fun ActionButton(text: String, icon: ImageVector? = null, modifier: Modifier = Modifier, enabled: Boolean = true, onClick: () -> Unit) {
    val src = remember { MutableInteractionSource() }
    Row(modifier.fillMaxWidth().scale(pressedScale(src)).heightIn(min = 56.dp).clip(CircleShape)
        .background(if (enabled) Accent else Soft).clickable(src, androidx.compose.material3.ripple(), enabled = enabled, onClickLabel = text, onClick = onClick)
        .padding(horizontal = 20.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
        if (icon != null) { Icon(icon, null, tint = Color.White, modifier = Modifier.size(20.dp)); Spacer(Modifier.width(10.dp)) }
        Text(text, color = Color.White, fontSize = 16.5.sp, fontWeight = FontWeight.Medium)
    }
}

/** Just information: small grey text, clearly not something to tap. */
@Composable
fun InfoText(text: String, modifier: Modifier = Modifier) =
    Text(text, modifier.padding(start = 8.dp, end = 8.dp, top = 8.dp), fontSize = 13.5.sp, lineHeight = 19.sp, color = Soft)
