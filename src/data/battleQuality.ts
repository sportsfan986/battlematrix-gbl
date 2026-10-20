import {
  POKEMON_DATABASE,
  PVPOKE_TOP_OPPONENTS,
  PokemonStats,
  TeamPreset,
  calculateChargedDamage,
  computeEffectiveStatsForLeague,
  getStoredMatchupTierThresholds,
  getTypeMultiplier
} from './gblData';

export type ShieldCount = 0 | 1 | 2;

export type ShieldScenarioCode =
  | '0v0'
  | '0v1'
  | '0v2'
  | '1v0'
  | '1v1'
  | '1v2'
  | '2v0'
  | '2v1'
  | '2v2';

export const ALL_SHIELD_PERMUTATIONS: ReadonlyArray<{
  userShields: ShieldCount;
  oppShields: ShieldCount;
  code: ShieldScenarioCode;
}> = [
  { userShields: 0, oppShields: 0, code: '0v0' },
  { userShields: 0, oppShields: 1, code: '0v1' },
  { userShields: 0, oppShields: 2, code: '0v2' },
  { userShields: 1, oppShields: 0, code: '1v0' },
  { userShields: 1, oppShields: 1, code: '1v1' },
  { userShields: 1, oppShields: 2, code: '1v2' },
  { userShields: 2, oppShields: 0, code: '2v0' },
  { userShields: 2, oppShields: 1, code: '2v1' },
  { userShields: 2, oppShields: 2, code: '2v2' }
];

export type BattleQualityBadgeLabel =
  | 'Clutch Win'
  | 'Skill Win'
  | 'Expected Win'
  | 'Blunder Loss'
  | 'Tough Loss'
  | 'Expected Loss';

export interface BlindMatchupFavorabilityResult {
  bmf: number | null;
  pPre: number | null;
  bmfPercentage: number | null;
  weight: number;
  sLead: number | null;
  sBack: number | null;
  compositeM: number | null;
  isUnrevealedThird: boolean;
}

export interface BattleQualityMetadata {
  sLead: number;
  sBack: number;
  compositeM: number;
  pPre: number; // Pre-Match Expected Win Probability in [0, 1] (BMF)
  bmfPercentage: number; // Pre-Match BMF in [0, 100]
  pWin: number; // Expected Win Probability in [0, 1]
  deltaQ: number; // Result (1 or 0) - pWin
  weight: number; // 1.0 (all 3 seen), 0.75 (unrevealed 3rd), or 0 (incomplete <2 seen)
  weightedResidual: number; // weight * deltaQ
  badgeLabel: BattleQualityBadgeLabel;
  badgeColor: string; // Hex color (#22d3ee, #4ade80, #94a3b8, #f43f5e, #fb923c)
  isUnrevealedThird: boolean;
}

export interface BattleQualityTeamInput {
  lead?: string | null;
  swap?: string | null;
  close?: string | null;
  firstSwap?: string | null;
  finalSeen?: string | null;
}

export type RatingsLookupDb =
  | Record<string, number>
  | ((
      myMon: string,
      oppMon: string,
      userShields: ShieldCount,
      oppShieldsOrLeague?: ShieldCount | string,
      league?: string
    ) => number);

export function normalizeLeagueKey(league?: string): string {
  const upper = (league || 'GREAT LEAGUE').toUpperCase();
  if (upper.includes('MEGA')) return 'MEGA MASTER LEAGUE';
  if (upper.includes('ULTRA')) return 'ULTRA LEAGUE';
  if (upper.includes('MASTER')) return 'MASTER LEAGUE';
  return 'GREAT LEAGUE';
}

function resolvePokemonStats(rawName: string, league: string): { stats: PokemonStats; isShadow: boolean } {
  const trimmed = (rawName || '').trim();
  const isShadow = /^Shadow\s+/i.test(trimmed) || trimmed.toLowerCase().includes('(shadow)');
  const cleanName = trimmed
    .replace(/^Shadow\s+/i, '')
    .replace(/\s*\(Shadow\)/i, '')
    .trim();

  const allEntries = Object.values(POKEMON_DATABASE);
  const rawMatch =
    POKEMON_DATABASE[trimmed] ||
    POKEMON_DATABASE[cleanName] ||
    allEntries.find(
      (p) =>
        p.name.toLowerCase() === trimmed.toLowerCase() ||
        p.name.toLowerCase() === cleanName.toLowerCase() ||
        p.speciesId.toLowerCase() === cleanName.toLowerCase().replace(/\s+/g, '_')
    ) ||
    allEntries.find((p) => p.name.toLowerCase().includes(cleanName.toLowerCase())) ||
    allEntries[0];

  const scaled = computeEffectiveStatsForLeague(rawMatch, league, undefined, undefined, isShadow);
  return { stats: scaled, isShadow };
}

function clampShieldCount(s: number): ShieldCount {
  if (s <= 0) return 0;
  if (s >= 2) return 2;
  return 1;
}

/**
 * Computes a PvPoke-calibrated 0–1000 battle rating (500 = Neutral, >500 = Favorable, <500 = Negative)
 * across all 9 discrete shield permutations (s_user v s_opp in {0, 1, 2}^2):
 *   0v0, 0v1, 0v2, 1v0, 1v1, 1v2, 2v0, 2v1, 2v2.
 *
 * Supports both:
 * - Asymmetric signature: evaluatePvPokeMatchupRating(myMon, oppMon, userShields, oppShields, league, ratingsDb)
 * - Symmetric signature:  evaluatePvPokeMatchupRating(myMon, oppMon, shields, league, ratingsDb)
 */
export function evaluatePvPokeMatchupRating(
  myMonName: string,
  oppMonName: string,
  userShields: ShieldCount = 1,
  oppShieldsOrLeague?: ShieldCount | string,
  leagueOrRatingsDb?: string | RatingsLookupDb,
  maybeRatingsDb?: RatingsLookupDb
): number {
  const sUser: ShieldCount = clampShieldCount(Number(userShields));
  let sOpp: ShieldCount = sUser;
  let rawLeague: string | undefined = 'GREAT LEAGUE';
  let ratingsDb: RatingsLookupDb | undefined;

  if (typeof oppShieldsOrLeague === 'number') {
    sOpp = clampShieldCount(oppShieldsOrLeague);
    if (typeof leagueOrRatingsDb === 'string' || leagueOrRatingsDb === undefined) {
      rawLeague = leagueOrRatingsDb;
      ratingsDb = maybeRatingsDb;
    } else {
      ratingsDb = leagueOrRatingsDb;
    }
  } else {
    rawLeague = oppShieldsOrLeague;
    ratingsDb = leagueOrRatingsDb as RatingsLookupDb | undefined;
  }

  const normLeague = normalizeLeagueKey(rawLeague);
  const scenarioCode = `${sUser}v${sOpp}` as ShieldScenarioCode;

  if (typeof ratingsDb === 'function') {
    const custom =
      ratingsDb.length >= 5
        ? ratingsDb(myMonName, oppMonName, sUser, sOpp, normLeague)
        : ratingsDb(myMonName, oppMonName, sUser, normLeague);
    if (typeof custom === 'number' && !Number.isNaN(custom)) {
      return Math.max(100, Math.min(900, custom));
    }
  } else if (ratingsDb && typeof ratingsDb === 'object') {
    const keyAsymExact = `${normLeague}:${myMonName.toLowerCase()}:${oppMonName.toLowerCase()}:${scenarioCode}`;
    const keyAsymShort = `${myMonName.toLowerCase()}:${oppMonName.toLowerCase()}:${scenarioCode}`;
    if (typeof ratingsDb[keyAsymExact] === 'number') return ratingsDb[keyAsymExact];
    if (typeof ratingsDb[keyAsymShort] === 'number') return ratingsDb[keyAsymShort];
    if (sUser === sOpp) {
      const keySymExact = `${normLeague}:${myMonName.toLowerCase()}:${oppMonName.toLowerCase()}:${sUser}s`;
      const keySymShort = `${myMonName.toLowerCase()}:${oppMonName.toLowerCase()}:${sUser}s`;
      if (typeof ratingsDb[keySymExact] === 'number') return ratingsDb[keySymExact];
      if (typeof ratingsDb[keySymShort] === 'number') return ratingsDb[keySymShort];
    }
  }

  const { stats: myStats, isShadow: isMyShadow } = resolvePokemonStats(myMonName, normLeague);
  const { stats: oppStats, isShadow: isOppShadow } = resolvePokemonStats(oppMonName, normLeague);

  const myChargedDamages = myStats.chargedMoves.slice(0, 2).map(
    (cm) => calculateChargedDamage(myStats, oppStats, cm, isMyShadow, isOppShadow).percentage
  );
  const bestUserCharged = myChargedDamages.length ? Math.max(...myChargedDamages) : 45;
  const minUserCharged = myChargedDamages.length ? Math.min(...myChargedDamages) : 35;

  const oppChargedDamages = oppStats.chargedMoves.slice(0, 2).map(
    (cm) => calculateChargedDamage(oppStats, myStats, cm, isOppShadow, isMyShadow).percentage
  );
  const bestOppCharged = oppChargedDamages.length ? Math.max(...oppChargedDamages) : 45;
  const minOppCharged = oppChargedDamages.length ? Math.min(...oppChargedDamages) : 35;

  const userFastEff = getTypeMultiplier(myStats.defaultFastMove.type, oppStats.types);
  const oppFastEff = getTypeMultiplier(oppStats.defaultFastMove.type, myStats.types);
  const shadowBulkDelta = (isMyShadow ? -12 : 0) + (isOppShadow ? 12 : 0);

  // Unblocked charged impact against opponent's available shields (sDef in {0, 1, 2})
  const chargedPressureAgainstShields = (bestPct: number, minPct: number, defShields: ShieldCount): number => {
    if (defShields === 0) return bestPct * 1.7;
    if (defShields === 1) return ((bestPct + minPct) * 0.5) * 1.4;
    return minPct * 1.0;
  };

  const userChargedImpact = chargedPressureAgainstShields(bestUserCharged, minUserCharged, sOpp);
  const oppChargedImpact = chargedPressureAgainstShields(bestOppCharged, minOppCharged, sUser);
  const chargedDelta = 2.0 * (userChargedImpact - oppChargedImpact);

  const avgShields = (sUser + sOpp) * 0.5;
  const fastWeight =
    avgShields <= 1.0
      ? 95.0 + avgShields * 25.0 // 0->95, 0.5->107.5, 1.0->120
      : 120.0 + (avgShields - 1.0) * 35.0; // 1.0->120, 1.5->137.5, 2.0->155
  const fastDelta = (userFastEff - oppFastEff) * fastWeight;

  const shadowMultiplier = avgShields <= 1.0 ? 1.0 : avgShields;
  const effectiveShadowDelta = shadowBulkDelta * shadowMultiplier;

  // Direct shield advantage bonus when sUser != sOpp
  const shieldDiff = sUser - sOpp;
  const shieldAdvantageDelta =
    shieldDiff * (85.0 + 0.65 * ((bestOppCharged + bestUserCharged) * 0.5));

  const totalDelta = chargedDelta + fastDelta + effectiveShadowDelta + shieldAdvantageDelta;
  const roundedDelta = totalDelta >= 0 ? Math.round(totalDelta) : -Math.round(-totalDelta);
  const rating = 500 + roundedDelta;
  return Math.max(150, Math.min(850, rating));
}

/**
 * Evaluates all 9 shield permutations (0v0, 0v1, 0v2, 1v0, 1v1, 1v2, 2v0, 2v1, 2v2)
 * for a given pair of combatants.
 */
export function evaluateAllShieldPermutations(
  myMonName: string,
  oppMonName: string,
  league: string = 'GREAT LEAGUE',
  ratingsDb?: RatingsLookupDb
): Record<ShieldScenarioCode, number> {
  const result = {} as Record<ShieldScenarioCode, number>;
  for (const perm of ALL_SHIELD_PERMUTATIONS) {
    result[perm.code] = evaluatePvPokeMatchupRating(
      myMonName,
      oppMonName,
      perm.userShields,
      perm.oppShields,
      league,
      ratingsDb
    );
  }
  return result;
}

/**
 * Computes the unweighted average 1v1 battle rating (R_bar) of a given Pokémon
 * against the active league's top meta list.
 */
export function computeMetaAverage1v1Rating(
  pokemonName: string,
  league: string = 'GREAT LEAGUE',
  metaPool?: string[],
  ratingsDb?: RatingsLookupDb
): number {
  const normLeague = normalizeLeagueKey(league);
  const activeMetaPool =
    metaPool && metaPool.length > 0
      ? metaPool
      : (PVPOKE_TOP_OPPONENTS[normLeague] || PVPOKE_TOP_OPPONENTS['GREAT LEAGUE'] || []).map((m) => m.name);

  if (activeMetaPool.length === 0) return 500.0;
  const sum = activeMetaPool.reduce(
    (acc, metaMon) => acc + evaluatePvPokeMatchupRating(pokemonName, metaMon, 1, 1, normLeague, ratingsDb),
    0
  );
  return sum / activeMetaPool.length;
}

/**
 * Computes the unweighted average 1v1 battle ratings for the user's backline
 * (R_bar_swap and R_bar_close) against the active league's top meta list.
 */
export function computeBacklineMetaAverages(
  mySwap: string,
  myClose: string,
  league: string = 'GREAT LEAGUE',
  metaPool?: string[],
  ratingsDb?: RatingsLookupDb
): { rBarSwap: number; rBarClose: number } {
  return {
    rBarSwap: computeMetaAverage1v1Rating(mySwap, league, metaPool, ratingsDb),
    rBarClose: computeMetaAverage1v1Rating(myClose, league, metaPool, ratingsDb)
  };
}

export function calculateAutoLeadMatchup(
  myLead: string,
  oppLead: string,
  league: string = 'GREAT LEAGUE'
): 'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE' {
  if (!myLead?.trim() || !oppLead?.trim()) return 'NEUTRAL';
  const r1s = evaluatePvPokeMatchupRating(myLead, oppLead, 1, 1, league);
  const thresholds = getStoredMatchupTierThresholds();
  if (r1s >= thresholds.wMin) return 'FAVORABLE';
  if (r1s <= thresholds.lMax) return 'NEGATIVE';
  return 'NEUTRAL';
}

export function getBadgeCategorization(
  pWin: number,
  result: 'WIN' | 'LOSS' | number
): {
  badgeLabel: BattleQualityBadgeLabel;
  badgeColor: string;
} {
  const isWin = result === 'WIN' || result === 1 || result === 1.0;
  if (isWin) {
    if (pWin < 0.4) {
      return { badgeLabel: 'Clutch Win', badgeColor: '#22d3ee' };
    }
    if (pWin <= 0.6) {
      return { badgeLabel: 'Skill Win', badgeColor: '#4ade80' };
    }
    return { badgeLabel: 'Expected Win', badgeColor: '#94a3b8' };
  } else {
    if (pWin > 0.6) {
      return { badgeLabel: 'Blunder Loss', badgeColor: '#f43f5e' };
    }
    if (pWin >= 0.4) {
      return { badgeLabel: 'Tough Loss', badgeColor: '#fb923c' };
    }
    return { badgeLabel: 'Expected Loss', badgeColor: '#94a3b8' };
  }
}

/**
 * Phase 1: Blind Matchup Favorability (BMF / Pre-Match Expectation)
 *
 * Match Validity Rules:
 * - If oppTeam.firstSwap is null or missing: Return { bmf: null, pPre: null, bmfPercentage: null, weight: 0.0 }
 * - If oppTeam.finalSeen is null or missing (unrevealed 3rd): Set weight w = 0.75 and use meta-average ratings for the missing slot.
 * - If all 3 Pokémon are resolved: Set weight w = 1.0.
 *
 * Lead Score (S_lead):
 *   S_lead = 0.50 * Rating_1v1(lead, oppLead) + 0.50 * Rating_2v2(lead, oppLead)
 *
 * Backline Score (S_back):
 *   - Known 3rd: Average the 1v1 ratings for Scenario A (swap vs oppSwap, close vs oppClose)
 *     and Scenario B (swap vs oppClose, close vs oppSwap).
 *   - Unrevealed 3rd: Average known swap pairing with the meta-average prior (R_bar_swap, R_bar_close) of the opposing slot.
 *   - S_back = 0.70 * max(Score_A, Score_B) + 0.30 * min(Score_A, Score_B)
 *
 * Composite Score & Pre-Match Win Probability (P_pre):
 *   M = 0.40 * S_lead + 0.60 * S_back
 *   P_pre = 1 / (1 + exp(-0.006 * (M - 500)))
 */
export function calculateBlindMatchupFavorability(
  myTeam: string[] | BattleQualityTeamInput,
  oppTeam: string[] | BattleQualityTeamInput,
  league: string = 'GREAT LEAGUE',
  ratingsDb?: RatingsLookupDb,
  metaPool?: string[]
): BlindMatchupFavorabilityResult {
  const normLeague = normalizeLeagueKey(league);

  const myLead = Array.isArray(myTeam) ? (myTeam[0] || '').trim() : (myTeam.lead || '').trim();
  const mySwap = Array.isArray(myTeam)
    ? (myTeam[1] || myTeam[0] || '').trim()
    : (myTeam.swap || myTeam.firstSwap || myTeam.lead || '').trim();
  const myClose = Array.isArray(myTeam)
    ? (myTeam[2] || myTeam[1] || myTeam[0] || '').trim()
    : (myTeam.close || myTeam.finalSeen || mySwap || '').trim();

  const oppLead = Array.isArray(oppTeam) ? (oppTeam[0] || '').trim() : (oppTeam.lead || '').trim();
  const oppSwap = Array.isArray(oppTeam)
    ? (oppTeam[1] || '').trim()
    : (oppTeam.firstSwap || oppTeam.swap || '').trim();
  const oppClose = Array.isArray(oppTeam)
    ? (oppTeam[2] || '').trim()
    : (oppTeam.finalSeen || oppTeam.close || '').trim();

  // Match Validity Rule 1: If oppTeam.firstSwap is null or missing -> return { bmf: null, weight: 0.0 }
  if (!myLead || !oppLead || !oppSwap) {
    return {
      bmf: null,
      pPre: null,
      bmfPercentage: null,
      weight: 0.0,
      sLead: null,
      sBack: null,
      compositeM: null,
      isUnrevealedThird: false
    };
  }

  const isUnrevealedThird = !oppClose;
  const weight = isUnrevealedThird ? 0.75 : 1.0;

  // Lead Score (S_lead): 50% 1v1 + 50% 2v2
  const ratingLead1v1 = evaluatePvPokeMatchupRating(myLead, oppLead, 1, 1, normLeague, ratingsDb);
  const ratingLead2v2 = evaluatePvPokeMatchupRating(myLead, oppLead, 2, 2, normLeague, ratingsDb);
  const sLead = 0.5 * ratingLead1v1 + 0.5 * ratingLead2v2;

  // Backline Score (S_back):
  let scoreA: number;
  let scoreB: number;

  if (!isUnrevealedThird) {
    // Known 3rd (w = 1.0)
    const rSwapVsOppSwap = evaluatePvPokeMatchupRating(mySwap, oppSwap, 1, 1, normLeague, ratingsDb);
    const rCloseVsOppClose = evaluatePvPokeMatchupRating(myClose, oppClose, 1, 1, normLeague, ratingsDb);
    const rSwapVsOppClose = evaluatePvPokeMatchupRating(mySwap, oppClose, 1, 1, normLeague, ratingsDb);
    const rCloseVsOppSwap = evaluatePvPokeMatchupRating(myClose, oppSwap, 1, 1, normLeague, ratingsDb);

    scoreA = (rSwapVsOppSwap + rCloseVsOppClose) / 2.0;
    scoreB = (rSwapVsOppClose + rCloseVsOppSwap) / 2.0;
  } else {
    // Unrevealed 3rd (w = 0.75) -> Meta-Average Prior
    const { rBarSwap, rBarClose } = computeBacklineMetaAverages(
      mySwap,
      myClose,
      normLeague,
      metaPool,
      ratingsDb
    );
    const rSwapVsOppSwap = evaluatePvPokeMatchupRating(mySwap, oppSwap, 1, 1, normLeague, ratingsDb);
    const rCloseVsOppSwap = evaluatePvPokeMatchupRating(myClose, oppSwap, 1, 1, normLeague, ratingsDb);

    scoreA = (rSwapVsOppSwap + rBarClose) / 2.0;
    scoreB = (rCloseVsOppSwap + rBarSwap) / 2.0;
  }

  const sBack = 0.7 * Math.max(scoreA, scoreB) + 0.3 * Math.min(scoreA, scoreB);

  // Composite Score & Pre-Match Win Probability (P_pre):
  const compositeM = 0.4 * sLead + 0.6 * sBack;
  const pPre = 1.0 / (1.0 + Math.exp(-0.006 * (compositeM - 500.0)));

  return {
    bmf: Number(pPre.toFixed(4)),
    pPre: Number(pPre.toFixed(4)),
    bmfPercentage: Number((pPre * 100.0).toFixed(1)),
    weight,
    sLead: Number(sLead.toFixed(2)),
    sBack: Number(sBack.toFixed(2)),
    compositeM: Number(compositeM.toFixed(2)),
    isUnrevealedThird
  };
}

/**
 * Core Mathematical Pipeline:
 * Evaluates Battle Quality & Wins Above Expected (WAE) for a logged GBL match,
 * grounded on Phase 1 Blind Matchup Favorability (BMF / P_pre).
 *
 * Returns `null` if `oppTeam.firstSwap` is null/missing (incomplete match, weight = 0).
 */
export function calculateBattleQuality(
  myTeam: string[] | BattleQualityTeamInput,
  oppTeam: string[] | BattleQualityTeamInput,
  league: string = 'GREAT LEAGUE',
  ratingsDb?: RatingsLookupDb,
  metaPool?: string[],
  result: 'WIN' | 'LOSS' | number = 'WIN'
): BattleQualityMetadata | null {
  const bmfResult = calculateBlindMatchupFavorability(myTeam, oppTeam, league, ratingsDb, metaPool);
  if (
    bmfResult.bmf === null ||
    bmfResult.pPre === null ||
    bmfResult.bmfPercentage === null ||
    bmfResult.sLead === null ||
    bmfResult.sBack === null ||
    bmfResult.compositeM === null ||
    bmfResult.weight <= 0
  ) {
    return null;
  }

  const pWin = bmfResult.pPre;
  const numericResult = result === 'WIN' || result === 1 || result === 1.0 ? 1.0 : 0.0;
  const deltaQ = numericResult - pWin;
  const weightedResidual = bmfResult.weight * deltaQ;

  const { badgeLabel, badgeColor } = getBadgeCategorization(pWin, result);

  return {
    sLead: bmfResult.sLead,
    sBack: bmfResult.sBack,
    compositeM: bmfResult.compositeM,
    pPre: bmfResult.pPre,
    bmfPercentage: bmfResult.bmfPercentage,
    pWin: bmfResult.pPre,
    deltaQ: Number(deltaQ.toFixed(4)),
    weight: bmfResult.weight,
    weightedResidual: Number(weightedResidual.toFixed(4)),
    badgeLabel,
    badgeColor,
    isUnrevealedThird: bmfResult.isUnrevealedThird
  };
}

/**
 * Resolves a logged match's BattleQualityMetadata, using cached `entry.quality` if present
 * or computing it on-the-fly from `userPokemon` / `presets` and `opponents`.
 */
export function resolveLogEntryQuality(
  entry: {
    league: string;
    presetId?: string;
    userTeamName?: string;
    userPokemon?: string[];
    opponents?: string[];
    result: 'WIN' | 'LOSS' | string;
    quality?: BattleQualityMetadata | null;
  },
  presets: TeamPreset[] = [],
  ratingsDb?: RatingsLookupDb,
  metaPool?: string[]
): BattleQualityMetadata | null {
  if (entry.quality !== undefined) {
    if (entry.quality === null) return null;
    // Ensure badgeLabel & deltaQ stay consistent with entry.result if result was toggled
    const numericResult = entry.result === 'WIN' ? 1.0 : 0.0;
    const expectedDelta = Number((numericResult - entry.quality.pWin).toFixed(4));
    if (Math.abs(expectedDelta - entry.quality.deltaQ) > 0.001) {
      const { badgeLabel, badgeColor } = getBadgeCategorization(entry.quality.pWin, entry.result as 'WIN' | 'LOSS');
      return {
        ...entry.quality,
        deltaQ: expectedDelta,
        weightedResidual: Number((entry.quality.weight * expectedDelta).toFixed(4)),
        badgeLabel,
        badgeColor
      };
    }
    return entry.quality;
  }

  let myMons = (entry.userPokemon || []).map((m) => m.trim()).filter(Boolean);
  if (myMons.length < 3) {
    const matchedPreset = presets.find(
      (p) =>
        (entry.presetId && p.id === entry.presetId) ||
        (entry.userTeamName && p.name.toLowerCase() === entry.userTeamName.toLowerCase())
    );
    if (matchedPreset && matchedPreset.pokemon.length > 0) {
      myMons = matchedPreset.pokemon.map((p) => p.name);
    }
  }
  if (myMons.length === 0) {
    const normLeague = normalizeLeagueKey(entry.league);
    myMons = (PVPOKE_TOP_OPPONENTS[normLeague] || PVPOKE_TOP_OPPONENTS['GREAT LEAGUE'])
      .slice(0, 3)
      .map((p) => p.name);
  }

  return calculateBattleQuality(
    myMons,
    entry.opponents || [],
    entry.league,
    ratingsDb,
    metaPool,
    entry.result === 'LOSS' ? 'LOSS' : 'WIN'
  );
}

/**
 * Computes Aggregate Wins Above Expected (WAE) percentage across a filtered list of battle logs:
 *   Aggregate WAE = ( sum(w_i * (Result_i - P_win,i)) / sum(w_i) ) * 100%
 */
export function calculateAggregateWAE(
  entries: Array<{
    league: string;
    presetId?: string;
    userTeamName?: string;
    userPokemon?: string[];
    opponents?: string[];
    result: 'WIN' | 'LOSS' | string;
    quality?: BattleQualityMetadata | null;
  }>,
  presets: TeamPreset[] = []
): {
  waePct: number | null;
  formatted: string;
  totalWeight: number;
  rankedCount: number;
} {
  let weightedSum = 0.0;
  let totalWeight = 0.0;
  let rankedCount = 0;

  for (const entry of entries) {
    const q = resolveLogEntryQuality(entry, presets);
    if (!q || q.weight <= 0) continue;
    const resNum = entry.result === 'WIN' ? 1.0 : 0.0;
    const delta = resNum - q.pWin;
    weightedSum += q.weight * delta;
    totalWeight += q.weight;
    rankedCount++;
  }

  if (totalWeight <= 0) {
    return {
      waePct: null,
      formatted: '—%',
      totalWeight: 0,
      rankedCount: 0
    };
  }

  const waePct = (weightedSum / totalWeight) * 100.0;
  const sign = waePct >= 0 ? '+' : '';
  return {
    waePct,
    formatted: `${sign}${waePct.toFixed(1)}%`,
    totalWeight,
    rankedCount
  };
}

/**
 * One-time retroactive migration script/routine (`migrateExistingBattleLogs()`):
 * - Iterates through all historical matches in localStorage (`gbl_battle_logs_v1` and `gbl_deleted_battles_trash_v1`).
 * - If a match lacks `quality` metadata:
 *   - Checks if `firstSwap` (`opponents[1]`) exists. If missing, marks `quality: null` (unranked/ignored).
 *   - Looks up team compositions and league in existing ratings data.
 *   - Calculates P_win, badge label, Delta Q, and weight (1.0 or 0.75).
 *   - Persists the enriched schema back to localStorage so recalculation does not re-run on every render.
 */
export function migrateExistingBattleLogs<
  T extends {
    id: string;
    league: string;
    presetId?: string;
    userTeamName?: string;
    userPokemon?: string[];
    opponents?: string[];
    result: 'WIN' | 'LOSS';
    quality?: BattleQualityMetadata | null;
  }
>(logs: T[], presets: TeamPreset[] = [], storageKey: string = 'gbl_battle_logs_v1'): { logs: T[]; didMigrate: boolean } {
  let didMigrate = false;
  const migrated = logs.map((entry) => {
    if (entry.quality !== undefined) {
      return entry;
    }
    didMigrate = true;
    const opps = (entry.opponents || []).map((o) => o.trim()).filter(Boolean);
    if (opps.length < 2) {
      return {
        ...entry,
        quality: null
      };
    }
    const computedQuality = resolveLogEntryQuality(
      { ...entry, opponents: opps, quality: undefined },
      presets
    );
    return {
      ...entry,
      quality: computedQuality
    };
  });

  if (didMigrate && storageKey) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(migrated));
    } catch {}
  }

  return { logs: migrated, didMigrate };
}

/**
 * Re-evaluates all completed battle logs from scratch using the latest damage multipliers
 * (2.56x dual-type effectiveness, 1.2x Shadow attack, half-level CPM stats) and recalculates
 * both Lead Matchup (FAVORABLE / NEUTRAL / NEGATIVE) and Win Quality (WAE).
 */
export function reparseAllCompletedBattleLogs<
  T extends {
    id: string;
    league: string;
    presetId?: string;
    userTeamName?: string;
    userPokemon?: string[];
    opponents?: string[];
    result: 'WIN' | 'LOSS';
    leadMatchup?: 'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE';
    quality?: BattleQualityMetadata | null;
    updatedAt?: number;
  }
>(logs: T[], presets: TeamPreset[] = [], storageKey: string = 'gbl_battle_logs_v1'): T[] {
  const now = Date.now();
  const reparsed = logs.map((entry) => {
    const matchedPreset = presets.find(
      (p) =>
        (entry.presetId && p.id === entry.presetId) ||
        (entry.userTeamName && p.name.toLowerCase() === entry.userTeamName.toLowerCase())
    );
    let myMons = (entry.userPokemon || []).map((m) => m.trim()).filter(Boolean);
    if (myMons.length < 3 && matchedPreset && matchedPreset.pokemon.length > 0) {
      myMons = matchedPreset.pokemon.map((p) => p.name);
    }
    const opps = (entry.opponents || []).map((o) => o.trim()).filter(Boolean);
    const updatedLead =
      myMons.length > 0 && opps.length > 0
        ? calculateAutoLeadMatchup(myMons[0], opps[0], entry.league)
        : entry.leadMatchup || 'NEUTRAL';

    const freshQuality =
      opps.length < 2
        ? null
        : resolveLogEntryQuality(
            { ...entry, userPokemon: myMons, opponents: opps, quality: undefined },
            presets
          );

    return {
      ...entry,
      userPokemon: myMons.length > 0 ? myMons : entry.userPokemon,
      leadMatchup: updatedLead,
      quality: freshQuality,
      updatedAt: now
    };
  });

  if (storageKey) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(reparsed));
    } catch {}
  }
  return reparsed;
}

