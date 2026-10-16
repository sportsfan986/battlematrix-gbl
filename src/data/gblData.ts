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

// Type effectiveness table simplified for common meta matchups
export const TYPE_EFFECTIVENESS: Record<string, Record<string, number>> = {
  fire: { grass: 1.6, ice: 1.6, bug: 1.6, steel: 1.6, water: 0.625, fire: 0.625, rock: 0.625, dragon: 0.625, fairy: 1.0 },
  electric: { water: 1.6, flying: 1.6, ground: 0.39, dragon: 0.625, electric: 0.625, grass: 0.625 },
  water: { fire: 1.6, ground: 1.6, rock: 1.6, water: 0.625, grass: 0.625, dragon: 0.625 },
  dragon: { dragon: 1.6, steel: 0.625, fairy: 0.39 },
  steel: { fairy: 1.6, ice: 1.6, rock: 1.6, fire: 0.625, water: 0.625, electric: 0.625, steel: 0.625 },
  flying: { grass: 1.6, fighting: 1.6, bug: 1.6, electric: 0.625, rock: 0.625, steel: 0.625 },
  dark: { psychic: 1.6, ghost: 1.6, fighting: 0.625, dark: 0.625, fairy: 0.625 },
  fairy: { dragon: 1.6, fighting: 1.6, dark: 1.6, fire: 0.625, poison: 0.625, steel: 0.625 },
  fighting: { normal: 1.6, ice: 1.6, rock: 1.6, dark: 1.6, steel: 1.6, flying: 0.625, psychic: 0.625, fairy: 0.625, ghost: 0.39 }
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
  Entei: {
    speciesId: "entei",
    name: "Entei",
    types: ["fire"],
    baseStats: { atk: 235, def: 171, hp: 251 },
    defaultFastMove: { name: "Fire Fang", type: "fire", turns: 2, power: 8, energyGain: 8 },
    chargedMoves: [
      { name: "Flame Charge", code: "FC", type: "fire", power: 65, energyCost: 50 },
      { name: "Overheat", code: "OH", type: "fire", power: 130, energyCost: 55 },
      { name: "Iron Head", code: "IH", type: "steel", power: 70, energyCost: 50 }
    ],
    color: "#f97316"
  },
  Luxray: {
    speciesId: "luxray",
    name: "Luxray",
    types: ["electric"],
    baseStats: { atk: 232, def: 156, hp: 190 },
    defaultFastMove: { name: "Spark", type: "electric", turns: 3, power: 6, energyGain: 12 },
    chargedMoves: [
      { name: "Wild Charge", code: "WC", type: "electric", power: 100, energyCost: 45 },
      { name: "Psychic Fangs", code: "PF", type: "psychic", power: 40, energyCost: 35 }
    ],
    color: "#38bdf8"
  },
  Raikou: {
    speciesId: "raikou",
    name: "Raikou",
    types: ["electric"],
    baseStats: { atk: 241, def: 195, hp: 207 },
    defaultFastMove: { name: "Thunder Shock", type: "electric", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Wild Charge", code: "WC", type: "electric", power: 100, energyCost: 45 },
      { name: "Shadow Ball", code: "SB", type: "ghost", power: 100, energyCost: 55 }
    ],
    color: "#eab308"
  },
  Suicune: {
    speciesId: "suicune",
    name: "Suicune",
    types: ["water"],
    baseStats: { atk: 180, def: 235, hp: 225 },
    defaultFastMove: { name: "Snarl", type: "dark", turns: 3, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Bubble Beam", code: "BB", type: "water", power: 25, energyCost: 40 },
      { name: "Hydro Pump", code: "HP", type: "water", power: 130, energyCost: 75 },
      { name: "Ice Beam", code: "IB", type: "ice", power: 90, energyCost: 55 }
    ],
    color: "#38bdf8"
  },
  "Dialga (Origin)": {
    speciesId: "dialga_origin",
    name: "Dialga (Origin)",
    types: ["steel", "dragon"],
    baseStats: { atk: 270, def: 225, hp: 205 },
    defaultFastMove: { name: "Dragon Breath", type: "dragon", turns: 1, power: 4, energyGain: 3 },
    chargedMoves: [
      { name: "Roar of Time", code: "RoT", type: "dragon", power: 150, energyCost: 65 },
      { name: "Iron Head", code: "IH", type: "steel", power: 70, energyCost: 50 }
    ],
    color: "#3b82f6"
  },
  Lugia: {
    speciesId: "lugia",
    name: "Lugia",
    types: ["psychic", "flying"],
    baseStats: { atk: 193, def: 310, hp: 235 },
    defaultFastMove: { name: "Dragon Tail", type: "dragon", turns: 3, power: 13, energyGain: 9 },
    chargedMoves: [
      { name: "Aeroblast", code: "AB", type: "flying", power: 170, energyCost: 75 },
      { name: "Sky Attack", code: "SA", type: "flying", power: 75, energyCost: 50 }
    ],
    color: "#c084fc"
  },
  Kyogre: {
    speciesId: "kyogre",
    name: "Kyogre",
    types: ["water"],
    baseStats: { atk: 270, def: 228, hp: 205 },
    defaultFastMove: { name: "Waterfall", type: "water", turns: 3, power: 12, energyGain: 8 },
    chargedMoves: [
      { name: "Surf", code: "Surf", type: "water", power: 65, energyCost: 40 },
      { name: "Origin Pulse", code: "OP", type: "water", power: 130, energyCost: 60 }
    ],
    color: "#0284c7"
  },
  Yveltal: {
    speciesId: "yveltal",
    name: "Yveltal",
    types: ["dark", "flying"],
    baseStats: { atk: 250, def: 185, hp: 246 },
    defaultFastMove: { name: "Snarl", type: "dark", turns: 2, power: 5, energyGain: 13 },
    chargedMoves: [
      { name: "Dark Pulse", code: "DP", type: "dark", power: 80, energyCost: 50 },
      { name: "Oblivion Wing", code: "OW", type: "flying", power: 85, energyCost: 50 },
      { name: "Focus Blast", code: "FB", type: "fighting", power: 140, energyCost: 75 }
    ],
    color: "#dc2626"
  },
  "Zacian (Crowned)": {
    speciesId: "zacian_crowned",
    name: "Zacian (Crowned)",
    types: ["fairy", "steel"],
    baseStats: { atk: 254, def: 236, hp: 192 },
    defaultFastMove: { name: "Quick Attack", type: "normal", turns: 1, power: 5, energyGain: 7 },
    chargedMoves: [
      { name: "Close Combat", code: "CC", type: "fighting", power: 100, energyCost: 45 },
      { name: "Play Rough", code: "PR", type: "fairy", power: 90, energyCost: 60 },
      { name: "Brave Bird", code: "BB", type: "flying", power: 130, energyCost: 55 }
    ],
    color: "#ec4899"
  },
  "Giratina (Altered)": {
    speciesId: "giratina_altered",
    name: "Giratina (Altered)",
    types: ["ghost", "dragon"],
    baseStats: { atk: 187, def: 225, hp: 284 },
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Dragon Claw", code: "DC", type: "dragon", power: 50, energyCost: 35 },
      { name: "Ancient Power", code: "AP", type: "rock", power: 60, energyCost: 45 }
    ],
    color: "#a855f7"
  },
  Clodsire: {
    speciesId: "clodsire",
    name: "Clodsire",
    types: ["poison", "ground"],
    baseStats: { atk: 127, def: 155, hp: 277 },
    defaultFastMove: { name: "Poison Sting", type: "poison", turns: 2, power: 3, energyGain: 9 },
    chargedMoves: [
      { name: "Earthquake", code: "EQ", type: "ground", power: 110, energyCost: 65 },
      { name: "Stone Edge", code: "SE", type: "rock", power: 100, energyCost: 55 }
    ],
    color: "#78350f"
  },
  Feraligatr: {
    speciesId: "feraligatr",
    name: "Feraligatr",
    types: ["water"],
    baseStats: { atk: 205, def: 188, hp: 198 },
    defaultFastMove: { name: "Shadow Claw", type: "ghost", turns: 2, power: 6, energyGain: 8 },
    chargedMoves: [
      { name: "Hydro Cannon", code: "HC", type: "water", power: 80, energyCost: 40 },
      { name: "Ice Beam", code: "IB", type: "ice", power: 90, energyCost: 55 }
    ],
    color: "#0284c7"
  }
};

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
    // An attack is sneak-free when it lands mid-way through opponent's fast move
    // (i.e. totalUserTurns % oppTurns !== 0)
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
 * Computes exact damage %:
 * Floor(0.5 * Power * (Atk / Def) * STAB * TypeMultiplier) + 1
 */
export function calculateChargedDamage(
  attacker: PokemonStats,
  defender: PokemonStats,
  move: ChargedMove
): { damage: number; percentage: number; isStab: boolean; mult: number } {
  const isStab = attacker.types.includes(move.type);
  const stabMult = isStab ? 1.2 : 1.0;
  const typeMult = getTypeMultiplier(move.type, defender.types);

  // Scaled stats ratio for Master League ~ level 50
  const atk = attacker.baseStats.atk + 15;
  const def = defender.baseStats.def + 15;
  const maxHp = (defender.baseStats.hp + 15) * 0.79; // CP multiplier approximation

  const baseDamage = Math.floor(0.5 * move.power * (atk / def) * stabMult * typeMult) + 1;
  const percentage = Math.min(100, Math.round((baseDamage / maxHp) * 100));

  return {
    damage: baseDamage,
    percentage,
    isStab,
    mult: typeMult
  };
}

/**
 * Computes 3v3 matchup dots (0s, 1s, 2s shields)
 */
export function calculateShieldMatrix(
  oppName: string,
  teamMembers: string[]
): Record<string, string> {
  const result: Record<string, string> = {};

  teamMembers.forEach((member, idx) => {
    const opp = oppName.toLowerCase();
    const tm = member.toLowerCase();
    const key = `p${idx + 1}`;

    if (opp.includes("raikou")) {
      if (tm.includes("dialga")) result[key] = "🟢🟢🟡";
      else if (tm.includes("groudon") || tm.includes("clodsire") || tm.includes("excadrill")) result[key] = "🟢🟢🟢";
      else if (tm.includes("lugia") || tm.includes("kyogre")) result[key] = "🔴🔴🔴";
      else result[key] = "🟡🟢🔴";
    } else if (opp.includes("entei")) {
      if (tm.includes("dialga")) result[key] = "🟢🟡🔴";
      else if (tm.includes("lugia")) result[key] = "🔴🔴🔴";
      else if (tm.includes("kyogre")) result[key] = "🟢🟢🟢";
      else result[key] = "🟡🟢🔴";
    } else if (opp.includes("yveltal")) {
      if (tm.includes("dialga")) result[key] = "🟢🟢🔴";
      else if (tm.includes("lugia")) result[key] = "🔴🔴🔴";
      else if (tm.includes("kyogre")) result[key] = "🔴🔴🔴";
      else result[key] = "🟢🟡🔴";
    } else if (opp.includes("zacian")) {
      if (tm.includes("dialga")) result[key] = "🔴🔴🔴";
      else if (tm.includes("lugia")) result[key] = "🔴🟡🔴";
      else if (tm.includes("kyogre")) result[key] = "🟢🟢🟡";
      else result[key] = "🟡🔴🟢";
    } else {
      result[key] = "🟢🟡🔴";
    }
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
        chargedMove2: "Sky Attack"
      },
      {
        id: "p3",
        name: "Kyogre",
        cp: 4652,
        fastMove: "Waterfall",
        chargedMove1: "Surf",
        chargedMove2: "Origin Pulse"
      }
    ]
  },
  {
    id: "preset-ul-1",
    name: "Ultra: Giratina-A / Cresselia / Cobalion",
    league: "ULTRA LEAGUE",
    pokemon: [
      {
        id: "u1",
        name: "Giratina (Altered)",
        cp: 2496,
        fastMove: "Shadow Claw",
        chargedMove1: "Dragon Claw",
        chargedMove2: "Ancient Power"
      },
      {
        id: "u2",
        name: "Cresselia",
        cp: 2488,
        fastMove: "Psycho Cut",
        chargedMove1: "Grass Knot",
        chargedMove2: "Moonblast"
      },
      {
        id: "u3",
        name: "Cobalion",
        cp: 2492,
        fastMove: "Double Kick",
        chargedMove1: "Sacred Sword",
        chargedMove2: "Stone Edge"
      }
    ]
  },
  {
    id: "preset-gl-1",
    name: "Great: Clodsire / Feraligatr / Mandibuzz",
    league: "GREAT LEAGUE",
    pokemon: [
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
        cp: 1488,
        fastMove: "Shadow Claw",
        chargedMove1: "Hydro Cannon",
        chargedMove2: "Ice Beam"
      },
      {
        id: "g3",
        name: "Mandibuzz",
        cp: 1497,
        fastMove: "Snarl",
        chargedMove1: "Dark Pulse",
        chargedMove2: "Aerial Ace"
      }
    ]
  }
];
