package com.metsxmfanzone.app;

import android.content.Intent;

import androidx.core.content.ContextCompat;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the website start and stop the background-audio service: Capacitor.Plugins.ListenService.start({ title }). */
@CapacitorPlugin(name = "ListenService")
public class ListenServicePlugin extends Plugin {
    @PluginMethod
    public void start(PluginCall call) {
        try {
            Intent i = new Intent(getContext(), ListenService.class);
            i.putExtra("title", call.getString("title", "Live stream"));
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
