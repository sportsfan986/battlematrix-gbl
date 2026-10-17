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
import okhttp3.OkHttpClient
import okhttp3.Request
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
            val isRawBaseStats: Boolean = false,
            val defaultIvsGl: String = "1/15/15",
            val defaultIvsUl: String = "1/15/15"
        )

        val RECOMMENDED_CHARGED_MOVES: Map<String, Triple<String, String, String>> = mapOf(
            "Rillaboom" to Triple("Drum Beating", "Earth Power", "Frenzy Plant"),
            "rillaboom" to Triple("Drum Beating", "Earth Power", "Frenzy Plant"),
            "Tinkaton" to Triple("Gigaton Hammer", "Bulldoze", "Brutal Swing"),
            "tinkaton" to Triple("Gigaton Hammer", "Bulldoze", "Brutal Swing"),
            "Kanto Ninetales" to Triple("Weather Ball", "Energy Ball", "Overheat"),
            "ninetales" to Triple("Weather Ball", "Energy Ball", "Overheat"),
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
            "Skeledirge" to Triple("Disarming Voice", "Shadow Ball", "Overheat"),
            "skeledirge" to Triple("Disarming Voice", "Shadow Ball", "Overheat"),
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
            val rec = RECOMMENDED_CHARGED_MOVES[meta.name]
                ?: RECOMMENDED_CHARGED_MOVES[meta.baseSpecies.lowercase()]
                ?: RECOMMENDED_CHARGED_MOVES[meta.speciesId.lowercase()]
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
            "Marowak (Alolan)" to "FirePunch",
            "Trevenant" to "Foul Play",
            "Jellicent" to "Ice Beam",
            "Drifblim" to "Mystical Fire",
            "Froslass" to "Crunch",
            "Skeledirge" to "Torch Song",
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
            "Greninja" to "Aerial Ace",
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
            "Behemoth Blade" to MoveStats("Behemoth Blade", "steel", 100),
            "Behemoth Bash" to MoveStats("Behemoth Bash", "steel", 80),
            "Secret Sword" to MoveStats("Secret Sword", "fighting", 70),
            "Aqua Jet" to MoveStats("Aqua Jet", "water", 70),
            "Double Iron Bash" to MoveStats("Double Iron Bash", "steel", 70),
            "Bleakwind Storm" to MoveStats("Bleakwind Storm", "flying", 60),
            "Wildbolt Storm" to MoveStats("Wildbolt Storm", "electric", 60),
            "Springtide Storm" to MoveStats("Springtide Storm", "fairy", 60),
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
            "Shadow Sneak" to MoveStats("Shadow Sneak", "ghost", 50),
            "Twister" to MoveStats("Twister", "dragon", 50),
            "Air Cutter" to MoveStats("Air Cutter", "flying", 60),
            "Payback" to MoveStats("Payback", "dark", 110),
            "Body Slam" to MoveStats("Body Slam", "normal", 50),
            "Foul Play" to MoveStats("Foul Play", "dark", 70),
            "Night Slash" to MoveStats("Night Slash", "dark", 50),
            "Cross Chop" to MoveStats("Cross Chop", "fighting", 50),
            "Dynamic Punch" to MoveStats("Dynamic Punch", "fighting", 90),
            "Aura Sphere" to MoveStats("Aura Sphere", "fighting", 100),
            "Focus Blast" to MoveStats("Focus Blast", "fighting", 150),
            "Sludge Bomb" to MoveStats("Sludge Bomb", "poison", 80),
            "Sludge Wave" to MoveStats("Sludge Wave", "poison", 110),
            "Acid Spray" to MoveStats("Acid Spray", "poison", 20),
            "Poison Fang" to MoveStats("Poison Fang", "poison", 40),
            "Cross Poison" to MoveStats("Cross Poison", "poison", 50),
            "Gunk Shot" to MoveStats("Gunk Shot", "poison", 130),
            "Mud Bomb" to MoveStats("Mud Bomb", "ground", 60),
            "Bone Club" to MoveStats("Bone Club", "ground", 40),
            "Shadow Bone" to MoveStats("Shadow Bone", "ghost", 75),
            "Hurricane" to MoveStats("Hurricane", "flying", 110),
            "Acrobatics" to MoveStats("Acrobatics", "flying", 110),
            "Drill Peck" to MoveStats("Drill Peck", "flying", 65),
            "Psychic" to MoveStats("Psychic", "psychic", 75),
            "Psyshock" to MoveStats("Psyshock", "psychic", 70),
            "Psychic Fangs" to MoveStats("Psychic Fangs", "psychic", 40),
            "Lunge" to MoveStats("Lunge", "bug", 55),
            "Megahorn" to MoveStats("Megahorn", "bug", 110),
            "X-Scissor" to MoveStats("X-Scissor", "bug", 65),
            "Power Gem" to MoveStats("Power Gem", "rock", 85),
            "Meteor Beam" to MoveStats("Meteor Beam", "rock", 120),
            "Night Shade" to MoveStats("Night Shade", "ghost", 80),
            "Icy Wind" to MoveStats("Icy Wind", "ice", 60),
            "Triple Axel" to MoveStats("Triple Axel", "ice", 60),
            "Icicle Spear" to MoveStats("Icicle Spear", "ice", 60),
            "Freeze Shock" to MoveStats("Freeze Shock", "ice", 160),
            "Ice Burn" to MoveStats("Ice Burn", "ice", 160),
            "Dragon Pulse" to MoveStats("Dragon Pulse", "dragon", 90),
            "Brutal Swing" to MoveStats("Brutal Swing", "dark", 65),
            "Flash Cannon" to MoveStats("Flash Cannon", "steel", 110),
            "Heavy Slam" to MoveStats("Heavy Slam", "steel", 70),
            "Magnet Bomb" to MoveStats("Magnet Bomb", "steel", 70),
            "Mirror Shot" to MoveStats("Mirror Shot", "steel", 35),
            "Doom Desire" to MoveStats("Doom Desire", "steel", 75),
            "Frenzy Plant" to MoveStats("Frenzy Plant", "grass", 100),
            "Energy Ball" to MoveStats("Energy Ball", "grass", 90),
            "Seed Bomb" to MoveStats("Seed Bomb", "grass", 65),
            "Power Whip" to MoveStats("Power Whip", "grass", 90),
            "Trailblaze" to MoveStats("Trailblaze", "grass", 65),
            "Solar Beam" to MoveStats("Solar Beam", "grass", 150),
            "Discharge" to MoveStats("Discharge", "electric", 65),
            "Zap Cannon" to MoveStats("Zap Cannon", "electric", 150),
            "Scald" to MoveStats("Scald", "water", 85),
            "Liquidation" to MoveStats("Liquidation", "water", 70),
            "Muddy Water" to MoveStats("Muddy Water", "water", 35),
            "Water Pulse" to MoveStats("Water Pulse", "water", 80),
            "Nature's Madness" to MoveStats("Nature's Madness", "fairy", 80),
            "Swift" to MoveStats("Swift", "normal", 65),
            "Hyper Beam" to MoveStats("Hyper Beam", "normal", 150),
            "Aura Wheel" to MoveStats("Aura Wheel", "electric", 100),
            "Rage Fist" to MoveStats("Rage Fist", "ghost", 50),
            "Drum Beating" to MoveStats("Drum Beating", "grass", 60, 35),
            "Gigaton Hammer" to MoveStats("Gigaton Hammer", "steel", 130, 60),
            "Bulldoze" to MoveStats("Bulldoze", "ground", 80, 55),
            "Air Cutter" to MoveStats("Air Cutter", "flying", 60, 55)
        )

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
            PokemonMeta("Zacian (Crowned)", "zacian_crowned", "zacian", "Crowned", listOf("fairy", "steel"), 4620, "Metal Claw", 2, "Behemoth Blade", "Close Combat", 52, 48, atk = 264.0, def = 216.0, hp = 173, glRank = 400, ulRank = 300, mlRank = 2, chargedMove3 = "Play Rough"),
            PokemonMeta("Zacian (Hero)", "zacian_hero", "zacian", "Hero", listOf("fairy"), 4329, "Quick Attack", 1, "Close Combat", "Play Rough", 44, 42, atk = 232.0, def = 215.0, hp = 173, glRank = 420, ulRank = 310, mlRank = 18, chargedMove3 = "Wild Charge"),
            PokemonMeta("Zamazenta (Crowned)", "zamazenta_crowned", "zamazenta", "Crowned", listOf("fighting", "steel"), 4620, "Metal Claw", 2, "Behemoth Bash", "Close Combat", 46, 48, atk = 225.0, def = 260.0, hp = 173, glRank = 390, ulRank = 280, mlRank = 12, chargedMove3 = "Moonblast"),
            PokemonMeta("Zamazenta (Hero)", "zamazenta_hero", "zamazenta", "Hero", listOf("fighting"), 4329, "Snarl", 3, "Close Combat", "Crunch", 46, 32, atk = 232.0, def = 215.0, hp = 173, glRank = 410, ulRank = 290, mlRank = 20, chargedMove3 = "Moonblast"),
            PokemonMeta("Keldeo (Resolute)", "keldeo_resolute", "keldeo", "Resolute", listOf("water", "fighting"), 4181, "Low Kick", 2, "Secret Sword", "Aqua Jet", 42, 38, atk = 234.0, def = 171.0, hp = 188, glRank = 140, ulRank = 65, mlRank = 14, chargedMove3 = "Hydro Pump"),
            PokemonMeta("Keldeo (Ordinary)", "keldeo_ordinary", "keldeo", "Ordinary", listOf("water", "fighting"), 4181, "Low Kick", 2, "Sacred Sword", "Aqua Jet", 38, 38, atk = 234.0, def = 171.0, hp = 188, glRank = 150, ulRank = 70, mlRank = 19, chargedMove3 = "Hydro Pump"),
            PokemonMeta("Giratina (Origin)", "giratina_origin", "giratina", "Origin", listOf("ghost", "dragon"), 4164, "Shadow Claw", 2, "Shadow Ball", "Ominous Wind", 46, 22, atk = 206.0, def = 172.0, hp = 247, glRank = 180, ulRank = 35, mlRank = 9),
            PokemonMeta("Giratina (Altered)", "giratina_altered", "giratina", "Altered", listOf("ghost", "dragon"), 3820, "Shadow Claw", 2, "Dragon Claw", "Ancient Power", 28, 26, atk = 171.0, def = 206.0, hp = 247, glRank = 190, ulRank = 3, mlRank = 26),
            PokemonMeta("Ninetales (Alolan)", "ninetales_alolan", "ninetales", "Alolan", listOf("ice", "fairy"), 2610, "Powder Snow", 2, "Weather Ball", "Dazzling Gleam", 34, 46, atk = 116.0, def = 138.0, hp = 126, glRank = 16, ulRank = 32, mlRank = 320),
            PokemonMeta("Kanto Ninetales", "ninetales", "ninetales", "Kanto", listOf("fire"), 1498, "Ember", 2, "Weather Ball", "Energy Ball", 34, 44, atk = 115.0, def = 138.0, hp = 127, glRank = 58, ulRank = 88, mlRank = 350, chargedMove3 = "Overheat"),
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
            PokemonMeta("Kyurem (Black)", "kyurem_black", "kyurem", "Black", listOf("dragon", "ice"), 4605, "Shadow Claw", 2, "Freeze Shock", "Fusion Bolt", 58, 48, atk = 278.0, def = 171.0, hp = 218, glRank = 200, ulRank = 80, mlRank = 1, chargedMove3 = "Outrage"),
            PokemonMeta("Kyurem (White)", "kyurem_white", "kyurem", "White", listOf("dragon", "ice"), 4605, "Dragon Breath", 1, "Ice Burn", "Fusion Flare", 58, 48, atk = 278.0, def = 171.0, hp = 218, glRank = 210, ulRank = 85, mlRank = 2, chargedMove3 = "Blizzard"),
            PokemonMeta("Kyurem", "kyurem", "kyurem", "Base", listOf("dragon", "ice"), 4041, "Dragon Breath", 1, "Glaciate", "Dragon Claw", 38, 30, atk = 219.0, def = 154.0, hp = 218, glRank = 310, ulRank = 95, mlRank = 18, chargedMove3 = "Blizzard"),
            PokemonMeta("Enamorus (Incarnate)", "enamorus", "enamorus", "Incarnate", listOf("fairy", "flying"), 3873, "Fairy Wind", 2, "Fly", "Dazzling Gleam", 42, 48, atk = 250.0, def = 148.0, hp = 158, glRank = 280, ulRank = 130, mlRank = 17),
            PokemonMeta("Enamorus (Therian)", "enamorus_therian", "enamorus", "Therian", listOf("fairy", "flying"), 3873, "Fairy Wind", 2, "Fly", "Moonblast", 42, 50, atk = 225.0, def = 182.0, hp = 158, glRank = 290, ulRank = 140, mlRank = 25),
            PokemonMeta("Urshifu (Single Strike)", "urshifu_single", "urshifu", "Single", listOf("fighting", "dark"), 4077, "Counter", 2, "Dynamic Punch", "Payback", 44, 52, atk = 226.0, def = 166.0, hp = 200, glRank = 210, ulRank = 110, mlRank = 22),
            PokemonMeta("Urshifu (Rapid Strike)", "urshifu_rapid", "urshifu", "Rapid", listOf("fighting", "water"), 4077, "Counter", 2, "Aqua Jet", "Close Combat", 34, 48, atk = 226.0, def = 166.0, hp = 200, glRank = 215, ulRank = 115, mlRank = 24),
            PokemonMeta("Sandslash (Alolan)", "sandslash_alolan", "sandslash", "Alolan", listOf("ice", "steel"), 2432, "Powder Snow", 2, "Ice Punch", "Drill Run", 32, 42, atk = 115.0, def = 139.0, hp = 132, glRank = 9, ulRank = 16, mlRank = 350),
            PokemonMeta("Sandslash", "sandslash", "sandslash", "Kanto", listOf("ground"), 2374, "Mud Shot", 2, "Scorching Sands", "Night Slash", 42, 28, atk = 126.0, def = 128.0, hp = 132, glRank = 48, ulRank = 75, mlRank = 380),
            PokemonMeta("Marowak (Alolan)", "marowak_alolan", "marowak", "Alolan", listOf("fire", "ghost"), 1835, "Fire Spin", 3, "Bone Club", "Shadow Bone", 28, 44, atk = 110.0, def = 144.0, hp = 125, glRank = 35, ulRank = 310, mlRank = 450),
            PokemonMeta("Marowak", "marowak", "marowak", "Kanto", listOf("ground"), 1835, "Mud-Slap", 3, "Bone Club", "Rock Slide", 28, 40, atk = 110.0, def = 144.0, hp = 125, glRank = 12, ulRank = 290, mlRank = 440),
            PokemonMeta("Stunfisk (Galarian)", "stunfisk_galarian", "stunfisk", "Galarian", listOf("ground", "steel"), 2445, "Mud Shot", 2, "Rock Slide", "Earthquake", 38, 52, atk = 102.0, def = 126.0, hp = 172, glRank = 30, ulRank = 28, mlRank = 340),
            PokemonMeta("Stunfisk", "stunfisk", "stunfisk", "Unovan", listOf("ground", "electric"), 2445, "Thunder Shock", 2, "Mud Bomb", "Discharge", 34, 38, atk = 102.0, def = 126.0, hp = 172, glRank = 26, ulRank = 34, mlRank = 350),
            PokemonMeta("Muk (Alolan)", "muk_alolan", "muk", "Alolan", listOf("poison", "dark"), 2757, "Poison Jab", 2, "Dark Pulse", "Acid Spray", 40, 20, atk = 152.0, def = 148.0, hp = 190, glRank = 95, ulRank = 22, mlRank = 180),
            PokemonMeta("Muk", "muk", "muk", "Kanto", listOf("poison"), 2757, "Poison Jab", 2, "Thunder Punch", "Dark Pulse", 32, 40, atk = 152.0, def = 148.0, hp = 190, glRank = 110, ulRank = 36, mlRank = 190),
            PokemonMeta("Weezing (Galarian)", "weezing_galarian", "weezing", "Galarian", listOf("poison", "fairy"), 2488, "Fairy Wind", 2, "Brutal Swing", "Overheat", 34, 62, atk = 136.0, def = 162.0, hp = 138, glRank = 25, ulRank = 11, mlRank = 290),
            PokemonMeta("Qwilfish (Hisuian)", "qwilfish_hisuian", "qwilfish", "Hisuian", listOf("dark", "poison"), 2290, "Poison Sting", 2, "Aqua Tail", "Shadow Ball", 30, 44, atk = 125.0, def = 114.0, hp = 134, glRank = 36, ulRank = 90, mlRank = 380),

            // --- User Custom Great & Ultra League Team Pokémon ---
            PokemonMeta("Fearow", "fearow", "fearow", "Base", listOf("normal", "flying"), 1500, "Peck", 2, "Drill Run", "Drill Peck", 42, 34, atk = 131.0, def = 96.0, hp = 120, glRank = 85, ulRank = 250, mlRank = 420),
            PokemonMeta("Shadow Pidgeot", "pidgeot_shadow", "pidgeot", "Shadow", listOf("normal", "flying"), 1490, "Gust", 4, "Twister", "Brave Bird", 28, 62, atk = 117.0, def = 112.0, hp = 142, glRank = 28, ulRank = 18, mlRank = 310),
            PokemonMeta("Pidgeot", "pidgeot", "pidgeot", "Base", listOf("normal", "flying"), 1490, "Gust", 4, "Twister", "Brave Bird", 24, 52, atk = 117.0, def = 112.0, hp = 142, glRank = 32, ulRank = 15, mlRank = 300),
            PokemonMeta("Zygarde", "zygarde_complete", "zygarde", "Complete", listOf("dragon", "ground"), 2472, "Dragon Tail", 3, "Crunch", "Earthquake", 32, 52, atk = 169.0, def = 186.0, hp = 338, glRank = 80, ulRank = 1, mlRank = 5),
            PokemonMeta("Corviknight", "corviknight", "corviknight", "Base", listOf("flying", "steel"), 2499, "Sand Attack", 1, "Air Cutter", "Iron Head", 32, 34, atk = 148.0, def = 178.0, hp = 202, glRank = 14, ulRank = 7, mlRank = 120, chargedMove3 = "Sky Attack"),
            PokemonMeta("Mimikyu", "mimikyu", "mimikyu", "Disguised", listOf("ghost", "fairy"), 2497, "Shadow Claw", 2, "Play Rough", "Shadow Sneak", 44, 28, atk = 162.0, def = 184.0, hp = 138, glRank = 40, ulRank = 25, mlRank = 210),

            // --- Master League Core Meta ---
            PokemonMeta("Lugia", "lugia", "lugia", "Base", listOf("psychic", "flying"), 4179, "Dragon Tail", 3, "Aeroblast", "Earth Power", 54, 34, atk = 176.0, def = 274.0, hp = 211, glRank = 75, ulRank = 45, mlRank = 12),
            PokemonMeta("Kyogre", "kyogre", "kyogre", "Base", listOf("water"), 4652, "Waterfall", 3, "Origin Pulse", "Avalanche", 56, 40, atk = 243.0, def = 204.0, hp = 184, glRank = 310, ulRank = 180, mlRank = 10),
            PokemonMeta("Groudon", "groudon", "groudon", "Base", listOf("ground"), 4652, "Mud Shot", 2, "Precipice Blades", "Fire Punch", 55, 26, atk = 243.0, def = 204.0, hp = 184, glRank = 300, ulRank = 175, mlRank = 11),
            PokemonMeta("Ho-Oh", "ho_oh", "ho-oh", "Base", listOf("fire", "flying"), 4367, "Incinerate", 5, "Sacred Fire", "Brave Bird", 54, 52, atk = 216.0, def = 219.0, hp = 193, glRank = 140, ulRank = 70, mlRank = 7),
            PokemonMeta("Yveltal", "yveltal", "yveltal", "Base", listOf("dark", "flying"), 4275, "Snarl", 3, "Dark Pulse", "Oblivion Wing", 42, 42, atk = 225.0, def = 169.0, hp = 226, glRank = 260, ulRank = 95, mlRank = 8),
            PokemonMeta("Xerneas", "xerneas", "xerneas", "Base", listOf("fairy"), 4275, "Geomancy", 3, "Close Combat", "Moonblast", 44, 48, atk = 225.0, def = 169.0, hp = 226, glRank = 270, ulRank = 98, mlRank = 13),
            PokemonMeta("Solgaleo", "solgaleo", "solgaleo", "Base", listOf("psychic", "steel"), 4545, "Fire Spin", 3, "Psychic Fangs", "Iron Head", 24, 32, atk = 229.0, def = 174.0, hp = 234, glRank = 290, ulRank = 120, mlRank = 15),
            PokemonMeta("Lunala", "lunala", "lunala", "Base", listOf("psychic", "ghost"), 4545, "Shadow Claw", 2, "Shadow Ball", "Moonblast", 46, 48, atk = 229.0, def = 174.0, hp = 234, glRank = 310, ulRank = 140, mlRank = 18),
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
            PokemonMeta("Zarude", "zarude", "zarude", "Base", listOf("dark", "grass"), 4334, "Vine Whip", 2, "Dark Pulse", "Power Whip", 40, 44, atk = 215.0, def = 191.0, hp = 209, glRank = 210, ulRank = 95, mlRank = 17),
            PokemonMeta("Meloetta", "meloetta_aria", "meloetta", "Aria", listOf("normal", "psychic"), 4490, "Quick Attack", 1, "Psyshock", "Dazzling Gleam", 34, 46, atk = 224.0, def = 201.0, hp = 200, glRank = 260, ulRank = 110, mlRank = 16),
            PokemonMeta("Ursaluna", "ursaluna", "ursaluna", "Base", listOf("ground", "normal"), 4358, "Tackle", 1, "Ice Punch", "High Horsepower", 30, 50, atk = 216.0, def = 176.0, hp = 246, glRank = 250, ulRank = 130, mlRank = 21),
            PokemonMeta("Togekiss", "togekiss", "togekiss", "Base", listOf("fairy", "flying"), 3767, "Charm", 3, "Ancient Power", "Aura Sphere", 30, 46, atk = 201.0, def = 195.0, hp = 178, glRank = 150, ulRank = 48, mlRank = 24),
            PokemonMeta("Gyarados", "gyarados", "gyarados", "Base", listOf("water", "flying"), 3834, "Dragon Breath", 1, "Aqua Tail", "Crunch", 28, 34, atk = 212.0, def = 168.0, hp = 193, glRank = 160, ulRank = 42, mlRank = 26),
            PokemonMeta("Snorlax", "snorlax", "snorlax", "Base", listOf("normal"), 3647, "Lick", 1, "Body Slam", "Superpower", 26, 40, atk = 171.0, def = 154.0, hp = 285, glRank = 95, ulRank = 38, mlRank = 30),
            PokemonMeta("Gholdengo", "gholdengo", "gholdengo", "Base", listOf("steel", "ghost"), 3976, "Hex", 3, "Shadow Ball", "Focus Blast", 46, 56, atk = 226.0, def = 175.0, hp = 181, glRank = 280, ulRank = 140, mlRank = 23),
            PokemonMeta("Baxcalibur", "baxcalibur", "baxcalibur", "Base", listOf("dragon", "ice"), 4286, "Dragon Breath", 1, "Avalanche", "Dragon Claw", 44, 28, atk = 228.0, def = 154.0, hp = 218, glRank = 90, ulRank = 55, mlRank = 22),
            PokemonMeta("Tapu Bulu", "tapu_bulu", "tapu bulu", "Base", listOf("grass", "fairy"), 3865, "Bullet Seed", 3, "Nature's Madness", "Grass Knot", 42, 44, atk = 222.0, def = 191.0, hp = 158, glRank = 290, ulRank = 110, mlRank = 14),
            PokemonMeta("Tapu Fini", "tapu_fini", "tapu fini", "Base", listOf("water", "fairy"), 3230, "Water Gun", 1, "Surf", "Nature's Madness", 34, 42, atk = 135.0, def = 214.0, hp = 158, glRank = 32, ulRank = 3, mlRank = 55),
            PokemonMeta("Tapu Lele", "tapu_lele", "tapu lele", "Base", listOf("psychic", "fairy"), 3950, "Astonish", 3, "Nature's Madness", "Psyshock", 44, 36, atk = 232.0, def = 191.0, hp = 158, glRank = 300, ulRank = 120, mlRank = 19),
            PokemonMeta("Tapu Koko", "tapu_koko", "tapu koko", "Base", listOf("electric", "fairy"), 3582, "Volt Switch", 4, "Nature's Madness", "Brave Bird", 42, 52, atk = 224.0, def = 166.0, hp = 158, glRank = 270, ulRank = 95, mlRank = 35),

            // --- Great League & Ultra League Core Meta ---
            PokemonMeta("Clodsire", "clodsire", "clodsire", "Base", listOf("poison", "ground"), 1494, "Poison Sting", 2, "Earthquake", "Stone Edge", 46, 42, atk = 89.0, def = 123.0, hp = 222, glRank = 1, ulRank = 90, mlRank = 400),
            PokemonMeta("Feraligatr", "feraligatr", "feraligatr", "Base", listOf("water"), 2488, "Shadow Claw", 2, "Hydro Cannon", "Ice Beam", 44, 38, atk = 164.0, def = 155.0, hp = 161, glRank = 2, ulRank = 2, mlRank = 85),
            PokemonMeta("Mandibuzz", "mandibuzz", "mandibuzz", "Base", listOf("dark", "flying"), 2417, "Snarl", 3, "Dark Pulse", "Aerial Ace", 38, 28, atk = 118.0, def = 191.0, hp = 208, glRank = 3, ulRank = 12, mlRank = 280),
            PokemonMeta("Azumarill", "azumarill", "azumarill", "Base", listOf("water", "fairy"), 1499, "Bubble", 3, "Ice Beam", "Play Rough", 36, 40, atk = 94.0, def = 132.0, hp = 188, glRank = 4, ulRank = 350, mlRank = 500),
            PokemonMeta("Gastrodon", "gastrodon", "gastrodon", "Base", listOf("water", "ground"), 2485, "Mud-Slap", 3, "Body Slam", "Earth Power", 26, 44, atk = 112.0, def = 115.0, hp = 182, glRank = 5, ulRank = 24, mlRank = 310),
            PokemonMeta("Malamar", "malamar", "malamar", "Base", listOf("dark", "psychic"), 2488, "Psywave", 1, "Foul Play", "Superpower", 36, 42, atk = 118.0, def = 124.0, hp = 154, glRank = 6, ulRank = 18, mlRank = 320),
            PokemonMeta("Dunsparce", "dunsparce", "dunsparce", "Base", listOf("normal"), 1498, "Rollout", 3, "Rock Slide", "Drill Run", 36, 40, atk = 104.0, def = 108.0, hp = 178, glRank = 7, ulRank = 310, mlRank = 480),
            PokemonMeta("Annihilape", "annihilape", "annihilape", "Base", listOf("fighting", "ghost"), 3695, "Counter", 2, "Rage Fist", "Ice Punch", 32, 30, atk = 198.0, def = 162.0, hp = 215, glRank = 8, ulRank = 9, mlRank = 32),
            PokemonMeta("Primeape", "primeape", "primeape", "Base", listOf("fighting"), 2488, "Karate Chop", 2, "Rage Fist", "Close Combat", 32, 48, atk = 132.0, def = 108.0, hp = 128, glRank = 10, ulRank = 20, mlRank = 340),
            PokemonMeta("Cresselia", "cresselia", "cresselia", "Base", listOf("psychic"), 2488, "Psycho Cut", 2, "Grass Knot", "Moonblast", 36, 46, atk = 124.0, def = 215.0, hp = 197, glRank = 11, ulRank = 4, mlRank = 110),
            PokemonMeta("Jumpluff", "jumpluff", "jumpluff", "Base", listOf("grass", "flying"), 1498, "Fairy Wind", 2, "Aerial Ace", "Energy Ball", 28, 42, atk = 96.0, def = 154.0, hp = 152, glRank = 13, ulRank = 300, mlRank = 480),
            PokemonMeta("Swampert", "swampert", "swampert", "Base", listOf("water", "ground"), 2495, "Mud Shot", 2, "Hydro Cannon", "Earthquake", 44, 52, atk = 167.0, def = 143.0, hp = 175, glRank = 15, ulRank = 14, mlRank = 60),
            PokemonMeta("Quagsire", "quagsire", "quagsire", "Base", listOf("water", "ground"), 1499, "Mud Shot", 2, "Aqua Tail", "Stone Edge", 28, 46, atk = 112.0, def = 114.0, hp = 164, glRank = 17, ulRank = 280, mlRank = 450),
            PokemonMeta("Whiscash", "whiscash", "whiscash", "Base", listOf("water", "ground"), 1499, "Mud Shot", 2, "Scald", "Mud Bomb", 40, 32, atk = 108.0, def = 106.0, hp = 180, glRank = 19, ulRank = 290, mlRank = 450),
            PokemonMeta("Talonflame", "talonflame", "talonflame", "Base", listOf("fire", "flying"), 2493, "Incinerate", 5, "Fly", "Flame Charge", 42, 28, atk = 159.0, def = 143.0, hp = 169, glRank = 18, ulRank = 10, mlRank = 180),
            PokemonMeta("Serperior", "serperior", "serperior", "Base", listOf("grass"), 2480, "Vine Whip", 2, "Frenzy Plant", "Aerial Ace", 44, 28, atk = 110.0, def = 162.0, hp = 142, glRank = 20, ulRank = 26, mlRank = 310),
            PokemonMeta("Wigglytuff", "wigglytuff", "wigglytuff", "Base", listOf("normal", "fairy"), 1499, "Charm", 3, "Icy Wind", "Swift", 30, 32, atk = 109.0, def = 82.0, hp = 225, glRank = 21, ulRank = 320, mlRank = 480),
            PokemonMeta("Clefable", "clefable", "clefable", "Base", listOf("fairy"), 2488, "Fairy Wind", 2, "Meteor Mash", "Swift", 46, 30, atk = 148.0, def = 144.0, hp = 176, glRank = 23, ulRank = 13, mlRank = 240),
            PokemonMeta("Skeledirge", "skeledirge", "skeledirge", "Base", listOf("fire", "ghost"), 2491, "Incinerate", 5, "Disarming Voice", "Shadow Ball", 32, 46, atk = 158.0, def = 144.0, hp = 184, glRank = 22, ulRank = 15, mlRank = 70),
            PokemonMeta("Lickilicky", "lickilicky", "lickilicky", "Base", listOf("normal"), 2488, "Rollout", 3, "Body Slam", "Shadow Ball", 26, 44, atk = 136.0, def = 152.0, hp = 190, glRank = 27, ulRank = 8, mlRank = 210),
            PokemonMeta("Lickitung", "lickitung", "lickitung", "Base", listOf("normal"), 1499, "Lick", 1, "Body Slam", "Power Whip", 26, 42, atk = 96.0, def = 126.0, hp = 184, glRank = 29, ulRank = 400, mlRank = 500),
            PokemonMeta("Bastiodon", "bastiodon", "bastiodon", "Base", listOf("rock", "steel"), 1499, "Smack Down", 3, "Stone Edge", "Flamethrower", 42, 38, atk = 84.0, def = 238.0, hp = 138, glRank = 31, ulRank = 400, mlRank = 500),
            PokemonMeta("Carbink", "carbink", "carbink", "Base", listOf("rock", "fairy"), 1499, "Rock Throw", 2, "Rock Slide", "Moonblast", 36, 46, atk = 86.0, def = 242.0, hp = 126, glRank = 33, ulRank = 410, mlRank = 500),
            PokemonMeta("Registeel", "registeel", "registeel", "Base", listOf("steel"), 2488, "Lock-On", 1, "Focus Blast", "Zap Cannon", 56, 56, atk = 118.0, def = 236.0, hp = 162, glRank = 34, ulRank = 5, mlRank = 190),
            PokemonMeta("Skarmory", "skarmory", "skarmory", "Base", listOf("steel", "flying"), 2380, "Steel Wing", 2, "Sky Attack", "Brave Bird", 36, 52, atk = 104.0, def = 178.0, hp = 126, glRank = 37, ulRank = 65, mlRank = 360),
            PokemonMeta("Umbreon", "umbreon", "umbreon", "Base", listOf("dark"), 2416, "Snarl", 3, "Foul Play", "Last Resort", 34, 40, atk = 94.0, def = 192.0, hp = 166, glRank = 38, ulRank = 30, mlRank = 340),
            PokemonMeta("Lanturn", "lanturn", "lanturn", "Base", listOf("water", "electric"), 1499, "Spark", 2, "Surf", "Thunderbolt", 34, 44, atk = 102.0, def = 108.0, hp = 202, glRank = 39, ulRank = 260, mlRank = 450),
            PokemonMeta("Medicham", "medicham", "medicham", "Base", listOf("fighting", "psychic"), 1499, "Counter", 2, "Ice Punch", "Psychic", 28, 38, atk = 108.0, def = 128.0, hp = 136, glRank = 41, ulRank = 420, mlRank = 500),
            PokemonMeta("Sableye", "sableye", "sableye", "Base", listOf("dark", "ghost"), 1499, "Shadow Claw", 2, "Foul Play", "Power Gem", 36, 40, atk = 116.0, def = 118.0, hp = 124, glRank = 42, ulRank = 410, mlRank = 500),
            PokemonMeta("Drapion", "drapion", "drapion", "Base", listOf("poison", "dark"), 2488, "Poison Sting", 2, "Crunch", "Aqua Tail", 34, 28, atk = 152.0, def = 164.0, hp = 148, glRank = 43, ulRank = 17, mlRank = 260),
            PokemonMeta("Toxapex", "toxapex", "toxapex", "Base", listOf("poison", "water"), 1499, "Poison Jab", 2, "Brine", "Sludge Wave", 28, 48, atk = 92.0, def = 216.0, hp = 126, glRank = 44, ulRank = 380, mlRank = 490),
            PokemonMeta("Gligar", "gligar", "gligar", "Base", listOf("ground", "flying"), 1499, "Wing Attack", 2, "Aerial Ace", "Dig", 28, 44, atk = 108.0, def = 148.0, hp = 132, glRank = 45, ulRank = 360, mlRank = 490),
            PokemonMeta("Gliscor", "gliscor", "gliscor", "Base", listOf("ground", "flying"), 2492, "Wing Attack", 2, "Night Slash", "Earthquake", 28, 52, atk = 156.0, def = 182.0, hp = 152, glRank = 65, ulRank = 29, mlRank = 180),
            PokemonMeta("Poliwrath", "poliwrath", "poliwrath", "Base", listOf("water", "fighting"), 2495, "Counter", 2, "Icy Wind", "Scald", 30, 42, atk = 154.0, def = 152.0, hp = 172, glRank = 46, ulRank = 19, mlRank = 190),
            PokemonMeta("Pelipper", "pelipper", "pelipper", "Base", listOf("water", "flying"), 1499, "Wing Attack", 2, "Weather Ball", "Hurricane", 32, 52, atk = 118.0, def = 132.0, hp = 126, glRank = 47, ulRank = 280, mlRank = 460),
            PokemonMeta("Mantine", "mantine", "mantine", "Base", listOf("water", "flying"), 1499, "Wing Attack", 2, "Aerial Ace", "Ice Beam", 28, 38, atk = 98.0, def = 168.0, hp = 148, glRank = 49, ulRank = 240, mlRank = 440),
            PokemonMeta("Dewgong", "dewgong", "dewgong", "Base", listOf("water", "ice"), 1499, "Ice Shard", 3, "Icy Wind", "Drill Run", 30, 40, atk = 104.0, def = 138.0, hp = 162, glRank = 50, ulRank = 290, mlRank = 460),
            PokemonMeta("Walrein", "walrein", "walrein", "Base", listOf("ice", "water"), 2492, "Powder Snow", 2, "Icicle Spear", "Earthquake", 32, 52, atk = 152.0, def = 148.0, hp = 188, glRank = 68, ulRank = 33, mlRank = 170),
            PokemonMeta("Abomasnow", "abomasnow", "abomasnow", "Base", listOf("grass", "ice"), 2485, "Powder Snow", 2, "Weather Ball", "Energy Ball", 32, 44, atk = 148.0, def = 136.0, hp = 172, glRank = 52, ulRank = 37, mlRank = 280),
            PokemonMeta("Trevenant", "trevenant", "trevenant", "Base", listOf("ghost", "grass"), 2492, "Shadow Claw", 2, "Seed Bomb", "Shadow Ball", 32, 46, atk = 168.0, def = 134.0, hp = 166, glRank = 54, ulRank = 31, mlRank = 220),
            PokemonMeta("Goodra", "goodra", "goodra", "Base", listOf("dragon"), 2495, "Dragon Breath", 1, "Aqua Tail", "Thunder Punch", 28, 30, atk = 158.0, def = 188.0, hp = 168, glRank = 56, ulRank = 36, mlRank = 85),
            PokemonMeta("Guzzlord", "guzzlord", "guzzlord", "Base", listOf("dark", "dragon"), 2492, "Dragon Tail", 3, "Dragon Claw", "Crunch", 28, 34, atk = 142.0, def = 86.0, hp = 320, glRank = 60, ulRank = 21, mlRank = 160),
            PokemonMeta("Morpeko", "morpeko", "morpeko", "Full Belly", listOf("electric", "dark"), 1499, "Thunder Shock", 2, "Aura Wheel", "Psychic Fangs", 52, 24, atk = 142.0, def = 96.0, hp = 114, glRank = 15, ulRank = 340, mlRank = 480),
            PokemonMeta("Dusknoir", "dusknoir", "dusknoir", "Base", listOf("ghost"), 2480, "Astonish", 3, "Shadow Punch", "Dynamic Punch", 28, 42, atk = 146.0, def = 192.0, hp = 122, glRank = 55, ulRank = 40, mlRank = 290),
            PokemonMeta("Pangoro", "pangoro", "pangoro", "Base", listOf("fighting", "dark"), 2492, "Karate Chop", 2, "Night Slash", "Close Combat", 28, 48, atk = 168.0, def = 132.0, hp = 178, glRank = 59, ulRank = 27, mlRank = 180),
            PokemonMeta("Greedent", "greedent", "greedent", "Base", listOf("normal"), 2485, "Mud Shot", 2, "Body Slam", "Crunch", 26, 34, atk = 134.0, def = 138.0, hp = 216, glRank = 64, ulRank = 23, mlRank = 290),
            PokemonMeta("Dubwool", "dubwool", "dubwool", "Base", listOf("normal"), 2478, "Double Kick", 3, "Body Slam", "Payback", 26, 50, atk = 138.0, def = 168.0, hp = 154, glRank = 66, ulRank = 39, mlRank = 300),
            PokemonMeta("Ampharos", "ampharos", "ampharos", "Base", listOf("electric"), 2495, "Volt Switch", 4, "Brutal Swing", "Trailblaze", 32, 34, atk = 168.0, def = 142.0, hp = 172, glRank = 92, ulRank = 41, mlRank = 210),
            PokemonMeta("Tentacruel", "tentacruel", "tentacruel", "Base", listOf("water", "poison"), 2485, "Poison Jab", 2, "Scald", "Acid Spray", 40, 20, atk = 142.0, def = 178.0, hp = 164, glRank = 70, ulRank = 18, mlRank = 260),
            PokemonMeta("Cobalion", "cobalion", "cobalion", "Base", listOf("steel", "fighting"), 2492, "Double Kick", 3, "Sacred Sword", "Stone Edge", 38, 42, atk = 152.0, def = 182.0, hp = 169, glRank = 95, ulRank = 6, mlRank = 90),
            PokemonMeta("Virizion", "virizion", "virizion", "Base", listOf("grass", "fighting"), 2490, "Double Kick", 3, "Sacred Sword", "Leaf Blade", 38, 36, atk = 152.0, def = 182.0, hp = 169, glRank = 110, ulRank = 8, mlRank = 95),
            PokemonMeta("Venusaur", "venusaur", "venusaur", "Base", listOf("grass", "poison"), 2495, "Vine Whip", 2, "Frenzy Plant", "Sludge Bomb", 46, 40, atk = 158.0, def = 156.0, hp = 162, glRank = 72, ulRank = 44, mlRank = 220),
            PokemonMeta("Charizard", "charizard", "charizard", "Base", listOf("fire", "flying"), 2495, "Wing Attack", 2, "Blast Burn", "Dragon Claw", 50, 28, atk = 172.0, def = 142.0, hp = 158, glRank = 78, ulRank = 46, mlRank = 190),
            PokemonMeta("Blastoise", "blastoise", "blastoise", "Base", listOf("water"), 2466, "Rollout", 3, "Hydro Cannon", "Ice Beam", 44, 38, atk = 142.0, def = 176.0, hp = 162, glRank = 62, ulRank = 43, mlRank = 250),
            PokemonMeta("Greninja", "greninja", "greninja", "Base", listOf("water", "dark"), 2492, "Water Shuriken", 3, "Hydro Cannon", "Night Slash", 44, 28, atk = 178.0, def = 128.0, hp = 148, glRank = 74, ulRank = 35, mlRank = 210),
            PokemonMeta("Chesnaught", "chesnaught", "chesnaught", "Base", listOf("grass", "fighting"), 2492, "Vine Whip", 2, "Frenzy Plant", "Superpower", 46, 42, atk = 158.0, def = 166.0, hp = 168, glRank = 67, ulRank = 50, mlRank = 160),
            PokemonMeta("Typhlosion", "typhlosion", "typhlosion", "Base", listOf("fire"), 2495, "Incinerate", 5, "Blast Burn", "Thunder Punch", 50, 30, atk = 172.0, def = 142.0, hp = 158, glRank = 76, ulRank = 47, mlRank = 230),
            PokemonMeta("Decidueye", "decidueye", "decidueye", "Base", listOf("grass", "ghost"), 2492, "Astonish", 3, "Frenzy Plant", "Spirit Shackle", 46, 36, atk = 166.0, def = 146.0, hp = 158, glRank = 79, ulRank = 54, mlRank = 240),
            PokemonMeta("Incineroar", "incineroar", "incineroar", "Base", listOf("fire", "dark"), 2495, "Snarl", 3, "Blast Burn", "Darkest Lariat", 50, 44, atk = 168.0, def = 144.0, hp = 172, glRank = 88, ulRank = 52, mlRank = 170),
            PokemonMeta("Empoleon", "empoleon", "empoleon", "Base", listOf("water", "steel"), 2495, "Steel Wing", 2, "Hydro Cannon", "Drill Peck", 44, 34, atk = 166.0, def = 152.0, hp = 166, glRank = 71, ulRank = 49, mlRank = 180),
            PokemonMeta("Machamp", "machamp", "machamp", "Base", listOf("fighting"), 2495, "Karate Chop", 2, "Cross Chop", "Stone Edge", 28, 44, atk = 182.0, def = 132.0, hp = 172, glRank = 73, ulRank = 51, mlRank = 120),
            PokemonMeta("Scrafty", "scrafty", "scrafty", "Base", listOf("dark", "fighting"), 2283, "Counter", 2, "Foul Play", "Power-Up Punch", 36, 20, atk = 132.0, def = 182.0, hp = 142, glRank = 82, ulRank = 58, mlRank = 340),
            PokemonMeta("Obstagoon", "obstagoon", "obstagoon", "Base", listOf("dark", "normal"), 2492, "Counter", 2, "Night Slash", "Cross Chop", 28, 28, atk = 148.0, def = 164.0, hp = 174, glRank = 84, ulRank = 56, mlRank = 210),
            PokemonMeta("Diggersby", "diggersby", "diggersby", "Base", listOf("normal", "ground"), 1499, "Quick Attack", 1, "Scorching Sands", "Fire Punch", 40, 28, atk = 94.0, def = 132.0, hp = 178, glRank = 36, ulRank = 380, mlRank = 490),
            PokemonMeta("Jellicent", "jellicent", "jellicent", "Base", listOf("water", "ghost"), 2488, "Hex", 3, "Surf", "Shadow Ball", 34, 46, atk = 136.0, def = 158.0, hp = 184, glRank = 61, ulRank = 28, mlRank = 270),
            PokemonMeta("Cofagrigus", "cofagrigus", "cofagrigus", "Base", listOf("ghost"), 2480, "Shadow Claw", 2, "Shadow Ball", "Dark Pulse", 46, 38, atk = 134.0, def = 196.0, hp = 136, glRank = 86, ulRank = 60, mlRank = 310),
            PokemonMeta("Runerigus", "runerigus", "runerigus", "Base", listOf("ground", "ghost"), 2480, "Shadow Claw", 2, "Sand Tomb", "Shadow Ball", 24, 46, atk = 134.0, def = 196.0, hp = 136, glRank = 89, ulRank = 62, mlRank = 315),
            PokemonMeta("Ferrothorn", "ferrothorn", "ferrothorn", "Base", listOf("grass", "steel"), 2480, "Bullet Seed", 3, "Power Whip", "Thunder", 42, 44, atk = 132.0, def = 192.0, hp = 148, glRank = 51, ulRank = 64, mlRank = 290),
            PokemonMeta("Galvantula", "galvantula", "galvantula", "Base", listOf("bug", "electric"), 2494, "Volt Switch", 4, "Lunge", "Discharge", 32, 36, atk = 166.0, def = 128.0, hp = 146, glRank = 87, ulRank = 68, mlRank = 350),
            PokemonMeta("Araquanid", "araquanid", "araquanid", "Base", listOf("water", "bug"), 1499, "Bug Bite", 1, "Bubble Beam", "Bug Buzz", 22, 44, atk = 88.0, def = 168.0, hp = 138, glRank = 53, ulRank = 320, mlRank = 480),
            PokemonMeta("Golisopod", "golisopod", "golisopod", "Base", listOf("bug", "water"), 2495, "Shadow Claw", 2, "Liquidation", "X-Scissor", 36, 32, atk = 164.0, def = 178.0, hp = 152, glRank = 69, ulRank = 24, mlRank = 150),
            PokemonMeta("Altaria", "altaria", "altaria", "Base", listOf("dragon", "flying"), 1499, "Dragon Breath", 1, "Sky Attack", "Moonblast", 36, 48, atk = 98.0, def = 154.0, hp = 148, glRank = 63, ulRank = 310, mlRank = 470),
            PokemonMeta("Noctowl", "noctowl", "noctowl", "Base", listOf("normal", "flying"), 1499, "Wing Attack", 2, "Sky Attack", "Shadow Ball", 36, 44, atk = 102.0, def = 132.0, hp = 182, glRank = 90, ulRank = 340, mlRank = 480),
            PokemonMeta("Vigoroth", "vigoroth", "vigoroth", "Base", listOf("normal"), 1499, "Counter", 2, "Body Slam", "Rock Slide", 26, 36, atk = 114.0, def = 112.0, hp = 158, glRank = 77, ulRank = 360, mlRank = 490),
            PokemonMeta("Toxicroak", "toxicroak", "toxicroak", "Base", listOf("poison", "fighting"), 2488, "Mud Shot", 2, "Mud Bomb", "Shadow Ball", 32, 44, atk = 168.0, def = 122.0, hp = 166, glRank = 81, ulRank = 57, mlRank = 290),
            PokemonMeta("Nidoqueen", "nidoqueen", "nidoqueen", "Base", listOf("poison", "ground"), 2488, "Poison Jab", 2, "Poison Fang", "Earth Power", 24, 46, atk = 152.0, def = 156.0, hp = 176, glRank = 83, ulRank = 59, mlRank = 260),
            PokemonMeta("Steelix", "steelix", "steelix", "Base", listOf("steel", "ground"), 2485, "Dragon Tail", 3, "Breaking Swipe", "Earthquake", 24, 52, atk = 128.0, def = 216.0, hp = 152, glRank = 80, ulRank = 30, mlRank = 250),
            PokemonMeta("Tinkaton", "tinkaton", "tinkaton", "Base", listOf("fairy", "steel"), 2488, "Fairy Wind", 2, "Gigaton Hammer", "Bulldoze", 42, 36, atk = 138.0, def = 176.0, hp = 166, glRank = 40, ulRank = 32, mlRank = 260, chargedMove3 = "Brutal Swing"),
            PokemonMeta("Rillaboom", "rillaboom", "rillaboom", "Base", listOf("grass"), 2485, "Scratch", 1, "Drum Beating", "Earth Power", 36, 44, atk = 178.0, def = 138.0, hp = 172, glRank = 82, ulRank = 45, mlRank = 88, chargedMove3 = "Frenzy Plant"),
            PokemonMeta("Cetitan", "cetitan", "cetitan", "Base", listOf("ice"), 2495, "Powder Snow", 2, "Body Slam", "Avalanche", 26, 44, atk = 156.0, def = 118.0, hp = 232, glRank = 57, ulRank = 38, mlRank = 95),
            PokemonMeta("Bellibolt", "bellibolt", "bellibolt", "Base", listOf("electric"), 2492, "Sucker Punch", 2, "Discharge", "Zap Cannon", 34, 56, atk = 144.0, def = 146.0, hp = 198, glRank = 75, ulRank = 42, mlRank = 220)
        )

        // Dynamically loaded species & moves from PvPoke gamemaster.json (1,100+ Pokémon)
        val DYNAMIC_POKEMON_DATABASE = CopyOnWriteArrayList<PokemonMeta>()
        val DYNAMIC_MOVE_DATABASE = java.util.concurrent.ConcurrentHashMap<String, MoveStats>()
        val DYNAMIC_FAST_TURNS = java.util.concurrent.ConcurrentHashMap<String, Int>()
        val DYNAMIC_FAST_ENERGY = java.util.concurrent.ConcurrentHashMap<String, Int>()

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
            "Air Cutter" to 55,
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
            "Sky Attack" to 55,
            "Future Sight" to 65,
            "Surf" to 40,
            "Origin Pulse" to 60,
            "Hydro Pump" to 75,
            "Blizzard" to 75,
            "Close Combat" to 45,
            "Brave Bird" to 55,
            "Play Rough" to 60,
            "Wild Charge" to 45,
            "Shadow Ball" to 55,
            "Ominous Wind" to 45,
            "Dragon Claw" to 35,
            "Ancient Power" to 45,
            "Shadow Force" to 90,
            "Spacial Rend" to 50,
            "Aqua Tail" to 35,
            "Precipice Blades" to 60,
            "Fire Punch" to 40,
            "Psystrike" to 45,
            "Ice Beam" to 55,
            "Moonblast" to 60,
            "Dark Pulse" to 50,
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
            "Earth Power" to 55,
            "Outrage" to 60,
            "Meteor Mash" to 50,
            "Drill Run" to 45,
            "Rock Wrecker" to 50,
            "Breaking Swipe" to 35,
            "Avalanche" to 45,
            "High Horsepower" to 60,
            "Ice Punch" to 40,
            "Fusion Flare" to 45,
            "Overheat" to 55,
            "Fusion Bolt" to 45,
            "Glaciate" to 40,
            "Disarming Voice" to 45,
            "Hydro Cannon" to 40,
            "Weather Ball" to 35,
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
            "Rage Fist" to 35
        )

        fun getAllPokemonMeta(): List<PokemonMeta> {
            return if (DYNAMIC_POKEMON_DATABASE.isEmpty()) {
                POKEMON_META_DATABASE
            } else {
                POKEMON_META_DATABASE + DYNAMIC_POKEMON_DATABASE
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
                    .filter { it.baseSpecies.equals(base, ignoreCase = true) }
                    .distinctBy { it.name.lowercase() }
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
            val moveCount: List<Int>? = null
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

        fun formatMoveIdDisplay(moveId: String): String {
            if (moveId.isBlank()) return ""
            DYNAMIC_MOVE_ID_TO_NAME[moveId]?.let { return it }
            return moveId.lowercase().split("_").joinToString(" ") { w ->
                w.replaceFirstChar { c -> c.uppercase() }
            }
        }

        fun parseRankingsJsonStatic(leagueKey: String, jsonStr: String): Int {
            return try {
                val arr = JsonParser.parseString(jsonStr).asJsonArray
                val leagueMap = java.util.concurrent.ConcurrentHashMap<String, PokemonRankingEntry>()
                for (el in arr) {
                    if (!el.isJsonObject) continue
                    val obj = el.asJsonObject
                    val speciesId = obj.get("speciesId")?.asString ?: continue
                    val score = obj.get("score")?.asDouble ?: 80.0
                    val movesObj = obj.getAsJsonObject("moves")

                    val fastList = mutableListOf<MoveUsage>()
                    val rawFast = movesObj?.getAsJsonArray("fastMoves")
                    if (rawFast != null) {
                        for (fm in rawFast) {
                            if (!fm.isJsonObject) continue
                            val fmObj = fm.asJsonObject
                            val mId = fmObj.get("moveId")?.asString ?: continue
                            val uses = fmObj.get("uses")?.asInt
                            fastList.add(MoveUsage(mId, uses))
                        }
                    }
                    fastList.sortByDescending { it.uses ?: 0 }

                    val chargedList = mutableListOf<MoveUsage>()
                    val rawCharged = movesObj?.getAsJsonArray("chargedMoves")
                    if (rawCharged != null) {
                        for (cm in rawCharged) {
                            if (!cm.isJsonObject) continue
                            val cmObj = cm.asJsonObject
                            val mId = cmObj.get("moveId")?.asString ?: continue
                            val uses = cmObj.get("uses")?.asInt
                            chargedList.add(MoveUsage(mId, uses))
                        }
                    }
                    chargedList.sortByDescending { it.uses ?: 0 }

                    // Fallback to moveset array if moves object is empty
                    val movesetArr = obj.getAsJsonArray("moveset")
                    if (movesetArr != null && movesetArr.size() > 0) {
                        if (fastList.isEmpty()) {
                            fastList.add(MoveUsage(movesetArr.get(0).asString, 100))
                        }
                        if (chargedList.isEmpty() && movesetArr.size() > 1) {
                            for (i in 1 until movesetArr.size()) {
                                chargedList.add(MoveUsage(movesetArr.get(i).asString, 100 - i))
                            }
                        }
                    }

                    val moveCountList = mutableListOf<Int>()
                    val mcArr = obj.getAsJsonArray("moveCount")
                    if (mcArr != null) {
                        for (mc in mcArr) {
                            moveCountList.add(mc.asInt)
                        }
                    }

                    leagueMap[speciesId.lowercase()] = PokemonRankingEntry(
                        speciesId = speciesId,
                        score = score,
                        moves = RankingMoves(fastMoves = fastList, chargedMoves = chargedList),
                        moveCount = moveCountList.takeIf { it.isNotEmpty() }
                    )
                }
                LIVE_RANKINGS_MAP[leagueKey.uppercase()] = leagueMap
                leagueMap.size
            } catch (_: Exception) {
                0
            }
        }

        private fun applyRankingMovesForLeague(meta: PokemonMeta, league: String, isShadow: Boolean = false): PokemonMeta {
            val normLeague = when {
                league.contains("MEGA", ignoreCase = true) -> "MEGA MASTER LEAGUE"
                league.contains("GREAT", ignoreCase = true) -> "GREAT LEAGUE"
                league.contains("ULTRA", ignoreCase = true) -> "ULTRA LEAGUE"
                else -> "MASTER LEAGUE"
            }
            val map = LIVE_RANKINGS_MAP[normLeague] ?: return meta
            val baseKey = meta.speciesId.lowercase().removeSuffix("_shadow")
            val entry = if (isShadow || meta.name.startsWith("Shadow ", ignoreCase = true) || meta.speciesId.endsWith("_shadow", ignoreCase = true)) {
                map["${baseKey}_shadow"] ?: map[baseKey]
            } else {
                map[baseKey] ?: map["${baseKey}_shadow"]
            } ?: return meta

            val topFastId = entry.moves.fastMoves.firstOrNull()?.moveId
            val topC1Id = entry.moves.chargedMoves.getOrNull(0)?.moveId
            val topC2Id = entry.moves.chargedMoves.getOrNull(1)?.moveId
            val topC3Id = entry.moves.chargedMoves.getOrNull(2)?.moveId

            val fastName = topFastId?.let { formatMoveIdDisplay(it) }?.takeIf { it.isNotBlank() } ?: meta.defaultFastMove
            val fastTurns = DYNAMIC_FAST_TURNS[fastName.lowercase()] ?: FAST_MOVE_TURNS[fastName.lowercase()] ?: meta.fastTurns
            val c1Name = topC1Id?.let { formatMoveIdDisplay(it) }?.takeIf { it.isNotBlank() } ?: meta.chargedMove1
            val c2Name = topC2Id?.let { formatMoveIdDisplay(it) }?.takeIf { it.isNotBlank() } ?: meta.chargedMove2
            val c3Name = topC3Id?.let { formatMoveIdDisplay(it) } ?: meta.chargedMove3

            return meta.copy(
                defaultFastMove = fastName,
                fastTurns = fastTurns,
                chargedMove1 = c1Name,
                chargedMove2 = c2Name,
                chargedMove3 = c3Name
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

        /**
         * Resolves PvPoke recommended Fast Move, Charged Move 1, Charged Move 2, and default CP for a Pokémon name,
         * prioritizing live rankings JSON moves when available.
         */
        fun resolveRecommendedMovesForSpecies(rawName: String, league: String = "GREAT LEAGUE"): PokemonMeta? {
            val trimmed = rawName.trim()
            if (trimmed.isEmpty()) return null
            val isShadowInput = trimmed.startsWith("Shadow ", ignoreCase = true)
            val cleanNoShadow = trimmed.replace(Regex("^Shadow\\s+", RegexOption.IGNORE_CASE), "").trim()
            val allMeta = getAllPokemonMeta()

            val exact = allMeta.find {
                it.name.equals(trimmed, ignoreCase = true) ||
                    it.name.equals(cleanNoShadow, ignoreCase = true) ||
                    it.speciesId.equals(trimmed.replace(" ", "_"), ignoreCase = true)
            }
            if (exact != null) {
                val withRankMoves = applyRankingMovesForLeague(applyRecommendedMoves(exact), league, isShadowInput)
                return computeEffectiveCombatStats(withRankMoves, league)
            }

            val base = FormResolver.extractBaseSpecies(cleanNoShadow)
            val variants = FormResolver.getVariantsForSpecies(base, league)
            if (variants.isNotEmpty()) {
                val chosen = FormResolver.resolveBestDefaultVariant(variants.first(), trimmed, league)
                val withRankMoves = applyRankingMovesForLeague(applyRecommendedMoves(chosen), league, isShadowInput)
                return computeEffectiveCombatStats(withRankMoves, league)
            }

            val partial = allMeta.firstOrNull {
                it.name.lowercase().contains(cleanNoShadow.lowercase()) ||
                    cleanNoShadow.lowercase().contains(it.baseSpecies.lowercase())
            }
            return partial?.let {
                val withRankMoves = applyRankingMovesForLeague(applyRecommendedMoves(it), league, isShadowInput)
                computeEffectiveCombatStats(withRankMoves, league)
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
         * Automatically defaults to PvPoke standard IVs when customIvs is blank.
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
                val maxCp50 = floor(uAtk * kotlin.math.sqrt(uDef * uHp) * 0.8403 * 0.8403 / 10.0).toInt().coerceAtLeast(10)
                val targetCp = if (customCp != null && customCp in 100..(leagueCap + 100)) {
                    customCp
                } else {
                    min(maxCp50, leagueCap)
                }
                val cpm = kotlin.math.sqrt((targetCp * 10.0) / (uAtk * kotlin.math.sqrt(uDef * uHp))).coerceIn(0.094, 0.8453)
                return meta.copy(
                    defaultCp = targetCp,
                    atk = uAtk * cpm,
                    def = uDef * cpm,
                    hp = floor(uHp * cpm).toInt().coerceAtLeast(10),
                    isRawBaseStats = false
                )
            }

            // Static POKEMON_META_DATABASE entries have effective stats at meta.defaultCp
            val refCpm = when {
                meta.defaultCp > 2500 -> 0.8403
                meta.defaultCp > 1500 -> 0.7903
                else -> 0.7317
            }
            val refIvs = when {
                meta.defaultCp > 2500 -> Triple(15, 15, 15)
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
                    else -> min(2500, (meta.defaultCp * 1.65).roundToInt())
                }
                else -> if (meta.defaultCp > 2500) meta.defaultCp else (meta.defaultCp * 1.45).roundToInt().coerceAtMost(4720)
            }

            val targetCp = if (customCp != null && customCp in 100..(leagueCap + 100)) {
                customCp
            } else if (!isGreat && !isUltra) {
                (defaultLeagueCp * ivCpRatio).roundToInt().coerceAtLeast(100)
            } else {
                defaultLeagueCp
            }

            val effectiveRefCp = (meta.defaultCp.toDouble() * ivCpRatio).coerceAtLeast(100.0)
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
                val movesArr: JsonArray? = root.getAsJsonArray("moves")
                val fastMoveNames = HashMap<String, String>()
                if (movesArr != null) {
                    for (el in movesArr) {
                        val obj = el.asJsonObject
                        val moveId = obj.get("moveId")?.asString ?: continue
                        val name = obj.get("name")?.asString ?: moveId
                        val type = obj.get("type")?.asString?.lowercase() ?: "normal"
                        val power = obj.get("power")?.asInt ?: 50
                        val energyGain = obj.get("energyGain")?.asInt ?: 0
                        val energyCost = obj.get("energy")?.asInt ?: 50
                        val turns = ((obj.get("cooldown")?.asInt ?: 1000) / 500).coerceIn(1, 5)
                        DYNAMIC_MOVE_ID_TO_NAME[moveId] = name
                        if (energyGain > 0) {
                            fastMoveNames[moveId] = name
                            DYNAMIC_FAST_TURNS[name.lowercase()] = turns
                            DYNAMIC_FAST_TURNS[moveId.lowercase()] = turns
                            DYNAMIC_FAST_ENERGY[name.lowercase()] = energyGain
                            DYNAMIC_FAST_ENERGY[moveId.lowercase()] = energyGain
                        } else {
                            DYNAMIC_MOVE_DATABASE[name] = MoveStats(name, type, power, energyCost)
                        }
                    }
                }

                val pokemonArr: JsonArray? = root.getAsJsonArray("pokemon")
                if (pokemonArr != null) {
                    val existingIds = POKEMON_META_DATABASE.map { it.speciesId.lowercase() }.toSet()
                    val parsedList = mutableListOf<PokemonMeta>()
                    for (el in pokemonArr) {
                        val obj = el.asJsonObject
                        val speciesId = obj.get("speciesId")?.asString ?: continue
                        if (existingIds.contains(speciesId.lowercase())) continue

                        val rawSpeciesName = obj.get("speciesName")?.asString ?: continue
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

                        val typesArr = obj.getAsJsonArray("types")
                        val types = mutableListOf<String>()
                        if (typesArr != null) {
                            for (t in typesArr) {
                                val ts = t.asString
                                if (ts != "none") types.add(ts.lowercase())
                            }
                        }
                        if (types.isEmpty()) types.add("normal")

                        val baseStats = obj.getAsJsonObject("baseStats")
                        val atk = baseStats?.get("atk")?.asDouble ?: 180.0
                        val def = baseStats?.get("def")?.asDouble ?: 170.0
                        val hp = baseStats?.get("hp")?.asInt ?: 160

                        var defaultIvsGl = "1/15/15"
                        var defaultIvsUl = "1/15/15"
                        val defaultIvsObj = obj.getAsJsonObject("defaultIVs")
                        if (defaultIvsObj != null) {
                            val cp1500 = defaultIvsObj.getAsJsonArray("cp1500")
                            if (cp1500 != null && cp1500.size() >= 4) {
                                defaultIvsGl = "${cp1500.get(1).asInt}/${cp1500.get(2).asInt}/${cp1500.get(3).asInt}"
                            }
                            val cp2500 = defaultIvsObj.getAsJsonArray("cp2500")
                            if (cp2500 != null && cp2500.size() >= 4) {
                                defaultIvsUl = "${cp2500.get(1).asInt}/${cp2500.get(2).asInt}/${cp2500.get(3).asInt}"
                            }
                        }

                        val rankEntry = LIVE_RANKINGS_MAP["GREAT LEAGUE"]?.get(speciesId.lowercase())
                            ?: LIVE_RANKINGS_MAP["ULTRA LEAGUE"]?.get(speciesId.lowercase())
                            ?: LIVE_RANKINGS_MAP["MASTER LEAGUE"]?.get(speciesId.lowercase())
                            ?: LIVE_RANKINGS_MAP["MEGA MASTER LEAGUE"]?.get(speciesId.lowercase())

                        val fastMovesArr = obj.getAsJsonArray("fastMoves")
                        val firstFastId = rankEntry?.moves?.fastMoves?.firstOrNull()?.moveId
                            ?: if (fastMovesArr != null && fastMovesArr.size() > 0) fastMovesArr.get(0).asString else "TACKLE"
                        val fastMoveName = fastMoveNames[firstFastId]
                            ?: formatMoveIdDisplay(firstFastId)
                        val fastTurns = DYNAMIC_FAST_TURNS[fastMoveName.lowercase()]
                            ?: FAST_MOVE_TURNS[fastMoveName.lowercase()] ?: 2

                        val chargedArr = obj.getAsJsonArray("chargedMoves")
                        val eliteArr = obj.getAsJsonArray("eliteMoves")
                        val orderedChargedIds = mutableListOf<String>()
                        rankEntry?.moves?.chargedMoves?.forEach { cm ->
                            if (cm.moveId.isNotBlank() && !orderedChargedIds.contains(cm.moveId)) {
                                orderedChargedIds.add(cm.moveId)
                            }
                        }
                        if (eliteArr != null) {
                            for (em in eliteArr) {
                                val emId = em.asString
                                if (!fastMoveNames.containsKey(emId) && !orderedChargedIds.contains(emId)) {
                                    orderedChargedIds.add(emId)
                                }
                            }
                        }
                        if (chargedArr != null) {
                            for (cm in chargedArr) {
                                val cmId = cm.asString
                                if (!orderedChargedIds.contains(cmId)) {
                                    orderedChargedIds.add(cmId)
                                }
                            }
                        }

                        val c1Id = orderedChargedIds.getOrNull(0) ?: "BODY_SLAM"
                        val c2Id = orderedChargedIds.getOrNull(1) ?: c1Id
                        val c3Id = orderedChargedIds.getOrNull(2) ?: ""
                        val c1Name = formatMoveIdDisplay(c1Id)
                        val c2Name = formatMoveIdDisplay(c2Id)
                        val c3Name = if (c3Id.isNotBlank()) formatMoveIdDisplay(c3Id) else ""

                        val baseMeta = PokemonMeta(
                            name = speciesName,
                            speciesId = speciesId,
                            baseSpecies = baseSpecies,
                            formLabel = formLabel,
                            types = types,
                            defaultCp = 2500,
                            defaultFastMove = fastMoveName,
                            fastTurns = fastTurns,
                            chargedMove1 = c1Name,
                            chargedMove2 = c2Name,
                            atk = atk,
                            def = def,
                            hp = hp,
                            chargedMove3 = c3Name,
                            isRawBaseStats = true,
                            defaultIvsGl = defaultIvsGl,
                            defaultIvsUl = defaultIvsUl
                        )
                        parsedList.add(applyRecommendedMoves(baseMeta))
                    }
                    DYNAMIC_POKEMON_DATABASE.clear()
                    DYNAMIC_POKEMON_DATABASE.addAll(parsedList)
                }
            } catch (_: Exception) {}
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

    private var currentLayoutMode = "option1"
    private var oppCountMode = "my_fasts"
    private var overlayScalePct = 78
    private var cachedScreenBitmap: Bitmap? = null
    private val captureLock = Any()

    data class TeamMember(
        val name: String,
        val cp: Int,
        val fastMove: String,
        val chargedMove1: String,
        val chargedMove2: String,
        val ivs: String? = null
    )
    data class TeamPreset(val id: String, val name: String, val league: String, val pokemon: List<TeamMember>, var isSelected: Boolean = false)

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        mediaProjectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        prefs = getSharedPreferences("gbl_overlay_prefs", Context.MODE_PRIVATE)
        oppCountMode = prefs.getString("opp_count_mode", "my_fasts") ?: "my_fasts"
        overlayScalePct = prefs.getInt("overlay_scale_pct", 78).coerceIn(50, 100)

        val metrics = resources.displayMetrics
        screenWidth = metrics.widthPixels
        screenHeight = metrics.heightPixels
        screenDensity = metrics.densityDpi

        imageReaderThread = HandlerThread("GBLImageReaderThread").apply { start() }
        imageReaderHandler = Handler(imageReaderThread!!.looper)

        createNotificationChannel()
        setupDefaultPresetsIfNeeded()
        loadOrFetchGamemasterInBackground()
        setupOverlayView()
        startBattleOcrLoop()
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
                            body
                        } else null
                    }
                }
                if (!jsonStr.isNullOrBlank()) {
                    parseGamemasterJson(jsonStr)
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
                        layoutParams.x = max(0, min(initialX + deltaX, max(0, screenWidth - layoutParams.width)))
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

    private fun applyOverlayScale(scalePct: Int) {
        overlayScalePct = scalePct.coerceIn(50, 100)
        if (!::layoutParams.isInitialized) return
        val targetWidth = (screenWidth * (overlayScalePct / 100f)).toInt()
        layoutParams.width = targetWidth
        layoutParams.x = max(0, min(layoutParams.x, max(0, screenWidth - targetWidth)))
        Handler(Looper.getMainLooper()).post {
            try {
                if (overlayView != null) {
                    windowManager.updateViewLayout(overlayView, layoutParams)
                    overlayView?.evaluateJavascript("if (window.setOverlayScalePct) setOverlayScalePct($overlayScalePct);", null)
                }
            } catch (_: Exception) {}
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        val action = intent?.action ?: ACTION_START_OVERLAY

        when (action) {
            ACTION_START_OVERLAY -> {
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
            ACTION_UPDATE_SETTINGS -> {
                if (intent?.hasExtra(EXTRA_OPP_COUNT_MODE) == true) {
                    val newMode = intent.getStringExtra(EXTRA_OPP_COUNT_MODE) ?: "my_fasts"
                    oppCountMode = if (newMode == "opp_fasts") "opp_fasts" else "my_fasts"
                } else {
                    oppCountMode = prefs.getString("opp_count_mode", oppCountMode) ?: oppCountMode
                }
                val updatedScalePct = intent?.getIntExtra(
                    EXTRA_OVERLAY_SCALE_PCT,
                    prefs.getInt("overlay_scale_pct", overlayScalePct)
                ) ?: prefs.getInt("overlay_scale_pct", overlayScalePct)
                applyOverlayScale(updatedScalePct)
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
        val screen = captureCleanScreenBitmap() ?: return
        if (screen.isRecycled) return

        val w = screen.width
        val h = screen.height

        // CRITICAL FIX: Mask out our own floating overlay window on the captured frame
        // so ML Kit can NEVER read our own overlay header ("VS ZACIAN (CROWNED)") or matrix rows!
        try {
            val view = overlayView
            if (view != null) {
                val ox = layoutParams.x.coerceIn(0, w - 1)
                val oy = layoutParams.y.coerceIn(0, h - 1)
                val ow = (if (view.width > 0) view.width else layoutParams.width).coerceAtLeast(1)
                val oh = (if (view.height > 0) view.height else (180 * resources.displayMetrics.density).toInt()).coerceAtLeast(1)
                val screenCanvas = Canvas(screen)
                val maskPaint = Paint().apply { color = Color.BLACK; style = Paint.Style.FILL }
                screenCanvas.drawRect(
                    ox.toFloat(),
                    oy.toFloat(),
                    (ox + ow).coerceAtMost(w).toFloat(),
                    (oy + oh).coerceAtMost(h).toFloat(),
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

        if (visionText == null) return

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

    private fun isOverlayHudSelfText(lower: String): Boolean {
        return lower.contains("waiting") ||
                lower.contains("scanning") ||
                lower.contains("zero-sneak") ||
                lower.contains("awaiting") ||
                lower.contains("shadow:") ||
                lower.contains("form:") ||
                lower.contains("reset opp") ||
                lower.contains("dmg") ||
                lower.contains("throw on") ||
                lower.contains("1 hz") ||
                lower.contains("bench:") ||
                lower.contains("opt 1") ||
                lower.contains("opt 2") ||
                lower.contains("⚔") ||
                lower.contains("→") ||
                Regex("\\(\\d+t\\b").containsMatchIn(lower)
    }

    private fun upsertDetectedOpponentBySpecies(fullName: String, baseSpecies: String) {
        val existingIdx = detectedOpponents.indexOfFirst {
            FormResolver.extractBaseSpecies(it).equals(baseSpecies, ignoreCase = true)
        }
        if (existingIdx >= 0) {
            detectedOpponents.removeAt(existingIdx)
        }
        detectedOpponents.add(0, fullName)
        while (detectedOpponents.size > 3) {
            detectedOpponents.removeAt(detectedOpponents.lastIndex)
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
                val resolved = if (manualFormName != null) {
                    getPokemonMeta(manualFormName)
                } else {
                    FormResolver.resolveBestDefaultVariant(candidate, text, activeLeague)
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
                    !cleanWord.contains("super", ignoreCase = true) &&
                    !cleanWord.contains("effective", ignoreCase = true) &&
                    !cleanWord.contains("attack", ignoreCase = true) &&
                    !cleanWord.contains("defense", ignoreCase = true) &&
                    !cleanWord.contains("shield", ignoreCase = true)
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

            // Trigger immediately when opponent spawns or switches/faints into a different species
            if (isWaitingForOpponent || !newBaseSpecies.equals(activeOpponentSpecies, ignoreCase = true)) {
                isWaitingForOpponent = false
                activeOpponentSpecies = newBaseSpecies
                availableOpponentForms = FormResolver.getVariantsForSpecies(newBaseSpecies, activeLeague)
                currentFormIndex = availableOpponentForms.indexOfFirst { it.name == matched.name }.coerceAtLeast(0)
                activeOpponentName = matched.name

                isOpponentShadow = when {
                    manualShadowOverrides.containsKey(newBaseSpecies) -> manualShadowOverrides[newBaseSpecies]!!
                    rawMatchedLine.contains("shadow", ignoreCase = true) -> {
                        manualShadowOverrides[newBaseSpecies] = true
                        true
                    }
                    else -> false
                }

                // 1-per-species deduplication on opponent team
                upsertDetectedOpponentBySpecies(matched.name, newBaseSpecies)

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
    private fun handlePlayerSwitchLines(playerTopLines: List<Text.Line>, playerMoveLines: List<Text.Line>) {
        val preset = currentPreset ?: return

        // 1. Check Top-Left Player Nameplate lines first (strictly against user's 3 preset team members)
        for (line in playerTopLines) {
            val lineText = line.text.trim()
            if (lineText.length < 3) continue
            val lowerLine = lineText.lowercase()
            if (isOverlayHudSelfText(lowerLine)) continue

            val normalizedLine = normalizeOcrToken(lineText)

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
                        .replace(Regex("\\b\\d+\\b"), " ")
                        .replace(Regex("[^a-zA-Z0-9\\s]"), " ")
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
                if (!bestSlot.name.equals(activeUserPokemonName, ignoreCase = true)) {
                    activeUserPokemonName = bestSlot.name
                    recalculateAndPushBattleData()
                    Handler(Looper.getMainLooper()).post {
                        Toast.makeText(this, "🔄 Player Switch: ${bestSlot.name}", Toast.LENGTH_SHORT).show()
                    }
                }
            }
        }
    }

    /**
     * ACTION: RESET OPPONENT (Start New Battle)
     * Clears opponent team & manual form/shadow overrides while keeping 1 Hz OCR continuously active
     */
    fun startNewBattle() {
        detectedOpponents.clear()
        manualFormOverrides.clear()
        manualShadowOverrides.clear()
        isWaitingForOpponent = true
        activeOpponentName = "Waiting..."
        activeOpponentSpecies = ""
        isOpponentShadow = false
        availableOpponentForms = emptyList()
        currentFormIndex = 0
        startBattleOcrLoop()
        recalculateAndPushBattleData()
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(this, "↺ Opponent Reset — OCR Active", Toast.LENGTH_SHORT).show()
        }
    }

    fun toggleShadowModifier() {
        isOpponentShadow = !isOpponentShadow
        if (activeOpponentSpecies.isNotBlank()) {
            manualShadowOverrides[activeOpponentSpecies.lowercase()] = isOpponentShadow
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

        // Update existing species entry in-place (only 1 per species allowed on a team)
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
        isOpponentShadow = manualShadowOverrides[newBaseSpecies] ?: false
        upsertDetectedOpponentBySpecies(matched.name, newBaseSpecies)
        recalculateAndPushBattleData()
        Handler(Looper.getMainLooper()).post {
            Toast.makeText(this, "⚔️ Opponent Swap: ${matched.name}", Toast.LENGTH_SHORT).show()
        }
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
        // Strip CP labels and 2+ digit numbers EVEN when concatenated without a space (e.g. "KyuremCP4605" or "Kyurem4605"),
        // while preserving single digits inside words (e.g. "Cl0dsire", "D1alga") for normalizeOcrToken!
        val cleaned = rawText
            .replace(Regex("(?i)cp\\s*\\d+"), " ")
            .replace(Regex("(?i)\\b(?:shadow|purified|forme|form|cp|iv|lv|level|vs)\\b"), " ")
            .replace(Regex("\\d{2,}"), " ")
            .replace(Regex("\\b\\d+\\b"), " ")
            .replace(Regex("[^a-zA-Z0-9\\s-]"), " ")
            .trim()

        if (cleaned.length < 3) return null

        val allMeta = getAllPokemonMeta()
        val sortedByLenDesc = allMeta.sortedByDescending { it.baseSpecies.length }
        val lowerCleaned = cleaned.lowercase()
        val normCleanedVariants = listOf(
            normalizeOcrToken(cleaned, oneAsL = false, rnAsM = false, vAsY = false),
            normalizeOcrToken(cleaned, oneAsL = true, rnAsM = false, vAsY = false),
            normalizeOcrToken(cleaned, oneAsL = false, rnAsM = true, vAsY = false),
            normalizeOcrToken(cleaned, oneAsL = false, rnAsM = true, vAsY = true),
            normalizeOcrToken(cleaned, oneAsL = false, rnAsM = false, vAsY = true)
        ).distinct()

        // 1. Direct or normalized substring match against species base names (longest species name first)
        for (meta in sortedByLenDesc) {
            val baseNorm = normalizeOcrToken(meta.baseSpecies)
            if (baseNorm.length >= 4 && (lowerCleaned.contains(meta.baseSpecies) || normCleanedVariants.any { it.contains(baseNorm) })) {
                return meta
            }
        }

        // 2. Token-level exact & normalized OCR confusable match (including rn->m and v->y for "Kyurern"/"Kvurem")
        val tokens = cleaned.split("\\s+".toRegex()).filter { it.length >= 3 }
        for (token in tokens) {
            val tokenNorms = listOf(
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = true, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = true),
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = true)
            ).filter { it.length >= 3 }.distinct()
            if (tokenNorms.isEmpty()) continue

            val exactOrNorm = sortedByLenDesc.find { meta ->
                val target = normalizeOcrToken(meta.baseSpecies)
                meta.baseSpecies.equals(token, ignoreCase = true) || tokenNorms.any { it == target }
            }
            if (exactOrNorm != null) return exactOrNorm
        }

        // 3. Prefix match for partially clipped names (e.g. "Kyure", "Feraliga", "Giratin", "Zacia")
        for (token in tokens) {
            val tokenNorms = listOf(
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = true)
            ).filter { it.length >= 5 }.distinct()
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
            val tokenNorms = listOf(
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = true, rnAsM = false, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = false),
                normalizeOcrToken(token, oneAsL = false, rnAsM = true, vAsY = true),
                normalizeOcrToken(token, oneAsL = false, rnAsM = false, vAsY = true)
            ).filter { it.length >= 4 }.distinct()
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
                        val dist = levenshteinDistance(sub, target)
                        if (dist <= 1 && dist < bestDistance) {
                            bestDistance = dist
                            bestMatch = meta
                        }
                    }
                }
            }
        }

        return bestMatch
    }

    private fun getPokemonMeta(name: String): PokemonMeta {
        val allMeta = getAllPokemonMeta()
        val exact = allMeta.find { it.name.equals(name, ignoreCase = true) }
        val found = if (exact != null) {
            exact
        } else {
            val base = FormResolver.extractBaseSpecies(name)
            val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
            val variants = FormResolver.getVariantsForSpecies(base, activeLeague)
            variants.firstOrNull() ?: PokemonMeta(
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
        return applyRecommendedMoves(found)
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
        "Aura Wheel" to "AuW"
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
        val power = fastMovePowerMap[key] ?: (fastTurns * 3).coerceAtLeast(3)
        val moveType = fastMoveTypeMap[key] ?: attacker.types.firstOrNull() ?: "normal"
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
        val moveStats = MOVE_DATABASE[moveName]
            ?: DYNAMIC_MOVE_DATABASE[moveName]
            ?: MoveStats(moveName, attacker.types.firstOrNull() ?: "normal", 80)
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

        val teamNames = listOf(p1Name, p2Name, p3Name)
        val activeUserSlotIndex = teamNames.indexOfFirst { it.equals(activePlayerName, ignoreCase = true) }.let { if (it >= 0) it else 0 }

        val teamData = listOf(
            mapOf("initial" to (p1Name.firstOrNull()?.uppercase() ?: "P1"), "code" to abbrPokemon3(p1Name), "name" to p1Name),
            mapOf("initial" to (p2Name.firstOrNull()?.uppercase() ?: "P2"), "code" to abbrPokemon3(p2Name), "name" to p2Name),
            mapOf("initial" to (p3Name.firstOrNull()?.uppercase() ?: "P3"), "code" to abbrPokemon3(p3Name), "name" to p3Name)
        )

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

        val activeLeague = currentPreset?.league ?: "MASTER LEAGUE"
        val oppMeta = computeEffectiveCombatStats(getPokemonMeta(activeOpponentName), activeLeague)
        val userMeta = computeEffectiveCombatStats(
            getPokemonMeta(activePlayerName),
            activeLeague,
            activeSlot?.cp,
            activeSlot?.ivs
        )
        val isUserShadow = activePlayerName.contains("Shadow", ignoreCase = true)

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

        // Ensure 1-per-species deduplication in displayList
        val displayList = mutableListOf<String>()
        val seenSpecies = mutableSetOf<String>()
        for (opp in listOf(activeOpponentName) + detectedOpponents) {
            val base = FormResolver.extractBaseSpecies(opp).lowercase()
            if (seenSpecies.add(base)) {
                displayList.add(opp)
            }
            if (displayList.size >= 3) break
        }

        val scannedOpponentsData = displayList.mapIndexed { idx, opp ->
            val meta = computeEffectiveCombatStats(getPokemonMeta(opp), activeLeague)
            val baseKey = meta.baseSpecies.lowercase()
            val isThisOppShadow = manualShadowOverrides[baseKey] ?: (if (idx == 0) isOpponentShadow else false)
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
            val matrix = calculate3v3Matrix(meta, isThisOppShadow, p1, p2, p3)
            mapOf(
                "name" to meta.name,
                "code" to abbrPokemon3(meta.name, isThisOppShadow),
                "turns" to meta.fastTurns,
                "c1" to "${abbrMove5(meta.chargedMove1)} ($oppC1Pct%)",
                "c2" to "${abbrMove5(meta.chargedMove2)} ($oppC2Pct%)",
                "c3" to "${abbrMove5(thirdMoveName)} ($oppC3Pct%)",
                "matrix" to matrix
            )
        }

        if (availableOpponentForms.isEmpty()) {
            availableOpponentForms = FormResolver.getVariantsForSpecies(oppMeta.baseSpecies, activeLeague)
        }

        // CMP Tie Evaluation: True if player's active Pokémon wins CMP (higher or equal Attack)
        val winsCmp = userMeta.atk >= oppMeta.atk

        // Active opponent's 3 charged moves
        val activeOppThirdMove = oppMeta.chargedMove3.takeIf { it.isNotBlank() }
            ?: COMMON_THIRD_CHARGED_MOVE[oppMeta.name]
            ?: COMMON_THIRD_CHARGED_MOVE.entries.firstOrNull { it.key.equals(oppMeta.name, ignoreCase = true) }?.value
            ?: "Outrage"
        val oppChargedMoveNames = listOf(oppMeta.chargedMove1, oppMeta.chargedMove2, activeOppThirdMove)
            .filter { it.isNotBlank() }
            .distinct()

        val myChargedMoveNames = listOf(userMove1Name, userMove2Name).filter { it.isNotBlank() }.distinct()

        // Compute shared 1st-throw maximum turn horizon across all 5 moves (Opponent's 3 + Player's 2)
        val oppFirstTurns = oppChargedMoveNames.map { moveName ->
            val mStats = MOVE_DATABASE[moveName]
                ?: DYNAMIC_MOVE_DATABASE[moveName]
                ?: MoveStats(moveName, oppMeta.types.firstOrNull() ?: "normal", 80, 50)
            val mEnergy = MOVE_ENERGY_COST[moveName] ?: mStats.energyCost
            val fasts = kotlin.math.ceil(mEnergy.toDouble() / oppFastEnergy.toDouble()).toInt().coerceAtLeast(1)
            fasts * oppFastTurns
        }
        val myFirstTurns = myChargedMoveNames.map { mName ->
            val mStats = MOVE_DATABASE[mName]
                ?: DYNAMIC_MOVE_DATABASE[mName]
                ?: MoveStats(mName, userMeta.types.firstOrNull() ?: "normal", 80, 50)
            val mEnergy = MOVE_ENERGY_COST[mName] ?: mStats.energyCost
            val fasts = kotlin.math.ceil(mEnergy.toDouble() / userFastEnergy.toDouble()).toInt().coerceAtLeast(1)
            fasts * userFastTurns
        }
        val maxHorizonTurns = ((oppFirstTurns + myFirstTurns).maxOrNull() ?: 12).coerceAtLeast(4)

        // Precompute opponent ready turns across up to 3 cycles for CMP tie evaluation
        val oppReadyTurnsSet = mutableSetOf<Int>()
        for (moveName in oppChargedMoveNames) {
            val mStats = MOVE_DATABASE[moveName]
                ?: DYNAMIC_MOVE_DATABASE[moveName]
                ?: MoveStats(moveName, oppMeta.types.firstOrNull() ?: "normal", 80, 50)
            val mEnergy = MOVE_ENERGY_COST[moveName] ?: mStats.energyCost
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
            val mStats = MOVE_DATABASE[moveName]
                ?: DYNAMIC_MOVE_DATABASE[moveName]
                ?: MoveStats(moveName, oppMeta.types.firstOrNull() ?: "normal", 80, 50)
            val mEnergy = MOVE_ENERGY_COST[moveName] ?: mStats.energyCost
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
                val tMeta = computeEffectiveCombatStats(
                    getPokemonMeta(tName),
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
            val mStats = MOVE_DATABASE[mName]
                ?: DYNAMIC_MOVE_DATABASE[mName]
                ?: MoveStats(mName, userMeta.types.firstOrNull() ?: "normal", 80, 50)
            val mEnergy = MOVE_ENERGY_COST[mName] ?: mStats.energyCost
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
                    val oppMetaSlot = computeEffectiveCombatStats(getPokemonMeta(oppNameSlot), activeLeague)
                    val baseKeySlot = oppMetaSlot.baseSpecies.lowercase()
                    val isSlotShadow = manualShadowOverrides[baseKeySlot] ?: (if (slotIdx == 0) isOpponentShadow else false)
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
                        "isActive" to (slotIdx == 0)
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
            "maxHorizonTurns" to maxHorizonTurns,
            "isOpponentShadow" to isOpponentShadow,
            "currentFormLabel" to oppMeta.formLabel,
            "availableForms" to availableOpponentForms.map { it.formLabel },
            "userActivePokemon" to activePlayerName,
            "activeUserSlotIndex" to activeUserSlotIndex,
            "userFastMoveName" to userFastMoveName,
            "userFastMoveTurns" to userFastTurns,
            "winsCmp" to winsCmp,
            "myMove1Summary" to myMove1Summary,
            "myMove2Summary" to myMove2Summary,
            "throwAlignmentText" to throwAlignmentText,
            "throwHorizonText" to throwHorizonText,
            "team" to teamData,
            "scannedOpponents" to scannedOpponentsData,
            "oppMoveTimingRows" to oppMoveTimingRows,
            "myMoveTimingRows" to myMoveTimingRows
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
            val userMeta = computeEffectiveCombatStats(
                getPokemonMeta(userName),
                activeLeague,
                slot?.cp,
                slot?.ivs
            )
            val isUserShad = userName.contains("Shadow", ignoreCase = true)

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
            val userFastType = userMeta.types.firstOrNull() ?: "normal"
            val oppFastType = oppMeta.types.firstOrNull() ?: "normal"
            val userFastEff = getTypeEffectiveness(userFastType, oppMeta.types)
            val oppFastEff = getTypeEffectiveness(oppFastType, userMeta.types)

            val rating0s = (500.0 + (bestUserCharged - bestOppCharged) * 3.4 + (userFastEff - oppFastEff) * 95.0).roundToInt()
            val rating1s = (500.0 + ((bestUserCharged + minUserCharged) * 0.5 - (bestOppCharged + minOppCharged) * 0.5) * 2.8 + (userFastEff - oppFastEff) * 120.0).roundToInt()
            val rating2s = (500.0 + (minUserCharged - minOppCharged) * 2.0 + (userFastEff - oppFastEff) * 155.0).roundToInt()

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
        fun swapActiveOpponent(pokemonName: String) {
            Handler(Looper.getMainLooper()).post {
                this@OverlayService.swapActiveOpponent(pokemonName)
            }
        }

        @JavascriptInterface
        fun updateContentHeight(heightDp: Int) {
            if (currentLayoutMode != "option1") return
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
                loadInitialDataIntoOverlay()
            }
        }
    }
}
