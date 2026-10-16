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
    val chargedMove2: String
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
    private lateinit var btnToggleOppCountBasis: Button
    private lateinit var textOppCountBasisDesc: TextView
    private lateinit var presetsContainer: LinearLayout

    private val PREFS_KEY_PRESETS = "gbl_team_presets_v5"
    private val PREFS_KEY_SELECTED_PRESET = "gbl_selected_preset_id"
    private val PREFS_KEY_OPP_COUNT_MODE = "opp_count_mode"
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

        prefs = getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)
        projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager

        initViews()
        ensureDefaultPresets()
        refreshPresetsUi()
        checkGamemasterCache()
    }

    private fun initViews() {
        statusText = findViewById(R.id.text_status)
        dbStatusText = findViewById(R.id.text_db_status)
        btnToggleOverlay = findViewById(R.id.btn_toggle_overlay)
        btnDownloadDb = findViewById(R.id.btn_download_db)
        btnAddPreset = findViewById(R.id.btn_add_preset)
        btnToggleOppCountBasis = findViewById(R.id.btn_toggle_opp_count_basis)
        textOppCountBasisDesc = findViewById(R.id.text_opp_count_basis_desc)
        presetsContainer = findViewById(R.id.layout_presets_list)

        updateOppCountBasisUi()

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
     * Saves and loads custom team presets locally via SharedPreferences
     */
    fun loadPresets(): List<TeamPreset> {
        val json = prefs.getString(PREFS_KEY_PRESETS, null) ?: return emptyList()
        val type = object : TypeToken<List<TeamPreset>>() {}.type
        return gson.fromJson(json, type) ?: emptyList()
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

    private fun ensureDefaultPresets() {
        val existing = loadPresets()
        if (existing.isEmpty()) {
            val defaults = listOf(
                TeamPreset(
                    id = "preset-ml-1",
                    name = "Master: Dialga-O / Lugia / Kyogre",
                    league = "MASTER LEAGUE",
                    pokemon = listOf(
                        PokemonSlot("Dialga (Origin)", 4624, "Dragon Breath", "Roar of Time", "Iron Head"),
                        PokemonSlot("Lugia", 4179, "Dragon Tail", "Aeroblast", "Earth Power"),
                        PokemonSlot("Kyogre", 4652, "Waterfall", "Origin Pulse", "Avalanche")
                    ),
                    isSelected = true
                ),
                TeamPreset(
                    id = "preset-ul-1",
                    name = "Ultra: Zygarde / Corviknight / Mimikyu",
                    league = "ULTRA LEAGUE",
                    pokemon = listOf(
                        PokemonSlot("Zygarde", 2472, "Dragon Tail", "Crunch", "Earthquake"),
                        PokemonSlot("Corviknight", 2499, "Sand Attack", "Sky Attack", "Iron Head"),
                        PokemonSlot("Mimikyu", 2497, "Shadow Claw", "Play Rough", "Shadow Sneak")
                    )
                ),
                TeamPreset(
                    id = "preset-gl-1",
                    name = "Great: Kanto Ninetales / Fearow / S-Pidgeot",
                    league = "GREAT LEAGUE",
                    pokemon = listOf(
                        PokemonSlot("Kanto Ninetales", 1498, "Fire Spin", "Weather Ball", "Scorching Sands"),
                        PokemonSlot("Fearow", 1500, "Peck", "Drill Run", "Drill Peck"),
                        PokemonSlot("Shadow Pidgeot", 1490, "Gust", "Twister", "Brave Bird")
                    )
                )
            )
            savePresets(defaults)
            prefs.edit().putString(PREFS_KEY_SELECTED_PRESET, "preset-ml-1").apply()
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
                "• ${it.name} (CP ${it.cp}) — ${it.fastMove} | ${it.chargedMove1}, ${it.chargedMove2}"
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
        val editP1Fast = dialogView.findViewById<EditText>(R.id.edit_p1_fast)
        val editP1C1 = dialogView.findViewById<EditText>(R.id.edit_p1_c1)
        val editP1C2 = dialogView.findViewById<EditText>(R.id.edit_p1_c2)

        val editP2 = dialogView.findViewById<EditText>(R.id.edit_p2_name)
        val editP2Cp = dialogView.findViewById<EditText>(R.id.edit_p2_cp)
        val editP2Fast = dialogView.findViewById<EditText>(R.id.edit_p2_fast)
        val editP2C1 = dialogView.findViewById<EditText>(R.id.edit_p2_c1)
        val editP2C2 = dialogView.findViewById<EditText>(R.id.edit_p2_c2)

        val editP3 = dialogView.findViewById<EditText>(R.id.edit_p3_name)
        val editP3Cp = dialogView.findViewById<EditText>(R.id.edit_p3_cp)
        val editP3Fast = dialogView.findViewById<EditText>(R.id.edit_p3_fast)
        val editP3C1 = dialogView.findViewById<EditText>(R.id.edit_p3_c1)
        val editP3C2 = dialogView.findViewById<EditText>(R.id.edit_p3_c2)

        val leagues = arrayOf("GREAT LEAGUE", "ULTRA LEAGUE", "MASTER LEAGUE")
        spinnerLeague.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, leagues)

        if (existingPreset != null) {
            editName.setText(existingPreset.name)
            val leagueIdx = leagues.indexOfFirst { existingPreset.league.contains(it.split(" ").first(), ignoreCase = true) }.coerceAtLeast(0)
            spinnerLeague.setSelection(leagueIdx)

            existingPreset.pokemon.getOrNull(0)?.let {
                editP1.setText(it.name)
                editP1Cp.setText(it.cp.toString())
                editP1Fast.setText(it.fastMove)
                editP1C1.setText(it.chargedMove1)
                editP1C2.setText(it.chargedMove2)
            }
            existingPreset.pokemon.getOrNull(1)?.let {
                editP2.setText(it.name)
                editP2Cp.setText(it.cp.toString())
                editP2Fast.setText(it.fastMove)
                editP2C1.setText(it.chargedMove1)
                editP2C2.setText(it.chargedMove2)
            }
            existingPreset.pokemon.getOrNull(2)?.let {
                editP3.setText(it.name)
                editP3Cp.setText(it.cp.toString())
                editP3Fast.setText(it.fastMove)
                editP3C1.setText(it.chargedMove1)
                editP3C2.setText(it.chargedMove2)
            }
        }

        AlertDialog.Builder(this)
            .setTitle(if (existingPreset != null) "Edit Team & Moves" else "Create Custom GBL Team")
            .setView(dialogView)
            .setPositiveButton("Save Team") { _, _ ->
                val name = editName.text.toString().trim().ifEmpty { "Custom Team" }
                val league = spinnerLeague.selectedItem.toString()

                val p1 = PokemonSlot(
                    name = editP1.text.toString().trim().ifEmpty { "Kanto Ninetales" },
                    cp = editP1Cp.text.toString().toIntOrNull() ?: 1498,
                    fastMove = editP1Fast.text.toString().trim().ifEmpty { "Fire Spin" },
                    chargedMove1 = editP1C1.text.toString().trim().ifEmpty { "Weather Ball" },
                    chargedMove2 = editP1C2.text.toString().trim().ifEmpty { "Scorching Sands" }
                )
                val p2 = PokemonSlot(
                    name = editP2.text.toString().trim().ifEmpty { "Fearow" },
                    cp = editP2Cp.text.toString().toIntOrNull() ?: 1500,
                    fastMove = editP2Fast.text.toString().trim().ifEmpty { "Peck" },
                    chargedMove1 = editP2C1.text.toString().trim().ifEmpty { "Sky Attack" },
                    chargedMove2 = editP2C2.text.toString().trim().ifEmpty { "Drill Run" }
                )
                val p3 = PokemonSlot(
                    name = editP3.text.toString().trim().ifEmpty { "Shadow Pidgeot" },
                    cp = editP3Cp.text.toString().toIntOrNull() ?: 1490,
                    fastMove = editP3Fast.text.toString().trim().ifEmpty { "Gust" },
                    chargedMove1 = editP3C1.text.toString().trim().ifEmpty { "Twister" },
                    chargedMove2 = editP3C2.text.toString().trim().ifEmpty { "Brave Bird" }
                )

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
