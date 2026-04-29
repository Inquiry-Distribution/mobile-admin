# ─── React Native core ───────────────────────────────────────────────────────
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keepattributes *Annotation*
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── Hermes ──────────────────────────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }

# ─── MMKV ────────────────────────────────────────────────────────────────────
-keep class com.tencent.mmkv.** { *; }

# ─── Socket.io / OkHttp / Okio ───────────────────────────────────────────────
-keep class okhttp3.** { *; }
-keep class okio.**    { *; }
-keep class io.socket.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# ─── Firebase ────────────────────────────────────────────────────────────────
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.gms.**

# ─── react-native-maps ───────────────────────────────────────────────────────
-keep class com.airbnb.android.react.maps.** { *; }

# ─── react-native-vector-icons ───────────────────────────────────────────────
-keep class com.oblador.vectoricons.** { *; }

# ─── react-native-config ─────────────────────────────────────────────────────
-keep class com.lugg.ReactNativeConfig.** { *; }

# ─── react-native-audio-recorder-player ──────────────────────────────────────
-keep class com.dooboolab.audiorecorderplayer.** { *; }

# ─── react-native-bootsplash ─────────────────────────────────────────────────
-keep class com.zoontek.rnbootsplash.** { *; }

# ─── react-native-paper ──────────────────────────────────────────────────────
-keep class io.github.droidkaigi.material3.** { *; }

# ─── react-native-gesture-handler ────────────────────────────────────────────
-keep class com.swmansion.gesturehandler.** { *; }

# ─── react-native-screens ────────────────────────────────────────────────────
-keep class com.swmansion.rnscreens.** { *; }

# ─── react-native-safe-area-context ──────────────────────────────────────────
-keep class com.th3rdwave.safeareacontext.** { *; }

# ─── react-native-permissions ────────────────────────────────────────────────
-keep class com.zoontek.rnpermissions.** { *; }

# ─── react-native-device-info ────────────────────────────────────────────────
-keep class com.learnium.RNDeviceInfo.** { *; }

# ─── react-native-image-picker ───────────────────────────────────────────────
-keep class com.imagepicker.** { *; }

# ─── react-native-netinfo ────────────────────────────────────────────────────
-keep class com.reactnativecommunity.netinfo.** { *; }

# ─── AsyncStorage ────────────────────────────────────────────────────────────
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# ─── Suppress common warnings from transitive deps ───────────────────────────
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# ─── Preserve source file names and line numbers for crash reports ────────────
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
