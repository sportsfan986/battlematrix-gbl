# Live Floating HP Bar Reading, Swap Debounce, Gold KO Highlighting & Battle Settings Toggles

This update adds real-time floating health bar detection above 3D Pokémon models (including low-positioned bars on shorter Pokémon), protects against cross-contaminating HP readings during switches with a multi-reading debounce gate, remembers each Pokémon's remaining health when it swaps out, displays live and remembered HP percentages in a second row on the 3-column Pokémon headers, highlights lethal (KO) charged move damage cells in bright gold (active target) or muted gold (benched/swapped-out target), and adds two new **Settings toggles** to disable HP bar tracking and to disable toast messages during battles.

## User Review & Critical Decisions

> [!IMPORTANT]
> Incorporates the floating HP bar battlefield coordinates from your screenshot, your Phase 1 display choices, and the two new Settings options:

- **Revised HP Bar Search Geometry (Floating Above 3D Models, Not Under Nameplates)**:
  - **Player HP Bar Search Zone**: Scans **`X: 2%–44%` of screen width** and **`Y: 32%–68%` of screen height** (capturing both tall Pokémon and shorter foreground Pokémon like Manectric where the bar sits around `Y ≈ 58.5%`).
  - **Opponent HP Bar Search Zone**: Scans **`X: 44%–85%` of screen width** and **`Y: 15%–50%` of screen height** (capturing tall legendaries up near `Y ≈ 18%` down to short opponents near `Y ≈ 45%`, while staying left of the `X > 83%` switch-drawer icons).
- **Confirmed Decision 1 — Highlight Target**: Lethal move indicators highlight the **3-column damage percentage cells** (`Opponent Attacks` 3-column team matrix and `My Attacks` 3-column opponent matrix).
- **Confirmed Decision 2 — KO Color Palette**: **Bright gold** (`#FACC15` / `#FDE047` with high-contrast border and glow) for any move that will KO an **active** Pokémon's current HP, and **muted gold/amber** (`rgba(180, 83, 9, 0.26)` with warm amber text/border) when a move is strong enough to KO a **swapped-out (benched)** Pokémon's remembered remaining HP.
- **Confirmed Decision 3 — Column Header HP Row**: Both 3-column damage headers (`Opponent Attacks` user team headers and `My Attacks` scanned opponent headers) render a **second row beneath each 3-letter Pokémon code** showing its live or remembered remaining HP percentage (e.g. `100%`, `56%`) whenever HP Bar Tracking is enabled.
- **New Settings Option 1 — Disable HP Bar Tracking**: A toggle card in **Settings** (`HP Bar Tracking & KO Highlights: ON / OFF`, enabled by default) that turns off real-time HP bar pixel scanning, hides the 2nd-row HP% header sub-labels, and reverts damage cells to standard full-HP percentages.
- **New Settings Option 2 — Disable Toast Messages During Battles**: A toggle card in **Settings** (`Battle Toast Notifications: ON / OFF`, enabled by default) that suppresses all pop-up Android Toast banners during live battles (opponent detections, player switch detections, active lead/opponent swaps, and battle start/stop toasts).

---

## 1. Overview & Core Concept

- **What It Does**:
  - Dynamically locates the floating horizontal HP bar above both the player's Pokémon (`Y: 0.32..0.68`) and the opponent's Pokémon (`Y: 0.15..0.50`) on each ~450ms screen capture frame—after masking out the floating SilphScope overlay window so the HUD never interferes with detection.
  - Identifies the exact rectangular bar signature (`~24%–33%` of screen width, `~5–14px` interior height, white or orange-flash border, vibrant spring-green `#10E7A2` / yellow / red left fill + flat dark-charcoal `#484C52` depleted right track) to compute the exact remaining HP percentage (`1%`–`100%`).
  - Tracks remaining HP percentage independently for each of the player's 3 team Pokémon and each of the opponent's 3 discovered Pokémon.
  - Applies a **Swap & Transition Debounce Gate** (rejecting upward HP jumps `> 8%` when a new Pokémon enters before nameplate OCR updates, and requiring 2 post-swap readings before accepting new HP values) so mid-switch health bars never bleed between outgoing and incoming Pokémon.
  - Compares every charged move's calculated damage percentage against each target Pokémon's remaining HP percentage (`dmgPct >= remainingHpPct`), lighting up the corresponding cell in **bright gold** when that Pokémon is currently active or **muted gold** when that Pokémon is swapped out on the bench.
  - Provides instant Settings toggles to disable HP bar tracking or mute in-battle toast pop-ups without restarting the overlay service.
- **Target Audience / Persona**: Competitive Pokémon GO Battle League players using the floating HUD overlay and Web companion simulator to make split-second shield, farm-down, and energy-management decisions.
- **Key Value**: Eliminates mental math mid-battle by immediately signaling when an opponent's charged move is now in KO range on your active Pokémon (must shield) or when your charged move can finish off the active or banked opponent Pokémon, while giving players full control over HUD visuals and screen toast clutter.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Battle Start (`100%` Baseline)**: When a battle begins or a new Pokémon enters for the first time, its remembered HP initializes to `100%`. When HP tracking is enabled, the 2-row column headers display the Pokémon's 3-letter code on Row 1 and `100%` on Row 2.
  2. **Dynamic Floating Bar Lock & Live HP Drain**: On each capture frame, the scanner sweeps the vertical band above each Pokémon, locks onto the horizontal health bar regardless of whether the Pokémon is tall (Entei at `Y ≈ 34.5%`) or short (Manectric at `Y ≈ 58.5%`), and updates the active HP%. The moment a Pokémon's remaining HP drops at or below a charged move's damage percentage (`dmgPct >= remainingHpPct`), that move's damage cell in the active column switches to a **Bright Gold KO state**.
  3. **Swap-Out Memory & Debounced Switch**: When either player or opponent swaps Pokémon, the outgoing Pokémon's last stable HP reading prior to the swap is locked into memory, and its column shifts from active to benched. Any move cell in that benched column whose `dmgPct >= rememberedHpPct` transitions to a **Muted Gold KO state** so you always know which banked moves can finish off the swapped-out Pokémon when it returns. Meanwhile, a 2-reading debounce window prevents mid-switch transition frames from corrupting either Pokémon's HP.
  4. **Settings Controls (HP Bar Tracking & Battle Toasts)**:
     - In the **Settings** tab (both Android native app and Web companion), users can toggle **HP Bar Tracking & KO Highlights** (`ON` / `OFF`) and **Battle Toast Messages** (`ON` / `OFF`).
     - Toggling either setting broadcasts immediately to the running `OverlayService` without interrupting an active battle.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-contrast tactical glass HUD optimized for instant peripheral recognition over live gameplay.
  - *Color Palette & Mood*:
    - **Active KO Cell (Bright Gold)**: Background `rgba(234, 179, 8, 0.48)`, border `1.5px solid #FDE047`, text `#FEF08A` (bold tabular numerals with subtle gold outer glow `0 0 6px rgba(250, 204, 21, 0.65)`).
    - **Swapped-Out / Banked KO Cell (Muted Gold)**: Background `rgba(180, 83, 9, 0.26)`, border `1px dashed rgba(251, 191, 36, 0.55)`, text `#FCD34D` (subdued warm amber indicating lethal against remembered bench HP).
    - **2-Row Column Header (`dmg-col-hdr`)**: Row 1 displays the 3-letter Pokémon code (`DIA`, `S-ANN`, `ZYG`); Row 2 displays the live or remembered HP percentage (`58%`) in compact `6.5px` tabular monospace, tinted spring-green (`#6EE7B7`) when `>50%`, amber (`#FDE047`) when `21%–50%`, and coral (`#FCA5A5`) when `≤20%`.
  - *Typography & Hierarchy*: Compact tabular numerals (`font-variant-numeric: tabular-nums`) across all damage cells and HP sub-rows so column widths remain locked at `87px` without horizontal jitter.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Vertical Band Sweep for Floating Health Bar Geometry**:
  - *Chosen Approach*:
    - Because Pokémon GO positions each HP bar above the 3D model's head height, its vertical coordinate `Y` varies significantly by species (`Y: 0.15..0.50` for Opponent; `Y: 0.32..0.68` for Player), whereas its **horizontal width is fixed at `~28.5%` of screen width (`0.24 * w .. 0.33 * w`)** and its interior consists of `5–14` vertically aligned horizontal scanlines.
    - Each scanline inside the bar consists of:
      1. **Left Colored HP Fill**: Spring-Green/Teal (`#10E7A2`, `H: 135°–175°` or `75°–135°`, `S >= 0.45`, `V >= 0.55`), Yellow/Amber (`H: 30°–74°`, `S >= 0.50`, `V >= 0.60`), or Red/Crimson (`H: 0°–29°` or `340°–360°`, `S >= 0.50`, `V >= 0.50`).
      2. **Right Depleted Track**: Flat dark charcoal gray (`R: 50..105, G: 55..110, B: 60..115`, low saturation `max(R,G,B) - min(R,G,B) <= 22`), optionally separated by a `1–3px` orange/white damage-flash divider tick.
    - By sweeping candidate rows in the Player and Opponent battlefield boxes (`stepY = 2px`) and requiring:
      - Total contiguous bar width (`fillWidth + emptyTrackWidth`) between **`24%` and `33%` of screen width**,
      - At least **3 vertically adjacent scanlines** sharing the same left start `X` (`±4px`), right end `X` (`±4px`), and fill ratio (`±3%`),
      - Flat vertical color coherence,
      the detector pinpoints the floating HP bar anywhere in the vertical band in `< 2ms` with zero false positives.
  - *Why*: Handles tall legendaries, standard bipeds, and short/low-profile Pokémon (like Manectric in the screenshot at `Y ≈ 58.5%`) without hardcoding a single `Y` line, and naturally ignores the narrow (`~11%` width) switch-drawer mini-bars on the far right (`X > 0.83`).

- **Decision 2 — Two-Stage Swap Debounce & Pre-Swap Lookback Buffer**:
  - *Chosen Approach*:
    1. **Upward Jump Swap Guard**: In GBL, Pokémon cannot heal. During a swap or faint, the floating HP bar often snaps to the incoming Pokémon's full health 1 frame (`~450ms`) *before* ML Kit OCR updates the nameplate text. If an active Pokémon's raw HP reading suddenly jumps *upward* by `> 8%`, that reading is rejected as a swap transition frame so the outgoing Pokémon's damaged HP is never overwritten by the incoming Pokémon's full bar.
    2. **Post-Swap 2-Reading Cooldown Gate**: Whenever OCR or a manual chip tap changes the active player or opponent Pokémon, lock the outgoing Pokémon's confirmed HP into memory and set `swapDebounceReadsRemaining = 2` for that side. For the next 2 OCR frames (`~900ms`), ignore raw bar readings while the camera zooms and the new health bar settles, displaying the incoming Pokémon's remembered HP (or `100%` on first entry).
    3. **2-Reading Consistency Filter**: Require 2 consecutive readings within `±6%` before committing to memory so mid-hit orange flash animations never cause single-frame glitches.

- **Decision 3 — Live-Broadcast Settings for HP Tracking & Battle Toasts**:
  - *Chosen Approach*: Add two persistent preferences (`enable_hp_bar_tracking` default `true`, and `enable_battle_toasts` default `true`) in Settings. When toggled, `MainActivity` immediately sends an intent action to `OverlayService` so changes take effect in real time without stopping the overlay. All in-battle `Toast.makeText(...)` calls inside `OverlayService` route through `showBattleToast(...)`, which checks `enableBattleToasts` before displaying any toast.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│             450ms Screen Capture (Overlay Masked Out First)             │
│  [If enableHpBarTracking == true]:                                      │
│  Player Battlefield Box:              Opponent Battlefield Box:         │
│  X: 0.02..0.44w, Y: 0.32..0.68h       X: 0.44..0.85w, Y: 0.15..0.50h    │
└───────────────────┬───────────────────┴────────────────┬────────────────┘
                    │                                    │
                    ▼                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│         2D Floating HP Bar Rect & Scanline Detector (< 2.0ms)           │
│  • Sweeps scanlines for [Colored Fill (#10E7A2/Amber/Red) + Dark Track] │
│  • Enforces total bar width = 24%..33% of screen width                  │
│  • Verifies >= 3 vertically aligned rows with matching [X_left, X_right]│
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│        Swap Debounce & Per-Pokémon HP Memory State Machine              │
│  • Upward Jump Guard: Rejects >8% HP increases (impossible in GBL)      │
│  • Post-Swap Gate: Skips 2 readings after any player/opponent switch    │
│  • Memory Map: userTeamHpPct[0..2] & opponentHpBySpecies[baseKey]       │
│  • Battle Toast Gate: showBattleToast() checks enableBattleToasts       │
└───────────────────────────────────┬─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             Battle Payload Builder & 3-Column HUD Renderer              │
│  • Column Headers: Row 1 = 3-letter Code | Row 2 = Live/Remembered HP%  │
│  • Active Column + dmgPct >= hpPct   ──► Bright Gold Cell (.ko-active)  │
│  • Benched Column + dmgPct >= hpPct  ──► Muted Gold Cell  (.ko-muted)   │
└─────────────────────────────────────────────────────────────────────────┘
```

- **Data Model & State**:
  - `enableHpBarTracking: Boolean` (default `true`, stored in `SharedPreferences` key `"enable_hp_bar_tracking"`).
  - `enableBattleToasts: Boolean` (default `true`, stored in `SharedPreferences` key `"enable_battle_toasts"`).
  - `userTeamHpPct: ConcurrentHashMap<Int, Int>` — Remaining HP (`1..100`, default `100`) for each of the player's 3 team slots (`0, 1, 2`). Reset to `100` on `startNewBattle()`.
  - `opponentHpBySpecies: ConcurrentHashMap<String, Int>` — Remaining HP (`1..100`, default `100`) keyed by normalized opponent base species. Reset on `startNewBattle()`.
  - `HpDebounceState` (independent instances for Player and Opponent):
    - `activeKey: String` (current team slot index or opponent base species)
    - `debounceFramesRemaining: Int` (set to `2` on every species/slot switch)
    - `pendingHpReading: Int?` (requires 2 consecutive consistent readings within `±6%` before updating memory)
    - `lastCommittedHp: Int` (guards against upward HP jumps `> 8%` when a new full-health Pokémon swaps in 1 frame before nameplate OCR updates)
  - Payload Additions (`buildBattlePayloadJson`):
    - `enableHpBarTracking: Boolean`
    - `team[]` and `scannedOpponents[]` entries include `hpPct: Int` (`1..100`).
    - `oppMoveTimingRows[].teamDamages[]` and `myMoveTimingRows[].oppDamages[]` entries include `hpPct: Int`, `isKoActive: Boolean` (`enableHpBarTracking && isActive && dmgPct >= hpPct`), and `isKoMuted: Boolean` (`enableHpBarTracking && !isActive && dmgPct >= hpPct`).

- **Interactive Component & State Mapping**:
  - **Settings Page (`activity_main.xml`, `MainActivity.kt`, and `src/App.tsx`)**:
    - **HP Bar Tracking & KO Highlights Card**: Toggle button (`ON` / `OFF`) with description explaining live HP bar reading, 2-row header HP display, and bright/muted gold KO cell highlighting.
    - **Battle Toast Messages Card**: Toggle button (`ON` / `OFF`) with description explaining suppression of pop-up Android Toast banners during battles.
  - **2-Row Column Headers (`#sky-opp-dmg-headers` & `#sky-my-dmg-headers`)**:
    - When `enableHpBarTracking` is true, renders each column header as a 2-row flex cell: Row 1 = `<span class="hdr-code">${code}</span>`, Row 2 = `<span class="hdr-hp ${hpTier}">${hpPct}%</span>`. When false, renders the single-row 3-letter code.
  - **3-Column Damage Cells (`.dmg-cell`)**:
    - `.ko-active`: Bright gold fill, solid bright yellow-gold border, glowing `#FEF08A` bold text when `isKoActive` is true.
    - `.ko-muted`: Muted amber-gold fill, dashed amber border, `#FCD34D` text when `isKoMuted` is true.
