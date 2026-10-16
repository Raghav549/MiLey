package space.mileymusic.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.IBinder;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

/**
 * MiLey Native Android Foreground Media Playback Service
 * Keeps audio playing continuously when the user closes or backgrounds the app,
 * displaying transport controls (Prev / Play-Pause / Next) and Song Theme info.
 */
public class MusicPlaybackService extends Service {

    private static final String CHANNEL_ID = "miley_playback_channel";
    private static final int NOTIFICATION_ID = 1001;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String trackJson = intent != null ? intent.getStringExtra("track_json") : "{}";
        String title = "MiLey — Global Beats";
        String artist = "mileymusic.space";
        String themeName = "Cyber Neon Pulse";
        String primaryColor = "#00E0A8";
        boolean isPlaying = true;

        try {
            if (trackJson != null) {
                JSONObject obj = new JSONObject(trackJson);
                title = obj.optString("title", title);
                artist = obj.optString("artist", artist);
                themeName = obj.optString("themeName", themeName);
                primaryColor = obj.optString("primaryColor", primaryColor);
                isPlaying = obj.optBoolean("isPlaying", true);
            }
        } catch (Exception ignored) {
        }

        Notification notification = buildNotification(title, artist, themeName, primaryColor, isPlaying);
        startForeground(NOTIFICATION_ID, notification);
        return START_STICKY;
    }

    private Notification buildNotification(
            String title,
            String artist,
            String themeName,
            String primaryHex,
            boolean isPlaying
    ) {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentPending = PendingIntent.getActivity(
                this,
                0,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        PendingIntent prevPending = buildCommandIntent("PREV", 1);
        PendingIntent togglePending = buildCommandIntent("TOGGLE_PLAY", 2);
        PendingIntent nextPending = buildCommandIntent("NEXT", 3);

        int accentColor = Color.parseColor("#00E0A8");
        try {
            accentColor = Color.parseColor(primaryHex);
        } catch (Exception ignored) {
        }

        return new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(title)
                .setContentText(artist + " · " + themeName)
                .setSubText("mileymusic.space")
                .setColor(accentColor)
                .setColorized(true)
                .setOngoing(isPlaying)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setContentIntent(contentPending)
                .addAction(android.R.drawable.ic_media_previous, "Previous", prevPending)
                .addAction(
                        isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                        isPlaying ? "Pause" : "Play",
                        togglePending
                )
                .addAction(android.R.drawable.ic_media_next, "Next", nextPending)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .build();
    }

    private PendingIntent buildCommandIntent(String command, int requestCode) {
        Intent i = new Intent(MainActivity.ACTION_PLAYER_COMMAND);
        i.setPackage(getPackageName());
        i.putExtra(MainActivity.EXTRA_COMMAND, command);
        return PendingIntent.getBroadcast(
                this,
                requestCode,
                i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "MiLey Music Playback & Camera Bar",
                    NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Continuous background playback for mileymusic.space");
            channel.setShowBadge(false);
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
