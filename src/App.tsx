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
  ChevronDown
} from 'lucide-react';
import {
  POKEMON_DATABASE,
  INITIAL_PRESETS,
  TeamPreset,
  TeamMember,
  calculateTurnAlignment,
  calculateChargedDamage,
  calculateShieldMatrix,
  PokemonStats
} from './data/gblData';
import { ANDROID_FILES, downloadAndroidProjectZip, AndroidProjectFile } from './data/androidFiles';

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'simulator' | 'presets' | 'ocr_scan' | 'turn_matrix' | 'android_code'>('simulator');

  // Overlay Mode: Option 1 (Top-Left Sky Trench) vs Option 2 (Bottom Horizon Belt)
  const [layoutMode, setLayoutMode] = useState<'option1' | 'option2'>('option1');
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);

  // Overlay Custom Position (Optimized higher default: y=38px, x=8px so it never interferes with opponent HP bar)
  const [overlayPos, setOverlayPos] = useState<{ x: number; y: number }>({ x: 8, y: 38 });

  // Mouse & Touch drag handling for moving overlay in simulator
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number; initialOverlayX: number; initialOverlayY: number }>({
    x: 0,
    y: 0,
    initialOverlayX: 8,
    initialOverlayY: 38
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

  // Team Presets State (stored in localStorage)
  const [presets, setPresets] = useState<TeamPreset[]>(() => {
    const saved = localStorage.getItem('gbl_team_presets_v1');
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
    localStorage.setItem('gbl_team_presets_v1', JSON.stringify(presets));
  }, [presets]);

  useEffect(() => {
    localStorage.setItem('gbl_selected_preset_id', selectedPresetId);
  }, [selectedPresetId]);

  const activePreset = useMemo(() => {
    return presets.find(p => p.id === selectedPresetId) || presets[0] || INITIAL_PRESETS[0];
  }, [presets, selectedPresetId]);

  // Battle Simulation State
  const [activeOpponentKey, setActiveOpponentKey] = useState<string>('Entei');
  const [userTurnsElapsed, setUserTurnsElapsed] = useState<number>(0);
  const [oppTurnsElapsed, setOppTurnsElapsed] = useState<number>(0);
  const [userEnergy, setUserEnergy] = useState<number>(36);
  const [oppEnergy, setOppEnergy] = useState<number>(40);
  const [userShields, setUserShields] = useState<number>(2);
  const [oppShields, setOppShields] = useState<number>(2);

  // Scanned Opponents (Simulating ML Kit 1.4s OCR detection)
  const [scannedOpponents, setScannedOpponents] = useState<string[]>(['Entei', 'Yveltal', 'Zacian (Crowned)']);
  const [isWaitingOpponent, setIsWaitingOpponent] = useState<boolean>(false);
  const [showOpponentPicker, setShowOpponentPicker] = useState<boolean>(false);

  // Preset Dialog State
  const [isNewPresetOpen, setIsNewPresetOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetLeague, setNewPresetLeague] = useState<'MASTER LEAGUE' | 'ULTRA LEAGUE' | 'GREAT LEAGUE'>('MASTER LEAGUE');
  const [p1Name, setP1Name] = useState('Dialga (Origin)');
  const [p1Cp, setP1Cp] = useState(4624);
  const [p2Name, setP2Name] = useState('Lugia');
  const [p2Cp, setP2Cp] = useState(4179);
  const [p3Name, setP3Name] = useState('Kyogre');
  const [p3Cp, setP3Cp] = useState(4652);

  // Code Viewer State
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(0);
  const [copiedFile, setCopiedFile] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // OCR Party scan simulation
  const [isScanningParty, setIsScanningParty] = useState(false);
  const [scanResult, setScanResult] = useState<{
    league: string;
    members: { name: string; cp: number; confidence: number }[];
  } | null>(null);

  // Actions for Overlay: Start Battle (clears opponents) & Scan Team (creates scanned team)
  const handleStartBattle = () => {
    setScannedOpponents([]);
    setIsWaitingOpponent(true);
    setActiveOpponentKey('Waiting...');
    setUserTurnsElapsed(0);
    setOppTurnsElapsed(0);
    setUserEnergy(0);
    setOppEnergy(0);
  };

  const handleSelectOpponent = (name: string) => {
    setActiveOpponentKey(name);
    setIsWaitingOpponent(false);
    setShowOpponentPicker(false);
    setScannedOpponents(prev => {
      if (prev.includes(name)) return prev;
      return [name, ...prev.filter(n => n !== name).slice(0, 2)];
    });
  };

  const handleScanTeam = () => {
    setIsScanningParty(true);
    setTimeout(() => {
      const sampleTeams = [
        {
          name: 'Great: Clodsire / Feraligatr / Mandibuzz',
          league: 'GREAT LEAGUE' as const,
          pokemon: [
            { id: 'scan-1', name: 'Clodsire', cp: 1494, fastMove: 'Poison Sting', chargedMove1: 'Earthquake', chargedMove2: 'Stone Edge' },
            { id: 'scan-2', name: 'Feraligatr', cp: 1488, fastMove: 'Shadow Claw', chargedMove1: 'Hydro Cannon', chargedMove2: 'Ice Beam' },
            { id: 'scan-3', name: 'Mandibuzz', cp: 1490, fastMove: 'Snarl', chargedMove1: 'Dark Pulse', chargedMove2: 'Aerial Ace' }
          ]
        },
        {
          name: 'Ultra: Giratina-A / Cresselia / Cobalion',
          league: 'ULTRA LEAGUE' as const,
          pokemon: [
            { id: 'scan-4', name: 'Giratina (Altered)', cp: 2488, fastMove: 'Shadow Claw', chargedMove1: 'Dragon Claw', chargedMove2: 'Ancient Power' },
            { id: 'scan-5', name: 'Cresselia', cp: 2488, fastMove: 'Psycho Cut', chargedMove1: 'Grass Knot', chargedMove2: 'Moonblast' },
            { id: 'scan-6', name: 'Cobalion', cp: 2492, fastMove: 'Double Kick', chargedMove1: 'Sacred Sword', chargedMove2: 'Stone Edge' }
          ]
        },
        {
          name: 'Master: Dialga-O / Lugia / Kyogre',
          league: 'MASTER LEAGUE' as const,
          pokemon: [
            { id: 'scan-7', name: 'Dialga (Origin)', cp: 4624, fastMove: 'Dragon Breath', chargedMove1: 'Roar of Time', chargedMove2: 'Iron Head' },
            { id: 'scan-8', name: 'Lugia', cp: 4179, fastMove: 'Dragon Tail', chargedMove1: 'Aeroblast', chargedMove2: 'Sky Attack' },
            { id: 'scan-9', name: 'Kyogre', cp: 4652, fastMove: 'Waterfall', chargedMove1: 'Surf', chargedMove2: 'Origin Pulse' }
          ]
        }
      ];
      const picked = sampleTeams[Math.floor(Math.random() * sampleTeams.length)];
      const scannedPreset: TeamPreset = {
        id: `scanned-${Date.now()}`,
        name: `Scanned: ${picked.pokemon.map(p => p.name.split(' ')[0]).join('/')}`,
        league: picked.league,
        pokemon: picked.pokemon
      };
      setPresets(prev => [scannedPreset, ...prev]);
      setSelectedPresetId(scannedPreset.id);
      setIsScanningParty(false);
    }, 1000);
  };

  // Active Pokémon stats
  const activeOpponent = POKEMON_DATABASE[activeOpponentKey] || POKEMON_DATABASE['Entei'];
  const userLeadName = activePreset?.pokemon[0]?.name || 'Dialga (Origin)';
  const userActivePokemon = POKEMON_DATABASE[userLeadName] || POKEMON_DATABASE['Luxray'] || POKEMON_DATABASE['Dialga (Origin)'];

  // Calculations
  const userFastTurns = userActivePokemon?.defaultFastMove?.turns || 3;
  const oppFastTurns = activeOpponent?.defaultFastMove?.turns || 2;
  const turnAlignInfo = calculateTurnAlignment(userFastTurns, oppFastTurns);

  // Damage Calculations
  const oppDamageData = useMemo(() => {
    return activeOpponent.chargedMoves.map(move => {
      const calc = calculateChargedDamage(activeOpponent, userActivePokemon, move);
      const tapsNeeded = Math.max(0, Math.ceil((move.energyCost - oppEnergy) / (activeOpponent.defaultFastMove.energyGain || 8)));
      return {
        move,
        ...calc,
        tapsNeeded,
        isReady: oppEnergy >= move.energyCost
      };
    });
  }, [activeOpponent, userActivePokemon, oppEnergy]);

  // Fast move click handler in simulator
  const handleFastAttack = () => {
    const newTurns = userTurnsElapsed + 1;
    setUserTurnsElapsed(newTurns);
    setUserEnergy(prev => Math.min(100, prev + (userActivePokemon.defaultFastMove.energyGain || 8)));

    // Opponent also attacks
    setOppTurnsElapsed(prev => prev + 1);
    setOppEnergy(prev => Math.min(100, prev + (activeOpponent.defaultFastMove.energyGain || 8)));
  };

  const isCurrentTurnZeroSneak = useMemo(() => {
    if (userTurnsElapsed === 0) return false;
    const totalHalfSeconds = userTurnsElapsed * userFastTurns;
    return totalHalfSeconds % oppFastTurns !== 0;
  }, [userTurnsElapsed, userFastTurns, oppFastTurns]);

  // Handle Preset Creation
  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `preset-${Date.now()}`;
    const newPreset: TeamPreset = {
      id: newId,
      name: newPresetName.trim() || `${newPresetLeague} Custom`,
      league: newPresetLeague,
      pokemon: [
        {
          id: 'p1',
          name: p1Name.trim() || 'Dialga',
          cp: p1Cp || 4500,
          fastMove: 'Dragon Breath',
          chargedMove1: 'Roar of Time',
          chargedMove2: 'Iron Head'
        },
        {
          id: 'p2',
          name: p2Name.trim() || 'Lugia',
          cp: p2Cp || 4100,
          fastMove: 'Dragon Tail',
          chargedMove1: 'Aeroblast',
          chargedMove2: 'Sky Attack'
        },
        {
          id: 'p3',
          name: p3Name.trim() || 'Kyogre',
          cp: p3Cp || 4600,
          fastMove: 'Waterfall',
          chargedMove1: 'Surf',
          chargedMove2: 'Origin Pulse'
        }
      ]
    };

    setPresets(prev => [...prev, newPreset]);
    setSelectedPresetId(newId);
    setIsNewPresetOpen(false);
    setNewPresetName('');
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

  // Trigger simulated ML Kit party screen scan
  const handleScanPartyScreen = () => {
    setIsScanningParty(true);
    setTimeout(() => {
      setIsScanningParty(false);
      setScanResult({
        league: 'MASTER LEAGUE',
        members: [
          { name: 'Dialga (Origin)', cp: 4624, confidence: 0.99 },
          { name: 'Lugia', cp: 4179, confidence: 0.98 },
          { name: 'Kyogre', cp: 4652, confidence: 0.99 }
        ]
      });
    }, 1100);
  };

  const handleApplyScannedParty = () => {
    if (!scanResult) return;
    const newId = `preset-scanned-${Date.now()}`;
    const scannedPreset: TeamPreset = {
      id: newId,
      name: `Scanned: ${scanResult.members.map(m => m.name.split(' ')[0]).join('/')}`,
      league: 'MASTER LEAGUE',
      pokemon: scanResult.members.map((m, idx) => ({
        id: `scanned-${idx}`,
        name: m.name,
        cp: m.cp,
        fastMove: 'Fast Move',
        chargedMove1: 'Move 1',
        chargedMove2: 'Move 2'
      }))
    };
    setPresets(prev => [...prev, scannedPreset]);
    setSelectedPresetId(newId);
    setActiveTab('simulator');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500 selection:text-white">
      {/* Top Application Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base md:text-lg tracking-tight text-white">GBL Battle Matrix</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Android Native Overlay
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Real-Time ML Kit OCR • PvPoke Gamemaster • Zero-Sneak Turn Alignment • 3v3 Shield Matrix
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
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
              onClick={() => setActiveTab('ocr_scan')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'ocr_scan'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Party OCR</span>
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
                      onClick={() => setOverlayPos({ x: 8, y: 38 })}
                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-sky-600 text-[10px] text-slate-300 hover:text-white font-semibold transition ml-0.5"
                      title="Reset to Top-Left Default"
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
                      <div className="text-[10px] text-slate-300 font-semibold [text-shadow:0_1px_2px_#000]">
                        {activeOpponent.defaultFastMove.turns}t {activeOpponent.defaultFastMove.name}
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
                      <div className="text-[10px] text-slate-300 font-semibold [text-shadow:0_1px_2px_#000]">
                        {userFastTurns}t {userActivePokemon.defaultFastMove?.name || 'Spark'}
                      </div>
                    </div>
                  </div>

                  {/* =========================================================================
                      FLOATING OVERLAY OPTION 1: Top-Left Sky Trench
                      (Anchored at X: 8px, Y: 38px, 272px wide - elevated clear of Opponent HP bar)
                     ========================================================================= */}
                  {isOverlayVisible && layoutMode === 'option1' && (
                    <div 
                      className={`absolute z-30 rounded-lg p-2 border border-white/20 shadow-2xl transition-all ${
                        isDragging ? 'ring-2 ring-sky-400 scale-[1.01]' : ''
                      }`}
                      style={{
                        top: `${overlayPos.y}px`,
                        left: `${overlayPos.x}px`,
                        width: '272px',
                        background: 'rgba(10, 14, 22, 0.44)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.95), 0 0 4px rgba(0, 0, 0, 0.9)'
                      }}
                    >


                      {/* Quick manual opponent picker popup */}
                      {showOpponentPicker && (
                        <div className="absolute top-10 left-2 right-2 bg-slate-900 border border-sky-400 rounded-lg p-2 z-50 shadow-2xl">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold text-sky-400">Select Opponent Pokémon</span>
                            <button 
                              onClick={() => setShowOpponentPicker(false)}
                              className="text-slate-400 hover:text-white text-xs px-1"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-0.5">
                            {['Raikou', 'Entei', 'Suicune', 'Dialga (Origin)', 'Lugia', 'Kyogre', 'Clodsire', 'Feraligatr', 'Mandibuzz', 'Giratina (Altered)', 'Cresselia', 'Cobalion', 'Talonflame', 'Serperior', 'Annihilape', 'Azumarill', 'Skarmory', 'Whiscash', 'Swampert', 'Zacian (Crowned)', 'Groudon', 'Mewtwo'].map(name => (
                              <button
                                key={name}
                                onClick={() => handleSelectOpponent(name)}
                                className="text-left text-[9.5px] px-1.5 py-1 rounded bg-slate-800 hover:bg-sky-600 text-slate-200 hover:text-white font-medium truncate"
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Header row */}
                      <div className="flex items-center justify-between pb-1.5 border-b border-white/15">
                        <div className="font-extrabold text-[11.5px] text-amber-100 flex items-center gap-1.5">
                          {isWaitingOpponent || scannedOpponents.length === 0 ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                              <span className="text-emerald-200">WAITING FOR OPPONENT...</span>
                              <span className="text-amber-300 font-semibold text-[9.5px]">(Scanning Header)</span>
                            </>
                          ) : (
                            <>
                              <span>⚔️ VS {activeOpponent.name.toUpperCase()}</span>
                              <span className="text-amber-300 font-semibold text-[10.5px]">
                                ({oppFastTurns}t {activeOpponent.defaultFastMove.name})
                              </span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Team preset quick picker */}
                          <div className="relative">
                            <select
                              value={selectedPresetId}
                              onChange={(e) => setSelectedPresetId(e.target.value)}
                              className="bg-slate-900/90 text-emerald-400 border border-white/20 rounded text-[9.5px] px-1.5 py-0.5 font-bold outline-none cursor-pointer max-w-[85px] truncate"
                            >
                              {presets.map(p => (
                                <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                                  {p.name.split(':')[0]}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            onClick={() => setLayoutMode('option2')}
                            className="bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-[9px] px-1.5 py-0.5 rounded border border-white/25 transition"
                          >
                            ⇄ Opt 2
                          </button>
                        </div>
                      </div>

                      {/* Action Toolbar */}
                      <div className="flex items-center justify-between gap-1.5 bg-black/35 p-1 rounded border border-white/10 my-1">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={handleStartBattle}
                            className="bg-red-500/30 hover:bg-red-500/50 active:scale-95 text-red-200 border border-red-500/50 font-bold text-[9.5px] px-2 py-0.5 rounded transition flex items-center gap-1"
                            title="Clear previous opponents and reset waiting HUD"
                          >
                            ⚔️ Start Battle
                          </button>
                          <button
                            onClick={() => setShowOpponentPicker(!showOpponentPicker)}
                            className="bg-sky-500/25 hover:bg-sky-500/40 active:scale-95 text-sky-200 border border-sky-400/50 font-bold text-[9px] px-1.5 py-0.5 rounded transition"
                            title="Pick opponent manually"
                          >
                            🔍 Pick Opp
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          {activePreset.pokemon.map(member => (
                            <span
                              key={member.id}
                              className="text-[8.5px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 border border-emerald-500/40"
                            >
                              {member.name.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* 3v3 Matchup Matrix Dots */}
                      <div className="my-1 py-1 px-1.5 bg-black/20 rounded flex flex-col gap-1 text-[10px]">
                        {isWaitingOpponent || scannedOpponents.length === 0 ? (
                          <div className="text-[9.5px] text-slate-300 flex items-center gap-1.5 py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Scanner active! Ready for opponent spawn or tap <strong>Pick Opp</strong></span>
                          </div>
                        ) : (
                          scannedOpponents.map((oppName) => {
                            const matrix = calculateShieldMatrix(
                              oppName,
                              activePreset.pokemon.map(p => p.name)
                            );
                            const shortOpp = oppName.substring(0, 3);
                            const p1Init = activePreset.pokemon[0]?.name.charAt(0) || 'D';
                            const p2Init = activePreset.pokemon[1]?.name.charAt(0) || 'L';
                            const p3Init = activePreset.pokemon[2]?.name.charAt(0) || 'K';

                            return (
                              <div key={oppName} className="flex items-center justify-between font-mono">
                                <span className="font-bold text-slate-200 w-7">{shortOpp}</span>
                                <div className="flex items-center gap-1 text-[9.5px]">
                                  <span className="font-bold text-slate-400">{p1Init}:</span>
                                  <span>{matrix.p1 || '🟢🟡🔴'}</span>
                                  <span className="text-white/30">|</span>
                                  <span className="font-bold text-slate-400">{p2Init}:</span>
                                  <span>{matrix.p2 || '🔴🔴🔴'}</span>
                                  <span className="text-white/30">|</span>
                                  <span className="font-bold text-slate-400">{p3Init}:</span>
                                  <span>{matrix.p3 || '🟢🟢🟢'}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Optimal Fast Move Turn Alignment Box */}
                      <div className={`p-1.5 rounded flex items-center justify-between text-[10.5px] font-bold border-l-2 mb-1.5 ${
                        isWaitingOpponent || scannedOpponents.length === 0
                          ? 'bg-slate-800/60 border-slate-600 text-slate-300'
                          : isCurrentTurnZeroSneak 
                            ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 animate-pulse'
                            : 'bg-red-500/20 border-red-500 text-orange-200'
                      }`}>
                        <div className="flex items-center gap-1.5">
                          <span>🎯 THROW:</span>
                          <span className="underline decoration-orange-400 font-extrabold text-white">
                            {isWaitingOpponent || scannedOpponents.length === 0
                              ? 'Waiting for Opponent spawn'
                              : turnAlignInfo.optimalThrowText}
                          </span>
                        </div>
                        <span className="text-[8.5px] font-semibold text-slate-300">
                          {isWaitingOpponent || scannedOpponents.length === 0
                            ? 'Awaiting Fast Attack'
                            : isCurrentTurnZeroSneak ? '✨ SNEAK-FREE WINDOW' : '(Zero-Sneak)'}
                        </span>
                      </div>

                      {/* Charged Move Damage Counter */}
                      <div className="flex flex-col gap-0.5 text-[9.5px] text-slate-200 leading-tight">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span>💥 <strong>{isWaitingOpponent || scannedOpponents.length === 0 ? 'Awaiting Opponent' : activeOpponent.name}</strong> Dmg to {userActivePokemon.name.split(' ')[0]}:</span>
                          {isWaitingOpponent || scannedOpponents.length === 0 ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            oppDamageData.slice(0, 2).map((dmg, idx) => (
                              <span 
                                key={dmg.move.name}
                                className={dmg.isReady ? 'text-emerald-400 font-bold' : 'text-amber-300 font-medium'}
                              >
                                {dmg.move.code} ({dmg.percentage}% • {dmg.isReady ? 'Ready' : `${dmg.tapsNeeded} taps`})
                                {idx === 0 && oppDamageData.length > 1 ? ' | ' : ''}
                              </span>
                            ))
                          )}
                        </div>
                        <div className="text-slate-300/80 text-[8.5px] truncate">
                          {isWaitingOpponent || scannedOpponents.length === 0
                            ? 'Opponent Bench: Awaiting detection...'
                            : '💥 Bench: Yvl [DP: 42% | OW: 68%] • Zac [CC: 44%]'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* =========================================================================
                      FLOATING OVERLAY OPTION 2: Bottom Horizon Belt Fallback
                      (Wide single-line horizontal ticker between sprites and charge buttons)
                     ========================================================================= */}
                  {isOverlayVisible && layoutMode === 'option2' && (
                    <div 
                      className="absolute bottom-[108px] left-[8px] right-[8px] z-30 rounded-lg p-2 border border-white/20 shadow-2xl transition-all"
                      style={{
                        background: 'rgba(10, 14, 22, 0.42)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.95), 0 0 4px rgba(0, 0, 0, 0.9)'
                      }}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-none font-mono">
                          {isWaitingOpponent || scannedOpponents.length === 0 ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <strong className="text-emerald-300">[Waiting for Opponent]</strong>
                              <span className="text-slate-400">Scanning top battle header...</span>
                            </>
                          ) : (
                            <>
                              <strong>[{activeOpponent.name}: {oppFastTurns}t]</strong>
                              <span>D: 🟢🟡🔴 | L: 🔴🔴🔴 | K: 🟢🟢🟢</span>
                              <span className="text-white/30">•</span>
                              <strong>[Yveltal]</strong>
                              <span>D: 🟢🟢🔴 | L: 🔴🔴🔴</span>
                              <span className="text-white/30">•</span>
                              <strong>[Zac-C]</strong>
                              <span>D: 🔴🔴🔴</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-1">

                          <button
                            onClick={handleStartBattle}
                            className="bg-red-500/30 hover:bg-red-500/50 text-red-200 text-[8.5px] font-bold px-1.5 py-0.5 rounded"
                            title="Start fresh battle"
                          >
                            ⚔️ New
                          </button>
                          <button
                            onClick={() => setLayoutMode('option1')}
                            className="bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-[8.5px] px-1.5 py-0.5 rounded border border-white/25"
                          >
                            ⇄ Opt 1
                          </button>
                        </div>
                      </div>

                      <div className="mt-1 pt-1 border-t border-white/10 flex items-center justify-between text-[9px] text-orange-200">
                        <div>
                          🎯 <strong className="text-white">THROW ON:</strong> {isWaitingOpponent || scannedOpponents.length === 0 ? '—' : turnAlignInfo.horizonText}
                          <span className="mx-1 text-white/30">•</span>
                          <span>{isWaitingOpponent || scannedOpponents.length === 0 ? 'Awaiting opponent spawn...' : `💥 Dmg to ${userActivePokemon.name.split(' ')[0]}: Ent [FC: 28% / OH: 72%] • Yvl [DP: 42%]`}</span>
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

                {/* Opponent Selection (Simulating ML Kit OCR detection) */}
                <div className="pt-3 border-t border-slate-800">
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Opponent Pokémon Detected via OCR (1.4s Loop):
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Entei', 'Yveltal', 'Zacian (Crowned)', 'Kyogre', 'Dialga (Origin)', 'Giratina (Altered)'].map((opp) => (
                      <button
                        key={opp}
                        onClick={() => {
                          setActiveOpponentKey(opp);
                          if (!scannedOpponents.includes(opp)) {
                            setScannedOpponents(prev => [opp, ...prev.slice(0, 2)]);
                          }
                        }}
                        className={`p-2 rounded-lg text-xs font-semibold border transition text-left truncate ${
                          activeOpponentKey === opp
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {opp.split(' ')[0]}
                      </button>
                    ))}
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
                onClick={() => setIsNewPresetOpen(true)}
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
                            : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
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

                      {/* 3 Pokémon Slots */}
                      <div className="space-y-2">
                        {preset.pokemon.map((member, index) => (
                          <div
                            key={member.id || index}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/80 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-500">
                                #{index + 1}
                              </span>
                              <span className="font-semibold text-slate-200">{member.name}</span>
                            </div>
                            <span className="text-[11px] font-mono font-bold text-sky-400">
                              CP {member.cp}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-slate-400 text-[11px]">
                        Fast Moves: {preset.pokemon.map(p => p.fastMove).join(', ')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Dialog for Creating New Preset */}
            {isNewPresetOpen && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-400" />
                      <span>Create New GBL Team Preset</span>
                    </h3>
                    <button
                      onClick={() => setIsNewPresetOpen(false)}
                      className="text-slate-400 hover:text-white text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={handleCreatePreset} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Preset Name
                      </label>
                      <input
                        type="text"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="e.g. Master: Dialga-O / Lugia / Kyogre"
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        League Category
                      </label>
                      <select
                        value={newPresetLeague}
                        onChange={(e) => setNewPresetLeague(e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
                      >
                        <option value="MASTER LEAGUE">MASTER LEAGUE (No CP Limit)</option>
                        <option value="ULTRA LEAGUE">ULTRA LEAGUE (Max 2500 CP)</option>
                        <option value="GREAT LEAGUE">GREAT LEAGUE (Max 1500 CP)</option>
                      </select>
                    </div>

                    {/* Slot 1 */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <span className="text-xs font-bold text-sky-400 block">Slot 1 (Lead Pokémon)</span>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p1Name}
                          onChange={(e) => setP1Name(e.target.value)}
                          placeholder="Name (e.g. Dialga)"
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
                    </div>

                    {/* Slot 2 */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <span className="text-xs font-bold text-purple-400 block">Slot 2 (Safe Swap)</span>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p2Name}
                          onChange={(e) => setP2Name(e.target.value)}
                          placeholder="Name (e.g. Lugia)"
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
                    </div>

                    {/* Slot 3 */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <span className="text-xs font-bold text-amber-400 block">Slot 3 (Closer)</span>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p3Name}
                          onChange={(e) => setP3Name(e.target.value)}
                          placeholder="Name (e.g. Kyogre)"
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
                    </div>

                    <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setIsNewPresetOpen(false)}
                        className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30"
                      >
                        Save Preset Locally
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: PARTY SCREEN OCR SCANNER MODULE
           ========================================================================= */}
        {activeTab === 'ocr_scan' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Visual Screen Reference Replicating user's screenshot */}
            <div className="lg:col-span-6 flex flex-col items-center">
              <div className="text-xs font-semibold text-slate-300 mb-2">
                Party Screen OCR Crop Regions (Green: League, Blue: 3 Team Members)
              </div>

              <div className="relative w-full max-w-[340px] h-[680px] rounded-[32px] border-4 border-slate-800 bg-slate-950 overflow-hidden shadow-2xl flex flex-col justify-between p-4">
                
                {/* Header with back icon and bag */}
                <div className="flex justify-between items-center text-slate-300 text-xs">
                  <span className="p-1 rounded-full bg-slate-800/80">⇦</span>
                  <span className="p-1 rounded-full bg-slate-800/80">🎒</span>
                </div>

                {/* Trainer Avatar & Badge */}
                <div className="flex flex-col items-center my-2">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center text-3xl">
                    🧢
                  </div>
                  <div className="w-12 h-10 mt-1 bg-gradient-to-tr from-purple-600 to-indigo-500 clip-triangle flex items-center justify-center text-xs">
                    ⚔️
                  </div>
                </div>

                {/* GREEN REGION CROP: Active League */}
                <div className="relative border-4 border-emerald-500 rounded-3xl p-3 bg-slate-900/60 backdrop-blur text-center my-2 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <span className="absolute -top-3 left-4 bg-emerald-500 text-slate-950 text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                    ML Kit OCR: League Region
                  </span>
                  <h3 className="font-black text-lg text-white tracking-wide">MASTER LEAGUE</h3>
                  <p className="text-[11px] text-slate-300">Max CP per Pokémon: No limit</p>
                  <div className="w-12 h-1 bg-white/40 mx-auto mt-2 rounded-full" />
                </div>

                <div className="text-center text-xs font-bold text-slate-300 my-1">
                  CHOOSE YOUR PARTY
                </div>

                {/* BLUE REGION CROP: Party Members */}
                <div className="relative border-4 border-sky-400 rounded-2xl p-3 bg-white/95 text-slate-900 shadow-[0_0_20px_rgba(56,189,248,0.3)]">
                  <span className="absolute -top-3 left-4 bg-sky-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                    ML Kit OCR: Party Crop Region
                  </span>

                  <div className="text-center font-bold text-sm text-slate-800 border-b border-slate-200 pb-1 mb-2">
                    New Party
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-bold text-slate-700">CP 4624</span>
                      <div className="w-12 h-12 rounded-lg bg-sky-100 flex items-center justify-center text-2xl my-1 border border-sky-200">
                        🦕
                      </div>
                      <span className="text-[9px] font-bold text-slate-800 text-center truncate w-full">
                        Dialga-O
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-bold text-slate-700">CP 4179</span>
                      <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center text-2xl my-1 border border-purple-200">
                        🕊️
                      </div>
                      <span className="text-[9px] font-bold text-slate-800 text-center truncate w-full">
                        Lugia
                      </span>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[11px] font-bold text-slate-700">CP 4652</span>
                      <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-2xl my-1 border border-blue-200">
                        🐋
                      </div>
                      <span className="text-[9px] font-bold text-slate-800 text-center truncate w-full">
                        Kyogre
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom button */}
                <div className="py-2">
                  <div className="w-full py-2.5 rounded-full bg-emerald-500 text-white font-bold text-xs text-center uppercase tracking-wider">
                    Use This Party
                  </div>
                </div>

              </div>
            </div>

            {/* OCR Engine Details & Test Action */}
            <div className="lg:col-span-6 flex flex-col gap-5">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-2 mb-3">
                  <Scan className="w-5 h-5 text-sky-400" />
                  <h3 className="font-bold text-base text-white">Party Screen Scanner Engine</h3>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  Using Android's <code>MediaProjection</code> and <code>ImageReader</code>, screen frames are captured strictly in-memory into a Direct ByteBuffer (zero disk writes). The overlay runs two separate ML Kit Text Recognition passes:
                </p>

                <div className="space-y-3 text-xs mb-5">
                  <div className="p-3 rounded-xl bg-slate-950/60 border border-emerald-500/30">
                    <strong className="text-emerald-400 block mb-1">Pass 1: League Crop (Y: 22% - 32%)</strong>
                    <span className="text-slate-400">
                      Crops the upper-center bounding box to identify active Battle League rules ("MASTER LEAGUE", "ULTRA LEAGUE", "GREAT LEAGUE").
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950/60 border border-sky-500/30">
                    <strong className="text-sky-400 block mb-1">Pass 2: Team Members Crop (Y: 55% - 72%)</strong>
                    <span className="text-slate-400">
                      Crops the 3 team member slots, extracting CP numbers and fuzzy-matching Pokémon nicknames (e.g. "☆B-DayRoT100" → Dialga-Origin, "Lugia151415" → Lugia, "☆M²Kvogre" → Kyogre).
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleScanPartyScreen}
                  disabled={isScanningParty}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-sky-500/25 flex items-center justify-center gap-2 transition"
                >
                  {isScanningParty ? (
                    <>
                      <RotateCcw className="w-4 h-4 animate-spin" />
                      <span>Processing In-Memory OCR Frame...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Run ML Kit Party Scan Test</span>
                    </>
                  )}
                </button>

                {scanResult && (
                  <div className="mt-5 p-4 rounded-xl bg-slate-950 border border-sky-400/50 animate-in fade-in">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" />
                        <span>OCR Extraction Successful</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">Latency: 142ms</span>
                    </div>

                    <div className="text-xs text-white font-semibold mb-2">
                      Active League: <span className="text-sky-400">{scanResult.league}</span>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-300 mb-3">
                      {scanResult.members.map((m, i) => (
                        <div key={i} className="flex justify-between items-center py-1 border-b border-slate-800">
                          <span>Slot {i + 1}: <strong>{m.name}</strong></span>
                          <span className="text-sky-300 font-mono">CP {m.cp} ({(m.confidence * 100).toFixed(0)}% conf)</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={handleApplyScannedParty}
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
                    >
                      Save As Team Preset & Apply to Overlay
                    </button>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            TAB 4: FAST MOVE TURN ALIGNMENT & SNEAK MECHANICS
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
