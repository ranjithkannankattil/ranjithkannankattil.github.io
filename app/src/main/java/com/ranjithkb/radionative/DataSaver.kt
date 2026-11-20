package com.ranjithkb.radionative

import android.content.Context
import android.net.ConnectivityManager
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.datasource.DataSource
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.TransferListener
import java.util.Calendar
import java.util.Locale

/**
 * Data saver, for listeners on ships, in remote villages, on 2G or satellite links (his idea, Nov 2026).
 * Off / On / Only on mobile data. When on: each station plays its lightest link first (the website's twice-daily
 * check records every link's kbps as "br"), HLS streams such as Akashvani play their lowest level, and no song
 * covers are fetched. Defaults stay exactly as before (off).
 */
object DataSaver {
    const val OFF = "off"; const val ON = "on"; const val MOBILE = "mobile"
    val MODES = listOf(OFF, ON, MOBILE)
    var mode by mutableStateOf(OFF)
    /** True when data saving applies right now (read by the player too, so no Compose state needed). */
    @Volatile var isOn = false; private set
    /** HLS (Akashvani…) is capped to this when saving data: their lowest levels are 24–64 kbps. */
    const val HLS_CAP = 64_000

    private fun p(ctx: Context) = ctx.getSharedPreferences("settings", Context.MODE_PRIVATE)
    fun load(ctx: Context) { mode = p(ctx).getString("dataSaver", OFF)!!.let { if (it in MODES) it else OFF }; refresh(ctx) }
    fun save(ctx: Context, m: String) { mode = m; p(ctx).edit().putString("dataSaver", m).apply(); refresh(ctx) }

    /** Works out [isOn] from the setting and whether the phone is on mobile data now. */
    fun refresh(ctx: Context): Boolean {
        val m = p(ctx).getString("dataSaver", OFF)
        isOn = when (m) { ON -> true; MOBILE -> metered(ctx); else -> false }
        return isOn
    }
    fun metered(ctx: Context): Boolean = runCatching {
        ctx.getSystemService(ConnectivityManager::class.java)?.isActiveNetworkMetered ?: false }.getOrDefault(false)

    /** The station's links, lightest first (unknown ones count as 96 kbps, between light and full quality). Pure. */
    fun order(streams: List<String>, br: List<Int>): List<String> =
        streams.indices.sortedBy { i -> br.getOrNull(i)?.takeIf { it > 0 } ?: 96 }.map { streams[it] }

    /** The lightest known kbps of a station, or 0. Pure. */
    fun lightest(br: List<Int>): Int = br.filter { it > 0 }.minOrNull() ?: 0

    /** MB an hour of listening uses at [kbps] (kbps × 3600 s ÷ 8 ÷ 1000). Pure. */
    fun mbPerHour(kbps: Int): Int = Math.round(kbps * 0.45).toInt()

    /** "32 kbps · ~14 MB/hour". Pure. */
    fun label(kbps: Int): String = if (kbps <= 0) "" else "$kbps kbps · ~${mbPerHour(kbps)} MB/hour"
}

/**
 * How much data the radio has used this month, counted by the player itself (every byte it downloads), split into
 * mobile data and Wi-Fi. Kept on the phone only.
 */
object DataUse : TransferListener {
    private var app: Context? = null
    @Volatile private var pendMobile = 0L
    @Volatile private var pendWifi = 0L
    @Volatile private var lastFlush = 0L
    @Volatile private var meteredNow = false
    private var meteredAt = 0L

    fun init(ctx: Context) { app = ctx.applicationContext }
    private fun p(ctx: Context) = ctx.getSharedPreferences("datause", Context.MODE_PRIVATE)
    fun monthKey(c: Calendar = Calendar.getInstance()) = String.format(Locale.UK, "%04d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1)

    override fun onTransferInitializing(source: DataSource, dataSpec: DataSpec, isNetwork: Boolean) {}
    override fun onTransferStart(source: DataSource, dataSpec: DataSpec, isNetwork: Boolean) {}
    override fun onTransferEnd(source: DataSource, dataSpec: DataSpec, isNetwork: Boolean) { flush(force = true) }
    override fun onBytesTransferred(source: DataSource, dataSpec: DataSpec, isNetwork: Boolean, bytesTransferred: Int) {
        if (!isNetwork || bytesTransferred <= 0) return
        val now = System.currentTimeMillis()
        if (now - meteredAt > 30_000) { meteredAt = now; meteredNow = app?.let { DataSaver.metered(it) } ?: false }
        synchronized(this) { if (meteredNow) pendMobile += bytesTransferred else pendWifi += bytesTransferred }
        if (now - lastFlush > 30_000) flush()
    }

    fun flush(force: Boolean = false) {
        val ctx = app ?: return
        val (m, w) = synchronized(this) { val r = pendMobile to pendWifi; pendMobile = 0; pendWifi = 0; r }
        lastFlush = System.currentTimeMillis()
        if (m == 0L && w == 0L) return
        add(ctx, monthKey(), m, w)
    }

    fun add(ctx: Context, month: String, mobile: Long, wifi: Long) {
        val pr = p(ctx)
        val same = pr.getString("month", null) == month                 // a new month starts from zero
        pr.edit().putString("month", month)
            .putLong("mobile", (if (same) pr.getLong("mobile", 0) else 0) + mobile)
            .putLong("wifi", (if (same) pr.getLong("wifi", 0) else 0) + wifi).apply()
    }

    /** This month's (mobile, Wi-Fi) bytes. */
    fun thisMonth(ctx: Context): Pair<Long, Long> {
        val pr = p(ctx)
        if (pr.getString("month", "") != monthKey()) return 0L to 0L
        return (pr.getLong("mobile", 0) + pendMobile) to (pr.getLong("wifi", 0) + pendWifi)
    }

    /** "1.2 GB", "340 MB", "0 MB". Pure. */
    fun size(bytes: Long): String = when {
        bytes >= 1_000_000_000L -> String.format(Locale.UK, "%.1f GB", bytes / 1e9)
        else -> "${Math.round(bytes / 1e6)} MB"
    }
}

@Composable
fun DataSaverScreen(close: () -> Unit) {
    val ctx = LocalContext.current
    var use by remember { mutableStateOf(DataUse.thisMonth(ctx)) }
    LaunchedEffect(Unit) { while (true) { kotlinx.coroutines.delay(5000); use = DataUse.thisMonth(ctx) } }
    SubPage(t("Data saver"), close) {
        Text(t("For ships, villages and patchy signal: plays each station's lightest link and skips song covers. Many stations then use 15–30 MB an hour instead of 60–90."), fontSize = 14.sp, color = Soft, lineHeight = 20.sp,
            modifier = Modifier.padding(top = 4.dp))
        SectionHead(t("Save data"))
        val opts = listOf(DataSaver.OFF, DataSaver.MOBILE, DataSaver.ON)
        Segmented(listOf(t("Off"), t("Mobile data"), t("Always")), opts.indexOf(DataSaver.mode).coerceAtLeast(0)) { DataSaver.save(ctx, opts[it]) }
        Text(when (DataSaver.mode) {
            DataSaver.ON -> "On all the time, on Wi-Fi too."
            DataSaver.MOBILE -> "On when the phone is on mobile data; full quality on Wi-Fi."
            else -> "Off: every station plays at its usual quality."
        }, fontSize = 13.sp, color = Soft, modifier = Modifier.padding(top = 8.dp))
        SectionHead(t("Used by Radio Velvet this month"))
        SettingRow(t("Mobile data"), value = DataUse.size(use.first))
        SettingRow(t("Wi-Fi"), value = DataUse.size(use.second))
        Text(t("Counted by the app itself, from the 1st of the month. Lists show each station's weight with Data saver on, and ⇅ Sort has \"Lightest first\"."), fontSize = 13.sp, color = Soft, lineHeight = 19.sp, modifier = Modifier.padding(top = 12.dp))
    }
}
