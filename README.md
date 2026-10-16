# BattleMatrix GBL - Real-Time 3x3 matchup Matrix, Damage Calculations, & Turn Pacing HUD for Poekmon Go PVP (v1.11)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20the%20Project-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sportsfan986)
[![Latest Release](https://img.shields.io/github/v/release/sportsfan986/battlematrix-gbl?style=for-the-badge&color=0284c7&label=Latest%20APK)](https://github.com/sportsfan986/battlematrix-gbl/releases)

A standalone native Android application and interactive floating battle overlay for Pokémon GO Battle League (GBL). Built with Kotlin, WindowManager `TYPE_APPLICATION_OVERLAY`, in-memory `MediaProjection` frame capture (zero disk writes), PvPoke `gamemaster.json` stats, and offline Google ML Kit Text Recognition.

---

## ☕ Support the Project

If **BattleMatrix GBL** helps you climb Elo and count moves in GO Battle League, consider supporting continued development and updates:

👉 **[Buy Me a Coffee — https://buymeacoffee.com/sportsfan986](https://buymeacoffee.com/sportsfan986)**

---

## 📥 Download & Install Official Release APK

1. Visit the **[Official GitHub Releases Page](https://github.com/sportsfan986/battlematrix-gbl/releases)**.
2. Under the latest release (**`v1.11`**), download **`battlematrix-gbl-v1.11.apk`** (or `app-release.apk`) directly to your Android phone.
3. Tap the downloaded APK to install (allow *"Install unknown apps"* if prompted).
4. Open **BattleMatrix GBL**:
   - Configure your **GBL Team Presets**, **Opponent Move Count Basis** (`My Fasts` default vs. `Their Fasts`), and **Overlay Size** (`50%–100%` of screen width, defaulting to `78%`).
   - Grant **"Display over other apps"** (Floating Window permission) and **Screen Capture** permission (strictly in-memory for 1 Hz ML Kit OCR).
   - Tap **"Start Battle Overlay"** and switch to Pokémon GO!

---

## ✨ Key Features in v1.11

- **Persistent User Teams & Settings Across App Updates**:
  - Programmed teams, selected preset, opponent count mode, and overlay scale are persisted to a permanent version-independent store (`gbl_user_teams_persistent`) with automatic migration from legacy keys so updates never overwrite your teams.
- **PvPoke Top 3 League Defaults & Custom Templates**:
  - Default teams (if no teams are saved) and custom team templates pre-populate with the **PvPoke Top 3 rated Pokémon** for each league (**Great League**: Clodsire, Shadow Feraligatr, Gastrodon; **Ultra League**: Zygarde Complete, Feraligatr, Giratina Altered; **Master League**: Palkia Origin, Zacian Crowned, Dialga Origin).
- **Auto-Filled Recommended Fast & Charged Moves**:
  - Entering a Pokémon name in the preset editor automatically fills in its #1 PvPoke recommended Fast Move, Charged Move 1, Charged Move 2, and default CP whenever move/CP fields are left blank.
- **League CP-Scaled Stats & Optional Custom IVs**:
  - Scales Attack, Defense, and HP to the exact active League CP cap (`1500` GL, `2500` UL, uncapped ML) using your entered CP and optional `Atk/Def/HP` IVs (auto-defaulting to PvPoke's optimal league IVs when left blank) for accurate damage `%`, KO thresholds, and CMP tie calculations.
- **3v3 Shield Matchup Matrix & Turn-Aligned Multi-Cycle Move Bars**:
  - Universal segmented range bars across all fast move durations (`1t–5t`), 2nd/3rd throw cycles using true PvPoke residual energy, and 3-column incoming/outgoing team damage matrices.

---

## 🚀 Automated CI/CD APK & Release Publishing

Every push to `main` automatically runs `.github/workflows/android.yml`, which compiles the signed release APK and publishes an official GitHub Release using the version in `VERSION` (`v1.11`).

To bump the version on future updates (defaults to incrementing the sub-version by `+0.01`, e.g., `v1.10` → `v1.11`, or accepts an explicit version):
```bash
./scripts/bump_version.sh        # increments by +0.01 (e.g. v1.10 -> v1.11)
./scripts/bump_version.sh v1.20  # sets explicit version v1.20
```

---

## 💻 How to Build Locally in Android Studio

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sportsfan986/battlematrix-gbl.git
   cd battlematrix-gbl
   ```
2. **Open in Android Studio** and run:
   ```bash
   ./gradlew assembleRelease
   ```
   The signed release APK will be output to `app/build/outputs/apk/release/app-release.apk`.
