package com.hoteldelvalle.kiosco.util

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

@Serializable
data class GitHubRelease(
    val tag_name: String = "",
    val name: String = "",
    val body: String = "",
    val assets: List<GitHubAsset> = emptyList()
)

@Serializable
data class GitHubAsset(
    val name: String = "",
    val browser_download_url: String = "",
    val size: Long = 0
)

data class UpdateResult(
    val hasUpdate: Boolean,
    val currentVersion: String,
    val latestVersion: String,
    val downloadUrl: String?,
    val releaseName: String?,
    val error: String? = null
)

object UpdateChecker {
    private const val REPO = "sekaishopml/cyhotel-kiosko"
    private const val API_URL = "https://api.github.com/repos/$REPO/releases/latest"

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun checkForUpdates(currentVersion: String): UpdateResult =
        withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url(API_URL)
                    .header("Accept", "application/vnd.github+json")
                    .get()
                    .build()

                val response = client.newCall(request).execute()
                val body = response.body?.string()
                    ?: return@withContext UpdateResult(
                        hasUpdate = false,
                        currentVersion = currentVersion,
                        latestVersion = currentVersion,
                        downloadUrl = null,
                        releaseName = null,
                        error = "Respuesta vacía del servidor"
                    )

                if (response.code != 200) {
                    return@withContext UpdateResult(
                        hasUpdate = false,
                        currentVersion = currentVersion,
                        latestVersion = currentVersion,
                        downloadUrl = null,
                        releaseName = null,
                        error = "Error HTTP ${response.code}"
                    )
                }

                val release = json.decodeFromString<GitHubRelease>(body)
                val latest = release.tag_name.removePrefix("v")
                val current = currentVersion.removePrefix("v")

                val hasUpdate = compareVersions(latest, current) > 0
                val apkAsset = release.assets.find {
                    it.name.endsWith(".apk", ignoreCase = true)
                }

                UpdateResult(
                    hasUpdate = hasUpdate,
                    currentVersion = currentVersion,
                    latestVersion = latest,
                    downloadUrl = apkAsset?.browser_download_url,
                    releaseName = release.name
                )
            } catch (e: Exception) {
                UpdateResult(
                    hasUpdate = false,
                    currentVersion = currentVersion,
                    latestVersion = currentVersion,
                    downloadUrl = null,
                    releaseName = null,
                    error = e.message ?: "Error desconocido"
                )
            }
        }

    private fun compareVersions(a: String, b: String): Int {
        val partsA = a.split(".").map { it.toIntOrNull() ?: 0 }
        val partsB = b.split(".").map { it.toIntOrNull() ?: 0 }
        for (i in 0 until maxOf(partsA.size, partsB.size)) {
            val pa = partsA.getOrElse(i) { 0 }
            val pb = partsB.getOrElse(i) { 0 }
            if (pa != pb) return pa.compareTo(pb)
        }
        return 0
    }
}
