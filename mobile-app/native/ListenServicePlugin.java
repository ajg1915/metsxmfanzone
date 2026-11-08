package com.metsxmfanzone.app;

import android.content.Intent;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the website start and stop the background-audio service: Capacitor.Plugins.ListenService.start({ title }). */
@CapacitorPlugin(name = "ListenService")
public class ListenServicePlugin extends Plugin {
    @Override
    public void load() {
        ListenService.listener = (playing, status) -> {
            JSObject o = new JSObject();
            o.put("playing", playing);
            o.put("status", status);
            notifyListeners("state", o);
        };
    }

    @PluginMethod
    public void setPlaying(PluginCall call) {
        ListenService s = ListenService.instance;
        if (s != null) s.setPlaying(Boolean.TRUE.equals(call.getBoolean("playing", true)));
        call.resolve();
    }

    @PluginMethod
    public void start(PluginCall call) {
        try {
            Intent i = new Intent(getContext(), ListenService.class);
            i.putExtra("title", call.getString("title", "Live stream"));
            try {
                JSArray arr = call.getArray("urls");
                if (arr != null && arr.length() > 0) {
                    String[] urls = new String[arr.length()];
                    for (int k = 0; k < urls.length; k++) urls[k] = arr.getString(k);
                    i.putExtra("urls", urls);
                }
            } catch (Exception ignored) {}
            ContextCompat.startForegroundService(getContext(), i);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not start background audio: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            getContext().stopService(new Intent(getContext(), ListenService.class));
        } catch (Exception ignored) {
        }
        call.resolve();
    }
}
