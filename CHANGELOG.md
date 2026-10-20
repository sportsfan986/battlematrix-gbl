# Changelog

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
