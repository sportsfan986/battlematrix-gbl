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
    private lateinit var presetsContainer: LinearLayout

    private val PREFS_KEY_PRESETS = "gbl_team_presets_v2"
    private val PREFS_KEY_SELECTED_PRESET = "gbl_selected_preset_id"
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
        presetsContainer = findViewById(R.id.layout_presets_list)

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
            showCreatePresetDialog()
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
                        PokemonSlot("Lugia", 4179, "Dragon Tail", "Aeroblast", "Sky Attack"),
                        PokemonSlot("Kyogre", 4652, "Waterfall", "Surf", "Origin Pulse")
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
                    name = "Great: Kanto Ninetales / Fearow / Shadow Pidgeot",
                    league = "GREAT LEAGUE",
                    pokemon = listOf(
                        PokemonSlot("Kanto Ninetales", 1498, "Fire Spin", "Weather Ball", "Scorching Sands"),
                        PokemonSlot("Fearow", 1500, "Peck", "Sky Attack", "Drill Run"),
                        PokemonSlot("Shadow Pidgeot", 1490, "Wing Attack", "Feather Dance", "Brave Bird")
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
            val btnDelete = itemView.findViewById<ImageButton>(R.id.btn_delete_preset)

            val isCurrent = preset.id == selectedId
            radioSelected.isChecked = isCurrent
            textName.text = preset.name
            textLeague.text = preset.league
            textPokemon.text = preset.pokemon.joinToString(" • ") { "${it.name} (${it.cp})" }

            itemView.setOnClickListener {
                setSelectedPreset(preset.id)
            }
            radioSelected.setOnClickListener {
                setSelectedPreset(preset.id)
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

    private fun showCreatePresetDialog() {
        val dialogView = layoutInflater.inflate(R.layout.dialog_create_preset, null)
        val editName = dialogView.findViewById<EditText>(R.id.edit_preset_name)
        val spinnerLeague = dialogView.findViewById<Spinner>(R.id.spinner_league)
        val editP1 = dialogView.findViewById<EditText>(R.id.edit_p1_name)
        val editP1Cp = dialogView.findViewById<EditText>(R.id.edit_p1_cp)
        val editP2 = dialogView.findViewById<EditText>(R.id.edit_p2_name)
        val editP2Cp = dialogView.findViewById<EditText>(R.id.edit_p2_cp)
        val editP3 = dialogView.findViewById<EditText>(R.id.edit_p3_name)
        val editP3Cp = dialogView.findViewById<EditText>(R.id.edit_p3_cp)

        val leagues = arrayOf("MASTER LEAGUE", "ULTRA LEAGUE", "GREAT LEAGUE")
        spinnerLeague.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, leagues)

        AlertDialog.Builder(this)
            .setTitle("Create Custom GBL Team")
            .setView(dialogView)
            .setPositiveButton("Save Preset") { _, _ ->
                val name = editName.text.toString().trim().ifEmpty { "Custom Team" }
                val league = spinnerLeague.selectedItem.toString()
                val p1 = PokemonSlot(
                    name = editP1.text.toString().trim().ifEmpty { "Dialga" },
                    cp = editP1Cp.text.toString().toIntOrNull() ?: 4500,
                    fastMove = "Default Fast",
                    chargedMove1 = "Move 1",
                    chargedMove2 = "Move 2"
                )
                val p2 = PokemonSlot(
                    name = editP2.text.toString().trim().ifEmpty { "Lugia" },
                    cp = editP2Cp.text.toString().toIntOrNull() ?: 4100,
                    fastMove = "Default Fast",
                    chargedMove1 = "Move 1",
                    chargedMove2 = "Move 2"
                )
                val p3 = PokemonSlot(
                    name = editP3.text.toString().trim().ifEmpty { "Kyogre" },
                    cp = editP3Cp.text.toString().toIntOrNull() ?: 4600,
                    fastMove = "Default Fast",
                    chargedMove1 = "Move 1",
                    chargedMove2 = "Move 2"
                )

                val newPreset = TeamPreset(
                    name = name,
                    league = league,
                    pokemon = listOf(p1, p2, p3)
                )

                val list = loadPresets().toMutableList()
                list.add(newPreset)
                savePresets(list)
                setSelectedPreset(newPreset.id)
                Toast.makeText(this, "Preset '${name}' saved!", Toast.LENGTH_SHORT).show()
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
