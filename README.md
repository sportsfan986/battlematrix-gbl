# GBL Battle Matrix - Real-Time Overlay for Pokémon GO

A standalone native Android application and interactive floating battle overlay for Pokémon GO Battle League (GBL). Built with Kotlin, WindowManager `TYPE_APPLICATION_OVERLAY`, in-memory `MediaProjection` frame capture (zero disk writes), and offline Google ML Kit Text Recognition.

---

## 🚀 How to Build in GitHub (Automated CI/CD APK)

This repository includes a ready-to-run **GitHub Actions CI/CD workflow** (`.github/workflows/android.yml`).

### Option A: Automatic Build via GitHub Actions (Recommended)
1. Go to your repository on GitHub: [https://github.com/sportsfan986/gbl-matrix-realtime](https://github.com/sportsfan986/gbl-matrix-realtime)
2. Click on the **Actions** tab at the top.
3. You will see the **Build Android APK** workflow running automatically for the latest commit.
   *(You can also trigger it manually at any time by selecting "Build Android APK" in the left sidebar and clicking **Run workflow**).*
4. Once the workflow finishes (green checkmark), click on the completed run.
5. Scroll down to the **Artifacts** section at the bottom.
6. Click **`gbl-battle-matrix-debug-apk`** to download your ready-to-install `app-debug.apk` directly to your computer or phone!

---

## 💻 How to Build Locally in Android Studio

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sportsfan986/gbl-matrix-realtime.git
   cd gbl-matrix-realtime
   ```
2. **Open in Android Studio**:
   - Launch Android Studio (Hedgehog or newer recommended).
   - Select **File > Open...** and choose the `gbl-matrix-realtime` folder.
   - Wait for Gradle sync to complete.
3. **Build APK**:
   - In the top menu, go to **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
   - Or run in terminal:
     ```bash
     gradle assembleDebug
     ```
   - The compiled APK will be at: `app/build/outputs/apk/debug/app-debug.apk`.

---

## 📱 How to Install on Android

1. Transfer `app-debug.apk` to your Android device (or download directly from the GitHub Actions Artifacts page on your phone browser).
2. Tap the file and select **Install** (allow *"Install unknown apps"* if prompted).
3. Open **GBL Battle Matrix**:
   - Grant **"Display over other apps"** (Floating Window permission).
   - Grant **Screen Capture** permission (used by MediaProjection strictly in-memory for ML Kit OCR).
   - Tap **"Start Battle Overlay"**.
4. Switch to Pokémon GO:
   - The ultra-transparent HUD will appear floating above your screen.
   - Drag anywhere on the header grip to reposition.
   - Tap **"⇄ Opt 2"** to switch between Top-Left Sky Trench and Bottom Horizon Belt.
