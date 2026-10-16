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

export interface OpponentMoveTimingRow {
  name: string;
  code: string;
  energy: number;
  oppFasts: number;
  oppReadyTurn: number;
  myTapAtReady: number;
  myCapTap: number;
  coAligned: boolean;
  winsCmp: boolean;
  activeName: string;
  activeDmgPct: number;
  activeEff: number;
  safeRangeLabel: string;
  tapNodes: TapNodeInfo[];
  bench: BenchThreatInfo[];
}

export interface MyMoveTimingRow {
  name: string;
  energy: number;
  myTapsNeeded: number;
  dmgPct: number;
  eff: number;
  state: "safe" | "cmp" | "cmp-loss";
  tapNodes: TapNodeInfo[];
}

/**
 * Computes per-move timing, catch/CMP windows, and active/bench threat rows
 * strictly in YOUR active Pokémon's fast-move tap counts up to opponent's first charged move.
 */
export function calculateOpponentMoveTimingRows(
  oppStats: PokemonStats,
  userLeadName: string,
  teamNames: string[],
  isOppShadow: boolean = false,
  userFastTurnsOverride?: number
): { rows: OpponentMoveTimingRow[]; winsCmp: boolean; userFastTurns: number } {
  const cleanUserName = userLeadName.replace(/^Shadow\s+/i, "").trim();
  const userStats =
    POKEMON_DATABASE[userLeadName] ||
    POKEMON_DATABASE[cleanUserName] ||
    Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanUserName.toLowerCase()) ||
    Object.values(POKEMON_DATABASE)[0];

  const isUserShadow = userLeadName.toLowerCase().startsWith("shadow ");
  const userFastTurns = userFastTurnsOverride || userStats.defaultFastMove.turns || 2;
  const oppFastTurns = oppStats.defaultFastMove.turns || 2;
  const oppFastEnergy = oppStats.defaultFastMove.energyGain || oppFastTurns * 4;
  const winsCmp = userStats.baseStats.atk >= oppStats.baseStats.atk;

  const benchNames = teamNames.filter((n) => n.toLowerCase() !== userLeadName.toLowerCase()).slice(0, 2);

  const rows: OpponentMoveTimingRow[] = oppStats.chargedMoves.slice(0, 3).map((cm) => {
    const mEnergy = cm.energyCost || 50;
    const oppFasts = Math.max(1, Math.ceil(mEnergy / oppFastEnergy));
    const oppReadyTurn = oppFasts * oppFastTurns;

    // Strictly in YOUR active Pokémon's fast-move tap counts
    const myTapAtReady = Math.max(1, Math.ceil(oppReadyTurn / userFastTurns));
    const myCapTap = Math.max(myTapAtReady + 1, Math.ceil((oppReadyTurn * 2) / userFastTurns));
    const coAligned = oppReadyTurn % userFastTurns === 0;

    const actvDmg = calculateChargedDamage(oppStats, userStats, cm, isOppShadow, isUserShadow);
    const activeDmgPct = actvDmg.percentage;
    const activeEff = actvDmg.mult;

    const bench: BenchThreatInfo[] = benchNames.map((bName) => {
      const cleanB = bName.replace(/^Shadow\s+/i, "").trim();
      const bStats =
        POKEMON_DATABASE[bName] ||
        POKEMON_DATABASE[cleanB] ||
        Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanB.toLowerCase()) ||
        Object.values(POKEMON_DATABASE)[0];
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

    // Move count bars do NOT go to max energy, JUST to first charged move by opponent!
    const maxNode = myTapAtReady;
    const tapNodes: TapNodeInfo[] = [];
    for (let k = 1; k <= maxNode; k++) {
      let state: "safe" | "leak" | "catch" | "cmp";
      if (k === myTapAtReady) {
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
        isCatchOrCmp: k === myTapAtReady
      });
    }

    const safeEnd = Math.max(1, myTapAtReady - 1);
    const safeRangeLabel = safeEnd <= 1 ? "1" : `1–${safeEnd}`;

    return {
      name: cm.name,
      code: cm.code,
      energy: mEnergy,
      oppFasts,
      oppReadyTurn,
      myTapAtReady,
      myCapTap,
      coAligned,
      winsCmp,
      activeName: userLeadName,
      activeDmgPct,
      activeEff,
      safeRangeLabel,
      tapNodes,
      bench
    };
  });

  return { rows, winsCmp, userFastTurns };
}

/**
 * Computes player's charged move timing rows vertically aligned with opponent moves
 */
export function calculateMyMoveTimingRows(
  userLeadName: string,
  oppStats: PokemonStats,
  customMoves: string[],
  oppReadyTaps: number[],
  isOppShadow: boolean = false,
  userFastTurnsOverride?: number
): MyMoveTimingRow[] {
  const cleanUserName = userLeadName.replace(/^Shadow\s+/i, "").trim();
  const userStats =
    POKEMON_DATABASE[userLeadName] ||
    POKEMON_DATABASE[cleanUserName] ||
    Object.values(POKEMON_DATABASE).find((p) => p.name.toLowerCase() === cleanUserName.toLowerCase()) ||
    Object.values(POKEMON_DATABASE)[0];

  const isUserShadow = userLeadName.toLowerCase().startsWith("shadow ");
  const userFastTurns = userFastTurnsOverride || userStats.defaultFastMove.turns || 2;
  const userFastEnergy = userStats.defaultFastMove.energyGain || userFastTurns * 4;
  const winsCmp = userStats.baseStats.atk >= oppStats.baseStats.atk;
  const maxOppTap = oppReadyTaps.length > 0 ? Math.max(...oppReadyTaps) : 4;

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
    const actvDmg = calculateChargedDamage(userStats, oppStats, existing, isUserShadow, isOppShadow);

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

    const readyState: "safe" | "cmp" | "cmp-loss" = oppReadyTaps.includes(myTapsNeeded)
      ? winsCmp
        ? "cmp"
        : "cmp-loss"
      : "safe";

    return {
      name: mName,
      energy: mEnergy,
      myTapsNeeded,
      dmgPct: actvDmg.percentage,
      eff: actvDmg.mult,
      state: readyState,
      tapNodes
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
        chargedMove1: "Air Cutter",
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
        fastMove: "Ember",
        chargedMove1: "Weather Ball",
        chargedMove2: "Energy Ball"
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

