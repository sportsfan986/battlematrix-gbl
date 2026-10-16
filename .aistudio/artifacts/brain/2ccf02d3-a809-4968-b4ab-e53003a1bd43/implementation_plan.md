# Per-Move Fast Timing, Catch Window & Threat Visualization

This update replaces the separate Throw Alignment box and text-only damage rows with a unified, ultra-compact **3-row Per-Move Timing, Catch & Threat HUD**—one row per opponent charged move—where **all timing numbers are strictly in YOUR active Pokémon's fast-move taps**, with an explicit **Green CMP Tie Win indicator** vs **Red Catch indicator** on the opponent's throw turn.

## User Review & Critical Decisions

> [!IMPORTANT]
> Confirmed design choices and revisions incorporated:

- **Confirmed Decision 1 (All Timing Based on YOUR Fast Move Counts)**: Every number in the center timing track (both the `1–2–3–4–5` dots for 3–5T fast moves and the `1–9 SAFE` / `#10` blocks for 1–2T fast moves) represents **YOUR active Pokémon's fast move count** (how many fast attacks *you* tap).
- **Confirmed Decision 2 (Explicit Green CMP Win Indicator on Throw/Catch Turn)**:
  - We compare your active Pokémon's Attack stat against the opponent's Attack stat (`winsCmp = userAtk > oppAtk`).
  - On the fast-move tap where the opponent reaches energy and can throw their charged move:
    - **Green CMP Tie Win (`#16a34a` / `#4ade80`)**: Shown when you **win CMP (`userAtk > oppAtk`)** and your fast move finishes on the opponent's throw turn (`myTap * myFastTurns == oppReadyTurn`). Renders a **Green Node + `CMP✓` label** (3–5T dot mode) or **Green `[⚡ #10 CMP✓]` badge alongside `[🎯 #10 CATCH]`** (1–2T bar mode) so you immediately know you can either **throw on `#N` to win the CMP tie** OR **swap on `#N` to catch**.
    - **Red Catch Window (`#dc2626` / `#f87171`)**: Shown when you **lose CMP (`userAtk <= oppAtk`)** or when your slower fast move would still be mid-animation on the opponent's throw turn. Renders a **Red Node + `🎯 Catch` label** (3–5T mode) or **Red `[🎯 #10 CATCH]` block** (1–2T mode) so you know not to contest CMP and instead swap-catch or shield.
- **Confirmed Decision 3 (Unified 3-Row Layout)**: Replaces the old Throw Alignment box and separate damage text rows with all 3 opponent charged move rows (`c1`, `c2`, `c3`), showing **Active damage % on the left** and **both Bench Pokémon damage % badges on the right**.

---

## 1. Overview & Core Concept

- **How Your Fast Move Tap Count Is Calculated**:
  1. For each opponent charged move (`energyCost`), the opponent needs `oppFastsToReady = ceil(energyCost / oppFastEnergyGain)` fast moves, which takes `oppReadyTurns = oppFastsToReady * oppFastTurns` half-second battle turns.
  2. Converting `oppReadyTurns` into **YOUR fast move taps (`myFastTurns`)**:
     - Each of your fast move taps `#k` starts at battle turn `(k - 1) * myFastTurns` and finishes at battle turn `k * myFastTurns` (when your queued charged move or swap executes).
     - The exact tap `#k` of **your fast move** where the opponent's charged move becomes ready to fire is `catchOrCmpTap = ceil(oppReadyTurns / myFastTurns)`.
- **4-Color Coding for Your Fast Move Taps**:
  - **Blue (`#0284c7` fill / `#38bdf8` border)**: **Safe to Throw (Zero Energy Leak)** — Throwing your charged move after this tap count (`k * myFastTurns % oppFastTurns != 0`) gives the opponent zero free turns, and occurs before their charged move is ready.
  - **Yellow (`#ca8a04` fill / `#facc15` border)**: **Energy Leak Turn / Cap** — Throwing after this tap count lets the opponent sneak/complete a fast move, or marks the 2nd-move energy cap (`#20⚡`).
  - **Green (`#16a34a` fill / `#4ade80` border)**: **CMP Tie Win (`⚡ CMP✓`)** — Opponent's charged move is ready on this tap, their throw turn co-aligns with the end of your fast move `#k`, and **your active Pokémon wins CMP (`userAtk > oppAtk`)** so throwing on tap `#k` fires first!
  - **Red (`#dc2626` fill / `#f87171` border)**: **Opponent Throw / Catch Window (`🎯 CATCH`)** — Opponent's charged move is ready on this tap and you either **lose CMP** or are mid-fast-move; swap to a bench Pokémon on this tap to catch their charged move.

---

## 2. User Experience & Visual Design

- **Row Anatomy (Compact 3-Zone Horizontal Grid per Opponent Move)**:
  ```
  ┌───────────────────┬───────────────────────────────────────────────┬───────────────────────────────┐
  │ LEFT: Move & Actv │ CENTER: YOUR Fast Move Tap Timing Track       │ RIGHT: Bench 1 & Bench 2 Dmg  │
  ├───────────────────┼───────────────────────────────────────────────┼───────────────────────────────┤
  │ [Mode A: Your Fast Move is 3, 4, or 5 Turns — Connected Numbered Tap Dots]                        │
  │ Wld.Chg (45e)     │  (1 blue)──(2 yel)──(3 RED🎯)──(4 GRN⚡)──(5⚡) │ [Dia: 24% Res] [Kyo: 72% WK]  │
  │ 48% on Lug · 3f   │                      ▲Catch    ▲CMP✓          │                               │
  ├───────────────────┼───────────────────────────────────────────────┼───────────────────────────────┤
  │ [Mode B: Your Fast Move is 1 or 2 Turns — Simplified Segmented Tap Bars]                          │
  │ Fire.Pn (40e)     │  [1–9 SAFE (Odd)] [⚡#10 CMP✓ | 🎯CATCH] [#20⚡]│ [Kyo: 21% Res] [Lug: 65% WK]  │
  │ 45% on Dia · 10f  │  (or Red [🎯 #10 CATCH] if you lose CMP)      │                               │
  └───────────────────┴───────────────────────────────────────────────┴───────────────────────────────┘
  ```
- **Left Column Sub-Label (`Active Dmg % · Your Taps to Ready`)**:
  - Top line: Abbreviated move name + energy cost (`Beh.Bld (55e)`, `Frz.Shk (60e)`), colored by threat on your active Pokémon.
  - Bottom line: `48% on Lug · @3t` (shows exact % damage to your active Pokémon and which of **your** fast taps `@3t` / `@10t` the opponent reaches the move).
- **Right Column (Both Bench Pokémon Threat & Catch Badges)**:
  - **Tank / Ideal Catch (`≤ 30%` HP or Resisted `< 0.7x` type eff & `< 45%` HP)**: Deep Blue/Emerald (`#1e40af` / `#065f46` fill, `#60a5fa` / `#34d399` border) — e.g. `Dia: 24% (Res)`.
  - **Neutral / Moderate (`31% – 59%` HP)**: Slate/Amber (`#334155` fill, `#94a3b8` border) — e.g. `Kyo: 38%`.
  - **High Threat / Avoid Swap (`≥ 60%` HP or Super Effective `≥ 1.6x`)**: Deep Crimson (`#7f1d1d` fill, `#f87171` border) — e.g. `Lug: 72% (WK)` or `100% (KO)`.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Exact Fast-Move Energy Gain & Charged-Move Energy Cost Database**
  - *Chosen Approach*: Add `energyCost` to `MoveStats` and `FAST_MOVE_ENERGY` (energy gain per fast move) to `OverlayService.kt` and `gblData.ts`, plus parse `energy` and `energyGain` directly from `pvpoke_gamemaster.json`.
  - *Why*: Allows exact calculation of how many opponent fast moves are needed for each charged move, which is then converted into **your active Pokémon's fast move tap numbers**.
- **Decision 2: Live CMP Tie Evaluation (`userAtk` vs `oppAtk`)**
  - *Chosen Approach*: Compare effective base/stat-product Attack between your active Pokémon and the active opponent for every matchup change or swap.
  - *Why*: Lets the timing bar automatically highlight the throw turn in **Green (`CMP✓`)** when your active Pokémon wins CMP vs **Red (`🎯 CATCH`)** when the opponent wins CMP.

---

## 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                   OverlayService.kt / gblData.ts Engine                    │
│  • MoveStats(name, type, power, energyCost) + FastMove(turns, energyGain)  │
│  • CMP Check: winsCmp = userMeta.atk > oppMeta.atk                         │
│  • Per Opponent Move (c1, c2, c3) in YOUR fast move taps (userFastTurns):  │
│    - oppFasts = ceil(moveEnergy / oppFastEnergy)                           │
│    - oppReadyTurn = oppFasts * oppFastTurns                                │
│    - myCatchTap = floor((oppReadyTurn - 1) / userFastTurns) + 1            │
│    - myCmpTap = if (winsCmp && oppReadyTurn % userFastTurns == 0)          │
│                 (oppReadyTurn / userFastTurns) else null                   │
│    - Generates tapNodes[] (for 3-5T) or rangeSegments[] (for 1-2T)         │
└─────────────────────────────────────┬──────────────────────────────────────┘
                                      │ JSON Bridge (updateBattleData)
                                      ▼
┌────────────────────────────────────────────────────────────────────────────┐
│             Floating Overlay HUD (overlay.html) & Web Preview              │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Header: Active Opponent + CMP Badge + Form/Shad + P1/P2/P3 Switch │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ 2. 3v3 Shield Matchup Matrix (5-Tier Dots: SW+, W, N, L, SL×)        │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ 3. Unified Per-Move Timing, Catch/CMP & Bench Threat Rows (c1,c2,c3) │  │
│  │    [Move + Actv%] [Your Tap Dots (3-5T) / Blocks (1-2T)] [B1% | B2%] │  │
│  ├──────────────────────────────────────────────────────────────────────┤  │
│  │ 4. 1-Line Outgoing Damage Micro-Footer (My Moves -> Active Opponent) │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────┘
```
