package com.ranjithkb.radionative

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import androidx.media3.session.MediaController
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * Wake up to a station. Days are a set of Calendar.DAY_OF_WEEK values (empty = once). Survives restarts.
 * When it goes off, the player fades in from silence; if the station doesn't answer, a soft alarm tone plays instead.
 */
object Alarm {
    data class Setup(val on: Boolean, val hour: Int, val minute: Int, val days: Set<Int>, val station: JSONObject?,
                     val fadeSec: Int, val volume: Int)

    private fun p(ctx: Context) = ctx.getSharedPreferences("alarm", Context.MODE_PRIVATE)

    fun load(ctx: Context): Setup {
        val pr = p(ctx)
        return Setup(pr.getBoolean("on", false), pr.getInt("hour", 7), pr.getInt("minute", 0),
            pr.getString("days", "2,3,4,5,6")!!.split(',').mapNotNull { it.toIntOrNull() }.filter { it in 1..7 }.toSet(),
            pr.getString("station", null)?.let { runCatching { JSONObject(it) }.getOrNull() },
            pr.getInt("fade", 60), pr.getInt("volume", 70).coerceIn(20, 100))
    }

    fun save(ctx: Context, s: Setup) {
        p(ctx).edit().putBoolean("on", s.on).putInt("hour", s.hour).putInt("minute", s.minute)
            .putString("days", s.days.sorted().joinToString(",")).putString("station", s.station?.toString())
            .putInt("fade", s.fadeSec).putInt("volume", s.volume).apply()
        schedule(ctx)
    }

    fun stationJson(st: Station, lang: String): JSONObject = JSONObject().put("id", st.id).put("col", st.col).put("name", st.name)
        .put("lang", lang).put("streams", JSONArray(st.streams))

    /** The next time the alarm should ring, after [now]. Pure, so it can be tested. */
    fun next(now: Calendar, hour: Int, minute: Int, days: Set<Int>): Calendar {
        val c = (now.clone() as Calendar).apply { set(Calendar.HOUR_OF_DAY, hour); set(Calendar.MINUTE, minute); set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0) }
        if (!c.after(now)) c.add(Calendar.DAY_OF_YEAR, 1)
        if (days.isNotEmpty()) repeat(7) { if (c.get(Calendar.DAY_OF_WEEK) !in days) c.add(Calendar.DAY_OF_YEAR, 1) }
        return c
    }

    fun canExact(ctx: Context): Boolean = Build.VERSION.SDK_INT < 31 ||
        (ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager).canScheduleExactAlarms()

    private fun pending(ctx: Context) = PendingIntent.getBroadcast(ctx, 7, Intent(ctx, AlarmReceiver::class.java).setAction(AlarmReceiver.RING),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

    fun schedule(ctx: Context) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val s = load(ctx)
        am.cancel(pending(ctx))
        if (!s.on) return
        val at = next(Calendar.getInstance(), s.hour, s.minute, s.days).timeInMillis
        try {
            if (canExact(ctx)) {
                val show = PendingIntent.getActivity(ctx, 8, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
                am.setAlarmClock(AlarmManager.AlarmClockInfo(at, show), pending(ctx))
            } else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(ctx))   // may be a few minutes late
        } catch (e: SecurityException) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(ctx)) }
    }

    /** "Mon–Fri", "Every day", "Once", "Sat, Sun" … */
    fun daysLabel(days: Set<Int>): String {
        val names = mapOf(Calendar.MONDAY to "Mon", Calendar.TUESDAY to "Tue", Calendar.WEDNESDAY to "Wed", Calendar.THURSDAY to "Thu",
            Calendar.FRIDAY to "Fri", Calendar.SATURDAY to "Sat", Calendar.SUNDAY to "Sun")
        val week = (2..6).toSet()
        return when {
            days.isEmpty() -> "Once"
            days.size == 7 -> "Every day"
            days == week -> "Mon–Fri"
            days == setOf(1, 7) -> "Weekends"
            else -> listOf(2, 3, 4, 5, 6, 7, 1).filter { it in days }.joinToString(", ") { names[it]!! }
        }
    }
}

/** Rings the alarm, and puts it back after a restart, a time change or an app update. */
class AlarmReceiver : BroadcastReceiver() {
    companion object { const val RING = "com.ranjithkb.radio.ALARM" }

    override fun onReceive(ctx: Context, intent: Intent) {
        if (intent.action != RING) { Alarm.schedule(ctx); return }
        val s = Alarm.load(ctx)
        if (!s.on) return
        // one-off alarms switch themselves off; repeating ones are set for the next day
        if (s.days.isEmpty()) Alarm.save(ctx, s.copy(on = false)) else Alarm.schedule(ctx)
        val done = goAsync()
        val app = ctx.applicationContext
        val f = MediaController.Builder(app, SessionToken(app, ComponentName(app, PlaybackService::class.java))).buildAsync()
        f.addListener({
            try {
                val c = f.get()
                val args = Bundle().apply {
                    putString("station", s.station?.toString()); putInt("fade", s.fadeSec); putInt("volume", s.volume) }
                c.sendCustomCommand(SessionCommand(PlaybackService.ALARM, Bundle.EMPTY), args)
                    .addListener({ c.release(); done.finish() }, MoreExecutors.directExecutor())
            } catch (e: Exception) { done.finish() }
        }, MoreExecutors.directExecutor())
    }
}
