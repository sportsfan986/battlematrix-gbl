# SilphScope PvP — Real-Time 3x3 Matchup Matrix, Damage Calculations, Turn Pacing HUD & Battle Log Overlay for Pokémon GO PvP (v2.30)

> **Note on Release v2.30:** Releases v2.20–v2.27 attempted real-time on-screen Pokémon HP bar tracking with no success due to 3D head-bobbing motion, background contrast shifts, and pending damage animations. In v2.30, on-screen HP bar tracking has been completely removed to maintain lightweight, rock-solid 1 Hz OCR performance for move timing, damage matrices, and CMP tie calculation.

[![Live Web Simulator](https://img.shields.io/badge/🌐%20Live%20Web%20Simulator-Try%20in%20Browser-0284c7?style=for-the-badge&logo=googlechrome&logoColor=white)](https://sportsfan986.github.io/silphscope-pvp/)
[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20the%20Project-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sportsfan986)
[![Latest Release](https://img.shields.io/github/v/release/sportsfan986/silphscope-pvp?style=for-the-badge&color=10b981&label=Latest%20APK)](https://github.com/sportsfan986/silphscope-pvp/releases)

---

![SilphScope PvP Full Color Real Gameplay HUD Overlay — Dialga Origin vs Mewtwo](./docs/screenshots/featured_real_gameplay.png)

**SilphScope PvP** is a standalone Android application and client-side web battle simulator for **Pokémon GO Battle League (GBL)**. Built with Kotlin, WindowManager `TYPE_APPLICATION_OVERLAY`, in-memory `MediaProjection` frame analysis (zero disk writes), PvPoke `gamemaster.json` + official league rankings JSON synchronization, offline Google ML Kit Text Recognition, Battle Quality & Wins Above Expected (WAE) micro-skill analytics, multi-device GitHub Cloud Delta Sync, and an interactive React web dashboard.

---

## 📸 Real Android Application Screenshots & In-Game HUD

| Main App & Presets Manager | Master League HUD (Kyogre vs Zacian) | Ultra League HUD (Mimikyu vs Ampharos) |
| :---: | :---: | :---: |
| ![Main App & Presets](./docs/screenshots/real_app_main_menu.png) | ![Master League HUD](./docs/screenshots/real_hud_master_league.png) | ![Ultra League HUD](./docs/screenshots/real_hud_ultra_league.png) |

- **Main App & Presets Manager (Left)**: Floating overlay controller, PvPoke + Rankings sync status, move count basis toggles, `50%–100%` overlay scaler, background glass transparency slider, and drag-and-drop persistent league team presets.
- **Master League In-Game HUD (Center)**: Real-time damage calculations for Kyogre vs Zacian (Crowned), shield scenarios, move energy cycles, and CMP tie alerts.
- **Ultra League In-Game HUD (Right)**: Turn pacing, safe move timing windows, catch point recommendations, and team switch damage previews.

---

## 🎮 Try the Live Web Simulator (No Install Needed)

Experience **SilphScope PvP** instantly in your web browser — completely free, client-side, and consuming **0 personal API tokens**:

👉 **[Launch Live Web Simulator — https://sportsfan986.github.io/silphscope-pvp/](https://sportsfan986.github.io/silphscope-pvp/)**

- **Explore 3v3 Matchup Matrices**: Compare damage percentages, 0S / 1S / 2S shield scenarios, and CMP tie outcomes for any team.
- **Custom Team Builder with Live Autocomplete**: Pre-populated with the **PvPoke Top 3 rated Pokémon** for Great League, Ultra League, Master League, and Mega Master League. Typing a base Pokémon name automatically surfaces all Base, Shadow, Regional (Alolan/Galarian/Hisuian/Paldean), and Alternate/Mega forms in a live pop-down menu.
- **Official PvPoke Rankings Move Engine**: Synchronizes `gamemaster.json` alongside official PvPoke league rankings JSONs (`1500`, `2500`, `10000`, and `mega/10000`) to automatically assign meta-recommended Fast and Charged moves by usage.
- **Battle Quality & Wins Above Expected (WAE) Analytics**: Evaluates your micro-execution skill independent of team-composition counter-luck with Expected Win Probability ($P_{\text{win}}$), Residual Quality Delta ($\Delta Q$), 6 performance badges, and filter-reactive WAE summary metrics.

---

## 📊 Battle Quality & Wins Above Expected (WAE) System

Raw win rate in GO Battle League is heavily influenced by matchmaking alignment and blind 3v3 team-composition luck (RPS). **Wins Above Expected (WAE)** isolates **micro-execution skill** (shield management, energy farming, sacrificial catches, CMP timing, and optimal backline alignment) from team-composition counter-luck by comparing your actual match outcome ($\text{Result} \in \{0.0, 1.0\}$) against the mathematical **Expected Win Probability ($P_{\text{win}}$)** of the 3v3 lineup.

### 1. Mathematical Formula & Weighting Constants

Whenever a battle is logged (or retroactively migrated via `migrateExistingBattleLogs()`), `calculateBattleQuality(myTeam, oppTeam, league, ratingsDb, metaPool)` evaluates the matchup on PvPoke's 500-centered rating scale:

- **Lead Score ($S_{\text{lead}}$ — $50/50$ $1\text{v}1$ & $2\text{v}2$ Split)**:
  Blends the $1\text{v}1$ and $2\text{v}2$ shield scenarios equally to prevent bait-tree distortions and reflect standard lead gameplay:
  $$S_{\text{lead}} = 0.50 \cdot \text{Rating}_{1\text{v}1}(\text{myLead}, \text{oppLead}) + 0.50 \cdot \text{Rating}_{2\text{v}2}(\text{myLead}, \text{oppLead})$$
- **Backline Score ($S_{\text{back}}$ — $70/30$ Optimal Alignment Weighting)**:
  Evaluates the two possible backline pairings ($\text{Score}_A$ and $\text{Score}_B$) and weights the stronger alignment at $70\%$ and the weaker alignment at $30\%$:
  $$S_{\text{back}} = 0.70 \cdot \max(\text{Score}_A, \text{Score}_B) + 0.30 \cdot \min(\text{Score}_A, \text{Score}_B)$$
- **Composite Score ($M$ — $40/60$ Lead/Backline Weighting) & Logistic Win Probability ($k = 0.006$)**:
  $$M = 0.40 \cdot S_{\text{lead}} + 0.60 \cdot S_{\text{back}}, \qquad P_{\text{win}} = \frac{1}{1 + e^{-0.006 \cdot (M - 500)}}$$
- **Residual Quality Delta ($\Delta Q$) & Aggregate WAE**:
  $$\Delta Q = \text{Result} - P_{\text{win}}, \qquad \text{Aggregate WAE} = \frac{\sum_{i \in \text{Filtered}} w_i \cdot (\text{Result}_i - P_{\text{win}, i})}{\sum_{i \in \text{Filtered}} w_i} \times 100\%$$

### 2. Incomplete Match Rules & Unrevealed Pokémon Handling

| Opponent Lineup Seen | Confidence Weight ($w$) | Evaluation Behavior |
| :--- | :---: | :--- |
| **Missing 2nd Slot (`firstSwap` null/missing)** | $w = 0.00$ | **Dropped / Unranked (`quality: null`)**: Turn-1 top-left quits or incomplete scans where the opponent's switch was never revealed are excluded from WAE calculations. |
| **Unrevealed 3rd Slot (`finalSeen` null/missing)** | $w = 0.75$ | **Meta-Average Prior (`⚡ 75% Conf`)**: Pre-calculates the average $1\text{v}1$ ratings of `mySwap` ($\bar{R}_{\text{swap}}$) and `myClose` ($\bar{R}_{\text{close}}$) against the active league's top meta pool to estimate the unrevealed closer at $75\%$ confidence weight. |
| **All 3 Opponents Revealed** | $w = 1.00$ | **Full 3v3 Evaluation**: Exact pairwise $1\text{v}1$ backline matrix evaluation at $100\%$ confidence weight. |

### 3. The 6 Battle Quality Badge Classifications

Each ranked battle card displays `[Badge Label] • Exp Win: XX% • ΔQ: [+/-X.XX]` directly below the Pokémon lineup:

| Outcome | Expected Win ($P_{\text{win}}$) | Badge Classification | Color Hex | Tactical Meaning |
| :---: | :---: | :--- | :---: | :--- |
| **WIN** | $P_{\text{win}} < 0.40$ | **`Clutch Win`** | Cyan `#22d3ee` | Flipped a heavily unfavorable team comp via superior micro-execution (catches, energy lead, or shield baiting). |
| **WIN** | $0.40 \le P_{\text{win}} \le 0.60$ | **`Skill Win`** | Bright Green `#4ade80` | Outplayed the opponent in an even/neutral 3v3 matchup. |
| **WIN** | $P_{\text{win}} > 0.60$ | **`Expected Win`** | Muted Slate `#94a3b8` | Cleanly converted a favorable team-composition advantage into a win. |
| **LOSS** | $P_{\text{win}} > 0.60$ | **`Blunder Loss`** | Rose Red `#f43f5e` | Dropped a favorable matchup where your team had >60% expected win equity. |
| **LOSS** | $0.40 \le P_{\text{win}} \le 0.60$ | **`Tough Loss`** | Orange `#fb923c` | Narrow loss in a competitive 50/50 matchup. |
| **LOSS** | $P_{\text{win}} < 0.40$ | **`Expected Loss`** | Muted Slate `#94a3b8` | Hard-countered team composition (<40% win equity); minimal negative impact on WAE. |

---

## 🖼️ HUD & Feature Overview

![Floating HUD Overlay Diagram](./docs/images/hud_overlay_preview.svg)

---

## ☕ Support Continued Development

If **SilphScope PvP** helps you count fast moves, win CMP ties, and climb Elo in GO Battle League, consider supporting continued updates and new feature releases:

👉 **[Buy Me a Coffee — https://buymeacoffee.com/sportsfan986](https://buymeacoffee.com/sportsfan986)**

---

## 📥 Download & Install Native Android APK (v2.13)

1. Visit the **[Official GitHub Releases Page](https://github.com/sportsfan986/silphscope-pvp/releases)**.
2. Download **`silphscope-pvp-v2.13.apk`** directly to your Android device.
3. Tap the downloaded APK file to install (grant *"Install unknown apps"* permission if prompted).
4. Launch **SilphScope PvP**:
   - Select, reorder, or customize your **GBL Team Presets**, set **Opponent Move Count Basis** (`My Fasts` vs. `Their Fasts`), and adjust **Overlay Size** (`50%–100%` screen width slider) and **Background Transparency**.
   - Grant **"Display over other apps"** (Floating Window permission) and **Screen Capture** permission (used strictly in-memory for 1 Hz ML Kit OCR).
   - Tap **"Start Battle Overlay"** and launch Pokémon GO!

---

## ✨ Key Features in v2.13

- **Accurate Dual-Type Effectiveness & League CP Stat Scaling Engine**:
  - Synchronizes official dual-types and raw base stats from `gamemaster.json` across all species, computes reference CP directly from stored stat vectors to prevent HP/Defense inflation in Great and Ultra Leagues, prioritizes live PvPoke move powers/energies, and persists Shadow (+20% ATK / -16.7% DEF) modifiers across OCR ticks.
- **Start Battle / Stop Battle Toggle with Post-Stop Logging**:
  - Pressing `⚔️ Start Battle` immediately clears the opponent list and empties the 3x3 matrix for a fresh match while switching the button to `🛑 Stop Battle`. When the match concludes, pressing `🛑 Stop Battle` pauses OCR scanning, switches the button back to `⚔️ Start Battle`, and opens the `🏆 Win` / `💀 Loss` / `✕ Skip` logging bar.
- **Battle Quality & Wins Above Expected (WAE) System**:
  - Computes Expected Win Probability ($P_{\text{win}}$), Residual Quality Delta ($\Delta Q$), and 6 performance badges (`Clutch Win`, `Skill Win`, `Expected Win`, `Blunder Loss`, `Tough Loss`, `Expected Loss`) with automatic retroactive migration (`migrateExistingBattleLogs()`) and filter-linked `QUALITY (WAE)` summary cards and daily group headers.
- **Battle Menu OCR Guard (`BATTLE` & `PARTY` Filter)**:
  - Blocks menu header tokens (`battle`, `party`, `battles`, `parties`) from fuzzy-matching Pokémon names (such as `Paras`) and automatically pauses OCR scanning when on the Pokémon GO Battle Menu screen.
- **Trash Bin Modal + Quick Undo Toast for Deleted Battles & Teams**:
  - Soft-deletes battle logs and team presets into a persistent Trash Bin with an instant `↩ UNDO` banner and one-tap individual or bulk restoration.
- **Streamlined Summary & Go Battle Log Sharing**:
  - Share or copy overall/daily summaries with `W/L(ExpectedWin%) MyTeamName vs. Opponent1,Opponent2,Opponent3` match rows, or export in Go Battle Log format.
- **Multi-Device GitHub Cloud Delta Sync (OAuth Device Flow)**:
  - Sign in directly on Android or Web via GitHub's native Device Flow (`github.com/login/device`) to automatically synchronize team presets and battle logs across multiple phones using conflict-free union + Last-Write-Wins (LWW) + tombstone delta reconciliation.

---

## 🚀 Automated CI/CD & Version Bump Script

Every push to `main` triggers `.github/workflows/android.yml` (builds signed release APK `silphscope-pvp-vX.XX.apk`) and `.github/workflows/deploy-pages.yml` (deploys Web Simulator to GitHub Pages).

To increment the version for future releases:
```bash
./scripts/bump_version.sh        # increments sub-version by +0.01 (e.g. v2.12 -> v2.13)
./scripts/bump_version.sh v2.13  # sets an explicit version
```

---

## 💻 Building Locally from Source

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/sportsfan986/silphscope-pvp.git
   cd silphscope-pvp
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
