package com.ranjithkb.radio;

import android.content.Intent;
import android.net.Uri;

import androidx.browser.customtabs.CustomTabsIntent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Google won't sign in inside an app's built-in browser, and the page's sign-in popup has
 * nowhere to go in the app. So the page asks this plugin to sign in: it opens a secure Chrome
 * tab on ranjithkb.com/auth-app.html, which signs in with Google as on the website and returns
 * the Google tokens to com.ranjithkb.radio://auth. That link reopens the app (see the intent
 * filter in AndroidManifest.xml) and the tokens go back to the page, which signs in with them.
 */
@CapacitorPlugin(name = "RadioAuth")
public class RadioAuthPlugin extends Plugin {

    private static final String START = "https://ranjithkb.com/auth-app.html?start=1";
    private String pendingCallId = null;

    @PluginMethod
    public void signIn(PluginCall call) {
        // a sign-in already waiting is abandoned
        rejectPending("cancelled");
        call.setKeepAlive(true);
        bridge.saveCall(call);
        pendingCallId = call.getCallbackId();
        try {
            CustomTabsIntent tab = new CustomTabsIntent.Builder().setShowTitle(true).build();
            tab.launchUrl(getActivity(), Uri.parse(START));
        } catch (Exception e) {
            // no Custom Tabs browser: fall back to the default browser
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(START)));
            } catch (Exception e2) {
                rejectPending("failed");
            }
        }
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        Uri uri = intent == null ? null : intent.getData();
        if (uri == null || !"com.ranjithkb.radio".equals(uri.getScheme()) || !"auth".equals(uri.getHost())) return;
        PluginCall call = pendingCall();
        if (call == null) return;
        // tokens come back in the fragment: #id_token=…&access_token=…  (or #error=…)
        Uri q = Uri.parse("x://x?" + (uri.getEncodedFragment() == null ? "" : uri.getEncodedFragment()));
        String error = q.getQueryParameter("error");
        String idToken = q.getQueryParameter("id_token");
        String accessToken = q.getQueryParameter("access_token");
        finish(call);
        if (error != null && !error.isEmpty()) { call.reject(error, error); return; }
        if ((idToken == null || idToken.isEmpty()) && (accessToken == null || accessToken.isEmpty())) {
            call.reject("no sign-in came back", "failed"); return;
        }
        JSObject ret = new JSObject();
        ret.put("idToken", idToken == null ? "" : idToken);
        ret.put("accessToken", accessToken == null ? "" : accessToken);
        call.resolve(ret);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // Back in the app without the sign-in link (tab closed / back pressed): give up after a
        // moment, so the page isn't left waiting. A real hand-off arrives via onNewIntent first.
        if (pendingCallId == null) return;
        final String id = pendingCallId;
        getBridge().executeOnMainThread(() -> getBridge().getWebView().postDelayed(() -> {
            if (id.equals(pendingCallId)) rejectPending("cancelled");
        }, 1500));
    }

    private PluginCall pendingCall() {
        return pendingCallId == null ? null : bridge.getSavedCall(pendingCallId);
    }

    private void finish(PluginCall call) {
        pendingCallId = null;
        call.setKeepAlive(false);
        bridge.releaseCall(call);
    }

    private void rejectPending(String why) {
        PluginCall call = pendingCall();
        if (call == null) { pendingCallId = null; return; }
        finish(call);
        call.reject(why, why);
    }
}
