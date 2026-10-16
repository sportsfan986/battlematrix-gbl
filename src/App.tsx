import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Zap,
  Target,
  Layers,
  Settings,
  Download,
  Copy,
  Check,
  Plus,
  Trash2,
  Play,
  RotateCcw,
  Smartphone,
  Eye,
  FileCode2,
  FolderArchive,
  Scan,
  Sparkles,
  Info,
  ChevronDown,
  Swords
} from 'lucide-react';
import {
  POKEMON_DATABASE,
  INITIAL_PRESETS,
  TeamPreset,
  TeamMember,
  calculateTurnAlignment,
  calculateFastDamage,
  calculateChargedDamage,
  calculateShieldMatrix,
  calculateOpponentMoveTimingRows,
  calculateMyMoveTimingRows,
  getAvailableFormsForPokemon,
  abbrMove5,
  OppCountMode,
  PokemonStats,
  PVPOKE_TOP_OPPONENTS,
  TopOpponentInfo
} from './data/gblData';
import { ANDROID_FILES, downloadAndroidProjectZip, AndroidProjectFile } from './data/androidFiles';

function renderTierDots(tierStr: string) {
  const raw = tierStr || 'W,N,L';
  const tokens = raw.includes(',')
    ? raw.split(',')
    : Array.from(raw).map((ch) => (ch === '🟢' ? 'W' : ch === '🔴' ? 'L' : 'N'));

  return (
    <span className="inline-flex items-center gap-[1px]">
      {tokens.slice(0, 3).map((tok, i) => {
        const t = tok.trim().toUpperCase();
        if (t === 'SW') {
          return (
            <span
              key={i}
              title="Strong Win"
              className="w-[9.5px] h-[9.5px] rounded-full inline-flex items-center justify-center text-[7px] font-black leading-none text-white bg-gradient-to-br from-emerald-400 to-emerald-600 border border-emerald-200 shadow-[0_0_4px_rgba(16,185,129,0.9)]"
            >
              +
            </span>
          );
        }
        if (t === 'W') {
          return (
            <span
              key={i}
              title="Win"
              className="w-[8.5px] h-[8.5px] rounded-full inline-block bg-green-500 border border-green-300/80"
            />
          );
        }
        if (t === 'SL') {
          return (
            <span
              key={i}
              title="Strong Loss"
              className="w-[9.5px] h-[9.5px] rounded-full inline-flex items-center justify-center text-[7px] font-black leading-none text-white bg-gradient-to-br from-red-500 to-red-800 border border-red-200 shadow-[0_0_4px_rgba(239,68,68,0.9)]"
            >
              ×
            </span>
          );
        }
        if (t === 'L') {
          return (
            <span
              key={i}
              title="Loss"
              className="w-[8.5px] h-[8.5px] rounded-full inline-block bg-red-500 border border-red-300/80"
            />
          );
        }
        return (
          <span
            key={i}
            title="Neutral"
            className="w-[8.5px] h-[8.5px] rounded-full inline-block bg-slate-400 border border-slate-300/80"
          />
        );
      })}
    </span>
  );
}

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'simulator' | 'presets' | 'turn_matrix' | 'android_code'>('simulator');

  // Overlay Mode: Option 1 (Top-Left Sky Trench) vs Option 2 (Bottom Horizon Belt)
  const [layoutMode, setLayoutMode] = useState<'option1' | 'option2'>('option1');
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);

  // App Setting (Not in Overlay): Opponent Fast Move Count Basis ("my_fasts" default vs "opp_fasts")
  const [oppCountMode, setOppCountMode] = useState<OppCountMode>(() => {
    try {
      const saved = localStorage.getItem('gbl_opp_count_mode');
      return saved === 'opp_fasts' ? 'opp_fasts' : 'my_fasts';
    } catch {
      return 'my_fasts';
    }
  });

  const handleSetOppCountMode = (mode: OppCountMode) => {
    setOppCountMode(mode);
    try {
      localStorage.setItem('gbl_opp_count_mode', mode);
    } catch {}
  };

  // App-Level Setting: Overlay Screen Width Scale (50% - 100%, Default 78%, step 2%)
  const [overlayScalePct, setOverlayScalePct] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem('gbl_overlay_scale_pct'));
      if (!Number.isNaN(saved) && saved >= 50 && saved <= 100) {
        return Math.round(saved / 2) * 2;
      }
    } catch {}
    return 78;
  });

  const handleSetOverlayScalePct = (pct: number) => {
    const clamped = Math.max(50, Math.min(100, Math.round(pct / 2) * 2));
    setOverlayScalePct(clamped);
    try {
      localStorage.setItem('gbl_overlay_scale_pct', String(clamped));
    } catch {}
  };

  // Overlay Custom Position (Positioned below top header: y=118px, x=8px so it never obscures top opponent HP bar)
  const [overlayPos, setOverlayPos] = useState<{ x: number; y: number }>({ x: 8, y: 118 });

  // Mouse & Touch drag handling for moving overlay in simulator
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialOverlayX: number; initialOverlayY: number }>({
    x: 0,
    y: 0,
    initialOverlayX: 8,
    initialOverlayY: 118
  });

  const onDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    setDragStart({
      x: clientX,
      y: clientY,
      initialOverlayX: overlayPos.x,
      initialOverlayY: overlayPos.y
    });
  };

  const onDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaX = clientX - dragStart.x;
    const deltaY = clientY - dragStart.y;
    
    // Clamp so overlay stays comfortably on screen
    const newX = Math.max(0, Math.min(dragStart.initialOverlayX + deltaX, 110));
    const newY = Math.max(22, Math.min(dragStart.initialOverlayY + deltaY, 440));
    setOverlayPos({ x: newX, y: newY });
  };

  const onDragEnd = () => {
    setIsDragging(false);
  };

  // Team Presets State (stored in localStorage v5 with updated Lugia, Kyogre & Fearow movesets)
  const [presets, setPresets] = useState<TeamPreset[]>(() => {
    const saved = localStorage.getItem('gbl_team_presets_v6');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_PRESETS;
  });

  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    return localStorage.getItem('gbl_selected_preset_id') || 'preset-ml-1';
  });

  // Save presets whenever updated
  useEffect(() => {
    localStorage.setItem('gbl_team_presets_v6', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem('gbl_selected_preset_id', selectedPresetId);
  }, [selectedPresetId]);

  const activePreset = useMemo(() => {
    return presets.find(p => p.id === selectedPresetId) || presets[0] || INITIAL_PRESETS[0];
  }, [presets, selectedPresetId]);

  // Battle Simulation State
  const [activeOpponentKey, setActiveOpponentKey] = useState<string>('Zacian (Crowned)');
  const [isOpponentShadow, setIsOpponentShadow] = useState<boolean>(false);
  const [activeUserSlotIndex, setActiveUserSlotIndex] = useState<number>(0);
  const [userTurnsElapsed, setUserTurnsElapsed] = useState<number>(0);
  const [oppTurnsElapsed, setOppTurnsElapsed] = useState<number>(0);
  const [userEnergy, setUserEnergy] = useState<number>(36);
  const [oppEnergy, setOppEnergy] = useState<number>(40);
  const [userShields, setUserShields] = useState<number>(2);
  const [oppShields, setOppShields] = useState<number>(2);

  // Scanned Opponents (1-per-species deduplicated)
  const [scannedOpponents, setScannedOpponents] = useState<string[]>(['Zacian (Crowned)', 'Yveltal', 'Entei']);
  const [isWaitingOpponent, setIsWaitingOpponent] = useState<boolean>(false);
  const [showOpponentPicker, setShowOpponentPicker] = useState<boolean>(false);
  const [selectedOpponentLeague, setSelectedOpponentLeague] = useState<'AUTO' | 'MASTER LEAGUE' | 'ULTRA LEAGUE' | 'GREAT LEAGUE'>('AUTO');

  // Preset Create / Edit Dialog State
  const [isNewPresetOpen, setIsNewPresetOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetLeague, setNewPresetLeague] = useState<'MASTER LEAGUE' | 'ULTRA LEAGUE' | 'GREAT LEAGUE'>('GREAT LEAGUE');
  const [p1Name, setP1Name] = useState('Kanto Ninetales');
  const [p1Cp, setP1Cp] = useState(1498);
  const [p1Fast, setP1Fast] = useState('Ember');
  const [p1C1, setP1C1] = useState('Weather Ball');
  const [p1C2, setP1C2] = useState('Energy Ball');

  const [p2Name, setP2Name] = useState('Fearow');
  const [p2Cp, setP2Cp] = useState(1500);
  const [p2Fast, setP2Fast] = useState('Peck');
  const [p2C1, setP2C1] = useState('Drill Run');
  const [p2C2, setP2C2] = useState('Drill Peck');

  const [p3Name, setP3Name] = useState('Shadow Pidgeot');
  const [p3Cp, setP3Cp] = useState(1490);
  const [p3Fast, setP3Fast] = useState('Gust');
  const [p3C1, setP3C1] = useState('Twister');
  const [p3C2, setP3C2] = useState('Brave Bird');

  // Code Viewer State
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copiedFile, setCopiedFile] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  const getBaseSpeciesKey = (name: string) => {
    const dbEntry = POKEMON_DATABASE[name];
    if (dbEntry?.baseSpecies) return dbEntry.baseSpecies.toLowerCase();
    return name
      .replace(/^Shadow\s+/i, '')
      .replace(/^Kanto\s+/i, '')
      .replace(/^Alolan\s+/i, '')
      .split(' ')[0]
      .toLowerCase();
  };

  // Actions for Overlay: Reset Opponent (clears opponents while keeping 1 Hz OCR active)
  const handleStartBattle = () => {
    setScannedOpponents([]);
    setIsWaitingOpponent(true);
    setActiveOpponentKey('Waiting...');
    setIsOpponentShadow(false);
    setUserTurnsElapsed(0);
    setOppTurnsElapsed(0);
    setUserEnergy(0);
    setOppEnergy(0);
  };

  const handleSwapActiveOpponent = (name: string) => {
    setActiveOpponentKey(name);
    setIsWaitingOpponent(false);
    setShowOpponentPicker(false);
    setOppTurnsElapsed(0);
    setOppEnergy(0);
    const targetBase = getBaseSpeciesKey(name);
    setScannedOpponents(prev => {
      const filtered = prev.filter(n => getBaseSpeciesKey(n) !== targetBase);
      return [name, ...filtered].slice(0, 3);
    });
  };

  const handleSelectOpponent = (name: string) => {
    handleSwapActiveOpponent(name);
  };

  const handleSwapNextBenchOpponent = () => {
    if (scannedOpponents.length <= 1) return;
    const nextLead = scannedOpponents[1];
    const remaining = [scannedOpponents[0], ...scannedOpponents.slice(2)];
    setActiveOpponentKey(nextLead);
    setIsWaitingOpponent(false);
    setOppTurnsElapsed(0);
    setOppEnergy(0);
    setScannedOpponents([nextLead, ...remaining]);
  };

  // Active Pokémon stats (synchronized with front of scannedOpponents during battle)
  const activeOpponentName = (!isWaitingOpponent && scannedOpponents.length > 0)
    ? scannedOpponents[0]
    : activeOpponentKey;
  const activeOpponent = POKEMON_DATABASE[activeOpponentName] || POKEMON_DATABASE[activeOpponentKey] || POKEMON_DATABASE['Zacian (Crowned)'];
  const activeUserSlot = activePreset?.pokemon[activeUserSlotIndex] || activePreset?.pokemon[0];
  const userLeadName = activeUserSlot?.name || 'Dialga (Origin)';
  const userActivePokemon = POKEMON_DATABASE[userLeadName] || POKEMON_DATABASE['Lugia'] || POKEMON_DATABASE['Dialga (Origin)'];
  const isUserShadow = userLeadName.toLowerCase().includes('shadow');

  const availableForms = useMemo(() => {
    return getAvailableFormsForPokemon(activeOpponent.name);
  }, [activeOpponent.name]);

  const handleCycleForm = () => {
    if (availableForms.length <= 1) return;
    const idx = availableForms.indexOf(activeOpponent.name);
    const nextForm = availableForms[(idx + 1) % availableForms.length];
    handleSelectOpponent(nextForm);
  };

  const activeOpponentLeague = selectedOpponentLeague === 'AUTO' ? (activePreset?.league || 'MASTER LEAGUE') : selectedOpponentLeague;
  const currentTopOpponents: TopOpponentInfo[] = PVPOKE_TOP_OPPONENTS[activeOpponentLeague] || PVPOKE_TOP_OPPONENTS['MASTER LEAGUE'] || [];

  // Calculations (respecting custom fast move turns if edited)
  const FAST_MOVE_TURN_LOOKUP: Record<string, number> = {
    'dragon breath': 1,
    'sand attack': 1,
    'quick attack': 1,
    'lock-on': 1,
    'psycho cut': 2,
    'mud shot': 2,
    'shadow claw': 2,
    'counter': 2,
    'powder snow': 2,
    'wing attack': 2,
    'peck': 2,
    'poison sting': 2,
    'thunder shock': 2,
    'metal claw': 2,
    'fire fang': 2,
    'dragon tail': 3,
    'waterfall': 3,
    'fire spin': 3,
    'snarl': 3,
    'charm': 3,
    'double kick': 3,
    'gust': 4,
    'confusion': 4,
    'volt switch': 4,
    'incinerate': 5
  };

  const userFastMoveName = activeUserSlot?.fastMove || userActivePokemon?.defaultFastMove?.name || 'Fast Move';
  const userFastTurns = FAST_MOVE_TURN_LOOKUP[userFastMoveName.toLowerCase().trim()] || userActivePokemon?.defaultFastMove?.turns || 3;
  const oppFastTurns = activeOpponent?.defaultFastMove?.turns || 2;
  const turnAlignInfo = calculateTurnAlignment(userFastTurns, oppFastTurns);

  const oppFastInfo = useMemo(() => {
    return calculateFastDamage(
      activeOpponent,
      userActivePokemon,
      undefined,
      isOpponentShadow,
      isUserShadow
    );
  }, [activeOpponent, userActivePokemon, isOpponentShadow, isUserShadow]);

  const userFastInfo = useMemo(() => {
    return calculateFastDamage(
      userActivePokemon,
      activeOpponent,
      userFastMoveName,
      isUserShadow,
      isOpponentShadow
    );
  }, [userActivePokemon, activeOpponent, userFastMoveName, isUserShadow, isOpponentShadow]);

  const myCustomChargedMoves = useMemo(() => {
    return [
      activeUserSlot?.chargedMove1 || userActivePokemon.chargedMoves[0]?.name || 'Move 1',
      activeUserSlot?.chargedMove2 || userActivePokemon.chargedMoves[1]?.name || 'Move 2'
    ];
  }, [activeUserSlot, userActivePokemon]);

  const oppMoveTimingInfo = useMemo(() => {
    return calculateOpponentMoveTimingRows(
      activeOpponent,
      userLeadName,
      activePreset.pokemon.map(p => p.name),
      isOpponentShadow,
      userFastTurns,
      userFastMoveName,
      myCustomChargedMoves,
      oppCountMode
    );
  }, [activeOpponent, userLeadName, activePreset, isOpponentShadow, userFastTurns, userFastMoveName, myCustomChargedMoves, oppCountMode]);

  const oppReadyTaps = useMemo(() => {
    return oppMoveTimingInfo.rows.map(r => r.myTapAtReady);
  }, [oppMoveTimingInfo]);

  const myMoveTimingInfo = useMemo(() => {
    return calculateMyMoveTimingRows(
      userLeadName,
      activeOpponent,
      myCustomChargedMoves,
      oppReadyTaps,
      isOpponentShadow,
      userFastTurns,
      userFastMoveName,
      scannedOpponents,
      oppMoveTimingInfo.maxHorizonTurns
    );
  }, [userLeadName, activeOpponent, myCustomChargedMoves, oppReadyTaps, isOpponentShadow, userFastTurns, userFastMoveName, scannedOpponents, oppMoveTimingInfo.maxHorizonTurns]);

  const abbrPoke3 = (name: string, isShad: boolean = false) => {
    const clean = name
      .replace(/^Shadow\s+/i, '')
      .replace(/^Kanto\s+/i, '')
      .replace(/^Alolan\s+/i, '')
      .split(' ')[0]
      .slice(0, 3);
    const prefix = isShad || /^Shadow\s+/i.test(name) ? 'S-' : '';
    return prefix + clean;
  };

  const abbrMoveName = (name: string) => {
    return abbrMove5(name);
  };

  // Damage Calculations (Opponent -> Player & Player -> Opponent with Shadow modifiers & custom moves)
  const oppDamageData = useMemo(() => {
    return activeOpponent.chargedMoves.map(move => {
      const calc = calculateChargedDamage(activeOpponent, userActivePokemon, move, isOpponentShadow, isUserShadow);
      const tapsNeeded = Math.max(0, Math.ceil((move.energyCost - oppEnergy) / (activeOpponent.defaultFastMove.energyGain || 8)));
      return {
        move,
        ...calc,
        tapsNeeded,
        isReady: oppEnergy >= move.energyCost
      };
    });
  }, [activeOpponent, userActivePokemon, oppEnergy, isOpponentShadow, isUserShadow]);

  const myDamageData = useMemo(() => {
    const customMoveNames = [
      activeUserSlot?.chargedMove1 || userActivePokemon.chargedMoves[0]?.name || 'Move 1',
      activeUserSlot?.chargedMove2 || userActivePokemon.chargedMoves[1]?.name || 'Move 2'
    ];
    const CUSTOM_MOVE_STATS: Record<string, { type: string; power: number }> = {
      'Twister': { type: 'dragon', power: 50 },
      'Brave Bird': { type: 'flying', power: 130 },
      'Feather Dance': { type: 'flying', power: 35 },
      'Weather Ball': { type: 'fire', power: 55 },
      'Scorching Sands': { type: 'ground', power: 80 },
      'Sky Attack': { type: 'flying', power: 75 },
      'Drill Run': { type: 'ground', power: 80 },
      'Crunch': { type: 'dark', power: 70 },
      'Earthquake': { type: 'ground', power: 110 },
      'Iron Head': { type: 'steel', power: 70 },
      'Play Rough': { type: 'fairy', power: 90 },
      'Shadow Sneak': { type: 'ghost', power: 50 },
      'Roar of Time': { type: 'dragon', power: 150 },
      'Aeroblast': { type: 'flying', power: 170 },
      'Surf': { type: 'water', power: 65 },
      'Origin Pulse': { type: 'water', power: 130 }
    };
    return customMoveNames.map((mName, idx) => {
      const existingMove = userActivePokemon.chargedMoves.find(m => m.name.toLowerCase() === mName.toLowerCase()) ||
        userActivePokemon.chargedMoves[idx];
      const override = CUSTOM_MOVE_STATS[mName];
      const moveObj = {
        name: mName,
        code: mName.slice(0, 2).toUpperCase(),
        type: override?.type || existingMove?.type || userActivePokemon.types[0] || 'normal',
        power: override?.power || existingMove?.power || 80,
        energyCost: existingMove?.energyCost || 50
      };
      const calc = calculateChargedDamage(userActivePokemon, activeOpponent, moveObj, isUserShadow, isOpponentShadow);
      return {
        move: moveObj,
        ...calc
      };
    });
  }, [userActivePokemon, activeOpponent, isUserShadow, isOpponentShadow, activeUserSlot]);

  // Fast move click handler in simulator
  const handleFastAttack = () => {
    const newTurns = userTurnsElapsed + 1;
    setUserTurnsElapsed(newTurns);
    setUserEnergy(prev => Math.min(100, prev + (userActivePokemon.defaultFastMove.energyGain || 8)));

    // Opponent also attacks
    setOppTurnsElapsed(prev => prev + 1);
    setOppEnergy(prev => Math.min(100, prev + (activeOpponent.defaultFastMove.energyGain || 8)));
  };

  const openCreatePresetModal = () => {
    setEditingPresetId(null);
    setNewPresetName('');
    setNewPresetLeague('GREAT LEAGUE');
    setP1Name('Kanto Ninetales');
    setP1Cp(1498);
    setP1Fast('Ember');
    setP1C1('Weather Ball');
    setP1C2('Energy Ball');
    setP2Name('Fearow');
    setP2Cp(1500);
    setP2Fast('Peck');
    setP2C1('Drill Run');
    setP2C2('Drill Peck');
    setP3Name('Shadow Pidgeot');
    setP3Cp(1490);
    setP3Fast('Gust');
    setP3C1('Twister');
    setP3C2('Brave Bird');
    setIsNewPresetOpen(true);
  };

  const openEditPresetModal = (preset: TeamPreset) => {
    setEditingPresetId(preset.id);
    setNewPresetName(preset.name);
    setNewPresetLeague(preset.league);
    const s1 = preset.pokemon[0];
    const s2 = preset.pokemon[1];
    const s3 = preset.pokemon[2];
    if (s1) {
      setP1Name(s1.name);
      setP1Cp(s1.cp);
      setP1Fast(s1.fastMove);
      setP1C1(s1.chargedMove1);
      setP1C2(s1.chargedMove2);
    }
    if (s2) {
      setP2Name(s2.name);
      setP2Cp(s2.cp);
      setP2Fast(s2.fastMove);
      setP2C1(s2.chargedMove1);
      setP2C2(s2.chargedMove2);
    }
    if (s3) {
      setP3Name(s3.name);
      setP3Cp(s3.cp);
      setP3Fast(s3.fastMove);
      setP3C1(s3.chargedMove1);
      setP3C2(s3.chargedMove2);
    }
    setIsNewPresetOpen(true);
  };

  // Handle Preset Creation or Editing
  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = editingPresetId || `preset-${Date.now()}`;
    const savedPreset: TeamPreset = {
      id: targetId,
      name: newPresetName.trim() || `${newPresetLeague} Custom`,
      league: newPresetLeague,
      pokemon: [
        {
          id: 'p1',
          name: p1Name.trim() || 'Kanto Ninetales',
          cp: p1Cp || 1498,
          fastMove: p1Fast.trim() || 'Fire Spin',
          chargedMove1: p1C1.trim() || 'Weather Ball',
          chargedMove2: p1C2.trim() || 'Scorching Sands'
        },
        {
          id: 'p2',
          name: p2Name.trim() || 'Fearow',
          cp: p2Cp || 1500,
          fastMove: p2Fast.trim() || 'Peck',
          chargedMove1: p2C1.trim() || 'Sky Attack',
          chargedMove2: p2C2.trim() || 'Drill Run'
        },
        {
          id: 'p3',
          name: p3Name.trim() || 'Shadow Pidgeot',
          cp: p3Cp || 1490,
          fastMove: p3Fast.trim() || 'Gust',
          chargedMove1: p3C1.trim() || 'Twister',
          chargedMove2: p3C2.trim() || 'Brave Bird'
        }
      ]
    };

    setPresets(prev => {
      const idx = prev.findIndex(p => p.id === targetId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = savedPreset;
        return next;
      }
      return [...prev, savedPreset];
    });
    setSelectedPresetId(targetId);
    setIsNewPresetOpen(false);
    setEditingPresetId(null);
  };

  const handleDeletePreset = (id: string) => {
    if (presets.length <= 1) {
      alert('You must keep at least one team preset.');
      return;
    }
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    if (selectedPresetId === id) {
      setSelectedPresetId(updated[0].id);
    }
  };

  // Copy code handler
  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFile(true);
    setTimeout(() => setCopiedFile(false), 2000);
  };

  // Download Zip handler
  const handleDownloadZip = async () => {
    try {
      setIsDownloadingZip(true);
      const blob = await downloadAndroidProjectZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'GBL_Battle_Matrix_Android_Project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Failed to generate project zip');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Application Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/favicon.svg"
              alt="GBL Battle Matrix Icon"
              className="w-10 h-10 rounded-xl shadow-lg shadow-sky-500/20 border border-sky-500/30"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base md:text-lg tracking-tight text-white">GBL Battle Matrix</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  v1.10 • Android Native Overlay
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Real-Time ML Kit OCR • PvPoke Gamemaster • Turn-Aligned Bars • 3v3 Shield Matrix
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Donation Button */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <nav className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('simulator')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'simulator'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>Overlay Simulator</span>
              </button>
              <button
                onClick={() => setActiveTab('presets')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'presets'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Team Presets</span>
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-sky-400 border border-slate-700">
                  {presets.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('turn_matrix')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'turn_matrix'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>Turn Alignment</span>
              </button>
              <button
                onClick={() => setActiveTab('android_code')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'android_code'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Kotlin & Android Code</span>
              </button>
            </nav>

            <a
              href="https://buymeacoffee.com/sportsfan986"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 transition"
              title="Support GBL Battle Matrix on Buy Me a Coffee"
            >
              <span>☕ Buy Me a Coffee</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">

        {/* =========================================================================
            TAB 1: INTERACTIVE BATTLE ARENA & FLOATING OVERLAY SIMULATOR
           ========================================================================= */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left: Phone Screen Canvas with Floating HUD */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-3 px-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">Layout Mode:</span>
                  <div className="inline-flex rounded-lg border border-slate-700 bg-slate-900 p-0.5">
                    <button
                      onClick={() => setLayoutMode('option1')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                        layoutMode === 'option1' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Option 1 (Sky Trench)
                    </button>
                    <button
                      onClick={() => setLayoutMode('option2')}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                        layoutMode === 'option2' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Option 2 (Horizon Belt)
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsOverlayVisible(!isOverlayVisible)}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-900 border border-slate-800"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isOverlayVisible ? 'Hide HUD' : 'Show HUD'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setUserTurnsElapsed(0);
                      setOppTurnsElapsed(0);
                      setUserEnergy(36);
                      setOppEnergy(40);
                    }}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded bg-slate-900 border border-slate-800"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Turns</span>
                  </button>
                </div>
              </div>

              {/* Real-time Overlay Placement & Nudge Control Bar */}
              <div className="w-full max-w-[390px] mb-2.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-xs shadow-md">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-semibold text-slate-300">HUD Pos:</span>
                  <span className="font-mono text-sky-400 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    X:{overlayPos.x} Y:{overlayPos.y}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                    Clear of Opponent HP ✅
                  </span>
                  
                  {/* Quick Nudge Buttons */}
                  <div className="flex items-center gap-0.5 ml-1">
                    <button
                      onClick={() => setOverlayPos(prev => ({ ...prev, y: Math.max(20, prev.y - 8) }))}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold flex items-center justify-center text-[10px]"
                      title="Nudge Up"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => setOverlayPos(prev => ({ ...prev, y: Math.min(420, prev.y + 8) }))}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold flex items-center justify-center text-[10px]"
                      title="Nudge Down"
                    >
                      ▼
                    </button>
                    <button
                      onClick={() => setOverlayPos(prev => ({ ...prev, x: Math.max(0, prev.x - 6) }))}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold flex items-center justify-center text-[10px]"
                      title="Nudge Left"
                    >
                      ◄
                    </button>
                    <button
                      onClick={() => setOverlayPos(prev => ({ ...prev, x: Math.min(105, prev.x + 6) }))}
                      className="w-5 h-5 rounded bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold flex items-center justify-center text-[10px]"
                      title="Nudge Right"
                    >
                      ►
                    </button>
                    <button
                      onClick={() => setOverlayPos({ x: 8, y: 118 })}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-sky-600 text-[10px] text-slate-300 hover:text-white font-semibold transition ml-0.5"
                      title="Reset to Default Position"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>

              {/* Mobile Device Frame simulating Pokémon GO Screen (with drag event listeners) */}
              <div 
                onMouseMove={onDragMove}
                onMouseUp={onDragEnd}
                onMouseLeave={onDragEnd}
                onTouchMove={onDragMove}
                onTouchEnd={onDragEnd}
                className="relative w-full max-w-[390px] h-[780px] rounded-[38px] border-[6px] border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col justify-between select-none"
              >
                
                {/* Pokémon GO Battle Background with Sky & Rain Atmosphere */}
                <div 
                  className="absolute inset-0 bg-cover bg-center pointer-events-none"
                  style={{
                    backgroundImage: `linear-gradient(to bottom, rgba(15, 23, 42, 0.45) 0%, rgba(30, 41, 59, 0.25) 45%, rgba(15, 23, 42, 0.85) 100%), radial-gradient(circle at 50% 30%, #334155 0%, #0f172a 100%)`
                  }}
                >
                  {/* Subtle animated battle atmosphere grid */}
                  <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px]" />
                </div>

                {/* Status Bar / Notch */}
                <div className="relative z-10 pt-2.5 px-6 flex justify-between items-center text-[11px] font-semibold text-slate-300">
                  <span>10:40</span>
                  <div className="w-4 h-4 rounded-full bg-black/60 border border-slate-700/60" />
                  <div className="flex items-center gap-1.5">
                    <span>5G</span>
                    <div className="w-4 h-2 border border-slate-400 rounded-sm flex items-center p-0.5">
                      <div className="h-full w-full bg-slate-300 rounded-2xs" />
                    </div>
                  </div>
                </div>

                {/* Top Opponent & Player HP Bar Headers (Matching Pokémon GO Battle HUD) */}
                <div className="relative z-10 px-4 pt-1 flex justify-between items-start">
                  {/* Player Header */}
                  <div className="bg-slate-900/80 backdrop-blur-md rounded-xl p-2.5 border border-slate-700/60 shadow-lg w-[145px]">
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span className="font-bold text-slate-200 truncate">{userActivePokemon.name.split(' ')[0]}*</span>
                      <span className="font-semibold text-slate-400">CP 4624</span>
                    </div>
                    {/* HP Bar */}
                    <div className="w-full h-2 bg-slate-800 rounded-full mt-1 overflow-hidden border border-slate-700">
                      <div className="h-full bg-emerald-500 rounded-full w-[82%]" />
                    </div>
                    {/* Pokeballs & Shields */}
                    <div className="flex items-center justify-between mt-1.5 text-[9px] text-slate-400">
                      <div className="flex gap-1">
                        <span className="text-red-500">🔴</span>
                        <span className="text-red-500">🔴</span>
                        <span className="text-red-500">🔴</span>
                      </div>
                      <div className="flex gap-0.5">
                        <span className="text-purple-400">🛡️</span>
                        <span className="text-purple-400">🛡️</span>
                      </div>
                    </div>
                  </div>

                  {/* Opponent Header (Target of ML Kit OCR) */}
                  <div 
                    id="ocr-opponent-header-crop"
                    className="relative bg-slate-900/80 backdrop-blur-md rounded-xl p-2.5 border border-sky-400/50 shadow-lg w-[145px]"
                  >
                    {/* Bounding box indicator showing OCR scan region */}
                    <span className="absolute -top-2 -right-1 text-[8px] bg-sky-500 text-white font-bold px-1 rounded shadow">
                      ML Kit OCR
                    </span>
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span className="font-semibold text-slate-400">CP 4108</span>
                      <span className="font-bold text-amber-300">{activeOpponent.name}</span>
                    </div>
                    {/* HP Bar */}
                    <div className="w-full h-2 bg-slate-800 rounded-full mt-1 overflow-hidden border border-slate-700">
                      <div className="h-full bg-emerald-500 rounded-full w-[74%]" />
                    </div>
                    {/* Pokeballs & Shields */}
                    <div className="flex items-center justify-between mt-1.5 text-[9px] text-slate-400">
                      <div className="flex gap-0.5">
                        <span className="text-purple-400">🛡️</span>
                        <span className="text-purple-400">🛡️</span>
                      </div>
                      <div className="flex gap-1">
                        <span className="text-red-500">🔴</span>
                        <span className="text-red-500">🔴</span>
                        <span className="text-red-500">🔴</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Center 3D Battle Arena (Opponent Sprite & Player Sprite) */}
                <div className="relative flex-1 flex flex-col justify-between py-6 px-4">
                  
                  {/* Opponent Pokémon Sprite & Trainer */}
                  <div className="flex justify-end pr-8 pt-6">
                    <div className="relative flex flex-col items-center">
                      <div className="w-32 h-32 rounded-full bg-amber-500/10 filter blur-xl absolute" />
                      <div className="text-6xl select-none filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                        {activeOpponent.name === 'Entei' ? '🦁' : activeOpponent.name === 'Yveltal' ? '🦅' : '🐺'}
                      </div>
                      <div className="mt-1 text-center font-bold text-sm text-amber-200 [text-shadow:0_2px_4px_#000]">
                        {activeOpponent.name}
                      </div>
                      <div className="text-[10px] text-slate-300 font-semibold font-mono [text-shadow:0_1px_2px_#000]">
                        {oppFastInfo.telemetry}
                      </div>
                    </div>
                  </div>

                  {/* Player Pokémon Sprite */}
                  <div className="flex justify-start pl-6 pb-6">
                    <div className="relative flex flex-col items-center">
                      <div className="w-36 h-36 rounded-full bg-sky-500/10 filter blur-xl absolute" />
                      <div className="text-7xl select-none filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)]">
                        {userActivePokemon.name.includes('Dialga') ? '🦕' : userActivePokemon.name.includes('Luxray') ? '⚡' : '🐋'}
                      </div>
                      <div className="mt-1 text-center font-bold text-sm text-sky-200 [text-shadow:0_2px_4px_#000]">
                        {userActivePokemon.name}
                      </div>
                      <div className="text-[10px] text-slate-300 font-semibold font-mono [text-shadow:0_1px_2px_#000]">
                        {userFastInfo.telemetry}
                      </div>
                    </div>
                  </div>

                  {/* =========================================================================
                      FLOATING OVERLAY OPTION 1: Top-Left Sky Trench
                      (Ultra-transparent, full-width header, Reset Opp, 1-per-species full names, 3-letter damage rows)
                     ========================================================================= */}
                  {isOverlayVisible && layoutMode === 'option1' && (
                    <div 
                      className={`absolute z-30 rounded-lg p-1.5 border border-white/15 shadow-lg transition-all ${
                        isDragging ? 'ring-2 ring-sky-400' : ''
                      }`}
                      style={{
                        top: `${overlayPos.y}px`,
                        left: `${overlayPos.x}px`,
                        width: '286px',
                        transform: `scale(${(overlayScalePct / 78).toFixed(4)})`,
                        transformOrigin: 'top left',
                        background: 'rgba(10, 14, 22, 0.26)',
                        backdropFilter: 'blur(3px)',
                        WebkitBackdropFilter: 'blur(3px)',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.98), 0 0 4px rgba(0, 0, 0, 0.95)'
                      }}
                    >
                      {/* Header row (Full width, fast move telemetry Abbr Xt/Ye/Z%) */}
                      <div className="flex items-center justify-between pb-1 border-b border-white/15 gap-1">
                        <div className="font-extrabold text-[10.5px] text-amber-100 flex items-center gap-1 truncate min-w-0">
                          {isWaitingOpponent || scannedOpponents.length === 0 ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block shrink-0" />
                              <span className="text-emerald-200">WAITING FOR OPPONENT...</span>
                              <span className="text-amber-300 font-semibold text-[9px]">(1 Hz OCR Active)</span>
                            </>
                          ) : (
                            <>
                              <span className="truncate">⚔️ VS {isOpponentShadow ? 'S-' : ''}{activeOpponent.name.toUpperCase()}</span>
                              <span className="text-amber-300 font-bold text-[8.5px] font-mono shrink-0 bg-black/35 px-1 rounded border border-amber-400/30">
                                {oppFastInfo.telemetry}
                              </span>
                            </>
                          )}
                        </div>
                        {!isWaitingOpponent && scannedOpponents.length > 0 && (
                          <span className="text-sky-300 font-bold text-[8px] font-mono shrink-0 bg-black/35 px-1 rounded border border-sky-400/30">
                            {userFastInfo.telemetry}
                          </span>
                        )}
                      </div>

                      {/* Action Toolbar: Reset Opp, Swap Opponent, Shadow Toggle, Form Cycler, and Active Lead Switch */}
                      <div className="flex items-center justify-between gap-1 bg-black/20 p-1 rounded border border-white/10 my-1">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleStartBattle}
                            className="bg-red-500/35 hover:bg-red-500/50 active:scale-95 text-red-100 border border-red-400/60 font-bold text-[8px] px-1.5 py-0.5 rounded transition"
                            title="Reset opponent team & manual overrides (1 Hz OCR remains active)"
                          >
                            ↺ Reset
                          </button>
                          <button
                            onClick={() => setShowOpponentPicker(!showOpponentPicker)}
                            className={`font-bold text-[8px] px-1.5 py-0.5 rounded border transition active:scale-95 ${
                              showOpponentPicker
                                ? 'bg-amber-500/60 text-white border-amber-300 shadow-[0_0_5px_rgba(245,158,11,0.5)]'
                                : 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50 hover:bg-emerald-500/45'
                            }`}
                            title="Swap opponent from PvPoke Top 10 Meta"
                          >
                            ⚔️ Swap ▾
                          </button>
                          <button
                            onClick={() => setIsOpponentShadow(!isOpponentShadow)}
                            className={`font-bold text-[8px] px-1.5 py-0.5 rounded border transition active:scale-95 ${
                              isOpponentShadow
                                ? 'bg-purple-600/60 text-white border-purple-300 shadow-[0_0_5px_rgba(168,85,247,0.5)]'
                                : 'bg-purple-500/25 text-purple-200 border-purple-400/50 hover:bg-purple-500/35'
                            }`}
                            title="Toggle 1.2x Attack / 0.833x Defense Shadow modifier"
                          >
                            Shadow: {isOpponentShadow ? 'ON' : 'OFF'}
                          </button>
                          <button
                            onClick={handleCycleForm}
                            disabled={availableForms.length <= 1 || isWaitingOpponent}
                            className={`font-bold text-[8px] px-1.5 py-0.5 rounded border transition ${
                              availableForms.length > 1 && !isWaitingOpponent
                                ? 'bg-sky-500/30 hover:bg-sky-500/45 text-sky-100 border-sky-300/60 active:scale-95 cursor-pointer'
                                : 'bg-slate-800/30 text-slate-500 border-slate-700/40 opacity-50 cursor-not-allowed'
                            }`}
                            title="Cycle regional or alternate form"
                          >
                            Form: {activeOpponent.formLabel || 'Base'}
                          </button>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {activePreset.pokemon.map((member, idx) => (
                            <button
                              key={member.id}
                              onClick={() => setActiveUserSlotIndex(idx)}
                              className={`text-[8px] font-bold px-1 py-0.5 rounded border transition ${
                                activeUserSlotIndex === idx
                                  ? 'bg-emerald-500/40 text-white border-emerald-400'
                                  : 'bg-slate-900/50 text-slate-200 border-white/20 hover:bg-slate-800'
                              }`}
                            >
                              {member.name.replace(/^Shadow\s+/i, 'S-').replace(/^Kanto\s+/i, '').split(' ')[0].slice(0, 5)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Floating PvPoke Top 10 Opponent Swap Popover in Overlay */}
                      {showOpponentPicker && (
                        <div className="bg-slate-950/95 border border-sky-400/50 rounded-lg p-2 my-1 shadow-2xl backdrop-blur-md z-40 text-[8px]">
                          <div className="flex items-center justify-between pb-1 border-b border-white/10 mb-1.5">
                            <span className="font-bold text-amber-200">
                              Top 10 Opponents ({activeOpponentLeague.split(' ')[0]}):
                            </span>
                            <button
                              onClick={() => setShowOpponentPicker(false)}
                              className="text-slate-400 hover:text-white px-1 text-[9px] font-bold"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1 max-h-[140px] overflow-y-auto scrollbar-none">
                            {currentTopOpponents.map((topMon) => (
                              <button
                                key={topMon.name}
                                onClick={() => handleSelectOpponent(topMon.name)}
                                className={`px-1.5 py-1 rounded text-left font-semibold border flex items-center justify-between transition ${
                                  activeOpponent.name === topMon.name
                                    ? 'bg-sky-500/35 border-sky-400 text-sky-100 font-bold'
                                    : 'bg-slate-900/80 border-slate-700/60 text-slate-200 hover:bg-slate-800'
                                }`}
                              >
                                <span className="truncate">#{topMon.rank} {topMon.name.split(' ')[0]}</span>
                                <span className="text-[7px] text-amber-300 shrink-0 ml-1 font-mono">{topMon.fastTurns}t</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 3v3 Matchup Matrix Dots (Full Pokémon Names, 1 per species, click to swap active lead) */}
                      <div className="my-1 py-1 px-1.5 bg-black/20 rounded flex flex-col gap-0.5 text-[9.5px]">
                        {isWaitingOpponent || scannedOpponents.length === 0 ? (
                          <div className="text-[9px] text-slate-200 flex items-center justify-between py-1 px-1.5 bg-black/35 rounded border border-white/10">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>1 Hz OCR scanning opponent & active lead...</span>
                            </div>
                            <span className="text-[8px] text-amber-300 font-mono">Standby</span>
                          </div>
                        ) : (
                          scannedOpponents.map((oppName, idx) => {
                            const isLead = idx === 0;
                            const matrix = calculateShieldMatrix(
                              oppName,
                              activePreset.pokemon.map(p => p.name),
                              idx === 0 && isOpponentShadow
                            );
                            const fullOppDisplay = (idx === 0 && isOpponentShadow ? 'S-' : '') + oppName;
                            const p1Init = activePreset.pokemon[0]?.name.charAt(0) || 'D';
                            const p2Init = activePreset.pokemon[1]?.name.charAt(0) || 'L';
                            const p3Init = activePreset.pokemon[2]?.name.charAt(0) || 'K';

                            return (
                              <div
                                key={oppName}
                                onClick={() => handleSwapActiveOpponent(oppName)}
                                className={`flex items-center justify-start gap-1.5 px-1.5 py-0.5 rounded cursor-pointer transition ${
                                  isLead
                                    ? 'bg-sky-500/25 border border-sky-400/50 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                                    : 'hover:bg-white/10 border border-transparent'
                                }`}
                                title={isLead ? `${oppName} (Active on field)` : `Click to swap in ${oppName} as active opponent`}
                              >
                                <div className="flex items-center gap-1 w-[100px] min-w-[100px] max-w-[100px] shrink-0">
                                  <span className={`text-[8px] font-bold shrink-0 ${isLead ? 'text-sky-300' : 'text-slate-400'}`}>
                                    #{idx + 1}
                                  </span>
                                  <span className="font-bold text-slate-100 truncate text-[9.5px]" title={fullOppDisplay}>
                                    {fullOppDisplay}
                                  </span>
                                </div>
                                <div className="flex items-center gap-[1px] text-[9px] font-mono shrink-0">
                                  <span className="font-bold text-slate-300">{p1Init}:</span>
                                  {renderTierDots(matrix.p1)}
                                  <span className="text-white/25 mx-[1.5px] text-[8px]">|</span>
                                  <span className="font-bold text-slate-300">{p2Init}:</span>
                                  {renderTierDots(matrix.p2)}
                                  <span className="text-white/25 mx-[1.5px] text-[8px]">|</span>
                                  <span className="font-bold text-slate-300">{p3Init}:</span>
                                  {renderTierDots(matrix.p3)}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Opponent Attacks & My Attacks (Segmented Range Bars + 3-Column Damage Matrices with Vertical Highlight) */}
                      {!isWaitingOpponent && scannedOpponents.length > 0 && (
                        <div className="flex flex-col gap-0.5 my-1">
                          {/* Opponent Attacks Section Header + 3-Team Column Headers */}
                          <div className="grid grid-cols-[44px_1fr_84px] items-center gap-1 px-1 pt-0.5">
                            <span className="text-[7.5px] font-extrabold text-slate-400 uppercase tracking-wider col-span-2 flex items-center justify-between pr-1">
                              <span>Opp Attacks</span>
                              <span
                                className={`text-[7px] font-extrabold px-1 rounded ${
                                  oppMoveTimingInfo.winsCmp
                                    ? 'bg-emerald-500/25 border border-emerald-400/50 text-emerald-300'
                                    : 'bg-red-500/25 border border-red-400/50 text-red-300'
                                }`}
                              >
                                {oppMoveTimingInfo.winsCmp ? 'CMP WIN ✓' : 'CMP LOSS'}
                              </span>
                            </span>
                            <div className="grid grid-cols-3 w-[84px] text-center font-mono text-[7.5px] font-extrabold">
                              {[0, 1, 2].map((slotIdx) => {
                                const memberName = activePreset.pokemon[slotIdx]?.name || '';
                                const code = memberName
                                  ? abbrPoke3(memberName, false).toUpperCase().slice(0, 3)
                                  : '---';
                                const isActv = slotIdx === activeUserSlotIndex;
                                return (
                                  <span
                                    key={slotIdx}
                                    className={`py-0.5 leading-none transition ${
                                      isActv
                                        ? 'bg-sky-500/25 text-sky-200 border-t border-x border-sky-400/80 rounded-t shadow-[0_0_6px_rgba(56,189,248,0.25)]'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {code}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* Opponent Attack Rows (Turn-Aligned Proportional Bars + Multi-Cycle Support) */}
                          <div className="flex flex-col gap-[2px]">
                            {oppMoveTimingInfo.rows.map((row, rIdx) => {
                              const isLastRow = rIdx === oppMoveTimingInfo.rows.length - 1;
                              const threatLevel =
                                row.activeDmgPct >= 60 || row.activeEff >= 1.5
                                  ? 'high'
                                  : row.activeDmgPct <= 30 || (row.activeEff <= 0.65 && row.activeDmgPct < 45)
                                  ? 'low'
                                  : 'mid';
                              const titleColor =
                                threatLevel === 'high'
                                  ? 'text-red-300'
                                  : threatLevel === 'low'
                                  ? 'text-emerald-300'
                                  : 'text-amber-300';

                              return (
                                <div
                                  key={row.name}
                                  className="bg-slate-950/55 border border-slate-400/20 rounded px-1 py-0.5 grid grid-cols-[44px_1fr_84px] items-center gap-1 tabular-nums"
                                >
                                  {/* Left: <=5 Char Move Name (Top) & Energy/Turns (Bottom) */}
                                  <div className="flex flex-col leading-tight min-w-0">
                                    <span className={`text-[8.5px] font-extrabold truncate ${titleColor}`} title={row.name}>
                                      {row.shortName}
                                    </span>
                                    <span className="text-[7.5px] text-slate-300 font-mono truncate">
                                      {row.energy}e/{row.displayReadyCount}f
                                    </span>
                                  </div>

                                  {/* Center: Turn-Aligned Proportional Multi-Cycle Segmented Bar */}
                                  <div className="flex items-center justify-start min-w-0 w-full bg-slate-900/45 rounded p-[1px]">
                                    <div className="flex items-center justify-start w-full">
                                      {row.cycles.map((cycle) => (
                                        <div
                                          key={cycle.cycleIndex}
                                          style={{ width: `${cycle.widthPct}%` }}
                                          className="flex items-center gap-[1.5px] pr-[1.5px] last:pr-0 min-w-0 shrink-0"
                                        >
                                          {cycle.rangeLabel ? (
                                            <span
                                              className="flex-1 min-w-0 text-center rounded px-1 py-0.5 text-[7px] font-extrabold truncate bg-sky-600/35 border border-sky-400/70 text-sky-200 leading-none"
                                              title={`Throw ${cycle.cycleIndex} charging taps: ${cycle.rangeLabel} (Turns ${cycle.startTurn + 1}–${cycle.readyTurn})`}
                                            >
                                              {cycle.rangeLabel}
                                            </span>
                                          ) : null}
                                          {cycle.readyState === 'cmp' ? (
                                            <span
                                              className="rounded px-1 py-0.5 text-[7px] font-extrabold whitespace-nowrap bg-green-600/55 border border-green-300 text-white leading-none shrink-0"
                                              title={`Throw #${cycle.cycleIndex} ready at Turn ${cycle.readyTurn} (Tap ${cycle.readyLabel} · CMP Win)`}
                                            >
                                              {cycle.readyLabel}
                                            </span>
                                          ) : (
                                            <span
                                              className="rounded px-1 py-0.5 text-[7px] font-extrabold whitespace-nowrap bg-red-600/55 border border-red-300 text-white leading-none shrink-0"
                                              title={`Throw #${cycle.cycleIndex} ready at Turn ${cycle.readyTurn} (Tap ${cycle.readyLabel} · Catch/CMP)`}
                                            >
                                              {cycle.readyLabel}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Right: 3-Pokemon Team Damage % Columns with Vertical Active Highlight */}
                                  <div className="grid grid-cols-3 w-[84px] items-center text-center font-mono shrink-0">
                                    {row.teamDamages.map((cell, cIdx) => {
                                      const isActv = cIdx === activeUserSlotIndex;
                                      const textCls =
                                        cell.tier === 'resist'
                                          ? 'text-emerald-300'
                                          : cell.tier === 'weak'
                                          ? 'text-red-300'
                                          : 'text-amber-200';
                                      return (
                                        <div
                                          key={cIdx}
                                          className={`py-0.5 text-[7.5px] font-extrabold leading-tight ${textCls} ${
                                            isActv
                                              ? `bg-sky-500/25 border-x border-sky-400/80 shadow-[inset_0_0_6px_rgba(56,189,248,0.25)] ${
                                                  isLastRow ? 'border-b rounded-b' : ''
                                                }`
                                              : 'bg-slate-900/40'
                                          }`}
                                          title={`${cell.name}: ${cell.dmgPct}%`}
                                        >
                                          {cell.isEmpty ? '—' : `${cell.dmgPct}%`}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* My Attacks Section Header + 3-Opponent Column Headers */}
                          <div className="grid grid-cols-[44px_1fr_84px] items-center gap-1 px-1 pt-1">
                            <span className="text-[7.5px] font-extrabold text-slate-400 uppercase tracking-wider col-span-2 flex items-center justify-between pr-1">
                              <span>My Attacks</span>
                              <span className="text-sky-300 font-extrabold text-[7.5px] font-mono">
                                {abbrPoke3(userLeadName, false)} ({userFastInfo.telemetry})
                              </span>
                            </span>
                            <div className="grid grid-cols-3 w-[84px] text-center font-mono text-[7.5px] font-extrabold">
                              {[0, 1, 2].map((oppIdx) => {
                                const oppName = scannedOpponents[oppIdx] || '';
                                const code = oppName
                                  ? abbrPoke3(oppName, false).toUpperCase().slice(0, 3)
                                  : '---';
                                const isActv = oppIdx === 0;
                                return (
                                  <span
                                    key={oppIdx}
                                    className={`py-0.5 leading-none transition ${
                                      isActv
                                        ? 'bg-sky-500/25 text-sky-200 border-t border-x border-sky-400/80 rounded-t shadow-[0_0_6px_rgba(56,189,248,0.25)]'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {code}
                                  </span>
                                );
                              })}
                            </div>
                          </div>

                          {/* My Attack Rows (Turn-Aligned Proportional Bars + Multi-Cycle & Safe Throw Numbers) */}
                          <div className="flex flex-col gap-[2px]">
                            {myMoveTimingInfo.map((row, rIdx) => {
                              const isLastRow = rIdx === myMoveTimingInfo.length - 1;
                              const threatLevel =
                                row.dmgPct >= 60 || row.eff >= 1.5
                                  ? 'high'
                                  : row.dmgPct <= 35 || row.eff <= 0.65
                                  ? 'low'
                                  : 'mid';
                              const titleColor =
                                threatLevel === 'high'
                                  ? 'text-emerald-300'
                                  : threatLevel === 'low'
                                  ? 'text-red-300'
                                  : 'text-amber-300';

                              return (
                                <div
                                  key={row.name}
                                  className="bg-slate-950/55 border border-slate-400/20 rounded px-1 py-0.5 grid grid-cols-[44px_1fr_84px] items-center gap-1 tabular-nums"
                                >
                                  {/* Left: <=5 Char Move Name (Top) & Energy/Turns (Bottom) */}
                                  <div className="flex flex-col leading-tight min-w-0">
                                    <span className={`text-[8.5px] font-extrabold truncate ${titleColor}`} title={row.name}>
                                      {row.shortName}
                                    </span>
                                    <span className="text-[7.5px] text-slate-300 font-mono truncate">
                                      {row.energy}e/{row.myTapsNeeded}f
                                    </span>
                                  </div>

                                  {/* Center: Turn-Aligned Proportional Multi-Cycle Bar with Leak-Free Safe Throw Numbers */}
                                  <div className="flex items-center justify-start min-w-0 w-full bg-slate-900/45 rounded p-[1px]">
                                    <div className="flex items-center justify-start w-full">
                                      {row.cycles.map((cycle) => (
                                        <div
                                          key={cycle.cycleIndex}
                                          style={{ width: `${cycle.widthPct}%` }}
                                          className="flex items-center gap-[1.5px] pr-[1.5px] last:pr-0 min-w-0 shrink-0"
                                        >
                                          {cycle.rangeLabel ? (
                                            <span
                                              className={`flex-1 min-w-0 text-center rounded px-1 py-0.5 text-[7px] font-extrabold truncate leading-none ${
                                                cycle.hasZeroSneak
                                                  ? 'bg-sky-600/35 border border-sky-400/70 text-sky-200'
                                                  : 'bg-slate-700/45 border border-slate-400/40 text-slate-300'
                                              }`}
                                              title={
                                                cycle.hasZeroSneak
                                                  ? `Leak-free (zero-sneak) throw taps: ${cycle.rangeLabel} (Turns ${cycle.startTurn + 1}–${cycle.readyTurn})`
                                                  : `Co-aligned charging taps (Turns ${cycle.startTurn + 1}–${cycle.readyTurn})`
                                              }
                                            >
                                              {cycle.rangeLabel}
                                            </span>
                                          ) : null}
                                          {cycle.readyState === 'cmp' ? (
                                            <span
                                              className="rounded px-1 py-0.5 text-[7px] font-extrabold whitespace-nowrap bg-green-600/55 border border-green-300 text-white leading-none shrink-0"
                                              title={`Throw #${cycle.cycleIndex} ready at Turn ${cycle.readyTurn} (${cycle.readyLabel} · CMP Win)`}
                                            >
                                              {cycle.readyLabel}
                                            </span>
                                          ) : cycle.readyState === 'cmp-loss' ? (
                                            <span
                                              className="rounded px-1 py-0.5 text-[7px] font-extrabold whitespace-nowrap bg-red-600/55 border border-red-300 text-white leading-none shrink-0"
                                              title={`Throw #${cycle.cycleIndex} ready at Turn ${cycle.readyTurn} (${cycle.readyLabel} · CMP Loss)`}
                                            >
                                              {cycle.readyLabel}
                                            </span>
                                          ) : (
                                            <span
                                              className="rounded px-1 py-0.5 text-[7px] font-extrabold whitespace-nowrap bg-sky-600/35 border border-sky-400/70 text-sky-200 leading-none shrink-0"
                                              title={`Throw #${cycle.cycleIndex} ready at Turn ${cycle.readyTurn} (${cycle.readyLabel})`}
                                            >
                                              {cycle.readyLabel}
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Right: 3-Opponent Outgoing Damage % Columns with Vertical Active Highlight */}
                                  <div className="grid grid-cols-3 w-[84px] items-center text-center font-mono shrink-0">
                                    {row.oppDamages.map((cell, cIdx) => {
                                      const isActv = cIdx === 0;
                                      const textCls = cell.isEmpty
                                        ? 'text-slate-500'
                                        : cell.tier === 'resist'
                                        ? 'text-emerald-300'
                                        : cell.tier === 'weak'
                                        ? 'text-red-300'
                                        : 'text-amber-200';
                                      return (
                                        <div
                                          key={cIdx}
                                          className={`py-0.5 text-[7.5px] font-extrabold leading-tight ${textCls} ${
                                            isActv
                                              ? `bg-sky-500/25 border-x border-sky-400/80 shadow-[inset_0_0_6px_rgba(56,189,248,0.25)] ${
                                                  isLastRow ? 'border-b rounded-b' : ''
                                                }`
                                              : 'bg-slate-900/40'
                                          }`}
                                          title={cell.isEmpty ? 'Unscanned opponent slot' : `${cell.name}: ${cell.dmgPct}%`}
                                        >
                                          {cell.isEmpty ? '—' : cell.dmgPct >= 100 ? 'KO!' : `${cell.dmgPct}%`}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* =========================================================================
                      FLOATING OVERLAY OPTION 2: Bottom Horizon Belt Fallback
                     ========================================================================= */}
                  {isOverlayVisible && layoutMode === 'option2' && (
                    <div 
                      className="absolute bottom-[108px] left-[8px] right-[8px] z-30 rounded-lg p-2 border border-white/15 shadow-lg transition-all"
                      style={{
                        background: 'rgba(10, 14, 22, 0.28)',
                        backdropFilter: 'blur(3px)',
                        WebkitBackdropFilter: 'blur(3px)',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.98), 0 0 4px rgba(0, 0, 0, 0.95)'
                      }}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none font-mono">
                          {isWaitingOpponent || scannedOpponents.length === 0 ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <strong className="text-emerald-300">[Waiting for Opponent]</strong>
                              <span className="text-slate-300">1 Hz OCR active...</span>
                            </>
                          ) : (
                            <>
                              <strong>[{activeOpponent.name}: {oppFastInfo.telemetry}]</strong>
                              <span className="inline-flex items-center gap-1">
                                D:{renderTierDots('W,N,L')} | L:{renderTierDots('SL,L,L')} | K:{renderTierDots('SW,W,W')}
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          <button
                            onClick={handleStartBattle}
                            className="bg-red-500/35 hover:bg-red-500/50 text-red-100 text-[8.5px] font-bold px-1.5 py-0.5 rounded border border-red-400/50"
                            title="Reset opponent"
                          >
                            ↺ Reset Opp
                          </button>
                        </div>
                      </div>

                      <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between text-[9px] text-orange-200">
                        <div>
                          🎯 <strong className="text-white">THROW ON:</strong> {isWaitingOpponent || scannedOpponents.length === 0 ? '—' : turnAlignInfo.horizonText}
                          <span className="mx-1 text-white/30">•</span>
                          <span>{isWaitingOpponent || scannedOpponents.length === 0 ? 'Awaiting opponent...' : `💥 ${abbrPoke3(activeOpponent.name, isOpponentShadow)}→${abbrPoke3(userLeadName)}: ${abbrMoveName(oppDamageData[0]?.move.name || 'Move')} (${oppDamageData[0]?.percentage || 40}%)`}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Switch Pokémon Bench Icons */}
                  <div className="absolute right-3 bottom-24 flex flex-col gap-2">
                    <button className="w-11 h-11 rounded-full bg-slate-900/80 border border-slate-700 shadow-lg flex flex-col items-center justify-center p-0.5 active:scale-95">
                      <span className="text-xs">🕊️</span>
                      <span className="text-[7.5px] font-bold text-slate-300">CP 4179</span>
                    </button>
                    <button className="w-11 h-11 rounded-full bg-slate-900/80 border border-slate-700 shadow-lg flex flex-col items-center justify-center p-0.5 active:scale-95">
                      <span className="text-xs">🐋</span>
                      <span className="text-[7.5px] font-bold text-slate-300">CP 4652</span>
                    </button>
                  </div>

                </div>

                {/* Bottom Charge Attack Circles & Tap Controls */}
                <div className="relative z-10 px-4 pb-5 pt-2 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-center justify-center gap-4">
                  {/* Charge Move 1 */}
                  <div className="relative flex flex-col items-center">
                    <button 
                      onClick={() => alert(`Used ${userActivePokemon.chargedMoves[0]?.name || 'Charge Move 1'}!`)}
                      className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 border-2 border-amber-300 shadow-lg shadow-amber-500/30 flex items-center justify-center active:scale-90 transition transform"
                    >
                      <Zap className="w-7 h-7 text-white fill-white" />
                    </button>
                    <span className="text-[9px] font-bold text-amber-200 mt-1 uppercase">
                      {userActivePokemon.chargedMoves[0]?.name.split(' ')[0] || 'MOVE 1'}
                    </span>
                  </div>

                  {/* Charge Move 2 */}
                  {userActivePokemon.chargedMoves[1] && (
                    <div className="relative flex flex-col items-center">
                      <button 
                        onClick={() => alert(`Used ${userActivePokemon.chargedMoves[1]?.name}!`)}
                        className="w-16 h-16 rounded-full bg-gradient-to-tr from-sky-600 to-sky-400 border-2 border-sky-300 shadow-lg shadow-sky-500/30 flex items-center justify-center active:scale-90 transition transform"
                      >
                        <Shield className="w-7 h-7 text-white" />
                      </button>
                      <span className="text-[9px] font-bold text-sky-200 mt-1 uppercase">
                        {userActivePokemon.chargedMoves[1]?.name.split(' ')[0]}
                      </span>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Right: Live Battle Simulation Controller & Presets Quick Switcher */}
            <div className="lg:col-span-5 flex flex-col gap-5">
              
              {/* Battle Simulation Controls Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    <Play className="w-4 h-4 text-sky-400" />
                    <span>Live Battle Tap & Turn Simulator</span>
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    Turn Count: <strong>{userTurnsElapsed}</strong>
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-4">
                  Tap the button below to simulate Fast Attacks in real-time. Watch how the overlay highlights when you reach the exact zero-sneak window!
                </p>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <button
                    onClick={handleFastAttack}
                    className="col-span-2 py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 active:scale-[0.98] font-bold text-sm text-white shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Tap Fast Attack ({userActivePokemon.defaultFastMove?.name || 'Fast'})</span>
                  </button>

                  <button
                    onClick={() => setUserShields(prev => (prev > 0 ? prev - 1 : 2))}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-400" />
                    <span>Your Shields: {userShields}</span>
                  </button>

                  <button
                    onClick={() => setOppShields(prev => (prev > 0 ? prev - 1 : 2))}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-300 flex items-center justify-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-red-400" />
                    <span>Opp Shields: {oppShields}</span>
                  </button>
                </div>

                {/* App Setting (Not on Overlay): Opponent Fast Move Count Basis */}
                <div className="mb-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Opponent Move Count Basis
                    </span>
                    <span className="text-[10px] font-mono text-sky-400">
                      App Setting · Turn-Aligned
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
                    <button
                      onClick={() => handleSetOppCountMode('my_fasts')}
                      className={`py-1.5 px-2 rounded-md text-xs font-bold transition ${
                        oppCountMode === 'my_fasts'
                          ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      My Fast Moves (Default)
                    </button>
                    <button
                      onClick={() => handleSetOppCountMode('opp_fasts')}
                      className={`py-1.5 px-2 rounded-md text-xs font-bold transition ${
                        oppCountMode === 'opp_fasts'
                          ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Opponent Fast Moves
                    </button>
                  </div>
                </div>

                {/* App Setting (Not on Overlay): Overlay Screen Width Scale (50% - 100%, Default 78%) */}
                <div className="mb-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Overlay Size (% of Screen Width)
                    </span>
                    <button
                      onClick={() => handleSetOverlayScalePct(78)}
                      className="text-xs font-mono font-bold text-sky-400 hover:text-sky-300 transition"
                      title="Click to reset to 78% Default"
                    >
                      {overlayScalePct === 78 ? '78% (Default)' : `${overlayScalePct}%`}
                    </button>
                  </div>

                  <input
                    type="range"
                    min={50}
                    max={100}
                    step={2}
                    value={overlayScalePct}
                    onChange={(e) => handleSetOverlayScalePct(Number(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />

                  {/* Scale Bounds & 78% Default Tick Mark (56% along 50-100 range) */}
                  <div className="relative h-4 text-[10px] font-mono text-slate-400">
                    <span className="absolute left-0">50%</span>
                    <button
                      type="button"
                      onClick={() => handleSetOverlayScalePct(78)}
                      style={{ left: '56%', transform: 'translateX(-50%)' }}
                      className="absolute text-sky-400 hover:text-sky-300 font-bold transition"
                      title="Reset to 78% Default"
                    >
                      ▲ 78% Default
                    </button>
                    <span className="absolute right-0">100%</span>
                  </div>
                </div>

                {/* Swap In Opponent Pokémon (PvPoke Top 10 Meta & OCR Switch Simulator) */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Swords className="w-4 h-4 text-amber-400" />
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                          Swap In Opponent (PvPoke Top 10)
                        </h4>
                        <p className="text-[10px] text-slate-400">
                          Simulate in-battle swaps or OCR detection to test battle matrix & move timing updates.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* League Switcher Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
                    <button
                      onClick={() => setSelectedOpponentLeague('AUTO')}
                      className={`px-2.5 py-1 rounded-lg font-bold border transition shrink-0 ${
                        selectedOpponentLeague === 'AUTO'
                          ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Auto ({activePreset.league.split(' ')[0]})
                    </button>
                    {(['MASTER LEAGUE', 'ULTRA LEAGUE', 'GREAT LEAGUE'] as const).map((lg) => (
                      <button
                        key={lg}
                        onClick={() => setSelectedOpponentLeague(lg)}
                        className={`px-2.5 py-1 rounded-lg font-bold border transition shrink-0 ${
                          selectedOpponentLeague === lg
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {lg.split(' ')[0]}
                      </button>
                    ))}
                  </div>

                  {/* Quick Action Simulation Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleStartBattle}
                      className="flex-1 py-1.5 px-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
                      title="Reset opponent team to test 1 Hz OCR scanning standby"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Opp (Test 1 Hz OCR)</span>
                    </button>
                    <button
                      onClick={handleSwapNextBenchOpponent}
                      disabled={scannedOpponents.length <= 1}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
                        scannedOpponents.length > 1
                          ? 'bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200'
                          : 'bg-slate-800/40 border border-slate-700/40 text-slate-500 opacity-50 cursor-not-allowed'
                      }`}
                      title={scannedOpponents.length > 1 ? `Swap to bench: ${scannedOpponents[1]}` : 'Need >=2 scanned opponents to rotate'}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>Swap Bench Opponent</span>
                    </button>
                  </div>

                  {/* Top 10 PvPoke Opponents Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[310px] overflow-y-auto pr-1">
                    {currentTopOpponents.map((mon) => {
                      const isActiveLead = !isWaitingOpponent && scannedOpponents[0] === mon.name;
                      const benchIdx = !isWaitingOpponent ? scannedOpponents.indexOf(mon.name) : -1;
                      const isBench = benchIdx > 0;

                      return (
                        <button
                          key={mon.name}
                          onClick={() => handleSwapActiveOpponent(mon.name)}
                          className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 relative group ${
                            isActiveLead
                              ? 'bg-sky-500/20 border-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.25)] ring-1 ring-sky-400/50'
                              : isBench
                              ? 'bg-amber-500/15 border-amber-400/50 hover:bg-amber-500/25'
                              : 'bg-slate-950/60 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900/80'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full gap-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-mono">
                                #{mon.rank}
                              </span>
                              <span className="font-bold text-xs text-white truncate">
                                {mon.name}
                              </span>
                            </div>
                            {isActiveLead ? (
                              <span className="text-[9px] font-extrabold bg-sky-400 text-slate-950 px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 animate-pulse">
                                Active Lead
                              </span>
                            ) : isBench ? (
                              <span className="text-[9px] font-bold bg-amber-400/30 text-amber-200 border border-amber-400/50 px-1.5 py-0.5 rounded shrink-0">
                                Bench #{benchIdx + 1}
                              </span>
                            ) : (
                              <span className="text-[9px] font-semibold text-slate-400 group-hover:text-sky-300 transition shrink-0">
                                Swap In ▾
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-300 w-full pt-1 border-t border-white/5">
                            <span className="font-semibold text-amber-300">
                              ⚡ {mon.fastTurns}t {mon.fastMove}
                            </span>
                            <span className="text-slate-400 truncate max-w-[125px] font-mono text-[9px]">
                              {mon.chargedMoves.join(' + ')}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Active Team Preset Summary Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-bold text-sm text-white">Active Team Preset</h3>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {activePreset.league}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-200 mb-3">
                  {activePreset.name}
                </div>

                <div className="space-y-2">
                  {activePreset.pokemon.map((poke, index) => (
                    <div
                      key={poke.id || index}
                      className="flex items-center justify-between p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-400">
                          {index + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-200">{poke.name}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5 font-mono">CP {poke.cp}</span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-400 text-right">
                        <span>{poke.fastMove}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-400">Want to add more teams?</span>
                  <button
                    onClick={() => setActiveTab('presets')}
                    className="text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                  >
                    <span>Manage Presets</span>
                    <span>→</span>
                  </button>
                </div>
              </div>

              {/* Real-time Math Breakdown Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-xs space-y-3">
                <h4 className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Info className="w-4 h-4 text-sky-400" />
                  <span>Calculated Overlay Values</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Fast Move Alignment</span>
                    <strong className="text-white text-xs">{userFastTurns}t vs {oppFastTurns}t</strong>
                  </div>
                  <div className="p-2 rounded bg-slate-950/60 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Optimal Zero-Sneak Throws</span>
                    <strong className="text-emerald-400 text-xs">{turnAlignInfo.optimalThrowText}</strong>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {turnAlignInfo.explanation}
                </p>
              </div>

            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: CUSTOM GBL TEAM PRESETS MANAGER (User Requirement)
           ========================================================================= */}
        {activeTab === 'presets' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-sky-400" />
                  <span>Custom GBL Team Presets</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Save, name, and manage custom 3-Pokémon battle league teams. Presets are stored locally on the device (localStorage / SharedPreferences) and instantly update the floating overlay matrix!
                </p>
              </div>
              <button
                onClick={openCreatePresetModal}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Preset</span>
              </button>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {presets.map((preset) => {
                const isSelected = preset.id === selectedPresetId;
                return (
                  <div
                    key={preset.id}
                    className={`rounded-2xl p-5 border transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-b from-sky-950/60 to-slate-900 border-sky-400 shadow-xl shadow-sky-500/10'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                          preset.league === 'MASTER LEAGUE'
                            ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                            : preset.league === 'ULTRA LEAGUE'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                        }`}>
                          {preset.league}
                        </span>

                        <div className="flex items-center gap-1">
                          {isSelected ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <Check className="w-3 h-3" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => setSelectedPresetId(preset.id)}
                              className="text-xs text-sky-400 hover:text-white font-semibold px-2 py-0.5 rounded bg-slate-800 hover:bg-sky-600 border border-slate-700 transition"
                            >
                              Select
                            </button>
                          )}
                          <button
                            onClick={() => openEditPresetModal(preset)}
                            className="text-xs text-amber-300 hover:text-white font-semibold px-2 py-0.5 rounded bg-slate-800 hover:bg-amber-600 border border-slate-700 transition"
                            title="Edit Team & Moves"
                          >
                            Edit Moves
                          </button>
                          <button
                            onClick={() => handleDeletePreset(preset.id)}
                            className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition"
                            title="Delete Preset"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <h3 className="font-bold text-base text-white mb-3">
                        {preset.name}
                      </h3>

                      {/* 3 Pokémon Slots with Movesets */}
                      <div className="space-y-2">
                        {preset.pokemon.map((member, index) => (
                          <div
                            key={member.id || index}
                            className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-slate-500">
                                  #{index + 1}
                                </span>
                                <span className="font-semibold text-slate-100">{member.name}</span>
                              </div>
                              <span className="text-[11px] font-mono font-bold text-sky-400">
                                CP {member.cp}
                              </span>
                            </div>
                            <div className="text-[10.5px] text-slate-400 pl-5 flex items-center justify-between">
                              <span>Fast: <strong className="text-slate-200">{member.fastMove}</strong></span>
                              <span>Charged: <strong className="text-amber-300">{member.chargedMove1}</strong> / <strong className="text-sky-300">{member.chargedMove2}</strong></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">
                        League: <strong className="text-slate-200">{preset.league}</strong>
                      </span>
                      <button
                        onClick={() => openEditPresetModal(preset)}
                        className="text-sky-400 hover:text-sky-300 font-semibold text-[11px]"
                      >
                        ✎ Edit Team & Moves
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Dialog for Creating or Editing Preset & Moves */}
            {isNewPresetOpen && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 my-8">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-400" />
                      <span>{editingPresetId ? 'Edit Team & Moves' : 'Create Custom GBL Team Preset'}</span>
                    </h3>
                    <button
                      onClick={() => {
                        setIsNewPresetOpen(false);
                        setEditingPresetId(null);
                      }}
                      className="text-slate-400 hover:text-white text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreatePreset} className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          Preset Name
                        </label>
                        <input
                          type="text"
                          value={newPresetName}
                          onChange={(e) => setNewPresetName(e.target.value)}
                          placeholder="e.g. Great League Team"
                          required
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          League Category
                        </label>
                        <select
                          value={newPresetLeague}
                          onChange={(e) => setNewPresetLeague(e.target.value as any)}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                        >
                          <option value="GREAT LEAGUE">GREAT LEAGUE (Max 1500 CP)</option>
                          <option value="ULTRA LEAGUE">ULTRA LEAGUE (Max 2500 CP)</option>
                          <option value="MASTER LEAGUE">MASTER LEAGUE (No CP Limit)</option>
                        </select>
                      </div>
                    </div>

                    {/* Slot 1 */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <span className="text-xs font-bold text-sky-400 block">Slot 1 (Lead Pokémon & Moveset)</span>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p1Name}
                          onChange={(e) => setP1Name(e.target.value)}
                          placeholder="Name (e.g. Kanto Ninetales)"
                          className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          required
                        />
                        <input
                          type="number"
                          value={p1Cp}
                          onChange={(e) => setP1Cp(parseInt(e.target.value) || 0)}
                          placeholder="CP"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p1Fast}
                          onChange={(e) => setP1Fast(e.target.value)}
                          placeholder="Fast Move"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p1C1}
                          onChange={(e) => setP1C1(e.target.value)}
                          placeholder="Charged Move 1"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p1C2}
                          onChange={(e) => setP1C2(e.target.value)}
                          placeholder="Charged Move 2"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                    </div>

                    {/* Slot 2 */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <span className="text-xs font-bold text-purple-400 block">Slot 2 (Safe Swap & Moveset)</span>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p2Name}
                          onChange={(e) => setP2Name(e.target.value)}
                          placeholder="Name (e.g. Fearow)"
                          className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          required
                        />
                        <input
                          type="number"
                          value={p2Cp}
                          onChange={(e) => setP2Cp(parseInt(e.target.value) || 0)}
                          placeholder="CP"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p2Fast}
                          onChange={(e) => setP2Fast(e.target.value)}
                          placeholder="Fast Move"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p2C1}
                          onChange={(e) => setP2C1(e.target.value)}
                          placeholder="Charged Move 1"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p2C2}
                          onChange={(e) => setP2C2(e.target.value)}
                          placeholder="Charged Move 2"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                    </div>

                    {/* Slot 3 */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <span className="text-xs font-bold text-amber-400 block">Slot 3 (Closer & Moveset)</span>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p3Name}
                          onChange={(e) => setP3Name(e.target.value)}
                          placeholder="Name (e.g. Shadow Pidgeot)"
                          className="col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          required
                        />
                        <input
                          type="number"
                          value={p3Cp}
                          onChange={(e) => setP3Cp(parseInt(e.target.value) || 0)}
                          placeholder="CP"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p3Fast}
                          onChange={(e) => setP3Fast(e.target.value)}
                          placeholder="Fast Move (e.g. Gust)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p3C1}
                          onChange={(e) => setP3C1(e.target.value)}
                          placeholder="Charged 1 (e.g. Twister)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p3C2}
                          onChange={(e) => setP3C2(e.target.value)}
                          placeholder="Charged 2 (e.g. Brave Bird)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewPresetOpen(false);
                          setEditingPresetId(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20"
                      >
                        {editingPresetId ? 'Save Team & Moves' : 'Create Preset'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: FAST MOVE TURN ALIGNMENT & SNEAK MECHANICS
           ========================================================================= */}
        {activeTab === 'turn_matrix' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
                <Target className="w-5 h-5 text-orange-400" />
                <span>Optimal Fast Move Turn Alignment & Sneak Prevention</span>
              </h2>
              <p className="text-xs text-slate-400">
                In Pokémon GO Battle League, fast moves last 1 to 5 turns (0.5s per turn). When throwing a charged move on the exact turn an opponent finishes their fast move, the game gives the opponent a "free sneak" turn. The GBL overlay computes the exact attacks to throw on to deny all opponent sneaks!
              </p>
            </div>

            {/* Turn Alignment Matrix Calculator */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="font-bold text-sm text-white">Compare Fast Move Timings</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Your Move Turns:</label>
                    <select
                      value={userFastTurns}
                      onChange={() => {}}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white"
                    >
                      <option value="1">1 Turn (Dragon Breath, Lick)</option>
                      <option value="2">2 Turns (Counter, Shadow Claw)</option>
                      <option value="3">3 Turns (Spark, Waterfall, Snarl)</option>
                      <option value="4">4 Turns (Incinerate, Volt Switch)</option>
                      <option value="5">5 Turns (Lock-On, Gust)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Opponent Move Turns:</label>
                    <select
                      value={oppFastTurns}
                      onChange={() => {}}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2 text-xs text-white"
                    >
                      <option value="1">1 Turn (Dragon Breath)</option>
                      <option value="2">2 Turns (Fire Fang, Counter)</option>
                      <option value="3">3 Turns (Waterfall)</option>
                      <option value="4">4 Turns (Incinerate)</option>
                    </select>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-orange-500/30">
                  <div className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-1">
                    Optimal Sneak-Free Throws
                  </div>
                  <div className="text-lg font-extrabold text-white">
                    🎯 {turnAlignInfo.optimalThrowText}
                  </div>
                  <div className="text-xs text-slate-400 mt-2">
                    {turnAlignInfo.explanation}
                  </div>
                </div>
              </div>

              {/* Visual Timeline of Sneak Prevention */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="font-bold text-sm text-white">Turn Timeline (User 3t vs Opponent 2t)</h3>
                
                <div className="space-y-2 text-xs">
                  {[1, 2, 3, 4, 5, 6, 7].map((attack) => {
                    const userTurn = attack * 3;
                    const isSneakFree = userTurn % 2 !== 0;
                    return (
                      <div
                        key={attack}
                        className={`flex items-center justify-between p-2 rounded-lg border ${
                          isSneakFree
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-semibold'
                            : 'bg-rose-500/10 border-rose-500/30 text-rose-300 font-medium'
                        }`}
                      >
                        <span>Attack #{attack} (Turn {userTurn})</span>
                        <span className="font-bold">
                          {isSneakFree ? '✅ ZERO SNEAK (Optimal)' : '❌ SNEAK DANGER (Simultaneous)'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: ANDROID SOURCE CODE & COMPLETE PROJECT EXPORTER
           ========================================================================= */}
        {activeTab === 'android_code' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <FileCode2 className="w-5 h-5 text-emerald-400" />
                  <span>Android Native Project Codebase</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Ready-to-compile Kotlin files for Android Studio. Includes foreground WindowManager overlay, zero-disk MediaProjection capture, ML Kit offline text recognizer, and local SharedPreferences preset manager.
                </p>
              </div>

              <button
                onClick={handleDownloadZip}
                disabled={isDownloadingZip}
                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition shrink-0"
              >
                <FolderArchive className="w-4 h-4" />
                <span>{isDownloadingZip ? 'Generating Zip...' : 'Download Full Android Project (.zip)'}</span>
              </button>
            </div>

            {/* GitHub Repository Push Integration Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white text-base font-bold">
                    🐙
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white flex items-center gap-2">
                      <span>Git Repository Status: Ready to Push</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Committed (main branch)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      All 22 project files are staged and committed in the local Git repository on branch <code>main</code>.
                    </p>
                  </div>
                </div>

                <div className="text-xs text-slate-400 font-mono bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto">
                  commit: <span className="text-sky-400">f5d598f</span>
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-300 space-y-2">
                <p>
                  To push these committed files to your GitHub account:
                </p>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[11.5px] text-sky-300 space-y-1">
                  <div>git remote add origin https://github.com/&lt;your-username&gt;/&lt;your-repo&gt;.git</div>
                  <div>git branch -M main</div>
                  <div>git push -u origin main</div>
                </div>
                <p className="text-[11px] text-slate-400">
                  Tip: If your GitHub repository uses a Personal Access Token (PAT), provide your repo URL and token in chat, and it will be pushed automatically!
                </p>
              </div>
            </div>

            {/* File Selector Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-800">
              {ANDROID_FILES.map((file, idx) => (
                <button
                  key={file.path}
                  onClick={() => setSelectedFileIndex(idx)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-2 ${
                    selectedFileIndex === idx
                      ? 'bg-slate-800 text-sky-400 border border-sky-400/40 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900'
                  }`}
                >
                  <span className="font-mono">{file.name}</span>
                </button>
              ))}
            </div>

            {/* Active File Details & Code Display */}
            {ANDROID_FILES[selectedFileIndex] && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
                <div className="px-5 py-3.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-xs text-sky-400 block">
                      {ANDROID_FILES[selectedFileIndex].path}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {ANDROID_FILES[selectedFileIndex].description}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyCode(ANDROID_FILES[selectedFileIndex].content)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-semibold flex items-center gap-1.5 transition"
                    >
                      {copiedFile ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <pre className="p-5 text-xs font-mono text-slate-300 overflow-x-auto max-h-[580px] bg-slate-950/90 leading-relaxed selection:bg-sky-500/30">
                  <code>{ANDROID_FILES[selectedFileIndex].content}</code>
                </pre>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        GBL Battle Matrix Overlay • Built with Kotlin, WindowManager TYPE_APPLICATION_OVERLAY, MediaProjection in-memory frame capture, and ML Kit Text Recognition.
      </footer>
    </div>
  );
}
