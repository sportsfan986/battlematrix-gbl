package com.gbl.overlay

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.ServiceInfo
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.Rect
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonParser
import com.google.gson.reflect.TypeToken
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.coroutines.resume
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * OverlayService:
 * Floating HUD and real-time screen analysis for Pokémon GO Battle League.
 * - Android 14+ compliant MediaProjection callback registration & background frame reader
 * - Real-time OCR detection for Opponent Pokémon (Top-Right nameplate region) with fuzzy matching
 * - Real-time OCR detection for Player Active Switch (Top-Left nameplate & Bottom move buttons)
 * - League-aware FormResolver (Ninetales, Giratina, Zacian, Deoxys, Dialga, Palkia, Landorus, Necrozma)
 * - Shadow modifier toggle (1.2x Attack / 0.833x Defense) & Form cycling
 * - Exact PvPoke Charged Move damage calculation (Player -> Opponent & Opponent -> Player)
 */
class OverlayService : LifecycleService() {

    companion object {
        const val ACTION_START_OVERLAY = "com.gbl.overlay.ACTION_START_OVERLAY"
        const val ACTION_STOP_OVERLAY = "com.gbl.overlay.ACTION_STOP_OVERLAY"
        const val ACTION_TOGGLE_LAYOUT = "com.gbl.overlay.ACTION_TOGGLE_LAYOUT"
        const val ACTION_UPDATE_PRESET = "com.gbl.overlay.ACTION_UPDATE_PRESET"
        const val ACTION_UPDATE_SETTINGS = "com.gbl.overlay.ACTION_UPDATE_SETTINGS"
        const val ACTION_START_BATTLE = "com.gbl.overlay.ACTION_START_BATTLE"

        const val EXTRA_RESULT_CODE = "extra_result_code"
        const val EXTRA_RESULT_DATA = "extra_result_data"
        const val EXTRA_PRESET_JSON = "extra_preset_json"
        const val EXTRA_OPP_COUNT_MODE = "extra_opp_count_mode"
        const val EXTRA_OVERLAY_SCALE_PCT = "extra_overlay_scale_pct"
        const val EXTRA_OVERLAY_TRANSPARENCY_PCT = "extra_overlay_transparency_pct"
        const val EXTRA_ENABLE_4_CHARGED_MOVES = "extra_enable_4_charged_moves"
        const val EXTRA_DISABLE_BATTLE_TOASTS = "extra_disable_battle_toasts"

        const val PREFS_KEY_ENABLE_4_CHARGED_MOVES = "enable_4_charged_moves"
        const val PREFS_KEY_DISABLE_BATTLE_TOASTS = "disable_battle_toasts"
        const val PREFS_KEY_OVERLAY_TRANSPARENCY_PCT = "overlay_transparency_pct"
        const val PREFS_KEY_LAST_SYNC_TIMESTAMP = "last_sync_timestamp"
        const val PREFS_KEY_BATTLE_LOGS = "gbl_battle_logs_v1"
        const val PREFS_KEY_DELETED_LOG_IDS = "gbl_deleted_log_ids_v1"
        const val PREFS_KEY_DELETED_TEAM_IDS = "gbl_deleted_team_ids_v1"
        const val PREFS_KEY_DELETED_LOGS_TRASH = "gbl_deleted_battles_trash_v1"
        const val PREFS_KEY_DELETED_TEAMS_TRASH = "gbl_deleted_teams_trash_v1"
        const val PREFS_KEY_GBL_SEASONS_JSON = "gbl_seasons_json_v1"
        const val PREFS_KEY_SYNC_GITHUB_TOKEN = "gbl_sync_github_token"
        const val PREFS_KEY_SYNC_GIST_ID = "gbl_sync_gist_id"
        const val PREFS_KEY_SYNC_LAST_AT = "gbl_sync_last_at"
        const val PREFS_KEY_DEVICE_LABEL = "gbl_device_label"

        private const val NOTIFICATION_CHANNEL_ID = "gbl_battle_overlay_channel"
        private const val NOTIFICATION_ID = 2001

        const val PREFS_KEY_PERSISTENT_TEAMS = "gbl_user_teams_persistent"
        val LEGACY_PRESET_KEYS = listOf(
            "gbl_team_presets_v6",
            "gbl_team_presets_v5",
            "gbl_team_presets_v4",
            "gbl_team_presets_v3",
            "gbl_team_presets_v2",
            "gbl_team_presets"
        )

        data class SyncBattleLogRecord(
            val id: String = java.util.UUID.randomUUID().toString(),
            val timestampMs: Long = System.currentTimeMillis(),
            val updatedAt: Long = timestampMs,
            val league: String = "GREAT LEAGUE",
            val presetId: String = "",
            val userTeamName: String = "",
            val userPokemon: List<String> = emptyList(),
            val opponents: List<String> = emptyList(),
            val leadMatchup: String = "NEUTRAL",
            val result: String = "WIN",
            val deviceLabel: String = Build.MODEL ?: "Android",
            val quality: BattleQualityMetadata? = null,
            val qualityEvaluated: Boolean = false
        )

        data class SyncTeamSlot(
            val name: String,
            val cp: Int,
            val fastMove: String,
            val chargedMove1: String,
            val chargedMove2: String,
            val ivs: String? = null
        )

        data class SyncTeamPresetRecord(
            val id: String = java.util.UUID.randomUUID().toString(),
            val name: String,
            val league: String,
            val pokemon: List<SyncTeamSlot>,
            val isSelected: Boolean = false,
            val updatedAt: Long = System.currentTimeMillis()
        )

        data class SyncVaultPayload(
            val schemaVersion: Int = 2,
            val updatedAt: Long = System.currentTimeMillis(),
            val battleLogs: List<SyncBattleLogRecord> = emptyList(),
            val teamPresets: List<SyncTeamPresetRecord> = emptyList(),
            val deletedLogIds: List<String> = emptyList(),
            val deletedTeamIds: List<String> = emptyList()
        )

        fun reconcileSyncVaultPayloads(
            local: SyncVaultPayload,
            remote: SyncVaultPayload
        ): Triple<SyncVaultPayload, Int, Int> {
            val localLogMap = local.battleLogs.associateBy { it.id }
            val remoteLogMap = remote.battleLogs.associateBy { it.id }
            val localDeletedLogSet = local.deletedLogIds.toSet()
            val remoteDeletedLogSet = remote.deletedLogIds.toSet()

            // Allow restored items (present in active list, absent from that device's deletedIds, with newer updatedAt) to clear tombstones
            val allDeletedLogs = (localDeletedLogSet + remoteDeletedLogSet).filter { id ->
                val l = localLogMap[id]
                val r = remoteLogMap[id]
                val restoredLocally = l != null && id !in localDeletedLogSet && (l.updatedAt > remote.updatedAt || id !in remoteLogMap)
                val restoredRemotely = r != null && id !in remoteDeletedLogSet && (r.updatedAt > local.updatedAt && id !in localDeletedLogSet)
                !(restoredLocally || restoredRemotely)
            }.toSet()

            val localTeamMap = local.teamPresets.associateBy { it.id }
            val remoteTeamMap = remote.teamPresets.associateBy { it.id }
            val localDeletedTeamSet = local.deletedTeamIds.toSet()
            val remoteDeletedTeamSet = remote.deletedTeamIds.toSet()

            val allDeletedTeams = (localDeletedTeamSet + remoteDeletedTeamSet).filter { id ->
                val l = localTeamMap[id]
                val r = remoteTeamMap[id]
                val restoredLocally = l != null && id !in localDeletedTeamSet && (l.updatedAt > remote.updatedAt || id !in remoteTeamMap)
                val restoredRemotely = r != null && id !in remoteDeletedTeamSet && (r.updatedAt > local.updatedAt && id !in localDeletedTeamSet)
                !(restoredLocally || restoredRemotely)
            }.toSet()

            val allLogIds = (localLogMap.keys + remoteLogMap.keys) - allDeletedLogs
            var newOrUpdatedLogsFromRemote = 0

            val mergedLogs = allLogIds.mapNotNull { id ->
                val l = localLogMap[id]
                val r = remoteLogMap[id]
                when {
                    l != null && r != null -> {
                        val lUpd = if (l.updatedAt > 0L) l.updatedAt else l.timestampMs
                        val rUpd = if (r.updatedAt > 0L) r.updatedAt else r.timestampMs
                        if (rUpd > lUpd) {
                            newOrUpdatedLogsFromRemote++
                            r
                        } else l
                    }
                    r != null -> {
                        newOrUpdatedLogsFromRemote++
                        r
                    }
                    else -> l
                }
            }.sortedByDescending { it.timestampMs }

            val orderedIds = mutableListOf<String>()
            for (t in local.teamPresets) {
                if (t.id !in allDeletedTeams && !orderedIds.contains(t.id)) orderedIds.add(t.id)
            }
            for (t in remote.teamPresets) {
                if (t.id !in allDeletedTeams && !orderedIds.contains(t.id)) orderedIds.add(t.id)
            }

            var newOrUpdatedTeamsFromRemote = 0
            val mergedTeams = orderedIds.mapNotNull { id ->
                val l = localTeamMap[id]
                val r = remoteTeamMap[id]
                when {
                    l != null && r != null -> {
                        val lUpd = if (l.updatedAt > 0L) l.updatedAt else 1L
                        val rUpd = if (r.updatedAt > 0L) r.updatedAt else 1L
                        if (rUpd > lUpd) {
                            newOrUpdatedTeamsFromRemote++
                            r
                        } else l
                    }
                    r != null -> {
                        newOrUpdatedTeamsFromRemote++
                        r
                    }
                    else -> l
                }
            }

            val mergedPayload = SyncVaultPayload(
                schemaVersion = 2,
                updatedAt = System.currentTimeMillis(),
                battleLogs = mergedLogs,
                teamPresets = mergedTeams,
                deletedLogIds = allDeletedLogs.toList(),
                deletedTeamIds = allDeletedTeams.toList()
            )
            return Triple(mergedPayload, newOrUpdatedLogsFromRemote, newOrUpdatedTeamsFromRemote)
        }

        fun buildLocalSyncVaultPayload(prefs: SharedPreferences, gson: Gson): SyncVaultPayload {
            val logsType = object : TypeToken<List<SyncBattleLogRecord>>() {}.type
            val teamsType = object : TypeToken<List<SyncTeamPresetRecord>>() {}.type
            val strListType = object : TypeToken<List<String>>() {}.type

            val logs: List<SyncBattleLogRecord> = try {
                gson.fromJson(prefs.getString(PREFS_KEY_BATTLE_LOGS, "[]"), logsType) ?: emptyList()
            } catch (_: Exception) { emptyList() }

            val teams: List<SyncTeamPresetRecord> = try {
                gson.fromJson(prefs.getString(PREFS_KEY_PERSISTENT_TEAMS, "[]"), teamsType) ?: emptyList()
            } catch (_: Exception) { emptyList() }

            val delLogs: List<String> = try {
                gson.fromJson(prefs.getString(PREFS_KEY_DELETED_LOG_IDS, "[]"), strListType) ?: emptyList()
            } catch (_: Exception) { emptyList() }

            val delTeams: List<String> = try {
                gson.fromJson(prefs.getString(PREFS_KEY_DELETED_TEAM_IDS, "[]"), strListType) ?: emptyList()
            } catch (_: Exception) { emptyList() }

            return SyncVaultPayload(
                schemaVersion = 2,
                updatedAt = System.currentTimeMillis(),
                battleLogs = logs,
                teamPresets = teams,
                deletedLogIds = delLogs,
                deletedTeamIds = delTeams
            )
        }

        fun saveReconciledSyncVaultLocally(prefs: SharedPreferences, gson: Gson, payload: SyncVaultPayload) {
            val editor = prefs.edit()
                .putString(PREFS_KEY_BATTLE_LOGS, gson.toJson(payload.battleLogs))
                .putString(PREFS_KEY_DELETED_LOG_IDS, gson.toJson(payload.deletedLogIds))
                .putString(PREFS_KEY_DELETED_TEAM_IDS, gson.toJson(payload.deletedTeamIds))
                .putLong(PREFS_KEY_SYNC_LAST_AT, System.currentTimeMillis())
            if (payload.teamPresets.isNotEmpty()) {
                editor.putString(PREFS_KEY_PERSISTENT_TEAMS, gson.toJson(payload.teamPresets))
            }
            editor.apply()
        }

        const val PREFS_KEY_SYNC_GITHUB_USERNAME = "gbl_sync_github_username"
        const val GITHUB_OAUTH_CLIENT_ID = "178c6fc778ccc68e1d6a"

        data class GitHubDeviceCodeResponse(
            val deviceCode: String,
            val userCode: String,
            val verificationUri: String,
            val expiresIn: Int,
            val interval: Int
        )

        fun getEffectiveSyncToken(prefs: SharedPreferences): String {
            return prefs.getString(PREFS_KEY_SYNC_GITHUB_TOKEN, "")?.trim().orEmpty()
        }

        fun fetchGitHubUsernameBlocking(token: String): String {
            if (token.isBlank()) return ""
            return try {
                val client = OkHttpClient()
                val req = Request.Builder()
                    .url("https://api.github.com/user")
                    .header("Authorization", "Bearer $token")
                    .header("Accept", "application/vnd.github+json")
                    .build()
                client.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return ""
                    val body = resp.body?.string().orEmpty()
                    val json = JsonParser.parseString(body).asJsonObject
                    json.get("login")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                }
            } catch (_: Exception) {
                ""
            }
        }

        fun requestGitHubDeviceCodeBlocking(): Result<GitHubDeviceCodeResponse> {
            return try {
                val client = OkHttpClient()
                val formBody = "client_id=$GITHUB_OAUTH_CLIENT_ID&scope=gist%20repo"
                    .toRequestBody("application/x-www-form-urlencoded".toMediaTypeOrNull())
                val req = Request.Builder()
                    .url("https://github.com/login/device/code")
                    .post(formBody)
                    .header("Accept", "application/json")
                    .build()
                client.newCall(req).execute().use { resp ->
                    val bodyStr = resp.body?.string().orEmpty()
                    if (!resp.isSuccessful) {
                        return Result.failure(Exception("GitHub HTTP ${resp.code}"))
                    }
                    val root = JsonParser.parseString(bodyStr).asJsonObject
                    val deviceCode = root.get("device_code")?.asString.orEmpty()
                    val userCode = root.get("user_code")?.asString.orEmpty()
                    val verificationUri = root.get("verification_uri")?.asString ?: "https://github.com/login/device"
                    val expiresIn = root.get("expires_in")?.asInt ?: 900
                    val interval = root.get("interval")?.asInt ?: 5
                    if (deviceCode.isEmpty() || userCode.isEmpty()) {
                        return Result.failure(Exception("Invalid device code response from GitHub"))
                    }
                    Result.success(
                        GitHubDeviceCodeResponse(
                            deviceCode = deviceCode,
                            userCode = userCode,
                            verificationUri = verificationUri,
                            expiresIn = expiresIn,
                            interval = interval
                        )
                    )
                }
            } catch (e: Exception) {
                Result.failure(e)
            }
        }

        fun pollGitHubDeviceTokenOnceBlocking(deviceCode: String): Triple<String, String, String> {
            return try {
                val client = OkHttpClient()
                val formBody = (
                    "client_id=$GITHUB_OAUTH_CLIENT_ID" +
                        "&device_code=$deviceCode" +
                        "&grant_type=urn:ietf:params:oauth:grant-type:device_code"
                    ).toRequestBody("application/x-www-form-urlencoded".toMediaTypeOrNull())
                val req = Request.Builder()
                    .url("https://github.com/login/oauth/access_token")
                    .post(formBody)
                    .header("Accept", "application/json")
                    .build()
                client.newCall(req).execute().use { resp ->
                    val bodyStr = resp.body?.string().orEmpty()
                    val root = JsonParser.parseString(bodyStr).asJsonObject
                    val accessToken = root.get("access_token")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                    if (accessToken.isNotEmpty()) {
                        val username = fetchGitHubUsernameBlocking(accessToken)
                        return Triple("SUCCESS", accessToken, username)
                    }
                    val error = root.get("error")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                    val errorDesc = root.get("error_description")?.takeIf { !it.isJsonNull }?.asString ?: error
                    when (error) {
                        "authorization_pending" -> Triple("PENDING", "", "")
                        "slow_down" -> Triple("SLOW_DOWN", "", "")
                        else -> Triple("ERROR", errorDesc.ifEmpty { "Authorization failed" }, "")
                    }
                }
            } catch (e: Exception) {
                Triple("PENDING", e.localizedMessage ?: "", "")
            }
        }

        fun syncWithGitHubGistBlocking(prefs: SharedPreferences, gson: Gson): Pair<Boolean, String> {
            val token = getEffectiveSyncToken(prefs)
            val customGistId = prefs.getString(PREFS_KEY_SYNC_GIST_ID, "")?.trim().orEmpty()
            if (token.isEmpty()) {
                return false to "Tap '🔑 Login with GitHub' in Settings to enable automatic multi-device sync."
            }
            val httpClient = OkHttpClient()
            val fileName = "battlematrix_gbl_sync_vault.json"

            try {
                var username = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty()
                if (username.isEmpty()) {
                    username = fetchGitHubUsernameBlocking(token)
                    if (username.isNotEmpty()) {
                        prefs.edit().putString(PREFS_KEY_SYNC_GITHUB_USERNAME, username).apply()
                    }
                }

                val localPayload = buildLocalSyncVaultPayload(prefs, gson)
                var remotePayload = SyncVaultPayload()
                var remoteFileSha = ""

                // If signed-in user is sportsfan986 (repo owner) and no custom Gist override is set, use dedicated 'sync-vault' branch
                val useRepoSyncVault = (customGistId.isEmpty() || customGistId.equals("sync-vault", ignoreCase = true)) &&
                    username.equals("sportsfan986", ignoreCase = true)

                if (useRepoSyncVault) {
                    val repoVaultUrl = "https://api.github.com/repos/sportsfan986/silphscope-pvp/contents/$fileName"
                    var totalNewLogs = 0
                    var totalNewTeams = 0
                    var finalMergedPayload = localPayload
                    for (attempt in 1..3) {
                        val currentLocal = if (attempt == 1) localPayload else buildLocalSyncVaultPayload(prefs, gson)
                        remotePayload = SyncVaultPayload()
                        remoteFileSha = ""
                        val getReq = Request.Builder()
                            .url("$repoVaultUrl?ref=sync-vault")
                            .header("Authorization", "Bearer $token")
                            .header("Accept", "application/vnd.github+json")
                            .build()
                        httpClient.newCall(getReq).execute().use { resp ->
                            if (resp.isSuccessful) {
                                val bodyStr = resp.body?.string().orEmpty()
                                val root = JsonParser.parseString(bodyStr).asJsonObject
                                remoteFileSha = root.get("sha")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                                val contentB64 = root.get("content")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                                if (contentB64.isNotBlank()) {
                                    val decodedBytes = android.util.Base64.decode(contentB64.replace("\n", "").replace("\r", ""), android.util.Base64.DEFAULT)
                                    val decodedStr = String(decodedBytes, Charsets.UTF_8)
                                    remotePayload = try {
                                        gson.fromJson(decodedStr, SyncVaultPayload::class.java) ?: SyncVaultPayload()
                                    } catch (_: Exception) { SyncVaultPayload() }
                                }
                            }
                        }

                        // Reconcile deltas across N devices (Pull -> Union/LWW/Tombstone Reconcile -> Save Local)
                        val (mergedPayload, newLogsCount, newTeamsCount) = reconcileSyncVaultPayloads(currentLocal, remotePayload)
                        saveReconciledSyncVaultLocally(prefs, gson, mergedPayload)
                        finalMergedPayload = mergedPayload
                        totalNewLogs += newLogsCount
                        totalNewTeams += newTeamsCount

                        // Determine if local state has deltas that need to be pushed back to the shared multi-device vault
                        val remoteLogIds = remotePayload.battleLogs.associateBy { it.id }
                        val hasLogDiff = mergedPayload.battleLogs.size != remotePayload.battleLogs.size ||
                            mergedPayload.battleLogs.any { m -> remoteLogIds[m.id]?.updatedAt != m.updatedAt }
                        val remoteTeamMap = remotePayload.teamPresets.associateBy { it.id }
                        val hasTeamDiff = mergedPayload.teamPresets.size != remotePayload.teamPresets.size ||
                            mergedPayload.teamPresets.any { t -> remoteTeamMap[t.id]?.updatedAt != t.updatedAt }
                        val hasTombstoneDiff = mergedPayload.deletedLogIds.toSet() != remotePayload.deletedLogIds.toSet() ||
                            mergedPayload.deletedTeamIds.toSet() != remotePayload.deletedTeamIds.toSet()

                        if (remoteFileSha.isEmpty() || hasLogDiff || hasTeamDiff || hasTombstoneDiff) {
                            val mergedJsonStr = gson.toJson(mergedPayload)
                            val encodedB64 = android.util.Base64.encodeToString(
                                mergedJsonStr.toByteArray(Charsets.UTF_8),
                                android.util.Base64.NO_WRAP
                            )
                            val putBodyMap = mutableMapOf<String, Any>(
                                "message" to "Auto-sync multi-device delta vault",
                                "content" to encodedB64,
                                "branch" to "sync-vault"
                            )
                            if (remoteFileSha.isNotEmpty()) {
                                putBodyMap["sha"] = remoteFileSha
                            }
                            val reqBody = gson.toJson(putBodyMap)
                                .toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
                            val putReq = Request.Builder()
                                .url(repoVaultUrl)
                                .put(reqBody)
                                .header("Authorization", "Bearer $token")
                                .header("Accept", "application/vnd.github+json")
                                .build()
                            var retryConflict = false
                            httpClient.newCall(putReq).execute().use { putResp ->
                                if (putResp.code == 409 || putResp.code == 422) {
                                    retryConflict = true
                                } else if (!putResp.isSuccessful) {
                                    return false to "Sync error (HTTP ${putResp.code})"
                                }
                            }
                            if (!retryConflict) break
                        } else {
                            break
                        }
                    }

                    val userTag = if (username.isNotEmpty()) "@$username" else "Cloud Vault"
                    return true to "Synced ($userTag)! (${finalMergedPayload.battleLogs.size} battles, +$totalNewLogs from other devices · ${finalMergedPayload.teamPresets.size} teams, +$totalNewTeams updated)"
                }

                // Standard Per-User Isolated Vault: Auto-discover or create a private Gist in the signed-in user's own GitHub account
                var gistId = if (customGistId.equals("sync-vault", ignoreCase = true)) "" else customGistId
                if (gistId.isEmpty()) {
                    val listReq = Request.Builder()
                        .url("https://api.github.com/gists?per_page=100")
                        .header("Authorization", "Bearer $token")
                        .header("Accept", "application/vnd.github+json")
                        .build()
                    httpClient.newCall(listReq).execute().use { resp ->
                        if (resp.isSuccessful) {
                            val arr = JsonParser.parseString(resp.body?.string().orEmpty()).asJsonArray
                            for (el in arr) {
                                val obj = el.asJsonObject
                                val filesObj = obj.getAsJsonObject("files")
                                if (filesObj != null && filesObj.has(fileName)) {
                                    gistId = obj.get("id")?.asString.orEmpty()
                                    break
                                }
                            }
                        }
                    }
                }

                if (gistId.isNotEmpty()) {
                    val getReq = Request.Builder()
                        .url("https://api.github.com/gists/$gistId")
                        .header("Authorization", "Bearer $token")
                        .header("Accept", "application/vnd.github+json")
                        .build()
                    httpClient.newCall(getReq).execute().use { resp ->
                        if (resp.isSuccessful) {
                            val bodyStr = resp.body?.string().orEmpty()
                            val root = JsonParser.parseString(bodyStr).asJsonObject
                            val filesObj = root.getAsJsonObject("files")
                            val vaultFile = filesObj?.getAsJsonObject(fileName)
                            val contentStr = vaultFile?.get("content")?.asString
                            if (!contentStr.isNullOrBlank()) {
                                remotePayload = try {
                                    gson.fromJson(contentStr, SyncVaultPayload::class.java) ?: SyncVaultPayload()
                                } catch (_: Exception) { SyncVaultPayload() }
                            }
                        } else if (resp.code == 404) {
                            gistId = ""
                        }
                    }
                }

                val (mergedPayload, newLogsCount, newTeamsCount) = reconcileSyncVaultPayloads(localPayload, remotePayload)
                saveReconciledSyncVaultLocally(prefs, gson, mergedPayload)

                val mergedJsonStr = gson.toJson(mergedPayload)
                val bodyMap = mapOf(
                    "description" to "SilphScope PvP Multi-Device Sync Vault (Teams & Battle Logs)",
                    "public" to false,
                    "files" to mapOf(
                        fileName to mapOf("content" to mergedJsonStr)
                    )
                )
                val reqBody = gson.toJson(bodyMap)
                    .toRequestBody("application/json; charset=utf-8".toMediaTypeOrNull())
                val pushReq = if (gistId.isEmpty()) {
                    Request.Builder()
                        .url("https://api.github.com/gists")
                        .post(reqBody)
                        .header("Authorization", "Bearer $token")
                        .header("Accept", "application/vnd.github+json")
                        .build()
                } else {
                    Request.Builder()
                        .url("https://api.github.com/gists/$gistId")
                        .patch(reqBody)
                        .header("Authorization", "Bearer $token")
                        .header("Accept", "application/vnd.github+json")
                        .build()
                }

                httpClient.newCall(pushReq).execute().use { pushResp ->
                    if (!pushResp.isSuccessful) {
                        return false to "Sync error (HTTP ${pushResp.code})"
                    }
                    if (gistId.isEmpty()) {
                        val respObj = JsonParser.parseString(pushResp.body?.string().orEmpty()).asJsonObject
                        val createdId = respObj.get("id")?.asString.orEmpty()
                        if (createdId.isNotEmpty()) {
                            prefs.edit().putString(PREFS_KEY_SYNC_GIST_ID, createdId).apply()
                        }
                    }
                }

                val userTag = if (username.isNotEmpty()) "@$username" else "Private Gist"
                return true to "Synced ($userTag)! (${mergedPayload.battleLogs.size} battles, +$newLogsCount from other devices · ${mergedPayload.teamPresets.size} teams, +$newTeamsCount updated)"
            } catch (e: Exception) {
                return false to "Sync failed: ${e.localizedMessage ?: "Network error"}"
            }
        }

        data class MoveStats(
            val name: String,
            val type: String,
            val power: Int,
            val energyCost: Int = 50
        )

        data class PokemonMeta(
            val name: String,
            val speciesId: String,
            val baseSpecies: String,
            val formLabel: String,
            val types: List<String>,
            val defaultCp: Int,
            val defaultFastMove: String,
            val fastTurns: Int,
            val chargedMove1: String,
            val chargedMove2: String,
            val c1Dmg: Int = 35,
            val c2Dmg: Int = 50,
            val atk: Double = 210.0,
            val def: Double = 190.0,
            val hp: Int = 180,
            val glRank: Int = 500,
            val ulRank: Int = 500,
            val mlRank: Int = 500,
            val chargedMove3: String = "",
            val chargedMove4: String = "",
            val isRawBaseStats: Boolean = false,
            val defaultIvsGl: String = "1/15/15",
            val defaultIvsUl: String = "1/15/15"
        )

        val RECOMMENDED_CHARGED_MOVES: Map<String, Triple<String, String, String>> = mapOf(
            "Rillaboom" to Triple("Drum Beating", "Earth Power", "Frenzy Plant"),
            "rillaboom" to Triple("Drum Beating", "Earth Power", "Frenzy Plant"),
            "Tinkaton" to Triple("Gigaton Hammer", "Bulldoze", "Brutal Swing"),
            "tinkaton" to Triple("Gigaton Hammer", "Bulldoze", "Brutal Swing"),
            "Kanto Ninetales" to Triple("Weather Ball (Fire)", "Energy Ball", "Psyshock"),
            "ninetales" to Triple("Weather Ball (Fire)", "Energy Ball", "Psyshock"),
            "Ninetales (Alolan)" to Triple("Weather Ball (Ice)", "Chilling Water", "Psyshock"),
            "Alolan Ninetales" to Triple("Weather Ball (Ice)", "Chilling Water", "Psyshock"),
            "ninetales_alolan" to Triple("Weather Ball (Ice)", "Chilling Water", "Psyshock"),
            "ninetales_alolan_shadow" to Triple("Weather Ball (Ice)", "Chilling Water", "Psyshock"),
            "Corviknight" to Triple("Air Cutter", "Iron Head", "Sky Attack"),
            "corviknight" to Triple("Air Cutter", "Iron Head", "Sky Attack"),
            "Lugia" to Triple("Aeroblast", "Earth Power", "Hydro Pump"),
            "lugia" to Triple("Aeroblast", "Earth Power", "Hydro Pump"),
            "Kyogre" to Triple("Origin Pulse", "Avalanche", "Surf"),
            "kyogre" to Triple("Origin Pulse", "Avalanche", "Surf"),
            "Fearow" to Triple("Drill Run", "Drill Peck", "Twister"),
            "fearow" to Triple("Drill Run", "Drill Peck", "Twister"),
            "Zacian (Crowned)" to Triple("Behemoth Blade", "Close Combat", "Play Rough"),
            "zacian_crowned" to Triple("Behemoth Blade", "Close Combat", "Play Rough"),
            "zacian" to Triple("Close Combat", "Play Rough", "Wild Charge"),
            "Zamazenta (Crowned)" to Triple("Behemoth Bash", "Close Combat", "Moonblast"),
            "zamazenta_crowned" to Triple("Behemoth Bash", "Close Combat", "Moonblast"),
            "zamazenta" to Triple("Close Combat", "Crunch", "Moonblast"),
            "Keldeo (Resolute)" to Triple("Secret Sword", "Aqua Jet", "Hydro Pump"),
            "keldeo_resolute" to Triple("Secret Sword", "Aqua Jet", "Hydro Pump"),
            "Keldeo (Ordinary)" to Triple("Sacred Sword", "Aqua Jet", "Hydro Pump"),
            "keldeo" to Triple("Sacred Sword", "Aqua Jet", "Hydro Pump"),
            "Kyurem (Black)" to Triple("Freeze Shock", "Fusion Bolt", "Outrage"),
            "kyurem_black" to Triple("Freeze Shock", "Fusion Bolt", "Outrage"),
            "Kyurem (White)" to Triple("Ice Burn", "Fusion Flare", "Blizzard"),
            "kyurem_white" to Triple("Ice Burn", "Fusion Flare", "Blizzard"),
            "Kyurem" to Triple("Glaciate", "Dragon Claw", "Blizzard"),
            "kyurem" to Triple("Glaciate", "Dragon Claw", "Blizzard"),
            "Zygarde" to Triple("Crunch", "Earthquake", "Outrage"),
            "zygarde" to Triple("Crunch", "Earthquake", "Outrage"),
            "Ampharos" to Triple("Brutal Swing", "Trailblaze", "Zap Cannon"),
            "ampharos" to Triple("Brutal Swing", "Trailblaze", "Zap Cannon"),
            "Dialga (Origin)" to Triple("Roar of Time", "Iron Head", "Thunder"),
            "dialga_origin" to Triple("Roar of Time", "Iron Head", "Thunder"),
            "Dialga" to Triple("Draco Meteor", "Iron Head", "Thunder"),
            "dialga" to Triple("Draco Meteor", "Iron Head", "Thunder"),
            "Palkia (Origin)" to Triple("Spacial Rend", "Aqua Tail", "Hydro Pump"),
            "palkia_origin" to Triple("Spacial Rend", "Aqua Tail", "Hydro Pump"),
            "Palkia" to Triple("Aqua Tail", "Draco Meteor", "Fire Blast"),
            "palkia" to Triple("Aqua Tail", "Draco Meteor", "Fire Blast"),
            "Groudon" to Triple("Precipice Blades", "Fire Punch", "Earthquake"),
            "groudon" to Triple("Precipice Blades", "Fire Punch", "Earthquake"),
            "Ho-Oh" to Triple("Sacred Fire", "Brave Bird", "Earthquake"),
            "ho_oh" to Triple("Sacred Fire", "Brave Bird", "Earthquake"),
            "ho-oh" to Triple("Sacred Fire", "Brave Bird", "Earthquake"),
            "Yveltal" to Triple("Dark Pulse", "Oblivion Wing", "Focus Blast"),
            "yveltal" to Triple("Dark Pulse", "Oblivion Wing", "Focus Blast"),
            "Xerneas" to Triple("Close Combat", "Moonblast", "Megahorn"),
            "xerneas" to Triple("Close Combat", "Moonblast", "Megahorn"),
            "Landorus (Therian)" to Triple("Sandsear Storm", "Stone Edge", "Superpower"),
            "landorus_therian" to Triple("Sandsear Storm", "Stone Edge", "Superpower"),
            "Necrozma (Dusk Mane)" to Triple("Sunsteel Strike", "Dark Pulse", "Iron Head"),
            "necrozma_dusk_mane" to Triple("Sunsteel Strike", "Dark Pulse", "Iron Head"),
            "Necrozma (Dawn Wings)" to Triple("Moongeist Beam", "Dark Pulse", "Iron Head"),
            "necrozma_dawn_wings" to Triple("Moongeist Beam", "Dark Pulse", "Iron Head"),
            "Mewtwo" to Triple("Psystrike", "Shadow Ball", "Focus Blast"),
            "mewtwo" to Triple("Psystrike", "Shadow Ball", "Focus Blast"),
            "Rhyperior" to Triple("Rock Wrecker", "Breaking Swipe", "Superpower"),
            "rhyperior" to Triple("Rock Wrecker", "Breaking Swipe", "Superpower"),
            "Dragonite" to Triple("Dragon Claw", "Superpower", "Outrage"),
            "dragonite" to Triple("Dragon Claw", "Superpower", "Outrage"),
            "Metagross" to Triple("Meteor Mash", "Earthquake", "Psychic"),
            "metagross" to Triple("Meteor Mash", "Earthquake", "Psychic"),
            "Melmetal" to Triple("Superpower", "Rock Slide", "Double Iron Bash"),
            "melmetal" to Triple("Superpower", "Rock Slide", "Double Iron Bash"),
            "Excadrill" to Triple("Drill Run", "Rock Slide", "Iron Head"),
            "excadrill" to Triple("Drill Run", "Rock Slide", "Iron Head"),
            "Mamoswine" to Triple("Avalanche", "High Horsepower", "Stone Edge"),
            "mamoswine" to Triple("Avalanche", "High Horsepower", "Stone Edge"),
            "Clodsire" to Triple("Earthquake", "Stone Edge", "Sludge Bomb"),
            "clodsire" to Triple("Earthquake", "Stone Edge", "Sludge Bomb"),
            "Feraligatr" to Triple("Hydro Cannon", "Ice Beam", "Crunch"),
            "feraligatr" to Triple("Hydro Cannon", "Ice Beam", "Crunch"),
            "Mandibuzz" to Triple("Dark Pulse", "Aerial Ace", "Foul Play"),
            "mandibuzz" to Triple("Dark Pulse", "Aerial Ace", "Foul Play"),
            "Azumarill" to Triple("Ice Beam", "Play Rough", "Hydro Pump"),
            "azumarill" to Triple("Ice Beam", "Play Rough", "Hydro Pump"),
            "Gastrodon" to Triple("Body Slam", "Earth Power", "Water Pulse"),
            "gastrodon" to Triple("Body Slam", "Earth Power", "Water Pulse"),
            "Annihilape" to Triple("Rage Fist", "Ice Punch", "Close Combat"),
            "annihilape" to Triple("Rage Fist", "Ice Punch", "Close Combat"),
            "Primeape" to Triple("Rage Fist", "Close Combat", "Ice Punch"),
            "primeape" to Triple("Rage Fist", "Close Combat", "Ice Punch"),
            "Cresselia" to Triple("Grass Knot", "Moonblast", "Future Sight"),
            "cresselia" to Triple("Grass Knot", "Moonblast", "Future Sight"),
            "Swampert" to Triple("Hydro Cannon", "Earthquake", "Sludge Wave"),
            "swampert" to Triple("Hydro Cannon", "Earthquake", "Sludge Wave"),
            "Quagsire" to Triple("Aqua Tail", "Stone Edge", "Mud Bomb"),
            "quagsire" to Triple("Aqua Tail", "Stone Edge", "Mud Bomb"),
            "Whiscash" to Triple("Scald", "Mud Bomb", "Blizzard"),
            "whiscash" to Triple("Scald", "Mud Bomb", "Blizzard"),
            "Talonflame" to Triple("Fly", "Flame Charge", "Brave Bird"),
            "talonflame" to Triple("Fly", "Flame Charge", "Brave Bird"),
            "Serperior" to Triple("Frenzy Plant", "Aerial Ace", "Leaf Tornado"),
            "serperior" to Triple("Frenzy Plant", "Aerial Ace", "Leaf Tornado"),
            "Skeledirge" to Triple("Torch Song", "Shadow Ball", "Disarming Voice"),
            "skeledirge" to Triple("Torch Song", "Shadow Ball", "Disarming Voice"),
            "Snorlax" to Triple("Body Slam", "Earthquake", "Superpower"),
            "snorlax" to Triple("Body Slam", "Earthquake", "Superpower"),
            "Shadow Snorlax" to Triple("Body Slam", "Superpower", "Earthquake"),
            "snorlax_shadow" to Triple("Body Slam", "Superpower", "Earthquake"),
            "Greninja" to Triple("Hydro Cannon", "Brutal Swing", "Night Slash"),
            "greninja" to Triple("Hydro Cannon", "Brutal Swing", "Night Slash"),
            "Shadow Greninja" to Triple("Hydro Cannon", "Night Slash", "Brutal Swing"),
            "greninja_shadow" to Triple("Hydro Cannon", "Night Slash", "Brutal Swing"),
            "Lickilicky" to Triple("Body Slam", "Shadow Ball", "Earthquake"),
            "lickilicky" to Triple("Body Slam", "Shadow Ball", "Earthquake"),
            "Lickitung" to Triple("Body Slam", "Power Whip", "Stomp"),
            "lickitung" to Triple("Body Slam", "Power Whip", "Stomp"),
            "Skarmory" to Triple("Brave Bird", "Sky Attack", "Flash Cannon"),
            "skarmory" to Triple("Brave Bird", "Sky Attack", "Flash Cannon"),
            "Registeel" to Triple("Zap Cannon", "Focus Blast", "Hyper Beam"),
            "registeel" to Triple("Zap Cannon", "Focus Blast", "Hyper Beam"),
            "Trevenant" to Triple("Seed Bomb", "Shadow Ball", "Foul Play"),
            "trevenant" to Triple("Seed Bomb", "Shadow Ball", "Foul Play"),
            "Morpeko" to Triple("Aura Wheel", "Psychic Fangs", "Outrage"),
            "morpeko" to Triple("Aura Wheel", "Psychic Fangs", "Outrage"),
            "Poliwrath" to Triple("Icy Wind", "Scald", "Dynamic Punch"),
            "poliwrath" to Triple("Icy Wind", "Scald", "Dynamic Punch"),
            "Pelipper" to Triple("Weather Ball", "Hurricane", "Hydro Pump"),
            "pelipper" to Triple("Weather Ball", "Hurricane", "Hydro Pump"),
            "Mantine" to Triple("Aerial Ace", "Ice Beam", "Water Pulse"),
            "mantine" to Triple("Aerial Ace", "Ice Beam", "Water Pulse"),
            "Dewgong" to Triple("Icy Wind", "Drill Run", "Blizzard"),
            "dewgong" to Triple("Icy Wind", "Drill Run", "Blizzard"),
            "Walrein" to Triple("Icicle Spear", "Earthquake", "Blizzard"),
            "walrein" to Triple("Icicle Spear", "Earthquake", "Blizzard"),
            "Mimikyu" to Triple("Play Rough", "Shadow Sneak", "Shadow Ball"),
            "mimikyu" to Triple("Play Rough", "Shadow Sneak", "Shadow Ball"),
            "Gholdengo" to Triple("Shadow Ball", "Focus Blast", "Dazzling Gleam"),
            "gholdengo" to Triple("Shadow Ball", "Focus Blast", "Dazzling Gleam"),
            "Baxcalibur" to Triple("Avalanche", "Dragon Claw", "Blizzard"),
            "baxcalibur" to Triple("Avalanche", "Dragon Claw", "Blizzard")
        )

        fun applyRecommendedMoves(meta: PokemonMeta): PokemonMeta {
            val cleanSpeciesId = meta.speciesId.lowercase().removeSuffix("_shadow")
            val isBaseForm = cleanSpeciesId == meta.baseSpecies.lowercase() &&
                (meta.formLabel.equals("Base", ignoreCase = true) ||
                    meta.formLabel.equals("Kanto", ignoreCase = true) ||
                    meta.formLabel.equals("Shadow", ignoreCase = true))
            val rec = RECOMMENDED_CHARGED_MOVES[meta.name]
                ?: RECOMMENDED_CHARGED_MOVES[meta.speciesId.lowercase()]
                ?: RECOMMENDED_CHARGED_MOVES[cleanSpeciesId]
                ?: if (isBaseForm) RECOMMENDED_CHARGED_MOVES[meta.baseSpecies.lowercase()] else null
            return if (rec != null) {
                meta.copy(
                    chargedMove1 = rec.first,
                    chargedMove2 = rec.second,
                    chargedMove3 = rec.third
                )
            } else {
                meta
            }
        }

        val COMMON_THIRD_CHARGED_MOVE: Map<String, String> = mapOf(
            "Dialga (Origin)" to "Thunder",
            "Dialga" to "Thunder",
            "Palkia (Origin)" to "Hydro Pump",
            "Palkia" to "Hydro Pump",
            "Zacian (Crowned)" to "Play Rough",
            "Zacian (Hero)" to "Wild Charge",
            "Zamazenta (Crowned)" to "Moonblast",
            "Zamazenta (Hero)" to "Moonblast",
            "Keldeo (Resolute)" to "Hydro Pump",
            "Keldeo (Ordinary)" to "Hydro Pump",
            "Zygarde" to "Outrage",
            "Lugia" to "Sky Attack",
            "Kyogre" to "Surf",
            "Groudon" to "Solar Beam",
            "Giratina (Origin)" to "Dragon Pulse",
            "Giratina (Altered)" to "Shadow Sneak",
            "Mewtwo" to "Shadow Ball",
            "Xerneas" to "Megahorn",
            "Yveltal" to "Focus Blast",
            "Landorus (Therian)" to "Superpower",
            "Landorus (Incarnate)" to "Outrage",
            "Ho-Oh" to "Solar Beam",
            "Necrozma (Dusk Mane)" to "Outrage",
            "Necrozma (Dawn Wings)" to "Outrage",
            "Solgaleo" to "Solar Beam",
            "Lunala" to "Future Sight",
            "Dragonite" to "Hurricane",
            "Metagross" to "Psychic",
            "Excadrill" to "Iron Head",
            "Rhyperior" to "Surf",
            "Garchomp" to "Earth Power",
            "Mamoswine" to "Stone Edge",
            "Florges" to "Psychic",
            "Reshiram" to "Crunch",
            "Zekrom" to "Outrage",
            "Kyurem (Black)" to "Outrage",
            "Kyurem (White)" to "Blizzard",
            "Kyurem" to "Blizzard",
            "Primarina" to "Moonblast",
            "Ursaluna" to "Swift",
            "Togekiss" to "Ancient Power",
            "Gyarados" to "Outrage",
            "Melmetal" to "Thunderbolt",
            "Zarude" to "Energy Ball",
            "Marshadow" to "Close Combat",
            "Enamorus" to "Grass Knot",
            "Corviknight" to "Payback",
            "Mimikyu" to "Shadow Ball",
            "Kanto Ninetales" to "Overheat",
            "Ninetales (Alolan)" to "Psyshock",
            "Fearow" to "Sky Attack",
            "Shadow Pidgeot" to "Feather Dance",
            "Pidgeot" to "Air Cutter",
            "Deoxys (Defense)" to "Thunderbolt",
            "Deoxys (Normal)" to "Hyper Beam",
            "Cresselia" to "Future Sight",
            "Registeel" to "Flash Cannon",
            "Swampert" to "Sludge Wave",
            "Feraligatr" to "Crunch",
            "Talonflame" to "Fly",
            "Clodsire" to "Megahorn",
            "Azumarill" to "Hydro Pump",
            "Bastiodon" to "Flash Cannon",
            "Lickilicky" to "Solar Beam",
            "Mandibuzz" to "Shadow Ball",
            "Umbreon" to "Psychic",
            "Annihilape" to "Close Combat",
            "Poliwrath" to "Dynamic Punch",
            "Medicham" to "Psychic",
            "Sableye" to "Shadow Sneak",
            "Carbink" to "Power Gem",
            "Skarmory" to "Flash Cannon",
            "Altaria" to "Dazzling Gleam",
            "Pelipper" to "Blizzard",
            "Mantine" to "Water Pulse",
            "Lanturn" to "Hydro Pump",
            "Whiscash" to "Blizzard",
            "Quagsire" to "Sludge Bomb",
            "Gastrodon" to "Water Pulse",
            "Dunsparce" to "Drill Run",
            "Wigglytuff" to "Disarming Voice",
            "Clefable" to "Psychic",
            "Charizard" to "Overheat",
            "Venusaur" to "Petal Blizzard",
            "Serperior" to "Aerial Ace",
            "Abomasnow" to "Outrage",
            "Walrein" to "Water Pulse",
            "Dewgong" to "Blizzard",
            "Lapras" to "Blizzard",
            "Sandslash (Alolan)" to "Blizzard",
            "Marowak (Alolan)" to "Fire Punch",
            "Trevenant" to "Foul Play",
            "Jellicent" to "Ice Beam",
            "Drifblim" to "Mystical Fire",
            "Froslass" to "Crunch",
            "Skeledirge" to "Disarming Voice",
            "Snorlax" to "Superpower",
            "Shadow Snorlax" to "Earthquake",
            "Typhlosion" to "Solar Beam",
            "Goodra" to "Power Whip",
            "Guzzlord" to "Sludge Bomb",
            "Zweilous" to "Dragon Pulse",
            "Virizion" to "Stone Edge",
            "Cobalion" to "Iron Head",
            "Tapu Fini" to "Ice Beam",
            "Tapu Lele" to "Future Sight",
            "Tapu Bulu" to "Megahorn",
            "Tapu Koko" to "Thunder",
            "Tentacruel" to "Blizzard",
            "Toxapex" to "Gunk Shot",
            "Drapion" to "Sludge Bomb",
            "Skuntank" to "Sludge Bomb",
            "Muk (Alolan)" to "Gunk Shot",
            "Obstagoon" to "Hyper Beam",
            "Scrafty" to "Acid Spray",
            "Machamp" to "Payback",
            "Primeape" to "Close Combat",
            "Pangoro" to "Iron Head",
            "Malamar" to "Hyper Beam",
            "Stunfisk" to "Muddy Water",
            "Stunfisk (Galarian)" to "Flash Cannon",
            "Steelix" to "Heavy Slam",
            "Empoleon" to "Blizzard",
            "Greninja" to "Night Slash",
            "Shadow Greninja" to "Brutal Swing",
            "Samurott" to "Blizzard",
            "Golisopod" to "Aerial Ace",
            "Araquanid" to "Water Pulse",
            "Ariados" to "Trailblaze",
            "Charjabug" to "Crunch",
            "Galvantula" to "Energy Ball",
            "Ampharos" to "Focus Blast",
            "Magnezone" to "Flash Cannon",
            "Togedemaru" to "Gyro Ball",
            "Morpeko" to "Outrage",
            "Raikou" to "Thunderbolt",
            "Entei" to "Overheat",
            "Suicune" to "Hydro Pump",
            "Zapdos" to "Ancient Power",
            "Zapdos (Galarian)" to "Payback",
            "Moltres" to "Overheat",
            "Moltres (Galarian)" to "Payback",
            "Articuno" to "Hurricane",
            "Articuno (Galarian)" to "Future Sight",
            "Jumpluff" to "Dazzling Gleam",
            "Tropius" to "Aerial Ace",
            "Noctowl" to "Psychic",
            "Gligar" to "Night Slash",
            "Gliscor" to "Sand Tomb"
        )

        val MOVE_DATABASE: Map<String, MoveStats> = mapOf(
            "Behemoth Blade" to MoveStats("Behemoth Blade", "steel", 100, 55),
            "Behemoth Bash" to MoveStats("Behemoth Bash", "steel", 80, 45),
            "Secret Sword" to MoveStats("Secret Sword", "fighting", 70, 35),
            "Aqua Jet" to MoveStats("Aqua Jet", "water", 70, 40),
            "Double Iron Bash" to MoveStats("Double Iron Bash", "steel", 70, 35),
            "Bleakwind Storm" to MoveStats("Bleakwind Storm", "flying", 60, 45),
            "Wildbolt Storm" to MoveStats("Wildbolt Storm", "electric", 60, 45),
            "Springtide Storm" to MoveStats("Springtide Storm", "fairy", 60),
            "Roar of Time" to MoveStats("Roar of Time", "dragon", 150, 65),
            "Iron Head" to MoveStats("Iron Head", "steel", 85, 50),
            "Draco Meteor" to MoveStats("Draco Meteor", "dragon", 150, 65),
            "Thunder" to MoveStats("Thunder", "electric", 100, 60),
            "Aeroblast" to MoveStats("Aeroblast", "flying", 170, 75),
            "Sky Attack" to MoveStats("Sky Attack", "flying", 75, 50),
            "Future Sight" to MoveStats("Future Sight", "psychic", 110, 65),
            "Surf" to MoveStats("Surf", "water", 75, 45),
            "Origin Pulse" to MoveStats("Origin Pulse", "water", 130, 60),
            "Hydro Pump" to MoveStats("Hydro Pump", "water", 130, 75),
            "Blizzard" to MoveStats("Blizzard", "ice", 140, 75),
            "Close Combat" to MoveStats("Close Combat", "fighting", 100, 45),
            "Brave Bird" to MoveStats("Brave Bird", "flying", 130, 55),
            "Play Rough" to MoveStats("Play Rough", "fairy", 90, 60),
            "Wild Charge" to MoveStats("Wild Charge", "electric", 100, 45),
            "Shadow Ball" to MoveStats("Shadow Ball", "ghost", 90, 50),
            "Ominous Wind" to MoveStats("Ominous Wind", "ghost", 45, 45),
            "Dragon Claw" to MoveStats("Dragon Claw", "dragon", 80, 50),
            "Ancient Power" to MoveStats("Ancient Power", "rock", 60, 45),
            "Shadow Force" to MoveStats("Shadow Force", "ghost", 120, 65),
            "Spacial Rend" to MoveStats("Spacial Rend", "dragon", 95, 55),
            "Aqua Tail" to MoveStats("Aqua Tail", "water", 55, 35),
            "Precipice Blades" to MoveStats("Precipice Blades", "ground", 130, 60),
            "Fire Punch" to MoveStats("Fire Punch", "fire", 60, 40),
            "Psystrike" to MoveStats("Psystrike", "psychic", 90, 45),
            "Ice Beam" to MoveStats("Ice Beam", "ice", 90, 55),
            "Moonblast" to MoveStats("Moonblast", "fairy", 90, 50),
            "Dark Pulse" to MoveStats("Dark Pulse", "dark", 80, 45),
            "Oblivion Wing" to MoveStats("Oblivion Wing", "flying", 85, 50),
            "Crunch" to MoveStats("Crunch", "dark", 70, 45),
            "Earthquake" to MoveStats("Earthquake", "ground", 120, 65),
            "Sandsear Storm" to MoveStats("Sandsear Storm", "ground", 60, 45),
            "Stone Edge" to MoveStats("Stone Edge", "rock", 100, 55),
            "Superpower" to MoveStats("Superpower", "fighting", 85, 40),
            "Sacred Fire" to MoveStats("Sacred Fire", "fire", 130, 65),
            "Sunsteel Strike" to MoveStats("Sunsteel Strike", "steel", 135, 65),
            "Moongeist Beam" to MoveStats("Moongeist Beam", "ghost", 135, 65),
            "Rock Slide" to MoveStats("Rock Slide", "rock", 75, 45),
            "Earth Power" to MoveStats("Earth Power", "ground", 90, 50),
            "Outrage" to MoveStats("Outrage", "dragon", 110, 60),
            "Meteor Mash" to MoveStats("Meteor Mash", "steel", 100, 45),
            "Drill Run" to MoveStats("Drill Run", "ground", 70, 40),
            "Rock Wrecker" to MoveStats("Rock Wrecker", "rock", 110, 50),
            "Breaking Swipe" to MoveStats("Breaking Swipe", "dragon", 50, 50),
            "Avalanche" to MoveStats("Avalanche", "ice", 90, 45),
            "High Horsepower" to MoveStats("High Horsepower", "ground", 100, 55),
            "Ice Punch" to MoveStats("Ice Punch", "ice", 60, 40),
            "Fusion Flare" to MoveStats("Fusion Flare", "fire", 90, 45),
            "Overheat" to MoveStats("Overheat", "fire", 130, 55),
            "Fusion Bolt" to MoveStats("Fusion Bolt", "electric", 90, 45),
            "Glaciate" to MoveStats("Glaciate", "ice", 60, 40),
            "Disarming Voice" to MoveStats("Disarming Voice", "fairy", 70, 45),
            "Hydro Cannon" to MoveStats("Hydro Cannon", "water", 80, 40),
            "Weather Ball" to MoveStats("Weather Ball", "ice", 60, 35),
            "Weather Ball (Ice)" to MoveStats("Weather Ball (Ice)", "ice", 60, 35),
            "Weather Ball (Fire)" to MoveStats("Weather Ball (Fire)", "fire", 60, 35),
            "Weather Ball (Water)" to MoveStats("Weather Ball (Water)", "water", 60, 35),
            "Weather Ball (Rock)" to MoveStats("Weather Ball (Rock)", "rock", 60, 35),
            "Chilling Water" to MoveStats("Chilling Water", "water", 60, 45),
            "Dazzling Gleam" to MoveStats("Dazzling Gleam", "fairy", 90, 55),
            "Scorching Sands" to MoveStats("Scorching Sands", "ground", 80, 50),
            "Psycho Boost" to MoveStats("Psycho Boost", "psychic", 85, 35),
            "Thunderbolt" to MoveStats("Thunderbolt", "electric", 90, 55),
            "Grass Knot" to MoveStats("Grass Knot", "grass", 90, 50),
            "Sacred Sword" to MoveStats("Sacred Sword", "fighting", 60, 35),
            "Leaf Blade" to MoveStats("Leaf Blade", "grass", 70, 35),
            "Aerial Ace" to MoveStats("Aerial Ace", "flying", 60, 45),
            "Fly" to MoveStats("Fly", "flying", 80, 45),
            "Flame Charge" to MoveStats("Flame Charge", "fire", 65, 50),
            "Blast Burn" to MoveStats("Blast Burn", "fire", 110, 50),
            "Feather Dance" to MoveStats("Feather Dance", "flying", 35, 50),
            "Shadow Sneak" to MoveStats("Shadow Sneak", "ghost", 75, 50),
            "Twister" to MoveStats("Twister", "dragon", 70, 40),
            "Air Cutter" to MoveStats("Air Cutter", "flying", 60, 40),
            "Payback" to MoveStats("Payback", "dark", 110, 60),
            "Body Slam" to MoveStats("Body Slam", "normal", 65, 40),
            "Foul Play" to MoveStats("Foul Play", "dark", 65, 40),
            "Night Slash" to MoveStats("Night Slash", "dark", 50, 35),
            "Cross Chop" to MoveStats("Cross Chop", "fighting", 55, 35),
            "Dynamic Punch" to MoveStats("Dynamic Punch", "fighting", 90, 45),
            "Aura Sphere" to MoveStats("Aura Sphere", "fighting", 80, 40),
            "Focus Blast" to MoveStats("Focus Blast", "fighting", 150, 75),
            "Sludge Bomb" to MoveStats("Sludge Bomb", "poison", 80, 50),
            "Sludge Wave" to MoveStats("Sludge Wave", "poison", 110, 65),
            "Acid Spray" to MoveStats("Acid Spray", "poison", 20, 45),
            "Poison Fang" to MoveStats("Poison Fang", "poison", 50, 40),
            "Cross Poison" to MoveStats("Cross Poison", "poison", 50, 35),
            "Gunk Shot" to MoveStats("Gunk Shot", "poison", 130, 75),
            "Mud Bomb" to MoveStats("Mud Bomb", "ground", 65, 45),
            "Bone Club" to MoveStats("Bone Club", "ground", 55, 35),
            "Shadow Bone" to MoveStats("Shadow Bone", "ghost", 80, 45),
            "Hurricane" to MoveStats("Hurricane", "flying", 110, 60),
            "Acrobatics" to MoveStats("Acrobatics", "flying", 110, 55),
            "Drill Peck" to MoveStats("Drill Peck", "flying", 70, 40),
            "Psychic" to MoveStats("Psychic", "psychic", 75, 55),
            "Psyshock" to MoveStats("Psyshock", "psychic", 70, 40),
            "Psychic Fangs" to MoveStats("Psychic Fangs", "psychic", 40, 35),
            "Lunge" to MoveStats("Lunge", "bug", 70, 45),
            "Megahorn" to MoveStats("Megahorn", "bug", 110, 55),
            "X-Scissor" to MoveStats("X-Scissor", "bug", 65, 40),
            "Power Gem" to MoveStats("Power Gem", "rock", 85, 50),
            "Meteor Beam" to MoveStats("Meteor Beam", "rock", 120, 60),
            "Night Shade" to MoveStats("Night Shade", "ghost", 70, 45),
            "Icy Wind" to MoveStats("Icy Wind", "ice", 60, 45),
            "Triple Axel" to MoveStats("Triple Axel", "ice", 60, 45),
            "Icicle Spear" to MoveStats("Icicle Spear", "ice", 70, 40),
            "Freeze Shock" to MoveStats("Freeze Shock", "ice", 120, 60),
            "Ice Burn" to MoveStats("Ice Burn", "ice", 120, 60),
            "Dragon Pulse" to MoveStats("Dragon Pulse", "dragon", 90, 55),
            "Brutal Swing" to MoveStats("Brutal Swing", "dark", 55, 35),
            "Flash Cannon" to MoveStats("Flash Cannon", "steel", 110, 65),
            "Heavy Slam" to MoveStats("Heavy Slam", "steel", 70, 50),
            "Magnet Bomb" to MoveStats("Magnet Bomb", "steel", 70, 40),
            "Mirror Shot" to MoveStats("Mirror Shot", "steel", 35, 35),
            "Doom Desire" to MoveStats("Doom Desire", "steel", 80, 40),
            "Frenzy Plant" to MoveStats("Frenzy Plant", "grass", 100, 45),
            "Energy Ball" to MoveStats("Energy Ball", "grass", 80, 45),
            "Seed Bomb" to MoveStats("Seed Bomb", "grass", 55, 40),
            "Power Whip" to MoveStats("Power Whip", "grass", 90, 50),
            "Trailblaze" to MoveStats("Trailblaze", "grass", 65, 45),
            "Solar Beam" to MoveStats("Solar Beam", "grass", 150, 80),
            "Discharge" to MoveStats("Discharge", "electric", 55, 40),
            "Zap Cannon" to MoveStats("Zap Cannon", "electric", 150, 80),
            "Scald" to MoveStats("Scald", "water", 85, 50),
            "Liquidation" to MoveStats("Liquidation", "water", 70, 45),
            "Muddy Water" to MoveStats("Muddy Water", "water", 35, 35),
            "Water Pulse" to MoveStats("Water Pulse", "water", 80, 50),
            "Nature's Madness" to MoveStats("Nature's Madness", "fairy", 80, 50),
            "Swift" to MoveStats("Swift", "normal", 55, 35),
            "Hyper Beam" to MoveStats("Hyper Beam", "normal", 150, 80),
            "Aura Wheel" to MoveStats("Aura Wheel", "electric", 100, 45),
            "Rage Fist" to MoveStats("Rage Fist", "ghost", 55, 40),
            "Torch Song" to MoveStats("Torch Song", "fire", 70, 45),
            "Super Power" to MoveStats("Superpower", "fighting", 85, 40),
            "Drum Beating" to MoveStats("Drum Beating", "grass", 60, 35),
            "Gigaton Hammer" to MoveStats("Gigaton Hammer", "steel", 130, 60),
            "Bulldoze" to MoveStats("Bulldoze", "ground", 80, 55),
            "Air Cutter" to MoveStats("Air Cutter", "flying", 60, 40),
            "Rock Tomb" to MoveStats("Rock Tomb", "rock", 75, 50),
            "Sand Tomb" to MoveStats("Sand Tomb", "ground", 55, 45),
            "Thunder Punch" to MoveStats("Thunder Punch", "electric", 60, 40),
            "Flamethrower" to MoveStats("Flamethrower", "fire", 90, 55),
            "Fire Blast" to MoveStats("Fire Blast", "fire", 140, 80),
            "Last Resort" to MoveStats("Last Resort", "normal", 90, 55),
            "Brine" to MoveStats("Brine", "water", 100, 60),
            "Dig" to MoveStats("Dig", "ground", 70, 50),
            "Shadow Punch" to MoveStats("Shadow Punch", "ghost", 55, 35),
            "Spirit Shackle" to MoveStats("Spirit Shackle", "ghost", 50, 40),
            "Darkest Lariat" to MoveStats("Darkest Lariat", "dark", 120, 60),
            "Power-Up Punch" to MoveStats("Power-Up Punch", "fighting", 20, 35),
            "Bubble Beam" to MoveStats("Bubble Beam", "water", 50, 50),
            "Bug Buzz" to MoveStats("Bug Buzz", "bug", 100, 60),
            "Leaf Tornado" to MoveStats("Leaf Tornado", "grass", 45, 40),
            "Stomp" to MoveStats("Stomp", "normal", 55, 40),
            "Petal Blizzard" to MoveStats("Petal Blizzard", "grass", 110, 65),
            "Mystical Fire" to MoveStats("Mystical Fire", "fire", 60, 45),
            "Gyro Ball" to MoveStats("Gyro Ball", "steel", 80, 50)
        )

        fun resolveChargedMoveStatsStatic(moveName: String, fallbackType: String = "normal"): MoveStats {
            val trimmed = moveName.trim()
            DYNAMIC_MOVE_DATABASE[trimmed]?.let { return it }
            DYNAMIC_MOVE_DATABASE.entries.firstOrNull { it.key.equals(trimmed, ignoreCase = true) }?.value?.let { return it }
            MOVE_DATABASE[trimmed]?.let { return it }
            MOVE_DATABASE.entries.firstOrNull { it.key.equals(trimmed, ignoreCase = true) }?.value?.let { return it }
            return MoveStats(trimmed, fallbackType.lowercase().ifBlank { "normal" }, 80, 50)
        }

        val FAST_MOVE_TURNS: Map<String, Int> = mapOf(
            "ember" to 2,
            "dragon breath" to 1,
            "sand attack" to 1,
            "quick attack" to 1,
            "lock-on" to 1,
            "water gun" to 1,
            "lick" to 1,
            "bite" to 1,
            "tackle" to 1,
            "fury cutter" to 1,
            "bug bite" to 1,
            "scratch" to 1,
            "psycho cut" to 2,
            "mud shot" to 2,
            "shadow claw" to 2,
            "counter" to 2,
            "powder snow" to 2,
            "wing attack" to 2,
            "peck" to 2,
            "poison sting" to 2,
            "thunder shock" to 2,
            "fairy wind" to 2,
            "bullet punch" to 2,
            "fire fang" to 2,
            "vine whip" to 2,
            "karate chop" to 2,
            "low kick" to 2,
            "ice fang" to 2,
            "metal claw" to 2,
            "sucker punch" to 2,
            "poison jab" to 2,
            "spark" to 2,
            "leafage" to 2,
            "psywave" to 1,
            "force palm" to 3,
            "dragon tail" to 3,
            "waterfall" to 3,
            "fire spin" to 3,
            "snarl" to 3,
            "geomancy" to 3,
            "mud-slap" to 3,
            "charm" to 3,
            "double kick" to 3,
            "air slash" to 3,
            "ice shard" to 3,
            "bubble" to 3,
            "rollout" to 3,
            "smack down" to 3,
            "astonish" to 3,
            "hex" to 3,
            "magical leaf" to 3,
            "bullet seed" to 3,
            "rock throw" to 2,
            "water shuriken" to 3,
            "gust" to 4,
            "confusion" to 4,
            "volt switch" to 4,
            "incinerate" to 5
        )

        val POKEMON_META_DATABASE = listOf(
            // --- Multi-Form & Regional Variants ---
            PokemonMeta("Zacian (Crowned)", "zacian_crowned", "zacian", "Crowned", listOf("fairy", "steel"), 4620, "Metal Claw", 2, "Behemoth Blade", "Close Combat", 52, 48, atk = 332.0, def = 240.0, hp = 192, glRank = 400, ulRank = 300, mlRank = 2, chargedMove3 = "Play Rough", isRawBaseStats = true, defaultIvsGl = "7/9/12", defaultIvsUl = "6/13/15"),
            PokemonMeta("Zacian (Hero)", "zacian_hero", "zacian", "Hero", listOf("fairy"), 4329, "Quick Attack", 1, "Close Combat", "Play Rough", 44, 42, atk = 254.0, def = 236.0, hp = 192, glRank = 420, ulRank = 310, mlRank = 18, chargedMove3 = "Wild Charge", isRawBaseStats = true, defaultIvsGl = "5/7/14", defaultIvsUl = "5/10/13"),
            PokemonMeta("Zamazenta (Crowned)", "zamazenta_crowned", "zamazenta", "Crowned", listOf("fighting", "steel"), 4620, "Metal Claw", 2, "Behemoth Bash", "Close Combat", 46, 48, atk = 250.0, def = 292.0, hp = 192, glRank = 390, ulRank = 280, mlRank = 12, chargedMove3 = "Moonblast", isRawBaseStats = true, defaultIvsGl = "6/13/14", defaultIvsUl = "6/7/14"),
            PokemonMeta("Zamazenta (Hero)", "zamazenta_hero", "zamazenta", "Hero", listOf("fighting"), 4329, "Snarl", 3, "Close Combat", "Crunch", 46, 32, atk = 254.0, def = 236.0, hp = 192, glRank = 410, ulRank = 290, mlRank = 20, chargedMove3 = "Moonblast", isRawBaseStats = true, defaultIvsGl = "5/7/14", defaultIvsUl = "5/10/13"),
            PokemonMeta("Keldeo (Resolute)", "keldeo_resolute", "keldeo", "Resolute", listOf("water", "fighting"), 4181, "Low Kick", 2, "Secret Sword", "Aqua Jet", 42, 38, atk = 260.0, def = 192.0, hp = 209, glRank = 140, ulRank = 65, mlRank = 14, chargedMove3 = "Hydro Pump", isRawBaseStats = true, defaultIvsGl = "12/12/13", defaultIvsUl = "11/14/13"),
            PokemonMeta("Keldeo (Ordinary)", "keldeo_ordinary", "keldeo", "Ordinary", listOf("water", "fighting"), 4181, "Low Kick", 2, "Sacred Sword", "Aqua Jet", 38, 38, atk = 260.0, def = 192.0, hp = 209, glRank = 150, ulRank = 70, mlRank = 19, chargedMove3 = "Hydro Pump", isRawBaseStats = true, defaultIvsGl = "0/0/0", defaultIvsUl = "11/14/13"),
            PokemonMeta("Giratina (Origin)", "giratina_origin", "giratina", "Origin", listOf("ghost", "dragon"), 4164, "Shadow Claw", 2, "Shadow Ball", "Ominous Wind", 46, 22, atk = 225.0, def = 187.0, hp = 284, glRank = 180, ulRank = 35, mlRank = 9, isRawBaseStats = true, defaultIvsGl = "7/9/14", defaultIvsUl = "6/14/9"),
            PokemonMeta("Giratina (Altered)", "giratina_altered", "giratina", "Altered", listOf("ghost", "dragon"), 3820, "Shadow Claw", 2, "Dragon Claw", "Ancient Power", 28, 26, atk = 187.0, def = 225.0, hp = 284, glRank = 190, ulRank = 3, mlRank = 26, isRawBaseStats = true, defaultIvsGl = "6/15/6", defaultIvsUl = "5/15/8"),
            PokemonMeta("Ninetales (Alolan)", "ninetales_alolan", "ninetales", "Alolan", listOf("ice", "fairy"), 2610, "Powder Snow", 2, "Weather Ball (Ice)", "Chilling Water", 34, 46, atk = 170.0, def = 193.0, hp = 177, glRank = 16, ulRank = 25, mlRank = 320, chargedMove3 = "Psyshock", isRawBaseStats = true, defaultIvsGl = "5/15/15", defaultIvsUl = "13/15/14"),
            PokemonMeta("Kanto Ninetales", "ninetales", "ninetales", "Kanto", listOf("fire"), 1498, "Ember", 2, "Weather Ball (Fire)", "Energy Ball", 34, 44, atk = 169.0, def = 190.0, hp = 177, glRank = 58, ulRank = 34, mlRank = 350, chargedMove3 = "Psyshock", isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "12/15/14"),
            PokemonMeta("Deoxys (Defense)", "deoxys_defense", "deoxys", "Defense", listOf("psychic"), 2570, "Counter", 2, "Psycho Boost", "Thunderbolt", 36, 44, atk = 144.0, def = 330.0, hp = 137, glRank = 24, ulRank = 48, mlRank = 390, isRawBaseStats = true, defaultIvsGl = "12/12/15", defaultIvsUl = "11/13/14"),
            PokemonMeta("Deoxys (Normal)", "deoxys_normal", "deoxys", "Normal", listOf("psychic"), 3573, "Counter", 2, "Psycho Boost", "Thunderbolt", 48, 56, atk = 345.0, def = 115.0, hp = 137, glRank = 650, ulRank = 600, mlRank = 450, isRawBaseStats = true, defaultIvsGl = "11/11/14", defaultIvsUl = "12/13/11"),
            PokemonMeta("Dialga (Origin)", "dialga_origin", "dialga", "Origin", listOf("steel", "dragon"), 4624, "Dragon Breath", 1, "Roar of Time", "Iron Head", 52, 34, atk = 270.0, def = 225.0, hp = 205, glRank = 350, ulRank = 240, mlRank = 3, isRawBaseStats = true, defaultIvsGl = "5/15/8", defaultIvsUl = "7/14/14"),
            PokemonMeta("Dialga", "dialga", "dialga", "Altered", listOf("steel", "dragon"), 4565, "Dragon Breath", 1, "Draco Meteor", "Iron Head", 50, 32, atk = 275.0, def = 211.0, hp = 205, glRank = 360, ulRank = 250, mlRank = 14, isRawBaseStats = true, defaultIvsGl = "7/11/14", defaultIvsUl = "6/14/12"),
            PokemonMeta("Palkia (Origin)", "palkia_origin", "palkia", "Origin", listOf("water", "dragon"), 4683, "Dragon Breath", 1, "Spacial Rend", "Aqua Tail", 46, 28, atk = 286.0, def = 223.0, hp = 189, glRank = 330, ulRank = 210, mlRank = 1, isRawBaseStats = true, defaultIvsGl = "7/15/13", defaultIvsUl = "11/13/15"),
            PokemonMeta("Palkia", "palkia", "palkia", "Altered", listOf("water", "dragon"), 4512, "Dragon Breath", 1, "Aqua Tail", "Draco Meteor", 28, 52, atk = 280.0, def = 215.0, hp = 189, glRank = 340, ulRank = 230, mlRank = 22, isRawBaseStats = true, defaultIvsGl = "5/15/4", defaultIvsUl = "5/10/13"),
            PokemonMeta("Landorus (Therian)", "landorus_therian", "landorus", "Therian", listOf("ground", "flying"), 4434, "Mud Shot", 2, "Sandsear Storm", "Stone Edge", 42, 46, atk = 289.0, def = 179.0, hp = 205, glRank = 280, ulRank = 190, mlRank = 5, isRawBaseStats = true, defaultIvsGl = "6/9/15", defaultIvsUl = "6/15/12"),
            PokemonMeta("Landorus (Incarnate)", "landorus", "landorus", "Incarnate", listOf("ground", "flying"), 4057, "Mud Shot", 2, "Earth Power", "Rock Slide", 44, 36, atk = 261.0, def = 182.0, hp = 205, glRank = 310, ulRank = 210, mlRank = 42, isRawBaseStats = true, defaultIvsGl = "10/13/14", defaultIvsUl = "5/8/11"),
            PokemonMeta("Necrozma (Dusk Mane)", "necrozma_dusk_mane", "necrozma", "Dusk Mane", listOf("psychic", "steel"), 4634, "Shadow Claw", 2, "Sunsteel Strike", "Dark Pulse", 54, 40, atk = 277.0, def = 220.0, hp = 200, glRank = 400, ulRank = 280, mlRank = 4, isRawBaseStats = true, defaultIvsGl = "4/9/14", defaultIvsUl = "4/15/9"),
            PokemonMeta("Necrozma (Dawn Wings)", "necrozma_dawn_wings", "necrozma", "Dawn Wings", listOf("psychic", "ghost"), 4634, "Shadow Claw", 2, "Moongeist Beam", "Dark Pulse", 54, 40, atk = 277.0, def = 220.0, hp = 200, glRank = 405, ulRank = 285, mlRank = 6, isRawBaseStats = true, defaultIvsGl = "4/9/14", defaultIvsUl = "4/15/9"),
            PokemonMeta("Necrozma", "necrozma", "necrozma", "Base", listOf("psychic"), 4163, "Shadow Claw", 2, "Dark Pulse", "Iron Head", 38, 30, atk = 251.0, def = 195.0, hp = 219, glRank = 450, ulRank = 310, mlRank = 65, isRawBaseStats = true, defaultIvsGl = "4/13/13", defaultIvsUl = "4/11/15"),
            PokemonMeta("Kyurem (Black)", "kyurem_black", "kyurem", "Black", listOf("dragon", "ice"), 4605, "Shadow Claw", 2, "Freeze Shock", "Fusion Bolt", 58, 48, atk = 310.0, def = 183.0, hp = 245, glRank = 200, ulRank = 80, mlRank = 1, chargedMove3 = "Outrage", isRawBaseStats = true, defaultIvsGl = "7/10/8", defaultIvsUl = "9/13/14"),
            PokemonMeta("Kyurem (White)", "kyurem_white", "kyurem", "White", listOf("dragon", "ice"), 4605, "Dragon Breath", 1, "Ice Burn", "Fusion Flare", 58, 48, atk = 310.0, def = 183.0, hp = 245, glRank = 210, ulRank = 85, mlRank = 2, chargedMove3 = "Blizzard", isRawBaseStats = true, defaultIvsGl = "7/10/8", defaultIvsUl = "9/13/14"),
            PokemonMeta("Kyurem", "kyurem", "kyurem", "Base", listOf("dragon", "ice"), 4041, "Dragon Breath", 1, "Glaciate", "Dragon Claw", 38, 30, atk = 246.0, def = 170.0, hp = 245, glRank = 310, ulRank = 95, mlRank = 18, chargedMove3 = "Blizzard", isRawBaseStats = true, defaultIvsGl = "9/15/14", defaultIvsUl = "5/8/14"),
            PokemonMeta("Enamorus (Incarnate)", "enamorus", "enamorus", "Incarnate", listOf("fairy", "flying"), 3873, "Fairy Wind", 2, "Fly", "Dazzling Gleam", 42, 48, atk = 281.0, def = 162.0, hp = 179, glRank = 280, ulRank = 130, mlRank = 17, isRawBaseStats = true, defaultIvsGl = "7/13/11", defaultIvsUl = "5/13/9"),
            PokemonMeta("Enamorus (Therian)", "enamorus_therian", "enamorus", "Therian", listOf("fairy", "flying"), 3873, "Fairy Wind", 2, "Fly", "Moonblast", 42, 50, atk = 250.0, def = 201.0, hp = 179, glRank = 290, ulRank = 140, mlRank = 25, isRawBaseStats = true, defaultIvsGl = "4/9/11", defaultIvsUl = "6/15/11"),
            PokemonMeta("Urshifu (Single Strike)", "urshifu_single", "urshifu", "Single", listOf("fighting", "dark"), 4077, "Counter", 2, "Dynamic Punch", "Payback", 44, 52, atk = 254.0, def = 177.0, hp = 225, glRank = 210, ulRank = 110, mlRank = 22, isRawBaseStats = true, defaultIvsGl = "10/12/10", defaultIvsUl = "13/13/14"),
            PokemonMeta("Urshifu (Rapid Strike)", "urshifu_rapid", "urshifu", "Rapid", listOf("fighting", "water"), 4077, "Counter", 2, "Aqua Jet", "Close Combat", 34, 48, atk = 254.0, def = 177.0, hp = 225, glRank = 215, ulRank = 115, mlRank = 24, isRawBaseStats = true, defaultIvsGl = "10/12/10", defaultIvsUl = "13/13/14"),
            PokemonMeta("Sandslash (Alolan)", "sandslash_alolan", "sandslash", "Alolan", listOf("ice", "steel"), 2432, "Powder Snow", 2, "Ice Punch", "Drill Run", 32, 42, atk = 177.0, def = 195.0, hp = 181, glRank = 9, ulRank = 16, mlRank = 350, isRawBaseStats = true, defaultIvsGl = "4/13/15", defaultIvsUl = "4/12/15"),
            PokemonMeta("Sandslash", "sandslash", "sandslash", "Kanto", listOf("ground"), 2374, "Mud Shot", 2, "Scorching Sands", "Night Slash", 42, 28, atk = 182.0, def = 175.0, hp = 181, glRank = 48, ulRank = 75, mlRank = 380, isRawBaseStats = true, defaultIvsGl = "4/15/13", defaultIvsUl = "4/13/14"),
            PokemonMeta("Marowak (Alolan)", "marowak_alolan", "marowak", "Alolan", listOf("fire", "ghost"), 1835, "Fire Spin", 3, "Bone Club", "Shadow Bone", 28, 44, atk = 144.0, def = 186.0, hp = 155, glRank = 35, ulRank = 310, mlRank = 450, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),
            PokemonMeta("Marowak", "marowak", "marowak", "Kanto", listOf("ground"), 1835, "Mud-Slap", 3, "Bone Club", "Rock Slide", 28, 40, atk = 144.0, def = 186.0, hp = 155, glRank = 12, ulRank = 290, mlRank = 440, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),
            PokemonMeta("Stunfisk (Galarian)", "stunfisk_galarian", "stunfisk", "Galarian", listOf("ground", "steel"), 2445, "Mud Shot", 2, "Rock Slide", "Earthquake", 38, 52, atk = 144.0, def = 171.0, hp = 240, glRank = 30, ulRank = 28, mlRank = 340, isRawBaseStats = true, defaultIvsGl = "5/15/13", defaultIvsUl = "15/15/15"),
            PokemonMeta("Stunfisk", "stunfisk", "stunfisk", "Unovan", listOf("ground", "electric"), 2445, "Thunder Shock", 2, "Mud Bomb", "Discharge", 34, 38, atk = 144.0, def = 171.0, hp = 240, glRank = 26, ulRank = 34, mlRank = 350, isRawBaseStats = true, defaultIvsGl = "5/15/13", defaultIvsUl = "15/15/15"),
            PokemonMeta("Muk (Alolan)", "muk_alolan", "muk", "Alolan", listOf("poison", "dark"), 2757, "Poison Jab", 2, "Dark Pulse", "Acid Spray", 40, 20, atk = 190.0, def = 172.0, hp = 233, glRank = 95, ulRank = 22, mlRank = 180, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "4/15/15"),
            PokemonMeta("Muk", "muk", "muk", "Kanto", listOf("poison"), 2757, "Poison Jab", 2, "Thunder Punch", "Dark Pulse", 32, 40, atk = 190.0, def = 172.0, hp = 233, glRank = 110, ulRank = 36, mlRank = 190, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "4/15/15"),
            PokemonMeta("Weezing (Galarian)", "weezing_galarian", "weezing", "Galarian", listOf("poison", "fairy"), 2488, "Fairy Wind", 2, "Brutal Swing", "Overheat", 34, 62, atk = 174.0, def = 197.0, hp = 163, glRank = 25, ulRank = 11, mlRank = 290, isRawBaseStats = true, defaultIvsGl = "4/14/13", defaultIvsUl = "12/14/13"),
            PokemonMeta("Qwilfish (Hisuian)", "qwilfish_hisuian", "qwilfish", "Hisuian", listOf("dark", "poison"), 2290, "Poison Sting", 2, "Aqua Tail", "Shadow Ball", 30, 44, atk = 184.0, def = 151.0, hp = 163, glRank = 36, ulRank = 90, mlRank = 380, isRawBaseStats = true, defaultIvsGl = "4/14/15", defaultIvsUl = "15/15/15"),

            // --- User Custom Great & Ultra League Team Pokémon ---
            PokemonMeta("Fearow", "fearow", "fearow", "Base", listOf("normal", "flying"), 1500, "Peck", 2, "Drill Run", "Drill Peck", 42, 34, atk = 182.0, def = 133.0, hp = 163, glRank = 85, ulRank = 250, mlRank = 420, isRawBaseStats = true, defaultIvsGl = "4/15/13", defaultIvsUl = "15/15/15"),
            PokemonMeta("Shadow Pidgeot", "pidgeot_shadow", "pidgeot", "Shadow", listOf("normal", "flying"), 1490, "Gust", 4, "Twister", "Brave Bird", 28, 62, atk = 166.0, def = 154.0, hp = 195, glRank = 28, ulRank = 18, mlRank = 310, isRawBaseStats = true, defaultIvsGl = "4/14/12", defaultIvsUl = "15/15/15"),
            PokemonMeta("Pidgeot", "pidgeot", "pidgeot", "Base", listOf("normal", "flying"), 1490, "Gust", 4, "Twister", "Brave Bird", 24, 52, atk = 166.0, def = 154.0, hp = 195, glRank = 32, ulRank = 15, mlRank = 300, isRawBaseStats = true, defaultIvsGl = "4/14/12", defaultIvsUl = "15/15/15"),
            PokemonMeta("Zygarde", "zygarde_complete", "zygarde", "Complete", listOf("dragon", "ground"), 2472, "Dragon Tail", 3, "Crunch", "Earthquake", 32, 52, atk = 184.0, def = 207.0, hp = 389, glRank = 80, ulRank = 1, mlRank = 5, isRawBaseStats = true, defaultIvsGl = "0/0/0", defaultIvsUl = "13/10/15"),
            PokemonMeta("Corviknight", "corviknight", "corviknight", "Base", listOf("flying", "steel"), 2499, "Sand Attack", 1, "Air Cutter", "Iron Head", 32, 34, atk = 163.0, def = 192.0, hp = 221, glRank = 14, ulRank = 7, mlRank = 120, chargedMove3 = "Sky Attack", isRawBaseStats = true, defaultIvsGl = "4/12/14", defaultIvsUl = "4/14/13"),
            PokemonMeta("Mimikyu", "mimikyu", "mimikyu", "Disguised", listOf("ghost", "fairy"), 2497, "Shadow Claw", 2, "Play Rough", "Shadow Sneak", 44, 28, atk = 177.0, def = 199.0, hp = 146, glRank = 40, ulRank = 25, mlRank = 210, isRawBaseStats = true, defaultIvsGl = "4/14/15", defaultIvsUl = "13/15/15"),

            // --- Master League Core Meta ---
            PokemonMeta("Lugia", "lugia", "lugia", "Base", listOf("psychic", "flying"), 4179, "Dragon Tail", 3, "Aeroblast", "Earth Power", 54, 34, atk = 193.0, def = 310.0, hp = 235, glRank = 75, ulRank = 45, mlRank = 12, isRawBaseStats = true, defaultIvsGl = "5/13/12", defaultIvsUl = "5/13/12"),
            PokemonMeta("Kyogre", "kyogre", "kyogre", "Base", listOf("water"), 4652, "Waterfall", 3, "Origin Pulse", "Avalanche", 56, 40, atk = 270.0, def = 228.0, hp = 205, glRank = 310, ulRank = 180, mlRank = 10, isRawBaseStats = true, defaultIvsGl = "6/14/5", defaultIvsUl = "4/9/12"),
            PokemonMeta("Groudon", "groudon", "groudon", "Base", listOf("ground"), 4652, "Mud Shot", 2, "Precipice Blades", "Fire Punch", 55, 26, atk = 270.0, def = 228.0, hp = 205, glRank = 300, ulRank = 175, mlRank = 11, isRawBaseStats = true, defaultIvsGl = "6/14/5", defaultIvsUl = "4/9/12"),
            PokemonMeta("Ho-Oh", "ho_oh", "ho-oh", "Base", listOf("fire", "flying"), 4367, "Incinerate", 5, "Sacred Fire", "Brave Bird", 54, 52, atk = 239.0, def = 244.0, hp = 214, glRank = 140, ulRank = 70, mlRank = 7, isRawBaseStats = true, defaultIvsGl = "7/13/15", defaultIvsUl = "5/15/13"),
            PokemonMeta("Yveltal", "yveltal", "yveltal", "Base", listOf("dark", "flying"), 4275, "Snarl", 3, "Dark Pulse", "Oblivion Wing", 42, 42, atk = 250.0, def = 185.0, hp = 246, glRank = 260, ulRank = 95, mlRank = 8, isRawBaseStats = true, defaultIvsGl = "7/13/11", defaultIvsUl = "4/14/8"),
            PokemonMeta("Xerneas", "xerneas", "xerneas", "Base", listOf("fairy"), 4275, "Geomancy", 3, "Close Combat", "Moonblast", 44, 48, atk = 250.0, def = 185.0, hp = 246, glRank = 270, ulRank = 98, mlRank = 13, isRawBaseStats = true, defaultIvsGl = "7/13/11", defaultIvsUl = "4/14/8"),
            PokemonMeta("Solgaleo", "solgaleo", "solgaleo", "Base", listOf("psychic", "steel"), 4545, "Fire Spin", 3, "Psychic Fangs", "Iron Head", 24, 32, atk = 255.0, def = 191.0, hp = 264, glRank = 290, ulRank = 120, mlRank = 15, isRawBaseStats = true, defaultIvsGl = "4/15/12", defaultIvsUl = "5/13/5"),
            PokemonMeta("Lunala", "lunala", "lunala", "Base", listOf("psychic", "ghost"), 4545, "Shadow Claw", 2, "Shadow Ball", "Moonblast", 46, 48, atk = 255.0, def = 191.0, hp = 264, glRank = 310, ulRank = 140, mlRank = 18, isRawBaseStats = true, defaultIvsGl = "4/15/12", defaultIvsUl = "5/13/5"),
            PokemonMeta("Mewtwo", "mewtwo", "mewtwo", "Base", listOf("psychic"), 4724, "Psycho Cut", 2, "Psystrike", "Shadow Ball", 48, 44, atk = 300.0, def = 182.0, hp = 214, glRank = 380, ulRank = 210, mlRank = 16, isRawBaseStats = true, defaultIvsGl = "4/14/13", defaultIvsUl = "8/13/14"),
            PokemonMeta("Rhyperior", "rhyperior", "rhyperior", "Base", listOf("ground", "rock"), 4221, "Mud-Slap", 3, "Rock Wrecker", "Breaking Swipe", 52, 25, atk = 241.0, def = 190.0, hp = 251, glRank = 210, ulRank = 110, mlRank = 9, isRawBaseStats = true, defaultIvsGl = "4/12/8", defaultIvsUl = "5/14/14"),
            PokemonMeta("Dragonite", "dragonite", "dragonite", "Base", listOf("dragon", "flying"), 4287, "Dragon Breath", 1, "Dragon Claw", "Superpower", 30, 42, atk = 263.0, def = 198.0, hp = 209, glRank = 95, ulRank = 52, mlRank = 19, isRawBaseStats = true, defaultIvsGl = "4/13/14", defaultIvsUl = "5/15/13"),
            PokemonMeta("Garchomp", "garchomp", "garchomp", "Base", listOf("dragon", "ground"), 4479, "Mud Shot", 2, "Earth Power", "Outrage", 48, 48, atk = 261.0, def = 193.0, hp = 239, glRank = 220, ulRank = 130, mlRank = 24, isRawBaseStats = true, defaultIvsGl = "4/10/14", defaultIvsUl = "4/15/14"),
            PokemonMeta("Metagross", "metagross", "metagross", "Base", listOf("steel", "psychic"), 4286, "Bullet Punch", 2, "Meteor Mash", "Earthquake", 48, 52, atk = 257.0, def = 228.0, hp = 190, glRank = 290, ulRank = 160, mlRank = 25, isRawBaseStats = true, defaultIvsGl = "4/12/15", defaultIvsUl = "5/14/15"),
            PokemonMeta("Melmetal", "melmetal", "melmetal", "Base", listOf("steel"), 4144, "Thunder Shock", 2, "Superpower", "Rock Slide", 42, 34, atk = 226.0, def = 190.0, hp = 264, glRank = 130, ulRank = 65, mlRank = 23, isRawBaseStats = true, defaultIvsGl = "4/10/14", defaultIvsUl = "4/15/14"),
            PokemonMeta("Florges", "florges", "florges", "Base", listOf("fairy"), 3657, "Fairy Wind", 2, "Disarming Voice", "Moonblast", 30, 48, atk = 212.0, def = 244.0, hp = 186, glRank = 110, ulRank = 38, mlRank = 20, isRawBaseStats = true, defaultIvsGl = "6/13/14", defaultIvsUl = "4/13/15"),
            PokemonMeta("Primarina", "primarina", "primarina", "Base", listOf("water", "fairy"), 3618, "Charm", 3, "Hydro Cannon", "Moonblast", 42, 48, atk = 232.0, def = 195.0, hp = 190, glRank = 90, ulRank = 42, mlRank = 21, isRawBaseStats = true, defaultIvsGl = "7/15/14", defaultIvsUl = "5/14/15"),
            PokemonMeta("Mamoswine", "mamoswine", "mamoswine", "Base", listOf("ice", "ground"), 3763, "Powder Snow", 2, "Avalanche", "High Horsepower", 44, 48, atk = 247.0, def = 146.0, hp = 242, glRank = 190, ulRank = 120, mlRank = 27, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "4/14/15"),
            PokemonMeta("Excadrill", "excadrill", "excadrill", "Base", listOf("ground", "steel"), 3667, "Mud Shot", 2, "Drill Run", "Rock Slide", 40, 32, atk = 255.0, def = 129.0, hp = 242, glRank = 230, ulRank = 140, mlRank = 28, isRawBaseStats = true, defaultIvsGl = "4/14/13", defaultIvsUl = "6/15/13"),
            PokemonMeta("Reshiram", "reshiram", "reshiram", "Base", listOf("dragon", "fire"), 4565, "Dragon Breath", 1, "Fusion Flare", "Overheat", 52, 70, atk = 275.0, def = 211.0, hp = 205, glRank = 350, ulRank = 220, mlRank = 29, isRawBaseStats = true, defaultIvsGl = "7/11/14", defaultIvsUl = "6/14/12"),
            PokemonMeta("Zekrom", "zekrom", "zekrom", "Base", listOf("dragon", "electric"), 4565, "Dragon Breath", 1, "Fusion Bolt", "Crunch", 50, 32, atk = 275.0, def = 211.0, hp = 205, glRank = 345, ulRank = 215, mlRank = 30, isRawBaseStats = true, defaultIvsGl = "7/11/14", defaultIvsUl = "6/14/12"),
            PokemonMeta("Raikou", "raikou", "raikou", "Base", listOf("electric"), 3902, "Thunder Shock", 2, "Wild Charge", "Shadow Ball", 48, 44, atk = 241.0, def = 195.0, hp = 207, glRank = 180, ulRank = 115, mlRank = 45, isRawBaseStats = true, defaultIvsGl = "6/12/11", defaultIvsUl = "5/13/13"),
            PokemonMeta("Entei", "entei", "entei", "Base", listOf("fire"), 3926, "Fire Fang", 2, "Flame Charge", "Overheat", 28, 72, atk = 235.0, def = 171.0, hp = 251, glRank = 240, ulRank = 165, mlRank = 55, isRawBaseStats = true, defaultIvsGl = "7/9/11", defaultIvsUl = "6/12/12"),
            PokemonMeta("Suicune", "suicune", "suicune", "Base", listOf("water"), 3372, "Snarl", 3, "Ice Beam", "Hydro Pump", 36, 52, atk = 180.0, def = 235.0, hp = 225, glRank = 170, ulRank = 95, mlRank = 75, isRawBaseStats = true, defaultIvsGl = "5/14/14", defaultIvsUl = "5/15/12"),
            PokemonMeta("Zarude", "zarude", "zarude", "Base", listOf("dark", "grass"), 4334, "Vine Whip", 2, "Dark Pulse", "Power Whip", 40, 44, atk = 242.0, def = 215.0, hp = 233, glRank = 210, ulRank = 95, mlRank = 17, isRawBaseStats = true, defaultIvsGl = "13/11/12", defaultIvsUl = "11/12/10"),
            PokemonMeta("Meloetta", "meloetta_aria", "meloetta", "Aria", listOf("normal", "psychic"), 4490, "Quick Attack", 1, "Psyshock", "Dazzling Gleam", 34, 46, atk = 250.0, def = 225.0, hp = 225, glRank = 260, ulRank = 110, mlRank = 16, isRawBaseStats = true, defaultIvsGl = "12/14/10", defaultIvsUl = "10/12/14"),
            PokemonMeta("Ursaluna", "ursaluna", "ursaluna", "Base", listOf("ground", "normal"), 4358, "Tackle", 1, "Ice Punch", "High Horsepower", 30, 50, atk = 243.0, def = 181.0, hp = 277, glRank = 250, ulRank = 130, mlRank = 21, isRawBaseStats = true, defaultIvsGl = "4/13/7", defaultIvsUl = "4/10/15"),
            PokemonMeta("Togekiss", "togekiss", "togekiss", "Base", listOf("fairy", "flying"), 3767, "Charm", 3, "Ancient Power", "Aura Sphere", 30, 46, atk = 225.0, def = 217.0, hp = 198, glRank = 150, ulRank = 48, mlRank = 24, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "5/13/15"),
            PokemonMeta("Gyarados", "gyarados", "gyarados", "Base", listOf("water", "flying"), 3834, "Dragon Breath", 1, "Aqua Tail", "Crunch", 28, 34, atk = 237.0, def = 186.0, hp = 216, glRank = 160, ulRank = 42, mlRank = 26, isRawBaseStats = true, defaultIvsGl = "4/14/7", defaultIvsUl = "5/13/15"),
            PokemonMeta("Snorlax", "snorlax", "snorlax", "Base", listOf("normal"), 3647, "Psywave", 1, "Body Slam", "Earthquake", 26, 52, atk = 190.0, def = 169.0, hp = 330, glRank = 95, ulRank = 38, mlRank = 30, chargedMove3 = "Superpower", isRawBaseStats = true, defaultIvsGl = "4/14/5", defaultIvsUl = "5/15/14"),
            PokemonMeta("Gholdengo", "gholdengo", "gholdengo", "Base", listOf("steel", "ghost"), 3976, "Hex", 3, "Shadow Ball", "Focus Blast", 46, 56, atk = 252.0, def = 190.0, hp = 202, glRank = 280, ulRank = 140, mlRank = 23, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "4/14/15"),
            PokemonMeta("Baxcalibur", "baxcalibur", "baxcalibur", "Base", listOf("dragon", "ice"), 4286, "Dragon Breath", 1, "Avalanche", "Dragon Claw", 44, 28, atk = 254.0, def = 168.0, hp = 229, glRank = 90, ulRank = 55, mlRank = 22, isRawBaseStats = true, defaultIvsGl = "4/14/14", defaultIvsUl = "6/15/15"),
            PokemonMeta("Tapu Bulu", "tapu_bulu", "tapu bulu", "Base", listOf("grass", "fairy"), 3865, "Bullet Seed", 3, "Nature's Madness", "Grass Knot", 42, 44, atk = 249.0, def = 215.0, hp = 172, glRank = 290, ulRank = 110, mlRank = 14, isRawBaseStats = true, defaultIvsGl = "4/13/5", defaultIvsUl = "5/8/14"),
            PokemonMeta("Tapu Fini", "tapu_fini", "tapu fini", "Base", listOf("water", "fairy"), 3230, "Water Gun", 1, "Surf", "Nature's Madness", 34, 42, atk = 189.0, def = 254.0, hp = 172, glRank = 32, ulRank = 3, mlRank = 55, isRawBaseStats = true, defaultIvsGl = "5/11/4", defaultIvsUl = "5/11/14"),
            PokemonMeta("Tapu Lele", "tapu_lele", "tapu lele", "Base", listOf("psychic", "fairy"), 3950, "Astonish", 3, "Nature's Madness", "Psyshock", 44, 36, atk = 259.0, def = 208.0, hp = 172, glRank = 300, ulRank = 120, mlRank = 19, isRawBaseStats = true, defaultIvsGl = "5/9/10", defaultIvsUl = "5/14/13"),
            PokemonMeta("Tapu Koko", "tapu_koko", "tapu koko", "Base", listOf("electric", "fairy"), 3582, "Volt Switch", 4, "Nature's Madness", "Brave Bird", 42, 52, atk = 250.0, def = 181.0, hp = 172, glRank = 270, ulRank = 95, mlRank = 35, isRawBaseStats = true, defaultIvsGl = "6/7/15", defaultIvsUl = "6/12/12"),

            // --- Great League & Ultra League Core Meta ---
            PokemonMeta("Clodsire", "clodsire", "clodsire", "Base", listOf("poison", "ground"), 1494, "Poison Sting", 2, "Earthquake", "Stone Edge", 46, 42, atk = 127.0, def = 151.0, hp = 277, glRank = 1, ulRank = 90, mlRank = 400, isRawBaseStats = true, defaultIvsGl = "4/14/10", defaultIvsUl = "15/15/15"),
            PokemonMeta("Feraligatr", "feraligatr", "feraligatr", "Base", listOf("water"), 2488, "Shadow Claw", 2, "Hydro Cannon", "Ice Beam", 44, 38, atk = 205.0, def = 188.0, hp = 198, glRank = 2, ulRank = 2, mlRank = 85, isRawBaseStats = true, defaultIvsGl = "5/11/14", defaultIvsUl = "4/15/11"),
            PokemonMeta("Mandibuzz", "mandibuzz", "mandibuzz", "Base", listOf("dark", "flying"), 2417, "Snarl", 3, "Dark Pulse", "Aerial Ace", 38, 28, atk = 129.0, def = 205.0, hp = 242, glRank = 3, ulRank = 12, mlRank = 280, isRawBaseStats = true, defaultIvsGl = "5/15/13", defaultIvsUl = "15/15/15"),
            PokemonMeta("Azumarill", "azumarill", "azumarill", "Base", listOf("water", "fairy"), 1499, "Bubble", 3, "Ice Beam", "Play Rough", 36, 40, atk = 112.0, def = 152.0, hp = 225, glRank = 4, ulRank = 350, mlRank = 500, isRawBaseStats = true, defaultIvsGl = "4/15/13", defaultIvsUl = "15/15/15"),
            PokemonMeta("Gastrodon", "gastrodon", "gastrodon", "Base", listOf("water", "ground"), 2485, "Mud-Slap", 3, "Body Slam", "Earth Power", 26, 44, atk = 169.0, def = 143.0, hp = 244, glRank = 5, ulRank = 24, mlRank = 310, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "12/15/13"),
            PokemonMeta("Malamar", "malamar", "malamar", "Base", listOf("dark", "psychic"), 2488, "Psywave", 1, "Foul Play", "Superpower", 36, 42, atk = 177.0, def = 165.0, hp = 200, glRank = 6, ulRank = 18, mlRank = 320, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "4/13/15"),
            PokemonMeta("Dunsparce", "dunsparce", "dunsparce", "Base", listOf("normal"), 1498, "Rollout", 3, "Rock Slide", "Drill Run", 36, 40, atk = 131.0, def = 128.0, hp = 225, glRank = 7, ulRank = 310, mlRank = 480, isRawBaseStats = true, defaultIvsGl = "4/15/13", defaultIvsUl = "15/15/15"),
            PokemonMeta("Annihilape", "annihilape", "annihilape", "Base", listOf("fighting", "ghost"), 3695, "Counter", 2, "Rage Fist", "Ice Punch", 32, 30, atk = 220.0, def = 178.0, hp = 242, glRank = 8, ulRank = 9, mlRank = 32, isRawBaseStats = true, defaultIvsGl = "4/13/13", defaultIvsUl = "5/14/15"),
            PokemonMeta("Primeape", "primeape", "primeape", "Base", listOf("fighting"), 2488, "Karate Chop", 2, "Rage Fist", "Close Combat", 32, 48, atk = 207.0, def = 138.0, hp = 163, glRank = 10, ulRank = 20, mlRank = 340, isRawBaseStats = true, defaultIvsGl = "5/15/15", defaultIvsUl = "12/15/14"),
            PokemonMeta("Cresselia", "cresselia", "cresselia", "Base", listOf("psychic"), 2488, "Psycho Cut", 2, "Grass Knot", "Moonblast", 36, 46, atk = 152.0, def = 258.0, hp = 260, glRank = 11, ulRank = 4, mlRank = 110, isRawBaseStats = true, defaultIvsGl = "4/11/9", defaultIvsUl = "4/11/11"),
            PokemonMeta("Jumpluff", "jumpluff", "jumpluff", "Base", listOf("grass", "flying"), 1498, "Fairy Wind", 2, "Aerial Ace", "Energy Ball", 28, 42, atk = 118.0, def = 183.0, hp = 181, glRank = 13, ulRank = 300, mlRank = 480, isRawBaseStats = true, defaultIvsGl = "4/15/12", defaultIvsUl = "15/15/15"),
            PokemonMeta("Swampert", "swampert", "swampert", "Base", listOf("water", "ground"), 2495, "Mud Shot", 2, "Hydro Cannon", "Earthquake", 44, 52, atk = 208.0, def = 175.0, hp = 225, glRank = 15, ulRank = 14, mlRank = 60, isRawBaseStats = true, defaultIvsGl = "6/15/12", defaultIvsUl = "4/15/14"),
            PokemonMeta("Quagsire", "quagsire", "quagsire", "Base", listOf("water", "ground"), 1499, "Mud Shot", 2, "Aqua Tail", "Stone Edge", 28, 46, atk = 152.0, def = 143.0, hp = 216, glRank = 17, ulRank = 280, mlRank = 450, isRawBaseStats = true, defaultIvsGl = "4/15/10", defaultIvsUl = "15/15/15"),
            PokemonMeta("Whiscash", "whiscash", "whiscash", "Base", listOf("water", "ground"), 1499, "Mud Shot", 2, "Scald", "Mud Bomb", 40, 32, atk = 151.0, def = 141.0, hp = 242, glRank = 19, ulRank = 290, mlRank = 450, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "15/15/15"),
            PokemonMeta("Talonflame", "talonflame", "talonflame", "Base", listOf("fire", "flying"), 2493, "Incinerate", 5, "Fly", "Flame Charge", 42, 28, atk = 176.0, def = 155.0, hp = 186, glRank = 18, ulRank = 10, mlRank = 180, isRawBaseStats = true, defaultIvsGl = "4/12/15", defaultIvsUl = "15/15/15"),
            PokemonMeta("Serperior", "serperior", "serperior", "Base", listOf("grass"), 2480, "Vine Whip", 2, "Frenzy Plant", "Aerial Ace", 44, 28, atk = 161.0, def = 204.0, hp = 181, glRank = 20, ulRank = 26, mlRank = 310, isRawBaseStats = true, defaultIvsGl = "4/9/14", defaultIvsUl = "13/15/15"),
            PokemonMeta("Wigglytuff", "wigglytuff", "wigglytuff", "Base", listOf("normal", "fairy"), 1499, "Charm", 3, "Icy Wind", "Swift", 30, 32, atk = 156.0, def = 90.0, hp = 295, glRank = 21, ulRank = 320, mlRank = 480, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "15/15/15"),
            PokemonMeta("Clefable", "clefable", "clefable", "Base", listOf("fairy"), 2488, "Fairy Wind", 2, "Meteor Mash", "Swift", 46, 30, atk = 178.0, def = 162.0, hp = 216, glRank = 23, ulRank = 13, mlRank = 240, isRawBaseStats = true, defaultIvsGl = "4/13/14", defaultIvsUl = "4/12/15"),
            PokemonMeta("Skeledirge", "skeledirge", "skeledirge", "Base", listOf("fire", "ghost"), 2491, "Incinerate", 5, "Torch Song", "Shadow Ball", 38, 46, atk = 207.0, def = 178.0, hp = 232, glRank = 22, ulRank = 15, mlRank = 70, chargedMove3 = "Disarming Voice", isRawBaseStats = true, defaultIvsGl = "4/13/11", defaultIvsUl = "6/15/13"),
            PokemonMeta("Lickilicky", "lickilicky", "lickilicky", "Base", listOf("normal"), 2488, "Rollout", 3, "Body Slam", "Shadow Ball", 26, 44, atk = 161.0, def = 181.0, hp = 242, glRank = 27, ulRank = 8, mlRank = 210, isRawBaseStats = true, defaultIvsGl = "4/15/8", defaultIvsUl = "4/13/13"),
            PokemonMeta("Lickitung", "lickitung", "lickitung", "Base", listOf("normal"), 1499, "Lick", 1, "Body Slam", "Power Whip", 26, 42, atk = 108.0, def = 137.0, hp = 207, glRank = 29, ulRank = 400, mlRank = 500, isRawBaseStats = true, defaultIvsGl = "7/15/15", defaultIvsUl = "15/15/15"),
            PokemonMeta("Bastiodon", "bastiodon", "bastiodon", "Base", listOf("rock", "steel"), 1499, "Smack Down", 3, "Stone Edge", "Flamethrower", 42, 38, atk = 94.0, def = 286.0, hp = 155, glRank = 31, ulRank = 400, mlRank = 500, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),
            PokemonMeta("Carbink", "carbink", "carbink", "Base", listOf("rock", "fairy"), 1499, "Rock Throw", 2, "Rock Slide", "Moonblast", 36, 46, atk = 95.0, def = 285.0, hp = 137, glRank = 33, ulRank = 410, mlRank = 500, isRawBaseStats = true, defaultIvsGl = "5/15/13", defaultIvsUl = "15/15/15"),
            PokemonMeta("Registeel", "registeel", "registeel", "Base", listOf("steel"), 2488, "Lock-On", 1, "Focus Blast", "Zap Cannon", 56, 56, atk = 143.0, def = 285.0, hp = 190, glRank = 34, ulRank = 5, mlRank = 190, isRawBaseStats = true, defaultIvsGl = "8/15/14", defaultIvsUl = "4/6/14"),
            PokemonMeta("Skarmory", "skarmory", "skarmory", "Base", listOf("steel", "flying"), 2380, "Steel Wing", 2, "Sky Attack", "Brave Bird", 36, 52, atk = 148.0, def = 226.0, hp = 163, glRank = 37, ulRank = 65, mlRank = 360, isRawBaseStats = true, defaultIvsGl = "4/14/12", defaultIvsUl = "15/15/15"),
            PokemonMeta("Umbreon", "umbreon", "umbreon", "Base", listOf("dark"), 2416, "Snarl", 3, "Foul Play", "Last Resort", 34, 40, atk = 126.0, def = 240.0, hp = 216, glRank = 38, ulRank = 30, mlRank = 340, isRawBaseStats = true, defaultIvsGl = "4/15/9", defaultIvsUl = "15/15/15"),
            PokemonMeta("Lanturn", "lanturn", "lanturn", "Base", listOf("water", "electric"), 1499, "Spark", 2, "Surf", "Thunderbolt", 34, 44, atk = 146.0, def = 137.0, hp = 268, glRank = 39, ulRank = 260, mlRank = 450, isRawBaseStats = true, defaultIvsGl = "5/15/12", defaultIvsUl = "15/15/15"),
            PokemonMeta("Medicham", "medicham", "medicham", "Base", listOf("fighting", "psychic"), 1499, "Counter", 2, "Ice Punch", "Psychic", 28, 38, atk = 121.0, def = 152.0, hp = 155, glRank = 41, ulRank = 420, mlRank = 500, isRawBaseStats = true, defaultIvsGl = "7/15/14", defaultIvsUl = "15/15/15"),
            PokemonMeta("Sableye", "sableye", "sableye", "Base", listOf("dark", "ghost"), 1499, "Shadow Claw", 2, "Foul Play", "Power Gem", 36, 40, atk = 141.0, def = 136.0, hp = 137, glRank = 42, ulRank = 410, mlRank = 500, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "15/15/15"),
            PokemonMeta("Drapion", "drapion", "drapion", "Base", listOf("poison", "dark"), 2488, "Poison Sting", 2, "Crunch", "Aqua Tail", 34, 28, atk = 180.0, def = 202.0, hp = 172, glRank = 43, ulRank = 17, mlRank = 260, isRawBaseStats = true, defaultIvsGl = "6/14/15", defaultIvsUl = "4/15/15"),
            PokemonMeta("Toxapex", "toxapex", "toxapex", "Base", listOf("poison", "water"), 1499, "Poison Jab", 2, "Brine", "Sludge Wave", 28, 48, atk = 114.0, def = 273.0, hp = 137, glRank = 44, ulRank = 380, mlRank = 490, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "15/15/15"),
            PokemonMeta("Gligar", "gligar", "gligar", "Base", listOf("ground", "flying"), 1499, "Wing Attack", 2, "Aerial Ace", "Dig", 28, 44, atk = 143.0, def = 184.0, hp = 163, glRank = 45, ulRank = 360, mlRank = 490, isRawBaseStats = true, defaultIvsGl = "4/13/15", defaultIvsUl = "15/15/15"),
            PokemonMeta("Gliscor", "gliscor", "gliscor", "Base", listOf("ground", "flying"), 2492, "Wing Attack", 2, "Night Slash", "Earthquake", 28, 52, atk = 185.0, def = 222.0, hp = 181, glRank = 65, ulRank = 29, mlRank = 180, isRawBaseStats = true, defaultIvsGl = "4/14/9", defaultIvsUl = "4/15/11"),
            PokemonMeta("Poliwrath", "poliwrath", "poliwrath", "Base", listOf("water", "fighting"), 2495, "Counter", 2, "Icy Wind", "Scald", 30, 42, atk = 182.0, def = 184.0, hp = 207, glRank = 46, ulRank = 19, mlRank = 190, isRawBaseStats = true, defaultIvsGl = "5/13/15", defaultIvsUl = "4/14/15"),
            PokemonMeta("Pelipper", "pelipper", "pelipper", "Base", listOf("water", "flying"), 1499, "Wing Attack", 2, "Weather Ball", "Hurricane", 32, 52, atk = 175.0, def = 174.0, hp = 155, glRank = 47, ulRank = 280, mlRank = 460, isRawBaseStats = true, defaultIvsGl = "6/15/14", defaultIvsUl = "15/15/15"),
            PokemonMeta("Mantine", "mantine", "mantine", "Base", listOf("water", "flying"), 1499, "Wing Attack", 2, "Aerial Ace", "Ice Beam", 28, 38, atk = 148.0, def = 226.0, hp = 163, glRank = 49, ulRank = 240, mlRank = 440, isRawBaseStats = true, defaultIvsGl = "4/14/12", defaultIvsUl = "15/15/15"),
            PokemonMeta("Dewgong", "dewgong", "dewgong", "Base", listOf("water", "ice"), 1499, "Ice Shard", 3, "Icy Wind", "Drill Run", 30, 40, atk = 139.0, def = 177.0, hp = 207, glRank = 50, ulRank = 290, mlRank = 460, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),
            PokemonMeta("Walrein", "walrein", "walrein", "Base", listOf("ice", "water"), 2492, "Powder Snow", 2, "Icicle Spear", "Earthquake", 32, 52, atk = 182.0, def = 176.0, hp = 242, glRank = 68, ulRank = 33, mlRank = 170, isRawBaseStats = true, defaultIvsGl = "4/14/14", defaultIvsUl = "4/13/14"),
            PokemonMeta("Abomasnow", "abomasnow", "abomasnow", "Base", listOf("grass", "ice"), 2485, "Powder Snow", 2, "Weather Ball", "Energy Ball", 32, 44, atk = 178.0, def = 158.0, hp = 207, glRank = 52, ulRank = 37, mlRank = 280, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "4/15/11"),
            PokemonMeta("Trevenant", "trevenant", "trevenant", "Base", listOf("ghost", "grass"), 2492, "Shadow Claw", 2, "Seed Bomb", "Shadow Ball", 32, 46, atk = 201.0, def = 154.0, hp = 198, glRank = 54, ulRank = 31, mlRank = 220, isRawBaseStats = true, defaultIvsGl = "3/13/12", defaultIvsUl = "4/14/10"),
            PokemonMeta("Goodra", "goodra", "goodra", "Base", listOf("dragon"), 2495, "Dragon Breath", 1, "Aqua Tail", "Thunder Punch", 28, 30, atk = 220.0, def = 242.0, hp = 207, glRank = 56, ulRank = 36, mlRank = 85, isRawBaseStats = true, defaultIvsGl = "4/9/12", defaultIvsUl = "5/15/15"),
            PokemonMeta("Guzzlord", "guzzlord", "guzzlord", "Base", listOf("dark", "dragon"), 2492, "Dragon Tail", 3, "Dragon Claw", "Crunch", 28, 34, atk = 188.0, def = 99.0, hp = 440, glRank = 60, ulRank = 21, mlRank = 160, isRawBaseStats = true, defaultIvsGl = "4/13/10", defaultIvsUl = "4/15/14"),
            PokemonMeta("Morpeko", "morpeko", "morpeko", "Full Belly", listOf("electric", "dark"), 1499, "Thunder Shock", 2, "Aura Wheel", "Psychic Fangs", 52, 24, atk = 192.0, def = 121.0, hp = 151, glRank = 15, ulRank = 340, mlRank = 480, isRawBaseStats = true, defaultIvsGl = "5/14/15", defaultIvsUl = "15/15/15"),
            PokemonMeta("Dusknoir", "dusknoir", "dusknoir", "Base", listOf("ghost"), 2480, "Astonish", 3, "Shadow Punch", "Dynamic Punch", 28, 42, atk = 180.0, def = 254.0, hp = 128, glRank = 55, ulRank = 40, mlRank = 290, isRawBaseStats = true, defaultIvsGl = "5/15/11", defaultIvsUl = "4/13/15"),
            PokemonMeta("Pangoro", "pangoro", "pangoro", "Base", listOf("fighting", "dark"), 2492, "Karate Chop", 2, "Night Slash", "Close Combat", 28, 48, atk = 226.0, def = 146.0, hp = 216, glRank = 59, ulRank = 27, mlRank = 180, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "4/15/15"),
            PokemonMeta("Greedent", "greedent", "greedent", "Base", listOf("normal"), 2485, "Mud Shot", 2, "Body Slam", "Crunch", 26, 34, atk = 160.0, def = 156.0, hp = 260, glRank = 64, ulRank = 23, mlRank = 290, isRawBaseStats = true, defaultIvsGl = "5/15/14", defaultIvsUl = "4/15/15"),
            PokemonMeta("Dubwool", "dubwool", "dubwool", "Base", listOf("normal"), 2478, "Double Kick", 3, "Body Slam", "Payback", 26, 50, atk = 159.0, def = 198.0, hp = 176, glRank = 66, ulRank = 39, mlRank = 300, isRawBaseStats = true, defaultIvsGl = "5/14/14", defaultIvsUl = "15/15/15"),
            PokemonMeta("Ampharos", "ampharos", "ampharos", "Base", listOf("electric"), 2495, "Volt Switch", 4, "Brutal Swing", "Trailblaze", 32, 34, atk = 211.0, def = 169.0, hp = 207, glRank = 92, ulRank = 41, mlRank = 210, isRawBaseStats = true, defaultIvsGl = "4/14/12", defaultIvsUl = "4/12/15"),
            PokemonMeta("Tentacruel", "tentacruel", "tentacruel", "Base", listOf("water", "poison"), 2485, "Poison Jab", 2, "Scald", "Acid Spray", 40, 20, atk = 166.0, def = 209.0, hp = 190, glRank = 70, ulRank = 18, mlRank = 260, isRawBaseStats = true, defaultIvsGl = "4/15/15", defaultIvsUl = "4/14/14"),
            PokemonMeta("Cobalion", "cobalion", "cobalion", "Base", listOf("steel", "fighting"), 2492, "Double Kick", 3, "Sacred Sword", "Stone Edge", 38, 42, atk = 192.0, def = 229.0, hp = 209, glRank = 95, ulRank = 6, mlRank = 90, isRawBaseStats = true, defaultIvsGl = "4/10/4", defaultIvsUl = "6/15/11"),
            PokemonMeta("Virizion", "virizion", "virizion", "Base", listOf("grass", "fighting"), 2490, "Double Kick", 3, "Sacred Sword", "Leaf Blade", 38, 36, atk = 192.0, def = 229.0, hp = 209, glRank = 110, ulRank = 8, mlRank = 95, isRawBaseStats = true, defaultIvsGl = "4/10/4", defaultIvsUl = "6/15/11"),
            PokemonMeta("Venusaur", "venusaur", "venusaur", "Base", listOf("grass", "poison"), 2495, "Vine Whip", 2, "Frenzy Plant", "Sludge Bomb", 46, 40, atk = 198.0, def = 189.0, hp = 190, glRank = 72, ulRank = 44, mlRank = 220, isRawBaseStats = true, defaultIvsGl = "4/13/14", defaultIvsUl = "4/14/15"),
            PokemonMeta("Charizard", "charizard", "charizard", "Base", listOf("fire", "flying"), 2495, "Wing Attack", 2, "Blast Burn", "Dragon Claw", 50, 28, atk = 223.0, def = 173.0, hp = 186, glRank = 78, ulRank = 46, mlRank = 190, isRawBaseStats = true, defaultIvsGl = "5/14/15", defaultIvsUl = "4/13/14"),
            PokemonMeta("Blastoise", "blastoise", "blastoise", "Base", listOf("water"), 2466, "Rollout", 3, "Hydro Cannon", "Ice Beam", 44, 38, atk = 171.0, def = 207.0, hp = 188, glRank = 62, ulRank = 43, mlRank = 250, isRawBaseStats = true, defaultIvsGl = "4/8/15", defaultIvsUl = "5/15/15"),
            PokemonMeta("Greninja", "greninja", "greninja", "Base", listOf("water", "dark"), 2492, "Water Shuriken", 3, "Hydro Cannon", "Brutal Swing", 44, 34, atk = 223.0, def = 152.0, hp = 176, glRank = 74, ulRank = 35, mlRank = 210, chargedMove3 = "Night Slash", isRawBaseStats = true, defaultIvsGl = "5/12/12", defaultIvsUl = "4/13/15"),
            PokemonMeta("Chesnaught", "chesnaught", "chesnaught", "Base", listOf("grass", "fighting"), 2492, "Vine Whip", 2, "Frenzy Plant", "Superpower", 46, 42, atk = 201.0, def = 204.0, hp = 204, glRank = 67, ulRank = 50, mlRank = 160, isRawBaseStats = true, defaultIvsGl = "4/14/9", defaultIvsUl = "4/15/11"),
            PokemonMeta("Typhlosion", "typhlosion", "typhlosion", "Base", listOf("fire"), 2495, "Incinerate", 5, "Blast Burn", "Thunder Punch", 50, 30, atk = 223.0, def = 173.0, hp = 186, glRank = 76, ulRank = 47, mlRank = 230, isRawBaseStats = true, defaultIvsGl = "5/14/15", defaultIvsUl = "4/13/14"),
            PokemonMeta("Decidueye", "decidueye", "decidueye", "Base", listOf("grass", "ghost"), 2492, "Astonish", 3, "Frenzy Plant", "Spirit Shackle", 46, 36, atk = 210.0, def = 179.0, hp = 186, glRank = 79, ulRank = 54, mlRank = 240, isRawBaseStats = true, defaultIvsGl = "4/14/14", defaultIvsUl = "4/14/12"),
            PokemonMeta("Incineroar", "incineroar", "incineroar", "Base", listOf("fire", "dark"), 2495, "Snarl", 3, "Blast Burn", "Darkest Lariat", 50, 44, atk = 214.0, def = 175.0, hp = 216, glRank = 88, ulRank = 52, mlRank = 170, isRawBaseStats = true, defaultIvsGl = "4/15/12", defaultIvsUl = "4/15/14"),
            PokemonMeta("Empoleon", "empoleon", "empoleon", "Base", listOf("water", "steel"), 2495, "Steel Wing", 2, "Hydro Cannon", "Drill Peck", 44, 34, atk = 210.0, def = 186.0, hp = 197, glRank = 71, ulRank = 49, mlRank = 180, isRawBaseStats = true, defaultIvsGl = "5/15/13", defaultIvsUl = "6/15/14"),
            PokemonMeta("Machamp", "machamp", "machamp", "Base", listOf("fighting"), 2495, "Karate Chop", 2, "Cross Chop", "Stone Edge", 28, 44, atk = 234.0, def = 159.0, hp = 207, glRank = 73, ulRank = 51, mlRank = 120, isRawBaseStats = true, defaultIvsGl = "5/15/12", defaultIvsUl = "4/15/14"),
            PokemonMeta("Scrafty", "scrafty", "scrafty", "Base", listOf("dark", "fighting"), 2283, "Counter", 2, "Foul Play", "Power-Up Punch", 36, 20, atk = 163.0, def = 222.0, hp = 163, glRank = 82, ulRank = 58, mlRank = 340, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "12/12/14"),
            PokemonMeta("Obstagoon", "obstagoon", "obstagoon", "Base", listOf("dark", "normal"), 2492, "Counter", 2, "Night Slash", "Cross Chop", 28, 28, atk = 180.0, def = 194.0, hp = 212, glRank = 84, ulRank = 56, mlRank = 210, isRawBaseStats = true, defaultIvsGl = "5/15/12", defaultIvsUl = "4/15/14"),
            PokemonMeta("Diggersby", "diggersby", "diggersby", "Base", listOf("normal", "ground"), 1499, "Quick Attack", 1, "Scorching Sands", "Fire Punch", 40, 28, atk = 112.0, def = 155.0, hp = 198, glRank = 36, ulRank = 380, mlRank = 490, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),
            PokemonMeta("Jellicent", "jellicent", "jellicent", "Base", listOf("water", "ghost"), 2488, "Hex", 3, "Surf", "Shadow Ball", 34, 46, atk = 159.0, def = 178.0, hp = 225, glRank = 61, ulRank = 28, mlRank = 270, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "12/14/12"),
            PokemonMeta("Cofagrigus", "cofagrigus", "cofagrigus", "Base", listOf("ghost"), 2480, "Shadow Claw", 2, "Shadow Ball", "Dark Pulse", 46, 38, atk = 163.0, def = 237.0, hp = 151, glRank = 86, ulRank = 60, mlRank = 310, isRawBaseStats = true, defaultIvsGl = "6/13/14", defaultIvsUl = "12/12/15"),
            PokemonMeta("Runerigus", "runerigus", "runerigus", "Base", listOf("ground", "ghost"), 2480, "Shadow Claw", 2, "Sand Tomb", "Shadow Ball", 24, 46, atk = 163.0, def = 237.0, hp = 151, glRank = 89, ulRank = 62, mlRank = 315, isRawBaseStats = true, defaultIvsGl = "6/13/14", defaultIvsUl = "12/12/15"),
            PokemonMeta("Ferrothorn", "ferrothorn", "ferrothorn", "Base", listOf("grass", "steel"), 2480, "Bullet Seed", 3, "Power Whip", "Thunder", 42, 44, atk = 158.0, def = 223.0, hp = 179, glRank = 51, ulRank = 64, mlRank = 290, isRawBaseStats = true, defaultIvsGl = "4/8/15", defaultIvsUl = "13/14/15"),
            PokemonMeta("Galvantula", "galvantula", "galvantula", "Base", listOf("bug", "electric"), 2494, "Volt Switch", 4, "Lunge", "Discharge", 32, 36, atk = 201.0, def = 128.0, hp = 172, glRank = 87, ulRank = 68, mlRank = 350, isRawBaseStats = true, defaultIvsGl = "4/15/9", defaultIvsUl = "15/15/15"),
            PokemonMeta("Araquanid", "araquanid", "araquanid", "Base", listOf("water", "bug"), 1499, "Bug Bite", 1, "Bubble Beam", "Bug Buzz", 22, 44, atk = 126.0, def = 219.0, hp = 169, glRank = 53, ulRank = 320, mlRank = 480, isRawBaseStats = true, defaultIvsGl = "5/15/14", defaultIvsUl = "15/15/15"),
            PokemonMeta("Golisopod", "golisopod", "golisopod", "Base", listOf("bug", "water"), 2495, "Shadow Claw", 2, "Liquidation", "X-Scissor", 36, 32, atk = 218.0, def = 226.0, hp = 181, glRank = 69, ulRank = 24, mlRank = 150, isRawBaseStats = true, defaultIvsGl = "4/15/13", defaultIvsUl = "5/13/15"),
            PokemonMeta("Altaria", "altaria", "altaria", "Base", listOf("dragon", "flying"), 1499, "Dragon Breath", 1, "Sky Attack", "Moonblast", 36, 48, atk = 141.0, def = 201.0, hp = 181, glRank = 63, ulRank = 310, mlRank = 470, isRawBaseStats = true, defaultIvsGl = "4/12/13", defaultIvsUl = "15/15/15"),
            PokemonMeta("Noctowl", "noctowl", "noctowl", "Base", listOf("normal", "flying"), 1499, "Wing Attack", 2, "Sky Attack", "Shadow Ball", 36, 44, atk = 145.0, def = 156.0, hp = 225, glRank = 90, ulRank = 340, mlRank = 480, isRawBaseStats = true, defaultIvsGl = "4/14/14", defaultIvsUl = "15/15/15"),
            PokemonMeta("Vigoroth", "vigoroth", "vigoroth", "Base", listOf("normal"), 1499, "Counter", 2, "Body Slam", "Rock Slide", 26, 36, atk = 159.0, def = 145.0, hp = 190, glRank = 77, ulRank = 360, mlRank = 490, isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "15/15/15"),
            PokemonMeta("Toxicroak", "toxicroak", "toxicroak", "Base", listOf("poison", "fighting"), 2488, "Mud Shot", 2, "Mud Bomb", "Shadow Ball", 32, 44, atk = 211.0, def = 133.0, hp = 195, glRank = 81, ulRank = 57, mlRank = 290, isRawBaseStats = true, defaultIvsGl = "4/15/9", defaultIvsUl = "4/15/14"),
            PokemonMeta("Nidoqueen", "nidoqueen", "nidoqueen", "Base", listOf("poison", "ground"), 2488, "Poison Jab", 2, "Poison Fang", "Earth Power", 24, 46, atk = 180.0, def = 173.0, hp = 207, glRank = 83, ulRank = 59, mlRank = 260, isRawBaseStats = true, defaultIvsGl = "4/14/13", defaultIvsUl = "4/13/15"),
            PokemonMeta("Steelix", "steelix", "steelix", "Base", listOf("steel", "ground"), 2485, "Dragon Tail", 3, "Breaking Swipe", "Earthquake", 24, 52, atk = 148.0, def = 272.0, hp = 181, glRank = 80, ulRank = 30, mlRank = 250, isRawBaseStats = true, defaultIvsGl = "4/11/14", defaultIvsUl = "4/14/15"),
            PokemonMeta("Tinkaton", "tinkaton", "tinkaton", "Base", listOf("fairy", "steel"), 2488, "Fairy Wind", 2, "Gigaton Hammer", "Bulldoze", 42, 36, atk = 155.0, def = 196.0, hp = 198, glRank = 40, ulRank = 32, mlRank = 260, chargedMove3 = "Brutal Swing", isRawBaseStats = true, defaultIvsGl = "4/15/14", defaultIvsUl = "12/15/15"),
            PokemonMeta("Rillaboom", "rillaboom", "rillaboom", "Base", listOf("grass"), 2485, "Scratch", 1, "Drum Beating", "Earth Power", 36, 44, atk = 239.0, def = 168.0, hp = 225, glRank = 82, ulRank = 45, mlRank = 88, chargedMove3 = "Frenzy Plant", isRawBaseStats = true, defaultIvsGl = "5/15/13", defaultIvsUl = "4/14/15"),
            PokemonMeta("Cetitan", "cetitan", "cetitan", "Base", listOf("ice"), 2495, "Powder Snow", 2, "Body Slam", "Avalanche", 26, 44, atk = 208.0, def = 123.0, hp = 347, glRank = 57, ulRank = 38, mlRank = 95, isRawBaseStats = true, defaultIvsGl = "4/13/10", defaultIvsUl = "4/15/15"),
            PokemonMeta("Bellibolt", "bellibolt", "bellibolt", "Base", listOf("electric"), 2492, "Sucker Punch", 2, "Discharge", "Zap Cannon", 34, 56, atk = 184.0, def = 165.0, hp = 240, glRank = 75, ulRank = 42, mlRank = 220, isRawBaseStats = true, defaultIvsGl = "4/15/12", defaultIvsUl = "4/15/15")
        )

        // Dynamically loaded species & moves from PvPoke gamemaster.json (1,100+ Pokémon)
        val DYNAMIC_POKEMON_DATABASE = CopyOnWriteArrayList<PokemonMeta>()
        val DYNAMIC_MOVE_DATABASE = java.util.concurrent.ConcurrentHashMap<String, MoveStats>()
        val DYNAMIC_FAST_TURNS = java.util.concurrent.ConcurrentHashMap<String, Int>()
        val DYNAMIC_FAST_ENERGY = java.util.concurrent.ConcurrentHashMap<String, Int>()
        val DYNAMIC_FAST_POWER = java.util.concurrent.ConcurrentHashMap<String, Int>()
        val DYNAMIC_FAST_TYPE = java.util.concurrent.ConcurrentHashMap<String, String>()

        val FAST_MOVE_ENERGY: Map<String, Int> = mapOf(
            "dragon breath" to 3,
            "sand attack" to 4,
            "quick attack" to 8,
            "lock-on" to 5,
            "water gun" to 3,
            "lick" to 3,
            "bite" to 2,
            "tackle" to 3,
            "fury cutter" to 4,
            "bug bite" to 3,
            "scratch" to 2,
            "psywave" to 4,
            "psycho cut" to 9,
            "mud shot" to 8,
            "shadow claw" to 8,
            "counter" to 6,
            "powder snow" to 8,
            "wing attack" to 7,
            "peck" to 6,
            "poison sting" to 9,
            "thunder shock" to 9,
            "fairy wind" to 9,
            "bullet punch" to 7,
            "fire fang" to 6,
            "vine whip" to 8,
            "karate chop" to 9,
            "low kick" to 7,
            "ice fang" to 6,
            "metal claw" to 7,
            "sucker punch" to 7,
            "poison jab" to 7,
            "spark" to 7,
            "leafage" to 7,
            "steel wing" to 6,
            "rock throw" to 5,
            "force palm" to 10,
            "dragon tail" to 9,
            "waterfall" to 8,
            "fire spin" to 10,
            "snarl" to 13,
            "geomancy" to 13,
            "mud-slap" to 10,
            "charm" to 6,
            "double kick" to 12,
            "air slash" to 9,
            "ice shard" to 10,
            "bubble" to 11,
            "rollout" to 13,
            "smack down" to 8,
            "astonish" to 10,
            "hex" to 12,
            "magical leaf" to 10,
            "bullet seed" to 13,
            "water shuriken" to 14,
            "gust" to 12,
            "confusion" to 12,
            "volt switch" to 16,
            "incinerate" to 20,
            "ember" to 6
        )

        val MOVE_ENERGY_COST: Map<String, Int> = mapOf(
            "Drum Beating" to 35,
            "Gigaton Hammer" to 60,
            "Bulldoze" to 55,
            "Air Cutter" to 40,
            "Behemoth Blade" to 55,
            "Behemoth Bash" to 45,
            "Secret Sword" to 35,
            "Sacred Sword" to 35,
            "Aqua Jet" to 40,
            "Double Iron Bash" to 35,
            "Bleakwind Storm" to 45,
            "Wildbolt Storm" to 45,
            "Springtide Storm" to 45,
            "Roar of Time" to 65,
            "Iron Head" to 50,
            "Draco Meteor" to 65,
            "Thunder" to 60,
            "Aeroblast" to 75,
            "Sky Attack" to 50,
            "Future Sight" to 65,
            "Surf" to 45,
            "Origin Pulse" to 60,
            "Hydro Pump" to 75,
            "Blizzard" to 75,
            "Close Combat" to 45,
            "Brave Bird" to 55,
            "Play Rough" to 60,
            "Wild Charge" to 45,
            "Shadow Ball" to 50,
            "Ominous Wind" to 45,
            "Dragon Claw" to 50,
            "Ancient Power" to 45,
            "Shadow Force" to 65,
            "Spacial Rend" to 55,
            "Aqua Tail" to 35,
            "Precipice Blades" to 60,
            "Fire Punch" to 40,
            "Psystrike" to 45,
            "Ice Beam" to 55,
            "Moonblast" to 50,
            "Dark Pulse" to 45,
            "Oblivion Wing" to 50,
            "Crunch" to 45,
            "Earthquake" to 65,
            "Sandsear Storm" to 45,
            "Stone Edge" to 55,
            "Superpower" to 40,
            "Sacred Fire" to 65,
            "Sunsteel Strike" to 65,
            "Moongeist Beam" to 65,
            "Rock Slide" to 45,
            "Earth Power" to 50,
            "Outrage" to 60,
            "Meteor Mash" to 45,
            "Drill Run" to 40,
            "Rock Wrecker" to 50,
            "Breaking Swipe" to 50,
            "Avalanche" to 45,
            "High Horsepower" to 55,
            "Ice Punch" to 40,
            "Fusion Flare" to 45,
            "Overheat" to 55,
            "Fusion Bolt" to 45,
            "Glaciate" to 40,
            "Disarming Voice" to 45,
            "Hydro Cannon" to 40,
            "Weather Ball" to 35,
            "Weather Ball (Ice)" to 35,
            "Weather Ball (Fire)" to 35,
            "Weather Ball (Water)" to 35,
            "Weather Ball (Rock)" to 35,
            "Chilling Water" to 45,
            "Dazzling Gleam" to 70,
            "Scorching Sands" to 50,
            "Psycho Boost" to 35,
            "Thunderbolt" to 55,
            "Grass Knot" to 50,
            "Leaf Blade" to 35,
            "Aerial Ace" to 40,
            "Fly" to 45,
            "Flame Charge" to 50,
            "Blast Burn" to 50,
            "Feather Dance" to 50,
            "Shadow Sneak" to 45,
            "Twister" to 45,
            "Air Cutter" to 45,
            "Payback" to 60,
            "Body Slam" to 35,
            "Foul Play" to 45,
            "Night Slash" to 35,
            "Cross Chop" to 35,
            "Dynamic Punch" to 50,
            "Aura Sphere" to 55,
            "Focus Blast" to 75,
            "Sludge Bomb" to 50,
            "Sludge Wave" to 65,
            "Acid Spray" to 45,
            "Poison Fang" to 40,
            "Cross Poison" to 35,
            "Gunk Shot" to 75,
            "Mud Bomb" to 40,
            "Bone Club" to 35,
            "Shadow Bone" to 45,
            "Hurricane" to 65,
            "Acrobatics" to 55,
            "Drill Peck" to 40,
            "Psychic" to 55,
            "Psyshock" to 45,
            "Psychic Fangs" to 35,
            "Lunge" to 45,
            "Megahorn" to 55,
            "X-Scissor" to 40,
            "Power Gem" to 50,
            "Meteor Beam" to 60,
            "Night Shade" to 55,
            "Icy Wind" to 45,
            "Triple Axel" to 45,
            "Icicle Spear" to 40,
            "Freeze Shock" to 60,
            "Ice Burn" to 60,
            "Dragon Pulse" to 60,
            "Brutal Swing" to 40,
            "Flash Cannon" to 70,
            "Heavy Slam" to 50,
            "Magnet Bomb" to 45,
            "Mirror Shot" to 35,
            "Doom Desire" to 40,
            "Frenzy Plant" to 45,
            "Energy Ball" to 55,
            "Seed Bomb" to 45,
            "Power Whip" to 50,
            "Trailblaze" to 45,
            "Solar Beam" to 80,
            "Discharge" to 45,
            "Zap Cannon" to 80,
            "Scald" to 55,
            "Liquidation" to 45,
            "Muddy Water" to 35,
            "Water Pulse" to 55,
            "Nature's Madness" to 50,
            "Swift" to 35,
            "Hyper Beam" to 80,
            "Aura Wheel" to 45,
            "Rage Fist" to 35,
            "Torch Song" to 45,
            "Super Power" to 40,
            "Rock Tomb" to 60,
            "Sand Tomb" to 40,
            "Thunder Punch" to 40,
            "Flamethrower" to 55,
            "Fire Blast" to 80,
            "Last Resort" to 55,
            "Brine" to 50,
            "Dig" to 50,
            "Shadow Punch" to 35,
            "Spirit Shackle" to 40,
            "Darkest Lariat" to 60,
            "Power-Up Punch" to 35,
            "Bubble Beam" to 40,
            "Bug Buzz" to 60,
            "Leaf Tornado" to 40,
            "Stomp" to 40,
            "Petal Blizzard" to 65,
            "Mystical Fire" to 45,
            "Gyro Ball" to 60
        )

        fun getAllPokemonMeta(): List<PokemonMeta> {
            return if (DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                POKEMON_META_DATABASE
            } else {
                val dynIds = DYNAMIC_POKEMON_DATABASE.map { it.speciesId.lowercase() }.toSet()
                DYNAMIC_POKEMON_DATABASE + POKEMON_META_DATABASE.filter { !dynIds.contains(it.speciesId.lowercase()) }
            }
        }

        /**
         * FormResolver:
         * Resolves multi-form and regional species to the highest-ranked PvPoke variant
         * for the currently active league, and provides cycling across valid forms.
         */
        object FormResolver {
            fun getVariantsForSpecies(speciesOrName: String, activeLeague: String): List<PokemonMeta> {
                val base = extractBaseSpecies(speciesOrName)
                val variants = getAllPokemonMeta()
                    .filter {
                        it.baseSpecies.equals(base, ignoreCase = true) &&
                            !it.speciesId.endsWith("_shadow", ignoreCase = true) &&
                            !it.name.startsWith("Shadow ", ignoreCase = true)
                    }
                    .distinctBy { it.speciesId.lowercase() }
                if (variants.isEmpty()) return emptyList()

                return variants.sortedBy { meta ->
                    when {
                        activeLeague.contains("GREAT", ignoreCase = true) -> meta.glRank
                        activeLeague.contains("ULTRA", ignoreCase = true) -> meta.ulRank
                        else -> meta.mlRank
                    }
                }
            }

            fun resolveBestDefaultVariant(detectedMeta: PokemonMeta, rawText: String, activeLeague: String): PokemonMeta {
                val lowerRaw = rawText.lowercase()
                val variants = getVariantsForSpecies(detectedMeta.baseSpecies, activeLeague)
                if (variants.size <= 1) return variants.firstOrNull() ?: detectedMeta

                // Check if OCR explicitly read a form keyword (ignoring "base" and "shadow")
                for (variant in variants) {
                    val labelLower = variant.formLabel.lowercase()
                    if (labelLower != "base" && labelLower != "shadow" && lowerRaw.contains(labelLower)) {
                        return variant
                    }
                }
                // Otherwise default to the #1 highest-ranked variant for the active league
                return variants.first()
            }

            fun extractBaseSpecies(name: String): String {
                val exact = POKEMON_META_DATABASE.find { it.name.equals(name, ignoreCase = true) }
                if (exact != null) return exact.baseSpecies.lowercase()

                val cleaned = name.lowercase()
                    .replace(Regex("\\(.*?\\)"), " ")
                    .replace(Regex("\\b(?:shadow|purified|kanto|alolan|galarian|hisuian|paldean|mega|primal)\\b"), " ")
                    .replace(Regex("\\s+"), " ")
                    .trim()

                if (cleaned.startsWith("tapu ")) return cleaned
                return cleaned.split(" ").firstOrNull()?.takeIf { it.isNotBlank() } ?: name.lowercase()
            }
        }

        data class MoveUsage(
            val moveId: String,
            val uses: Int? = null
        )

        data class RankingMoves(
            val fastMoves: List<MoveUsage>,
            val chargedMoves: List<MoveUsage>
        )

        data class PokemonRankingEntry(
            val speciesId: String,
            val score: Double,
            val moves: RankingMoves,
            val moveCount: List<Int>? = null,
            val moveset: List<String>? = null
        )

        data class PokemonAutocompleteSuggestion(
            val name: String,
            val speciesId: String,
            val baseSpecies: String,
            val formBadge: String,
            val cp: Int,
            val fastMove: String,
            val chargedMove1: String,
            val chargedMove2: String,
            val isShadow: Boolean,
            val isAlternateForm: Boolean
        )

        val LIVE_RANKINGS_MAP = java.util.concurrent.ConcurrentHashMap<String, java.util.concurrent.ConcurrentHashMap<String, PokemonRankingEntry>>()
        val DYNAMIC_MOVE_ID_TO_NAME = java.util.concurrent.ConcurrentHashMap<String, String>()

        val CANONICAL_MOVE_ID_MAP: Map<String, String> = mapOf(
            "SUPER_POWER" to "Superpower",
            "LOCK_ON" to "Lock-On",
            "MUD_SLAP" to "Mud-Slap",
            "POWER_UP_PUNCH" to "Power-Up Punch",
            "X_SCISSOR" to "X-Scissor",
            "NATURES_MADNESS" to "Nature's Madness",
            "TORCH_SONG" to "Torch Song",
            "BRUTAL_SWING" to "Brutal Swing",
            "WATER_SHURIKEN" to "Water Shuriken",
            "PSYWAVE" to "Psywave",
            "DISARMING_VOICE" to "Disarming Voice",
            "HYDRO_CANNON" to "Hydro Cannon",
            "NIGHT_SLASH" to "Night Slash",
            "BODY_SLAM" to "Body Slam",
            "EARTHQUAKE" to "Earthquake",
            "SHADOW_BALL" to "Shadow Ball",
            "INCINERATE" to "Incinerate",
            "WEATHER_BALL_FIRE" to "Weather Ball (Fire)",
            "WEATHER_BALL_ICE" to "Weather Ball (Ice)",
            "WEATHER_BALL_WATER" to "Weather Ball (Water)",
            "WEATHER_BALL_ROCK" to "Weather Ball (Rock)",
            "WEATHER_BALL_NORMAL" to "Weather Ball",
            "CHILLING_WATER" to "Chilling Water",
            "FUTURE_SIGHT" to "Future Sight",
            "ROAR_OF_TIME" to "Roar of Time",
            "FREEZE_SHOCK" to "Freeze Shock",
            "ICE_BURN" to "Ice Burn",
            "FUSION_BOLT" to "Fusion Bolt",
            "FUSION_FLARE" to "Fusion Flare",
            "SPACIAL_REND" to "Spacial Rend",
            "ROCK_TOMB" to "Rock Tomb",
            "SAND_TOMB" to "Sand Tomb",
            "MIRROR_SHOT" to "Mirror Shot",
            "VOLT_SWITCH" to "Volt Switch"
        )

        val REQUIRED_LEAGUE_KEYS = listOf(
            "GREAT LEAGUE",
            "ULTRA LEAGUE",
            "MASTER LEAGUE",
            "MEGA MASTER LEAGUE"
        )

        fun areAllFourLeaguesLoaded(): Boolean {
            return REQUIRED_LEAGUE_KEYS.all { key ->
                val map = LIVE_RANKINGS_MAP[key]
                map != null && map.isNotEmpty()
            }
        }

        fun getGamemasterLoadedCount(): Int {
            return if (DYNAMIC_POKEMON_DATABASE.isNotEmpty()) {
                POKEMON_META_DATABASE.size + DYNAMIC_POKEMON_DATABASE.size
            } else {
                0
            }
        }

        fun getLeagueRankingsCount(leagueKey: String): Int {
            return LIVE_RANKINGS_MAP[leagueKey.uppercase()]?.size ?: 0
        }

        fun formatMoveIdDisplay(moveId: String): String {
            if (moveId.isBlank()) return ""
            val upper = moveId.trim().uppercase()
            CANONICAL_MOVE_ID_MAP[upper]?.let { return it }
            DYNAMIC_MOVE_ID_TO_NAME[moveId]?.let { return it }
            DYNAMIC_MOVE_ID_TO_NAME[upper]?.let { return it }
            return moveId.lowercase().split("_").joinToString(" ") { w ->
                w.replaceFirstChar { c -> c.uppercase() }
            }
        }

        private fun com.google.gson.JsonObject.optString(key: String): String? =
            get(key)?.takeIf { !it.isJsonNull && it.isJsonPrimitive }?.let { runCatching { it.asString }.getOrNull() }

        private fun com.google.gson.JsonObject.optInt(key: String): Int? =
            get(key)?.takeIf { !it.isJsonNull && it.isJsonPrimitive }?.let { runCatching { it.asDouble.toInt() }.getOrNull() }

        private fun com.google.gson.JsonObject.optDouble(key: String): Double? =
            get(key)?.takeIf { !it.isJsonNull && it.isJsonPrimitive }?.let { runCatching { it.asDouble }.getOrNull() }

        private fun com.google.gson.JsonObject.optJsonArray(key: String): com.google.gson.JsonArray? =
            get(key)?.takeIf { !it.isJsonNull && it.isJsonArray }?.asJsonArray

        private fun com.google.gson.JsonObject.optJsonObject(key: String): com.google.gson.JsonObject? =
            get(key)?.takeIf { !it.isJsonNull && it.isJsonObject }?.asJsonObject

        fun parseRankingsJsonStatic(leagueKey: String, jsonStr: String): Int {
            return try {
                val arr = JsonParser.parseString(jsonStr).asJsonArray
                val leagueMap = java.util.concurrent.ConcurrentHashMap<String, PokemonRankingEntry>()
                for (el in arr) {
                    try {
                        if (!el.isJsonObject) continue
                        val obj = el.asJsonObject
                        val speciesId = obj.optString("speciesId")?.takeIf { it.isNotBlank() } ?: continue
                        val score = obj.optDouble("score") ?: 80.0
                        val movesObj = obj.optJsonObject("moves")

                        val fastList = mutableListOf<MoveUsage>()
                        val rawFast = movesObj?.optJsonArray("fastMoves")
                        if (rawFast != null) {
                            for (fm in rawFast) {
                                if (!fm.isJsonObject) continue
                                val fmObj = fm.asJsonObject
                                val mId = fmObj.optString("moveId")?.takeIf { it.isNotBlank() } ?: continue
                                val uses = fmObj.optInt("uses")
                                fastList.add(MoveUsage(mId, uses))
                            }
                        }
                        fastList.sortByDescending { it.uses ?: 0 }

                        val chargedList = mutableListOf<MoveUsage>()
                        val rawCharged = movesObj?.optJsonArray("chargedMoves")
                        if (rawCharged != null) {
                            for (cm in rawCharged) {
                                if (!cm.isJsonObject) continue
                                val cmObj = cm.asJsonObject
                                val mId = cmObj.optString("moveId")?.takeIf { it.isNotBlank() } ?: continue
                                val uses = cmObj.optInt("uses")
                                chargedList.add(MoveUsage(mId, uses))
                            }
                        }
                        chargedList.sortByDescending { it.uses ?: 0 }

                        val movesetList = mutableListOf<String>()
                        val movesetArr = obj.optJsonArray("moveset")
                        if (movesetArr != null && movesetArr.size() > 0) {
                            for (i in 0 until movesetArr.size()) {
                                val msEl = movesetArr.get(i)
                                val msId = if (msEl != null && !msEl.isJsonNull && msEl.isJsonPrimitive) msEl.asString else null
                                if (!msId.isNullOrBlank()) movesetList.add(msId)
                            }
                            if (fastList.isEmpty() && movesetList.isNotEmpty()) {
                                fastList.add(MoveUsage(movesetList[0], 100))
                            }
                            if (chargedList.isEmpty() && movesetList.size > 1) {
                                for (i in 1 until movesetList.size) {
                                    chargedList.add(MoveUsage(movesetList[i], 100 - i))
                                }
                            }
                        }

                        val moveCountList = mutableListOf<Int>()
                        val mcArr = obj.optJsonArray("moveCount")
                        if (mcArr != null) {
                            for (mc in mcArr) {
                                if (mc != null && !mc.isJsonNull && mc.isJsonPrimitive) {
                                    runCatching { mc.asDouble.toInt() }.getOrNull()?.let { moveCountList.add(it) }
                                }
                            }
                        }

                        leagueMap[speciesId.lowercase()] = PokemonRankingEntry(
                            speciesId = speciesId,
                            score = score,
                            moves = RankingMoves(fastMoves = fastList, chargedMoves = chargedList),
                            moveCount = moveCountList.takeIf { it.isNotEmpty() },
                            moveset = movesetList.takeIf { it.isNotEmpty() }
                        )
                    } catch (_: Exception) {
                        // Skip individual malformed entry without aborting league parsing
                    }
                }
                LIVE_RANKINGS_MAP[leagueKey.uppercase()] = leagueMap
                leagueMap.size
            } catch (_: Exception) {
                0
            }
        }

        fun applyRankingMovesForLeague(meta: PokemonMeta, league: String, isShadow: Boolean = false): PokemonMeta {
            val normLeague = when {
                league.contains("MEGA", ignoreCase = true) -> "MEGA MASTER LEAGUE"
                league.contains("GREAT", ignoreCase = true) -> "GREAT LEAGUE"
                league.contains("ULTRA", ignoreCase = true) -> "ULTRA LEAGUE"
                else -> "MASTER LEAGUE"
            }
            val isSkeledirge = meta.baseSpecies.equals("skeledirge", ignoreCase = true) ||
                meta.speciesId.startsWith("skeledirge", ignoreCase = true)

            val map = LIVE_RANKINGS_MAP[normLeague]
            val baseKey = meta.speciesId.lowercase().removeSuffix("_shadow")
            val effectiveShadow = isShadow || meta.name.startsWith("Shadow ", ignoreCase = true) || meta.speciesId.endsWith("_shadow", ignoreCase = true)
            val entry = if (map != null) {
                if (effectiveShadow) {
                    map["${baseKey}_shadow"] ?: map[baseKey]
                } else {
                    map[baseKey] ?: map["${baseKey}_shadow"]
                }
            } else null

            if (entry == null) {
                if (isSkeledirge) {
                    return meta.copy(
                        defaultFastMove = "Incinerate",
                        fastTurns = 5,
                        chargedMove1 = "Torch Song",
                        chargedMove2 = "Shadow Ball",
                        chargedMove3 = "Disarming Voice"
                    )
                }
                return meta
            }

            // Priority 1: Official recommended moveset[0] for Fast Move, fallback to highest-uses fastMoves[0]
            val topFastId = entry.moveset?.getOrNull(0)?.takeIf { it.isNotBlank() }
                ?: entry.moves.fastMoves.firstOrNull()?.moveId

            // Priority 2: Official recommended moveset[1..2] for Charged Moves 1 & 2, then top-usage chargedMoves for 3rd move
            val orderedChargedNames = mutableListOf<String>()
            entry.moveset?.drop(1)?.forEach { mId ->
                val formatted = formatMoveIdDisplay(mId)
                if (formatted.isNotBlank() && orderedChargedNames.none { it.equals(formatted, ignoreCase = true) }) {
                    orderedChargedNames.add(formatted)
                }
            }
            entry.moves.chargedMoves.forEach { cm ->
                val formatted = formatMoveIdDisplay(cm.moveId)
                if (formatted.isNotBlank() && orderedChargedNames.none { it.equals(formatted, ignoreCase = true) }) {
                    orderedChargedNames.add(formatted)
                }
            }

            val fastName = topFastId?.let { formatMoveIdDisplay(it) }?.takeIf { it.isNotBlank() } ?: meta.defaultFastMove
            val fastTurns = DYNAMIC_FAST_TURNS[fastName.lowercase()] ?: FAST_MOVE_TURNS[fastName.lowercase()] ?: meta.fastTurns

            if (isSkeledirge) {
                return meta.copy(
                    defaultFastMove = fastName,
                    fastTurns = fastTurns,
                    chargedMove1 = "Torch Song",
                    chargedMove2 = "Shadow Ball",
                    chargedMove3 = "Disarming Voice"
                )
            }

            val c1Name = orderedChargedNames.getOrNull(0) ?: meta.chargedMove1
            val c2Name = orderedChargedNames.getOrNull(1) ?: meta.chargedMove2
            val c3Name = orderedChargedNames.getOrNull(2) ?: meta.chargedMove3
            val c4Name = orderedChargedNames.getOrNull(3) ?: meta.chargedMove4

            return meta.copy(
                defaultFastMove = fastName,
                fastTurns = fastTurns,
                chargedMove1 = c1Name,
                chargedMove2 = c2Name,
                chargedMove3 = c3Name,
                chargedMove4 = c4Name
            )
        }

        /**
         * Returns autocomplete suggestions for the Team Builder UI.
         * When typing a base form (e.g. "giratina", "ninetales", "feraligatr", "zacian"),
         * returns Base + all Alternate Forms + Shadow variants.
         */
        fun getAutocompletePokemonSuggestions(
            rawQuery: String,
            league: String = "GREAT LEAGUE",
            limit: Int = 20
        ): List<PokemonAutocompleteSuggestion> {
            val query = rawQuery.trim().lowercase()
            if (query.isEmpty()) return emptyList()

            val isTypingShadow = query.startsWith("shadow") || query.contains(" shadow")
            val strippedQuery = query.removePrefix("shadow").trim()
            val searchToken = strippedQuery.ifEmpty { query }

            val allMeta = getAllPokemonMeta()
            val poolByName = LinkedHashMap<String, PokemonAutocompleteSuggestion>()

            for (meta in allMeta) {
                val isShadow = meta.name.startsWith("Shadow ", ignoreCase = true) || meta.speciesId.endsWith("_shadow", ignoreCase = true)
                val isMegaOrPrimal = meta.name.startsWith("Mega ", ignoreCase = true) || meta.name.startsWith("Primal ", ignoreCase = true) || meta.speciesId.contains("_mega") || meta.speciesId.contains("_primal")
                val baseKey = FormResolver.extractBaseSpecies(meta.name)
                val rankedMeta = computeEffectiveCombatStats(applyRankingMovesForLeague(applyRecommendedMoves(meta), league, isShadow), league)
                val badge = when {
                    isShadow && meta.formLabel != "Base" && meta.formLabel != "Shadow" -> "Shadow • ${meta.formLabel}"
                    isShadow -> "Shadow"
                    isMegaOrPrimal -> if (meta.name.startsWith("Primal", ignoreCase = true)) "Primal" else "Mega"
                    else -> meta.formLabel
                }
                val isAlt = badge != "Base" && badge != "Shadow"

                val keyLower = meta.name.lowercase()
                if (!poolByName.containsKey(keyLower)) {
                    poolByName[keyLower] = PokemonAutocompleteSuggestion(
                        name = meta.name,
                        speciesId = meta.speciesId,
                        baseSpecies = baseKey,
                        formBadge = badge,
                        cp = rankedMeta.defaultCp,
                        fastMove = rankedMeta.defaultFastMove,
                        chargedMove1 = rankedMeta.chargedMove1,
                        chargedMove2 = rankedMeta.chargedMove2,
                        isShadow = isShadow,
                        isAlternateForm = isAlt
                    )
                }

                // Synthesize Shadow option for eligible non-Shadow, non-Mega/Primal Pokémon
                if (!isShadow && !isMegaOrPrimal) {
                    val shadowName = "Shadow ${meta.name}"
                    val shadowKey = shadowName.lowercase()
                    if (!poolByName.containsKey(shadowKey)) {
                        val shadowRanked = computeEffectiveCombatStats(applyRankingMovesForLeague(applyRecommendedMoves(meta), league, true), league)
                        poolByName[shadowKey] = PokemonAutocompleteSuggestion(
                            name = shadowName,
                            speciesId = "${meta.speciesId}_shadow",
                            baseSpecies = baseKey,
                            formBadge = if (meta.formLabel != "Base") "Shadow • ${meta.formLabel}" else "Shadow",
                            cp = shadowRanked.defaultCp,
                            fastMove = shadowRanked.defaultFastMove,
                            chargedMove1 = shadowRanked.chargedMove1,
                            chargedMove2 = shadowRanked.chargedMove2,
                            isShadow = true,
                            isAlternateForm = isAlt
                        )
                    }
                }
            }

            val matchedFamilies = HashSet<String>()
            for (opt in poolByName.values) {
                if (opt.baseSpecies.startsWith(searchToken) || opt.baseSpecies.contains(searchToken) || opt.name.lowercase().contains(searchToken)) {
                    matchedFamilies.add(opt.baseSpecies)
                }
            }

            val results = poolByName.values.filter { opt ->
                matchedFamilies.contains(opt.baseSpecies) || opt.name.lowercase().contains(query)
            }.sortedWith(
                Comparator { a, b ->
                    val aStarts = if (a.baseSpecies.startsWith(searchToken)) 0 else 1
                    val bStarts = if (b.baseSpecies.startsWith(searchToken)) 0 else 1
                    if (aStarts != bStarts) return@Comparator aStarts - bStarts
                    val famCmp = a.baseSpecies.compareTo(b.baseSpecies)
                    if (famCmp != 0) return@Comparator famCmp
                    if (isTypingShadow) {
                        if (a.isShadow != b.isShadow) return@Comparator if (a.isShadow) -1 else 1
                    } else {
                        if (a.isShadow != b.isShadow) return@Comparator if (a.isShadow) 1 else -1
                    }
                    if (a.isAlternateForm != b.isAlternateForm) return@Comparator if (a.isAlternateForm) 1 else -1
                    a.name.compareTo(b.name)
                }
            )

            return results.take(limit)
        }

        private val CPM_TABLE: List<Pair<Double, Double>> = listOf(
            1.0 to 0.094, 1.5 to 0.135137432, 2.0 to 0.16639787, 2.5 to 0.192650919,
            3.0 to 0.21573247, 3.5 to 0.236572661, 4.0 to 0.25572005, 4.5 to 0.273530381,
            5.0 to 0.29024988, 5.5 to 0.306057377, 6.0 to 0.3210876, 6.5 to 0.335445036,
            7.0 to 0.34921268, 7.5 to 0.362457751, 8.0 to 0.37523559, 8.5 to 0.387592406,
            9.0 to 0.39956728, 9.5 to 0.411193551, 10.0 to 0.42250001, 10.5 to 0.432926419,
            11.0 to 0.44310755, 11.5 to 0.453059958, 12.0 to 0.46279839, 12.5 to 0.472336083,
            13.0 to 0.48168495, 13.5 to 0.4908558, 14.0 to 0.49985844, 14.5 to 0.508701765,
            15.0 to 0.51739395, 15.5 to 0.525942511, 16.0 to 0.53435433, 16.5 to 0.542635767,
            17.0 to 0.55079269, 17.5 to 0.558830576, 18.0 to 0.56675452, 18.5 to 0.574569153,
            19.0 to 0.58227891, 19.5 to 0.589887917, 20.0 to 0.59740001, 20.5 to 0.604818814,
            21.0 to 0.61215729, 21.5 to 0.619404122, 22.0 to 0.62656713, 22.5 to 0.633649143,
            23.0 to 0.64065295, 23.5 to 0.647580967, 24.0 to 0.65443563, 24.5 to 0.661219252,
            25.0 to 0.667934, 25.5 to 0.674581896, 26.0 to 0.68116492, 26.5 to 0.687684904,
            27.0 to 0.69414365, 27.5 to 0.70054287, 28.0 to 0.70688421, 28.5 to 0.713168999,
            29.0 to 0.71939909, 29.5 to 0.725575614, 30.0 to 0.7317, 30.5 to 0.734741009,
            31.0 to 0.73776948, 31.5 to 0.740785574, 32.0 to 0.74378943, 32.5 to 0.746781211,
            33.0 to 0.74976104, 33.5 to 0.752729087, 34.0 to 0.75568551, 34.5 to 0.758630378,
            35.0 to 0.76156384, 35.5 to 0.764486065, 36.0 to 0.76739717, 36.5 to 0.770297266,
            37.0 to 0.7731865, 37.5 to 0.776064962, 38.0 to 0.77893275, 38.5 to 0.781790055,
            39.0 to 0.78463697, 39.5 to 0.787473578, 40.0 to 0.7903, 40.5 to 0.792803968,
            41.0 to 0.79530001, 41.5 to 0.797800015, 42.0 to 0.8003, 42.5 to 0.802799995,
            43.0 to 0.8053, 43.5 to 0.8078, 44.0 to 0.81029999, 44.5 to 0.812799985,
            45.0 to 0.81529999, 45.5 to 0.81779999, 46.0 to 0.82029999, 46.5 to 0.82279999,
            47.0 to 0.82529999, 47.5 to 0.82779999, 48.0 to 0.83029999, 48.5 to 0.83279999,
            49.0 to 0.83529999, 49.5 to 0.83779999, 50.0 to 0.84029999
        )

        private fun solveLeagueLevelCpm(uAtk: Double, uDef: Double, uHp: Double, leagueCap: Int): Pair<Double, Int> {
            var bestCpm = 0.094
            var bestCp = 10
            for ((_, cpm) in CPM_TABLE) {
                val cp = floor(uAtk * kotlin.math.sqrt(uDef * uHp) * cpm * cpm / 10.0).toInt().coerceAtLeast(10)
                if (cp <= leagueCap) {
                    bestCpm = cpm
                    bestCp = cp
                } else {
                    break
                }
            }
            return bestCpm to bestCp
        }

        /**
         * Resolves PvPoke recommended Fast Move, Charged Move 1, Charged Move 2, and default CP for a Pokémon name,
         * prioritizing live rankings JSON moves when available.
         */
        fun resolveRecommendedMovesForSpecies(
            rawName: String,
            league: String = "GREAT LEAGUE",
            customCp: Int? = null,
            customIvs: String? = null
        ): PokemonMeta? {
            val trimmed = rawName.trim()
            if (trimmed.isEmpty()) return null
            val isShadowInput = trimmed.startsWith("Shadow ", ignoreCase = true) || trimmed.contains("(Shadow)", ignoreCase = true)
            val cleanNoShadow = trimmed
                .replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "")
                .replace(Regex("\\s*\\(Shadow\\)", RegexOption.IGNORE_CASE), "")
                .trim()
            val allMeta = getAllPokemonMeta()

            val exactByName = allMeta.find {
                it.name.equals(trimmed, ignoreCase = true) ||
                    it.name.equals(cleanNoShadow, ignoreCase = true) ||
                    (cleanNoShadow.contains("zygarde", ignoreCase = true) && cleanNoShadow.contains("complete", ignoreCase = true) && it.speciesId.equals("zygarde_complete", ignoreCase = true))
            }
            if (exactByName != null) {
                val withRankMoves = applyRankingMovesForLeague(applyRecommendedMoves(exactByName), league, isShadowInput)
                return computeEffectiveCombatStats(withRankMoves, league, customCp, customIvs)
            }

            val base = FormResolver.extractBaseSpecies(cleanNoShadow)
            val variants = FormResolver.getVariantsForSpecies(base, league)
            if (variants.isNotEmpty()) {
                val chosen = FormResolver.resolveBestDefaultVariant(variants.first(), cleanNoShadow, league)
                val withRankMoves = applyRankingMovesForLeague(applyRecommendedMoves(chosen), league, isShadowInput)
                return computeEffectiveCombatStats(withRankMoves, league, customCp, customIvs)
            }

            val exactById = allMeta.find {
                it.speciesId.equals(cleanNoShadow.replace(" ", "_"), ignoreCase = true)
            }
            if (exactById != null) {
                val withRankMoves = applyRankingMovesForLeague(applyRecommendedMoves(exactById), league, isShadowInput)
                return computeEffectiveCombatStats(withRankMoves, league, customCp, customIvs)
            }

            val partial = allMeta.firstOrNull {
                it.name.lowercase().contains(cleanNoShadow.lowercase()) ||
                    cleanNoShadow.lowercase().contains(it.baseSpecies.lowercase())
            }
            return partial?.let {
                val withRankMoves = applyRankingMovesForLeague(applyRecommendedMoves(it), league, isShadowInput)
                computeEffectiveCombatStats(withRankMoves, league, customCp, customIvs)
            }
        }

        /**
         * Parses user IV string (e.g. "0/15/15", "15-15-15", "15 15 15") or returns PvPoke default IVs for the league.
         */
        fun parseIvTriplet(ivStr: String?, league: String, meta: PokemonMeta): Triple<Int, Int, Int> {
            if (!ivStr.isNullOrBlank()) {
                val parts = ivStr.trim().split(Regex("[/\\-,\\s]+")).mapNotNull { it.toIntOrNull() }
                if (parts.size >= 3) {
                    return Triple(
                        parts[0].coerceIn(0, 15),
                        parts[1].coerceIn(0, 15),
                        parts[2].coerceIn(0, 15)
                    )
                }
            }
            return when {
                league.contains("GREAT", ignoreCase = true) -> {
                    val glParts = meta.defaultIvsGl.split("/").mapNotNull { it.toIntOrNull() }
                    if (glParts.size >= 3) Triple(glParts[0], glParts[1], glParts[2]) else Triple(1, 15, 15)
                }
                league.contains("ULTRA", ignoreCase = true) -> {
                    val ulParts = meta.defaultIvsUl.split("/").mapNotNull { it.toIntOrNull() }
                    if (ulParts.size >= 3) Triple(ulParts[0], ulParts[1], ulParts[2]) else Triple(1, 15, 15)
                }
                else -> Triple(15, 15, 15)
            }
        }

        /**
         * Computes League CP-scaled and IV-adjusted effective combat stats (Atk, Def, HP, and CP).
         * Automatically defaults to PvPoke standard IVs and official half-level CPM when customIvs/customCp is blank.
         */
        fun computeEffectiveCombatStats(
            meta: PokemonMeta,
            league: String,
            customCp: Int? = null,
            customIvs: String? = null
        ): PokemonMeta {
            val isGreat = league.contains("GREAT", ignoreCase = true)
            val isUltra = league.contains("ULTRA", ignoreCase = true)
            val leagueCap = when {
                isGreat -> 1500
                isUltra -> 2500
                else -> 6000
            }

            val actualIvs = parseIvTriplet(customIvs, league, meta)

            if (meta.isRawBaseStats) {
                val uAtk = (meta.atk + actualIvs.first).coerceAtLeast(20.0)
                val uDef = (meta.def + actualIvs.second).coerceAtLeast(20.0)
                val uHp = (meta.hp.toDouble() + actualIvs.third).coerceAtLeast(20.0)
                val (cpm, targetCp) = if (customCp != null && customCp in 100..(leagueCap + 100)) {
                    val solvedCpm = kotlin.math.sqrt((customCp * 10.0) / (uAtk * kotlin.math.sqrt(uDef * uHp))).coerceIn(0.094, 0.8453)
                    solvedCpm to customCp
                } else {
                    solveLeagueLevelCpm(uAtk, uDef, uHp, leagueCap)
                }
                return meta.copy(
                    defaultCp = targetCp,
                    atk = uAtk * cpm,
                    def = uDef * cpm,
                    hp = floor(uHp * cpm).toInt().coerceAtLeast(10),
                    isRawBaseStats = false
                )
            }

            // Static POKEMON_META_DATABASE entries: derive true reference CP from actual (atk, def, hp) stat product
            val statRefCp = floor(meta.atk * kotlin.math.sqrt(meta.def * meta.hp.toDouble()) / 10.0).coerceAtLeast(100.0)
            val refCpm = when {
                statRefCp > 2500.0 -> 0.8403
                statRefCp > 1550.0 -> 0.7903
                else -> 0.7317
            }
            val refIvs = when {
                statRefCp > 2500.0 -> Triple(15, 15, 15)
                else -> Triple(1, 15, 15)
            }

            val adjAtkAtRef = (meta.atk + (actualIvs.first - refIvs.first) * refCpm).coerceAtLeast(20.0)
            val adjDefAtRef = (meta.def + (actualIvs.second - refIvs.second) * refCpm).coerceAtLeast(20.0)
            val adjHpAtRef = (meta.hp.toDouble() + (actualIvs.third - refIvs.third) * refCpm).coerceAtLeast(20.0)

            val refProd = (meta.atk * kotlin.math.sqrt(meta.def * meta.hp.toDouble())).coerceAtLeast(1.0)
            val adjProd = (adjAtkAtRef * kotlin.math.sqrt(adjDefAtRef * adjHpAtRef)).coerceAtLeast(1.0)
            val ivCpRatio = adjProd / refProd

            val defaultLeagueCp = when {
                isGreat -> if (meta.defaultCp <= 1500) meta.defaultCp else 1498
                isUltra -> when {
                    meta.defaultCp in 1501..2500 -> meta.defaultCp
                    meta.defaultCp > 2500 -> 2496
                    else -> min(2500, (statRefCp * 1.65).roundToInt())
                }
                else -> if (meta.defaultCp > 2500) meta.defaultCp else (statRefCp * 1.45).roundToInt().coerceAtMost(4720)
            }

            val targetCp = if (customCp != null && customCp in 100..(leagueCap + 100)) {
                customCp
            } else if (!isGreat && !isUltra) {
                (defaultLeagueCp * ivCpRatio).roundToInt().coerceAtLeast(100)
            } else {
                defaultLeagueCp
            }

            val effectiveRefCp = (statRefCp * ivCpRatio).coerceAtLeast(100.0)
            val cpmScale = kotlin.math.sqrt(targetCp.toDouble() / effectiveRefCp).coerceIn(0.35, 1.45)

            return meta.copy(
                defaultCp = targetCp,
                atk = adjAtkAtRef * cpmScale,
                def = adjDefAtRef * cpmScale,
                hp = (adjHpAtRef * cpmScale).roundToInt().coerceAtLeast(10)
            )
        }

        fun parseGamemasterJsonStatic(jsonStr: String) {
            try {
                val root = JsonParser.parseString(jsonStr).asJsonObject
                val movesArr: JsonArray? = root.optJsonArray("moves")
                val fastMoveNames = HashMap<String, String>()
                if (movesArr != null) {
                    for (el in movesArr) {
                        try {
                            if (!el.isJsonObject) continue
                            val obj = el.asJsonObject
                            val moveId = obj.optString("moveId")?.takeIf { it.isNotBlank() } ?: continue
                            val rawName = obj.optString("name")?.takeIf { it.isNotBlank() } ?: moveId
                            val name = CANONICAL_MOVE_ID_MAP[moveId.uppercase()] ?: rawName
                            val type = obj.optString("type")?.lowercase() ?: "normal"
                            val power = obj.optInt("power") ?: 50
                            val energyGain = obj.optInt("energyGain") ?: 0
                            val energyCost = obj.optInt("energy") ?: 50
                            val turns = ((obj.optInt("cooldown") ?: 1000) / 500).coerceIn(1, 5)
                            DYNAMIC_MOVE_ID_TO_NAME[moveId] = name
                            if (energyGain > 0) {
                                fastMoveNames[moveId] = name
                                DYNAMIC_FAST_TURNS[name.lowercase()] = turns
                                DYNAMIC_FAST_TURNS[moveId.lowercase()] = turns
                                DYNAMIC_FAST_ENERGY[name.lowercase()] = energyGain
                                DYNAMIC_FAST_ENERGY[moveId.lowercase()] = energyGain
                                DYNAMIC_FAST_POWER[name.lowercase()] = power
                                DYNAMIC_FAST_POWER[moveId.lowercase()] = power
                                DYNAMIC_FAST_TYPE[name.lowercase()] = type
                                DYNAMIC_FAST_TYPE[moveId.lowercase()] = type
                            } else {
                                DYNAMIC_MOVE_DATABASE[name] = MoveStats(name, type, power, energyCost)
                            }
                        } catch (_: Exception) {}
                    }
                }

                val pokemonArr: JsonArray? = root.optJsonArray("pokemon")
                if (pokemonArr != null) {
                    val existingById = POKEMON_META_DATABASE.associateBy { it.speciesId.lowercase() }
                    val parsedList = mutableListOf<PokemonMeta>()
                    for (el in pokemonArr) {
                        try {
                            if (!el.isJsonObject) continue
                            val obj = el.asJsonObject
                            val speciesId = obj.optString("speciesId")?.takeIf { it.isNotBlank() } ?: continue
                            val existingStatic = existingById[speciesId.lowercase()]

                            val rawSpeciesName = obj.optString("speciesName")?.takeIf { it.isNotBlank() } ?: continue
                            val speciesName = if (rawSpeciesName.endsWith(" (Shadow)")) {
                                "Shadow " + rawSpeciesName.removeSuffix(" (Shadow)").trim()
                            } else {
                                rawSpeciesName
                            }
                            val baseSpecies = speciesName.lowercase()
                                .replace(Regex("\\(.*?\\)"), " ")
                                .replace(Regex("\\b(?:shadow|purified|alolan|galarian|hisuian|paldean|mega|primal)\\b"), " ")
                                .replace(Regex("\\s+"), " ")
                                .trim()
                                .let { if (it.startsWith("tapu ")) it else it.split(" ").firstOrNull() ?: speciesName.lowercase() }

                            val formLabel = Regex("\\((.*?)\\)").find(rawSpeciesName)?.groupValues?.getOrNull(1)
                                ?: if (speciesName.startsWith("Mega ", ignoreCase = true)) "Mega"
                                else if (speciesName.startsWith("Primal ", ignoreCase = true)) "Primal"
                                else "Base"

                            val typesArr = obj.optJsonArray("types")
                            val types = mutableListOf<String>()
                            if (typesArr != null) {
                                for (t in typesArr) {
                                    if (t != null && !t.isJsonNull && t.isJsonPrimitive) {
                                        val ts = t.asString
                                        if (ts != "none") types.add(ts.lowercase())
                                    }
                                }
                            }
                            if (types.isEmpty()) types.add("normal")

                            val baseStats = obj.optJsonObject("baseStats")
                            val atk = baseStats?.optDouble("atk") ?: 180.0
                            val def = baseStats?.optDouble("def") ?: 170.0
                            val hp = baseStats?.optInt("hp") ?: 160

                            var defaultIvsGl = "1/15/15"
                            var defaultIvsUl = "1/15/15"
                            val defaultIvsObj = obj.optJsonObject("defaultIVs")
                            if (defaultIvsObj != null) {
                                val cp1500 = defaultIvsObj.optJsonArray("cp1500")
                                if (cp1500 != null && cp1500.size() >= 4) {
                                    runCatching {
                                        defaultIvsGl = "${cp1500.get(1).asDouble.toInt()}/${cp1500.get(2).asDouble.toInt()}/${cp1500.get(3).asDouble.toInt()}"
                                    }
                                }
                                val cp2500 = defaultIvsObj.optJsonArray("cp2500")
                                if (cp2500 != null && cp2500.size() >= 4) {
                                    runCatching {
                                        defaultIvsUl = "${cp2500.get(1).asDouble.toInt()}/${cp2500.get(2).asDouble.toInt()}/${cp2500.get(3).asDouble.toInt()}"
                                    }
                                }
                            }

                            val rankEntry = LIVE_RANKINGS_MAP["GREAT LEAGUE"]?.get(speciesId.lowercase())
                                ?: LIVE_RANKINGS_MAP["ULTRA LEAGUE"]?.get(speciesId.lowercase())
                                ?: LIVE_RANKINGS_MAP["MASTER LEAGUE"]?.get(speciesId.lowercase())
                                ?: LIVE_RANKINGS_MAP["MEGA MASTER LEAGUE"]?.get(speciesId.lowercase())

                            val fastMovesArr = obj.optJsonArray("fastMoves")
                            val firstFastId = rankEntry?.moveset?.getOrNull(0)?.takeIf { it.isNotBlank() }
                                ?: rankEntry?.moves?.fastMoves?.firstOrNull()?.moveId
                                ?: if (fastMovesArr != null && fastMovesArr.size() > 0 && !fastMovesArr.get(0).isJsonNull) fastMovesArr.get(0).asString else "TACKLE"
                            val fastMoveName = fastMoveNames[firstFastId]
                                ?: formatMoveIdDisplay(firstFastId)
                            val fastTurns = DYNAMIC_FAST_TURNS[fastMoveName.lowercase()]
                                ?: FAST_MOVE_TURNS[fastMoveName.lowercase()] ?: 2

                            val chargedArr = obj.optJsonArray("chargedMoves")
                            val eliteArr = obj.optJsonArray("eliteMoves")
                            val orderedChargedIds = mutableListOf<String>()
                            rankEntry?.moveset?.drop(1)?.forEach { msId ->
                                if (msId.isNotBlank() && !orderedChargedIds.contains(msId)) {
                                    orderedChargedIds.add(msId)
                                }
                            }
                            rankEntry?.moves?.chargedMoves?.forEach { cm ->
                                if (cm.moveId.isNotBlank() && !orderedChargedIds.contains(cm.moveId)) {
                                    orderedChargedIds.add(cm.moveId)
                                }
                            }
                            if (eliteArr != null) {
                                for (em in eliteArr) {
                                    if (em != null && !em.isJsonNull && em.isJsonPrimitive) {
                                        val emId = em.asString
                                        if (!fastMoveNames.containsKey(emId) && !orderedChargedIds.contains(emId)) {
                                            orderedChargedIds.add(emId)
                                        }
                                    }
                                }
                            }
                            if (chargedArr != null) {
                                for (cm in chargedArr) {
                                    if (cm != null && !cm.isJsonNull && cm.isJsonPrimitive) {
                                        val cmId = cm.asString
                                        if (!orderedChargedIds.contains(cmId)) {
                                            orderedChargedIds.add(cmId)
                                        }
                                    }
                                }
                            }

                            val c1Id = orderedChargedIds.getOrNull(0) ?: "BODY_SLAM"
                            val c2Id = orderedChargedIds.getOrNull(1) ?: c1Id
                            val c3Id = orderedChargedIds.getOrNull(2) ?: ""
                            val c4Id = orderedChargedIds.getOrNull(3) ?: ""
                            val c1Name = formatMoveIdDisplay(c1Id)
                            val c2Name = formatMoveIdDisplay(c2Id)
                            val c3Name = if (c3Id.isNotBlank()) formatMoveIdDisplay(c3Id) else ""
                            val c4Name = if (c4Id.isNotBlank()) formatMoveIdDisplay(c4Id) else ""

                            val baseMeta = PokemonMeta(
                                name = existingStatic?.name ?: speciesName,
                                speciesId = speciesId,
                                baseSpecies = existingStatic?.baseSpecies ?: baseSpecies,
                                formLabel = existingStatic?.formLabel ?: formLabel,
                                types = types,
                                defaultCp = existingStatic?.defaultCp ?: 2500,
                                defaultFastMove = fastMoveName,
                                fastTurns = fastTurns,
                                chargedMove1 = c1Name,
                                chargedMove2 = c2Name,
                                atk = atk,
                                def = def,
                                hp = hp,
                                glRank = existingStatic?.glRank ?: 500,
                                ulRank = existingStatic?.ulRank ?: 500,
                                mlRank = existingStatic?.mlRank ?: 500,
                                chargedMove3 = c3Name,
                                chargedMove4 = c4Name,
                                isRawBaseStats = true,
                                defaultIvsGl = defaultIvsGl,
                                defaultIvsUl = defaultIvsUl
                            )
                            parsedList.add(applyRecommendedMoves(baseMeta))
                        } catch (_: Exception) {}
                    }
                    DYNAMIC_POKEMON_DATABASE.clear()
                    DYNAMIC_POKEMON_DATABASE.addAll(parsedList)
                }
            } catch (_: Exception) {}
        }

        private fun getTypeEffectivenessStatic(moveType: String, defenderTypes: List<String>): Double {
            var multiplier = 1.0
            val atk = moveType.lowercase().trim()
            for (def in defenderTypes.map { it.lowercase().trim() }.filter { it.isNotEmpty() && it != "none" }.distinct()) {
                val eff = when (atk) {
                    "normal" -> when (def) { "rock", "steel" -> 0.625; "ghost" -> 0.390625; else -> 1.0 }
                    "fire" -> when (def) { "grass", "ice", "bug", "steel" -> 1.6; "fire", "water", "rock", "dragon" -> 0.625; else -> 1.0 }
                    "water" -> when (def) { "fire", "ground", "rock" -> 1.6; "water", "grass", "dragon" -> 0.625; else -> 1.0 }
                    "electric" -> when (def) { "water", "flying" -> 1.6; "electric", "grass", "dragon" -> 0.625; "ground" -> 0.390625; else -> 1.0 }
                    "grass" -> when (def) { "water", "ground", "rock" -> 1.6; "fire", "grass", "poison", "flying", "bug", "dragon", "steel" -> 0.625; else -> 1.0 }
                    "ice" -> when (def) { "grass", "ground", "flying", "dragon" -> 1.6; "fire", "water", "ice", "steel" -> 0.625; else -> 1.0 }
                    "fighting" -> when (def) { "normal", "ice", "rock", "dark", "steel" -> 1.6; "poison", "flying", "psychic", "bug", "fairy" -> 0.625; "ghost" -> 0.390625; else -> 1.0 }
                    "poison" -> when (def) { "grass", "fairy" -> 1.6; "poison", "ground", "rock", "ghost" -> 0.625; "steel" -> 0.390625; else -> 1.0 }
                    "ground" -> when (def) { "fire", "electric", "poison", "rock", "steel" -> 1.6; "grass", "bug" -> 0.625; "flying" -> 0.390625; else -> 1.0 }
                    "flying" -> when (def) { "grass", "fighting", "bug" -> 1.6; "electric", "rock", "steel" -> 0.625; else -> 1.0 }
                    "psychic" -> when (def) { "fighting", "poison" -> 1.6; "psychic", "steel" -> 0.625; "dark" -> 0.390625; else -> 1.0 }
                    "bug" -> when (def) { "grass", "psychic", "dark" -> 1.6; "fire", "fighting", "poison", "flying", "ghost", "steel", "fairy" -> 0.625; else -> 1.0 }
                    "rock" -> when (def) { "fire", "ice", "flying", "bug" -> 1.6; "fighting", "ground", "steel" -> 0.625; else -> 1.0 }
                    "ghost" -> when (def) { "psychic", "ghost" -> 1.6; "dark" -> 0.625; "normal" -> 0.390625; else -> 1.0 }
                    "dragon" -> when (def) { "dragon" -> 1.6; "steel" -> 0.625; "fairy" -> 0.390625; else -> 1.0 }
                    "dark" -> when (def) { "psychic", "ghost" -> 1.6; "fighting", "dark", "fairy" -> 0.625; else -> 1.0 }
                    "steel" -> when (def) { "ice", "rock", "fairy" -> 1.6; "fire", "water", "electric", "steel" -> 0.625; else -> 1.0 }
                    "fairy" -> when (def) { "fighting", "dragon", "dark" -> 1.6; "fire", "poison", "steel" -> 0.625; else -> 1.0 }
                    else -> 1.0
                }
                multiplier *= eff
            }
            return multiplier
        }

        private val fastMoveTypeMapStatic = mapOf(
            "dragon breath" to "dragon", "sand attack" to "ground", "quick attack" to "normal",
            "lock-on" to "normal", "water gun" to "water", "lick" to "ghost", "bite" to "dark",
            "tackle" to "normal", "fury cutter" to "bug", "bug bite" to "bug", "scratch" to "normal",
            "psywave" to "psychic", "psycho cut" to "psychic", "mud shot" to "ground",
            "shadow claw" to "ghost", "counter" to "fighting", "powder snow" to "ice",
            "wing attack" to "flying", "peck" to "flying", "poison sting" to "poison",
            "thunder shock" to "electric", "fairy wind" to "fairy", "bullet punch" to "steel",
            "fire fang" to "fire", "vine whip" to "grass", "karate chop" to "fighting",
            "low kick" to "fighting", "ice fang" to "ice", "metal claw" to "steel",
            "sucker punch" to "dark", "poison jab" to "poison", "spark" to "electric",
            "leafage" to "grass", "steel wing" to "steel", "rock throw" to "rock", "ember" to "fire",
            "force palm" to "fighting", "dragon tail" to "dragon", "waterfall" to "water",
            "fire spin" to "fire", "snarl" to "dark", "geomancy" to "fairy", "mud-slap" to "ground",
            "charm" to "fairy", "double kick" to "fighting", "air slash" to "flying",
            "ice shard" to "ice", "bubble" to "water", "rollout" to "rock", "smack down" to "rock",
            "astonish" to "ghost", "hex" to "ghost", "magical leaf" to "grass",
            "bullet seed" to "grass", "water shuriken" to "water", "gust" to "flying",
            "confusion" to "psychic", "volt switch" to "electric", "incinerate" to "fire"
        )

        private fun calculateChargedMoveDamagePctStatic(
            attacker: PokemonMeta,
            defender: PokemonMeta,
            moveName: String,
            isAttackerShadow: Boolean,
            isDefenderShadow: Boolean
        ): Int {
            val moveStats = resolveChargedMoveStatsStatic(moveName, attacker.types.firstOrNull() ?: "normal")
            val stab = if (attacker.types.any { it.equals(moveStats.type, ignoreCase = true) }) 1.2 else 1.0
            val typeEff = getTypeEffectivenessStatic(moveStats.type, defender.types)
            val effectiveAtk = attacker.atk * (if (isAttackerShadow) 1.2 else 1.0)
            val effectiveDef = defender.def * (if (isDefenderShadow) 0.8333333 else 1.0)
            val rawDamage = floor(0.5 * moveStats.power * (effectiveAtk / effectiveDef) * stab * typeEff * 1.3) + 1.0
            return ((rawDamage / defender.hp.toDouble()) * 100.0).roundToInt().coerceIn(5, 100)
        }

        fun calculate1v1And2v2RatingsStatic(
            myName: String,
            oppName: String,
            league: String,
            myFastMove: String? = null,
            myCharged1: String? = null,
            myCharged2: String? = null,
            myCp: Int? = null,
            myIvs: String? = null
        ): Pair<Int, Int> {
            val myShadow = myName.trim().startsWith("Shadow ", ignoreCase = true) || myName.contains("(Shadow)", ignoreCase = true)
            val oppShadow = oppName.trim().startsWith("Shadow ", ignoreCase = true) || oppName.contains("(Shadow)", ignoreCase = true)

            val myMeta = resolveRecommendedMovesForSpecies(myName, league, myCp, myIvs)
                ?: POKEMON_META_DATABASE.first().let { computeEffectiveCombatStats(it, league, myCp, myIvs) }
            val oppMeta = resolveRecommendedMovesForSpecies(oppName, league)
                ?: POKEMON_META_DATABASE.first().let { computeEffectiveCombatStats(it, league) }

            val uFast = myFastMove?.takeIf { it.isNotBlank() } ?: myMeta.defaultFastMove
            val uC1 = myCharged1?.takeIf { it.isNotBlank() } ?: myMeta.chargedMove1
            val uC2 = myCharged2?.takeIf { it.isNotBlank() } ?: myMeta.chargedMove2

            val userC1Pct = calculateChargedMoveDamagePctStatic(myMeta, oppMeta, uC1, myShadow, oppShadow)
            val userC2Pct = calculateChargedMoveDamagePctStatic(myMeta, oppMeta, uC2, myShadow, oppShadow)
            val bestUserCharged = max(userC1Pct, userC2Pct)
            val minUserCharged = min(userC1Pct, userC2Pct)

            val oppC1Pct = calculateChargedMoveDamagePctStatic(oppMeta, myMeta, oppMeta.chargedMove1, oppShadow, myShadow)
            val oppC2Pct = calculateChargedMoveDamagePctStatic(oppMeta, myMeta, oppMeta.chargedMove2, oppShadow, myShadow)
            val bestOppCharged = max(oppC1Pct, oppC2Pct)
            val minOppCharged = min(oppC1Pct, oppC2Pct)

            val userFastType = DYNAMIC_FAST_TYPE[uFast.lowercase()] ?: fastMoveTypeMapStatic[uFast.lowercase()] ?: myMeta.types.firstOrNull() ?: "normal"
            val oppFastType = DYNAMIC_FAST_TYPE[oppMeta.defaultFastMove.lowercase()] ?: fastMoveTypeMapStatic[oppMeta.defaultFastMove.lowercase()] ?: oppMeta.types.firstOrNull() ?: "normal"
            val userFastEff = getTypeEffectivenessStatic(userFastType, oppMeta.types)
            val oppFastEff = getTypeEffectivenessStatic(oppFastType, myMeta.types)

            val shadowBulkDelta = (if (myShadow) -12 else 0) + (if (oppShadow) 12 else 0)
            val rating1s = (500.0 + ((bestUserCharged + minUserCharged) * 0.5 - (bestOppCharged + minOppCharged) * 0.5) * 2.8 + (userFastEff - oppFastEff) * 120.0 + shadowBulkDelta).roundToInt().coerceIn(150, 850)
            val rating2s = (500.0 + (minUserCharged - minOppCharged) * 2.0 + (userFastEff - oppFastEff) * 155.0 + shadowBulkDelta * 2).roundToInt().coerceIn(150, 850)
            return rating1s to rating2s
        }

        fun calculateAutoLeadMatchupStatic(
            myLead: String,
            oppLead: String,
            league: String,
            myFastMove: String? = null,
            myCharged1: String? = null,
            myCharged2: String? = null,
            myCp: Int? = null,
            myIvs: String? = null
        ): String {
            if (myLead.isBlank() || oppLead.isBlank()) return "NEUTRAL"
            val (rating1s, _) = calculate1v1And2v2RatingsStatic(
                myName = myLead,
                oppName = oppLead,
                league = league,
                myFastMove = myFastMove,
                myCharged1 = myCharged1,
                myCharged2 = myCharged2,
                myCp = myCp,
                myIvs = myIvs
            )
            return when {
                rating1s >= 530 -> "FAVORABLE"
                rating1s <= 470 -> "NEGATIVE"
                else -> "NEUTRAL"
            }
        }

        fun getTopMetaPoolForLeagueStatic(league: String): List<String> {
            val isGreat = league.contains("GREAT", ignoreCase = true)
            val isUltra = league.contains("ULTRA", ignoreCase = true)
            val sorted = getAllPokemonMeta()
                .filter { !it.speciesId.endsWith("_shadow", ignoreCase = true) && !it.name.startsWith("Shadow ", ignoreCase = true) }
                .sortedBy {
                    when {
                        isGreat -> it.glRank
                        isUltra -> it.ulRank
                        else -> it.mlRank
                    }
                }
                .take(18)
                .map { it.name }
            return if (sorted.isNotEmpty()) sorted else listOf("Azumarill", "Clodsire", "Annihilape", "Feraligatr", "Mandibuzz", "Gastrodon")
        }

        /**
         * Mathematical Model & Calculation Pipeline for Battle Quality & Wins Above Expected (WAE):
         * - Rule 1: If firstSwap (2nd opponent) is missing -> returns null (weight = 0).
         *           If finalSeen (3rd opponent) is missing -> Meta-Average Prior with confidence weight w = 0.75.
         *           If all 3 opponents are seen -> Standard evaluation with confidence weight w = 1.0.
         * - Rule 2: S_lead = 0.50 * Rating_1v1(myLead, oppLead) + 0.50 * Rating_2v2(myLead, oppLead)
         * - Rule 3: S_back = 0.70 * max(Score_A, Score_B) + 0.30 * min(Score_A, Score_B)
         * - Rule 4: M = 0.40 * S_lead + 0.60 * S_back; P_win = 1 / (1 + exp(-0.006 * (M - 500)))
         * - Rule 5: deltaQ = Result - P_win; weightedResidual = w * deltaQ
         * - Rule 6: Badge categorization (Clutch Win, Skill Win, Expected Win, Blunder Loss, Tough Loss, Expected Loss)
         */
        fun calculateBattleQuality(
            myTeam: List<String>,
            oppTeam: List<String>,
            league: String,
            result: String = "WIN",
            myTeamSlots: List<TeamMember>? = null,
            metaPool: List<String>? = null
        ): BattleQualityMetadata? {
            val oppLead = oppTeam.getOrNull(0)?.trim().orEmpty()
            val oppSwap = oppTeam.getOrNull(1)?.trim().orEmpty()
            val oppClose = oppTeam.getOrNull(2)?.trim().orEmpty()

            // 1. Incomplete Match Rules: If oppTeam.firstSwap is null/missing -> discard entirely (weight = 0)
            if (oppLead.isEmpty() || oppSwap.isEmpty()) {
                return null
            }

            val fallbackMons = getTopMetaPoolForLeagueStatic(league).take(3)
            val myLead = myTeam.getOrNull(0)?.trim()?.takeIf { it.isNotEmpty() } ?: fallbackMons.getOrElse(0) { "Azumarill" }
            val mySwap = myTeam.getOrNull(1)?.trim()?.takeIf { it.isNotEmpty() } ?: fallbackMons.getOrElse(1) { "Clodsire" }
            val myClose = myTeam.getOrNull(2)?.trim()?.takeIf { it.isNotEmpty() } ?: fallbackMons.getOrElse(2) { "Feraligatr" }

            val slot0 = myTeamSlots?.getOrNull(0)
            val slot1 = myTeamSlots?.getOrNull(1)
            val slot2 = myTeamSlots?.getOrNull(2)

            val unrevealedThird = oppClose.isEmpty()
            val weight = if (unrevealedThird) 0.75 else 1.0

            // 2. Lead Score (S_lead): 50% 1v1 + 50% 2v2
            val (lead1v1, lead2v2) = calculate1v1And2v2RatingsStatic(
                myLead, oppLead, league, slot0?.fastMove, slot0?.chargedMove1, slot0?.chargedMove2, slot0?.cp, slot0?.ivs
            )
            val sLead = 0.50 * lead1v1.toDouble() + 0.50 * lead2v2.toDouble()

            // 3. Backline Score (S_back)
            val scoreA: Double
            val scoreB: Double
            if (!unrevealedThird) {
                val rSwapVsOppSwap = calculate1v1And2v2RatingsStatic(
                    mySwap, oppSwap, league, slot1?.fastMove, slot1?.chargedMove1, slot1?.chargedMove2, slot1?.cp, slot1?.ivs
                ).first.toDouble()
                val rCloseVsOppClose = calculate1v1And2v2RatingsStatic(
                    myClose, oppClose, league, slot2?.fastMove, slot2?.chargedMove1, slot2?.chargedMove2, slot2?.cp, slot2?.ivs
                ).first.toDouble()
                val rSwapVsOppClose = calculate1v1And2v2RatingsStatic(
                    mySwap, oppClose, league, slot1?.fastMove, slot1?.chargedMove1, slot1?.chargedMove2, slot1?.cp, slot1?.ivs
                ).first.toDouble()
                val rCloseVsOppSwap = calculate1v1And2v2RatingsStatic(
                    myClose, oppSwap, league, slot2?.fastMove, slot2?.chargedMove1, slot2?.chargedMove2, slot2?.cp, slot2?.ivs
                ).first.toDouble()

                scoreA = (rSwapVsOppSwap + rCloseVsOppClose) / 2.0
                scoreB = (rSwapVsOppClose + rCloseVsOppSwap) / 2.0
            } else {
                val activeMetaPool = metaPool?.takeIf { it.isNotEmpty() } ?: getTopMetaPoolForLeagueStatic(league)
                val rBarSwap = if (activeMetaPool.isNotEmpty()) {
                    activeMetaPool.map { m ->
                        calculate1v1And2v2RatingsStatic(
                            mySwap, m, league, slot1?.fastMove, slot1?.chargedMove1, slot1?.chargedMove2, slot1?.cp, slot1?.ivs
                        ).first.toDouble()
                    }.average()
                } else 500.0
                val rBarClose = if (activeMetaPool.isNotEmpty()) {
                    activeMetaPool.map { m ->
                        calculate1v1And2v2RatingsStatic(
                            myClose, m, league, slot2?.fastMove, slot2?.chargedMove1, slot2?.chargedMove2, slot2?.cp, slot2?.ivs
                        ).first.toDouble()
                    }.average()
                } else 500.0

                val rSwapVsOppSwap = calculate1v1And2v2RatingsStatic(
                    mySwap, oppSwap, league, slot1?.fastMove, slot1?.chargedMove1, slot1?.chargedMove2, slot1?.cp, slot1?.ivs
                ).first.toDouble()
                val rCloseVsOppSwap = calculate1v1And2v2RatingsStatic(
                    myClose, oppSwap, league, slot2?.fastMove, slot2?.chargedMove1, slot2?.chargedMove2, slot2?.cp, slot2?.ivs
                ).first.toDouble()

                scoreA = (rSwapVsOppSwap + rBarClose) / 2.0
                scoreB = (rCloseVsOppSwap + rBarSwap) / 2.0
            }

            val sBack = 0.70 * max(scoreA, scoreB) + 0.30 * min(scoreA, scoreB)

            // 4. Composite Score & Expected Win Probability (P_win)
            val mScore = 0.40 * sLead + 0.60 * sBack
            val pWin = 1.0 / (1.0 + kotlin.math.exp(-0.006 * (mScore - 500.0)))

            // 5. Residual Quality Delta (deltaQ)
            val isWin = result.equals("WIN", ignoreCase = true)
            val numericResult = if (isWin) 1.0 else 0.0
            val deltaQ = numericResult - pWin
            val weightedResidual = weight * deltaQ

            // 6. Badge Categorization
            val (badgeLabel, badgeColorHex) = if (isWin) {
                when {
                    pWin < 0.40 -> "Clutch Win" to "#22d3ee"
                    pWin <= 0.60 -> "Skill Win" to "#4ade80"
                    else -> "Expected Win" to "#94a3b8"
                }
            } else {
                when {
                    pWin > 0.60 -> "Blunder Loss" to "#f43f5e"
                    pWin >= 0.40 -> "Tough Loss" to "#fb923c"
                    else -> "Expected Loss" to "#94a3b8"
                }
            }

            return BattleQualityMetadata(
                pWin = (pWin * 10000.0).roundToInt() / 10000.0,
                expWinPct = (pWin * 100.0).roundToInt(),
                deltaQ = (deltaQ * 10000.0).roundToInt() / 10000.0,
                weight = weight,
                weightedResidual = (weightedResidual * 10000.0).roundToInt() / 10000.0,
                badgeLabel = badgeLabel,
                badgeColorHex = badgeColorHex,
                unrevealedThird = unrevealedThird,
                sLead = (sLead * 10.0).roundToInt() / 10.0,
                sBack = (sBack * 10.0).roundToInt() / 10.0,
                compositeScore = (mScore * 10.0).roundToInt() / 10.0
            )
        }

        fun calculateAggregateWAEStatic(qualities: List<BattleQualityMetadata?>): AggregateWAEResult {
            var weightedSum = 0.0
            var totalWeight = 0.0
            var rankedCount = 0

            for (q in qualities) {
                if (q == null || q.weight <= 0.0) continue
                weightedSum += q.weight * q.deltaQ
                totalWeight += q.weight
                rankedCount++
            }

            if (totalWeight <= 0.0 || rankedCount == 0) {
                return AggregateWAEResult(
                    waePct = 0.0,
                    formatted = "—%",
                    isPositive = true,
                    rankedCount = 0,
                    totalWeight = 0.0
                )
            }

            val rawPct = (weightedSum / totalWeight) * 100.0
            val rounded = (rawPct * 10.0).roundToInt() / 10.0
            val isPositive = rounded >= 0.0
            val sign = if (rounded >= 0.0) "+" else "-"
            val formatted = String.format(java.util.Locale.US, "%s%.1f%%", sign, kotlin.math.abs(rounded))

            return AggregateWAEResult(
                waePct = rounded,
                formatted = formatted,
                isPositive = isPositive,
                rankedCount = rankedCount,
                totalWeight = totalWeight
            )
        }
    }

    private lateinit var windowManager: WindowManager
    private var overlayView: WebView? = null
    private lateinit var layoutParams: WindowManager.LayoutParams
    private lateinit var prefs: SharedPreferences
    private val gson = Gson()

    private var mediaProjectionManager: MediaProjectionManager? = null
    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private var imageReaderThread: HandlerThread? = null
    private var imageReaderHandler: Handler? = null

    private var screenWidth = 1080
    private var screenHeight = 2400
    private var screenDensity = 2

    private val textRecognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
    private var battleLoopJob: Job? = null

    private var currentPreset: TeamPreset? = null
    private var activeOpponentName: String = "Waiting..."
    private var activeOpponentSpecies: String = ""
    private var isOpponentShadow: Boolean = false
    private var availableOpponentForms: List<PokemonMeta> = emptyList()
    private var currentFormIndex: Int = 0

    private var activeUserPokemonName: String? = null
    private val detectedOpponents = mutableListOf<String>()
    private val manualFormOverrides = mutableMapOf<String, String>()
    private val manualShadowOverrides = mutableMapOf<String, Boolean>()
    private var isWaitingForOpponent = true
    private var isBattleActive = false
    private var manualLeadMatchupOverride: String? = null
    private var currentLeadMatchup: String = "NEUTRAL"
    private var lastClearedOpponentsSnapshot: List<String> = emptyList()
    private var lastClearedLeadMatchupSnapshot: String = "NEUTRAL"
    @Volatile private var battleResetEpoch: Long = 0L
    @Volatile private var lastBattleResetTimeMs: Long = 0L

    private var currentLayoutMode = "option1"
    private var oppCountMode = "my_fasts"
    private var enable4ChargedMoves = false
    private var disableBattleToasts = false
    private var overlayScalePct = 78
    private var overlayTransparencyPct = 72
    private var isOverlayMinimized = false
    private var cachedScreenBitmap: Bitmap? = null
    private val captureLock = Any()

    // v2.33: Independent 50s Swap Countdown Timers, Shield vs. Pokéball Isolation & Faint State Machine
    private var playerSwapEndTimeMs: Long = 0L
    private var oppSwapEndTimeMs: Long = 0L
    private var playerPokeballCount: Int = 3
    private var oppPokeballCount: Int = 3
    private var playerShieldsRemaining: Int = 2
    private var oppShieldsRemaining: Int = 2
    private val playerFaintedSlots = BooleanArray(3) { false }
    private val oppFaintedSlots = BooleanArray(3) { false }
    private var prevFrameTimestampMs: Long = 0L
    private var currentFrameTimestampMs: Long = 0L
    private var isPlayerTurnOne: Boolean = true
    private var isOppTurnOne: Boolean = true
    private var sampledPlayerBalls: Int = 3
    private var sampledOppBalls: Int = 3
    private var sampledPlayerShields: Int = 2
    private var sampledOppShields: Int = 2

    data class BattleQualityMetadata(
        val pWin: Double,
        val expWinPct: Int,
        val deltaQ: Double,
        val weight: Double,
        val weightedResidual: Double,
        val badgeLabel: String,
        val badgeColorHex: String,
        val unrevealedThird: Boolean,
        val sLead: Double,
        val sBack: Double,
        val compositeScore: Double
    )

    data class AggregateWAEResult(
        val waePct: Double,
        val formatted: String,
        val isPositive: Boolean,
        val rankedCount: Int,
        val totalWeight: Double
    )

    data class TeamMember(
        val name: String,
        val cp: Int,
        val fastMove: String,
        val chargedMove1: String,
        val chargedMove2: String,
        val ivs: String? = null
    )
    data class TeamPreset(
        val id: String,
        val name: String,
        val league: String,
        val pokemon: List<TeamMember>,
        var isSelected: Boolean = false,
        val updatedAt: Long = System.currentTimeMillis()
    )

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        prefs = getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)
        oppCountMode = prefs.getString("opp_count_mode", "my_fasts") ?: "my_fasts"
        enable4ChargedMoves = prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, false)
        disableBattleToasts = prefs.getBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, false)
        overlayScalePct = prefs.getInt("overlay_scale_pct", 78).coerceIn(50, 100)
        overlayTransparencyPct = prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, 72).coerceIn(0, 100)

        val metrics = resources.displayMetrics
        screenWidth = metrics.widthPixels
        screenHeight = metrics.heightPixels
        screenDensity = metrics.densityDpi

        imageReaderThread = HandlerThread("GBLImageReaderThread").apply { start() }
        imageReaderHandler = Handler(imageReaderThread!!.looper)

        createNotificationChannel()
        setupDefaultPresetsIfNeeded()
        loadCachedRankingsSynchronously()
        loadOrFetchGamemasterInBackground()
        setupOverlayView()
        startBattleOcrLoop()
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val (ok, _) = syncWithGitHubGistBlocking(prefs, gson)
                if (ok) {
                    withContext(Dispatchers.Main) {
                        setupDefaultPresetsIfNeeded()
                        loadInitialDataIntoOverlay()
                    }
                }
            } catch (_: Exception) {}
        }
    }

    private fun showBattleToast(message: String, duration: Int = Toast.LENGTH_SHORT) {
        if (disableBattleToasts) return
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(this, message, duration).show()
        }
    }

    private fun loadCachedRankingsSynchronously() {
        try {
            val rankingTargets = listOf(
                Pair("GREAT LEAGUE", "pvpoke_rankings_gl.json"),
                Pair("ULTRA LEAGUE", "pvpoke_rankings_ul.json"),
                Pair("MASTER LEAGUE", "pvpoke_rankings_ml.json"),
                Pair("MEGA MASTER LEAGUE", "pvpoke_rankings_mega_ml.json")
            )
            for ((leagueKey, fileName) in rankingTargets) {
                if (LIVE_RANKINGS_MAP[leagueKey].isNullOrEmpty()) {
                    val rFile = File(filesDir, fileName)
                    if (rFile.exists() && rFile.length() > 200) {
                        parseRankingsJsonStatic(leagueKey, rFile.readText())
                    }
                }
            }
            if (DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                val mainCache = File(filesDir, "pvpoke_gamemaster.json")
                val cacheFile = if (mainCache.exists() && mainCache.length() > 1000) mainCache else File(filesDir, "pvpoke_gamemaster_cache.json")
                if (cacheFile.exists() && cacheFile.length() > 1000) {
                    parseGamemasterJsonStatic(cacheFile.readText())
                }
            }
        } catch (_: Exception) {}
    }

    private fun loadOrFetchGamemasterInBackground() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val client = OkHttpClient()
                val rankingTargets = listOf(
                    Triple("GREAT LEAGUE", "pvpoke_rankings_gl.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json"),
                    Triple("ULTRA LEAGUE", "pvpoke_rankings_ul.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-2500.json"),
                    Triple("MASTER LEAGUE", "pvpoke_rankings_ml.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-10000.json"),
                    Triple("MEGA MASTER LEAGUE", "pvpoke_rankings_mega_ml.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/mega/overall/rankings-10000.json")
                )

                var didDownloadAny = false
                for ((leagueKey, fileName, url) in rankingTargets) {
                    try {
                        val rFile = File(filesDir, fileName)
                        val rJson = if (rFile.exists() && rFile.length() > 200) {
                            rFile.readText()
                        } else {
                            val req = Request.Builder().url(url).build()
                            client.newCall(req).execute().use { resp ->
                                val body = resp.body?.string()
                                if (resp.isSuccessful && !body.isNullOrBlank()) {
                                    rFile.writeText(body)
                                    didDownloadAny = true
                                    body
                                } else null
                            }
                        }
                        if (!rJson.isNullOrBlank()) {
                            parseRankingsJsonStatic(leagueKey, rJson)
                        }
                    } catch (_: Exception) {}
                }

                val mainCache = File(filesDir, "pvpoke_gamemaster.json")
                val cacheFile = if (mainCache.exists() && mainCache.length() > 1000) mainCache else File(filesDir, "pvpoke_gamemaster_cache.json")
                val jsonStr = if (cacheFile.exists() && cacheFile.length() > 1000) {
                    cacheFile.readText()
                } else {
                    val req = Request.Builder()
                        .url("https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json")
                        .build()
                    client.newCall(req).execute().use { resp ->
                        val body = resp.body?.string()
                        if (resp.isSuccessful && !body.isNullOrBlank()) {
                            cacheFile.writeText(body)
                            didDownloadAny = true
                            body
                        } else null
                    }
                }
                if (!jsonStr.isNullOrBlank()) {
                    parseGamemasterJson(jsonStr)
                }
                if (didDownloadAny || prefs.getLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, 0L) == 0L) {
                    prefs.edit().putLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, System.currentTimeMillis()).apply()
                }
                withContext(Dispatchers.Main) {
                    recalculateAndPushBattleData()
                }
            } catch (_: Exception) {}
        }
    }

    private fun parseGamemasterJson(jsonStr: String) {
        parseGamemasterJsonStatic(jsonStr)
    }

    private fun setupDefaultPresetsIfNeeded() {
        val existing = loadPresets()
        if (existing.isEmpty()) {
            val defaults = listOf(
                TeamPreset(
                    "preset-ml-1", "Master: Palkia-O / Zacian-C / Dialga-O", "MASTER LEAGUE", listOf(
                        TeamMember("Palkia (Origin)", 4683, "Dragon Breath", "Spacial Rend", "Aqua Tail"),
                        TeamMember("Zacian (Crowned)", 4658, "Metal Claw", "Behemoth Blade", "Close Combat"),
                        TeamMember("Dialga (Origin)", 4624, "Dragon Breath", "Roar of Time", "Iron Head")
                    ), true
                ),
                TeamPreset(
                    "preset-ul-1", "Ultra: Zygarde / Feraligatr / Giratina-A", "ULTRA LEAGUE", listOf(
                        TeamMember("Zygarde", 2472, "Dragon Tail", "Crunch", "Earthquake"),
                        TeamMember("Feraligatr", 2488, "Shadow Claw", "Hydro Cannon", "Ice Beam"),
                        TeamMember("Giratina (Altered)", 2497, "Shadow Claw", "Dragon Claw", "Ancient Power")
                    ), false
                ),
                TeamPreset(
                    "preset-gl-1", "Great: Clodsire / Feraligatr / Mandibuzz", "GREAT LEAGUE", listOf(
                        TeamMember("Clodsire", 1494, "Poison Sting", "Earthquake", "Stone Edge"),
                        TeamMember("Feraligatr", 1498, "Shadow Claw", "Hydro Cannon", "Ice Beam"),
                        TeamMember("Mandibuzz", 1496, "Snarl", "Dark Pulse", "Aerial Ace")
                    ), false
                )
            )
            val json = gson.toJson(defaults)
            prefs.edit().putString(PREFS_KEY_PERSISTENT_TEAMS, json).apply()
            currentPreset = defaults[0]
            activeUserPokemonName = defaults[0].pokemon[0].name
        } else {
            val selectedId = prefs.getString("gbl_selected_preset_id", existing[0].id)
            currentPreset = existing.find { it.id == selectedId } ?: existing[0]
            activeUserPokemonName = currentPreset?.pokemon?.getOrNull(0)?.name
        }
    }

    @SuppressLint("SetJavaScriptEnabled", "ClickableViewAccessibility")
    private fun setupOverlayView() {
        overlayView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            setBackgroundColor(0x00000000)
            setLayerType(WebView.LAYER_TYPE_HARDWARE, null)
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    loadInitialDataIntoOverlay()
                }
            }
            addJavascriptInterface(AndroidBridge(), "AndroidOverlay")
            loadUrl("file:///android_asset/overlay.html")
        }

        val density = resources.displayMetrics.density

        layoutParams = WindowManager.LayoutParams().apply {
            type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            }
            flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED

            format = PixelFormat.TRANSLUCENT
            gravity = Gravity.TOP or Gravity.START
            x = (8 * density).toInt()
            y = (142 * density).toInt()
            width = (screenWidth * (overlayScalePct.coerceIn(50, 100) / 100f)).toInt()
            height = WindowManager.LayoutParams.WRAP_CONTENT
        }

        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var isDraggingTouch = false

        overlayView?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = layoutParams.x
                    initialY = layoutParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isDraggingTouch = false
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaX = (event.rawX - initialTouchX).toInt()
                    val deltaY = (event.rawY - initialTouchY).toInt()
                    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                        isDraggingTouch = true
                        val maxYOffset = if (isOverlayMinimized) screenHeight - (56 * density).toInt() else screenHeight - 200
                        layoutParams.x = max(0, min(initialX + deltaX, max(0, screenWidth - layoutParams.width)))
                        layoutParams.y = max(16, min(initialY + deltaY, max(16, maxYOffset)))
                        try {
                            windowManager.updateViewLayout(overlayView, layoutParams)
                        } catch (_: Exception) {}
                        true
                    } else false
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (isDraggingTouch) {
                        isDraggingTouch = false
                        true
                    } else {
                        false
                    }
                }
                else -> false
            }
        }

        try {
            windowManager.addView(overlayView, layoutParams)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun applyOverlayScale(scalePct: Int) {
        overlayScalePct = scalePct.coerceIn(50, 100)
        if (!::layoutParams.isInitialized) return
        if (!isOverlayMinimized) {
            val targetWidth = (screenWidth * (overlayScalePct / 100f)).toInt()
            layoutParams.width = targetWidth
            layoutParams.x = max(0, min(layoutParams.x, max(0, screenWidth - targetWidth)))
        }
        Handler(Looper.getMainLooper()).post {
            try {
                if (overlayView != null) {
                    if (!isOverlayMinimized) {
                        windowManager.updateViewLayout(overlayView, layoutParams)
                    }
                    overlayView?.evaluateJavascript("if (window.setOverlayScalePct) setOverlayScalePct($overlayScalePct);", null)
                }
            } catch (_: Exception) {}
        }
    }

    private fun applyOverlayTransparency(transparencyPct: Int) {
        overlayTransparencyPct = transparencyPct.coerceIn(0, 100)
        Handler(Looper.getMainLooper()).post {
            try {
                overlayView?.evaluateJavascript(
                    "if (window.setOverlayTransparencyPct) setOverlayTransparencyPct($overlayTransparencyPct);",
                    null
                )
            } catch (_: Exception) {}
        }
    }

    private fun stopBattleOcrLoop() {
        battleLoopJob?.cancel()
        battleLoopJob = null
    }

    private fun minimizeOverlayToBubble() {
        if (isOverlayMinimized) return
        isOverlayMinimized = true
        stopBattleOcrLoop()
        val density = resources.displayMetrics.density
        val bubbleSize = (48 * density).toInt()
        if (::layoutParams.isInitialized) {
            layoutParams.width = bubbleSize
            layoutParams.height = bubbleSize
            layoutParams.x = max(0, min(layoutParams.x, max(0, screenWidth - bubbleSize)))
            layoutParams.y = max(16, min(layoutParams.y, max(16, screenHeight - bubbleSize - 24)))
            try {
                if (overlayView != null) {
                    windowManager.updateViewLayout(overlayView, layoutParams)
                }
            } catch (_: Exception) {}
        }
        overlayView?.evaluateJavascript("if (window.setOverlayMinimizedState) setOverlayMinimizedState(true);", null)
        startForegroundNotification()
        Toast.makeText(this, "Overlay minimized (OCR paused). Tap bubble to resume.", Toast.LENGTH_SHORT).show()
    }

    private fun restoreOverlayFromBubble() {
        if (!isOverlayMinimized) return
        isOverlayMinimized = false
        if (::layoutParams.isInitialized) {
            val targetWidth = (screenWidth * (overlayScalePct.coerceIn(50, 100) / 100f)).toInt()
            layoutParams.width = targetWidth
            layoutParams.height = WindowManager.LayoutParams.WRAP_CONTENT
            layoutParams.x = max(0, min(layoutParams.x, max(0, screenWidth - targetWidth)))
            try {
                if (overlayView != null) {
                    windowManager.updateViewLayout(overlayView, layoutParams)
                }
            } catch (_: Exception) {}
        }
        overlayView?.evaluateJavascript("if (window.setOverlayMinimizedState) setOverlayMinimizedState(false);", null)
        if (mediaProjection != null) {
            startBattleOcrLoop()
        }
        recalculateAndPushBattleData()
        startForegroundNotification()
        Toast.makeText(this, "⚔️ Overlay restored & OCR resumed", Toast.LENGTH_SHORT).show()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        val action = intent?.action ?: ACTION_START_OVERLAY

        when (action) {
            ACTION_START_OVERLAY -> {
                isOverlayMinimized = false
                startForegroundNotification()
                intent?.getStringExtra(EXTRA_OPP_COUNT_MODE)?.let { mode ->
                    if (mode == "opp_fasts" || mode == "my_fasts") {
                        oppCountMode = mode
                    }
                } ?: run {
                    oppCountMode = prefs.getString("opp_count_mode", "my_fasts") ?: "my_fasts"
                }
                val startScalePct = intent?.getIntExtra(
                    EXTRA_OVERLAY_SCALE_PCT,
                    prefs.getInt("overlay_scale_pct", 78)
                ) ?: prefs.getInt("overlay_scale_pct", 78)
                applyOverlayScale(startScalePct)

                val startTransparencyPct = intent?.getIntExtra(
                    EXTRA_OVERLAY_TRANSPARENCY_PCT,
                    prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, 72)
                ) ?: prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, 72)
                applyOverlayTransparency(startTransparencyPct)

                enable4ChargedMoves = if (intent?.hasExtra(EXTRA_ENABLE_4_CHARGED_MOVES) == true) {
                    intent.getBooleanExtra(EXTRA_ENABLE_4_CHARGED_MOVES, false)
                } else {
                    prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, enable4ChargedMoves)
                }

                disableBattleToasts = if (intent?.hasExtra(EXTRA_DISABLE_BATTLE_TOASTS) == true) {
                    intent.getBooleanExtra(EXTRA_DISABLE_BATTLE_TOASTS, false)
                } else {
                    prefs.getBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, disableBattleToasts)
                }
                overlayView?.evaluateJavascript("if (window.setDisableBattleToasts) setDisableBattleToasts($disableBattleToasts);", null)

                intent?.getStringExtra(EXTRA_PRESET_JSON)?.let { presetJson ->
                    try {
                        val incoming = gson.fromJson(presetJson, TeamPreset::class.java)
                        if (incoming != null && incoming.pokemon.isNotEmpty()) {
                            currentPreset = incoming
                            activeUserPokemonName = incoming.pokemon.first().name
                        }
                    } catch (_: Exception) {}
                }
                val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, 0) ?: 0
                val resultData = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent?.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent?.getParcelableExtra(EXTRA_RESULT_DATA)
                }

                if (!areAllFourLeaguesLoaded() || DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                    loadCachedRankingsSynchronously()
                    if (!areAllFourLeaguesLoaded() || DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                        loadOrFetchGamemasterInBackground()
                    }
                }
                if (resultCode != 0 && resultData != null) {
                    initMediaProjection(resultCode, resultData)
                    startBattleOcrLoop()
                } else if (mediaProjection != null) {
                    startBattleOcrLoop()
                }
                recalculateAndPushBattleData()
            }
            ACTION_UPDATE_PRESET -> {
                intent?.getStringExtra(EXTRA_PRESET_JSON)?.let { presetJson ->
                    try {
                        val incoming = gson.fromJson(presetJson, TeamPreset::class.java)
                        if (incoming != null && incoming.pokemon.isNotEmpty()) {
                            currentPreset = incoming
                            activeUserPokemonName = incoming.pokemon.first().name
                            loadInitialDataIntoOverlay()
                        }
                    } catch (_: Exception) {}
                }
            }
            ACTION_UPDATE_SETTINGS -> {
                if (intent?.hasExtra(EXTRA_OPP_COUNT_MODE) == true) {
                    val newMode = intent.getStringExtra(EXTRA_OPP_COUNT_MODE) ?: "my_fasts"
                    oppCountMode = if (newMode == "opp_fasts") "opp_fasts" else "my_fasts"
                } else {
                    oppCountMode = prefs.getString("opp_count_mode", oppCountMode) ?: oppCountMode
                }
                if (intent?.hasExtra(EXTRA_ENABLE_4_CHARGED_MOVES) == true) {
                    enable4ChargedMoves = intent.getBooleanExtra(EXTRA_ENABLE_4_CHARGED_MOVES, false)
                } else {
                    enable4ChargedMoves = prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, enable4ChargedMoves)
                }
                if (intent?.hasExtra(EXTRA_DISABLE_BATTLE_TOASTS) == true) {
                    disableBattleToasts = intent.getBooleanExtra(EXTRA_DISABLE_BATTLE_TOASTS, false)
                } else {
                    disableBattleToasts = prefs.getBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, disableBattleToasts)
                }
                overlayView?.evaluateJavascript("if (window.setDisableBattleToasts) setDisableBattleToasts($disableBattleToasts);", null)
                val updatedScalePct = intent?.getIntExtra(
                    EXTRA_OVERLAY_SCALE_PCT,
                    prefs.getInt("overlay_scale_pct", overlayScalePct)
                ) ?: prefs.getInt("overlay_scale_pct", overlayScalePct)
                applyOverlayScale(updatedScalePct)

                val updatedTransparencyPct = intent?.getIntExtra(
                    EXTRA_OVERLAY_TRANSPARENCY_PCT,
                    prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, overlayTransparencyPct)
                ) ?: prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, overlayTransparencyPct)
                applyOverlayTransparency(updatedTransparencyPct)

                recalculateAndPushBattleData()
            }
            ACTION_START_BATTLE -> startNewBattle()
            ACTION_TOGGLE_LAYOUT -> toggleLayoutMode()
            ACTION_STOP_OVERLAY -> stopSelf()
        }

        return START_STICKY
    }

    private fun startForegroundNotification() {
        val notificationIntent = Intent(this, OverlayService::class.java).apply {
            action = ACTION_STOP_OVERLAY
        }
        val pendingIntent = PendingIntent.getService(
            this, 0, notificationIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val statusText = if (isOverlayMinimized) {
            "Overlay minimized (OCR paused) — Tap bubble to resume"
        } else {
            "Live OCR monitoring opponent & player switches..."
        }

        val notification: Notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("SilphScope PvP Overlay Active")
            .setContentText(statusText)
            .setSmallIcon(android.R.drawable.ic_menu_compass)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Overlay", pendingIntent)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "SilphScope PvP Overlay Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows live GBL turn alignment & opponent counter HUD"
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun applyLayoutMode(mode: String) {
        currentLayoutMode = mode
        val density = resources.displayMetrics.density
        if (mode == "option2") {
            layoutParams.gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            layoutParams.x = 0
            layoutParams.y = (16 * density).toInt()
            layoutParams.width = min((screenWidth * 0.88f).toInt(), (340 * density).toInt())
            layoutParams.height = WindowManager.LayoutParams.WRAP_CONTENT
        } else {
            layoutParams.gravity = Gravity.TOP or Gravity.START
            layoutParams.x = (8 * density).toInt()
            layoutParams.y = (135 * density).toInt()
            layoutParams.width = min((screenWidth * 0.78f).toInt(), (310 * density).toInt())
            layoutParams.height = WindowManager.LayoutParams.WRAP_CONTENT
        }
        try {
            windowManager.updateViewLayout(overlayView, layoutParams)
        } catch (_: Exception) {}

        Handler(Looper.getMainLooper()).post {
            overlayView?.evaluateJavascript("setLayoutMode('$mode')", null)
        }
    }

    private fun toggleLayoutMode() {
        val nextMode = if (currentLayoutMode == "option1") "option2" else "option1"
        applyLayoutMode(nextMode)
    }

    @SuppressLint("WrongConstant")
    private fun initMediaProjection(resultCode: Int, data: Intent) {
        try {
            virtualDisplay?.release()
            imageReader?.close()
            mediaProjection?.stop()

            mediaProjection = mediaProjectionManager?.getMediaProjection(resultCode, data)

            // CRITICAL FOR ANDROID 14+ (API 34+): Must register callback before createVirtualDisplay
            mediaProjection?.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    super.onStop()
                    virtualDisplay?.release()
                    virtualDisplay = null
                }
            }, Handler(Looper.getMainLooper()))

            imageReader = ImageReader.newInstance(screenWidth, screenHeight, PixelFormat.RGBA_8888, 2)
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "GBLScreenCapture",
                screenWidth,
                screenHeight,
                screenDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader?.surface,
                null,
                imageReaderHandler
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun captureCleanScreenBitmap(): Bitmap? {
        val reader = imageReader ?: return null
        synchronized(captureLock) {
            return try {
                val image = reader.acquireLatestImage() ?: reader.acquireNextImage()
                if (image != null) {
                    try {
                        val plane = image.planes[0]
                        val buffer = plane.buffer
                        val pixelStride = plane.pixelStride
                        val rowStride = plane.rowStride
                        val rowPadding = rowStride - pixelStride * screenWidth

                        val fullBitmap = Bitmap.createBitmap(
                            screenWidth + rowPadding / pixelStride,
                            screenHeight,
                            Bitmap.Config.ARGB_8888
                        )
                        fullBitmap.copyPixelsFromBuffer(buffer)

                        val clean = if (rowPadding == 0) {
                            fullBitmap
                        } else {
                            val cropped = Bitmap.createBitmap(fullBitmap, 0, 0, screenWidth, screenHeight)
                            fullBitmap.recycle()
                            cropped
                        }

                        cachedScreenBitmap?.recycle()
                        cachedScreenBitmap = clean
                        clean.copy(Bitmap.Config.ARGB_8888, false)
                    } finally {
                        image.close()
                    }
                } else {
                    cachedScreenBitmap?.let {
                        if (!it.isRecycled) it.copy(Bitmap.Config.ARGB_8888, false) else null
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }

    /**
     * ALWAYS-ON ~1.8 HZ BATTLE OCR LOOP:
     * Continuously scans screen regions whenever the overlay service is active.
     * Masks out the overlay HUD's own window bounds first, then stitches & upscales the
     * Top-Right Opponent Nameplate (1.8x), Top-Left Player Nameplate (1.8x), and Bottom Move Buttons
     * into a single composite bitmap for 1-pass ML Kit recognition.
     */
    private fun startBattleOcrLoop() {
        if (battleLoopJob?.isActive == true) return
        battleLoopJob = lifecycleScope.launch(Dispatchers.Default) {
            while (isActive) {
                try {
                    captureAndProcessBattleRegions()
                } catch (_: Exception) {}
                delay(450)
            }
        }
    }

    private suspend fun captureAndProcessBattleRegions() {
        val frameEpoch = battleResetEpoch
        if (System.currentTimeMillis() - lastBattleResetTimeMs < 600L) return

        val screen = captureCleanScreenBitmap() ?: return
        if (screen.isRecycled) return
        if (frameEpoch != battleResetEpoch) {
            screen.recycle()
            return
        }

        val w = screen.width
        val h = screen.height

        // CRITICAL FIX: Mask out our own floating overlay window on the captured frame
        // (including status bar / cutout offset via getLocationOnScreen) so ML Kit can NEVER read our own HUD!
        try {
            val view = overlayView
            if (view != null) {
                val loc = IntArray(2)
                try {
                    view.getLocationOnScreen(loc)
                } catch (_: Exception) {}
                val ox = min(layoutParams.x, if (loc[0] > 0) loc[0] else layoutParams.x).coerceIn(0, w - 1)
                val oyMin = min(layoutParams.y, if (loc[1] > 0) loc[1] else layoutParams.y).coerceIn(0, h - 1)
                val oyMax = max(layoutParams.y, loc[1]).coerceIn(0, h - 1)
                val ow = (if (view.width > 0) view.width else layoutParams.width).coerceAtLeast(1)
                val oh = (if (view.height > 0) view.height else (220 * resources.displayMetrics.density).toInt()).coerceAtLeast(1)
                val screenCanvas = Canvas(screen)
                val maskPaint = Paint().apply { color = Color.BLACK; style = Paint.Style.FILL }
                screenCanvas.drawRect(
                    (ox - 8).coerceAtLeast(0).toFloat(),
                    (oyMin - 8).coerceAtLeast(0).toFloat(),
                    (ox + ow + 16).coerceAtMost(w).toFloat(),
                    (oyMax + oh + 28).coerceAtMost(h).toFloat(),
                    maskPaint
                )
            }
        } catch (_: Exception) {}

        // Generous top nameplate bounds (Y: 0.025..0.148) where Player & Opponent Pokémon names & CPs sit
        // (overlayView is already masked out above so it can never be self-read)
        val srcOpp = Rect(
            (w * 0.42f).toInt().coerceIn(0, w - 1),
            (h * 0.025f).toInt().coerceIn(0, h - 1),
            (w * 0.98f).toInt().coerceIn(1, w),
            (h * 0.148f).toInt().coerceIn(1, h)
        )
        val srcPlayer = Rect(
            (w * 0.01f).toInt().coerceIn(0, w - 1),
            (h * 0.025f).toInt().coerceIn(0, h - 1),
            (w * 0.47f).toInt().coerceIn(1, w),
            (h * 0.148f).toInt().coerceIn(1, h)
        )
        val srcMoves = Rect(
            (w * 0.08f).toInt().coerceIn(0, w - 1),
            (h * 0.80f).toInt().coerceIn(0, h - 1),
            (w * 0.92f).toInt().coerceIn(1, w),
            (h * 0.95f).toInt().coerceIn(1, h)
        )

        // Create high-contrast dark-on-white nameplate extraction of srcOpp so white text over icy/cloudy backgrounds (e.g. Kyurem) is unmistakable
        val bwOppBitmap = createHighContrastWhiteTextBitmap(screen, srcOpp)

        // Upscale top nameplates 1.8x so white-on-sky outlined game font is large & crisp for ML Kit
        val scale = 1.8f
        val dstOppW = (srcOpp.width() * scale).toInt().coerceAtLeast(1)
        val dstOppH = (srcOpp.height() * scale).toInt().coerceAtLeast(1)
        val dstPlayerW = (srcPlayer.width() * scale).toInt().coerceAtLeast(1)
        val dstPlayerH = (srcPlayer.height() * scale).toInt().coerceAtLeast(1)
        val movesW = srcMoves.width().coerceAtLeast(1)
        val movesH = srcMoves.height().coerceAtLeast(1)
        val gap = 24

        val compW = max(max(dstOppW, dstPlayerW), movesW).coerceAtLeast(100)
        // Stitch: [1] Raw Upscaled Opp -> [2] High-Contrast B&W Upscaled Opp -> [3] Player Top -> [4] Player Moves
        val oppZoneH = dstOppH + gap + dstOppH
        val compH = oppZoneH + gap + dstPlayerH + gap + movesH

        val composite = try {
            Bitmap.createBitmap(compW, compH, Bitmap.Config.ARGB_8888)
        } catch (_: Exception) {
            bwOppBitmap?.recycle()
            screen.recycle()
            return
        }

        val canvas = Canvas(composite)
        canvas.drawColor(Color.BLACK)
        val filterPaint = Paint(Paint.FILTER_BITMAP_FLAG)

        val dstOppRaw = Rect(0, 0, dstOppW, dstOppH)
        val dstOppBw = Rect(0, dstOppH + gap, dstOppW, oppZoneH)
        val dstPlayer = Rect(0, oppZoneH + gap, dstPlayerW, oppZoneH + gap + dstPlayerH)
        val dstMoves = Rect(0, oppZoneH + gap + dstPlayerH + gap, movesW, compH)

        canvas.drawBitmap(screen, srcOpp, dstOppRaw, filterPaint)
        if (bwOppBitmap != null) {
            canvas.drawBitmap(bwOppBitmap, null, dstOppBw, filterPaint)
            bwOppBitmap.recycle()
        }
        canvas.drawBitmap(screen, srcPlayer, dstPlayer, filterPaint)
        canvas.drawBitmap(screen, srcMoves, dstMoves, null)

        // v2.33: Vision Sanity Check: Pokéball vs. Shield Disambiguation & Sub-Region Segmentation
        // Player Corner (Top-Left under name/CP):
        //   - Pokéball Cluster: 3 circular slots aligned horizontally to the left
        //   - Shield Cluster: 2 hexagonal shield icons aligned horizontally to the right of the Pokéballs
        val playerPokeballRect = Rect(
            (w * 0.015f).toInt().coerceIn(0, w - 1),
            (h * 0.070f).toInt().coerceIn(0, h - 1),
            (w * 0.170f).toInt().coerceIn(1, w),
            (h * 0.144f).toInt().coerceIn(1, h)
        )
        val playerShieldRect = Rect(
            (w * 0.172f).toInt().coerceIn(0, w - 1),
            (h * 0.070f).toInt().coerceIn(0, h - 1),
            (w * 0.300f).toInt().coerceIn(1, w),
            (h * 0.144f).toInt().coerceIn(1, h)
        )

        // Opponent Corner (Top-Right under CP/name):
        //   - Shield Cluster: 2 hexagonal shield icons on the left
        //   - Pokéball Cluster: 3 circular Pokéball icons on the right
        val oppShieldRect = Rect(
            (w * 0.700f).toInt().coerceIn(0, w - 1),
            (h * 0.070f).toInt().coerceIn(0, h - 1),
            (w * 0.828f).toInt().coerceIn(1, w),
            (h * 0.144f).toInt().coerceIn(1, h)
        )
        val oppPokeballRect = Rect(
            (w * 0.830f).toInt().coerceIn(0, w - 1),
            (h * 0.070f).toInt().coerceIn(0, h - 1),
            (w * 0.985f).toInt().coerceIn(1, w),
            (h * 0.144f).toInt().coerceIn(1, h)
        )

        // Frame Timestamp Tracking & Pokéball/Shield Status Sampling before screen recycle
        prevFrameTimestampMs = currentFrameTimestampMs
        currentFrameTimestampMs = System.currentTimeMillis()
        sampledPlayerBalls = detectActivePokeballCount(screen, playerPokeballRect)
        sampledOppBalls = detectActivePokeballCount(screen, oppPokeballRect)
        sampledPlayerShields = detectActiveShieldCount(screen, playerShieldRect)
        sampledOppShields = detectActiveShieldCount(screen, oppShieldRect)

        screen.recycle()

        val visionText = suspendCancellableCoroutine<Text?> { cont ->
            val input = InputImage.fromBitmap(composite, 0)
            textRecognizer.process(input)
                .addOnSuccessListener { result ->
                    if (cont.isActive) cont.resume(result)
                }
                .addOnFailureListener {
                    if (cont.isActive) cont.resume(null)
                }
        }
        composite.recycle()

        if (visionText == null || frameEpoch != battleResetEpoch || System.currentTimeMillis() - lastBattleResetTimeMs < 600L) return

        val yDivider1 = oppZoneH + gap / 2
        val yDivider2 = oppZoneH + gap + dstPlayerH + gap / 2

        val oppLines = mutableListOf<Text.Line>()
        val playerTopLines = mutableListOf<Text.Line>()
        val playerMoveLines = mutableListOf<Text.Line>()

        for (block in visionText.textBlocks) {
            for (line in block.lines) {
                val cy = line.boundingBox?.centerY() ?: continue
                when {
                    cy < yDivider1 -> oppLines.add(line)
                    cy < yDivider2 -> playerTopLines.add(line)
                    else -> playerMoveLines.add(line)
                }
            }
        }

        // Guard: If the screen is on the GBL Battle Menu ("BATTLE" in upper-left & "PARTY" in upper-right),
        // pause OCR matching for this frame so menu headers never overwrite opponent or player slots.
        if (isBattleMenuScreen(oppLines, playerTopLines, playerMoveLines)) {
            return
        }

        handleOpponentLines(oppLines)
        handlePlayerSwitchLines(playerTopLines, playerMoveLines)
    }

    /**
     * Isolates bright white nameplate text pixels (R>=185, G>=185, B>=185, low color saturation)
     * into crisp black text on a pure white background so ML Kit reads names over bright sky/ice wings (e.g. Kyurem).
     */
    private fun createHighContrastWhiteTextBitmap(source: Bitmap, crop: Rect): Bitmap? {
        return try {
            val cw = crop.width().coerceAtLeast(1)
            val ch = crop.height().coerceAtLeast(1)
            val pixels = IntArray(cw * ch)
            source.getPixels(pixels, 0, cw, crop.left, crop.top, cw, ch)
            for (i in pixels.indices) {
                val c = pixels[i]
                val r = (c shr 16) and 0xFF
                val g = (c shr 8) and 0xFF
                val b = c and 0xFF
                val maxCh = max(r, max(g, b))
                val minCh = min(r, min(g, b))
                // Pure white nameplate text has high luminance and low saturation
                val isWhiteGlyph = r >= 188 && g >= 188 && b >= 188 && (maxCh - minCh) <= 42
                pixels[i] = if (isWhiteGlyph) Color.BLACK else Color.WHITE
            }
            Bitmap.createBitmap(pixels, cw, ch, Bitmap.Config.ARGB_8888)
        } catch (_: Exception) {
            null
        }
    }

    /**
     * Interpolates T_swap midway between frame F_prev and detection frame F_detect
     * to eliminate capture interval latency, anchoring the timer to calculated animation start.
     */
    private fun getInterpolatedSwapStartTimeMs(): Long {
        return if (prevFrameTimestampMs > 0L && currentFrameTimestampMs > prevFrameTimestampMs) {
            (prevFrameTimestampMs + currentFrameTimestampMs) / 2L
        } else {
            currentFrameTimestampMs
        }
    }

    /**
     * Detects active (unfainted) Pokéball count (0..3) from the circular Pokéball sub-ROI.
     * Evaluates ONLY within the circular Pokéball sub-ROI (1:1 circular aspect ratio,
     * two-tone red top / white bottom separated by a dark center band, turning dark/grey when fainted).
     * Guard: Cannot be triggered or decremented by shield usage.
     */
    private fun detectActivePokeballCount(screen: Bitmap, searchRect: Rect): Int {
        return try {
            val left = searchRect.left.coerceIn(0, screen.width - 1)
            val right = searchRect.right.coerceIn(0, screen.width)
            val top = searchRect.top.coerceIn(0, screen.height - 1)
            val bottom = searchRect.bottom.coerceIn(0, screen.height)
            if (right <= left || bottom <= top) return 3

            val step = 2
            val redXCoordinates = mutableListOf<Int>()
            for (y in top until bottom step step) {
                for (x in left until right step step) {
                    val pixel = screen.getPixel(x, y)
                    val r = (pixel shr 16) and 0xFF
                    val g = (pixel shr 8) and 0xFF
                    val b = pixel and 0xFF
                    // Live Pokéball red top half: pure red dominance (high R, low G/B)
                    if (r >= 160 && g <= 100 && b <= 100 && (r - max(g, b)) >= 55) {
                        redXCoordinates.add(x)
                    }
                }
            }
            if (redXCoordinates.isEmpty()) return 0

            redXCoordinates.sort()
            val minClusterSpacing = (screen.width * 0.024f).toInt().coerceAtLeast(6)
            var clusters = 0
            var currentClusterSize = 0
            var lastX = -100

            for (x in redXCoordinates) {
                if (x - lastX > minClusterSpacing) {
                    if (currentClusterSize >= 3) {
                        clusters++
                    }
                    currentClusterSize = 1
                    lastX = x
                } else {
                    currentClusterSize++
                    lastX = x
                }
            }
            if (currentClusterSize >= 3) {
                clusters++
            }
            clusters.coerceIn(0, 3)
        } catch (_: Exception) {
            3
        }
    }

    /**
     * Detects active shield count (0, 1, 2) from the hexagonal shield sub-ROI.
     * Active shields have a distinctive pink/magenta/purple hue profile (high R & B, lower G).
     * Used/depleted shields turn translucent/grey.
     */
    private fun detectActiveShieldCount(screen: Bitmap, searchRect: Rect): Int {
        return try {
            val left = searchRect.left.coerceIn(0, screen.width - 1)
            val right = searchRect.right.coerceIn(0, screen.width)
            val top = searchRect.top.coerceIn(0, screen.height - 1)
            val bottom = searchRect.bottom.coerceIn(0, screen.height)
            if (right <= left || bottom <= top) return 2

            val step = 2
            val pinkXCoordinates = mutableListOf<Int>()
            for (y in top until bottom step step) {
                for (x in left until right step step) {
                    val pixel = screen.getPixel(x, y)
                    val r = (pixel shr 16) and 0xFF
                    val g = (pixel shr 8) and 0xFF
                    val b = pixel and 0xFF
                    // Active shield pink/magenta hue (high R and B, lower G)
                    if (r >= 145 && b >= 125 && g <= 140 && (r + b - 2 * g) >= 50) {
                        pinkXCoordinates.add(x)
                    }
                }
            }
            if (pinkXCoordinates.isEmpty()) return 0

            pinkXCoordinates.sort()
            val minClusterSpacing = (screen.width * 0.024f).toInt().coerceAtLeast(6)
            var clusters = 0
            var currentClusterSize = 0
            var lastX = -100

            for (x in pinkXCoordinates) {
                if (x - lastX > minClusterSpacing) {
                    if (currentClusterSize >= 3) {
                        clusters++
                    }
                    currentClusterSize = 1
                    lastX = x
                } else {
                    currentClusterSize++
                    lastX = x
                }
            }
            if (currentClusterSize >= 3) {
                clusters++
            }
            clusters.coerceIn(0, 2)
        } catch (_: Exception) {
            2
        }
    }

    private val OCR_MENU_IGNORED_WORDS = setOf(
        "party", "parties", "battle", "battles", "league", "schedule",
        "rank", "rating", "rewards", "reward", "train", "training",
        "season", "current", "great", "ultra", "master", "premier",
        "switch", "shield", "shields", "super", "effective", "not", "very",
        "attack", "defense", "charged", "fast", "weather", "boost"
    )

    /**
     * Returns true if a token or word is a GBL menu label ("party", "battle", etc.) or a 1-character
     * OCR confusable of "party" (which otherwise has edit distance 2 to "paras") or "battle".
     */
    private fun isIgnoredMenuToken(rawToken: String): Boolean {
        val cleanLower = rawToken.lowercase().replace(Regex("[^a-z]"), "")
        if (cleanLower.isEmpty()) return true
        if (cleanLower in OCR_MENU_IGNORED_WORDS) return true
        val normVariants = listOf(
            normalizeOcrToken(rawToken, oneAsL = false, rnAsM = false, vAsY = false),
            normalizeOcrToken(rawToken, oneAsL = true, rnAsM = false, vAsY = false),
            normalizeOcrToken(rawToken, oneAsL = false, rnAsM = true, vAsY = true)
        ).filter { it.isNotEmpty() }.distinct()
        for (norm in normVariants) {
            if (norm in OCR_MENU_IGNORED_WORDS) return true
            // Block "party" and any 1-char OCR typo of "party" (e.g. "partv", "parly") so it can NEVER match Paras (dist 2 from party)
            if (norm.length in 4..6 && levenshteinDistance(norm, "party") <= 1) return true
            // Block "battle" and any 1-char OCR typo of "battle" (e.g. "batt1e", "battie") so it can NEVER match user team Pokémon
            if (norm.length in 5..7 && levenshteinDistance(norm, "battle") <= 1) return true
        }
        return false
    }

    /**
     * Detects when the user is on the Pokémon GO Battle Menu screen (upper-left "BATTLE" + upper-right "PARTY",
     * or GBL lobby headers without any active combat CP indicators) and pauses OCR matching on that frame.
     */
    private fun isBattleMenuScreen(
        oppLines: List<Text.Line>,
        playerTopLines: List<Text.Line>,
        playerMoveLines: List<Text.Line>
    ): Boolean {
        val oppTextLower = oppLines.joinToString(" ") { it.text.lowercase() }
        val playerTopLower = playerTopLines.joinToString(" ") { it.text.lowercase() }
        val bottomLower = playerMoveLines.joinToString(" ") { it.text.lowercase() }
        val combinedTopLower = "$playerTopLower $oppTextLower"

        val hasCpInTop = Regex("(?i)\\bcp\\s*\\d{2,4}\\b").containsMatchIn(combinedTopLower)

        val hasPartyInOpp = oppLines.any { line ->
            line.text.trim().split(Regex("\\s+")).any { tok ->
                val n = normalizeOcrToken(tok, vAsY = true)
                n == "party" || n == "parties" || (n.length in 4..6 && levenshteinDistance(n, "party") <= 1)
            }
        }
        val hasBattleInPlayerTop = playerTopLines.any { line ->
            line.text.trim().split(Regex("\\s+")).any { tok ->
                val n = normalizeOcrToken(tok, oneAsL = true)
                n == "battle" || n == "battles" || (n.length in 5..7 && levenshteinDistance(n, "battle") <= 1)
            }
        }

        // Classic GBL Battle Menu header: "BATTLE" in upper-left and "PARTY" in upper-right
        if (hasPartyInOpp && hasBattleInPlayerTop) return true

        // Even if one side of the header was occluded by the floating HUD, if "PARTY" is in upper-right without any CP in top bars
        if (hasPartyInOpp && !hasCpInTop) return true
        if (hasBattleInPlayerTop && !hasCpInTop) return true

        // GBL Lobby / Menu text indicators
        if (!hasCpInTop && (
                combinedTopLower.contains("go battle league") ||
                combinedTopLower.contains("current season") ||
                bottomLower.contains("battle till you win") ||
                bottomLower.contains("view schedule")
            )
        ) {
            return true
        }
        return false
    }

    private fun isOverlayHudSelfText(lower: String): Boolean {
        return lower.contains("waiting") ||
                lower.contains("scanning") ||
                lower.contains("zero-sneak") ||
                lower.contains("awaiting") ||
                lower.contains("shadow:") ||
                lower.contains("form:") ||
                lower.contains("reset opp") ||
                lower.contains("start battle") ||
                lower.contains("stop battle") ||
                lower.contains("🛑") ||
                lower.contains("new battle") ||
                lower.contains("opponent attacks") ||
                lower.contains("my attacks") ||
                lower.contains("cmp:") ||
                lower.contains("cmp win") ||
                lower.contains("cmp loss") ||
                lower.contains("lead:") ||
                lower.contains("dmg") ||
                lower.contains("throw on") ||
                lower.contains("1 hz") ||
                lower.contains("bench:") ||
                lower.contains("opt 1") ||
                lower.contains("opt 2") ||
                lower.contains("⚔") ||
                lower.contains("→") ||
                Regex("^vs\\s+").containsMatchIn(lower.trim()) ||
                Regex("\\b(?:1st|2nd|3rd)\\b").containsMatchIn(lower) ||
                Regex("\\d+t/\\d+e/").containsMatchIn(lower) ||
                Regex("\\d+e/\\d+f\\b").containsMatchIn(lower) ||
                Regex("\\(\\d+t\\b").containsMatchIn(lower)
    }

    /**
     * Strictly maintains fixed opponent discovery order: [1st seen, 2nd seen, 3rd seen].
     * Never reorders slots when an already-seen opponent switches back in!
     */
    private fun upsertDetectedOpponentBySpecies(fullName: String, baseSpecies: String) {
        val existingIdx = detectedOpponents.indexOfFirst {
            FormResolver.extractBaseSpecies(it).equals(baseSpecies, ignoreCase = true)
        }
        if (existingIdx >= 0) {
            detectedOpponents[existingIdx] = fullName
            return
        }
        if (detectedOpponents.size < 3) {
            detectedOpponents.add(fullName)
        } else {
            val activeIdx = detectedOpponents.indexOfFirst {
                FormResolver.extractBaseSpecies(it).equals(activeOpponentSpecies, ignoreCase = true)
            }.takeIf { it in 0..2 } ?: 2
            detectedOpponents[activeIdx] = fullName
        }
    }

    private fun handleOpponentLines(oppLines: List<Text.Line>) {
        if (oppLines.isEmpty()) return
        val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"

        // Sort top-to-bottom so the opponent Pokémon name line (above CP) is evaluated first
        val sortedLines = oppLines.sortedBy { it.boundingBox?.top ?: 0 }
        val matchedCandidates = mutableListOf<Pair<PokemonMeta, String>>()

        for (line in sortedLines) {
            val text = line.text.trim()
            if (text.length < 3) continue

            val lower = text.lowercase()
            if (isOverlayHudSelfText(lower)) continue

            val candidate = findPokemonInText(text)
            if (candidate != null) {
                val base = candidate.baseSpecies.lowercase()
                val manualFormName = manualFormOverrides[base]
                val isLineShadow = manualShadowOverrides[base] ?: text.contains("shadow", ignoreCase = true)
                val resolved = if (manualFormName != null) {
                    getPokemonMeta(manualFormName, activeLeague, isLineShadow)
                } else {
                    val bestVar = FormResolver.resolveBestDefaultVariant(candidate, text, activeLeague)
                    applyRankingMovesForLeague(applyRecommendedMoves(bestVar), activeLeague, isLineShadow)
                }
                matchedCandidates.add(resolved to text)
            }
        }

        // Prefer any detected candidate that is a DIFFERENT species from the current activeOpponentSpecies
        val chosenPair = matchedCandidates.firstOrNull {
            !it.first.baseSpecies.equals(activeOpponentSpecies, ignoreCase = true)
        } ?: matchedCandidates.firstOrNull()

        // Dynamic fallback if CP line is visible in top-right nameplate and a clean name line is above it
        val finalPair: Pair<PokemonMeta, String>? = chosenPair ?: run {
            val hasCpIndicator = sortedLines.any {
                Regex("(?i)\\bcp\\s*\\d{3,4}\\b").containsMatchIn(it.text) ||
                        Regex("^\\d{3,4}$").containsMatchIn(it.text.trim())
            }
            if (!hasCpIndicator) return@run null

            for (line in sortedLines) {
                val raw = line.text.trim()
                if (isOverlayHudSelfText(raw.lowercase())) continue
                val cleanWord = raw
                    .replace(Regex("(?i)\\bcp\\s*\\d*"), "")
                    .replace(Regex("[^a-zA-Z\\s-]"), "")
                    .trim()
                if (cleanWord.length in 4..14 &&
                    !isIgnoredMenuToken(cleanWord) &&
                    !cleanWord.contains("super", ignoreCase = true) &&
                    !cleanWord.contains("effective", ignoreCase = true) &&
                    !cleanWord.contains("attack", ignoreCase = true) &&
                    !cleanWord.contains("defense", ignoreCase = true) &&
                    !cleanWord.contains("shield", ignoreCase = true) &&
                    !cleanWord.contains("party", ignoreCase = true) &&
                    !cleanWord.contains("battle", ignoreCase = true)
                ) {
                    val dynamicName = cleanWord.lowercase().replaceFirstChar { it.uppercase() }
                    val dynMeta = getPokemonMeta(dynamicName)
                    return@run dynMeta to raw
                }
            }
            null
        }

        if (finalPair != null) {
            val (matched, rawMatchedLine) = finalPair
            val newBaseSpecies = matched.baseSpecies.lowercase()

            val anyLineHasShadow = rawMatchedLine.contains("shadow", ignoreCase = true) ||
                sortedLines.any { it.text.contains("shadow", ignoreCase = true) }

            // Trigger immediately when opponent spawns or switches/faints into a different species
            if (System.currentTimeMillis() - lastBattleResetTimeMs < 600L) return
            val speciesChanged = isWaitingForOpponent || !newBaseSpecies.equals(activeOpponentSpecies, ignoreCase = true)
            if (speciesChanged) {
                // v2.33 State Machine:
                // Species Changed = YES:
                // - balls_curr == balls_prev (unchanged): True Tactical Swap -> reset Swap Clock to 50s, species alive
                // - balls_curr < balls_prev (decremented): Faint Replacement -> preserve Swap Clock, mark prior species FAINTED
                if (!isWaitingForOpponent) {
                    val prevOppSlotIdx = if (detectedOpponents.isNotEmpty()) {
                        val base = FormResolver.extractBaseSpecies(activeOpponentName).lowercase()
                        detectedOpponents.indexOfFirst { FormResolver.extractBaseSpecies(it).equals(base, ignoreCase = true) }.coerceAtLeast(0)
                    } else 0

                    val isFaintReplacement = sampledOppBalls in 0..2 && sampledOppBalls < oppPokeballCount
                    if (isFaintReplacement) {
                        // Faint Replacement:
                        // 1. Do NOT reset Swap Clock (preserve existing cooldown/ready timer).
                        // 2. Mark prior species as FAINTED (grey out / dim column in attacks table).
                        oppPokeballCount = sampledOppBalls
                        if (prevOppSlotIdx in 0..2) {
                            oppFaintedSlots[prevOppSlotIdx] = true
                        }
                    } else {
                        // True Tactical Swap:
                        // 1. Reset Swap Clock to 50s.
                        // 2. Species remains alive (do NOT grey out column).
                        val swapStartMs = getInterpolatedSwapStartTimeMs()
                        oppSwapEndTimeMs = swapStartMs + 50000L
                    }
                    isOppTurnOne = false
                }

                isWaitingForOpponent = false
                isBattleActive = true
                lastClearedOpponentsSnapshot = emptyList()
                activeOpponentSpecies = newBaseSpecies
                availableOpponentForms = FormResolver.getVariantsForSpecies(newBaseSpecies, activeLeague)
                currentFormIndex = availableOpponentForms.indexOfFirst { it.name == matched.name }.coerceAtLeast(0)
                activeOpponentName = matched.name

                isOpponentShadow = when {
                    manualShadowOverrides.containsKey(newBaseSpecies) -> manualShadowOverrides[newBaseSpecies]!!
                    anyLineHasShadow -> {
                        manualShadowOverrides[newBaseSpecies] = true
                        true
                    }
                    else -> false
                }

                // 1-per-species deduplication on opponent team
                upsertDetectedOpponentBySpecies(matched.name, newBaseSpecies)

                recalculateAndPushBattleData()
                showBattleToast("⚔️ Opponent: ${matched.name} (${matched.fastTurns}t ${matched.defaultFastMove})")
            } else {
                // Species Changed = NO:
                // Check if shield count transitioned (shields_curr < shields_prev):
                // 1. Update shield state variable.
                // 2. Do NOT alter party life status or swap clocks.
                var updated = false
                if (sampledOppShields in 0..1 && sampledOppShields < oppShieldsRemaining) {
                    oppShieldsRemaining = sampledOppShields
                    updated = true
                }
                if (anyLineHasShadow && !manualShadowOverrides.containsKey(newBaseSpecies) && !isOpponentShadow) {
                    isOpponentShadow = true
                    manualShadowOverrides[newBaseSpecies] = true
                    updated = true
                }
                if (updated) {
                    recalculateAndPushBattleData()
                }
            }
        }
    }

    /**
     * Executes a player switch, applying Faint vs. True Swap classification,
     * timestamp interpolation, and 50s cooldown countdown management (v2.33).
     */
    private fun executePlayerSwitch(newSlotName: String) {
        val preset = currentPreset ?: return
        if (newSlotName.equals(activeUserPokemonName, ignoreCase = true)) {
            // Species Changed = NO: check if shield was used
            if (sampledPlayerShields in 0..1 && sampledPlayerShields < playerShieldsRemaining) {
                playerShieldsRemaining = sampledPlayerShields
                recalculateAndPushBattleData()
            }
            return
        }

        val prevSlotIdx = preset.pokemon.indexOfFirst { it.name.equals(activeUserPokemonName, ignoreCase = true) }.let { if (it >= 0) it else 0 }
        val isFaintReplacement = sampledPlayerBalls in 0..2 && sampledPlayerBalls < playerPokeballCount
        if (isFaintReplacement) {
            // Faint Replacement:
            // 1. Do NOT reset Swap Clock (preserve existing cooldown/ready timer).
            // 2. Mark prior species as FAINTED (grey out / dim column in attacks table).
            playerPokeballCount = sampledPlayerBalls
            if (prevSlotIdx in 0..2) {
                playerFaintedSlots[prevSlotIdx] = true
            }
        } else {
            // True Tactical Swap:
            // 1. Reset Swap Clock to 50s.
            // 2. Prior species remains alive (do NOT grey out column).
            val swapStartMs = getInterpolatedSwapStartTimeMs()
            playerSwapEndTimeMs = swapStartMs + 50000L
        }
        isPlayerTurnOne = false

        activeUserPokemonName = newSlotName
        recalculateAndPushBattleData()
        showBattleToast("🔄 Player Switch: $newSlotName")
    }

    /**
     * Detects player switches automatically via Top-Left Player Nameplate OR Bottom Charged Move buttons.
     * Immediately updates internal state, re-indexes current matchups, and refreshes UI without manual party tap.
     */
    private fun handlePlayerSwitchLines(playerTopLines: List<Text.Line>, playerMoveLines: List<Text.Line>) {
        val preset = currentPreset ?: return

        // 1. Check Top-Left Player Nameplate lines first (strictly against user's 3 preset team members)
        for (line in playerTopLines) {
            val lineText = line.text.trim()
            if (lineText.length < 3) continue
            val lowerLine = lineText.lowercase()
            if (isOverlayHudSelfText(lowerLine)) continue
            if (isIgnoredMenuToken(lineText)) continue

            val normalizedLine = normalizeOcrToken(lineText)
            if (normalizedLine == "battle" || normalizedLine == "party") continue

            val matchCountInLine = preset.pokemon.count { slot ->
                val base = FormResolver.extractBaseSpecies(slot.name)
                base.length >= 3 && normalizedLine.contains(base)
            }
            if (matchCountInLine > 1) continue

            for (slot in preset.pokemon) {
                val speciesBase = FormResolver.extractBaseSpecies(slot.name)
                val cpStr = slot.cp.toString()

                var isMatched = false
                if (speciesBase.length >= 3 && normalizedLine.contains(speciesBase)) {
                    isMatched = true
                } else if (cpStr.length >= 3 && lineText.contains(cpStr)) {
                    isMatched = true
                } else {
                    val tokens = lineText.replace(Regex("(?i)\\bcp\\s*\\d+\\b"), " ")
                        .replace(Regex("(?i)\\b(?:battle|battles|party|parties|schedule|rank|rating|rewards|train)\\b"), " ")
                        .replace(Regex("\\b\\d+\\b"), " ")
                        .replace(Regex("[^a-zA-Z0-9\\s]"), " ")
                        .split("\\s+".toRegex())
                        .filter { it.length >= 4 && !isIgnoredMenuToken(it) }
                    for (token in tokens) {
                        val normTok = normalizeOcrToken(token)
                        if (isIgnoredMenuToken(normTok)) continue
                        if (levenshteinDistance(normTok, speciesBase) <= 2) {
                            isMatched = true
                            break
                        }
                    }
                }

                if (isMatched) {
                    executePlayerSwitch(slot.name)
                    return
                }
            }
        }

        // 2. Check Bottom Charged Move Buttons across all bottom move lines
        if (playerMoveLines.isNotEmpty()) {
            val combinedBottomNorm = playerMoveLines.joinToString(" ") { normalizeOcrToken(it.text) }
            val combinedBottomLower = playerMoveLines.joinToString(" ") { it.text.lowercase() }

            var bestSlot: TeamMember? = null
            var bestScore = 0

            for (slot in preset.pokemon) {
                val meta = getPokemonMeta(slot.name)
                val candidateMoves = listOf(slot.chargedMove1, slot.chargedMove2, meta.chargedMove1, meta.chargedMove2)
                    .map { it.trim() }
                    .filter { it.isNotEmpty() }
                    .distinct()

                var score = 0
                for (move in candidateMoves) {
                    val normMove = normalizeOcrToken(move)
                    if (normMove.length >= 3 && combinedBottomNorm.contains(normMove)) {
                        score += 3
                    } else {
                        val words = move.lowercase().split(" ").filter { it.length >= 4 && it != "attack" && it != "ball" }
                        for (w in words) {
                            if (combinedBottomLower.contains(w)) {
                                score += 1
                            }
                        }
                    }
                }

                if (score > bestScore) {
                    bestScore = score
                    bestSlot = slot
                }
            }

            if (bestSlot != null && bestScore >= 2) {
                executePlayerSwitch(bestSlot.name)
            }
        }
    }

    /**
     * ACTION: RESET OPPONENT (Start New Battle)
     * Clears opponent team & manual form/shadow overrides while keeping 1 Hz OCR continuously active
     */
    fun startNewBattle() {
        // Snapshot opponents and lead matchup before clearing, so if the user taps
        // "Start Battle" (which immediately empties the matrix) and then taps "Win" or "Loss",
        // the battle log still records the opponents from the battle that just ended.
        if (detectedOpponents.isNotEmpty()) {
            lastClearedOpponentsSnapshot = detectedOpponents.take(3).map { oppName ->
                val baseKey = FormResolver.extractBaseSpecies(oppName).lowercase()
                val isShad = manualShadowOverrides[baseKey] ?: oppName.contains("Shadow", ignoreCase = true)
                if (isShad && !oppName.startsWith("Shadow ", ignoreCase = true)) {
                    "Shadow $oppName"
                } else {
                    oppName
                }
            }
            lastClearedLeadMatchupSnapshot = currentLeadMatchup
        }

        battleResetEpoch++
        lastBattleResetTimeMs = System.currentTimeMillis()
        synchronized(captureLock) {
            try {
                var img = imageReader?.acquireLatestImage()
                while (img != null) {
                    img.close()
                    img = imageReader?.acquireLatestImage()
                }
            } catch (_: Exception) {}
            cachedScreenBitmap?.recycle()
            cachedScreenBitmap = null
        }

        detectedOpponents.clear()
        manualFormOverrides.clear()
        manualShadowOverrides.clear()
        manualLeadMatchupOverride = null
        currentLeadMatchup = "NEUTRAL"
        isWaitingForOpponent = true
        isBattleActive = true
        activeOpponentName = "Waiting..."
        activeOpponentSpecies = ""
        isOpponentShadow = false
        availableOpponentForms = emptyList()
        currentFormIndex = 0

        // v2.33: Reset Swap Clocks, Shields & Pokéball Faint state
        playerSwapEndTimeMs = 0L
        oppSwapEndTimeMs = 0L
        playerPokeballCount = 3
        oppPokeballCount = 3
        playerShieldsRemaining = 2
        oppShieldsRemaining = 2
        sampledPlayerBalls = 3
        sampledOppBalls = 3
        sampledPlayerShields = 2
        sampledOppShields = 2
        playerFaintedSlots.fill(false)
        oppFaintedSlots.fill(false)
        isPlayerTurnOne = true
        isOppTurnOne = true
        prevFrameTimestampMs = 0L
        currentFrameTimestampMs = 0L

        stopBattleOcrLoop()
        startBattleOcrLoop()
        recalculateAndPushBattleData()
        showBattleToast("⚔️ Battle Started — Scanning Opponents")
    }

    /**
     * ACTION: STOP CURRENT BATTLE
     * Pauses 1 Hz OCR scanning and snapshots the current battle's opponents & lead matchup
     * so the user can log Win/Loss (or skip) before starting the next battle.
     */
    fun stopCurrentBattle() {
        if (detectedOpponents.isNotEmpty()) {
            lastClearedOpponentsSnapshot = detectedOpponents.take(3).map { oppName ->
                val baseKey = FormResolver.extractBaseSpecies(oppName).lowercase()
                val isShad = manualShadowOverrides[baseKey] ?: oppName.contains("Shadow", ignoreCase = true)
                if (isShad && !oppName.startsWith("Shadow ", ignoreCase = true)) {
                    "Shadow $oppName"
                } else {
                    oppName
                }
            }
            lastClearedLeadMatchupSnapshot = currentLeadMatchup
        }
        isBattleActive = false
        stopBattleOcrLoop()
        recalculateAndPushBattleData()
        showBattleToast("🛑 Battle Stopped — Log Win/Loss or Start Next")
    }

    fun logBattleResultFromOverlay(result: String, leadOverride: String?) {
        val normalizedResult = if (result.equals("LOSS", ignoreCase = true)) "LOSS" else "WIN"
        val fallbackLead = if (detectedOpponents.isNotEmpty()) currentLeadMatchup else lastClearedLeadMatchupSnapshot
        val resolvedLead = (leadOverride?.takeIf { it.isNotBlank() } ?: fallbackLead).uppercase()
        currentLeadMatchup = resolvedLead

        val preset = currentPreset
        val league = preset?.league ?: "GREAT LEAGUE"
        val teamName = preset?.name ?: "Active Team"
        val presetId = preset?.id ?: ""
        val userMons = preset?.pokemon?.map { it.name } ?: emptyList()

        val formattedOpponents = if (detectedOpponents.isNotEmpty()) {
            detectedOpponents.take(3).map { oppName ->
                val baseKey = FormResolver.extractBaseSpecies(oppName).lowercase()
                val isShad = manualShadowOverrides[baseKey] ?: oppName.contains("Shadow", ignoreCase = true)
                if (isShad && !oppName.startsWith("Shadow ", ignoreCase = true)) {
                    "Shadow $oppName"
                } else {
                    oppName
                }
            }
        } else {
            lastClearedOpponentsSnapshot
        }

        val quality = calculateBattleQuality(
            myTeam = userMons,
            oppTeam = formattedOpponents,
            league = league,
            result = normalizedResult,
            myTeamSlots = preset?.pokemon
        )

        val nowMs = System.currentTimeMillis()
        val newEntry = SyncBattleLogRecord(
            id = "log-$nowMs-${(100..999).random()}",
            timestampMs = nowMs,
            updatedAt = nowMs,
            league = league,
            presetId = presetId,
            userTeamName = teamName,
            userPokemon = userMons,
            opponents = formattedOpponents,
            leadMatchup = resolvedLead,
            result = normalizedResult,
            deviceLabel = prefs.getString(PREFS_KEY_DEVICE_LABEL, null)?.takeIf { it.isNotBlank() } ?: (Build.MODEL ?: "Android"),
            quality = quality,
            qualityEvaluated = true
        )

        val logsType = object : TypeToken<List<SyncBattleLogRecord>>() {}.type
        val existingLogs: MutableList<SyncBattleLogRecord> = try {
            gson.fromJson<List<SyncBattleLogRecord>>(prefs.getString(PREFS_KEY_BATTLE_LOGS, "[]"), logsType)?.toMutableList()
                ?: mutableListOf()
        } catch (_: Exception) {
            mutableListOf()
        }
        existingLogs.add(0, newEntry)
        prefs.edit().putString(PREFS_KEY_BATTLE_LOGS, gson.toJson(existingLogs)).apply()

        // Ensure opponent list is cleared for the next battle after logging
        lastClearedOpponentsSnapshot = emptyList()
        lastClearedLeadMatchupSnapshot = "NEUTRAL"
        battleResetEpoch++
        lastBattleResetTimeMs = System.currentTimeMillis()
        detectedOpponents.clear()
        manualFormOverrides.clear()
        manualShadowOverrides.clear()
        manualLeadMatchupOverride = null
        currentLeadMatchup = "NEUTRAL"
        isWaitingForOpponent = true
        isBattleActive = false
        activeOpponentName = "Waiting..."
        activeOpponentSpecies = ""
        isOpponentShadow = false
        availableOpponentForms = emptyList()
        currentFormIndex = 0
        stopBattleOcrLoop()
        recalculateAndPushBattleData()
        Handler(Looper.getMainLooper()).post {
            overlayView?.evaluateJavascript(
                "if (window.onBattleLoggedToast) onBattleLoggedToast('$normalizedResult', '$resolvedLead');",
                null
            )
            val leadShort = when (resolvedLead) {
                "FAVORABLE" -> "Fav Lead"
                "NEGATIVE" -> "Neg Lead"
                else -> "Neu Lead"
            }
            showBattleToast("✓ Logged $normalizedResult ($leadShort) • ${formattedOpponents.joinToString(", ").ifEmpty { "No opponents" }}")
        }

        // Always trigger background 2-device delta sync after logging a battle
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                syncWithGitHubGistBlocking(prefs, gson)
            } catch (_: Exception) {}
        }
    }

    fun toggleShadowModifier() {
        isOpponentShadow = !isOpponentShadow
        val baseKey = activeOpponentSpecies.ifBlank { FormResolver.extractBaseSpecies(activeOpponentName) }.lowercase()
        if (baseKey.isNotBlank()) {
            manualShadowOverrides[baseKey] = isOpponentShadow
        }
        recalculateAndPushBattleData()
    }

    fun cycleActiveOpponentForm() {
        if (availableOpponentForms.size <= 1) return
        isWaitingForOpponent = false
        currentFormIndex = (currentFormIndex + 1) % availableOpponentForms.size
        val nextVariant = availableOpponentForms[currentFormIndex]
        val baseKey = nextVariant.baseSpecies.lowercase()
        activeOpponentName = nextVariant.name
        manualFormOverrides[baseKey] = nextVariant.name

        // Update existing species entry in-place (preserving 1st/2nd/3rd seen slot!)
        val existingIdx = detectedOpponents.indexOfFirst {
            FormResolver.extractBaseSpecies(it).equals(baseKey, ignoreCase = true)
        }
        if (existingIdx >= 0) {
            detectedOpponents[existingIdx] = nextVariant.name
        } else {
            upsertDetectedOpponentBySpecies(nextVariant.name, baseKey)
        }
        recalculateAndPushBattleData()
    }

    fun swapActiveOpponent(pokemonName: String) {
        val matched = getPokemonMeta(pokemonName)
        val newBaseSpecies = matched.baseSpecies.lowercase()
        isWaitingForOpponent = false
        activeOpponentSpecies = newBaseSpecies
        val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
        availableOpponentForms = FormResolver.getVariantsForSpecies(newBaseSpecies, activeLeague)
        currentFormIndex = availableOpponentForms.indexOfFirst { it.name == matched.name }.coerceAtLeast(0)
        activeOpponentName = matched.name
        if (pokemonName.contains("Shadow", ignoreCase = true)) {
            manualShadowOverrides[newBaseSpecies] = true
        }
        isOpponentShadow = manualShadowOverrides[newBaseSpecies] ?: pokemonName.contains("Shadow", ignoreCase = true)
        upsertDetectedOpponentBySpecies(matched.name, newBaseSpecies)
        recalculateAndPushBattleData()
        if (::prefs.isInitialized) {
            showBattleToast("⚔️ Active Opponent: ${matched.name}")
        }
    }

    fun selectActiveUserPokemon(pokemonName: String) {
        activeUserPokemonName = pokemonName
        recalculateAndPushBattleData()
        if (::prefs.isInitialized) {
            showBattleToast("Active Lead: $pokemonName")
        }
    }

    fun configureReplayState(
        preset: TeamPreset,
        opponentsList: List<String>,
        activeOppIdx: Int,
        activeUserIdx: Int,
        oppCountModeVal: String = "my_fasts",
        enable4ChargedVal: Boolean = false
    ) {
        currentPreset = preset
        oppCountMode = oppCountModeVal
        enable4ChargedMoves = enable4ChargedVal
        detectedOpponents.clear()
        manualShadowOverrides.clear()
        manualFormOverrides.clear()
        for (rawOpp in opponentsList.take(3)) {
            val isShad = rawOpp.contains("Shadow", ignoreCase = true)
            val clean = rawOpp
                .replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "")
                .replace(Regex("\\s*\\(Shadow\\)", RegexOption.IGNORE_CASE), "")
                .trim()
            val base = FormResolver.extractBaseSpecies(clean).lowercase()
            if (isShad) {
                manualShadowOverrides[base] = true
            }
            if (clean.isNotBlank()) {
                detectedOpponents.add(clean)
            }
        }
        val validOppIdx = activeOppIdx.coerceIn(0, max(0, detectedOpponents.size - 1))
        val activeOpp = detectedOpponents.getOrNull(validOppIdx)
        if (activeOpp != null) {
            isWaitingForOpponent = false
            activeOpponentName = activeOpp
            activeOpponentSpecies = FormResolver.extractBaseSpecies(activeOpp).lowercase()
            isOpponentShadow = manualShadowOverrides[activeOpponentSpecies] ?: false
            availableOpponentForms = FormResolver.getVariantsForSpecies(activeOpponentSpecies, preset.league)
            currentFormIndex = availableOpponentForms.indexOfFirst { it.name.equals(activeOpp, ignoreCase = true) }.coerceAtLeast(0)
        } else {
            isWaitingForOpponent = true
            activeOpponentName = "Waiting..."
        }
        val validUserIdx = activeUserIdx.coerceIn(0, max(0, preset.pokemon.size - 1))
        activeUserPokemonName = preset.pokemon.getOrNull(validUserIdx)?.name ?: preset.pokemon.firstOrNull()?.name
    }

    private fun normalizeOcrToken(input: String, oneAsL: Boolean = false, rnAsM: Boolean = false, vAsY: Boolean = false): String {
        var s = input.lowercase()
            .replace("0", "o")
            .replace("1", if (oneAsL) "l" else "i")
            .replace("!", "i")
            .replace("|", "l")
            .replace("5", "s")
            .replace("8", "b")
            .replace("2", "z")
            .replace("vv", "w")
        if (rnAsM) s = s.replace("rn", "m")
        if (vAsY) s = s.replace("v", "y")
        return s.replace(Regex("[^a-z]"), "")
    }

    private fun findPokemonInText(rawText: String): PokemonMeta? {
        // Strip CP labels, menu labels ("party", "battle", etc.) and 2+ digit numbers EVEN when concatenated without a space (e.g. "KyuremCP4605" or "Kyurem4605"),
        // while preserving single digits inside words (e.g. "Cl0dsire", "D1alga") for normalizeOcrToken!
        val cleaned = rawText
            .replace(Regex("(?i)cp\\s*\\d+"), " ")
            .replace(Regex("(?i)\\b(?:shadow|purified|forme|form|cp|iv|lv|level|vs|party|parties|battle|battles|league|schedule|rank|rating|rewards|reward|train|training|season|current)\\b"), " ")
            .replace(Regex("\\d{2,}"), " ")
            .replace(Regex("\\b\\d+\\b"), " ")
            .replace(Regex("[^a-zA-Z0-9\\s-]"), " ")
            .trim()

        if (cleaned.length < 3) return null
        if (isIgnoredMenuToken(cleaned)) return null

        val tokens = cleaned.split("\\s+".toRegex()).filter { it.length >= 3 && !isIgnoredMenuToken(it) }
        if (tokens.isEmpty()) return null
        val filteredCleaned = tokens.joinToString(" ")

        val allMeta = getAllPokemonMeta()
        val sortedByLenDesc = allMeta.sortedByDescending { it.baseSpecies.length }
        val lowerCleaned = filteredCleaned.lowercase()
        val normCleanedVariants = listOf(
            normalizeOcrToken(filteredCleaned, oneAsL = false, rnAsM = false, vAsY = false),
            normalizeOcrToken(filteredCleaned, oneAsL = true, rnAsM = false, vAsY = false),
            normalizeOcrToken(filteredCleaned, oneAsL = false, rnAsM = true, vAsY = false),
            normalizeOcrToken(filteredCleaned, oneAsL = false, rnAsM = true, vAsY = true),
            normalizeOcrToken(filteredCleaned, oneAsL = false, rnAsM = false, vAsY = true)
        ).filter { !isIgnoredMenuToken(it) }.distinct()

        // 1. Direct or normalized substring match against species base names (longest species name first)
        for (meta in sortedByLenDesc) {
            val baseNorm = normalizeOcrToken(meta.baseSpecies)
            if (baseNorm.length >= 4 && (lowerCleaned.contains(meta.baseSpecies) || normCleanedVariants.any { it.contains(baseNorm) })) {
                return meta
            }
        }

        // 2. Token-level exact & normalized OCR confusable match (including rn->m and v->y for "Kyurern"/"Kvurem")
        for (token in tokens) {
            if (isIgnoredMenuToken(token)) continue
            val tokenNorms = listOf(
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = true, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = true),
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = true)
            ).filter { it.length >= 3 && !isIgnoredMenuToken(it) }.distinct()
            if (tokenNorms.isEmpty()) continue

            val exactOrNorm = sortedByLenDesc.find { meta ->
                val target = normalizeOcrToken(meta.baseSpecies)
                meta.baseSpecies.equals(token, ignoreCase = true) || tokenNorms.any { it == target }
            }
            if (exactOrNorm != null) return exactOrNorm
        }

        // 3. Prefix match for partially clipped names (e.g. "Kyure", "Feraliga", "Giratin", "Zacia")
        for (token in tokens) {
            if (isIgnoredMenuToken(token)) continue
            val tokenNorms = listOf(
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = true)
            ).filter { it.length >= 5 && !isIgnoredMenuToken(it) }.distinct()
            for (normToken in tokenNorms) {
                val prefixMatch = sortedByLenDesc.find {
                    val target = normalizeOcrToken(it.baseSpecies)
                    target.length >= 5 && (target.startsWith(normToken) || normToken.startsWith(target))
                }
                if (prefixMatch != null) return prefixMatch
            }
        }

        // 4. Fuzzy Levenshtein match against meta dictionary (testing 1->i, 1->l, rn->m, v->y)
        var bestMatch: PokemonMeta? = null
        var bestDistance = Int.MAX_VALUE

        for (token in tokens) {
            if (isIgnoredMenuToken(token)) continue
            val tokenNorms = listOf(
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = true, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = true),
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = true)
            ).filter { it.length >= 4 && !isIgnoredMenuToken(it) }.distinct()
            if (tokenNorms.isEmpty()) continue

            for (normTok in tokenNorms) {
                val maxAllowedDist = if (normTok.length >= 5) 2 else 1
                for (meta in allMeta) {
                    val target = normalizeOcrToken(meta.baseSpecies)
                    if (kotlin.math.abs(target.length - normTok.length) <= maxAllowedDist) {
                        val dist = levenshteinDistance(normTok, target)
                        if (dist <= maxAllowedDist && dist < bestDistance) {
                            bestDistance = dist
                            bestMatch = meta
                        }
                    } else if (normTok.length > target.length && target.length >= 5 && normTok.length <= target.length + 4) {
                        // Sliding window check if trailing type icon / CP letter got glued to the token
                        val sub = normTok.substring(0, target.length)
                        if (!isIgnoredMenuToken(sub)) {
                            val dist = levenshteinDistance(sub, target)
                            if (dist <= 1 && dist < bestDistance) {
                                bestDistance = dist
                                bestMatch = meta
                            }
                        }
                    }
                }
            }
        }

        return bestMatch
    }

    private fun getPokemonMeta(
        name: String,
        leagueOverride: String? = null,
        isShadowOverride: Boolean? = null
    ): PokemonMeta {
        val activeLeague = leagueOverride ?: currentPreset?.league ?: "MASTER LEAGUE"
        val cleanNoShadow = name.replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "").trim()
        val base = FormResolver.extractBaseSpecies(cleanNoShadow)
        val isShadow = isShadowOverride ?: (name.contains("Shadow", ignoreCase = true) ||
            manualShadowOverrides[base.lowercase()] == true ||
            (name.equals(activeOpponentName, ignoreCase = true) && isOpponentShadow))

        // Normalize prefix regional forms like "Alolan Ninetales" -> "Ninetales (Alolan)"
        val regionalMatch = Regex("^(Alolan|Galarian|Hisuian|Paldean)\\s+(.+)$", RegexOption.IGNORE_CASE).find(cleanNoShadow)
        val normalizedParenName = if (regionalMatch != null) {
            "${regionalMatch.groupValues[2].trim()} (${regionalMatch.groupValues[1].replaceFirstChar { it.uppercase() }})"
        } else {
            cleanNoShadow
        }

        val allMeta = getAllPokemonMeta()
        val exactByName = allMeta.find {
            it.name.equals(name, ignoreCase = true) ||
                it.name.equals(cleanNoShadow, ignoreCase = true) ||
                it.name.equals(normalizedParenName, ignoreCase = true) ||
                (cleanNoShadow.contains("zygarde", ignoreCase = true) && cleanNoShadow.contains("complete", ignoreCase = true) && it.speciesId.equals("zygarde_complete", ignoreCase = true))
        }
        val found = if (exactByName != null) {
            exactByName
        } else {
            val variants = FormResolver.getVariantsForSpecies(base, activeLeague)
            if (variants.isNotEmpty()) {
                FormResolver.resolveBestDefaultVariant(variants.first(), cleanNoShadow, activeLeague)
            } else {
                allMeta.find { it.speciesId.equals(cleanNoShadow.replace(" ", "_"), ignoreCase = true) }
                    ?: PokemonMeta(
                        name = name,
                        speciesId = base,
                        baseSpecies = base,
                        formLabel = "Base",
                        types = listOf("normal"),
                        defaultCp = 2500,
                        defaultFastMove = "Fast Attack",
                        fastTurns = 2,
                        chargedMove1 = "Charged Move 1",
                        chargedMove2 = "Charged Move 2",
                        c1Dmg = 35,
                        c2Dmg = 45
                    )
            }
        }
        return applyRankingMovesForLeague(applyRecommendedMoves(found), activeLeague, isShadow)
    }

    private fun levenshteinDistance(s1: String, s2: String): Int {
        val dp = Array(s1.length + 1) { IntArray(s2.length + 1) }
        for (i in 0..s1.length) dp[i][0] = i
        for (j in 0..s2.length) dp[0][j] = j
        for (i in 1..s1.length) {
            for (j in 1..s2.length) {
                val cost = if (s1[i - 1] == s2[j - 1]) 0 else 1
                dp[i][j] = min(dp[i - 1][j] + 1, min(dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost))
            }
        }
        return dp[s1.length][s2.length]
    }

    /**
     * PvPoke Type Effectiveness Multiplier (Pokémon GO combat chart: 1.6x SE, 0.625x NVE, 0.390625x Immune)
     */
    private fun getTypeEffectiveness(moveType: String, defenderTypes: List<String>): Double {
        var multiplier = 1.0
        val atk = moveType.lowercase().trim()
        for (def in defenderTypes.map { it.lowercase().trim() }.filter { it.isNotEmpty() && it != "none" }.distinct()) {
            val eff = when (atk) {
                "normal" -> when (def) { "rock", "steel" -> 0.625; "ghost" -> 0.390625; else -> 1.0 }
                "fire" -> when (def) { "grass", "ice", "bug", "steel" -> 1.6; "fire", "water", "rock", "dragon" -> 0.625; else -> 1.0 }
                "water" -> when (def) { "fire", "ground", "rock" -> 1.6; "water", "grass", "dragon" -> 0.625; else -> 1.0 }
                "electric" -> when (def) { "water", "flying" -> 1.6; "electric", "grass", "dragon" -> 0.625; "ground" -> 0.390625; else -> 1.0 }
                "grass" -> when (def) { "water", "ground", "rock" -> 1.6; "fire", "grass", "poison", "flying", "bug", "dragon", "steel" -> 0.625; else -> 1.0 }
                "ice" -> when (def) { "grass", "ground", "flying", "dragon" -> 1.6; "fire", "water", "ice", "steel" -> 0.625; else -> 1.0 }
                "fighting" -> when (def) { "normal", "ice", "rock", "dark", "steel" -> 1.6; "poison", "flying", "psychic", "bug", "fairy" -> 0.625; "ghost" -> 0.390625; else -> 1.0 }
                "poison" -> when (def) { "grass", "fairy" -> 1.6; "poison", "ground", "rock", "ghost" -> 0.625; "steel" -> 0.390625; else -> 1.0 }
                "ground" -> when (def) { "fire", "electric", "poison", "rock", "steel" -> 1.6; "grass", "bug" -> 0.625; "flying" -> 0.390625; else -> 1.0 }
                "flying" -> when (def) { "grass", "fighting", "bug" -> 1.6; "electric", "rock", "steel" -> 0.625; else -> 1.0 }
                "psychic" -> when (def) { "fighting", "poison" -> 1.6; "psychic", "steel" -> 0.625; "dark" -> 0.390625; else -> 1.0 }
                "bug" -> when (def) { "grass", "psychic", "dark" -> 1.6; "fire", "fighting", "poison", "flying", "ghost", "steel", "fairy" -> 0.625; else -> 1.0 }
                "rock" -> when (def) { "fire", "ice", "flying", "bug" -> 1.6; "fighting", "ground", "steel" -> 0.625; else -> 1.0 }
                "ghost" -> when (def) { "psychic", "ghost" -> 1.6; "dark" -> 0.625; "normal" -> 0.390625; else -> 1.0 }
                "dragon" -> when (def) { "dragon" -> 1.6; "steel" -> 0.625; "fairy" -> 0.390625; else -> 1.0 }
                "dark" -> when (def) { "psychic", "ghost" -> 1.6; "fighting", "dark", "fairy" -> 0.625; else -> 1.0 }
                "steel" -> when (def) { "ice", "rock", "fairy" -> 1.6; "fire", "water", "electric", "steel" -> 0.625; else -> 1.0 }
                "fairy" -> when (def) { "fighting", "dragon", "dark" -> 1.6; "fire", "poison", "steel" -> 0.625; else -> 1.0 }
                else -> 1.0
            }
            multiplier *= eff
        }
        return multiplier
    }

    /**
     * Standardized <= 5 character PvPoke Move Abbreviations (Fast & Charged Moves)
     */
    private val moveAbbr5Map = mapOf(
        // Fast Moves
        "Dragon Breath" to "DB",
        "Sand Attack" to "SndAt",
        "Quick Attack" to "QA",
        "Lock-On" to "LO",
        "Water Gun" to "WG",
        "Lick" to "Lick",
        "Bite" to "Bite",
        "Tackle" to "Tckl",
        "Fury Cutter" to "FC",
        "Bug Bite" to "BB",
        "Scratch" to "Scrt",
        "Psywave" to "PsyWv",
        "Psycho Cut" to "PC",
        "Mud Shot" to "MS",
        "Shadow Claw" to "SC",
        "Counter" to "C",
        "Powder Snow" to "PS",
        "Wing Attack" to "WA",
        "Peck" to "Peck",
        "Poison Sting" to "PSng",
        "Thunder Shock" to "TS",
        "Fairy Wind" to "FW",
        "Bullet Punch" to "BP",
        "Fire Fang" to "FF",
        "Vine Whip" to "VW",
        "Karate Chop" to "KC",
        "Low Kick" to "LK",
        "Ice Fang" to "IF",
        "Metal Claw" to "MC",
        "Sucker Punch" to "SP",
        "Poison Jab" to "PJ",
        "Spark" to "Sprk",
        "Leafage" to "Lfge",
        "Steel Wing" to "SW",
        "Rock Throw" to "RT",
        "Ember" to "Embr",
        "Force Palm" to "FP",
        "Dragon Tail" to "DT",
        "Waterfall" to "WF",
        "Fire Spin" to "FS",
        "Snarl" to "Snrl",
        "Geomancy" to "Geo",
        "Mud-Slap" to "MSlp",
        "Charm" to "Chrm",
        "Double Kick" to "DK",
        "Air Slash" to "AS",
        "Ice Shard" to "IS",
        "Bubble" to "Bbl",
        "Rollout" to "Rll",
        "Smack Down" to "SD",
        "Astonish" to "Astn",
        "Hex" to "Hex",
        "Magical Leaf" to "MgLf",
        "Bullet Seed" to "BS",
        "Water Shuriken" to "WS",
        "Gust" to "Gust",
        "Confusion" to "Conf",
        "Volt Switch" to "VS",
        "Incinerate" to "Incin",
        // Charged Moves
        "Roar of Time" to "RoT",
        "Iron Head" to "IH",
        "Draco Meteor" to "DM",
        "Thunder" to "Thdr",
        "Aeroblast" to "Aero",
        "Sky Attack" to "SA",
        "Future Sight" to "FS",
        "Surf" to "Surf",
        "Origin Pulse" to "OP",
        "Hydro Pump" to "HP",
        "Blizzard" to "Blz",
        "Close Combat" to "CC",
        "Brave Bird" to "BB",
        "Play Rough" to "PR",
        "Wild Charge" to "WC",
        "Shadow Ball" to "SB",
        "Ominous Wind" to "OW",
        "Dragon Claw" to "DC",
        "Ancient Power" to "AP",
        "Shadow Force" to "SF",
        "Spacial Rend" to "SpR",
        "Aqua Tail" to "AT",
        "Precipice Blades" to "PB",
        "Fire Punch" to "FP",
        "Psystrike" to "Pstk",
        "Ice Beam" to "IB",
        "Moonblast" to "Mb",
        "Dark Pulse" to "DP",
        "Oblivion Wing" to "ObW",
        "Crunch" to "Crn",
        "Earthquake" to "Eq",
        "Sandsear Storm" to "SndS",
        "Stone Edge" to "SE",
        "Superpower" to "SpP",
        "Sacred Fire" to "ScF",
        "Sunsteel Strike" to "SnSt",
        "Moongeist Beam" to "MnBm",
        "Rock Slide" to "RS",
        "Earth Power" to "EP",
        "Outrage" to "OR",
        "Meteor Mash" to "MM",
        "Drill Run" to "DR",
        "Rock Wrecker" to "RW",
        "Breaking Swipe" to "BS",
        "Avalanche" to "Avl",
        "High Horsepower" to "HH",
        "Ice Punch" to "IP",
        "Fusion Flare" to "FFl",
        "Overheat" to "OH",
        "Fusion Bolt" to "FBlt",
        "Glaciate" to "Glct",
        "Disarming Voice" to "DV",
        "Hydro Cannon" to "HC",
        "Weather Ball (Fire)" to "WB-F",
        "Weather Ball (Ice)" to "WB-I",
        "Weather Ball (Water)" to "WB-W",
        "Weather Ball (Rock)" to "WB-R",
        "Weather Ball" to "WB",
        "Dazzling Gleam" to "DG",
        "Scorching Sands" to "ScS",
        "Psycho Boost" to "PsB",
        "Thunderbolt" to "TB",
        "Grass Knot" to "GK",
        "Sacred Sword" to "ScS",
        "Leaf Blade" to "LB",
        "Aerial Ace" to "AA",
        "Fly" to "Fly",
        "Flame Charge" to "FC",
        "Blast Burn" to "BB",
        "Feather Dance" to "FD",
        "Shadow Sneak" to "SS",
        "Air Cutter" to "AirC",
        "Twister" to "Twst",
        "Focus Blast" to "FB",
        "Solar Beam" to "SolB",
        "Dragon Pulse" to "DP",
        "Megahorn" to "Mgh",
        "Hurricane" to "Hrc",
        "Psychic" to "Psyc",
        "Psyshock" to "Psyk",
        "Flash Cannon" to "FlC",
        "Sludge Wave" to "SWv",
        "Sludge Bomb" to "SlB",
        "Gunk Shot" to "GS",
        "Foul Play" to "FoP",
        "Payback" to "Pybk",
        "Dynamic Punch" to "DyP",
        "Power Gem" to "PG",
        "Water Pulse" to "WP",
        "Petal Blizzard" to "PtB",
        "Energy Ball" to "EnB",
        "Power Whip" to "PW",
        "Heavy Slam" to "HS",
        "Hyper Beam" to "HB",
        "Night Slash" to "NS",
        "Sand Tomb" to "ST",
        "Rock Tomb" to "RT",
        "Mirror Shot" to "MS",
        "Freeze Shock" to "FrS",
        "Ice Burn" to "IcB",
        "Drill Peck" to "DPk",
        "Behemoth Blade" to "BehB",
        "Behemoth Bash" to "BehS",
        "Secret Sword" to "SecS",
        "Aqua Jet" to "AJ",
        "Double Iron Bash" to "DIB",
        "Drum Beating" to "DrmB",
        "Gigaton Hammer" to "GgHm",
        "Bulldoze" to "Bldz",
        "Brutal Swing" to "BrS",
        "Swift" to "Swft",
        "Body Slam" to "BS",
        "Icy Wind" to "IW",
        "Cross Chop" to "CrCh",
        "Mystical Fire" to "MyF",
        "Liquidation" to "Liq",
        "Scald" to "Scld",
        "Trailblaze" to "Trlb",
        "Nature's Madness" to "NM",
        "Rage Fist" to "RgF",
        "Aura Wheel" to "AuW",
        "Torch Song" to "TrS",
        "Super Power" to "SpP",
        "Chilling Water" to "ChW"
    )

    private val fastMovePowerMap = mapOf(
        "dragon breath" to 4,
        "sand attack" to 2,
        "quick attack" to 5,
        "lock-on" to 1,
        "water gun" to 3,
        "lick" to 3,
        "bite" to 4,
        "tackle" to 3,
        "fury cutter" to 2,
        "bug bite" to 3,
        "scratch" to 4,
        "psywave" to 3,
        "psycho cut" to 3,
        "mud shot" to 4,
        "shadow claw" to 6,
        "counter" to 8,
        "powder snow" to 6,
        "wing attack" to 5,
        "peck" to 6,
        "poison sting" to 4,
        "thunder shock" to 3,
        "fairy wind" to 4,
        "bullet punch" to 8,
        "fire fang" to 8,
        "vine whip" to 5,
        "karate chop" to 5,
        "low kick" to 4,
        "ice fang" to 8,
        "metal claw" to 6,
        "sucker punch" to 8,
        "poison jab" to 7,
        "spark" to 5,
        "leafage" to 6,
        "steel wing" to 7,
        "rock throw" to 8,
        "ember" to 7,
        "force palm" to 13,
        "dragon tail" to 13,
        "waterfall" to 12,
        "fire spin" to 11,
        "snarl" to 5,
        "geomancy" to 4,
        "mud-slap" to 12,
        "charm" to 15,
        "double kick" to 8,
        "air slash" to 9,
        "ice shard" to 9,
        "bubble" to 7,
        "rollout" to 8,
        "smack down" to 11,
        "astonish" to 12,
        "hex" to 7,
        "magical leaf" to 10,
        "bullet seed" to 5,
        "water shuriken" to 6,
        "gust" to 16,
        "confusion" to 16,
        "volt switch" to 12,
        "incinerate" to 20
    )

    private val fastMoveTypeMap = mapOf(
        "dragon breath" to "dragon",
        "sand attack" to "ground",
        "quick attack" to "normal",
        "lock-on" to "normal",
        "water gun" to "water",
        "lick" to "ghost",
        "bite" to "dark",
        "tackle" to "normal",
        "fury cutter" to "bug",
        "bug bite" to "bug",
        "scratch" to "normal",
        "psywave" to "psychic",
        "psycho cut" to "psychic",
        "mud shot" to "ground",
        "shadow claw" to "ghost",
        "counter" to "fighting",
        "powder snow" to "ice",
        "wing attack" to "flying",
        "peck" to "flying",
        "poison sting" to "poison",
        "thunder shock" to "electric",
        "fairy wind" to "fairy",
        "bullet punch" to "steel",
        "fire fang" to "fire",
        "vine whip" to "grass",
        "karate chop" to "fighting",
        "low kick" to "fighting",
        "ice fang" to "ice",
        "metal claw" to "steel",
        "sucker punch" to "dark",
        "poison jab" to "poison",
        "spark" to "electric",
        "leafage" to "grass",
        "steel wing" to "steel",
        "rock throw" to "rock",
        "ember" to "fire",
        "force palm" to "fighting",
        "dragon tail" to "dragon",
        "waterfall" to "water",
        "fire spin" to "fire",
        "snarl" to "dark",
        "geomancy" to "fairy",
        "mud-slap" to "ground",
        "charm" to "fairy",
        "double kick" to "fighting",
        "air slash" to "flying",
        "ice shard" to "ice",
        "bubble" to "water",
        "rollout" to "rock",
        "smack down" to "rock",
        "astonish" to "ghost",
        "hex" to "ghost",
        "magical leaf" to "grass",
        "bullet seed" to "grass",
        "water shuriken" to "water",
        "gust" to "flying",
        "confusion" to "psychic",
        "volt switch" to "electric",
        "incinerate" to "fire"
    )

    private fun abbrMove5(moveName: String): String {
        if (moveName.isBlank()) return "Move"
        moveAbbr5Map[moveName]?.let { return it }
        moveAbbr5Map.entries.firstOrNull { it.key.equals(moveName, ignoreCase = true) }?.let { return it.value }
        val clean = moveName.replace(Regex("[()\\-]"), " ").trim()
        val words = clean.split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (words.size >= 2) {
            val combo = (words[0].take(3) + words[1].take(2)).take(5)
            return combo
        }
        return clean.take(5)
    }

    private fun abbrPokemon3(name: String, isShadow: Boolean = false): String {
        if (name.isBlank() || name == "Waiting...") return "OPP"
        val clean = name
            .replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^Kanto\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^Alolan\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^Galarian\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^Hisuian\\s+", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^Paldean\\s+", RegexOption.IGNORE_CASE), "")
            .split(" ")
            .firstOrNull()
            ?.take(3)
            ?.uppercase() ?: "MON"
        return if (isShadow) "S$clean".take(4) else clean
    }

    private fun calculateFastMoveDamagePercent(
        attacker: PokemonMeta,
        defender: PokemonMeta,
        fastMoveName: String,
        fastTurns: Int,
        isAttackerShadow: Boolean,
        isDefenderShadow: Boolean
    ): Int {
        val key = fastMoveName.lowercase().trim()
        val power = DYNAMIC_FAST_POWER[key] ?: fastMovePowerMap[key] ?: (fastTurns * 3).coerceAtLeast(3)
        val moveType = DYNAMIC_FAST_TYPE[key] ?: fastMoveTypeMap[key] ?: attacker.types.firstOrNull() ?: "normal"
        val stab = if (attacker.types.any { it.equals(moveType, ignoreCase = true) }) 1.2 else 1.0
        val typeEff = getTypeEffectiveness(moveType, defender.types)

        val effectiveAtk = attacker.atk * (if (isAttackerShadow) 1.2 else 1.0)
        val effectiveDef = defender.def * (if (isDefenderShadow) 0.8333333 else 1.0)

        val rawDamage = floor(0.5 * power * (effectiveAtk / effectiveDef) * stab * typeEff * 1.3) + 1.0
        val pct = ((rawDamage / defender.hp.toDouble()) * 100.0).roundToInt()
        return pct.coerceIn(1, 100)
    }

    /**
     * Computes exact PvPoke Charged Move damage percentage dealt to defender's total HP pool:
     * Damage = floor(0.5 * Power * (EffectiveAtk / EffectiveDef) * STAB * TypeEffectiveness * 1.3) + 1
     * Accounts for STAB (1.2x), Type Effectiveness, and Shadow modifiers (1.2x Atk / 0.8333333x Def).
     */
    private fun calculateChargedMoveDamagePercent(
        attacker: PokemonMeta,
        defender: PokemonMeta,
        moveName: String,
        isAttackerShadow: Boolean,
        isDefenderShadow: Boolean
    ): Int {
        val moveStats = resolveChargedMoveStatsStatic(moveName, attacker.types.firstOrNull() ?: "normal")
        val stab = if (attacker.types.any { it.equals(moveStats.type, ignoreCase = true) }) 1.2 else 1.0
        val typeEff = getTypeEffectiveness(moveStats.type, defender.types)

        val effectiveAtk = attacker.atk * (if (isAttackerShadow) 1.2 else 1.0)
        val effectiveDef = defender.def * (if (isDefenderShadow) 0.8333333 else 1.0)

        val rawDamage = floor(0.5 * moveStats.power * (effectiveAtk / effectiveDef) * stab * typeEff * 1.3) + 1.0
        val pct = ((rawDamage / defender.hp.toDouble()) * 100.0).roundToInt()
        return pct.coerceIn(5, 100)
    }

    /**
     * BATTLE CALCULATIONS:
     * Calculates turn alignment, opponent incoming damage, and player outgoing damage ("My Dmg to [Opponent]")
     */
    private fun recalculateAndPushBattleData() {
        val jsonStr = buildBattlePayloadJson(isReplayMode = false)
        Handler(Looper.getMainLooper()).post {
            overlayView?.evaluateJavascript("updateBattleData($jsonStr)", null)
        }
    }

    fun buildBattlePayloadJson(isReplayMode: Boolean = false): String {
        val p1 = currentPreset?.pokemon?.getOrNull(0)
        val p2 = currentPreset?.pokemon?.getOrNull(1)
        val p3 = currentPreset?.pokemon?.getOrNull(2)

        val p1Name = p1?.name ?: "Dialga (Origin)"
        val p2Name = p2?.name ?: "Lugia"
        val p3Name = p3?.name ?: "Kyogre"

        val activePlayerName = activeUserPokemonName ?: p1Name
        val activeSlot = currentPreset?.pokemon?.find { it.name.equals(activePlayerName, ignoreCase = true) }

        val teamNames = listOf(p1Name, p2Name, p3Name)
        val activeUserSlotIndex = teamNames.indexOfFirst { it.equals(activePlayerName, ignoreCase = true) }.let { if (it >= 0) it else 0 }

        val teamData = listOf(
            mapOf("initial" to (p1Name.firstOrNull()?.uppercase() ?: "P1"), "code" to abbrPokemon3(p1Name), "name" to p1Name),
            mapOf("initial" to (p2Name.firstOrNull()?.uppercase() ?: "P2"), "code" to abbrPokemon3(p2Name), "name" to p2Name),
            mapOf("initial" to (p3Name.firstOrNull()?.uppercase() ?: "P3"), "code" to abbrPokemon3(p3Name), "name" to p3Name)
        )

        val nowMs = System.currentTimeMillis()
        val playerSwapRemainingSec = if (playerSwapEndTimeMs > nowMs) ((playerSwapEndTimeMs - nowMs + 999L) / 1000L).toInt() else 0
        val oppSwapRemainingSec = if (oppSwapEndTimeMs > nowMs) ((oppSwapEndTimeMs - nowMs + 999L) / 1000L).toInt() else 0

        if (isWaitingForOpponent || activeOpponentName == "Waiting...") {
            val waitingPayload = mapOf(
                "activeOpponent" to "Waiting...",
                "activeOpponentFastMove" to "Scanning Header...",
                "activeOpponentTurns" to 0,
                "oppFastTelemetry" to "1 Hz OCR Active",
                "userFastTelemetry" to "",
                "isOpponentShadow" to isOpponentShadow,
                "currentFormLabel" to "Base",
                "availableForms" to emptyList<String>(),
                "userActivePokemon" to activePlayerName,
                "activeUserSlotIndex" to activeUserSlotIndex,
                "activeOpponentSlotIndex" to 0,
                "leadMatchup" to (manualLeadMatchupOverride ?: lastClearedLeadMatchupSnapshot.ifBlank { currentLeadMatchup }),
                "isReplayMode" to isReplayMode,
                "myMove1Summary" to "—",
                "myMove2Summary" to "—",
                "throwAlignmentText" to "Waiting for Opponent spawn",
                "throwHorizonText" to "—",
                "playerSwapRemainingSec" to playerSwapRemainingSec,
                "playerSwapEndTimeMs" to playerSwapEndTimeMs,
                "oppSwapRemainingSec" to oppSwapRemainingSec,
                "oppSwapEndTimeMs" to oppSwapEndTimeMs,
                "playerPokeballs" to playerPokeballCount,
                "oppPokeballs" to oppPokeballCount,
                "playerShields" to playerShieldsRemaining,
                "oppShields" to oppShieldsRemaining,
                "player_shields_remaining" to playerShieldsRemaining,
                "opponent_shields_remaining" to oppShieldsRemaining,
                "playerFaintedSlots" to playerFaintedSlots.toList(),
                "oppFaintedSlots" to oppFaintedSlots.toList(),
                "team" to teamData,
                "scannedOpponents" to emptyList<Map<String, Any>>(),
                "oppMoveTimingRows" to emptyList<Map<String, Any>>(),
                "myMoveTimingRows" to emptyList<Map<String, Any>>()
            )
            return gson.toJson(waitingPayload)
        }

        val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
        val isUserShadow = activePlayerName.contains("Shadow", ignoreCase = true)
        val activeBaseKey = FormResolver.extractBaseSpecies(activeOpponentName).lowercase()
        val isActiveOppShadow = manualShadowOverrides[activeBaseKey] ?: (isOpponentShadow || activeOpponentName.contains("Shadow", ignoreCase = true))
        isOpponentShadow = isActiveOppShadow
        val oppMeta = computeEffectiveCombatStats(getPokemonMeta(activeOpponentName, activeLeague, isActiveOppShadow), activeLeague)
        val userMeta = computeEffectiveCombatStats(
            getPokemonMeta(activePlayerName, activeLeague, isUserShadow),
            activeLeague,
            activeSlot?.cp,
            activeSlot?.ivs
        )

        val userMove1Name = activeSlot?.chargedMove1?.takeIf { it.isNotBlank() } ?: userMeta.chargedMove1
        val userMove2Name = activeSlot?.chargedMove2?.takeIf { it.isNotBlank() } ?: userMeta.chargedMove2

        val myMove1Pct = calculateChargedMoveDamagePercent(
            attacker = userMeta,
            defender = oppMeta,
            moveName = userMove1Name,
            isAttackerShadow = isUserShadow,
            isDefenderShadow = isOpponentShadow
        )
        val myMove2Pct = calculateChargedMoveDamagePercent(
            attacker = userMeta,
            defender = oppMeta,
            moveName = userMove2Name,
            isAttackerShadow = isUserShadow,
            isDefenderShadow = isOpponentShadow
        )

        val myMove1Summary = "${abbrMove5(userMove1Name)} ($myMove1Pct%)"
        val myMove2Summary = "${abbrMove5(userMove2Name)} ($myMove2Pct%)"

        val userFastMoveName = activeSlot?.fastMove?.takeIf { it.isNotBlank() } ?: userMeta.defaultFastMove
        val userFastTurns = FAST_MOVE_TURNS[userFastMoveName.lowercase().trim()]
            ?: DYNAMIC_FAST_TURNS[userFastMoveName.lowercase().trim()]
            ?: userMeta.fastTurns
        val oppFastMoveName = oppMeta.defaultFastMove
        val oppFastTurns = oppMeta.fastTurns

        val oppFastEnergy = FAST_MOVE_ENERGY[oppFastMoveName.lowercase().trim()]
            ?: DYNAMIC_FAST_ENERGY[oppFastMoveName.lowercase().trim()]
            ?: (oppFastTurns * 4).coerceAtLeast(3)
        val userFastEnergy = FAST_MOVE_ENERGY[userFastMoveName.lowercase().trim()]
            ?: DYNAMIC_FAST_ENERGY[userFastMoveName.lowercase().trim()]
            ?: (userFastTurns * 4).coerceAtLeast(3)

        val oppFastDmgPct = calculateFastMoveDamagePercent(
            attacker = oppMeta,
            defender = userMeta,
            fastMoveName = oppFastMoveName,
            fastTurns = oppFastTurns,
            isAttackerShadow = isOpponentShadow,
            isDefenderShadow = isUserShadow
        )
        val userFastDmgPct = calculateFastMoveDamagePercent(
            attacker = userMeta,
            defender = oppMeta,
            fastMoveName = userFastMoveName,
            fastTurns = userFastTurns,
            isAttackerShadow = isUserShadow,
            isDefenderShadow = isOpponentShadow
        )

        val oppFastTelemetry = "${abbrMove5(oppFastMoveName)} ${oppFastTurns}t/${oppFastEnergy}e/${oppFastDmgPct}%"
        val userFastTelemetry = "${abbrMove5(userFastMoveName)} ${userFastTurns}t/${userFastEnergy}e/${userFastDmgPct}%"

        fun formatOrdinal(n: Int): String = when {
            n % 100 in 11..13 -> "${n}th"
            n % 10 == 1 -> "${n}st"
            n % 10 == 2 -> "${n}nd"
            n % 10 == 3 -> "${n}rd"
            else -> "${n}th"
        }

        val zeroSneakAttacks = calculateZeroSneakThrows(userFastTurns, oppFastTurns)
        val throwAlignmentText = zeroSneakAttacks.joinToString(", ") { formatOrdinal(it) }
        val throwHorizonText = throwAlignmentText

        // FIXED DISCOVERY ORDER: [1st seen, 2nd seen, 3rd seen] — never reorder on switch!
        val displayList = mutableListOf<String>()
        val seenSpecies = mutableSetOf<String>()
        val sourceList = if (detectedOpponents.isNotEmpty()) detectedOpponents else listOf(activeOpponentName)
        for (opp in sourceList) {
            val base = FormResolver.extractBaseSpecies(opp).lowercase()
            if (seenSpecies.add(base)) {
                displayList.add(opp)
            }
            if (displayList.size >= 3) break
        }
        val activeBase = FormResolver.extractBaseSpecies(activeOpponentName).lowercase()
        val activeOpponentSlotIndex = displayList.indexOfFirst {
            FormResolver.extractBaseSpecies(it).equals(activeBase, ignoreCase = true)
        }.let { if (it >= 0) it else 0 }

        val scannedOpponentsData = displayList.mapIndexed { idx, opp ->
            val rawBaseKey = FormResolver.extractBaseSpecies(opp).lowercase()
            val isThisOppShadow = manualShadowOverrides[rawBaseKey] ?: (if (idx == activeOpponentSlotIndex) isOpponentShadow else opp.contains("Shadow", ignoreCase = true))
            val meta = computeEffectiveCombatStats(getPokemonMeta(opp, activeLeague, isThisOppShadow), activeLeague)
            val oppC1Pct = calculateChargedMoveDamagePercent(
                attacker = meta,
                defender = userMeta,
                moveName = meta.chargedMove1,
                isAttackerShadow = isThisOppShadow,
                isDefenderShadow = isUserShadow
            )
            val oppC2Pct = calculateChargedMoveDamagePercent(
                attacker = meta,
                defender = userMeta,
                moveName = meta.chargedMove2,
                isAttackerShadow = isThisOppShadow,
                isDefenderShadow = isUserShadow
            )
            val thirdMoveName = meta.chargedMove3.takeIf { it.isNotBlank() }
                ?: COMMON_THIRD_CHARGED_MOVE[meta.name]
                ?: COMMON_THIRD_CHARGED_MOVE.entries.firstOrNull { it.key.equals(meta.name, ignoreCase = true) }?.value
                ?: when (meta.types.lastOrNull()?.lowercase()) {
                    "dragon" -> if (meta.chargedMove1 != "Outrage" && meta.chargedMove2 != "Outrage") "Outrage" else "Dragon Pulse"
                    "steel" -> if (meta.chargedMove1 != "Flash Cannon" && meta.chargedMove2 != "Flash Cannon") "Flash Cannon" else "Heavy Slam"
                    "water" -> if (meta.chargedMove1 != "Hydro Pump" && meta.chargedMove2 != "Hydro Pump") "Hydro Pump" else "Blizzard"
                    "fire" -> if (meta.chargedMove1 != "Overheat" && meta.chargedMove2 != "Overheat") "Overheat" else "Solar Beam"
                    "grass" -> if (meta.chargedMove1 != "Energy Ball" && meta.chargedMove2 != "Energy Ball") "Energy Ball" else "Solar Beam"
                    "electric" -> if (meta.chargedMove1 != "Thunderbolt" && meta.chargedMove2 != "Thunderbolt") "Thunderbolt" else "Thunder"
                    "ice" -> if (meta.chargedMove1 != "Blizzard" && meta.chargedMove2 != "Blizzard") "Blizzard" else "Ice Beam"
                    "fighting" -> if (meta.chargedMove1 != "Close Combat" && meta.chargedMove2 != "Close Combat") "Close Combat" else "Focus Blast"
                    "poison" -> if (meta.chargedMove1 != "Sludge Bomb" && meta.chargedMove2 != "Sludge Bomb") "Sludge Bomb" else "Gunk Shot"
                    "ground" -> if (meta.chargedMove1 != "Earthquake" && meta.chargedMove2 != "Earthquake") "Earthquake" else "Bulldoze"
                    "flying" -> if (meta.chargedMove1 != "Hurricane" && meta.chargedMove2 != "Hurricane") "Hurricane" else "Aerial Ace"
                    "psychic" -> if (meta.chargedMove1 != "Psychic" && meta.chargedMove2 != "Psychic") "Psychic" else "Future Sight"
                    "rock" -> if (meta.chargedMove1 != "Stone Edge" && meta.chargedMove2 != "Stone Edge") "Stone Edge" else "Power Gem"
                    "ghost" -> if (meta.chargedMove1 != "Shadow Ball" && meta.chargedMove2 != "Shadow Ball") "Shadow Ball" else "Ominous Wind"
                    "dark" -> if (meta.chargedMove1 != "Dark Pulse" && meta.chargedMove2 != "Dark Pulse") "Dark Pulse" else "Foul Play"
                    "fairy" -> if (meta.chargedMove1 != "Moonblast" && meta.chargedMove2 != "Moonblast") "Moonblast" else "Dazzling Gleam"
                    else -> "Hyper Beam"
                }
            val oppC3Pct = calculateChargedMoveDamagePercent(
                attacker = meta,
                defender = userMeta,
                moveName = thirdMoveName,
                isAttackerShadow = isThisOppShadow,
                isDefenderShadow = isUserShadow
            )
            val fourthMoveName = meta.chargedMove4.takeIf {
                it.isNotBlank() &&
                    !it.equals(meta.chargedMove1, ignoreCase = true) &&
                    !it.equals(meta.chargedMove2, ignoreCase = true) &&
                    !it.equals(thirdMoveName, ignoreCase = true)
            } ?: ""
            val oppC4Pct = if (fourthMoveName.isNotBlank()) {
                calculateChargedMoveDamagePercent(
                    attacker = meta,
                    defender = userMeta,
                    moveName = fourthMoveName,
                    isAttackerShadow = isThisOppShadow,
                    isDefenderShadow = isUserShadow
                )
            } else 0
            val matrix = calculate3v3Matrix(meta, isThisOppShadow, p1, p2, p3)
            mapOf(
                "name" to meta.name,
                "code" to abbrPokemon3(meta.name, isThisOppShadow),
                "slotOrder" to (idx + 1),
                "isActive" to (idx == activeOpponentSlotIndex),
                "isShadow" to isThisOppShadow,
                "turns" to meta.fastTurns,
                "c1" to "${abbrMove5(meta.chargedMove1)} ($oppC1Pct%)",
                "c2" to "${abbrMove5(meta.chargedMove2)} ($oppC2Pct%)",
                "c3" to "${abbrMove5(thirdMoveName)} ($oppC3Pct%)",
                "c4" to if (enable4ChargedMoves && fourthMoveName.isNotBlank()) "${abbrMove5(fourthMoveName)} ($oppC4Pct%)" else "",
                "matrix" to matrix
            )
        }

        // Auto-compute Lead Matchup (Your Slot #1 p1 vs. Opponent #1 1st-seen Lead)
        val firstOppP1Matrix = (scannedOpponentsData.firstOrNull()?.get("matrix") as? Map<*, *>)?.get("p1")?.toString() ?: "N,N,N"
        val lead1sCode = firstOppP1Matrix.split(",").getOrNull(1)?.trim() ?: "N"
        val autoLeadMatchup = when (lead1sCode) {
            "SW", "W" -> "FAVORABLE"
            "L", "SL" -> "NEGATIVE"
            else -> "NEUTRAL"
        }
        currentLeadMatchup = manualLeadMatchupOverride ?: autoLeadMatchup

        if (availableOpponentForms.isEmpty()) {
            availableOpponentForms = FormResolver.getVariantsForSpecies(oppMeta.baseSpecies, activeLeague)
        }

        // CMP Tie Evaluation: True if player's active Pokémon wins CMP (higher or equal Attack)
        val winsCmp = userMeta.atk >= oppMeta.atk

        // Active opponent's 3 (or 4) charged moves
        val activeOppThirdMove = oppMeta.chargedMove3.takeIf { it.isNotBlank() }
            ?: COMMON_THIRD_CHARGED_MOVE[oppMeta.name]
            ?: COMMON_THIRD_CHARGED_MOVE.entries.firstOrNull { it.key.equals(oppMeta.name, ignoreCase = true) }?.value
            ?: "Outrage"
        val activeOppFourthMove = oppMeta.chargedMove4.takeIf {
            it.isNotBlank() &&
                !it.equals(oppMeta.chargedMove1, ignoreCase = true) &&
                !it.equals(oppMeta.chargedMove2, ignoreCase = true) &&
                !it.equals(activeOppThirdMove, ignoreCase = true)
        } ?: ""
        val oppChargedMoveNames = (if (enable4ChargedMoves && activeOppFourthMove.isNotBlank()) {
            listOf(oppMeta.chargedMove1, oppMeta.chargedMove2, activeOppThirdMove, activeOppFourthMove)
        } else {
            listOf(oppMeta.chargedMove1, oppMeta.chargedMove2, activeOppThirdMove)
        })
            .filter { it.isNotBlank() }
            .distinct()

        val myChargedMoveNames = listOf(userMove1Name, userMove2Name).filter { it.isNotBlank() }.distinct()

        // Compute shared 1st-throw maximum turn horizon across all 5 moves (Opponent's 3 + Player's 2)
        val oppFirstTurns = oppChargedMoveNames.map { moveName ->
            val mStats = resolveChargedMoveStatsStatic(moveName, oppMeta.types.firstOrNull() ?: "normal")
            val mEnergy = mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[moveName] ?: 50
            val fasts = kotlin.math.ceil(mEnergy.toDouble() / oppFastEnergy.toDouble()).toInt().coerceAtLeast(1)
            fasts * oppFastTurns
        }
        val myFirstTurns = myChargedMoveNames.map { mName ->
            val mStats = resolveChargedMoveStatsStatic(mName, userMeta.types.firstOrNull() ?: "normal")
            val mEnergy = mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[mName] ?: 50
            val fasts = kotlin.math.ceil(mEnergy.toDouble() / userFastEnergy.toDouble()).toInt().coerceAtLeast(1)
            fasts * userFastTurns
        }
        val maxHorizonTurns = ((oppFirstTurns + myFirstTurns).maxOrNull() ?: 12).coerceAtLeast(4)

        // Precompute opponent ready turns across up to 3 cycles for CMP tie evaluation
        val oppReadyTurnsSet = mutableSetOf<Int>()
        for (moveName in oppChargedMoveNames) {
            val mStats = resolveChargedMoveStatsStatic(moveName, oppMeta.types.firstOrNull() ?: "normal")
            val mEnergy = mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[moveName] ?: 50
            var leftE = 0
            var cumF = 0
            for (c in 1..3) {
                val needE = max(1, mEnergy - leftE)
                val f = kotlin.math.ceil(needE.toDouble() / oppFastEnergy.toDouble()).toInt().coerceAtLeast(1)
                leftE = leftE + f * oppFastEnergy - mEnergy
                cumF += f
                oppReadyTurnsSet.add(cumF * oppFastTurns)
            }
        }

        // Build per-move timing, catch/CMP, multi-cycle turn-aligned segments & 3-column team threat rows
        val oppMoveTimingRows = oppChargedMoveNames.map { moveName ->
            val mStats = resolveChargedMoveStatsStatic(moveName, oppMeta.types.firstOrNull() ?: "normal")
            val mEnergy = mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[moveName] ?: 50
            val oppFasts = kotlin.math.ceil(mEnergy.toDouble() / oppFastEnergy.toDouble()).toInt().coerceAtLeast(1)
            val oppReadyTurn = oppFasts * oppFastTurns

            val myTapAtReady = kotlin.math.ceil(oppReadyTurn.toDouble() / userFastTurns.toDouble()).toInt().coerceAtLeast(1)
            val displayReadyCount = if (oppCountMode == "opp_fasts") oppFasts else myTapAtReady
            val myCapTap = kotlin.math.ceil((oppReadyTurn * 2).toDouble() / userFastTurns.toDouble()).toInt().coerceAtLeast(myTapAtReady + 1)
            val coAligned = (oppReadyTurn % userFastTurns == 0)

            // Multi-cycle calculation using true PvPoke residual energy up to maxHorizonTurns
            val cycles = mutableListOf<Map<String, Any>>()
            var leftoverEnergy = 0
            var cumOppFasts = 0
            var prevTurn = 0
            var prevDisplayTap = 0

            for (cycleIdx in 1..3) {
                val energyNeeded = max(1, mEnergy - leftoverEnergy)
                val fastsInCycle = kotlin.math.ceil(energyNeeded.toDouble() / oppFastEnergy.toDouble()).toInt().coerceAtLeast(1)
                leftoverEnergy = leftoverEnergy + fastsInCycle * oppFastEnergy - mEnergy
                cumOppFasts += fastsInCycle
                val readyTurn = cumOppFasts * oppFastTurns

                if (cycleIdx > 1 && readyTurn > maxHorizonTurns) {
                    break
                }

                val turnSpan = max(1, readyTurn - prevTurn)
                val widthPct = ((turnSpan.toDouble() / maxHorizonTurns.toDouble()) * 100.0).coerceIn(8.0, 100.0)

                val readyTap = if (oppCountMode == "opp_fasts") {
                    cumOppFasts
                } else {
                    max(prevDisplayTap + 1, kotlin.math.ceil(readyTurn.toDouble() / userFastTurns.toDouble()).toInt())
                }
                val startTap = prevDisplayTap + 1
                val rangeEnd = readyTap - 1
                val rangeLabel = when {
                    readyTap <= startTap -> ""
                    rangeEnd == startTap -> "$startTap"
                    else -> "$startTap–$rangeEnd"
                }

                cycles.add(
                    mapOf(
                        "cycleIndex" to cycleIdx,
                        "startTurn" to prevTurn,
                        "readyTurn" to readyTurn,
                        "turnSpan" to turnSpan,
                        "widthPct" to widthPct,
                        "startTap" to startTap,
                        "readyTap" to readyTap,
                        "rangeLabel" to rangeLabel,
                        "readyLabel" to "#$readyTap",
                        "hasZeroSneak" to false,
                        "readyState" to if (winsCmp) "cmp" else "catch"
                    )
                )

                prevTurn = readyTurn
                prevDisplayTap = readyTap
            }

            val activeDmgPct = calculateChargedMoveDamagePercent(
                attacker = oppMeta,
                defender = userMeta,
                moveName = moveName,
                isAttackerShadow = isOpponentShadow,
                isDefenderShadow = isUserShadow
            )
            val activeEff = getTypeEffectiveness(mStats.type, userMeta.types)

            // All 3 team Pokémon damage percentages in fixed team slot order [0, 1, 2]
            val teamSlots = listOf(p1, p2, p3)
            val teamDamages = teamNames.mapIndexed { tIdx, tName ->
                val tSlot = teamSlots.getOrNull(tIdx)
                val isTeamShad = tName.contains("Shadow", ignoreCase = true)
                val tMeta = computeEffectiveCombatStats(
                    getPokemonMeta(tName, activeLeague, isTeamShad),
                    activeLeague,
                    tSlot?.cp,
                    tSlot?.ivs
                )
                val tDmgPct = calculateChargedMoveDamagePercent(
                    attacker = oppMeta,
                    defender = tMeta,
                    moveName = moveName,
                    isAttackerShadow = isOpponentShadow,
                    isDefenderShadow = tName.contains("Shadow", ignoreCase = true)
                )
                val tEff = getTypeEffectiveness(mStats.type, tMeta.types)
                val tier = when {
                    tDmgPct <= 35 -> "resist"
                    tDmgPct >= 65 || tEff >= 1.5 -> "weak"
                    else -> "neutral"
                }
                mapOf(
                    "name" to tName,
                    "code" to abbrPokemon3(tName),
                    "dmgPct" to tDmgPct,
                    "eff" to tEff,
                    "tier" to tier,
                    "isActive" to (tIdx == activeUserSlotIndex)
                )
            }

            val safeEnd = max(1, displayReadyCount - 1)
            val safeRangeLabel = if (safeEnd <= 1) "1" else "1–$safeEnd"

            mapOf(
                "name" to moveName,
                "shortName" to abbrMove5(moveName),
                "energy" to mEnergy,
                "oppFasts" to oppFasts,
                "oppReadyTurn" to oppReadyTurn,
                "myTapAtReady" to myTapAtReady,
                "displayReadyCount" to displayReadyCount,
                "myCapTap" to myCapTap,
                "coAligned" to coAligned,
                "winsCmp" to winsCmp,
                "activeName" to activePlayerName,
                "activeDmgPct" to activeDmgPct,
                "activeEff" to activeEff,
                "safeRangeLabel" to safeRangeLabel,
                "maxHorizonTurns" to maxHorizonTurns,
                "cycles" to cycles,
                "teamDamages" to teamDamages
            )
        }

        // Build player's charged move timing rows (My Attacks) with turn-aligned multi-cycle segments, leak-free range label & 3 scanned opponent columns
        val oppFirstReadyTaps = oppMoveTimingRows.mapNotNull { it["myTapAtReady"] as? Int }.toSet()

        val myMoveTimingRows = myChargedMoveNames.map { mName ->
            val mStats = resolveChargedMoveStatsStatic(mName, userMeta.types.firstOrNull() ?: "normal")
            val mEnergy = mStats.energyCost.takeIf { it > 0 } ?: MOVE_ENERGY_COST[mName] ?: 50
            val myTapsNeeded = kotlin.math.ceil(mEnergy.toDouble() / userFastEnergy.toDouble()).toInt().coerceAtLeast(1)
            val myReadyTurn = myTapsNeeded * userFastTurns

            val dmgPct = calculateChargedMoveDamagePercent(
                attacker = userMeta,
                defender = oppMeta,
                moveName = mName,
                isAttackerShadow = isUserShadow,
                isDefenderShadow = isOpponentShadow
            )
            val eff = getTypeEffectiveness(mStats.type, oppMeta.types)

            // Multi-cycle calculation using true PvPoke residual energy up to maxHorizonTurns
            val cycles = mutableListOf<Map<String, Any>>()
            var leftoverEnergy = 0
            var cumMyFasts = 0
            var prevTurn = 0
            var prevDisplayTap = 0

            for (cycleIdx in 1..3) {
                val energyNeeded = max(1, mEnergy - leftoverEnergy)
                val fastsInCycle = kotlin.math.ceil(energyNeeded.toDouble() / userFastEnergy.toDouble()).toInt().coerceAtLeast(1)
                leftoverEnergy = leftoverEnergy + fastsInCycle * userFastEnergy - mEnergy
                cumMyFasts += fastsInCycle
                val readyTurn = cumMyFasts * userFastTurns

                if (cycleIdx > 1 && readyTurn > maxHorizonTurns) {
                    break
                }

                val turnSpan = max(1, readyTurn - prevTurn)
                val widthPct = ((turnSpan.toDouble() / maxHorizonTurns.toDouble()) * 100.0).coerceIn(8.0, 100.0)

                val readyTap = cumMyFasts
                val startTap = prevDisplayTap + 1
                val rangeEnd = readyTap - 1

                val cycleSafeTaps = mutableListOf<Int>()
                for (k in startTap..rangeEnd) {
                    if ((k * userFastTurns) % oppFastTurns != 0) {
                        cycleSafeTaps.add(k)
                    }
                }
                val cycleHasZeroSneak = cycleSafeTaps.isNotEmpty()
                val rangeLabel = when {
                    readyTap <= startTap -> ""
                    cycleHasZeroSneak -> "Safe ${cycleSafeTaps.take(3).joinToString(",")}"
                    rangeEnd == startTap -> "$startTap"
                    else -> "$startTap–$rangeEnd"
                }

                val isCmpTurn = oppReadyTurnsSet.contains(readyTurn) || oppFirstReadyTaps.contains(readyTap)
                val cycleReadyState = when {
                    isCmpTurn -> if (winsCmp) "cmp" else "cmp-loss"
                    else -> "safe"
                }

                cycles.add(
                    mapOf(
                        "cycleIndex" to cycleIdx,
                        "startTurn" to prevTurn,
                        "readyTurn" to readyTurn,
                        "turnSpan" to turnSpan,
                        "widthPct" to widthPct,
                        "startTap" to startTap,
                        "readyTap" to readyTap,
                        "rangeLabel" to rangeLabel,
                        "readyLabel" to "#$readyTap",
                        "hasZeroSneak" to cycleHasZeroSneak,
                        "readyState" to cycleReadyState
                    )
                )

                prevTurn = readyTurn
                prevDisplayTap = readyTap
            }

            val firstCycle = cycles.firstOrNull()
            val hasZeroSneak = (firstCycle?.get("hasZeroSneak") as? Boolean) ?: false
            val safeThrowLabel = (firstCycle?.get("rangeLabel") as? String)?.takeIf { it.isNotEmpty() }
                ?: if (myTapsNeeded <= 1) "1" else "1–${myTapsNeeded - 1}"
            val readyState = (firstCycle?.get("readyState") as? String) ?: "safe"

            val oppDamages = (0..2).map { slotIdx ->
                if (slotIdx < displayList.size) {
                    val oppNameSlot = displayList[slotIdx]
                    val rawBaseKeySlot = FormResolver.extractBaseSpecies(oppNameSlot).lowercase()
                    val isSlotShadow = manualShadowOverrides[rawBaseKeySlot] ?: (if (slotIdx == activeOpponentSlotIndex) isOpponentShadow else oppNameSlot.contains("Shadow", ignoreCase = true))
                    val oppMetaSlot = computeEffectiveCombatStats(getPokemonMeta(oppNameSlot, activeLeague, isSlotShadow), activeLeague)
                    val oDmgPct = calculateChargedMoveDamagePercent(
                        attacker = userMeta,
                        defender = oppMetaSlot,
                        moveName = mName,
                        isAttackerShadow = isUserShadow,
                        isDefenderShadow = isSlotShadow
                    )
                    val oEff = getTypeEffectiveness(mStats.type, oppMetaSlot.types)
                    val tier = when {
                        oDmgPct >= 65 || oEff >= 1.5 -> "high"
                        oDmgPct <= 35 || oEff <= 0.65 -> "low"
                        else -> "neutral"
                    }
                    mapOf(
                        "name" to oppMetaSlot.name,
                        "code" to abbrPokemon3(oppMetaSlot.name, isSlotShadow),
                        "dmgPct" to oDmgPct,
                        "eff" to oEff,
                        "tier" to tier,
                        "isActive" to (slotIdx == activeOpponentSlotIndex)
                    )
                } else {
                    mapOf(
                        "name" to "—",
                        "code" to "—",
                        "dmgPct" to null,
                        "eff" to 1.0,
                        "tier" to "empty",
                        "isActive" to false
                    )
                }
            }

            mapOf(
                "name" to mName,
                "shortName" to abbrMove5(mName),
                "energy" to mEnergy,
                "myTapsNeeded" to myTapsNeeded,
                "myReadyTurn" to myReadyTurn,
                "dmgPct" to dmgPct,
                "eff" to eff,
                "state" to readyState,
                "safeThrowLabel" to safeThrowLabel,
                "hasZeroSneak" to hasZeroSneak,
                "maxHorizonTurns" to maxHorizonTurns,
                "cycles" to cycles,
                "oppDamages" to oppDamages
            )
        }

        val battlePayload = mapOf(
            "activeOpponent" to oppMeta.name,
            "activeOpponentFastMove" to oppMeta.defaultFastMove,
            "activeOpponentTurns" to oppMeta.fastTurns,
            "oppFastTelemetry" to oppFastTelemetry,
            "userFastTelemetry" to userFastTelemetry,
            "oppCountMode" to oppCountMode,
            "enable4ChargedMoves" to enable4ChargedMoves,
            "overlayTransparencyPct" to overlayTransparencyPct,
            "isOverlayMinimized" to isOverlayMinimized,
            "maxHorizonTurns" to maxHorizonTurns,
            "isOpponentShadow" to isOpponentShadow,
            "currentFormLabel" to oppMeta.formLabel,
            "availableForms" to availableOpponentForms.map { it.formLabel },
            "userActivePokemon" to activePlayerName,
            "activeUserSlotIndex" to activeUserSlotIndex,
            "activeOpponentSlotIndex" to activeOpponentSlotIndex,
            "leadMatchup" to currentLeadMatchup,
            "isBattleActive" to isBattleActive,
            "isReplayMode" to isReplayMode,
            "userFastMoveName" to userFastMoveName,
            "userFastMoveTurns" to userFastTurns,
            "winsCmp" to winsCmp,
            "myMove1Summary" to myMove1Summary,
            "myMove2Summary" to myMove2Summary,
            "throwAlignmentText" to throwAlignmentText,
            "throwHorizonText" to throwHorizonText,
            "playerSwapRemainingSec" to playerSwapRemainingSec,
            "playerSwapEndTimeMs" to playerSwapEndTimeMs,
            "oppSwapRemainingSec" to oppSwapRemainingSec,
            "oppSwapEndTimeMs" to oppSwapEndTimeMs,
            "playerPokeballs" to playerPokeballCount,
            "oppPokeballs" to oppPokeballCount,
            "playerShields" to playerShieldsRemaining,
            "oppShields" to oppShieldsRemaining,
            "player_shields_remaining" to playerShieldsRemaining,
            "opponent_shields_remaining" to oppShieldsRemaining,
            "playerFaintedSlots" to playerFaintedSlots.toList(),
            "oppFaintedSlots" to oppFaintedSlots.toList(),
            "team" to teamData,
            "scannedOpponents" to scannedOpponentsData,
            "oppMoveTimingRows" to oppMoveTimingRows,
            "myMoveTimingRows" to myMoveTimingRows
        )

        return gson.toJson(battlePayload)
    }

    private fun calculateZeroSneakThrows(userTurns: Int, oppTurns: Int): List<Int> {
        val list = mutableListOf<Int>()
        for (attack in 1..10) {
            val totalUserTurns = attack * userTurns
            if (totalUserTurns % oppTurns != 0) {
                list.add(attack)
            }
            if (list.size >= 3) break
        }
        return if (list.isNotEmpty()) list else listOf(1, 3, 5)
    }

    /**
     * Computes 5-tier 0s/1s/2s matchup codes ("SW,W,N,L,SL"):
     * - SW = Strong Win (rating >= 620)
     * - W  = Win (530 <= rating < 620)
     * - N  = Neutral / Grey (470 < rating < 530)
     * - L  = Loss (380 < rating <= 470)
     * - SL = Strong Loss (rating <= 380)
     */
    private fun calculate3v3Matrix(
        oppMeta: PokemonMeta,
        isOppShad: Boolean,
        p1: TeamMember?,
        p2: TeamMember?,
        p3: TeamMember?
    ): Map<String, String> {
        fun evaluateSlot(slot: TeamMember?, fallbackName: String): String {
            val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
            val userName = slot?.name ?: fallbackName
            val isUserShad = userName.contains("Shadow", ignoreCase = true)
            val userMeta = computeEffectiveCombatStats(
                getPokemonMeta(userName, activeLeague, isUserShad),
                activeLeague,
                slot?.cp,
                slot?.ivs
            )

            val uMove1 = slot?.chargedMove1?.takeIf { it.isNotBlank() } ?: userMeta.chargedMove1
            val uMove2 = slot?.chargedMove2?.takeIf { it.isNotBlank() } ?: userMeta.chargedMove2

            val userC1Pct = calculateChargedMoveDamagePercent(userMeta, oppMeta, uMove1, isUserShad, isOppShad)
            val userC2Pct = calculateChargedMoveDamagePercent(userMeta, oppMeta, uMove2, isUserShad, isOppShad)
            val bestUserCharged = max(userC1Pct, userC2Pct)
            val minUserCharged = min(userC1Pct, userC2Pct)

            val oppC1Pct = calculateChargedMoveDamagePercent(oppMeta, userMeta, oppMeta.chargedMove1, isOppShad, isUserShad)
            val oppC2Pct = calculateChargedMoveDamagePercent(oppMeta, userMeta, oppMeta.chargedMove2, isOppShad, isUserShad)
            val bestOppCharged = max(oppC1Pct, oppC2Pct)
            val minOppCharged = min(oppC1Pct, oppC2Pct)

            // Fast move type effectiveness ratio
            val uFastKey = (slot?.fastMove?.takeIf { it.isNotBlank() } ?: userMeta.defaultFastMove).lowercase().trim()
            val oFastKey = oppMeta.defaultFastMove.lowercase().trim()
            val userFastType = DYNAMIC_FAST_TYPE[uFastKey] ?: fastMoveTypeMap[uFastKey] ?: userMeta.types.firstOrNull() ?: "normal"
            val oppFastType = DYNAMIC_FAST_TYPE[oFastKey] ?: fastMoveTypeMap[oFastKey] ?: oppMeta.types.firstOrNull() ?: "normal"
            val userFastEff = getTypeEffectiveness(userFastType, oppMeta.types)
            val oppFastEff = getTypeEffectiveness(oppFastType, userMeta.types)

            val shadowBulkDelta = (if (isUserShad) -12 else 0) + (if (isOppShad) 12 else 0)
            val rating0s = (500.0 + (bestUserCharged - bestOppCharged) * 3.4 + (userFastEff - oppFastEff) * 95.0 + shadowBulkDelta).roundToInt()
            val rating1s = (500.0 + ((bestUserCharged + minUserCharged) * 0.5 - (bestOppCharged + minOppCharged) * 0.5) * 2.8 + (userFastEff - oppFastEff) * 120.0 + shadowBulkDelta).roundToInt()
            val rating2s = (500.0 + (minUserCharged - minOppCharged) * 2.0 + (userFastEff - oppFastEff) * 155.0 + shadowBulkDelta * 2).roundToInt()

            fun toTier(r: Int): String = when {
                r >= 620 -> "SW"
                r >= 530 -> "W"
                r > 470 -> "N"
                r > 380 -> "L"
                else -> "SL"
            }

            return "${toTier(rating0s)},${toTier(rating1s)},${toTier(rating2s)}"
        }

        return mapOf(
            "p1" to evaluateSlot(p1, "Palkia (Origin)"),
            "p2" to evaluateSlot(p2, "Zacian (Crowned)"),
            "p3" to evaluateSlot(p3, "Dialga (Origin)")
        )
    }

    private fun loadInitialDataIntoOverlay() {
        val presets = loadPresets()
        val jsonPresets = gson.toJson(presets)
        Handler(Looper.getMainLooper()).post {
            overlayView?.evaluateJavascript("updatePresets($jsonPresets)", null)
        }
        recalculateAndPushBattleData()
    }

    private fun loadPresets(): List<TeamPreset> {
        val persistentJson = prefs.getString(PREFS_KEY_PERSISTENT_TEAMS, null)
        if (!persistentJson.isNullOrBlank()) {
            val type = object : TypeToken<List<TeamPreset>>() {}.type
            val parsed: List<TeamPreset>? = try { gson.fromJson(persistentJson, type) } catch (_: Exception) { null }
            if (!parsed.isNullOrEmpty()) return parsed
        }
        for (legacyKey in LEGACY_PRESET_KEYS) {
            val legacyJson = prefs.getString(legacyKey, null)
            if (!legacyJson.isNullOrBlank()) {
                val type = object : TypeToken<List<TeamPreset>>() {}.type
                val parsed: List<TeamPreset>? = try { gson.fromJson(legacyJson, type) } catch (_: Exception) { null }
                if (!parsed.isNullOrEmpty()) {
                    prefs.edit().putString(PREFS_KEY_PERSISTENT_TEAMS, legacyJson).apply()
                    return parsed
                }
            }
        }
        return emptyList()
    }

    override fun onDestroy() {
        super.onDestroy()
        battleLoopJob?.cancel()

        try {
            virtualDisplay?.release()
            virtualDisplay = null
            mediaProjection?.stop()
            mediaProjection = null
            imageReader?.close()
            imageReader = null
            imageReaderThread?.quitSafely()
            imageReaderThread = null
            cachedScreenBitmap?.recycle()
            cachedScreenBitmap = null
        } catch (_: Exception) {}

        if (overlayView != null) {
            try {
                windowManager.removeView(overlayView)
            } catch (_: Exception) {}
            overlayView = null
        }
    }

    override fun onBind(intent: Intent): IBinder? {
        super.onBind(intent)
        return null
    }

    /**
     * JavaScript Bridge exposing native Android actions to the HTML HUD
     */
    inner class AndroidBridge {
        @JavascriptInterface
        fun onLayoutSwitched(newMode: String) {
            Handler(Looper.getMainLooper()).post { applyLayoutMode(newMode) }
        }

        @JavascriptInterface
        fun onSelectPreset(presetId: String) {
            val presets = loadPresets()
            val chosen = presets.find { it.id == presetId }
            if (chosen != null) {
                currentPreset = chosen
                activeUserPokemonName = chosen.pokemon.firstOrNull()?.name
                prefs.edit().putString("gbl_selected_preset_id", presetId).apply()
                recalculateAndPushBattleData()
                showBattleToast("Loaded Team: ${chosen.name}")
            }
        }

        @JavascriptInterface
        fun selectActiveUserPokemon(pokemonName: String) {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.selectActiveUserPokemon(pokemonName)
            }
        }

        @JavascriptInterface
        fun startNewBattle() {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.startNewBattle()
            }
        }

        @JavascriptInterface
        fun stopBattle() {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.stopCurrentBattle()
            }
        }

        @JavascriptInterface
        fun logBattleResult(result: String, leadMatchup: String) {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.logBattleResultFromOverlay(result, leadMatchup)
            }
        }

        @JavascriptInterface
        fun setLeadMatchupOverride(leadMatchup: String) {
            Handler(Looper.getMainLooper()).post {
                manualLeadMatchupOverride = leadMatchup.uppercase()
                currentLeadMatchup = manualLeadMatchupOverride ?: "NEUTRAL"
                recalculateAndPushBattleData()
            }
        }

        @JavascriptInterface
        fun toggleOpponentShadow() {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.toggleShadowModifier()
            }
        }

        @JavascriptInterface
        fun cycleOpponentForm() {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.cycleActiveOpponentForm()
            }
        }

        @JavascriptInterface
        fun swapActiveOpponent(pokemonName: String) {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.swapActiveOpponent(pokemonName)
            }
        }

        @JavascriptInterface
        fun minimizeOverlay() {
            Handler(Looper.getMainLooper()).post {
                minimizeOverlayToBubble()
            }
        }

        @JavascriptInterface
        fun restoreOverlay() {
            Handler(Looper.getMainLooper()).post {
                restoreOverlayFromBubble()
            }
        }

        @JavascriptInterface
        fun updateContentHeight(heightDp: Int) {
            if (isOverlayMinimized || currentLayoutMode != "option1") return
            val density = resources.displayMetrics.density
            val targetHeight = (heightDp * density).toInt()
            if (layoutParams.height < 0 || Math.abs(layoutParams.height - targetHeight) > 4) {
                layoutParams.height = targetHeight
                Handler(Looper.getMainLooper()).post {
                    try {
                        windowManager.updateViewLayout(overlayView, layoutParams)
                    } catch (_: Exception) {}
                }
            }
        }

        @JavascriptInterface
        fun onOverlayReady() {
            Handler(Looper.getMainLooper()).post {
                applyOverlayTransparency(overlayTransparencyPct)
                loadInitialDataIntoOverlay()
            }
        }
    }
}
