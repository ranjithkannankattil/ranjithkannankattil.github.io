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
    val ex = Bundle().apply { putStringArrayList("streams", ArrayList(streams)); putInt("try", 0); putString("station", name) }
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
        })
        session = MediaLibrarySession.Builder(this, player, Callback()).build()
        SleepTimer.pause = { player.pause() }
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
            LibraryResult.ofItemList(ImmutableList.copyOf(list), p)
        }
    }

    private fun folder(id: String, title: String) = MediaItem.Builder().setMediaId(id)
        .setMediaMetadata(MediaMetadata.Builder().setTitle(title).setIsBrowsable(true).setIsPlayable(false)
            .setMediaType(MediaMetadata.MEDIA_TYPE_FOLDER_RADIO_STATIONS).build()).build()
        .also { known[id] = it }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo) = session

    override fun onTaskRemoved(rootIntent: android.content.Intent?) {
        if (!player.playWhenReady || player.mediaItemCount == 0) stopSelf()
    }

    override fun onDestroy() {
        scope.cancel(); SleepTimer.pause = null
        session.release(); player.release()
        super.onDestroy()
    }
}
