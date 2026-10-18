# Per-League & Team Battle Logging, Interactive Matchup Replay, Lead Matchup, Season Export & Two-Device Delta Sync

Add one-tap in-overlay battle result logging (`⚔️ Start Battle` → `🏆 Record Win`, `💀 Record Loss`, `🔄 Restart & Don't Log`), **Interactive Post-Game Overlay Replay** when clicking any logged battle, **Lead Matchup classification (`Favorable`, `Neutral`, `Negative`)**, **fixed opponent discovery order (`1st seen`, `2nd seen`, `3rd seen`)**, **in-app battle modification & deletion**, **CRDT-style delta reconciliation sync across two or more devices**, and a plain-text exporter supporting **Day (Today)**, **Week (Last 7 Days)**, **Current Season**, **Previous Season** (scraped live from the **ScrapedDuck API**), and **All Time**.

## User Review & Critical Decisions

> [!IMPORTANT]
> All product decisions below incorporate your confirmed choices, including **Interactive Overlay Replay on Battle Log cards**, **ScrapedDuck API Season scraping (`Current Season` / `Previous Season`)**, **in-app Edit & Delete for logged battles**, **Lead Matchup (`Favorable`, `Neutral`, `Negative`)**, fixed opponent order in the overlay, and two-device delta reconciliation:

- **Confirmed Decision 1 (Interactive Post-Game Overlay Replay When Clicking a Logged Battle)**:
  - Clicking/tapping any battle card in the **Battle Log** opens an **Interactive Post-Game Overlay Inspector** loaded with that match's exact **League**, **Your 3 Pokémon (`p1`, `p2`, `p3`)**, and the **Opponent's 3 Pokémon (`[1st seen, 2nd seen, 3rd seen]`)**.
  - Renders the full interactive overlay HUD (`3v3 Matchup Matrix` with `0s/1s/2s` shield ratings, `Opponent Moves & Cycle Counts`, `My Attacks 3-Column Damage Table`, and `Tactical Recommendation Banner`).
  - Lets you interactively tap between any of your 3 Pokémon and any of the 3 opponents (plus test alternative opponent moves via the move-override picker) to analyze optimal switches, shield scenarios, and damage breakpoints after the match.
- **Confirmed Decision 2 (Season Filtering & Export via ScrapedDuck API)**:
  - Automatically fetches `https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json` and extracts `eventType == "season"` (e.g., `"Twilight Trails"`, `start: "2026-09-08T10:00:00.000"`, `end: "2026-12-01T10:00:00.000"`).
  - Caches scraped season boundaries locally alongside historical GBL season windows so both **Current Season** (with live season name & start date from ScrapedDuck) and **Previous Season** (the 3-month GBL season immediately preceding `currentSeason.start`) are always available for filtering and plain-text export (`Day`, `Week`, `Current Season`, `Previous Season`, `All Time`).
- **Confirmed Decision 3 (Modify or Delete Any Logged Battle in App + Sync Reconciliation)**:
  - Every Battle Log card in the app includes **`✏️ Edit`** and **`🗑️ Delete`** actions:
    - **`✏️ Edit Battle`**: Modify the **Result (`WIN` / `LOSS`)**, **Lead Matchup (`Favorable` / `Neutral` / `Negative`)**, **Team Preset / League**, and **Opponent Pokémon (`1st seen`, `2nd seen`, `3rd seen`)**. Bumps `updatedAt` so edits propagate across both devices during sync.
    - **`🗑️ Delete Battle`**: Removes the battle from the log and records its `id` in `deletedLogIds` tombstones so two-device delta sync deletes it on your other device as well.
- **Confirmed Decision 4 (Lead Matchup Classification in Battle Log & Export)**:
  - Every logged battle records whether the **Lead Matchup** (Your Slot #1 Lead vs. Opponent's 1st-Seen Lead) was **`Favorable`**, **`Neutral`**, or **`Negative`** (auto-computed from the 3v3 Matchup Matrix `SW`/`W` → `Favorable`, `N` → `Neutral`, `L`/`SL` → `Negative`, with 1-tap manual override).
- **Confirmed Decision 5 (Fixed Opponent Order in Overlay: 1st Seen, 2nd Seen, 3rd Seen)**:
  - Opponents in the overlay's **3v3 Matchup Matrix** and **My Attacks 3-column damage table** **never reorder** when an opponent switches or when you tap a row to change the active opponent. Slot 1 is always **1st seen (Lead)**, Slot 2 is **2nd seen**, and Slot 3 is **3rd seen**.
- **Confirmed Decision 6 (Log Result Behavior & Two-Device Delta Reconciliation)**:
  - Tapping **Record Win** or **Record Loss** in the overlay menu logs the battle immediately while **keeping the current opponents on screen**. Tapping **Restart (Don't Log)** clears the scanned opponents for the next match.
  - Every sync uses a strict **Pull → Reconcile Deltas → Push** cycle, merging newly logged battles, propagating edited battles via `updatedAt`, and honoring `deletedLogIds` / `deletedTeamIds` tombstones.

---

## 1. Overview & Core Concept

- **What It Does**: Locks opponent slots in the floating HUD to their exact discovery order (`1st seen`, `2nd seen`, `3rd seen`), replaces `↺ Reset Opp` with **`⚔️ Start Battle`** (`🏆 Win`, `💀 Loss`, `🔄 Restart` + `Lead: Favorable | Neutral | Negative`), lets you **tap any logged battle to open an interactive post-game overlay replay** to explore matchup lines and move counts, scrapes active GBL Season start/end dates from the **ScrapedDuck API**, lets you **edit or delete** any logged match, syncs deltas across your devices, and exports daily-grouped plain-text reports for **Today**, **This Week**, **Current Season**, **Previous Season**, or **All Time**.
- **Target Audience / Persona**: Competitive Pokémon GO Battle League players who play across two devices and want stable visual muscle memory in the overlay HUD, interactive post-match replay analysis, automatic lead matchup analytics, season-long record tracking, and delta reconciliation.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Fixed Opponent Discovery Order (`1st Seen`, `2nd Seen`, `3rd Seen`) in Overlay**:
     - Slot 1 is always the 1st opponent seen (Lead), Slot 2 is the 2nd opponent seen, and Slot 3 is the 3rd opponent seen. Switching opponents moves the active highlight without reordering rows or columns.
  2. **In-Overlay `⚔️ Start Battle` Action Menu with Lead Matchup Indicator**:
     - Tapping **`⚔️ Start Battle`** toggles a compact action bar inside the overlay:
       - **Lead Matchup Toggle (`Lead: Fav` | `Neu` | `Neg`)**: Auto-selected from your Lead (`p1`) vs. Opponent Lead (`1st seen`) and tappable to override.
       - **`🏆 Win`** / **`💀 Loss`**: Logs the battle result with the active Lead Matchup and `[1st seen, 2nd seen, 3rd seen]` opponents, keeps opponents on screen, and triggers background delta sync.
       - **`🔄 Restart`**: Clears scanned opponents for the next battle without logging.
  3. **Interactive Post-Game Overlay Replay (Clicking Any Logged Battle Card)**:
     - Clicking/tapping a battle card in the **Battle Log** opens the **Interactive Matchup Replay** dialog:
       - On **Android**: Hosts the full interactive `overlay.html` HUD in an in-app Replay Dialog pre-populated via a shared battle payload builder with your logged team (`userPokemon`) and the opponent's 3 Pokémon (`[1st seen, 2nd seen, 3rd seen]`).
       - On **Web**: Opens an interactive overlay inspector modal with the full 3v3 shield matrix (`0s/1s/2s`), clickable active-opponent & active-user-Pokémon selectors, opponent move-override picker, fast/charged cycle counts, and 3-column damage breakdown.
       - Allows you to click any of your 3 Pokémon or any of the 3 opponents (and toggle opponent move overrides) to see how different swap alignments or shield decisions play out.
  4. **In-App Battle Log Modification (`✏️ Edit`) & Deletion (`🗑️ Delete`)**:
     - Each match card on the **Battle Log** page includes action buttons alongside the card replay:
       - **`🔍 Replay` / Tap Card**: Opens the interactive overlay matchup analyzer for that battle.
       - **`✏️ Edit`**: Modify `WIN` ↔ `LOSS`, `Lead: Favorable / Neutral / Negative`, **Team Preset / League**, or the **1st, 2nd, and 3rd opponent Pokémon** names.
       - **`🗑️ Delete`**: Deletes the battle entry and records a deletion tombstone so syncing won't resurrect deleted logs.
  5. **ScrapedDuck API Season Detection & Timeframe Export (`Day` | `Week` | `Current Season` | `Previous Season` | `All Time`)**:
     - Automatically fetches `https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json`, extracts `eventType == "season"`, and updates the cached season timeline (e.g., **Current Season: Twilight Trails (Sep 8 – Dec 1, 2026)** and **Previous Season (Jun 1 – Sep 8, 2026)**).
     - Example exported plain-text format:
       ```text
       BattleMatrix GBL Log — Great League
       Team: Great: Clodsire / Feraligatr / Mandibuzz
       Range: Current Season (Twilight Trails • Since Sep 8, 2026)
       Overall: 48W - 22L (69%) • Leads: 26 Fav / 24 Neu / 20 Neg

       === Oct 17, 2026 — Daily Record: 4W - 1L (80%) [Leads: 2 Fav, 2 Neu, 1 Neg] ===
       [6:42 PM] WIN  | Lead: Favorable | Great: Clodsire / Feraligatr / Mandibuzz vs. 1st: Azumarill, 2nd: Shadow Feraligatr, 3rd: Clodsire
       [6:38 PM] LOSS | Lead: Negative  | Great: Clodsire / Feraligatr / Mandibuzz vs. 1st: Gastrodon, 2nd: Corviknight, 3rd: Wigglytuff
       ```

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Shared Battle Payload Generator for Live Overlay & Post-Game Replay**
  - *Chosen Approach*: Extract/expose a standalone battle-matrix payload builder in `OverlayService` / `MainActivity` (and in `src/App.tsx`) that accepts `(league, userTeamPokemon, opponentsList, activeOpponentIndex, activeUserIndex, moveOverrides)` and feeds the exact same `updateBattleData(json)` structure into `overlay.html` (on Android) and the interactive HUD component (on Web).
  - *Why*: Guarantees 100% parity between the live in-battle overlay and the post-game replay analyzer—every shield dot (`0s/1s/2s`), move cycle count, damage percentage, and move-override works identically when reviewing past battles.
- **Decision 2: Live Season Start Dates from ScrapedDuck API + Persistent Season Registry**
  - *Chosen Approach*: Query `https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json` for `eventType == "season"` and maintain a sorted local season registry so both `Current Season` and `Previous Season` date boundaries are always accurate.
- **Decision 3: Mutable Battle Log Entries (`updatedAt`) + Deletion Tombstones (`deletedLogIds`)**
  - *Chosen Approach*: Each `BattleLogEntry` includes `updatedAt: Long` so in-app edits reconcile via Last-Write-Wins and deletions propagate via `deletedLogIds` across both devices.

---

## 4. Technical Architecture & Data Strategy

### Architecture Diagram

```text
┌────────────────────────────────────────────────────────────────────────────┐
│                   SCRAPEDDUCK API (events.min.json)                        │
│  • Scrapes eventType == "season" (Name, Start ISO Date, End ISO Date)      │
│  • Populates Current Season & Previous Season date windows                 │
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                        FLOATING OVERLAY HUD (WebView)                      │
│  • Fixed Opponent Order: [1st Seen | 2nd Seen | 3rd Seen] (Never reorders) │
│  • [⚔️ Start Battle] ──► [Lead: Fav|Neu|Neg] [🏆 Win] [💀 Loss] [🔄 Restart]│
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│               PULL ──► RECONCILE DELTAS ──► PUSH ENGINE                    │
│  • Logs  = Per-ID max(local.updatedAt, remote.updatedAt) \ deletedLogIds   │
│  • Teams = Per-ID max(local.updatedAt, remote.updatedAt) \ deletedTeamIds  │
└───────────────────────────────────────┬────────────────────────────────────┘
                                        │
                                        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                     PAGE 3: 📜 BATTLE LOG & TEXT EXPORTER                  │
│  ├─ Filters: [League ▾] [Team ▾] [Day | Week | Curr Season | Prev | All]   │
│  ├─ Click Any Card / [🔍 Replay]:                                          │
│  │    └──► Opens Interactive Overlay Replay Modal (3v3 Matrix, Switch      │
│  │         Active User/Opp Pokémon, Override Opponent Moves, Damage Table) │
│  ├─ Per-Card Actions: [✏️ Edit (W/L, Lead, Team, Opponents)] [🗑️ Delete]    │
│  └─ Export Actions:   [☁️ Sync] [📋 Copy Text] [📤 Share (Select Range)]    │
└────────────────────────────────────────────────────────────────────────────┘
```

### Data Model
- **`BattleLogEntry`**:
  - `id: String`: Unique UUID
  - `timestampMs: Long`: Epoch milliseconds when battle was played
  - `updatedAt: Long`: Epoch milliseconds when entry was last created or modified
  - `league: String`: Active league (`GREAT LEAGUE`, `ULTRA LEAGUE`, `MASTER LEAGUE`, `MEGA MASTER LEAGUE`)
  - `presetId: String`: ID of the user's team preset
  - `userTeamName: String`: Display name of the user's team preset
  - `userPokemon: List<String>`: The 3 Pokémon on the user's team
  - `opponents: List<String>`: Up to 3 opponent Pokémon in fixed discovery order (`[1st seen, 2nd seen, 3rd seen]`)
  - `leadMatchup: String`: `"FAVORABLE"` | `"NEUTRAL"` | `"NEGATIVE"`
  - `result: String`: `"WIN"` | `"LOSS"`
  - `deviceLabel: String`: Source device identifier
- **`SeasonInfo` (Scraped from ScrapedDuck API)**:
  - `id: String`: e.g. `"season-24-twilight-trails"`
  - `name: String`: e.g. `"Twilight Trails"`
  - `startMs: Long`: Parsed epoch ms from ScrapedDuck `start`
  - `endMs: Long`: Parsed epoch ms from ScrapedDuck `end`
