# SilphScope PvP (v2.03) — Implementation Plan

## 1. Rebrand Application to **SilphScope PvP (v2.03)**
- **Web Simulator & Project Hub (`src/App.tsx`, `index.html`, `src/data/androidFiles.ts`)**:
  - Update the main header, simulator HUD title, export headers, and ZIP bundle filenames to **SilphScope PvP v2.03**.
- **Android Native App (`MainActivity.kt`, `OverlayService.kt`, `activity_main.xml`, `strings.xml`, `build.gradle.kts`)**:
  - Update `app_name` in `res/values/strings.xml`, top title banner in `res/layout/activity_main.xml`, foreground service notification title, and floating HUD title bar to **SilphScope PvP v2.03**.
  - Bump `versionCode` to `203` and `versionName` to `"2.03"`.

---

## 2. Prevent Battle Menu OCR False Positives (`party` & `battle`)
- **Expanded OCR Stop-Words (`OverlayService.kt`)**:
  - Add `"party"`, `"parties"`, `"battle"`, `"battles"`, `"schedule"`, `"rank"`, `"rating"`, `"rewards"`, and `"train"` to `IGNORED_WORDS` and token filtering before running exact or fuzzy Levenshtein matching.
  - This prevents `"party"` (upper-right of the GBL menu) from fuzzy-matching to **Paras** (edit distance 2) and prevents `"battle"` (upper-left) from fuzzy-matching to any Pokémon in the user's team or opponent pool.
- **Battle Menu Screen Guard (`OverlayService.kt`)**:
  - Before processing top-right opponent OCR or bottom-left user Pokémon OCR, inspect the full OCR frame for the GBL Battle Menu signature (e.g., upper-left `"battle"` appearing alongside upper-right `"party"`, or `"go battle league"` menu headers without an active `"switch"` /HP HUD).
  - When the Battle Menu screen is detected, skip opponent and user slot matching for that frame so the opponent party is never overwritten while navigating menus.

---

## 3. Restore Accidentally Deleted Battles & Teams (Trash Bin Modal + Undo Toast)
- **Soft-Delete Storage & Sync Tombstone Reversal**:
  - Store deleted battles in a persistent Trash list (`gbl_deleted_battles_trash_v1`) and deleted team presets in a persistent Trash list (`gbl_deleted_teams_trash_v1`) in both `SharedPreferences` (`MainActivity.kt`) and `localStorage` (`src/App.tsx`).
  - When a battle or team is restored, remove its ID from `PREFS_KEY_DELETED_LOG_IDS` / `PREFS_KEY_DELETED_TEAM_IDS` tombstones and update its `updatedAt` timestamp so 2-device cloud sync restores it cleanly across devices.
- **Quick Undo Toast / Banner**:
  - Immediately after deleting a battle log, clearing battle logs, or deleting a team preset, display an interactive **Undo** toast/banner (`"Battle deleted — [UNDO]"` / `"Team deleted — [UNDO]"`) for instant 1-tap recovery.
- **Trash Bin Modal on Teams & Battle Log Tabs**:
  - **Teams Tab**: Add a **🗑️ Trash / Restore** button showing recently deleted teams with **Restore** and **Delete Forever** actions.
  - **Battle Log Tab**: Add a **🗑️ Trash / Restore** button showing recently deleted battles with **Restore**, **Restore All**, and **Empty Trash** actions.

---

## 4. Go Battle Log Friendly Export Format
- **Format Specification**:
  - **No dates or timestamps** included in the output.
  - **Header Row**: User's 3-Pokémon team inside square brackets, e.g.:
    ```text
    [Clodsire, Feraligatr, Mandibuzz]
    ```
    *(If logs from multiple teams are included in the filter, each team section outputs its own `[Lead, Switch, Closer]` header row).*
  - **Battle Rows**: Each battle on its own line in the format `opp1 opp2 opp3 W/L` (using `W` for Win and `L` for Loss), e.g.:
    ```text
    [Clodsire, Feraligatr, Mandibuzz]
    Azumarill Annihilape Bastiodon W
    Feraligatr Clodsire Mandibuzz L
    ```
- **UI Integration (`MainActivity.kt` & `src/App.tsx`)**:
  - In the **Copy** and **Share** export dialogs on the Battle Log tab, allow choosing between **Standard Summary Format** and **Go Battle Log Format (`[Team]` + `opp1 opp2 opp3 W/L`)** across any selected timeframe (Today, This Week, Current Season, Previous Season, All Time).
