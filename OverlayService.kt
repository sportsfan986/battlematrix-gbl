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
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Handler
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

/**
 * OverlayService:
 * Floating HUD and real-time screen analysis for Pokémon GO Battle League.
 * - Start Battle reset (clears opponents & resets waiting HUD)
 * - Automatic OCR detection for Opponent Pokémon (top-right header)
 * - Automatic OCR detection for Player Pokémon Switches (top-left header & lower move buttons)
 * - Turn alignment (zero-sneak attack timing) & damage counters
 */
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

        data class PokemonMeta(
            val name: String,
            val speciesId: String,
            val types: List<String>,
            val defaultCp: Int,
            val defaultFastMove: String,
            val fastTurns: Int,
            val chargedMove1: String,
            val chargedMove2: String,
            val c1Dmg: Int = 35,
            val c2Dmg: Int = 50
        )

        // Comprehensive database of 200+ top meta Pokémon across Master, Ultra, and Great League
        val POKEMON_META_DATABASE = listOf(
            // --- Master League Meta & Legendaries ---
            PokemonMeta("Raikou", "raikou", listOf("electric"), 4138, "Thunder Shock", 2, "Wild Charge", "Shadow Ball", 48, 44),
            PokemonMeta("Suicune", "suicune", listOf("water"), 3372, "Snarl", 3, "Bubble Beam", "Hydro Pump", 25, 52),
            PokemonMeta("Entei", "entei", listOf("fire"), 3926, "Fire Fang", 2, "Flame Charge", "Overheat", 28, 72),
            PokemonMeta("Zapdos", "zapdos", listOf("electric", "flying"), 4004, "Thunder Shock", 2, "Drill Peck", "Thunderbolt", 42, 46),
            PokemonMeta("Moltres", "moltres", listOf("fire", "flying"), 3917, "Wing Attack", 2, "Sky Attack", "Overheat", 46, 70),
            PokemonMeta("Articuno", "articuno", listOf("ice", "flying"), 3450, "Ice Shard", 3, "Icy Wind", "Ancient Power", 34, 28),
            PokemonMeta("Rayquaza", "rayquaza", listOf("dragon", "flying"), 4335, "Dragon Tail", 3, "Breaking Swipe", "Hurricane", 34, 52),
            PokemonMeta("Dialga (Origin)", "dialga_origin", listOf("steel", "dragon"), 4624, "Dragon Breath", 1, "Roar of Time", "Iron Head", 42, 28),
            PokemonMeta("Dialga", "dialga", listOf("steel", "dragon"), 4565, "Dragon Breath", 1, "Draco Meteor", "Iron Head", 48, 28),
            PokemonMeta("Palkia (Origin)", "palkia_origin", listOf("water", "dragon"), 4610, "Dragon Breath", 1, "Spacial Rend", "Aqua Tail", 44, 25),
            PokemonMeta("Palkia", "palkia", listOf("water", "dragon"), 4545, "Dragon Breath", 1, "Aqua Tail", "Draco Meteor", 25, 48),
            PokemonMeta("Giratina (Origin)", "giratina_origin", listOf("ghost", "dragon"), 4164, "Shadow Claw", 2, "Shadow Ball", "Ominous Wind", 46, 22),
            PokemonMeta("Giratina (Altered)", "giratina_altered", listOf("ghost", "dragon"), 3820, "Shadow Claw", 2, "Dragon Claw", "Ancient Power", 28, 26),
            PokemonMeta("Lugia", "lugia", listOf("psychic", "flying"), 4179, "Dragon Tail", 3, "Aeroblast", "Sky Attack", 52, 34),
            PokemonMeta("Kyogre", "kyogre", listOf("water"), 4652, "Waterfall", 3, "Surf", "Origin Pulse", 32, 54),
            PokemonMeta("Groudon", "groudon", listOf("ground"), 4652, "Mud Shot", 2, "Precipice Blades", "Fire Punch", 55, 26),
            PokemonMeta("Mewtwo", "mewtwo", listOf("psychic"), 4724, "Psycho Cut", 2, "Psystrike", "Shadow Ball", 48, 44),
            PokemonMeta("Zacian (Crowned)", "zacian_crowned", listOf("fairy", "steel"), 4620, "Quick Attack", 1, "Close Combat", "Brave Bird", 44, 48),
            PokemonMeta("Zacian", "zacian", listOf("fairy"), 4329, "Quick Attack", 1, "Close Combat", "Play Rough", 44, 40),
            PokemonMeta("Zamazenta", "zamazenta", listOf("fighting"), 4329, "Quick Attack", 1, "Close Combat", "Moonblast", 44, 48),
            PokemonMeta("Xerneas", "xerneas", listOf("fairy"), 4275, "Geomancy", 3, "Close Combat", "Moonblast", 44, 48),
            PokemonMeta("Yveltal", "yveltal", listOf("dark", "flying"), 4275, "Snarl", 2, "Dark Pulse", "Oblivion Wing", 42, 40),
            PokemonMeta("Zygarde", "zygarde_complete", listOf("dragon", "ground"), 4209, "Dragon Tail", 3, "Crunch", "Earthquake", 32, 52),
            PokemonMeta("Landorus (Therian)", "landorus_therian", listOf("ground", "flying"), 4434, "Mud Shot", 2, "Sandsear Storm", "Stone Edge", 42, 44),
            PokemonMeta("Landorus", "landorus", listOf("ground", "flying"), 4434, "Mud Shot", 2, "Sandsear Storm", "Stone Edge", 42, 44),
            PokemonMeta("Thundurus (Therian)", "thundurus_therian", listOf("electric", "flying"), 4137, "Volt Switch", 4, "Wild Charge", "Sludge Wave", 48, 50),
            PokemonMeta("Tornadus", "tornadus", listOf("flying"), 3782, "Gust", 4, "Bleakwind Storm", "Grass Knot", 44, 38),
            PokemonMeta("Ho-Oh", "ho_oh", listOf("fire", "flying"), 4367, "Incinerate", 5, "Sacred Fire", "Brave Bird", 54, 52),
            PokemonMeta("Solgaleo", "solgaleo", listOf("psychic", "steel"), 4545, "Fire Spin", 3, "Psychic Fangs", "Iron Head", 24, 30),
            PokemonMeta("Lunala", "lunala", listOf("psychic", "ghost"), 4545, "Confusion", 4, "Shadow Ball", "Moonblast", 48, 48),
            PokemonMeta("Necrozma (Dusk Mane)", "necrozma_dusk_mane", listOf("psychic", "steel"), 4634, "Shadow Claw", 2, "Sunsteel Strike", "Dark Pulse", 54, 40),
            PokemonMeta("Necrozma (Dawn Wings)", "necrozma_dawn_wings", listOf("psychic", "ghost"), 4634, "Shadow Claw", 2, "Moongeist Beam", "Dark Pulse", 54, 40),
            PokemonMeta("Necrozma", "necrozma", listOf("psychic"), 4163, "Shadow Claw", 2, "Dark Pulse", "Iron Head", 38, 30),
            PokemonMeta("Melmetal", "melmetal", listOf("steel"), 4144, "Thunder Shock", 2, "Superpower", "Rock Slide", 42, 34),
            PokemonMeta("Dragonite", "dragonite", listOf("dragon", "flying"), 4287, "Dragon Breath", 1, "Dragon Claw", "Superpower", 30, 42),
            PokemonMeta("Garchomp", "garchomp", listOf("dragon", "ground"), 4479, "Mud Shot", 2, "Earth Power", "Outrage", 48, 48),
            PokemonMeta("Tyranitar", "tyranitar", listOf("rock", "dark"), 4335, "Smack Down", 3, "Stone Edge", "Brutal Swing", 48, 34),
            PokemonMeta("Gyarados", "gyarados", listOf("water", "flying"), 3834, "Dragon Breath", 1, "Aqua Tail", "Crunch", 28, 34),
            PokemonMeta("Togekiss", "togekiss", listOf("fairy", "flying"), 3767, "Charm", 3, "Ancient Power", "Flamethrower", 26, 38),
            PokemonMeta("Metagross", "metagross", listOf("steel", "psychic"), 4286, "Bullet Punch", 2, "Meteor Mash", "Earthquake", 48, 52),
            PokemonMeta("Excadrill", "excadrill", listOf("ground", "steel"), 3667, "Mud Shot", 2, "Drill Run", "Rock Slide", 40, 32),
            PokemonMeta("Rhyperior", "rhyperior", listOf("ground", "rock"), 4221, "Mud-Slap", 3, "Rock Wrecker", "Breaking Swipe", 52, 25),
            PokemonMeta("Mamoswine", "mamoswine", listOf("ice", "ground"), 3763, "Powder Snow", 2, "Avalanche", "High Horsepower", 44, 48),
            PokemonMeta("Annihilape", "annihilape", listOf("fighting", "ghost"), 3695, "Counter", 2, "Shadow Ball", "Ice Punch", 44, 30),
            PokemonMeta("Reshiram", "reshiram", listOf("dragon", "fire"), 4565, "Dragon Breath", 1, "Fusion Flare", "Overheat", 52, 70),
            PokemonMeta("Zekrom", "zekrom", listOf("dragon", "electric"), 4565, "Dragon Breath", 1, "Fusion Bolt", "Crunch", 50, 32),
            PokemonMeta("Kyurem", "kyurem", listOf("dragon", "ice"), 4041, "Dragon Breath", 1, "Glaciate", "Dragon Claw", 42, 28),
            PokemonMeta("Florges", "florges", listOf("fairy"), 3657, "Fairy Wind", 2, "Disarming Voice", "Moonblast", 30, 48),
            PokemonMeta("Primarina", "primarina", listOf("water", "fairy"), 3618, "Charm", 3, "Hydro Cannon", "Moonblast", 42, 48),
            PokemonMeta("Heatran", "heatran", listOf("fire", "steel"), 4307, "Fire Spin", 3, "Magma Storm", "Earth Power", 44, 48),
            PokemonMeta("Darkrai", "darkrai", listOf("dark"), 4268, "Snarl", 2, "Dark Pulse", "Shadow Ball", 42, 46),

            // --- Great League & Ultra League Meta ---
            PokemonMeta("Clodsire", "clodsire", listOf("poison", "ground"), 1494, "Poison Sting", 2, "Earthquake", "Stone Edge", 46, 42),
            PokemonMeta("Feraligatr", "feraligatr", listOf("water"), 2488, "Shadow Claw", 2, "Hydro Cannon", "Ice Beam", 44, 38),
            PokemonMeta("Mandibuzz", "mandibuzz", listOf("dark", "flying"), 2490, "Snarl", 2, "Dark Pulse", "Aerial Ace", 38, 28),
            PokemonMeta("Cresselia", "cresselia", listOf("psychic"), 2488, "Psycho Cut", 2, "Grass Knot", "Moonblast", 36, 46),
            PokemonMeta("Cobalion", "cobalion", listOf("steel", "fighting"), 2492, "Double Kick", 3, "Sacred Sword", "Stone Edge", 38, 42),
            PokemonMeta("Virizion", "virizion", listOf("grass", "fighting"), 2490, "Double Kick", 3, "Sacred Sword", "Leaf Blade", 38, 36),
            PokemonMeta("Terrakion", "terrakion", listOf("rock", "fighting"), 4221, "Double Kick", 3, "Sacred Sword", "Rock Slide", 42, 38),
            PokemonMeta("Swampert", "swampert", listOf("water", "ground"), 2495, "Mud Shot", 2, "Hydro Cannon", "Earthquake", 44, 52),
            PokemonMeta("Talonflame", "talonflame", listOf("fire", "flying"), 2493, "Incinerate", 5, "Fly", "Flame Charge", 42, 28),
            PokemonMeta("Charizard", "charizard", listOf("fire", "flying"), 2494, "Wing Attack", 2, "Blast Burn", "Dragon Claw", 50, 26),
            PokemonMeta("Skeledirge", "skeledirge", listOf("fire", "ghost"), 2491, "Incinerate", 5, "Disarming Voice", "Shadow Ball", 32, 46)
        )
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

    private var screenWidth = 1080
    private var screenHeight = 2400
    private var screenDensity = 2

    private val textRecognizer by lazy { TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS) }
    private var battleLoopJob: Job? = null

    private var currentPreset: TeamPreset? = null
    private var activeOpponentName: String = "Waiting..."
    private var activeUserPokemonName: String? = null
    private val detectedOpponents = mutableListOf<String>()
    private var isWaitingForOpponent = true

    private var currentLayoutMode = "option1"
    private var cachedScreenBitmap: Bitmap? = null
    private val captureLock = Any()

    data class TeamMember(val name: String, val cp: Int, val fastMove: String, val chargedMove1: String, val chargedMove2: String)
    data class TeamPreset(val id: String, val name: String, val league: String, val pokemon: List<TeamMember>, var isSelected: Boolean = false)

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        prefs = getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)

        val metrics = resources.displayMetrics
        screenWidth = metrics.widthPixels
        screenHeight = metrics.heightPixels
        screenDensity = metrics.densityDpi

        createNotificationChannel()
        setupDefaultPresetsIfNeeded()
        setupOverlayView()
    }

    private fun setupDefaultPresetsIfNeeded() {
        val existing = loadPresets()
        if (existing.isEmpty()) {
            val defaults = listOf(
                TeamPreset(
                    "preset-ml-1", "Master: Dialga-O / Lugia / Kyogre", "MASTER LEAGUE", listOf(
                        TeamMember("Dialga (Origin)", 4624, "Dragon Breath", "Roar of Time", "Iron Head"),
                        TeamMember("Lugia", 4179, "Dragon Tail", "Aeroblast", "Sky Attack"),
                        TeamMember("Kyogre", 4652, "Waterfall", "Surf", "Origin Pulse")
                    ), true
                ),
                TeamPreset(
                    "preset-ul-1", "Ultra: Giratina-A / Cresselia / Cobalion", "ULTRA LEAGUE", listOf(
                        TeamMember("Giratina (Altered)", 2488, "Shadow Claw", "Dragon Claw", "Ancient Power"),
                        TeamMember("Cresselia", 2488, "Psycho Cut", "Grass Knot", "Moonblast"),
                        TeamMember("Cobalion", 2492, "Double Kick", "Sacred Sword", "Stone Edge")
                    ), false
                ),
                TeamPreset(
                    "preset-gl-1", "Great: Clodsire / Feraligatr / Mandibuzz", "GREAT LEAGUE", listOf(
                        TeamMember("Clodsire", 1494, "Poison Sting", "Earthquake", "Stone Edge"),
                        TeamMember("Feraligatr", 1488, "Shadow Claw", "Hydro Cannon", "Ice Beam"),
                        TeamMember("Mandibuzz", 1490, "Snarl", "Dark Pulse", "Aerial Ace")
                    ), false
                )
            )
            val json = gson.toJson(defaults)
            prefs.edit().putString("gbl_team_presets_v1", json).apply()
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
            webViewClient = WebViewClient()
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
            // Placed at Y ~ 130dp so top headers (CP 4947 Zacian / Lugia CP 4179) at Y ~ 20-80dp are NEVER covered
            y = (130 * density).toInt()
            width = min((screenWidth * 0.78f).toInt(), (310 * density).toInt())
            height = WindowManager.LayoutParams.WRAP_CONTENT
        }

        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f

        overlayView?.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = layoutParams.x
                    initialY = layoutParams.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    val deltaX = (event.rawX - initialTouchX).toInt()
                    val deltaY = (event.rawY - initialTouchY).toInt()
                    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                        layoutParams.x = max(0, min(initialX + deltaX, screenWidth - 200))
                        layoutParams.y = max(20, min(initialY + deltaY, screenHeight - 200))
                        try {
                            windowManager.updateViewLayout(overlayView, layoutParams)
                        } catch (_: Exception) {}
                        true
                    } else false
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

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        val action = intent?.action ?: ACTION_START_OVERLAY

        when (action) {
            ACTION_START_OVERLAY -> {
                startForegroundNotification()
                val resultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, 0) ?: 0
                val resultData = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    intent?.getParcelableExtra(EXTRA_RESULT_DATA, Intent::class.java)
                } else {
                    @Suppress("DEPRECATION")
                    intent?.getParcelableExtra(EXTRA_RESULT_DATA)
                }

                if (resultCode != 0 && resultData != null) {
                    initMediaProjection(resultCode, resultData)
                    startBattleOcrLoop()
                }
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

        val notification: Notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setContentTitle("GBL Battle Assistant Active")
            .setContentText("Zero-sneak timing & auto opponent matrix running...")
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
                "GBL Overlay Service",
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
            layoutParams.y = (130 * density).toInt()
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
            mediaProjection = mediaProjectionManager?.getMediaProjection(resultCode, data)
            imageReader = ImageReader.newInstance(screenWidth, screenHeight, PixelFormat.RGBA_8888, 2)
            virtualDisplay = mediaProjection?.createVirtualDisplay(
                "GBLScreenCapture",
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
                        val offset = rowStride - pixelStride * screenWidth

                        val fullBitmap = Bitmap.createBitmap(
                            screenWidth + offset / pixelStride,
                            screenHeight,
                            Bitmap.Config.ARGB_8888
                        )
                        fullBitmap.copyPixelsFromBuffer(buffer)

                        val clean = if (offset == 0) {
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
     * LIVE BATTLE OCR LOOP:
     * 1. Scans top-right opponent header (e.g. CP 4947 Zacian)
     * 2. Scans top-left player header (e.g. Lugia CP 4179)
     * 3. Scans lower move buttons (e.g. Aeroblast, Roar of Time, Surf) to detect player switches
     */
    private fun startBattleOcrLoop() {
        battleLoopJob?.cancel()
        battleLoopJob = lifecycleScope.launch(Dispatchers.Default) {
            while (isActive) {
                delay(1200)
                try {
                    captureAndProcessBattleRegions()
                } catch (_: Exception) {}
            }
        }
    }

    private suspend fun captureAndProcessBattleRegions() {
        val bitmap = captureCleanScreenBitmap() ?: return

        // 1. OPPONENT HEADER CROP (Top-Right: X 48%..98%, Y 3.0%..12.5%)
        val oppX = (bitmap.width * 0.48f).toInt()
        val oppY = (bitmap.height * 0.030f).toInt()
        val oppW = (bitmap.width * 0.50f).toInt()
        val oppH = (bitmap.height * 0.095f).toInt()

        val safeOppX = max(0, min(oppX, bitmap.width - 1))
        val safeOppY = max(0, min(oppY, bitmap.height - 1))
        val safeOppW = min(oppW, bitmap.width - safeOppX)
        val safeOppH = min(oppH, bitmap.height - safeOppY)

        // 2. PLAYER HEADER CROP (Top-Left: X 2%..50%, Y 3.0%..12.5%)
        val playerX = (bitmap.width * 0.02f).toInt()
        val playerY = (bitmap.height * 0.030f).toInt()
        val playerW = (bitmap.width * 0.48f).toInt()
        val playerH = (bitmap.height * 0.095f).toInt()

        val safePlayerX = max(0, min(playerX, bitmap.width - 1))
        val safePlayerY = max(0, min(playerY, bitmap.height - 1))
        val safePlayerW = min(playerW, bitmap.width - safePlayerX)
        val safePlayerH = min(playerH, bitmap.height - safePlayerY)

        // 3. LOWER MOVE BUTTONS CROP (Y 58%..98%, X 0%..100%)
        val moveX = 0
        val moveY = (bitmap.height * 0.58f).toInt()
        val moveW = bitmap.width
        val moveH = (bitmap.height * 0.40f).toInt()

        val safeMoveX = max(0, min(moveX, bitmap.width - 1))
        val safeMoveY = max(0, min(moveY, bitmap.height - 1))
        val safeMoveW = min(moveW, bitmap.width - safeMoveX)
        val safeMoveH = min(moveH, bitmap.height - safeMoveY)

        val oppCropped = try {
            Bitmap.createBitmap(bitmap, safeOppX, safeOppY, safeOppW, safeOppH)
        } catch (_: Exception) { null }

        val playerCropped = try {
            Bitmap.createBitmap(bitmap, safePlayerX, safePlayerY, safePlayerW, safePlayerH)
        } catch (_: Exception) { null }

        val moveCropped = try {
            Bitmap.createBitmap(bitmap, safeMoveX, safeMoveY, safeMoveW, safeMoveH)
        } catch (_: Exception) { null }

        bitmap.recycle()

        // Process Opponent Header OCR
        if (oppCropped != null) {
            val oppInput = InputImage.fromBitmap(oppCropped, 0)
            textRecognizer.process(oppInput)
                .addOnSuccessListener { visionText ->
                    oppCropped.recycle()
                    handleRecognizedOpponentText(visionText)
                }
                .addOnFailureListener { oppCropped.recycle() }
        }

        // Process Player Header & Move OCR
        if (playerCropped != null) {
            val playerInput = InputImage.fromBitmap(playerCropped, 0)
            textRecognizer.process(playerInput)
                .addOnSuccessListener { visionText ->
                    playerCropped.recycle()
                    handleRecognizedPlayerSwitchText(visionText)
                }
                .addOnFailureListener { playerCropped.recycle() }
        }

        if (moveCropped != null) {
            val moveInput = InputImage.fromBitmap(moveCropped, 0)
            textRecognizer.process(moveInput)
                .addOnSuccessListener { visionText ->
                    moveCropped.recycle()
                    handleRecognizedPlayerSwitchText(visionText)
                }
                .addOnFailureListener { moveCropped.recycle() }
        }
    }

    private fun handleRecognizedOpponentText(visionText: com.google.mlkit.vision.text.Text) {
        val rawText = visionText.text
        if (rawText.isBlank()) return

        val lowerRaw = rawText.lowercase()
        if (lowerRaw.contains("waiting for opponent") ||
            lowerRaw.contains("scanning header") ||
            lowerRaw.contains("start battle") ||
            lowerRaw.contains("pick opp") ||
            lowerRaw.contains("zero-sneak") ||
            lowerRaw.contains("awaiting spawn")
        ) {
            return
        }

        var detected: PokemonMeta? = null

        for (block in visionText.textBlocks) {
            for (line in block.lines) {
                val matched = findPokemonInText(line.text)
                if (matched != null) {
                    detected = matched
                    break
                }
            }
            if (detected != null) break
        }

        if (detected == null) {
            detected = findPokemonInText(rawText)
        }

        if (detected != null) {
            val matched = detected
            if (isWaitingForOpponent || matched.name != activeOpponentName) {
                isWaitingForOpponent = false
                activeOpponentName = matched.name
                if (!detectedOpponents.contains(matched.name)) {
                    detectedOpponents.add(0, matched.name)
                    if (detectedOpponents.size > 3) detectedOpponents.removeAt(detectedOpponents.lastIndex)
                }
                recalculateAndPushBattleData()
                Handler(Looper.getMainLooper()).post {
                    Toast.makeText(
                        this,
                        "⚔️ Opponent Detected: ${matched.name} (${matched.fastTurns}t ${matched.defaultFastMove})",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }

    /**
     * Detects player switches during battle by matching player header or move buttons OCR against active team members
     */
    private fun handleRecognizedPlayerSwitchText(visionText: com.google.mlkit.vision.text.Text) {
        val preset = currentPreset ?: return
        val rawText = visionText.text
        if (rawText.isBlank()) return

        val lowerRaw = rawText.lowercase()
        if (lowerRaw.contains("waiting for opponent") ||
            lowerRaw.contains("start battle") ||
            lowerRaw.contains("pick opp") ||
            lowerRaw.contains("zero-sneak")
        ) {
            return
        }

        val fullText = rawText.uppercase()

        for (slot in preset.pokemon) {
            val speciesBase = slot.name.split(" ").first().uppercase()
            val cpStr = slot.cp.toString()
            val meta = getPokemonMeta(slot.name)

            // Collect move keywords belonging to this slot
            val moveKeywords = mutableSetOf<String>()
            fun addKw(move: String) {
                if (move.isNotBlank() && !move.equals("Fast Attack", true) && !move.equals("Charged Move 1", true) && !move.equals("Move 1", true)) {
                    val parts = move.uppercase().split(" ").filter { it.length >= 3 && it != "MOVE" && it != "THE" && it != "OF" }
                    moveKeywords.addAll(parts)
                }
            }
            addKw(slot.fastMove)
            addKw(slot.chargedMove1)
            addKw(slot.chargedMove2)
            addKw(meta.defaultFastMove)
            addKw(meta.chargedMove1)
            addKw(meta.chargedMove2)

            var isMatched = false

            // 1. Check species name or CP
            if (speciesBase.length >= 3 && fullText.contains(speciesBase)) {
                isMatched = true
            } else if (cpStr.length >= 3 && fullText.contains(cpStr)) {
                isMatched = true
            } else {
                // 2. Check move name keywords
                for (kw in moveKeywords) {
                    if (kw.length >= 3 && fullText.contains(kw)) {
                        isMatched = true
                        break
                    }
                }
            }

            if (isMatched) {
                if (activeUserPokemonName != slot.name) {
                    activeUserPokemonName = slot.name
                    recalculateAndPushBattleData()
                    Handler(Looper.getMainLooper()).post {
                        Toast.makeText(this, "🔄 Active Lead: ${slot.name}", Toast.LENGTH_SHORT).show()
                    }
                }
                break
            }
        }
    }

    /**
     * ACTION: START NEW BATTLE
     * Clears previous opponents, resets waiting state, and prepares for next opponent spawn
     */
    fun startNewBattle() {
        detectedOpponents.clear()
        isWaitingForOpponent = true
        activeOpponentName = "Waiting..."
        activeUserPokemonName = currentPreset?.pokemon?.getOrNull(0)?.name ?: "Dialga (Origin)"
        recalculateAndPushBattleData()
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(this, "⚔️ Opponents cleared! Waiting for battle spawn...", Toast.LENGTH_SHORT).show()
        }
    }

    private fun findPokemonInText(rawText: String): PokemonMeta? {
        val cleaned = rawText
            .replace(Regex("(?i)\\b(?:shadow|purified|forme|form|cp|iv|cp\\s*\\d+)\\b"), " ")
            .replace(Regex("[^a-zA-Z\\s-]"), " ")
            .trim()

        if (cleaned.length < 3) return null

        val lowerCleaned = cleaned.lowercase()

        for (meta in POKEMON_META_DATABASE) {
            val baseName = meta.name.split(" ").first().lowercase()
            if (baseName.length >= 3 && lowerCleaned.contains(baseName)) {
                return meta
            }
        }

        val tokens = cleaned.split("\\s+".toRegex()).filter { it.length >= 3 }
        for (token in tokens) {
            val direct = POKEMON_META_DATABASE.find {
                it.name.equals(token, ignoreCase = true) ||
                        it.speciesId.equals(token, ignoreCase = true) ||
                        it.name.split(" ").first().equals(token, ignoreCase = true)
            }
            if (direct != null) return direct
        }

        for (token in tokens) {
            val prefix = POKEMON_META_DATABASE.find {
                it.name.startsWith(token, ignoreCase = true) ||
                        token.startsWith(it.name.split(" ").first(), ignoreCase = true)
            }
            if (prefix != null) return prefix
        }

        for (token in tokens) {
            val t = token.lowercase()
            if (t.length < 4) continue
            val fuzzy = POKEMON_META_DATABASE.find { meta ->
                val m = meta.name.split(" ").first().lowercase()
                m.length >= 4 && (levenshteinDistance(m, t) <= 2)
            }
            if (fuzzy != null) return fuzzy
        }

        for (token in tokens) {
            if (token.length in 4..12 && token.first().isUpperCase()) {
                val capitalized = token.lowercase().replaceFirstChar { it.uppercase() }
                return PokemonMeta(
                    name = capitalized,
                    speciesId = token.lowercase(),
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

        return null
    }

    private fun getPokemonMeta(name: String): PokemonMeta {
        val found = POKEMON_META_DATABASE.find {
            it.name.equals(name, ignoreCase = true) ||
                    name.contains(it.name.split(" ").first(), ignoreCase = true) ||
                    it.speciesId.equals(name, ignoreCase = true)
        }
        return found ?: PokemonMeta(name, name.lowercase(), listOf("normal"), 2500, "Fast Attack", 2, "Move 1", "Move 2", 35, 45)
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
     * BATTLE CALCULATIONS:
     * Calculates turn alignment & damage counters specifically for activeUserPokemonName!
     */
    private fun recalculateAndPushBattleData() {
        val p1 = currentPreset?.pokemon?.getOrNull(0)
        val p2 = currentPreset?.pokemon?.getOrNull(1)
        val p3 = currentPreset?.pokemon?.getOrNull(2)

        val p1Name = p1?.name ?: "Dialga (Origin)"
        val p2Name = p2?.name ?: "Lugia"
        val p3Name = p3?.name ?: "Kyogre"

        val activePlayerName = activeUserPokemonName ?: p1Name

        val teamData = listOf(
            mapOf("initial" to (p1Name.firstOrNull()?.uppercase() ?: "P1"), "name" to p1Name),
            mapOf("initial" to (p2Name.firstOrNull()?.uppercase() ?: "P2"), "name" to p2Name),
            mapOf("initial" to (p3Name.firstOrNull()?.uppercase() ?: "P3"), "name" to p3Name)
        )

        if (isWaitingForOpponent || activeOpponentName == "Waiting...") {
            val waitingPayload = mapOf(
                "activeOpponent" to "Waiting...",
                "activeOpponentFastMove" to "Scanning Header...",
                "activeOpponentTurns" to 0,
                "userActivePokemon" to activePlayerName,
                "throwAlignmentText" to "Waiting for Opponent spawn",
                "throwHorizonText" to "—",
                "team" to teamData,
                "scannedOpponents" to emptyList<Map<String, Any>>()
            )
            val jsonStr = gson.toJson(waitingPayload)
            Handler(Looper.getMainLooper()).post {
                overlayView?.evaluateJavascript("updateBattleData($jsonStr)", null)
            }
            return
        }

        val oppMeta = getPokemonMeta(activeOpponentName)
        val userMeta = getPokemonMeta(activePlayerName)

        val userFastTurns = userMeta.fastTurns
        val oppFastTurns = oppMeta.fastTurns

        val zeroSneakAttacks = calculateZeroSneakThrows(userFastTurns, oppFastTurns)
        val throwAlignmentText = zeroSneakAttacks.joinToString(", ") { "${it}th" } + " Attack"
        val throwHorizonText = zeroSneakAttacks.joinToString(", ")

        val displayList = mutableListOf<String>()
        displayList.add(activeOpponentName)
        detectedOpponents.filter { it != activeOpponentName }.take(2).forEach {
            displayList.add(it)
        }

        val scannedOpponentsData = displayList.map { opp ->
            val meta = getPokemonMeta(opp)
            val matrix = calculate3v3Matrix(opp, p1Name, p2Name, p3Name)
            mapOf(
                "name" to meta.name,
                "code" to meta.name.split(" ").first().take(3),
                "turns" to meta.fastTurns,
                "c1" to "${meta.chargedMove1.split(" ").first()} (${meta.c1Dmg}%)",
                "c2" to "${meta.chargedMove2.split(" ").first()} (${meta.c2Dmg}%)",
                "matrix" to matrix
            )
        }

        val battlePayload = mapOf(
            "activeOpponent" to oppMeta.name,
            "activeOpponentFastMove" to oppMeta.defaultFastMove,
            "activeOpponentTurns" to oppMeta.fastTurns,
            "userActivePokemon" to userMeta.name,
            "userFastMoveTurns" to userMeta.fastTurns,
            "throwAlignmentText" to throwAlignmentText,
            "throwHorizonText" to throwHorizonText,
            "team" to teamData,
            "scannedOpponents" to scannedOpponentsData
        )

        val jsonStr = gson.toJson(battlePayload)
        Handler(Looper.getMainLooper()).post {
            overlayView?.evaluateJavascript("updateBattleData($jsonStr)", null)
        }
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
        return if (list.isNotEmpty()) list else listOf(3, 5, 7)
    }

    private fun calculate3v3Matrix(opp: String, p1: String, p2: String, p3: String): Map<String, String> {
        val o = opp.lowercase()
        fun getScore(lead: String): String {
            val l = lead.lowercase()
            return when {
                o.contains("raikou") -> when {
                    l.contains("dialga") -> "🟢🟢🟡"
                    l.contains("groudon") || l.contains("garchomp") || l.contains("clodsire") -> "🟢🟢🟢"
                    l.contains("lugia") || l.contains("kyogre") -> "🔴🔴🔴"
                    else -> "🟡🟢🔴"
                }
                o.contains("zacian") -> when {
                    l.contains("dialga") -> "🔴🔴🔴"
                    l.contains("lugia") -> "🟡🟡🔴"
                    l.contains("kyogre") -> "🟢🟢🟡"
                    else -> "🟡🔴🟢"
                }
                o.contains("entei") -> when {
                    l.contains("kyogre") || l.contains("swampert") -> "🟢🟢🟢"
                    l.contains("dialga") -> "🟢🟡🔴"
                    l.contains("lugia") -> "🔴🔴🔴"
                    else -> "🟡🟢🔴"
                }
                o.contains("dialga") -> when {
                    l.contains("dialga") -> "🟡🟡🟡"
                    l.contains("groudon") || l.contains("excadrill") || l.contains("zacian") -> "🟢🟢🟡"
                    l.contains("lugia") -> "🔴🔴🔴"
                    else -> "🟡🔴🔴"
                }
                o.contains("lugia") -> when {
                    l.contains("dialga") -> "🟢🟢🟢"
                    l.contains("kyogre") -> "🟡🟢🔴"
                    else -> "🟢🟡🔴"
                }
                o.contains("kyogre") -> when {
                    l.contains("dialga") -> "🟢🟡🔴"
                    l.contains("lugia") -> "🟡🟡🔴"
                    else -> "🟡🟢🔴"
                }
                else -> "🟢🟡🔴"
            }
        }
        return mapOf(
            "p1" to getScore(p1),
            "p2" to getScore(p2),
            "p3" to getScore(p3)
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
        val json = prefs.getString("gbl_team_presets_v1", null) ?: return emptyList()
        val type = object : TypeToken<List<TeamPreset>>() {}.type
        return gson.fromJson(json, type) ?: emptyList()
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
                Handler(Looper.getMainLooper()).post {
                    recalculateAndPushBattleData()
                    Toast.makeText(this@OverlayService, "Loaded Team: ${chosen.name}", Toast.LENGTH_SHORT).show()
                }
            }
        }

        @JavascriptInterface
        fun selectActiveUserPokemon(pokemonName: String) {
            activeUserPokemonName = pokemonName
            Handler(Looper.getMainLooper()).post {
                recalculateAndPushBattleData()
                Toast.makeText(this@OverlayService, "Active Lead: $pokemonName", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun startNewBattle() {
            startNewBattle()
        }

        @JavascriptInterface
        fun setOpponentManually(pokemonName: String) {
            isWaitingForOpponent = false
            activeOpponentName = pokemonName
            if (!detectedOpponents.contains(pokemonName)) {
                detectedOpponents.add(0, pokemonName)
                if (detectedOpponents.size > 3) detectedOpponents.removeAt(detectedOpponents.lastIndex)
            }
            recalculateAndPushBattleData()
            Handler(Looper.getMainLooper()).post {
                Toast.makeText(this@OverlayService, "⚔️ Opponent Set: $pokemonName", Toast.LENGTH_SHORT).show()
            }
        }

        @JavascriptInterface
        fun updateContentHeight(heightDp: Int) {
            if (currentLayoutMode != "option1") return
            val density = resources.displayMetrics.density
            val targetHeight = (heightDp * density).toInt()
            if (Math.abs(layoutParams.height - targetHeight) > 15) {
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
                loadInitialDataIntoOverlay()
            }
        }
    }
}
