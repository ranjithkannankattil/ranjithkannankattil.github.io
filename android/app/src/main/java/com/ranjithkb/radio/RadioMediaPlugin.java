package com.ranjithkb.radio;

import android.content.Intent;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges the web page's navigator.mediaSession calls (via js/app-bridge.js on the site)
 * to a native foreground service, so playback survives the screen turning off and
 * shows notification / lock-screen / headset controls.
 */
@CapacitorPlugin(name = "RadioMedia")
public class RadioMediaPlugin extends Plugin {

    private static RadioMediaPlugin instance;

    @Override
    public void load() {
        instance = this;
        // Runs before the WebView loads, so the bridge script is injected at document start
        // of every ranjithkb.com page (file lives in www/, copied to assets/public/).
        getBridge().injectScriptBeforeLoad("app-bridge.js");
    }

    /** Called by the service when a notification, lock-screen or headset button is pressed. */
    static void dispatchAction(String action) {
        RadioMediaPlugin p = instance;
        if (p == null) return;
        JSObject data = new JSObject();
        data.put("action", action);
        p.notifyListeners("action", data);
    }

    @PluginMethod
    public void setMetadata(PluginCall call) {
        RadioMediaService.setMeta(
            call.getString("title", ""),
            call.getString("artist", ""),
            call.getString("album", ""),
            call.getString("artwork", ""));
        send(false);
        call.resolve();
    }

    @PluginMethod
    public void setPlaybackState(PluginCall call) {
        String state = call.getString("state", "none");
        RadioMediaService.setState(state);
        send("playing".equals(state));
        call.resolve();
    }

    @PluginMethod
    public void setActions(PluginCall call) {
        RadioMediaService.setSkips(
            Boolean.TRUE.equals(call.getBoolean("previoustrack", false)),
            Boolean.TRUE.equals(call.getBoolean("nexttrack", false)));
        send(false);
        call.resolve();
    }

    private void send(boolean foreground) {
        Intent i = new Intent(getContext(), RadioMediaService.class);
        i.setAction(RadioMediaService.CMD_REFRESH);
        try {
            if (foreground && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(i);
            } else if (RadioMediaService.isRunning() || foreground) {
                getContext().startService(i);
            }
        } catch (Exception ignored) {
            // Starting a service can fail if the app is already in the background; ignore.
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            getContext().stopService(new Intent(getContext(), RadioMediaService.class));
        } catch (Exception ignored) { }
        if (instance == this) instance = null;
    }
}
