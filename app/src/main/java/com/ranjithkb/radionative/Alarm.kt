package com.ranjithkb.radionative

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.core.app.NotificationCompat
import androidx.media3.session.MediaController
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * Wake up to the radio. Any number of alarms (one for workdays, one for the weekend…), each with its own time, days,
 * station, fade-in, volume, name and backup. Days are Calendar.DAY_OF_WEEK values (empty = once). Survives restarts.
 *
 * Safety net, so an alarm always wakes you: the station's other links, then the backup ("auto" = your favourites,
 * then the last station played; or one chosen station; or "tone" = straight to the phone's alarm sound); the phone's
 * alarm sound at the latest [TONE_AFTER_MS] after the alarm time, whatever happens; it keeps going until you stop it
 * (at most [RING_MAX_MS]) with Stop and Snooze on the lock screen. Two minutes before, a quiet check of the station's
 * stream; if it's down, the alarm goes straight to the backup.
 */
object Alarm {
    data class Setup(val on: Boolean, val hour: Int, val minute: Int, val days: Set<Int>, val station: JSONObject?,
                     val fadeSec: Int, val volume: Int, val id: Int = 1, val name: String = "", val backup: String = "auto") {
        fun toJson(): JSONObject = JSONObject().put("id", id).put("on", on).put("hour", hour).put("minute", minute)
            .put("days", JSONArray(days.sorted())).put("station", station).put("fade", fadeSec).put("volume", volume)
            .put("name", name).put("backup", backup)
        companion object {
            fun fromJson(o: JSONObject) = Setup(o.optBoolean("on", false), o.optInt("hour", 7).coerceIn(0, 23), o.optInt("minute", 0).coerceIn(0, 59),
                o.optJSONArray("days")?.let { a -> (0 until a.length()).map { a.optInt(it) }.filter { it in 1..7 }.toSet() } ?: emptySet(),
                o.optJSONObject("station"), o.optInt("fade", 60).coerceIn(0, 300), o.optInt("volume", 70).coerceIn(20, 100),
                o.optInt("id", 1), o.optString("name", ""), o.optString("backup", "auto").ifBlank { "auto" })
        }
    }

    const val TONE_AFTER_MS = 20_000L        // the phone's alarm sound, at the latest, this long after the alarm time
    const val RING_MAX_MS = 10 * 60_000L      // an alarm nobody stops goes quiet after this long
    const val SNOOZE_MIN = 10
    val WORKDAYS = (2..6).toSet()            // Mon–Fri
    val WEEKEND = setOf(1, 7)                // Sat, Sun
    val EVERY_DAY = (1..7).toSet()

    private fun p(ctx: Context) = ctx.getSharedPreferences("alarm", Context.MODE_PRIVATE)

    // ------------------------------------------------------------ the list

    /** Every alarm, in time order. The single alarm of 2.6 becomes the first one, so nobody loses theirs. */
    fun all(ctx: Context): List<Setup> {
        val pr = p(ctx)
        val raw = pr.getString("list", null)
        if (raw == null) {
            if (!pr.contains("on") && !pr.contains("hour")) return emptyList()
            val old = Setup(pr.getBoolean("on", false), pr.getInt("hour", 7), pr.getInt("minute", 0),
                pr.getString("days", "2,3,4,5,6")!!.split(',').mapNotNull { it.toIntOrNull() }.filter { it in 1..7 }.toSet(),
                pr.getString("station", null)?.let { runCatching { JSONObject(it) }.getOrNull() },
                pr.getInt("fade", 60), pr.getInt("volume", 70).coerceIn(20, 100), id = 1)
            pr.edit().putString("list", JSONArray(listOf(old.toJson())).toString()).apply()
            return listOf(old)
        }
        val a = runCatching { JSONArray(raw) }.getOrElse { JSONArray() }
        return (0 until a.length()).mapNotNull { runCatching { Setup.fromJson(a.getJSONObject(it)) }.getOrNull() }
            .sortedWith(compareBy({ it.hour }, { it.minute }, { it.id }))
    }

    private fun write(ctx: Context, l: List<Setup>) { p(ctx).edit().putString("list", JSONArray(l.map { it.toJson() }).toString()).apply() }

    /** The first alarm (or a fresh one): kept for older callers. */
    fun load(ctx: Context): Setup = all(ctx).firstOrNull() ?: fresh(ctx)

    fun byId(ctx: Context, id: Int): Setup? = all(ctx).firstOrNull { it.id == id }

    /** A new alarm: 7:00 on workdays, waking to the last station played. */
    fun fresh(ctx: Context) = Setup(true, 7, 0, WORKDAYS, null, 60, 70, id = (all(ctx).maxOfOrNull { it.id } ?: 0) + 1)

    /** Add or update one alarm (by id), then set them all with Android. */
    fun save(ctx: Context, s: Setup) {
        val l = all(ctx).filter { it.id != s.id } + s
        write(ctx, l); schedule(ctx)
    }

    fun remove(ctx: Context, id: Int) { write(ctx, all(ctx).filter { it.id != id }); cancelOne(ctx, id); schedule(ctx) }

    fun stationJson(st: Station, lang: String): JSONObject = JSONObject().put("id", st.id).put("col", st.col).put("name", st.name)
        .put("lang", lang).put("streams", JSONArray(st.streams))

    // ------------------------------------------------------------ times

    /** The next time an alarm should ring, after [now]. Pure, so it can be tested. */
    fun next(now: Calendar, hour: Int, minute: Int, days: Set<Int>): Calendar {
        val c = (now.clone() as Calendar).apply { set(Calendar.HOUR_OF_DAY, hour); set(Calendar.MINUTE, minute); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
        if (!c.after(now)) c.add(Calendar.DAY_OF_YEAR, 1)
        if (days.isNotEmpty()) repeat(7) { if (c.get(Calendar.DAY_OF_WEEK) !in days) c.add(Calendar.DAY_OF_YEAR, 1) }
        return c
    }

    /** The alarm that rings next, and when (null if none is on). Pure. */
    fun upcoming(now: Calendar, list: List<Setup>): Pair<Setup, Calendar>? =
        list.filter { it.on }.map { it to next(now, it.hour, it.minute, it.days) }.minByOrNull { it.second.timeInMillis }

    /** "Tomorrow, Friday 6:30", "Today 22:15", "Monday 7:00". Pure. */
    fun whenLabel(now: Calendar, at: Calendar, is24: Boolean): String {
        val days = ((at.clone() as Calendar).apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis -
            (now.clone() as Calendar).apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }.timeInMillis) / 86_400_000L
        val day = at.getDisplayName(Calendar.DAY_OF_WEEK, Calendar.LONG, if (Lang.code == "en") java.util.Locale.UK else java.util.Locale(Lang.code))
        val t = timeLabel(at.get(Calendar.HOUR_OF_DAY), at.get(Calendar.MINUTE), is24)
        return when (days) { 0L -> Lang.tr("Today") + " $t"; 1L -> Lang.tr("Tomorrow") + ", $day $t"; else -> "$day $t" }
    }

    fun timeLabel(h: Int, m: Int, is24: Boolean): String = if (is24) String.format(java.util.Locale.UK, "%02d:%02d", h, m)
        else String.format(java.util.Locale.UK, "%d:%02d %s", if (h % 12 == 0) 12 else h % 12, m, if (h < 12) "am" else "pm")

    /** "Workdays", "Weekend", "Every day", "Once", "Mon, Wed" … */
    fun daysLabel(days: Set<Int>): String {
        val names = mapOf(Calendar.MONDAY to "Mon", Calendar.TUESDAY to "Tue", Calendar.WEDNESDAY to "Wed", Calendar.THURSDAY to "Thu",
            Calendar.FRIDAY to "Fri", Calendar.SATURDAY to "Sat", Calendar.SUNDAY to "Sun")
        return when {
            days.isEmpty() -> t("Once")
            days.size == 7 -> t("Every day")
            days == WORKDAYS -> t("Workdays")
            days == WEEKEND -> t("Weekend")
            else -> listOf(2, 3, 4, 5, 6, 7, 1).filter { it in days }.joinToString(", ") { names[it]!! }
        }
    }

    // ------------------------------------------------------------ setting them with Android

    fun canExact(ctx: Context): Boolean = Build.VERSION.SDK_INT < 31 ||
        (ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()

    private fun intent(ctx: Context, action: String, id: Int) = Intent(ctx, AlarmReceiver::class.java).setAction(action).putExtra("id", id)
    private fun pending(ctx: Context, action: String, id: Int, code: Int) = PendingIntent.getBroadcast(ctx, code, intent(ctx, action, id),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    private fun ringPI(ctx: Context, id: Int) = pending(ctx, AlarmReceiver.RING, id, 1000 + id)
    private fun checkPI(ctx: Context, id: Int) = pending(ctx, AlarmReceiver.CHECK, id, 3000 + id)

    private fun cancelOne(ctx: Context, id: Int) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(ringPI(ctx, id)); am.cancel(checkPI(ctx, id))
    }

    /** Sets every alarm that's on (and the quiet stream check 2 minutes before each); clears the rest. */
    fun schedule(ctx: Context) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pending(ctx, AlarmReceiver.RING, 1, 7))          // 2.6's single alarm
        val pr = p(ctx)
        val list = all(ctx)
        val before = pr.getString("scheduled", "")!!.split(',').mapNotNull { it.toIntOrNull() }
        before.filter { id -> list.none { it.id == id && it.on } }.forEach { cancelOne(ctx, it) }
        val now = Calendar.getInstance()
        for (s in list.filter { it.on }) {
            val at = next(now, s.hour, s.minute, s.days).timeInMillis
            try {
                if (canExact(ctx)) {
                    val show = PendingIntent.getActivity(ctx, 8, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
                    am.setAlarmClock(AlarmManager.AlarmClockInfo(at, show), ringPI(ctx, s.id))
                    val check = at - 2 * 60_000L
                    if (check > System.currentTimeMillis() + 5_000) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, check, checkPI(ctx, s.id))
                } else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, ringPI(ctx, s.id))   // may be a few minutes late
            } catch (e: SecurityException) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, ringPI(ctx, s.id)) }
        }
        pr.edit().putString("scheduled", list.filter { it.on }.joinToString(",") { it.id.toString() }).apply()
    }

    /** Snooze: the same alarm again in [SNOOZE_MIN] minutes (once). */
    fun snooze(ctx: Context, id: Int) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val at = System.currentTimeMillis() + SNOOZE_MIN * 60_000L
        val pi = pending(ctx, AlarmReceiver.SNOOZED, id, 5000 + id)
        try { if (canExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) }
        catch (e: SecurityException) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) }
    }

    /** Is a snooze waiting for this alarm? (for the tests) */
    fun snoozeSet(ctx: Context, id: Int): Boolean = PendingIntent.getBroadcast(ctx, 5000 + id, intent(ctx, AlarmReceiver.SNOOZED, id),
        PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE) != null

    // ------------------------------------------------------------ the quiet check before an alarm

    /** Is the station's stream answering? (first link that answers with audio in a few seconds) */
    fun streamAnswers(streams: List<String>, timeoutMs: Int = 6000): Boolean = streams.take(3).any { u ->
        runCatching {
            val c = (java.net.URL(u).openConnection() as java.net.HttpURLConnection).apply {
                connectTimeout = timeoutMs; readTimeout = timeoutMs; instanceFollowRedirects = true
                setRequestProperty("Icy-MetaData", "0"); setRequestProperty("User-Agent", "RadioVelvet")
            }
            try { c.responseCode in 200..299 && c.inputStream.read(ByteArray(2048)) > 0 } finally { c.disconnect() }
        }.getOrDefault(false)
    }
    // ------------------------------------------------------------ the guard: an alarm must make a sound even if the player never starts

    const val GUARD_MS = 40_000L
    /** The receiver fired this alarm now; nothing has answered yet. */
    fun markFired(ctx: Context, id: Int) = p(ctx).edit().putInt("fired_id", id).putLong("fired_at", System.currentTimeMillis())
        .putBoolean("answered", false).commit()
    /** The radio is on air, the player's alarm sound rang, or someone pressed Stop / Snooze: the guard has nothing to do. */
    fun markAnswered(ctx: Context) = p(ctx).edit().putBoolean("answered", true).apply()
    /** Should the guard ring? Only for the alarm that just fired, within a few minutes, and only if nothing answered. */
    fun guardShouldRing(ctx: Context, id: Int, now: Long = System.currentTimeMillis()): Boolean {
        val pr = p(ctx)
        return pr.getInt("fired_id", -1) == id && !pr.getBoolean("answered", true) && now - pr.getLong("fired_at", 0) in 0..(5 * 60_000L)
    }
    fun setGuard(ctx: Context, id: Int) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val at = System.currentTimeMillis() + GUARD_MS
        val pi = pending(ctx, AlarmReceiver.GUARD, id, 8000 + id)
        try { if (canExact(ctx)) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) }
        catch (e: SecurityException) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) }
    }

    fun markChecked(ctx: Context, id: Int, ok: Boolean) =
        p(ctx).edit().putBoolean("ok_$id", ok).putLong("checked_$id", System.currentTimeMillis()).apply()
    /** The check said the station is down (and it was this morning's check, not an old one). */
    fun knownDown(ctx: Context, id: Int): Boolean {
        val pr = p(ctx)
        return !pr.getBoolean("ok_$id", true) && System.currentTimeMillis() - pr.getLong("checked_$id", 0) < 10 * 60_000L
    }

    // ------------------------------------------------------------ the notification while it rings

    const val NOTE_ID = 4411
    /** [sound]: the notification itself rings the phone's alarm sound, over and over until Stop (the guard's last resort). */
    fun showRinging(ctx: Context, s: Setup, tone: Boolean, sound: Boolean = false) {
        val nm = ctx.getSystemService(NotificationManager::class.java) ?: return
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel("alarm") == null)
            nm.createNotificationChannel(NotificationChannel("alarm", "Alarm", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Stop or snooze an alarm"; setSound(null, null) })
        val alarmUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM)
            ?: android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE)
        if (sound && Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel("alarm_sound") == null)
            nm.createNotificationChannel(NotificationChannel("alarm_sound", "Alarm sound (backup)", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Rings when the radio can't start for an alarm"
                setSound(alarmUri, android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_ALARM)
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                enableVibration(true); setBypassDnd(true) })
        val stop = pending(ctx, AlarmReceiver.STOP, s.id, 6000 + s.id)
        val snooze = pending(ctx, AlarmReceiver.SNOOZE, s.id, 7000 + s.id)
        val open = PendingIntent.getActivity(ctx, 9, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val title = s.name.ifBlank { "Alarm" } + " · " + timeLabel(s.hour, s.minute, android.text.format.DateFormat.is24HourFormat(ctx))
        val text = if (tone) "The radio isn't answering, so the alarm sound is ringing." else s.station?.optString("name")?.ifBlank { null } ?: "Radio Velvet"
        val n = NotificationCompat.Builder(ctx, if (sound) "alarm_sound" else "alarm").setSmallIcon(R.drawable.ic_logo_mark).setContentTitle(title).setContentText(text)
            .apply { if (sound) { setSound(alarmUri, android.media.AudioManager.STREAM_ALARM); setVibrate(longArrayOf(0, 800, 600)) } }
            .setCategory(NotificationCompat.CATEGORY_ALARM).setPriority(NotificationCompat.PRIORITY_MAX).setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC).setContentIntent(open)
            .addAction(0, "Stop", stop).addAction(0, "Snooze $SNOOZE_MIN min", snooze).setTimeoutAfter(RING_MAX_MS).build()
        if (sound) n.flags = n.flags or android.app.Notification.FLAG_INSISTENT     // keeps ringing until Stop / Snooze
        if (!nm.areNotificationsEnabled()) AlarmLog.note(ctx, "notifications are off for Radio Velvet")
        try { if (sound) nm.cancel(NOTE_ID); nm.notify(NOTE_ID, n) } catch (e: SecurityException) { AlarmLog.note(ctx, "can't show the alarm: $e") }
    }
    fun clearRinging(ctx: Context) { ctx.getSystemService(NotificationManager::class.java)?.cancel(NOTE_ID) }
}

/** Rings the alarm; checks its station 2 minutes before; Stop / Snooze; puts alarms back after a restart, a time change or an update. */
class AlarmReceiver : BroadcastReceiver() {
    companion object {
        const val RING = "com.ranjithkb.radio.ALARM"
        const val SNOOZED = "com.ranjithkb.radio.ALARM_SNOOZED"
        const val CHECK = "com.ranjithkb.radio.ALARM_CHECK"
        const val STOP = "com.ranjithkb.radio.ALARM_STOP"
        const val SNOOZE = "com.ranjithkb.radio.ALARM_SNOOZE"
        const val GUARD = "com.ranjithkb.radio.ALARM_GUARD"
    }

    override fun onReceive(ctx: Context, intent: Intent) {
        val id = intent.getIntExtra("id", 1)
        when (intent.action) {
            RING, SNOOZED -> ring(ctx, id, snoozed = intent.action == SNOOZED)
            CHECK -> {
                val s = Alarm.byId(ctx, id) ?: return
                val streams = s.station?.optJSONArray("streams")?.let { a -> (0 until a.length()).map { a.getString(it) } }
                if (streams.isNullOrEmpty()) return
                val done = goAsync()
                Thread { try { Alarm.markChecked(ctx, id, Alarm.streamAnswers(streams)) } finally { done.finish() } }.start()
            }
            GUARD -> {
                if (!Alarm.guardShouldRing(ctx, id)) return
                val s = Alarm.byId(ctx, id) ?: return
                AlarmLog.note(ctx, "guard ${id}: nothing played in ${Alarm.GUARD_MS / 1000} s, ringing the alarm sound")
                Alarm.markAnswered(ctx)
                Alarm.showRinging(ctx, s, tone = true, sound = true)
            }
            STOP, SNOOZE -> {
                Alarm.markAnswered(ctx)
                if (intent.action == SNOOZE) Alarm.snooze(ctx, id)
                Alarm.clearRinging(ctx)
                send(ctx, PlaybackService.ALARM_STOP, Bundle())
            }
            else -> Alarm.schedule(ctx)     // restart, time change, app update
        }
    }

    private fun ring(ctx: Context, id: Int, snoozed: Boolean) {
        val s = Alarm.byId(ctx, id) ?: run { AlarmLog.note(ctx, "fired $id: no such alarm"); return }
        if (!s.on && !snoozed) { AlarmLog.note(ctx, "fired $id: it's off"); return }
        AlarmLog.note(ctx, "fired $id" + if (snoozed) " (snooze)" else "")
        Alarm.markFired(ctx, id); Alarm.setGuard(ctx, id)        // whatever happens next, something rings
        if (!snoozed) {
            // a one-off alarm switches itself off; repeating ones are set for their next day
            if (s.days.isEmpty()) Alarm.save(ctx, s.copy(on = false)) else Alarm.schedule(ctx)
        }
        Alarm.showRinging(ctx, s, tone = false)
        val args = Bundle().apply {
            putInt("id", s.id); putString("station", s.station?.toString()); putInt("fade", s.fadeSec); putInt("volume", s.volume)
            putString("backup", s.backup); putBoolean("down", Alarm.knownDown(ctx, s.id)) }
        send(ctx, PlaybackService.ALARM, args)
    }

    private fun send(ctx: Context, cmd: String, args: Bundle) {
        val done = goAsync()
        val app = ctx.applicationContext
        val f = MediaController.Builder(app, SessionToken(app, ComponentName(app, PlaybackService::class.java))).buildAsync()
        f.addListener({
            try {
                val c = f.get()
                val r = c.sendCustomCommand(SessionCommand(cmd, Bundle.EMPTY), args)
                r.addListener({
                    val code = runCatching { r.get().resultCode }.getOrDefault(-999)
                    if (code != androidx.media3.session.SessionResult.RESULT_SUCCESS) AlarmLog.note(app, "player said $code to $cmd")
                    c.release(); done.finish() }, MoreExecutors.directExecutor())
            } catch (e: Exception) { AlarmLog.note(app, "couldn't reach the player for $cmd: ${e.cause ?: e}"); done.finish() }
        }, MoreExecutors.directExecutor())
    }
}

/** What the last alarms did (kept on the phone, last 30 lines): for the tests, and for "why didn't it play?". */
object AlarmLog {
    private fun p(ctx: Context) = ctx.getSharedPreferences("alarmlog", Context.MODE_PRIVATE)
    fun note(ctx: Context, line: String) {
        android.util.Log.i("VELVET-ALARM", line)
        val t = java.text.SimpleDateFormat("dd MMM HH:mm:ss", java.util.Locale.UK).format(java.util.Date())
        val l = (listOf("$t  $line") + all(ctx)).take(30)
        p(ctx).edit().putString("l", JSONArray(l).toString()).apply()
    }
    fun all(ctx: Context): List<String> = runCatching { JSONArray(p(ctx).getString("l", "[]")).let { a -> (0 until a.length()).map { a.getString(it) } } }.getOrDefault(emptyList())
}

/**
 * What started or stopped the radio lately, and who asked (the app, lock screen, car, Bluetooth, Android Auto, the
 * "resume after other apps" helper, reconnecting…). Kept on the phone (last 40 lines); Info → hold the version line.
 */
object PlayLog {
    @Volatile var who: String = "app"
    private fun p(ctx: Context) = ctx.getSharedPreferences("playlog", Context.MODE_PRIVATE)
    fun note(ctx: Context, line: String) {
        android.util.Log.i("VELVET-PLAY", line)
        val t = java.text.SimpleDateFormat("dd MMM HH:mm:ss", java.util.Locale.UK).format(java.util.Date())
        val l = (listOf("$t  $line") + all(ctx)).take(40)
        p(ctx).edit().putString("l", JSONArray(l).toString()).apply()
        who = "app"
    }
    fun all(ctx: Context): List<String> = runCatching { JSONArray(p(ctx).getString("l", "[]")).let { a -> (0 until a.length()).map { a.getString(it) } } }.getOrDefault(emptyList())
}
