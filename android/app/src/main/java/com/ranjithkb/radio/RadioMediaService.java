package com.ranjithkb.radio;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Base64;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Foreground "now playing" service. The audio itself plays inside the WebView;
 * this service keeps the process alive with the screen off, holds wake/Wi-Fi locks
 * while playing, and exposes a MediaSession for notification, lock-screen,
 * Bluetooth and headset controls.
 */
public class RadioMediaService extends Service {

    static final String CMD_REFRESH = "com.ranjithkb.radio.REFRESH";
    private static final String CMD_BUTTON = "com.ranjithkb.radio.BUTTON";
    private static final String CHANNEL_ID = "radio_playback";
    private static final int NOTIFICATION_ID = 7;
    /** Let go of the foreground service if left paused this long. */
    private static final long PAUSED_TIMEOUT_MS = 10 * 60 * 1000L;

    // Shared state written by the plugin (any thread), read by the service.
    private static volatile String title = "";
    private static volatile String artist = "";
    private static volatile String album = "";
    private static volatile String artworkUrl = "";
    private static volatile String state = "none";
    private static volatile boolean hasPrev = false;
    private static volatile boolean hasNext = false;
    private static volatile boolean running = false;

    static void setMeta(String t, String a, String al, String art) {
        title = t == null ? "" : t;
        artist = a == null ? "" : a;
        album = al == null ? "" : al;
        artworkUrl = art == null ? "" : art;
    }

    static void setState(String s) { state = s == null ? "none" : s; }

    static void setSkips(boolean prev, boolean next) { hasPrev = prev; hasNext = next; }

    static boolean isRunning() { return running; }

    private MediaSessionCompat session;
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private final Handler main = new Handler(Looper.getMainLooper());
    private String loadedArtworkUrl = null;
    private Bitmap artwork = null;
    private boolean inForeground = false;
    private final Runnable pausedTimeout = this::shutDown;

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        createChannel();

        session = new MediaSessionCompat(this, "RanjithkbRadio");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override public void onPlay() { RadioMediaPlugin.dispatchAction("play"); }
            @Override public void onPause() { RadioMediaPlugin.dispatchAction("pause"); }
            @Override public void onStop() { RadioMediaPlugin.dispatchAction("pause"); shutDown(); }
            @Override public void onSkipToNext() { RadioMediaPlugin.dispatchAction("nexttrack"); }
            @Override public void onSkipToPrevious() { RadioMediaPlugin.dispatchAction("previoustrack"); }
        });
        Intent open = new Intent(this, MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        session.setSessionActivity(PendingIntent.getActivity(this, 0, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        session.setActive(true);

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "radio:playback");
        wakeLock.setReferenceCounted(false);
        WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wm != null) {
            int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
            wifiLock = wm.createWifiLock(mode, "radio:playback");
            wifiLock.setReferenceCounted(false);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && CMD_BUTTON.equals(intent.getAction())) {
            String a = intent.getStringExtra("action");
            if ("close".equals(a)) {
                RadioMediaPlugin.dispatchAction("pause");
                shutDown();
                return START_NOT_STICKY;
            }
            if (a != null) RadioMediaPlugin.dispatchAction(a);
            // Still post the notification so a startForegroundService() call is always honoured.
            refresh();
            return START_NOT_STICKY;
        }
        refresh();
        return START_NOT_STICKY;
    }

    private void refresh() {
        if ("none".equals(state)) {
            shutDown();
            return;
        }
        boolean playing = "playing".equals(state);
        updateSession(playing);
        Notification n = buildNotification(playing);

        if (!inForeground) {
            try {
                ServiceCompat.startForeground(this, NOTIFICATION_ID, n,
                    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                        ? ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK : 0);
                inForeground = true;
            } catch (Exception e) {
                // Not allowed to go foreground right now (app in background on Android 12+).
                NotificationManager nm = getSystemService(NotificationManager.class);
                if (nm != null) nm.notify(NOTIFICATION_ID, n);
            }
        } else {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.notify(NOTIFICATION_ID, n);
        }

        main.removeCallbacks(pausedTimeout);
        if (playing) {
            if (!wakeLock.isHeld()) wakeLock.acquire(6 * 60 * 60 * 1000L);
            if (wifiLock != null && !wifiLock.isHeld()) wifiLock.acquire();
        } else {
            releaseLocks();
            main.postDelayed(pausedTimeout, PAUSED_TIMEOUT_MS);
        }

        maybeLoadArtwork();
    }

    private void updateSession(boolean playing) {
        MediaMetadataCompat.Builder mb = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, artist)
            .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, -1);
        if (artwork != null && artworkUrl.equals(loadedArtworkUrl)) {
            mb.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork);
        }
        session.setMetadata(mb.build());

        long actions = PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
            | PlaybackStateCompat.ACTION_PLAY_PAUSE | PlaybackStateCompat.ACTION_STOP;
        if (hasPrev) actions |= PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;
        if (hasNext) actions |= PlaybackStateCompat.ACTION_SKIP_TO_NEXT;
        session.setPlaybackState(new PlaybackStateCompat.Builder()
            .setActions(actions)
            .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, playing ? 1f : 0f)
            .build());
    }

    private Notification buildNotification(boolean playing) {
        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_radio)
            .setContentTitle(title.isEmpty() ? "Radio" : title)
            .setContentText(artist)
            .setSubText(album)
            .setContentIntent(session.getController().getSessionActivity())
            .setDeleteIntent(button("close", 10))
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setOngoing(playing)
            .setColor(0xFF2F6B4F);
        if (artwork != null && artworkUrl.equals(loadedArtworkUrl)) b.setLargeIcon(artwork);

        int idx = 0;
        int[] compact = new int[3];
        int nc = 0;
        if (hasPrev) {
            b.addAction(android.R.drawable.ic_media_previous, "Previous station", button("previoustrack", 11));
            compact[nc++] = idx++;
        }
        if (playing) {
            b.addAction(android.R.drawable.ic_media_pause, "Pause", button("pause", 12));
        } else {
            b.addAction(android.R.drawable.ic_media_play, "Play", button("play", 13));
        }
        compact[nc++] = idx++;
        if (hasNext) {
            b.addAction(android.R.drawable.ic_media_next, "Next station", button("nexttrack", 14));
            compact[nc++] = idx++;
        }
        b.addAction(android.R.drawable.ic_menu_close_clear_cancel, "Close", button("close", 15));

        int[] shown = new int[nc];
        System.arraycopy(compact, 0, shown, 0, nc);
        b.setStyle(new MediaStyle()
            .setMediaSession(session.getSessionToken())
            .setShowActionsInCompactView(shown));
        return b.build();
    }

    private PendingIntent button(String action, int requestCode) {
        Intent i = new Intent(this, RadioMediaService.class)
            .setAction(CMD_BUTTON)
            .putExtra("action", action);
        return PendingIntent.getService(this, requestCode, i,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void maybeLoadArtwork() {
        final String url = artworkUrl;
        if (url.isEmpty() || url.equals(loadedArtworkUrl)) return;
        loadedArtworkUrl = url;
        artwork = null;
        new Thread(() -> {
            Bitmap bmp = null;
            try {
                if (url.startsWith("data:")) {
                    int comma = url.indexOf(',');
                    if (comma > 0 && url.substring(0, comma).contains(";base64")) {
                        byte[] bytes = Base64.decode(url.substring(comma + 1), Base64.DEFAULT);
                        bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                    }
                } else {
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(5000);
                    c.setReadTimeout(5000);
                    c.setInstanceFollowRedirects(true);
                    try (InputStream in = c.getInputStream()) {
                        bmp = BitmapFactory.decodeStream(in);
                    }
                }
            } catch (Exception ignored) { }
            final Bitmap result = bmp;
            main.post(() -> {
                if (!url.equals(artworkUrl) || result == null || !running) return;
                artwork = result;
                if (!"none".equals(state)) {
                    boolean playing = "playing".equals(state);
                    updateSession(playing);
                    NotificationManager nm = getSystemService(NotificationManager.class);
                    if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification(playing));
                }
            });
        }).start();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Now playing",
                NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Playback controls for the station that's on");
            ch.setShowBadge(false);
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private void releaseLocks() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
    }

    private void shutDown() {
        main.removeCallbacks(pausedTimeout);
        releaseLocks();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.cancel(NOTIFICATION_ID);
        inForeground = false;
        stopSelf();
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // App swiped away: the WebView (and its audio) is gone, so clear the controls.
        shutDown();
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        running = false;
        main.removeCallbacksAndMessages(null);
        releaseLocks();
        if (session != null) {
            session.setActive(false);
            session.release();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
