# SilphScope PvP Changelog (Since v3.00)

## [v3.07] — 2026-10-21 — League-Rated Default Form & Shadow Selection, Strict Mew/Mewtwo Disambiguation, Same-Day Repeated Lead Highlighting & Yesterday Filter
- **Highest-Rated League Default Form & Shadow Selection on Scan (`FormResolver` & `OverlayService`)**:
  - Scanning an opponent with multiple forms or Shadow variants now evaluates all form variants and their `_shadow` counterparts against the active league's live PvPoke rankings (plus curated current-meta fallbacks) and selects the highest-rated form + Shadow state automatically:
    - **Great League (`1500`)**: Scanning `"Ninetales"` (without `"Alolan"` in the OCR nameplate) defaults to **Shadow Kanto Ninetales**.
    - **Ultra League (`2500`)**: Scanning `"Mewtwo"` defaults to **Armored Mewtwo** (`Mewtwo (Armored)`).
    - **Master League (`10000`)**: Scanning `"Mewtwo"` defaults to **Shadow Mewtwo**.
  - Added `Mewtwo (Armored)` (`Confusion` + `Psystrike` / `Dynamic Punch` / `Earthquake`) and `Mew` (`Shadow Claw` + `Psyshock` / `Wild Charge` / `Surf`) to static + live metadata and recommended movesets.
- **Strict `Mew` vs. `Mewtwo` Disambiguation**:
  - Enabled exact 3-letter token matching for `"Mew"` while adding strict disambiguation guards across OCR prefix matching, Levenshtein sliding-window matching, player switch detection, and stats lookups so `"Mew"` never evaluates as `"Mewtwo"` and `"Mewtwo"` never evaluates as `"Mew"`.
- **Battle Log: Same-Day Repeated Lead Highlighting, `/ # Unique` Lead Counts & Markdown Share Bold**:
  - **Unique Lead Counts (`/# Unique`)**: Added `/ # Unique` right after `/ # Neg` across the Battle Log top summary, daily record headers, and Share log output (`Leads: # Fav / # Neu / # Neg / # Unique`).
  - **In-App Repeated Daily Lead Highlighting**: When the same opponent lead is faced more than once on the same calendar day, all matching battle cards on that day are highlighted with an accent border, highlighted `1st: <Lead> 🔁` text, and a chronological **`🔁 Repeat Lead (#1 of 2 Today)` / `🔁 Repeat Lead (#2 of 2 Today)`** badge so you can evaluate whether you adapted and improved the second time.
  - **Markdown Share Highlighting**: Repeated same-day opponent leads are automatically wrapped in Markdown bold syntax (`**lead_name**`) in the Share log summary.
- **New `"Yesterday"` Timeframe Filter**:
  - Added **`Yesterday`** to the Battle Log page timeframe filter dropdown and the **Share** / **Copy GBL** timeframe chooser dialogs.

---

## [v3.06] — 2026-10-20 — Dual-Accent Theme Engine Overhaul, Shiny Origin Forme Dialga Midnight Theme, Complete Modal/Button Theming & Enhanced Page Transparency
- **New ✨ Shiny Origin Forme Dialga Midnight Theme (`dialga_shiny_midnight`)**:
  - Replaced legacy AMOLED Cyber Pulse Cyan & Matrix Phosphor Green themes with **✨ Shiny Origin Dialga Midnight (Dark)** (`#050B16` deep temporal void, `#2DD4BF` luminous shiny teal primary accent, `#FACC15` astral ring gold secondary accent, and custom vector Origin Forme Dialga temporal wheel & diamond core emblem).
- **Dual-Accent Color Palettes Across All 9 Themes**:
  - Added a distinct secondary accent color (`secondaryAccentColor` / `secondaryButtonColor` + 5-dot swatch preview in Settings) to every theme for richer visual depth across headers, badges, slot titles, and secondary action buttons.
  - **🎀 Sylveon Fairy Ribbon**: Paired Fairy Ribbon Pink (`#EC4899`) with Sylveon's signature **Pastel Sky Blue** (`#38BDF8`) secondary accent.
  - **⚡ Team Instinct (Dark & Light)**: Paired Zapdos Lightning Gold with Storm Sky Cyan (`#38BDF8`) and Electric Cobalt (`#0284C7`).
  - **❄️ Team Mystic (Dark & Light)**: Paired Articuno Ice Blue with Aurora Borealis Violet (`#C084FC`) and Royal Frost Indigo (`#7C3AED`).
  - **🔥 Team Valor (Dark & Light)**: Paired Moltres Crimson with Molten Solar Gold (`#FBBF24`) and Phoenix Amber (`#D97706`).
  - **🛡️ SilphScope Slate (Default Generic)**: Placed last in the theme selector as a clean generic fallback with Sky Cyan (`#38BDF8`) & Tactical Amber (`#F59E0B`).
- **Complete Action Button, Team Edit & Replay Matrix Theming**:
  - Fixed Android `MaterialButton` background tint resolution and explicitly themed all action buttons across the app:
    - **Top Bar & Overlay**: `Start Battle Overlay` / `Stop Battle Overlay`, `❓ Help`, `☕ Support`, and the floating overlay's `⚔️ Start Battle` button.
    - **Battle Log Page**: `+ Log`, `☁️ Sync`, `🗑️ Trash`, `Clear`, `📋 Copy GBL`, and `📤 Share`.
    - **Settings Page**: `💾 Save Thresholds`, `↺ Restore Defaults`, all 3 cloud sync buttons (`🔑 Login with GitHub`, `☁️ Sync Devices Now`, `📦 Sync Bundle`), `Sync PvPoke`, `🔄 Reparse All`, and Tasker hook buttons.
  - **Themed Team Edit & Manual Battle Log Modals**: Added active theme backgrounds, dual-accent Lead / Safe Swap / Closer slot headers, themed inputs, and centered background emblem watermarks when enabled.
  - **Themed Replay Overlay Matrix & Watermark**: Styled the main app's interactive post-game replay overlay matrix with the active theme's background, primary/secondary accent colors, and centered emblem logo watermark.
- **Enhanced Transparency Across All 3 Main Pages (`Teams`, `Battle Log`, `Settings`)**:
  - Increased background emblem watermark visibility (`alpha` `0.22`–`0.25`) and reduced card/surface opacity across all 3 main pages when watermarks are enabled so the centered team/Pokémon crest shines through cleanly.

---

## [v3.05] — 2026-10-20 — Interactive Overlay Header Shield Counters & Live Matrix Recalculation
- **Interactive Header Shield Counters (`🛡️ You` & `🛡️ Opp`)**:
  - Added interactive shield counter buttons for both the player and opponent directly in the floating overlay's top header row.
  - Tapping either shield icon cycles remaining shields (`2 → 1 → 0 → 2`) mid-battle, automatically dims with a strike-through at `0` shields, logs `SHIELD` timeline events during active matches, and immediately recalculates the 3x3 PvPoke matchup matrix and threat thresholds.

---

## [v3.03] — 2026-10-20 — Dynamic Overlay Emblem Icons & Recursive UI Theme Engine
- **Dynamic Theme Emblem Icons on Floating Overlay**:
  - Updated the floating overlay's upper-left minimize button, minimized floating bubble, and `Start Battle` button to display vector SVG emblems matching the active theme.
- **Recursive View-Tree Theming**:
  - Added recursive theme traversal across Android layouts, spinners, switches, and cards.

---

## [v3.02] — 2026-10-20 — Theme Engine, Background Emblem Watermarks & Reorganized Settings
- **Multi-Theme Engine & Background Watermarks**:
  - Introduced the app-wide & overlay theme engine with Pokémon GO Team (Instinct ⚡, Mystic ❄️, Valor 🔥) and Sylveon 🎀 vector emblem watermarks.
  - Reorganized the **⚙️ Settings** page to group **App & Overlay Theme**, **Overlay Size (% of Screen Width)**, and **Overlay Background Transparency** together in the top card.
