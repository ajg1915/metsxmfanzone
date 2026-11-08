package com.metsxmfanzone.app;

import android.os.Handler;
import android.os.Looper;

import androidx.mediarouter.app.MediaRouteChooserDialog;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.cast.MediaInfo;
import com.google.android.gms.cast.MediaLoadRequestData;
import com.google.android.gms.cast.MediaMetadata;
import com.google.android.gms.cast.framework.CastContext;
import com.google.android.gms.cast.framework.CastSession;

/** Chromecast from the installed app: NativeCast.cast({ url, title }) opens the device picker and plays the stream. */
@CapacitorPlugin(name = "NativeCast")
public class NativeCastPlugin extends Plugin {
    private final Handler handler = new Handler(Looper.getMainLooper());

    private void loadInto(CastSession s, String url, String title) {
        try {
            MediaMetadata md = new MediaMetadata(MediaMetadata.MEDIA_TYPE_GENERIC);
            md.putString(MediaMetadata.KEY_TITLE, title);
            MediaInfo info = new MediaInfo.Builder(url)
                    .setStreamType(MediaInfo.STREAM_TYPE_LIVE)
                    .setContentType("application/x-mpegURL")
                    .setMetadata(md)
                    .build();
            if (s.getRemoteMediaClient() != null) {
                s.getRemoteMediaClient().load(new MediaLoadRequestData.Builder().setMediaInfo(info).setAutoplay(true).build());
            }
        } catch (Exception ignored) {
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject o = new JSObject();
        try {
            CastContext ctx = CastContext.getSharedInstance(getContext());
            CastSession s = ctx.getSessionManager().getCurrentCastSession();
            o.put("available", true);
            o.put("connected", s != null && s.isConnected());
        } catch (Exception e) {
            o.put("available", false);
            o.put("connected", false);
        }
        call.resolve(o);
    }

    @PluginMethod
    public void cast(PluginCall call) {
        final String url = call.getString("url", "");
        final String title = call.getString("title", "Live Stream");
        getActivity().runOnUiThread(() -> {
            try {
                CastContext ctx = CastContext.getSharedInstance(getContext());
                CastSession s = ctx.getSessionManager().getCurrentCastSession();
                if (s != null && s.isConnected()) {
                    loadInto(s, url, title);
                    call.resolve();
                    return;
                }
                MediaRouteChooserDialog d = new MediaRouteChooserDialog(getActivity());
                d.setRouteSelector(ctx.getMergedSelector());
                d.show();
                // Wait for the viewer to pick a TV, then start the stream on it.
                final long until = System.currentTimeMillis() + 90000;
                handler.post(new Runnable() {
                    @Override public void run() {
                        try {
                            CastSession cs = ctx.getSessionManager().getCurrentCastSession();
                            if (cs != null && cs.isConnected()) { loadInto(cs, url, title); return; }
                        } catch (Exception ignored) {}
                        if (System.currentTimeMillis() < until) handler.postDelayed(this, 1000);
                    }
                });
                call.resolve();
            } catch (Exception e) {
                call.reject("Cast is not available: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            CastContext.getSharedInstance(getContext()).getSessionManager().endCurrentSession(true);
        } catch (Exception ignored) {
        }
        call.resolve();
    }
}
