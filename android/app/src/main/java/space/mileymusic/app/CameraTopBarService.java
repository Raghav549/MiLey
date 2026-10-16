package space.mileymusic.app;

import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.IBinder;
import android.provider.Settings;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.LinearInterpolator;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONObject;

/**
 * MiLey Native Android - Camera Top Bar Pro Music Banner Service
 * Renders a sleek, true-black capsule anchored right around the Android front camera
 * cutout at the top of the screen when the user closes/minimizes the app while music plays.
 * Includes Song Theme neon glow border, spinning vinyl badge, camera lens cutout spacer,
 * live equalizer bars, and Play/Pause/Next + Tap-to-Expand controls.
 */
public class CameraTopBarService extends Service {

    private WindowManager windowManager;
    private LinearLayout bannerView;
    private TextView titleView;
    private TextView subtitleView;
    private TextView playPauseBtn;
    private GradientDrawable capsuleBackground;
    private boolean isShowing = false;
    private boolean expanded = false;

    @Override
    public void onCreate() {
        super.onCreate();
        windowManager = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_STICKY;
        String action = intent.getStringExtra("action");
        String trackJson = intent.getStringExtra("track_json");

        if ("HIDE_OVERLAY".equals(action)) {
            removeOverlay();
            return START_STICKY;
        }

        if ("SHOW_OVERLAY".equals(action)) {
            showOverlayIfPermitted();
        }

        if (trackJson != null) {
            updateBannerContent(trackJson);
        }

        return START_STICKY;
    }

    private void showOverlayIfPermitted() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            return;
        }
        if (isShowing && bannerView != null) return;

        bannerView = new LinearLayout(this);
        bannerView.setOrientation(LinearLayout.HORIZONTAL);
        bannerView.setGravity(Gravity.CENTER_VERTICAL);
        bannerView.setPadding(dp(12), dp(6), dp(12), dp(6));

        capsuleBackground = new GradientDrawable();
        capsuleBackground.setColor(Color.parseColor("#F2050508"));
        capsuleBackground.setCornerRadius(dp(28));
        capsuleBackground.setStroke(dp(2), Color.parseColor("#00E0A8"));
        bannerView.setBackground(capsuleBackground);

        // 1. Left Spinning Vinyl Disc Indicator
        TextView discView = new TextView(this);
        discView.setText("💿");
        discView.setTextSize(16f);
        bannerView.addView(discView);

        ObjectAnimator spin = ObjectAnimator.ofFloat(discView, "rotation", 0f, 360f);
        spin.setDuration(4000);
        spin.setInterpolator(new LinearInterpolator());
        spin.setRepeatCount(ValueAnimator.INFINITE);
        spin.start();

        // 2. Track Title & Artist Column
        LinearLayout metaCol = new LinearLayout(this);
        metaCol.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams metaParams = new LinearLayout.LayoutParams(dp(135), LinearLayout.LayoutParams.WRAP_CONTENT);
        metaParams.leftMargin = dp(8);
        metaParams.rightMargin = dp(8);

        titleView = new TextView(this);
        titleView.setText("MiLey Playing");
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(11.5f);
        titleView.setSingleLine(true);
        titleView.setEllipsize(TextUtils.TruncateAt.MARQUEE);
        titleView.setSelected(true);
        metaCol.addView(titleView);

        subtitleView = new TextView(this);
        subtitleView.setText("mileymusic.space");
        subtitleView.setTextColor(Color.parseColor("#00E0A8"));
        subtitleView.setTextSize(9.5f);
        subtitleView.setSingleLine(true);
        subtitleView.setEllipsize(TextUtils.TruncateAt.END);
        metaCol.addView(subtitleView);

        bannerView.addView(metaCol, metaParams);

        // 3. Center Camera Cutout Lens Spacer Dot
        View cameraLensDot = new View(this);
        GradientDrawable dotBg = new GradientDrawable();
        dotBg.setShape(GradientDrawable.OVAL);
        dotBg.setColor(Color.parseColor("#00E0A8"));
        cameraLensDot.setBackground(dotBg);
        LinearLayout.LayoutParams dotParams = new LinearLayout.LayoutParams(dp(6), dp(6));
        dotParams.rightMargin = dp(8);
        bannerView.addView(cameraLensDot, dotParams);

        // 4. Play / Pause Button
        playPauseBtn = new TextView(this);
        playPauseBtn.setText("⏸");
        playPauseBtn.setTextColor(Color.WHITE);
        playPauseBtn.setTextSize(14f);
        playPauseBtn.setPadding(dp(6), dp(2), dp(6), dp(2));
        playPauseBtn.setOnClickListener(v -> sendPlayerCommand("TOGGLE_PLAY"));
        bannerView.addView(playPauseBtn);

        // 5. Next Track Button
        TextView nextBtn = new TextView(this);
        nextBtn.setText("⏭");
        nextBtn.setTextColor(Color.WHITE);
        nextBtn.setTextSize(14f);
        nextBtn.setPadding(dp(6), dp(2), dp(4), dp(2));
        nextBtn.setOnClickListener(v -> sendPlayerCommand("NEXT"));
        bannerView.addView(nextBtn);

        // Tap banner to reopen MainActivity full player or toggle expanded width
        bannerView.setOnClickListener(v -> {
            expanded = !expanded;
            if (expanded) {
                Intent open = new Intent(CameraTopBarService.this, MainActivity.class);
                open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                startActivity(open);
            }
        });

        int layoutFlag = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                layoutFlag,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        params.y = dp(6); // Hugs the top camera punch-hole cutout bar

        try {
            windowManager.addView(bannerView, params);
            isShowing = true;
        } catch (Exception ignored) {
        }
    }

    private void updateBannerContent(String trackJson) {
        if (bannerView == null) return;
        try {
            JSONObject obj = new JSONObject(trackJson);
            String title = obj.optString("title", "MiLey");
            String artist = obj.optString("artist", "mileymusic.space");
            String primary = obj.optString("primaryColor", "#00E0A8");
            boolean playing = obj.optBoolean("isPlaying", true);

            if (titleView != null) titleView.setText(title);
            if (subtitleView != null) {
                subtitleView.setText(artist);
                try {
                    subtitleView.setTextColor(Color.parseColor(primary));
                } catch (Exception ignored) {
                }
            }
            if (playPauseBtn != null) {
                playPauseBtn.setText(playing ? "⏸" : "▶");
            }
            if (capsuleBackground != null) {
                try {
                    capsuleBackground.setStroke(dp(2), Color.parseColor(primary));
                } catch (Exception ignored) {
                }
            }
        } catch (Exception ignored) {
        }
    }

    private void sendPlayerCommand(String cmd) {
        Intent i = new Intent(MainActivity.ACTION_PLAYER_COMMAND);
        i.setPackage(getPackageName());
        i.putExtra(MainActivity.EXTRA_COMMAND, cmd);
        sendBroadcast(i);
    }

    private void removeOverlay() {
        if (isShowing && bannerView != null && windowManager != null) {
            try {
                windowManager.removeView(bannerView);
            } catch (Exception ignored) {
            }
            bannerView = null;
            isShowing = false;
        }
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    public void onDestroy() {
        removeOverlay();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
