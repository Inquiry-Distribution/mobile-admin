package com.inquirydeskadmin

import android.app.Activity
import android.app.AlertDialog
import android.app.ProgressDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

object UpdateManager {

    private const val GITHUB_OWNER = "Inquiry-Distribution"
    private const val GITHUB_REPO  = "mobile-admin"
    private const val GITHUB_TOKEN = "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"
    private const val API_URL =
        "https://api.github.com/repos/$GITHUB_OWNER/$GITHUB_REPO/releases/latest"

    // Request code used with startActivityForResult when opening unknown-sources settings
    const val REQUEST_INSTALL_PERMISSION = 1001

    private val mainHandler = Handler(Looper.getMainLooper())

    // Held across the Settings round-trip so download can resume after permission is granted
    private var pendingRelease: ReleaseInfo? = null

    data class ReleaseInfo(
        val tagName: String,
        val versionCode: Int,
        val assetApiUrl: String,
        val releaseNotes: String
    )

    fun checkAndPrompt(activity: Activity) {
        val currentVersionCode = try {
            activity.packageManager
                .getPackageInfo(activity.packageName, 0)
                .longVersionCode.toInt()
        } catch (e: PackageManager.NameNotFoundException) {
            return
        }

        Thread {
            val release = fetchLatestRelease(currentVersionCode) ?: return@Thread
            mainHandler.post { showUpdateDialog(activity, release) }
        }.start()
    }

    // Called from MainActivity.onActivityResult — resumes download after permission granted
    fun onPermissionResult(activity: Activity) {
        val release = pendingRelease ?: return
        pendingRelease = null
        if (canInstallUnknownApps(activity)) {
            startDownload(activity, release)
        }
    }

    private fun fetchLatestRelease(currentVersionCode: Int): ReleaseInfo? {
        return try {
            val connection = URL(API_URL).openConnection() as HttpURLConnection
            connection.setRequestProperty("Authorization", "token $GITHUB_TOKEN")
            connection.setRequestProperty("Accept", "application/vnd.github.v3+json")
            connection.connectTimeout = 10_000
            connection.readTimeout = 10_000
            connection.connect()

            if (connection.responseCode != 200) return null

            val json = JSONObject(connection.inputStream.bufferedReader().readText())
            val tagName = json.getString("tag_name") // e.g. "v2"

            val remoteVersionCode = tagName.removePrefix("v").toIntOrNull() ?: -1
            if (remoteVersionCode <= currentVersionCode) return null

            val assets = json.getJSONArray("assets")
            val preferredAbi = if (Build.SUPPORTED_ABIS.contains("arm64-v8a")) "arm64-v8a" else "armeabi-v7a"
            var assetApiUrl = ""
            var fallbackUrl = ""

            for (i in 0 until assets.length()) {
                val asset = assets.getJSONObject(i)
                val name = asset.getString("name")
                if (!name.endsWith(".apk")) continue
                val url = asset.getString("url") // API URL, required for private repos
                when {
                    name.contains(preferredAbi) -> { assetApiUrl = url; break }
                    fallbackUrl.isEmpty()        -> fallbackUrl = url
                }
            }

            if (assetApiUrl.isEmpty()) assetApiUrl = fallbackUrl
            if (assetApiUrl.isEmpty()) return null

            ReleaseInfo(
                tagName = tagName,
                versionCode = remoteVersionCode,
                assetApiUrl = assetApiUrl,
                releaseNotes = json.optString("body", "").take(300)
            )
        } catch (e: Exception) {
            null
        }
    }

    private fun showUpdateDialog(activity: Activity, release: ReleaseInfo) {
        if (activity.isFinishing || activity.isDestroyed) return

        val message = buildString {
            append("Version ${release.tagName} is available.")
            if (release.releaseNotes.isNotBlank()) {
                append("\n\n${release.releaseNotes}")
            }
        }

        AlertDialog.Builder(activity)
            .setTitle("Update Available")
            .setMessage(message)
            .setCancelable(false)
            .setPositiveButton("Update Now") { _, _ -> startDownload(activity, release) }
            .setNegativeButton("Later", null)
            .show()
    }

    private fun startDownload(activity: Activity, release: ReleaseInfo) {
        if (!canInstallUnknownApps(activity)) {
            requestUnknownAppsPermission(activity, release)
            return
        }

        @Suppress("DEPRECATION")
        val progress = ProgressDialog(activity).apply {
            setTitle("Downloading Update")
            setMessage("Please wait...")
            setProgressStyle(ProgressDialog.STYLE_HORIZONTAL)
            setCancelable(false)
            max = 100
            show()
        }

        val apkFile = File(activity.externalCacheDir, "update.apk")

        Thread {
            val success = downloadApk(release.assetApiUrl, apkFile) { percent ->
                mainHandler.post { progress.progress = percent }
            }
            mainHandler.post {
                progress.dismiss()
                if (success) installApk(activity, apkFile)
            }
        }.start()
    }

    private fun downloadApk(
        assetApiUrl: String,
        destination: File,
        onProgress: (Int) -> Unit
    ): Boolean {
        return try {
            // Step 1: hit GitHub asset API URL → redirects to S3
            val apiConn = URL(assetApiUrl).openConnection() as HttpURLConnection
            apiConn.setRequestProperty("Authorization", "token $GITHUB_TOKEN")
            apiConn.setRequestProperty("Accept", "application/octet-stream")
            apiConn.instanceFollowRedirects = false
            apiConn.connectTimeout = 10_000
            apiConn.connect()

            // Step 2: follow redirect to actual S3/CDN URL (no auth needed there)
            val downloadUrl = if (apiConn.responseCode in 301..302) {
                apiConn.getHeaderField("Location")
            } else {
                assetApiUrl
            }

            val dlConn = URL(downloadUrl).openConnection() as HttpURLConnection
            dlConn.connectTimeout = 15_000
            dlConn.readTimeout = 60_000
            dlConn.connect()

            val totalBytes = dlConn.contentLength
            var downloadedBytes = 0

            dlConn.inputStream.use { input ->
                destination.outputStream().use { output ->
                    val buffer = ByteArray(8192)
                    var bytes: Int
                    while (input.read(buffer).also { bytes = it } != -1) {
                        output.write(buffer, 0, bytes)
                        downloadedBytes += bytes
                        if (totalBytes > 0) {
                            onProgress((downloadedBytes * 100) / totalBytes)
                        }
                    }
                }
            }
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun installApk(activity: Activity, apkFile: File) {
        val uri = FileProvider.getUriForFile(
            activity,
            "${activity.packageName}.fileprovider",
            apkFile
        )
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
        }
        activity.startActivity(intent)
    }

    private fun canInstallUnknownApps(activity: Activity): Boolean {
        return activity.packageManager.canRequestPackageInstalls()
    }

    private fun requestUnknownAppsPermission(activity: Activity, release: ReleaseInfo) {
        pendingRelease = release  // save so onPermissionResult can resume the download
        AlertDialog.Builder(activity)
            .setTitle("Permission Required")
            .setMessage("To install updates, allow this app to install from unknown sources in Settings.")
            .setPositiveButton("Open Settings") { _, _ ->
                val intent = Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:${activity.packageName}")
                )
                activity.startActivityForResult(intent, REQUEST_INSTALL_PERMISSION)
            }
            .setNegativeButton("Cancel") { _, _ ->
                pendingRelease = null  // user cancelled — discard pending release
            }
            .show()
    }
}
