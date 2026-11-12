package com.ranjithkb.radionative

import android.content.Context
import android.view.ContextThemeWrapper
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.platform.LocalContext
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.mediarouter.app.MediaRouteChooserDialog
import androidx.mediarouter.app.MediaRouteControllerDialog
import com.google.android.gms.cast.CastMediaControlIntent
import com.google.android.gms.cast.framework.CastContext
import com.google.android.gms.cast.framework.CastOptions
import com.google.android.gms.cast.framework.CastState
import com.google.android.gms.cast.framework.CastStateListener
import com.google.android.gms.cast.framework.OptionsProvider
import com.google.android.gms.cast.framework.SessionProvider

/** Cast uses Google's standard receiver: it plays the station's stream address directly. */
class VelvetCastOptions : OptionsProvider {
    override fun getCastOptions(context: Context): CastOptions = CastOptions.Builder()
        .setReceiverApplicationId(CastMediaControlIntent.DEFAULT_MEDIA_RECEIVER_APPLICATION_ID)
        .setStopReceiverApplicationWhenEndingSession(true)
        .build()
    override fun getAdditionalSessionProviders(context: Context): List<SessionProvider>? = null
}

object Cast {
    /** null on phones without Google Play services (then there's no Cast button). */
    fun context(ctx: Context): CastContext? = try {
        @Suppress("DEPRECATION") CastContext.getSharedInstance(ctx.applicationContext)
    } catch (e: Throwable) { null }

    /** Opens the list of TVs and speakers (or, while casting, the cast controls with "Stop casting"). */
    fun open(ctx: Context, dark: Boolean) {
        val cc = context(ctx) ?: return
        val themed = ContextThemeWrapper(ctx, if (dark) androidx.appcompat.R.style.Theme_AppCompat_NoActionBar
            else androidx.appcompat.R.style.Theme_AppCompat_Light_NoActionBar)
        try {
            if (cc.castState == CastState.CONNECTED) MediaRouteControllerDialog(themed).show()
            else MediaRouteChooserDialog(themed).apply { routeSelector = cc.mergedSelector ?: return; show() }
        } catch (e: Throwable) {
            android.widget.Toast.makeText(ctx, "Cast isn't available on this phone", android.widget.Toast.LENGTH_SHORT).show()
        }
    }

    /** The cast receiver needs to be told what kind of stream it is. */
    fun forCast(item: MediaItem): MediaItem {
        val uri = item.localConfiguration?.uri ?: item.requestMetadata.mediaUri ?: return item
        val type = when {
            uri.toString().contains(".m3u8", true) -> MimeTypes.APPLICATION_M3U8
            uri.toString().contains("aac", true) -> MimeTypes.AUDIO_AAC
            else -> MimeTypes.AUDIO_MPEG
        }
        return item.buildUpon().setUri(uri).setMimeType(type).build()
    }
}

/** Cast state for the UI: has Cast at all, and is it casting now. */
class CastUi(val available: Boolean, val connected: Boolean)

@Composable
fun rememberCast(): CastUi {
    val ctx = LocalContext.current
    val cc = remember { Cast.context(ctx) }
    var state by remember { mutableStateOf(cc?.castState ?: CastState.NO_DEVICES_AVAILABLE) }
    DisposableEffect(cc) {
        val l = CastStateListener { state = it }
        cc?.addCastStateListener(l)
        onDispose { cc?.removeCastStateListener(l) }
    }
    return CastUi(cc != null, state == CastState.CONNECTED || state == CastState.CONNECTING)
}
