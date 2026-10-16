# GBL Battle Matrix v1.10 Implementation Plan

This update adds the custom GBL Battle Matrix launcher icon, fixes Android status bar / clock overlap on edge-to-edge screens, adds the Buy Me a Coffee support link to the main app and GitHub README, introduces a proportional **50%–100% Screen Width Overlay Scale Slider** in the main app with a default tick mark, and prepares release **v1.10**.

---

## 1. Custom App Icon (Android Launcher & App Header)
- **Adaptive & Vector Launcher Icons**:
  - Create `app/src/main/res/drawable/ic_launcher_background.xml` (`#0B111E` dark navy canvas with the subtle dashed outer radar ring) and `app/src/main/res/drawable/ic_launcher_foreground.xml` matching the uploaded **GBL Battle Matrix** shield emblem:
    - Glowing cyan-to-royal-blue hexagonal battle shield outline.
    - Top gold crossed swords (`✕`) crest.
    - Center 3×3 battle matrix grid of green, red, sky-blue, and slate dots.
    - Bottom 5-node charged move turn timeline bar (cyan, orange, cyan, red target bullseye, and gold badge).
  - Configure `app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml` and `ic_launcher_round.xml` plus fallback drawable references in `AndroidManifest.xml` (`android:icon="@mipmap/ic_launcher"` and `android:roundIcon="@mipmap/ic_launcher_round"`).
  - Display the icon alongside the title in `MainActivity` (`activity_main.xml`) and update the web app's SVG favicon to match.

---

## 2. Main App Top Status Bar / Clock / Notification Bar Inset Fix
- **Root Cause**: With `targetSdk = 35` (Android 15), Android enforces edge-to-edge window drawing by default, causing `activity_main.xml` content to render underneath the top clock/battery/notification bar and bottom gesture bar.
- **Fix**:
  - Enable `android:fitsSystemWindows="true"` on the root layout in `app/src/main/res/layout/activity_main.xml`.
  - In `MainActivity.kt`, attach `ViewCompat.setOnApplyWindowInsetsListener` on the root view to dynamically read `WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout()` and apply the exact top, bottom, left, and right system bar insets on top of the 16dp base padding.

---

## 3. Buy Me a Coffee Donation Link (`https://buymeacoffee.com/sportsfan986`)
- **Main App UI (No Overlay Clutter)**:
  - **Android `MainActivity`**: Add a styled **`☕ Support / Donate`** button in the top header row of `activity_main.xml` that opens `https://buymeacoffee.com/sportsfan986` in the user's browser via `Intent(Intent.ACTION_VIEW, Uri.parse("https://buymeacoffee.com/sportsfan986"))`.
  - **Web App Simulator**: Add a matching **`☕ Buy Me a Coffee`** link button in the main app header/settings panel (outside the floating overlay).
- **GitHub `README.md`**:
  - Add a prominent **Support the Project** section and a Buy Me a Coffee badge near the top of `README.md` linking directly to `https://buymeacoffee.com/sportsfan986`.

---

## 4. Proportional Overlay Screen-Width Scale Slider (`50%` – `100%`)
- **Main App Slider with Default Tick (`78%`)**:
  - Placed exclusively inside the **Main App** Status & Settings card (`activity_main.xml` and Web App settings panel)—zero controls added to the floating overlay.
  - **Bounds & Step Increment**:
    - Range: **`50%` to `100%` of screen width**.
    - Default: **`78%`** (matching the existing `0.78f` screen width calculation).
    - Increment: **`2%` per step** (25 discrete steps on the `SeekBar`: `progress = (scalePct - 50) / 2`, where `progress = 0` is `50%`, `progress = 14` is the default `78%`, and `progress = 25` is `100%`). A `2%` step corresponds to ~`0.16px` font scaling per step, allowing smooth, crisp typography adjustments without text wrapping or overflowing its grid cells.
  - **Default Tick Indicator**:
    - Render a visual tick marker aligned directly at the **78% Default** position underneath the slider track (`50%` left label, `▲ 78% (Default)` tick marker at 56% along the 50–100 track, and `100%` right label), plus a tap-to-reset action on the label/tick to snap back to `78%`.
- **Proportional All-Element & Font Scaling**:
  - **Window Width (`OverlayService.kt`)**:
    - Persist `overlay_scale_pct` (default `78`) in `SharedPreferences`.
    - Set `layoutParams.width = (screenWidth * (overlayScalePct / 100f)).toInt()`, clamping `layoutParams.x` so the overlay stays within screen bounds when scaled up toward `100%`.
    - Live updates via `ACTION_UPDATE_SETTINGS` immediately resize `layoutParams.width` via `windowManager.updateViewLayout(overlayView, layoutParams)` and notify the WebView.
  - **Proportional Internal Scaling (`overlay.html`)**:
    - The overlay's internal layout is authored against a reference base width of `300px`.
    - On load and on every `window.onresize` / `setOverlayScale()`, `overlay.html` computes `zoomFactor = window.innerWidth / 300.0` and applies `document.body.style.zoom = zoomFactor` (with automatic height recalculation in `notifyHeight()`).
    - Because CSS `zoom` scales the entire coordinate system uniformly with the window width, every font size (`px`), grid column (`44px 1fr 87px`), dot diameter, border radius, and padding scales in exact lockstep from **50% to 100% screen width** while preserving identical relative spacing and proportions.

---

## 5. Version `v1.10` Release Configuration
- Update `VERSION` to `v1.10` and `app/build.gradle.kts` to `versionCode = 110`, `versionName = "1.10"`.
- Future runs of `scripts/bump_version.sh` will automatically increment from `v1.10` → `v1.11` → `v1.12` unless a version is specified.
