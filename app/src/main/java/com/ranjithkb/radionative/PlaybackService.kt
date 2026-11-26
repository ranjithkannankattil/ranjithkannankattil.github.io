package com.ranjithkb.radionative

import android.net.Uri
import android.os.Bundle
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Metadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.ForwardingPlayer
import androidx.media3.common.Player
import androidx.media3.cast.CastPlayer
import androidx.media3.cast.SessionAvailabilityListener
import androidx.media3.session.SessionCommand
import androidx.media3.session.SessionResult
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.extractor.metadata.icy.IcyInfo
import androidx.media3.session.LibraryResult
import androidx.media3.session.MediaLibraryService
import androidx.media3.session.MediaLibraryService.LibraryParams
import androidx.media3.session.MediaLibraryService.MediaLibrarySession
import androidx.media3.session.MediaSession
import com.google.common.collect.ImmutableList
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.guava.future
import kotlinx.coroutines.launch

/** Station <-> player item. The stream list rides along in the metadata extras. */
fun Station.toItem(language: String): MediaItem {
    // Data saver: the lightest link first (the others stay as backups, lightest next)
    val streams = if (DataSaver.isOn && br.isNotEmpty()) DataSaver.order(streams, br) else streams
    val ex = Bundle().apply { putStringArrayList("streams", ArrayList(streams)); putInt("try", 0); putString("station", name); putString("lang", language) }
    return MediaItem.Builder()
        .setMediaId("st|$key")
        .setUri(streams[0])
        .setRequestMetadata(MediaItem.RequestMetadata.Builder().setMediaUri(Uri.parse(streams[0])).build())
        .setMediaMetadata(MediaMetadata.Builder().setTitle(name).setArtist(language).setStation(name)
            .setIsPlayable(true).setIsBrowsable(false).setMediaType(MediaMetadata.MEDIA_TYPE_RADIO_STATION)
            .setArtworkUri(CarArt.uriFor(key, name))      // the Android Auto picture: logo in a Velvet frame, or a badge
            .setExtras(ex).build())
        .build()
}

/**
 * Plays in the background as a media app: notification, lock screen, headphones, Bluetooth,
 * Android Auto. Phone calls: Android's audio focus pauses for the call and resumes after it.
 */
class PlaybackService : MediaLibraryService() {
    private lateinit var player: ExoPlayer
    private lateinit var session: MediaLibrarySession
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val known = HashMap<String, MediaItem>()   // items shown to Android Auto, by id
    private val siblings = HashMap<String, List<String>>()   // station id -> ids of the list it was picked from
    private var castPlayer: CastPlayer? = null
    private lateinit var local: Player

    /**
     * Cars, Bluetooth buttons and Android Auto send "next" / "previous". For music, "previous" after 3 seconds
     * restarts the song; for live radio that only reconnects the same station. Here they always change station,
     * and wrap round at the ends of the list.
     */
    private class StationSkipper(p: Player, private val onPause: () -> Unit = {}, private val onPlay: () -> Unit = {}) : ForwardingPlayer(p) {
        // Every pause the listener asks for (phone, lock screen, car, Bluetooth, Android Auto) lands here, even when the
        // radio was already stopped by something else: it must cancel any plan to start the sound again later.
        override fun pause() { onPause(); super.pause() }
        override fun setPlayWhenReady(playWhenReady: Boolean) { if (playWhenReady) onPlay() else onPause(); super.setPlayWhenReady(playWhenReady) }
        override fun play() { onPlay(); super.play() }
        private val skips = listOf(Player.COMMAND_SEEK_TO_NEXT, Player.COMMAND_SEEK_TO_PREVIOUS,
            Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM, Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
        override fun getAvailableCommands(): Player.Commands = super.getAvailableCommands().let { c ->
            if (mediaItemCount > 1) c.buildUpon().addAll(*skips.toIntArray()).build() else c }
        override fun isCommandAvailable(command: Int) =
            (mediaItemCount > 1 && command in skips) || super.isCommandAvailable(command)
        override fun hasNextMediaItem() = mediaItemCount > 1
        override fun hasPreviousMediaItem() = mediaItemCount > 1
        private fun go(d: Int) {
            val n = mediaItemCount; if (n < 2) return
            seekToDefaultPosition(((currentMediaItemIndex + d) % n + n) % n)
        }
        override fun seekToNext() = go(1)
        override fun seekToNextMediaItem() = go(1)
        override fun seekToPrevious() = go(-1)
        override fun seekToPreviousMediaItem() = go(-1)
    }

    /** How long to wait between reconnect attempts, and when to stop. Pure, so it can be tested. */
    object Reconnect {
        const val LIMIT_MS = 15 * 60_000L
        private val WAITS = longArrayOf(1_500, 3_000, 5_000, 8_000, 12_000, 20_000, 30_000)
        fun delayMs(n: Int): Long = WAITS[n.coerceIn(0, WAITS.size - 1)]
    }
    companion object { const val CLOSE = "velvet.close"; const val ALARM = "velvet.alarm"; const val ALARM_STOP = "velvet.alarm.stop"; const val ALARM_START = "velvet.alarm.start"; const val RESUME = "velvet.resume"
        /** Sound outputs that mean "the car or a Bluetooth device": when one goes away, the radio pauses. */
        val CAR_OUTPUTS = setOf(android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, android.media.AudioDeviceInfo.TYPE_BLE_HEADSET,
            android.media.AudioDeviceInfo.TYPE_BLE_SPEAKER, android.media.AudioDeviceInfo.TYPE_USB_DEVICE,
            android.media.AudioDeviceInfo.TYPE_USB_ACCESSORY, android.media.AudioDeviceInfo.TYPE_BUS,
            android.media.AudioDeviceInfo.TYPE_HEARING_AID) }
    private lateinit var eq: EqEngine
    private lateinit var resumer: ResumeWatcher
    private var tone: android.media.Ringtone? = null
    private var alarmUntil = 0L
    private val prefListener = android.content.SharedPreferences.OnSharedPreferenceChangeListener { _, k ->
        if (k != null && k.startsWith("eq")) eq.apply()
        if (k == "theme" || k == "mode") VelvetWidget.refresh(this)
    }

    /**
     * An alarm starts the player directly (not through a controller): it becomes a foreground service at once,
     * showing the alarm notification, so Android gives it the sound and doesn't freeze it (Android 15+).
     */
    override fun onStartCommand(intent: android.content.Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ALARM_START) {
            val args = intent.extras ?: Bundle()
            val setup = Alarm.byId(this, args.getInt("id", 1))
            val n = setup?.let { Alarm.ringingNotification(this, it, tone = false) }
            if (n != null) try {
                if (android.os.Build.VERSION.SDK_INT >= 29)
                    startForeground(Alarm.NOTE_ID, n, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
                else startForeground(Alarm.NOTE_ID, n)
                alarmForeground = true
            } catch (e: Exception) { AlarmLog.note(this, "couldn't become a foreground service: $e") }
            ring(args)
            return START_NOT_STICKY
        }
        return super.onStartCommand(intent, flags, startId)
    }
    private var alarmForeground = false
    /** Keeps the phone awake while an alarm rings (it may still be connecting or trying backups with the screen off). */
    private var ringLock: android.os.PowerManager.WakeLock? = null

    // His 9:13 test (21 Nov 2026): when the alarm moved to a backup station the player dropped out of the foreground
    // for a moment and Android froze it. While an alarm rings, it stays in the foreground whatever the player does.
    override fun onUpdateNotification(session: MediaSession, startInForegroundRequired: Boolean) =
        super.onUpdateNotification(session, startInForegroundRequired || ringing)
    private var focusJob: kotlinx.coroutines.Job? = null

    override fun onCreate() {
        super.onCreate()
        Crash.install(this); CarArt.init(this); DataUse.init(this); DataSaver.refresh(this)
        player = ExoPlayer.Builder(this, VelvetRenderers(this))
            .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), /* handleAudioFocus = */ true)
            .setHandleAudioBecomingNoisy(true)          // headphones out: pause
            .setWakeMode(C.WAKE_MODE_NETWORK)
            // short drop-outs (a bridge, a few seconds without signal) are retried quietly while the buffer keeps
            // playing, instead of stopping at the first failed read
            .setMediaSourceFactory(androidx.media3.exoplayer.source.DefaultMediaSourceFactory(
                    androidx.media3.datasource.DefaultDataSource.Factory(this).setTransferListener(DataUse))   // counts this month's data
                .setLoadErrorHandlingPolicy(androidx.media3.exoplayer.upstream.DefaultLoadErrorHandlingPolicy(10)))
            .build()
        applyDataSaver()
        getSystemService(android.media.AudioManager::class.java)?.registerAudioDeviceCallback(outputs, null)
        runCatching { carConn = androidx.car.app.connection.CarConnection(this).also { it.type.observeForever(carObserver) } }
        player.addListener(object : Player.Listener {
            override fun onMetadata(metadata: Metadata) {
                for (i in 0 until metadata.length()) {
                    val e = metadata[i]
                    if (e is IcyInfo && !e.title.isNullOrBlank()) nowPlaying(e.title!!)
                }
            }
            override fun onPlayerError(error: PlaybackException) {
                if (ringing) AlarmLog.note(this@PlaybackService, "station error: ${error.errorCodeName}")
                onFailed(error)
            }
            override fun onAudioSessionIdChanged(audioSessionId: Int) = eq.attach(audioSessionId)
            override fun onPlayWhenReadyChanged(playWhenReady: Boolean, reason: Int) {
                if (reason != Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
                    PlayLog.note(this@PlaybackService, (if (playWhenReady) "playing" else "stopped") + " (" + when (reason) {
                        Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS -> "another app took the sound"
                        Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_BECOMING_NOISY -> "headphones or car unplugged"
                        Player.PLAY_WHEN_READY_CHANGE_REASON_END_OF_MEDIA_ITEM -> "stream ended"
                        Player.PLAY_WHEN_READY_CHANGE_REASON_REMOTE -> "cast device"
                        else -> "reason $reason" } + ")")
                if (playWhenReady) return
                // His 7:50 alarm (21 Nov 2026): another app took the sound the moment it rang, and that used to end
                // the alarm and its backups. An alarm only ends with Stop, Snooze or a pause you press: here the radio
                // asks for the sound back, and if it can't have it the alarm sound rings (the ring loop sees to that).
                if (ringing && reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS) {
                    AlarmLog.note(this@PlaybackService, "another app took the sound; the alarm carries on")
                    focusJob?.cancel()
                    focusJob = scope.launch {         // belongs to this alarm only: Stop or the next alarm cancels it
                        kotlinx.coroutines.delay(2_000)
                        if (ringing && !session.player.playWhenReady) session.player.play()
                        kotlinx.coroutines.delay(6_000)
                        if (ringing && !session.player.isPlaying) startTone()
                    }
                    return
                }
                stopTone(); giveUpReconnect()
                if (ringing) stopRing(pause = false)
                if (System.currentTimeMillis() > alarmUntil) player.volume = 1f
                // another app (a video, a game) took the sound for good: start again once it's quiet, if allowed
                if (reason == Player.PLAY_WHEN_READY_CHANGE_REASON_AUDIO_FOCUS_LOSS) resumer.lostForGood() else resumer.cancel()
            }
            override fun onEvents(p: Player, events: Player.Events) {
                val item = p.currentMediaItem
                val station = item?.mediaMetadata?.extras?.getString("station") ?: item?.mediaMetadata?.station?.toString()
                val title = item?.mediaMetadata?.title?.toString()
                VelvetWidget.update(this@PlaybackService, station, title?.takeIf { it != station }, p.playWhenReady && item != null)
            }
            // listening time: count only while sound is actually playing
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                if (isPlaying) { stopTone(); onAir(); if (ringing) { Alarm.markAnswered(this@PlaybackService); AlarmLog.note(this@PlaybackService, "on air: " + (player.currentMediaItem?.mediaId ?: "")) } }
                val item = player.currentMediaItem
                if (isPlaying && item != null) Listen.start(this@PlaybackService, item.mediaId.removePrefix("st|"),
                    item.mediaMetadata.extras?.getString("station") ?: item.mediaMetadata.station?.toString() ?: "")
                else { Listen.stop(this@PlaybackService); scope.launch { Listen.flushStations(this@PlaybackService, all = true) } }
            }
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                saveQueue(); applyDataSaver()
                // another station (not just the same one reloaded on a different source): start afresh
                if (mediaItem?.mediaId != lastId) { lastId = mediaItem?.mediaId; playedOk = false; giveUpReconnect() }
                mediaItem?.let { Recent.add(this@PlaybackService, it) }
                if (System.currentTimeMillis() > alarmUntil) player.volume = 1f
                if (player.isPlaying && mediaItem != null) Listen.start(this@PlaybackService, mediaItem.mediaId.removePrefix("st|"),
                    mediaItem.mediaMetadata.extras?.getString("station") ?: "")
            }
        })
        eq = EqEngine(this); eq.attach(player.audioSessionId)
        resumer = ResumeWatcher(this, scope) { session.player }
        Theme.prefs(this).registerOnSharedPreferenceChangeListener(prefListener)
        local = StationSkipper(player,
            onPause = { PlayLog.note(this, "pause by " + PlayLog.who); resumer.cancel(); giveUpReconnect(); if (ringing) stopRing(pause = false) },
            onPlay = { PlayLog.note(this, "play by " + PlayLog.who) })
        session = MediaLibrarySession.Builder(this, local, Callback()).build()
        SleepTimer.pause = { session.player.pause() }
        // Cast: when a TV or speaker is picked, the same list carries on there; back on the phone when casting stops
        Cast.context(this)?.let { cc -> try {
            castPlayer = CastPlayer(cc).also { cp -> val castSkip = StationSkipper(cp); cp.setSessionAvailabilityListener(object : SessionAvailabilityListener {
                override fun onCastSessionAvailable() = switchTo(castSkip)
                override fun onCastSessionUnavailable() = switchTo(local)
            }) }
        } catch (e: Throwable) { castPlayer = null } }
        scope.launch { while (true) { kotlinx.coroutines.delay(60_000); Listen.tick(this@PlaybackService) } }
    }

    // ---- resume: the car (Android Auto), Bluetooth play button or the system media controls can start
    // the last station again even when the app isn't running, like Spotify does.
    private fun qp() = getSharedPreferences("queue", MODE_PRIVATE)
    private fun saveQueue() {
        val n = player.mediaItemCount; if (n == 0) return
        val from = (player.currentMediaItemIndex - 150).coerceAtLeast(0); val to = (from + 300).coerceAtMost(n)
        val arr = org.json.JSONArray()
        for (i in from until to) {
            val it = player.getMediaItemAt(i); val md = it.mediaMetadata
            val streams = md.extras?.getStringArrayList("streams") ?: continue
            arr.put(org.json.JSONObject().put("id", it.mediaId)
                .put("name", md.extras?.getString("station") ?: md.station?.toString() ?: md.title?.toString() ?: "")
                .put("lang", md.extras?.getString("lang") ?: "")
                .put("streams", org.json.JSONArray(streams)))
        }
        qp().edit().putString("items", arr.toString()).putInt("at", player.currentMediaItemIndex - from).apply()
    }
    private fun savedQueue(): MediaSession.MediaItemsWithStartPosition? = try {
        val arr = org.json.JSONArray(qp().getString("items", null) ?: return null)
        val list = (0 until arr.length()).map { i -> val o = arr.getJSONObject(i)
            val streams = o.getJSONArray("streams").let { a -> (0 until a.length()).map { a.getString(it) } }
            Station(o.getString("id").removePrefix("st|").substringAfter(':'), o.getString("name"), "", streams,
                    col = o.getString("id").removePrefix("st|").substringBefore(':'))
                .toItem(o.optString("lang")) }
        if (list.isEmpty()) null
        else MediaSession.MediaItemsWithStartPosition(list, qp().getInt("at", 0).coerceIn(0, list.size - 1), C.TIME_UNSET)
    } catch (e: Exception) { null }

    /** Move playback between the phone and a Cast device, keeping the list and the station. */
    private fun switchTo(target: Player) {
        val from = session.player
        if (from === target) return
        val n = from.mediaItemCount
        if (n > 0) {
            val toCast = target !== local
            val at = from.currentMediaItemIndex.coerceAtLeast(0)
            val lo = if (toCast) (at - 50).coerceAtLeast(0) else 0
            val hi = if (toCast) (at + 50).coerceAtMost(n) else n
            val items = (lo until hi).map { from.getMediaItemAt(it) }
                .map { if (toCast) Cast.forCast(it) else it.buildUpon().setMimeType(null).build() }
            val play = toCast && from.playWhenReady
            from.stop()
            target.setMediaItems(items, at - lo, C.TIME_UNSET); target.prepare(); target.playWhenReady = play
        }
        session.player = target
    }

    /** Close (✕ while paused): stop, clear the list and remove the notification. The last station is kept for resuming. */
    private fun closeAll() {
        SleepTimer.off(); resumer.cancel(); stopRing(pause = false); stopTone(); giveUpReconnect()
        val p = session.player
        p.stop(); p.clearMediaItems()
        if (p !== local) { player.stop(); player.clearMediaItems() }
        stopSelf()
    }

    // ---- the alarm, with a safety net so it always wakes you
    // The chosen station (or the last one) fades in. If it doesn't play: its other links, then the backup (your
    // favourites / one chosen station / straight to the alarm sound). The phone's alarm sound starts at the latest
    // Alarm.TONE_AFTER_MS after the alarm time, whatever happens, and stops on its own once the radio is on air.
    // It keeps going until Stop / Snooze / pause, at most Alarm.RING_MAX_MS.
    private var ringing = false

    // ---- leaving the car: pause, and don't let a stray "play" from the car start it on the phone speaker ----
    @Volatile private var carGoneAt = 0L
    private var carType = -1
    private var carConn: androidx.car.app.connection.CarConnection? = null
    private val carObserver = androidx.lifecycle.Observer<Int> { type ->
        val proj = androidx.car.app.connection.CarConnection.CONNECTION_TYPE_PROJECTION
        if (carType == proj && type != proj) carGone("Android Auto disconnected")
        carType = type
    }
    private val outputs = object : android.media.AudioDeviceCallback() {
        override fun onAudioDevicesRemoved(removed: Array<out android.media.AudioDeviceInfo>) {
            val car = removed.firstOrNull { it.isSink && it.type in CAR_OUTPUTS } ?: return
            carGone("sound output gone (type ${car.type})")
        }
    }
    private fun carGone(why: String) {
        carGoneAt = android.os.SystemClock.elapsedRealtime()
        if (ringing || !player.playWhenReady) { PlayLog.note(this, "$why: already paused"); return }
        PlayLog.who = why; player.pause()
    }
    /** True for a play request that arrives in the first 10 s after the car / Bluetooth went away. */
    private fun strayPlay(from: String): Boolean {
        val recent = android.os.SystemClock.elapsedRealtime() - carGoneAt < 10_000
        if (recent && !player.playWhenReady && from != packageName) { PlayLog.note(this, "ignored play from $from right after the car left"); return true }
        return false
    }
    private var ringId = 0
    private var ringJob: kotlinx.coroutines.Job? = null
    private var candidateAt = 0L
    private val candidates = ArrayDeque<MediaItem>()

    private fun itemOf(o: org.json.JSONObject?): MediaItem? = o?.let { runCatching {
        val streams = it.getJSONArray("streams").let { a -> (0 until a.length()).map { a.getString(it) } }
        if (streams.isEmpty()) null
        else Station(it.getString("id"), it.getString("name"), "", streams, col = it.getString("col")).toItem(it.optString("lang")) }.getOrNull() }

    /** Who to try after the alarm's station: pure order rules, testable. */
    private fun backups(backup: String, primaryKey: String?): List<MediaItem> {
        if (backup == "tone") return emptyList()
        val picked = if (backup != "auto") itemOf(runCatching { org.json.JSONObject(backup) }.getOrNull()) else null
        val favs = Favs(this).all().map { it.toItem("") }
        val recent = Recent.all(this).map { it.station.toItem(it.lang) }
        val l = (listOfNotNull(picked) + favs + recent).distinctBy { it.mediaId }.filter { it.mediaId != primaryKey }
        return l.take(6)
    }

    private fun ring(args: Bundle) {
        stopRing(pause = false)
        resumer.cancel(); giveUpReconnect()
        ringing = true; ringId = args.getInt("id", 1)
        runCatching {
            ringLock?.let { if (it.isHeld) it.release() }
            ringLock = getSystemService(android.os.PowerManager::class.java)
                .newWakeLock(android.os.PowerManager.PARTIAL_WAKE_LOCK, "velvet:alarm")
                .apply { acquire(Alarm.RING_MAX_MS + 6 * 60_000L) }        // never longer than the alarm can ring
        }
        val p = session.player
        val primary = itemOf(args.getString("station")?.let { runCatching { org.json.JSONObject(it) }.getOrNull() })
            ?: savedQueue()?.let { q -> q.mediaItems.getOrNull(q.startIndex) }
        candidates.clear()
        val backup = args.getString("backup") ?: "auto"
        candidates.addAll(backups(backup, primary?.mediaId))
        val down = args.getBoolean("down")
        if (down && primary != null) candidates.addLast(primary)        // the check said it's down: backups first, it last
        val first = if (primary != null && !down) primary else candidates.removeFirstOrNull()
        AlarmLog.note(this, "ring ${ringId}: " + (first?.mediaId ?: "tone") + (if (down) " (station was down)" else "") + ", ${candidates.size} backups")
        val target = (args.getInt("volume", 70).coerceIn(20, 100)) / 100f
        val fade = args.getInt("fade", 60).coerceIn(0, 300)
        val start = System.currentTimeMillis()
        alarmUntil = start + fade * 1000L + Alarm.RING_MAX_MS
        if (first == null) startTone()
        else {
            if (p === local) player.volume = if (fade > 0) 0.05f else target
            p.setMediaItem(first); candidateAt = start; p.prepare(); p.play()
        }
        ringJob = scope.launch {
            val steps = fade * 4
            var i = 0
            var lastNote = 0L
            while (ringing) {
                kotlinx.coroutines.delay(250)
                val now = System.currentTimeMillis()
                val pl = session.player
                if (pl.isPlaying) { if (pl === local && i < steps) { i++; player.volume = 0.05f + (target - 0.05f) * i / steps } }
                else {
                    if ((now - start) / 10_000 != lastNote) { lastNote = (now - start) / 10_000
                        AlarmLog.note(this@PlaybackService, "${(now - start) / 1000} s: not on air yet (" + when (pl.playbackState) {
                            Player.STATE_BUFFERING -> "connecting"; Player.STATE_IDLE -> "idle"; Player.STATE_ENDED -> "ended"; else -> "ready" } +
                            (if (pl.playWhenReady) "" else ", paused") + ")") }
                    // this station has had its chance (stuck connecting): the next one
                    if (now - candidateAt > 9_000 && candidates.isNotEmpty()) nextCandidate()
                    if (now - start > Alarm.TONE_AFTER_MS && !toneOn) startTone()
                }
                // nobody stopped it: the alarm sound ends; a radio that's playing carries on as normal listening
                if (now - start > Alarm.RING_MAX_MS) { stopRing(pause = !pl.isPlaying); break }
            }
        }
    }

    /** The alarm's station and its links all failed (or got stuck): the next backup, or the alarm sound. */
    private fun nextCandidate(): Boolean {
        val n = candidates.removeFirstOrNull()
        if (n == null) { startTone(); return false }
        AlarmLog.note(this, "trying ${n.mediaId}")
        val p = session.player
        p.setMediaItem(n); candidateAt = System.currentTimeMillis(); p.prepare(); p.play()
        return true
    }

    /** Stop / Snooze / pause: everything about the alarm ends (the radio too, unless [pause] is false). */
    private fun stopRing(pause: Boolean) {
        val was = ringing
        ringing = false; ringJob?.cancel(); ringJob = null; focusJob?.cancel(); focusJob = null
        runCatching { ringLock?.let { if (it.isHeld) it.release() } }; ringLock = null; candidates.clear(); stopTone(); alarmUntil = 0
        if (was) { AlarmLog.note(this, "stopped"); if (pause) { session.player.pause(); player.volume = 1f } }
        // the alarm's own foreground notification: let go of it (the radio, if it plays on, has its usual notification)
        if (alarmForeground) { alarmForeground = false
            if (!session.player.isPlaying) runCatching { stopForeground(STOP_FOREGROUND_DETACH) } }
        if (was) Alarm.clearRinging(this)
    }

    private var toneOn = false
    private fun startTone() {
        if (toneOn) return
        toneOn = true
        try {
            val uri = android.media.RingtoneManager.getActualDefaultRingtoneUri(this, android.media.RingtoneManager.TYPE_ALARM)
                ?: android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_ALARM)
                ?: android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_RINGTONE)
            tone = android.media.RingtoneManager.getRingtone(this, uri)?.apply {
                audioAttributes = android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_ALARM).build()
                if (android.os.Build.VERSION.SDK_INT >= 28) isLooping = true
                play() }
            if (ringing) Alarm.byId(this, ringId)?.let { Alarm.showRinging(this, it, tone = true) }
            if (tone?.isPlaying != false) Alarm.markAnswered(this)      // if the sound didn't start, the guard still rings
            AlarmLog.note(this, "tone" + if (tone?.isPlaying == false) " (didn't start)" else "")
        } catch (e: Exception) {
            AlarmLog.note(this, "alarm sound failed: $e")
            // the notification rings it instead (works without the player)
            if (ringing) Alarm.byId(this, ringId)?.let { Alarm.showRinging(this, it, tone = true, sound = true) }
        }
    }
    private fun stopTone() { try { tone?.stop() } catch (e: Exception) { }; tone = null; toneOn = false }

    /** "Artist - Song" from the stream: show it, and look up the cover. */
    private fun nowPlaying(raw: String) {
        val i = player.currentMediaItemIndex
        val item = player.currentMediaItem ?: return
        val station = item.mediaMetadata.extras?.getString("station") ?: item.mediaMetadata.station?.toString() ?: ""
        val parts = raw.split(" - ", limit = 2).map { it.trim() }
        var (artist, song) = if (parts.size == 2) parts[0] to parts[1] else "" to raw.trim()
        // Usual order is "Artist - Song"; some (e.g. Radio Mango) send "Song - Singer, Singer"
        if (parts.size == 2 && song.contains(',') && !artist.contains(',')) { val t = artist; artist = song; song = t }
        if (song.isBlank() || song.equals(station, true)) return
        fun update(art: String?) {
            val cur = player.currentMediaItem ?: return
            if (cur.mediaId != item.mediaId) return
            val md = cur.mediaMetadata.buildUpon().setTitle(song)
                .setArtist(listOf(artist, station).filter { it.isNotBlank() }.joinToString(" · "))
                // the song's cover when found, else the station's picture for the car
                .setArtworkUri(art?.let(Uri::parse) ?: CarArt.uriFor(item.mediaId.removePrefix("st|"), station)).build()
            player.replaceMediaItem(i, cur.buildUpon().setMediaMetadata(md).build())
        }
        update(null)
        scope.launch { Repo.artwork(artist, song)?.let { update(it) } }
    }

    // ---- staying on air through tunnels and patchy signal
    // A station that was playing and loses the network keeps trying, the moment the phone is back online and
    // every few seconds, for up to 15 minutes (then it stops, to save battery and data). Only while the listener
    // still wants it playing: their own pause, another station or closing ends it.
    private var playedOk = false
    private var lastId: String? = null
    private var lostAt = 0L
    private var retryN = 0
    private var retryJob: kotlinx.coroutines.Job? = null
    private var netCb: android.net.ConnectivityManager.NetworkCallback? = null

    private fun onAir() { playedOk = true; lostAt = 0; retryN = 0; retryJob?.cancel(); retryJob = null; unwatchNet() }

    private fun onFailed(error: PlaybackException) {
        val network = error.errorCode in 2000..2999
        if (!player.playWhenReady && !ringing) {                     // paused by the listener: an error now must not start the sound
            PlayLog.note(this, "error while paused (${error.errorCodeName}): stays paused"); return }
        if (playedOk && network) { reconnectLater(); return }        // it was on air: the signal, not the station
        if (nextSource()) return
        if (ringing) { nextCandidate(); return }                     // an alarm can't wait: the next station
        if (network || playedOk) reconnectLater()
    }

    private fun reconnectLater() {
        if (!player.playWhenReady || player.currentMediaItem == null) return
        val now = System.currentTimeMillis()
        if (lostAt == 0L) lostAt = now
        if (now - lostAt > Reconnect.LIMIT_MS) { giveUpReconnect(); return }
        watchNet()
        retryJob?.cancel()
        retryJob = scope.launch { kotlinx.coroutines.delay(Reconnect.delayMs(retryN++)); retryNow() }
    }

    private fun retryNow() {
        retryJob?.cancel(); retryJob = null
        if (!player.playWhenReady || player.playbackState != Player.STATE_IDLE) return
        PlayLog.note(this, "reconnecting after the signal dropped")
        val i = player.currentMediaItemIndex
        val item = player.currentMediaItem ?: return
        val ex = item.mediaMetadata.extras
        val first = ex?.getStringArrayList("streams")?.firstOrNull()
        if (first != null && ex.getInt("try") != 0) {   // start again from the station's main stream
            player.replaceMediaItem(i, item.buildUpon().setUri(first)
                .setMediaMetadata(item.mediaMetadata.buildUpon().setExtras(Bundle(ex).apply { putInt("try", 0) }).build()).build())
        }
        player.prepare(); player.play()
    }

    /** Data saver: HLS streams (Akashvani…) play their lowest level; the setting can change while the radio plays. */
    private fun applyDataSaver() {
        DataSaver.refresh(this)
        val cap = if (DataSaver.isOn) DataSaver.HLS_CAP else Int.MAX_VALUE
        if (player.trackSelectionParameters.maxAudioBitrate != cap)
            player.trackSelectionParameters = player.trackSelectionParameters.buildUpon().setMaxAudioBitrate(cap).build()
    }

    private fun giveUpReconnect() { retryJob?.cancel(); retryJob = null; lostAt = 0; retryN = 0; unwatchNet() }

    /** Back online: try straight away instead of waiting for the next attempt. */
    private fun watchNet() {
        if (netCb != null) return
        val cm = getSystemService(android.net.ConnectivityManager::class.java) ?: return
        val cb = object : android.net.ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: android.net.Network) {
                android.os.Handler(mainLooper).postDelayed({ if (lostAt != 0L) retryNow() }, 800)
            }
        }
        try { cm.registerDefaultNetworkCallback(cb); netCb = cb } catch (e: Exception) { }
    }
    private fun unwatchNet() {
        val cb = netCb ?: return; netCb = null
        try { getSystemService(android.net.ConnectivityManager::class.java)?.unregisterNetworkCallback(cb) } catch (e: Exception) { }
    }

    /** A stream failed: try the station's next source, if it has one. False when there are no more. */
    private fun nextSource(): Boolean {
        if (!player.playWhenReady && !ringing) return false
        val i = player.currentMediaItemIndex
        val item = player.currentMediaItem ?: return false
        val ex = item.mediaMetadata.extras ?: return false
        val streams = ex.getStringArrayList("streams") ?: return false
        val t = ex.getInt("try") + 1
        if (t >= streams.size) return false
        val nex = Bundle(ex).apply { putInt("try", t) }
        PlayLog.note(this, "trying the station's link ${t + 1} of ${streams.size}")
        player.replaceMediaItem(i, item.buildUpon().setUri(streams[t])
            .setMediaMetadata(item.mediaMetadata.buildUpon().setExtras(nex).build()).build())
        player.prepare(); player.play()
        return true
    }

    private inner class Callback : MediaLibrarySession.Callback {
        // who sent the last command (for the play log): the app, the lock screen, the car, Android Auto, Bluetooth…
        override fun onPlayerCommandRequest(s: MediaSession, c: MediaSession.ControllerInfo, playerCommand: Int): Int {
            if (playerCommand == Player.COMMAND_PLAY_PAUSE && strayPlay(c.packageName)) return SessionResult.RESULT_ERROR_PERMISSION_DENIED
            PlayLog.who = c.packageName; return super.onPlayerCommandRequest(s, c, playerCommand)
        }
        override fun onMediaButtonEvent(s: MediaSession, c: MediaSession.ControllerInfo, intent: android.content.Intent): Boolean {
            val key = androidx.core.content.IntentCompat.getParcelableExtra(intent, android.content.Intent.EXTRA_KEY_EVENT, android.view.KeyEvent::class.java)
            if (key != null && key.keyCode in intArrayOf(android.view.KeyEvent.KEYCODE_MEDIA_PLAY, android.view.KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, android.view.KeyEvent.KEYCODE_HEADSETHOOK)
                && strayPlay("button:" + c.packageName)) return true
            PlayLog.who = "button:" + c.packageName; return super.onMediaButtonEvent(s, c, intent)
        }
        override fun onConnect(s: MediaSession, c: MediaSession.ControllerInfo): MediaSession.ConnectionResult =
            MediaSession.ConnectionResult.AcceptedResultBuilder(s)
                .setAvailableSessionCommands(MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS.buildUpon()
                    .add(SessionCommand(CLOSE, Bundle.EMPTY)).add(SessionCommand(ALARM, Bundle.EMPTY)).add(SessionCommand(ALARM_STOP, Bundle.EMPTY))
                    .add(SessionCommand(RESUME, Bundle.EMPTY)).build())
                .build()

        override fun onCustomCommand(s: MediaSession, c: MediaSession.ControllerInfo, cmd: SessionCommand, args: Bundle)
                : ListenableFuture<SessionResult> {
            if (cmd.customAction == CLOSE) { closeAll(); return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS)) }
            if (cmd.customAction == ALARM) { ring(args); return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS)) }
            if (cmd.customAction == ALARM_STOP) { stopRing(pause = true); return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS)) }
            if (cmd.customAction == RESUME) {
                savedQueue()?.let { q -> val p = session.player
                    p.setMediaItems(q.mediaItems, q.startIndex, q.startPositionMs); p.prepare(); p.play() }
                return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS))
            }
            return super.onCustomCommand(s, c, cmd, args)
        }

        override fun onPlaybackResumption(s: MediaSession, c: MediaSession.ControllerInfo)
                : ListenableFuture<MediaSession.MediaItemsWithStartPosition> =
            savedQueue()?.let { Futures.immediateFuture(it) }
                ?: Futures.immediateFailedFuture(UnsupportedOperationException("Nothing played yet"))

        // Android Auto hands over only the station that was tapped. Play it inside the list it came from
        // (Favourites, Velvet Selection or a language), so the car's next / previous buttons work.
        override fun onSetMediaItems(s: MediaSession, c: MediaSession.ControllerInfo, items: MutableList<MediaItem>,
                                     startIndex: Int, startPositionMs: Long)
                : ListenableFuture<MediaSession.MediaItemsWithStartPosition> {
            if (items.size == 1) {
                // a car item carries the list it was shown in ("favs>st|col:id"), so next / previous stay in that list
                val tapped = items[0].mediaId
                val plain = plainId(tapped)
                val ids = siblings[tapped]
                val list = ids?.mapNotNull { id -> known[id]?.let { k -> k.buildUpon().setUri(k.requestMetadata.mediaUri).build() } }
                val at = list?.indexOfFirst { it.mediaId == plain } ?: -1
                if (list != null && list.size > 1 && at >= 0)
                    return Futures.immediateFuture(MediaSession.MediaItemsWithStartPosition(list, at, C.TIME_UNSET))
            }
            return super.onSetMediaItems(s, c, items, startIndex, startPositionMs)
        }

        // Items from the phone app / Android Auto arrive without their stream address: restore it.
        override fun onAddMediaItems(s: MediaSession, c: MediaSession.ControllerInfo, items: MutableList<MediaItem>)
                : ListenableFuture<MutableList<MediaItem>> = Futures.immediateFuture(items.map {
            val id = plainId(it.mediaId)
            val uri = it.requestMetadata.mediaUri ?: known[id]?.requestMetadata?.mediaUri
            val base = known[id] ?: it.buildUpon().setMediaId(id).build()
            base.buildUpon().setUri(uri).build()
        }.toMutableList())

        override fun onGetLibraryRoot(s: MediaLibrarySession, b: MediaSession.ControllerInfo, p: LibraryParams?)
                : ListenableFuture<LibraryResult<MediaItem>> =
            Futures.immediateFuture(LibraryResult.ofItem(folder("root", "Radio"), p))

        override fun onGetItem(s: MediaLibrarySession, b: MediaSession.ControllerInfo, id: String)
                : ListenableFuture<LibraryResult<MediaItem>> =
            Futures.immediateFuture((known[id] ?: known[plainId(id)])?.let { LibraryResult.ofItem(it, null) } ?: LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE))

        override fun onGetChildren(s: MediaLibrarySession, b: MediaSession.ControllerInfo, parent: String,
                                   page: Int, size: Int, p: LibraryParams?)
                : ListenableFuture<LibraryResult<ImmutableList<MediaItem>>> = scope.future {
            val ctx = this@PlaybackService
            val cols = Repo.collections(ctx)
            val list: List<MediaItem> = when {
                parent == "root" -> listOf(folder("favs", "Favourites"), folder("picks", "Velvet Selection")) + cols.map { folder("col|${it.id}", it.name) }
                parent == "favs" -> Favs(ctx).all().map { st -> st.toItem(cols.find { it.id == st.col }?.name ?: "") }
                parent == "picks" -> Repo.picks(ctx).map { st -> st.toItem(cols.find { it.id == st.col }?.name ?: "") }
                parent.startsWith("col|") -> {
                    val id = parent.removePrefix("col|")
                    Repo.stations(ctx, id).filter { !it.offline }.map { it.toItem(cols.find { c -> c.id == id }?.name ?: "") }
                }
                else -> emptyList()
            }
            list.forEach { known[it.mediaId] = it }
            val playable = list.filter { it.mediaMetadata.isPlayable == true }.map { it.mediaId }
            // Each list gets its own ids for the car ("favs>st|…", "picks>st|…"): a station in both Favourites and
            // Velvet Selection then knows which list it was tapped in (the car loads every tab, so one shared id
            // used to end up with whichever list loaded last).
            val shown = list.map { item ->
                if (item.mediaMetadata.isPlayable != true) item
                else item.buildUpon().setMediaId("$parent>${item.mediaId}").build().also { sc ->
                    known[sc.mediaId] = sc; siblings[sc.mediaId] = playable }
            }
            LibraryResult.ofItemList(ImmutableList.copyOf(shown), p)
        }
    }

    /** The station's own id from a car item's list-scoped id ("favs>st|col:id" → "st|col:id"). */
    private fun plainId(id: String) = id.substringAfter('>')

    private fun folder(id: String, title: String) = MediaItem.Builder().setMediaId(id)
        .setMediaMetadata(MediaMetadata.Builder().setTitle(title).setIsBrowsable(true).setIsPlayable(false)
            .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_RADIO_STATIONS).build()).build()
        .also { known[id] = it }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo) = session

    // App swiped away: if the radio is paused (or nothing is loaded) close fully, so the notification goes too
    // (some phones, e.g. Samsung Galaxy A14, otherwise keep it). While playing, it carries on as before.
    override fun onTaskRemoved(rootIntent: android.content.Intent?) {
        val p = session.player
        if (!p.playWhenReady || p.mediaItemCount == 0) { p.stop(); stopSelf() }
    }

    override fun onDestroy() {
        Theme.prefs(this).unregisterOnSharedPreferenceChangeListener(prefListener)
        getSystemService(android.media.AudioManager::class.java)?.unregisterAudioDeviceCallback(outputs)
        carConn?.type?.removeObserver(carObserver)
        stopTone(); eq.release(); giveUpReconnect()
        scope.cancel(); SleepTimer.pause = null
        castPlayer?.setSessionAvailabilityListener(null); castPlayer?.release()
        session.release(); player.release()
        super.onDestroy()
    }
}
