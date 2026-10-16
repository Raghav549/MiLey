# Keep JavascriptInterface methods for MiLeyNative bridge
-keepclassmembers class space.mileymusic.app.MainActivity$MiLeyNativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface
-keep class space.mileymusic.app.** { *; }
