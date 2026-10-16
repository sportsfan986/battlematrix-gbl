# GBL Battle Matrix - Real-Time Overlay for Pokémon GO (v1.10)

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Support%20the%20Project-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/sportsfan986)
[![Latest Release](https://img.shields.io/github/v/release/sportsfan986/gbl-matrix-realtime?style=for-the-badge&color=0284c7&label=Latest%20APK)](https://github.com/sportsfan986/gbl-matrix-realtime/releases)

A standalone native Android application and interactive floating battle overlay for Pokémon GO Battle League (GBL). Built with Kotlin, WindowManager `TYPE_APPLICATION_OVERLAY`, in-memory `MediaProjection` frame capture (zero disk writes), PvPoke `gamemaster.json` stats, and offline Google ML Kit Text Recognition.

---

## ☕ Support the Project

If **GBL Battle Matrix** helps you climb Elo and count moves in GO Battle League, consider supporting continued development and updates:

👉 **[Buy Me a Coffee — https://buymeacoffee.com/sportsfan986](https://buymeacoffee.com/sportsfan986)**

---

## 📥 Download & Install Official Release APK

1. Visit the **[Official GitHub Releases Page](https://github.com/sportsfan986/gbl-matrix-realtime/releases)**.
2. Under the latest release (**`v1.10`**), download **`gbl-battle-matrix-v1.10.apk`** (or `app-release.apk`) directly to your Android phone.
3. Tap the downloaded APK to install (allow *"Install unknown apps"* if prompted).
4. Open **GBL Battle Matrix**:
   - Configure your **GBL Team Presets**, **Opponent Move Count Basis** (`My Fasts` default vs. `Their Fasts`), and **Overlay Size** (`50%–100%` of screen width, defaulting to `78%`).
   - Grant **"Display over other apps"** (Floating Window permission) and **Screen Capture** permission (strictly in-memory for 1 Hz ML Kit OCR).
   - Tap **"Start Battle Overlay"** and switch to Pokémon GO!

---

## ✨ Key Features in v1.10

- **3v3 Shield Matchup Matrix**: Instant 2-shield, 1-shield, and 0-shield PvPoke ratings across all 3 scanned opponents vs. your 3 team Pokémon.
- **Turn-Aligned Proportional Move Bars & Multi-Cycle Throws**:
  - Universal segmented range bars across all fast move durations (`1t–5t`), scaled proportionally along a shared turn horizon so move ready turns align vertically between **Opponent Attacks** and **My Attacks**.
  - Automatic 2nd/3rd throw cycles using true PvPoke residual energy when a fast-charging move can fire multiple times before the slowest nuke move is ready.
  - Zero-sneak leak-free throw indicators (`Safe 1,3,5`) on **My Attacks** bars.
- **3-Column Team & Opponent Damage Matrices**:
  - **Opponent Attacks**: Incoming charged move `%` against all 3 of your team Pokémon in fixed team order, with a vertical highlight column tracking your active Pokémon.
  - **My Attacks**: Outgoing charged move `%` (or `KO!`) against all 3 scanned opponents, with a vertical highlight column on the active opponent (`#1`).
- **Customizable Overlay Size (50%–100% Screen Width)**:
  - Main-app slider with a **78% Default** tick marker that scales the overlay window width and all internal fonts, bars, and spacing proportionally.

---

## 🚀 Automated CI/CD APK & Release Publishing

Every push to `main` automatically runs `.github/workflows/android.yml`, which compiles the signed release APK and publishes an official GitHub Release using the version in `VERSION` (`v1.10`).

To bump the version on future updates (defaults to incrementing the sub-version by `+0.01`, e.g., `v1.10` → `v1.11`, or accepts an explicit version):
```bash
./scripts/bump_version.sh        # increments by +0.01 (e.g. v1.10 -> v1.11)
./scripts/bump_version.sh v1.20  # sets explicit version v1.20
```

---

## 💻 How to Build Locally in Android Studio

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sportsfan986/gbl-matrix-realtime.git
   cd gbl-matrix-realtime
   ```
2. **Open in Android Studio** and run:
   ```bash
   ./gradlew assembleRelease
   ```
   The signed release APK will be output to `app/build/outputs/apk/release/app-release.apk`.
