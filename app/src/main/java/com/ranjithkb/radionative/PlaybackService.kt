package com.ranjithkb.radionative

import android.net.Uri
import android.os.Bundle
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Metadata
import androidx.media3.common.PlaybackException
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
    val ex = Bundle().apply { putStringArrayList("streams", ArrayList(streams)); putInt("try", 0); putString("station", name); putString("lang", language) }
    return MediaItem.Builder()
        .setMediaId("st|$key")
        .setUri(streams[0])
        .setRequestMetadata(MediaItem.RequestMetadata.Builder().setMediaUri(Uri.parse(streams[0])).build())
        .setMediaMetadata(MediaMetadata.Builder().setTitle(name).setArtist(language).setStation(name)
            .setIsPlayable(true).setIsBrowsable(false).setMediaType(MediaMetadata.MEDIA_TYPE_RADIO_STATION)
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

    companion object { const val CLOSE = "velvet.close" }

    override fun onCreate() {
        super.onCreate()
        player = ExoPlayer.Builder(this)
            .setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), /* handleAudioFocus = */ true)
            .setHandleAudioBecomingNoisy(true)          // headphones out: pause
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build()
        player.addListener(object : Player.Listener {
            override fun onMetadata(metadata: Metadata) {
                for (i in 0 until metadata.length()) {
                    val e = metadata[i]
                    if (e is IcyInfo && !e.title.isNullOrBlank()) nowPlaying(e.title!!)
                }
            }
            override fun onPlayerError(error: PlaybackException) = nextSource()
            // listening time: count only while sound is actually playing
            override fun onIsPlayingChanged(isPlaying: Boolean) {
                val item = player.currentMediaItem
                if (isPlaying && item != null) Listen.start(this@PlaybackService, item.mediaId.removePrefix("st|"),
                    item.mediaMetadata.extras?.getString("station") ?: item.mediaMetadata.station?.toString() ?: "")
                else Listen.stop(this@PlaybackService)
            }
            override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
                saveQueue()
                if (player.isPlaying && mediaItem != null) Listen.start(this@PlaybackService, mediaItem.mediaId.removePrefix("st|"),
                    mediaItem.mediaMetadata.extras?.getString("station") ?: "")
            }
        })
        session = MediaLibrarySession.Builder(this, player, Callback()).build()
        SleepTimer.pause = { session.player.pause() }
        // Cast: when a TV or speaker is picked, the same list carries on there; back on the phone when casting stops
        Cast.context(this)?.let { cc -> try {
            castPlayer = CastPlayer(cc).also { cp -> cp.setSessionAvailabilityListener(object : SessionAvailabilityListener {
                override fun onCastSessionAvailable() = switchTo(cp)
                override fun onCastSessionUnavailable() = switchTo(player)
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
            val toCast = target === castPlayer
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
        SleepTimer.off()
        val p = session.player
        p.stop(); p.clearMediaItems()
        if (p !== player) { player.stop(); player.clearMediaItems() }
        stopSelf()
    }

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
                .setArtworkUri(art?.let(Uri::parse)).build()
            player.replaceMediaItem(i, cur.buildUpon().setMediaMetadata(md).build())
        }
        update(null)
        scope.launch { Repo.artwork(artist, song)?.let { update(it) } }
    }

    /** A stream failed: try the station's next source, if it has one. */
    private fun nextSource() {
        val i = player.currentMediaItemIndex
        val item = player.currentMediaItem ?: return
        val ex = item.mediaMetadata.extras ?: return
        val streams = ex.getStringArrayList("streams") ?: return
        val t = ex.getInt("try") + 1
        if (t >= streams.size) return
        val nex = Bundle(ex).apply { putInt("try", t) }
        player.replaceMediaItem(i, item.buildUpon().setUri(streams[t])
            .setMediaMetadata(item.mediaMetadata.buildUpon().setExtras(nex).build()).build())
        player.prepare(); player.play()
    }

    private inner class Callback : MediaLibrarySession.Callback {
        override fun onConnect(s: MediaSession, c: MediaSession.ControllerInfo): MediaSession.ConnectionResult =
            MediaSession.ConnectionResult.AcceptedResultBuilder(s)
                .setAvailableSessionCommands(MediaSession.ConnectionResult.DEFAULT_SESSION_AND_LIBRARY_COMMANDS.buildUpon()
                    .add(SessionCommand(CLOSE, Bundle.EMPTY)).build())
                .build()

        override fun onCustomCommand(s: MediaSession, c: MediaSession.ControllerInfo, cmd: SessionCommand, args: Bundle)
                : ListenableFuture<SessionResult> {
            if (cmd.customAction == CLOSE) { closeAll(); return Futures.immediateFuture(SessionResult(SessionResult.RESULT_SUCCESS)) }
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
                val ids = siblings[items[0].mediaId]
                val list = ids?.mapNotNull { id -> known[id]?.let { k -> k.buildUpon().setUri(k.requestMetadata.mediaUri).build() } }
                val at = list?.indexOfFirst { it.mediaId == items[0].mediaId } ?: -1
                if (list != null && list.size > 1 && at >= 0)
                    return Futures.immediateFuture(MediaSession.MediaItemsWithStartPosition(list, at, C.TIME_UNSET))
            }
            return super.onSetMediaItems(s, c, items, startIndex, startPositionMs)
        }

        // Items from the phone app / Android Auto arrive without their stream address: restore it.
        override fun onAddMediaItems(s: MediaSession, c: MediaSession.ControllerInfo, items: MutableList<MediaItem>)
                : ListenableFuture<MutableList<MediaItem>> = Futures.immediateFuture(items.map {
            val uri = it.requestMetadata.mediaUri ?: known[it.mediaId]?.requestMetadata?.mediaUri
            val base = known[it.mediaId] ?: it
            base.buildUpon().setUri(uri).build()
        }.toMutableList())

        override fun onGetLibraryRoot(s: MediaLibrarySession, b: MediaSession.ControllerInfo, p: LibraryParams?)
                : ListenableFuture<LibraryResult<MediaItem>> =
            Futures.immediateFuture(LibraryResult.ofItem(folder("root", "Radio"), p))

        override fun onGetItem(s: MediaLibrarySession, b: MediaSession.ControllerInfo, id: String)
                : ListenableFuture<LibraryResult<MediaItem>> =
            Futures.immediateFuture(known[id]?.let { LibraryResult.ofItem(it, null) } ?: LibraryResult.ofError(LibraryResult.RESULT_ERROR_BAD_VALUE))

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
            playable.forEach { siblings[it] = playable }
            LibraryResult.ofItemList(ImmutableList.copyOf(list), p)
        }
    }

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
        scope.cancel(); SleepTimer.pause = null
        castPlayer?.setSessionAvailabilityListener(null); castPlayer?.release()
        session.release(); player.release()
        super.onDestroy()
    }
}
