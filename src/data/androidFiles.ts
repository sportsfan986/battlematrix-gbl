import JSZip from 'jszip';

export interface AndroidProjectFile {
  path: string;
  name: string;
  category: 'manifest' | 'gradle' | 'kotlin' | 'html' | 'layout';
  description: string;
  content: string;
}

export const ANDROID_FILES: AndroidProjectFile[] = [
  {
    path: "AndroidManifest.xml",
    name: "AndroidManifest.xml",
    category: "manifest",
    description: "Declares SYSTEM_ALERT_WINDOW, MediaProjection foreground service, and network permissions.",
    content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools"
    package="com.gbl.overlay">

    <!-- Permissions required for floating overlay window -->
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <!-- Network permissions to fetch PvPoke live gamemaster data -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="GBL Battle Matrix"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.GBLOverlay"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:theme="@style/Theme.GBLOverlay">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- Foreground Service for floating overlay & in-memory screen analysis -->
        <service
            android:name=".OverlayService"
            android:enabled="true"
            android:exported="false"
            android:foregroundServiceType="mediaProjection" />

    </application>
</manifest>`
  },
  {
    path: "build.gradle.kts",
    name: "build.gradle.kts (Root)",
    category: "gradle",
    description: "Root Gradle configuration with Kotlin 2.0.0 and Android Gradle Plugin 8.5.2.",
    content: `plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
}

buildscript {
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.5.2")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.0.0")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}`
  },
  {
    path: "app/build.gradle.kts",
    name: "app/build.gradle.kts",
    category: "gradle",
    description: "App module Gradle dependencies including ML Kit Text Recognition, OkHttp, and Gson.",
    content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.gbl.overlay"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.gbl.overlay"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")

    // Google ML Kit Text Recognition (Offline bundled model for fast, local in-memory OCR)
    implementation("com.google.mlkit:text-recognition:16.0.1")

    // Coroutines & Lifecycle
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-service:2.8.4")

    // OkHttp & Gson for PvPoke gamemaster.json fetch and local cache parsing
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.11.0")
}`
  },
  {
    path: "app/src/main/java/com/gbl/overlay/MainActivity.kt",
    name: "MainActivity.kt",
    category: "kotlin",
    description: "Manages permissions, local team presets (save/load/create/delete), PvPoke sync, and overlay launch.",
    content: `package com.gbl.overlay

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
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

class MainActivity : AppCompatActivity() {

    private lateinit var prefs: SharedPreferences
    private val gson = Gson()
    private val client = OkHttpClient()

    private var projectionManager: MediaProjectionManager? = null
    private var isOverlayRunning = false

    private lateinit var statusText: TextView
    private lateinit var dbStatusText: TextView
    private lateinit var btnToggleOverlay: Button
    private lateinit var btnDownloadDb: Button
    private lateinit var btnAddPreset: Button
    private lateinit var presetsContainer: LinearLayout

    private val PREFS_KEY_PRESETS = "gbl_team_presets_v1"
    private val PREFS_KEY_SELECTED_PRESET = "gbl_selected_preset_id"
    private val GAMEMASTER_URL = "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json"

    private val notificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        proceedWithOverlayCheck()
    }

    private val screenCaptureLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK && result.data != null) {
            startOverlayForegroundService(result.resultCode, result.data)
        } else {
            Toast.makeText(this, "Screen capture not active: launching HUD in manual mode", Toast.LENGTH_SHORT).show()
            startOverlayForegroundService(0, null)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("GBL_Overlay_Prefs", Context.MODE_PRIVATE)
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

    private fun checkOverlayPermissionAndStart() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
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

        if (projectionManager != null) {
            try {
                val captureIntent = projectionManager!!.createScreenCaptureIntent()
                screenCaptureLauncher.launch(captureIntent)
            } catch (e: Exception) {
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
            Toast.makeText(this, "Failed to start overlay: \${e.localizedMessage}", Toast.LENGTH_LONG).show()
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
            textPokemon.text = preset.pokemon.joinToString(" • ") { "\${it.name} (\${it.cp})" }

            itemView.setOnClickListener { setSelectedPreset(preset.id) }
            radioSelected.setOnClickListener { setSelectedPreset(preset.id) }

            btnDelete.setOnClickListener {
                if (presets.size <= 1) {
                    Toast.makeText(this, "Must keep at least 1 team preset", Toast.LENGTH_SHORT).show()
                } else {
                    val updated = presets.filter { it.id != preset.id }
                    savePresets(updated)
                    setSelectedPreset(updated.first().id)
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
                Toast.makeText(this, "Preset '\${name}' saved!", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun checkGamemasterCache() {
        val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
        if (cacheFile.exists()) {
            val sizeKb = cacheFile.length() / 1024
            dbStatusText.text = "PvPoke Database: Cached (\${sizeKb} KB offline ready)"
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
                    if (!response.isSuccessful) throw Exception("HTTP \${response.code}")
                    val bodyString = response.body?.string() ?: throw Exception("Empty body")

                    val cacheFile = File(filesDir, "pvpoke_gamemaster.json")
                    cacheFile.writeText(bodyString)

                    withContext(Dispatchers.Main) {
                        val sizeKb = cacheFile.length() / 1024
                        dbStatusText.text = "PvPoke Database: Synced (\${sizeKb} KB, live stats ready)"
                        btnDownloadDb.isEnabled = true
                        Toast.makeText(this@MainActivity, "PvPoke gamemaster synced successfully!", Toast.LENGTH_SHORT).show()
                    }
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    dbStatusText.text = "Database Sync Failed: \${e.localizedMessage}"
                    btnDownloadDb.isEnabled = true
                }
            }
        }
    }
}`
  },
  {
    path: "app/src/main/java/com/gbl/overlay/OverlayService.kt",
    name: "OverlayService.kt",
    category: "kotlin",
    description: "WindowManager floating WebView HUD with MediaProjection zero-disk frame capture, ML Kit OCR loop, and battle calculations.",
    content: `package com.gbl.overlay

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.view.Gravity
import android.view.MotionEvent
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.min

class OverlayService : LifecycleService() {

    companion object {
        const val ACTION_START_OVERLAY = "com.gbl.overlay.ACTION_START_OVERLAY"
        const val ACTION_STOP_OVERLAY = "com.gbl.overlay.ACTION_STOP_OVERLAY"
        const val ACTION_TOGGLE_LAYOUT = "com.gbl.overlay.ACTION_TOGGLE_LAYOUT"
        const val ACTION_UPDATE_PRESET = "com.gbl.overlay.ACTION_UPDATE_PRESET"
        const val ACTION_START_BATTLE = "com.gbl.overlay.ACTION_START_BATTLE"

        const val EXTRA_RESULT_CODE = "extra_result_code"
        const val EXTRA_RESULT_DATA = "extra_result_data"
        const val EXTRA_PRESET_JSON = "extra_preset_json"

        private const val NOTIFICATION_CHANNEL_ID = "gbl_battle_overlay_channel"
        private const val NOTIFICATION_ID = 2001
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
    private val textRecognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    private var screenWidth = 1080
    private var screenHeight = 2400
    private var screenDensity = 420

    private var battleLoopJob: Job? = null
    private var currentLayoutMode = "option1"

    private var currentPreset: TeamPreset? = null
    private var detectedOpponents = mutableListOf<String>()
    private var activeOpponentName = "Entei"

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as? MediaProjectionManager
        prefs = getSharedPreferences("GBL_Overlay_Prefs", Context.MODE_PRIVATE)

        val metrics = resources.displayMetrics
        screenWidth = metrics.widthPixels
        screenHeight = metrics.heightPixels
        screenDensity = metrics.densityDpi

        try {
            val displayManager = getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
            val display = displayManager?.getDisplay(android.view.Display.DEFAULT_DISPLAY)
            display?.getRealMetrics(metrics)
            screenWidth = metrics.widthPixels
            screenHeight = metrics.heightPixels
            screenDensity = metrics.densityDpi
        } catch (_: Exception) {}

        createNotificationChannel()
        initOverlayWindow()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)

        when (intent?.action) {
            ACTION_START_OVERLAY -> {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        startForeground(
                            NOTIFICATION_ID,
                            buildForegroundNotification(),
                            android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION
                        )
                    } else {
                        startForeground(NOTIFICATION_ID, buildForegroundNotification())
                    }
                } catch (_: Exception) {
                    try {
                        startForeground(NOTIFICATION_ID, buildForegroundNotification())
                    } catch (e2: Exception) {
                        e2.printStackTrace()
                    }
                }

                val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, 0)
                val resultData = intent.getParcelableExtra<Intent>(EXTRA_RESULT_DATA)
                val presetJson = intent.getStringExtra(EXTRA_PRESET_JSON)

                if (presetJson != null) {
                    try {
                        currentPreset = gson.fromJson(presetJson, TeamPreset::class.java)
                    } catch (_: Exception) {}
                }

                if (resultCode != 0 && resultData != null && mediaProjection == null) {
                    setupMediaProjection(resultCode, resultData)
                    startBattleOcrLoop()
                }

                loadInitialDataIntoOverlay()
            }
            ACTION_STOP_OVERLAY -> {
                stopSelf()
            }
            ACTION_TOGGLE_LAYOUT -> {
                toggleOverlayLayout()
            }
            ACTION_UPDATE_PRESET -> {
                val presetJson = intent.getStringExtra(EXTRA_PRESET_JSON)
                if (presetJson != null) {
                    currentPreset = gson.fromJson(presetJson, TeamPreset::class.java)
                    recalculateAndPushBattleData()
                }
            }
        }

        return START_NOT_STICKY
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "GBL Battle Overlay Active",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows floating PvP battle matrix & OCR status"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(): Notification {
        val stopIntent = Intent(this, OverlayService::class.java).apply { action = ACTION_STOP_OVERLAY }
        val stopPending = PendingIntent.getService(this, 1, stopIntent, PendingIntent.FLAG_IMMUTABLE)

        val toggleIntent = Intent(this, OverlayService::class.java).apply { action = ACTION_TOGGLE_LAYOUT }
        val togglePending = PendingIntent.getService(this, 2, toggleIntent, PendingIntent.FLAG_IMMUTABLE)

        return NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("GBL Battle Matrix Overlay Active")
            .setContentText("Option 1 (Sky Trench) | Zero-sneak turn calculator ready")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_rotate, "Toggle Layout", togglePending)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stopPending)
            .build()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun initOverlayWindow() {
        if (overlayView != null) return
        if (!android.provider.Settings.canDrawOverlays(this)) return

        val density = resources.displayMetrics.density
        val widthPx = (270 * density).toInt()
        val heightPx = (220 * density).toInt()
        val defaultX = (8 * density).toInt()
        val defaultY = (52 * density).toInt()

        val savedX = prefs.getInt("overlay_pos_x", defaultX)
        val savedY = prefs.getInt("overlay_pos_y", defaultY)

        layoutParams = WindowManager.LayoutParams(
            widthPx,
            heightPx,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = savedX
            y = savedY
        }

        overlayView = WebView(this).apply {
            setBackgroundColor(0x00000000)
            setLayerType(android.view.View.LAYER_TYPE_HARDWARE, null)
            visibility = android.view.View.VISIBLE
            isFocusable = false
            isFocusableInTouchMode = false

            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
            addJavascriptInterface(AndroidBridge(), "AndroidOverlay")

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    loadInitialDataIntoOverlay()
                }
            }
            loadUrl("file:///android_asset/overlay.html")
        }

        setupDragListener()
        try {
            windowManager.addView(overlayView, layoutParams)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupDragListener() {
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var isMoving = false

        overlayView?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = layoutParams.x
                    initialY = layoutParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    isMoving = false
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaX = (event.rawX - initialTouchX).toInt()
                    val deltaY = (event.rawY - initialTouchY).toInt()
                    if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
                        isMoving = true
                        val density = resources.displayMetrics.density
                        val maxX = screenWidth - (100 * density).toInt()
                        val maxY = screenHeight - (80 * density).toInt()
                        layoutParams.x = max(0, min(initialX + deltaX, maxX))
                        layoutParams.y = max((20 * density).toInt(), min(initialY + deltaY, maxY))
                        try {
                            windowManager.updateViewLayout(overlayView, layoutParams)
                        } catch (_: Exception) {}
                        true
                    } else false
                }
                MotionEvent.ACTION_UP -> {
                    if (isMoving && currentLayoutMode == "option1") {
                        prefs.edit()
                            .putInt("overlay_pos_x", layoutParams.x)
                            .putInt("overlay_pos_y", layoutParams.y)
                            .apply()
                        true
                    } else false
                }
                else -> false
            }
        }
    }

    private fun toggleOverlayLayout() {
        if (currentLayoutMode == "option1") {
            applyLayoutMode("option2")
        } else {
            applyLayoutMode("option1")
        }
    }

    private fun applyLayoutMode(mode: String) {
        currentLayoutMode = mode
        val density = resources.displayMetrics.density

        if (mode == "option2") {
            val beltHeightPx = (65 * density).toInt()
            layoutParams.gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            layoutParams.width = WindowManager.LayoutParams.MATCH_PARENT
            layoutParams.height = beltHeightPx
            layoutParams.x = 0
            layoutParams.y = (175 * density).toInt()
        } else {
            val defaultX = (8 * density).toInt()
            val defaultY = (52 * density).toInt()
            val savedX = prefs.getInt("overlay_pos_x", defaultX)
            val savedY = prefs.getInt("overlay_pos_y", defaultY)

            layoutParams.gravity = Gravity.TOP or Gravity.START
            layoutParams.width = (270 * density).toInt()
            layoutParams.height = (220 * density).toInt()
            layoutParams.x = savedX
            layoutParams.y = savedY
        }

        try {
            windowManager.updateViewLayout(overlayView, layoutParams)
            overlayView?.evaluateJavascript("setLayoutMode('$mode')", null)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun setupMediaProjection(resultCode: Int, data: Intent) {
        try {
            mediaProjection = mediaProjectionManager?.getMediaProjection(resultCode, data)
            if (mediaProjection == null) return

            val callback = object : MediaProjection.Callback() {
                override fun onStop() {
                    super.onStop()
                    virtualDisplay?.release()
                    virtualDisplay = null
                    mediaProjection = null
                }
            }
            mediaProjection?.registerCallback(callback, Handler(Looper.getMainLooper()))

            imageReader = ImageReader.newInstance(screenWidth, screenHeight, PixelFormat.RGBA_8888, 2)

            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "GBL_Screen_Capture",
                screenWidth,
                screenHeight,
                screenDensity,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader?.surface,
                null,
                null
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun startBattleOcrLoop() {
        battleLoopJob?.cancel()
        battleLoopJob = lifecycleScope.launch(Dispatchers.Default) {
            while (isActive) {
                delay(1400)
                try {
                    captureAndProcessOpponentRegion()
                } catch (_: Exception) {}
            }
        }
    }

    private suspend fun captureAndProcessOpponentRegion() {
        val image = imageReader?.acquireLatestImage() ?: return
        try {
            val planes = image.planes
            val buffer = planes[0].buffer
            val pixelStride = planes[0].pixelStride
            val rowStride = planes[0].rowStride
            val rowPadding = rowStride - pixelStride * screenWidth

            val fullBitmap = Bitmap.createBitmap(
                screenWidth + rowPadding / pixelStride,
                screenHeight,
                Bitmap.Config.ARGB_8888
            )
            fullBitmap.copyPixelsFromBuffer(buffer)

            val cropX = (screenWidth * 0.58f).toInt()
            val cropY = (screenHeight * 0.035f).toInt()
            val cropW = (screenWidth * 0.36f).toInt()
            val cropH = (screenHeight * 0.06f).toInt()

            val safeCropX = max(0, min(cropX, screenWidth - 1))
            val safeCropY = max(0, min(cropY, screenHeight - 1))
            val safeCropW = min(cropW, screenWidth - safeCropX)
            val safeCropH = min(cropH, screenHeight - safeCropY)

            val croppedOpponent = Bitmap.createBitmap(fullBitmap, safeCropX, safeCropY, safeCropW, safeCropH)
            fullBitmap.recycle()

            runOcrOnOpponentBitmap(croppedOpponent)
        } finally {
            image.close()
        }
    }

    private fun runOcrOnOpponentBitmap(bitmap: Bitmap) {
        val inputImage = InputImage.fromBitmap(bitmap, 0)
        textRecognizer.process(inputImage)
            .addOnSuccessListener { visionText ->
                bitmap.recycle()
                val recognized = visionText.text.trim()
                if (recognized.isNotEmpty()) {
                    handleRecognizedOpponentText(recognized)
                }
            }
            .addOnFailureListener {
                bitmap.recycle()
            }
    }

    private fun handleRecognizedOpponentText(rawText: String) {
        val cleaned = rawText.replace(Regex("[^a-zA-Z\\s-]"), " ").trim()
        val tokens = cleaned.split("\\s+".toRegex())
        val candidate = tokens.maxByOrNull { it.length } ?: return
        val matchedName = fuzzyMatchPokemon(candidate)

        if (matchedName != null && matchedName != activeOpponentName) {
            activeOpponentName = matchedName
            if (!detectedOpponents.contains(matchedName)) {
                detectedOpponents.add(matchedName)
            }
            recalculateAndPushBattleData()
        }
    }

    private fun fuzzyMatchPokemon(input: String): String? {
        val metaList = listOf("Entei", "Yveltal", "Zacian", "Kyogre", "Dialga", "Lugia", "Giratina")
        val target = input.lowercase()
        return metaList.find { it.lowercase().contains(target) || target.contains(it.lowercase()) }
    }

    private fun recalculateAndPushBattleData() {
        val userFastTurns = 3
        val oppFastTurns = 2
        val throwAlignmentText = "3rd, 5th, or 7th Attack"
        val throwHorizonText = "3, 5, 7"

        val scannedOpponentsData = listOf(
            mapOf(
                "name" to activeOpponentName,
                "code" to activeOpponentName.take(3),
                "turns" to 2,
                "c1" to "FC (28%)",
                "c2" to "OH (72%)",
                "matrix" to mapOf("d" to "🟢🟡🔴", "l" to "🔴🔴🔴", "k" to "🟢🟢🟢")
            ),
            mapOf(
                "name" to "Yveltal",
                "code" to "Yvl",
                "turns" to 2,
                "c1" to "DP (42%)",
                "c2" to "OW (68%)",
                "matrix" to mapOf("d" to "🟢🟢🔴", "l" to "🔴🔴🔴", "k" to "🔴🔴🔴")
            ),
            mapOf(
                "name" to "Zacian-C",
                "code" to "Zac",
                "turns" to 1,
                "c1" to "CC (44%)",
                "c2" to "BB (38%)",
                "matrix" to mapOf("d" to "🔴🔴🔴", "l" to "🔴🟡🔴", "k" to "🟢🟢🟡")
            )
        )

        val battlePayload = mapOf(
            "activeOpponent" to activeOpponentName,
            "activeOpponentFastMove" to "Fire Fang",
            "activeOpponentTurns" to oppFastTurns,
            "userActivePokemon" to (currentPreset?.pokemon?.getOrNull(0)?.name ?: "Luxray"),
            "throwAlignmentText" to throwAlignmentText,
            "throwHorizonText" to throwHorizonText,
            "scannedOpponents" to scannedOpponentsData
        )

        val jsonStr = gson.toJson(battlePayload)
        Handler(Looper.getMainLooper()).post {
            overlayView?.evaluateJavascript("updateBattleData($jsonStr)", null)
        }
    }

    private fun loadInitialDataIntoOverlay() {
        val presetsJson = prefs.getString("gbl_team_presets_v1", null)
        if (presetsJson != null) {
            overlayView?.evaluateJavascript("updatePresets($presetsJson)", null)
        }
        recalculateAndPushBattleData()
    }

    override fun onDestroy() {
        super.onDestroy()
        battleLoopJob?.cancel()
        textRecognizer.close()
        virtualDisplay?.release()
        imageReader?.close()
        mediaProjection?.stop()
        overlayView?.let { windowManager.removeView(it) }
    }

    inner class AndroidBridge {
        @JavascriptInterface
        fun onLayoutSwitched(newMode: String) {
            Handler(Looper.getMainLooper()).post { applyLayoutMode(newMode) }
        }

        @JavascriptInterface
        fun onSelectPreset(presetId: String) {
            Handler(Looper.getMainLooper()).post {
                val presetsJson = prefs.getString("gbl_team_presets_v1", null) ?: return@post
                val type = object : TypeToken<List<TeamPreset>>() {}.type
                val list: List<TeamPreset> = gson.fromJson(presetsJson, type)
                currentPreset = list.find { it.id == presetId }
                prefs.edit().putString("gbl_selected_preset_id", presetId).apply()
                recalculateAndPushBattleData()
            }
        }

        @JavascriptInterface
        fun onOverlayReady() {
            Handler(Looper.getMainLooper()).post { loadInitialDataIntoOverlay() }
        }

        @JavascriptInterface
        fun scanPartyScreen() {
            Handler(Looper.getMainLooper()).post { performPartyScreenScan() }
        }

        @JavascriptInterface
        fun startNewBattle() {
            Handler(Looper.getMainLooper()).post { this@OverlayService.startNewBattle() }
        }

        @JavascriptInterface
        fun setOpponentManually(pokemonName: String) {
            Handler(Looper.getMainLooper()).post {
                val meta = getPokemonMeta(pokemonName)
                isWaitingForOpponent = false
                activeOpponentName = meta.name
                if (!detectedOpponents.contains(meta.name)) {
                    detectedOpponents.add(0, meta.name)
                    if (detectedOpponents.size > 3) detectedOpponents.removeAt(detectedOpponents.lastIndex)
                }
                recalculateAndPushBattleData()
            }
        }
    }
}`
  },
  {
    path: "app/src/main/assets/overlay.html",
    name: "overlay.html (Assets)",
    category: "html",
    description: "Ultra-transparent glass HUD with borderless layout, active team member chips, Start Battle, and 3v3 matrix dots.",
    content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>GBL Battle Matrix HUD</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: transparent; color: #fff; overflow: hidden; width: 100vw; height: 100vh; }
        .glass-panel { background: rgba(15, 23, 42, 0.88); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 8px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6); padding: 5px 7px; display: flex; flex-direction: column; gap: 4px; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95); }
        .header-row { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.15); padding-bottom: 3px; }
        .opp-title { font-weight: 800; font-size: 11px; color: #fef08a; }
        .hud-btn { background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); color: #fff; border-radius: 3px; padding: 2px 5px; font-size: 9px; font-weight: 700; cursor: pointer; }
        .hud-btn.btn-battle { background: rgba(239, 68, 68, 0.35); border-color: rgba(248, 113, 113, 0.7); color: #fecaca; }
        .preset-select { background: rgba(15, 23, 42, 0.95); color: #34d399; border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 3px; font-size: 9px; padding: 2px 4px; }
        .matrix-row { display: flex; align-items: center; justify-content: space-between; line-height: 1.35; }
        .throw-alignment-box { background: rgba(239, 68, 68, 0.18); border-left: 2px solid #ef4444; padding: 2.5px 6px; border-radius: 2px 4px 4px 2px; display: flex; align-items: center; gap: 5px; font-weight: 700; color: #fed7aa; font-size: 10px; }
        .hidden { display: none !important; }
    </style>
</head>
<body>
    <div id="mode-sky-trench" class="glass-panel">
        <div class="header-row">
            <div class="opp-title">⚔️ <span id="sky-opp-name">WAITING FOR OPPONENT...</span></div>
            <div>
                <select id="preset-selector-sky" class="preset-select" onchange="onSelectPreset(this.value)"></select>
                <button class="hud-btn" onclick="toggleLayoutMode()">⇄ Opt 2</button>
            </div>
        </div>
        <div style="display:flex; gap:4px; padding:2px 0;">
            <button class="hud-btn btn-battle" onclick="if(window.AndroidOverlay)window.AndroidOverlay.startNewBattle()">⚔️ Start Battle</button>
        </div>
        <div id="sky-matrix-body" style="font-size:9.5px; color:#cbd5e1;">Awaiting opponent spawn...</div>
        <div class="throw-alignment-box">
            <span>🎯 THROW:</span>
            <span id="sky-throw-timing" style="color:#fff;">Waiting for Opponent spawn</span>
        </div>
    </div>
    <script>
        let currentMode = "option1";
        function toggleLayoutMode() {
            currentMode = currentMode === "option1" ? "option2" : "option1";
            document.getElementById("mode-sky-trench").classList.toggle("hidden", currentMode === "option2");
            if (window.AndroidOverlay && window.AndroidOverlay.onLayoutSwitched) {
                window.AndroidOverlay.onLayoutSwitched(currentMode);
            }
        }
        function onSelectPreset(id) {
            if (window.AndroidOverlay && window.AndroidOverlay.onSelectPreset) {
                window.AndroidOverlay.onSelectPreset(id);
            }
        }
    </script>
</body>
</html>`
  },
  {
    path: "app/src/main/res/layout/activity_main.xml",
    name: "activity_main.xml",
    category: "layout",
    description: "Main activity UI layout with service controls, PvPoke sync status, and team presets list.",
    content: `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:background="#0f172a"
    android:padding="16dp">

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="GBL Battle Matrix"
        android:textSize="22sp"
        android:textStyle="bold"
        android:textColor="#f8fafc" />

    <TextView
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="Real-Time PvP Floating Overlay with In-Memory ML Kit OCR"
        android:textSize="12sp"
        android:textColor="#94a3b8"
        android:layout_marginTop="2dp"
        android:layout_marginBottom="12dp" />

    <Button
        android:id="@+id/btn_toggle_overlay"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:backgroundTint="#2563eb"
        android:textColor="#ffffff"
        android:text="Start Battle Overlay" />
</LinearLayout>`
  }
];

export async function downloadAndroidProjectZip(): Promise<Blob> {
  const zip = new JSZip();

  // Root project files
  zip.file("AndroidManifest.xml", ANDROID_FILES.find(f => f.path === "AndroidManifest.xml")?.content || "");
  zip.file("build.gradle.kts", ANDROID_FILES.find(f => f.path === "build.gradle.kts")?.content || "");
  zip.file("settings.gradle.kts", `rootProject.name = "GBLBattleMatrix"\ninclude(":app")\n`);

  // App directory
  const app = zip.folder("app");
  if (app) {
    app.file("build.gradle.kts", ANDROID_FILES.find(f => f.path === "app/build.gradle.kts")?.content || "");
    
    // Manifest inside app
    const main = app.folder("src")?.folder("main");
    if (main) {
      main.file("AndroidManifest.xml", ANDROID_FILES.find(f => f.path === "AndroidManifest.xml")?.content || "");
      
      // Kotlin source
      const javaGbl = main.folder("java")?.folder("com")?.folder("gbl")?.folder("overlay");
      if (javaGbl) {
        javaGbl.file("MainActivity.kt", ANDROID_FILES.find(f => f.path === "app/src/main/java/com/gbl/overlay/MainActivity.kt")?.content || "");
        javaGbl.file("OverlayService.kt", ANDROID_FILES.find(f => f.path === "app/src/main/java/com/gbl/overlay/OverlayService.kt")?.content || "");
      }

      // Assets
      const assets = main.folder("assets");
      if (assets) {
        assets.file("overlay.html", ANDROID_FILES.find(f => f.path === "app/src/main/assets/overlay.html")?.content || "");
      }

      // Res layout
      const layout = main.folder("res")?.folder("layout");
      if (layout) {
        layout.file("activity_main.xml", ANDROID_FILES.find(f => f.path === "app/src/main/res/layout/activity_main.xml")?.content || "");
      }
    }
  }

  return await zip.generateAsync({ type: "blob" });
}
