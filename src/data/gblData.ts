export interface FastMove {
  name: string;
  type: string;
  turns: number; // Duration in turns (1 turn = 0.5s)
  power: number;
  energyGain: number;
}

export interface ChargedMove {
  name: string;
  code: string;
  type: string;
  power: number;
  energyCost: number;
}

export interface PokemonStats {
  speciesId: string;
  name: string;
  baseSpecies?: string;
  formLabel?: string;
  types: string[];
  baseStats: { atk: number; def: number; hp: number };
  defaultFastMove: FastMove;
  chargedMoves: ChargedMove[];
  color: string;
}

export interface TeamMember {
  id: string;
  name: string;
  cp: number;
  fastMove: string;
  chargedMove1: string;
  chargedMove2: string;
}

export interface TeamPreset {
  id: string;
  name: string;
  league: "MASTER LEAGUE" | "ULTRA LEAGUE" | "GREAT LEAGUE";
  pokemon: TeamMember[];
  isSelected?: boolean;
}

// Type effectiveness table for Pokémon GO PvP (1.6x SE, 0.625x NVE, 0.390625x Immune)
export const TYPE_EFFECTIVENESS: Record<string, Record<string, number>> = {
  normal: { rock: 0.625, steel: 0.625, ghost: 0.390625 },
  fire: { grass: 1.6, ice: 1.6, bug: 1.6, steel: 1.6, water: 0.625, fire: 0.625, rock: 0.625, dragon: 0.625 },
  electric: { water: 1.6, flying: 1.6, ground: 0.390625, dragon: 0.625, electric: 0.625, grass: 0.625 },
  water: { fire: 1.6, ground: 1.6, rock: 1.6, water: 0.625, grass: 0.625, dragon: 0.625 },
  grass: { water: 1.6, ground: 1.6, rock: 1.6, fire: 0.625, grass: 0.625, poison: 0.625, flying: 0.625, bug: 0.625, dragon: 0.625, steel: 0.625 },
  ice: { grass: 1.6, ground: 1.6, flying: 1.6, dragon: 1.6, fire: 0.625, water: 0.625, ice: 0.625, steel: 0.625 },
  dragon: { dragon: 1.6, steel: 0.625, fairy: 0.390625 },
  steel: { fairy: 1.6, ice: 1.6, rock: 1.6, fire: 0.625, water: 0.625, electric: 0.625, steel: 0.625 },
  flying: { grass: 1.6, fighting: 1.6, bug: 1.6, electric: 0.625, rock: 0.625, steel: 0.625 },
  dark: { psychic: 1.6, ghost: 1.6, fighting: 0.625, dark: 0.625, fairy: 0.625 },
  ghost: { psychic: 1.6, ghost: 1.6, dark: 0.625, normal: 0.390625 },
  psychic: { fighting: 1.6, poison: 1.6, psychic: 0.625, steel: 0.625, dark: 0.390625 },
  rock: { fire: 1.6, ice: 1.6, flying: 1.6, bug: 1.6, fighting: 0.625, ground: 0.625, steel: 0.625 },
  ground: { fire: 1.6, electric: 1.6, poison: 1.6, rock: 1.6, steel: 1.6, grass: 0.625, bug: 0.625, flying: 0.390625 },
  poison: { grass: 1.6, fairy: 1.6, poison: 0.625, ground: 0.625, rock: 0.625, ghost: 0.625, steel: 0.390625 },
  fairy: { dragon: 1.6, fighting: 1.6, dark: 1.6, fire: 0.625, poison: 0.625, steel: 0.625 },
  fighting: { normal: 1.6, ice: 1.6, rock: 1.6, dark: 1.6, steel: 1.6, flying: 0.625, psychic: 0.625, fairy: 0.625, ghost: 0.390625 }
};

export function getTypeMultiplier(attackType: string, defTypes: string[]): number {
  let mult = 1.0;
  const table = TYPE_EFFECTIVENESS[attackType.toLowerCase()];
  if (!table) return 1.0;
  for (const defType of defTypes) {
    const val = table[defType.toLowerCase()];
    if (val !== undefined) mult *= val;
  }
  return mult;
}

export const POKEMON_DATABASE: Record<string, PokemonStats> = {
  "Zacian (Crowned)": {
    speciesId: "zacian_crowned",
    name: "Zacian (Crowned)",
    baseSpecies: "zacian",
    formLabel: "Crowned",
    types: ["fairy", "steel"],
    baseStats: { atk: 264, def: 216, hp: 173 },
    defaultFastMove: { name: "Quick Attack", type: "normal", turns: 1, power: 5, energyGain: 7 },
    chargedMoves: [
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Brave Bird", code: "BB", type: "flying", power: 130, energyCost: 55 },
      { name: "Wild Charge", code: "WC", type: "electric", power: 100, energyCost: 45 }
    ],
    color: "#ec4899"
  },
  "Zacian (Hero)": {
    speciesId: "zacian_hero",
    name: "Zacian (Hero)",
    baseSpecies: "zacian",
    formLabel: "Hero",
    types: ["fairy"],
    baseStats: { atk: 232, def: 215, hp: 173 },
    defaultFastMove: { name: "Quick Attack", type: "normal", turns: 1, power: 5, energyGain: 7 },
    chargedMoves: [
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Play Rough", code: "PR", type: "fairy", power: 90, energyCost: 60 },
      { name: "Wild Charge", code: "WC", type: "electric", power: 100, energyCost: 45 }
    ],
    color: "#f472b6"
  },
  "Dialga (Origin)": {
    speciesId: "dialga_origin",
    name: "Dialga (Origin)",
    baseSpecies: "dialga",
    formLabel: "Origin",
    types: ["steel", "dragon"],
    baseStats: { atk: 241, def: 204, hp: 184 },
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 4, energyGain: 3 },
    chargedMoves: [
      { name: "Roar of Time", code: "RoT", type: "dragon", power: 150, energyCost: 65 },
      { name: "Iron Head", code: "IH", type: "steel", power: 70, energyCost: 50 },
      { name: "Thunder", code: "Th", type: "electric", power: 100, energyCost: 60 }
    ],
    color: "#3b82f6"
  },
  Lugia: {
    speciesId: "lugia",
    name: "Lugia",
    baseSpecies: "lugia",
    formLabel: "Base",
    types: ["psychic", "flying"],
    baseStats: { atk: 176, def: 274, hp: 211 },
    defaultFastMove: { name: "Dragon Tail", type: "dragon", turns: 3, power: 13, energyGain: 9 },
    chargedMoves: [
      { name: "Aeroblast", code: "AB", type: "flying", power: 170, energyCost: 75 },
      { name: "Earth Power", code: "EP", type: "ground", power: 90, energyCost: 55 },
      { name: "Sky Attack", code: "SA", type: "flying", power: 75, energyCost: 50 }
    ],
    color: "#c084fc"
  },
  Kyogre: {
    speciesId: "kyogre",
    name: "Kyogre",
    baseSpecies: "kyogre",
    formLabel: "Base",
    types: ["water"],
    baseStats: { atk: 243, def: 204, hp: 184 },
    defaultFastMove: { name: "Waterfall", type: "water", turns: 3, power: 12, energyGain: 8 },
    chargedMoves: [
      { name: "Origin Pulse", code: "OP", type: "water", power: 130, energyCost: 60 },
      { name: "Avalanche", code: "Av", type: "ice", power: 90, energyCost: 45 },
      { name: "Surf", code: "Surf", type: "water", power: 65, energyCost: 40 }
    ],
    color: "#0284c7"
  },
  "Giratina (Origin)": {
    speciesId: "giratina_origin",
    name: "Giratina (Origin)",
    baseSpecies: "giratina",
    formLabel: "Origin",
    types: ["ghost", "dragon"],
    baseStats: { atk: 206, def: 172, hp: 247 },
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 100, energyCost: 55 },
      { name: "Ominous Wind", code: "OW", type: "ghost", power: 45, energyCost: 40 },
      { name: "Dragon Pulse", code: "DP", type: "dragon", power: 90, energyCost: 60 }
    ],
    color: "#9333ea"
  },
  "Giratina (Altered)": {
    speciesId: "giratina_altered",
    name: "Giratina (Altered)",
    baseSpecies: "giratina",
    formLabel: "Altered",
    types: ["ghost", "dragon"],
    baseStats: { atk: 171, def: 206, hp: 247 },
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Dragon Claw", code: "DC", type: "dragon", power: 50, energyCost: 35 },
      { name: "Ancient Power", code: "AP", type: "rock", power: 60, energyCost: 45 },
      { name: "Shadow Sneak", code: "SS", type: "ghost", power: 50, energyCost: 45 }
    ],
    color: "#a855f7"
  },
  Zygarde: {
    speciesId: "zygarde_complete",
    name: "Zygarde",
    baseSpecies: "zygarde",
    formLabel: "Complete",
    types: ["dragon", "ground"],
    baseStats: { atk: 169, def: 186, hp: 338 },
    defaultFastMove: { name: "Dragon Tail", type: "dragon", turns: 3, power: 13, energyGain: 9 },
    chargedMoves: [
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 110, energyCost: 65 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#10b981"
  },
  Corviknight: {
    speciesId: "corviknight",
    name: "Corviknight",
    baseSpecies: "corviknight",
    formLabel: "Base",
    types: ["flying", "steel"],
    baseStats: { atk: 148, def: 178, hp: 202 },
    defaultFastMove: { name: "Sand Attack", type: "ground", turns: 1, power: 2, energyGain: 4 },
    chargedMoves: [
      { name: "Sky Attack", code: "SA", type: "flying", power: 75, energyCost: 50 },
      { name: "Iron Head", code: "IH", type: "steel", power: 70, energyCost: 50 },
      { name: "Payback", code: "PB", type: "dark", power: 110, energyCost: 60 }
    ],
    color: "#64748b"
  },
  Mimikyu: {
    speciesId: "mimikyu",
    name: "Mimikyu",
    baseSpecies: "mimikyu",
    formLabel: "Disguised",
    types: ["ghost", "fairy"],
    baseStats: { atk: 162, def: 184, hp: 138 },
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Play Rough", code: "PR", type: "fairy", power: 90, energyCost: 60 },
      { name: "Shadow Sneak", code: "SS", type: "ghost", power: 50, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 100, energyCost: 55 }
    ],
    color: "#facc15"
  },
  "Kanto Ninetales": {
    speciesId: "ninetales",
    name: "Kanto Ninetales",
    baseSpecies: "ninetales",
    formLabel: "Kanto",
    types: ["fire"],
    baseStats: { atk: 115, def: 138, hp: 127 },
    defaultFastMove: { name: "Fire Spin", type: "fire", turns: 3, power: 10, energyGain: 10 },
    chargedMoves: [
      { name: "Weather Ball", code: "WB", type: "fire", power: 55, energyCost: 35 },
      { name: "Scorching Sands", code: "SS", type: "ground", power: 80, energyCost: 50 },
      { name: "Overheat", code: "OH", type: "fire", power: 130, energyCost: 55 }
    ],
    color: "#f97316"
  },
  "Ninetales (Alolan)": {
    speciesId: "ninetales_alolan",
    name: "Ninetales (Alolan)",
    baseSpecies: "ninetales",
    formLabel: "Alolan",
    types: ["ice", "fairy"],
    baseStats: { atk: 116, def: 138, hp: 126 },
    defaultFastMove: { name: "Powder Snow", type: "ice", turns: 2, power: 5, energyGain: 8 },
    chargedMoves: [
      { name: "Weather Ball", code: "WB", type: "ice", power: 55, energyCost: 35 },
      { name: "Dazzling Gleam", code: "DG", type: "fairy", power: 100, energyCost: 70 },
      { name: "Psyshock", code: "PS", type: "psychic", power: 70, energyCost: 45 }
    ],
    color: "#38bdf8"
  },
  Fearow: {
    speciesId: "fearow",
    name: "Fearow",
    baseSpecies: "fearow",
    formLabel: "Base",
    types: ["normal", "flying"],
    baseStats: { atk: 131, def: 96, hp: 120 },
    defaultFastMove: { name: "Peck", type: "flying", turns: 2, power: 6, energyGain: 7 },
    chargedMoves: [
      { name: "Drill Run", code: "DR", type: "ground", power: 80, energyCost: 45 },
      { name: "Drill Peck", code: "DP", type: "flying", power: 65, energyCost: 40 },
      { name: "Sky Attack", code: "SA", type: "flying", power: 75, energyCost: 50 }
    ],
    color: "#d97706"
  },
  "Shadow Pidgeot": {
    speciesId: "pidgeot_shadow",
    name: "Shadow Pidgeot",
    baseSpecies: "pidgeot",
    formLabel: "Shadow",
    types: ["normal", "flying"],
    baseStats: { atk: 117, def: 112, hp: 142 },
    defaultFastMove: { name: "Gust", type: "flying", turns: 4, power: 16, energyGain: 12 },
    chargedMoves: [
      { name: "Twister", code: "Tw", type: "dragon", power: 50, energyCost: 45 },
      { name: "Brave Bird", code: "BB", type: "flying", power: 130, energyCost: 55 },
      { name: "Feather Dance", code: "FD", type: "flying", power: 35, energyCost: 50 }
    ],
    color: "#a855f7"
  },
  Raikou: {
    speciesId: "raikou",
    name: "Raikou",
    baseSpecies: "raikou",
    formLabel: "Base",
    types: ["electric"],
    baseStats: { atk: 216, def: 178, hp: 188 },
    defaultFastMove: { name: "Thunder Shock", type: "electric", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Wild Charge", code: "WC", type: "electric", power: 100, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 100, energyCost: 55 },
      { name: "Thunderbolt", code: "TB", type: "electric", power: 90, energyCost: 55 }
    ],
    color: "#eab308"
  },
  Entei: {
    speciesId: "entei",
    name: "Entei",
    baseSpecies: "entei",
    formLabel: "Base",
    types: ["fire"],
    baseStats: { atk: 211, def: 161, hp: 223 },
    defaultFastMove: { name: "Fire Fang", type: "fire", turns: 2, power: 8, energyGain: 8 },
    chargedMoves: [
      { name: "Flame Charge", code: "FC", type: "fire", power: 65, energyCost: 50 },
      { name: "Overheat", code: "OH", type: "fire", power: 130, energyCost: 55 },
      { name: "Scorching Sands", code: "SS", type: "ground", power: 80, energyCost: 50 }
    ],
    color: "#f97316"
  },
  Suicune: {
    speciesId: "suicune",
    name: "Suicune",
    baseSpecies: "suicune",
    formLabel: "Base",
    types: ["water"],
    baseStats: { atk: 166, def: 211, hp: 205 },
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Ice Beam", code: "IB", type: "ice", power: 90, energyCost: 55 },
      { name: "Hydro Pump", code: "HP", type: "water", power: 130, energyCost: 75 },
      { name: "Scald", code: "Sc", type: "water", power: 85, energyCost: 55 }
    ],
    color: "#38bdf8"
  },
  Yveltal: {
    speciesId: "yveltal",
    name: "Yveltal",
    baseSpecies: "yveltal",
    formLabel: "Base",
    types: ["dark", "flying"],
    baseStats: { atk: 225, def: 169, hp: 226 },
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 50 },
      { name: "Oblivion Wing", code: "OW", type: "flying", power: 85, energyCost: 50 },
      { name: "Focus Blast", code: "FB", type: "fighting", power: 150, energyCost: 75 }
    ],
    color: "#dc2626"
  }
};

export const SPECIES_VARIANTS: Record<string, string[]> = {
  zacian: ["Zacian (Crowned)", "Zacian (Hero)"],
  giratina: ["Giratina (Origin)", "Giratina (Altered)"],
  ninetales: ["Ninetales (Alolan)", "Kanto Ninetales"],
  dialga: ["Dialga (Origin)"]
};

export function getAvailableFormsForPokemon(name: string): string[] {
  const stats = POKEMON_DATABASE[name];
  const base = stats?.baseSpecies || name.split(" ")[0].toLowerCase();
  return SPECIES_VARIANTS[base] || [name];
}

/**
 * Calculates zero-sneak optimal throw attack numbers
 * User fast move duration vs Opponent fast move duration
 */
export function calculateTurnAlignment(userTurns: number, oppTurns: number): {
  zeroSneakAttacks: number[];
  optimalThrowText: string;
  horizonText: string;
  explanation: string;
} {
  const zeroSneakAttacks: number[] = [];

  for (let attack = 1; attack <= 10; attack++) {
    const totalUserTurns = attack * userTurns;
    if (totalUserTurns % oppTurns !== 0) {
      zeroSneakAttacks.push(attack);
    }
    if (zeroSneakAttacks.length >= 3) break;
  }

  const attacks = zeroSneakAttacks.length > 0 ? zeroSneakAttacks : [3, 5, 7];
  const optimalThrowText = attacks.map(a => `${a}${getOrdinal(a)}`).join(", ") + " Attack";
  const horizonText = attacks.join(", ");

  let explanation = "";
  if (userTurns === oppTurns) {
    explanation = `Both Pokémon use ${userTurns}-turn fast moves. Throws align every turn, timing is neutral.`;
  } else {
    explanation = `Your move is ${userTurns}t (${userTurns * 0.5}s), opponent's is ${oppTurns}t (${oppTurns * 0.5}s). Throwing on ${optimalThrowText} forces your charge attack while opponent is locked mid-animation, preventing sneak damage.`;
  }

  return {
    zeroSneakAttacks: attacks,
    optimalThrowText,
    horizonText,
    explanation
  };
}

function getOrdinal(n: number): string {
  if (n === 1) return "st";
  if (n === 2) return "nd";
  if (n === 3) return "rd";
  return "th";
}

/**
 * Computes exact PvPoke Charged Move damage %:
 * Floor(0.5 * Power * (EffectiveAtk / EffectiveDef) * STAB * TypeMultiplier * 1.3) + 1
 * Accounts for Shadow 1.2x Attack and 0.8333333x Defense modifiers.
 */
export function calculateChargedDamage(
  attacker: PokemonStats,
  defender: PokemonStats,
  move: ChargedMove,
  isAttackerShadow: boolean = false,
  isDefenderShadow: boolean = false
): { damage: number; percentage: number; isStab: boolean; mult: number } {
  const isStab = attacker.types.includes(move.type);
  const stabMult = isStab ? 1.2 : 1.0;
  const typeMult = getTypeMultiplier(move.type, defender.types);

  const atk = attacker.baseStats.atk * (isAttackerShadow ? 1.2 : 1.0);
  const def = defender.baseStats.def * (isDefenderShadow ? 0.8333333 : 1.0);
  const maxHp = defender.baseStats.hp;

  const baseDamage = Math.floor(0.5 * move.power * (atk / def) * stabMult * typeMult * 1.3) + 1;
  const percentage = Math.min(100, Math.max(5, Math.round((baseDamage / maxHp) * 100)));

  return {
    damage: baseDamage,
    percentage,
    isStab,
    mult: typeMult
  };
}

/**
 * Computes 3v3 matchup tiers (0s, 1s, 2s shields)
 * Returns comma-separated 5-tier codes per shield scenario:
 *  - "SW": Strong Win (Dominant type/stat advantage)
 *  - "W":  Win
 *  - "N":  Neutral (Grey)
 *  - "L":  Loss
 *  - "SL": Strong Loss (Hard walled or double super-effective against)
 */
export function calculateShieldMatrix(
  oppName: string,
  teamMembers: string[],
  isOppShadow: boolean = false
): Record<string, string> {
  const result: Record<string, string> = {};
  const oppStats = POKEMON_DATABASE[oppName] || Object.values(POKEMON_DATABASE)[0];

  teamMembers.forEach((member, idx) => {
    const key = `p${idx + 1}`;
    const isMyShadow = member.toLowerCase().startsWith("shadow ");
    const cleanMyName = member.replace(/^Shadow\s+/i, "").trim();
    const myStats =
      POKEMON_DATABASE[member] ||
      POKEMON_DATABASE[cleanMyName] ||
      Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanMyName.toLowerCase()) ||
      Object.values(POKEMON_DATABASE)[0];

    const myFastEff = getTypeMultiplier(myStats.defaultFastMove.type, oppStats.types);
    const myFastStab = myStats.types.includes(myStats.defaultFastMove.type) ? 1.2 : 1.0;
    const myFastScore = myFastEff * myFastStab * (isMyShadow ? 1.12 : 1.0);

    const oppFastEff = getTypeMultiplier(oppStats.defaultFastMove.type, myStats.types);
    const oppFastStab = oppStats.types.includes(oppStats.defaultFastMove.type) ? 1.2 : 1.0;
    const oppFastScore = oppFastEff * oppFastStab * (isOppShadow ? 1.12 : 1.0);

    const myChargedDamages = myStats.chargedMoves.map(
      (cm) => calculateDamage(myStats, oppStats, cm, isMyShadow, isOppShadow).percentage
    );
    const myMaxCharged = myChargedDamages.length ? Math.max(...myChargedDamages) : 45;
    const myMinEnergy = myStats.chargedMoves.length
      ? Math.min(...myStats.chargedMoves.map((c) => c.energyCost))
      : 45;

    const oppChargedDamages = oppStats.chargedMoves.map(
      (cm) => calculateDamage(oppStats, myStats, cm, isOppShadow, isMyShadow).percentage
    );
    const oppMaxCharged = oppChargedDamages.length ? Math.max(...oppChargedDamages) : 45;
    const oppMinEnergy = oppStats.chargedMoves.length
      ? Math.min(...oppStats.chargedMoves.map((c) => c.energyCost))
      : 45;

    const myBulk = myStats.baseStats.def * myStats.baseStats.hp * (isMyShadow ? 0.833 : 1.0);
    const oppBulk = oppStats.baseStats.def * oppStats.baseStats.hp * (isOppShadow ? 0.833 : 1.0);
    const bulkRatio = oppBulk > 0 ? Math.min(1.35, Math.max(0.7, myBulk / oppBulk)) : 1.0;

    const fastRatio = oppFastScore > 0 ? myFastScore / oppFastScore : 1.0;
    const chargedRatio = oppMaxCharged > 0 ? myMaxCharged / oppMaxCharged : 1.0;
    const paceAdvantage = (oppMinEnergy - myMinEnergy) / 100.0;

    const score0s = fastRatio * 0.4 + chargedRatio * 0.45 + bulkRatio * 0.15 + paceAdvantage * 0.5;
    const score1s = fastRatio * 0.52 + chargedRatio * 0.28 + bulkRatio * 0.2 + paceAdvantage * 0.8;
    const score2s = fastRatio * 0.68 + chargedRatio * 0.14 + bulkRatio * 0.18 + paceAdvantage * 0.45;

    const toTier = (score: number): string => {
      if (score >= 1.28) return "SW";
      if (score >= 1.07) return "W";
      if (score >= 0.93) return "N";
      if (score >= 0.76) return "L";
      return "SL";
    };

    result[key] = `${toTier(score0s)},${toTier(score1s)},${toTier(score2s)}`;
  });

  return result;
}

export const INITIAL_PRESETS: TeamPreset[] = [
  {
    id: "preset-ml-1",
    name: "Master: Dialga-O / Lugia / Kyogre",
    league: "MASTER LEAGUE",
    isSelected: true,
    pokemon: [
      {
        id: "p1",
        name: "Dialga (Origin)",
        cp: 4624,
        fastMove: "Dragon Breath",
        chargedMove1: "Roar of Time",
        chargedMove2: "Iron Head"
      },
      {
        id: "p2",
        name: "Lugia",
        cp: 4179,
        fastMove: "Dragon Tail",
        chargedMove1: "Aeroblast",
        chargedMove2: "Earth Power"
      },
      {
        id: "p3",
        name: "Kyogre",
        cp: 4652,
        fastMove: "Waterfall",
        chargedMove1: "Origin Pulse",
        chargedMove2: "Avalanche"
      }
    ]
  },
  {
    id: "preset-ul-1",
    name: "Ultra: Zygarde / Corviknight / Mimikyu",
    league: "ULTRA LEAGUE",
    pokemon: [
      {
        id: "u1",
        name: "Zygarde",
        cp: 2472,
        fastMove: "Dragon Tail",
        chargedMove1: "Crunch",
        chargedMove2: "Earthquake"
      },
      {
        id: "u2",
        name: "Corviknight",
        cp: 2499,
        fastMove: "Sand Attack",
        chargedMove1: "Sky Attack",
        chargedMove2: "Iron Head"
      },
      {
        id: "u3",
        name: "Mimikyu",
        cp: 2497,
        fastMove: "Shadow Claw",
        chargedMove1: "Play Rough",
        chargedMove2: "Shadow Sneak"
      }
    ]
  },
  {
    id: "preset-gl-1",
    name: "Great: Kanto Ninetales / Fearow / S-Pidgeot",
    league: "GREAT LEAGUE",
    pokemon: [
      {
        id: "g1",
        name: "Kanto Ninetales",
        cp: 1498,
        fastMove: "Fire Spin",
        chargedMove1: "Weather Ball",
        chargedMove2: "Scorching Sands"
      },
      {
        id: "g2",
        name: "Fearow",
        cp: 1500,
        fastMove: "Peck",
        chargedMove1: "Drill Run",
        chargedMove2: "Drill Peck"
      },
      {
        id: "g3",
        name: "Shadow Pidgeot",
        cp: 1490,
        fastMove: "Gust",
        chargedMove1: "Twister",
        chargedMove2: "Brave Bird"
      }
    ]
  }
];

