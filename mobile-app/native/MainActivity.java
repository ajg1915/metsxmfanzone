package com.metsxmfanzone.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ListenServicePlugin.class);
        registerPlugin(NativeCastPlugin.class);
        super.onCreate(savedInstanceState);
        try {
            getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        } catch (Exception ignored) {
        }
    }

    // While the viewer is listening (Listen mode), don't let Android freeze the page when the screen locks.
    private void keepListeningAlive() {
        if (!ListenService.running) return;
        try {
            WebView w = getBridge().getWebView();
            w.onResume();
            w.resumeTimers();
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        keepListeningAlive();
    }

    @Override
    public void onStop() {
        super.onStop();
        keepListeningAlive();
    }
}
