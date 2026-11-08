package com.metsxmfanzone.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioAttributes;
import android.media.MediaMetadata;
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;

/**
 * Plays the live stream's audio in the background (Listen mode) and shows a lock-screen / notification
 * media player with play-pause and stop, so audio keeps going with the screen locked.
 */
public class ListenService extends Service {
    public static volatile boolean running = false;
    public static volatile ListenService instance;
    public interface StateListener { void onState(boolean playing, String status); }
    public static volatile StateListener listener;

    private static final String CHANNEL_ID = "listen_live";
    private static final int NOTIFICATION_ID = 4107;

    private PowerManager.WakeLock wakeLock;
    private MediaPlayer player;
    private MediaSession session;
    private String[] urls = new String[0];
    private int urlIndex = 0;
    private boolean wantPlaying = true;
    private boolean isPlaying = false;
    private String title = "Live stream";
    private Bitmap logo;

    private Bitmap logo() {
        if (logo == null) {
            try { logo = BitmapFactory.decodeResource(getResources(), getResources().getIdentifier("listen_logo", "drawable", getPackageName())); } catch (Exception ignored) {}
        }
        return logo;
    }
    private final Handler handler = new Handler(Looper.getMainLooper());

    private void report(boolean playing, String status) {
        isPlaying = playing;
        updateSession();
        refreshNotification();
        StateListener l = listener;
        if (l != null) l.onState(playing, status);
    }

    private void playCurrent() {
        releasePlayer();
        if (urlIndex >= urls.length) {
            report(false, "error");
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
            player.setOnCompletionListener(mp -> playCurrent());
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
            if (play) player.start(); else player.pause();
            report(play, "ready");
        } catch (Exception ignored) {}
    }

    private void ensureSession() {
        if (session != null) return;
        session = new MediaSession(this, "MetsXMFanZoneListen");
        session.setCallback(new MediaSession.Callback() {
            @Override public void onPlay() { setPlaying(true); }
            @Override public void onPause() { setPlaying(false); }
            @Override public void onStop() { stopFromUser(); }
        });
        session.setActive(true);
    }

    private void updateSession() {
        if (session == null) return;
        session.setMetadata(new MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, "MetsXMFanZone · Live")
                .putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, logo())
                .putBitmap(MediaMetadata.METADATA_KEY_ART, logo())
                .build());
        long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_STOP;
        session.setPlaybackState(new PlaybackState.Builder()
                .setActions(actions)
                .setState(isPlaying ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f)
                .build());
    }

    private void stopFromUser() {
        StateListener l = listener;
        if (l != null) l.onState(false, "stopped");
        stopSelf();
    }

    private PendingIntent actionIntent(String action, int code) {
        return PendingIntent.getService(this, code, new Intent(this, ListenService.class).setAction(action),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private Notification buildNotification() {
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? new Notification.Builder(this, CHANNEL_ID) : new Notification.Builder(this);
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch != null) {
            b.setContentIntent(PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        if (logo() != null) b.setLargeIcon(logo());
        b.setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(title)
                .setContentText("MetsXMFanZone · Listening live")
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setVisibility(Notification.VISIBILITY_PUBLIC)
                .setCategory(Notification.CATEGORY_TRANSPORT);
        b.addAction(new Notification.Action.Builder(
                isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                isPlaying ? "Pause" : "Play", actionIntent("TOGGLE", 2)).build());
        b.addAction(new Notification.Action.Builder(
                android.R.drawable.ic_menu_close_clear_cancel, "Stop", actionIntent("STOP", 1)).build());
        Notification.MediaStyle style = new Notification.MediaStyle().setShowActionsInCompactView(0, 1);
        if (session != null) style.setMediaSession(session.getSessionToken());
        b.setStyle(style);
        return b.build();
    }

    private void refreshNotification() {
        if (!running) return;
        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildNotification());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String act = intent != null ? intent.getAction() : null;
        if ("STOP".equals(act)) { stopFromUser(); return START_NOT_STICKY; }
        if ("TOGGLE".equals(act)) { setPlaying(!isPlaying); return START_NOT_STICKY; }

        String t = intent != null ? intent.getStringExtra("title") : null;
        if (t != null && !t.trim().isEmpty()) title = t;

        NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Listening live", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            nm.createNotificationChannel(ch);
        }
        ensureSession();
        updateSession();

        Notification n = buildNotification();
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
                wakeLock.acquire(6 * 60 * 60 * 1000L);
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
        if (session != null) { try { session.setActive(false); session.release(); } catch (Exception ignored) {} session = null; }
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
