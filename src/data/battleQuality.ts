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

export type BattleQualityBadgeLabel =
  | 'Clutch Win'
  | 'Skill Win'
  | 'Expected Win'
  | 'Blunder Loss'
  | 'Tough Loss'
  | 'Expected Loss';

export interface BattleQualityMetadata {
  sLead: number;
  sBack: number;
  compositeM: number;
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
  | ((myMon: string, oppMon: string, shields: 1 | 2, league: string) => number);

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

/**
 * Computes a PvPoke-calibrated 0–1000 matchup rating (500 = Neutral, >500 = Favorable, <500 = Negative)
 * for either the 1v1 or 2v2 shield scenario.
 */
export function evaluatePvPokeMatchupRating(
  myMonName: string,
  oppMonName: string,
  shields: 1 | 2,
  league: string = 'GREAT LEAGUE',
  ratingsDb?: RatingsLookupDb
): number {
  const normLeague = normalizeLeagueKey(league);

  if (typeof ratingsDb === 'function') {
    const custom = ratingsDb(myMonName, oppMonName, shields, normLeague);
    if (typeof custom === 'number' && !Number.isNaN(custom)) {
      return Math.max(100, Math.min(900, custom));
    }
  } else if (ratingsDb && typeof ratingsDb === 'object') {
    const keyExact = `${normLeague}:${myMonName.toLowerCase()}:${oppMonName.toLowerCase()}:${shields}s`;
    const keyShort = `${myMonName.toLowerCase()}:${oppMonName.toLowerCase()}:${shields}s`;
    if (typeof ratingsDb[keyExact] === 'number') return ratingsDb[keyExact];
    if (typeof ratingsDb[keyShort] === 'number') return ratingsDb[keyShort];
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

  const rating =
    shields === 1
      ? Math.round(
          500 +
            ((bestUserCharged + minUserCharged) * 0.5 - (bestOppCharged + minOppCharged) * 0.5) * 2.8 +
            (userFastEff - oppFastEff) * 120 +
            shadowBulkDelta
        )
      : Math.round(
          500 +
            (minUserCharged - minOppCharged) * 2.0 +
            (userFastEff - oppFastEff) * 155 +
            shadowBulkDelta * 2
        );
  return Math.max(150, Math.min(850, rating));
}

export function calculateAutoLeadMatchup(
  myLead: string,
  oppLead: string,
  league: string = 'GREAT LEAGUE'
): 'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE' {
  if (!myLead?.trim() || !oppLead?.trim()) return 'NEUTRAL';
  const r1s = evaluatePvPokeMatchupRating(myLead, oppLead, 1, league);
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
 * Core Mathematical Pipeline:
 * Evaluates Battle Quality & Wins Above Expected (WAE) for a logged GBL match.
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

  // 1. Incomplete Match Rules:
  // If oppTeam.firstSwap is null/missing (or lead missing): Discard from quality calculations entirely (weight = 0)
  if (!myLead || !oppLead || !oppSwap) {
    return null;
  }

  const isUnrevealedThird = !oppClose;
  const weight = isUnrevealedThird ? 0.75 : 1.0;

  // 2. Lead Score (S_lead):
  // Blend 1v1 and 2v2 shield scenarios equally (50% / 50%)
  const ratingLead1v1 = evaluatePvPokeMatchupRating(myLead, oppLead, 1, normLeague, ratingsDb);
  const ratingLead2v2 = evaluatePvPokeMatchupRating(myLead, oppLead, 2, normLeague, ratingsDb);
  const sLead = 0.5 * ratingLead1v1 + 0.5 * ratingLead2v2;

  // 3. Backline Score (S_back):
  let scoreA: number;
  let scoreB: number;

  if (!isUnrevealedThird) {
    // Case A: 3rd Opponent is Known (w = 1.0)
    const rSwapVsOppSwap = evaluatePvPokeMatchupRating(mySwap, oppSwap, 1, normLeague, ratingsDb);
    const rCloseVsOppClose = evaluatePvPokeMatchupRating(myClose, oppClose, 1, normLeague, ratingsDb);
    const rSwapVsOppClose = evaluatePvPokeMatchupRating(mySwap, oppClose, 1, normLeague, ratingsDb);
    const rCloseVsOppSwap = evaluatePvPokeMatchupRating(myClose, oppSwap, 1, normLeague, ratingsDb);

    scoreA = (rSwapVsOppSwap + rCloseVsOppClose) / 2.0;
    scoreB = (rSwapVsOppClose + rCloseVsOppSwap) / 2.0;
  } else {
    // Case B: 3rd Opponent Unrevealed (w = 0.75) -> Meta-Average Prior
    const activeMetaPool =
      metaPool && metaPool.length > 0
        ? metaPool
        : (PVPOKE_TOP_OPPONENTS[normLeague] || PVPOKE_TOP_OPPONENTS['GREAT LEAGUE'] || []).map((m) => m.name);

    const avgRatingAgainstMeta = (myMon: string): number => {
      if (activeMetaPool.length === 0) return 500.0;
      const sum = activeMetaPool.reduce(
        (acc, metaMon) => acc + evaluatePvPokeMatchupRating(myMon, metaMon, 1, normLeague, ratingsDb),
        0
      );
      return sum / activeMetaPool.length;
    };

    const rBarSwap = avgRatingAgainstMeta(mySwap);
    const rBarClose = avgRatingAgainstMeta(myClose);
    const rSwapVsOppSwap = evaluatePvPokeMatchupRating(mySwap, oppSwap, 1, normLeague, ratingsDb);
    const rCloseVsOppSwap = evaluatePvPokeMatchupRating(myClose, oppSwap, 1, normLeague, ratingsDb);

    scoreA = (rSwapVsOppSwap + rBarClose) / 2.0;
    scoreB = (rCloseVsOppSwap + rBarSwap) / 2.0;
  }

  // Optimal Backline Assignment: 70% max + 30% min
  const sBack = 0.7 * Math.max(scoreA, scoreB) + 0.3 * Math.min(scoreA, scoreB);

  // 4. Composite Score & Expected Win Probability (P_win):
  const compositeM = 0.4 * sLead + 0.6 * sBack;
  const pWin = 1.0 / (1.0 + Math.exp(-0.006 * (compositeM - 500.0)));

  // 5. Residual Quality Delta (Delta Q):
  const numericResult = result === 'WIN' || result === 1 || result === 1.0 ? 1.0 : 0.0;
  const deltaQ = numericResult - pWin;
  const weightedResidual = weight * deltaQ;

  // 6. Badge Categorization:
  const { badgeLabel, badgeColor } = getBadgeCategorization(pWin, result);

  return {
    sLead: Number(sLead.toFixed(2)),
    sBack: Number(sBack.toFixed(2)),
    compositeM: Number(compositeM.toFixed(2)),
    pWin: Number(pWin.toFixed(4)),
    deltaQ: Number(deltaQ.toFixed(4)),
    weight,
    weightedResidual: Number(weightedResidual.toFixed(4)),
    badgeLabel,
    badgeColor,
    isUnrevealedThird
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

