package com.ranjithkb.radionative

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.widget.RemoteViews
import androidx.compose.ui.graphics.toArgb
import androidx.media3.session.MediaController
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors

/** Home-screen widgets: large (station, song, ⏮ ▶ ⏭) and small (station, ▶). In the chosen theme's colours. */
open class VelvetWidget : AppWidgetProvider() {
    open val layout = R.layout.widget_large

    companion object {
        const val PLAY = "com.ranjithkb.radio.W_PLAY"; const val NEXT = "com.ranjithkb.radio.W_NEXT"; const val PREV = "com.ranjithkb.radio.W_PREV"
        private fun p(ctx: Context) = ctx.getSharedPreferences("widget", Context.MODE_PRIVATE)

        /** Called by the player whenever the station, song or play state changes. */
        fun update(ctx: Context, station: String?, song: String?, playing: Boolean) {
            val pr = p(ctx)
            if (pr.getString("station", null) == station && pr.getString("song", null) == song && pr.getBoolean("playing", false) == playing) return
            pr.edit().putString("station", station).putString("song", song).putBoolean("playing", playing).apply()
            refresh(ctx)
        }

        fun refresh(ctx: Context) {
            val m = AppWidgetManager.getInstance(ctx)
            listOf(VelvetWidget::class.java to R.layout.widget_large, VelvetWidgetSmall::class.java to R.layout.widget_small).forEach { (cls, lay) ->
                val ids = try { m.getAppWidgetIds(ComponentName(ctx, cls)) } catch (e: Exception) { IntArray(0) }
                if (ids.isNotEmpty()) m.updateAppWidget(ids, views(ctx, lay, cls))
            }
        }

        fun views(ctx: Context, lay: Int, cls: Class<*>): RemoteViews {
            Theme.load(ctx)
            val night = (ctx.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
                android.content.res.Configuration.UI_MODE_NIGHT_YES
            val dark = when (Theme.mode) { "light" -> false; "dark" -> true; else -> night }
            val pal = Palettes.of(Theme.themeId, dark)
            val large = lay == R.layout.widget_large
            // large: the theme's bar colour (velvet on Velvet); small: the page colour
            val bg = if (large) pal.bar else pal.paper
            val ink = if (large) pal.barInk else pal.ink
            val soft = if (large) pal.barSoft else pal.soft
            val gold = if (Palettes.contrast(pal.gold, bg) >= 2.2f) pal.gold else ink
            val pr = p(ctx)
            val station = pr.getString("station", null); val song = pr.getString("song", null); val playing = pr.getBoolean("playing", false)
            return RemoteViews(ctx.packageName, lay).apply {
                setInt(R.id.w_bg, "setColorFilter", bg.toArgb())
                setTextViewText(R.id.w_station, station ?: if (large) "Tap play to listen" else "Radio Velvet")
                setTextColor(R.id.w_station, ink.toArgb())
                setInt(R.id.w_logo, "setColorFilter", (if (large) gold else pal.accentText).toArgb())
                setInt(R.id.w_ring, "setColorFilter", gold.toArgb())
                setInt(R.id.w_playicon, "setColorFilter", (if (large) ink else pal.ink).toArgb())
                setImageViewResource(R.id.w_playicon, if (playing) R.drawable.ln_pause else R.drawable.ln_play)
                setContentDescription(R.id.w_playicon, if (playing) "Pause" else "Play")
                setOnClickPendingIntent(R.id.w_play, action(ctx, cls, PLAY))
                val open = PendingIntent.getActivity(ctx, 0, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
                setOnClickPendingIntent(R.id.w_logo, open); setOnClickPendingIntent(R.id.w_station, open)
                if (large) {
                    setInt(R.id.w_artbg, "setColorFilter", androidx.compose.ui.graphics.lerp(bg, ink, 0.1f).toArgb())
                    setTextColor(R.id.w_label, gold.toArgb())
                    setTextViewText(R.id.w_song, song ?: if (station != null) "Live radio" else "")
                    setTextColor(R.id.w_song, soft.toArgb())
                    setInt(R.id.w_prev, "setColorFilter", ink.toArgb()); setInt(R.id.w_next, "setColorFilter", ink.toArgb())
                    setOnClickPendingIntent(R.id.w_prev, action(ctx, cls, PREV)); setOnClickPendingIntent(R.id.w_next, action(ctx, cls, NEXT))
                    setOnClickPendingIntent(R.id.w_open, open)
                }
            }
        }

        private fun action(ctx: Context, cls: Class<*>, a: String) = PendingIntent.getBroadcast(ctx, a.hashCode(),
            Intent(ctx, cls).setAction(a), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    override fun onUpdate(ctx: Context, m: AppWidgetManager, ids: IntArray) { m.updateAppWidget(ids, views(ctx, layout, javaClass)) }

    override fun onReceive(ctx: Context, intent: Intent) {
        val a = intent.action
        if (a != PLAY && a != NEXT && a != PREV) { super.onReceive(ctx, intent); return }
        val done = goAsync()
        val app = ctx.applicationContext
        val f = MediaController.Builder(app, SessionToken(app, ComponentName(app, PlaybackService::class.java))).buildAsync()
        f.addListener({
            try {
                val c = f.get()
                when {
                    c.mediaItemCount == 0 -> c.sendCustomCommand(SessionCommand(PlaybackService.RESUME, Bundle.EMPTY), Bundle.EMPTY)  // last station
                    a == NEXT -> c.seekToNextMediaItem()
                    a == PREV -> c.seekToPreviousMediaItem()
                    c.isPlaying -> c.pause()
                    else -> { c.prepare(); c.play() }
                }
                // give the command a moment to reach the player before letting go
                android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ c.release(); done.finish() }, 1500)
            } catch (e: Exception) { done.finish() }
        }, MoreExecutors.directExecutor())
    }
}

class VelvetWidgetSmall : VelvetWidget() { override val layout = R.layout.widget_small }
