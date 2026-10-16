# Persistent Teams, PvPoke Top 3 Defaults, Auto-Filled Moves & League CP/IV Damage Scaling (`v1.11`)

This plan addresses team/settings persistence across updates, updates default teams and custom team creation templates to the **PvPoke Top 3 rated Pokémon per league**, adds **automatic recommended Fast & Charged move auto-fill** when entering a Pokémon name, and upgrades the battle math engine with **exact League CP / CPM scaling and optional custom IVs** (auto-defaulting to PvPoke standard IVs when left blank).

---

## 1. Permanent Team & Settings Persistence Across Updates
- **Root Cause Fixed**: Previously, bumping the internal `SharedPreferences` key name (e.g., `gbl_team_presets_v5` → `gbl_team_presets_v6`) caused `MainActivity.loadPresets()` to see an empty key on update and re-seed default teams.
- **Permanent Storage & Multi-Version Migration (`MainActivity.kt` & `OverlayService.kt`)**:
  - Use a permanent canonical key `gbl_user_teams_persistent` in `SharedPreferences` (`gbl_overlay_prefs`).
  - On load, if `gbl_user_teams_persistent` is not yet populated, automatically scan and migrate existing user teams from `gbl_team_presets_v6`, `gbl_team_presets_v5`, `gbl_team_presets_v4`, `gbl_team_presets_v3`, `gbl_team_presets_v2`, and `gbl_team_presets`, saving them directly into `gbl_user_teams_persistent`.
  - Existing saved teams seamlessly support optional IV fields (`atkIv`, `defIv`, `hpIv`) without breaking or resetting existing team data.
  - Never overwrite `gbl_user_teams_persistent`, `gbl_selected_preset_id`, `opp_count_mode`, or `overlay_scale_pct` when any saved value already exists.
- **Web App LocalStorage Persistence (`src/App.tsx`)**:
  - Persist custom teams (`gbl_user_teams_persistent`, with automatic fallback migration from any legacy key) and `gbl_selected_preset_id` to `localStorage` so teams and settings are preserved across sessions and updates.

---

## 2. PvPoke Top 3 Default Teams & Custom Team Creation Templates
- **Default Teams (Only Seeded When No Persisted Teams Exist)**:
  - **Master League (`MASTER LEAGUE`) — PvPoke Top 3**:
    1. **Palkia (Origin)** (CP 4683, IVs `15/15/15` — `Dragon Breath` | `Spacial Rend`, `Aqua Tail`)
    2. **Zacian (Crowned)** (CP 4658, IVs `15/15/15` — `Metal Claw` | `Behemoth Blade`, `Close Combat`)
    3. **Dialga (Origin)** (CP 4624, IVs `15/15/15` — `Dragon Breath` | `Roar of Time`, `Iron Head`)
  - **Ultra League (`ULTRA LEAGUE`) — PvPoke Top 3**:
    1. **Zygarde** (CP 2472 — `Dragon Tail` | `Crunch`, `Earthquake`)
    2. **Feraligatr** (CP 2488 — `Shadow Claw` | `Hydro Cannon`, `Ice Beam`)
    3. **Giratina (Altered)** (CP 2497 — `Shadow Claw` | `Dragon Claw`, `Ancient Power`)
  - **Great League (`GREAT LEAGUE`) — PvPoke Top 3**:
    1. **Clodsire** (CP 1494 — `Poison Sting` | `Earthquake`, `Stone Edge`)
    2. **Feraligatr** (CP 1498 — `Shadow Claw` | `Hydro Cannon`, `Ice Beam`)
    3. **Mandibuzz** (CP 1496 — `Snarl` | `Dark Pulse`, `Aerial Ace`)
- **Create Custom Team Template Defaults**:
  - Update `dialog_create_preset.xml`, `MainActivity.showPresetEditorDialog()`, and `src/App.tsx` so creating a new team uses the selected league's **PvPoke Top 3** Pokémon as the template names/hints (`Clodsire / Feraligatr / Mandibuzz` for Great League, `Zygarde / Feraligatr / Giratina (Altered)` for Ultra League, `Palkia (Origin) / Zacian (Crowned) / Dialga (Origin)` for Master League).

---

## 3. Auto-Fill Recommended Fast & Charged Moves When Entering Pokémon Name
- **Lookup Engine (`OverlayService.resolveRecommendedMovesForSpecies` & `gblData.getRecommendedMovesForPokemon`)**:
  - Searches both the built-in `POKEMON_META_DATABASE` (including `RECOMMENDED_CHARGED_MOVES`) and the cached PvPoke `gamemaster.json` (`DYNAMIC_POKEMON_DATABASE`) using case-insensitive and fuzzy species/form matching.
- **Interactive & On-Save Auto-Fill (`MainActivity.kt` & `src/App.tsx`)**:
  - **On Focus Loss / Name Entry**: In the Team Preset Editor dialog, when the user finishes typing a Pokémon name (or leaves the Pokémon Name field), any blank `Fast Move`, `Charged Move 1`, `Charged Move 2`, or `CP` / `IV` placeholders are automatically populated with that Pokémon's PvPoke recommended moveset and league-optimal CP/IV hint.
  - **On Save Fallback**: If the user types a Pokémon name, leaves the move fields blank, and immediately taps **Save Team**, the save handler resolves that Pokémon's PvPoke recommended Fast Move, Charged Move 1, and Charged Move 2.

---

## 4. League CP Scaling & Optional Custom IVs (Exact Pokémon GO Damage Math)
- **Why This Improves Damage Accuracy**:
  - Instead of comparing raw unscaled base stats across all leagues, the engine now computes **true level-scaled combat stats** (`effectiveAtk`, `effectiveDef`, `effectiveSta` = $\lfloor(\text{Base} + \text{IV}) \times \text{CPM}\rfloor$) for the active league cap (`1500` Great, `2500` Ultra, `Unlimited / Lv50` Master) or the Pokémon's exact entered CP.
  - Uses the official Pokémon GO PvP damage formula:
    $$\text{Damage} = \left\lfloor 0.5 \times \text{Power} \times \frac{\text{EffectiveAtk}}{\text{EffectiveDef}} \times \text{STAB} \times \text{TypeEffectiveness} \times \text{ShadowMultiplier} \times 1.3 \right\rfloor + 1$$
    $$\text{HP \%} = \frac{\text{Damage}}{\text{EffectiveHP}} \times 100$$
- **PvPoke Default IV Solver (Zero Configuration Required)**:
  - **Master League**: Automatically defaults to `15 / 15 / 15` (Level 50, `CPM = 0.84029999`) for both player and opponent Pokémon when IVs are left blank.
  - **Great League (`1500`) & Ultra League (`2500`)**: Uses PvPoke's `defaultIVs` from `gamemaster.json` when available, or automatically computes the **PvPoke optimal stat-product IV spread** (searching half-levels 1–50 to maximize $\text{Atk} \times \text{Def} \times \text{HP}$ under the 1500 or 2500 CP cap, with `15/15/15` floor rules for Mythicals/Level-50 cap species).
  - If a player enters a custom CP without IVs, or custom IVs (`Atk / Def / HP`, e.g., `0/15/15`), the solver finds the exact `CPM` that matches their Pokémon's league cap / CP and uses their exact `effectiveAtk`, `effectiveDef`, and `effectiveSta`.
- **Optional Compact IV Input in Team Editor (`dialog_create_preset.xml`, `MainActivity.kt`, `src/App.tsx`)**:
  - Adds a single optional **IVs (Atk/Def/HP)** field (e.g., `0/15/15` or `15/15/15`) next to the **CP** input for each of the 3 team slots.
  - Leaving the IV field blank automatically uses the PvPoke default IV spread for that Pokémon and league, recalculating CP and damage percentages automatically.

---

## 5. Release Versioning
- Increment version to **`v1.11`** (`versionCode = 111`, `versionName = "1.11"`) via `./scripts/bump_version.sh` upon approval and publish to GitHub Releases.
