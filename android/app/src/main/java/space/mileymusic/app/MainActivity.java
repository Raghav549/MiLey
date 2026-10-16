package space.mileymusic.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

import org.json.JSONObject;

import java.io.InputStream;

/**
 * MiLey Native Android MainActivity
 * Serves bundled assets under https://mileymusic.space via WebViewAssetLoader,
 * keeps music playing when the user closes/minimizes the app, and coordinates with:
 *   1. MusicPlaybackService (Foreground Media Notification & WakeLock)
 *   2. CameraTopBarService (Pro Music Banner anchored in the Camera Top Bar Cutout)
 */
public class MainActivity extends Activity {

    public static final String ACTION_PLAYER_COMMAND = "space.mileymusic.app.PLAYER_COMMAND";
    public static final String EXTRA_COMMAND = "command";
    public static final String OFFICIAL_DOMAIN_URL = "https://mileymusic.space";

    private WebView webView;
    private PowerManager.WakeLock wakeLock;
    private boolean isPlayingMusic = false;
    private String lastTrackJson = "{}";

    private final BroadcastReceiver commandReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (intent == null || webView == null) return;
            String cmd = intent.getStringExtra(EXTRA_COMMAND);
            if (cmd == null) return;
            switch (cmd) {
                case "TOGGLE_PLAY":
                    evalJs("window.__mileyPlayerControls && window.__mileyPlayerControls.togglePlay()");
                    break;
                case "NEXT":
                    evalJs("window.__mileyPlayerControls && window.__mileyPlayerControls.next()");
                    break;
                case "PREV":
                    evalJs("window.__mileyPlayerControls && window.__mileyPlayerControls.prev()");
                    break;
            }
        }
    };

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestWindowFeature(Window.FEATURE_NO_TITLE);
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#0B0B0B"));
        window.setNavigationBarColor(Color.parseColor("#0B0B0B"));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MiLey::BackgroundAudioLock");
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#0B0B0B"));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " MiLeyAndroid/2.0 (mileymusic.space)");

        webView.addJavascriptInterface(new MiLeyNativeBridge(), "MiLeyNative");

        final WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .setDomain("mileymusic.space")
                .addPathHandler("/", path -> {
                    try {
                        String clean = (path == null || path.isEmpty() || path.equals("/")) ? "index.html" : path;
                        if (clean.startsWith("/")) clean = clean.substring(1);
                        InputStream is = getAssets().open("public/" + clean);
                        String mime = guessMime(clean);
                        return new WebResourceResponse(mime, "UTF-8", is);
                    } catch (Exception e) {
                        // SPA route fallback to index.html
                        try {
                            InputStream indexStream = getAssets().open("public/index.html");
                            return new WebResourceResponse("text/html", "UTF-8", indexStream);
                        } catch (Exception ignored) {
                            return null;
                        }
                    }
                })
                .build();

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                WebResourceResponse res = assetLoader.shouldInterceptRequest(request.getUrl());
                if (res != null) return res;
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost() != null ? uri.getHost().toLowerCase() : "";
                if (host.endsWith("mileymusic.space") || host.endsWith("supabase.co") || host.equals("localhost")) {
                    return false;
                }
                Intent browserIntent = new Intent(Intent.ACTION_VIEW, uri);
                startActivity(browserIntent);
                return true;
            }
        });

        IntentFilter filter = new IntentFilter(ACTION_PLAYER_COMMAND);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(commandReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(commandReceiver, filter);
        }

        Uri deepLink = getIntent() != null ? getIntent().getData() : null;
        if (deepLink != null && deepLink.getHost() != null && deepLink.getHost().contains("mileymusic.space")) {
            webView.loadUrl(deepLink.toString());
        } else {
            webView.loadUrl("https://mileymusic.space/index.html");
        }
    }

    private String guessMime(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        return "application/octet-stream";
    }

    private void evalJs(final String script) {
        if (webView == null) return;
        webView.post(() -> webView.evaluateJavascript(script, null));
    }

    public class MiLeyNativeBridge {

        @JavascriptInterface
        public void updateNowPlaying(String jsonPayload) {
            lastTrackJson = jsonPayload;
            try {
                JSONObject obj = new JSONObject(jsonPayload);
                isPlayingMusic = obj.optBoolean("isPlaying", false);
                if (isPlayingMusic && wakeLock != null && !wakeLock.isHeld()) {
                    wakeLock.acquire(4 * 60 * 60 * 1000L);
                }

                Intent serviceIntent = new Intent(MainActivity.this, MusicPlaybackService.class);
                serviceIntent.putExtra("track_json", jsonPayload);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(serviceIntent);
                } else {
                    startService(serviceIntent);
                }

                Intent barIntent = new Intent(MainActivity.this, CameraTopBarService.class);
                barIntent.putExtra("track_json", jsonPayload);
                barIntent.putExtra("action", "UPDATE");
                startService(barIntent);
            } catch (Exception ignored) {
            }
        }

        @JavascriptInterface
        public void onAppBackgrounded(String jsonPayload) {
            launchFloatingCameraBanner(jsonPayload);
        }

        @JavascriptInterface
        public void onAppForegrounded() {
            Intent barIntent = new Intent(MainActivity.this, CameraTopBarService.class);
            barIntent.putExtra("action", "HIDE_OVERLAY");
            startService(barIntent);
        }

        @JavascriptInterface
        public void launchFloatingCameraBanner(String jsonPayload) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(MainActivity.this)) {
                Intent permIntent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName())
                );
                permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(permIntent);
                return;
            }
            Intent barIntent = new Intent(MainActivity.this, CameraTopBarService.class);
            barIntent.putExtra("track_json", jsonPayload != null ? jsonPayload : lastTrackJson);
            barIntent.putExtra("action", "SHOW_OVERLAY");
            startService(barIntent);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (isPlayingMusic && webView != null) {
            webView.resumeTimers();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(this)) {
                Intent barIntent = new Intent(this, CameraTopBarService.class);
                barIntent.putExtra("track_json", lastTrackJson);
                barIntent.putExtra("action", "SHOW_OVERLAY");
                startService(barIntent);
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            moveTaskToBack(true);
        }
    }

    @Override
    protected void onDestroy() {
        try {
            unregisterReceiver(commandReceiver);
        } catch (Exception ignored) {
        }
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        super.onDestroy();
    }
}
