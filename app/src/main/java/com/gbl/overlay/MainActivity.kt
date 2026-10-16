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

/**
 * Data model for a custom saved GBL Team Preset
 */
data class PokemonSlot(
    val name: String,
    val cp: Int,
    val fastMove: String,
    val chargedMove1: String,
    val chargedMove2: String,
    val ivs: String? = null
)

data class TeamPreset(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val league: String, // "MASTER LEAGUE", "ULTRA LEAGUE", "GREAT LEAGUE"
    val pokemon: List<PokemonSlot>,
    val isSelected: Boolean = false
)

/**
 * MainActivity handles:
 * 1. Permission checks (SYSTEM_ALERT_WINDOW, POST_NOTIFICATIONS & MediaProjection Screen Capture)
 * 2. Background download & caching of PvPoke gamemaster.json
 * 3. Saving, loading, creating, and switching custom GBL Team Presets locally
 * 4. Launching the OverlayService foreground service (with robust fallback so overlay ALWAYS displays)
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
    private lateinit var btnToggleOppCountBasis: Button
    private lateinit var textOppCountBasisDesc: TextView
    private lateinit var seekbarOverlayScale: SeekBar
    private lateinit var textOverlayScaleValue: TextView
    private lateinit var textOverlayScaleDefaultTick: TextView
    private lateinit var presetsContainer: LinearLayout

    private val PREFS_KEY_PRESETS = OverlayService.PREFS_KEY_PERSISTENT_TEAMS
    private val PREFS_KEY_SELECTED_PRESET = "gbl_selected_preset_id"
    private val PREFS_KEY_OPP_COUNT_MODE = "opp_count_mode"
    private val PREFS_KEY_OVERLAY_SCALE_PCT = "overlay_scale_pct"
    private val DEFAULT_OVERLAY_SCALE_PCT = 78
    private val DONATION_URL = "https://buymeacoffee.com/sportsfan986"
    private val GAMEMASTER_URL = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json"

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
        projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager

        initViews()
        ensureDefaultPresets()
        refreshPresetsUi()
        checkGamemasterCache()
    }

    private fun scalePctToProgress(scalePct: Int): Int {
        val clamped = scalePct.coerceIn(50, 100)
        return ((clamped - 50) / 2).coerceIn(0, 25)
    }

    private fun progressToScalePct(progress: Int): Int {
        return (50 + progress.coerceIn(0, 25) * 2).coerceIn(50, 100)
    }

    private fun initViews() {
        statusText = findViewById(R.id.text_status)
        dbStatusText = findViewById(R.id.text_db_status)
        btnToggleOverlay = findViewById(R.id.btn_toggle_overlay)
        btnDownloadDb = findViewById(R.id.btn_download_db)
        btnAddPreset = findViewById(R.id.btn_add_preset)
        btnDonate = findViewById(R.id.btn_donate)
        btnToggleOppCountBasis = findViewById(R.id.btn_toggle_opp_count_basis)
        textOppCountBasisDesc = findViewById(R.id.text_opp_count_basis_desc)
        seekbarOverlayScale = findViewById(R.id.seekbar_overlay_scale)
        textOverlayScaleValue = findViewById(R.id.text_overlay_scale_value)
        textOverlayScaleDefaultTick = findViewById(R.id.text_overlay_scale_default_tick)
        presetsContainer = findViewById(R.id.layout_presets_list)

        updateOppCountBasisUi()

        val savedScalePct = prefs.getInt(PREFS_KEY_OVERLAY_SCALE_PCT, DEFAULT_OVERLAY_SCALE_PCT).coerceIn(50, 100)
        seekbarOverlayScale.progress = scalePctToProgress(savedScalePct)
        updateOverlayScaleUi(progressToScalePct(seekbarOverlayScale.progress))

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

        btnAddPreset.setOnClickListener {
            showPresetEditorDialog(null)
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
    }

    private fun updateOverlayScaleUi(scalePct: Int) {
        textOverlayScaleValue.text = if (scalePct == DEFAULT_OVERLAY_SCALE_PCT) {
            "${scalePct}% (Default)"
        } else {
            "${scalePct}%"
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
        val serviceIntent = Intent(this, OverlayService::class.java).apply {
            action = OverlayService.ACTION_START_OVERLAY
            putExtra(OverlayService.EXTRA_RESULT_CODE, resultCode)
            if (data != null) {
                putExtra(OverlayService.EXTRA_RESULT_DATA, data)
            }
            putExtra(OverlayService.EXTRA_PRESET_JSON, gson.toJson(getSelectedPreset()))
            putExtra(OverlayService.EXTRA_OPP_COUNT_MODE, prefs.getString(PREFS_KEY_OPP_COUNT_MODE, "my_fasts") ?: "my_fasts")
            putExtra(OverlayService.EXTRA_OVERLAY_SCALE_PCT, prefs.getInt(PREFS_KEY_OVERLAY_SCALE_PCT, DEFAULT_OVERLAY_SCALE_PCT))
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

    private fun getLeagueTop3Defaults(league: String): List<PokemonSlot> {
        return when {
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
        presetsContainer.removeAllViews()
        val presets = loadPresets()
        val selectedId = prefs.getString(PREFS_KEY_SELECTED_PRESET, null) ?: presets.firstOrNull()?.id

        for (preset in presets) {
            val itemView = layoutInflater.inflate(R.layout.item_team_preset, presetsContainer, false)
            val textName = itemView.findViewById<TextView>(R.id.text_preset_name)
            val textLeague = itemView.findViewById<TextView>(R.id.text_preset_league)
            val textPokemon = itemView.findViewById<TextView>(R.id.text_preset_pokemon)
            val radioSelected = itemView.findViewById<RadioButton>(R.id.radio_selected)
            val btnEdit = itemView.findViewById<ImageButton>(R.id.btn_edit_preset)
            val btnDelete = itemView.findViewById<ImageButton>(R.id.btn_delete_preset)

            val isCurrent = preset.id == selectedId
            radioSelected.isChecked = isCurrent
            textName.text = preset.name

            val maxCp = preset.pokemon.maxOfOrNull { it.cp } ?: 0
            val resolvedLeague = when {
                preset.league.contains("GREAT", ignoreCase = true) || (maxCp in 1..1500) -> "GREAT LEAGUE"
                preset.league.contains("ULTRA", ignoreCase = true) || (maxCp in 1501..2500) -> "ULTRA LEAGUE"
                else -> "MASTER LEAGUE"
            }
            textLeague.text = resolvedLeague
            textLeague.setTextColor(
                when (resolvedLeague) {
                    "GREAT LEAGUE" -> 0xFF38BDF8.toInt()
                    "ULTRA LEAGUE" -> 0xFFFBBF24.toInt()
                    else -> 0xFFC084FC.toInt()
                }
            )
            textPokemon.text = preset.pokemon.joinToString("\n") {
                val ivLabel = if (!it.ivs.isNullOrBlank()) " · IV ${it.ivs}" else ""
                "• ${it.name} (CP ${it.cp}$ivLabel) — ${it.fastMove} | ${it.chargedMove1}, ${it.chargedMove2}"
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
                    val updated = presets.filter { it.id != preset.id }
                    savePresets(updated)
                    if (isCurrent) {
                        setSelectedPreset(updated.first().id)
                    } else {
                        refreshPresetsUi()
                    }
                }
            }

            presetsContainer.addView(itemView)
        }
    }

    private fun showPresetEditorDialog(existingPreset: TeamPreset?) {
        val dialogView = layoutInflater.inflate(R.layout.dialog_create_preset, null)
        val editName = dialogView.findViewById<EditText>(R.id.edit_preset_name)
        val spinnerLeague = dialogView.findViewById<Spinner>(R.id.spinner_league)

        val editP1 = dialogView.findViewById<EditText>(R.id.edit_p1_name)
        val editP1Cp = dialogView.findViewById<EditText>(R.id.edit_p1_cp)
        val editP1Ivs = dialogView.findViewById<EditText>(R.id.edit_p1_ivs)
        val editP1Fast = dialogView.findViewById<EditText>(R.id.edit_p1_fast)
        val editP1C1 = dialogView.findViewById<EditText>(R.id.edit_p1_c1)
        val editP1C2 = dialogView.findViewById<EditText>(R.id.edit_p1_c2)

        val editP2 = dialogView.findViewById<EditText>(R.id.edit_p2_name)
        val editP2Cp = dialogView.findViewById<EditText>(R.id.edit_p2_cp)
        val editP2Ivs = dialogView.findViewById<EditText>(R.id.edit_p2_ivs)
        val editP2Fast = dialogView.findViewById<EditText>(R.id.edit_p2_fast)
        val editP2C1 = dialogView.findViewById<EditText>(R.id.edit_p2_c1)
        val editP2C2 = dialogView.findViewById<EditText>(R.id.edit_p2_c2)

        val editP3 = dialogView.findViewById<EditText>(R.id.edit_p3_name)
        val editP3Cp = dialogView.findViewById<EditText>(R.id.edit_p3_cp)
        val editP3Ivs = dialogView.findViewById<EditText>(R.id.edit_p3_ivs)
        val editP3Fast = dialogView.findViewById<EditText>(R.id.edit_p3_fast)
        val editP3C1 = dialogView.findViewById<EditText>(R.id.edit_p3_c1)
        val editP3C2 = dialogView.findViewById<EditText>(R.id.edit_p3_c2)

        val leagues = arrayOf("GREAT LEAGUE", "ULTRA LEAGUE", "MASTER LEAGUE")
        spinnerLeague.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, leagues)

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
            val selectedLeague = spinnerLeague.selectedItem?.toString() ?: "GREAT LEAGUE"
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
            val leagueIdx = leagues.indexOfFirst { existingPreset.league.contains(it.split(" ").first(), ignoreCase = true) }.coerceAtLeast(0)
            spinnerLeague.setSelection(leagueIdx)
            updateLeagueTemplateHints(leagues[leagueIdx])

            existingPreset.pokemon.getOrNull(0)?.let {
                editP1.setText(it.name)
                editP1Cp.setText(it.cp.toString())
                editP1Ivs.setText(it.ivs ?: "")
                editP1Fast.setText(it.fastMove)
                editP1C1.setText(it.chargedMove1)
                editP1C2.setText(it.chargedMove2)
            }
            existingPreset.pokemon.getOrNull(1)?.let {
                editP2.setText(it.name)
                editP2Cp.setText(it.cp.toString())
                editP2Ivs.setText(it.ivs ?: "")
                editP2Fast.setText(it.fastMove)
                editP2C1.setText(it.chargedMove1)
                editP2C2.setText(it.chargedMove2)
            }
            existingPreset.pokemon.getOrNull(2)?.let {
                editP3.setText(it.name)
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
                    isSelected = existingPreset?.isSelected ?: false
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
                Toast.makeText(this, "Saved '${name}' & updated moves!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    /**
     * PVPOKE GAMEMASTER DOWNLOAD & CACHE:
     * Downloads raw live PvPoke gamemaster.json and compiles local offline cache
     */
    private fun checkGamemasterCache() {
        val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
        if (cacheFile.exists()) {
            val sizeKb = cacheFile.length() / 1024
            dbStatusText.text = "PvPoke Database: Cached (${sizeKb} KB offline ready)"
            lifecycleScope.launch(Dispatchers.IO) {
                try {
                    OverlayService.parseGamemasterJsonStatic(cacheFile.readText())
                } catch (_: Exception) {}
            }
        } else {
            dbStatusText.text = "PvPoke Database: Not cached (tap Download to sync)"
        }
    }

    private fun downloadPvPokeGamemaster() {
        dbStatusText.text = "Downloading PvPoke gamemaster.json..."
        btnDownloadDb.isEnabled = false

        lifecycleScope.launch(Dispatchers.IO) {
            try {
                val request = Request.Builder().url(GAMEMASTER_URL).build()
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) throw Exception("HTTP ${response.code}")
                    val bodyString = response.body?.string() ?: throw Exception("Empty body")

                    val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
                    cacheFile.writeText(bodyString)
                    OverlayService.parseGamemasterJsonStatic(bodyString)

                    withContext(Dispatchers.Main) {
                        val sizeKb = cacheFile.length() / 1024
                        dbStatusText.text = "PvPoke Database: Synced (${sizeKb} KB, live stats ready)"
                        btnDownloadDb.isEnabled = true
                        Toast.makeText(this@MainActivity, "PvPoke gamemaster synced successfully!", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    dbStatusText.text = "Database Sync Failed: ${e.localizedMessage}"
                    btnDownloadDb.isEnabled = true
                    Toast.makeText(this@MainActivity, "Sync error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
