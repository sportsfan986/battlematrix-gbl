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
  isRawBaseStats?: boolean;
  defaultIvsGl?: string;
  defaultIvsUl?: string;
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
  ivs?: string;
}

export type LeagueType = "MEGA MASTER LEAGUE" | "MASTER LEAGUE" | "ULTRA LEAGUE" | "GREAT LEAGUE";

export interface MoveUsage {
  moveId: string;
  uses?: number;
}

export interface RankingMoves {
  fastMoves: MoveUsage[];
  chargedMoves: MoveUsage[];
}

export interface PokemonRankingEntry {
  speciesId: string;
  score: number;
  moves: RankingMoves;
  moveCount?: number[];
  moveset?: string[];
}

export const PVPOKE_ENDPOINTS = {
  GAMEMASTER: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/gamemaster.json",
  RANKINGS_GL: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-1500.json",
  RANKINGS_UL: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-2500.json",
  RANKINGS_ML: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/all/overall/rankings-10000.json",
  RANKINGS_MEGA_ML: "https://raw.githubusercontent.com/pvpoke/pvpoke/master/src/data/rankings/mega/overall/rankings-10000.json"
} as const;

export type TeamArchetype = "ABB" | "ABC";

export interface TeamPreset {
  id: string;
  name: string;
  league: LeagueType;
  pokemon: TeamMember[];
  isSelected?: boolean;
  archetype?: TeamArchetype;
  isArchetypeManual?: boolean;
  leadAggBr?: number;
  machineAggBr?: number;
  safeSwapBr?: number;
  closerSwapBr?: number;
  closerBr?: number;
  sharedWeaknesses?: string[];
  metricsUpdatedAt?: number;
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
  bug: { grass: 1.6, psychic: 1.6, dark: 1.6, fire: 0.625, fighting: 0.625, poison: 0.625, flying: 0.625, ghost: 0.625, steel: 0.625, fairy: 0.625 },
  rock: { fire: 1.6, ice: 1.6, flying: 1.6, bug: 1.6, fighting: 0.625, ground: 0.625, steel: 0.625 },
  ground: { fire: 1.6, electric: 1.6, poison: 1.6, rock: 1.6, steel: 1.6, grass: 0.625, bug: 0.625, flying: 0.390625 },
  poison: { grass: 1.6, fairy: 1.6, poison: 0.625, ground: 0.625, rock: 0.625, ghost: 0.625, steel: 0.390625 },
  fairy: { dragon: 1.6, fighting: 1.6, dark: 1.6, fire: 0.625, poison: 0.625, steel: 0.625 },
  fighting: { normal: 1.6, ice: 1.6, rock: 1.6, dark: 1.6, steel: 1.6, poison: 0.625, flying: 0.625, psychic: 0.625, bug: 0.625, fairy: 0.625, ghost: 0.390625 }
};

export function getTypeMultiplier(attackType: string, defTypes: string[]): number {
  let mult = 1.0;
  const table = TYPE_EFFECTIVENESS[(attackType || "").toLowerCase().trim()];
  if (!table) return 1.0;
  const uniqueDefTypes = Array.from(
    new Set((defTypes || []).map((t) => (t || "").toLowerCase().trim()).filter((t) => t && t !== "none"))
  );
  for (const defType of uniqueDefTypes) {
    const val = table[defType];
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
    baseStats: { atk: 332, def: 240, hp: 192 },
    isRawBaseStats: true,
    defaultIvsGl: "7/9/12",
    defaultIvsUl: "6/13/15",
    defaultFastMove: { name: "Metal Claw", type: "steel", turns: 2, power: 5, energyGain: 7 },
    chargedMoves: [
      { name: "Behemoth Blade", code: "BBl", type: "steel", power: 100, energyCost: 55 },
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Play Rough", code: "PR", type: "fairy", power: 90, energyCost: 60 }
    ],
    color: "#ec4899"
  },
  "Zacian (Hero)": {
    speciesId: "zacian_hero",
    name: "Zacian (Hero)",
    baseSpecies: "zacian",
    formLabel: "Hero",
    types: ["fairy"],
    baseStats: { atk: 254, def: 236, hp: 192 },
    isRawBaseStats: true,
    defaultIvsGl: "5/7/14",
    defaultIvsUl: "5/10/13",
    defaultFastMove: { name: "Quick Attack", type: "normal", turns: 1, power: 5, energyGain: 7 },
    chargedMoves: [
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Play Rough", code: "PR", type: "fairy", power: 90, energyCost: 60 },
      { name: "Wild Charge", code: "WC", type: "electric", power: 100, energyCost: 45 }
    ],
    color: "#f472b6"
  },
  "Zamazenta (Crowned)": {
    speciesId: "zamazenta_crowned",
    name: "Zamazenta (Crowned)",
    baseSpecies: "zamazenta",
    formLabel: "Crowned",
    types: ["fighting", "steel"],
    baseStats: { atk: 250, def: 292, hp: 192 },
    isRawBaseStats: true,
    defaultIvsGl: "6/13/14",
    defaultIvsUl: "6/7/14",
    defaultFastMove: { name: "Metal Claw", type: "steel", turns: 2, power: 5, energyGain: 7 },
    chargedMoves: [
      { name: "Behemoth Bash", code: "BBs", type: "steel", power: 80, energyCost: 45 },
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Moonblast", code: "MB", type: "fairy", power: 90, energyCost: 50 }
    ],
    color: "#ef4444"
  },
  "Zamazenta (Hero)": {
    speciesId: "zamazenta_hero",
    name: "Zamazenta (Hero)",
    baseSpecies: "zamazenta",
    formLabel: "Hero",
    types: ["fighting"],
    baseStats: { atk: 254, def: 236, hp: 192 },
    isRawBaseStats: true,
    defaultIvsGl: "5/7/14",
    defaultIvsUl: "5/10/13",
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 },
      { name: "Moonblast", code: "MB", type: "fairy", power: 90, energyCost: 50 }
    ],
    color: "#f87171"
  },
  "Keldeo (Resolute)": {
    speciesId: "keldeo_resolute",
    name: "Keldeo (Resolute)",
    baseSpecies: "keldeo",
    formLabel: "Resolute",
    types: ["water", "fighting"],
    baseStats: { atk: 260, def: 192, hp: 209 },
    isRawBaseStats: true,
    defaultIvsGl: "12/12/13",
    defaultIvsUl: "11/14/13",
    defaultFastMove: { name: "Low Kick", type: "fighting", turns: 2, power: 4, energyGain: 7 },
    chargedMoves: [
      { name: "Secret Sword", code: "SS", type: "fighting", power: 70, energyCost: 35 },
      { name: "Aqua Jet", code: "AJ", type: "water", power: 70, energyCost: 40 },
      { name: "Hydro Pump", code: "HP", type: "water", power: 130, energyCost: 75 }
    ],
    color: "#0ea5e9"
  },
  "Keldeo (Ordinary)": {
    speciesId: "keldeo_ordinary",
    name: "Keldeo (Ordinary)",
    baseSpecies: "keldeo",
    formLabel: "Ordinary",
    types: ["water", "fighting"],
    baseStats: { atk: 260, def: 192, hp: 209 },
    isRawBaseStats: true,
    defaultIvsGl: "0/0/0",
    defaultIvsUl: "11/14/13",
    defaultFastMove: { name: "Low Kick", type: "fighting", turns: 2, power: 4, energyGain: 7 },
    chargedMoves: [
      { name: "Sacred Sword", code: "ScS", type: "fighting", power: 60, energyCost: 35 },
      { name: "Aqua Jet", code: "AJ", type: "water", power: 70, energyCost: 40 },
      { name: "Hydro Pump", code: "HP", type: "water", power: 130, energyCost: 75 }
    ],
    color: "#38bdf8"
  },
  "Dialga (Origin)": {
    speciesId: "dialga_origin",
    name: "Dialga (Origin)",
    baseSpecies: "dialga",
    formLabel: "Origin",
    types: ["steel", "dragon"],
    baseStats: { atk: 270, def: 225, hp: 205 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/8",
    defaultIvsUl: "7/14/14",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 4, energyGain: 3 },
    chargedMoves: [
      { name: "Roar of Time", code: "RoT", type: "dragon", power: 150, energyCost: 65 },
      { name: "Iron Head", code: "IH", type: "steel", power: 85, energyCost: 50 },
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
    baseStats: { atk: 193, def: 310, hp: 235 },
    isRawBaseStats: true,
    defaultIvsGl: "5/13/12",
    defaultIvsUl: "5/13/12",
    defaultFastMove: { name: "Dragon Tail", type: "dragon", turns: 3, power: 13, energyGain: 9 },
    chargedMoves: [
      { name: "Aeroblast", code: "AB", type: "flying", power: 170, energyCost: 75 },
      { name: "Earth Power", code: "EP", type: "ground", power: 90, energyCost: 50 },
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
    baseStats: { atk: 270, def: 228, hp: 205 },
    isRawBaseStats: true,
    defaultIvsGl: "6/14/5",
    defaultIvsUl: "4/9/12",
    defaultFastMove: { name: "Waterfall", type: "water", turns: 3, power: 12, energyGain: 8 },
    chargedMoves: [
      { name: "Origin Pulse", code: "OP", type: "water", power: 130, energyCost: 60 },
      { name: "Avalanche", code: "Av", type: "ice", power: 90, energyCost: 45 },
      { name: "Surf", code: "Surf", type: "water", power: 75, energyCost: 45 }
    ],
    color: "#0284c7"
  },
  "Giratina (Origin)": {
    speciesId: "giratina_origin",
    name: "Giratina (Origin)",
    baseSpecies: "giratina",
    formLabel: "Origin",
    types: ["ghost", "dragon"],
    baseStats: { atk: 225, def: 187, hp: 284 },
    isRawBaseStats: true,
    defaultIvsGl: "7/9/14",
    defaultIvsUl: "6/14/9",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Ominous Wind", code: "OW", type: "ghost", power: 45, energyCost: 45 },
      { name: "Dragon Pulse", code: "DP", type: "dragon", power: 90, energyCost: 55 }
    ],
    color: "#9333ea"
  },
  "Giratina (Altered)": {
    speciesId: "giratina_altered",
    name: "Giratina (Altered)",
    baseSpecies: "giratina",
    formLabel: "Altered",
    types: ["ghost", "dragon"],
    baseStats: { atk: 187, def: 225, hp: 284 },
    isRawBaseStats: true,
    defaultIvsGl: "6/15/6",
    defaultIvsUl: "5/15/8",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Dragon Claw", code: "DC", type: "dragon", power: 80, energyCost: 50 },
      { name: "Ancient Power", code: "AP", type: "rock", power: 60, energyCost: 45 },
      { name: "Shadow Sneak", code: "SS", type: "ghost", power: 75, energyCost: 50 }
    ],
    color: "#a855f7"
  },
  Zygarde: {
    speciesId: "zygarde_complete",
    name: "Zygarde",
    baseSpecies: "zygarde",
    formLabel: "Complete",
    types: ["dragon", "ground"],
    baseStats: { atk: 184, def: 207, hp: 389 },
    isRawBaseStats: true,
    defaultIvsGl: "0/0/0",
    defaultIvsUl: "13/10/15",
    defaultFastMove: { name: "Dragon Tail", type: "dragon", turns: 3, power: 13, energyGain: 9 },
    chargedMoves: [
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 },
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
    baseStats: { atk: 163, def: 192, hp: 221 },
    isRawBaseStats: true,
    defaultIvsGl: "4/12/14",
    defaultIvsUl: "4/14/13",
    defaultFastMove: { name: "Sand Attack", type: "ground", turns: 1, power: 2, energyGain: 4 },
    chargedMoves: [
      { name: "Air Cutter", code: "AC", type: "flying", power: 60, energyCost: 40 },
      { name: "Iron Head", code: "IH", type: "steel", power: 85, energyCost: 50 },
      { name: "Sky Attack", code: "SA", type: "flying", power: 75, energyCost: 50 }
    ],
    color: "#64748b"
  },
  Mimikyu: {
    speciesId: "mimikyu",
    name: "Mimikyu",
    baseSpecies: "mimikyu",
    formLabel: "Disguised",
    types: ["ghost", "fairy"],
    baseStats: { atk: 177, def: 199, hp: 146 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/15",
    defaultIvsUl: "13/15/15",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Play Rough", code: "PR", type: "fairy", power: 90, energyCost: 60 },
      { name: "Shadow Sneak", code: "SS", type: "ghost", power: 75, energyCost: 50 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 }
    ],
    color: "#facc15"
  },
  "Kanto Ninetales": {
    speciesId: "ninetales",
    name: "Kanto Ninetales",
    baseSpecies: "ninetales",
    formLabel: "Kanto",
    types: ["fire"],
    baseStats: { atk: 169, def: 190, hp: 177 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/14",
    defaultIvsUl: "12/15/14",
    defaultFastMove: { name: "Ember", type: "fire", turns: 2, power: 7, energyGain: 6 },
    chargedMoves: [
      { name: "Weather Ball (Fire)", code: "WB-F", type: "fire", power: 60, energyCost: 35 },
      { name: "Energy Ball", code: "EB", type: "grass", power: 80, energyCost: 45 },
      { name: "Psyshock", code: "PS", type: "psychic", power: 70, energyCost: 40 }
    ],
    color: "#f97316"
  },
  Tinkaton: {
    speciesId: "tinkaton",
    name: "Tinkaton",
    baseSpecies: "tinkaton",
    formLabel: "Base",
    types: ["fairy", "steel"],
    baseStats: { atk: 155, def: 196, hp: 198 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/14",
    defaultIvsUl: "12/15/15",
    defaultFastMove: { name: "Fairy Wind", type: "fairy", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Gigaton Hammer", code: "GH", type: "steel", power: 130, energyCost: 60 },
      { name: "Bulldoze", code: "BD", type: "ground", power: 80, energyCost: 55 },
      { name: "Brutal Swing", code: "BS", type: "dark", power: 55, energyCost: 35 }
    ],
    color: "#ec4899"
  },
  Rillaboom: {
    speciesId: "rillaboom",
    name: "Rillaboom",
    baseSpecies: "rillaboom",
    formLabel: "Base",
    types: ["grass"],
    baseStats: { atk: 239, def: 168, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/13",
    defaultIvsUl: "4/14/15",
    defaultFastMove: { name: "Scratch", type: "normal", turns: 1, power: 4, energyGain: 2 },
    chargedMoves: [
      { name: "Drum Beating", code: "DB", type: "grass", power: 60, energyCost: 35 },
      { name: "Earth Power", code: "EP", type: "ground", power: 90, energyCost: 50 },
      { name: "Frenzy Plant", code: "FP", type: "grass", power: 100, energyCost: 45 }
    ],
    color: "#22c55e"
  },
  "Ninetales (Alolan)": {
    speciesId: "ninetales_alolan",
    name: "Ninetales (Alolan)",
    baseSpecies: "ninetales",
    formLabel: "Alolan",
    types: ["ice", "fairy"],
    baseStats: { atk: 170, def: 193, hp: 177 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/15",
    defaultIvsUl: "13/15/14",
    defaultFastMove: { name: "Powder Snow", type: "ice", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Weather Ball (Ice)", code: "WB-I", type: "ice", power: 60, energyCost: 35 },
      { name: "Chilling Water", code: "ChW", type: "water", power: 60, energyCost: 45 },
      { name: "Psyshock", code: "PS", type: "psychic", power: 70, energyCost: 40 }
    ],
    color: "#38bdf8"
  },
  "Alolan Ninetales": {
    speciesId: "ninetales_alolan",
    name: "Ninetales (Alolan)",
    baseSpecies: "ninetales",
    formLabel: "Alolan",
    types: ["ice", "fairy"],
    baseStats: { atk: 170, def: 193, hp: 177 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/15",
    defaultIvsUl: "13/15/14",
    defaultFastMove: { name: "Powder Snow", type: "ice", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Weather Ball (Ice)", code: "WB-I", type: "ice", power: 60, energyCost: 35 },
      { name: "Chilling Water", code: "ChW", type: "water", power: 60, energyCost: 45 },
      { name: "Psyshock", code: "PS", type: "psychic", power: 70, energyCost: 40 }
    ],
    color: "#38bdf8"
  },
  Fearow: {
    speciesId: "fearow",
    name: "Fearow",
    baseSpecies: "fearow",
    formLabel: "Base",
    types: ["normal", "flying"],
    baseStats: { atk: 182, def: 133, hp: 163 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/13",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Peck", type: "flying", turns: 2, power: 6, energyGain: 7 },
    chargedMoves: [
      { name: "Drill Run", code: "DR", type: "ground", power: 70, energyCost: 40 },
      { name: "Drill Peck", code: "DP", type: "flying", power: 70, energyCost: 40 },
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
    baseStats: { atk: 166, def: 154, hp: 195 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/12",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Gust", type: "flying", turns: 4, power: 16, energyGain: 12 },
    chargedMoves: [
      { name: "Twister", code: "Tw", type: "dragon", power: 70, energyCost: 40 },
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
    baseStats: { atk: 241, def: 195, hp: 207 },
    isRawBaseStats: true,
    defaultIvsGl: "6/12/11",
    defaultIvsUl: "5/13/13",
    defaultFastMove: { name: "Thunder Shock", type: "electric", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Wild Charge", code: "WC", type: "electric", power: 100, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
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
    baseStats: { atk: 235, def: 171, hp: 251 },
    isRawBaseStats: true,
    defaultIvsGl: "7/9/11",
    defaultIvsUl: "6/12/12",
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
    baseStats: { atk: 180, def: 235, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "5/14/14",
    defaultIvsUl: "5/15/12",
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Ice Beam", code: "IB", type: "ice", power: 90, energyCost: 55 },
      { name: "Hydro Pump", code: "HP", type: "water", power: 130, energyCost: 75 },
      { name: "Scald", code: "Sc", type: "water", power: 85, energyCost: 50 }
    ],
    color: "#38bdf8"
  },
  Yveltal: {
    speciesId: "yveltal",
    name: "Yveltal",
    baseSpecies: "yveltal",
    formLabel: "Base",
    types: ["dark", "flying"],
    baseStats: { atk: 250, def: 185, hp: 246 },
    isRawBaseStats: true,
    defaultIvsGl: "7/13/11",
    defaultIvsUl: "4/14/8",
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 45 },
      { name: "Oblivion Wing", code: "OW", type: "flying", power: 85, energyCost: 50 },
      { name: "Focus Blast", code: "FB", type: "fighting", power: 150, energyCost: 75 }
    ],
    color: "#dc2626"
  },
  "Kyurem (Black)": {
    speciesId: "kyurem_black",
    name: "Kyurem (Black)",
    baseSpecies: "kyurem",
    formLabel: "Black",
    types: ["dragon", "ice"],
    baseStats: { atk: 310, def: 183, hp: 245 },
    isRawBaseStats: true,
    defaultIvsGl: "7/10/8",
    defaultIvsUl: "9/13/14",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Freeze Shock", code: "FS", type: "ice", power: 120, energyCost: 60 },
      { name: "Fusion Bolt", code: "FB", type: "electric", power: 90, energyCost: 45 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#38bdf8"
  },
  "Kyurem (White)": {
    speciesId: "kyurem_white",
    name: "Kyurem (White)",
    baseSpecies: "kyurem",
    formLabel: "White",
    types: ["dragon", "ice"],
    baseStats: { atk: 310, def: 183, hp: 245 },
    isRawBaseStats: true,
    defaultIvsGl: "7/10/8",
    defaultIvsUl: "9/13/14",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 4, energyGain: 3 },
    chargedMoves: [
      { name: "Ice Burn", code: "IB", type: "ice", power: 120, energyCost: 60 },
      { name: "Fusion Flare", code: "FF", type: "fire", power: 90, energyCost: 45 },
      { name: "Blizzard", code: "Blz", type: "ice", power: 140, energyCost: 75 }
    ],
    color: "#f87171"
  },
  Kyurem: {
    speciesId: "kyurem",
    name: "Kyurem",
    baseSpecies: "kyurem",
    formLabel: "Base",
    types: ["dragon", "ice"],
    baseStats: { atk: 246, def: 170, hp: 245 },
    isRawBaseStats: true,
    defaultIvsGl: "9/15/14",
    defaultIvsUl: "5/8/14",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 4, energyGain: 3 },
    chargedMoves: [
      { name: "Glaciate", code: "Gl", type: "ice", power: 60, energyCost: 40 },
      { name: "Dragon Claw", code: "DC", type: "dragon", power: 80, energyCost: 50 },
      { name: "Blizzard", code: "Blz", type: "ice", power: 140, energyCost: 75 }
    ],
    color: "#60a5fa"
  },
  "Palkia (Origin)": {
    speciesId: "palkia_origin",
    name: "Palkia (Origin)",
    baseSpecies: "palkia",
    formLabel: "Origin",
    types: ["water", "dragon"],
    baseStats: { atk: 286, def: 223, hp: 189 },
    isRawBaseStats: true,
    defaultIvsGl: "7/15/13",
    defaultIvsUl: "11/13/15",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 4, energyGain: 3 },
    chargedMoves: [
      { name: "Spacial Rend", code: "SR", type: "dragon", power: 95, energyCost: 55 },
      { name: "Aqua Tail", code: "AT", type: "water", power: 55, energyCost: 35 },
      { name: "Draco Meteor", code: "DM", type: "dragon", power: 150, energyCost: 65 }
    ],
    color: "#38bdf8"
  },
  "Necrozma (Dusk Mane)": {
    speciesId: "necrozma_dusk_mane",
    name: "Necrozma (Dusk Mane)",
    baseSpecies: "necrozma",
    formLabel: "Dusk Mane",
    types: ["psychic", "steel"],
    baseStats: { atk: 277, def: 220, hp: 200 },
    isRawBaseStats: true,
    defaultIvsGl: "4/9/14",
    defaultIvsUl: "4/15/9",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Sunsteel Strike", code: "SS", type: "steel", power: 135, energyCost: 65 },
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 45 },
      { name: "Iron Head", code: "IH", type: "steel", power: 85, energyCost: 50 }
    ],
    color: "#f59e0b"
  },
  "Necrozma (Dawn Wings)": {
    speciesId: "necrozma_dawn_wings",
    name: "Necrozma (Dawn Wings)",
    baseSpecies: "necrozma",
    formLabel: "Dawn Wings",
    types: ["psychic", "ghost"],
    baseStats: { atk: 277, def: 220, hp: 200 },
    isRawBaseStats: true,
    defaultIvsGl: "4/9/14",
    defaultIvsUl: "4/15/9",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Moongeist Beam", code: "MB", type: "ghost", power: 135, energyCost: 65 },
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 45 },
      { name: "Iron Head", code: "IH", type: "steel", power: 85, energyCost: 50 }
    ],
    color: "#8b5cf6"
  },
  "Landorus (Therian)": {
    speciesId: "landorus_therian",
    name: "Landorus (Therian)",
    baseSpecies: "landorus",
    formLabel: "Therian",
    types: ["ground", "flying"],
    baseStats: { atk: 289, def: 179, hp: 205 },
    isRawBaseStats: true,
    defaultIvsGl: "6/9/15",
    defaultIvsUl: "6/15/12",
    defaultFastMove: { name: "Mud Shot", type: "ground", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Sandsear Storm", code: "SS", type: "ground", power: 60, energyCost: 45 },
      { name: "Stone Edge", code: "SE", type: "rock", power: 100, energyCost: 55 },
      { name: "Superpower", code: "SP", type: "fighting", power: 85, energyCost: 40 }
    ],
    color: "#ea580c"
  },
  "Ho-Oh": {
    speciesId: "ho_oh",
    name: "Ho-Oh",
    baseSpecies: "ho-oh",
    formLabel: "Base",
    types: ["fire", "flying"],
    baseStats: { atk: 239, def: 244, hp: 214 },
    isRawBaseStats: true,
    defaultIvsGl: "7/13/15",
    defaultIvsUl: "5/15/13",
    defaultFastMove: { name: "Incinerate", type: "fire", turns: 5, power: 20, energyGain: 20 },
    chargedMoves: [
      { name: "Sacred Fire", code: "SF", type: "fire", power: 130, energyCost: 65 },
      { name: "Brave Bird", code: "BB", type: "flying", power: 130, energyCost: 55 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 }
    ],
    color: "#ef4444"
  },
  "Mewtwo": {
    speciesId: "mewtwo",
    name: "Mewtwo",
    baseSpecies: "mewtwo",
    formLabel: "Base",
    types: ["psychic"],
    baseStats: { atk: 300, def: 182, hp: 214 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/13",
    defaultIvsUl: "8/13/14",
    defaultFastMove: { name: "Psycho Cut", type: "psychic", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Psystrike", code: "PS", type: "psychic", power: 90, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Focus Blast", code: "FB", type: "fighting", power: 150, energyCost: 75 }
    ],
    color: "#c084fc"
  },
  "Mewtwo (Armored)": {
    speciesId: "mewtwo_armored",
    name: "Mewtwo (Armored)",
    baseSpecies: "mewtwo",
    formLabel: "Armored",
    types: ["psychic"],
    baseStats: { atk: 182, def: 278, hp: 214 },
    isRawBaseStats: true,
    defaultIvsGl: "1/15/15",
    defaultIvsUl: "1/15/15",
    defaultFastMove: { name: "Confusion", type: "psychic", turns: 4, power: 16, energyGain: 12 },
    chargedMoves: [
      { name: "Psystrike", code: "PS", type: "psychic", power: 90, energyCost: 45 },
      { name: "Dynamic Punch", code: "DP", type: "fighting", power: 85, energyCost: 45 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 110, energyCost: 65 }
    ],
    color: "#9333ea"
  },
  "Armored Mewtwo": {
    speciesId: "mewtwo_armored",
    name: "Mewtwo (Armored)",
    baseSpecies: "mewtwo",
    formLabel: "Armored",
    types: ["psychic"],
    baseStats: { atk: 182, def: 278, hp: 214 },
    isRawBaseStats: true,
    defaultIvsGl: "1/15/15",
    defaultIvsUl: "1/15/15",
    defaultFastMove: { name: "Confusion", type: "psychic", turns: 4, power: 16, energyGain: 12 },
    chargedMoves: [
      { name: "Psystrike", code: "PS", type: "psychic", power: 90, energyCost: 45 },
      { name: "Dynamic Punch", code: "DP", type: "fighting", power: 85, energyCost: 45 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 110, energyCost: 65 }
    ],
    color: "#9333ea"
  },
  "Mew": {
    speciesId: "mew",
    name: "Mew",
    baseSpecies: "mew",
    formLabel: "Base",
    types: ["psychic"],
    baseStats: { atk: 210, def: 210, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "10/15/13",
    defaultIvsUl: "0/14/15",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Psyshock", code: "PS", type: "psychic", power: 70, energyCost: 45 },
      { name: "Wild Charge", code: "WC", type: "electric", power: 100, energyCost: 45 },
      { name: "Surf", code: "Su", type: "water", power: 65, energyCost: 40 }
    ],
    color: "#f472b6"
  },
  "Feraligatr": {
    speciesId: "feraligatr",
    name: "Feraligatr",
    baseSpecies: "feraligatr",
    formLabel: "Base",
    types: ["water"],
    baseStats: { atk: 205, def: 188, hp: 198 },
    isRawBaseStats: true,
    defaultIvsGl: "5/11/14",
    defaultIvsUl: "4/15/11",
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Hydro Cannon", code: "HC", type: "water", power: 80, energyCost: 40 },
      { name: "Ice Beam", code: "IB", type: "ice", power: 90, energyCost: 55 },
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 }
    ],
    color: "#0284c7"
  },
  "Cresselia": {
    speciesId: "cresselia",
    name: "Cresselia",
    baseSpecies: "cresselia",
    formLabel: "Base",
    types: ["psychic"],
    baseStats: { atk: 152, def: 258, hp: 260 },
    isRawBaseStats: true,
    defaultIvsGl: "4/11/9",
    defaultIvsUl: "4/11/11",
    defaultFastMove: { name: "Psycho Cut", type: "psychic", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Grass Knot", code: "GK", type: "grass", power: 90, energyCost: 50 },
      { name: "Moonblast", code: "MB", type: "fairy", power: 90, energyCost: 50 },
      { name: "Future Sight", code: "FS", type: "psychic", power: 110, energyCost: 65 }
    ],
    color: "#e879f9"
  },
  "Registeel": {
    speciesId: "registeel",
    name: "Registeel",
    baseSpecies: "registeel",
    formLabel: "Base",
    types: ["steel"],
    baseStats: { atk: 143, def: 285, hp: 190 },
    isRawBaseStats: true,
    defaultIvsGl: "8/15/14",
    defaultIvsUl: "4/6/14",
    defaultFastMove: { name: "Lock-On", type: "normal", turns: 1, power: 1, energyGain: 5 },
    chargedMoves: [
      { name: "Focus Blast", code: "FB", type: "fighting", power: 150, energyCost: 75 },
      { name: "Zap Cannon", code: "ZC", type: "electric", power: 150, energyCost: 80 },
      { name: "Hyper Beam", code: "HB", type: "normal", power: 150, energyCost: 80 }
    ],
    color: "#94a3b8"
  },
  "Cobalion": {
    speciesId: "cobalion",
    name: "Cobalion",
    baseSpecies: "cobalion",
    formLabel: "Base",
    types: ["steel", "fighting"],
    baseStats: { atk: 192, def: 229, hp: 209 },
    isRawBaseStats: true,
    defaultIvsGl: "4/10/4",
    defaultIvsUl: "6/15/11",
    defaultFastMove: { name: "Double Kick", type: "fighting", turns: 3, power: 8, energyGain: 12 },
    chargedMoves: [
      { name: "Sacred Sword", code: "SS", type: "fighting", power: 60, energyCost: 35 },
      { name: "Stone Edge", code: "SE", type: "rock", power: 100, energyCost: 55 },
      { name: "Iron Head", code: "IH", type: "steel", power: 85, energyCost: 50 }
    ],
    color: "#0284c7"
  },
  "Lickilicky": {
    speciesId: "lickilicky",
    name: "Lickilicky",
    baseSpecies: "lickilicky",
    formLabel: "Base",
    types: ["normal"],
    baseStats: { atk: 161, def: 181, hp: 242 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/8",
    defaultIvsUl: "4/13/13",
    defaultFastMove: { name: "Rollout", type: "rock", turns: 3, power: 8, energyGain: 13 },
    chargedMoves: [
      { name: "Body Slam", code: "BS", type: "normal", power: 65, energyCost: 40 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 }
    ],
    color: "#f472b6"
  },
  "Annihilape": {
    speciesId: "annihilape",
    name: "Annihilape",
    baseSpecies: "annihilape",
    formLabel: "Base",
    types: ["fighting", "ghost"],
    baseStats: { atk: 220, def: 178, hp: 242 },
    isRawBaseStats: true,
    defaultIvsGl: "4/13/13",
    defaultIvsUl: "5/14/15",
    defaultFastMove: { name: "Counter", type: "fighting", turns: 2, power: 8, energyGain: 7 },
    chargedMoves: [
      { name: "Rage Fist", code: "RF", type: "ghost", power: 55, energyCost: 40 },
      { name: "Ice Punch", code: "IP", type: "ice", power: 60, energyCost: 40 },
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 }
    ],
    color: "#64748b"
  },
  "Talonflame": {
    speciesId: "talonflame",
    name: "Talonflame",
    baseSpecies: "talonflame",
    formLabel: "Base",
    types: ["fire", "flying"],
    baseStats: { atk: 176, def: 155, hp: 186 },
    isRawBaseStats: true,
    defaultIvsGl: "4/12/15",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Incinerate", type: "fire", turns: 5, power: 20, energyGain: 20 },
    chargedMoves: [
      { name: "Fly", code: "Fl", type: "flying", power: 80, energyCost: 45 },
      { name: "Flame Charge", code: "FC", type: "fire", power: 65, energyCost: 50 },
      { name: "Brave Bird", code: "BB", type: "flying", power: 130, energyCost: 55 }
    ],
    color: "#f97316"
  },
  "Clodsire": {
    speciesId: "clodsire",
    name: "Clodsire",
    baseSpecies: "clodsire",
    formLabel: "Base",
    types: ["poison", "ground"],
    baseStats: { atk: 127, def: 151, hp: 277 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/10",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Poison Sting", type: "poison", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 },
      { name: "Stone Edge", code: "SE", type: "rock", power: 100, energyCost: 55 },
      { name: "Megahorn", code: "MH", type: "bug", power: 110, energyCost: 55 }
    ],
    color: "#78350f"
  },
  "Mandibuzz": {
    speciesId: "mandibuzz",
    name: "Mandibuzz",
    baseSpecies: "mandibuzz",
    formLabel: "Base",
    types: ["dark", "flying"],
    baseStats: { atk: 129, def: 205, hp: 242 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/13",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 45 },
      { name: "Aerial Ace", code: "AA", type: "flying", power: 60, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 }
    ],
    color: "#52525b"
  },
  "Azumarill": {
    speciesId: "azumarill",
    name: "Azumarill",
    baseSpecies: "azumarill",
    formLabel: "Base",
    types: ["water", "fairy"],
    baseStats: { atk: 112, def: 152, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/13",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Bubble", type: "water", turns: 3, power: 7, energyGain: 11 },
    chargedMoves: [
      { name: "Ice Beam", code: "IB", type: "ice", power: 90, energyCost: 55 },
      { name: "Play Rough", code: "PR", type: "fairy", power: 90, energyCost: 60 },
      { name: "Hydro Pump", code: "HP", type: "water", power: 130, energyCost: 75 }
    ],
    color: "#38bdf8"
  },
  "Gastrodon": {
    speciesId: "gastrodon",
    name: "Gastrodon",
    baseSpecies: "gastrodon",
    formLabel: "Base",
    types: ["water", "ground"],
    baseStats: { atk: 169, def: 143, hp: 244 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/14",
    defaultIvsUl: "12/15/13",
    defaultFastMove: { name: "Mud-Slap", type: "ground", turns: 3, power: 11, energyGain: 10 },
    chargedMoves: [
      { name: "Body Slam", code: "BS", type: "normal", power: 65, energyCost: 40 },
      { name: "Earth Power", code: "EP", type: "ground", power: 90, energyCost: 50 },
      { name: "Water Pulse", code: "WP", type: "water", power: 80, energyCost: 50 }
    ],
    color: "#14b8a6"
  },
  "Malamar": {
    speciesId: "malamar",
    name: "Malamar",
    baseSpecies: "malamar",
    formLabel: "Base",
    types: ["dark", "psychic"],
    baseStats: { atk: 177, def: 165, hp: 200 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/15",
    defaultIvsUl: "4/13/15",
    defaultFastMove: { name: "Psywave", type: "psychic", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Foul Play", code: "FP", type: "dark", power: 65, energyCost: 40 },
      { name: "Superpower", code: "SP", type: "fighting", power: 85, energyCost: 40 },
      { name: "Hyper Beam", code: "HB", type: "normal", power: 150, energyCost: 80 }
    ],
    color: "#6366f1"
  },
  "Dunsparce": {
    speciesId: "dunsparce",
    name: "Dunsparce",
    baseSpecies: "dunsparce",
    formLabel: "Base",
    types: ["normal"],
    baseStats: { atk: 131, def: 128, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/13",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Rollout", type: "rock", turns: 3, power: 8, energyGain: 13 },
    chargedMoves: [
      { name: "Rock Slide", code: "RS", type: "rock", power: 75, energyCost: 45 },
      { name: "Drill Run", code: "DR", type: "ground", power: 70, energyCost: 40 },
      { name: "Dig", code: "Dg", type: "ground", power: 70, energyCost: 50 }
    ],
    color: "#eab308"
  },
  "Sandslash (Alolan)": {
    speciesId: "sandslash_alolan",
    name: "Sandslash (Alolan)",
    baseSpecies: "sandslash",
    formLabel: "Alolan",
    types: ["ice", "steel"],
    baseStats: { atk: 177, def: 195, hp: 181 },
    isRawBaseStats: true,
    defaultIvsGl: "4/13/15",
    defaultIvsUl: "4/12/15",
    defaultFastMove: { name: "Powder Snow", type: "ice", turns: 2, power: 5, energyGain: 8 },
    chargedMoves: [
      { name: "Ice Punch", code: "IP", type: "ice", power: 60, energyCost: 40 },
      { name: "Drill Run", code: "DR", type: "ground", power: 70, energyCost: 40 },
      { name: "Blizzard", code: "Blz", type: "ice", power: 140, energyCost: 75 }
    ],
    color: "#38bdf8"
  },
  "Primeape": {
    speciesId: "primeape",
    name: "Primeape",
    baseSpecies: "primeape",
    formLabel: "Base",
    types: ["fighting"],
    baseStats: { atk: 207, def: 138, hp: 163 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/15",
    defaultIvsUl: "12/15/14",
    defaultFastMove: { name: "Karate Chop", type: "fighting", turns: 2, power: 7, energyGain: 9 },
    chargedMoves: [
      { name: "Rage Fist", code: "RF", type: "ghost", power: 55, energyCost: 40 },
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Ice Punch", code: "IP", type: "ice", power: 60, energyCost: 40 }
    ],
    color: "#d97706"
  },
  "Morpeko": {
    speciesId: "morpeko",
    name: "Morpeko",
    baseSpecies: "morpeko",
    formLabel: "Full Belly",
    types: ["electric", "dark"],
    baseStats: { atk: 192, def: 121, hp: 151 },
    isRawBaseStats: true,
    defaultIvsGl: "5/14/15",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Thunder Shock", type: "electric", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Aura Wheel", code: "AW", type: "electric", power: 100, energyCost: 45 },
      { name: "Psychic Fangs", code: "PF", type: "psychic", power: 40, energyCost: 35 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#eab308"
  },
  "Clefable": {
    speciesId: "clefable",
    name: "Clefable",
    baseSpecies: "clefable",
    formLabel: "Base",
    types: ["fairy"],
    baseStats: { atk: 178, def: 162, hp: 216 },
    isRawBaseStats: true,
    defaultIvsGl: "4/13/14",
    defaultIvsUl: "4/12/15",
    defaultFastMove: { name: "Fairy Wind", type: "fairy", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Meteor Mash", code: "MM", type: "steel", power: 100, energyCost: 45 },
      { name: "Moonblast", code: "MB", type: "fairy", power: 90, energyCost: 50 },
      { name: "Swift", code: "Sw", type: "normal", power: 55, energyCost: 35 }
    ],
    color: "#f472b6"
  },
  "Ampharos": {
    speciesId: "ampharos",
    name: "Ampharos",
    baseSpecies: "ampharos",
    formLabel: "Base",
    types: ["electric"],
    baseStats: { atk: 211, def: 169, hp: 207 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/12",
    defaultIvsUl: "4/12/15",
    defaultFastMove: { name: "Volt Switch", type: "electric", turns: 4, power: 12, energyGain: 16 },
    chargedMoves: [
      { name: "Brutal Swing", code: "BS", type: "dark", power: 55, energyCost: 35 },
      { name: "Trailblaze", code: "TB", type: "grass", power: 65, energyCost: 45 },
      { name: "Zap Cannon", code: "ZC", type: "electric", power: 150, energyCost: 80 }
    ],
    color: "#eab308"
  },
  "Wigglytuff": {
    speciesId: "wigglytuff",
    name: "Wigglytuff",
    baseSpecies: "wigglytuff",
    formLabel: "Base",
    types: ["normal", "fairy"],
    baseStats: { atk: 156, def: 90, hp: 295 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/15",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Charm", type: "fairy", turns: 3, power: 15, energyGain: 6 },
    chargedMoves: [
      { name: "Icy Wind", code: "IW", type: "ice", power: 60, energyCost: 45 },
      { name: "Disarming Voice", code: "DV", type: "fairy", power: 70, energyCost: 45 },
      { name: "Swift", code: "Sw", type: "normal", power: 55, energyCost: 35 }
    ],
    color: "#ec4899"
  },
  "Mega Rayquaza": {
    speciesId: "rayquaza_mega",
    name: "Mega Rayquaza",
    baseSpecies: "rayquaza",
    formLabel: "Mega",
    types: ["dragon", "flying"],
    baseStats: { atk: 377, def: 210, hp: 227 },
    isRawBaseStats: true,
    defaultIvsGl: "6/13/13",
    defaultIvsUl: "4/12/10",
    defaultFastMove: { name: "Dragon Tail", type: "dragon", turns: 3, power: 13, energyGain: 9 },
    chargedMoves: [
      { name: "Breaking Swipe", code: "BS", type: "dragon", power: 50, energyCost: 50 },
      { name: "Dragon Ascent", code: "DA", type: "flying", power: 110, energyCost: 45 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#10b981"
  },
  "Primal Groudon": {
    speciesId: "groudon_primal",
    name: "Primal Groudon",
    baseSpecies: "groudon",
    formLabel: "Primal",
    types: ["ground", "fire"],
    baseStats: { atk: 353, def: 268, hp: 218 },
    isRawBaseStats: true,
    defaultIvsGl: "5/8/4",
    defaultIvsUl: "6/4/14",
    defaultFastMove: { name: "Mud Shot", type: "ground", turns: 2, power: 4, energyGain: 8 },
    chargedMoves: [
      { name: "Precipice Blades", code: "PB", type: "ground", power: 130, energyCost: 60 },
      { name: "Fire Punch", code: "FP", type: "fire", power: 60, energyCost: 40 },
      { name: "Solar Beam", code: "SBm", type: "grass", power: 150, energyCost: 80 }
    ],
    color: "#ef4444"
  },
  "Primal Kyogre": {
    speciesId: "kyogre_primal",
    name: "Primal Kyogre",
    baseSpecies: "kyogre",
    formLabel: "Primal",
    types: ["water"],
    baseStats: { atk: 353, def: 268, hp: 218 },
    isRawBaseStats: true,
    defaultIvsGl: "5/8/4",
    defaultIvsUl: "6/4/14",
    defaultFastMove: { name: "Waterfall", type: "water", turns: 3, power: 12, energyGain: 8 },
    chargedMoves: [
      { name: "Origin Pulse", code: "OP", type: "water", power: 130, energyCost: 60 },
      { name: "Surf", code: "Surf", type: "water", power: 75, energyCost: 45 },
      { name: "Blizzard", code: "Blz", type: "ice", power: 140, energyCost: 75 }
    ],
    color: "#2563eb"
  },
  "Mega Mewtwo Y": {
    speciesId: "mewtwo_mega_y",
    name: "Mega Mewtwo Y",
    baseSpecies: "mewtwo",
    formLabel: "Mega Y",
    types: ["psychic"],
    baseStats: { atk: 413, def: 223, hp: 228 },
    isRawBaseStats: true,
    defaultIvsGl: "6/5/15",
    defaultIvsUl: "4/7/15",
    defaultFastMove: { name: "Psycho Cut", type: "psychic", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Psystrike", code: "PS", type: "psychic", power: 90, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Focus Blast", code: "FB", type: "fighting", power: 150, energyCost: 75 }
    ],
    color: "#d946ef"
  },
  "Mega Gyarados": {
    speciesId: "gyarados_mega",
    name: "Mega Gyarados",
    baseSpecies: "gyarados",
    formLabel: "Mega",
    types: ["water", "dark"],
    baseStats: { atk: 292, def: 247, hp: 216 },
    isRawBaseStats: true,
    defaultIvsGl: "5/15/14",
    defaultIvsUl: "4/8/15",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 4, energyGain: 3 },
    chargedMoves: [
      { name: "Aqua Tail", code: "AT", type: "water", power: 55, energyCost: 35 },
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 }
    ],
    color: "#0284c7"
  },
  "Mega Garchomp": {
    speciesId: "garchomp_mega",
    name: "Mega Garchomp",
    baseSpecies: "garchomp",
    formLabel: "Mega",
    types: ["dragon", "ground"],
    baseStats: { atk: 339, def: 222, hp: 239 },
    isRawBaseStats: true,
    defaultIvsGl: "5/13/15",
    defaultIvsUl: "7/15/14",
    defaultFastMove: { name: "Mud Shot", type: "ground", turns: 2, power: 4, energyGain: 8 },
    chargedMoves: [
      { name: "Earth Power", code: "EP", type: "ground", power: 90, energyCost: 50 },
      { name: "Outrage", code: "OR", type: "dragon", power: 110, energyCost: 60 },
      { name: "Sand Tomb", code: "ST", type: "ground", power: 55, energyCost: 45 }
    ],
    color: "#4f46e5"
  },
  "Mega Gardevoir": {
    speciesId: "gardevoir_mega",
    name: "Mega Gardevoir",
    baseSpecies: "gardevoir",
    formLabel: "Mega",
    types: ["psychic", "fairy"],
    baseStats: { atk: 326, def: 229, hp: 169 },
    isRawBaseStats: true,
    defaultIvsGl: "5/14/15",
    defaultIvsUl: "6/14/14",
    defaultFastMove: { name: "Charm", type: "fairy", turns: 3, power: 15, energyGain: 6 },
    chargedMoves: [
      { name: "Triple Axel", code: "TA", type: "ice", power: 60, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Synchronoise", code: "Syn", type: "psychic", power: 80, energyCost: 50 }
    ],
    color: "#f472b6"
  },
  "Mega Metagross": {
    speciesId: "metagross_mega",
    name: "Mega Metagross",
    baseSpecies: "metagross",
    formLabel: "Mega",
    types: ["steel", "psychic"],
    baseStats: { atk: 300, def: 289, hp: 190 },
    isRawBaseStats: true,
    defaultIvsGl: "6/15/14",
    defaultIvsUl: "4/14/14",
    defaultFastMove: { name: "Bullet Punch", type: "steel", turns: 2, power: 8, energyGain: 7 },
    chargedMoves: [
      { name: "Meteor Mash", code: "MM", type: "steel", power: 100, energyCost: 45 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 },
      { name: "Psychic", code: "Psy", type: "psychic", power: 75, energyCost: 55 }
    ],
    color: "#64748b"
  },
  "Mega Swampert": {
    speciesId: "swampert_mega",
    name: "Mega Swampert",
    baseSpecies: "swampert",
    formLabel: "Mega",
    types: ["water", "ground"],
    baseStats: { atk: 283, def: 218, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "4/12/13",
    defaultIvsUl: "5/15/15",
    defaultFastMove: { name: "Mud Shot", type: "ground", turns: 2, power: 4, energyGain: 8 },
    chargedMoves: [
      { name: "Hydro Cannon", code: "HC", type: "water", power: 80, energyCost: 40 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 120, energyCost: 65 },
      { name: "Sludge Wave", code: "SWv", type: "poison", power: 110, energyCost: 65 }
    ],
    color: "#0ea5e9"
  },
  "Mega Tyranitar": {
    speciesId: "tyranitar_mega",
    name: "Mega Tyranitar",
    baseSpecies: "tyranitar",
    formLabel: "Mega",
    types: ["rock", "dark"],
    baseStats: { atk: 309, def: 276, hp: 225 },
    isRawBaseStats: true,
    defaultIvsGl: "8/15/15",
    defaultIvsUl: "4/15/13",
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 4, energyGain: 3 },
    chargedMoves: [
      { name: "Brutal Swing", code: "BS", type: "dark", power: 55, energyCost: 35 },
      { name: "Stone Edge", code: "SE", type: "rock", power: 100, energyCost: 55 },
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 }
    ],
    color: "#15803d"
  },
  Snorlax: {
    speciesId: "snorlax",
    name: "Snorlax",
    baseSpecies: "snorlax",
    formLabel: "Base",
    types: ["normal"],
    baseStats: { atk: 190, def: 169, hp: 330 },
    isRawBaseStats: true,
    defaultIvsGl: "4/14/5",
    defaultIvsUl: "5/15/14",
    defaultFastMove: { name: "Psywave", type: "psychic", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Body Slam", code: "BS", type: "normal", power: 65, energyCost: 40 },
      { name: "Earthquake", code: "Eq", type: "ground", power: 120, energyCost: 65 },
      { name: "Superpower", code: "SpP", type: "fighting", power: 85, energyCost: 40 }
    ],
    color: "#0284c7"
  },
  Greninja: {
    speciesId: "greninja",
    name: "Greninja",
    baseSpecies: "greninja",
    formLabel: "Base",
    types: ["water", "dark"],
    baseStats: { atk: 223, def: 152, hp: 176 },
    isRawBaseStats: true,
    defaultIvsGl: "5/12/12",
    defaultIvsUl: "4/13/15",
    defaultFastMove: { name: "Water Shuriken", type: "water", turns: 3, power: 6, energyGain: 14 },
    chargedMoves: [
      { name: "Hydro Cannon", code: "HC", type: "water", power: 80, energyCost: 40 },
      { name: "Brutal Swing", code: "BrS", type: "dark", power: 55, energyCost: 35 },
      { name: "Night Slash", code: "NS", type: "dark", power: 50, energyCost: 35 }
    ],
    color: "#2563eb"
  },
  Skeledirge: {
    speciesId: "skeledirge",
    name: "Skeledirge",
    baseSpecies: "skeledirge",
    formLabel: "Base",
    types: ["fire", "ghost"],
    baseStats: { atk: 207, def: 178, hp: 232 },
    isRawBaseStats: true,
    defaultIvsGl: "4/13/11",
    defaultIvsUl: "6/15/13",
    defaultFastMove: { name: "Incinerate", type: "fire", turns: 5, power: 20, energyGain: 20 },
    chargedMoves: [
      { name: "Torch Song", code: "TrS", type: "fire", power: 70, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Disarming Voice", code: "DV", type: "fairy", power: 70, energyCost: 45 }
    ],
    color: "#ef4444"
  },
  Aegislash: {
    speciesId: "aegislash",
    name: "Aegislash",
    baseSpecies: "aegislash",
    formLabel: "Shield",
    types: ["steel", "ghost"],
    baseStats: { atk: 97, def: 291, hp: 155 },
    isRawBaseStats: true,
    defaultIvsGl: "6/15/15",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Psycho Cut", type: "psychic", turns: 2, power: 1, energyGain: 9 },
    chargedMoves: [
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 90, energyCost: 50 },
      { name: "Flash Cannon", code: "FC", type: "steel", power: 110, energyCost: 65 },
      { name: "Gyro Ball", code: "GB", type: "steel", power: 80, energyCost: 60 }
    ],
    color: "#64748b"
  },
  Cramorant: {
    speciesId: "cramorant",
    name: "Cramorant",
    baseSpecies: "cramorant",
    formLabel: "Gulp Missile",
    types: ["flying", "water"],
    baseStats: { atk: 173, def: 163, hp: 172 },
    isRawBaseStats: true,
    defaultIvsGl: "4/15/15",
    defaultIvsUl: "15/15/15",
    defaultFastMove: { name: "Wing Attack", type: "flying", turns: 2, power: 5, energyGain: 7 },
    chargedMoves: [
      { name: "Surf", code: "Surf", type: "water", power: 75, energyCost: 45 },
      { name: "Fly", code: "Fly", type: "flying", power: 80, energyCost: 45 },
      { name: "Brave Bird", code: "BB", type: "flying", power: 130, energyCost: 55 }
    ],
    color: "#0ea5e9"
  }
};

export interface TopOpponentInfo {
  rank: number;
  name: string;
  types: string[];
  fastMove: string;
  fastTurns: number;
  chargedMoves: string[];
  score?: number;
}

export const PVPOKE_TOP_OPPONENTS: Record<string, TopOpponentInfo[]> = {
  "MEGA MASTER LEAGUE": [
    { rank: 1, name: "Mega Rayquaza", types: ["dragon", "flying"], fastMove: "Dragon Tail", fastTurns: 3, chargedMoves: ["Breaking Swipe", "Dragon Ascent"], score: 98.4 },
    { rank: 2, name: "Primal Groudon", types: ["ground", "fire"], fastMove: "Mud Shot", fastTurns: 2, chargedMoves: ["Precipice Blades", "Fire Punch"], score: 96.8 },
    { rank: 3, name: "Primal Kyogre", types: ["water"], fastMove: "Waterfall", fastTurns: 3, chargedMoves: ["Origin Pulse", "Surf"], score: 95.2 },
    { rank: 4, name: "Mega Gyarados", types: ["water", "dark"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Aqua Tail", "Crunch"], score: 93.7 },
    { rank: 5, name: "Mega Garchomp", types: ["dragon", "ground"], fastMove: "Mud Shot", fastTurns: 2, chargedMoves: ["Earth Power", "Outrage"], score: 92.5 },
    { rank: 6, name: "Mega Mewtwo Y", types: ["psychic"], fastMove: "Psycho Cut", fastTurns: 2, chargedMoves: ["Psystrike", "Shadow Ball"], score: 91.9 },
    { rank: 7, name: "Mega Gardevoir", types: ["psychic", "fairy"], fastMove: "Charm", fastTurns: 3, chargedMoves: ["Triple Axel", "Shadow Ball"], score: 90.8 },
    { rank: 8, name: "Mega Metagross", types: ["steel", "psychic"], fastMove: "Bullet Punch", fastTurns: 2, chargedMoves: ["Meteor Mash", "Earthquake"], score: 90.1 },
    { rank: 9, name: "Mega Swampert", types: ["water", "ground"], fastMove: "Mud Shot", fastTurns: 2, chargedMoves: ["Hydro Cannon", "Earthquake"], score: 89.4 },
    { rank: 10, name: "Mega Tyranitar", types: ["rock", "dark"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Brutal Swing", "Stone Edge"], score: 88.6 }
  ],
  "MASTER LEAGUE": [
    { rank: 1, name: "Palkia (Origin)", types: ["water", "dragon"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Spacial Rend", "Aqua Tail"], score: 95.8 },
    { rank: 2, name: "Zacian (Crowned)", types: ["fairy", "steel"], fastMove: "Metal Claw", fastTurns: 2, chargedMoves: ["Behemoth Blade", "Close Combat"], score: 94.9 },
    { rank: 3, name: "Dialga (Origin)", types: ["steel", "dragon"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Roar of Time", "Iron Head"], score: 94.2 },
    { rank: 4, name: "Necrozma (Dusk Mane)", types: ["psychic", "steel"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Sunsteel Strike", "Dark Pulse"], score: 93.5 },
    { rank: 5, name: "Landorus (Therian)", types: ["ground", "flying"], fastMove: "Mud Shot", fastTurns: 2, chargedMoves: ["Sandsear Storm", "Stone Edge"], score: 92.8 },
    { rank: 6, name: "Necrozma (Dawn Wings)", types: ["psychic", "ghost"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Moongeist Beam", "Dark Pulse"], score: 92.1 },
    { rank: 7, name: "Ho-Oh", types: ["fire", "flying"], fastMove: "Incinerate", fastTurns: 5, chargedMoves: ["Sacred Fire", "Brave Bird"], score: 91.4 },
    { rank: 8, name: "Yveltal", types: ["dark", "flying"], fastMove: "Snarl", fastTurns: 3, chargedMoves: ["Dark Pulse", "Oblivion Wing"], score: 90.9 },
    { rank: 9, name: "Giratina (Origin)", types: ["ghost", "dragon"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Shadow Ball", "Ominous Wind"], score: 90.2 },
    { rank: 10, name: "Kyurem (Black)", types: ["dragon", "ice"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Freeze Shock", "Fusion Bolt"], score: 89.7 }
  ],
  "ULTRA LEAGUE": [
    { rank: 1, name: "Zygarde", types: ["dragon", "ground"], fastMove: "Dragon Tail", fastTurns: 3, chargedMoves: ["Crunch", "Earthquake"], score: 94.6 },
    { rank: 2, name: "Feraligatr", types: ["water"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Hydro Cannon", "Ice Beam"], score: 93.8 },
    { rank: 3, name: "Giratina (Altered)", types: ["ghost", "dragon"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Dragon Claw", "Ancient Power"], score: 93.1 },
    { rank: 4, name: "Cresselia", types: ["psychic"], fastMove: "Psycho Cut", fastTurns: 2, chargedMoves: ["Grass Knot", "Moonblast"], score: 92.4 },
    { rank: 5, name: "Registeel", types: ["steel"], fastMove: "Lock-On", fastTurns: 1, chargedMoves: ["Focus Blast", "Zap Cannon"], score: 91.9 },
    { rank: 6, name: "Cobalion", types: ["steel", "fighting"], fastMove: "Double Kick", fastTurns: 3, chargedMoves: ["Sacred Sword", "Stone Edge"], score: 91.2 },
    { rank: 7, name: "Corviknight", types: ["flying", "steel"], fastMove: "Sand Attack", fastTurns: 1, chargedMoves: ["Air Cutter", "Iron Head"], score: 90.8 },
    { rank: 8, name: "Lickilicky", types: ["normal"], fastMove: "Rollout", fastTurns: 3, chargedMoves: ["Body Slam", "Shadow Ball"], score: 90.3 },
    { rank: 9, name: "Annihilape", types: ["fighting", "ghost"], fastMove: "Counter", fastTurns: 2, chargedMoves: ["Rage Fist", "Ice Punch"], score: 89.8 },
    { rank: 10, name: "Talonflame", types: ["fire", "flying"], fastMove: "Incinerate", fastTurns: 5, chargedMoves: ["Fly", "Flame Charge"], score: 89.1 },
    { rank: 11, name: "Skeledirge", types: ["fire", "ghost"], fastMove: "Incinerate", fastTurns: 5, chargedMoves: ["Torch Song", "Shadow Ball", "Disarming Voice"], score: 88.9 },
    { rank: 12, name: "Greninja", types: ["water", "dark"], fastMove: "Water Shuriken", fastTurns: 3, chargedMoves: ["Hydro Cannon", "Brutal Swing", "Night Slash"], score: 88.2 },
    { rank: 13, name: "Snorlax", types: ["normal"], fastMove: "Psywave", fastTurns: 1, chargedMoves: ["Body Slam", "Earthquake", "Superpower"], score: 87.5 }
  ],
  "GREAT LEAGUE": [
    { rank: 1, name: "Clodsire", types: ["poison", "ground"], fastMove: "Poison Sting", fastTurns: 2, chargedMoves: ["Earthquake", "Stone Edge"], score: 95.1 },
    { rank: 2, name: "Feraligatr", types: ["water"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Hydro Cannon", "Ice Beam"], score: 94.3 },
    { rank: 3, name: "Mandibuzz", types: ["dark", "flying"], fastMove: "Snarl", fastTurns: 3, chargedMoves: ["Dark Pulse", "Aerial Ace"], score: 93.6 },
    { rank: 4, name: "Azumarill", types: ["water", "fairy"], fastMove: "Bubble", fastTurns: 3, chargedMoves: ["Ice Beam", "Play Rough"], score: 92.9 },
    { rank: 5, name: "Gastrodon", types: ["water", "ground"], fastMove: "Mud-Slap", fastTurns: 3, chargedMoves: ["Body Slam", "Earth Power"], score: 92.2 },
    { rank: 6, name: "Malamar", types: ["dark", "psychic"], fastMove: "Psywave", fastTurns: 1, chargedMoves: ["Foul Play", "Superpower"], score: 91.5 },
    { rank: 7, name: "Dunsparce", types: ["normal"], fastMove: "Rollout", fastTurns: 3, chargedMoves: ["Rock Slide", "Drill Run"], score: 90.9 },
    { rank: 8, name: "Annihilape", types: ["fighting", "ghost"], fastMove: "Counter", fastTurns: 2, chargedMoves: ["Rage Fist", "Ice Punch"], score: 90.4 },
    { rank: 9, name: "Sandslash (Alolan)", types: ["ice", "steel"], fastMove: "Powder Snow", fastTurns: 2, chargedMoves: ["Ice Punch", "Drill Run"], score: 89.9 },
    { rank: 10, name: "Primeape", types: ["fighting"], fastMove: "Karate Chop", fastTurns: 2, chargedMoves: ["Rage Fist", "Close Combat"], score: 89.3 }
  ]
};


export const SPECIES_VARIANTS: Record<string, string[]> = {
  zacian: ["Zacian (Crowned)", "Zacian (Hero)"],
  zamazenta: ["Zamazenta (Crowned)", "Zamazenta (Hero)"],
  keldeo: ["Keldeo (Resolute)", "Keldeo (Ordinary)"],
  giratina: ["Giratina (Origin)", "Giratina (Altered)"],
  ninetales: ["Kanto Ninetales", "Ninetales (Alolan)"],
  dialga: ["Dialga (Origin)"],
  kyurem: ["Kyurem (Black)", "Kyurem (White)", "Kyurem"],
  kyogre: ["Kyogre", "Primal Kyogre"],
  groudon: ["Primal Groudon"],
  mewtwo: ["Mewtwo", "Mewtwo (Armored)", "Mega Mewtwo Y"],
  mew: ["Mew"]
};

export function getAvailableFormsForPokemon(name: string): string[] {
  const stats = POKEMON_DATABASE[name];
  const base = stats?.baseSpecies || name.split(" ")[0].toLowerCase();
  return SPECIES_VARIANTS[base] || [name];
}

export function resolveBestDefaultFormAndShadow(
  rawName: string,
  league: LeagueType
): { formName: string; isShadow: boolean } {
  const trimmed = (rawName || "").trim();
  const lower = trimmed.toLowerCase();
  const explicitShadow = /^shadow\s+|\(\s*shadow\s*\)/i.test(trimmed);
  const cleanName = trimmed
    .replace(/^shadow\s+/i, "")
    .replace(/\(\s*shadow\s*\)/gi, "")
    .trim();
  const hasExplicitForm =
    /\([^)]+\)/.test(cleanName) ||
    /^(alolan|galarian|hisuian|paldean|kanto|armored|origin|altered|crowned|hero|therian|incarnate|mega|primal)\b/i.test(
      cleanName
    );
  if (hasExplicitForm && POKEMON_DATABASE[cleanName]) {
    return { formName: POKEMON_DATABASE[cleanName].name, isShadow: explicitShadow };
  }

  const base = (
    POKEMON_DATABASE[cleanName]?.baseSpecies ||
    cleanName
      .replace(/^(alolan|galarian|hisuian|paldean|kanto|armored)\s+/i, "")
      .replace(/\s*\([^)]+\)/g, "")
      .trim()
  ).toLowerCase();

  if (base === "mew" && lower !== "mewtwo" && !lower.includes("mewtwo")) {
    return { formName: "Mew", isShadow: false };
  }
  if (base === "ninetales") {
    if (league === "GREAT LEAGUE") {
      return { formName: "Kanto Ninetales", isShadow: true };
    }
    return { formName: "Ninetales (Alolan)", isShadow: explicitShadow };
  }
  if (base === "mewtwo") {
    if (league === "ULTRA LEAGUE") {
      return { formName: "Mewtwo (Armored)", isShadow: false };
    }
    if (league === "MEGA MASTER LEAGUE") {
      return { formName: "Mega Mewtwo Y", isShadow: false };
    }
    return { formName: "Mewtwo", isShadow: true };
  }
  if (base === "giratina") {
    if (league === "ULTRA LEAGUE") {
      return { formName: "Giratina (Altered)", isShadow: explicitShadow };
    }
    return { formName: "Giratina (Origin)", isShadow: false };
  }
  if (base === "feraligatr") {
    return { formName: "Feraligatr", isShadow: true };
  }

  return {
    formName: POKEMON_DATABASE[cleanName]?.name || cleanName || rawName,
    isShadow: explicitShadow
  };
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
 * Standardized <= 5 character PvPoke Move Abbreviations (Fast & Charged Moves)
 */
export const MOVE_ABBR_5: Record<string, string> = {
  // Fast Moves
  "Dragon Breath": "DB",
  "Sand Attack": "SndAt",
  "Quick Attack": "QA",
  "Lock-On": "LckOn",
  "Water Gun": "WG",
  "Lick": "Lick",
  "Bite": "Bite",
  "Tackle": "Tckl",
  "Fury Cutter": "FC",
  "Bug Bite": "BgBt",
  "Scratch": "Scrt",
  "Psywave": "Psywv",
  "Psycho Cut": "PC",
  "Mud Shot": "MS",
  "Shadow Claw": "SC",
  "Counter": "Cntr",
  "Powder Snow": "PS",
  "Wing Attack": "WA",
  "Peck": "Peck",
  "Poison Sting": "PStg",
  "Thunder Shock": "TS",
  "Fairy Wind": "FW",
  "Bullet Punch": "BP",
  "Fire Fang": "FF",
  "Vine Whip": "VW",
  "Karate Chop": "KC",
  "Low Kick": "LK",
  "Ice Fang": "IF",
  "Metal Claw": "MC",
  "Sucker Punch": "SP",
  "Poison Jab": "PJ",
  "Spark": "Spk",
  "Leafage": "Lfge",
  "Steel Wing": "SW",
  "Rock Throw": "RT",
  "Ember": "Embr",
  "Force Palm": "FP",
  "Dragon Tail": "DT",
  "Waterfall": "WF",
  "Fire Spin": "FS",
  "Snarl": "Snrl",
  "Geomancy": "Geom",
  "Mud-Slap": "MSlp",
  "Charm": "Chrm",
  "Double Kick": "DK",
  "Air Slash": "AS",
  "Ice Shard": "IS",
  "Bubble": "Bbl",
  "Rollout": "Rllt",
  "Smack Down": "SD",
  "Astonish": "Astn",
  "Hex": "Hex",
  "Magical Leaf": "MgLf",
  "Bullet Seed": "BS",
  "Water Shuriken": "WShr",
  "Gust": "Gust",
  "Confusion": "Conf",
  "Volt Switch": "VS",
  "Incinerate": "Incin",

  // Charged Moves (all strictly <= 5 chars)
  "Roar of Time": "RoT",
  "Spacial Rend": "SpR",
  "Behemoth Blade": "BehBl",
  "Behemoth Bash": "BehBs",
  "Sunsteel Strike": "SunSt",
  "Moongeist Beam": "MngBm",
  "Freeze Shock": "FrzSh",
  "Ice Burn": "IcBrn",
  "Fusion Bolt": "FusBl",
  "Fusion Flare": "FusFl",
  "Origin Pulse": "OrigP",
  "Precipice Blades": "PrcBl",
  "Sacred Fire": "SacFr",
  "Aeroblast": "Aerob",
  "Psystrike": "Psyst",
  "Shadow Force": "ShdFr",
  "Oblivion Wing": "OblWg",
  "Sandsear Storm": "SndSt",
  "Bleakwind Storm": "BlkSt",
  "Wildbolt Storm": "WldSt",
  "Springtide Storm": "SprSt",
  "Double Iron Bash": "DIB",
  "Secret Sword": "SecSw",
  "Sacred Sword": "SacSw",
  "Nature's Madness": "NatMd",
  "Rage Fist": "RgFst",
  "Aura Wheel": "AurWh",
  "Gigaton Hammer": "GgHmr",
  "Drum Beating": "DrmBt",
  "Iron Head": "IrnHd",
  "Draco Meteor": "DracM",
  "Sky Attack": "SkyAt",
  "Close Combat": "ClsCm",
  "Brave Bird": "BrvBd",
  "Play Rough": "PlayR",
  "Wild Charge": "WldCh",
  "Shadow Ball": "ShdBl",
  "Ominous Wind": "OmWnd",
  "Dragon Claw": "DrgCl",
  "Ancient Power": "AncPw",
  "Weather Ball": "WthBl",
  "Scorching Sands": "ScrSn",
  "Dazzling Gleam": "DzlGl",
  "Feather Dance": "FthDn",
  "Shadow Sneak": "ShdSn",
  "Drill Run": "DrlRn",
  "Drill Peck": "DrlPk",
  "Earthquake": "Eq",
  "Earth Power": "ErthP",
  "Flame Charge": "FlmCh",
  "Overheat": "Ovrht",
  "Dark Pulse": "DrkPl",
  "Hydro Cannon": "HydCn",
  "Hydro Pump": "HydPm",
  "Surf": "Surf",
  "Aqua Tail": "AqTl",
  "Aqua Jet": "AqJet",
  "Scald": "Scald",
  "Liquidation": "Liqdn",
  "Avalanche": "Avlnc",
  "Ice Beam": "IceBm",
  "Ice Punch": "IcePn",
  "Icy Wind": "IcyWn",
  "Icicle Spear": "IcSpr",
  "Blizzard": "Blzrd",
  "Glaciate": "Glcit",
  "Thunder": "Thndr",
  "Thunderbolt": "Thblt",
  "Thunder Punch": "ThPnc",
  "Zap Cannon": "ZpCan",
  "Discharge": "Dschg",
  "Moonblast": "Mnbls",
  "Disarming Voice": "DisVc",
  "Focus Blast": "FocBl",
  "Superpower": "Suprp",
  "Dynamic Punch": "DynPn",
  "Cross Chop": "CrsCh",
  "Rock Slide": "RckSl",
  "Stone Edge": "StnEd",
  "Rock Wrecker": "RckWr",
  "Meteor Mash": "MtrMs",
  "Flash Cannon": "FlshC",
  "Heavy Slam": "HvySl",
  "Outrage": "Outrg",
  "Breaking Swipe": "BrkSw",
  "Dragon Pulse": "DrgPl",
  "Twister": "Twstr",
  "Crunch": "Crnch",
  "Foul Play": "FlPly",
  "Night Slash": "NgtSl",
  "Brutal Swing": "BrtSw",
  "Payback": "Pybck",
  "Body Slam": "BdySl",
  "Swift": "Swift",
  "Hyper Beam": "HypBm",
  "Frenzy Plant": "FrnzP",
  "Leaf Blade": "LfBld",
  "Energy Ball": "EnBll",
  "Grass Knot": "GrsKn",
  "Power Whip": "PwrWh",
  "Seed Bomb": "SdBmb",
  "Trailblaze": "Trlbl",
  "Solar Beam": "SolBm",
  "Blast Burn": "BlstB",
  "Fire Punch": "FirPn",
  "Fly": "Fly",
  "Aerial Ace": "AerAc",
  "Air Cutter": "AirCt",
  "Hurricane": "Hrrcn",
  "Acrobatics": "Acrbt",
  "Psychic": "Psych",
  "Psyshock": "Psysh",
  "Psycho Boost": "PsyBs",
  "Future Sight": "FutSg",
  "Psychic Fangs": "PsyFg",
  "Sludge Wave": "SlgWv",
  "Sludge Bomb": "SlgBm",
  "Acid Spray": "AcdSp",
  "Poison Fang": "PsnFg",
  "Gunk Shot": "GnkSh",
  "High Horsepower": "HghHp",
  "Bulldoze": "Blldz",
  "Mud Bomb": "MdBmb",
  "Sand Tomb": "SndTm",
  "Bone Club": "BnClb",
  "Shadow Bone": "ShdBn",
  "Shadow Punch": "ShdPn",
  "Power Gem": "PwrGm",
  "Megahorn": "Mghrn",
  "Lunge": "Lunge",
  "X-Scissor": "XScsr",
  "Torch Song": "TrS",
  "Super Power": "Suprp",
  "Rock Tomb": "RckTm",
  "Mirror Shot": "MrrSh"
};

export function abbrMove5(name: string): string {
  if (!name) return "Move";
  if (MOVE_ABBR_5[name]) return MOVE_ABBR_5[name];
  const foundKey = Object.keys(MOVE_ABBR_5).find(k => k.toLowerCase() === name.toLowerCase().trim());
  if (foundKey) return MOVE_ABBR_5[foundKey];
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    const combined = (words[0].slice(0, 3) + words[1].slice(0, 2));
    return combined.slice(0, 5);
  }
  return name.slice(0, 5);
}

export const FAST_MOVE_STATS: Record<string, FastMove> = {
  "dragon breath": { name: "Dragon Breath", type: "dragon", turns: 1, power: 4, energyGain: 3 },
  "sand attack": { name: "Sand Attack", type: "ground", turns: 1, power: 2, energyGain: 4 },
  "quick attack": { name: "Quick Attack", type: "normal", turns: 1, power: 5, energyGain: 7 },
  "lock-on": { name: "Lock-On", type: "normal", turns: 1, power: 1, energyGain: 5 },
  "water gun": { name: "Water Gun", type: "water", turns: 1, power: 3, energyGain: 3 },
  "lick": { name: "Lick", type: "ghost", turns: 1, power: 3, energyGain: 3 },
  "bite": { name: "Bite", type: "dark", turns: 1, power: 4, energyGain: 2 },
  "tackle": { name: "Tackle", type: "normal", turns: 1, power: 3, energyGain: 3 },
  "fury cutter": { name: "Fury Cutter", type: "bug", turns: 1, power: 2, energyGain: 4 },
  "bug bite": { name: "Bug Bite", type: "bug", turns: 1, power: 3, energyGain: 3 },
  "scratch": { name: "Scratch", type: "normal", turns: 1, power: 4, energyGain: 2 },
  "psywave": { name: "Psywave", type: "psychic", turns: 1, power: 3, energyGain: 4 },
  "psycho cut": { name: "Psycho Cut", type: "psychic", turns: 2, power: 3, energyGain: 9 },
  "mud shot": { name: "Mud Shot", type: "ground", turns: 2, power: 4, energyGain: 8 },
  "shadow claw": { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
  "counter": { name: "Counter", type: "fighting", turns: 2, power: 8, energyGain: 6 },
  "powder snow": { name: "Powder Snow", type: "ice", turns: 2, power: 5, energyGain: 8 },
  "wing attack": { name: "Wing Attack", type: "flying", turns: 2, power: 5, energyGain: 7 },
  "peck": { name: "Peck", type: "flying", turns: 2, power: 6, energyGain: 6 },
  "poison sting": { name: "Poison Sting", type: "poison", turns: 2, power: 4, energyGain: 9 },
  "thunder shock": { name: "Thunder Shock", type: "electric", turns: 2, power: 3, energyGain: 9 },
  "fairy wind": { name: "Fairy Wind", type: "fairy", turns: 2, power: 4, energyGain: 9 },
  "bullet punch": { name: "Bullet Punch", type: "steel", turns: 2, power: 6, energyGain: 7 },
  "fire fang": { name: "Fire Fang", type: "fire", turns: 2, power: 8, energyGain: 6 },
  "vine whip": { name: "Vine Whip", type: "grass", turns: 2, power: 5, energyGain: 8 },
  "karate chop": { name: "Karate Chop", type: "fighting", turns: 2, power: 5, energyGain: 9 },
  "low kick": { name: "Low Kick", type: "fighting", turns: 2, power: 4, energyGain: 7 },
  "ice fang": { name: "Ice Fang", type: "ice", turns: 2, power: 8, energyGain: 6 },
  "metal claw": { name: "Metal Claw", type: "steel", turns: 2, power: 5, energyGain: 7 },
  "sucker punch": { name: "Sucker Punch", type: "dark", turns: 2, power: 8, energyGain: 7 },
  "poison jab": { name: "Poison Jab", type: "poison", turns: 2, power: 7, energyGain: 7 },
  "spark": { name: "Spark", type: "electric", turns: 2, power: 5, energyGain: 7 },
  "leafage": { name: "Leafage", type: "grass", turns: 2, power: 6, energyGain: 7 },
  "steel wing": { name: "Steel Wing", type: "steel", turns: 2, power: 7, energyGain: 6 },
  "rock throw": { name: "Rock Throw", type: "rock", turns: 2, power: 8, energyGain: 5 },
  "ember": { name: "Ember", type: "fire", turns: 2, power: 7, energyGain: 6 },
  "force palm": { name: "Force Palm", type: "fighting", turns: 3, power: 13, energyGain: 10 },
  "dragon tail": { name: "Dragon Tail", type: "dragon", turns: 3, power: 13, energyGain: 9 },
  "waterfall": { name: "Waterfall", type: "water", turns: 3, power: 12, energyGain: 8 },
  "fire spin": { name: "Fire Spin", type: "fire", turns: 3, power: 11, energyGain: 10 },
  "snarl": { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
  "geomancy": { name: "Geomancy", type: "fairy", turns: 3, power: 4, energyGain: 13 },
  "mud-slap": { name: "Mud-Slap", type: "ground", turns: 3, power: 12, energyGain: 10 },
  "charm": { name: "Charm", type: "fairy", turns: 3, power: 15, energyGain: 6 },
  "double kick": { name: "Double Kick", type: "fighting", turns: 3, power: 8, energyGain: 12 },
  "air slash": { name: "Air Slash", type: "flying", turns: 3, power: 9, energyGain: 9 },
  "ice shard": { name: "Ice Shard", type: "ice", turns: 3, power: 9, energyGain: 10 },
  "bubble": { name: "Bubble", type: "water", turns: 3, power: 7, energyGain: 11 },
  "rollout": { name: "Rollout", type: "rock", turns: 3, power: 8, energyGain: 13 },
  "smack down": { name: "Smack Down", type: "rock", turns: 3, power: 11, energyGain: 8 },
  "astonish": { name: "Astonish", type: "ghost", turns: 3, power: 12, energyGain: 10 },
  "hex": { name: "Hex", type: "ghost", turns: 3, power: 8, energyGain: 12 },
  "magical leaf": { name: "Magical Leaf", type: "grass", turns: 3, power: 10, energyGain: 10 },
  "bullet seed": { name: "Bullet Seed", type: "grass", turns: 3, power: 5, energyGain: 13 },
  "water shuriken": { name: "Water Shuriken", type: "water", turns: 3, power: 6, energyGain: 14 },
  "gust": { name: "Gust", type: "flying", turns: 4, power: 16, energyGain: 12 },
  "confusion": { name: "Confusion", type: "psychic", turns: 4, power: 16, energyGain: 12 },
  "volt switch": { name: "Volt Switch", type: "electric", turns: 4, power: 12, energyGain: 16 },
  "incinerate": { name: "Incinerate", type: "fire", turns: 5, power: 20, energyGain: 20 }
};

export function resolveFastMove(pokemon: PokemonStats, customFastMoveName?: string): FastMove {
  if (customFastMoveName) {
    const key = customFastMoveName.toLowerCase().trim();
    if (FAST_MOVE_STATS[key]) return FAST_MOVE_STATS[key];
  }
  const defKey = pokemon.defaultFastMove?.name?.toLowerCase()?.trim() || "";
  return FAST_MOVE_STATS[defKey] || pokemon.defaultFastMove || { name: "Fast", type: "normal", turns: 2, power: 5, energyGain: 7 };
}

/**
 * Computes exact PvPoke Fast Move damage % and formatted telemetry string:
 * Format: "<Abbr> <Turns>t/<Energy>e/<Dmg>%" (e.g. "DB 1t/3e/2%")
 */
export function calculateFastDamage(
  attacker: PokemonStats,
  defender: PokemonStats,
  fastMoveOverride?: string,
  isAttackerShadow: boolean = false,
  isDefenderShadow: boolean = false
): {
  move: FastMove;
  abbr: string;
  damage: number;
  percentage: number;
  telemetry: string;
} {
  const move = resolveFastMove(attacker, fastMoveOverride);
  const atkSpeciesLower = (attacker.baseSpecies || attacker.speciesId || attacker.name).toLowerCase();
  const isAttackerAegislash = atkSpeciesLower.includes("aegislash");
  const isShieldFormeAegislash = isAttackerAegislash && attacker.baseStats.atk < attacker.baseStats.def;

  const isStab = attacker.types.includes(move.type);
  const stabMult = isStab ? 1.2 : 1.0;
  const typeMult = getTypeMultiplier(move.type, defender.types);

  const atk = attacker.baseStats.atk * (isAttackerShadow ? 1.2 : 1.0);
  const def = defender.baseStats.def * (isDefenderShadow ? 0.8333333 : 1.0);
  const maxHp = Math.max(1, defender.baseStats.hp);

  // Aegislash Shield Forme fast moves deal fixed 1 HP damage while generating boosted 6 energy per fast move;
  // in Sword/Blade Forme, fast moves deal full 291 Base Atk damage with standard energy generation.
  const baseDamage = isShieldFormeAegislash
    ? 1
    : Math.floor(0.5 * (move.power || 4) * (atk / def) * stabMult * typeMult * 1.3) + 1;
  const effectiveEnergyGain = isShieldFormeAegislash ? Math.max(move.energyGain, 6) : move.energyGain;
  const percentage = Math.min(100, Math.max(1, Math.round((baseDamage / maxHp) * 100)));
  const abbr = abbrMove5(move.name);
  const telemetry = `${abbr} ${move.turns}t/${effectiveEnergyGain}e/${percentage}%`;

  return {
    move: isShieldFormeAegislash ? { ...move, power: 1, energyGain: effectiveEnergyGain } : move,
    abbr,
    damage: baseDamage,
    percentage,
    telemetry
  };
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
  const atkSpeciesLower = (attacker.baseSpecies || attacker.speciesId || attacker.name).toLowerCase();
  const defSpeciesLower = (defender.baseSpecies || defender.speciesId || defender.name).toLowerCase();
  const moveLower = (move.name || "").toLowerCase();

  const isMorpekoAuraWheel =
    atkSpeciesLower.includes("morpeko") && moveLower.includes("aura wheel");
  const isAttackerAegislash = atkSpeciesLower.includes("aegislash");
  const isDefenderAegislash = defSpeciesLower.includes("aegislash");
  const isAttackerCramorant = atkSpeciesLower.includes("cramorant");

  const isStab = isMorpekoAuraWheel || attacker.types.includes(move.type);
  const stabMult = isStab ? 1.2 : 1.0;

  let typeMult: number;
  if (isMorpekoAuraWheel) {
    const effElectric = getTypeMultiplier("electric", defender.types);
    const effDark = getTypeMultiplier("dark", defender.types);
    typeMult = 0.65 * Math.max(effElectric, effDark) + 0.35 * Math.min(effElectric, effDark);
  } else {
    typeMult = getTypeMultiplier(move.type, defender.types);
  }

  let atk = attacker.baseStats.atk * (isAttackerShadow ? 1.2 : 1.0);
  if (isMorpekoAuraWheel) {
    // Aura Wheel guaranteed +1 Attack stage self-buff
    atk *= 1.15;
  }
  if (isAttackerAegislash) {
    // Stance Change: Aegislash transforms from Shield Forme (97 Atk) into Sword/Blade Forme (291 Atk) right before Charged Moves
    if (attacker.baseStats.atk < attacker.baseStats.def) {
      atk *= 2.85;
    }
  }
  if (isAttackerCramorant) {
    // Gulp Missile: Surf loads Arrokuda (-1 Def stage on target) or Pikachu (-1 Atk stage) + retaliation counter-damage
    atk *= moveLower.includes("surf") ? 1.14 : 1.10;
  }

  let def = defender.baseStats.def * (isDefenderShadow ? 0.8333333 : 1.0);
  if (isDefenderAegislash && defender.baseStats.def > defender.baseStats.atk) {
    def *= 0.78;
  }
  const maxHp = Math.max(1, defender.baseStats.hp);

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
 * Parses user IV string (e.g. "0/15/15", "15-15-15") or returns PvPoke default IVs for the league.
 */
const CPM_TABLE: Record<number, number> = {
  1: 0.094, 1.5: 0.135137432, 2: 0.16639787, 2.5: 0.192650919,
  3: 0.21573247, 3.5: 0.236572661, 4: 0.25572005, 4.5: 0.273530381,
  5: 0.29024988, 5.5: 0.306057377, 6: 0.3210876, 6.5: 0.335445036,
  7: 0.34921268, 7.5: 0.362457751, 8: 0.37523559, 8.5: 0.387592406,
  9: 0.39956728, 9.5: 0.411193551, 10: 0.42250001, 10.5: 0.432926419,
  11: 0.44310755, 11.5: 0.453059958, 12: 0.46279839, 12.5: 0.472336083,
  13: 0.48168495, 13.5: 0.4908558, 14: 0.49985844, 14.5: 0.508701765,
  15: 0.51739395, 15.5: 0.525942511, 16: 0.53435433, 16.5: 0.542635767,
  17: 0.55079269, 17.5: 0.558830576, 18: 0.56675452, 18.5: 0.574569153,
  19: 0.58227891, 19.5: 0.589887917, 20: 0.59740001, 20.5: 0.604818814,
  21: 0.61215729, 21.5: 0.619404122, 22: 0.62656713, 22.5: 0.633649143,
  23: 0.64065295, 23.5: 0.647580967, 24: 0.65443563, 24.5: 0.661219252,
  25: 0.667934, 25.5: 0.674581896, 26: 0.68116492, 26.5: 0.687684904,
  27: 0.69414365, 27.5: 0.70054287, 28: 0.70688421, 28.5: 0.713168999,
  29: 0.71939909, 29.5: 0.725575614, 30: 0.7317, 30.5: 0.734741009,
  31: 0.73776948, 31.5: 0.740785574, 32: 0.74378943, 32.5: 0.746781211,
  33: 0.74976104, 33.5: 0.752729087, 34: 0.75568551, 34.5: 0.758630378,
  35: 0.76156384, 35.5: 0.764486065, 36: 0.76739717, 36.5: 0.770297266,
  37: 0.7731865, 37.5: 0.776064962, 38: 0.77893275, 38.5: 0.781790055,
  39: 0.78463697, 39.5: 0.787473578, 40: 0.7903, 40.5: 0.792803968,
  41: 0.79530001, 41.5: 0.797800015, 42: 0.8003, 42.5: 0.802799995,
  43: 0.8053, 43.5: 0.8078, 44: 0.81029999, 44.5: 0.812799985,
  45: 0.81529999, 45.5: 0.81779999, 46: 0.82029999, 46.5: 0.82279999,
  47: 0.82529999, 47.5: 0.82779999, 48: 0.83029999, 48.5: 0.83279999,
  49: 0.83529999, 49.5: 0.83779999, 50: 0.84029999, 50.5: 0.84279999,
  51: 0.84529999
};

function solveLeagueLevelCpm(uAtk: number, uDef: number, uHp: number, leagueCap: number): { cpm: number; cp: number } {
  let bestCpm = 0.094;
  let bestCp = 10;
  for (let lvl = 1; lvl <= 50; lvl += 0.5) {
    const cpm = CPM_TABLE[lvl] ?? 0.7903;
    const cp = Math.max(10, Math.floor((uAtk * Math.sqrt(uDef * uHp) * cpm * cpm) / 10));
    if (cp <= leagueCap) {
      bestCpm = cpm;
      bestCp = cp;
    } else {
      break;
    }
  }
  return { cpm: bestCpm, cp: bestCp };
}

/**
 * Parses user IV string (e.g. "0/15/15", "15-15-15") or returns PvPoke default IVs for the league.
 */
export function parseIvTriplet(
  ivStr: string | undefined,
  league: string = "MASTER LEAGUE",
  pokemon?: PokemonStats
): [number, number, number] {
  if (ivStr && ivStr.trim().length > 0) {
    const parts = ivStr
      .trim()
      .split(/[/\-,;\s]+/)
      .map((s) => parseInt(s, 10))
      .filter((n) => !Number.isNaN(n));
    if (parts.length >= 3) {
      return [
        Math.max(0, Math.min(15, parts[0])),
        Math.max(0, Math.min(15, parts[1])),
        Math.max(0, Math.min(15, parts[2]))
      ];
    }
  }
  const upper = league.toUpperCase();
  if (upper.includes("GREAT")) {
    if (pokemon?.defaultIvsGl) {
      const glParts = pokemon.defaultIvsGl.split("/").map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
      if (glParts.length >= 3) return [glParts[0], glParts[1], glParts[2]];
    }
    return [1, 15, 15];
  }
  if (upper.includes("ULTRA")) {
    if (pokemon?.defaultIvsUl) {
      const ulParts = pokemon.defaultIvsUl.split("/").map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n));
      if (ulParts.length >= 3) return [ulParts[0], ulParts[1], ulParts[2]];
    }
    return [1, 15, 15];
  }
  return [15, 15, 15];
}

/**
 * Computes League CP-scaled and IV-adjusted effective PokemonStats for a target league, custom CP, and optional IVs.
 */
export function computeEffectiveStatsForLeague(
  pokemon: PokemonStats,
  league: string = "MASTER LEAGUE",
  customCp?: number,
  customIvs?: string,
  isShadow?: boolean
): PokemonStats & { resolvedCp: number } {
  const upper = league.toUpperCase();
  const isGreat = upper.includes("GREAT");
  const isUltra = upper.includes("ULTRA");
  const leagueCap = isGreat ? 1500 : isUltra ? 2500 : 6000;
  const actualIvs = parseIvTriplet(customIvs, league, pokemon);
  const withLeagueMoves = applyRankingMovesToPokemonStats(pokemon, league, isShadow);

  if (pokemon.isRawBaseStats) {
    const uAtk = Math.max(20, pokemon.baseStats.atk + actualIvs[0]);
    const uDef = Math.max(20, pokemon.baseStats.def + actualIvs[1]);
    const uHp = Math.max(20, pokemon.baseStats.hp + actualIvs[2]);
    let targetCp: number;
    let cpm: number;
    if (customCp && customCp >= 100 && customCp <= leagueCap + 100) {
      targetCp = customCp;
      cpm = Math.max(
        0.094,
        Math.min(0.8453, Math.sqrt((targetCp * 10) / (uAtk * Math.sqrt(uDef * uHp))))
      );
    } else {
      const solved = solveLeagueLevelCpm(uAtk, uDef, uHp, leagueCap);
      targetCp = solved.cp;
      cpm = solved.cpm;
    }
    return {
      ...withLeagueMoves,
      isRawBaseStats: false,
      resolvedCp: targetCp,
      baseStats: {
        atk: Number((uAtk * cpm).toFixed(2)),
        def: Number((uDef * cpm).toFixed(2)),
        hp: Math.max(10, Math.floor(uHp * cpm))
      }
    };
  }

  const refStatCp = Math.max(
    100,
    Math.floor(
      (pokemon.baseStats.atk *
        Math.sqrt(pokemon.baseStats.def) *
        Math.sqrt(pokemon.baseStats.hp)) /
        10
    )
  );
  const refCpm = refStatCp > 2500 ? 0.8403 : refStatCp > 1550 ? 0.7903 : 0.7317;
  const refIvs: [number, number, number] = refStatCp > 2500 ? [15, 15, 15] : [1, 15, 15];

  const adjAtkAtRef = Math.max(20, pokemon.baseStats.atk + (actualIvs[0] - refIvs[0]) * refCpm);
  const adjDefAtRef = Math.max(20, pokemon.baseStats.def + (actualIvs[1] - refIvs[1]) * refCpm);
  const adjHpAtRef = Math.max(20, pokemon.baseStats.hp + (actualIvs[2] - refIvs[2]) * refCpm);

  const refProd = Math.max(1, pokemon.baseStats.atk * Math.sqrt(pokemon.baseStats.def * pokemon.baseStats.hp));
  const adjProd = Math.max(1, adjAtkAtRef * Math.sqrt(adjDefAtRef * adjHpAtRef));
  const ivCpRatio = adjProd / refProd;

  const defaultLeagueCp = isGreat
    ? refStatCp <= 1500
      ? refStatCp
      : 1498
    : isUltra
    ? refStatCp >= 1501 && refStatCp <= 2500
      ? refStatCp
      : refStatCp > 2500
      ? 2496
      : Math.min(2500, Math.round(refStatCp * 1.65))
    : refStatCp > 2500
    ? refStatCp
    : Math.min(4720, Math.round(refStatCp * 1.45));

  const targetCp =
    customCp && customCp >= 100 && customCp <= leagueCap + 100
      ? customCp
      : !isGreat && !isUltra
      ? Math.max(100, Math.round(defaultLeagueCp * ivCpRatio))
      : defaultLeagueCp;

  const effectiveRefCp = Math.max(100, refStatCp * ivCpRatio);
  const cpmScale = Math.max(0.35, Math.min(1.45, Math.sqrt(targetCp / effectiveRefCp)));

  return {
    ...withLeagueMoves,
    resolvedCp: targetCp,
    baseStats: {
      atk: Number((adjAtkAtRef * cpmScale).toFixed(2)),
      def: Number((adjDefAtRef * cpmScale).toFixed(2)),
      hp: Math.max(10, Math.round(adjHpAtRef * cpmScale))
    }
  };
}

/**
 * Resolves PvPoke recommended Fast Move, Charged Move 1, Charged Move 2, and default CP for a Pokémon name.
 */
const LIVE_RANKINGS_MAP: Record<string, Map<string, PokemonRankingEntry>> = {
  "GREAT LEAGUE": new Map(),
  "ULTRA LEAGUE": new Map(),
  "MASTER LEAGUE": new Map(),
  "MEGA MASTER LEAGUE": new Map()
};

const MOVE_ID_TO_NAME: Record<string, string> = {};

const CANONICAL_MOVE_ID_MAP: Record<string, string> = {
  SUPER_POWER: "Superpower",
  LOCK_ON: "Lock-On",
  MUD_SLAP: "Mud-Slap",
  POWER_UP_PUNCH: "Power-Up Punch",
  X_SCISSOR: "X-Scissor",
  NATURES_MADNESS: "Nature's Madness",
  TORCH_SONG: "Torch Song",
  BRUTAL_SWING: "Brutal Swing",
  WATER_SHURIKEN: "Water Shuriken",
  PSYWAVE: "Psywave",
  DISARMING_VOICE: "Disarming Voice",
  HYDRO_CANNON: "Hydro Cannon",
  NIGHT_SLASH: "Night Slash",
  BODY_SLAM: "Body Slam",
  EARTHQUAKE: "Earthquake",
  SHADOW_BALL: "Shadow Ball",
  INCINERATE: "Incinerate",
  WEATHER_BALL_FIRE: "Weather Ball (Fire)",
  WEATHER_BALL_ICE: "Weather Ball (Ice)",
  WEATHER_BALL_WATER: "Weather Ball (Water)",
  WEATHER_BALL_ROCK: "Weather Ball (Rock)",
  WEATHER_BALL_NORMAL: "Weather Ball",
  CHILLING_WATER: "Chilling Water",
  FUTURE_SIGHT: "Future Sight",
  ROAR_OF_TIME: "Roar of Time",
  FREEZE_SHOCK: "Freeze Shock",
  ICE_BURN: "Ice Burn",
  FUSION_BOLT: "Fusion Bolt",
  FUSION_FLARE: "Fusion Flare",
  SPACIAL_REND: "Spacial Rend",
  ROCK_TOMB: "Rock Tomb",
  SAND_TOMB: "Sand Tomb",
  MIRROR_SHOT: "Mirror Shot",
  VOLT_SWITCH: "Volt Switch"
};

const CHARGED_MOVE_FALLBACK_STATS: Record<string, { type: string; power: number; energyCost: number; code: string }> = {
  "weather ball (ice)": { type: "ice", power: 60, energyCost: 35, code: "WB-I" },
  "weather ball (fire)": { type: "fire", power: 60, energyCost: 35, code: "WB-F" },
  "weather ball (water)": { type: "water", power: 60, energyCost: 35, code: "WB-W" },
  "weather ball (rock)": { type: "rock", power: 60, energyCost: 35, code: "WB-R" },
  "chilling water": { type: "water", power: 60, energyCost: 45, code: "ChW" },
  "psyshock": { type: "psychic", power: 70, energyCost: 40, code: "PS" },
  "energy ball": { type: "grass", power: 80, energyCost: 45, code: "EB" },
  "dazzling gleam": { type: "fairy", power: 90, energyCost: 55, code: "DG" },
  "torch song": { type: "fire", power: 70, energyCost: 45, code: "TrS" },
  "shadow ball": { type: "ghost", power: 90, energyCost: 50, code: "SB" },
  "disarming voice": { type: "fairy", power: 70, energyCost: 45, code: "DV" },
  "body slam": { type: "normal", power: 65, energyCost: 40, code: "BS" },
  "earthquake": { type: "ground", power: 120, energyCost: 65, code: "Eq" },
  "superpower": { type: "fighting", power: 85, energyCost: 40, code: "SpP" },
  "hydro cannon": { type: "water", power: 80, energyCost: 40, code: "HC" },
  "brutal swing": { type: "dark", power: 55, energyCost: 35, code: "BrS" },
  "night slash": { type: "dark", power: 50, energyCost: 35, code: "NS" },
  "blast burn": { type: "fire", power: 110, energyCost: 50, code: "BB" },
  "overheat": { type: "fire", power: 130, energyCost: 55, code: "OH" },
  "outrage": { type: "dragon", power: 110, energyCost: 60, code: "OR" },
  "crunch": { type: "dark", power: 70, energyCost: 45, code: "Cr" },
  "ice beam": { type: "ice", power: 90, energyCost: 55, code: "IB" },
  "aerial ace": { type: "flying", power: 60, energyCost: 45, code: "AA" },
  "close combat": { type: "fighting", power: 100, energyCost: 45, code: "CC" },
  "rock slide": { type: "rock", power: 75, energyCost: 45, code: "RS" },
  "stone edge": { type: "rock", power: 100, energyCost: 55, code: "SE" },
  "foul play": { type: "dark", power: 65, energyCost: 40, code: "FP" },
  "dark pulse": { type: "dark", power: 80, energyCost: 45, code: "DP" },
  "moonblast": { type: "fairy", power: 90, energyCost: 50, code: "MB" },
  "play rough": { type: "fairy", power: 90, energyCost: 60, code: "PR" },
  "surf": { type: "water", power: 75, energyCost: 45, code: "Surf" },
  "scald": { type: "water", power: 85, energyCost: 50, code: "Sc" },
  "icy wind": { type: "ice", power: 60, energyCost: 45, code: "IW" },
  "rock tomb": { type: "rock", power: 75, energyCost: 50, code: "RT" },
  "sand tomb": { type: "ground", power: 55, energyCost: 45, code: "ST" },
  "mirror shot": { type: "steel", power: 35, energyCost: 35, code: "MS" },
  "ice punch": { type: "ice", power: 60, energyCost: 40, code: "IP" },
  "thunder punch": { type: "electric", power: 60, energyCost: 40, code: "TP" },
  "fire punch": { type: "fire", power: 60, energyCost: 40, code: "FP" },
  "rage fist": { type: "ghost", power: 55, energyCost: 40, code: "RF" },
  "dynamic punch": { type: "fighting", power: 90, energyCost: 45, code: "DP" },
  "cross chop": { type: "fighting", power: 55, energyCost: 35, code: "CC" },
  "focus blast": { type: "fighting", power: 150, energyCost: 75, code: "FB" },
  "sacred sword": { type: "fighting", power: 60, energyCost: 35, code: "SS" },
  "secret sword": { type: "fighting", power: 70, energyCost: 35, code: "ScS" },
  "power-up punch": { type: "fighting", power: 20, energyCost: 35, code: "PuP" },
  "drill run": { type: "ground", power: 70, energyCost: 40, code: "DR" },
  "earth power": { type: "ground", power: 90, energyCost: 50, code: "EP" },
  "scorching sands": { type: "ground", power: 80, energyCost: 50, code: "SS" },
  "high horsepower": { type: "ground", power: 100, energyCost: 55, code: "HH" },
  "mud bomb": { type: "ground", power: 65, energyCost: 45, code: "MB" },
  "bone club": { type: "ground", power: 55, energyCost: 35, code: "BC" },
  "bulldoze": { type: "ground", power: 80, energyCost: 55, code: "BD" },
  "sky attack": { type: "flying", power: 75, energyCost: 50, code: "SA" },
  "brave bird": { type: "flying", power: 130, energyCost: 55, code: "BB" },
  "fly": { type: "flying", power: 80, energyCost: 45, code: "Fly" },
  "drill peck": { type: "flying", power: 70, energyCost: 40, code: "DP" },
  "hurricane": { type: "flying", power: 110, energyCost: 60, code: "Hur" },
  "acrobatics": { type: "flying", power: 110, energyCost: 55, code: "Acr" },
  "air cutter": { type: "flying", power: 60, energyCost: 40, code: "AC" },
  "feather dance": { type: "flying", power: 35, energyCost: 50, code: "FD" },
  "avalanche": { type: "ice", power: 90, energyCost: 45, code: "Av" },
  "blizzard": { type: "ice", power: 140, energyCost: 75, code: "Blz" },
  "icicle spear": { type: "ice", power: 70, energyCost: 40, code: "IS" },
  "triple axel": { type: "ice", power: 60, energyCost: 45, code: "TA" },
  "frenzy plant": { type: "grass", power: 100, energyCost: 45, code: "FP" },
  "leaf blade": { type: "grass", power: 70, energyCost: 35, code: "LB" },
  "grass knot": { type: "grass", power: 90, energyCost: 50, code: "GK" },
  "power whip": { type: "grass", power: 90, energyCost: 50, code: "PW" },
  "seed bomb": { type: "grass", power: 55, energyCost: 40, code: "SB" },
  "trailblaze": { type: "grass", power: 65, energyCost: 45, code: "TB" },
  "solar beam": { type: "grass", power: 150, energyCost: 80, code: "SBm" },
  "sludge bomb": { type: "poison", power: 80, energyCost: 50, code: "SlB" },
  "sludge wave": { type: "poison", power: 110, energyCost: 65, code: "SWv" },
  "acid spray": { type: "poison", power: 20, energyCost: 45, code: "AS" },
  "poison fang": { type: "poison", power: 50, energyCost: 40, code: "PF" },
  "gunk shot": { type: "poison", power: 130, energyCost: 75, code: "GS" },
  "wild charge": { type: "electric", power: 100, energyCost: 45, code: "WC" },
  "thunderbolt": { type: "electric", power: 90, energyCost: 55, code: "TB" },
  "thunder": { type: "electric", power: 100, energyCost: 60, code: "Th" },
  "zap cannon": { type: "electric", power: 150, energyCost: 80, code: "ZC" },
  "discharge": { type: "electric", power: 55, energyCost: 40, code: "Dis" },
  "aura wheel": { type: "electric", power: 100, energyCost: 45, code: "AW" },
  "psychic": { type: "psychic", power: 75, energyCost: 55, code: "Psy" },
  "psychic fangs": { type: "psychic", power: 40, energyCost: 35, code: "PF" },
  "future sight": { type: "psychic", power: 110, energyCost: 65, code: "FS" },
  "psycho boost": { type: "psychic", power: 85, energyCost: 35, code: "PB" },
  "psystrike": { type: "psychic", power: 90, energyCost: 45, code: "PS" },
  "shadow bone": { type: "ghost", power: 80, energyCost: 45, code: "SBn" },
  "shadow punch": { type: "ghost", power: 55, energyCost: 35, code: "SP" },
  "shadow sneak": { type: "ghost", power: 75, energyCost: 50, code: "SS" },
  "ominous wind": { type: "ghost", power: 45, energyCost: 45, code: "OW" },
  "megahorn": { type: "bug", power: 110, energyCost: 55, code: "MH" },
  "lunge": { type: "bug", power: 70, energyCost: 45, code: "Lng" },
  "x-scissor": { type: "bug", power: 65, energyCost: 40, code: "XS" },
  "bug buzz": { type: "bug", power: 100, energyCost: 60, code: "BBz" },
  "power gem": { type: "rock", power: 85, energyCost: 50, code: "PG" },
  "ancient power": { type: "rock", power: 60, energyCost: 45, code: "AP" },
  "rock wrecker": { type: "rock", power: 110, energyCost: 50, code: "RW" },
  "meteor mash": { type: "steel", power: 100, energyCost: 45, code: "MM" },
  "iron head": { type: "steel", power: 85, energyCost: 50, code: "IH" },
  "flash cannon": { type: "steel", power: 110, energyCost: 65, code: "FC" },
  "heavy slam": { type: "steel", power: 70, energyCost: 50, code: "HS" },
  "dragon claw": { type: "dragon", power: 80, energyCost: 50, code: "DC" },
  "breaking swipe": { type: "dragon", power: 50, energyCost: 50, code: "BS" },
  "draco meteor": { type: "dragon", power: 150, energyCost: 65, code: "DM" },
  "aqua tail": { type: "water", power: 55, energyCost: 35, code: "AT" },
  "hydro pump": { type: "water", power: 130, energyCost: 75, code: "HP" },
  "liquidation": { type: "water", power: 70, energyCost: 45, code: "Liq" }
};

const DYNAMIC_CHARGED_MOVE_MAP: Record<string, ChargedMove> = {};

function formatMoveIdToDisplayName(moveId: string): string {
  if (!moveId) return "";
  const upper = moveId.trim().toUpperCase();
  if (CANONICAL_MOVE_ID_MAP[upper]) return CANONICAL_MOVE_ID_MAP[upper];
  if (MOVE_ID_TO_NAME[moveId]) return MOVE_ID_TO_NAME[moveId];
  if (MOVE_ID_TO_NAME[upper]) return MOVE_ID_TO_NAME[upper];
  return moveId
    .toLowerCase()
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export function buildChargedMoveFromName(moveName: string, fallbackType: string, existingMoves: ChargedMove[]): ChargedMove {
  const lower = moveName.toLowerCase().trim();
  if (DYNAMIC_CHARGED_MOVE_MAP[lower]) return DYNAMIC_CHARGED_MOVE_MAP[lower];
  const existing = existingMoves.find((m) => m.name.toLowerCase() === lower);
  if (existing) return existing;
  const fb = CHARGED_MOVE_FALLBACK_STATS[lower];
  if (fb) {
    return {
      name: moveName,
      code: fb.code,
      type: fb.type,
      power: fb.power,
      energyCost: fb.energyCost
    };
  }
  return {
    name: moveName,
    code: abbrMove5(moveName),
    type: fallbackType || "normal",
    power: 75,
    energyCost: 50
  };
}

export function applyRankingMovesToPokemonStats(
  pokemon: PokemonStats,
  league: string = "MASTER LEAGUE",
  isShadowOverride?: boolean
): PokemonStats {
  const upper = league.toUpperCase();
  const normLeague = upper.includes("MEGA")
    ? "MEGA MASTER LEAGUE"
    : upper.includes("GREAT")
    ? "GREAT LEAGUE"
    : upper.includes("ULTRA")
    ? "ULTRA LEAGUE"
    : "MASTER LEAGUE";

  const isSkeledirge =
    pokemon.baseSpecies?.toLowerCase() === "skeledirge" ||
    pokemon.speciesId.toLowerCase().startsWith("skeledirge");

  const map = LIVE_RANKINGS_MAP[normLeague];
  const baseKey = pokemon.speciesId.toLowerCase().replace(/_shadow$/i, "");
  const isShadow =
    isShadowOverride ??
    (pokemon.name.toLowerCase().startsWith("shadow ") || pokemon.speciesId.toLowerCase().endsWith("_shadow"));

  const entry = map
    ? isShadow
      ? map.get(`${baseKey}_shadow`) || map.get(baseKey)
      : map.get(baseKey) || map.get(`${baseKey}_shadow`)
    : undefined;

  if (!entry) {
    if (isSkeledirge) {
      return {
        ...pokemon,
        defaultFastMove: FAST_MOVE_STATS["incinerate"] || pokemon.defaultFastMove,
        chargedMoves: [
          buildChargedMoveFromName("Torch Song", "fire", pokemon.chargedMoves),
          buildChargedMoveFromName("Shadow Ball", "ghost", pokemon.chargedMoves),
          buildChargedMoveFromName("Disarming Voice", "fairy", pokemon.chargedMoves)
        ]
      };
    }
    return pokemon;
  }

  const topFastId = entry.moveset?.[0] || entry.moves.fastMoves[0]?.moveId;
  const fastName = topFastId ? formatMoveIdToDisplayName(topFastId) : pokemon.defaultFastMove.name;
  const resolvedFast = FAST_MOVE_STATS[fastName.toLowerCase()] || pokemon.defaultFastMove;

  if (isSkeledirge) {
    return {
      ...pokemon,
      defaultFastMove: resolvedFast,
      chargedMoves: [
        buildChargedMoveFromName("Torch Song", "fire", pokemon.chargedMoves),
        buildChargedMoveFromName("Shadow Ball", "ghost", pokemon.chargedMoves),
        buildChargedMoveFromName("Disarming Voice", "fairy", pokemon.chargedMoves)
      ]
    };
  }

  const orderedChargedNames: string[] = [];
  if (entry.moveset && entry.moveset.length > 1) {
    for (const mId of entry.moveset.slice(1)) {
      const formatted = formatMoveIdToDisplayName(mId);
      if (formatted && !orderedChargedNames.some((n) => n.toLowerCase() === formatted.toLowerCase())) {
        orderedChargedNames.push(formatted);
      }
    }
  }
  for (const cm of entry.moves.chargedMoves) {
    const formatted = formatMoveIdToDisplayName(cm.moveId);
    if (formatted && !orderedChargedNames.some((n) => n.toLowerCase() === formatted.toLowerCase())) {
      orderedChargedNames.push(formatted);
    }
  }

  const finalChargedMoves =
    orderedChargedNames.length > 0
      ? orderedChargedNames
          .slice(0, 4)
          .map((mName) => buildChargedMoveFromName(mName, pokemon.types[0], pokemon.chargedMoves))
      : pokemon.chargedMoves;

  return {
    ...pokemon,
    defaultFastMove: resolvedFast,
    chargedMoves: finalChargedMoves
  };
}

export function parseRankingsJsonArray(rawJson: unknown): PokemonRankingEntry[] {
  if (!Array.isArray(rawJson)) return [];
  const entries: PokemonRankingEntry[] = [];
  for (const item of rawJson) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const speciesId = typeof obj.speciesId === "string" ? obj.speciesId : "";
    if (!speciesId) continue;
    const score = typeof obj.score === "number" ? obj.score : 80.0;
    const movesObj = (obj.moves && typeof obj.moves === "object" ? obj.moves : {}) as Record<string, unknown>;
    const rawFast = Array.isArray(movesObj.fastMoves) ? movesObj.fastMoves : [];
    const rawCharged = Array.isArray(movesObj.chargedMoves) ? movesObj.chargedMoves : [];

    const fastMoves: MoveUsage[] = rawFast
      .map((m: unknown): MoveUsage | null => {
        if (!m || typeof m !== "object") return null;
        const mo = m as Record<string, unknown>;
        return typeof mo.moveId === "string"
          ? { moveId: mo.moveId, uses: typeof mo.uses === "number" ? mo.uses : undefined }
          : null;
      })
      .filter((x): x is MoveUsage => x !== null)
      .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0));

    const chargedMoves: MoveUsage[] = rawCharged
      .map((m: unknown): MoveUsage | null => {
        if (!m || typeof m !== "object") return null;
        const mo = m as Record<string, unknown>;
        return typeof mo.moveId === "string"
          ? { moveId: mo.moveId, uses: typeof mo.uses === "number" ? mo.uses : undefined }
          : null;
      })
      .filter((x): x is MoveUsage => x !== null)
      .sort((a, b) => (b.uses ?? 0) - (a.uses ?? 0));

    const moveset = Array.isArray(obj.moveset)
      ? obj.moveset.filter((s): s is string => typeof s === "string")
      : undefined;

    entries.push({
      speciesId,
      score,
      moves: { fastMoves, chargedMoves },
      moveCount: Array.isArray(obj.moveCount) ? (obj.moveCount as number[]) : undefined,
      moveset
    });
  }
  return entries;
}

export async function syncPvPokeDataAndRankings(): Promise<{
  syncedCount: number;
  rankingsCount: Record<string, number>;
}> {
  const [gmRes, glRes, ulRes, mlRes, megaRes] = await Promise.all([
    fetch(PVPOKE_ENDPOINTS.GAMEMASTER).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(PVPOKE_ENDPOINTS.RANKINGS_GL).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(PVPOKE_ENDPOINTS.RANKINGS_UL).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(PVPOKE_ENDPOINTS.RANKINGS_ML).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(PVPOKE_ENDPOINTS.RANKINGS_MEGA_ML).then((r) => (r.ok ? r.json() : null)).catch(() => null)
  ]);

  const gmMoveDetails: Record<
    string,
    { name: string; type: string; power: number; energy: number; energyGain: number; turns: number }
  > = {};

  if (gmRes && typeof gmRes === "object" && Array.isArray(gmRes.moves)) {
    for (const m of gmRes.moves) {
      if (m?.moveId && m?.name) {
        MOVE_ID_TO_NAME[m.moveId] = m.name;
        const rawTurns = typeof m.turns === "number" ? m.turns : 1;
        const turns = rawTurns >= 500 ? Math.max(1, Math.round(rawTurns / 500)) : Math.max(1, rawTurns);
        gmMoveDetails[m.moveId] = {
          name: m.name,
          type: typeof m.type === "string" ? m.type.toLowerCase() : "normal",
          power: typeof m.power === "number" ? m.power : 50,
          energy: typeof m.energy === "number" ? m.energy : 50,
          energyGain: typeof m.energyGain === "number" ? m.energyGain : 6,
          turns
        };
        if (typeof m.energy === "number" && m.energy > 0) {
          DYNAMIC_CHARGED_MOVE_MAP[m.name.toLowerCase()] = {
            name: m.name,
            code: abbrMove5(m.name),
            type: typeof m.type === "string" ? m.type.toLowerCase() : "normal",
            power: typeof m.power === "number" ? m.power : 50,
            energyCost: m.energy
          };
        } else if (typeof m.energyGain === "number" && m.energyGain > 0) {
          FAST_MOVE_STATS[m.name.toLowerCase()] = {
            name: m.name,
            type: typeof m.type === "string" ? m.type.toLowerCase() : "normal",
            turns,
            power: typeof m.power === "number" ? m.power : 4,
            energyGain: m.energyGain
          };
        }
      }
    }
  }

  const glEntries = parseRankingsJsonArray(glRes);
  const ulEntries = parseRankingsJsonArray(ulRes);
  const mlEntries = parseRankingsJsonArray(mlRes);
  const megaEntries = parseRankingsJsonArray(megaRes);

  const storeLeagueRankings = (leagueKey: string, list: PokemonRankingEntry[]) => {
    const map = LIVE_RANKINGS_MAP[leagueKey];
    if (!map) return;
    map.clear();
    list.forEach((entry) => {
      map.set(entry.speciesId.toLowerCase(), entry);
    });
  };

  storeLeagueRankings("GREAT LEAGUE", glEntries);
  storeLeagueRankings("ULTRA LEAGUE", ulEntries);
  storeLeagueRankings("MASTER LEAGUE", mlEntries);
  storeLeagueRankings("MEGA MASTER LEAGUE", megaEntries);

  // Dynamically ingest species from gamemaster.json so all base, alternate, mega, and shadow forms are available in Team Builder
  if (gmRes && typeof gmRes === "object" && Array.isArray(gmRes.pokemon)) {
    const typeColorMap: Record<string, string> = {
      fire: "#f97316",
      water: "#3b82f6",
      grass: "#22c55e",
      electric: "#eab308",
      ice: "#38bdf8",
      fighting: "#ef4444",
      poison: "#a855f7",
      ground: "#d97706",
      flying: "#60a5fa",
      psychic: "#ec4899",
      bug: "#84cc16",
      rock: "#b45309",
      ghost: "#8b5cf6",
      dragon: "#6366f1",
      dark: "#64748b",
      steel: "#94a3b8",
      fairy: "#f472b6",
      normal: "#9ca3af"
    };

    for (const p of gmRes.pokemon) {
      if (!p || typeof p.speciesId !== "string" || typeof p.speciesName !== "string") continue;
      const speciesId: string = p.speciesId;
      let displayName: string = p.speciesName;
      if (displayName.endsWith(" (Shadow)")) {
        displayName = "Shadow " + displayName.replace(" (Shadow)", "").trim();
      }
      const rawTypes = Array.isArray(p.types)
        ? p.types.filter((t: unknown): t is string => typeof t === "string" && t.toLowerCase() !== "none").map((t: string) => t.toLowerCase())
        : ["normal"];
      const types = rawTypes.length > 0 ? rawTypes : ["normal"];
      const statsObj = p.baseStats && typeof p.baseStats === "object" ? p.baseStats : {};
      const atk = typeof statsObj.atk === "number" ? statsObj.atk : 180;
      const def = typeof statsObj.def === "number" ? statsObj.def : 180;
      const hp = typeof statsObj.hp === "number" ? statsObj.hp : 180;

      let defaultIvsGl = "1/15/15";
      let defaultIvsUl = "1/15/15";
      if (p.defaultIVs && typeof p.defaultIVs === "object") {
        if (Array.isArray(p.defaultIVs.cp1500) && p.defaultIVs.cp1500.length >= 4) {
          defaultIvsGl = `${Math.trunc(p.defaultIVs.cp1500[1])}/${Math.trunc(p.defaultIVs.cp1500[2])}/${Math.trunc(p.defaultIVs.cp1500[3])}`;
        }
        if (Array.isArray(p.defaultIVs.cp2500) && p.defaultIVs.cp2500.length >= 4) {
          defaultIvsUl = `${Math.trunc(p.defaultIVs.cp2500[1])}/${Math.trunc(p.defaultIVs.cp2500[2])}/${Math.trunc(p.defaultIVs.cp2500[3])}`;
        }
      }

      // Update any existing static keys that match either displayName or speciesId (e.g., "Zygarde" -> "zygarde_complete")
      for (const [k, existingEntry] of Object.entries(POKEMON_DATABASE)) {
        if (k === displayName || existingEntry.speciesId.toLowerCase() === speciesId.toLowerCase()) {
          POKEMON_DATABASE[k] = {
            ...existingEntry,
            types,
            baseStats: { atk, def, hp },
            isRawBaseStats: true,
            defaultIvsGl,
            defaultIvsUl
          };
        }
      }
      if (POKEMON_DATABASE[displayName]) {
        continue;
      }

      const rankEntry =
        LIVE_RANKINGS_MAP["GREAT LEAGUE"]?.get(speciesId.toLowerCase()) ||
        LIVE_RANKINGS_MAP["ULTRA LEAGUE"]?.get(speciesId.toLowerCase()) ||
        LIVE_RANKINGS_MAP["MASTER LEAGUE"]?.get(speciesId.toLowerCase()) ||
        LIVE_RANKINGS_MAP["MEGA MASTER LEAGUE"]?.get(speciesId.toLowerCase());

      const rawFastIds: string[] = Array.isArray(p.fastMoves) ? p.fastMoves : [];
      const rawChargedIds: string[] = Array.isArray(p.chargedMoves) ? p.chargedMoves : [];

      const prefFastId = rankEntry?.moveset?.[0] || rankEntry?.moves.fastMoves[0]?.moveId || rawFastIds[0] || "TACKLE";
      const fastInfo = gmMoveDetails[prefFastId] || {
        name: formatMoveIdToDisplayName(prefFastId) || "Tackle",
        type: types[0],
        turns: 2,
        power: 5,
        energyGain: 7,
        energy: 0
      };

      const orderedChargedIds: string[] = [];
      if (rankEntry) {
        rankEntry.moveset?.slice(1).forEach((mId) => {
          if (mId && !orderedChargedIds.includes(mId)) orderedChargedIds.push(mId);
        });
        rankEntry.moves.chargedMoves.forEach((cm) => {
          if (cm.moveId && !orderedChargedIds.includes(cm.moveId)) orderedChargedIds.push(cm.moveId);
        });
      }
      rawChargedIds.forEach((mId) => {
        if (mId && !orderedChargedIds.includes(mId)) orderedChargedIds.push(mId);
      });

      const chargedMoves: ChargedMove[] = orderedChargedIds.slice(0, 4).map((mId) => {
        const cInfo = gmMoveDetails[mId];
        const mName = cInfo?.name || formatMoveIdToDisplayName(mId) || "Struggle";
        const words = mName.split(" ").filter(Boolean);
        const code = words.length >= 2 ? (words[0][0] + words[1][0]).toUpperCase() : mName.slice(0, 2).toUpperCase();
        return {
          name: mName,
          code,
          type: cInfo?.type || types[0],
          power: cInfo?.power || 75,
          energyCost: cInfo?.energy || 50
        };
      });

      const baseSpecies = speciesId
        .replace(/_shadow$/i, "")
        .split("_")[0]
        .toLowerCase();

      const parenMatch = displayName.match(/\(([^)]+)\)/);
      const formLabel = parenMatch
        ? parenMatch[1]
        : displayName.startsWith("Mega ")
        ? "Mega"
        : displayName.startsWith("Primal ")
        ? "Primal"
        : undefined;

      POKEMON_DATABASE[displayName] = {
        speciesId,
        name: displayName,
        baseSpecies,
        formLabel,
        types,
        baseStats: { atk, def, hp },
        isRawBaseStats: true,
        defaultIvsGl,
        defaultIvsUl,
        defaultFastMove: {
          name: fastInfo.name,
          type: fastInfo.type,
          turns: fastInfo.turns,
          power: fastInfo.power,
          energyGain: fastInfo.energyGain
        },
        chargedMoves:
          chargedMoves.length > 0
            ? chargedMoves
            : [{ name: "Body Slam", code: "BS", type: "normal", power: 65, energyCost: 40 }],
        color: typeColorMap[types[0]] || "#38bdf8"
      };
    }
  }

  return {
    syncedCount: Object.keys(POKEMON_DATABASE).length,
    rankingsCount: {
      "GREAT LEAGUE": glEntries.length,
      "ULTRA LEAGUE": ulEntries.length,
      "MASTER LEAGUE": mlEntries.length,
      "MEGA MASTER LEAGUE": megaEntries.length
    }
  };
}

export function getPvPokeDatabaseTelemetry(): {
  gmCount: number;
  glCount: number;
  ulCount: number;
  mlCount: number;
  megaCount: number;
  areAllFourLeaguesLoaded: boolean;
} {
  const glCount = LIVE_RANKINGS_MAP["GREAT LEAGUE"]?.size ?? 0;
  const ulCount = LIVE_RANKINGS_MAP["ULTRA LEAGUE"]?.size ?? 0;
  const mlCount = LIVE_RANKINGS_MAP["MASTER LEAGUE"]?.size ?? 0;
  const megaCount = LIVE_RANKINGS_MAP["MEGA MASTER LEAGUE"]?.size ?? 0;
  return {
    gmCount: Object.keys(POKEMON_DATABASE).length,
    glCount,
    ulCount,
    mlCount,
    megaCount,
    areAllFourLeaguesLoaded: glCount > 0 && ulCount > 0 && mlCount > 0 && megaCount > 0
  };
}

export interface PokemonAutocompleteOption {
  name: string;
  speciesId: string;
  baseSpecies: string;
  formBadge: string;
  types: string[];
  cp: number;
  fastMove: string;
  chargedMove1: string;
  chargedMove2: string;
  isShadow: boolean;
  isAlternateForm: boolean;
  score?: number;
}

const BUILTIN_REGIONAL_ALTERNATES: Array<{
  base: string;
  name: string;
  speciesId: string;
  formBadge: string;
  types: string[];
  fastMove: string;
  chargedMove1: string;
  chargedMove2: string;
  hasShadow?: boolean;
}> = [
  { base: "ninetales", name: "Kanto Ninetales", speciesId: "ninetales", formBadge: "Kanto", types: ["fire"], fastMove: "Ember", chargedMove1: "Weather Ball (Fire)", chargedMove2: "Energy Ball", hasShadow: true },
  { base: "ninetales", name: "Ninetales (Alolan)", speciesId: "ninetales_alolan", formBadge: "Alolan", types: ["ice", "fairy"], fastMove: "Powder Snow", chargedMove1: "Weather Ball (Ice)", chargedMove2: "Chilling Water", hasShadow: true },
  { base: "marowak", name: "Marowak", speciesId: "marowak", formBadge: "Kanto", types: ["ground"], fastMove: "Mud-Slap", chargedMove1: "Bone Club", chargedMove2: "Rock Slide", hasShadow: true },
  { base: "marowak", name: "Marowak (Alolan)", speciesId: "marowak_alolan", formBadge: "Alolan", types: ["fire", "ghost"], fastMove: "Fire Spin", chargedMove1: "Shadow Bone", chargedMove2: "Bone Club", hasShadow: true },
  { base: "sandslash", name: "Sandslash", speciesId: "sandslash", formBadge: "Kanto", types: ["ground"], fastMove: "Mud Shot", chargedMove1: "Scorching Sands", chargedMove2: "Night Slash", hasShadow: true },
  { base: "sandslash", name: "Sandslash (Alolan)", speciesId: "sandslash_alolan", formBadge: "Alolan", types: ["ice", "steel"], fastMove: "Powder Snow", chargedMove1: "Ice Punch", chargedMove2: "Drill Run", hasShadow: true },
  { base: "raichu", name: "Raichu", speciesId: "raichu", formBadge: "Kanto", types: ["electric"], fastMove: "Volt Switch", chargedMove1: "Trailblaze", chargedMove2: "Wild Charge", hasShadow: true },
  { base: "raichu", name: "Raichu (Alolan)", speciesId: "raichu_alolan", formBadge: "Alolan", types: ["electric", "psychic"], fastMove: "Volt Switch", chargedMove1: "Thunder Punch", chargedMove2: "Wild Charge", hasShadow: false },
  { base: "weezing", name: "Weezing", speciesId: "weezing", formBadge: "Kanto", types: ["poison"], fastMove: "Infestation", chargedMove1: "Sludge", chargedMove2: "Thunderbolt", hasShadow: true },
  { base: "weezing", name: "Weezing (Galarian)", speciesId: "weezing_galarian", formBadge: "Galarian", types: ["poison", "fairy"], fastMove: "Fairy Wind", chargedMove1: "Brutal Swing", chargedMove2: "Overheat", hasShadow: true },
  { base: "stunfisk", name: "Stunfisk", speciesId: "stunfisk", formBadge: "Unova", types: ["ground", "electric"], fastMove: "Thunder Shock", chargedMove1: "Mud Bomb", chargedMove2: "Discharge", hasShadow: false },
  { base: "stunfisk", name: "Stunfisk (Galarian)", speciesId: "stunfisk_galarian", formBadge: "Galarian", types: ["ground", "steel"], fastMove: "Mud Shot", chargedMove1: "Rock Slide", chargedMove2: "Earthquake", hasShadow: false },
  { base: "moltres", name: "Moltres", speciesId: "moltres", formBadge: "Kanto", types: ["fire", "flying"], fastMove: "Wing Attack", chargedMove1: "Sky Attack", chargedMove2: "Overheat", hasShadow: true },
  { base: "moltres", name: "Moltres (Galarian)", speciesId: "moltres_galarian", formBadge: "Galarian", types: ["dark", "flying"], fastMove: "Sucker Punch", chargedMove1: "Fly", chargedMove2: "Brave Bird", hasShadow: false },
  { base: "zapdos", name: "Zapdos", speciesId: "zapdos", formBadge: "Kanto", types: ["electric", "flying"], fastMove: "Thunder Shock", chargedMove1: "Drill Peck", chargedMove2: "Thunderbolt", hasShadow: true },
  { base: "zapdos", name: "Zapdos (Galarian)", speciesId: "zapdos_galarian", formBadge: "Galarian", types: ["fighting", "flying"], fastMove: "Counter", chargedMove1: "Ancient Power", chargedMove2: "Close Combat", hasShadow: false },
  { base: "articuno", name: "Articuno", speciesId: "articuno", formBadge: "Kanto", types: ["ice", "flying"], fastMove: "Ice Shard", chargedMove1: "Icy Wind", chargedMove2: "Ancient Power", hasShadow: true },
  { base: "articuno", name: "Articuno (Galarian)", speciesId: "articuno_galarian", formBadge: "Galarian", types: ["psychic", "flying"], fastMove: "Psycho Cut", chargedMove1: "Ancient Power", chargedMove2: "Brave Bird", hasShadow: false },
  { base: "muk", name: "Muk", speciesId: "muk", formBadge: "Kanto", types: ["poison"], fastMove: "Poison Jab", chargedMove1: "Thunder Punch", chargedMove2: "Dark Pulse", hasShadow: true },
  { base: "muk", name: "Muk (Alolan)", speciesId: "muk_alolan", formBadge: "Alolan", types: ["poison", "dark"], fastMove: "Poison Jab", chargedMove1: "Acid Spray", chargedMove2: "Dark Pulse", hasShadow: true },
  { base: "qwilfish", name: "Qwilfish", speciesId: "qwilfish", formBadge: "Johto", types: ["water", "poison"], fastMove: "Poison Sting", chargedMove1: "Aqua Tail", chargedMove2: "Sludge Wave", hasShadow: true },
  { base: "qwilfish", name: "Qwilfish (Hisuian)", speciesId: "qwilfish_hisuian", formBadge: "Hisuian", types: ["dark", "poison"], fastMove: "Poison Jab", chargedMove1: "Aqua Tail", chargedMove2: "Shadow Ball", hasShadow: false },
  { base: "typhlosion", name: "Typhlosion", speciesId: "typhlosion", formBadge: "Johto", types: ["fire"], fastMove: "Incinerate", chargedMove1: "Blast Burn", chargedMove2: "Thunder Punch", hasShadow: true },
  { base: "typhlosion", name: "Typhlosion (Hisuian)", speciesId: "typhlosion_hisuian", formBadge: "Hisuian", types: ["fire", "ghost"], fastMove: "Hex", chargedMove1: "Fire Punch", chargedMove2: "Shadow Ball", hasShadow: false },
  { base: "samurott", name: "Samurott", speciesId: "samurott", formBadge: "Unova", types: ["water"], fastMove: "Fury Cutter", chargedMove1: "Hydro Cannon", chargedMove2: "Megahorn", hasShadow: false },
  { base: "samurott", name: "Samurott (Hisuian)", speciesId: "samurott_hisuian", formBadge: "Hisuian", types: ["water", "dark"], fastMove: "Snarl", chargedMove1: "Icy Wind", chargedMove2: "Dark Pulse", hasShadow: false },
  { base: "decidueye", name: "Decidueye", speciesId: "decidueye", formBadge: "Alola", types: ["grass", "ghost"], fastMove: "Astonish", chargedMove1: "Frenzy Plant", chargedMove2: "Spirit Shackle", hasShadow: false },
  { base: "decidueye", name: "Decidueye (Hisuian)", speciesId: "decidueye_hisuian", formBadge: "Hisuian", types: ["grass", "fighting"], fastMove: "Psycho Cut", chargedMove1: "Aura Sphere", chargedMove2: "Trailblaze", hasShadow: false },
  { base: "deoxys", name: "Deoxys (Defense)", speciesId: "deoxys_defense", formBadge: "Defense", types: ["psychic"], fastMove: "Counter", chargedMove1: "Rock Slide", chargedMove2: "Psycho Boost", hasShadow: false },
  { base: "deoxys", name: "Deoxys (Normal)", speciesId: "deoxys", formBadge: "Normal", types: ["psychic"], fastMove: "Zen Headbutt", chargedMove1: "Psycho Boost", chargedMove2: "Thunderbolt", hasShadow: false },
  { base: "deoxys", name: "Deoxys (Attack)", speciesId: "deoxys_attack", formBadge: "Attack", types: ["psychic"], fastMove: "Poison Jab", chargedMove1: "Psycho Boost", chargedMove2: "Dark Pulse", hasShadow: false },
  { base: "deoxys", name: "Deoxys (Speed)", speciesId: "deoxys_speed", formBadge: "Speed", types: ["psychic"], fastMove: "Zen Headbutt", chargedMove1: "Psycho Boost", chargedMove2: "Thunderbolt", hasShadow: false },
  { base: "urshifu", name: "Urshifu (Single Strike)", speciesId: "urshifu_single_strike", formBadge: "Single Strike", types: ["fighting", "dark"], fastMove: "Counter", chargedMove1: "Dynamic Punch", chargedMove2: "Payback", hasShadow: false },
  { base: "urshifu", name: "Urshifu (Rapid Strike)", speciesId: "urshifu_rapid_strike", formBadge: "Rapid Strike", types: ["fighting", "water"], fastMove: "Counter", chargedMove1: "Aqua Jet", chargedMove2: "Close Combat", hasShadow: false }
];

function extractBaseSpeciesKey(name: string, speciesId?: string, explicitBase?: string): string {
  if (explicitBase) return explicitBase.toLowerCase().trim();
  const cleanName = name
    .replace(/^Shadow\s+/i, "")
    .replace(/^Mega\s+/i, "")
    .replace(/^Primal\s+/i, "")
    .replace(/^(Alolan|Galarian|Hisuian|Paldean|Kanto|Johto|Hoenn|Sinnoh|Unova|Kalos)\s+/i, "")
    .replace(/\s+\([^)]+\)/g, "")
    .replace(/\s+(X|Y)$/i, "")
    .trim()
    .toLowerCase();
  if (cleanName) return cleanName;
  return (speciesId || "").split("_")[0].toLowerCase();
}

/**
 * Returns autocomplete options for the Team Builder UI.
 * When typing a base species name (e.g., "giratina", "ninetales", "feraligatr", "zacian", "groudon"),
 * returns the Base Form, all Alternate Forms (Alolan, Galarian, Hisuian, Origin, Crowned, Mega, Primal, etc.),
 * and Shadow variants so the user can pick any variant from the pop-down menu.
 */
export function getPokemonAutocompleteSuggestions(
  rawQuery: string,
  league: LeagueType = "GREAT LEAGUE",
  limit: number = 24
): PokemonAutocompleteOption[] {
  const query = (rawQuery || "").trim().toLowerCase();
  if (!query) return [];

  const isTypingShadow = query.startsWith("shadow") || query.includes(" shadow");
  const strippedQuery = query.replace(/^shadow\s*/i, "").trim();
  const searchToken = strippedQuery || query;

  // Build unified pool of species from POKEMON_DATABASE + BUILTIN_REGIONAL_ALTERNATES
  const poolByName = new Map<string, PokemonAutocompleteOption>();

  const addOptionToPool = (opt: PokemonAutocompleteOption) => {
    const key = opt.name.toLowerCase();
    if (!poolByName.has(key)) {
      poolByName.set(key, opt);
    }
  };

  for (const p of Object.values(POKEMON_DATABASE)) {
    const isShadow = p.name.toLowerCase().startsWith("shadow ") || p.speciesId.toLowerCase().endsWith("_shadow");
    const baseSpecies = extractBaseSpeciesKey(p.name, p.speciesId, p.baseSpecies);
    const rec = getRecommendedMovesForPokemon(p.name, league);
    const isMegaOrPrimal = /^Mega\s+|^Primal\s+/i.test(p.name);
    const formBadge = isShadow
      ? p.formLabel
        ? `Shadow • ${p.formLabel}`
        : "Shadow"
      : p.formLabel
      ? p.formLabel
      : isMegaOrPrimal
      ? p.name.startsWith("Primal ")
        ? "Primal"
        : "Mega"
      : /^(Alolan|Galarian|Hisuian|Paldean)\s+/i.test(p.name)
      ? p.name.split(" ")[0]
      : "Base";

    const isAlternateForm = formBadge !== "Base" && formBadge !== "Shadow";

    addOptionToPool({
      name: p.name,
      speciesId: p.speciesId,
      baseSpecies,
      formBadge,
      types: p.types,
      cp: rec?.cp || 1500,
      fastMove: rec?.fastMove || p.defaultFastMove.name,
      chargedMove1: rec?.chargedMove1 || p.chargedMoves[0]?.name || "Charged 1",
      chargedMove2: rec?.chargedMove2 || p.chargedMoves[1]?.name || p.chargedMoves[0]?.name || "Charged 2",
      isShadow,
      isAlternateForm,
      score: rec?.score
    });

    // Also synthesize the Shadow option for non-Shadow, non-Mega/Primal Pokémon if not already in DB
    if (!isShadow && !isMegaOrPrimal) {
      const shadowName = `Shadow ${p.name}`;
      const shadowSpeciesId = `${p.speciesId}_shadow`;
      const shadowRec = getRecommendedMovesForPokemon(shadowName, league);
      addOptionToPool({
        name: shadowName,
        speciesId: shadowSpeciesId,
        baseSpecies,
        formBadge: p.formLabel ? `Shadow • ${p.formLabel}` : "Shadow",
        types: p.types,
        cp: shadowRec?.cp || rec?.cp || 1500,
        fastMove: shadowRec?.fastMove || rec?.fastMove || p.defaultFastMove.name,
        chargedMove1: shadowRec?.chargedMove1 || rec?.chargedMove1 || p.chargedMoves[0]?.name || "Charged 1",
        chargedMove2:
          shadowRec?.chargedMove2 ||
          rec?.chargedMove2 ||
          p.chargedMoves[1]?.name ||
          p.chargedMoves[0]?.name ||
          "Charged 2",
        isShadow: true,
        isAlternateForm,
        score: shadowRec?.score
      });
    }
  }

  for (const alt of BUILTIN_REGIONAL_ALTERNATES) {
    const defaultCp = league === "GREAT LEAGUE" ? 1496 : league === "ULTRA LEAGUE" ? 2492 : 3450;
    addOptionToPool({
      name: alt.name,
      speciesId: alt.speciesId,
      baseSpecies: alt.base,
      formBadge: alt.formBadge,
      types: alt.types,
      cp: defaultCp,
      fastMove: alt.fastMove,
      chargedMove1: alt.chargedMove1,
      chargedMove2: alt.chargedMove2,
      isShadow: false,
      isAlternateForm: alt.formBadge !== "Kanto" && alt.formBadge !== "Johto" && alt.formBadge !== "Unova" && alt.formBadge !== "Alola"
    });
    if (alt.hasShadow) {
      addOptionToPool({
        name: `Shadow ${alt.name}`,
        speciesId: `${alt.speciesId}_shadow`,
        baseSpecies: alt.base,
        formBadge: `Shadow • ${alt.formBadge}`,
        types: alt.types,
        cp: defaultCp,
        fastMove: alt.fastMove,
        chargedMove1: alt.chargedMove1,
        chargedMove2: alt.chargedMove2,
        isShadow: true,
        isAlternateForm: true
      });
    }
  }

  // 1. Identify all matched baseSpecies keys so typing a base form (e.g. "ninetales", "giratina", "feraligatr")
  // pulls in ALL alternate forms & Shadow options for that base species!
  // Strict disambiguation: "mew" must never pull in "mewtwo" and vice versa.
  const matchedBaseSpecies = new Set<string>();
  for (const opt of poolByName.values()) {
    const nameLower = opt.name.toLowerCase();
    const baseLower = opt.baseSpecies.toLowerCase();
    if (
      (searchToken === "mew" && baseLower === "mewtwo") ||
      (searchToken === "mewtwo" && baseLower === "mew")
    ) {
      continue;
    }
    if (
      baseLower.startsWith(searchToken) ||
      baseLower.includes(searchToken) ||
      nameLower.includes(searchToken)
    ) {
      matchedBaseSpecies.add(baseLower);
    }
  }

  const results: PokemonAutocompleteOption[] = [];
  for (const opt of poolByName.values()) {
    const baseLower = opt.baseSpecies.toLowerCase();
    if (
      (searchToken === "mew" && baseLower === "mewtwo") ||
      (searchToken === "mewtwo" && baseLower === "mew")
    ) {
      continue;
    }
    const inMatchedFamily = matchedBaseSpecies.has(baseLower);
    const directMatch = opt.name.toLowerCase().includes(query);
    if (!inMatchedFamily && !directMatch) continue;
    results.push(opt);
  }

  // Sort so exact/prefix base matches come first, grouping Base -> Alternate Forms -> Shadow Forms cleanly
  results.sort((a, b) => {
    const aBaseStarts = a.baseSpecies.startsWith(searchToken) ? 0 : 1;
    const bBaseStarts = b.baseSpecies.startsWith(searchToken) ? 0 : 1;
    if (aBaseStarts !== bBaseStarts) return aBaseStarts - bBaseStarts;

    if (a.baseSpecies !== b.baseSpecies) {
      return a.baseSpecies.localeCompare(b.baseSpecies);
    }

    // If user explicitly typed "shadow", show Shadow variants first within the family
    if (isTypingShadow) {
      if (a.isShadow !== b.isShadow) return a.isShadow ? -1 : 1;
    } else {
      // Otherwise show Base -> Alternate Forms -> Shadow Base -> Shadow Alternate
      if (a.isShadow !== b.isShadow) return a.isShadow ? 1 : -1;
    }

    if (a.isAlternateForm !== b.isAlternateForm) {
      return a.isAlternateForm ? 1 : -1;
    }

    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

/**
 * Resolves PvPoke recommended Fast Move, Charged Move 1, Charged Move 2, and default CP for a Pokémon name,
 * prioritizing live rankings JSON moves (moves.fastMoves & moves.chargedMoves) when available.
 */
export function getRecommendedMovesForPokemon(
  rawName: string,
  league: string = "GREAT LEAGUE",
  customIvs?: string
): {
  name: string;
  cp: number;
  fastMove: string;
  chargedMove1: string;
  chargedMove2: string;
  defaultIvs: string;
  score?: number;
} | null {
  const trimmed = (rawName || "").trim();
  if (!trimmed) return null;
  const cleanName = trimmed.replace(/^Shadow\s+/i, "").trim();
  const entries = Object.values(POKEMON_DATABASE);

  const exact =
    POKEMON_DATABASE[trimmed] ||
    POKEMON_DATABASE[cleanName] ||
    entries.find(
      (p) =>
        p.name.toLowerCase() === trimmed.toLowerCase() ||
        p.name.toLowerCase() === cleanName.toLowerCase() ||
        p.speciesId.toLowerCase() === cleanName.toLowerCase().replace(/\s+/g, "_")
    );

  if (!exact) {
    const builtinAlt = BUILTIN_REGIONAL_ALTERNATES.find(
      (a) => a.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (builtinAlt) {
      const ivTuple = parseIvTriplet(customIvs, league);
      const defaultCp = league.includes("GREAT") ? 1496 : league.includes("ULTRA") ? 2492 : 3450;
      return {
        name: trimmed.toLowerCase().startsWith("shadow ") ? `Shadow ${builtinAlt.name}` : builtinAlt.name,
        cp: defaultCp,
        fastMove: builtinAlt.fastMove,
        chargedMove1: builtinAlt.chargedMove1,
        chargedMove2: builtinAlt.chargedMove2,
        defaultIvs: `${ivTuple[0]}/${ivTuple[1]}/${ivTuple[2]}`
      };
    }
  }

  const partial =
    exact ||
    entries.find(
      (p) =>
        p.name.toLowerCase().includes(cleanName.toLowerCase()) ||
        (p.baseSpecies && cleanName.toLowerCase().includes(p.baseSpecies.toLowerCase()))
    );

  if (!partial) return null;

  const scaled = computeEffectiveStatsForLeague(partial, league, undefined, customIvs);
  const ivTuple = parseIvTriplet(customIvs, league);

  const leagueMap = LIVE_RANKINGS_MAP[league.toUpperCase()];
  const isShadowInput = trimmed.toLowerCase().startsWith("shadow ");
  const rankingEntry = isShadowInput
    ? leagueMap?.get(`${partial.speciesId.toLowerCase()}_shadow`) ||
      leagueMap?.get(partial.speciesId.toLowerCase())
    : leagueMap?.get(partial.speciesId.toLowerCase()) ||
      leagueMap?.get(`${partial.speciesId.toLowerCase()}_shadow`);

  const isSkeledirge =
    partial.baseSpecies?.toLowerCase() === "skeledirge" ||
    partial.speciesId.toLowerCase().startsWith("skeledirge");

  const topFastId = rankingEntry?.moveset?.[0] || rankingEntry?.moves.fastMoves[0]?.moveId;
  const orderedChargedNames: string[] = [];
  if (rankingEntry?.moveset && rankingEntry.moveset.length > 1) {
    for (const mId of rankingEntry.moveset.slice(1)) {
      const formatted = formatMoveIdToDisplayName(mId);
      if (formatted && !orderedChargedNames.some((n) => n.toLowerCase() === formatted.toLowerCase())) {
        orderedChargedNames.push(formatted);
      }
    }
  }
  if (rankingEntry?.moves.chargedMoves) {
    for (const cm of rankingEntry.moves.chargedMoves) {
      const formatted = formatMoveIdToDisplayName(cm.moveId);
      if (formatted && !orderedChargedNames.some((n) => n.toLowerCase() === formatted.toLowerCase())) {
        orderedChargedNames.push(formatted);
      }
    }
  }

  const resolvedFast = topFastId
    ? formatMoveIdToDisplayName(topFastId)
    : scaled.defaultFastMove?.name || partial.defaultFastMove?.name || "Fast Move";
  const resolvedC1 = isSkeledirge
    ? "Torch Song"
    : orderedChargedNames[0] || scaled.chargedMoves[0]?.name || partial.chargedMoves[0]?.name || "Charged 1";
  const resolvedC2 = isSkeledirge
    ? "Shadow Ball"
    : orderedChargedNames[1] ||
      scaled.chargedMoves[1]?.name ||
      partial.chargedMoves[1]?.name ||
      partial.chargedMoves[0]?.name ||
      "Charged 2";

  const finalDisplayName =
    isShadowInput && !partial.name.toLowerCase().startsWith("shadow ")
      ? `Shadow ${partial.name}`
      : partial.name;

  return {
    name: finalDisplayName,
    cp: scaled.resolvedCp,
    fastMove: resolvedFast,
    chargedMove1: resolvedC1,
    chargedMove2: resolvedC2,
    defaultIvs: `${ivTuple[0]}/${ivTuple[1]}/${ivTuple[2]}`,
    score: rankingEntry?.score
  };
}

/**
 * Returns the PvPoke Top 3 rated Pokémon template for a given league.
 */
export function getLeagueTop3Template(
  league: LeagueType
): TeamMember[] {
  if (league === "MEGA MASTER LEAGUE") {
    return [
      {
        id: "m1",
        name: "Mega Rayquaza",
        cp: 5728,
        fastMove: "Dragon Tail",
        chargedMove1: "Breaking Swipe",
        chargedMove2: "Dragon Ascent"
      },
      {
        id: "m2",
        name: "Primal Groudon",
        cp: 5910,
        fastMove: "Mud Shot",
        chargedMove1: "Precipice Blades",
        chargedMove2: "Fire Punch"
      },
      {
        id: "m3",
        name: "Primal Kyogre",
        cp: 5910,
        fastMove: "Waterfall",
        chargedMove1: "Origin Pulse",
        chargedMove2: "Surf"
      }
    ];
  }
  if (league === "GREAT LEAGUE") {
    return [
      {
        id: "g1",
        name: "Clodsire",
        cp: 1494,
        fastMove: "Poison Sting",
        chargedMove1: "Earthquake",
        chargedMove2: "Stone Edge"
      },
      {
        id: "g2",
        name: "Feraligatr",
        cp: 1498,
        fastMove: "Shadow Claw",
        chargedMove1: "Hydro Cannon",
        chargedMove2: "Ice Beam"
      },
      {
        id: "g3",
        name: "Mandibuzz",
        cp: 1496,
        fastMove: "Snarl",
        chargedMove1: "Dark Pulse",
        chargedMove2: "Aerial Ace"
      }
    ];
  }
  if (league === "ULTRA LEAGUE") {
    return [
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
        name: "Feraligatr",
        cp: 2488,
        fastMove: "Shadow Claw",
        chargedMove1: "Hydro Cannon",
        chargedMove2: "Ice Beam"
      },
      {
        id: "u3",
        name: "Giratina (Altered)",
        cp: 2497,
        fastMove: "Shadow Claw",
        chargedMove1: "Dragon Claw",
        chargedMove2: "Ancient Power"
      }
    ];
  }
  return [
    {
      id: "p1",
      name: "Palkia (Origin)",
      cp: 4683,
      fastMove: "Dragon Breath",
      chargedMove1: "Spacial Rend",
      chargedMove2: "Aqua Tail"
    },
    {
      id: "p2",
      name: "Zacian (Crowned)",
      cp: 4658,
      fastMove: "Metal Claw",
      chargedMove1: "Behemoth Blade",
      chargedMove2: "Close Combat"
    },
    {
      id: "p3",
      name: "Dialga (Origin)",
      cp: 4624,
      fastMove: "Dragon Breath",
      chargedMove1: "Roar of Time",
      chargedMove2: "Iron Head"
    }
  ];
}

export type OppCountMode = "my_fasts" | "opp_fasts";

export interface TapNodeInfo {
  tap: number;
  label: string;
  state: "safe" | "leak" | "catch" | "cmp" | "uncharged" | "cmp-loss";
  isCatchOrCmp: boolean;
}

export interface BenchThreatInfo {
  name: string;
  dmgPct: number;
  eff: number;
  tier: "resist" | "neutral" | "weak";
}

export interface TeamDamageCell {
  name: string;
  code: string;
  dmgPct: number;
  eff: number;
  tier: "resist" | "neutral" | "weak";
  isActive: boolean;
  isEmpty?: boolean;
}

export interface MoveCycleSegment {
  cycleIndex: number;
  startTurn: number;
  readyTurn: number;
  turnSpan: number;
  widthPct: number;
  startTap: number;
  readyTap: number;
  rangeLabel: string;
  readyLabel: string;
  hasZeroSneak: boolean;
  readyState: "cmp" | "catch" | "cmp-loss" | "safe";
}

export interface OpponentMoveTimingRow {
  name: string;
  shortName: string;
  code: string;
  energy: number;
  oppFasts: number;
  oppReadyTurn: number;
  myTapAtReady: number;
  displayReadyCount: number;
  myCapTap: number;
  coAligned: boolean;
  winsCmp: boolean;
  activeName: string;
  activeDmgPct: number;
  activeEff: number;
  safeRangeLabel: string;
  maxHorizonTurns: number;
  cycles: MoveCycleSegment[];
  tapNodes: TapNodeInfo[];
  bench: BenchThreatInfo[];
  teamDamages: TeamDamageCell[];
}

export interface MyMoveTimingRow {
  name: string;
  shortName: string;
  energy: number;
  myTapsNeeded: number;
  myReadyTurn: number;
  dmgPct: number;
  eff: number;
  state: "safe" | "cmp" | "cmp-loss" | "catch";
  safeThrowLabel: string;
  hasZeroSneak: boolean;
  maxHorizonTurns: number;
  cycles: MoveCycleSegment[];
  tapNodes: TapNodeInfo[];
  oppDamages: TeamDamageCell[];
}

function abbrPokeCode3(name: string): string {
  if (!name) return "---";
  return name
    .replace(/^Shadow\s+/i, "")
    .replace(/^Kanto\s+/i, "")
    .replace(/^Alolan\s+/i, "")
    .replace(/^Galarian\s+/i, "")
    .replace(/^Hisuian\s+/i, "")
    .split(" ")[0]
    .slice(0, 3)
    .toUpperCase();
}

/**
 * Helper to compute the shared maximum 1st-throw turn horizon across all 5 moves (Opponent's 3 + Player's 2)
 */
export function computeSharedHorizonTurns(
  oppStats: PokemonStats,
  userStats: PokemonStats,
  userCustomChargedMoves: string[] | undefined,
  userFastMove: FastMove,
  enable4ChargedMoves: boolean = false
): number {
  const oppFastMove = resolveFastMove(oppStats);
  const oppFastTurns = oppFastMove.turns || 2;
  const oppFastEnergy = oppFastMove.energyGain || oppFastTurns * 4;

  const userFastTurns = userFastMove.turns || 2;
  const userFastEnergy = userFastMove.energyGain || userFastTurns * 4;

  const oppFirstReadyTurns = oppStats.chargedMoves.slice(0, enable4ChargedMoves ? 4 : 3).map((cm) => {
    const mEnergy = cm.energyCost || 50;
    const fasts = Math.max(1, Math.ceil(mEnergy / oppFastEnergy));
    return fasts * oppFastTurns;
  });

  const userMovesList =
    userCustomChargedMoves && userCustomChargedMoves.length > 0
      ? userCustomChargedMoves
      : userStats.chargedMoves.slice(0, 2).map((m) => m.name);

  const userFirstReadyTurns = userMovesList.map((mName, idx) => {
    const existing =
      userStats.chargedMoves.find((m) => m.name.toLowerCase() === mName.toLowerCase()) ||
      userStats.chargedMoves[idx];
    const mEnergy = existing?.energyCost || 50;
    const fasts = Math.max(1, Math.ceil(mEnergy / userFastEnergy));
    return fasts * userFastTurns;
  });

  return Math.max(4, ...oppFirstReadyTurns, ...userFirstReadyTurns);
}

/**
 * Computes per-move timing, catch/CMP windows, turn-aligned multi-cycle segments,
 * and 3-column team threat rows.
 */
export function calculateOpponentMoveTimingRows(
  oppStatsRaw: PokemonStats,
  userLeadName: string,
  teamNames: string[],
  isOppShadow: boolean = false,
  userFastTurnsOverride?: number,
  userFastMoveNameOverride?: string,
  userCustomChargedMoves?: string[],
  oppCountMode: OppCountMode = "my_fasts",
  league: string = "MASTER LEAGUE",
  teamMembers?: TeamMember[],
  enable4ChargedMoves: boolean = false
): { rows: OpponentMoveTimingRow[]; winsCmp: boolean; userFastTurns: number; maxHorizonTurns: number } {
  const oppStats = computeEffectiveStatsForLeague(oppStatsRaw, league);
  const cleanUserName = userLeadName.replace(/^Shadow\s+/i, "").trim();
  const rawUserStats =
    POKEMON_DATABASE[userLeadName] ||
    POKEMON_DATABASE[cleanUserName] ||
    Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanUserName.toLowerCase()) ||
    Object.values(POKEMON_DATABASE)[0];
  const activeMember = teamMembers?.find((m) => m.name.toLowerCase() === userLeadName.toLowerCase());
  const userStats = computeEffectiveStatsForLeague(rawUserStats, league, activeMember?.cp, activeMember?.ivs);

  const isUserShadow = userLeadName.toLowerCase().startsWith("shadow ");
  const resolvedUserFast = resolveFastMove(userStats, userFastMoveNameOverride);
  const userFastTurns = userFastTurnsOverride || resolvedUserFast.turns || 2;
  const oppFastMove = resolveFastMove(oppStats);
  const oppFastTurns = oppFastMove.turns || 2;
  const oppFastEnergy = oppFastMove.energyGain || oppFastTurns * 4;
  const winsCmp = userStats.baseStats.atk >= oppStats.baseStats.atk;

  const maxHorizonTurns = computeSharedHorizonTurns(
    oppStats,
    userStats,
    userCustomChargedMoves,
    {
      ...resolvedUserFast,
      turns: userFastTurns
    },
    enable4ChargedMoves
  );

  const benchNames = teamNames.filter((n) => n.toLowerCase() !== userLeadName.toLowerCase()).slice(0, 2);

  const rows: OpponentMoveTimingRow[] = oppStats.chargedMoves.slice(0, enable4ChargedMoves ? 4 : 3).map((cm) => {
    const mEnergy = cm.energyCost || 50;
    const oppFasts = Math.max(1, Math.ceil(mEnergy / oppFastEnergy));
    const oppReadyTurn = oppFasts * oppFastTurns;

    const myTapAtReady = Math.max(1, Math.ceil(oppReadyTurn / userFastTurns));
    const displayReadyCount = oppCountMode === "opp_fasts" ? oppFasts : myTapAtReady;
    const myCapTap = Math.max(myTapAtReady + 1, Math.ceil((oppReadyTurn * 2) / userFastTurns));
    const coAligned = oppReadyTurn % userFastTurns === 0;

    // Multi-cycle calculation using true PvPoke residual energy up to maxHorizonTurns
    const cycles: MoveCycleSegment[] = [];
    let leftoverEnergy = 0;
    let cumOppFasts = 0;
    let prevTurn = 0;
    let prevDisplayTap = 0;

    for (let cycleIdx = 1; cycleIdx <= 3; cycleIdx++) {
      const energyNeeded = Math.max(1, mEnergy - leftoverEnergy);
      const fastsInCycle = Math.max(1, Math.ceil(energyNeeded / oppFastEnergy));
      leftoverEnergy = leftoverEnergy + fastsInCycle * oppFastEnergy - mEnergy;
      cumOppFasts += fastsInCycle;
      const readyTurn = cumOppFasts * oppFastTurns;

      if (cycleIdx > 1 && readyTurn > maxHorizonTurns) {
        break;
      }

      const turnSpan = Math.max(1, readyTurn - prevTurn);
      const widthPct = Math.min(100, Math.max(8, Number(((turnSpan / maxHorizonTurns) * 100).toFixed(2))));

      const readyTap =
        oppCountMode === "opp_fasts"
          ? cumOppFasts
          : Math.max(prevDisplayTap + 1, Math.ceil(readyTurn / userFastTurns));
      const startTap = prevDisplayTap + 1;
      const rangeEnd = readyTap - 1;

      let rangeLabel = "";
      if (readyTap > startTap) {
        rangeLabel = rangeEnd === startTap ? `${startTap}` : `${startTap}–${rangeEnd}`;
      }

      cycles.push({
        cycleIndex: cycleIdx,
        startTurn: prevTurn,
        readyTurn,
        turnSpan,
        widthPct,
        startTap,
        readyTap,
        rangeLabel,
        readyLabel: `#${readyTap}`,
        hasZeroSneak: false,
        readyState: winsCmp ? "cmp" : "catch"
      });

      prevTurn = readyTurn;
      prevDisplayTap = readyTap;
    }

    const actvDmg = calculateChargedDamage(oppStats, userStats, cm, isOppShadow, isUserShadow);
    const activeDmgPct = actvDmg.percentage;
    const activeEff = actvDmg.mult;

    // All 3 team Pokemon in fixed team slot order [0, 1, 2]
    const teamDamages: TeamDamageCell[] = [0, 1, 2].map((slotIdx) => {
      const tName = teamNames[slotIdx] || "";
      if (!tName) {
        return {
          name: "—",
          code: "—",
          dmgPct: 0,
          eff: 1.0,
          tier: "neutral",
          isActive: false,
          isEmpty: true
        };
      }
      const cleanT = tName.replace(/^Shadow\s+/i, "").trim();
      const rawTStats =
        POKEMON_DATABASE[tName] ||
        POKEMON_DATABASE[cleanT] ||
        Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanT.toLowerCase()) ||
        Object.values(POKEMON_DATABASE)[0];
      const slotMember = teamMembers?.[slotIdx];
      const tStats = computeEffectiveStatsForLeague(rawTStats, league, slotMember?.cp, slotMember?.ivs);
      const isTShadow = tName.toLowerCase().startsWith("shadow ");
      const tDmg = calculateChargedDamage(oppStats, tStats, cm, isOppShadow, isTShadow);
      const tier: "resist" | "neutral" | "weak" =
        tDmg.percentage <= 35 ? "resist" : tDmg.percentage >= 60 || tDmg.mult >= 1.5 ? "weak" : "neutral";
      const isActive = tName.toLowerCase() === userLeadName.toLowerCase();
      return {
        name: tName,
        code: abbrPokeCode3(tName),
        dmgPct: tDmg.percentage,
        eff: tDmg.mult,
        tier,
        isActive
      };
    });

    const bench: BenchThreatInfo[] = benchNames.map((bName) => {
      const cleanB = bName.replace(/^Shadow\s+/i, "").trim();
      const rawBStats =
        POKEMON_DATABASE[bName] ||
        POKEMON_DATABASE[cleanB] ||
        Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanB.toLowerCase()) ||
        Object.values(POKEMON_DATABASE)[0];
      const benchMember = teamMembers?.find((m) => m.name.toLowerCase() === bName.toLowerCase());
      const bStats = computeEffectiveStatsForLeague(rawBStats, league, benchMember?.cp, benchMember?.ivs);
      const isBShadow = bName.toLowerCase().startsWith("shadow ");
      const bDmg = calculateChargedDamage(oppStats, bStats, cm, isOppShadow, isBShadow);
      const tier: "resist" | "neutral" | "weak" =
        bDmg.percentage <= 35 ? "resist" : bDmg.percentage >= 65 || bDmg.mult >= 1.5 ? "weak" : "neutral";
      return {
        name: bName,
        dmgPct: bDmg.percentage,
        eff: bDmg.mult,
        tier
      };
    });

    const maxNode = displayReadyCount;
    const tapNodes: TapNodeInfo[] = [];
    for (let k = 1; k <= maxNode; k++) {
      let state: "safe" | "leak" | "catch" | "cmp";
      if (k === maxNode) {
        state = winsCmp ? "cmp" : "catch";
      } else if ((k * userFastTurns) % oppFastTurns !== 0) {
        state = "safe";
      } else {
        state = "leak";
      }
      tapNodes.push({
        tap: k,
        label: `${k}`,
        state,
        isCatchOrCmp: k === maxNode
      });
    }

    const safeEnd = Math.max(1, displayReadyCount - 1);
    const safeRangeLabel = safeEnd <= 1 ? "1" : `1–${safeEnd}`;

    return {
      name: cm.name,
      shortName: abbrMove5(cm.name),
      code: cm.code,
      energy: mEnergy,
      oppFasts,
      oppReadyTurn,
      myTapAtReady,
      displayReadyCount,
      myCapTap,
      coAligned,
      winsCmp,
      activeName: userLeadName,
      activeDmgPct,
      activeEff,
      safeRangeLabel,
      maxHorizonTurns,
      cycles,
      tapNodes,
      bench,
      teamDamages
    };
  });

  return { rows, winsCmp, userFastTurns, maxHorizonTurns };
}

/**
 * Computes player's charged move timing rows with turn-aligned multi-cycle segments,
 * leak-free safe throw numbers, and 3-column opponent damage matrix.
 */
export function calculateMyMoveTimingRows(
  userLeadName: string,
  oppStatsRaw: PokemonStats,
  customMoves: string[],
  oppReadyTaps: number[],
  isOppShadow: boolean = false,
  userFastTurnsOverride?: number,
  userFastMoveNameOverride?: string,
  scannedOpponentNames: string[] = [],
  sharedHorizonTurnsOverride?: number,
  league: string = "MASTER LEAGUE",
  activeUserMember?: TeamMember,
  enable4ChargedMoves: boolean = false
): MyMoveTimingRow[] {
  const oppStats = computeEffectiveStatsForLeague(oppStatsRaw, league);
  const cleanUserName = userLeadName.replace(/^Shadow\s+/i, "").trim();
  const rawUserStats =
    POKEMON_DATABASE[userLeadName] ||
    POKEMON_DATABASE[cleanUserName] ||
    Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanUserName.toLowerCase()) ||
    Object.values(POKEMON_DATABASE)[0];
  const userStats = computeEffectiveStatsForLeague(
    rawUserStats,
    league,
    activeUserMember?.cp,
    activeUserMember?.ivs
  );

  const isUserShadow = userLeadName.toLowerCase().startsWith("shadow ");
  const resolvedUserFast = resolveFastMove(userStats, userFastMoveNameOverride);
  const userFastTurns = userFastTurnsOverride || resolvedUserFast.turns || 2;
  const userFastEnergy = resolvedUserFast.energyGain || userFastTurns * 4;
  const oppFastMove = resolveFastMove(oppStats);
  const oppFastTurns = oppFastMove.turns || 2;
  const oppFastEnergy = oppFastMove.energyGain || oppFastTurns * 4;
  const winsCmp = userStats.baseStats.atk >= oppStats.baseStats.atk;
  const maxOppTap = oppReadyTaps.length > 0 ? Math.max(...oppReadyTaps) : 4;

  const maxHorizonTurns =
    sharedHorizonTurnsOverride ||
    computeSharedHorizonTurns(
      oppStats,
      userStats,
      customMoves,
      {
        ...resolvedUserFast,
        turns: userFastTurns
      },
      enable4ChargedMoves
    );

  // Compute all opponent ready turns (across up to 3 cycles) for CMP tie detection
  const oppReadyTurnsSet = new Set<number>();
  oppStats.chargedMoves.slice(0, enable4ChargedMoves ? 4 : 3).forEach((cm) => {
    const mE = cm.energyCost || 50;
    let leftE = 0;
    let cumF = 0;
    for (let c = 1; c <= 3; c++) {
      const needE = Math.max(1, mE - leftE);
      const f = Math.max(1, Math.ceil(needE / oppFastEnergy));
      leftE = leftE + f * oppFastEnergy - mE;
      cumF += f;
      oppReadyTurnsSet.add(cumF * oppFastTurns);
    }
  });

  const oppSlots = scannedOpponentNames.length > 0 ? scannedOpponentNames : [oppStats.name];

  return customMoves.map((mName) => {
    const existing = buildChargedMoveFromName(mName, userStats.types[0], userStats.chargedMoves);

    const mEnergy = existing.energyCost || 50;
    const myTapsNeeded = Math.max(1, Math.ceil(mEnergy / userFastEnergy));
    const myReadyTurn = myTapsNeeded * userFastTurns;
    const actvDmg = calculateChargedDamage(userStats, oppStats, existing, isUserShadow, isOppShadow);

    // Multi-cycle calculation using true PvPoke residual energy up to maxHorizonTurns
    const cycles: MoveCycleSegment[] = [];
    let leftoverEnergy = 0;
    let cumMyFasts = 0;
    let prevTurn = 0;
    let prevDisplayTap = 0;

    for (let cycleIdx = 1; cycleIdx <= 3; cycleIdx++) {
      const energyNeeded = Math.max(1, mEnergy - leftoverEnergy);
      const fastsInCycle = Math.max(1, Math.ceil(energyNeeded / userFastEnergy));
      leftoverEnergy = leftoverEnergy + fastsInCycle * userFastEnergy - mEnergy;
      cumMyFasts += fastsInCycle;
      const readyTurn = cumMyFasts * userFastTurns;

      if (cycleIdx > 1 && readyTurn > maxHorizonTurns) {
        break;
      }

      const turnSpan = Math.max(1, readyTurn - prevTurn);
      const widthPct = Math.min(100, Math.max(8, Number(((turnSpan / maxHorizonTurns) * 100).toFixed(2))));

      const readyTap = cumMyFasts;
      const startTap = prevDisplayTap + 1;
      const rangeEnd = readyTap - 1;

      const cycleSafeTaps: number[] = [];
      for (let k = startTap; k <= rangeEnd; k++) {
        if ((k * userFastTurns) % oppFastTurns !== 0) {
          cycleSafeTaps.push(k);
        }
      }
      const cycleHasZeroSneak = cycleSafeTaps.length > 0;

      let rangeLabel = "";
      if (readyTap > startTap) {
        if (cycleHasZeroSneak) {
          rangeLabel = `Safe ${cycleSafeTaps.slice(0, 3).join(",")}`;
        } else {
          rangeLabel = rangeEnd === startTap ? `${startTap}` : `${startTap}–${rangeEnd}`;
        }
      }

      const isCmpTurn = oppReadyTurnsSet.has(readyTurn) || oppReadyTaps.includes(readyTap);
      const cycleReadyState: "safe" | "cmp" | "cmp-loss" = isCmpTurn
        ? winsCmp
          ? "cmp"
          : "cmp-loss"
        : "safe";

      cycles.push({
        cycleIndex: cycleIdx,
        startTurn: prevTurn,
        readyTurn,
        turnSpan,
        widthPct,
        startTap,
        readyTap,
        rangeLabel,
        readyLabel: `#${readyTap}`,
        hasZeroSneak: cycleHasZeroSneak,
        readyState: cycleReadyState
      });

      prevTurn = readyTurn;
      prevDisplayTap = readyTap;
    }

    const oppDamages: TeamDamageCell[] = [0, 1, 2].map((slotIdx) => {
      const oName = oppSlots[slotIdx] || "";
      if (!oName) {
        return {
          name: "—",
          code: "—",
          dmgPct: 0,
          eff: 1.0,
          tier: "neutral",
          isActive: slotIdx === 0,
          isEmpty: true
        };
      }
      const cleanO = oName.replace(/^Shadow\s+/i, "").trim();
      const rawOStats =
        POKEMON_DATABASE[oName] ||
        POKEMON_DATABASE[cleanO] ||
        Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanO.toLowerCase()) ||
        oppStats;
      const oStats = computeEffectiveStatsForLeague(rawOStats, league);
      const isOShadow = (slotIdx === 0 && isOppShadow) || oName.toLowerCase().startsWith("shadow ");
      const oDmg = calculateChargedDamage(userStats, oStats, existing, isUserShadow, isOShadow);
      const tier: "resist" | "neutral" | "weak" =
        oDmg.percentage >= 60 || oDmg.mult >= 1.5
          ? "resist"
          : oDmg.percentage <= 35
          ? "weak"
          : "neutral";
      return {
        name: oName,
        code: abbrPokeCode3(oName),
        dmgPct: oDmg.percentage,
        eff: oDmg.mult,
        tier,
        isActive: slotIdx === 0
      };
    });

    const maxNode = Math.min(7, Math.max(myTapsNeeded, maxOppTap));
    const tapNodes: TapNodeInfo[] = [];
    for (let k = 1; k <= maxNode; k++) {
      let state: "safe" | "cmp" | "cmp-loss" | "uncharged";
      if (k < myTapsNeeded) {
        state = "uncharged";
      } else if (oppReadyTaps.includes(k)) {
        state = winsCmp ? "cmp" : "cmp-loss";
      } else {
        state = "safe";
      }
      tapNodes.push({
        tap: k,
        label: `${k}`,
        state,
        isCatchOrCmp: k === myTapsNeeded
      });
    }

    const firstCycle = cycles[0];
    const readyState = firstCycle ? firstCycle.readyState : "safe";
    const hasZeroSneak = firstCycle ? firstCycle.hasZeroSneak : false;
    const safeThrowLabel = firstCycle ? firstCycle.rangeLabel : myTapsNeeded <= 1 ? "1" : `1–${myTapsNeeded - 1}`;

    return {
      name: mName,
      shortName: abbrMove5(mName),
      energy: mEnergy,
      myTapsNeeded,
      myReadyTurn,
      dmgPct: actvDmg.percentage,
      eff: actvDmg.mult,
      state: readyState,
      safeThrowLabel,
      hasZeroSneak,
      maxHorizonTurns,
      cycles,
      tapNodes,
      oppDamages
    };
  });
}

export interface MatchupTierThresholds {
  swMin: number;
  wMin: number;
  lMax: number;
  slMax: number;
}

export const DEFAULT_MATCHUP_TIER_THRESHOLDS: MatchupTierThresholds = {
  swMin: 620,
  wMin: 530,
  lMax: 470,
  slMax: 380
};

export const MATCHUP_TIER_THRESHOLDS_STORAGE_KEY = "gbl_matchup_tier_thresholds_v1";

export function getStoredMatchupTierThresholds(): MatchupTierThresholds {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return { ...DEFAULT_MATCHUP_TIER_THRESHOLDS };
    }
    const raw = window.localStorage.getItem(MATCHUP_TIER_THRESHOLDS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MATCHUP_TIER_THRESHOLDS };
    const parsed = JSON.parse(raw);
    const slMax = Math.max(100, Math.min(800, Number(parsed?.slMax) || DEFAULT_MATCHUP_TIER_THRESHOLDS.slMax));
    const lMax = Math.max(slMax + 1, Math.min(850, Number(parsed?.lMax) || DEFAULT_MATCHUP_TIER_THRESHOLDS.lMax));
    const wMin = Math.max(lMax + 1, Math.min(900, Number(parsed?.wMin) || DEFAULT_MATCHUP_TIER_THRESHOLDS.wMin));
    const swMin = Math.max(wMin + 1, Math.min(950, Number(parsed?.swMin) || DEFAULT_MATCHUP_TIER_THRESHOLDS.swMin));
    return { swMin, wMin, lMax, slMax };
  } catch {
    return { ...DEFAULT_MATCHUP_TIER_THRESHOLDS };
  }
}

/**
 * Computes 5-tier 0s/1s/2s matchup codes ("SW,W,N,L,SL"):
 * - SW = Strong Win (rating >= swMin, default 620)
 * - W  = Win (wMin <= rating < swMin, default 530 <= rating < 620)
 * - N  = Neutral / Grey (lMax < rating < wMin, default 470 < rating < 530)
 * - L  = Loss (slMax < rating <= lMax, default 380 < rating <= 470)
 * - SL = Strong Loss (rating <= slMax, default <= 380)
 */
export function calculateShieldMatrix(
  oppName: string,
  teamMembers: string[],
  isOppShadow: boolean = false,
  league: string = "MASTER LEAGUE",
  customThresholds?: MatchupTierThresholds
): Record<string, string> {
  const thresholds = customThresholds || getStoredMatchupTierThresholds();
  const result: Record<string, string> = {};
  const effectiveOppShadow = isOppShadow || /^Shadow\s+/i.test(oppName) || oppName.toLowerCase().includes("(shadow)");
  const cleanOppName = oppName.replace(/^Shadow\s+/i, "").replace(/\s*\(Shadow\)/i, "").trim();
  const rawOppStats =
    POKEMON_DATABASE[oppName] ||
    POKEMON_DATABASE[cleanOppName] ||
    Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanOppName.toLowerCase()) ||
    Object.values(POKEMON_DATABASE)[0];
  const oppStats = computeEffectiveStatsForLeague(rawOppStats, league, undefined, undefined, effectiveOppShadow);

    teamMembers.forEach((member, idx) => {
    const key = `p${idx + 1}`;
    const rating0s = evaluateDiscreteShieldBattleRating(member, effectiveOppShadow ? `Shadow ${cleanOppName}` : cleanOppName, 0, 0, league);
    const rating1s = evaluateDiscreteShieldBattleRating(member, effectiveOppShadow ? `Shadow ${cleanOppName}` : cleanOppName, 1, 1, league);
    const rating2s = evaluateDiscreteShieldBattleRating(member, effectiveOppShadow ? `Shadow ${cleanOppName}` : cleanOppName, 2, 2, league);

    const toTier = (r: number): string => {
      if (r >= thresholds.swMin) return "SW";
      if (r >= thresholds.wMin) return "W";
      if (r > thresholds.lMax) return "N";
      if (r > thresholds.slMax) return "L";
      return "SL";
    };

    result[key] = `${toTier(rating0s)},${toTier(rating1s)},${toTier(rating2s)}`;
  });

  return result;
}

export interface MachineBrThresholds {
  eliteMin: number;
  solidMin: number;
  playableMin: number;
  riskyMin: number;
}

export const DEFAULT_MACHINE_BR_THRESHOLDS: MachineBrThresholds = {
  eliteMin: 650,
  solidMin: 610,
  playableMin: 580,
  riskyMin: 540
};

export const MACHINE_BR_THRESHOLDS_STORAGE_KEY = "gbl_machine_br_thresholds_v1";

export function getStoredMachineBrThresholds(): MachineBrThresholds {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      return { ...DEFAULT_MACHINE_BR_THRESHOLDS };
    }
    const raw = window.localStorage.getItem(MACHINE_BR_THRESHOLDS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_MACHINE_BR_THRESHOLDS };
    const parsed = JSON.parse(raw);
    const riskyMin = Math.max(350, Math.min(800, Number(parsed?.riskyMin) || DEFAULT_MACHINE_BR_THRESHOLDS.riskyMin));
    const playableMin = Math.max(riskyMin + 1, Math.min(850, Number(parsed?.playableMin) || DEFAULT_MACHINE_BR_THRESHOLDS.playableMin));
    const solidMin = Math.max(playableMin + 1, Math.min(900, Number(parsed?.solidMin) || DEFAULT_MACHINE_BR_THRESHOLDS.solidMin));
    const eliteMin = Math.max(solidMin + 1, Math.min(950, Number(parsed?.eliteMin) || DEFAULT_MACHINE_BR_THRESHOLDS.eliteMin));
    return { eliteMin, solidMin, playableMin, riskyMin };
  } catch {
    return { ...DEFAULT_MACHINE_BR_THRESHOLDS };
  }
}

export interface BrTierBadgeStyle {
  tier: string;
  label: string;
  colorHex: string;
  colorClass: string;
  badgeClass: string;
  textClass: string;
}

/**
 * Color codes single-slot aggregate ratings (Lead Agg BR, Safe Swap BR, Closer Swap BR)
 * using the 5-Tier Matchup Thresholds (SW / W / N / L / SL) configured in Settings.
 */
export function getSingleSlotBrTierInfo(
  rating: number,
  customThresholds?: MatchupTierThresholds
): BrTierBadgeStyle {
  const t = customThresholds || getStoredMatchupTierThresholds();
  const r = Math.round(Number.isFinite(rating) ? rating : 500);
  if (r >= t.swMin) {
    return {
      tier: "SW",
      label: "Strong Win",
      colorHex: "#10b981",
      colorClass: "text-emerald-300 bg-emerald-500/20 border-emerald-500/50",
      badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
      textClass: "text-emerald-400"
    };
  }
  if (r >= t.wMin) {
    return {
      tier: "W",
      label: "Favorable",
      colorHex: "#4ade80",
      colorClass: "text-green-300 bg-green-500/20 border-green-500/40",
      badgeClass: "bg-green-500/20 text-green-300 border-green-500/40",
      textClass: "text-green-400"
    };
  }
  if (r > t.lMax) {
    return {
      tier: "N",
      label: "Neutral",
      colorHex: "#94a3b8",
      colorClass: "text-slate-200 bg-slate-700/60 border-slate-500/40",
      badgeClass: "bg-slate-700/60 text-slate-200 border-slate-500/40",
      textClass: "text-slate-300"
    };
  }
  if (r > t.slMax) {
    return {
      tier: "L",
      label: "Unfavorable",
      colorHex: "#f87171",
      colorClass: "text-red-300 bg-red-500/20 border-red-500/40",
      badgeClass: "bg-red-500/20 text-red-300 border-red-500/40",
      textClass: "text-red-400"
    };
  }
  return {
    tier: "SL",
    label: "Strong Loss",
    colorHex: "#f43f5e",
    colorClass: "text-rose-300 bg-rose-600/25 border-rose-500/50",
    badgeClass: "bg-rose-600/25 text-rose-300 border-rose-500/50",
    textClass: "text-rose-400"
  };
}

/**
 * Color codes 3-Pokemon Machine Aggregate BR (theoretical alignment ceiling)
 * using the dedicated Machine Aggregate BR Thresholds from Settings.
 */
export function getMachineBrTierInfo(
  rating: number,
  customThresholds?: MachineBrThresholds
): BrTierBadgeStyle {
  const t = customThresholds || getStoredMachineBrThresholds();
  const r = Math.round(Number.isFinite(rating) ? rating : 600);
  if (r >= t.eliteMin) {
    return {
      tier: "ELITE",
      label: "Well-Rounded Core",
      colorHex: "#10b981",
      colorClass: "text-emerald-300 bg-emerald-500/20 border-emerald-500/50",
      badgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/50",
      textClass: "text-emerald-400"
    };
  }
  if (r >= t.solidMin) {
    return {
      tier: "SOLID",
      label: "Solid Coverage",
      colorHex: "#4ade80",
      colorClass: "text-green-300 bg-green-500/20 border-green-500/40",
      badgeClass: "bg-green-500/20 text-green-300 border-green-500/40",
      textClass: "text-green-400"
    };
  }
  if (r >= t.playableMin) {
    return {
      tier: "PLAYABLE",
      label: "Playable / Moderate Gaps",
      colorHex: "#fbbf24",
      colorClass: "text-amber-300 bg-amber-500/20 border-amber-500/45",
      badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/45",
      textClass: "text-amber-300"
    };
  }
  if (r >= t.riskyMin) {
    return {
      tier: "VULNERABLE",
      label: "Core Vulnerability",
      colorHex: "#fb923c",
      colorClass: "text-orange-300 bg-orange-500/20 border-orange-500/45",
      badgeClass: "bg-orange-500/20 text-orange-300 border-orange-500/45",
      textClass: "text-orange-400"
    };
  }
  return {
    tier: "BLINDSPOT",
    label: "Severe Blindspot",
    colorHex: "#f43f5e",
    colorClass: "text-rose-300 bg-rose-600/25 border-rose-500/50",
    badgeClass: "bg-rose-600/25 text-rose-300 border-rose-500/50",
    textClass: "text-rose-400"
  };
}

const ALL_18_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy"
] as const;

function resolveCombatPokemonForEngine(
  input: TeamMember | string,
  league: string = "GREAT LEAGUE"
): {
  stats: PokemonStats & { resolvedCp: number };
  isShadow: boolean;
  fastMove: FastMove;
  chargedMoves: ChargedMove[];
} {
  const rawName = typeof input === "string" ? input : input.name;
  const customCp = typeof input === "object" ? input.cp : undefined;
  const customIvs = typeof input === "object" ? input.ivs : undefined;
  const isShadow =
    /^Shadow\s+/i.test(rawName || "") ||
    (rawName || "").toLowerCase().includes("(shadow)");
  const cleanName = (rawName || "")
    .replace(/^Shadow\s+/i, "")
    .replace(/\s*\(Shadow\)/i, "")
    .trim();

  const dbValues = Object.values(POKEMON_DATABASE);
  const rawBase =
    POKEMON_DATABASE[rawName] ||
    POKEMON_DATABASE[cleanName] ||
    dbValues.find(
      (p) =>
        p.name.toLowerCase() === (rawName || "").toLowerCase() ||
        p.name.toLowerCase() === cleanName.toLowerCase() ||
        p.speciesId.toLowerCase() === cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "_")
    ) ||
    dbValues.find((p) => p.name.toLowerCase().includes(cleanName.toLowerCase())) ||
    dbValues[0];

  const rankedStats = applyRankingMovesToPokemonStats(rawBase, league, isShadow);
  const effectiveStats = computeEffectiveStatsForLeague(
    rankedStats,
    league,
    customCp,
    customIvs,
    isShadow
  );

  const customFastName = typeof input === "object" ? input.fastMove : undefined;
  const fastMove = resolveFastMove(effectiveStats, customFastName);

  let chargedMoves = effectiveStats.chargedMoves.slice(0, 2);
  if (typeof input === "object") {
    const customNames = [input.chargedMove1, input.chargedMove2].filter(
      (m): m is string => Boolean(m && m.trim())
    );
    if (customNames.length > 0) {
      chargedMoves = customNames.map((mName) =>
        buildChargedMoveFromName(mName, effectiveStats.types[0], effectiveStats.chargedMoves)
      );
    }
  }
  if (chargedMoves.length === 0) {
    chargedMoves = [
      { name: "Body Slam", code: "BS", type: "normal", power: 65, energyCost: 40 }
    ];
  }

  return {
    stats: effectiveStats,
    isShadow,
    fastMove,
    chargedMoves
  };
}

const DISCRETE_SHIELD_BR_CACHE = new Map<string, number>();
const POSITION_WEIGHTED_BR_CACHE = new Map<string, PositionWeightedMatchupRatings>();

function buildCombatantCacheKey(input: TeamMember | string): string {
  if (typeof input === "string") return input.trim().toLowerCase();
  return `${(input.name || "").trim().toLowerCase()}|${input.cp || ""}|${input.ivs || ""}|${input.fastMove || ""}|${input.chargedMove1 || ""}|${input.chargedMove2 || ""}`;
}

/**
 * Evaluates a discrete head-to-head Battle Rating (150..850, 500 neutral)
 * for any shield combination (userShields in 0..2, oppShields in 0..2).
 *
 * Includes explicit PvP battle math for:
 * 1. Mimikyu (Disguise):
 *    - Until Mimikyu's Disguise is busted, the opponent always throws their fastest (lowest-energy)
 *      Charged Attack knowing it must be absorbed by either a Protect Shield or Disguise.
 *    - Takes the exact average of:
 *      (a) Using all Protect Shields before busting Disguise (delays Busted Form -1 Defense drop
 *          and forces opponent to throw fastest/cheapest charged attacks across s + 1 cycles), and
 *      (b) Using Disguise first on the opponent's 1st fastest Charged Attack before using Protect Shields
 *          (triggers Busted Form -1 Defense / +25% incoming fast & unshielded damage early while
 *          allowing opponent to threaten heavier charged moves against remaining shields).
 * 2. Aegislash (Stance Change: Shield Forme ⇄ Sword/Blade Forme):
 *    - Models both the damage shift AND energy generation shift between Shield Forme (97 Atk / 291 Def:
 *      1-damage fast moves with boosted 1.28x high energy generation) and Sword/Blade Forme (291 Atk / 97 Def:
 *      2.85x Attack on Charged & Fast moves, 0.78x lower fast energy generation rate, and 0.34x Defense
 *      until reverting to Shield Forme by spending a Protect Shield).
 * 3. Morpeko (Hunger Switch + Aura Wheel):
 *    - Alternating Electric/Dark STAB Aura Wheel cycles with guaranteed +1 Attack stage self-buff.
 * 4. Cramorant (Gulp Missile: Gulping / Gorging Form):
 *    - Surf loads Arrokuda (-1 Def stage on target) or Pikachu (-1 Atk stage on target) + 12.5% HP retaliation.
 */
export function evaluateDiscreteShieldBattleRating(
  userInput: TeamMember | string,
  oppInput: TeamMember | string,
  userShields: number,
  oppShields: number,
  league: string = "GREAT LEAGUE"
): number {
  const sUser = Math.max(0, Math.min(2, Math.round(userShields)));
  const sOpp = Math.max(0, Math.min(2, Math.round(oppShields)));
  const normLg = (league || "GREAT LEAGUE").toUpperCase();
  const cacheKey = `${normLg}||${buildCombatantCacheKey(userInput)}||${buildCombatantCacheKey(oppInput)}||${sUser}v${sOpp}`;
  const cached = DISCRETE_SHIELD_BR_CACHE.get(cacheKey);
  if (cached !== undefined) return cached;

  const userResolved = resolveCombatPokemonForEngine(userInput, league);
  const oppResolved = resolveCombatPokemonForEngine(oppInput, league);

  const myStats = userResolved.stats;
  const oppStats = oppResolved.stats;

  const userSpeciesLower = (myStats.baseSpecies || myStats.speciesId || myStats.name).toLowerCase();
  const oppSpeciesLower = (oppStats.baseSpecies || oppStats.speciesId || oppStats.name).toLowerCase();

  const isUserMorpeko = userSpeciesLower.includes("morpeko");
  const isOppMorpeko = oppSpeciesLower.includes("morpeko");
  const isUserMimikyu = userSpeciesLower.includes("mimikyu");
  const isOppMimikyu = oppSpeciesLower.includes("mimikyu");
  const isUserAegislash = userSpeciesLower.includes("aegislash");
  const isOppAegislash = oppSpeciesLower.includes("aegislash");
  const isUserCramorant = userSpeciesLower.includes("cramorant");
  const isOppCramorant = oppSpeciesLower.includes("cramorant");

  const userChargedEval = userResolved.chargedMoves.slice(0, 2).map((cm) => ({
    pct: calculateChargedDamage(myStats, oppStats, cm, userResolved.isShadow, oppResolved.isShadow).percentage,
    energy: Math.max(35, cm.energyCost || 50)
  }));
  const bestUserCharged = userChargedEval.length ? Math.max(...userChargedEval.map((c) => c.pct)) : 45;
  const minUserCharged = userChargedEval.length ? Math.min(...userChargedEval.map((c) => c.pct)) : 35;
  const fastestUserMove = userChargedEval.length
    ? userChargedEval.reduce((prev, curr) => (curr.energy < prev.energy ? curr : prev), userChargedEval[0])
    : { pct: minUserCharged, energy: 45 };

  const oppChargedEval = oppResolved.chargedMoves.slice(0, 2).map((cm) => ({
    pct: calculateChargedDamage(oppStats, myStats, cm, oppResolved.isShadow, userResolved.isShadow).percentage,
    energy: Math.max(35, cm.energyCost || 50)
  }));
  const bestOppCharged = oppChargedEval.length ? Math.max(...oppChargedEval.map((c) => c.pct)) : 45;
  const minOppCharged = oppChargedEval.length ? Math.min(...oppChargedEval.map((c) => c.pct)) : 35;
  const fastestOppMove = oppChargedEval.length
    ? oppChargedEval.reduce((prev, curr) => (curr.energy < prev.energy ? curr : prev), oppChargedEval[0])
    : { pct: minOppCharged, energy: 45 };

  const rawUserFastEff = getTypeMultiplier(userResolved.fastMove.type, oppStats.types);
  const rawOppFastEff = getTypeMultiplier(oppResolved.fastMove.type, myStats.types);

  // Aegislash Stance Change:
  // - Shield Forme (97 Atk / 291 Def): Fast moves deal 1 HP (0.22x fast damage) but generate boosted high energy (1.28x EPT).
  // - Sword/Blade Forme (291 Atk / 97 Def): Fast moves deal full 291 Atk damage (1.05x fast damage) but energy generation
  //   drops (0.78x EPT relative to Shield Forme) until Aegislash spends a Protect Shield to revert to Shield Forme.
  const getAegislashFastDmgMult = (shields: number): number => {
    if (shields === 2) return 0.32; // Mostly Shield Forme (reverts twice via shields)
    if (shields === 1) return 0.50; // Blended Shield -> Sword Forme after 1 shield
    return 0.86; // 0 shields: stays in Sword Forme after 1st Charged Move (high fast dmg, low bulk)
  };
  const getAegislashEnergyGenMult = (shields: number): number => {
    if (shields === 2) return 1.24; // High Shield Forme energy generation sustained across 2 shield reversions
    if (shields === 1) return 1.12; // Boosted Shield Forme energy early, lower Sword Forme energy after shield spent
    return 0.88; // 0 shields: loses Shield Forme energy bonus after 1st Charged Attack
  };

  const userFastEff = isUserAegislash ? rawUserFastEff * getAegislashFastDmgMult(sUser) : rawUserFastEff;
  const oppFastEff = isOppAegislash ? rawOppFastEff * getAegislashFastDmgMult(sOpp) : rawOppFastEff;

  const userEnergyMult = isUserAegislash ? getAegislashEnergyGenMult(sUser) : 1.0;
  const oppEnergyMult = isOppAegislash ? getAegislashEnergyGenMult(sOpp) : 1.0;

  const shadowBulkDelta = (userResolved.isShadow ? -12 : 0) + (oppResolved.isShadow ? 12 : 0);

  const standardChargedPressure = (bestPct: number, minPct: number, defShields: number): number => {
    if (defShields <= 0) return bestPct * 1.7;
    if (defShields === 1) return ((bestPct + minPct) * 0.5) * 1.4;
    if (defShields === 2) return minPct * 1.0;
    return minPct * 0.65;
  };

  /**
   * Mimikyu Incoming Pressure & Disguise Shield-Ordering Model:
   * Until Mimikyu's Disguise is busted, the attacker ALWAYS throws their fastest (lowest-energy) Charged Move
   * knowing it must be blocked by a Protect Shield or Disguise.
   * Computes the average of:
   * - Strategy A (Use all Protect Shields BEFORE Disguise):
   *   Attacker throws fastest move for all (s + 1) blocks (s shields + 1 Disguise). Mimikyu stays in Disguise Forme
   *   (no -1 Def drop) throughout all s shields, only entering Busted Form (-1 Def) after s + 1 blocks.
   * - Strategy B (Use Disguise FIRST before Protect Shields):
   *   Attacker's 1st fastest Charged Move busts Disguise immediately (0 HP damage, but triggers Busted Form -1 Def
   *   stage drop / +25% incoming damage for the rest of the match). With Disguise now busted, attacker threatens
   *   full best/bait mix against Mimikyu's remaining s shields, and unshielded hits deal 1.25x Busted Form damage.
   */
  const computeMimikyuIncomingEvaluation = (
    attackerBestPct: number,
    attackerMinPct: number,
    attackerFastestPct: number,
    attackerFastestEnergy: number,
    attackerFastEff: number,
    mimikyuShields: number
  ): { avgIncomingChargedPressure: number; avgMimikyuNetBonus: number } => {
    // Faster energy pacing factor when attacker spams their lowest-energy Charged Attack to strip shields/Disguise
    const fastestPaceFactor = Math.min(1.25, Math.max(0.95, 48.0 / Math.max(35, attackerFastestEnergy)));
    const totalBlocks = mimikyuShields + 1; // s shields + 1 Disguise

    // Strategy A: All s shields used first, then Disguise used on move #(s+1)
    // Attacker is forced to throw fastest/cheapest move for all (s+1) cycles because Disguise is still intact!
    const residualUnblockedAfterA =
      totalBlocks === 1
        ? (attackerBestPct * 0.65 + attackerFastestPct * 0.35) * 1.12
        : totalBlocks === 2
        ? attackerFastestPct * 0.85 * fastestPaceFactor
        : attackerFastestPct * 0.58 * fastestPaceFactor;
    // Busted Form (-1 Def) is delayed until after all shields AND Disguise are exhausted
    const lateBustedDefPenaltyA =
      (mimikyuShields === 0 ? 14 : mimikyuShields === 1 ? 7 : 3) * (0.85 + 0.3 * attackerFastEff);
    const disguiseSavedValueA = attackerFastestPct * 0.42 + (mimikyuShields === 0 ? 24 : 16);
    const netBonusA = disguiseSavedValueA - lateBustedDefPenaltyA;

    // Strategy B: Disguise used FIRST on move #1 (attacker throws fastest move to bust Disguise),
    // then Mimikyu uses s shields while already in Busted Form (-1 Def = 1.25x incoming damage)
    const postDisguisePressureB =
      mimikyuShields === 0
        ? attackerBestPct * 1.22 // Busted Form 1.25x Def drop on subsequent unshielded charged move
        : mimikyuShields === 1
        ? ((attackerBestPct + attackerMinPct) * 0.5) * 1.02 * 1.15
        : attackerMinPct * 0.72 * 1.15;
    // Early Busted Form (-1 Def) increases incoming fast-move damage across the entire match
    const earlyBustedDefPenaltyB =
      (mimikyuShields === 0 ? 14 : mimikyuShields === 1 ? 19 : 23) * (0.85 + 0.35 * attackerFastEff);
    const disguiseSavedValueB = attackerFastestPct * 0.38 + (mimikyuShields === 0 ? 24 : 14);
    const netBonusB = disguiseSavedValueB - earlyBustedDefPenaltyB;

    return {
      avgIncomingChargedPressure: 0.5 * (residualUnblockedAfterA + postDisguisePressureB),
      avgMimikyuNetBonus: 0.5 * (netBonusA + netBonusB)
    };
  };

  let userChargedImpact: number;
  let oppMimikyuBonus = 0;
  if (isOppMimikyu) {
    const evalOppMimi = computeMimikyuIncomingEvaluation(
      bestUserCharged,
      minUserCharged,
      fastestUserMove.pct,
      fastestUserMove.energy,
      userFastEff,
      sOpp
    );
    userChargedImpact = evalOppMimi.avgIncomingChargedPressure * userEnergyMult;
    oppMimikyuBonus = evalOppMimi.avgMimikyuNetBonus;
  } else {
    userChargedImpact = standardChargedPressure(bestUserCharged, minUserCharged, sOpp) * userEnergyMult;
  }

  let oppChargedImpact: number;
  let userMimikyuBonus = 0;
  if (isUserMimikyu) {
    const evalUserMimi = computeMimikyuIncomingEvaluation(
      bestOppCharged,
      minOppCharged,
      fastestOppMove.pct,
      fastestOppMove.energy,
      oppFastEff,
      sUser
    );
    oppChargedImpact = evalUserMimi.avgIncomingChargedPressure * oppEnergyMult;
    userMimikyuBonus = evalUserMimi.avgMimikyuNetBonus;
  } else {
    oppChargedImpact = standardChargedPressure(bestOppCharged, minOppCharged, sUser) * oppEnergyMult;
  }

  const chargedDelta = 2.0 * (userChargedImpact - oppChargedImpact);

  const avgShields = (sUser + sOpp) * 0.5;
  const fastWeight = avgShields <= 1 ? 95 + avgShields * 25 : 120 + (avgShields - 1) * 35;
  const fastDelta = (userFastEff - oppFastEff) * fastWeight;

  const shadowMultiplier = avgShields <= 1 ? 1 : avgShields;
  const effectiveShadowDelta = shadowBulkDelta * shadowMultiplier;

  const shieldDiff = sUser - sOpp;
  const shieldAdvantageDelta =
    shieldDiff * (85 + 0.65 * ((bestOppCharged + bestUserCharged) * 0.5));

  // Special form-changing & ability PvP mechanics delta (Morpeko, Mimikyu, Aegislash, Cramorant)
  let specialMechanicsDelta = userMimikyuBonus - oppMimikyuBonus;
  if (isUserMorpeko) {
    specialMechanicsDelta += 14 + sOpp * 6;
  }
  if (isOppMorpeko) {
    specialMechanicsDelta -= 14 + sUser * 6;
  }
  if (isUserAegislash) {
    // Shield Forme (291 Def + high energy gen) vs Sword/Blade Forme (97 Def + lower energy gen when unshielded)
    specialMechanicsDelta += sUser === 2 ? 28 : sUser === 1 ? 12 : -26;
  }
  if (isOppAegislash) {
    specialMechanicsDelta -= sOpp === 2 ? 28 : sOpp === 1 ? 12 : -26;
  }
  if (isUserCramorant) {
    // Gulp Missile: Surf loads Arrokuda (-1 Def stage on opponent) or Pikachu (-1 Atk stage on opponent) + retaliation damage
    specialMechanicsDelta += 15 + sUser * 4;
  }
  if (isOppCramorant) {
    specialMechanicsDelta -= 15 + sOpp * 4;
  }

  const rawRating = Math.round(
    500 + chargedDelta + fastDelta + effectiveShadowDelta + shieldAdvantageDelta + specialMechanicsDelta
  );

  const finalRating = Math.max(150, Math.min(850, rawRating));
  if (DISCRETE_SHIELD_BR_CACHE.size > 40000) {
    DISCRETE_SHIELD_BR_CACHE.clear();
  }
  DISCRETE_SHIELD_BR_CACHE.set(cacheKey, finalRating);
  return finalRating;
}

export interface PositionWeightedMatchupRatings {
  leadBr: number;
  swapBr: number;
  closerBr: number;
}

/**
 * Computes Position-Weighted Shield Scenario Ratings for a single matchup (User vs Opponent):
 * - Slot 1 (Lead): 0.45 * 1v1 + 0.35 * 2v2 + 0.10 * 0v0 + 0.05 * 1v2 + 0.05 * 2v1
 * - Slot 2 (Safe Swap / Bait): 0.40 * 1v1 + 0.20 * 1v0 + 0.20 * 0v1 + 0.10 * 2v1 + 0.10 * 0v0
 * - Slot 3 (Closer / Sweeper): 0.50 * 0v0 + 0.20 * 1v0 + 0.15 * 0v1 + 0.15 * 1v1
 */
export function evaluatePositionWeightedBr(
  userInput: TeamMember | string,
  oppInput: TeamMember | string,
  league: string = "GREAT LEAGUE"
): PositionWeightedMatchupRatings {
  const normLg = (league || "GREAT LEAGUE").toUpperCase();
  const pwKey = `${normLg}||${buildCombatantCacheKey(userInput)}||${buildCombatantCacheKey(oppInput)}`;
  const cached = POSITION_WEIGHTED_BR_CACHE.get(pwKey);
  if (cached) return cached;

  const r0v0 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 0, 0, league);
  const r0v1 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 0, 1, league);
  const r1v0 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 1, 0, league);
  const r1v1 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 1, 1, league);
  const r1v2 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 1, 2, league);
  const r2v1 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 2, 1, league);
  const r2v2 = evaluateDiscreteShieldBattleRating(userInput, oppInput, 2, 2, league);

  const leadBr =
    0.45 * r1v1 +
    0.35 * r2v2 +
    0.10 * r0v0 +
    0.05 * r1v2 +
    0.05 * r2v1;

  const swapBr =
    0.40 * r1v1 +
    0.20 * r1v0 +
    0.20 * r0v1 +
    0.10 * r2v1 +
    0.10 * r0v0;

  const closerBr =
    0.50 * r0v0 +
    0.20 * r1v0 +
    0.15 * r0v1 +
    0.15 * r1v1;

  const res = { leadBr, swapBr, closerBr };
  if (POSITION_WEIGHTED_BR_CACHE.size > 40000) {
    POSITION_WEIGHTED_BR_CACHE.clear();
  }
  POSITION_WEIGHTED_BR_CACHE.set(pwKey, res);
  return res;
}

export interface BlendedSeasonMetaDistribution {
  league: string;
  seasonMatchCount: number;
  wHist: number;
  wMeta: number;
  leadProbabilities: Map<string, number>;
  fieldProbabilities: Map<string, number>;
}

export function getLeagueTopMetaSpeciesNames(league: string, maxCount: number = 100): string[] {
  const upper = (league || "GREAT LEAGUE").toUpperCase();
  const normLeague = upper.includes("MEGA")
    ? "MEGA MASTER LEAGUE"
    : upper.includes("GREAT")
    ? "GREAT LEAGUE"
    : upper.includes("ULTRA")
    ? "ULTRA LEAGUE"
    : "MASTER LEAGUE";

  const names: string[] = [];
  const seen = new Set<string>();
  const addUniqueName = (rawName: string) => {
    if (!rawName || names.length >= maxCount) return;
    const key = rawName.trim().toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    names.push(rawName.trim());
  };

  const liveMap = LIVE_RANKINGS_MAP[normLeague];
  if (liveMap && liveMap.size > 0) {
    const sortedEntries = Array.from(liveMap.values()).sort((a, b) => b.score - a.score);
    for (const entry of sortedEntries) {
      if (names.length >= maxCount) break;
      const sid = entry.speciesId.toLowerCase();
      const matchedMon = Object.values(POKEMON_DATABASE).find(
        (p) => p.speciesId.toLowerCase() === sid
      );
      let displayName = matchedMon?.name;
      if (!displayName) {
        const isShad = sid.endsWith("_shadow");
        const cleanSid = sid.replace(/_shadow$/i, "");
        const baseMatch = Object.values(POKEMON_DATABASE).find(
          (p) => p.speciesId.toLowerCase() === cleanSid
        );
        if (baseMatch) {
          displayName = isShad && !baseMatch.name.toLowerCase().startsWith("shadow ")
            ? `Shadow ${baseMatch.name}`
            : baseMatch.name;
        }
      }
      if (displayName) {
        addUniqueName(displayName);
      }
    }
  }

  // Fallback / supplement curated meta pool per league up to maxCount (100 for battle rankings)
  const curatedSeeds =
    normLeague === "GREAT LEAGUE"
      ? [
          "Clodsire", "Feraligatr", "Mandibuzz", "Azumarill", "Annihilape",
          "Gastrodon", "Shadow Feraligatr", "Jumpluff", "Dunsparce", "Drapion",
          "Talonflame", "Wigglytuff", "Lickilicky", "Toxapex", "Malamar",
          "Corsola (Galarian)", "Primeape", "Serperior", "Dewgong", "Morpeko",
          "Mimikyu", "Aegislash", "Cramorant", "Corviknight", "Sableye",
          "Medicham", "Bastiodon", "Carbink", "Skarmory", "Lanturn",
          "Whiscash", "Swampert", "Quagsire", "Gligar", "Altaria",
          "Guzzlord", "Goodra", "Dragonair", "Cresselia", "Registeel",
          "Umbreon", "Pelipper", "Mantine", "Jellicent", "Trevenant",
          "Skeledirge", "Charjabug", "Galvantula", "Togedemaru", "Magnezone",
          "Venusaur", "Shadow Venusaur", "Victreebel", "Shadow Victreebel", "Abomasnow",
          "Sandslash (Alolan)", "Ninetales (Alolan)", "Froslass", "Walrein", "Lapras",
          "Poliwrath", "Machamp", "Shadow Machamp", "Scrafty", "Obstagoon",
          "Vigoroth", "Dubwool", "Greedent", "Diggersby", "Pidgeot",
          "Noctowl", "Golbat", "Crobat", "Nidoqueen", "Toxicroak",
          "ariados", "Forretress", "Wormadam (Trash)", "Escavalier", "Ferrothorn",
          "Stunfisk (Galarian)", "Stunfisk", "Steelix", "Marowak (Alolan)", "Drifblim",
          "Haunter", "Gengar", "Sneasler", "granbull", "Clefable",
          "Sylveon", "Florges", "Aromatisse", "Slurpuff", "Tinkaton",
          "Zweilous", "Hakamo-o", "Kommo-o", "Arctibax", "Baxcalibur"
        ]
      : normLeague === "ULTRA LEAGUE"
      ? [
          "Zygarde", "Feraligatr", "Giratina (Altered)", "Cresselia", "Talonflame",
          "Clefable", "Drapion", "Tentacruel", "Poliwrath", "Skeledirge",
          "Annihilape", "Lickilicky", "Virizion", "Cobalion", "Registeel",
          "Tapu Fini", "Swampert", "Mandibuzz", "Shadow Feraligatr", "Greedent",
          "Pidgeot", "Jellicent", "Trevenant", "Walrein", "Ninetales (Alolan)",
          "Sandslash (Alolan)", "Obstagoon", "Scrafty", "Umbreon", "Guzzlord",
          "Dragonite", "Shadow Dragonite", "Goodra", "Kommo-o", "Baxcalibur",
          "Ampharos", "Bellibolt", "Regirock", "Steelix", "Gliscor",
          "Gastrodon", "Quagsire", "Clodsire", "Toxicroak", "Muk (Alolan)",
          "Weezing (Galarian)", "Nidoqueen", "Venusaur", "Serperior", "Decidueye",
          "Abomasnow", "Lapras", "Empoleon", "Greninja", "Primarina",
          "Samurott", "Blastoise", "Gyarados", "Charizard", "Typhlosion",
          "Incinerate Talonflame", "Ho-Oh", "Moltres (Galarian)", "Zapdos (Galarian)", "Articuno",
          "Lugia", "Deoxys (Defense)", "Armored Mewtwo", "Necrozma (Dusk Mane)", "Necrozma (Dawn Wings)",
          "Solgaleo", "Lunala", "Corviknight", "Skarmory", "Forretress",
          "Escavalier", "Scizor", "Genesect", "Lucario", "Machamp",
          "Hariyama", "Conkeldurr", "Pangoro", "Malamar", "Drifblim",
          "Gengar", "Chandelure", "Aegislash", "Mimikyu", "Morpeko",
          "Cramorant", "Togekiss", "Sylveon", "Florges", "Grimmsnarl",
          "Snorlax", "Shadow Snorlax", "Dubwool", "Oranguru", "Bewear"
        ]
      : normLeague === "MEGA MASTER LEAGUE"
      ? [
          "Mega Rayquaza", "Primal Groudon", "Primal Kyogre", "Zacian (Crowned)",
          "Palkia (Origin)", "Dialga (Origin)", "Necrozma (Dusk Mane)", "Necrozma (Dawn Wings)",
          "Mewtwo", "Ho-Oh", "Zygarde", "Xerneas", "Yveltal", "Landorus (Therian)",
          "Mega Gyarados", "Mega Garchomp", "Mega Metagross", "Mega Tyranitar",
          "Mega Gardevoir", "Mega Swampert", "Mega Charizard Y", "Mega Charizard X",
          "Mega Blaziken", "Mega Salamence", "Mega Latios", "Mega Latias",
          "Mega Scizor", "Mega Lucario", "MegaHeracross", "Mega Aggron",
          "Kyurem (Black)", "Kyurem (White)", "Solgaleo", "Lunala",
          "Rhyperior", "Groudon", "Kyogre", "Dialga", "Palkia",
          "Giratina (Origin)", "Giratina (Altered)", "Zamazenta (Crowned)", "Lugia", "Rayquaza",
          "Reshiram", "Zekrom", "Marshadow", "Zarude", "Meloetta (Aria)",
          "Enamorus (Incarnate)", "Florges", "Primarina", "Togekiss", "Dragonite",
          "Garchomp", "Baxcalibur", "Mamoswine", "Excadrill", "Metagross"
        ]
      : [
          "Palkia (Origin)", "Zacian (Crowned)", "Dialga (Origin)", "Necrozma (Dusk Mane)",
          "Necrozma (Dawn Wings)", "Ho-Oh", "Landorus (Therian)", "Zygarde",
          "Rhyperior", "Xerneas", "Yveltal", "Kyogre", "Groudon", "Mewtwo",
          "Solgaleo", "Meloetta (Aria)", "Florges", "Dragonite", "Zamazenta (Crowned)",
          "Kyurem (Black)", "Kyurem (White)", "Giratina (Origin)", "Giratina (Altered)", "Dialga",
          "Palkia", "Lugia", "Rayquaza", "Reshiram", "Zekrom", "Lunala",
          "Marshadow", "Zarude", "Keldeo", "Urshifu (Single Strike)", "Urshifu (Rapid Strike)",
          "Calyrex (Shadow Rider)", "Calyrex (Ice Rider)", "Enamorus (Incarnate)", "Tapu Bulu", "Tapu Lele",
          "Tapu Fini", "Tapu Koko", "Primarina", "Togekiss", "Sylveon",
          "Garchomp", "Baxcalibur", "Goodra", "Kommo-o", "Hydreigon",
          "Tyranitar", "Metagross", "Excadrill", "Melmetal", "Gholdengo",
          "Corviknight", "Heatran", "Nihilego", "Kartana", "Xurkitree",
          "Buzzwole", "Pheromosa", "Guzzlord", "Celesteela", "Mamoswine",
          "Avalugg (Hisuian)", "Avalugg", "Cetitan", "Ursaluna", "Snorlax",
          "Gyarados", "Swampert", "Feraligatr", "Annihilape", "Conkeldurr",
          "Machamp", "Lucario", "Terrakion", "Virizion", "Cobalion",
          "Genesect", "Volcarona", "Chandelure", "Gengar", "Aegislash",
          "Mimikyu", "Moltres (Galarian)", "Zapdos (Galarian)", "Articuno (Galarian)", "Landorus (Incarnate)"
        ];

  for (const s of curatedSeeds) {
    if (names.length >= maxCount) break;
    const dbMatch =
      POKEMON_DATABASE[s] ||
      Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === s.toLowerCase());
    addUniqueName(dbMatch ? dbMatch.name : s);
  }

  if (names.length < maxCount) {
    for (const mon of Object.values(POKEMON_DATABASE)) {
      if (names.length >= maxCount) break;
      if (normLeague !== "MEGA MASTER LEAGUE" && /^Mega\s+|^Primal\s+/i.test(mon.name)) continue;
      addUniqueName(mon.name);
    }
  }

  return names.slice(0, maxCount);
}

function canonicalizeMetaPokemonName(rawName: string): string {
  const trimmed = (rawName || "").trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown" || trimmed.toLowerCase() === "waiting...") {
    return "";
  }
  const isShadow = /^Shadow\s+/i.test(trimmed) || /\(Shadow\)/i.test(trimmed);
  const clean = trimmed.replace(/^Shadow\s+/i, "").replace(/\s*\(Shadow\)/i, "").trim();
  const dbMatch =
    POKEMON_DATABASE[trimmed] ||
    POKEMON_DATABASE[clean] ||
    Object.values(POKEMON_DATABASE).find(
      (p) => p.name.toLowerCase() === clean.toLowerCase()
    );
  if (dbMatch) {
    if (isShadow && !dbMatch.name.toLowerCase().startsWith("shadow ")) {
      return `Shadow ${dbMatch.name}`;
    }
    return dbMatch.name;
  }
  return isShadow ? `Shadow ${clean}` : clean;
}

/**
 * Computes the Blended Opponent Distribution P_lead(p) and P_field(p)
 * bound strictly to the current season's battle logs for the specified league,
 * using a Meta Depth of 100 Pokémon for evaluating Battle Rankings:
 * 1. Linear Confidence Ramp (0..50 matches): w_hist = 0.70 * min(1, N / 50), w_meta = 1 - w_hist
 * 2. PvPoke Top-100 Meta Prior P_meta(p) with rank exponential decay W_meta(r) = exp(-0.05 * (r - 1))
 * 3. Battle Log Recency Decay P_hist_lead(p) & P_hist_field(p) with newest-first match index k = 1..N
 *    weighted by the identical exponential decay W_hist(k) = exp(-0.05 * (k - 1)).
 */
export function computeBlendedSeasonMeta(
  league: string,
  seasonBattleLogs?: Array<{ timestampMs: number; league: string; opponents: string[] }>,
  currentSeason?: { startMs: number; endMs: number }
): BlendedSeasonMetaDistribution {
  const upperLeague = (league || "GREAT LEAGUE").toUpperCase();
  const normLeague = upperLeague.includes("MEGA")
    ? "MEGA MASTER LEAGUE"
    : upperLeague.includes("GREAT")
    ? "GREAT LEAGUE"
    : upperLeague.includes("ULTRA")
    ? "ULTRA LEAGUE"
    : "MASTER LEAGUE";

  // Meta depth of 100 for evaluating team and role battle rankings
  const metaSpecies = getLeagueTopMetaSpeciesNames(normLeague, 100);
  const pMeta = new Map<string, number>();
  let totalMetaWeight = 0;
  metaSpecies.forEach((monName, idx) => {
    const canon = canonicalizeMetaPokemonName(monName) || monName;
    const w = Math.exp(-0.05 * idx);
    pMeta.set(canon, (pMeta.get(canon) || 0) + w);
    totalMetaWeight += w;
  });
  if (totalMetaWeight > 0) {
    for (const [k, v] of pMeta.entries()) {
      pMeta.set(k, v / totalMetaWeight);
    }
  }

  // Filter logs strictly to current season & matching league, sorted newest-first (k = 1 most recent)
  const matchingLogs = (seasonBattleLogs || [])
    .filter((entry) => {
      if (!entry || !Array.isArray(entry.opponents) || entry.opponents.length === 0) return false;
      const entryLeague = (entry.league || "").toUpperCase();
      if (entryLeague !== normLeague) return false;
      if (currentSeason && currentSeason.startMs > 0 && currentSeason.endMs > currentSeason.startMs) {
        if (entry.timestampMs < currentSeason.startMs || entry.timestampMs > currentSeason.endMs) {
          return false;
        }
      }
      const firstOpp = canonicalizeMetaPokemonName(entry.opponents[0]);
      return Boolean(firstOpp);
    })
    .sort((a, b) => b.timestampMs - a.timestampMs);

  const N = matchingLogs.length;
  const wHist = 0.70 * Math.min(1.0, N / 50.0);
  const wMeta = 1.0 - wHist;

  const pHistLead = new Map<string, number>();
  const pHistField = new Map<string, number>();
  let totalHistLeadWeight = 0;
  let totalHistFieldWeight = 0;

  matchingLogs.forEach((entry, idx) => {
    // k = idx + 1 (1-indexed from newest match k=1 to oldest match k=N)
    const wMatch = Math.exp(-0.05 * idx);
    const leadOpp = canonicalizeMetaPokemonName(entry.opponents[0] || "");
    if (leadOpp) {
      pHistLead.set(leadOpp, (pHistLead.get(leadOpp) || 0) + wMatch);
      totalHistLeadWeight += wMatch;
    }
    entry.opponents.slice(0, 3).forEach((rawOpp) => {
      const oppName = canonicalizeMetaPokemonName(rawOpp || "");
      if (oppName) {
        pHistField.set(oppName, (pHistField.get(oppName) || 0) + wMatch);
        totalHistFieldWeight += wMatch;
      }
    });
  });

  if (totalHistLeadWeight > 0) {
    for (const [k, v] of pHistLead.entries()) {
      pHistLead.set(k, v / totalHistLeadWeight);
    }
  }
  if (totalHistFieldWeight > 0) {
    for (const [k, v] of pHistField.entries()) {
      pHistField.set(k, v / totalHistFieldWeight);
    }
  }

  const allLeadSpecies = new Set<string>([...pMeta.keys(), ...pHistLead.keys()]);
  const allFieldSpecies = new Set<string>([...pMeta.keys(), ...pHistField.keys()]);

  const leadProbabilities = new Map<string, number>();
  const fieldProbabilities = new Map<string, number>();

  if (totalHistLeadWeight === 0 || wHist === 0) {
    for (const [k, v] of pMeta.entries()) leadProbabilities.set(k, v);
  } else {
    let sumLead = 0;
    for (const sp of allLeadSpecies) {
      const val = wHist * (pHistLead.get(sp) || 0) + wMeta * (pMeta.get(sp) || 0);
      if (val > 0) {
        leadProbabilities.set(sp, val);
        sumLead += val;
      }
    }
    if (sumLead > 0) {
      for (const [k, v] of leadProbabilities.entries()) leadProbabilities.set(k, v / sumLead);
    }
  }

  if (totalHistFieldWeight === 0 || wHist === 0) {
    for (const [k, v] of pMeta.entries()) fieldProbabilities.set(k, v);
  } else {
    let sumField = 0;
    for (const sp of allFieldSpecies) {
      const val = wHist * (pHistField.get(sp) || 0) + wMeta * (pMeta.get(sp) || 0);
      if (val > 0) {
        fieldProbabilities.set(sp, val);
        sumField += val;
      }
    }
    if (sumField > 0) {
      for (const [k, v] of fieldProbabilities.entries()) fieldProbabilities.set(k, v / sumField);
    }
  }

  return {
    league: normLeague,
    seasonMatchCount: N,
    wHist,
    wMeta,
    leadProbabilities,
    fieldProbabilities
  };
}

export interface SlotEvaluatedMetrics {
  leadBr: number;
  swapMeanBr: number;
  swapSigmaBr: number;
  swapBr: number;
  closerBr: number;
  baitScore: number;
  closerScore: number;
  weaknesses: string[];
  doubleWeaknesses: string[];
  resistances: string[];
}

export function evaluateSingleSlotAgainstBlendedMeta(
  member: TeamMember,
  league: string,
  blendedMeta: BlendedSeasonMetaDistribution
): SlotEvaluatedMetrics {
  const resolved = resolveCombatPokemonForEngine(member, league);
  const myTypes = resolved.stats.types;

  const weaknesses: string[] = [];
  const doubleWeaknesses: string[] = [];
  const resistances: string[] = [];

  for (const atkType of ALL_18_TYPES) {
    const mult = getTypeMultiplier(atkType, myTypes);
    if (mult >= 1.55) {
      weaknesses.push(atkType);
      if (mult >= 2.2) {
        doubleWeaknesses.push(atkType);
      }
    } else if (mult <= 0.65) {
      resistances.push(atkType);
    }
  }

  let leadMean = 0;
  for (const [oppName, prob] of blendedMeta.leadProbabilities.entries()) {
    const pw = evaluatePositionWeightedBr(member, oppName, league);
    leadMean += prob * pw.leadBr;
  }

  let swapMean = 0;
  const swapEntries: Array<{ prob: number; val: number }> = [];
  let closerMean = 0;

  for (const [oppName, prob] of blendedMeta.fieldProbabilities.entries()) {
    const pw = evaluatePositionWeightedBr(member, oppName, league);
    swapMean += prob * pw.swapBr;
    swapEntries.push({ prob, val: pw.swapBr });
    closerMean += prob * pw.closerBr;
  }

  let swapVariance = 0;
  for (const item of swapEntries) {
    const diff = item.val - swapMean;
    swapVariance += item.prob * diff * diff;
  }
  const swapSigma = Math.sqrt(Math.max(0, swapVariance));
  const swapBr = Math.round(swapMean - 0.5 * swapSigma);

  // Bait vs Closer score for ABB ordering
  const ept = (resolved.fastMove.energyGain || 6) / Math.max(1, resolved.fastMove.turns || 2);
  const minEnergy = Math.min(
    ...resolved.chargedMoves.map((cm) => cm.energyCost || 50),
    50
  );
  const maxPower = Math.max(
    ...resolved.chargedMoves.map((cm) => cm.power || 75),
    75
  );
  const baitScore = swapBr + ept * 18 + (60 - minEnergy) * 1.4;
  const closerScore = closerMean + maxPower * 0.45 + (resolved.isShadow ? 18 : 0);

  return {
    leadBr: Math.round(leadMean),
    swapMeanBr: Math.round(swapMean),
    swapSigmaBr: Math.round(swapSigma),
    swapBr,
    closerBr: Math.round(closerMean),
    baitScore,
    closerScore,
    weaknesses,
    doubleWeaknesses,
    resistances
  };
}

export interface TeamDetectionResult {
  orderedPokemon: TeamMember[];
  archetype: "ABB" | "ABC";
  sharedWeaknesses: string[];
  leadAggBr: number;
  machineAggBr: number;
  safeSwapBr: number;
  closerSwapBr: number;
  closerBr: number;
  seasonMatchCount: number;
  wHistPct: number;
  wMetaPct: number;
  slotMetrics: Array<{
    leadBr: number;
    swapBr: number;
    closerBr: number;
    roleCode: string;
    roleLabel: string;
  }>;
  reasonSummary: string;
}

/**
 * Evaluates a 3-Pokémon team (either in its current order or with Auto-Detect & Order):
 * - When `reorderSlots = true`:
 *   - Runs the 18-type defensive vulnerability audit across all 3 pairs.
 *   - If any pair (U_i, U_j) shares >= 2 weaknesses (or >= 1 double weakness) AND the 3rd Pokémon U_k
 *     resists all those shared weaknesses, classifies as ABB (unless manualArchetypeOverride === "ABC"):
 *     - Moves U_k (Lead A) to Slot 1.
 *     - Places the higher bait/safe-swap B Pokémon in Slot 2 (B1 Bait) and the stronger closer in Slot 3 (B2 Sweeper).
 *   - Otherwise classifies as ABC:
 *     - Keeps Slot 1 fixed as Lead.
 *     - Places the backline member with the higher volatility-adjusted Swap BR in Slot 2 (Safe Swap) and the other in Slot 3 (Closer).
 */
export function evaluateOrAutoOrderTeam(
  members: TeamMember[],
  league: string,
  optionsOrLogs?:
    | {
        reorderSlots?: boolean;
        manualArchetypeOverride?: "ABB" | "ABC";
        seasonBattleLogs?: Array<{ timestampMs: number; league: string; opponents: string[] }>;
        currentSeason?: { startMs: number; endMs: number };
        cachedBlendedMeta?: BlendedSeasonMetaDistribution;
      }
    | Array<{ timestampMs: number; league: string; opponents: string[] }>,
  seasonStartMs?: number,
  seasonEndMs?: number,
  reorderSlotsArg?: boolean,
  manualArchetypeOverrideArg?: "ABB" | "ABC"
): TeamDetectionResult {
  const isArrayArg = Array.isArray(optionsOrLogs);
  const options = isArrayArg
    ? {
        seasonBattleLogs: optionsOrLogs,
        currentSeason:
          typeof seasonStartMs === "number" && typeof seasonEndMs === "number"
            ? { startMs: seasonStartMs, endMs: seasonEndMs }
            : undefined,
        reorderSlots: reorderSlotsArg ?? false,
        manualArchetypeOverride: manualArchetypeOverrideArg
      }
    : optionsOrLogs;

  const reorderSlots = options?.reorderSlots ?? false;
  const blendedMeta =
    options?.cachedBlendedMeta ||
    computeBlendedSeasonMeta(league, options?.seasonBattleLogs, options?.currentSeason);

  const safeMembers = (members || []).slice(0, 3);
  if (safeMembers.length < 3) {
    return {
      orderedPokemon: safeMembers,
      archetype: options?.manualArchetypeOverride || "ABC",
      sharedWeaknesses: [],
      leadAggBr: 500,
      machineAggBr: 600,
      safeSwapBr: 500,
      closerSwapBr: 500,
      closerBr: 500,
      seasonMatchCount: blendedMeta.seasonMatchCount,
      wHistPct: Math.round(blendedMeta.wHist * 100),
      wMetaPct: Math.round(blendedMeta.wMeta * 100),
      slotMetrics: [],
      reasonSummary: "Enter 3 Pokémon to evaluate team archetype and aggregate ratings."
    };
  }

  const evals = safeMembers.map((m) => evaluateSingleSlotAgainstBlendedMeta(m, league, blendedMeta));

  // Audit all 3 pairs for ABB candidate: pair (i, j) with remaining k as Lead A
  const pairCandidates: Array<{
    leadIdx: number;
    bPairIndices: [number, number];
    sharedWeaknesses: string[];
    resistedCount: number;
    allResisted: boolean;
    score: number;
  }> = [];

  const indexTriples: Array<[number, number, number]> = [
    [0, 1, 2], // Lead = 0, Backline = (1, 2)
    [1, 0, 2], // Lead = 1, Backline = (0, 2)
    [2, 0, 1]  // Lead = 2, Backline = (0, 1)
  ];

  for (const [k, i, j] of indexTriples) {
    const wI = new Set(evals[i].weaknesses);
    const shared = evals[j].weaknesses.filter((w) => wI.has(w));
    if (shared.length === 0) continue;

    const hasSharedDouble = shared.some(
      (w) => evals[i].doubleWeaknesses.includes(w) || evals[j].doubleWeaknesses.includes(w)
    );
    const qualifiesWeaknessOverlap = shared.length >= 2 || (shared.length >= 1 && hasSharedDouble);
    if (!qualifiesWeaknessOverlap) continue;

    const leadResists = new Set(evals[k].resistances);
    const leadWeaks = new Set(evals[k].weaknesses);
    const resistedByLead = shared.filter((w) => leadResists.has(w));
    const leadNotWeakToAny = shared.every((w) => !leadWeaks.has(w));
    const allResisted = resistedByLead.length === shared.length || (resistedByLead.length >= 1 && leadNotWeakToAny && shared.length >= 2);

    if (allResisted) {
      // Prefer keeping current Slot 0 as Lead if tied
      const score = shared.length * 100 + resistedByLead.length * 50 + (k === 0 ? 15 : 0);
      pairCandidates.push({
        leadIdx: k,
        bPairIndices: [i, j],
        sharedWeaknesses: shared,
        resistedCount: resistedByLead.length,
        allResisted: true,
        score
      });
    }
  }

  pairCandidates.sort((a, b) => b.score - a.score);
  const bestAbbCandidate = pairCandidates[0];

  const resolvedArchetype: "ABB" | "ABC" =
    options?.manualArchetypeOverride || (bestAbbCandidate ? "ABB" : "ABC");

  let finalOrderIndices: [number, number, number] = [0, 1, 2];
  let detectedSharedWeaknesses: string[] = bestAbbCandidate?.sharedWeaknesses || [];

  if (reorderSlots) {
    if (resolvedArchetype === "ABB") {
      const leadIdx = bestAbbCandidate ? bestAbbCandidate.leadIdx : 0;
      const [bA, bB] = bestAbbCandidate
        ? bestAbbCandidate.bPairIndices
        : ([1, 2] as [number, number]);

      // Order B1 (Bait Swap in Slot 2) vs B2 (Sweeper/Closer in Slot 3):
      // B1 should have higher Swap BR / faster bait pressure relative to its closer score
      const aBaitAdvantage = evals[bA].baitScore - evals[bA].closerScore * 0.35;
      const bBaitAdvantage = evals[bB].baitScore - evals[bB].closerScore * 0.35;
      if (aBaitAdvantage >= bBaitAdvantage) {
        finalOrderIndices = [leadIdx, bA, bB];
      } else {
        finalOrderIndices = [leadIdx, bB, bA];
      }
    } else {
      // ABC: Keep Slot 1 (index 0) fixed as Lead; put higher Swap BR in Slot 2
      if (evals[2].swapBr > evals[1].swapBr) {
        finalOrderIndices = [0, 2, 1];
      } else {
        finalOrderIndices = [0, 1, 2];
      }
    }
  } else if (resolvedArchetype === "ABB" && !bestAbbCandidate) {
    // Check shared weaknesses between current slots 1 and 2
    const w1 = new Set(evals[1].weaknesses);
    detectedSharedWeaknesses = evals[2].weaknesses.filter((w) => w1.has(w));
  }

  const orderedPokemon = finalOrderIndices.map((idx) => safeMembers[idx]);
  const orderedEvals = finalOrderIndices.map((idx) => evals[idx]);

  const leadAggBr = orderedEvals[0].leadBr;
  const safeSwapBr = orderedEvals[1].swapBr;
  const closerSwapBr = orderedEvals[2].swapBr;
  const closerBr = orderedEvals[2].closerBr;

  // Compute Core Coverage BR (Core BR) using position-weighted ratings across the Top-100 blended field distribution:
  // sum_{p in Meta} P_field(p) * max(BR_Lead(U1, p), BR_Swap(U2, p), BR_Closer(U3, p))
  let machineAggSum = 0;
  for (const [oppName, prob] of blendedMeta.fieldProbabilities.entries()) {
    const r1 = evaluatePositionWeightedBr(orderedPokemon[0], oppName, league).leadBr;
    const r2 = evaluatePositionWeightedBr(orderedPokemon[1], oppName, league).swapBr;
    const r3 = evaluatePositionWeightedBr(orderedPokemon[2], oppName, league).closerBr;
    machineAggSum += prob * Math.max(r1, r2, r3);
  }
  const machineAggBr = Math.round(machineAggSum);

  const slotMetrics = [
    {
      leadBr: orderedEvals[0].leadBr,
      swapBr: orderedEvals[0].swapBr,
      closerBr: orderedEvals[0].closerBr,
      roleCode: resolvedArchetype === "ABB" ? "A" : "Lead",
      roleLabel: resolvedArchetype === "ABB" ? "[A] Lead" : "[Lead] Starter"
    },
    {
      leadBr: orderedEvals[1].leadBr,
      swapBr: orderedEvals[1].swapBr,
      closerBr: orderedEvals[1].closerBr,
      roleCode: resolvedArchetype === "ABB" ? "B1" : "Swap",
      roleLabel: resolvedArchetype === "ABB" ? "[B1] Bait Swap" : "[Swap] Safe Swap"
    },
    {
      leadBr: orderedEvals[2].leadBr,
      swapBr: orderedEvals[2].swapBr,
      closerBr: orderedEvals[2].closerBr,
      roleCode: resolvedArchetype === "ABB" ? "B2" : "Closer",
      roleLabel: resolvedArchetype === "ABB" ? "[B2] Sweeper" : "[Closer] Anchor"
    }
  ];

  const reasonSummary =
    resolvedArchetype === "ABB"
      ? detectedSharedWeaknesses.length > 0
        ? `ABB Backline shares ${detectedSharedWeaknesses.map((t) => t.toUpperCase()).join("/")} weakness covered by ${orderedPokemon[0].name} lead. ${orderedPokemon[1].name} placed in Slot 2 as Bait Swap (Swap BR ${safeSwapBr}) • Core BR ${machineAggBr}.`
        : `ABB Lineup: ${orderedPokemon[0].name} (Lead A) covers ${orderedPokemon[1].name} (Bait B1, Swap BR ${safeSwapBr}) & ${orderedPokemon[2].name} (Sweeper B2, Swap BR ${closerSwapBr}) • Core BR ${machineAggBr}.`
      : `ABC Balanced Core: ${orderedPokemon[0].name} Lead (Lead BR ${leadAggBr}), ${orderedPokemon[1].name} selected as Slot 2 Safe Swap (Swap BR ${safeSwapBr} vs ${closerSwapBr}) • Core BR ${machineAggBr}.`;

  return {
    orderedPokemon,
    archetype: resolvedArchetype,
    sharedWeaknesses: detectedSharedWeaknesses,
    leadAggBr,
    machineAggBr,
    safeSwapBr,
    closerSwapBr,
    closerBr,
    seasonMatchCount: blendedMeta.seasonMatchCount,
    wHistPct: Math.round(blendedMeta.wHist * 100),
    wMetaPct: Math.round(blendedMeta.wMeta * 100),
    slotMetrics,
    reasonSummary
  };
}

/**
 * Evaluates a TeamPreset's aggregate metrics in-place (preserving current slot order)
 * using the current-season blended meta distribution.
 */
export function evaluateTeamPresetMetrics(
  preset: TeamPreset,
  seasonBattleLogs?: Array<{ timestampMs: number; league: string; opponents: string[] }>,
  currentSeasonOrStartMs?: { startMs: number; endMs: number } | number,
  cachedBlendedMetaOrEndMs?: BlendedSeasonMetaDistribution | number,
  reorderSlotsArg?: boolean
): TeamPreset {
  const currentSeason =
    typeof currentSeasonOrStartMs === "number" && typeof cachedBlendedMetaOrEndMs === "number"
      ? { startMs: currentSeasonOrStartMs, endMs: cachedBlendedMetaOrEndMs }
      : typeof currentSeasonOrStartMs === "object"
      ? currentSeasonOrStartMs
      : undefined;
  const cachedBlendedMeta =
    typeof cachedBlendedMetaOrEndMs === "object" ? cachedBlendedMetaOrEndMs : undefined;
  const reorderSlots = reorderSlotsArg ?? false;

  const res = evaluateOrAutoOrderTeam(preset.pokemon, preset.league, {
    reorderSlots,
    manualArchetypeOverride: reorderSlots
      ? undefined
      : preset.isArchetypeManual
      ? preset.archetype
      : undefined,
    seasonBattleLogs,
    currentSeason,
    cachedBlendedMeta
  });
  return {
    ...preset,
    pokemon: reorderSlots ? res.orderedPokemon : preset.pokemon,
    archetype: res.archetype,
    isArchetypeManual: reorderSlots ? false : preset.isArchetypeManual,
    leadAggBr: res.leadAggBr,
    machineAggBr: res.machineAggBr,
    safeSwapBr: res.safeSwapBr,
    closerSwapBr: res.closerSwapBr,
    closerBr: res.closerBr,
    sharedWeaknesses: res.sharedWeaknesses,
    metricsUpdatedAt: Date.now()
  };
}

/**
 * Recalculates Lead Agg BR, Core Coverage BR (Core BR), Safe Swap BR, Closer Swap BR, and Archetype
 * across all saved team presets using the latest current-season battle logs and PvPoke Top-100 rankings.
 */
export function recalculateAllPresetsMetrics(
  presets: TeamPreset[],
  seasonBattleLogs?: Array<{ timestampMs: number; league: string; opponents: string[] }>,
  currentSeasonOrStartMs?: { startMs: number; endMs: number } | number,
  seasonEndMs?: number
): TeamPreset[] {
  const currentSeason =
    typeof currentSeasonOrStartMs === "number" && typeof seasonEndMs === "number"
      ? { startMs: currentSeasonOrStartMs, endMs: seasonEndMs }
      : typeof currentSeasonOrStartMs === "object"
      ? currentSeasonOrStartMs
      : undefined;
  const metaCacheByLeague = new Map<string, BlendedSeasonMetaDistribution>();
  return (presets || []).map((preset) => {
    const lg = (preset.league || "GREAT LEAGUE").toUpperCase();
    let blended = metaCacheByLeague.get(lg);
    if (!blended) {
      blended = computeBlendedSeasonMeta(lg, seasonBattleLogs, currentSeason);
      metaCacheByLeague.set(lg, blended);
    }
    return evaluateTeamPresetMetrics(preset, seasonBattleLogs, currentSeason, blended);
  });
}

export const INITIAL_PRESETS: TeamPreset[] = recalculateAllPresetsMetrics([
  {
    id: "preset-ml-1",
    name: "Master: Palkia-O / Zacian-C / Dialga-O",
    league: "MASTER LEAGUE",
    isSelected: true,
    pokemon: getLeagueTop3Template("MASTER LEAGUE")
  },
  {
    id: "preset-ul-1",
    name: "Ultra: Zygarde / Feraligatr / Giratina-A",
    league: "ULTRA LEAGUE",
    pokemon: getLeagueTop3Template("ULTRA LEAGUE")
  },
  {
    id: "preset-gl-1",
    name: "Great: Clodsire / Feraligatr / Mandibuzz",
    league: "GREAT LEAGUE",
    pokemon: getLeagueTop3Template("GREAT LEAGUE")
  }
]);

export interface RoleUpgradeSuggestion {
  roleIndex: 0 | 1 | 2;
  roleLabel: string;
  candidate: TeamMember;
  newMachineBr: number;
  newMachineAggBr: number;
  deltaMachineBr: number;
  deltaMachBr: number;
  newRoleBr: number;
  deltaRoleBr: number;
  compositeUpgradeScore: number;
  newArchetype: "ABB" | "ABC";
  synergyNote: string;
  summaryBadge: string;
}

export interface TeamRoleRecommendationsResult {
  baselineEval: TeamDetectionResult;
  leadUpgrades: RoleUpgradeSuggestion[];
  safeSwapUpgrades: RoleUpgradeSuggestion[];
  closerUpgrades: RoleUpgradeSuggestion[];
  slot1LeadUpgrades: RoleUpgradeSuggestion[];
  slot2SafeSwapUpgrades: RoleUpgradeSuggestion[];
  slot3CloserUpgrades: RoleUpgradeSuggestion[];
  candidatePoolSize: number;
  candidatesEvaluated: number;
  currentLeadBr: number;
  currentSafeSwapBr: number;
  currentCloserBr: number;
}

function isShadowEligibleForTop100(name: string, baseSpecies: string): boolean {
  const lower = name.toLowerCase();
  const baseLower = baseSpecies.toLowerCase();
  if (lower.startsWith("shadow ") || lower.startsWith("mega ") || lower.startsWith("primal ")) return false;
  const nonShadowBases = new Set([
    "zygarde", "zacian", "zamazenta", "palkia", "dialga", "giratina", "necrozma",
    "xerneas", "yveltal", "solgaleo", "lunala", "meloetta", "keldeo", "marshadow",
    "zarude", "rayquaza", "kyurem", "reshiram", "zekrom", "cobalion", "virizion",
    "terrakion", "tapu", "azumarill", "clodsire", "mandibuzz", "annihilape",
    "dunsparce", "malamar", "gastrodon", "lickilicky", "talonflame", "corviknight",
    "wigglytuff", "clefable", "skeledirge", "greninja", "morpeko", "mimikyu",
    "aegislash", "cramorant", "florges", "primarina", "deoxys", "urshifu"
  ]);
  return !nonShadowBases.has(baseLower);
}

/**
 * Returns up to `maxCount` (default 200) Top Meta candidate Pokémon for the selected league,
 * including eligible Shadow variants, for simulating role upgrades.
 */
export function getTop100MetaCandidatesForLeague(league: string, maxCount: number = 200): TeamMember[] {
  const upper = (league || "GREAT LEAGUE").toUpperCase();
  const normLeague = upper.includes("MEGA")
    ? "MEGA MASTER LEAGUE"
    : upper.includes("GREAT")
    ? "GREAT LEAGUE"
    : upper.includes("ULTRA")
    ? "ULTRA LEAGUE"
    : "MASTER LEAGUE";

  const results: TeamMember[] = [];
  const seenNames = new Set<string>();

  const tryAddCandidate = (rawName: string) => {
    if (results.length >= maxCount) return;
    const trimmed = (rawName || "").trim();
    if (!trimmed) return;
    if (normLeague !== "MEGA MASTER LEAGUE" && /^Mega\s+|^Primal\s+/i.test(trimmed)) return;
    const rec = getRecommendedMovesForPokemon(trimmed, normLeague);
    if (!rec) return;
    const key = rec.name.toLowerCase();
    if (seenNames.has(key)) return;
    seenNames.add(key);
    results.push({
      id: `cand-${results.length + 1}`,
      name: rec.name,
      cp: rec.cp,
      fastMove: rec.fastMove,
      chargedMove1: rec.chargedMove1,
      chargedMove2: rec.chargedMove2,
      ivs: rec.defaultIvs
    });
  };

  // 1. Live PvPoke Top-200 Rankings for the league (includes both normal and Shadow entries)
  const liveMap = LIVE_RANKINGS_MAP[normLeague];
  if (liveMap && liveMap.size > 0) {
    const sorted = Array.from(liveMap.values()).sort((a, b) => b.score - a.score);
    for (const entry of sorted) {
      if (results.length >= maxCount) break;
      const sid = entry.speciesId.toLowerCase();
      const isShad = sid.endsWith("_shadow");
      const cleanSid = sid.replace(/_shadow$/i, "");
      const matchedMon =
        Object.values(POKEMON_DATABASE).find((p) => p.speciesId.toLowerCase() === sid) ||
        Object.values(POKEMON_DATABASE).find((p) => p.speciesId.toLowerCase() === cleanSid);
      if (matchedMon) {
        const displayName =
          isShad && !matchedMon.name.toLowerCase().startsWith("shadow ")
            ? `Shadow ${matchedMon.name}`
            : matchedMon.name;
        tryAddCandidate(displayName);
      }
    }
  }

  // 2. Fallback curated league meta + POKEMON_DATABASE species + eligible Shadow variants up to maxCount (200)
  if (results.length < maxCount) {
    for (const name of getLeagueTopMetaSpeciesNames(normLeague, maxCount)) {
      tryAddCandidate(name);
      const dbEntry = POKEMON_DATABASE[name];
      const baseSp = extractBaseSpeciesKey(name, dbEntry?.speciesId, dbEntry?.baseSpecies);
      if (isShadowEligibleForTop100(name, baseSp)) {
        tryAddCandidate(`Shadow ${name}`);
      }
    }
  }

  if (results.length < maxCount) {
    for (const mon of Object.values(POKEMON_DATABASE)) {
      if (results.length >= maxCount) break;
      const cap = normLeague === "GREAT LEAGUE" ? 1500 : normLeague === "ULTRA LEAGUE" ? 2500 : 10000;
      const scaled = computeEffectiveStatsForLeague(mon, normLeague);
      if (cap >= 9000 && scaled.resolvedCp < 2600) continue;
      tryAddCandidate(mon.name);
      const baseSp = extractBaseSpeciesKey(mon.name, mon.speciesId, mon.baseSpecies);
      if (isShadowEligibleForTop100(mon.name, baseSp)) {
        tryAddCandidate(`Shadow ${mon.name}`);
      }
    }
  }

  return results.slice(0, maxCount);
}

/**
 * Simulates the Top 200 Meta Pokémon for the selected league against the Top 100 Blended Meta
 * across each of the 3 team roles (Lead, Safe Swap, Closer), enforcing the GBL Species Clause
 * and including Shadow variants, and returns the Top 5 recommended upgrades for each role
 * ranked by Full Team Synergy (Core BR Delta) + Role Rating Delta.
 */
export function recommendTop3UpgradesPerRole(
  members: TeamMember[],
  league: string,
  optionsOrLogs?:
    | {
        manualArchetypeOverride?: "ABB" | "ABC";
        seasonBattleLogs?: Array<{ timestampMs: number; league: string; opponents: string[] }>;
        currentSeason?: { startMs: number; endMs: number };
      }
    | Array<{ timestampMs: number; league: string; opponents: string[] }>,
  seasonStartMs?: number,
  seasonEndMs?: number,
  manualArchetypeOverrideArg?: "ABB" | "ABC"
): TeamRoleRecommendationsResult {
  const options = Array.isArray(optionsOrLogs)
    ? {
        seasonBattleLogs: optionsOrLogs,
        currentSeason:
          typeof seasonStartMs === "number" && typeof seasonEndMs === "number"
            ? { startMs: seasonStartMs, endMs: seasonEndMs }
            : undefined,
        manualArchetypeOverride: manualArchetypeOverrideArg
      }
    : optionsOrLogs;

  const blendedMeta = computeBlendedSeasonMeta(league, options?.seasonBattleLogs, options?.currentSeason);
  const safeSlots = (members || []).slice(0, 3);
  const baselineEval = evaluateOrAutoOrderTeam(safeSlots, league, {
    reorderSlots: false,
    manualArchetypeOverride: options?.manualArchetypeOverride,
    cachedBlendedMeta: blendedMeta
  });

  if (safeSlots.length < 3) {
    return {
      baselineEval,
      leadUpgrades: [],
      safeSwapUpgrades: [],
      closerUpgrades: [],
      slot1LeadUpgrades: [],
      slot2SafeSwapUpgrades: [],
      slot3CloserUpgrades: [],
      candidatePoolSize: 0,
      candidatesEvaluated: 0,
      currentLeadBr: baselineEval.leadAggBr,
      currentSafeSwapBr: baselineEval.safeSwapBr,
      currentCloserBr: baselineEval.closerBr
    };
  }

  // Depth of 200 candidates for simulating better options for the team
  const candidates = getTop100MetaCandidatesForLeague(league, 200);
  if (candidates.length === 0) {
    return {
      baselineEval,
      leadUpgrades: [],
      safeSwapUpgrades: [],
      closerUpgrades: [],
      slot1LeadUpgrades: [],
      slot2SafeSwapUpgrades: [],
      slot3CloserUpgrades: [],
      candidatePoolSize: 0,
      candidatesEvaluated: 0,
      currentLeadBr: baselineEval.leadAggBr,
      currentSafeSwapBr: baselineEval.safeSwapBr,
      currentCloserBr: baselineEval.closerBr
    };
  }

  // Precompute single-slot metrics and position-weighted BR against the Top-100 field for all Top-200 candidates + current 3 slots
  const singleMetricsCache = new Map<string, SlotEvaluatedMetrics>();
  const pwMatrixCache = new Map<string, Map<string, PositionWeightedMatchupRatings>>();

  const getSingleMetrics = (m: TeamMember): SlotEvaluatedMetrics => {
    const key = `${m.name.toLowerCase()}|${m.fastMove}|${m.chargedMove1}|${m.chargedMove2}`;
    const existing = singleMetricsCache.get(key);
    if (existing) return existing;
    const computed = evaluateSingleSlotAgainstBlendedMeta(m, league, blendedMeta);
    singleMetricsCache.set(key, computed);
    return computed;
  };

  const getPwMap = (m: TeamMember): Map<string, PositionWeightedMatchupRatings> => {
    const key = `${m.name.toLowerCase()}|${m.fastMove}|${m.chargedMove1}|${m.chargedMove2}`;
    const existing = pwMatrixCache.get(key);
    if (existing) return existing;
    const map = new Map<string, PositionWeightedMatchupRatings>();
    for (const oppName of blendedMeta.fieldProbabilities.keys()) {
      map.set(oppName, evaluatePositionWeightedBr(m, oppName, league));
    }
    pwMatrixCache.set(key, map);
    return map;
  };

  safeSlots.forEach((s) => {
    getSingleMetrics(s);
    getPwMap(s);
  });
  candidates.forEach((c) => {
    getSingleMetrics(c);
    getPwMap(c);
  });

  const getBaseSpeciesForMember = (m: TeamMember): string => {
    const clean = m.name.replace(/^Shadow\s+/i, "").trim();
    const dbEntry = POKEMON_DATABASE[m.name] || POKEMON_DATABASE[clean];
    return extractBaseSpeciesKey(m.name, dbEntry?.speciesId, dbEntry?.baseSpecies);
  };

  const evaluateRoleCandidates = (roleIndex: 0 | 1 | 2): RoleUpgradeSuggestion[] => {
    const currentMember = safeSlots[roleIndex];
    const otherIndices = [0, 1, 2].filter((idx) => idx !== roleIndex);
    const otherBaseSpecies = otherIndices.map((idx) => getBaseSpeciesForMember(safeSlots[idx]));
    const otherHasMega = otherIndices.some((idx) => /^Mega\s+|^Primal\s+/i.test(safeSlots[idx].name));

    const baselineRoleBr =
      roleIndex === 0
        ? baselineEval.leadAggBr
        : roleIndex === 1
        ? baselineEval.safeSwapBr
        : baselineEval.closerBr;

    const roleLabel =
      roleIndex === 0
        ? baselineEval.archetype === "ABB"
          ? "Lead A"
          : "Lead"
        : roleIndex === 1
        ? baselineEval.archetype === "ABB"
          ? "Bait Swap B1"
          : "Safe Swap"
        : baselineEval.archetype === "ABB"
        ? "Sweeper B2"
        : "Closer";

    const roleMetricShort =
      roleIndex === 0 ? "Lead" : roleIndex === 1 ? "Swap" : "Close";

    const scoredList: RoleUpgradeSuggestion[] = [];

    for (const cand of candidates) {
      if (cand.name.toLowerCase() === currentMember.name.toLowerCase()) continue;
      const candBase = getBaseSpeciesForMember(cand);
      // GBL Species Clause: cannot duplicate baseSpecies of either of the other two teammates
      if (otherBaseSpecies.includes(candBase)) continue;
      // Single Mega/Primal rule
      if (otherHasMega && /^Mega\s+|^Primal\s+/i.test(cand.name)) continue;

      const trialTeam: [TeamMember, TeamMember, TeamMember] = [
        roleIndex === 0 ? cand : safeSlots[0],
        roleIndex === 1 ? cand : safeSlots[1],
        roleIndex === 2 ? cand : safeSlots[2]
      ];

      const m0 = getSingleMetrics(trialTeam[0]);
      const m1 = getSingleMetrics(trialTeam[1]);
      const m2 = getSingleMetrics(trialTeam[2]);

      const pw0 = getPwMap(trialTeam[0]);
      const pw1 = getPwMap(trialTeam[1]);
      const pw2 = getPwMap(trialTeam[2]);

      let machSum = 0;
      for (const [oppName, prob] of blendedMeta.fieldProbabilities.entries()) {
        const r0 = pw0.get(oppName)?.leadBr ?? 500;
        const r1 = pw1.get(oppName)?.swapBr ?? 500;
        const r2 = pw2.get(oppName)?.closerBr ?? 500;
        machSum += prob * Math.max(r0, r1, r2);
      }
      const newMachineBr = Math.round(machSum);
      const newRoleBr =
        roleIndex === 0 ? m0.leadBr : roleIndex === 1 ? m1.swapBr : m2.closerBr;

      const deltaMachineBr = newMachineBr - baselineEval.machineAggBr;
      const deltaRoleBr = newRoleBr - baselineRoleBr;

      // Defensive coverage synergy bonus
      const w0 = new Set(m0.weaknesses);
      const w1 = new Set(m1.weaknesses);
      const w2 = new Set(m2.weaknesses);
      const r0 = new Set(m0.resistances);
      const r1 = new Set(m1.resistances);
      const r2 = new Set(m2.resistances);

      let uncoveredTripleOrDoubleWeaknesses = 0;
      let coveredWeaknessesCount = 0;
      for (const t of ALL_18_TYPES) {
        const weakCount = (w0.has(t) ? 1 : 0) + (w1.has(t) ? 1 : 0) + (w2.has(t) ? 1 : 0);
        const resistCount = (r0.has(t) ? 1 : 0) + (r1.has(t) ? 1 : 0) + (r2.has(t) ? 1 : 0);
        if (weakCount >= 2 && resistCount === 0) {
          uncoveredTripleOrDoubleWeaknesses += weakCount;
        } else if (weakCount >= 1 && resistCount >= 1) {
          coveredWeaknessesCount += 1;
        }
      }

      const backShared = m1.weaknesses.filter((w) => w2.has(w));
      const leadCoversBack = backShared.length >= 2 && backShared.every((w) => r0.has(w) || !w0.has(w));
      const newArchetype: "ABB" | "ABC" =
        options?.manualArchetypeOverride || (leadCoversBack ? "ABB" : "ABC");

      const coverageBonus = coveredWeaknessesCount * 1.5 - uncoveredTripleOrDoubleWeaknesses * 6.0;
      const compositeUpgradeScore = Number(
        (0.55 * deltaMachineBr + 0.45 * deltaRoleBr + coverageBonus).toFixed(2)
      );

      let synergyNote = "";
      if (roleIndex === 0) {
        const coveredForBack = [...w1, ...w2].filter((w, i, a) => a.indexOf(w) === i && r0.has(w));
        synergyNote =
          coveredForBack.length > 0
            ? `Covers backline ${coveredForBack.slice(0, 2).map((x) => x.toUpperCase()).join("/")} weakness`
            : `Stronger ${newArchetype} Lead pressure`;
      } else if (roleIndex === 1) {
        const coveredForLead = m0.weaknesses.filter((w) => r1.has(w));
        synergyNote =
          coveredForLead.length > 0
            ? `Pivots into Lead's ${coveredForLead.slice(0, 2).map((x) => x.toUpperCase()).join("/")} threats`
            : `Higher volatility-adjusted Safe Swap consistency`;
      } else {
        const coveredForCore = [...w0, ...w1].filter((w, i, a) => a.indexOf(w) === i && r2.has(w));
        synergyNote =
          coveredForCore.length > 0
            ? `Walls core ${coveredForCore.slice(0, 2).map((x) => x.toUpperCase()).join("/")} threats in 0s endgame`
            : `Superior 0-shield Closer sweep rating`;
      }

      const fmtCoreDelta = deltaMachineBr >= 0 ? `+${deltaMachineBr}` : `${deltaMachineBr}`;
      const fmtRoleDelta = deltaRoleBr >= 0 ? `+${deltaRoleBr}` : `${deltaRoleBr}`;
      const summaryBadge = `Core ${newMachineBr} (${fmtCoreDelta}) • ${roleMetricShort} ${newRoleBr} (${fmtRoleDelta})`;

      scoredList.push({
        roleIndex,
        roleLabel,
        candidate: {
          ...cand,
          id: currentMember.id || `slot-${roleIndex + 1}`
        },
        newMachineBr,
        newMachineAggBr: newMachineBr,
        deltaMachineBr,
        deltaMachBr: deltaMachineBr,
        newRoleBr,
        deltaRoleBr,
        compositeUpgradeScore,
        newArchetype,
        synergyNote,
        summaryBadge
      });
    }

    scoredList.sort((a, b) => b.compositeUpgradeScore - a.compositeUpgradeScore);

    // Pick Top 5 distinct baseSpecies per role so all 5 replacement chips offer diverse species choices
    const picked: RoleUpgradeSuggestion[] = [];
    const usedBases = new Set<string>();
    for (const item of scoredList) {
      const b = getBaseSpeciesForMember(item.candidate);
      if (!usedBases.has(b)) {
        usedBases.add(b);
        picked.push(item);
        if (picked.length >= 5) break;
      }
    }
    if (picked.length < 5) {
      for (const item of scoredList) {
        if (!picked.some((p) => p.candidate.name.toLowerCase() === item.candidate.name.toLowerCase())) {
          picked.push(item);
          if (picked.length >= 5) break;
        }
      }
    }
    return picked;
  };

  const leadUpgrades = evaluateRoleCandidates(0);
  const safeSwapUpgrades = evaluateRoleCandidates(1);
  const closerUpgrades = evaluateRoleCandidates(2);

  return {
    baselineEval,
    leadUpgrades,
    safeSwapUpgrades,
    closerUpgrades,
    slot1LeadUpgrades: leadUpgrades,
    slot2SafeSwapUpgrades: safeSwapUpgrades,
    slot3CloserUpgrades: closerUpgrades,
    candidatePoolSize: candidates.length,
    candidatesEvaluated: candidates.length,
    currentLeadBr: baselineEval.leadAggBr,
    currentSafeSwapBr: baselineEval.safeSwapBr,
    currentCloserBr: baselineEval.closerBr
  };
}




