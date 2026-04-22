# ── React Native ──────────────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# ── MMKV ──────────────────────────────────────────────────────────────────────
-keep class com.tencent.mmkv.** { *; }

# ── Socket.io / OkHttp ────────────────────────────────────────────────────────
-keep class okhttp3.** { *; }
-keep class okio.**    { *; }
-keep class io.socket.** { *; }

# ── react-native-maps ─────────────────────────────────────────────────────────
-keep class com.airbnb.android.react.maps.** { *; }

# ── react-native-vector-icons ─────────────────────────────────────────────────
-keep class com.oblador.vectoricons.** { *; }

# ── react-native-config ───────────────────────────────────────────────────────
-keep class com.lugg.ReactNativeConfig.** { *; }

# ── Firebase ──────────────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

# ── react-native-fast-image (Glide) ───────────────────────────────────────────
-keep public class * implements com.bumptech.glide.module.GlideModule
-keep class * extends com.bumptech.glide.module.AppGlideModule { *; }
-keep public enum com.bumptech.glide.load.ImageHeaderParser$** {
    **[] $VALUES;
    public *;
}

# ── react-native-bootsplash ───────────────────────────────────────────────────
-keep class com.zoontek.rnbootsplash.** { *; }

# ── Preserve source file names and line numbers for crash reports ──────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
