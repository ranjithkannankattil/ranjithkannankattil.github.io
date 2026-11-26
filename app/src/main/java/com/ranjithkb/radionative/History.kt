package com.ranjithkb.radionative

import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas as DrawCanvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Your listening (2.10): how long you've listened, day by day and month by month, your top stations and languages.
 * Kept on the phone from 2.10 on (earlier time only counts in the totals), and with the account when signed in,
 * so the numbers add up across phones. Nothing here is shared with anyone unless you share the picture.
 *   days   yyyy-MM-dd → ms (last 400 days)
 *   months yyyy-MM → ms (always)
 *   sd     yyyy-MM-dd → { station key → ms } (last 62 days, 15 biggest per day)
 *   sm     yyyy-MM → { station key → ms } (25 biggest per month)
 */
object History {
    private fun p(ctx: Context) = ctx.getSharedPreferences("history", Context.MODE_PRIVATE)
    private val DAY = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    fun dayKey(c: Calendar) = DAY.format(c.time)
    fun monthKey(c: Calendar) = "%04d-%02d".format(Locale.US, c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1)

    class Data(val days: Map<String, Long>, val months: Map<String, Long>,
               val sd: Map<String, Map<String, Long>>, val sm: Map<String, Map<String, Long>>)

    @Synchronized fun add(ctx: Context, key: String, ms: Long, now: Calendar = Calendar.getInstance()) {
        val pr = p(ctx); val d = dayKey(now); val m = monthKey(now)
        val days = JSONObject(pr.getString("days", "{}")!!).apply { put(d, optLong(d) + ms) }
        val months = JSONObject(pr.getString("months", "{}")!!).apply { put(m, optLong(m) + ms) }
        val sd = JSONObject(pr.getString("sd", "{}")!!); val sm = JSONObject(pr.getString("sm", "{}")!!)
        fun bump(o: JSONObject, k: String, keep: Int) { val x = o.optJSONObject(k) ?: JSONObject(); x.put(key, x.optLong(key) + ms)
            if (x.length() > keep + 5) { val small = x.keys().asSequence().toList().sortedByDescending { x.optLong(it) }.drop(keep); small.forEach { x.remove(it) } }
            o.put(k, x) }
        bump(sd, d, 15); bump(sm, m, 25)
        trim(days, 400); trim(sd, 62)
        pr.edit().putString("days", days.toString()).putString("months", months.toString())
            .putString("sd", sd.toString()).putString("sm", sm.toString()).apply()
    }
    private fun trim(o: JSONObject, keep: Int) { if (o.length() > keep) o.keys().asSequence().toList().sorted().dropLast(keep).forEach { o.remove(it) } }

    fun local(ctx: Context): Data { val pr = p(ctx); return parse(pr.getString("days", "{}")!!, pr.getString("months", "{}")!!,
        pr.getString("sd", "{}")!!, pr.getString("sm", "{}")!!) }

    fun parse(days: String, months: String, sd: String, sm: String): Data {
        fun flat(s: String) = runCatching { JSONObject(s).let { o -> o.keys().asSequence().associateWith { o.optLong(it) } } }.getOrDefault(emptyMap())
        fun nest(s: String) = runCatching { JSONObject(s).let { o -> o.keys().asSequence().associateWith { k ->
            o.optJSONObject(k)?.let { x -> x.keys().asSequence().associateWith { x.optLong(it) } } ?: emptyMap() } } }.getOrDefault(emptyMap())
        return Data(flat(days), flat(months), nest(sd), nest(sm))
    }

    /** The part of this phone's history that goes to the account (small: months, the last 60 days, station months). */
    fun forAccount(ctx: Context): JSONObject {
        val d = local(ctx)
        return JSONObject().put("days", JSONObject(d.days.toSortedMap().entries.toList().takeLast(60).associate { it.key to it.value }))
            .put("months", JSONObject(d.months)).put("sm", JSONObject(d.sm.mapValues { (_, v) ->
                JSONObject(v.entries.sortedByDescending { it.value }.take(12).associate { it.key.replace('.', '_') to it.value }) }))
    }

    /** Several phones' history added together (the account's devices); this phone's own detailed days stay as they are. */
    fun merge(mine: Data, others: List<Data>): Data {
        fun add(a: Map<String, Long>, b: Map<String, Long>) = (a.keys + b.keys).associateWith { (a[it] ?: 0) + (b[it] ?: 0) }
        var days = mine.days; var months = mine.months; var sm = mine.sm
        others.forEach { o -> days = add(days, o.days); months = add(months, o.months)
            sm = (sm.keys + o.sm.keys).associateWith { add(sm[it] ?: emptyMap(), o.sm[it] ?: emptyMap()) } }
        return Data(days, months, mine.sd, sm)
    }

    enum class Period { WEEK, MONTH, YEAR, ALL }

    /** Bars for the chart: label and listening time, oldest first. */
    fun bars(d: Data, period: Period, today: Calendar = Calendar.getInstance()): List<Pair<String, Long>> {
        val c = today.clone() as Calendar
        return when (period) {
            Period.WEEK, Period.MONTH -> {
                val n = if (period == Period.WEEK) 7 else 30
                c.add(Calendar.DAY_OF_YEAR, -(n - 1))
                (0 until n).map { i ->
                    val lab = if (period == Period.WEEK) SimpleDateFormat("EEE", Locale.UK).format(c.time).take(2)
                        else if (i % 5 == 0 || i == n - 1) "${c.get(Calendar.DAY_OF_MONTH)}" else ""
                    (lab to (d.days[dayKey(c)] ?: 0L)).also { c.add(Calendar.DAY_OF_YEAR, 1) }
                }
            }
            Period.YEAR -> { c.set(Calendar.DAY_OF_MONTH, 1); c.add(Calendar.MONTH, -11)
                (0 until 12).map { (SimpleDateFormat("MMM", Locale.UK).format(c.time).take(1) to (d.months[monthKey(c)] ?: 0L)).also { c.add(Calendar.MONTH, 1) } } }
            Period.ALL -> {
                val first = d.months.filterValues { it > 0 }.keys.minOrNull() ?: monthKey(c)
                val years = first.take(4).toInt()..c.get(Calendar.YEAR)
                if (years.count() > 1) years.map { y -> "$y" to d.months.filterKeys { it.startsWith("$y-") }.values.sum() }
                else { val m0 = first.substring(5, 7).toInt() - 1; val m1 = c.get(Calendar.MONTH)
                    (m0..m1).map { m -> c.set(Calendar.MONTH, m); SimpleDateFormat("MMM", Locale.UK).format(c.time) to (d.months[monthKey(c)] ?: 0L) } }
            }
        }
    }

    /** Stations heard most in the period (key → ms), biggest first. */
    fun stations(d: Data, period: Period, today: Calendar = Calendar.getInstance()): List<Pair<String, Long>> {
        val c = today.clone() as Calendar
        val maps: List<Map<String, Long>> = when (period) {
            Period.WEEK, Period.MONTH -> { val n = if (period == Period.WEEK) 7 else 30
                (0 until n).mapNotNull { i -> (c.clone() as Calendar).apply { add(Calendar.DAY_OF_YEAR, -i) }.let { d.sd[dayKey(it)] } } }
            Period.YEAR -> (0 until 12).mapNotNull { i -> (c.clone() as Calendar).apply { set(Calendar.DAY_OF_MONTH, 1); add(Calendar.MONTH, -i) }.let { d.sm[monthKey(it)] } }
            Period.ALL -> d.sm.values.toList()
        }
        val sum = HashMap<String, Long>()
        maps.forEach { m -> m.forEach { (k, v) -> sum[k] = (sum[k] ?: 0) + v } }
        return sum.entries.sortedByDescending { it.value }.map { it.key to it.value }
    }

    /** Languages (collections) from the period's stations, biggest first. */
    fun languages(st: List<Pair<String, Long>>): List<Pair<String, Long>> =
        st.groupBy { it.first.substringBefore(':') }.mapValues { e -> e.value.sumOf { it.second } }.entries
            .sortedByDescending { it.value }.map { it.key to it.value }

    fun total(bars: List<Pair<String, Long>>) = bars.sumOf { it.second }
}

/** The "Your listening" page from You. */
@Composable
fun ListeningScreen(close: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf(History.local(ctx)) }
    var totals by remember { mutableStateOf(Listen.local(ctx)) }
    var cols by remember { mutableStateOf<List<Collection>>(emptyList()) }
    var names by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    LaunchedEffect(Unit) {
        cols = Repo.collections(ctx)
        Listen.account(ctx)?.let { totals = it }
        Listen.accountHistory(ctx)?.let { data = it }
        names = withContext(Dispatchers.IO) { Listen.names(ctx) }
    }
    var period by remember { mutableStateOf(History.Period.MONTH) }
    val bars = remember(data, period) { History.bars(data, period) }
    val st = remember(data, period) { History.stations(data, period) }
    val langs = remember(st) { History.languages(st) }
    fun colName(id: String) = cols.find { it.id == id }?.name ?: id.replaceFirstChar { it.uppercase() }
    fun stName(k: String) = names[k] ?: k.substringAfter(':').replace('-', ' ').replaceFirstChar { it.uppercase() }
    val periodTotal = if (period == History.Period.ALL) maxOf(totals.total, History.total(bars)) else History.total(bars)
    val labels = listOf(t("Week"), t("Month"), t("Year"), t("All time"))

    SubPage(t("Your listening"), close) {
        run {
            Spacer(Modifier.height(8.dp)); run { Pill(labels, period.ordinal) { period = History.Period.entries[it] } }
            run {
                Column(Modifier.fillMaxWidth().padding(top = 22.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    CountUp(periodTotal)
                    Text(when (period) { History.Period.WEEK -> t("in the last 7 days"); History.Period.MONTH -> t("in the last 30 days")
                        History.Period.YEAR -> t("in the last 12 months"); History.Period.ALL -> t("since you started") }, fontSize = 14.sp, color = Soft)
                }
            }
            run { Group(modifier = Modifier.padding(top = 18.dp)) { BarChart(bars, Modifier.padding(16.dp)) } }
            if (bars.all { it.second == 0L } && period != History.Period.ALL) run {
                InfoText(t("Day-by-day history starts with this version, so earlier listening shows only in All time."))
            }
            if (st.isNotEmpty()) run {
                Group(t("TOP STATIONS")) {
                    st.take(5).forEachIndexed { i, (k, ms) ->
                        if (i > 0) RowLine()
                        ShareRow("${i + 1}", stName(k), Listen.hm(ms), ms.toFloat() / st.first().second)
                    }
                }
            }
            if (langs.isNotEmpty()) run {
                Group(t("LANGUAGES")) {
                    val all = langs.sumOf { it.second }.coerceAtLeast(1)
                    langs.take(5).forEachIndexed { i, (id, ms) ->
                        if (i > 0) RowLine()
                        ShareRow("${(ms * 100 / all)}%", colName(id), Listen.hm(ms), ms.toFloat() / langs.first().second)
                    }
                }
            }
            run {
                ActionButton(t("Share as a picture"), Icons.Outlined.Share, Modifier.padding(top = 24.dp)) {
                    scope.launch { shareListeningCard(ctx, labels[period.ordinal], periodTotal, bars,
                        st.take(3).map { stName(it.first) }, langs.firstOrNull()?.let { colName(it.first) }) }
                }
                InfoText(t("Only you see these numbers, unless you share the picture."))
            }
        }
    }
}

/** A big number that counts up when it appears or changes. */
@Composable
private fun CountUp(ms: Long) {
    val a = remember { Animatable(0f) }
    LaunchedEffect(ms) { a.animateTo(ms.toFloat(), tween(700)) }
    val m = (a.value / 60_000).toLong()
    Text(if (m >= 60) "%,d".format(Locale.UK, m / 60) + " " + t("hrs") + (if (m < 600) " ${m % 60} " + t("min") else "") else "$m " + t("min"),
        fontSize = 40.sp, fontWeight = FontWeight.Light, color = AccentText)
}

@Composable
private fun BarChart(bars: List<Pair<String, Long>>, modifier: Modifier = Modifier) {
    val max = (bars.maxOfOrNull { it.second } ?: 0L).coerceAtLeast(1)
    val grow = remember { Animatable(0f) }
    LaunchedEffect(bars) { grow.snapTo(0f); grow.animateTo(1f, tween(600)) }
    val acc = AccentText; val gold = GoldC; val base = Line
    Column(modifier) {
        DrawCanvas(Modifier.fillMaxWidth().height(150.dp)) {
            val bw = size.width / bars.size
            bars.forEachIndexed { i, (_, v) ->
                val h = (size.height - 4f) * (v.toFloat() / max) * grow.value
                val w = bw * if (bars.size > 12) 0.62f else 0.56f
                if (v > 0) drawRoundRect(if (i == bars.lastIndex) gold else acc, Offset(i * bw + (bw - w) / 2, size.height - h - 2f),
                    Size(w, h.coerceAtLeast(3f)), CornerRadius(w / 3))
            }
            drawRect(base, Offset(0f, size.height - 1.5f), Size(size.width, 1.5f))
        }
        Row(Modifier.fillMaxWidth().padding(top = 6.dp)) {
            bars.forEach { (l, _) -> Text(l, Modifier.weight(1f), fontSize = 11.sp, color = Soft, maxLines = 1,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center, softWrap = false) }
        }
    }
}

@Composable
private fun ShareRow(lead: String, name: String, value: String, frac: Float) {
    Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(lead, Modifier.width(44.dp), fontSize = 14.sp, color = GoldC, fontWeight = FontWeight.Medium)
            Text(name, Modifier.weight(1f), fontSize = 16.sp, color = Title, maxLines = 1, overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis)
            Text(value, fontSize = 14.sp, color = Soft)
        }
        Box(Modifier.padding(start = 44.dp, top = 6.dp).fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(Line.copy(alpha = 0.5f))) {
            Box(Modifier.fillMaxWidth(frac.coerceIn(0.02f, 1f)).fillMaxHeight().clip(RoundedCornerShape(2.dp)).background(AccentText))
        }
    }
}

/** Share a picture of your listening, drawn in your colour theme and font. */
suspend fun shareListeningCard(ctx: Context, period: String, ms: Long, bars: List<Pair<String, Long>>, top: List<String>, lang: String?) {
    val pal = Theme.pal; val font = Theme.font
    val file = withContext(Dispatchers.IO) {
        val bmp = drawListeningCard(ctx, period, ms, bars, top, lang, pal, font)
        val dir = File(ctx.cacheDir, "cards").apply { mkdirs() }
        File(dir, "listening-card.png").also { f -> f.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) } }
    }
    val uri = FileProvider.getUriForFile(ctx, ctx.packageName + ".files", file)
    val send = Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri)
        .putExtra(Intent.EXTRA_TEXT, "My listening on Radio Velvet\nhttps://ranjithkb.com/radio.html")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).apply { clipData = android.content.ClipData.newRawUri("card", uri) }
    ctx.startActivity(Intent.createChooser(send, "Share").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION))
}

/** 1080 × 1350 picture: logo and name together at the top, the time, the bars, top stations, the top language. */
fun drawListeningCard(ctx: Context, period: String, ms: Long, bars: List<Pair<String, Long>>, top: List<String>, lang: String?,
                      pal: Pal, font: String): Bitmap {
    val w = 1080; val h = 1350
    val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888); val cv = Canvas(bmp)
    val bg = pal.artBg; val dark = Palettes.luma(bg) < 0.5f
    val ink = if (dark) 0xFFF1E9EE.toInt() else pal.ink.toArgb()
    val soft = if (dark) 0xFFC9BBC5.toInt() else pal.soft.toArgb()
    val gold = (if (Palettes.contrast(pal.gold, bg) >= 2.2f) pal.gold else androidx.compose.ui.graphics.Color(ink)).toArgb()
    val acc = (if (Palettes.contrast(pal.accentText, bg) >= 2f) pal.accentText else androidx.compose.ui.graphics.Color(ink)).toArgb()
    fun alpha(c: Int, a: Int) = (c and 0x00FFFFFF) or (a shl 24)
    cv.drawColor(bg.toArgb())
    cv.drawRect(RectF(48f, 48f, w - 48f, h - 48f), Paint(Paint.ANTI_ALIAS_FLAG).apply { color = alpha(gold, 0x88); style = Paint.Style.STROKE; strokeWidth = 2f })
    val fc = FONTS.firstOrNull { it.id == font } ?: FONTS[0]
    fun face(light: Boolean): Typeface = try { fc.res?.let { r -> androidx.core.content.res.ResourcesCompat.getFont(ctx, if (light) r[0] else r[2]) } }
        catch (e: Exception) { null } ?: Typeface.create(Typeface.SANS_SERIF, if (light) Typeface.NORMAL else Typeface.BOLD)
    val light = face(true); val med = face(false)
    fun paint(size: Float, color: Int, tf: Typeface, spacing: Float = 0f, align: Paint.Align = Paint.Align.CENTER) = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        this.color = color; textSize = size * fc.scale; textAlign = align; typeface = tf; letterSpacing = spacing }
    fun fit(s: String, p: Paint, max: Float): String { var t = s; while (p.measureText(t) > max && t.length > 4) t = t.dropLast(2); return if (t != s) t.trimEnd() + "…" else s }

    // logo and name on one line, centred together
    val title = paint(34f, gold, med, 0.3f, Paint.Align.LEFT); val name = "RADIO VELVET"
    val lw = 64f; val gap = 22f; val tw = title.measureText(name); val x0 = (w - (lw + gap + tw)) / 2
    androidx.core.content.ContextCompat.getDrawable(ctx, R.drawable.ic_logo_mark)?.mutate()?.let { d ->
        d.setTint(gold); d.setBounds(x0.toInt(), 118, (x0 + lw).toInt(), (118 + lw).toInt()); d.draw(cv) }
    val fm = title.fontMetrics; cv.drawText(name, x0 + lw + gap, 150f - (fm.ascent + fm.descent) / 2, title)

    cv.drawText(("MY LISTENING · " + period).uppercase(), 540f, 290f, paint(28f, soft, med, 0.18f))
    val m = ms / 60_000
    val big = if (m >= 60) "%,d hrs".format(Locale.UK, m / 60) else "$m min"
    cv.drawText(big, 540f, 430f, paint(130f, ink, light))

    // bars
    val r = RectF(150f, 520f, 930f, 800f); val max = (bars.maxOfOrNull { it.second } ?: 0L).coerceAtLeast(1)
    val bw = r.width() / bars.size.coerceAtLeast(1); val bp = Paint(Paint.ANTI_ALIAS_FLAG)
    bars.forEachIndexed { i, (_, v) -> if (v <= 0) return@forEachIndexed
        val bh = (r.height() * v / max).coerceAtLeast(6f); val ww = bw * 0.58f
        bp.color = if (i == bars.lastIndex) gold else acc
        cv.drawRoundRect(RectF(r.left + i * bw + (bw - ww) / 2, r.bottom - bh, r.left + i * bw + (bw + ww) / 2, r.bottom), ww / 3, ww / 3, bp) }
    cv.drawRect(r.left, r.bottom + 4f, r.right, r.bottom + 6f, Paint().apply { color = alpha(soft, 0x66) })

    var y = 900f
    if (top.isNotEmpty()) {
        cv.drawText("TOP STATIONS", 540f, y, paint(26f, gold, med, 0.2f)); y += 70f
        val tp = paint(46f, ink, light)
        top.forEachIndexed { i, s -> cv.drawText(fit("${i + 1}  $s", tp, 860f), 540f, y, tp); y += 64f }
    }
    if (lang != null) { y += 14f; cv.drawText(fit("Mostly in $lang", paint(36f, soft, light), 860f), 540f, y, paint(36f, soft, light)) }
    cv.drawText("ranjithkb.com/radio", 540f, 1270f, paint(25f, alpha(ink, 0x99), light))
    return bmp
}
