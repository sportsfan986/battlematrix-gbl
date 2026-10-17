# BattleMatrix GBL - Real-Time 3x3 Matchup Matrix, Damage Calculations & Turn Pacing HUD for Pokémon GO PVP (v1.20)

[![Live Web Simulator](https://img.shields.io/badge/🌐%20Live%20Web%20Simulator-Try%20in%20Browser-0284c7?style=for-the-badge&logo=googlechrome&logoColor=white)](https://sportsfan986.github.io/battlematrix-gbl/)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20the%20Project-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sportsfan986)
[![Latest Release](https://img.shields.io/github/v/release/sportsfan986/battlematrix-gbl?style=for-the-badge&color=10b981&label=Latest%20APK)](https://github.com/sportsfan986/battlematrix-gbl/releases)

---

![BattleMatrix GBL Full Color Real Gameplay HUD Overlay — Dialga Origin vs Mewtwo](./docs/screenshots/featured_real_gameplay.png)

**BattleMatrix GBL** is a standalone Android application and client-side web battle simulator for **Pokémon GO Battle League (GBL)**. Built with Kotlin, WindowManager `TYPE_APPLICATION_OVERLAY`, in-memory `MediaProjection` frame analysis (zero disk writes), PvPoke `gamemaster.json` + official league rankings JSON synchronization, offline Google ML Kit Text Recognition, and an interactive React web dashboard.

---

## 📸 Real Android Application Screenshots & In-Game HUD

| Main App & Presets Manager | Master League HUD (Kyogre vs Zacian) | Ultra League HUD (Mimikyu vs Ampharos) |
| :---: | :---: | :---: |
| ![Main App & Presets](./docs/screenshots/real_app_main_menu.png) | ![Master League HUD](./docs/screenshots/real_hud_master_league.png) | ![Ultra League HUD](./docs/screenshots/real_hud_ultra_league.png) |

- **Main App & Presets Manager (Left)**: Floating overlay controller, PvPoke + Rankings sync status, move count basis toggles, `50%–100%` overlay scaler, and drag-and-drop persistent league team presets.
- **Master League In-Game HUD (Center)**: Real-time damage calculations for Kyogre vs Zacian (Crowned), shield scenarios, move energy cycles, and CMP tie alerts.
- **Ultra League In-Game HUD (Right)**: Turn pacing, safe move timing windows, catch point recommendations, and team switch damage previews.

---

## 🎮 Try the Live Web Simulator (No Install Needed)

Experience **BattleMatrix GBL** instantly in your web browser — completely free, client-side, and consuming **0 personal API tokens**:

👉 **[Launch Live Web Simulator — https://sportsfan986.github.io/battlematrix-gbl/](https://sportsfan986.github.io/battlematrix-gbl/)**

- **Explore 3v3 Matchup Matrices**: Compare damage percentages, 0S / 1S / 2S shield scenarios, and CMP tie outcomes for any team.
- **Custom Team Builder with Live Autocomplete**: Pre-populated with the **PvPoke Top 3 rated Pokémon** for Great League, Ultra League, Master League, and Mega Master League. Typing a base Pokémon name automatically surfaces all Base, Shadow, Regional (Alolan/Galarian/Hisuian/Paldean), and Alternate/Mega forms in a live pop-down menu.
- **Official PvPoke Rankings Move Engine**: Synchronizes `gamemaster.json` alongside official PvPoke league rankings JSONs (`1500`, `2500`, `10000`, and `mega/10000`) to automatically assign meta-recommended Fast and Charged moves by usage.
- **Drag-and-Drop Team Presets**: Rearrange your saved teams in any order via drag handles or quick reorder controls.

---

## 🖼️ HUD & Feature Overview

![Floating HUD Overlay Diagram](./docs/images/hud_overlay_preview.svg)

---

## ☕ Support Continued Development

If **BattleMatrix GBL** helps you count fast moves, win CMP ties, and climb Elo in GO Battle League, consider supporting continued updates and new feature releases:

👉 **[Buy Me a Coffee — https://buymeacoffee.com/sportsfan986](https://buymeacoffee.com/sportsfan986)**

---

## 📥 Download & Install Native Android APK (v1.20)

1. Visit the **[Official GitHub Releases Page](https://github.com/sportsfan986/battlematrix-gbl/releases)**.
2. Download **`battlematrix-gbl-v1.20.apk`** (or `app-release.apk`) directly to your Android device.
3. Tap the downloaded APK file to install (grant *"Install unknown apps"* permission if prompted).
4. Launch **BattleMatrix GBL**:
   - Select, reorder, or customize your **GBL Team Presets**, set **Opponent Move Count Basis** (`My Fasts` vs. `Their Fasts`), and adjust **Overlay Size** (`50%–100%` screen width slider).
   - Grant **"Display over other apps"** (Floating Window permission) and **Screen Capture** permission (used strictly in-memory for 1 Hz ML Kit OCR).
   - Tap **"Start Battle Overlay"** and launch Pokémon GO!

---

## ✨ Key Features in v1.20

- **Team Builder Live Pokémon Autocomplete with Form Expansion**:
  - Live pop-down autocomplete menu as you type in the Team Builder UI. Typing any base Pokémon species (e.g. `Giratina`, `Raichu`, `Ninetales`, `Zygarde`, `Kyurem`) displays all matching Base, Shadow, Regional, Alternate, and Mega/Primal variants with their types, league ranking scores, and recommended movesets.
- **PvPoke Rankings JSON Synchronization & Mega Master League**:
  - Downloads and caches official PvPoke rankings JSON endpoints (`rankings-1500.json`, `rankings-2500.json`, `rankings-10000.json`, and `mega/overall/rankings-10000.json`) in addition to `gamemaster.json` to prioritize true meta-recommended movesets (`moves.fastMoves` and `moves.chargedMoves`) and popularity scores.
- **Drag-and-Drop Team Preset Reordering**:
  - Drag to rearrange the order of your saved team presets (with persistent order across sessions).
- **Persistent User Teams & Settings Across App Updates**:
  - Programmed teams, active team selection, move count preferences, and overlay scale persist in a version-independent local store (`gbl_user_teams_persistent`). Updates never overwrite your custom teams!
- **CP-Scaled Stats & Custom IV Calculation**:
  - Calculates true Attack, Defense, and HP stats scaled to the exact league CP cap (`1500` GL, `2500` UL, uncapped ML / Mega ML) using your entered CP and optional `Atk/Def/HP` IVs for accurate damage `%`, KO thresholds, and CMP tie determination.
- **3v3 Shield Matchup Matrix & Turn-Aligned Multi-Cycle Move Bars**:
  - Visual segmented move energy bars across all fast move durations (`1t–5t`), 2nd/3rd throw cycles with residual energy tracking, and 3-column incoming/outgoing team damage matrices.

---

## 🚀 Automated CI/CD & Version Bump Script

Every push to `main` triggers `.github/workflows/android.yml` (builds signed release APK) and `.github/workflows/deploy-pages.yml` (deploys Web Simulator to GitHub Pages).

To increment the version for future releases:
```bash
./scripts/bump_version.sh        # increments sub-version by +0.01 (e.g. v1.20 -> v1.21)
./scripts/bump_version.sh v1.20  # sets an explicit version
```

---

## 💻 Building Locally from Source

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/sportsfan986/battlematrix-gbl.git
   cd battlematrix-gbl
   ```
2. **Build Web Simulator**:
   ```bash
   npm install
   npm run build
   ```
3. **Build Android APK in Android Studio**:
   ```bash
   ./gradlew assembleRelease
   ```
   Output APK location: `app/build/outputs/apk/release/app-release.apk`
