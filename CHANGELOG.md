# SilphScope PvP Changelog

## [v3.13] — 2026-10-22 — Best-Match-Across-Team Player Switch OCR Fix & Single-Tap Stop Overlay Button Fix
- **Best-Match-Across-Team Player Switch OCR (`scoreTeamMemberOnLine` & `handlePlayerSwitchLines`)**:
  - Replaced sequential slot-order matching (which checked Slot 0 / Lead first and immediately returned on any fuzzy edit-distance-2 or shared-CP match) with simultaneous scoring across all 3 team Pokémon to select the strictly best match (`score 0` exact/confusable-normalized > `score 1` 1-edit/7+ char prefix > `score 2` 2-edit) regardless of team order (`Tinkaton / Mimikyu / Swampert` or `Swampert / Mimikyu / Tinkaton`).
  - Added High-Contrast B&W nameplate extraction (`createHighContrastWhiteTextBitmap`) for the top-left player nameplate (`srcPlayer`) alongside 5-variant OCR confusable normalization (`rn -> m`, `1 -> i/l`, `0 -> o`, `v -> y`, `vv -> w`) so `"Swarnpert"` normalizes directly to `"swampert"` (exact match, score `0`).
  - Added horizontal team-chip-bar rejection and length guards so 6-character overlay team chips (`Tinkat`, `Mimiky`, `Swampe`) or shared default CPs (`1500` / `2500`) never pull the active Pokémon back to Slot 0 (Lead).
  - Updated bottom Charged Move button fallback to require a strictly unique best score across all 3 team members (`bestScore >= 3 && bestScore > secondBestScore`) so shared moves (e.g., `Play Rough`) or ties never default to Lead.
- **Single-Tap "Stop Battle Overlay" Button Restoration (`MainActivity` & `OverlayService`)**:
  - Fixed `stopOverlayService()` where `syncOverlayRunningUiState()` read `OverlayService.isInstanceRunning` before the asynchronous stop intent was processed, requiring two taps on **Stop Battle Overlay** to restore **Start Battle Overlay**.

## [v3.12] — 2026-10-21 — Top-5 Role Upgrades (Top-200 Candidates vs. Top-100 Meta), Core Coverage BR (Core BR), Enhanced Mimikyu 2-Strategy Disguise Math & Aegislash Shield/Sword Energy + Damage Shift
- **Top-5 Role Upgrade Recommendations (`Top-200` Candidate Pool vs. `Top-100` Blended Meta)**:
  - Expanded role upgrade recommendations in both the Android and Web Team Editors to display the **Top 5 distinct-species alternatives per role** (`#1 Lead`, `#2 Safe Swap`, `#3 Closer`) with one-tap replacement chips.
  - Increased candidate simulation depth to the **Top 200 Meta Pokémon** for the active league (including eligible Shadow variants and enforcing the GBL species clause) evaluated against the **Top 100** blended current-season meta distribution.
- **Renamed `Mach BR` (`Machine Aggregate BR`) → `Core BR` (`Core Coverage BR`)**:
  - Renamed unclear `Mach BR` / `Machine Aggregate BR` labels to **`Core BR`** / **`Core Coverage BR (Core BR — 3-Mon Team Ceiling)`** across all team preset cards, Team Editor badges, role upgrade chips, and Settings threshold scales while preserving backward-compatible preference keys.
- **Enhanced Mimikyu `Disguise` Simulation (Two-Strategy Shield Ordering Average + Opponent Fastest Charged Move Baiting)**:
  - Updated Mimikyu's discrete shield battle rating math (`0v0` through `2v2`) to compute the exact average of **(a) using all Protect Shields before busting Disguise** (preserving `100%` Defense longer) and **(b) busting Disguise first before using Protect Shields** (absorbing the first throw for `0 HP` and dropping to Busted Form `-1 Defense` stage / `1.20x` incoming damage).
  - Models intelligent opponent baiting: while Mimikyu's Disguise is intact, the opponent always throws their **fastest (lowest-energy) Charged Attack** knowing it will be negated by either a Protect Shield or Disguise.
- **Enhanced Aegislash `Stance Change` Simulation (Shield ⇄ Sword Forme Damage AND Energy Generation Shift)**:
  - Explicitly models the shift in **both Fast/Charged Move damage AND Fast Move energy generation** between **Shield Forme** (`97 Atk / 291 Def`, `1 HP` fast damage, boosted `1.28x` high energy generation) and **Sword/Blade Forme** (`291 Atk / 97 Def`, full `291 Atk` fast & charged damage, `0.78x` lower energy generation rate and `97 Def` vulnerability until reverting to Shield Forme via a Protect Shield).

## [v3.11] — 2026-10-21 — Top-100 Role Upgrade Recommendations, Unique Ability Battle Ranking Math (Morpeko / Mimikyu / Aegislash / Cramorant), ABB/ABC Auto-Detection & Position-Weighted Shield Ratings
- **Top-100 Role Upgrade Recommendation Engine (`#1 Lead`, `#2 Safe Swap`, `#3 Closer`)**:
  - Added an on-demand **`✨ Suggest Top-100 Role Upgrades (3 Per Role)`** button inside the Create Team and Edit Team dialogs (Android & Web) with **3 one-tap replacement chips** beneath Slot 1, Slot 2, and Slot 3.
  - Simulates the **Top 100 Meta Pokémon** for the selected league (including eligible Shadow variants) against your blended current-season meta distribution while enforcing the **GBL species clause** (no duplicate base species across your 3 slots and at most 1 Mega in Mega Master League).
  - Ranks candidates for each slot by combining **Full Team Synergy (`ΔTeamMachBR`)** and **Role Rating Delta (`ΔRoleBR`)** plus defensive coverage bonuses ($0.55 \cdot \Delta\text{MachBR} + 0.45 \cdot \Delta\text{RoleBR} + \text{CoverageBonus}$), and immediately populates the Pokémon, PvPoke recommended moveset, CP, and updated team ratings on a single tap.
- **Unique Form-Change & Signature Ability Battle Ranking Math (`Morpeko`, `Mimikyu`, `Aegislash`, `Cramorant`)**:
  - **Morpeko (`Hunger Switch` + `Aura Wheel`)**: Models alternating Full Belly (Electric) and Hangry (Dark) STAB `Aura Wheel` cycles with its guaranteed `+1 Attack` stage self-buff (`1.25x` compounding up to `+4` stages / `2.0x`) across every charged move cycle.
  - **Mimikyu (`Disguise`)**: Models the intact Disguise absorbing the first unshielded incoming Charged Attack for `1 HP` (acting as a free extra shield in 0s/1s/2s scenarios), followed by the Busted Form `-1 Defense` stage drop (`0.8x` Defense multiplier).
  - **Aegislash (`Stance Change: Shield Forme ⇄ Blade Forme`)**: Models Shield Forme (`97 Atk / 291 Def`) tanking incoming damage while generating energy with 1-damage fast moves, transforming into Blade Forme (`291 Atk / 97 Def`, ~`2.98x` Attack) right before executing Charged Attacks (`Shadow Ball` / `Flash Cannon` / `Gyro Ball`), and reverting to Shield Forme when spending a Protect Shield.
  - **Cramorant (`Gulp Missile: Gulping / Gorging Form`)**: Models `Surf` loading Arrokuda (`> 50% HP`) or Pikachu (`≤ 50% HP`), dealing automatic `12.5%` max-HP retaliation counter-damage when attacked and inflicting a guaranteed `-1 Defense` stage drop (`0.8x` Defense) in Gulping Form or `-1 Attack` stage drop (`0.8x` Attack) in Gorging Form.
- **Non-Blocking Background Evaluation & Instant Team Switching**:
  - Eliminated UI thread stalls and redundant recalculation loops when switching teams or editing presets by moving heavy team evaluation and Top-100 recommendation simulations onto background worker threads (`Dispatchers.Default`) and memoizing per-preset battle rating metrics.
  - Restricted manual slot reordering buttons (`#1 ⇄ #2`, `#2 ⇄ #3`) and `⚡ Auto-Detect Style & Order Swap` exclusively to the **Team Editor** modal so the main Team Select screen stays fast and uncluttered.
- **Auto Team Style Classification (`ABB` vs. `ABC`) & Smart Slot Reordering**:
  - Evaluates pairwise defensive type vulnerabilities across all 3 team members and tests whether the candidate Lead resists shared backline weaknesses (`≥ 2` shared weaknesses or `1` critical meta weakness):
    - **`ABB` Lineups**: Automatically moves the resisting `A` Pokémon to **Slot 1 (Lead)**, places the higher bait-pressure / faster energy `B` Pokémon into **Slot 2 (`Bait Swap B1`)**, and places the higher closing-power `B` Pokémon into **Slot 3 (`Sweeper B2`)**.
    - **`ABC` Lineups**: Keeps **Slot 1 (Lead)** fixed, places the backline Pokémon with the highest volatility-adjusted `Swap BR` ($\mu - 0.5\sigma$) into **Slot 2 (`Safe Swap`)**, and places the remaining Pokémon into **Slot 3 (`Closer`)**.
- **Current-Season Blended Meta & Exponential Recency Decay (`0–50` Match Ramp)**:
  - Calculates expected opponent probability distributions $P_{\text{lead}}(p)$ (from opponent leads) and $P_{\text{field}}(p)$ (from all 3 opponent Pokémon) strictly from **current GBL season** battle logs blended with active league PvPoke rankings.
  - Scales historical battle log weight linearly from `0%` at `0` matches up to `70%` at `50+` current-season matches ($w_{\text{hist}} = 0.70 \times \min(1, N / 50)$, $w_{\text{meta}} = 1 - w_{\text{hist}}$) and weights more recent logs exponentially higher ($W(k) = e^{-0.05 \cdot (k - 1)}$).
- **Position-Weighted Shield Scenario Ratings & Per-Slot Battle Rating Badges**:
  - **Slot 1 (`Lead`)**: $0.50 \cdot BR_{2v2} + 0.50 \cdot BR_{1v1}$ (`Lead Agg BR` color-coded by `SW / W / N / L / SL` thresholds).
  - **Slot 2 (`Safe Swap / Pivot`)**: $0.60 \cdot BR_{1v1} + 0.25 \cdot BR_{2v1} + 0.15 \cdot BR_{1v0}$ with volatility penalty $\mu_{\text{Swap}} - 0.5\sigma_{\text{Swap}}$.
  - **Slot 3 (`Closer / Sweeper`)**: $0.60 \cdot BR_{0v0} + 0.25 \cdot BR_{1v0} + 0.15 \cdot BR_{0v1}$, plus side-by-side **Swap BR** badges on both Slot 2 and Slot 3 and customizable **Machine Aggregate BR (`Mach BR`)** 5-tier thresholds in **⚙️ Settings**.
