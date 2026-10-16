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
        const val ACTION_START_BATTLE = "com.gbl.overlay.ACTION_START_BATTLE"

        const val EXTRA_RESULT_CODE = "extra_result_code"
        const val EXTRA_RESULT_DATA = "extra_result_data"
        const val EXTRA_PRESET_JSON = "extra_preset_json"

        private const val NOTIFICATION_CHANNEL_ID = "gbl_battle_overlay_channel"
        private const val NOTIFICATION_ID = 2001

        data class MoveStats(
            val name: String,
            val type: String,
            val power: Int
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
            val mlRank: Int = 500
        )

        val MOVE_DATABASE: Map<String, MoveStats> = mapOf(
            "Roar of Time" to MoveStats("Roar of Time", "dragon", 150),
            "Iron Head" to MoveStats("Iron Head", "steel", 70),
            "Draco Meteor" to MoveStats("Draco Meteor", "dragon", 150),
            "Thunder" to MoveStats("Thunder", "electric", 100),
            "Aeroblast" to MoveStats("Aeroblast", "flying", 170),
            "Sky Attack" to MoveStats("Sky Attack", "flying", 75),
            "Future Sight" to MoveStats("Future Sight", "psychic", 120),
            "Surf" to MoveStats("Surf", "water", 65),
            "Origin Pulse" to MoveStats("Origin Pulse", "water", 130),
            "Hydro Pump" to MoveStats("Hydro Pump", "water", 130),
            "Blizzard" to MoveStats("Blizzard", "ice", 140),
            "Close Combat" to MoveStats("Close Combat", "fighting", 100),
            "Brave Bird" to MoveStats("Brave Bird", "flying", 130),
            "Play Rough" to MoveStats("Play Rough", "fairy", 90),
            "Wild Charge" to MoveStats("Wild Charge", "electric", 100),
            "Shadow Ball" to MoveStats("Shadow Ball", "ghost", 100),
            "Ominous Wind" to MoveStats("Ominous Wind", "ghost", 45),
            "Dragon Claw" to MoveStats("Dragon Claw", "dragon", 50),
            "Ancient Power" to MoveStats("Ancient Power", "rock", 60),
            "Shadow Force" to MoveStats("Shadow Force", "ghost", 140),
            "Spacial Rend" to MoveStats("Spacial Rend", "dragon", 95),
            "Aqua Tail" to MoveStats("Aqua Tail", "water", 50),
            "Precipice Blades" to MoveStats("Precipice Blades", "ground", 130),
            "Fire Punch" to MoveStats("Fire Punch", "fire", 55),
            "Psystrike" to MoveStats("Psystrike", "psychic", 90),
            "Ice Beam" to MoveStats("Ice Beam", "ice", 90),
            "Moonblast" to MoveStats("Moonblast", "fairy", 110),
            "Dark Pulse" to MoveStats("Dark Pulse", "dark", 80),
            "Oblivion Wing" to MoveStats("Oblivion Wing", "flying", 85),
            "Crunch" to MoveStats("Crunch", "dark", 70),
            "Earthquake" to MoveStats("Earthquake", "ground", 110),
            "Sandsear Storm" to MoveStats("Sandsear Storm", "ground", 60),
            "Stone Edge" to MoveStats("Stone Edge", "rock", 100),
            "Superpower" to MoveStats("Superpower", "fighting", 85),
            "Sacred Fire" to MoveStats("Sacred Fire", "fire", 130),
            "Sunsteel Strike" to MoveStats("Sunsteel Strike", "steel", 135),
            "Moongeist Beam" to MoveStats("Moongeist Beam", "ghost", 135),
            "Rock Slide" to MoveStats("Rock Slide", "rock", 75),
            "Earth Power" to MoveStats("Earth Power", "ground", 90),
            "Outrage" to MoveStats("Outrage", "dragon", 110),
            "Meteor Mash" to MoveStats("Meteor Mash", "steel", 100),
            "Drill Run" to MoveStats("Drill Run", "ground", 80),
            "Rock Wrecker" to MoveStats("Rock Wrecker", "rock", 110),
            "Breaking Swipe" to MoveStats("Breaking Swipe", "dragon", 35),
            "Avalanche" to MoveStats("Avalanche", "ice", 90),
            "High Horsepower" to MoveStats("High Horsepower", "ground", 100),
            "Ice Punch" to MoveStats("Ice Punch", "ice", 55),
            "Fusion Flare" to MoveStats("Fusion Flare", "fire", 90),
            "Overheat" to MoveStats("Overheat", "fire", 130),
            "Fusion Bolt" to MoveStats("Fusion Bolt", "electric", 90),
            "Glaciate" to MoveStats("Glaciate", "ice", 60),
            "Disarming Voice" to MoveStats("Disarming Voice", "fairy", 70),
            "Hydro Cannon" to MoveStats("Hydro Cannon", "water", 80),
            "Weather Ball" to MoveStats("Weather Ball", "ice", 55),
            "Dazzling Gleam" to MoveStats("Dazzling Gleam", "fairy", 100),
            "Scorching Sands" to MoveStats("Scorching Sands", "ground", 80),
            "Psycho Boost" to MoveStats("Psycho Boost", "psychic", 70),
            "Thunderbolt" to MoveStats("Thunderbolt", "electric", 90),
            "Grass Knot" to MoveStats("Grass Knot", "grass", 90),
            "Sacred Sword" to MoveStats("Sacred Sword", "fighting", 60),
            "Leaf Blade" to MoveStats("Leaf Blade", "grass", 70),
            "Aerial Ace" to MoveStats("Aerial Ace", "flying", 55),
            "Fly" to MoveStats("Fly", "flying", 80),
            "Flame Charge" to MoveStats("Flame Charge", "fire", 65),
            "Blast Burn" to MoveStats("Blast Burn", "fire", 110),
            "Feather Dance" to MoveStats("Feather Dance", "flying", 35),
            "Shadow Sneak" to MoveStats("Shadow Sneak", "ghost", 50)
        )

        val POKEMON_META_DATABASE = listOf(
            // --- Multi-Form & Regional Variants ---
            PokemonMeta("Zacian (Crowned)", "zacian_crowned", "zacian", "Crowned", listOf("fairy", "steel"), 4620, "Quick Attack", 1, "Close Combat", "Brave Bird", 48, 52, atk = 264.0, def = 216.0, hp = 173, glRank = 400, ulRank = 300, mlRank = 2),
            PokemonMeta("Zacian (Hero)", "zacian_hero", "zacian", "Hero", listOf("fairy"), 4329, "Quick Attack", 1, "Close Combat", "Play Rough", 44, 42, atk = 232.0, def = 215.0, hp = 173, glRank = 420, ulRank = 310, mlRank = 18),
            PokemonMeta("Giratina (Origin)", "giratina_origin", "giratina", "Origin", listOf("ghost", "dragon"), 4164, "Shadow Claw", 2, "Shadow Ball", "Ominous Wind", 46, 22, atk = 206.0, def = 172.0, hp = 247, glRank = 180, ulRank = 35, mlRank = 9),
            PokemonMeta("Giratina (Altered)", "giratina_altered", "giratina", "Altered", listOf("ghost", "dragon"), 3820, "Shadow Claw", 2, "Dragon Claw", "Ancient Power", 28, 26, atk = 171.0, def = 206.0, hp = 247, glRank = 190, ulRank = 3, mlRank = 26),
            PokemonMeta("Ninetales (Alolan)", "ninetales_alolan", "ninetales", "Alolan", listOf("ice", "fairy"), 2610, "Powder Snow", 2, "Weather Ball", "Dazzling Gleam", 34, 46, atk = 116.0, def = 138.0, hp = 126, glRank = 16, ulRank = 32, mlRank = 320),
            PokemonMeta("Kanto Ninetales", "ninetales", "ninetales", "Kanto", listOf("fire"), 1498, "Fire Spin", 3, "Weather Ball", "Scorching Sands", 34, 42, atk = 115.0, def = 138.0, hp = 127, glRank = 58, ulRank = 88, mlRank = 350),
            PokemonMeta("Deoxys (Defense)", "deoxys_defense", "deoxys", "Defense", listOf("psychic"), 2570, "Counter", 2, "Psycho Boost", "Thunderbolt", 36, 44, atk = 102.0, def = 228.0, hp = 98, glRank = 24, ulRank = 48, mlRank = 390),
            PokemonMeta("Deoxys (Normal)", "deoxys_normal", "deoxys", "Normal", listOf("psychic"), 3573, "Counter", 2, "Psycho Boost", "Thunderbolt", 48, 56, atk = 240.0, def = 86.0, hp = 98, glRank = 650, ulRank = 600, mlRank = 450),
            PokemonMeta("Dialga (Origin)", "dialga_origin", "dialga", "Origin", listOf("steel", "dragon"), 4624, "Dragon Breath", 1, "Roar of Time", "Iron Head", 52, 34, atk = 241.0, def = 204.0, hp = 184, glRank = 350, ulRank = 240, mlRank = 3),
            PokemonMeta("Dialga", "dialga", "dialga", "Altered", listOf("steel", "dragon"), 4565, "Dragon Breath", 1, "Draco Meteor", "Iron Head", 50, 32, atk = 246.0, def = 190.0, hp = 184, glRank = 360, ulRank = 250, mlRank = 14),
            PokemonMeta("Palkia (Origin)", "palkia_origin", "palkia", "Origin", listOf("water", "dragon"), 4683, "Dragon Breath", 1, "Spacial Rend", "Aqua Tail", 46, 28, atk = 259.0, def = 202.0, hp = 169, glRank = 330, ulRank = 210, mlRank = 1),
            PokemonMeta("Palkia", "palkia", "palkia", "Altered", listOf("water", "dragon"), 4512, "Dragon Breath", 1, "Aqua Tail", "Draco Meteor", 28, 52, atk = 252.0, def = 195.0, hp = 169, glRank = 340, ulRank = 230, mlRank = 22),
            PokemonMeta("Landorus (Therian)", "landorus_therian", "landorus", "Therian", listOf("ground", "flying"), 4434, "Mud Shot", 2, "Sandsear Storm", "Stone Edge", 42, 46, atk = 259.0, def = 164.0, hp = 182, glRank = 280, ulRank = 190, mlRank = 5),
            PokemonMeta("Landorus (Incarnate)", "landorus", "landorus", "Incarnate", listOf("ground", "flying"), 4057, "Mud Shot", 2, "Earth Power", "Rock Slide", 44, 36, atk = 235.0, def = 164.0, hp = 182, glRank = 310, ulRank = 210, mlRank = 42),
            PokemonMeta("Necrozma (Dusk Mane)", "necrozma_dusk_mane", "necrozma", "Dusk Mane", listOf("psychic", "steel"), 4634, "Shadow Claw", 2, "Sunsteel Strike", "Dark Pulse", 54, 40, atk = 249.0, def = 200.0, hp = 179, glRank = 400, ulRank = 280, mlRank = 4),
            PokemonMeta("Necrozma (Dawn Wings)", "necrozma_dawn_wings", "necrozma", "Dawn Wings", listOf("psychic", "ghost"), 4634, "Shadow Claw", 2, "Moongeist Beam", "Dark Pulse", 54, 40, atk = 249.0, def = 200.0, hp = 179, glRank = 405, ulRank = 285, mlRank = 6),
            PokemonMeta("Necrozma", "necrozma", "necrozma", "Base", listOf("psychic"), 4163, "Shadow Claw", 2, "Dark Pulse", "Iron Head", 38, 30, atk = 225.0, def = 176.0, hp = 179, glRank = 450, ulRank = 310, mlRank = 65),

            // --- User Custom Great & Ultra League Team Pokémon ---
            PokemonMeta("Fearow", "fearow", "fearow", "Base", listOf("normal", "flying"), 1500, "Peck", 2, "Sky Attack", "Drill Run", 38, 42, atk = 131.0, def = 96.0, hp = 120, glRank = 85, ulRank = 250, mlRank = 420),
            PokemonMeta("Shadow Pidgeot", "pidgeot_shadow", "pidgeot", "Shadow", listOf("normal", "flying"), 1490, "Wing Attack", 2, "Feather Dance", "Brave Bird", 24, 62, atk = 117.0, def = 112.0, hp = 142, glRank = 28, ulRank = 18, mlRank = 310),
            PokemonMeta("Pidgeot", "pidgeot", "pidgeot", "Base", listOf("normal", "flying"), 1490, "Wing Attack", 2, "Feather Dance", "Brave Bird", 20, 52, atk = 117.0, def = 112.0, hp = 142, glRank = 32, ulRank = 15, mlRank = 300),
            PokemonMeta("Zygarde", "zygarde_complete", "zygarde", "Complete", listOf("dragon", "ground"), 2472, "Dragon Tail", 3, "Crunch", "Earthquake", 32, 52, atk = 169.0, def = 186.0, hp = 338, glRank = 80, ulRank = 1, mlRank = 5),
            PokemonMeta("Corviknight", "corviknight", "corviknight", "Base", listOf("flying", "steel"), 2499, "Sand Attack", 1, "Sky Attack", "Iron Head", 36, 34, atk = 148.0, def = 178.0, hp = 202, glRank = 14, ulRank = 7, mlRank = 120),
            PokemonMeta("Mimikyu", "mimikyu", "mimikyu", "Disguised", listOf("ghost", "fairy"), 2497, "Shadow Claw", 2, "Play Rough", "Shadow Sneak", 44, 28, atk = 162.0, def = 184.0, hp = 138, glRank = 40, ulRank = 25, mlRank = 210),

            // --- Master League & Core Meta ---
            PokemonMeta("Lugia", "lugia", "lugia", "Base", listOf("psychic", "flying"), 4179, "Dragon Tail", 3, "Aeroblast", "Sky Attack", 54, 34, atk = 176.0, def = 274.0, hp = 211, glRank = 75, ulRank = 45, mlRank = 12),
            PokemonMeta("Kyogre", "kyogre", "kyogre", "Base", listOf("water"), 4652, "Waterfall", 3, "Surf", "Origin Pulse", 34, 56, atk = 243.0, def = 204.0, hp = 184, glRank = 310, ulRank = 180, mlRank = 10),
            PokemonMeta("Groudon", "groudon", "groudon", "Base", listOf("ground"), 4652, "Mud Shot", 2, "Precipice Blades", "Fire Punch", 55, 26, atk = 243.0, def = 204.0, hp = 184, glRank = 300, ulRank = 175, mlRank = 11),
            PokemonMeta("Ho-Oh", "ho_oh", "ho-oh", "Base", listOf("fire", "flying"), 4367, "Incinerate", 5, "Sacred Fire", "Brave Bird", 54, 52, atk = 216.0, def = 219.0, hp = 193, glRank = 140, ulRank = 70, mlRank = 7),
            PokemonMeta("Yveltal", "yveltal", "yveltal", "Base", listOf("dark", "flying"), 4275, "Snarl", 3, "Dark Pulse", "Oblivion Wing", 42, 42, atk = 225.0, def = 169.0, hp = 226, glRank = 260, ulRank = 95, mlRank = 8),
            PokemonMeta("Xerneas", "xerneas", "xerneas", "Base", listOf("fairy"), 4275, "Geomancy", 3, "Close Combat", "Moonblast", 44, 48, atk = 225.0, def = 169.0, hp = 226, glRank = 270, ulRank = 98, mlRank = 13),
            PokemonMeta("Solgaleo", "solgaleo", "solgaleo", "Base", listOf("psychic", "steel"), 4545, "Fire Spin", 3, "Psychic Fangs", "Iron Head", 24, 32, atk = 229.0, def = 174.0, hp = 234, glRank = 290, ulRank = 120, mlRank = 15),
            PokemonMeta("Mewtwo", "mewtwo", "mewtwo", "Base", listOf("psychic"), 4724, "Psycho Cut", 2, "Psystrike", "Shadow Ball", 48, 44, atk = 266.0, def = 166.0, hp = 193, glRank = 380, ulRank = 210, mlRank = 16),
            PokemonMeta("Rhyperior", "rhyperior", "rhyperior", "Base", listOf("ground", "rock"), 4221, "Mud-Slap", 3, "Rock Wrecker", "Breaking Swipe", 52, 25, atk = 216.0, def = 174.0, hp = 219, glRank = 210, ulRank = 110, mlRank = 9),
            PokemonMeta("Dragonite", "dragonite", "dragonite", "Base", listOf("dragon", "flying"), 4287, "Dragon Breath", 1, "Dragon Claw", "Superpower", 30, 42, atk = 235.0, def = 181.0, hp = 188, glRank = 95, ulRank = 52, mlRank = 19),
            PokemonMeta("Garchomp", "garchomp", "garchomp", "Base", listOf("dragon", "ground"), 4479, "Mud Shot", 2, "Earth Power", "Outrage", 48, 48, atk = 233.0, def = 176.0, hp = 214, glRank = 220, ulRank = 130, mlRank = 24),
            PokemonMeta("Metagross", "metagross", "metagross", "Base", listOf("steel", "psychic"), 4286, "Bullet Punch", 2, "Meteor Mash", "Earthquake", 48, 52, atk = 229.0, def = 204.0, hp = 172, glRank = 290, ulRank = 160, mlRank = 25),
            PokemonMeta("Melmetal", "melmetal", "melmetal", "Base", listOf("steel"), 4144, "Thunder Shock", 2, "Superpower", "Rock Slide", 42, 34, atk = 204.0, def = 174.0, hp = 234, glRank = 130, ulRank = 65, mlRank = 23),
            PokemonMeta("Florges", "florges", "florges", "Base", listOf("fairy"), 3657, "Fairy Wind", 2, "Disarming Voice", "Moonblast", 30, 48, atk = 191.0, def = 218.0, hp = 169, glRank = 110, ulRank = 38, mlRank = 20),
            PokemonMeta("Primarina", "primarina", "primarina", "Base", listOf("water", "fairy"), 3618, "Charm", 3, "Hydro Cannon", "Moonblast", 42, 48, atk = 206.0, def = 178.0, hp = 172, glRank = 90, ulRank = 42, mlRank = 21),
            PokemonMeta("Mamoswine", "mamoswine", "mamoswine", "Base", listOf("ice", "ground"), 3763, "Powder Snow", 2, "Avalanche", "High Horsepower", 44, 48, atk = 221.0, def = 138.0, hp = 215, glRank = 190, ulRank = 120, mlRank = 27),
            PokemonMeta("Excadrill", "excadrill", "excadrill", "Base", listOf("ground", "steel"), 3667, "Mud Shot", 2, "Drill Run", "Rock Slide", 40, 32, atk = 228.0, def = 125.0, hp = 215, glRank = 230, ulRank = 140, mlRank = 28),
            PokemonMeta("Reshiram", "reshiram", "reshiram", "Base", listOf("dragon", "fire"), 4565, "Dragon Breath", 1, "Fusion Flare", "Overheat", 52, 70, atk = 246.0, def = 190.0, hp = 184, glRank = 350, ulRank = 220, mlRank = 29),
            PokemonMeta("Zekrom", "zekrom", "zekrom", "Base", listOf("dragon", "electric"), 4565, "Dragon Breath", 1, "Fusion Bolt", "Crunch", 50, 32, atk = 246.0, def = 190.0, hp = 184, glRank = 345, ulRank = 215, mlRank = 30),
            PokemonMeta("Raikou", "raikou", "raikou", "Base", listOf("electric"), 3902, "Thunder Shock", 2, "Wild Charge", "Shadow Ball", 48, 44, atk = 216.0, def = 178.0, hp = 188, glRank = 180, ulRank = 115, mlRank = 45),
            PokemonMeta("Entei", "entei", "entei", "Base", listOf("fire"), 3926, "Fire Fang", 2, "Flame Charge", "Overheat", 28, 72, atk = 211.0, def = 161.0, hp = 223, glRank = 240, ulRank = 165, mlRank = 55),
            PokemonMeta("Suicune", "suicune", "suicune", "Base", listOf("water"), 3372, "Snarl", 3, "Ice Beam", "Hydro Pump", 36, 52, atk = 166.0, def = 211.0, hp = 205, glRank = 170, ulRank = 95, mlRank = 75),

            // --- Great League & Ultra League Core Meta ---
            PokemonMeta("Clodsire", "clodsire", "clodsire", "Base", listOf("poison", "ground"), 1494, "Poison Sting", 2, "Earthquake", "Stone Edge", 46, 42, atk = 89.0, def = 123.0, hp = 222, glRank = 1, ulRank = 90, mlRank = 400),
            PokemonMeta("Feraligatr", "feraligatr", "feraligatr", "Base", listOf("water"), 2488, "Shadow Claw", 2, "Hydro Cannon", "Ice Beam", 44, 38, atk = 164.0, def = 155.0, hp = 161, glRank = 2, ulRank = 2, mlRank = 85),
            PokemonMeta("Mandibuzz", "mandibuzz", "mandibuzz", "Base", listOf("dark", "flying"), 2417, "Snarl", 3, "Dark Pulse", "Aerial Ace", 38, 28, atk = 118.0, def = 191.0, hp = 208, glRank = 3, ulRank = 12, mlRank = 280),
            PokemonMeta("Cresselia", "cresselia", "cresselia", "Base", listOf("psychic"), 2488, "Psycho Cut", 2, "Grass Knot", "Moonblast", 36, 46, atk = 124.0, def = 215.0, hp = 197, glRank = 11, ulRank = 4, mlRank = 110),
            PokemonMeta("Cobalion", "cobalion", "cobalion", "Base", listOf("steel", "fighting"), 2492, "Double Kick", 3, "Sacred Sword", "Stone Edge", 38, 42, atk = 152.0, def = 182.0, hp = 169, glRank = 95, ulRank = 6, mlRank = 90),
            PokemonMeta("Virizion", "virizion", "virizion", "Base", listOf("grass", "fighting"), 2490, "Double Kick", 3, "Sacred Sword", "Leaf Blade", 38, 36, atk = 152.0, def = 182.0, hp = 169, glRank = 110, ulRank = 8, mlRank = 95),
            PokemonMeta("Swampert", "swampert", "swampert", "Base", listOf("water", "ground"), 2495, "Mud Shot", 2, "Hydro Cannon", "Earthquake", 44, 52, atk = 167.0, def = 143.0, hp = 175, glRank = 15, ulRank = 14, mlRank = 60),
            PokemonMeta("Talonflame", "talonflame", "talonflame", "Base", listOf("fire", "flying"), 2493, "Incinerate", 5, "Fly", "Flame Charge", 42, 28, atk = 159.0, def = 143.0, hp = 169, glRank = 18, ulRank = 10, mlRank = 180),
            PokemonMeta("Annihilape", "annihilape", "annihilape", "Base", listOf("fighting", "ghost"), 3695, "Counter", 2, "Shadow Ball", "Ice Punch", 44, 30, atk = 198.0, def = 162.0, hp = 215, glRank = 8, ulRank = 9, mlRank = 32),
            PokemonMeta("Skeledirge", "skeledirge", "skeledirge", "Base", listOf("fire", "ghost"), 2491, "Incinerate", 5, "Disarming Voice", "Shadow Ball", 32, 46, atk = 158.0, def = 144.0, hp = 184, glRank = 22, ulRank = 15, mlRank = 70)
        )

        /**
         * FormResolver:
         * Resolves multi-form and regional species to the highest-ranked PvPoke variant
         * for the currently active league, and provides cycling across valid forms.
         */
        object FormResolver {
            fun getVariantsForSpecies(speciesOrName: String, activeLeague: String): List<PokemonMeta> {
                val base = extractBaseSpecies(speciesOrName)
                val variants = POKEMON_META_DATABASE.filter { it.baseSpecies.equals(base, ignoreCase = true) }
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
                if (variants.size <= 1) return detectedMeta

                // Check if OCR explicitly read a form keyword
                for (variant in variants) {
                    val labelLower = variant.formLabel.lowercase()
                    if (labelLower != "base" && lowerRaw.contains(labelLower)) {
                        return variant
                    }
                }
                // Otherwise default to the #1 highest-ranked variant for the active league
                return variants.first()
            }

            fun extractBaseSpecies(name: String): String {
                return name.lowercase()
                    .replace(Regex("\\(.*?\\)"), "")
                    .replace("shadow", "")
                    .trim()
                    .split(" ")
                    .firstOrNull() ?: name.lowercase()
            }
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

        imageReaderThread = HandlerThread("GBLImageReaderThread").apply { start() }
        imageReaderHandler = Handler(imageReaderThread!!.looper)

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
                    "preset-ul-1", "Ultra: Zygarde / Corviknight / Mimikyu", "ULTRA LEAGUE", listOf(
                        TeamMember("Zygarde", 2472, "Dragon Tail", "Crunch", "Earthquake"),
                        TeamMember("Corviknight", 2499, "Sand Attack", "Sky Attack", "Iron Head"),
                        TeamMember("Mimikyu", 2497, "Shadow Claw", "Play Rough", "Shadow Sneak")
                    ), false
                ),
                TeamPreset(
                    "preset-gl-1", "Great: Kanto Ninetales / Fearow / Shadow Pidgeot", "GREAT LEAGUE", listOf(
                        TeamMember("Kanto Ninetales", 1498, "Fire Spin", "Weather Ball", "Scorching Sands"),
                        TeamMember("Fearow", 1500, "Peck", "Sky Attack", "Drill Run"),
                        TeamMember("Shadow Pidgeot", 1490, "Wing Attack", "Feather Dance", "Brave Bird")
                    ), false
                )
            )
            val json = gson.toJson(defaults)
            prefs.edit().putString("gbl_team_presets_v2", json).apply()
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
            y = (135 * density).toInt()
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
            .setContentText("Live OCR monitoring opponent & player switches...")
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
     * LIVE BATTLE OCR LOOP:
     * Runs every 950ms to detect:
     * 1. Top-Right Opponent Pokémon nameplate (X: 44%..99%, Y: 2%..18%)
     * 2. Top-Left Player Active Switch nameplate (X: 1%..52%, Y: 2%..18%)
     * 3. Bottom Charged Move Buttons (Y: 68%..96%) for instant player switch confirmation
     */
    private fun startBattleOcrLoop() {
        battleLoopJob?.cancel()
        battleLoopJob = lifecycleScope.launch(Dispatchers.Default) {
            while (isActive) {
                delay(950)
                try {
                    captureAndProcessBattleRegions()
                } catch (_: Exception) {}
            }
        }
    }

    private fun cropNormalizedRegion(
        source: Bitmap,
        leftRatio: Float,
        topRatio: Float,
        rightRatio: Float,
        bottomRatio: Float
    ): Bitmap? {
        if (source.isRecycled) return null
        val x = (source.width * leftRatio).toInt().coerceIn(0, source.width - 1)
        val y = (source.height * topRatio).toInt().coerceIn(0, source.height - 1)
        val w = ((source.width * (rightRatio - leftRatio)).toInt()).coerceIn(1, source.width - x)
        val h = ((source.height * (bottomRatio - topRatio)).toInt()).coerceIn(1, source.height - y)
        return try {
            Bitmap.createBitmap(source, x, y, w, h)
        } catch (_: Exception) {
            null
        }
    }

    private suspend fun captureAndProcessBattleRegions() {
        val bitmap = captureCleanScreenBitmap() ?: return

        // 1. TOP-RIGHT OPPONENT NAMEPLATE REGION (Normalized X: 0.44..0.99, Y: 0.02..0.18)
        val oppCropped = cropNormalizedRegion(bitmap, 0.44f, 0.02f, 0.99f, 0.18f)

        // 2. TOP-LEFT PLAYER ACTIVE SWITCH NAMEPLATE REGION (Normalized X: 0.01..0.52, Y: 0.02..0.18)
        val playerCropped = cropNormalizedRegion(bitmap, 0.01f, 0.02f, 0.52f, 0.18f)

        // 3. BOTTOM CHARGED MOVE BUTTONS REGION (Normalized X: 0.05..0.95, Y: 0.68..0.96)
        val moveCropped = cropNormalizedRegion(bitmap, 0.05f, 0.68f, 0.95f, 0.96f)

        bitmap.recycle()

        // Process Top-Right Opponent OCR
        if (oppCropped != null) {
            val oppInput = InputImage.fromBitmap(oppCropped, 0)
            textRecognizer.process(oppInput)
                .addOnSuccessListener { visionText ->
                    oppCropped.recycle()
                    handleRecognizedOpponentText(visionText)
                }
                .addOnFailureListener { oppCropped.recycle() }
        }

        // Process Top-Left Player Nameplate OCR
        if (playerCropped != null) {
            val playerInput = InputImage.fromBitmap(playerCropped, 0)
            textRecognizer.process(playerInput)
                .addOnSuccessListener { visionText ->
                    playerCropped.recycle()
                    handleRecognizedPlayerSwitchText(visionText, isFromTopLeftHeader = true)
                }
                .addOnFailureListener { playerCropped.recycle() }
        }

        // Process Bottom Move Buttons OCR
        if (moveCropped != null) {
            val moveInput = InputImage.fromBitmap(moveCropped, 0)
            textRecognizer.process(moveInput)
                .addOnSuccessListener { visionText ->
                    moveCropped.recycle()
                    handleRecognizedPlayerSwitchText(visionText, isFromTopLeftHeader = false)
                }
                .addOnFailureListener { moveCropped.recycle() }
        }
    }

    private fun isOverlayHudSelfText(lower: String): Boolean {
        return lower.contains("waiting") ||
                lower.contains("scanning") ||
                lower.contains("zero-sneak") ||
                lower.contains("awaiting") ||
                lower.contains("shadow:") ||
                lower.contains("form:") ||
                lower.contains("dmg to") ||
                lower.contains("throw:")
    }

    private fun handleRecognizedOpponentText(visionText: Text) {
        val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
        var detected: PokemonMeta? = null
        var rawMatchedLine = ""

        for (block in visionText.textBlocks) {
            for (line in block.lines) {
                val text = line.text.trim()
                if (text.length < 3) continue

                val lower = text.lowercase()
                if (isOverlayHudSelfText(lower)) continue

                val candidate = findPokemonInText(text)
                if (candidate != null) {
                    detected = FormResolver.resolveBestDefaultVariant(candidate, text, activeLeague)
                    rawMatchedLine = text
                    break
                }
            }
            if (detected != null) break
        }

        if (detected != null) {
            val matched = detected
            val newBaseSpecies = matched.baseSpecies

            // Trigger immediately when opponent spawns or switches/faints into a new species
            if (isWaitingForOpponent || !newBaseSpecies.equals(activeOpponentSpecies, ignoreCase = true)) {
                isWaitingForOpponent = false
                activeOpponentSpecies = newBaseSpecies
                availableOpponentForms = FormResolver.getVariantsForSpecies(newBaseSpecies, activeLeague)
                currentFormIndex = availableOpponentForms.indexOfFirst { it.name == matched.name }.coerceAtLeast(0)
                activeOpponentName = matched.name

                if (rawMatchedLine.contains("shadow", ignoreCase = true)) {
                    isOpponentShadow = true
                }

                if (!detectedOpponents.contains(matched.name)) {
                    detectedOpponents.add(0, matched.name)
                    if (detectedOpponents.size > 3) detectedOpponents.removeAt(detectedOpponents.lastIndex)
                }

                recalculateAndPushBattleData()
                Handler(Looper.getMainLooper()).post {
                    Toast.makeText(
                        this,
                        "⚔️ Opponent: ${matched.name} (${matched.fastTurns}t ${matched.defaultFastMove})",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }

    /**
     * Detects player switches automatically via Top-Left Player Nameplate OR Bottom Charged Move buttons.
     * Immediately updates internal state, re-indexes current matchups, and refreshes UI without manual party tap.
     */
    private fun handleRecognizedPlayerSwitchText(visionText: Text, isFromTopLeftHeader: Boolean) {
        val preset = currentPreset ?: return

        for (block in visionText.textBlocks) {
            for (line in block.lines) {
                val lineText = line.text.trim()
                if (lineText.length < 3) continue

                val lowerLine = lineText.lowercase()
                if (isOverlayHudSelfText(lowerLine)) continue

                val normalizedLine = normalizeOcrToken(lineText)

                // 1. Direct or fuzzy species match against user's 3 team members
                for (slot in preset.pokemon) {
                    val speciesBase = FormResolver.extractBaseSpecies(slot.name)
                    val cpStr = slot.cp.toString()
                    val meta = getPokemonMeta(slot.name)

                    var isMatched = false

                    if (speciesBase.length >= 3 && normalizedLine.contains(speciesBase)) {
                        isMatched = true
                    } else if (cpStr.length >= 3 && lineText.contains(cpStr)) {
                        isMatched = true
                    } else if (isFromTopLeftHeader) {
                        // Fuzzy Levenshtein check on top-left nameplate tokens
                        val tokens = lineText.replace(Regex("[^a-zA-Z\\s]"), " ")
                            .split("\\s+".toRegex())
                            .filter { it.length >= 4 }
                        for (token in tokens) {
                            val normTok = normalizeOcrToken(token)
                            if (levenshteinDistance(normTok, speciesBase) <= 2) {
                                isMatched = true
                                break
                            }
                        }
                    }

                    if (!isMatched && !isFromTopLeftHeader) {
                        // Check Charged Move signature keywords on bottom move buttons
                        val moveKeywords = mutableSetOf<String>()
                        fun addMoveKw(move: String) {
                            if (move.isNotBlank()) {
                                move.lowercase().split(" ")
                                    .filter { it.length >= 4 && it != "move" && it != "fast" }
                                    .forEach { moveKeywords.add(it) }
                            }
                        }
                        addMoveKw(slot.chargedMove1)
                        addMoveKw(slot.chargedMove2)
                        addMoveKw(meta.chargedMove1)
                        addMoveKw(meta.chargedMove2)

                        for (kw in moveKeywords) {
                            if (lowerLine.contains(kw)) {
                                isMatched = true
                                break
                            }
                        }
                    }

                    if (isMatched) {
                        if (!slot.name.equals(activeUserPokemonName, ignoreCase = true)) {
                            activeUserPokemonName = slot.name
                            recalculateAndPushBattleData()
                            Handler(Looper.getMainLooper()).post {
                                Toast.makeText(this, "🔄 Player Switch: ${slot.name}", Toast.LENGTH_SHORT).show()
                            }
                        }
                        return
                    }
                }

                // 2. If top-left header detected a valid meta Pokémon not in preset, still update active lead
                if (isFromTopLeftHeader) {
                    val detectedPlayerMon = findPokemonInText(lineText)
                    if (detectedPlayerMon != null &&
                        !detectedPlayerMon.baseSpecies.equals(activeOpponentSpecies, ignoreCase = true)
                    ) {
                        val resolved = FormResolver.resolveBestDefaultVariant(
                            detectedPlayerMon,
                            lineText,
                            preset.league
                        )
                        if (!resolved.name.equals(activeUserPokemonName, ignoreCase = true)) {
                            activeUserPokemonName = resolved.name
                            recalculateAndPushBattleData()
                            Handler(Looper.getMainLooper()).post {
                                Toast.makeText(this, "🔄 Active Lead: ${resolved.name}", Toast.LENGTH_SHORT).show()
                            }
                            return
                        }
                    }
                }
            }
        }
    }

    /**
     * ACTION: START NEW BATTLE
     * Clears previous opponents, resets Shadow/Form state, and prepares for next opponent spawn
     */
    fun startNewBattle() {
        detectedOpponents.clear()
        isWaitingForOpponent = true
        activeOpponentName = "Waiting..."
        activeOpponentSpecies = ""
        isOpponentShadow = false
        availableOpponentForms = emptyList()
        currentFormIndex = 0
        activeUserPokemonName = currentPreset?.pokemon?.getOrNull(0)?.name ?: "Dialga (Origin)"
        recalculateAndPushBattleData()
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(this, "⚔️ New Battle! Scanning top-left & top-right headers...", Toast.LENGTH_SHORT).show()
        }
    }

    fun toggleShadowModifier() {
        isOpponentShadow = !isOpponentShadow
        recalculateAndPushBattleData()
    }

    fun cycleActiveOpponentForm() {
        if (availableOpponentForms.size <= 1) return
        currentFormIndex = (currentFormIndex + 1) % availableOpponentForms.size
        val nextVariant = availableOpponentForms[currentFormIndex]
        val previousName = activeOpponentName
        activeOpponentName = nextVariant.name

        val idx = detectedOpponents.indexOf(previousName)
        if (idx >= 0) {
            detectedOpponents[idx] = nextVariant.name
        } else if (!detectedOpponents.contains(nextVariant.name)) {
            detectedOpponents.add(0, nextVariant.name)
        }
        recalculateAndPushBattleData()
    }

    private fun normalizeOcrToken(input: String): String {
        return input.lowercase()
            .replace("0", "o")
            .replace("1", "i")
            .replace("!", "i")
            .replace("|", "l")
            .replace("5", "s")
            .replace("8", "b")
            .replace(Regex("[^a-z]"), "")
    }

    private fun findPokemonInText(rawText: String): PokemonMeta? {
        val cleaned = rawText
            .replace(Regex("(?i)\\b(?:shadow|purified|forme|form|cp|iv|lv|level)\\b"), " ")
            .replace(Regex("\\d+"), " ")
            .replace(Regex("[^a-zA-Z\\s-]"), " ")
            .trim()

        if (cleaned.length < 3) return null

        val lowerCleaned = cleaned.lowercase()

        // 1. Direct substring match against species base names
        for (meta in POKEMON_META_DATABASE) {
            if (meta.baseSpecies.length >= 4 && lowerCleaned.contains(meta.baseSpecies)) {
                return meta
            }
        }

        // 2. Token-level exact & normalized OCR confusable match
        val tokens = cleaned.split("\\s+".toRegex()).filter { it.length >= 3 }
        for (token in tokens) {
            val normToken = normalizeOcrToken(token)
            if (normToken.length < 4) continue

            val exactOrNorm = POKEMON_META_DATABASE.find {
                it.baseSpecies.equals(token, ignoreCase = true) ||
                        normalizeOcrToken(it.baseSpecies) == normToken
            }
            if (exactOrNorm != null) return exactOrNorm
        }

        // 3. Prefix match for partially clipped long names (e.g. "Feraliga", "Giratin", "Zacia")
        for (token in tokens) {
            val normToken = normalizeOcrToken(token)
            if (normToken.length < 5) continue
            val prefixMatch = POKEMON_META_DATABASE.find {
                normalizeOcrToken(it.baseSpecies).startsWith(normToken) ||
                        normToken.startsWith(normalizeOcrToken(it.baseSpecies))
            }
            if (prefixMatch != null) return prefixMatch
        }

        // 4. Fuzzy Levenshtein match against meta dictionary
        var bestMatch: PokemonMeta? = null
        var bestDistance = Int.MAX_VALUE

        for (token in tokens) {
            val normToken = normalizeOcrToken(token)
            if (normToken.length < 4) continue
            val maxAllowedDist = if (normToken.length >= 7) 2 else 1

            for (meta in POKEMON_META_DATABASE) {
                val target = normalizeOcrToken(meta.baseSpecies)
                if (kotlin.math.abs(target.length - normToken.length) > maxAllowedDist) continue
                val dist = levenshteinDistance(normToken, target)
                if (dist <= maxAllowedDist && dist < bestDistance) {
                    bestDistance = dist
                    bestMatch = meta
                }
            }
        }

        return bestMatch
    }

    private fun getPokemonMeta(name: String): PokemonMeta {
        val exact = POKEMON_META_DATABASE.find { it.name.equals(name, ignoreCase = true) }
        if (exact != null) return exact

        val base = FormResolver.extractBaseSpecies(name)
        val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
        val variants = FormResolver.getVariantsForSpecies(base, activeLeague)
        if (variants.isNotEmpty()) return variants.first()

        return PokemonMeta(
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
        val atk = moveType.lowercase()
        for (def in defenderTypes.map { it.lowercase() }) {
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
        val moveStats = MOVE_DATABASE[moveName] ?: MoveStats(moveName, attacker.types.firstOrNull() ?: "normal", 80)
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
        val p1 = currentPreset?.pokemon?.getOrNull(0)
        val p2 = currentPreset?.pokemon?.getOrNull(1)
        val p3 = currentPreset?.pokemon?.getOrNull(2)

        val p1Name = p1?.name ?: "Dialga (Origin)"
        val p2Name = p2?.name ?: "Lugia"
        val p3Name = p3?.name ?: "Kyogre"

        val activePlayerName = activeUserPokemonName ?: p1Name
        val activeSlot = currentPreset?.pokemon?.find { it.name.equals(activePlayerName, ignoreCase = true) }

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
                "isOpponentShadow" to isOpponentShadow,
                "currentFormLabel" to "Base",
                "availableForms" to emptyList<String>(),
                "userActivePokemon" to activePlayerName,
                "myMove1Summary" to "—",
                "myMove2Summary" to "—",
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

        val userMove1Name = activeSlot?.chargedMove1 ?: userMeta.chargedMove1
        val userMove2Name = activeSlot?.chargedMove2 ?: userMeta.chargedMove2

        // Calculate Player Active Pokémon's Charged Move Damage % to Opponent (accounting for STAB, Typing, and Opponent Shadow 0.833x Def)
        val myMove1Pct = calculateChargedMoveDamagePercent(
            attacker = userMeta,
            defender = oppMeta,
            moveName = userMove1Name,
            isAttackerShadow = activePlayerName.contains("Shadow", ignoreCase = true),
            isDefenderShadow = isOpponentShadow
        )
        val myMove2Pct = calculateChargedMoveDamagePercent(
            attacker = userMeta,
            defender = oppMeta,
            moveName = userMove2Name,
            isAttackerShadow = activePlayerName.contains("Shadow", ignoreCase = true),
            isDefenderShadow = isOpponentShadow
        )

        val myMove1Summary = "$userMove1Name ($myMove1Pct%)"
        val myMove2Summary = "$userMove2Name ($myMove2Pct%)"

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

        val scannedOpponentsData = displayList.mapIndexed { idx, opp ->
            val meta = getPokemonMeta(opp)
            val isThisOppShadow = if (idx == 0) isOpponentShadow else false
            val oppC1Pct = calculateChargedMoveDamagePercent(
                attacker = meta,
                defender = userMeta,
                moveName = meta.chargedMove1,
                isAttackerShadow = isThisOppShadow,
                isDefenderShadow = activePlayerName.contains("Shadow", ignoreCase = true)
            )
            val oppC2Pct = calculateChargedMoveDamagePercent(
                attacker = meta,
                defender = userMeta,
                moveName = meta.chargedMove2,
                isAttackerShadow = isThisOppShadow,
                isDefenderShadow = activePlayerName.contains("Shadow", ignoreCase = true)
            )
            val matrix = calculate3v3Matrix(opp, p1Name, p2Name, p3Name)
            mapOf(
                "name" to meta.name,
                "code" to meta.name.split(" ").first().take(3),
                "turns" to meta.fastTurns,
                "c1" to "${meta.chargedMove1} ($oppC1Pct%)",
                "c2" to "${meta.chargedMove2} ($oppC2Pct%)",
                "matrix" to matrix
            )
        }

        val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
        if (availableOpponentForms.isEmpty()) {
            availableOpponentForms = FormResolver.getVariantsForSpecies(oppMeta.baseSpecies, activeLeague)
        }

        val battlePayload = mapOf(
            "activeOpponent" to oppMeta.name,
            "activeOpponentFastMove" to oppMeta.defaultFastMove,
            "activeOpponentTurns" to oppMeta.fastTurns,
            "isOpponentShadow" to isOpponentShadow,
            "currentFormLabel" to oppMeta.formLabel,
            "availableForms" to availableOpponentForms.map { it.formLabel },
            "userActivePokemon" to userMeta.name,
            "userFastMoveTurns" to userMeta.fastTurns,
            "myMove1Summary" to myMove1Summary,
            "myMove2Summary" to myMove2Summary,
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
                    l.contains("dialga") -> if (o.contains("crowned")) "🟡🔴🔴" else "🔴🔴🔴"
                    l.contains("lugia") -> "🟡🟡🔴"
                    l.contains("kyogre") || l.contains("ho-oh") -> "🟢🟢🟡"
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
        val json = prefs.getString("gbl_team_presets_v2", null) ?: return emptyList()
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
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.startNewBattle()
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
