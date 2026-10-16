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
  ivs?: string;
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
    baseStats: { atk: 232, def: 215, hp: 173 },
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
    baseStats: { atk: 225, def: 260, hp: 173 },
    defaultFastMove: { name: "Metal Claw", type: "steel", turns: 2, power: 5, energyGain: 7 },
    chargedMoves: [
      { name: "Behemoth Bash", code: "BBs", type: "steel", power: 80, energyCost: 45 },
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Moonblast", code: "MB", type: "fairy", power: 110, energyCost: 60 }
    ],
    color: "#ef4444"
  },
  "Zamazenta (Hero)": {
    speciesId: "zamazenta_hero",
    name: "Zamazenta (Hero)",
    baseSpecies: "zamazenta",
    formLabel: "Hero",
    types: ["fighting"],
    baseStats: { atk: 232, def: 215, hp: 173 },
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Crunch", code: "Cr", type: "dark", power: 70, energyCost: 45 },
      { name: "Moonblast", code: "MB", type: "fairy", power: 110, energyCost: 60 }
    ],
    color: "#f87171"
  },
  "Keldeo (Resolute)": {
    speciesId: "keldeo_resolute",
    name: "Keldeo (Resolute)",
    baseSpecies: "keldeo",
    formLabel: "Resolute",
    types: ["water", "fighting"],
    baseStats: { atk: 234, def: 171, hp: 188 },
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
    baseStats: { atk: 234, def: 171, hp: 188 },
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
      { name: "Air Cutter", code: "AC", type: "flying", power: 60, energyCost: 55 },
      { name: "Iron Head", code: "IH", type: "steel", power: 70, energyCost: 50 },
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
    defaultFastMove: { name: "Ember", type: "fire", turns: 2, power: 10, energyGain: 6 },
    chargedMoves: [
      { name: "Weather Ball", code: "WB", type: "fire", power: 55, energyCost: 35 },
      { name: "Energy Ball", code: "EB", type: "grass", power: 90, energyCost: 55 },
      { name: "Overheat", code: "OH", type: "fire", power: 130, energyCost: 55 }
    ],
    color: "#f97316"
  },
  Tinkaton: {
    speciesId: "tinkaton",
    name: "Tinkaton",
    baseSpecies: "tinkaton",
    formLabel: "Base",
    types: ["fairy", "steel"],
    baseStats: { atk: 138, def: 176, hp: 166 },
    defaultFastMove: { name: "Fairy Wind", type: "fairy", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Gigaton Hammer", code: "GH", type: "steel", power: 130, energyCost: 60 },
      { name: "Bulldoze", code: "BD", type: "ground", power: 80, energyCost: 55 },
      { name: "Brutal Swing", code: "BS", type: "dark", power: 65, energyCost: 40 }
    ],
    color: "#ec4899"
  },
  Rillaboom: {
    speciesId: "rillaboom",
    name: "Rillaboom",
    baseSpecies: "rillaboom",
    formLabel: "Base",
    types: ["grass"],
    baseStats: { atk: 178, def: 138, hp: 172 },
    defaultFastMove: { name: "Scratch", type: "normal", turns: 1, power: 4, energyGain: 2 },
    chargedMoves: [
      { name: "Drum Beating", code: "DB", type: "grass", power: 60, energyCost: 35 },
      { name: "Earth Power", code: "EP", type: "ground", power: 90, energyCost: 55 },
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
  },
  "Kyurem (Black)": {
    speciesId: "kyurem_black",
    name: "Kyurem (Black)",
    baseSpecies: "kyurem",
    formLabel: "Black",
    types: ["dragon", "ice"],
    baseStats: { atk: 278, def: 171, hp: 218 },
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Freeze Shock", code: "FS", type: "ice", power: 160, energyCost: 60 },
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
    baseStats: { atk: 278, def: 171, hp: 218 },
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 4, energyGain: 3 },
    chargedMoves: [
      { name: "Ice Burn", code: "IB", type: "ice", power: 160, energyCost: 60 },
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
    baseStats: { atk: 219, def: 154, hp: 218 },
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 4, energyGain: 3 },
    chargedMoves: [
      { name: "Glaciate", code: "Gl", type: "ice", power: 60, energyCost: 40 },
      { name: "Dragon Claw", code: "DC", type: "dragon", power: 50, energyCost: 35 },
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
    baseStats: { atk: 259, def: 202, hp: 169 },
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 4, energyGain: 3 },
    chargedMoves: [
      { name: "Spacial Rend", code: "SR", type: "dragon", power: 100, energyCost: 50 },
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
    baseStats: { atk: 249, def: 200, hp: 179 },
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Sunsteel Strike", code: "SS", type: "steel", power: 135, energyCost: 65 },
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 50 },
      { name: "Iron Head", code: "IH", type: "steel", power: 70, energyCost: 50 }
    ],
    color: "#f59e0b"
  },
  "Necrozma (Dawn Wings)": {
    speciesId: "necrozma_dawn_wings",
    name: "Necrozma (Dawn Wings)",
    baseSpecies: "necrozma",
    formLabel: "Dawn Wings",
    types: ["psychic", "ghost"],
    baseStats: { atk: 249, def: 200, hp: 179 },
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Moongeist Beam", code: "MB", type: "ghost", power: 135, energyCost: 65 },
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 50 },
      { name: "Iron Head", code: "IH", type: "steel", power: 70, energyCost: 50 }
    ],
    color: "#8b5cf6"
  },
  "Landorus (Therian)": {
    speciesId: "landorus_therian",
    name: "Landorus (Therian)",
    baseSpecies: "landorus",
    formLabel: "Therian",
    types: ["ground", "flying"],
    baseStats: { atk: 259, def: 164, hp: 182 },
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
    baseStats: { atk: 216, def: 219, hp: 193 },
    defaultFastMove: { name: "Incinerate", type: "fire", turns: 5, power: 20, energyGain: 20 },
    chargedMoves: [
      { name: "Sacred Fire", code: "SF", type: "fire", power: 130, energyCost: 65 },
      { name: "Brave Bird", code: "BB", type: "flying", power: 130, energyCost: 55 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 110, energyCost: 65 }
    ],
    color: "#ef4444"
  },
  "Mewtwo": {
    speciesId: "mewtwo",
    name: "Mewtwo",
    baseSpecies: "mewtwo",
    formLabel: "Base",
    types: ["psychic"],
    baseStats: { atk: 266, def: 166, hp: 193 },
    defaultFastMove: { name: "Psycho Cut", type: "psychic", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Psystrike", code: "PS", type: "psychic", power: 90, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 100, energyCost: 55 },
      { name: "Focus Blast", code: "FB", type: "fighting", power: 150, energyCost: 75 }
    ],
    color: "#c084fc"
  },
  "Feraligatr": {
    speciesId: "feraligatr",
    name: "Feraligatr",
    baseSpecies: "feraligatr",
    formLabel: "Base",
    types: ["water"],
    baseStats: { atk: 164, def: 155, hp: 161 },
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
    baseStats: { atk: 124, def: 215, hp: 197 },
    defaultFastMove: { name: "Psycho Cut", type: "psychic", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Grass Knot", code: "GK", type: "grass", power: 90, energyCost: 50 },
      { name: "Moonblast", code: "MB", type: "fairy", power: 110, energyCost: 60 },
      { name: "Future Sight", code: "FS", type: "psychic", power: 120, energyCost: 65 }
    ],
    color: "#e879f9"
  },
  "Registeel": {
    speciesId: "registeel",
    name: "Registeel",
    baseSpecies: "registeel",
    formLabel: "Base",
    types: ["steel"],
    baseStats: { atk: 118, def: 236, hp: 162 },
    defaultFastMove: { name: "Lock-On", type: "normal", turns: 1, power: 1, energyGain: 5 },
    chargedMoves: [
      { name: "Focus Blast", code: "FB", type: "fighting", power: 150, energyCost: 75 },
      { name: "Zap Cannon", code: "ZC", type: "electric", power: 150, energyCost: 75 },
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
    baseStats: { atk: 152, def: 182, hp: 169 },
    defaultFastMove: { name: "Double Kick", type: "fighting", turns: 3, power: 8, energyGain: 12 },
    chargedMoves: [
      { name: "Sacred Sword", code: "SS", type: "fighting", power: 60, energyCost: 35 },
      { name: "Stone Edge", code: "SE", type: "rock", power: 100, energyCost: 55 },
      { name: "Iron Head", code: "IH", type: "steel", power: 70, energyCost: 50 }
    ],
    color: "#0284c7"
  },
  "Lickilicky": {
    speciesId: "lickilicky",
    name: "Lickilicky",
    baseSpecies: "lickilicky",
    formLabel: "Base",
    types: ["normal"],
    baseStats: { atk: 136, def: 152, hp: 190 },
    defaultFastMove: { name: "Rollout", type: "rock", turns: 3, power: 8, energyGain: 13 },
    chargedMoves: [
      { name: "Body Slam", code: "BS", type: "normal", power: 60, energyCost: 35 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 100, energyCost: 55 },
      { name: "Earthquake", code: "EQ", type: "ground", power: 110, energyCost: 65 }
    ],
    color: "#f472b6"
  },
  "Annihilape": {
    speciesId: "annihilape",
    name: "Annihilape",
    baseSpecies: "annihilape",
    formLabel: "Base",
    types: ["fighting", "ghost"],
    baseStats: { atk: 198, def: 162, hp: 215 },
    defaultFastMove: { name: "Counter", type: "fighting", turns: 2, power: 8, energyGain: 7 },
    chargedMoves: [
      { name: "Rage Fist", code: "RF", type: "ghost", power: 50, energyCost: 35 },
      { name: "Ice Punch", code: "IP", type: "ice", power: 55, energyCost: 40 },
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
    baseStats: { atk: 159, def: 143, hp: 169 },
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
    baseStats: { atk: 89, def: 123, hp: 222 },
    defaultFastMove: { name: "Poison Sting", type: "poison", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Earthquake", code: "EQ", type: "ground", power: 110, energyCost: 65 },
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
    baseStats: { atk: 118, def: 191, hp: 208 },
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 50 },
      { name: "Aerial Ace", code: "AA", type: "flying", power: 55, energyCost: 40 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 100, energyCost: 55 }
    ],
    color: "#52525b"
  },
  "Azumarill": {
    speciesId: "azumarill",
    name: "Azumarill",
    baseSpecies: "azumarill",
    formLabel: "Base",
    types: ["water", "fairy"],
    baseStats: { atk: 94, def: 132, hp: 188 },
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
    baseStats: { atk: 112, def: 115, hp: 182 },
    defaultFastMove: { name: "Mud-Slap", type: "ground", turns: 3, power: 11, energyGain: 10 },
    chargedMoves: [
      { name: "Body Slam", code: "BS", type: "normal", power: 60, energyCost: 35 },
      { name: "Earth Power", code: "EP", type: "ground", power: 90, energyCost: 55 },
      { name: "Water Pulse", code: "WP", type: "water", power: 70, energyCost: 60 }
    ],
    color: "#14b8a6"
  },
  "Malamar": {
    speciesId: "malamar",
    name: "Malamar",
    baseSpecies: "malamar",
    formLabel: "Base",
    types: ["dark", "psychic"],
    baseStats: { atk: 118, def: 124, hp: 154 },
    defaultFastMove: { name: "Psywave", type: "psychic", turns: 1, power: 3, energyGain: 4 },
    chargedMoves: [
      { name: "Foul Play", code: "FP", type: "dark", power: 70, energyCost: 45 },
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
    baseStats: { atk: 104, def: 108, hp: 178 },
    defaultFastMove: { name: "Rollout", type: "rock", turns: 3, power: 8, energyGain: 13 },
    chargedMoves: [
      { name: "Rock Slide", code: "RS", type: "rock", power: 75, energyCost: 45 },
      { name: "Drill Run", code: "DR", type: "ground", power: 80, energyCost: 45 },
      { name: "Dig", code: "Dg", type: "ground", power: 80, energyCost: 50 }
    ],
    color: "#eab308"
  },
  "Sandslash (Alolan)": {
    speciesId: "sandslash_alolan",
    name: "Sandslash (Alolan)",
    baseSpecies: "sandslash",
    formLabel: "Alolan",
    types: ["ice", "steel"],
    baseStats: { atk: 115, def: 139, hp: 132 },
    defaultFastMove: { name: "Powder Snow", type: "ice", turns: 2, power: 5, energyGain: 8 },
    chargedMoves: [
      { name: "Ice Punch", code: "IP", type: "ice", power: 55, energyCost: 40 },
      { name: "Drill Run", code: "DR", type: "ground", power: 80, energyCost: 45 },
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
    baseStats: { atk: 132, def: 108, hp: 128 },
    defaultFastMove: { name: "Karate Chop", type: "fighting", turns: 2, power: 7, energyGain: 9 },
    chargedMoves: [
      { name: "Rage Fist", code: "RF", type: "ghost", power: 50, energyCost: 35 },
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Ice Punch", code: "IP", type: "ice", power: 55, energyCost: 40 }
    ],
    color: "#d97706"
  },
  "Morpeko": {
    speciesId: "morpeko",
    name: "Morpeko",
    baseSpecies: "morpeko",
    formLabel: "Full Belly",
    types: ["electric", "dark"],
    baseStats: { atk: 142, def: 96, hp: 114 },
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
    baseStats: { atk: 148, def: 144, hp: 176 },
    defaultFastMove: { name: "Fairy Wind", type: "fairy", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Meteor Mash", code: "MM", type: "steel", power: 100, energyCost: 50 },
      { name: "Moonblast", code: "MB", type: "fairy", power: 110, energyCost: 60 },
      { name: "Swift", code: "Sw", type: "normal", power: 60, energyCost: 40 }
    ],
    color: "#f472b6"
  },
  "Ampharos": {
    speciesId: "ampharos",
    name: "Ampharos",
    baseSpecies: "ampharos",
    formLabel: "Base",
    types: ["electric"],
    baseStats: { atk: 168, def: 142, hp: 172 },
    defaultFastMove: { name: "Volt Switch", type: "electric", turns: 4, power: 12, energyGain: 16 },
    chargedMoves: [
      { name: "Brutal Swing", code: "BS", type: "dark", power: 65, energyCost: 35 },
      { name: "Trailblaze", code: "TB", type: "grass", power: 65, energyCost: 50 },
      { name: "Zap Cannon", code: "ZC", type: "electric", power: 150, energyCost: 75 }
    ],
    color: "#eab308"
  },
  "Wigglytuff": {
    speciesId: "wigglytuff",
    name: "Wigglytuff",
    baseSpecies: "wigglytuff",
    formLabel: "Base",
    types: ["normal", "fairy"],
    baseStats: { atk: 109, def: 82, hp: 225 },
    defaultFastMove: { name: "Charm", type: "fairy", turns: 3, power: 15, energyGain: 6 },
    chargedMoves: [
      { name: "Icy Wind", code: "IW", type: "ice", power: 60, energyCost: 45 },
      { name: "Disarming Voice", code: "DV", type: "fairy", power: 70, energyCost: 45 },
      { name: "Swift", code: "Sw", type: "normal", power: 60, energyCost: 40 }
    ],
    color: "#ec4899"
  }
};

export interface TopOpponentInfo {
  rank: number;
  name: string;
  types: string[];
  fastMove: string;
  fastTurns: number;
  chargedMoves: string[];
}

export const PVPOKE_TOP_OPPONENTS: Record<string, TopOpponentInfo[]> = {
  "MASTER LEAGUE": [
    { rank: 1, name: "Palkia (Origin)", types: ["water", "dragon"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Spacial Rend", "Aqua Tail"] },
    { rank: 2, name: "Zacian (Crowned)", types: ["fairy", "steel"], fastMove: "Metal Claw", fastTurns: 2, chargedMoves: ["Behemoth Blade", "Close Combat"] },
    { rank: 3, name: "Dialga (Origin)", types: ["steel", "dragon"], fastMove: "Dragon Breath", fastTurns: 1, chargedMoves: ["Roar of Time", "Iron Head"] },
    { rank: 4, name: "Necrozma (Dusk Mane)", types: ["psychic", "steel"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Sunsteel Strike", "Dark Pulse"] },
    { rank: 5, name: "Landorus (Therian)", types: ["ground", "flying"], fastMove: "Mud Shot", fastTurns: 2, chargedMoves: ["Sandsear Storm", "Stone Edge"] },
    { rank: 6, name: "Necrozma (Dawn Wings)", types: ["psychic", "ghost"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Moongeist Beam", "Dark Pulse"] },
    { rank: 7, name: "Ho-Oh", types: ["fire", "flying"], fastMove: "Incinerate", fastTurns: 5, chargedMoves: ["Sacred Fire", "Brave Bird"] },
    { rank: 8, name: "Yveltal", types: ["dark", "flying"], fastMove: "Snarl", fastTurns: 3, chargedMoves: ["Dark Pulse", "Oblivion Wing"] },
    { rank: 9, name: "Giratina (Origin)", types: ["ghost", "dragon"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Shadow Ball", "Ominous Wind"] },
    { rank: 10, name: "Kyurem (Black)", types: ["dragon", "ice"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Freeze Shock", "Fusion Bolt"] }
  ],
  "ULTRA LEAGUE": [
    { rank: 1, name: "Zygarde", types: ["dragon", "ground"], fastMove: "Dragon Tail", fastTurns: 3, chargedMoves: ["Crunch", "Earthquake"] },
    { rank: 2, name: "Feraligatr", types: ["water"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Hydro Cannon", "Ice Beam"] },
    { rank: 3, name: "Giratina (Altered)", types: ["ghost", "dragon"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Dragon Claw", "Ancient Power"] },
    { rank: 4, name: "Cresselia", types: ["psychic"], fastMove: "Psycho Cut", fastTurns: 2, chargedMoves: ["Grass Knot", "Moonblast"] },
    { rank: 5, name: "Registeel", types: ["steel"], fastMove: "Lock-On", fastTurns: 1, chargedMoves: ["Focus Blast", "Zap Cannon"] },
    { rank: 6, name: "Cobalion", types: ["steel", "fighting"], fastMove: "Double Kick", fastTurns: 3, chargedMoves: ["Sacred Sword", "Stone Edge"] },
    { rank: 7, name: "Corviknight", types: ["flying", "steel"], fastMove: "Sand Attack", fastTurns: 1, chargedMoves: ["Air Cutter", "Iron Head"] },
    { rank: 8, name: "Lickilicky", types: ["normal"], fastMove: "Rollout", fastTurns: 3, chargedMoves: ["Body Slam", "Shadow Ball"] },
    { rank: 9, name: "Annihilape", types: ["fighting", "ghost"], fastMove: "Counter", fastTurns: 2, chargedMoves: ["Rage Fist", "Ice Punch"] },
    { rank: 10, name: "Talonflame", types: ["fire", "flying"], fastMove: "Incinerate", fastTurns: 5, chargedMoves: ["Fly", "Flame Charge"] }
  ],
  "GREAT LEAGUE": [
    { rank: 1, name: "Clodsire", types: ["poison", "ground"], fastMove: "Poison Sting", fastTurns: 2, chargedMoves: ["Earthquake", "Stone Edge"] },
    { rank: 2, name: "Feraligatr", types: ["water"], fastMove: "Shadow Claw", fastTurns: 2, chargedMoves: ["Hydro Cannon", "Ice Beam"] },
    { rank: 3, name: "Mandibuzz", types: ["dark", "flying"], fastMove: "Snarl", fastTurns: 3, chargedMoves: ["Dark Pulse", "Aerial Ace"] },
    { rank: 4, name: "Azumarill", types: ["water", "fairy"], fastMove: "Bubble", fastTurns: 3, chargedMoves: ["Ice Beam", "Play Rough"] },
    { rank: 5, name: "Gastrodon", types: ["water", "ground"], fastMove: "Mud-Slap", fastTurns: 3, chargedMoves: ["Body Slam", "Earth Power"] },
    { rank: 6, name: "Malamar", types: ["dark", "psychic"], fastMove: "Psywave", fastTurns: 1, chargedMoves: ["Foul Play", "Superpower"] },
    { rank: 7, name: "Dunsparce", types: ["normal"], fastMove: "Rollout", fastTurns: 3, chargedMoves: ["Rock Slide", "Drill Run"] },
    { rank: 8, name: "Annihilape", types: ["fighting", "ghost"], fastMove: "Counter", fastTurns: 2, chargedMoves: ["Rage Fist", "Ice Punch"] },
    { rank: 9, name: "Sandslash (Alolan)", types: ["ice", "steel"], fastMove: "Powder Snow", fastTurns: 2, chargedMoves: ["Ice Punch", "Drill Run"] },
    { rank: 10, name: "Primeape", types: ["fighting"], fastMove: "Karate Chop", fastTurns: 2, chargedMoves: ["Rage Fist", "Close Combat"] }
  ]
};


export const SPECIES_VARIANTS: Record<string, string[]> = {
  zacian: ["Zacian (Crowned)", "Zacian (Hero)"],
  zamazenta: ["Zamazenta (Crowned)", "Zamazenta (Hero)"],
  keldeo: ["Keldeo (Resolute)", "Keldeo (Ordinary)"],
  giratina: ["Giratina (Origin)", "Giratina (Altered)"],
  ninetales: ["Ninetales (Alolan)", "Kanto Ninetales"],
  dialga: ["Dialga (Origin)"],
  kyurem: ["Kyurem (Black)", "Kyurem (White)", "Kyurem"]
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
  "Counter": "Cntr",
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
  "X-Scissor": "XScsr"
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
  const isStab = attacker.types.includes(move.type);
  const stabMult = isStab ? 1.2 : 1.0;
  const typeMult = getTypeMultiplier(move.type, defender.types);

  const atk = attacker.baseStats.atk * (isAttackerShadow ? 1.2 : 1.0);
  const def = defender.baseStats.def * (isDefenderShadow ? 0.8333333 : 1.0);
  const maxHp = Math.max(1, defender.baseStats.hp);

  const baseDamage = Math.floor(0.5 * (move.power || 4) * (atk / def) * stabMult * typeMult * 1.3) + 1;
  const percentage = Math.min(100, Math.max(1, Math.round((baseDamage / maxHp) * 100)));
  const abbr = abbrMove5(move.name);
  const telemetry = `${abbr} ${move.turns}t/${move.energyGain}e/${percentage}%`;

  return {
    move,
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
 * Parses user IV string (e.g. "0/15/15", "15-15-15") or returns PvPoke default IVs for the league.
 */
export function parseIvTriplet(
  ivStr: string | undefined,
  league: string = "MASTER LEAGUE"
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
  if (upper.includes("GREAT") || upper.includes("ULTRA")) {
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
  customIvs?: string
): PokemonStats & { resolvedCp: number } {
  const upper = league.toUpperCase();
  const isGreat = upper.includes("GREAT");
  const isUltra = upper.includes("ULTRA");
  const leagueCap = isGreat ? 1500 : isUltra ? 2500 : 5500;

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
  const actualIvs = parseIvTriplet(customIvs, league);

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
    ...pokemon,
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
  return {
    name: partial.name,
    cp: scaled.resolvedCp,
    fastMove: partial.defaultFastMove?.name || "Fast Move",
    chargedMove1: partial.chargedMoves[0]?.name || "Charged 1",
    chargedMove2: partial.chargedMoves[1]?.name || partial.chargedMoves[0]?.name || "Charged 2",
    defaultIvs: `${ivTuple[0]}/${ivTuple[1]}/${ivTuple[2]}`
  };
}

/**
 * Returns the PvPoke Top 3 rated Pokémon template for a given league.
 */
export function getLeagueTop3Template(
  league: "MASTER LEAGUE" | "ULTRA LEAGUE" | "GREAT LEAGUE"
): TeamMember[] {
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
  state: "safe" | "cmp" | "cmp-loss";
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
  userFastMove: FastMove
): number {
  const oppFastMove = resolveFastMove(oppStats);
  const oppFastTurns = oppFastMove.turns || 2;
  const oppFastEnergy = oppFastMove.energyGain || oppFastTurns * 4;

  const userFastTurns = userFastMove.turns || 2;
  const userFastEnergy = userFastMove.energyGain || userFastTurns * 4;

  const oppFirstReadyTurns = oppStats.chargedMoves.slice(0, 3).map((cm) => {
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
  teamMembers?: TeamMember[]
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

  const maxHorizonTurns = computeSharedHorizonTurns(oppStats, userStats, userCustomChargedMoves, {
    ...resolvedUserFast,
    turns: userFastTurns
  });

  const benchNames = teamNames.filter((n) => n.toLowerCase() !== userLeadName.toLowerCase()).slice(0, 2);

  const rows: OpponentMoveTimingRow[] = oppStats.chargedMoves.slice(0, 3).map((cm) => {
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
  activeUserMember?: TeamMember
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
    computeSharedHorizonTurns(oppStats, userStats, customMoves, {
      ...resolvedUserFast,
      turns: userFastTurns
    });

  // Compute all opponent ready turns (across up to 3 cycles) for CMP tie detection
  const oppReadyTurnsSet = new Set<number>();
  oppStats.chargedMoves.slice(0, 3).forEach((cm) => {
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

  return customMoves.map((mName, idx) => {
    const existing =
      userStats.chargedMoves.find((m) => m.name.toLowerCase() === mName.toLowerCase()) ||
      userStats.chargedMoves[idx] || {
        name: mName,
        code: mName.slice(0, 2),
        type: userStats.types[0],
        power: 80,
        energyCost: 50
      };

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
      (cm) => calculateChargedDamage(myStats, oppStats, cm, isMyShadow, isOppShadow).percentage
    );
    const myMaxCharged = myChargedDamages.length ? Math.max(...myChargedDamages) : 45;
    const myMinEnergy = myStats.chargedMoves.length
      ? Math.min(...myStats.chargedMoves.map((c) => c.energyCost))
      : 45;

    const oppChargedDamages = oppStats.chargedMoves.map(
      (cm) => calculateChargedDamage(oppStats, myStats, cm, isOppShadow, isMyShadow).percentage
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
];

