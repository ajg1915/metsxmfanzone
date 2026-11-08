package com.metsxmfanzone.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * Keeps the app alive while a viewer is listening to a live stream (Listen mode on the website), so the
 * audio keeps playing when the screen locks or another app is open. Shows a "Listening live" notification.
 */
public class ListenService extends Service {
    public static volatile boolean running = false;
    private static final String CHANNEL_ID = "listen_live";
    private static final int NOTIFICATION_ID = 4107;
    private PowerManager.WakeLock wakeLock;
    private MediaPlayer player;
    private String[] urls = new String[0];
    private int urlIndex = 0;
    private boolean wantPlaying = true;
    private final android.os.Handler handler = new android.os.Handler(android.os.Looper.getMainLooper());

    public interface StateListener { void onState(boolean playing, String status); }
    public static volatile StateListener listener;
    public static volatile ListenService instance;

    private void report(boolean playing, String status) {
        StateListener l = listener;
        if (l != null) l.onState(playing, status);
    }

    private void playCurrent() {
        releasePlayer();
        if (urlIndex >= urls.length) {
            report(false, "error");
            // live feeds come and go: retry from the start in 15s
            handler.postDelayed(() -> { if (running && wantPlaying) { urlIndex = 0; playCurrent(); } }, 15000);
            return;
        }
        report(false, "loading");
        try {
            player = new MediaPlayer();
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .setUsage(AudioAttributes.USAGE_MEDIA).build());
            player.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
            player.setDataSource(urls[urlIndex]);
            player.setOnPreparedListener(mp -> { if (wantPlaying) mp.start(); report(wantPlaying, "ready"); });
            player.setOnErrorListener((mp, what, extra) -> { urlIndex++; playCurrent(); return true; });
            player.setOnCompletionListener(mp -> { playCurrent(); });
            player.prepareAsync();
        } catch (Exception e) {
            urlIndex++;
            playCurrent();
        }
    }

    private void releasePlayer() {
        if (player != null) { try { player.release(); } catch (Exception ignored) {} player = null; }
    }

    public void setPlaying(boolean play) {
        wantPlaying = play;
        if (player == null) return;
        try {
            if (play) { player.start(); } else { player.pause(); }
            report(play, "ready");
        } catch (Exception ignored) {}
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && "STOP".equals(intent.getAction())) {
            report(false, "stopped");
            stopSelf();
            return START_NOT_STICKY;
        }
        String title = intent != null ? intent.getStringExtra("title") : null;
        if (title == null || title.trim().isEmpty()) title = "Live stream";

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Listening live", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }

        PendingIntent open = null;
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch != null) {
            open = PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        }

        Notification n = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle("MetsXMFanZone · Listening live")
                .setContentText(title)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                .setContentIntent(open)
                .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop",
                        PendingIntent.getService(this, 1, new Intent(this, ListenService.class).setAction("STOP"),
                                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT))
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, n);
        }

        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MetsXMFanZone:listen");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire(6 * 60 * 60 * 1000L); // at most 6 hours
            }
        }
        running = true;
        instance = this;
        String[] u = intent != null ? intent.getStringArrayExtra("urls") : null;
        if (u != null && u.length > 0) {
            urls = u;
            urlIndex = 0;
            wantPlaying = true;
            handler.removeCallbacksAndMessages(null);
            playCurrent();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        instance = null;
        handler.removeCallbacksAndMessages(null);
        releasePlayer();
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
