package space.mileymusic.app;

import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.LinearInterpolator;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * MiLey Native Android - Unique Animated Professional Splash Screen
 * Choreographed sonic vinyl rotation, pulsing neon aura rings, 12-bar equalizer,
 * and smooth transition into MainActivity (mileymusic.space).
 */
public class SplashActivity extends Activity {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean launched = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#060609"));
        window.setNavigationBarColor(Color.parseColor("#060609"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }

        // Root container
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#060609"));
        root.setOnClickListener(v -> proceedToMain());

        // Center Sonic Stack
        LinearLayout centerStack = new LinearLayout(this);
        centerStack.setOrientation(LinearLayout.VERTICAL);
        centerStack.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams centerParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
        );
        root.addView(centerStack, centerParams);

        // Pulsing Outer Neon Halo Ring + Spinning Vinyl Emblem
        FrameLayout emblemFrame = new FrameLayout(this);
        int sizePx = dp(164);
        centerStack.addView(emblemFrame, new LinearLayout.LayoutParams(sizePx, sizePx));

        View outerHalo = new View(this);
        GradientDrawable haloDrawable = new GradientDrawable();
        haloDrawable.setShape(GradientDrawable.OVAL);
        haloDrawable.setStroke(dp(2), Color.parseColor("#00E0A8"));
        haloDrawable.setColor(Color.parseColor("#1800E0A8"));
        outerHalo.setBackground(haloDrawable);
        emblemFrame.addView(outerHalo, new FrameLayout.LayoutParams(sizePx, sizePx, Gravity.CENTER));

        // Spinning Vinyl Disc
        TextView vinylCore = new TextView(this);
        int discPx = dp(122);
        GradientDrawable discDrawable = new GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                new int[]{Color.parseColor("#00E0A8"), Color.parseColor("#FF3DAE"), Color.parseColor("#6366F1")}
        );
        discDrawable.setShape(GradientDrawable.OVAL);
        vinylCore.setBackground(discDrawable);
        vinylCore.setText("♫");
        vinylCore.setTextColor(Color.parseColor("#060609"));
        vinylCore.setTextSize(38f);
        vinylCore.setGravity(Gravity.CENTER);
        emblemFrame.addView(vinylCore, new FrameLayout.LayoutParams(discPx, discPx, Gravity.CENTER));

        // 12-Bar Animated Equalizer Row
        LinearLayout eqRow = new LinearLayout(this);
        eqRow.setOrientation(LinearLayout.HORIZONTAL);
        eqRow.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams eqParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                dp(36)
        );
        eqParams.topMargin = dp(20);
        centerStack.addView(eqRow, eqParams);

        for (int i = 0; i < 12; i++) {
            View bar = new View(this);
            GradientDrawable barBg = new GradientDrawable();
            barBg.setCornerRadius(dp(4));
            barBg.setColor(i % 2 == 0 ? Color.parseColor("#00E0A8") : Color.parseColor("#FF3DAE"));
            bar.setBackground(barBg);
            LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(dp(4), dp(12 + (i * 5) % 22));
            bp.leftMargin = dp(3);
            bp.rightMargin = dp(3);
            eqRow.addView(bar, bp);

            ObjectAnimator scaleY = ObjectAnimator.ofFloat(bar, "scaleY", 0.35f, 1.35f, 0.5f, 1.0f);
            scaleY.setDuration(720 + (i * 45));
            scaleY.setRepeatCount(ValueAnimator.INFINITE);
            scaleY.setRepeatMode(ValueAnimator.REVERSE);
            scaleY.start();
        }

        // Brand Title: MiLey
        TextView titleView = new TextView(this);
        titleView.setText("MiLey");
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(42f);
        titleView.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
        );
        titleParams.topMargin = dp(16);
        centerStack.addView(titleView, titleParams);

        // Subtitle
        TextView subtitleView = new TextView(this);
        subtitleView.setText("GLOBAL BEATS · YOUR STAGE");
        subtitleView.setTextColor(Color.parseColor("#00E0A8"));
        subtitleView.setTextSize(11f);
        subtitleView.setLetterSpacing(0.25f);
        subtitleView.setGravity(Gravity.CENTER);
        centerStack.addView(subtitleView);

        // Domain Footer: mileymusic.space
        TextView footerView = new TextView(this);
        footerView.setText("mileymusic.space");
        footerView.setTextColor(Color.parseColor("#9CA3AF"));
        footerView.setTextSize(12f);
        footerView.setGravity(Gravity.CENTER);
        FrameLayout.LayoutParams footerParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL
        );
        footerParams.bottomMargin = dp(36);
        root.addView(footerView, footerParams);

        setContentView(root);

        // Start Choreographed Animations
        ObjectAnimator spin = ObjectAnimator.ofFloat(vinylCore, "rotation", 0f, 360f);
        spin.setDuration(2600);
        spin.setInterpolator(new LinearInterpolator());
        spin.setRepeatCount(ValueAnimator.INFINITE);
        spin.start();

        ObjectAnimator pulseX = ObjectAnimator.ofFloat(outerHalo, "scaleX", 0.9f, 1.18f);
        ObjectAnimator pulseY = ObjectAnimator.ofFloat(outerHalo, "scaleY", 0.9f, 1.18f);
        ObjectAnimator pulseAlpha = ObjectAnimator.ofFloat(outerHalo, "alpha", 0.85f, 0.2f);
        pulseX.setRepeatCount(ValueAnimator.INFINITE);
        pulseY.setRepeatCount(ValueAnimator.INFINITE);
        pulseAlpha.setRepeatCount(ValueAnimator.INFINITE);
        AnimatorSet pulseSet = new AnimatorSet();
        pulseSet.playTogether(pulseX, pulseY, pulseAlpha);
        pulseSet.setDuration(1400);
        pulseSet.setInterpolator(new AccelerateDecelerateInterpolator());
        pulseSet.start();

        handler.postDelayed(this::proceedToMain, 2350);
    }

    private void proceedToMain() {
        if (launched) return;
        launched = true;
        Intent intent = new Intent(SplashActivity.this, MainActivity.class);
        if (getIntent() != null && getIntent().getData() != null) {
            intent.setData(getIntent().getData());
        }
        startActivity(intent);
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
        finish();
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
