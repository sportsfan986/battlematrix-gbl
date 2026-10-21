# SilphScope PvP Changelog

## [v3.10] — 2026-10-21 — Team Archetype Auto-Detection (ABB vs. ABC), Position-Weighted Shield Scenario Ratings & Aggregate Battle Rating Engine
- **Auto Team Style Classification (`ABB` vs. `ABC`) & Smart Slot Reordering**:
  - Added a **`⚡ Auto-Detect Style & Order Swap`** button inside the Create/Edit Team modal and a quick **`⚡ Auto`** button on saved Team Preset cards.
  - Evaluates pairwise defensive type vulnerabilities across all 3 team members and tests whether the candidate Lead resists shared backline weaknesses (`≥ 2` shared weaknesses or `1` critical meta weakness):
    - **`ABB` Lineups**: Automatically moves the resisting `A` Pokémon to **Slot 1 (Lead)**, places the higher bait-pressure / faster energy `B` Pokémon into **Slot 2 (`Bait Swap B1`)**, and places the higher closing-power `B` Pokémon into **Slot 3 (`Sweeper B2`)**.
    - **`ABC` Lineups**: Keeps **Slot 1 (Lead)** fixed, places the backline Pokémon with the highest volatility-adjusted `Swap BR` ($\mu - 0.5\sigma$) into **Slot 2 (`Safe Swap`)**, and places the remaining Pokémon into **Slot 3 (`Closer`)**.
  - Added quick **`#1 ⇄ #2`** and **`#2 ⇄ #3`** slot swap buttons in the Team Builder to manually reorder team slots while preserving custom movesets, CPs, and IVs.
- **Current-Season Blended Meta & Exponential Recency Decay (`0–50` Match Ramp)**:
  - Calculates expected opponent probability distributions $P_{\text{lead}}(p)$ (from opponent leads) and $P_{\text{field}}(p)$ (from all 3 opponent Pokémon) strictly from **current GBL season** battle logs blended with active league PvPoke rankings.
  - Scales historical battle log weight linearly from `0%` at `0` matches up to `70%` at `50+` current-season matches ($w_{\text{hist}} = 0.70 \times \min(1, N / 50)$, $w_{\text{meta}} = 1 - w_{\text{hist}}$).
  - Weights more recent current-season battle logs higher than older battle logs using the same exponential decay factor ($W(k) = e^{-0.05 \cdot (k - 1)}$) used to weight higher-ranked PvPoke meta threats over lower-ranked ones.
- **Position-Weighted Shield Scenario Ratings (`Lead`, `Safe Swap`, `Closer`)**:
  - Replaces single-scenario 1v1 ratings with role-specific multi-shield expectations across the 9-state asymmetric shield matrix:
    - **Slot 1 (`Lead`)**: $0.45 \cdot BR_{1v1} + 0.35 \cdot BR_{2v2} + 0.10 \cdot BR_{0v0} + 0.05 \cdot BR_{1v2} + 0.05 \cdot BR_{2v1}$
    - **Slot 2 (`Safe Swap / Bait`)**: $0.40 \cdot BR_{1v1} + 0.20 \cdot BR_{1v0} + 0.20 \cdot BR_{0v1} + 0.10 \cdot BR_{2v1} + 0.10 \cdot BR_{0v0}$
    - **Slot 3 (`Closer / Sweeper`)**: $0.50 \cdot BR_{0v0} + 0.20 \cdot BR_{1v0} + 0.15 \cdot BR_{0v1} + 0.15 \cdot BR_{1v1}$
- **Team & Per-Slot Battle Rating Badges (`Lead Agg BR`, `Machine Agg BR`, and `Swap BR`)**:
  - **Lead Aggregate BR (`Lead BR`)**: Expected lead performance against the blended current-season lead meta, color-coded using your configured **`SW / W / N / L / SL`** matchup thresholds in Settings.
  - **Per-Slot `Swap BR` on Safe Swap & Closer**: Displays volatility-adjusted safe-swap ratings ($\mu_{\text{Swap}} - 0.5\sigma_{\text{Swap}}$) on **both Slot 2 and Slot 3**, color-coded by your `SW / W / N / L / SL` thresholds so you can compare both backline switch options at a glance.
  - **Machine Aggregate BR (`Mach BR`) & New Settings Thresholds**: Evaluates theoretical 3-mon core coverage ($\sum P_{\text{field}}(p) \cdot \max(BR_{\text{Lead}}, BR_{\text{Swap}}, BR_{\text{Closer}})$) with its own dedicated 5-tier color scale (**Elite ≥ 650**, **Solid ≥ 610**, **Playable ≥ 580**, **Risky ≥ 540**, **Blindspot < 540**) and a new **Machine Aggregate BR Thresholds** card in **⚙️ Settings**.
  - **Automatic Overlay Launch Recalculation**: Launching the Battle Overlay automatically recalculates all saved teams' aggregate and per-slot Battle Ratings against your latest current-season battle logs and PvPoke meta rankings.
