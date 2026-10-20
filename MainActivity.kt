package com.gbl.overlay

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.util.UUID
import kotlin.math.roundToInt

/**
 * Data model for a custom saved GBL Team Preset
 */
data class PokemonSlot(
    val name: String = "",
    val cp: Int = 1500,
    val fastMove: String = "",
    val chargedMove1: String = "",
    val chargedMove2: String = "",
    val ivs: String? = null
)

data class TeamPreset(
    val id: String = UUID.randomUUID().toString(),
    val name: String = "",
    val league: String = "GREAT LEAGUE", // "MASTER LEAGUE", "ULTRA LEAGUE", "GREAT LEAGUE"
    val pokemon: List<PokemonSlot> = emptyList(),
    val isSelected: Boolean = false,
    val updatedAt: Long = System.currentTimeMillis()
)

data class BattleLogEntry(
    val id: String = UUID.randomUUID().toString(),
    val timestampMs: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val league: String = "GREAT LEAGUE",
    val presetId: String = "",
    val userTeamName: String = "",
    val userPokemon: List<String> = emptyList(),
    val opponents: List<String> = emptyList(),
    val leadMatchup: String = "NEUTRAL",
    val result: String = "WIN",
    val deviceLabel: String = Build.MODEL ?: "Android",
    val bmfScore: Double? = null,
    val execWae: Double? = null,
    val badges: List<String> = emptyList(),
    val flags: List<String> = emptyList(),
    val quality: OverlayService.BattleQualityMetadata? = null,
    val qualityEvaluated: Boolean = false,
    val timelineEvents: List<OverlayService.BattleTimelineEvent> = emptyList(),
    val battleDurationSec: Double? = null,
    val userFaints: Int? = null,
    val oppFaints: Int? = null,
    val userShieldsRemaining: Int? = null,
    val oppShieldsRemaining: Int? = null
)

data class GblSeasonInfo(
    val id: String = "",
    val name: String = "",
    val startMs: Long = 0L,
    val endMs: Long = 0L
)

/**
 * MainActivity handles:
 * 1. Permission checks (SYSTEM_ALERT_WINDOW, POST_NOTIFICATIONS & MediaProjection Screen Capture)
 * 2. Background download & caching of PvPoke gamemaster.json + ScrapedDuck API Season start/end dates
 * 3. Saving, loading, creating, and switching custom GBL Team Presets locally + 2-Device Delta Sync
 * 4. Battle Log analytics, in-app Edit/Delete, Interactive Overlay Replay, and Day/Week/Season/All-Time plain-text export
 */
class MainActivity : AppCompatActivity() {

    private lateinit var prefs: SharedPreferences
    private val gson = Gson()
    private val client = OkHttpClient()

    private var projectionManager: MediaProjectionManager? = null
    private var isOverlayRunning = false

    // UI elements
    private lateinit var statusText: TextView
    private lateinit var dbStatusText: TextView
    private lateinit var btnToggleOverlay: Button
    private lateinit var btnDownloadDb: Button
    private lateinit var btnAddPreset: Button
    private lateinit var btnDonate: Button
    private lateinit var btnNavTeams: Button
    private lateinit var btnNavSettings: Button
    private lateinit var btnNavBattleLog: Button
    private lateinit var pageTeams: android.view.View
    private lateinit var pageSettings: android.view.View
    private lateinit var pageBattleLog: android.view.View
    private lateinit var btnReparseBattlesSettings: Button
    private lateinit var textReparseBattlesStatus: TextView
    private lateinit var btnToggleOppCountBasis: Button
    private lateinit var textOppCountBasisDesc: TextView
    private lateinit var btnToggleOppChargedMoves: Button
    private lateinit var textOppChargedMovesDesc: TextView
    private lateinit var btnToggleBattleToasts: Button
    private lateinit var textBattleToastsDesc: TextView
    private lateinit var seekbarOverlayScale: SeekBar
    private lateinit var textOverlayScaleValue: TextView
    private lateinit var textOverlayScaleDefaultTick: TextView
    private lateinit var seekbarOverlayTransparency: SeekBar
    private lateinit var textOverlayTransparencyValue: TextView
    private lateinit var textOverlayTransparencyDefaultTick: TextView
    private lateinit var btnGithubLoginSettings: Button
    private lateinit var editSyncGithubToken: EditText
    private lateinit var editSyncGistId: EditText
    private lateinit var btnSyncDevicesSettings: Button
    private lateinit var btnSyncBundleSettings: Button
    private lateinit var textSyncStatus: TextView
    private lateinit var textTierDefinitionsSummary: TextView
    private lateinit var editTierSwMin: EditText
    private lateinit var editTierWMin: EditText
    private lateinit var editTierLMax: EditText
    private lateinit var editTierSlMax: EditText
    private lateinit var btnSaveTierThresholds: Button
    private lateinit var btnRestoreTierThresholds: Button
    private lateinit var presetsContainer: LinearLayout
    private lateinit var battleLogContainer: LinearLayout
    private lateinit var textBattleLogTotal: TextView
    private lateinit var textBattleLogLeague: TextView
    private lateinit var textBattleLogWinrate: TextView
    private lateinit var textBattleLogWae: TextView
    private lateinit var textBattleLogLuck: TextView
    private lateinit var btnLogManualBattle: Button
    private lateinit var btnSyncBattleLog: Button
    private lateinit var btnClearBattleLog: Button
    private lateinit var spinnerLogFilterLeague: Spinner
    private lateinit var spinnerLogFilterTeam: Spinner
    private lateinit var spinnerLogFilterTimeframe: Spinner
    private lateinit var btnCopyBattleLog: Button
    private lateinit var btnShareBattleLog: Button
    private lateinit var layoutUndoBanner: LinearLayout
    private lateinit var textUndoBannerMsg: TextView
    private lateinit var btnUndoBannerAction: Button
    private lateinit var btnUndoBannerDismiss: TextView
    private lateinit var btnTrashTeams: Button
    private lateinit var btnTrashBattleLog: Button

    private var pendingUndoAction: (() -> Unit)? = null
    private var undoHideJob: kotlinx.coroutines.Job? = null

    private var selectedLogLeagueFilter: String = "ALL"
    private var selectedLogTeamFilter: String = "ALL"
    private var selectedLogTimeframeFilter: String = "ALL_TIME"
    private var isUpdatingLogFilterSpinners = false

    private val PREFS_KEY_PRESETS = OverlayService.PREFS_KEY_PERSISTENT_TEAMS
    private val PREFS_KEY_SELECTED_PRESET = "gbl_selected_preset_id"
    private val PREFS_KEY_OPP_COUNT_MODE = "opp_count_mode"
    private val PREFS_KEY_ENABLE_4_CHARGED_MOVES = OverlayService.PREFS_KEY_ENABLE_4_CHARGED_MOVES
    private val PREFS_KEY_DISABLE_BATTLE_TOASTS = OverlayService.PREFS_KEY_DISABLE_BATTLE_TOASTS
    private val PREFS_KEY_LAST_SYNC_TIMESTAMP = OverlayService.PREFS_KEY_LAST_SYNC_TIMESTAMP
    private val PREFS_KEY_OVERLAY_SCALE_PCT = "overlay_scale_pct"
    private val DEFAULT_OVERLAY_SCALE_PCT = 78
    private val PREFS_KEY_OVERLAY_TRANSPARENCY_PCT = OverlayService.PREFS_KEY_OVERLAY_TRANSPARENCY_PCT
    private val DEFAULT_OVERLAY_TRANSPARENCY_PCT = 72
    private val PREFS_KEY_BATTLE_LOGS = OverlayService.PREFS_KEY_BATTLE_LOGS
    private val PREFS_KEY_DELETED_LOG_IDS = OverlayService.PREFS_KEY_DELETED_LOG_IDS
    private val PREFS_KEY_DELETED_TEAM_IDS = OverlayService.PREFS_KEY_DELETED_TEAM_IDS
    private val PREFS_KEY_DELETED_BATTLES_TRASH = OverlayService.PREFS_KEY_DELETED_LOGS_TRASH
    private val PREFS_KEY_DELETED_TEAMS_TRASH = OverlayService.PREFS_KEY_DELETED_TEAMS_TRASH
    private val PREFS_KEY_GBL_SEASONS_JSON = OverlayService.PREFS_KEY_GBL_SEASONS_JSON
    private val PREFS_KEY_SYNC_GITHUB_TOKEN = OverlayService.PREFS_KEY_SYNC_GITHUB_TOKEN
    private val PREFS_KEY_SYNC_GITHUB_USERNAME = OverlayService.PREFS_KEY_SYNC_GITHUB_USERNAME
    private val PREFS_KEY_SYNC_GIST_ID = OverlayService.PREFS_KEY_SYNC_GIST_ID
    private val PREFS_KEY_SYNC_LAST_AT = OverlayService.PREFS_KEY_SYNC_LAST_AT
    private val SCRAPEDDUCK_EVENTS_URL = "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json"
    private val DONATION_URL = "https://buymeacoffee.com/sportsfan986"
    private val GAMEMASTER_URL = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json"
    private val RANKINGS_ENDPOINTS = listOf(
        Triple("GREAT LEAGUE", "pvpoke_rankings_gl.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json"),
        Triple("ULTRA LEAGUE", "pvpoke_rankings_ul.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-2500.json"),
        Triple("MASTER LEAGUE", "pvpoke_rankings_ml.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-10000.json"),
        Triple("MEGA MASTER LEAGUE", "pvpoke_rankings_mega_ml.json", "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/mega/overall/rankings-10000.json")
    )

    // Android 13+ Notification permission launcher
    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        proceedWithOverlayCheck()
    }

    // Media projection launcher (with manual mode fallback so the overlay HUD always shows)
    private val screenCaptureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            startOverlayForegroundService(result.resultCode, result.data)
        } else {
            Toast.makeText(this, "Screen capture not active: launching HUD in manual mode", Toast.LENGTH_SHORT).show()
            // Launch overlay HUD even if screen capture was declined
            startOverlayForegroundService(0, null)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Apply system status bar / clock / cutout and navigation bar insets so UI never overlaps top bar
        val rootLayout = findViewById<LinearLayout>(R.id.root_main_layout)
        val density = resources.displayMetrics.density
        val basePad = (16 * density).toInt()
        ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { view, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()
            )
            view.setPadding(
                basePad + insets.left,
                basePad + insets.top,
                basePad + insets.right,
                basePad + insets.bottom
            )
            WindowInsetsCompat.CONSUMED
        }

        prefs = getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager

        initViews()
        ensureDefaultPresets()
        ensureDefaultSeasons()
        migrateExistingBattleLogs()
        refreshPresetsUi()
        setupBattleLogFilters()
        renderBattleLogPage()
        checkGamemasterCache()
        fetchSeasonsFromScrapedDuck()
    }

    override fun onResume() {
        super.onResume()
        if (::prefs.isInitialized) {
            migrateExistingBattleLogs()
            setupBattleLogFilters()
            renderBattleLogPage()
            updateSyncStatusUi()
            checkPendingGitHubDeviceLoginOnResume()
            // Automatically pull & reconcile deltas from the other device on every app open / resume
            triggerTwoDeviceCloudSync(silent = true)
        }
    }

    private fun scalePctToProgress(scalePct: Int): Int {
        val clamped = scalePct.coerceIn(50, 100)
        return ((clamped - 50) / 2).coerceIn(0, 25)
    }

    private fun progressToScalePct(progress: Int): Int {
        return (50 + progress.coerceIn(0, 25) * 2).coerceIn(50, 100)
    }

    private fun transparencyPctToProgress(transparencyPct: Int): Int {
        val clamped = transparencyPct.coerceIn(0, 100)
        return (clamped / 2).coerceIn(0, 50)
    }

    private fun progressToTransparencyPct(progress: Int): Int {
        return (progress.coerceIn(0, 50) * 2).coerceIn(0, 100)
    }

    private fun switchMainPage(page: String) {
        pageTeams.visibility = if (page == "teams") android.view.View.VISIBLE else android.view.View.GONE
        pageSettings.visibility = if (page == "settings") android.view.View.VISIBLE else android.view.View.GONE
        pageBattleLog.visibility = if (page == "battle_log") android.view.View.VISIBLE else android.view.View.GONE

        val activeBg = android.content.res.ColorStateList.valueOf(0xFF0284C7.toInt())
        val inactiveBg = android.content.res.ColorStateList.valueOf(0xFF1E293B.toInt())
        val activeText = 0xFFFFFFFF.toInt()
        val inactiveText = 0xFF94A3B8.toInt()

        btnNavTeams.backgroundTintList = if (page == "teams") activeBg else inactiveBg
        btnNavTeams.setTextColor(if (page == "teams") activeText else inactiveText)

        btnNavSettings.backgroundTintList = if (page == "settings") activeBg else inactiveBg
        btnNavSettings.setTextColor(if (page == "settings") activeText else inactiveText)

        btnNavBattleLog.backgroundTintList = if (page == "battle_log") activeBg else inactiveBg
        btnNavBattleLog.setTextColor(if (page == "battle_log") activeText else inactiveText)

        if (page == "battle_log") {
            renderBattleLogPage()
        }
    }

    private fun initViews() {
        statusText = findViewById(R.id.text_status)
        dbStatusText = findViewById(R.id.text_db_status)
        btnToggleOverlay = findViewById(R.id.btn_toggle_overlay)
        btnDownloadDb = findViewById(R.id.btn_download_db)
        btnAddPreset = findViewById(R.id.btn_add_preset)
        btnDonate = findViewById(R.id.btn_donate)
        btnNavTeams = findViewById(R.id.btn_nav_teams)
        btnNavSettings = findViewById(R.id.btn_nav_settings)
        btnNavBattleLog = findViewById(R.id.btn_nav_battle_log)
        pageTeams = findViewById(R.id.page_teams)
        pageSettings = findViewById(R.id.page_settings)
        pageBattleLog = findViewById(R.id.page_battle_log)
        btnReparseBattlesSettings = findViewById(R.id.btn_reparse_battles_settings)
        textReparseBattlesStatus = findViewById(R.id.text_reparse_battles_status)
        btnToggleOppCountBasis = findViewById(R.id.btn_toggle_opp_count_basis)
        textOppCountBasisDesc = findViewById(R.id.text_opp_count_basis_desc)
        btnToggleOppChargedMoves = findViewById(R.id.btn_toggle_opp_charged_moves)
        textOppChargedMovesDesc = findViewById(R.id.text_opp_charged_moves_desc)
        btnToggleBattleToasts = findViewById(R.id.btn_toggle_battle_toasts)
        textBattleToastsDesc = findViewById(R.id.text_battle_toasts_desc)
        seekbarOverlayScale = findViewById(R.id.seekbar_overlay_scale)
        textOverlayScaleValue = findViewById(R.id.text_overlay_scale_value)
        textOverlayScaleDefaultTick = findViewById(R.id.text_overlay_scale_default_tick)
        seekbarOverlayTransparency = findViewById(R.id.seekbar_overlay_transparency)
        textOverlayTransparencyValue = findViewById(R.id.text_overlay_transparency_value)
        textOverlayTransparencyDefaultTick = findViewById(R.id.text_overlay_transparency_default_tick)
        btnGithubLoginSettings = findViewById(R.id.btn_github_login_settings)
        editSyncGithubToken = findViewById(R.id.edit_sync_github_token)
        editSyncGistId = findViewById(R.id.edit_sync_gist_id)
        btnSyncDevicesSettings = findViewById(R.id.btn_sync_devices_settings)
        btnSyncBundleSettings = findViewById(R.id.btn_sync_bundle_settings)
        textSyncStatus = findViewById(R.id.text_sync_status)
        textTierDefinitionsSummary = findViewById(R.id.text_tier_definitions_summary)
        editTierSwMin = findViewById(R.id.edit_tier_sw_min)
        editTierWMin = findViewById(R.id.edit_tier_w_min)
        editTierLMax = findViewById(R.id.edit_tier_l_max)
        editTierSlMax = findViewById(R.id.edit_tier_sl_max)
        btnSaveTierThresholds = findViewById(R.id.btn_save_tier_thresholds)
        btnRestoreTierThresholds = findViewById(R.id.btn_restore_tier_thresholds)
        presetsContainer = findViewById(R.id.layout_presets_list)
        battleLogContainer = findViewById(R.id.layout_battle_log_list)
        textBattleLogTotal = findViewById(R.id.text_battle_log_total)
        textBattleLogLeague = findViewById(R.id.text_battle_log_league)
        textBattleLogWinrate = findViewById(R.id.text_battle_log_winrate)
        textBattleLogWae = findViewById(R.id.text_battle_log_wae)
        textBattleLogLuck = findViewById(R.id.text_battle_log_luck)
        btnLogManualBattle = findViewById(R.id.btn_log_manual_battle)
        btnSyncBattleLog = findViewById(R.id.btn_sync_battle_log)
        btnClearBattleLog = findViewById(R.id.btn_clear_battle_log)
        spinnerLogFilterLeague = findViewById(R.id.spinner_log_filter_league)
        spinnerLogFilterTeam = findViewById(R.id.spinner_log_filter_team)
        spinnerLogFilterTimeframe = findViewById(R.id.spinner_log_filter_timeframe)
        btnCopyBattleLog = findViewById(R.id.btn_copy_battle_log)
        btnShareBattleLog = findViewById(R.id.btn_share_battle_log)
        layoutUndoBanner = findViewById(R.id.layout_undo_banner)
        textUndoBannerMsg = findViewById(R.id.text_undo_message)
        btnUndoBannerAction = findViewById(R.id.btn_undo_action)
        btnUndoBannerDismiss = findViewById(R.id.btn_undo_dismiss)
        btnTrashTeams = findViewById(R.id.btn_trash_presets)
        btnTrashBattleLog = findViewById(R.id.btn_trash_battle_log)

        btnUndoBannerAction.setOnClickListener {
            val action = pendingUndoAction
            hideUndoBanner()
            action?.invoke()
        }
        btnUndoBannerDismiss.setOnClickListener {
            hideUndoBanner()
        }
        btnTrashTeams.setOnClickListener {
            showTeamsTrashBinDialog()
        }
        btnTrashBattleLog.setOnClickListener {
            showBattleLogsTrashBinDialog()
        }

        btnNavTeams.setOnClickListener { switchMainPage("teams") }
        btnNavSettings.setOnClickListener { switchMainPage("settings") }
        btnNavBattleLog.setOnClickListener { switchMainPage("battle_log") }

        updateOppCountBasisUi()
        updateOppChargedMovesUi()
        updateBattleToastsUi()

        editSyncGithubToken.setText(prefs.getString(PREFS_KEY_SYNC_GITHUB_TOKEN, "") ?: "")
        editSyncGistId.setText(prefs.getString(PREFS_KEY_SYNC_GIST_ID, "") ?: "")
        updateSyncStatusUi()

        btnGithubLoginSettings.setOnClickListener {
            handleGitHubLoginButtonTap()
        }

        btnSyncDevicesSettings.setOnClickListener {
            saveSyncCredentialsFromInputs()
            if (OverlayService.getEffectiveSyncToken(prefs).isEmpty()) {
                startGitHubOAuthDeviceFlow()
            } else {
                triggerTwoDeviceCloudSync(silent = false)
            }
        }

        btnSyncBundleSettings.setOnClickListener {
            showSyncBundleDialog()
        }

        loadAndRenderTierThresholdsUi()
        btnSaveTierThresholds.setOnClickListener {
            saveTierThresholdsFromInputs(showToast = true)
        }
        btnRestoreTierThresholds.setOnClickListener {
            restoreDefaultTierThresholds()
        }

        val savedScalePct = prefs.getInt(PREFS_KEY_OVERLAY_SCALE_PCT, DEFAULT_OVERLAY_SCALE_PCT).coerceIn(50, 100)
        seekbarOverlayScale.progress = scalePctToProgress(savedScalePct)
        updateOverlayScaleUi(progressToScalePct(seekbarOverlayScale.progress))

        val savedTransparencyPct = prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, DEFAULT_OVERLAY_TRANSPARENCY_PCT).coerceIn(0, 100)
        seekbarOverlayTransparency.progress = transparencyPctToProgress(savedTransparencyPct)
        updateOverlayTransparencyUi(progressToTransparencyPct(seekbarOverlayTransparency.progress))

        btnDonate.setOnClickListener {
            try {
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(DONATION_URL))
                startActivity(browserIntent)
            } catch (e: Exception) {
                Toast.makeText(this, "Support at: $DONATION_URL", Toast.LENGTH_LONG).show()
            }
        }

        btnToggleOverlay.setOnClickListener {
            if (isOverlayRunning) {
                stopOverlayService()
            } else {
                checkOverlayPermissionAndStart()
            }
        }

        btnDownloadDb.setOnClickListener {
            downloadPvPokeGamemaster()
        }

        btnReparseBattlesSettings.setOnClickListener {
            reparseAllCompletedBattles(silent = false)
        }

        btnAddPreset.setOnClickListener {
            showPresetEditorDialog(null)
        }

        btnLogManualBattle.setOnClickListener {
            showEditOrCreateBattleLogDialog(null)
        }

        btnSyncBattleLog.setOnClickListener {
            saveSyncCredentialsFromInputs()
            if (OverlayService.getEffectiveSyncToken(prefs).isEmpty()) {
                AlertDialog.Builder(this)
                    .setTitle("☁️ Multi-Device Cloud Sync")
                    .setMessage("Sign in with your GitHub account once on each phone to automatically sync your Battle Logs and Team Presets across all your devices.")
                    .setPositiveButton("🔑 Login with GitHub") { _, _ ->
                        startGitHubOAuthDeviceFlow()
                    }
                    .setNeutralButton("📦 Manual Sync Bundle") { _, _ ->
                        showSyncBundleDialog()
                    }
                    .setNegativeButton("Cancel", null)
                    .show()
            } else {
                triggerTwoDeviceCloudSync(silent = false)
            }
        }

        btnCopyBattleLog.setOnClickListener {
            val allLogs = loadBattleLogs()
            val gblExport = buildCopyGblExport(
                allLogs,
                selectedLogLeagueFilter,
                selectedLogTeamFilter,
                selectedLogTimeframeFilter
            )
            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
            cm.setPrimaryClip(android.content.ClipData.newPlainText("SilphScope Copy GBL", gblExport))
            val count = filterBattleLogs(
                allLogs,
                selectedLogLeagueFilter,
                selectedLogTeamFilter,
                selectedLogTimeframeFilter
            ).size
            Toast.makeText(this, "Copied GBL format ($count battles) to clipboard!", Toast.LENGTH_SHORT).show()
        }

        btnShareBattleLog.setOnClickListener {
            showExportFormatAndTimeframeDialog(isShareIntent = true)
        }

        btnClearBattleLog.setOnClickListener {
            val existing = loadBattleLogs()
            if (existing.isEmpty()) {
                Toast.makeText(this, "Battle log is already empty", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            AlertDialog.Builder(this)
                .setTitle("Move All ${existing.size} Battle Logs to Trash?")
                .setMessage("Cleared battles are moved to the Trash Bin so you can restore them anytime, and tombstones are synced across your devices.")
                .setPositiveButton("Move to Trash") { _, _ ->
                    val trash = loadDeletedBattlesTrash().toMutableList()
                    existing.forEach { item ->
                        trash.removeAll { it.id == item.id }
                        trash.add(0, item)
                    }
                    saveDeletedBattlesTrash(trash)

                    val delIds = loadDeletedLogIds().toMutableSet()
                    existing.forEach { delIds.add(it.id) }
                    saveDeletedLogIds(delIds.toList())
                    prefs.edit().putString(PREFS_KEY_BATTLE_LOGS, "[]").apply()
                    renderBattleLogPage()
                    updateSyncStatusUi()
                    triggerTwoDeviceCloudSync(silent = true)
                    showUndoBanner("🗑️ ${existing.size} battle(s) moved to Trash") {
                        restoreBattleLogsFromTrash(existing)
                        Toast.makeText(this, "Restored ${existing.size} battle(s)!", Toast.LENGTH_SHORT).show()
                    }
                }
                .setNegativeButton("Cancel", null)
                .show()
        }

        btnToggleOppCountBasis.setOnClickListener {
            val currentMode = prefs.getString(PREFS_KEY_OPP_COUNT_MODE, "my_fasts") ?: "my_fasts"
            val nextMode = if (currentMode == "my_fasts") "opp_fasts" else "my_fasts"
            prefs.edit().putString(PREFS_KEY_OPP_COUNT_MODE, nextMode).apply()
            updateOppCountBasisUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_OPP_COUNT_MODE, nextMode)
                }
                startService(updateIntent)
            }
        }

        btnToggleOppChargedMoves.setOnClickListener {
            val currentEnable4 = prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, false)
            val nextEnable4 = !currentEnable4
            prefs.edit().putBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, nextEnable4).apply()
            updateOppChargedMovesUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_ENABLE_4_CHARGED_MOVES, nextEnable4)
                }
                startService(updateIntent)
            }
        }

        btnToggleBattleToasts.setOnClickListener {
            val currentDisable = prefs.getBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, false)
            val nextDisable = !currentDisable
            prefs.edit().putBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, nextDisable).apply()
            updateBattleToastsUi()

            if (isOverlayRunning) {
                val updateIntent = Intent(this, OverlayService::class.java).apply {
                    action = OverlayService.ACTION_UPDATE_SETTINGS
                    putExtra(OverlayService.EXTRA_DISABLE_BATTLE_TOASTS, nextDisable)
                }
                startService(updateIntent)
            }
        }

        seekbarOverlayScale.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val pct = progressToScalePct(progress)
                updateOverlayScaleUi(pct)
                prefs.edit().putInt(PREFS_KEY_OVERLAY_SCALE_PCT, pct).apply()
                if (isOverlayRunning) {
                    val updateIntent = Intent(this@MainActivity, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_UPDATE_SETTINGS
                        putExtra(OverlayService.EXTRA_OVERLAY_SCALE_PCT, pct)
                    }
                    startService(updateIntent)
                }
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        // Clicking the default tick or value label snaps back to 78% (Default)
        val resetToDefaultScale = {
            seekbarOverlayScale.progress = scalePctToProgress(DEFAULT_OVERLAY_SCALE_PCT)
        }
        textOverlayScaleDefaultTick.setOnClickListener { resetToDefaultScale() }
        textOverlayScaleValue.setOnClickListener { resetToDefaultScale() }

        seekbarOverlayTransparency.setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                val pct = progressToTransparencyPct(progress)
                updateOverlayTransparencyUi(pct)
                prefs.edit().putInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, pct).apply()
                if (isOverlayRunning) {
                    val updateIntent = Intent(this@MainActivity, OverlayService::class.java).apply {
                        action = OverlayService.ACTION_UPDATE_SETTINGS
                        putExtra(OverlayService.EXTRA_OVERLAY_TRANSPARENCY_PCT, pct)
                    }
                    startService(updateIntent)
                }
            }

            override fun onStartTrackingTouch(seekBar: SeekBar?) {}
            override fun onStopTrackingTouch(seekBar: SeekBar?) {}
        })

        // Clicking the default tick or value label snaps back to 72% (Default)
        val resetToDefaultTransparency = {
            seekbarOverlayTransparency.progress = transparencyPctToProgress(DEFAULT_OVERLAY_TRANSPARENCY_PCT)
        }
        textOverlayTransparencyDefaultTick.setOnClickListener { resetToDefaultTransparency() }
        textOverlayTransparencyValue.setOnClickListener { resetToDefaultTransparency() }
    }

    private fun updateOverlayScaleUi(scalePct: Int) {
        textOverlayScaleValue.text = if (scalePct == DEFAULT_OVERLAY_SCALE_PCT) {
            "${scalePct}% (Default)"
        } else {
            "${scalePct}%"
        }
    }

    private fun updateOverlayTransparencyUi(transparencyPct: Int) {
        textOverlayTransparencyValue.text = if (transparencyPct == DEFAULT_OVERLAY_TRANSPARENCY_PCT) {
            "${transparencyPct}% (Default)"
        } else {
            "${transparencyPct}%"
        }
    }

    private fun saveSyncCredentialsFromInputs() {
        val tok = editSyncGithubToken.text.toString().trim()
        val gist = editSyncGistId.text.toString().trim()
        val oldTok = prefs.getString(PREFS_KEY_SYNC_GITHUB_TOKEN, "")?.trim().orEmpty()
        val editor = prefs.edit()
            .putString(PREFS_KEY_SYNC_GITHUB_TOKEN, tok)
            .putString(PREFS_KEY_SYNC_GIST_ID, gist)
        if (tok != oldTok) {
            editor.putString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")
        }
        editor.apply()
        updateSyncStatusUi()
    }

    private fun updateSyncStatusUi() {
        val token = OverlayService.getEffectiveSyncToken(prefs)
        val username = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty()
        val lastAt = prefs.getLong(PREFS_KEY_SYNC_LAST_AT, 0L)
        val gistId = prefs.getString(PREFS_KEY_SYNC_GIST_ID, "")?.trim().orEmpty()
        val timeFmt = java.text.SimpleDateFormat("MMM d, h:mm a", java.util.Locale.US)
        val lastStr = if (lastAt > 0L) timeFmt.format(java.util.Date(lastAt)) else "Never"

        if (token.isNotEmpty()) {
            val userLabel = if (username.isNotEmpty()) "@$username" else "GitHub Account"
            btnGithubLoginSettings.text = "✅ Connected: $userLabel (Tap to Manage / Sign Out)"
            btnGithubLoginSettings.backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF059669.toInt())
            val vaultShort = if (gistId.isNotEmpty()) "Gist: ${gistId.take(8)}…" else "Account Vault ($userLabel)"
            textSyncStatus.text = "🟢 Auto-Sync Active ($userLabel) • Last: $lastStr • $vaultShort • Logs: ${loadBattleLogs().size} • Teams: ${loadPresets().size}"
        } else {
            btnGithubLoginSettings.text = "🔑 Login with GitHub (Generate Sync Token)"
            btnGithubLoginSettings.backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF10B981.toInt())
            textSyncStatus.text = "⚪ Not signed in (Local-only) • Tap 'Login with GitHub' to enable multi-device auto-sync"
        }
    }

    private fun handleGitHubLoginButtonTap() {
        val token = OverlayService.getEffectiveSyncToken(prefs)
        val username = prefs.getString(PREFS_KEY_SYNC_GITHUB_USERNAME, "")?.trim().orEmpty()
        if (token.isNotEmpty()) {
            val userDisplay = if (username.isNotEmpty()) "@$username" else "your GitHub account"
            AlertDialog.Builder(this)
                .setTitle("☁️ GitHub Cloud Sync ($userDisplay)")
                .setMessage("Your device is signed in to $userDisplay and automatically syncs Battle Logs & Teams on app open and after every battle.")
                .setPositiveButton("☁️ Sync Now") { _, _ ->
                    triggerTwoDeviceCloudSync(silent = false)
                }
                .setNeutralButton("🔑 Switch Account / Re-Login") { _, _ ->
                    startGitHubOAuthDeviceFlow()
                }
                .setNegativeButton("🔓 Sign Out") { _, _ ->
                    prefs.edit()
                        .remove(PREFS_KEY_SYNC_GITHUB_TOKEN)
                        .remove(PREFS_KEY_SYNC_GITHUB_USERNAME)
                        .remove(PREFS_KEY_SYNC_GIST_ID)
                        .apply()
                    editSyncGithubToken.setText("")
                    editSyncGistId.setText("")
                    updateSyncStatusUi()
                    Toast.makeText(this, "Signed out of GitHub Cloud Sync", Toast.LENGTH_SHORT).show()
                }
                .show()
        } else {
            startGitHubOAuthDeviceFlow()
        }
    }

    private fun startGitHubOAuthDeviceFlow() {
        btnGithubLoginSettings.isEnabled = false
        btnGithubLoginSettings.text = "⏳ Requesting GitHub Login Code..."
        lifecycleScope.launch(Dispatchers.IO) {
            val codeResult = OverlayService.requestGitHubDeviceCodeBlocking()
            withContext(Dispatchers.Main) {
                btnGithubLoginSettings.isEnabled = true
                updateSyncStatusUi()
                codeResult.onFailure { err ->
                    Toast.makeText(
                        this@MainActivity,
                        "Could not start GitHub Login: ${err.localizedMessage ?: "Network error"}",
                        Toast.LENGTH_LONG
                    ).show()
                }.onSuccess { deviceResp ->
                    showGitHubDeviceVerificationDialog(deviceResp)
                }
            }
        }
    }

    private fun checkPendingGitHubDeviceLoginOnResume() {
        if (OverlayService.getEffectiveSyncToken(prefs).isNotEmpty()) return
        val pendingCode = prefs.getString("pending_github_device_code", "")?.trim().orEmpty()
        val expiresAt = prefs.getLong("pending_github_device_expires_at", 0L)
        if (pendingCode.isEmpty() || System.currentTimeMillis() > expiresAt) return

        lifecycleScope.launch(Dispatchers.IO) {
            val (status, tokenOrErr, username) = OverlayService.pollGitHubDeviceTokenOnceBlocking(pendingCode)
            if (status == "SUCCESS" && tokenOrErr.isNotEmpty()) {
                prefs.edit()
                    .remove("pending_github_device_code")
                    .remove("pending_github_device_expires_at")
                    .putString(PREFS_KEY_SYNC_GITHUB_TOKEN, tokenOrErr)
                    .putString(PREFS_KEY_SYNC_GITHUB_USERNAME, username)
                    .apply()
                withContext(Dispatchers.Main) {
                    editSyncGithubToken.setText(tokenOrErr)
                    updateSyncStatusUi()
                    val userTag = if (username.isNotEmpty()) "@$username" else "GitHub"
                    Toast.makeText(
                        this@MainActivity,
                        "✅ Signed in as $userTag! Syncing devices...",
                        Toast.LENGTH_LONG
                    ).show()
                    triggerTwoDeviceCloudSync(silent = false)
                }
            }
        }
    }

    private fun showGitHubDeviceVerificationDialog(deviceResp: OverlayService.Companion.GitHubDeviceCodeResponse) {
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        cm.setPrimaryClip(android.content.ClipData.newPlainText("GitHub Device Code", deviceResp.userCode))
        Toast.makeText(this, "Code ${deviceResp.userCode} copied to clipboard!", Toast.LENGTH_LONG).show()

        val deadlineMs = System.currentTimeMillis() + (deviceResp.expiresIn * 1000L)
        prefs.edit()
            .putString("pending_github_device_code", deviceResp.deviceCode)
            .putLong("pending_github_device_expires_at", deadlineMs)
            .apply()

        var isPollingActive = true
        val statusLabel = TextView(this).apply {
            text = "Your 8-character GitHub Login Code:\n\n" +
                "   👉  ${deviceResp.userCode}  👈\n" +
                "   (Already copied to your clipboard!)\n\n" +
                "1. Tap \"🌐 Open GitHub Login\" below.\n" +
                "2. Paste ${deviceResp.userCode} on GitHub and tap Authorize.\n" +
                "3. Switch back to SilphScope PvP — your token is saved automatically!\n\n" +
                "⏳ Waiting for GitHub authorization..."
            setTextColor(0xFFF8FAFC.toInt())
            setBackgroundColor(0xFF0F172A.toInt())
            textSize = 13f
            val pad = (16 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad, pad, pad)
        }

        val dialog = AlertDialog.Builder(this)
            .setTitle("🔑 Code: ${deviceResp.userCode}")
            .setView(statusLabel)
            .setPositiveButton("🌐 Open GitHub Login", null)
            .setNeutralButton("📋 Copy Code", null)
            .setNegativeButton("Close") { _, _ ->
                isPollingActive = false
            }
            .setOnDismissListener {
                isPollingActive = false
            }
            .create()

        dialog.show()

        dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
            cm.setPrimaryClip(android.content.ClipData.newPlainText("GitHub Device Code", deviceResp.userCode))
            Toast.makeText(this, "Code ${deviceResp.userCode} copied! Paste it on GitHub.", Toast.LENGTH_LONG).show()
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(deviceResp.verificationUri)))
            } catch (_: Exception) {
                Toast.makeText(this, "Open ${deviceResp.verificationUri} in your browser", Toast.LENGTH_LONG).show()
            }
        }

        dialog.getButton(AlertDialog.BUTTON_NEUTRAL).setOnClickListener {
            cm.setPrimaryClip(android.content.ClipData.newPlainText("GitHub Device Code", deviceResp.userCode))
            Toast.makeText(this, "Copied ${deviceResp.userCode}!", Toast.LENGTH_SHORT).show()
        }

        // Poll GitHub OAuth endpoint in background until user authorizes
        lifecycleScope.launch(Dispatchers.IO) {
            var pollIntervalMs = (deviceResp.interval.coerceAtLeast(5)) * 1000L
            while (isPollingActive && System.currentTimeMillis() < deadlineMs) {
                kotlinx.coroutines.delay(pollIntervalMs)
                if (!isPollingActive) break
                val (status, tokenOrErr, username) = OverlayService.pollGitHubDeviceTokenOnceBlocking(deviceResp.deviceCode)
                when (status) {
                    "SUCCESS" -> {
                        isPollingActive = false
                        prefs.edit()
                            .remove("pending_github_device_code")
                            .remove("pending_github_device_expires_at")
                            .putString(PREFS_KEY_SYNC_GITHUB_TOKEN, tokenOrErr)
                            .putString(PREFS_KEY_SYNC_GITHUB_USERNAME, username)
                            .apply()
                        withContext(Dispatchers.Main) {
                            editSyncGithubToken.setText(tokenOrErr)
                            updateSyncStatusUi()
                            if (dialog.isShowing) dialog.dismiss()
                            val userTag = if (username.isNotEmpty()) "@$username" else "GitHub"
                            Toast.makeText(
                                this@MainActivity,
                                "✅ Signed in as $userTag! Syncing devices...",
                                Toast.LENGTH_LONG
                            ).show()
                            triggerTwoDeviceCloudSync(silent = false)
                        }
                        break
                    }
                    "SLOW_DOWN" -> {
                        pollIntervalMs += 5000L
                    }
                    "ERROR" -> {
                        isPollingActive = false
                        withContext(Dispatchers.Main) {
                            statusLabel.text = "❌ GitHub Login failed: $tokenOrErr"
                        }
                        break
                    }
                }
            }
        }
    }

    private fun triggerTwoDeviceCloudSync(silent: Boolean) {
        val tok = OverlayService.getEffectiveSyncToken(prefs)
        if (tok.isEmpty()) {
            if (!silent) {
                Toast.makeText(this, "Tap '🔑 Login with GitHub' in Settings to enable auto-sync", Toast.LENGTH_LONG).show()
            }
            return
        }
        if (!silent) {
            textSyncStatus.text = "☁️ Reconciling deltas with your GitHub cloud vault..."
            btnSyncDevicesSettings.isEnabled = false
            btnSyncBattleLog.isEnabled = false
        }
        lifecycleScope.launch(Dispatchers.IO) {
            val (ok, msg) = OverlayService.syncWithGitHubGistBlocking(prefs, gson)
            withContext(Dispatchers.Main) {
                btnSyncDevicesSettings.isEnabled = true
                btnSyncBattleLog.isEnabled = true
                editSyncGistId.setText(prefs.getString(PREFS_KEY_SYNC_GIST_ID, "") ?: "")
                updateSyncStatusUi()
                refreshPresetsUi()
                setupBattleLogFilters()
                renderBattleLogPage()
                if (!silent) {
                    Toast.makeText(this@MainActivity, msg, Toast.LENGTH_LONG).show()
                } else if (ok && (!msg.contains("+0 from other devices") || !msg.contains("+0 updated"))) {
                    Toast.makeText(this@MainActivity, "☁️ Auto-synced on open: $msg", Toast.LENGTH_SHORT).show()
                }
            }
        }
    }

    private fun showSyncBundleDialog() {
        val localVault = OverlayService.buildLocalSyncVaultPayload(prefs, gson)
        val bundleJson = gson.toJson(localVault)
        val input = EditText(this).apply {
            hint = "Paste Sync Bundle JSON from your other device here..."
            setTextColor(0xFFF8FAFC.toInt())
            setHintTextColor(0xFF64748B.toInt())
            setBackgroundColor(0xFF0F172A.toInt())
            textSize = 11f
            minLines = 4
            maxLines = 8
            val pad = (10 * resources.displayMetrics.density).toInt()
            setPadding(pad, pad, pad, pad)
        }
        AlertDialog.Builder(this)
            .setTitle("📦 Two-Device Delta Sync Bundle")
            .setMessage("Copy this device's Sync Bundle to share with your second device, or paste a Sync Bundle below to reconcile deltas (Logs + Teams):")
            .setView(input)
            .setPositiveButton("Merge Pasted Bundle") { _, _ ->
                val raw = input.text.toString().trim()
                if (raw.isEmpty()) {
                    Toast.makeText(this, "Paste a Sync Bundle JSON first", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                try {
                    val incoming = gson.fromJson(raw, OverlayService.Companion.SyncVaultPayload::class.java)
                    if (incoming == null) throw Exception("Invalid JSON")
                    val (merged, newLogs, newTeams) = OverlayService.reconcileSyncVaultPayloads(localVault, incoming)
                    OverlayService.saveReconciledSyncVaultLocally(prefs, gson, merged)
                    refreshPresetsUi()
                    setupBattleLogFilters()
                    renderBattleLogPage()
                    updateSyncStatusUi()
                    Toast.makeText(
                        this,
                        "Reconciled! +$newLogs battles & +$newTeams teams merged.",
                        Toast.LENGTH_LONG
                    ).show()
                } catch (e: Exception) {
                    Toast.makeText(this, "Invalid Sync Bundle: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
                }
            }
            .setNeutralButton("📋 Copy My Bundle") { _, _ ->
                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                cm.setPrimaryClip(android.content.ClipData.newPlainText("SilphScope PvP Sync Bundle", bundleJson))
                Toast.makeText(this, "Sync Bundle copied to clipboard!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun parseIsoDateMs(isoStr: String?): Long? {
        if (isoStr.isNullOrBlank()) return null
        val clean = isoStr.trim()
        val patterns = listOf(
            "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
            "yyyy-MM-dd'T'HH:mm:ss.SSS",
            "yyyy-MM-dd'T'HH:mm:ss'Z'",
            "yyyy-MM-dd'T'HH:mm:ss",
            "yyyy-MM-dd"
        )
        for (pat in patterns) {
            try {
                val sdf = java.text.SimpleDateFormat(pat, java.util.Locale.US)
                if (clean.endsWith("Z")) {
                    sdf.timeZone = java.util.TimeZone.getTimeZone("UTC")
                }
                val d = sdf.parse(clean)
                if (d != null) return d.time
            } catch (_: Exception) {}
        }
        return null
    }

    private fun ensureDefaultSeasons() {
        val existing = loadSeasons()
        if (existing.isEmpty()) {
            val defaults = getDefaultSeededSeasons()
            saveSeasons(defaults)
        }
    }

    private fun getDefaultSeededSeasons(): List<GblSeasonInfo> {
        return listOf(
            GblSeasonInfo(
                id = "season-21-max-out",
                name = "Max Out",
                startMs = parseIsoDateMs("2024-09-03T10:00:00.000") ?: 1725357600000L,
                endMs = parseIsoDateMs("2024-12-03T10:00:00.000") ?: 1733220000000L
            ),
            GblSeasonInfo(
                id = "season-22-dual-destiny",
                name = "Dual Destiny",
                startMs = parseIsoDateMs("2024-12-03T10:00:00.000") ?: 1733220000000L,
                endMs = parseIsoDateMs("2025-03-04T10:00:00.000") ?: 1741082400000L
            ),
            GblSeasonInfo(
                id = "season-23-summer-2026",
                name = "Previous GBL Season",
                startMs = parseIsoDateMs("2026-06-01T10:00:00.000") ?: 1780308000000L,
                endMs = parseIsoDateMs("2026-09-08T10:00:00.000") ?: 1788861600000L
            ),
            GblSeasonInfo(
                id = "season-24-twilight-trails",
                name = "Twilight Trails",
                startMs = parseIsoDateMs("2026-09-08T10:00:00.000") ?: 1788861600000L,
                endMs = parseIsoDateMs("2026-12-01T10:00:00.000") ?: 1796119200000L
            )
        )
    }

    private fun loadSeasons(): List<GblSeasonInfo> {
        val raw = prefs.getString(PREFS_KEY_GBL_SEASONS_JSON, null)
        if (!raw.isNullOrBlank()) {
            try {
                val type = object : TypeToken<List<GblSeasonInfo>>() {}.type
                val parsed: List<GblSeasonInfo>? = gson.fromJson(raw, type)
                if (!parsed.isNullOrEmpty()) return parsed.sortedBy { it.startMs }
            } catch (_: Exception) {}
        }
        return getDefaultSeededSeasons().sortedBy { it.startMs }
    }

    private fun saveSeasons(seasons: List<GblSeasonInfo>) {
        prefs.edit().putString(PREFS_KEY_GBL_SEASONS_JSON, gson.toJson(seasons.sortedBy { it.startMs })).apply()
    }

    private fun fetchSeasonsFromScrapedDuck() {
        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val req = Request.Builder().url(SCRAPEDDUCK_EVENTS_URL).build()
                client.newCall(req).execute().use { resp ->
                    if (!resp.isSuccessful) return@use
                    val body = resp.body?.string() ?: return@use
                    val arr = com.google.gson.JsonParser.parseString(body).asJsonArray
                    val currentList = loadSeasons().toMutableList()
                    var didUpdate = false

                    for (el in arr) {
                        val obj = el.asJsonObject
                        val eventType = obj.get("eventType")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                        val heading = obj.get("heading")?.takeIf { !it.isJsonNull }?.asString.orEmpty()
                        if (eventType.equals("season", ignoreCase = true) || heading.equals("Season", ignoreCase = true)) {
                            val id = obj.get("eventID")?.takeIf { !it.isJsonNull }?.asString ?: "scraped-season"
                            val name = obj.get("name")?.takeIf { !it.isJsonNull }?.asString ?: "Current Season"
                            val startStr = obj.get("start")?.takeIf { !it.isJsonNull }?.asString
                            val endStr = obj.get("end")?.takeIf { !it.isJsonNull }?.asString
                            val startMs = parseIsoDateMs(startStr)
                            val endMs = parseIsoDateMs(endStr)
                            if (startMs != null && endMs != null && endMs > startMs) {
                                val scraped = GblSeasonInfo(id = id, name = name, startMs = startMs, endMs = endMs)
                                val existingIdx = currentList.indexOfFirst {
                                    it.id.equals(id, ignoreCase = true) || kotlin.math.abs(it.startMs - startMs) < 86400000L * 5
                                }
                                if (existingIdx >= 0) {
                                    currentList[existingIdx] = scraped
                                } else {
                                    currentList.add(scraped)
                                }
                                // Ensure a Previous Season window exists immediately prior to startMs (approx 90 days)
                                val ninetyDaysMs = 90L * 24L * 3600L * 1000L
                                val hasPrev = currentList.any { it.endMs in (startMs - 86400000L * 7)..(startMs + 86400000L * 2) && it.startMs < startMs }
                                if (!hasPrev) {
                                    currentList.add(
                                        GblSeasonInfo(
                                            id = "prev-to-$id",
                                            name = "Previous GBL Season",
                                            startMs = startMs - ninetyDaysMs,
                                            endMs = startMs
                                        )
                                    )
                                }
                                didUpdate = true
                            }
                        }
                    }

                    if (didUpdate) {
                        saveSeasons(currentList)
                        withContext(Dispatchers.Main) {
                            setupBattleLogFilters()
                            renderBattleLogPage()
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    private fun getCurrentAndPreviousSeason(): Pair<GblSeasonInfo, GblSeasonInfo> {
        val sorted = loadSeasons().sortedBy { it.startMs }
        val now = System.currentTimeMillis()
        val currentIdx = sorted.indexOfLast { now >= it.startMs && now <= it.endMs }
            .takeIf { it >= 0 } ?: sorted.lastIndex.coerceAtLeast(0)
        val current = sorted.getOrElse(currentIdx) {
            GblSeasonInfo("season-curr", "Current Season", now - 45L * 86400000L, now + 45L * 86400000L)
        }
        val prev = if (currentIdx > 0) {
            sorted[currentIdx - 1]
        } else {
            val ninetyDaysMs = 90L * 86400000L
            GblSeasonInfo("season-prev", "Previous Season", current.startMs - ninetyDaysMs, current.startMs)
        }
        return current to prev
    }

    private fun loadBattleLogs(): List<BattleLogEntry> {
        val raw = prefs.getString(PREFS_KEY_BATTLE_LOGS, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<BattleLogEntry>>() {}.type
            val parsed: List<BattleLogEntry> = gson.fromJson<List<BattleLogEntry>>(raw, type) ?: emptyList()
            val deleted = loadDeletedLogIds().toSet()
            parsed.filter { it.id !in deleted }.sortedByDescending { it.timestampMs }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveBattleLogs(logs: List<BattleLogEntry>) {
        prefs.edit().putString(PREFS_KEY_BATTLE_LOGS, gson.toJson(logs.sortedByDescending { it.timestampMs })).apply()
    }

    /**
     * Phase 3 Retroactive Data Migration Routine:
     * Iterates through all historical matches in SharedPreferences (active + trash).
     * - If `oppTeam.firstSwap` (2nd opponent) is missing, marks as unranked (`bmfScore = null`, `execWae = null`, `quality = null`).
     * - If team data exists, calculates BMF (P_pre), Dynamic Execution WAE (Delta_Q_final),
     *   and attaches applicable Primary Performance Badges and Contextual Event Flags.
     * - Persists updated records back to storage without data loss.
     */
    private fun migrateExistingBattleLogs() {
        val reparseVer = prefs.getInt("damage_reparse_version", 0)
        if (reparseVer < 215) {
            reparseAllCompletedBattles(silent = true)
            prefs.edit()
                .putInt("damage_reparse_version", 293)
                .putInt("phase3_migration_version", 293)
                .apply()
            return
        }

        val phase3Migrated = prefs.getInt("phase3_migration_version", 0) >= 293
        val presets = loadPresets()

        fun migrateEntryList(rawJson: String?): Pair<List<BattleLogEntry>?, Boolean> {
            if (rawJson.isNullOrBlank()) return null to false
            return try {
                val type = object : TypeToken<List<BattleLogEntry>>() {}.type
                val parsed: List<BattleLogEntry> = gson.fromJson<List<BattleLogEntry>>(rawJson, type) ?: return null to false
                if (parsed.isEmpty()) return parsed to false

                var didMutate = false
                val migrated = parsed.map { entry ->
                    val firstSwap = entry.opponents.getOrNull(1)?.trim().orEmpty()
                    val isMissingFirstSwap = firstSwap.isEmpty()

                    val alreadyValidUnranked =
                        phase3Migrated && isMissingFirstSwap && entry.qualityEvaluated && entry.quality == null && entry.bmfScore == null && entry.execWae == null
                    val alreadyValidRanked =
                        phase3Migrated && !isMissingFirstSwap && entry.quality != null && entry.bmfScore != null && entry.execWae != null

                    if (alreadyValidUnranked || alreadyValidRanked) {
                        entry
                    } else {
                        didMutate = true
                        if (isMissingFirstSwap) {
                            entry.copy(
                                bmfScore = null,
                                execWae = null,
                                badges = emptyList(),
                                flags = emptyList(),
                                quality = null,
                                qualityEvaluated = true
                            )
                        } else {
                            val computed = resolveEntryQuality(entry, presets, forceRecalculate = true)
                            entry.copy(
                                bmfScore = computed?.pPre,
                                execWae = computed?.execWae,
                                badges = computed?.badges ?: if (computed != null) listOf(computed.badgeLabel) else emptyList(),
                                flags = computed?.contextualFlags ?: emptyList(),
                                quality = computed,
                                qualityEvaluated = true
                            )
                        }
                    }
                }
                migrated to didMutate
            } catch (_: Exception) {
                null to false
            }
        }

        val (migratedActive, activeMutated) = migrateEntryList(prefs.getString(PREFS_KEY_BATTLE_LOGS, null))
        val (migratedTrash, trashMutated) = migrateEntryList(prefs.getString(PREFS_KEY_DELETED_BATTLES_TRASH, null))

        val editor = prefs.edit()
        if (activeMutated && migratedActive != null) {
            editor.putString(PREFS_KEY_BATTLE_LOGS, gson.toJson(migratedActive))
        }
        if (trashMutated && migratedTrash != null) {
            editor.putString(PREFS_KEY_DELETED_BATTLES_TRASH, gson.toJson(migratedTrash))
        }
        if (!phase3Migrated || activeMutated || trashMutated) {
            editor.putInt("phase3_migration_version", 293)
            editor.apply()
        }
    }

    /**
     * Re-evaluates all completed battles (and trash battles) from scratch using the latest
     * damage multipliers (2.56x dual-type effectiveness, 1.2x Shadow attack, half-level CPM stats)
     * and recalculates Lead Matchup (Favorable/Neutral/Negative), BMF (P_pre),
     * Dynamic Execution WAE (Delta_Q_final), Primary Performance Badges, and Contextual Flags.
     */
    private fun reparseAllCompletedBattles(silent: Boolean) {
        try {
            val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
            if (cacheFile.exists() && cacheFile.length() > 1000 && OverlayService.DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                OverlayService.parseGamemasterJsonStatic(cacheFile.readText())
            }
            for ((leagueKey, fileName, _) in RANKINGS_ENDPOINTS) {
                val rFile = File(filesDir, fileName)
                if (rFile.exists() && rFile.length() > 200 && OverlayService.getLeagueRankingsCount(leagueKey) == 0) {
                    OverlayService.parseRankingsJsonStatic(leagueKey, rFile.readText())
                }
            }
        } catch (_: Exception) {}

        val presets = loadPresets()
        val nowMs = System.currentTimeMillis()

        fun reparseEntry(entry: BattleLogEntry): BattleLogEntry {
            val matchedPreset = presets.find {
                (entry.presetId.isNotBlank() && it.id == entry.presetId) ||
                    it.name.equals(entry.userTeamName, ignoreCase = true)
            }
            val myMons = if (entry.userPokemon.size >= 3) {
                entry.userPokemon
            } else if (matchedPreset != null && matchedPreset.pokemon.isNotEmpty()) {
                matchedPreset.pokemon.map { it.name }
            } else {
                entry.userPokemon
            }
            val leadSlot = matchedPreset?.pokemon?.firstOrNull()
            val myLeadName = myMons.firstOrNull()?.trim().orEmpty()
            val oppLeadName = entry.opponents.firstOrNull()?.trim().orEmpty()
            val updatedLead = if (myLeadName.isNotEmpty() && oppLeadName.isNotEmpty()) {
                OverlayService.calculateAutoLeadMatchupStatic(
                    myLead = myLeadName,
                    oppLead = oppLeadName,
                    league = entry.league,
                    myFastMove = leadSlot?.fastMove,
                    myCharged1 = leadSlot?.chargedMove1,
                    myCharged2 = leadSlot?.chargedMove2,
                    myCp = leadSlot?.cp,
                    myIvs = leadSlot?.ivs
                )
            } else {
                entry.leadMatchup
            }
            val freshQuality = resolveEntryQuality(entry, presets, forceRecalculate = true)
            return entry.copy(
                userPokemon = if (entry.userPokemon.isEmpty() && myMons.isNotEmpty()) myMons else entry.userPokemon,
                leadMatchup = updatedLead,
                bmfScore = freshQuality?.pPre,
                execWae = freshQuality?.execWae,
                badges = freshQuality?.badges ?: if (freshQuality != null) listOf(freshQuality.badgeLabel) else emptyList(),
                flags = freshQuality?.contextualFlags ?: emptyList(),
                quality = freshQuality,
                qualityEvaluated = true,
                updatedAt = nowMs
            )
        }

        val activeLogs = loadBattleLogs()
        val reparsedActive = activeLogs.map { reparseEntry(it) }
        if (reparsedActive.isNotEmpty()) {
            saveBattleLogs(reparsedActive)
        }

        val trashLogs = loadDeletedBattlesTrash()
        if (trashLogs.isNotEmpty()) {
            val reparsedTrash = trashLogs.map { reparseEntry(it) }
            saveDeletedBattlesTrash(reparsedTrash)
        }

        val aggWae = OverlayService.calculateAggregateWAEStatic(reparsedActive.map { it.quality })
        if (::textReparseBattlesStatus.isInitialized) {
            val timeFmt = java.text.SimpleDateFormat("h:mm a", java.util.Locale.US).format(java.util.Date(nowMs))
            textReparseBattlesStatus.text = "✅ Reparsed ${reparsedActive.size} battle(s) at $timeFmt • Ranked: ${aggWae.rankedCount} • Exec WAE: ${aggWae.formatted} • Luck: ${aggWae.luckFormatted}"
        }

        renderBattleLogPage()
        updateSyncStatusUi()

        if (!silent) {
            Toast.makeText(
                this,
                "✅ Reparsed ${reparsedActive.size} completed battle(s) (Exec WAE: ${aggWae.formatted} • Luck: ${aggWae.luckFormatted})!",
                Toast.LENGTH_LONG
            ).show()
            triggerTwoDeviceCloudSync(silent = true)
        }
    }

    @Suppress("USELESS_ELVIS")
    private fun resolveEntryQuality(
        entry: BattleLogEntry,
        presets: List<TeamPreset>,
        forceRecalculate: Boolean = false
    ): OverlayService.BattleQualityMetadata? {
        if (!forceRecalculate) {
            if (entry.quality != null) return entry.quality
            if (entry.qualityEvaluated) return null
        }

        val oppsList = entry.opponents ?: emptyList()
        val firstSwap = oppsList.getOrNull(1)?.trim().orEmpty()
        if (firstSwap.isEmpty()) return null

        val safePresetId = entry.presetId ?: ""
        val safeUserTeamName = entry.userTeamName ?: ""
        val matchedPreset = presets.find {
            (safePresetId.isNotBlank() && it.id == safePresetId) ||
                it.name.equals(safeUserTeamName, ignoreCase = true)
        }
        val safeUserMons = entry.userPokemon ?: emptyList()
        val myMons = if (safeUserMons.size >= 3) {
            safeUserMons
        } else if (matchedPreset != null && matchedPreset.pokemon.isNotEmpty()) {
            matchedPreset.pokemon.map { it.name }
        } else {
            safeUserMons
        }
        val serviceSlots = matchedPreset?.pokemon?.map {
            OverlayService.TeamMember(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs)
        }
        val safeTimeline = entry.timelineEvents ?: emptyList()
        val hasTimeline = safeTimeline.isNotEmpty()
        return OverlayService.calculateBattleQuality(
            myTeam = myMons,
            oppTeam = oppsList,
            league = entry.league ?: "GREAT LEAGUE",
            result = entry.result ?: "WIN",
            myTeamSlots = serviceSlots,
            timelineEvents = safeTimeline.takeIf { it.isNotEmpty() },
            totalDurationSec = entry.battleDurationSec,
            explicitUserFaints = entry.userFaints ?: (if (hasTimeline) entry.quality?.userFaints else null),
            explicitOppFaints = entry.oppFaints ?: (if (hasTimeline) entry.quality?.oppFaints else null),
            explicitUserShieldsRemaining = entry.userShieldsRemaining ?: (if (hasTimeline) entry.quality?.userShieldsRemaining else null),
            explicitOppShieldsRemaining = entry.oppShieldsRemaining ?: (if (hasTimeline) entry.quality?.oppShieldsRemaining else null)
        )
    }

    private fun loadDeletedLogIds(): List<String> {
        val raw = prefs.getString(PREFS_KEY_DELETED_LOG_IDS, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<String>>() {}.type
            gson.fromJson<List<String>>(raw, type) ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }

    private fun saveDeletedLogIds(ids: List<String>) {
        prefs.edit().putString(PREFS_KEY_DELETED_LOG_IDS, gson.toJson(ids.distinct())).apply()
    }

    private fun loadDeletedTeamIds(): List<String> {
        val raw = prefs.getString(PREFS_KEY_DELETED_TEAM_IDS, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<String>>() {}.type
            gson.fromJson<List<String>>(raw, type) ?: emptyList()
        } catch (_: Exception) { emptyList() }
    }

    private fun saveDeletedTeamIds(ids: List<String>) {
        prefs.edit().putString(PREFS_KEY_DELETED_TEAM_IDS, gson.toJson(ids.distinct())).apply()
    }

    private fun loadDeletedBattlesTrash(): List<BattleLogEntry> {
        val raw = prefs.getString(PREFS_KEY_DELETED_BATTLES_TRASH, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<BattleLogEntry>>() {}.type
            (gson.fromJson<List<BattleLogEntry>>(raw, type) ?: emptyList()).distinctBy { it.id }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveDeletedBattlesTrash(logs: List<BattleLogEntry>) {
        val trimmed = logs.distinctBy { it.id }.take(200)
        prefs.edit().putString(PREFS_KEY_DELETED_BATTLES_TRASH, gson.toJson(trimmed)).apply()
        updateTrashButtonsUi()
    }

    private fun loadDeletedTeamsTrash(): List<TeamPreset> {
        val raw = prefs.getString(PREFS_KEY_DELETED_TEAMS_TRASH, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<TeamPreset>>() {}.type
            (gson.fromJson<List<TeamPreset>>(raw, type) ?: emptyList()).distinctBy { it.id }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun saveDeletedTeamsTrash(teams: List<TeamPreset>) {
        val trimmed = teams.distinctBy { it.id }.take(50)
        prefs.edit().putString(PREFS_KEY_DELETED_TEAMS_TRASH, gson.toJson(trimmed)).apply()
        updateTrashButtonsUi()
    }

    private fun updateTrashButtonsUi() {
        if (::btnTrashTeams.isInitialized) {
            val count = loadDeletedTeamsTrash().size
            btnTrashTeams.text = if (count > 0) "🗑️ Trash ($count)" else "🗑️ Trash"
        }
        if (::btnTrashBattleLog.isInitialized) {
            val count = loadDeletedBattlesTrash().size
            btnTrashBattleLog.text = if (count > 0) "🗑️ Trash ($count)" else "🗑️ Trash"
        }
    }

    private fun showUndoBanner(message: String, onUndo: () -> Unit) {
        if (!::layoutUndoBanner.isInitialized) return
        undoHideJob?.cancel()
        pendingUndoAction = onUndo
        textUndoBannerMsg.text = message
        layoutUndoBanner.visibility = android.view.View.VISIBLE
        undoHideJob = lifecycleScope.launch {
            kotlinx.coroutines.delay(9000L)
            hideUndoBanner()
        }
    }

    private fun hideUndoBanner() {
        undoHideJob?.cancel()
        undoHideJob = null
        pendingUndoAction = null
        if (::layoutUndoBanner.isInitialized) {
            layoutUndoBanner.visibility = android.view.View.GONE
        }
    }

    private fun restoreBattleLogsFromTrash(entriesToRestore: List<BattleLogEntry>) {
        if (entriesToRestore.isEmpty()) return
        val nowMs = System.currentTimeMillis()
        val restoreIds = entriesToRestore.map { it.id }.toSet()

        val remainingDelIds = loadDeletedLogIds().filter { it !in restoreIds }
        saveDeletedLogIds(remainingDelIds)

        val remainingTrash = loadDeletedBattlesTrash().filter { it.id !in restoreIds }
        saveDeletedBattlesTrash(remainingTrash)

        val currentLogs = loadBattleLogs().toMutableList()
        for (entry in entriesToRestore) {
            currentLogs.removeAll { it.id == entry.id }
            currentLogs.add(entry.copy(updatedAt = nowMs))
        }
        saveBattleLogs(currentLogs)
        setupBattleLogFilters()
        renderBattleLogPage()
        updateSyncStatusUi()
        triggerTwoDeviceCloudSync(silent = true)
    }

    private fun restoreTeamPresetFromTrash(preset: TeamPreset) {
        val nowMs = System.currentTimeMillis()
        val remainingDelIds = loadDeletedTeamIds().filter { it != preset.id }
        saveDeletedTeamIds(remainingDelIds)

        val remainingTrash = loadDeletedTeamsTrash().filter { it.id != preset.id }
        saveDeletedTeamsTrash(remainingTrash)

        val currentPresets = loadPresets().toMutableList()
        currentPresets.removeAll { it.id == preset.id }
        currentPresets.add(preset.copy(updatedAt = nowMs))
        savePresets(currentPresets)
        refreshPresetsUi()
        setupBattleLogFilters()
        updateSyncStatusUi()
        triggerTwoDeviceCloudSync(silent = true)
    }

    private fun showTeamsTrashBinDialog() {
        val trashList = loadDeletedTeamsTrash()
        if (trashList.isEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("🗑️ Deleted Teams Trash Bin")
                .setMessage("No deleted teams in Trash. Any team you delete will appear here so you can restore it anytime.")
                .setPositiveButton("OK", null)
                .show()
            return
        }

        val density = resources.displayMetrics.density
        val scroll = ScrollView(this)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF0F172A.toInt())
            val pad = (12 * density).toInt()
            setPadding(pad, pad, pad, pad)
        }
        scroll.addView(container)

        var dialogRef: AlertDialog? = null

        for (team in trashList) {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF1E293B.toInt())
                val pad = (10 * density).toInt()
                setPadding(pad, pad, pad, pad)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = (8 * density).toInt()
                }
            }
            val titleTv = TextView(this).apply {
                text = "${team.name} (${team.league})"
                setTextColor(0xFFF8FAFC.toInt())
                textSize = 13f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            val monsTv = TextView(this).apply {
                text = team.pokemon.joinToString(" / ") { it.name }
                setTextColor(0xFF94A3B8.toInt())
                textSize = 11.5f
                setPadding(0, (3 * density).toInt(), 0, (6 * density).toInt())
            }
            val btnRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.END
            }
            val restoreBtn = Button(this).apply {
                text = "♻️ Restore Team"
                textSize = 11f
                setTextColor(0xFFFFFFFF.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF059669.toInt())
                setOnClickListener {
                    restoreTeamPresetFromTrash(team)
                    Toast.makeText(this@MainActivity, "Restored '${team.name}'!", Toast.LENGTH_SHORT).show()
                    dialogRef?.dismiss()
                }
            }
            val deleteForeverBtn = Button(this).apply {
                text = "✕ Delete Forever"
                textSize = 11f
                setTextColor(0xFFFCA5A5.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF450A0A.toInt())
                setOnClickListener {
                    saveDeletedTeamsTrash(loadDeletedTeamsTrash().filter { it.id != team.id })
                    dialogRef?.dismiss()
                    showTeamsTrashBinDialog()
                }
            }
            btnRow.addView(restoreBtn)
            btnRow.addView(deleteForeverBtn)
            card.addView(titleTv)
            card.addView(monsTv)
            card.addView(btnRow)
            container.addView(card)
        }

        dialogRef = AlertDialog.Builder(this)
            .setTitle("🗑️ Deleted Teams (${trashList.size})")
            .setView(scroll)
            .setPositiveButton("♻️ Restore All") { _, _ ->
                trashList.forEach { restoreTeamPresetFromTrash(it) }
                Toast.makeText(this, "Restored ${trashList.size} team(s)!", Toast.LENGTH_SHORT).show()
            }
            .setNeutralButton("🗑️ Empty Trash") { _, _ ->
                saveDeletedTeamsTrash(emptyList())
                Toast.makeText(this, "Team trash emptied", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Close", null)
            .create()
        dialogRef.show()
    }

    private fun showBattleLogsTrashBinDialog() {
        val trashList = loadDeletedBattlesTrash()
        if (trashList.isEmpty()) {
            AlertDialog.Builder(this)
                .setTitle("🗑️ Deleted Battles Trash Bin")
                .setMessage("No deleted battles in Trash. Any battle you delete or clear will appear here so you can restore it anytime.")
                .setPositiveButton("OK", null)
                .show()
            return
        }

        val density = resources.displayMetrics.density
        val scroll = ScrollView(this)
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF0F172A.toInt())
            val pad = (12 * density).toInt()
            setPadding(pad, pad, pad, pad)
        }
        scroll.addView(container)

        val dateFmt = java.text.SimpleDateFormat("MMM d, h:mm a", java.util.Locale.US)
        var dialogRef: AlertDialog? = null

        for (entry in trashList) {
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF1E293B.toInt())
                val pad = (10 * density).toInt()
                setPadding(pad, pad, pad, pad)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = (8 * density).toInt()
                }
            }
            val isWin = entry.result.equals("WIN", ignoreCase = true)
            val titleTv = TextView(this).apply {
                text = "${if (isWin) "🏆 WIN" else "💀 LOSS"} • ${entry.userTeamName} (${ dateFmt.format(java.util.Date(entry.timestampMs)) })"
                setTextColor(if (isWin) 0xFF4ADE80.toInt() else 0xFFF87171.toInt())
                textSize = 12.5f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            val oppsTv = TextView(this).apply {
                text = "Vs: ${if (entry.opponents.isEmpty()) "Unknown" else entry.opponents.joinToString(", ")}"
                setTextColor(0xFFE2E8F0.toInt())
                textSize = 11.5f
                setPadding(0, (3 * density).toInt(), 0, (6 * density).toInt())
            }
            val btnRow = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = android.view.Gravity.END
            }
            val restoreBtn = Button(this).apply {
                text = "♻️ Restore"
                textSize = 11f
                setTextColor(0xFFFFFFFF.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF059669.toInt())
                setOnClickListener {
                    restoreBattleLogsFromTrash(listOf(entry))
                    Toast.makeText(this@MainActivity, "Battle restored!", Toast.LENGTH_SHORT).show()
                    dialogRef?.dismiss()
                }
            }
            val deleteForeverBtn = Button(this).apply {
                text = "✕ Delete Forever"
                textSize = 11f
                setTextColor(0xFFFCA5A5.toInt())
                backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF450A0A.toInt())
                setOnClickListener {
                    saveDeletedBattlesTrash(loadDeletedBattlesTrash().filter { it.id != entry.id })
                    dialogRef?.dismiss()
                    showBattleLogsTrashBinDialog()
                }
            }
            btnRow.addView(restoreBtn)
            btnRow.addView(deleteForeverBtn)
            card.addView(titleTv)
            card.addView(oppsTv)
            card.addView(btnRow)
            container.addView(card)
        }

        dialogRef = AlertDialog.Builder(this)
            .setTitle("🗑️ Deleted Battles (${trashList.size})")
            .setView(scroll)
            .setPositiveButton("♻️ Restore All (${trashList.size})") { _, _ ->
                restoreBattleLogsFromTrash(trashList)
                Toast.makeText(this, "Restored ${trashList.size} battle(s)!", Toast.LENGTH_SHORT).show()
            }
            .setNeutralButton("🗑️ Empty Trash") { _, _ ->
                saveDeletedBattlesTrash(emptyList())
                Toast.makeText(this, "Battle trash emptied", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Close", null)
            .create()
        dialogRef.show()
    }

    private fun setupBattleLogFilters() {
        if (!::spinnerLogFilterLeague.isInitialized) return
        isUpdatingLogFilterSpinners = true

        val leagueLabels = listOf(
            "All Leagues",
            "GREAT LEAGUE",
            "ULTRA LEAGUE",
            "MASTER LEAGUE",
            "MEGA MASTER LEAGUE"
        )
        val leagueKeys = listOf(
            "ALL",
            "GREAT LEAGUE",
            "ULTRA LEAGUE",
            "MASTER LEAGUE",
            "MEGA MASTER LEAGUE"
        )
        spinnerLogFilterLeague.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, leagueLabels)
        val lgIdx = leagueKeys.indexOf(selectedLogLeagueFilter).takeIf { it >= 0 } ?: 0
        spinnerLogFilterLeague.setSelection(lgIdx, false)

        val allPresets = loadPresets()
        val matchingPresets = if (selectedLogLeagueFilter == "ALL") {
            allPresets
        } else {
            allPresets.filter { it.league.equals(selectedLogLeagueFilter, ignoreCase = true) }
        }
        val teamLabels = listOf("All Teams") + matchingPresets.map { it.name }
        val teamKeys = listOf("ALL") + matchingPresets.map { it.name }
        spinnerLogFilterTeam.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, teamLabels)
        val tmIdx = teamKeys.indexOf(selectedLogTeamFilter).takeIf { it >= 0 } ?: 0
        if (tmIdx == 0) selectedLogTeamFilter = "ALL"
        spinnerLogFilterTeam.setSelection(tmIdx, false)

        val (currSeason, _) = getCurrentAndPreviousSeason()
        val dateFmt = java.text.SimpleDateFormat("MMM d", java.util.Locale.US)
        val timeframeLabels = listOf(
            "All Time",
            "Today (Day)",
            "This Week (Last 7d)",
            "Current Season (${currSeason.name} • ${dateFmt.format(java.util.Date(currSeason.startMs))})",
            "Previous Season"
        )
        val timeframeKeys = listOf(
            "ALL_TIME",
            "DAY",
            "WEEK",
            "CURRENT_SEASON",
            "PREVIOUS_SEASON"
        )
        spinnerLogFilterTimeframe.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, timeframeLabels)
        val tfIdx = timeframeKeys.indexOf(selectedLogTimeframeFilter).takeIf { it >= 0 } ?: 0
        spinnerLogFilterTimeframe.setSelection(tfIdx, false)

        spinnerLogFilterLeague.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                if (isUpdatingLogFilterSpinners) return
                val nextLg = leagueKeys.getOrElse(position) { "ALL" }
                if (nextLg != selectedLogLeagueFilter) {
                    selectedLogLeagueFilter = nextLg
                    selectedLogTeamFilter = "ALL"
                    setupBattleLogFilters()
                    renderBattleLogPage()
                }
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        spinnerLogFilterTeam.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                if (isUpdatingLogFilterSpinners) return
                val nextTm = teamKeys.getOrElse(position) { "ALL" }
                if (nextTm != selectedLogTeamFilter) {
                    selectedLogTeamFilter = nextTm
                    renderBattleLogPage()
                }
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        spinnerLogFilterTimeframe.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                if (isUpdatingLogFilterSpinners) return
                val nextTf = timeframeKeys.getOrElse(position) { "ALL_TIME" }
                if (nextTf != selectedLogTimeframeFilter) {
                    selectedLogTimeframeFilter = nextTf
                    renderBattleLogPage()
                }
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        isUpdatingLogFilterSpinners = false
    }

    private fun filterBattleLogs(
        logs: List<BattleLogEntry>,
        leagueFilter: String,
        teamFilter: String,
        timeframeKey: String
    ): List<BattleLogEntry> {
        val (currSeason, prevSeason) = getCurrentAndPreviousSeason()
        val cal = java.util.Calendar.getInstance()
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
        cal.set(java.util.Calendar.MINUTE, 0)
        cal.set(java.util.Calendar.SECOND, 0)
        cal.set(java.util.Calendar.MILLISECOND, 0)
        val startOfTodayMs = cal.timeInMillis
        val sevenDaysAgoMs = startOfTodayMs - 6L * 86400000L

        return logs.filter { entry ->
            val leagueOk = leagueFilter == "ALL" || entry.league.equals(leagueFilter, ignoreCase = true)
            val teamOk = teamFilter == "ALL" || entry.userTeamName.equals(teamFilter, ignoreCase = true)
            val timeOk = when (timeframeKey) {
                "DAY" -> entry.timestampMs >= startOfTodayMs
                "WEEK" -> entry.timestampMs >= sevenDaysAgoMs
                "CURRENT_SEASON" -> entry.timestampMs in currSeason.startMs..currSeason.endMs
                "PREVIOUS_SEASON" -> entry.timestampMs >= prevSeason.startMs && entry.timestampMs < currSeason.startMs
                else -> true
            }
            leagueOk && teamOk && timeOk
        }
    }

    private data class ResolvedUserTeamInfo(
        val teamName: String,
        val mons: List<String>,
        val monsBracket: String,
        val groupKey: String
    )

    private fun resolveUserTeamInfo(entry: BattleLogEntry, presets: List<TeamPreset>): ResolvedUserTeamInfo {
        val matchedPreset = presets.find {
            (entry.presetId.isNotBlank() && it.id == entry.presetId) ||
                it.name.equals(entry.userTeamName, ignoreCase = true)
        }
        val teamName = entry.userTeamName.ifBlank { matchedPreset?.name ?: "My Team" }
        val directMons = entry.userPokemon.map { it.trim() }.filter { it.isNotEmpty() }
        val presetMons = matchedPreset?.pokemon?.map { it.name.trim() }?.filter { it.isNotEmpty() }.orEmpty()
        val mons = when {
            directMons.isNotEmpty() -> directMons
            presetMons.isNotEmpty() -> presetMons
            else -> listOf(teamName)
        }
        val monsBracket = "[${mons.joinToString(" ")}]"
        val groupKey = "${teamName.lowercase()}||${mons.joinToString(" ").lowercase()}"
        return ResolvedUserTeamInfo(teamName, mons, monsBracket, groupKey)
    }

    /**
     * Builds the "Copy GBL" clipboard export:
     * Header line: [Pokemon1 Pokemon2 Pokemon3]
     * Rows: Opponent1 Opponent2 Opponent3 W/L
     * Grouped by each team in the filter, sorted newest to oldest, prioritizing most recently used team first.
     */
    private fun buildCopyGblExport(
        logs: List<BattleLogEntry>,
        leagueFilter: String,
        teamFilter: String,
        timeframeKey: String
    ): String {
        val filtered = filterBattleLogs(logs, leagueFilter, teamFilter, timeframeKey)
            .sortedByDescending { it.timestampMs }
        val presets = loadPresets()
        if (filtered.isEmpty()) {
            val selectedPreset = if (teamFilter != "ALL") {
                presets.find { it.name.equals(teamFilter, ignoreCase = true) }
            } else {
                presets.find { it.isSelected } ?: presets.firstOrNull()
            }
            val fallbackMons = selectedPreset?.pokemon?.map { it.name.trim() }?.filter { it.isNotEmpty() }.orEmpty()
            return if (fallbackMons.isNotEmpty()) "[${fallbackMons.joinToString(" ")}]" else "[My Team]"
        }

        val groupedByBracket = filtered.groupBy { resolveUserTeamInfo(it, presets).monsBracket }
        val sortedTeams = groupedByBracket.entries.sortedByDescending { (_, teamEntries) ->
            teamEntries.maxOfOrNull { it.timestampMs } ?: 0L
        }

        val blocks = sortedTeams.map { (monsBracket, teamEntries) ->
            val sb = StringBuilder()
            sb.append(monsBracket).append("\n")
            for (entry in teamEntries.sortedByDescending { it.timestampMs }) {
                val oppList = entry.opponents.map { it.trim() }.filter { it.isNotEmpty() }
                val oppStr = if (oppList.isEmpty()) "Unknown" else oppList.joinToString(" ")
                val wl = if (entry.result.equals("WIN", ignoreCase = true)) "W" else "L"
                sb.append("$oppStr $wl\n")
            }
            sb.toString().trimEnd()
        }
        return blocks.joinToString("\n\n")
    }

    private fun buildPlainTextExport(
        logs: List<BattleLogEntry>,
        leagueFilter: String,
        teamFilter: String,
        timeframeKey: String
    ): String {
        val filtered = filterBattleLogs(logs, leagueFilter, teamFilter, timeframeKey)
            .sortedByDescending { it.timestampMs }
        val (currSeason, prevSeason) = getCurrentAndPreviousSeason()
        val dateFmt = java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.US)

        val rangeLabel = when (timeframeKey) {
            "DAY" -> "Today (${dateFmt.format(java.util.Date())})"
            "WEEK" -> "This Week (Last 7 Days)"
            "CURRENT_SEASON" -> "Current Season (${currSeason.name} • Since ${dateFmt.format(java.util.Date(currSeason.startMs))})"
            "PREVIOUS_SEASON" -> "Previous Season (${dateFmt.format(java.util.Date(prevSeason.startMs))} – ${dateFmt.format(java.util.Date(prevSeason.endMs))})"
            else -> "All Time"
        }

        val wins = filtered.count { it.result.equals("WIN", ignoreCase = true) }
        val losses = filtered.count { it.result.equals("LOSS", ignoreCase = true) }
        val total = wins + losses
        val winPct = if (total > 0) Math.round((wins.toDouble() / total.toDouble()) * 100.0).toInt() else 0
        val favCount = filtered.count { it.leadMatchup.equals("FAVORABLE", ignoreCase = true) }
        val neuCount = filtered.count { it.leadMatchup.equals("NEUTRAL", ignoreCase = true) || it.leadMatchup.isBlank() }
        val negCount = filtered.count { it.leadMatchup.equals("NEGATIVE", ignoreCase = true) }

        val presets = loadPresets()
        val aggWae = OverlayService.calculateAggregateWAEStatic(filtered.map { resolveEntryQuality(it, presets) })

        val sb = StringBuilder()
        val leagueTitle = if (leagueFilter == "ALL") "All Leagues" else leagueFilter
        val teamTitle = if (teamFilter == "ALL") "All Teams" else teamFilter
        sb.append("SilphScope PvP Battle Log — $leagueTitle\n")
        sb.append("Team: $teamTitle\n")
        sb.append("Range: $rangeLabel\n")
        sb.append("Overall Record: ${wins}W - ${losses}L ($winPct%) • Leads: $favCount Fav / $neuCount Neu / $negCount Neg • WAE: ${aggWae.formatted} • Luck: ${aggWae.luckFormatted}\n")

        if (filtered.isEmpty()) {
            sb.append("\nNo battles logged in this timeframe.\n")
            return sb.toString()
        }

        val groupedByDay = filtered.groupBy { dateFmt.format(java.util.Date(it.timestampMs)) }
        for ((dayStr, dayEntries) in groupedByDay) {
            val groupedByTeam = dayEntries.groupBy { resolveUserTeamInfo(it, presets).groupKey }
            val sortedDayTeams = groupedByTeam.entries.sortedWith(
                compareByDescending<Map.Entry<String, List<BattleLogEntry>>> { it.value.size }
                    .thenByDescending { it.value.maxOfOrNull { e -> e.timestampMs } ?: 0L }
            )

            for ((_, teamDayEntries) in sortedDayTeams) {
                val teamInfo = resolveUserTeamInfo(teamDayEntries.first(), presets)
                val dWins = teamDayEntries.count { it.result.equals("WIN", ignoreCase = true) }
                val dLosses = teamDayEntries.count { it.result.equals("LOSS", ignoreCase = true) }
                val dTotal = dWins + dLosses
                val dPct = if (dTotal > 0) Math.round((dWins.toDouble() / dTotal.toDouble()) * 100.0).toInt() else 0
                val dFav = teamDayEntries.count { it.leadMatchup.equals("FAVORABLE", ignoreCase = true) }
                val dNeu = teamDayEntries.count { it.leadMatchup.equals("NEUTRAL", ignoreCase = true) || it.leadMatchup.isBlank() }
                val dNeg = teamDayEntries.count { it.leadMatchup.equals("NEGATIVE", ignoreCase = true) }
                val dWae = OverlayService.calculateAggregateWAEStatic(teamDayEntries.map { resolveEntryQuality(it, presets) })

                sb.append("\n=== $dayStr - ${teamInfo.teamName} ${teamInfo.monsBracket} Daily Record: ${dWins}W - ${dLosses}L ($dPct%) [Leads: $dFav Fav, $dNeu Neu, $dNeg Neg] • WAE: ${dWae.formatted} • Luck: ${dWae.luckFormatted} ===\n")
                for (entry in teamDayEntries.sortedByDescending { it.timestampMs }) {
                    val wl = if (entry.result.equals("WIN", ignoreCase = true)) "W" else "L"
                    val leadTag = when (entry.leadMatchup.uppercase()) {
                        "FAVORABLE" -> "Fav"
                        "NEGATIVE" -> "Neg"
                        else -> "Neu"
                    }
                    val q = resolveEntryQuality(entry, presets)
                    val matchWinTag = if (q != null) "${q.expWinPct}%" else "—%"
                    val oppList = entry.opponents.map { it.trim() }.filter { it.isNotEmpty() }
                    val oppStr = if (oppList.isEmpty()) "Unknown" else oppList.joinToString(" ")
                    sb.append("$wl (Lead:$leadTag Match:$matchWinTag): $oppStr\n")
                }
            }
        }
        return sb.toString().trim()
    }

    private fun loadAndRenderTierThresholdsUi() {
        if (!::editTierSwMin.isInitialized) return
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        val sw = OverlayService.activeTierSwMin
        val w = OverlayService.activeTierWMin
        val l = OverlayService.activeTierLMax
        val sl = OverlayService.activeTierSlMax
        editTierSwMin.setText(sw.toString())
        editTierWMin.setText(w.toString())
        editTierLMax.setText(l.toString())
        editTierSlMax.setText(sl.toString())
        updateTierSummaryLabel(sw, w, l, sl)
    }

    private fun updateTierSummaryLabel(sw: Int, w: Int, l: Int, sl: Int) {
        if (!::textTierDefinitionsSummary.isInitialized) return
        textTierDefinitionsSummary.text =
            "• SW = Strong Win (rating >= $sw) (Default: 620)\n" +
            "• W = Win ($w <= rating < $sw) (Default: 530)\n" +
            "• N = Neutral / Grey ($l < rating < $w) (Default: 470–530)\n" +
            "• L = Loss ($sl < rating <= $l) (Default: 470)\n" +
            "• SL = Strong Loss (rating <= $sl) (Default: 380)"
    }

    private fun saveTierThresholdsFromInputs(showToast: Boolean) {
        val rawSw = editTierSwMin.text.toString().trim().toIntOrNull() ?: OverlayService.DEFAULT_TIER_SW_MIN
        val rawW = editTierWMin.text.toString().trim().toIntOrNull() ?: OverlayService.DEFAULT_TIER_W_MIN
        val rawL = editTierLMax.text.toString().trim().toIntOrNull() ?: OverlayService.DEFAULT_TIER_L_MAX
        val rawSl = editTierSlMax.text.toString().trim().toIntOrNull() ?: OverlayService.DEFAULT_TIER_SL_MAX

        val sl = rawSl.coerceIn(100, 800)
        val l = rawL.coerceIn(sl + 1, 850)
        val w = rawW.coerceIn(l + 1, 900)
        val sw = rawSw.coerceIn(w + 1, 950)

        prefs.edit()
            .putInt(OverlayService.PREFS_KEY_TIER_SW_MIN, sw)
            .putInt(OverlayService.PREFS_KEY_TIER_W_MIN, w)
            .putInt(OverlayService.PREFS_KEY_TIER_L_MAX, l)
            .putInt(OverlayService.PREFS_KEY_TIER_SL_MAX, sl)
            .apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        loadAndRenderTierThresholdsUi()

        if (isOverlayRunning) {
            val updateIntent = Intent(this, OverlayService::class.java).apply {
                action = OverlayService.ACTION_UPDATE_SETTINGS
            }
            startService(updateIntent)
        }
        if (showToast) {
            Toast.makeText(
                this,
                "Saved 5-Tier Matchup Thresholds: SW>=$sw, W>=$w, N($l..$w), L<=$l, SL<=$sl",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun restoreDefaultTierThresholds() {
        prefs.edit()
            .putInt(OverlayService.PREFS_KEY_TIER_SW_MIN, OverlayService.DEFAULT_TIER_SW_MIN)
            .putInt(OverlayService.PREFS_KEY_TIER_W_MIN, OverlayService.DEFAULT_TIER_W_MIN)
            .putInt(OverlayService.PREFS_KEY_TIER_L_MAX, OverlayService.DEFAULT_TIER_L_MAX)
            .putInt(OverlayService.PREFS_KEY_TIER_SL_MAX, OverlayService.DEFAULT_TIER_SL_MAX)
            .apply()
        OverlayService.syncTierThresholdsFromPrefs(prefs)
        loadAndRenderTierThresholdsUi()
        if (isOverlayRunning) {
            val updateIntent = Intent(this, OverlayService::class.java).apply {
                action = OverlayService.ACTION_UPDATE_SETTINGS
            }
            startService(updateIntent)
        }
        Toast.makeText(
            this,
            "Restored default 5-Tier Thresholds (620 / 530 / 470 / 380)",
            Toast.LENGTH_SHORT
        ).show()
    }

    private fun showExportFormatAndTimeframeDialog(isShareIntent: Boolean) {
        showExportTimeframeDialog(isShareIntent)
    }

    private fun showExportTimeframeDialog(isShareIntent: Boolean) {
        val allLogs = loadBattleLogs()
        val (currSeason, prevSeason) = getCurrentAndPreviousSeason()
        val dateFmt = java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.US)
        val options = arrayOf(
            "Today (Day)",
            "This Week (Last 7 Days)",
            "Current Season (${currSeason.name} • Since ${dateFmt.format(java.util.Date(currSeason.startMs))})",
            "Previous Season (${dateFmt.format(java.util.Date(prevSeason.startMs))} – ${dateFmt.format(java.util.Date(prevSeason.endMs))})",
            "All Time"
        )
        val keys = arrayOf("DAY", "WEEK", "CURRENT_SEASON", "PREVIOUS_SEASON", "ALL_TIME")

        AlertDialog.Builder(this)
            .setTitle(if (isShareIntent) "📤 Share Battle Log Summary — Range" else "📋 Copy Battle Log Summary — Range")
            .setItems(options) { _, which ->
                val chosenKey = keys.getOrElse(which) { "ALL_TIME" }
                val exportText = buildPlainTextExport(
                    allLogs,
                    selectedLogLeagueFilter,
                    selectedLogTeamFilter,
                    chosenKey
                )
                if (isShareIntent) {
                    val sendIntent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_SUBJECT, "SilphScope PvP Battle Log")
                        putExtra(Intent.EXTRA_TEXT, exportText)
                    }
                    startActivity(Intent.createChooser(sendIntent, "Share SilphScope PvP Battle Log"))
                } else {
                    val cm = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    cm.setPrimaryClip(android.content.ClipData.newPlainText("SilphScope PvP Battle Log", exportText))
                    Toast.makeText(this, "Copied Battle Log Summary (${options[which]}) to clipboard!", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun renderBattleLogPage() {
        updateTrashButtonsUi()
        val allLogs = loadBattleLogs()
        val filtered = filterBattleLogs(
            allLogs,
            selectedLogLeagueFilter,
            selectedLogTeamFilter,
            selectedLogTimeframeFilter
        )
        val wins = filtered.count { it.result.equals("WIN", ignoreCase = true) }
        val losses = filtered.count { it.result.equals("LOSS", ignoreCase = true) }
        val total = wins + losses
        val winPct = if (total > 0) Math.round((wins.toDouble() / total.toDouble()) * 100.0).toInt() else 0
        val favCount = filtered.count { it.leadMatchup.equals("FAVORABLE", ignoreCase = true) }
        val neuCount = filtered.count { it.leadMatchup.equals("NEUTRAL", ignoreCase = true) || it.leadMatchup.isBlank() }
        val negCount = filtered.count { it.leadMatchup.equals("NEGATIVE", ignoreCase = true) }

        val presets = loadPresets()
        val aggWae = OverlayService.calculateAggregateWAEStatic(filtered.map { resolveEntryQuality(it, presets) })

        textBattleLogTotal.text = "${wins}W - ${losses}L ($total)"
        textBattleLogLeague.text = "$favCount Fav · $neuCount Neu · $negCount Neg"
        textBattleLogWinrate.text = if (total == 0) "—%" else "$winPct%"
        textBattleLogWae.text = aggWae.formatted
        textBattleLogWae.setTextColor(
            when {
                aggWae.rankedCount == 0 -> 0xFF94A3B8.toInt()
                aggWae.waePct >= 0.0 -> 0xFF4ADE80.toInt()
                else -> 0xFFF43F5E.toInt()
            }
        )
        if (::textBattleLogLuck.isInitialized) {
            textBattleLogLuck.text = aggWae.luckFormatted
            textBattleLogLuck.setTextColor(
                when {
                    aggWae.rankedCount == 0 -> 0xFF94A3B8.toInt()
                    aggWae.luckPct > 50.0 -> 0xFF38BDF8.toInt()
                    aggWae.luckPct < 50.0 -> 0xFFFB923C.toInt()
                    else -> 0xFF94A3B8.toInt()
                }
            )
        }

        battleLogContainer.removeAllViews()
        val density = resources.displayMetrics.density
        if (filtered.isEmpty()) {
            val selectedPreset = getSelectedPreset()
            val (currSeason, _) = getCurrentAndPreviousSeason()
            val emptyCard = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF1E293B.toInt())
                val pad = (14 * density).toInt()
                setPadding(pad, pad, pad, pad)
            }
            val titleTv = TextView(this).apply {
                text = "📜 No Battles Logged in Selected Filter"
                setTextColor(0xFFF8FAFC.toInt())
                textSize = 14f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            val descTv = TextView(this).apply {
                text = "• Tap '⚔️ Start Battle' on the floating overlay during battle to log 🏆 Win or 💀 Loss with automatic Lead Matchup (${selectedPreset?.name ?: "Active Team"}).\n" +
                    "• Active Season (ScrapedDuck API): ${currSeason.name}\n" +
                    "• Tap any logged battle card to open the Interactive Overlay Matchup Replay!"
                setTextColor(0xFF94A3B8.toInt())
                textSize = 12f
                setPadding(0, (6 * density).toInt(), 0, 0)
            }
            emptyCard.addView(titleTv)
            emptyCard.addView(descTv)
            battleLogContainer.addView(emptyCard)
            return
        }

        val dayFmt = java.text.SimpleDateFormat("MMM d, yyyy", java.util.Locale.US)
        val timeFmt = java.text.SimpleDateFormat("h:mm a", java.util.Locale.US)
        val groupedByDay = filtered.groupBy { dayFmt.format(java.util.Date(it.timestampMs)) }

        for ((dayStr, dayEntries) in groupedByDay) {
            val dWins = dayEntries.count { it.result.equals("WIN", ignoreCase = true) }
            val dLosses = dayEntries.count { it.result.equals("LOSS", ignoreCase = true) }
            val dTotal = dWins + dLosses
            val dPct = if (dTotal > 0) Math.round((dWins.toDouble() / dTotal.toDouble()) * 100.0).toInt() else 0
            val dFav = dayEntries.count { it.leadMatchup.equals("FAVORABLE", ignoreCase = true) }
            val dNeu = dayEntries.count { it.leadMatchup.equals("NEUTRAL", ignoreCase = true) || it.leadMatchup.isBlank() }
            val dNeg = dayEntries.count { it.leadMatchup.equals("NEGATIVE", ignoreCase = true) }
            val dayWae = OverlayService.calculateAggregateWAEStatic(dayEntries.map { resolveEntryQuality(it, presets) })

            val dayHeader = TextView(this).apply {
                text = "📅 $dayStr — Daily Record: ${dWins}W - ${dLosses}L ($dPct%) • Leads: $dFav Fav / $dNeu Neu / $dNeg Neg • WAE: ${dayWae.formatted} • Luck: ${dayWae.luckFormatted}"
                setTextColor(0xFF38BDF8.toInt())
                textSize = 11f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                val padV = (6 * density).toInt()
                setPadding((4 * density).toInt(), padV, (4 * density).toInt(), padV)
            }
            battleLogContainer.addView(dayHeader)

            for (entry in dayEntries) {
                val isWin = entry.result.equals("WIN", ignoreCase = true)
                val leadUp = entry.leadMatchup.uppercase()
                val leadBadgeText = when (leadUp) {
                    "FAVORABLE" -> "Lead: Favorable"
                    "NEGATIVE" -> "Lead: Negative"
                    else -> "Lead: Neutral"
                }
                val leadColor = when (leadUp) {
                    "FAVORABLE" -> 0xFF4ADE80.toInt()
                    "NEGATIVE" -> 0xFFF87171.toInt()
                    else -> 0xFFCBD5E1.toInt()
                }

                val card = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    setBackgroundColor(0xFF1E293B.toInt())
                    val pad = (11 * density).toInt()
                    setPadding(pad, pad, pad, pad)
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply {
                        bottomMargin = (8 * density).toInt()
                    }
                    setOnClickListener {
                        showInteractiveBattleReplayDialog(entry)
                    }
                }

                val topRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = android.view.Gravity.CENTER_VERTICAL
                }

                val resultTv = TextView(this).apply {
                    text = if (isWin) "🏆 WIN" else "💀 LOSS"
                    setTextColor(if (isWin) 0xFF4ADE80.toInt() else 0xFFF87171.toInt())
                    textSize = 12f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                }

                val leadTv = TextView(this).apply {
                    text = "  •  $leadBadgeText"
                    setTextColor(leadColor)
                    textSize = 11f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                }

                val metaTv = TextView(this).apply {
                    text = "${entry.league.replace(" LEAGUE", "")} • ${timeFmt.format(java.util.Date(entry.timestampMs))}"
                    setTextColor(0xFF94A3B8.toInt())
                    textSize = 10.5f
                    gravity = android.view.Gravity.END
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                }

                topRow.addView(resultTv)
                topRow.addView(leadTv)
                topRow.addView(metaTv)

                val teamTv = TextView(this).apply {
                    text = "Team: ${entry.userTeamName}"
                    setTextColor(0xFFCBD5E1.toInt())
                    textSize = 11.5f
                    setPadding(0, (4 * density).toInt(), 0, (2 * density).toInt())
                }

                val oppOrderedText = if (entry.opponents.isEmpty()) {
                    "No opponents recorded"
                } else {
                    entry.opponents.mapIndexed { idx, opp ->
                        val ord = when (idx) { 0 -> "1st"; 1 -> "2nd"; else -> "3rd" }
                        "$ord: $opp"
                    }.joinToString("  •  ")
                }

                val oppTv = TextView(this).apply {
                    text = "Vs: $oppOrderedText"
                    setTextColor(0xFFF8FAFC.toInt())
                    textSize = 12f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                }

                // Phase 3: Primary Performance Badge (derived from P_pre) & Contextual Event Flags (Pills) Container
                val entryQuality = resolveEntryQuality(entry, presets)
                val qualityRow = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(0, (5 * density).toInt(), 0, (2 * density).toInt())
                }

                if (entryQuality != null) {
                    val primaryBadgeRow = LinearLayout(this).apply {
                        orientation = LinearLayout.HORIZONTAL
                        gravity = android.view.Gravity.CENTER_VERTICAL
                    }

                    val badgeTextColor = when (entryQuality.badgeLabel) {
                        "Clutch Win" -> 0xFF22D3EE.toInt()
                        "Skill Win" -> 0xFF4ADE80.toInt()
                        "Blunder Loss" -> 0xFFF43F5E.toInt()
                        "Tough Loss" -> 0xFFFB923C.toInt()
                        else -> 0xFF94A3B8.toInt()
                    }
                    val badgeBgColor = when (entryQuality.badgeLabel) {
                        "Clutch Win" -> 0x2622D3EE
                        "Skill Win" -> 0x264ADE80
                        "Blunder Loss" -> 0x26F43F5E
                        "Tough Loss" -> 0x26FB923C
                        else -> 0x2E64748B
                    }
                    val bmfPctInt = (entryQuality.pPre * 100.0).roundToInt()
                    val waePctVal = entryQuality.deltaQ * 100.0
                    val dqSign = if (waePctVal >= 0.0) "+" else "-"
                    val dqStr = String.format(java.util.Locale.US, "%s%.1f%%", dqSign, kotlin.math.abs(waePctVal))

                    val badgeTv = TextView(this).apply {
                        text = "${entryQuality.badgeLabel} • BMF: ${bmfPctInt}% • WAE: $dqStr"
                        setTextColor(badgeTextColor)
                        setBackgroundColor(badgeBgColor)
                        textSize = 10.5f
                        setTypeface(typeface, android.graphics.Typeface.BOLD)
                        val pH = (7 * density).toInt()
                        val pV = (3 * density).toInt()
                        setPadding(pH, pV, pH, pV)
                    }
                    primaryBadgeRow.addView(badgeTv)
                    qualityRow.addView(primaryBadgeRow)

                    @Suppress("USELESS_ELVIS")
                    val flagsList = (entryQuality.contextualFlags ?: emptyList()).ifEmpty { entry.flags ?: emptyList() }
                    if (flagsList.isNotEmpty()) {
                        val flagsRow = LinearLayout(this).apply {
                            orientation = LinearLayout.HORIZONTAL
                            gravity = android.view.Gravity.CENTER_VERTICAL
                            setPadding(0, (4 * density).toInt(), 0, 0)
                        }
                        for (flag in flagsList) {
                            val (flagTextColor, flagBgColor) = when {
                                flag.contains("Double Shield Pocket") -> 0xFFFDA4AF.toInt() to 0x26F43F5E
                                flag.contains("Shield in Pocket") -> 0xFFFCD34D.toInt() to 0x26F59E0B
                                flag.contains("Clean Sweep") -> 0xFF6EE7B7.toInt() to 0x2610B981
                                flag.contains("Shield Advantage") -> 0xFF7DD3FC.toInt() to 0x2638BDF8
                                else -> 0xFFFCD34D.toInt() to 0x26F59E0B
                            }
                            val pillTv = TextView(this).apply {
                                text = flag
                                setTextColor(flagTextColor)
                                setBackgroundColor(flagBgColor)
                                textSize = 9.5f
                                setTypeface(typeface, android.graphics.Typeface.BOLD)
                                val pH = (6 * density).toInt()
                                val pV = (2.5f * density).toInt()
                                setPadding(pH, pV, pH, pV)
                                layoutParams = LinearLayout.LayoutParams(
                                    LinearLayout.LayoutParams.WRAP_CONTENT,
                                    LinearLayout.LayoutParams.WRAP_CONTENT
                                ).apply {
                                    marginEnd = (5 * density).toInt()
                                }
                            }
                            flagsRow.addView(pillTv)
                        }
                        qualityRow.addView(flagsRow)
                    }
                } else {
                    val unrankedTv = TextView(this).apply {
                        text = "Unranked Match (Missing Swap — Excluded from WAE)"
                        setTextColor(0xFF64748B.toInt())
                        setBackgroundColor(0x26334155)
                        textSize = 10f
                        setTypeface(typeface, android.graphics.Typeface.BOLD)
                        val pH = (7 * density).toInt()
                        val pV = (3 * density).toInt()
                        setPadding(pH, pV, pH, pV)
                    }
                    qualityRow.addView(unrankedTv)
                }

                val actionsRow = LinearLayout(this).apply {
                    orientation = LinearLayout.HORIZONTAL
                    gravity = android.view.Gravity.CENTER_VERTICAL
                    setPadding(0, (6 * density).toInt(), 0, 0)
                }

                val replayHintBtn = TextView(this).apply {
                    text = "🔍 Tap to Replay Overlay Matrix"
                    setTextColor(0xFF38BDF8.toInt())
                    textSize = 11f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                    setOnClickListener {
                        showInteractiveBattleReplayDialog(entry)
                    }
                }

                val editBtn = TextView(this).apply {
                    text = "✏️ Edit"
                    setTextColor(0xFFE2E8F0.toInt())
                    textSize = 11f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    val padH = (8 * density).toInt()
                    val padV = (3 * density).toInt()
                    setPadding(padH, padV, padH, padV)
                    setOnClickListener {
                        showEditOrCreateBattleLogDialog(entry)
                    }
                }

                val delBtn = TextView(this).apply {
                    text = "🗑️ Delete"
                    setTextColor(0xFFF87171.toInt())
                    textSize = 11f
                    setTypeface(typeface, android.graphics.Typeface.BOLD)
                    val padH = (8 * density).toInt()
                    val padV = (3 * density).toInt()
                    setPadding(padH, padV, padH, padV)
                    setOnClickListener {
                        deleteBattleLogEntry(entry)
                    }
                }

                actionsRow.addView(replayHintBtn)
                actionsRow.addView(editBtn)
                actionsRow.addView(delBtn)

                card.addView(topRow)
                card.addView(teamTv)
                card.addView(oppTv)
                card.addView(qualityRow)
                card.addView(actionsRow)
                battleLogContainer.addView(card)
            }
        }
    }

    private fun deleteBattleLogEntry(entry: BattleLogEntry) {
        val trash = loadDeletedBattlesTrash().toMutableList()
        trash.removeAll { it.id == entry.id }
        trash.add(0, entry)
        saveDeletedBattlesTrash(trash)

        val current = loadBattleLogs().filter { it.id != entry.id }
        saveBattleLogs(current)
        val delIds = loadDeletedLogIds().toMutableList()
        delIds.add(entry.id)
        saveDeletedLogIds(delIds)
        renderBattleLogPage()
        updateSyncStatusUi()
        triggerTwoDeviceCloudSync(silent = true)
        val oppSummary = entry.opponents.firstOrNull() ?: "Opponent"
        showUndoBanner("🗑️ Battle (${entry.result} vs $oppSummary) moved to Trash") {
            restoreBattleLogsFromTrash(listOf(entry))
            Toast.makeText(this, "Battle restored!", Toast.LENGTH_SHORT).show()
        }
    }

    private fun showEditOrCreateBattleLogDialog(existing: BattleLogEntry?) {
        val density = resources.displayMetrics.density
        val pad = (14 * density).toInt()
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(0xFF0F172A.toInt())
            setPadding(pad, pad, pad, pad)
        }

        val presets = loadPresets()
        val selectedPreset = getSelectedPreset() ?: presets.firstOrNull()

        // 1. Result Spinner (WIN / LOSS)
        val resultLabel = TextView(this).apply {
            text = "Battle Result"
            setTextColor(0xFF94A3B8.toInt())
            textSize = 11f
        }
        val resultsArr = arrayOf("WIN", "LOSS")
        val spinnerResult = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, resultsArr)
            val idx = if (existing?.result.equals("LOSS", ignoreCase = true)) 1 else 0
            setSelection(idx)
        }

        // 2. Lead Matchup Spinner (FAVORABLE / NEUTRAL / NEGATIVE)
        val leadLabel = TextView(this).apply {
            text = "Lead Matchup (1st Seen vs Your Lead)"
            setTextColor(0xFF94A3B8.toInt())
            textSize = 11f
            setPadding(0, (8 * density).toInt(), 0, 0)
        }
        val leadsArr = arrayOf("FAVORABLE", "NEUTRAL", "NEGATIVE")
        val spinnerLead = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, leadsArr)
            val idx = leadsArr.indexOfFirst { it.equals(existing?.leadMatchup ?: "NEUTRAL", ignoreCase = true) }.coerceAtLeast(0)
            setSelection(idx)
        }

        // 3. Team Preset Spinner
        val teamLabel = TextView(this).apply {
            text = "Your Team Preset & League"
            setTextColor(0xFF94A3B8.toInt())
            textSize = 11f
            setPadding(0, (8 * density).toInt(), 0, 0)
        }
        val presetDisplayNames = presets.map { "${it.name} (${it.league})" }
        val spinnerPreset = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, presetDisplayNames)
            val initIdx = if (existing != null) {
                presets.indexOfFirst { it.id == existing.presetId || it.name.equals(existing.userTeamName, ignoreCase = true) }
                    .takeIf { it >= 0 } ?: 0
            } else {
                presets.indexOfFirst { it.id == selectedPreset?.id }.takeIf { it >= 0 } ?: 0
            }
            setSelection(initIdx)
        }

        val currentLeagueProvider = {
            val chosenPreset = presets.getOrNull(spinnerPreset.selectedItemPosition)
            chosenPreset?.league ?: existing?.league ?: "GREAT LEAGUE"
        }

        // 4. Opponents (1st seen, 2nd seen, 3rd seen) with Autocomplete
        fun createOpponentAutoInput(hintText: String, initialValue: String): AutoCompleteTextView {
            return AutoCompleteTextView(this).apply {
                hint = hintText
                setText(initialValue, false)
                setTextColor(0xFFF8FAFC.toInt())
                setHintTextColor(0xFF64748B.toInt())
                textSize = 13f
                threshold = 1
                setAdapter(PokemonAutocompleteAdapter(currentLeagueProvider))
            }
        }

        val oppLabel = TextView(this).apply {
            text = "Opponent Team (Fixed Order: 1st Seen, 2nd Seen, 3rd Seen)"
            setTextColor(0xFF94A3B8.toInt())
            textSize = 11f
            setPadding(0, (8 * density).toInt(), 0, 0)
        }
        val editOpp1 = createOpponentAutoInput("1st Seen Opponent (Lead)", existing?.opponents?.getOrNull(0) ?: "")
        val editOpp2 = createOpponentAutoInput("2nd Seen Opponent (Switch)", existing?.opponents?.getOrNull(1) ?: "")
        val editOpp3 = createOpponentAutoInput("3rd Seen Opponent (Closer)", existing?.opponents?.getOrNull(2) ?: "")

        container.addView(resultLabel)
        container.addView(spinnerResult)
        container.addView(leadLabel)
        container.addView(spinnerLead)
        container.addView(teamLabel)
        container.addView(spinnerPreset)
        container.addView(oppLabel)
        container.addView(editOpp1)
        container.addView(editOpp2)
        container.addView(editOpp3)

        AlertDialog.Builder(this)
            .setTitle(if (existing != null) "✏️ Modify Logged Battle" else "+ Log GBL Battle")
            .setView(container)
            .setPositiveButton("Save Battle") { _, _ ->
                val chosenPreset = presets.getOrNull(spinnerPreset.selectedItemPosition) ?: selectedPreset
                val opps = listOf(
                    editOpp1.text.toString().trim(),
                    editOpp2.text.toString().trim(),
                    editOpp3.text.toString().trim()
                ).filter { it.isNotEmpty() }

                val nowMs = System.currentTimeMillis()
                val chosenLeague = chosenPreset?.league ?: existing?.league ?: "GREAT LEAGUE"
                val chosenMons = chosenPreset?.pokemon?.map { it.name } ?: existing?.userPokemon ?: emptyList()
                val chosenResult = resultsArr.getOrElse(spinnerResult.selectedItemPosition) { "WIN" }
                val serviceSlots = chosenPreset?.pokemon?.map {
                    OverlayService.TeamMember(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs)
                }
                val computedQuality = OverlayService.calculateBattleQuality(
                    myTeam = chosenMons,
                    oppTeam = opps,
                    league = chosenLeague,
                    result = chosenResult,
                    myTeamSlots = serviceSlots,
                    timelineEvents = existing?.timelineEvents?.takeIf { it.isNotEmpty() },
                    totalDurationSec = existing?.battleDurationSec,
                    explicitUserFaints = existing?.userFaints,
                    explicitOppFaints = existing?.oppFaints,
                    explicitUserShieldsRemaining = existing?.userShieldsRemaining,
                    explicitOppShieldsRemaining = existing?.oppShieldsRemaining
                )
                val updatedEntry = BattleLogEntry(
                    id = existing?.id ?: "log-$nowMs-${(100..999).random()}",
                    timestampMs = existing?.timestampMs ?: nowMs,
                    updatedAt = nowMs,
                    league = chosenLeague,
                    presetId = chosenPreset?.id ?: existing?.presetId ?: "",
                    userTeamName = chosenPreset?.name ?: existing?.userTeamName ?: "Active Team",
                    userPokemon = chosenMons,
                    opponents = opps,
                    leadMatchup = leadsArr.getOrElse(spinnerLead.selectedItemPosition) { "NEUTRAL" },
                    result = chosenResult,
                    deviceLabel = existing?.deviceLabel ?: (Build.MODEL ?: "Android"),
                    bmfScore = computedQuality?.pPre,
                    execWae = computedQuality?.execWae,
                    badges = computedQuality?.badges ?: if (computedQuality != null) listOf(computedQuality.badgeLabel) else emptyList(),
                    flags = computedQuality?.contextualFlags ?: emptyList(),
                    quality = computedQuality,
                    qualityEvaluated = true,
                    timelineEvents = existing?.timelineEvents ?: emptyList(),
                    battleDurationSec = existing?.battleDurationSec,
                    userFaints = existing?.userFaints,
                    oppFaints = existing?.oppFaints,
                    userShieldsRemaining = existing?.userShieldsRemaining,
                    oppShieldsRemaining = existing?.oppShieldsRemaining
                )

                val all = loadBattleLogs().toMutableList()
                val idx = all.indexOfFirst { it.id == updatedEntry.id }
                if (idx >= 0) {
                    all[idx] = updatedEntry
                } else {
                    all.add(0, updatedEntry)
                }
                saveBattleLogs(all)
                setupBattleLogFilters()
                renderBattleLogPage()
                updateSyncStatusUi()
                triggerTwoDeviceCloudSync(silent = true)
                Toast.makeText(this, "Battle saved!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    inner class ReplayJavascriptBridge(
        private val replayEngine: OverlayService,
        private val pushReplayStateToWeb: () -> Unit
    ) {
        @android.webkit.JavascriptInterface
        fun selectActiveUserPokemon(pokemonName: String) {
            runOnUiThread {
                try {
                    replayEngine.selectActiveUserPokemon(pokemonName)
                    pushReplayStateToWeb()
                } catch (_: Exception) {}
            }
        }

        @android.webkit.JavascriptInterface
        fun swapActiveOpponent(pokemonName: String) {
            runOnUiThread {
                try {
                    replayEngine.swapActiveOpponent(pokemonName)
                    pushReplayStateToWeb()
                } catch (_: Exception) {}
            }
        }

        @android.webkit.JavascriptInterface
        fun toggleOpponentShadow() {
            runOnUiThread {
                try {
                    replayEngine.toggleShadowModifier()
                    pushReplayStateToWeb()
                } catch (_: Exception) {}
            }
        }

        @android.webkit.JavascriptInterface
        fun cycleOpponentForm() {
            runOnUiThread {
                try {
                    replayEngine.cycleActiveOpponentForm()
                    pushReplayStateToWeb()
                } catch (_: Exception) {}
            }
        }

        @android.webkit.JavascriptInterface
        fun updateContentHeight(heightDp: Int) {}

        @android.webkit.JavascriptInterface
        fun onOverlayReady() {
            runOnUiThread {
                try {
                    pushReplayStateToWeb()
                } catch (_: Exception) {}
            }
        }
    }

    @Suppress("USELESS_ELVIS")
    @android.annotation.SuppressLint("SetJavaScriptEnabled")
    private fun showInteractiveBattleReplayDialog(entry: BattleLogEntry) {
        try {
            OverlayService.syncTierThresholdsFromPrefs(prefs)
            val presets = loadPresets()
            val safePresetId = entry.presetId ?: ""
            val safeUserTeamName = entry.userTeamName ?: ""
            val safeLeague = entry.league ?: "GREAT LEAGUE"
            val safeUserPokemon = entry.userPokemon ?: emptyList()
            val safeOpponents = entry.opponents ?: emptyList()
            val safeLeadMatchup = entry.leadMatchup ?: "NEUTRAL"
            val safeResult = entry.result ?: "WIN"

            val matchedPreset = presets.find {
                (safePresetId.isNotBlank() && it.id == safePresetId) ||
                    it.name.equals(safeUserTeamName, ignoreCase = true)
            } ?: getSelectedPreset()

            val teamMembers: List<OverlayService.TeamMember> = if (matchedPreset != null && matchedPreset.pokemon.isNotEmpty()) {
                matchedPreset.pokemon.map {
                    OverlayService.TeamMember(it.name, it.cp, it.fastMove, it.chargedMove1, it.chargedMove2, it.ivs)
                }
            } else {
                val fallbackNames = if (safeUserPokemon.size >= 3) safeUserPokemon else getLeagueTop3Defaults(safeLeague).map { it.name }
                fallbackNames.map { monName ->
                    val rec = OverlayService.resolveRecommendedMovesForSpecies(monName, safeLeague)
                    OverlayService.TeamMember(
                        name = monName,
                        cp = rec?.defaultCp ?: 1500,
                        fastMove = rec?.defaultFastMove ?: "Fast Move",
                        chargedMove1 = rec?.chargedMove1 ?: "Charged 1",
                        chargedMove2 = rec?.chargedMove2 ?: "Charged 2"
                    )
                }
            }

            val servicePreset = OverlayService.TeamPreset(
                id = matchedPreset?.id ?: "replay-preset",
                name = safeUserTeamName.ifBlank { matchedPreset?.name ?: "Replay Team" },
                league = safeLeague,
                pokemon = teamMembers
            )

            val replayOpponents = if (safeOpponents.isNotEmpty()) {
                safeOpponents
            } else {
                getLeagueTop3Defaults(safeLeague).map { it.name }
            }

            val oppCountModeVal = prefs.getString(PREFS_KEY_OPP_COUNT_MODE, "my_fasts") ?: "my_fasts"
            val enable4Val = prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, false)

            val replayEngine = OverlayService()
            replayEngine.configureReplayState(
                preset = servicePreset,
                opponentsList = replayOpponents,
                activeOppIdx = 0,
                activeUserIdx = 0,
                oppCountModeVal = oppCountModeVal,
                enable4ChargedVal = enable4Val
            )

            val density = resources.displayMetrics.density
            val dialogContainer = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF0F172A.toInt())
                val pad = (8 * density).toInt()
                setPadding(pad, pad, pad, pad)
            }

            val entryQuality = resolveEntryQuality(entry, presets)
            val qualityLine = if (entryQuality != null) {
                val bmfInt = (entryQuality.pPre * 100.0).roundToInt()
                val waeVal = entryQuality.deltaQ * 100.0
                val sign = if (waeVal >= 0.0) "+" else "-"
                val waeStr = String.format(java.util.Locale.US, "%s%.1f%%", sign, kotlin.math.abs(waeVal))
                "\n${entryQuality.badgeLabel} • BMF: ${bmfInt}% • Exec WAE: $waeStr"
            } else ""

            val hintTv = TextView(this).apply {
                val leadTxt = when (safeLeadMatchup.uppercase()) {
                    "FAVORABLE" -> "Lead: Favorable"
                    "NEGATIVE" -> "Lead: Negative"
                    else -> "Lead: Neutral"
                }
                text = "🔍 Interactive Post-Game Overlay • $safeResult ($leadTxt)$qualityLine\nTap any of your 3 Pokémon chips, opponent rows (1st/2nd/3rd), or Shadow/Form buttons to inspect matchup lines:"
                setTextColor(0xFF94A3B8.toInt())
                textSize = 11f
                setPadding((4 * density).toInt(), 0, (4 * density).toInt(), (6 * density).toInt())
            }

            val replayWebView = android.webkit.WebView(this).apply {
                settings.javaScriptEnabled = true
                settings.domStorageEnabled = true
                settings.allowFileAccess = true
                setBackgroundColor(0x00000000)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    (390 * density).toInt()
                )
            }

            val pushReplayStateToWeb = {
                try {
                    val payloadJson = replayEngine.buildBattlePayloadJson(isReplayMode = true)
                    replayWebView.post {
                        try {
                            replayWebView.evaluateJavascript("if (window.setOverlayTransparencyPct) setOverlayTransparencyPct(15);", null)
                            replayWebView.evaluateJavascript("if (window.updateBattleData) updateBattleData($payloadJson);", null)
                        } catch (_: Exception) {}
                    }
                } catch (_: Exception) {}
            }

            val replayBridge = ReplayJavascriptBridge(replayEngine, pushReplayStateToWeb)

            replayWebView.webViewClient = object : android.webkit.WebViewClient() {
                override fun onPageFinished(view: android.webkit.WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    pushReplayStateToWeb()
                }
            }
            replayWebView.addJavascriptInterface(replayBridge, "AndroidOverlay")
            replayWebView.loadUrl("file:///android_asset/overlay.html?replay=1")

            dialogContainer.addView(hintTv)
            dialogContainer.addView(replayWebView)

            AlertDialog.Builder(this)
                .setView(dialogContainer)
                .setPositiveButton("Close Replay", null)
                .setNeutralButton("✏️ Edit Log") { _, _ ->
                    showEditOrCreateBattleLogDialog(entry)
                }
                .show()
        } catch (e: Exception) {
            Toast.makeText(this, "Error opening Battle Recap: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
        }
    }

    private fun updateOppCountBasisUi() {
        val mode = prefs.getString(PREFS_KEY_OPP_COUNT_MODE, "my_fasts") ?: "my_fasts"
        if (mode == "opp_fasts") {
            btnToggleOppCountBasis.text = "Their Fasts"
            textOppCountBasisDesc.text = "Counts & 50e/Xf relative to Opponent Fast Moves"
        } else {
            btnToggleOppCountBasis.text = "My Fasts"
            textOppCountBasisDesc.text = "Default: Counts & 50e/Xf relative to My Fast Moves"
        }
    }

    private fun updateOppChargedMovesUi() {
        val enable4 = prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, false)
        if (enable4) {
            btnToggleOppChargedMoves.text = "4 Moves"
            textOppChargedMovesDesc.text = "Active: 4 Charged Moves (Official + Top 2 Usage)"
        } else {
            btnToggleOppChargedMoves.text = "3 Moves"
            textOppChargedMovesDesc.text = "Default: 3 Charged Moves (Official + Top Usage)"
        }
    }

    private fun updateBattleToastsUi() {
        val disableToasts = prefs.getBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, false)
        if (disableToasts) {
            btnToggleBattleToasts.text = "Toasts Off"
            btnToggleBattleToasts.backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF64748B.toInt())
            textBattleToastsDesc.text = "Active: In-game Battle Toast popups disabled"
        } else {
            btnToggleBattleToasts.text = "Toasts On"
            btnToggleBattleToasts.backgroundTintList = android.content.res.ColorStateList.valueOf(0xFF0284C7.toInt())
            textBattleToastsDesc.text = "Default: Popups shown for Battle Start/Stop, Switches & Logs"
        }
    }

    /**
     * Checks notifications (Android 13+), SYSTEM_ALERT_WINDOW, and initiates overlay launch
     */
    private fun checkOverlayPermissionAndStart() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                notificationPermissionLauncher.launch(android.Manifest.permission.POST_NOTIFICATIONS)
                return
            }
        }
        proceedWithOverlayCheck()
    }

    private fun proceedWithOverlayCheck() {
        if (!Settings.canDrawOverlays(this)) {
            val intent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName")
            )
            Toast.makeText(this, "Please grant 'Display over other apps' permission", Toast.LENGTH_LONG).show()
            startActivity(intent)
            return
        }

        // Request MediaProjection token for in-memory screen analysis
        if (projectionManager != null) {
            try {
                val captureIntent = projectionManager!!.createScreenCaptureIntent()
                screenCaptureLauncher.launch(captureIntent)
            } catch (e: Exception) {
                // If createScreenCaptureIntent fails, launch overlay HUD directly
                startOverlayForegroundService(0, null)
            }
        } else {
            startOverlayForegroundService(0, null)
        }
    }

    private fun startOverlayForegroundService(resultCode: Int, data: Intent?) {
        if (OverlayService.areAllFourLeaguesLoaded() && OverlayService.DYNAMIC_POKEMON_DATABASE.isNotEmpty()) {
            launchOverlayServiceNow(resultCode, data)
            return
        }

        statusText.text = "Status: Ensuring all 4 league rankings JSONs are loaded..."
        dbStatusText.text = "Syncing PvPoke GameMaster & all 4 leagues before launching overlay..."
        btnToggleOverlay.isEnabled = false
        Toast.makeText(this, "Downloading/verifying all 4 league rankings before launching overlay...", Toast.LENGTH_SHORT).show()

        lifecycleScope.launch(Dispatchers.IO) {
            var didDownloadAny = false
            try {
                for ((leagueKey, fileName, url) in RANKINGS_ENDPOINTS) {
                    val rFile = File(filesDir, fileName)
                    if (rFile.exists() && rFile.length() > 200 && OverlayService.getLeagueRankingsCount(leagueKey) == 0) {
                        OverlayService.parseRankingsJsonStatic(leagueKey, rFile.readText())
                    }
                    if (OverlayService.getLeagueRankingsCount(leagueKey) == 0) {
                        val rReq = Request.Builder().url(url).build()
                        client.newCall(rReq).execute().use { rResp ->
                            val rBody = rResp.body?.string()
                            if (rResp.isSuccessful && !rBody.isNullOrBlank()) {
                                rFile.writeText(rBody)
                                OverlayService.parseRankingsJsonStatic(leagueKey, rBody)
                                didDownloadAny = true
                            }
                        }
                    }
                }

                val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
                if (cacheFile.exists() && cacheFile.length() > 1000 && OverlayService.DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                    OverlayService.parseGamemasterJsonStatic(cacheFile.readText())
                }
                if (OverlayService.DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                    val req = Request.Builder().url(GAMEMASTER_URL).build()
                    client.newCall(req).execute().use { resp ->
                        val body = resp.body?.string()
                        if (resp.isSuccessful && !body.isNullOrBlank()) {
                            cacheFile.writeText(body)
                            OverlayService.parseGamemasterJsonStatic(body)
                            didDownloadAny = true
                        }
                    }
                }

                if (didDownloadAny || prefs.getLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, 0L) == 0L) {
                    prefs.edit().putLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, System.currentTimeMillis()).apply()
                }
            } catch (_: Exception) {}

            withContext(Dispatchers.Main) {
                btnToggleOverlay.isEnabled = true
                dbStatusText.text = formatDbAndLeagueStatusText()
                if (OverlayService.areAllFourLeaguesLoaded()) {
                    launchOverlayServiceNow(resultCode, data)
                } else {
                    statusText.text = "Status: Waiting for all 4 league rankings JSONs"
                    Toast.makeText(
                        this@MainActivity,
                        "All 4 league rankings JSONs must be downloaded before launching overlay. Check connection and tap Sync PvPoke.",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
    }

    private fun launchOverlayServiceNow(resultCode: Int, data: Intent?) {
        val serviceIntent = Intent(this, OverlayService::class.java).apply {
            action = OverlayService.ACTION_START_OVERLAY
            putExtra(OverlayService.EXTRA_RESULT_CODE, resultCode)
            if (data != null) {
                putExtra(OverlayService.EXTRA_RESULT_DATA, data)
            }
            putExtra(OverlayService.EXTRA_PRESET_JSON, gson.toJson(getSelectedPreset()))
            putExtra(OverlayService.EXTRA_OPP_COUNT_MODE, prefs.getString(PREFS_KEY_OPP_COUNT_MODE, "my_fasts") ?: "my_fasts")
            putExtra(OverlayService.EXTRA_ENABLE_4_CHARGED_MOVES, prefs.getBoolean(PREFS_KEY_ENABLE_4_CHARGED_MOVES, false))
            putExtra(OverlayService.EXTRA_DISABLE_BATTLE_TOASTS, prefs.getBoolean(PREFS_KEY_DISABLE_BATTLE_TOASTS, false))
            putExtra(OverlayService.EXTRA_OVERLAY_SCALE_PCT, prefs.getInt(PREFS_KEY_OVERLAY_SCALE_PCT, DEFAULT_OVERLAY_SCALE_PCT))
            putExtra(OverlayService.EXTRA_OVERLAY_TRANSPARENCY_PCT, prefs.getInt(PREFS_KEY_OVERLAY_TRANSPARENCY_PCT, DEFAULT_OVERLAY_TRANSPARENCY_PCT))
        }

        try {
            ContextCompat.startForegroundService(this, serviceIntent)
            isOverlayRunning = true
            btnToggleOverlay.text = "Stop Battle Overlay"
            statusText.text = "Status: Overlay Active (Option 1 Sky Trench loaded)"
            Toast.makeText(this, "GBL Battle Overlay launched! Check your screen", Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Toast.makeText(this, "Failed to start overlay: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
            e.printStackTrace()
        }
    }

    private fun stopOverlayService() {
        val serviceIntent = Intent(this, OverlayService::class.java).apply {
            action = OverlayService.ACTION_STOP_OVERLAY
        }
        startService(serviceIntent)
        isOverlayRunning = false
        btnToggleOverlay.text = "Start Battle Overlay"
        statusText.text = "Status: Idle"
    }

    /**
     * TEAM PRESET MANAGEMENT:
     * Saves and loads custom team presets locally via SharedPreferences.
     * Automatically migrates any teams from legacy preference keys so updates never overwrite user teams.
     */
    fun loadPresets(): List<TeamPreset> {
        val type = object : TypeToken<List<TeamPreset>>() {}.type
        val persistentJson = prefs.getString(PREFS_KEY_PRESETS, null)
        if (!persistentJson.isNullOrBlank()) {
            val parsed: List<TeamPreset>? = try { gson.fromJson(persistentJson, type) } catch (_: Exception) { null }
            if (!parsed.isNullOrEmpty()) return parsed
        }

        for (legacyKey in OverlayService.LEGACY_PRESET_KEYS) {
            val legacyJson = prefs.getString(legacyKey, null)
            if (!legacyJson.isNullOrBlank()) {
                val parsed: List<TeamPreset>? = try { gson.fromJson(legacyJson, type) } catch (_: Exception) { null }
                if (!parsed.isNullOrEmpty()) {
                    // Migrate permanently to PREFS_KEY_PRESETS so future updates never touch user teams
                    prefs.edit().putString(PREFS_KEY_PRESETS, legacyJson).apply()
                    return parsed
                }
            }
        }
        return emptyList()
    }

    fun savePresets(presets: List<TeamPreset>) {
        prefs.edit().putString(PREFS_KEY_PRESETS, gson.toJson(presets)).apply()
    }

    fun getSelectedPreset(): TeamPreset? {
        val list = loadPresets()
        val selectedId = prefs.getString(PREFS_KEY_SELECTED_PRESET, null)
        return list.find { it.id == selectedId } ?: list.firstOrNull()
    }

    fun setSelectedPreset(presetId: String) {
        prefs.edit().putString(PREFS_KEY_SELECTED_PRESET, presetId).apply()
        refreshPresetsUi()

        // If overlay is running, notify service of the new preset
        if (isOverlayRunning) {
            val updateIntent = Intent(this, OverlayService::class.java).apply {
                action = OverlayService.ACTION_UPDATE_PRESET
                putExtra(OverlayService.EXTRA_PRESET_JSON, gson.toJson(getSelectedPreset()))
            }
            startService(updateIntent)
        }
    }

    private fun movePresetOrder(fromIndex: Int, toIndex: Int) {
        val list = loadPresets().toMutableList()
        if (fromIndex !in list.indices || toIndex !in list.indices || fromIndex == toIndex) return
        val item = list.removeAt(fromIndex)
        list.add(toIndex, item)
        savePresets(list)
        refreshPresetsUi()
    }

    private fun getLeagueTop3Defaults(league: String): List<PokemonSlot> {
        return when {
            league.contains("MEGA", ignoreCase = true) -> listOf(
                PokemonSlot("Mega Rayquaza", 5728, "Dragon Tail", "Breaking Swipe", "Dragon Ascent"),
                PokemonSlot("Primal Groudon", 5910, "Mud Shot", "Precipice Blades", "Fire Punch"),
                PokemonSlot("Primal Kyogre", 5910, "Waterfall", "Origin Pulse", "Surf")
            )
            league.contains("GREAT", ignoreCase = true) -> listOf(
                PokemonSlot("Clodsire", 1494, "Poison Sting", "Earthquake", "Stone Edge"),
                PokemonSlot("Feraligatr", 1498, "Shadow Claw", "Hydro Cannon", "Ice Beam"),
                PokemonSlot("Mandibuzz", 1496, "Snarl", "Dark Pulse", "Aerial Ace")
            )
            league.contains("ULTRA", ignoreCase = true) -> listOf(
                PokemonSlot("Zygarde", 2472, "Dragon Tail", "Crunch", "Earthquake"),
                PokemonSlot("Feraligatr", 2488, "Shadow Claw", "Hydro Cannon", "Ice Beam"),
                PokemonSlot("Giratina (Altered)", 2497, "Shadow Claw", "Dragon Claw", "Ancient Power")
            )
            else -> listOf(
                PokemonSlot("Palkia (Origin)", 4683, "Dragon Breath", "Spacial Rend", "Aqua Tail"),
                PokemonSlot("Zacian (Crowned)", 4658, "Metal Claw", "Behemoth Blade", "Close Combat"),
                PokemonSlot("Dialga (Origin)", 4624, "Dragon Breath", "Roar of Time", "Iron Head")
            )
        }
    }

    private fun ensureDefaultPresets() {
        val existing = loadPresets()
        if (existing.isEmpty()) {
            val defaults = listOf(
                TeamPreset(
                    id = "preset-ml-1",
                    name = "Master: Palkia-O / Zacian-C / Dialga-O",
                    league = "MASTER LEAGUE",
                    pokemon = getLeagueTop3Defaults("MASTER LEAGUE"),
                    isSelected = true
                ),
                TeamPreset(
                    id = "preset-ul-1",
                    name = "Ultra: Zygarde / Feraligatr / Giratina-A",
                    league = "ULTRA LEAGUE",
                    pokemon = getLeagueTop3Defaults("ULTRA LEAGUE")
                ),
                TeamPreset(
                    id = "preset-gl-1",
                    name = "Great: Clodsire / Feraligatr / Mandibuzz",
                    league = "GREAT LEAGUE",
                    pokemon = getLeagueTop3Defaults("GREAT LEAGUE")
                )
            )
            savePresets(defaults)
            if (!prefs.contains(PREFS_KEY_SELECTED_PRESET)) {
                prefs.edit().putString(PREFS_KEY_SELECTED_PRESET, "preset-ml-1").apply()
            }
        }
    }

    private fun refreshPresetsUi() {
        updateTrashButtonsUi()
        presetsContainer.removeAllViews()
        val presets = loadPresets()
        val selectedId = prefs.getString(PREFS_KEY_SELECTED_PRESET, null) ?: presets.firstOrNull()?.id

        presets.forEachIndexed { index, preset ->
            val itemView = layoutInflater.inflate(R.layout.item_team_preset, presetsContainer, false)
            val dragHandle = itemView.findViewById<TextView>(R.id.drag_handle_preset)
            val textName = itemView.findViewById<TextView>(R.id.text_preset_name)
            val textLeague = itemView.findViewById<TextView>(R.id.text_preset_league)
            val textPokemon = itemView.findViewById<TextView>(R.id.text_preset_pokemon)
            val radioSelected = itemView.findViewById<RadioButton>(R.id.radio_selected)
            val btnMoveUp = itemView.findViewById<TextView>(R.id.btn_move_preset_up)
            val btnMoveDown = itemView.findViewById<TextView>(R.id.btn_move_preset_down)
            val btnEdit = itemView.findViewById<ImageButton>(R.id.btn_edit_preset)
            val btnDelete = itemView.findViewById<ImageButton>(R.id.btn_delete_preset)

            val isCurrent = preset.id == selectedId
            radioSelected.isChecked = isCurrent
            textName.text = preset.name

            val maxCp = preset.pokemon.maxOfOrNull { it.cp } ?: 0
            val resolvedLeague = when {
                preset.league.contains("MEGA", ignoreCase = true) -> "MEGA MASTER LEAGUE"
                preset.league.contains("GREAT", ignoreCase = true) || (maxCp in 1..1500) -> "GREAT LEAGUE"
                preset.league.contains("ULTRA", ignoreCase = true) || (maxCp in 1501..2500) -> "ULTRA LEAGUE"
                else -> "MASTER LEAGUE"
            }
            textLeague.text = resolvedLeague
            textLeague.setTextColor(
                when (resolvedLeague) {
                    "GREAT LEAGUE" -> 0xFF38BDF8.toInt()
                    "ULTRA LEAGUE" -> 0xFFFBBF24.toInt()
                    "MEGA MASTER LEAGUE" -> 0xFFE879F9.toInt()
                    else -> 0xFFC084FC.toInt()
                }
            )
            textPokemon.text = preset.pokemon.joinToString("\n") {
                val ivLabel = if (!it.ivs.isNullOrBlank()) " · IV ${it.ivs}" else ""
                "• ${it.name} (CP ${it.cp}$ivLabel) — ${it.fastMove} | ${it.chargedMove1}, ${it.chargedMove2}"
            }

            btnMoveUp?.alpha = if (index == 0) 0.3f else 1.0f
            btnMoveDown?.alpha = if (index == presets.lastIndex) 0.3f else 1.0f
            btnMoveUp?.setOnClickListener {
                if (index > 0) movePresetOrder(index, index - 1)
            }
            btnMoveDown?.setOnClickListener {
                if (index < presets.lastIndex) movePresetOrder(index, index + 1)
            }

            val startDragAction = { v: android.view.View ->
                val clipData = android.content.ClipData.newPlainText("preset_index", index.toString())
                val shadow = android.view.View.DragShadowBuilder(itemView)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    v.startDragAndDrop(clipData, shadow, index, 0)
                } else {
                    @Suppress("DEPRECATION")
                    v.startDrag(clipData, shadow, index, 0)
                }
                true
            }
            dragHandle?.setOnLongClickListener { startDragAction(itemView) }
            itemView.setOnLongClickListener { startDragAction(itemView) }

            itemView.setOnDragListener { v, event ->
                when (event.action) {
                    android.view.DragEvent.ACTION_DRAG_STARTED -> true
                    android.view.DragEvent.ACTION_DRAG_ENTERED -> {
                        v.alpha = 0.65f
                        true
                    }
                    android.view.DragEvent.ACTION_DRAG_EXITED,
                    android.view.DragEvent.ACTION_DRAG_ENDED -> {
                        v.alpha = 1.0f
                        true
                    }
                    android.view.DragEvent.ACTION_DROP -> {
                        v.alpha = 1.0f
                        val fromIdx = (event.localState as? Int)
                            ?: event.clipData?.getItemAt(0)?.text?.toString()?.toIntOrNull()
                        if (fromIdx != null && fromIdx != index) {
                            movePresetOrder(fromIdx, index)
                        }
                        true
                    }
                    else -> true
                }
            }

            itemView.setOnClickListener {
                setSelectedPreset(preset.id)
            }
            radioSelected.setOnClickListener {
                setSelectedPreset(preset.id)
            }

            btnEdit.setOnClickListener {
                showPresetEditorDialog(preset)
            }

            btnDelete.setOnClickListener {
                if (presets.size <= 1) {
                    Toast.makeText(this, "Must keep at least 1 team preset", Toast.LENGTH_SHORT).show()
                } else {
                    val trash = loadDeletedTeamsTrash().toMutableList()
                    trash.removeAll { it.id == preset.id }
                    trash.add(0, preset)
                    saveDeletedTeamsTrash(trash)

                    val delTeamIds = loadDeletedTeamIds().toMutableList()
                    delTeamIds.add(preset.id)
                    saveDeletedTeamIds(delTeamIds)

                    val updated = presets.filter { it.id != preset.id }
                    savePresets(updated)
                    if (isCurrent) {
                        setSelectedPreset(updated.first().id)
                    } else {
                        refreshPresetsUi()
                    }
                    setupBattleLogFilters()
                    updateSyncStatusUi()
                    triggerTwoDeviceCloudSync(silent = true)
                    showUndoBanner("🗑️ Team '${preset.name}' moved to Trash") {
                        restoreTeamPresetFromTrash(preset)
                        Toast.makeText(this, "Team '${preset.name}' restored!", Toast.LENGTH_SHORT).show()
                    }
                }
            }

            presetsContainer.addView(itemView)
        }
    }

    private inner class PokemonAutocompleteAdapter(
        private val leagueProvider: () -> String
    ) : BaseAdapter(), Filterable {

        private var items: List<OverlayService.Companion.PokemonAutocompleteSuggestion> = emptyList()

        override fun getCount(): Int = items.size
        override fun getItem(position: Int): OverlayService.Companion.PokemonAutocompleteSuggestion = items[position]
        override fun getItemId(position: Int): Long = position.toLong()

        override fun getView(position: Int, convertView: android.view.View?, parent: android.view.ViewGroup?): android.view.View {
            val container = (convertView as? LinearLayout) ?: LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                setBackgroundColor(0xFF0F172A.toInt())
                val padH = (12 * resources.displayMetrics.density).toInt()
                val padV = (8 * resources.displayMetrics.density).toInt()
                setPadding(padH, padV, padH, padV)
            }
            container.removeAllViews()

            val item = items[position]

            val topRow = LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.HORIZONTAL
            }
            val nameTv = TextView(this@MainActivity).apply {
                text = item.name
                textSize = 13f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setTextColor(0xFFFFFFFF.toInt())
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            val badgeTv = TextView(this@MainActivity).apply {
                text = "${item.formBadge} • CP ${item.cp}"
                textSize = 10.5f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
                setTextColor(
                    when {
                        item.isShadow -> 0xFFD8B4FE.toInt()
                        item.isAlternateForm -> 0xFFFDE68A.toInt()
                        else -> 0xFF38BDF8.toInt()
                    }
                )
            }
            topRow.addView(nameTv)
            topRow.addView(badgeTv)

            val movesTv = TextView(this@MainActivity).apply {
                text = "${item.fastMove}  •  ${item.chargedMove1} / ${item.chargedMove2}"
                textSize = 11f
                setTextColor(0xFF94A3B8.toInt())
            }

            container.addView(topRow)
            container.addView(movesTv)
            return container
        }

        override fun getFilter(): Filter {
            return object : Filter() {
                override fun performFiltering(constraint: CharSequence?): FilterResults {
                    val results = FilterResults()
                    val query = constraint?.toString()?.trim().orEmpty()
                    val suggestions = if (query.isEmpty()) {
                        emptyList()
                    } else {
                        OverlayService.getAutocompletePokemonSuggestions(query, leagueProvider(), 20)
                    }
                    results.values = suggestions
                    results.count = suggestions.size
                    return results
                }

                @Suppress("UNCHECKED_CAST")
                override fun publishResults(constraint: CharSequence?, results: FilterResults?) {
                    items = (results?.values as? List<OverlayService.Companion.PokemonAutocompleteSuggestion>) ?: emptyList()
                    if (items.isNotEmpty()) {
                        notifyDataSetChanged()
                    } else {
                        notifyDataSetInvalidated()
                    }
                }

                override fun convertResultToString(resultValue: Any?): CharSequence {
                    return (resultValue as? OverlayService.Companion.PokemonAutocompleteSuggestion)?.name ?: ""
                }
            }
        }
    }

    private fun showPresetEditorDialog(existingPreset: TeamPreset?) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_create_preset, null)
        val editName = dialogView.findViewById<EditText>(R.id.edit_preset_name)
        val spinnerLeague = dialogView.findViewById<Spinner>(R.id.spinner_league)

        val editP1 = dialogView.findViewById<AutoCompleteTextView>(R.id.edit_p1_name)
        val editP1Cp = dialogView.findViewById<EditText>(R.id.edit_p1_cp)
        val editP1Ivs = dialogView.findViewById<EditText>(R.id.edit_p1_ivs)
        val editP1Fast = dialogView.findViewById<EditText>(R.id.edit_p1_fast)
        val editP1C1 = dialogView.findViewById<EditText>(R.id.edit_p1_c1)
        val editP1C2 = dialogView.findViewById<EditText>(R.id.edit_p1_c2)

        val editP2 = dialogView.findViewById<AutoCompleteTextView>(R.id.edit_p2_name)
        val editP2Cp = dialogView.findViewById<EditText>(R.id.edit_p2_cp)
        val editP2Ivs = dialogView.findViewById<EditText>(R.id.edit_p2_ivs)
        val editP2Fast = dialogView.findViewById<EditText>(R.id.edit_p2_fast)
        val editP2C1 = dialogView.findViewById<EditText>(R.id.edit_p2_c1)
        val editP2C2 = dialogView.findViewById<EditText>(R.id.edit_p2_c2)

        val editP3 = dialogView.findViewById<AutoCompleteTextView>(R.id.edit_p3_name)
        val editP3Cp = dialogView.findViewById<EditText>(R.id.edit_p3_cp)
        val editP3Ivs = dialogView.findViewById<EditText>(R.id.edit_p3_ivs)
        val editP3Fast = dialogView.findViewById<EditText>(R.id.edit_p3_fast)
        val editP3C1 = dialogView.findViewById<EditText>(R.id.edit_p3_c1)
        val editP3C2 = dialogView.findViewById<EditText>(R.id.edit_p3_c2)

        val leagues = arrayOf("GREAT LEAGUE", "ULTRA LEAGUE", "MASTER LEAGUE", "MEGA MASTER LEAGUE")
        spinnerLeague.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, leagues)

        val currentLeagueProvider = {
            spinnerLeague.selectedItem?.toString() ?: "GREAT LEAGUE"
        }

        fun bindSlotAutocomplete(
            nameAuto: AutoCompleteTextView,
            cpEdit: EditText,
            ivsEdit: EditText,
            fastEdit: EditText,
            c1Edit: EditText,
            c2Edit: EditText
        ) {
            val adapter = PokemonAutocompleteAdapter(currentLeagueProvider)
            nameAuto.setAdapter(adapter)
            nameAuto.threshold = 1
            nameAuto.setOnItemClickListener { parent, _, position, _ ->
                val chosen = parent.getItemAtPosition(position) as? OverlayService.Companion.PokemonAutocompleteSuggestion ?: return@setOnItemClickListener
                nameAuto.setText(chosen.name, false)
                val customIvs = ivsEdit.text.toString().trim().takeIf { it.isNotEmpty() }
                val rec = OverlayService.resolveRecommendedMovesForSpecies(chosen.name, currentLeagueProvider())
                if (rec != null) {
                    val scaled = OverlayService.computeEffectiveCombatStats(rec, currentLeagueProvider(), null, customIvs)
                    fastEdit.setText(scaled.defaultFastMove)
                    c1Edit.setText(scaled.chargedMove1)
                    c2Edit.setText(scaled.chargedMove2)
                    cpEdit.setText(scaled.defaultCp.toString())
                } else {
                    fastEdit.setText(chosen.fastMove)
                    c1Edit.setText(chosen.chargedMove1)
                    c2Edit.setText(chosen.chargedMove2)
                    cpEdit.setText(chosen.cp.toString())
                }
            }
        }

        bindSlotAutocomplete(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2)
        bindSlotAutocomplete(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2)
        bindSlotAutocomplete(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2)

        fun updateLeagueTemplateHints(selectedLeague: String) {
            val top3 = getLeagueTop3Defaults(selectedLeague)
            editP1.hint = "Name (e.g. ${top3[0].name})"
            editP2.hint = "Name (e.g. ${top3[1].name})"
            editP3.hint = "Name (e.g. ${top3[2].name})"
            val ivHint = if (selectedLeague.contains("MASTER", ignoreCase = true)) "IVs (def 15/15/15)" else "IVs (PvPoke def)"
            editP1Ivs.hint = ivHint
            editP2Ivs.hint = ivHint
            editP3Ivs.hint = ivHint
        }

        fun autoFillMovesForSlot(
            nameEdit: EditText,
            cpEdit: EditText,
            ivsEdit: EditText,
            fastEdit: EditText,
            c1Edit: EditText,
            c2Edit: EditText
        ) {
            val enteredName = nameEdit.text.toString().trim()
            if (enteredName.isEmpty()) return
            val selectedLeague = currentLeagueProvider()
            val rec = OverlayService.resolveRecommendedMovesForSpecies(enteredName, selectedLeague) ?: return
            val customIvs = ivsEdit.text.toString().trim().takeIf { it.isNotEmpty() }
            val scaled = OverlayService.computeEffectiveCombatStats(rec, selectedLeague, null, customIvs)

            if (fastEdit.text.toString().trim().isEmpty()) {
                fastEdit.setText(scaled.defaultFastMove)
            }
            if (c1Edit.text.toString().trim().isEmpty()) {
                c1Edit.setText(scaled.chargedMove1)
            }
            if (c2Edit.text.toString().trim().isEmpty()) {
                c2Edit.setText(scaled.chargedMove2)
            }
            if (cpEdit.text.toString().trim().isEmpty()) {
                cpEdit.setText(scaled.defaultCp.toString())
            }
        }

        editP1.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) autoFillMovesForSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2)
        }
        editP2.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) autoFillMovesForSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2)
        }
        editP3.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) autoFillMovesForSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2)
        }

        spinnerLeague.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: AdapterView<*>?, view: android.view.View?, position: Int, id: Long) {
                val lg = leagues.getOrElse(position) { "GREAT LEAGUE" }
                updateLeagueTemplateHints(lg)
            }
            override fun onNothingSelected(parent: AdapterView<*>?) {}
        }

        if (existingPreset != null) {
            editName.setText(existingPreset.name)
            val leagueIdx = leagues.indexOfFirst { existingPreset.league.equals(it, ignoreCase = true) }
                .takeIf { it >= 0 } ?: 0
            spinnerLeague.setSelection(leagueIdx)
            updateLeagueTemplateHints(leagues[leagueIdx])

            existingPreset.pokemon.getOrNull(0)?.let {
                editP1.setText(it.name, false)
                editP1Cp.setText(it.cp.toString())
                editP1Ivs.setText(it.ivs ?: "")
                editP1Fast.setText(it.fastMove)
                editP1C1.setText(it.chargedMove1)
                editP1C2.setText(it.chargedMove2)
            }
            existingPreset.pokemon.getOrNull(1)?.let {
                editP2.setText(it.name, false)
                editP2Cp.setText(it.cp.toString())
                editP2Ivs.setText(it.ivs ?: "")
                editP2Fast.setText(it.fastMove)
                editP2C1.setText(it.chargedMove1)
                editP2C2.setText(it.chargedMove2)
            }
            existingPreset.pokemon.getOrNull(2)?.let {
                editP3.setText(it.name, false)
                editP3Cp.setText(it.cp.toString())
                editP3Ivs.setText(it.ivs ?: "")
                editP3Fast.setText(it.fastMove)
                editP3C1.setText(it.chargedMove1)
                editP3C2.setText(it.chargedMove2)
            }
        } else {
            updateLeagueTemplateHints("GREAT LEAGUE")
        }

        fun buildResolvedSlot(
            nameEdit: EditText,
            cpEdit: EditText,
            ivsEdit: EditText,
            fastEdit: EditText,
            c1Edit: EditText,
            c2Edit: EditText,
            league: String,
            fallbackSlot: PokemonSlot
        ): PokemonSlot {
            val finalName = nameEdit.text.toString().trim().ifEmpty { fallbackSlot.name }
            val enteredIvs = ivsEdit.text.toString().trim().takeIf { it.isNotEmpty() }
            val recMeta = OverlayService.resolveRecommendedMovesForSpecies(finalName, league)
            val enteredCp = cpEdit.text.toString().trim().toIntOrNull()
            val scaledMeta = recMeta?.let {
                OverlayService.computeEffectiveCombatStats(it, league, enteredCp, enteredIvs)
            }

            val finalCp = enteredCp ?: scaledMeta?.defaultCp ?: fallbackSlot.cp
            val finalFast = fastEdit.text.toString().trim().ifEmpty {
                scaledMeta?.defaultFastMove ?: fallbackSlot.fastMove
            }
            val finalC1 = c1Edit.text.toString().trim().ifEmpty {
                scaledMeta?.chargedMove1 ?: fallbackSlot.chargedMove1
            }
            val finalC2 = c2Edit.text.toString().trim().ifEmpty {
                scaledMeta?.chargedMove2 ?: fallbackSlot.chargedMove2
            }

            return PokemonSlot(
                name = finalName,
                cp = finalCp,
                fastMove = finalFast,
                chargedMove1 = finalC1,
                chargedMove2 = finalC2,
                ivs = enteredIvs
            )
        }

        AlertDialog.Builder(this)
            .setTitle(if (existingPreset != null) "Edit Team & Moves" else "Create Custom GBL Team")
            .setView(dialogView)
            .setPositiveButton("Save Team") { _, _ ->
                val league = spinnerLeague.selectedItem.toString()
                val top3Defaults = getLeagueTop3Defaults(league)
                val name = editName.text.toString().trim().ifEmpty { "${league.split(" ").first().lowercase().replaceFirstChar { it.uppercase() }} Team" }

                val p1 = buildResolvedSlot(editP1, editP1Cp, editP1Ivs, editP1Fast, editP1C1, editP1C2, league, top3Defaults[0])
                val p2 = buildResolvedSlot(editP2, editP2Cp, editP2Ivs, editP2Fast, editP2C1, editP2C2, league, top3Defaults[1])
                val p3 = buildResolvedSlot(editP3, editP3Cp, editP3Ivs, editP3Fast, editP3C1, editP3C2, league, top3Defaults[2])

                val savedPreset = TeamPreset(
                    id = existingPreset?.id ?: UUID.randomUUID().toString(),
                    name = name,
                    league = league,
                    pokemon = listOf(p1, p2, p3),
                    isSelected = existingPreset?.isSelected ?: false,
                    updatedAt = System.currentTimeMillis()
                )

                val list = loadPresets().toMutableList()
                val existingIdx = list.indexOfFirst { it.id == savedPreset.id }
                if (existingIdx >= 0) {
                    list[existingIdx] = savedPreset
                } else {
                    list.add(savedPreset)
                }
                savePresets(list)
                setSelectedPreset(savedPreset.id)
                setupBattleLogFilters()
                triggerTwoDeviceCloudSync(silent = true)
                Toast.makeText(this, "Saved '${name}' & updated moves!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun formatDbAndLeagueStatusText(): String {
        val lastSyncMs = prefs.getLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, 0L)
        val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
        val effectiveMs = if (lastSyncMs > 0L) lastSyncMs else if (cacheFile.exists()) cacheFile.lastModified() else 0L
        val dateStr = if (effectiveMs > 0L) {
            java.text.SimpleDateFormat("MMM d, yyyy h:mm a", java.util.Locale.US).format(java.util.Date(effectiveMs))
        } else {
            "Not synced"
        }
        val gmCount = OverlayService.getGamemasterLoadedCount()
        val glCount = OverlayService.getLeagueRankingsCount("GREAT LEAGUE")
        val ulCount = OverlayService.getLeagueRankingsCount("ULTRA LEAGUE")
        val mlCount = OverlayService.getLeagueRankingsCount("MASTER LEAGUE")
        val megaCount = OverlayService.getLeagueRankingsCount("MEGA MASTER LEAGUE")
        return "Last Updated: $dateStr • GameMaster: $gmCount Pokémon\nLeagues Loaded — GL: $glCount • UL: $ulCount • ML: $mlCount • Mega: $megaCount"
    }

    /**
     * PVPOKE GAMEMASTER + LEAGUE RANKINGS DOWNLOAD & CACHE:
     * Downloads raw live PvPoke gamemaster.json + GL/UL/ML/Mega Master rankings JSONs
     */
    private fun checkGamemasterCache() {
        val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
        if (cacheFile.exists()) {
            dbStatusText.text = "Loading cached PvPoke GameMaster & 4 League Rankings..."
            lifecycleScope.launch(Dispatchers.IO) {
                var didDownloadMissing = false
                try {
                    for ((leagueKey, fileName, url) in RANKINGS_ENDPOINTS) {
                        val rFile = File(filesDir, fileName)
                        if (rFile.exists() && rFile.length() > 200) {
                            OverlayService.parseRankingsJsonStatic(leagueKey, rFile.readText())
                        } else {
                            try {
                                val rReq = Request.Builder().url(url).build()
                                client.newCall(rReq).execute().use { rResp ->
                                    val rBody = rResp.body?.string()
                                    if (rResp.isSuccessful && !rBody.isNullOrBlank()) {
                                        rFile.writeText(rBody)
                                        OverlayService.parseRankingsJsonStatic(leagueKey, rBody)
                                        didDownloadMissing = true
                                    }
                                }
                            } catch (_: Exception) {}
                        }
                    }
                    OverlayService.parseGamemasterJsonStatic(cacheFile.readText())
                    if (didDownloadMissing || prefs.getLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, 0L) == 0L) {
                        prefs.edit().putLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, cacheFile.lastModified().takeIf { it > 0L } ?: System.currentTimeMillis()).apply()
                    }
                } catch (_: Exception) {}
                withContext(Dispatchers.Main) {
                    dbStatusText.text = formatDbAndLeagueStatusText()
                    reparseAllCompletedBattles(silent = true)
                }
            }
        } else {
            dbStatusText.text = "PvPoke Database: Not cached (syncing all 4 leagues...)"
            downloadPvPokeGamemaster()
        }
    }

    private fun downloadPvPokeGamemaster() {
        dbStatusText.text = "Downloading PvPoke gamemaster.json + GL/UL/ML/Mega rankings..."
        btnDownloadDb.isEnabled = false

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                for ((leagueKey, fileName, url) in RANKINGS_ENDPOINTS) {
                    try {
                        val rReq = Request.Builder().url(url).build()
                        client.newCall(rReq).execute().use { rResp ->
                            if (rResp.isSuccessful) {
                                val rBody = rResp.body?.string()
                                if (!rBody.isNullOrBlank()) {
                                    File(filesDir, fileName).writeText(rBody)
                                    OverlayService.parseRankingsJsonStatic(leagueKey, rBody)
                                }
                            }
                        }
                    } catch (_: Exception) {}
                }

                val request = Request.Builder().url(GAMEMASTER_URL).build()
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) throw Exception("HTTP ${response.code}")
                    val bodyString = response.body?.string() ?: throw Exception("Empty body")

                    val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
                    cacheFile.writeText(bodyString)
                    OverlayService.parseGamemasterJsonStatic(bodyString)
                    prefs.edit().putLong(PREFS_KEY_LAST_SYNC_TIMESTAMP, System.currentTimeMillis()).apply()

                    withContext(Dispatchers.Main) {
                        dbStatusText.text = formatDbAndLeagueStatusText()
                        btnDownloadDb.isEnabled = true
                        reparseAllCompletedBattles(silent = true)
                        Toast.makeText(this@MainActivity, "PvPoke gamemaster & all 4 league rankings synced!", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    dbStatusText.text = "Database Sync Failed: ${e.localizedMessage}\n${formatDbAndLeagueStatusText()}"
                    btnDownloadDb.isEnabled = true
                    Toast.makeText(this@MainActivity, "Sync error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
