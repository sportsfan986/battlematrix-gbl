# Changelog

## v2.91
**Phase 2/4 of 3.00 release, use 2.3x builds until 3.00 released**

### Phase 2: Battle Timeline Tracking & Dynamic Execution WAE Engine
1. **Clock Synchronization ($t_0$) & Live Event Capture (`OverlayService.kt` & `src/App.tsx`)**
   - Initializes $t_0 = 0.00\text{s}$ at the exact millisecond the opponent's lead Pokémon is recognized by the app.
   - Records relative elapsed seconds $t = (\text{Date.now()} - t_0) / 1000$ for all discrete in-battle actions (`BattleTimelineEvent`):
     - **Swaps (`SWAP`)**: Logs `actor` (`user` | `opp`), `pokemonIn`, `pokemonOut`, remaining shield counts, and $t$.
     - **Shields (`SHIELD`)**: Decrements remaining shields and logs `actor`, `shieldNumber` (1 or 2), active Pokémon shielded, remaining shield counts, and $t$.
     - **Faints (`FAINT`)**: Logs `actor` (whose Pokémon fainted), `pokemonFainted`, remaining shield counts for both sides, and $t$.
   - Attaches `timelineEvents` (and duration/faint/shield summary fields) to the match log schema (`SyncBattleLogRecord`, `BattleLogEntry`, `WebBattleLogEntry`) upon completion.
2. **Dynamic Execution WAE Engine (`src/data/battleQuality.ts` & `OverlayService.kt`)**
   - Implemented chronological match evaluation (`calculateDynamicExecutionWAE` / `calculateDynamicExecutionWAEStatic`):
     - When event timeline data is absent (manual entries or legacy matches), sets $P_{\text{exec}} = P_{\text{pre}}$.
     - When timeline events exist, partitions the battle duration into active head-to-head intervals $k$ bounded by swap and faint timestamps, resolves each interval's asymmetric shield rating $R_k = \text{Rating}_{s_{\text{user}}\text{v}s_{\text{opp}}}(\text{userActive}, \text{oppActive})$, and weights by fractional duration $\tau_k = \Delta t_k / t_{\text{total}}$ to compute $S_{\text{actual}} = \sum (\tau_k \cdot R_k)$ and $P_{\text{exec}} = \frac{1}{1 + e^{-0.006 \cdot (S_{\text{actual}} - 500)}}$.
     - Computes Execution Residual ($\Delta Q = \text{Result} - P_{\text{exec}}$) with **Faint Margin Scaling** ($\Delta Q \times 1.10$ when $\text{Result} == 1$ and $(\text{oppFaints} - \text{userFaints}) \ge 2$) and **Shield in Pocket Penalty** ($\Delta Q_{\text{final}} = \Delta Q - 0.15 \cdot \text{userShieldsRemaining}$ when $\text{Result} == 0$ and $\text{userShieldsRemaining} > 0$).

## v2.90
**Phase 1/4 of 3.00 release, use 2.3x builds until 3.00 released**

### Phase 1: Asymmetric Shield Matrix & Blind Matchup Favorability (BMF)
1. **9-Permutation Asymmetric Shield Matrix (`0v0`, `0v1`, `0v2`, `1v0`, `1v1`, `1v2`, `2v0`, `2v1`, `2v2`)**
   - Extended battle rating lookups in `src/data/battleQuality.ts` and `OverlayService.kt` to accept discrete shield counts for both combatants ($s_{\text{user}} \text{v} s_{\text{opp}} \in \{0, 1, 2\}^2$).
   - Added `computeMetaAverage1v1Rating` / `computeBacklineMetaAverages` (`computeMetaAverage1v1RatingStatic` in Kotlin) to compute unweighted average 1v1 battle ratings ($\bar{R}_{\text{swap}}$ and $\bar{R}_{\text{close}}$) against the active league's top meta list.
2. **Blind Matchup Favorability (BMF / Pre-Match Expectation $P_{\text{pre}}$)**
   - Implemented `calculateBlindMatchupFavorability` (`calculateBlindMatchupFavorabilityStatic` in Kotlin):
     - If `oppTeam.firstSwap` is null or missing: returns `{ bmf: null, pPre: null, bmfPercentage: null, weight: 0.0 }`.
     - If `oppTeam.finalSeen` is null or missing (unrevealed 3rd): sets weight $w = 0.75$ and uses meta-average ratings ($\bar{R}_{\text{swap}}, \bar{R}_{\text{close}}$) for the missing slot.
     - If all 3 Pokémon are resolved: sets weight $w = 1.0$.
     - Computes $S_{\text{lead}} = 0.50 \cdot \text{Rating}_{1\text{v}1} + 0.50 \cdot \text{Rating}_{2\text{v}2}$, $S_{\text{back}} = 0.70 \cdot \max(\text{Score}_A, \text{Score}_B) + 0.30 \cdot \min(\text{Score}_A, \text{Score}_B)$, $M = 0.40 \cdot S_{\text{lead}} + 0.60 \cdot S_{\text{back}}$, and $P_{\text{pre}} = \frac{1}{1 + e^{-0.006 \cdot (M - 500)}}$.
