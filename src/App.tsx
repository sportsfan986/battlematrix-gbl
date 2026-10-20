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
  Swords,
  GripVertical,
  RefreshCw,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import {
  POKEMON_DATABASE,
  INITIAL_PRESETS,
  TeamPreset,
  TeamMember,
  LeagueType,
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
  TopOpponentInfo,
  computeEffectiveStatsForLeague,
  getRecommendedMovesForPokemon,
  getLeagueTop3Template,
  syncPvPokeDataAndRankings,
  getPvPokeDatabaseTelemetry,
  getPokemonAutocompleteSuggestions,
  PokemonAutocompleteOption,
  MatchupTierThresholds,
  DEFAULT_MATCHUP_TIER_THRESHOLDS,
  MATCHUP_TIER_THRESHOLDS_STORAGE_KEY,
  getStoredMatchupTierThresholds
} from './data/gblData';
import {
  BattleQualityMetadata,
  BattleTimelineEvent,
  calculateBattleQuality,
  calculateAggregateWAE,
  migrateExistingBattleLogs,
  reparseAllCompletedBattleLogs,
  resolveLogEntryQuality
} from './data/battleQuality';
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

export interface WebBattleLogEntry {
  id: string;
  timestampMs: number;
  league: string;
  presetId?: string;
  userTeamName: string;
  userPokemon: string[];
  opponents: string[];
  result: 'WIN' | 'LOSS';
  leadMatchup: 'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE';
  bmfScore?: number | null;
  execWae?: number | null;
  badges?: string[];
  flags?: string[];
  quality?: BattleQualityMetadata | null;
  timelineEvents?: BattleTimelineEvent[];
  battleDurationSec?: number;
  userFaints?: number;
  oppFaints?: number;
  userShieldsRemaining?: number;
  oppShieldsRemaining?: number;
  deviceId?: string;
  updatedAt?: number;
}

export interface GblSeasonInfo {
  eventID: string;
  name: string;
  startMs: number;
  endMs: number;
  rawStart: string;
  rawEnd: string;
}

const DEFAULT_SEASONS_FALLBACK: GblSeasonInfo[] = [
  {
    eventID: 'season-24-twilight-trails',
    name: 'Twilight Trails',
    startMs: new Date('2026-09-08T10:00:00').getTime(),
    endMs: new Date('2026-12-01T10:00:00').getTime(),
    rawStart: '2026-09-08T10:00:00',
    rawEnd: '2026-12-01T10:00:00'
  },
  {
    eventID: 'season-23-prev',
    name: 'Previous GBL Season',
    startMs: new Date('2026-06-01T10:00:00').getTime(),
    endMs: new Date('2026-09-08T10:00:00').getTime(),
    rawStart: '2026-06-01T10:00:00',
    rawEnd: '2026-09-08T10:00:00'
  }
];

export default function App() {
  // Navigation tabs (includes separated Teams, Settings, and Battle Log pages)
  const [activeTab, setActiveTab] = useState<'simulator' | 'presets' | 'settings' | 'battle_log' | 'turn_matrix' | 'android_code'>('simulator');

  // Floating Overlay Visibility & Minimized Bubble State
  const [isOverlayVisible, setIsOverlayVisible] = useState(true);
  const [isOverlayMinimized, setIsOverlayMinimized] = useState(false);

  // PvPoke Gamemaster + League Rankings Sync State
  const [isSyncingPvPoke, setIsSyncingPvPoke] = useState(false);
  const [pvPokeSyncStatus, setPvPokeSyncStatus] = useState<string>('Syncing GameMaster & 4 League Rankings...');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => {
    try {
      return localStorage.getItem('gbl_last_sync_timestamp') || 'Not synced yet';
    } catch {
      return 'Not synced yet';
    }
  });
  const [dbTelemetry, setDbTelemetry] = useState(() => getPvPokeDatabaseTelemetry());

  // Drag-and-drop state for rearranging Team Presets
  const [draggedPresetIndex, setDraggedPresetIndex] = useState<number | null>(null);
  const [dragOverPresetIndex, setDragOverPresetIndex] = useState<number | null>(null);

  // Autocomplete pop-down state for Team Builder UI slots (1, 2, 3)
  const [activeAutocompleteSlot, setActiveAutocompleteSlot] = useState<1 | 2 | 3 | null>(null);
  const [autocompleteHighlightIdx, setAutocompleteHighlightIdx] = useState<number>(0);

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

  // App Setting: Enable 4 Charged Moves in Overlay (Default: false -> 3 moves)
  const [enable4ChargedMoves, setEnable4ChargedMoves] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gbl_enable_4_charged_moves') === 'true';
    } catch {
      return false;
    }
  });

  const handleSetEnable4ChargedMoves = (enabled: boolean) => {
    setEnable4ChargedMoves(enabled);
    try {
      localStorage.setItem('gbl_enable_4_charged_moves', String(enabled));
    } catch {}
  };

  // App Setting: Disable Battle Toast Messages (Default: false -> Toasts Enabled)
  const [disableBattleToasts, setDisableBattleToasts] = useState<boolean>(() => {
    try {
      return localStorage.getItem('gbl_disable_battle_toasts') === 'true';
    } catch {
      return false;
    }
  });

  const handleSetDisableBattleToasts = (disabled: boolean) => {
    setDisableBattleToasts(disabled);
    try {
      localStorage.setItem('gbl_disable_battle_toasts', String(disabled));
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

  // App-Level Setting: Overlay Background Transparency (0% - 100%, Default 72%, step 2%)
  const [overlayTransparencyPct, setOverlayTransparencyPct] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('gbl_overlay_transparency_pct');
      if (saved !== null) {
        const num = Number(saved);
        if (!Number.isNaN(num) && num >= 0 && num <= 100) {
          return Math.round(num / 2) * 2;
        }
      }
    } catch {}
    return 72;
  });

  const handleSetOverlayTransparencyPct = (pct: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(pct / 2) * 2));
    setOverlayTransparencyPct(clamped);
    try {
      localStorage.setItem('gbl_overlay_transparency_pct', String(clamped));
    } catch {}
  };

  // Provisioned Battle Log State (Page 3) + Tombstones + Seasons + 2-Device Sync
  const [deviceId] = useState<string>(() => {
    try {
      const existing = localStorage.getItem('gbl_sync_device_id');
      if (existing) return existing;
      const created = 'web-' + Math.random().toString(36).substring(2, 10);
      localStorage.setItem('gbl_sync_device_id', created);
      return created;
    } catch {
      return 'web-local';
    }
  });

  const [battleLogs, setBattleLogs] = useState<WebBattleLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_battle_logs_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [deletedLogIds, setDeletedLogIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_deleted_log_ids_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [deletedTeamIds, setDeletedTeamIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_deleted_team_ids_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [deletedBattlesTrash, setDeletedBattlesTrash] = useState<WebBattleLogEntry[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_deleted_battles_trash_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [deletedTeamsTrash, setDeletedTeamsTrash] = useState<TeamPreset[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_deleted_teams_trash_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [showBattlesTrashModal, setShowBattlesTrashModal] = useState<boolean>(false);
  const [showTeamsTrashModal, setShowTeamsTrashModal] = useState<boolean>(false);
  const [undoBanner, setUndoBanner] = useState<{ message: string; onUndo: () => void } | null>(null);
  const [exportFormatMode, setExportFormatMode] = useState<'GO_BATTLE_LOG' | 'STANDARD'>('GO_BATTLE_LOG');
  const [tierThresholds, setTierThresholds] = useState<MatchupTierThresholds>(() => getStoredMatchupTierThresholds());

  const updateTierThresholds = (next: MatchupTierThresholds) => {
    setTierThresholds(next);
    try {
      localStorage.setItem(MATCHUP_TIER_THRESHOLDS_STORAGE_KEY, JSON.stringify(next));
    } catch {}
  };

  const restoreDefaultTierThresholds = () => {
    updateTierThresholds({ ...DEFAULT_MATCHUP_TIER_THRESHOLDS });
  };

  const triggerUndoBanner = (message: string, onUndo: () => void) => {
    setUndoBanner({ message, onUndo });
  };

  useEffect(() => {
    if (!undoBanner) return;
    const timer = setTimeout(() => {
      setUndoBanner(null);
    }, 9000);
    return () => clearTimeout(timer);
  }, [undoBanner]);

  const saveDeletedBattlesTrashToStorage = (list: WebBattleLogEntry[]) => {
    const unique = Array.from(new Map(list.map((item) => [item.id, item])).values()).slice(0, 200);
    setDeletedBattlesTrash(unique);
    try {
      localStorage.setItem('gbl_deleted_battles_trash_v1', JSON.stringify(unique));
    } catch {}
  };

  const saveDeletedTeamsTrashToStorage = (list: TeamPreset[]) => {
    const unique = Array.from(new Map(list.map((item) => [item.id, item])).values()).slice(0, 50);
    setDeletedTeamsTrash(unique);
    try {
      localStorage.setItem('gbl_deleted_teams_trash_v1', JSON.stringify(unique));
    } catch {}
  };

  const [seasonsList, setSeasonsList] = useState<GblSeasonInfo[]>(() => {
    try {
      const raw = localStorage.getItem('gbl_scraped_seasons_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_SEASONS_FALLBACK;
  });

  // Battle Log Filter & Modal States
  const [logFilterLeague, setLogFilterLeague] = useState<string>('ALL LEAGUES');
  const [logFilterTeamId, setLogFilterTeamId] = useState<string>('ALL TEAMS');
  const [logFilterTimeframe, setLogFilterTimeframe] = useState<'DAY' | 'WEEK' | 'CURRENT_SEASON' | 'PREVIOUS_SEASON' | 'ALL'>('ALL');
  const [exportPromptAction, setExportPromptAction] = useState<'COPY' | 'SHARE' | null>(null);
  const [editingLogEntry, setEditingLogEntry] = useState<WebBattleLogEntry | null>(null);
  const [replayLogEntry, setReplayLogEntry] = useState<WebBattleLogEntry | null>(null);
  const [replayUserIdx, setReplayUserIdx] = useState<number>(0);
  const [replayOppIdx, setReplayOppIdx] = useState<number>(0);
  const [replayOppShadow, setReplayOppShadow] = useState<boolean>(false);

  // Two-Device Cloud & Delta Sync States
  const [githubGistToken, setGithubGistToken] = useState<string>(() => localStorage.getItem('gbl_sync_github_token') || '');
  const [githubGistId, setGithubGistId] = useState<string>(() => localStorage.getItem('gbl_sync_github_gist_id') || '');
  const [lastCloudSyncStatus, setLastCloudSyncStatus] = useState<string>(() => localStorage.getItem('gbl_last_cloud_sync_ts') || 'Ready for 2-device delta sync');
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);
  const [showImportBundleModal, setShowImportBundleModal] = useState<boolean>(false);
  const [importBundleText, setImportBundleText] = useState<string>('');

  const saveBattleLogsToStorage = (logs: WebBattleLogEntry[]) => {
    const sorted = [...logs].sort((a, b) => b.timestampMs - a.timestampMs);
    setBattleLogs(sorted);
    try {
      localStorage.setItem('gbl_battle_logs_v1', JSON.stringify(sorted));
    } catch {}
  };

  const addDeletedTombstone = (id: string) => {
    setDeletedLogIds((prev) => {
      const next = Array.from(new Set([...prev, id]));
      try {
        localStorage.setItem('gbl_deleted_log_ids_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const restoreBattleLogsFromTrash = (entriesToRestore: WebBattleLogEntry[]) => {
    if (entriesToRestore.length === 0) return;
    const now = Date.now();
    const restoreIds = new Set(entriesToRestore.map((e) => e.id));
    setDeletedLogIds((prev) => {
      const next = prev.filter((id) => !restoreIds.has(id));
      try {
        localStorage.setItem('gbl_deleted_log_ids_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
    saveDeletedBattlesTrashToStorage(deletedBattlesTrash.filter((e) => !restoreIds.has(e.id)));
    setBattleLogs((prev) => {
      const filteredPrev = prev.filter((e) => !restoreIds.has(e.id));
      const updated = [
        ...entriesToRestore.map((e) => ({ ...e, updatedAt: now })),
        ...filteredPrev
      ].sort((a, b) => b.timestampMs - a.timestampMs);
      try {
        localStorage.setItem('gbl_battle_logs_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const restoreTeamPresetsFromTrash = (teamsToRestore: TeamPreset[]) => {
    if (teamsToRestore.length === 0) return;
    const restoreIds = new Set(teamsToRestore.map((t) => t.id));
    setDeletedTeamIds((prev) => {
      const next = prev.filter((id) => !restoreIds.has(id));
      try {
        localStorage.setItem('gbl_deleted_team_ids_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
    saveDeletedTeamsTrashToStorage(deletedTeamsTrash.filter((t) => !restoreIds.has(t.id)));
    setPresets((prev) => {
      const filteredPrev = prev.filter((p) => !restoreIds.has(p.id));
      return [...filteredPrev, ...teamsToRestore];
    });
  };

  const handleDeleteSingleBattleLog = (entry: WebBattleLogEntry) => {
    saveDeletedBattlesTrashToStorage([entry, ...deletedBattlesTrash.filter((b) => b.id !== entry.id)]);
    addDeletedTombstone(entry.id);
    saveBattleLogsToStorage(battleLogs.filter((b) => b.id !== entry.id));
    const oppFirst = entry.opponents[0] || 'Opponent';
    triggerUndoBanner(`🗑️ Battle (${entry.result} vs ${oppFirst}) moved to Trash`, () => {
      restoreBattleLogsFromTrash([entry]);
    });
  };

  const handleClearBattleLogs = () => {
    if (battleLogs.length === 0) return;
    const clearedCopy = [...battleLogs];
    saveDeletedBattlesTrashToStorage([...clearedCopy, ...deletedBattlesTrash]);
    clearedCopy.forEach((b) => addDeletedTombstone(b.id));
    saveBattleLogsToStorage([]);
    triggerUndoBanner(`🗑️ ${clearedCopy.length} battle(s) moved to Trash`, () => {
      restoreBattleLogsFromTrash(clearedCopy);
    });
  };

  // Overlay Custom Position (Positioned below top header: y=118px, x=8px so it never obscures top opponent HP bar)
  const [overlayPos, setOverlayPos] = useState<{ x: number; y: number }>({ x: 8, y: 118 });

  // Mouse & Touch drag handling for moving overlay or minimized bubble in simulator
  const [isDragging, setIsDragging] = useState(false);
  const [didMoveDuringDrag, setDidMoveDuringDrag] = useState(false);
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
    setDidMoveDuringDrag(false);
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
    if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
      setDidMoveDuringDrag(true);
    }
    const maxX = isOverlayMinimized ? 330 : 110;
    const maxY = isOverlayMinimized ? 700 : 440;
    const newX = Math.max(0, Math.min(dragStart.initialOverlayX + deltaX, maxX));
    const newY = Math.max(22, Math.min(dragStart.initialOverlayY + deltaY, maxY));
    setOverlayPos({ x: newX, y: newY });
  };

  const onDragEnd = () => {
    setIsDragging(false);
  };

  // Team Presets State (persisted in version-independent 'gbl_user_teams_persistent' with automatic migration from legacy keys)
  const [presets, setPresets] = useState<TeamPreset[]>(() => {
    try {
      const persistent = localStorage.getItem('gbl_user_teams_persistent');
      if (persistent) {
        const parsed = JSON.parse(persistent);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const legacyKeys = [
        'gbl_team_presets_v6',
        'gbl_team_presets_v5',
        'gbl_team_presets_v4',
        'gbl_team_presets_v3',
        'gbl_team_presets_v2',
        'gbl_team_presets'
      ];
      for (const key of legacyKeys) {
        const legacy = localStorage.getItem(key);
        if (legacy) {
          const parsed = JSON.parse(legacy);
          if (Array.isArray(parsed) && parsed.length > 0) {
            localStorage.setItem('gbl_user_teams_persistent', JSON.stringify(parsed));
            return parsed;
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_PRESETS;
  });

  const [selectedPresetId, setSelectedPresetId] = useState<string>(() => {
    return localStorage.getItem('gbl_selected_preset_id') || 'preset-ml-1';
  });

  // Save presets whenever updated to version-independent key
  useEffect(() => {
    try {
      localStorage.setItem('gbl_user_teams_persistent', JSON.stringify(presets));
    } catch {}
  }, [presets]);

  useEffect(() => {
    try {
      localStorage.setItem('gbl_selected_preset_id', selectedPresetId);
    } catch {}
  }, [selectedPresetId]);

  const activePreset = useMemo(() => {
    return presets.find(p => p.id === selectedPresetId) || presets[0] || INITIAL_PRESETS[0];
  }, [presets, selectedPresetId]);

  const [reparseBattlesStatus, setReparseBattlesStatus] = useState<string>(
    'Re-evaluates all logged battles with latest 2.56x dual-type & Shadow 1.2x damage + Win Quality (WAE) metrics'
  );

  const handleReparseAllCompletedBattles = (silent: boolean = false) => {
    const reparsedActive = reparseAllCompletedBattleLogs(battleLogs, presets, 'gbl_battle_logs_v1');
    setBattleLogs(reparsedActive);
    const reparsedTrash = reparseAllCompletedBattleLogs(deletedBattlesTrash, presets, 'gbl_deleted_battles_trash_v1');
    setDeletedBattlesTrash(reparsedTrash);
    const agg = calculateAggregateWAE(reparsedActive, presets);
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    setReparseBattlesStatus(
      `✅ Reparsed ${reparsedActive.length} completed battle(s) at ${timeStr} • Ranked: ${agg.rankedCount} • Exec WAE: ${agg.formatted} • Luck: ${agg.luckFormatted}`
    );
    if (!silent) {
      try {
        localStorage.setItem('gbl_damage_reparse_version', '293');
      } catch {}
    }
  };

  // Phase 3: Retroactive migration & v2.93 BMF / Exec WAE / Badges & Contextual Flags migration
  useEffect(() => {
    let reparseVer = 0;
    try {
      reparseVer = Number(localStorage.getItem('gbl_damage_reparse_version') || '0');
    } catch {}
    if (reparseVer < 215) {
      handleReparseAllCompletedBattles(true);
      try {
        localStorage.setItem('gbl_damage_reparse_version', '293');
      } catch {}
      return;
    }
    const migActive = migrateExistingBattleLogs(battleLogs, presets, 'gbl_battle_logs_v1');
    if (migActive.didMigrate) {
      setBattleLogs(migActive.logs);
    }
    const migTrash = migrateExistingBattleLogs(deletedBattlesTrash, presets, 'gbl_deleted_battles_trash_v1');
    if (migTrash.didMigrate) {
      setDeletedBattlesTrash(migTrash.logs);
    }
  }, [presets]);

  // Battle Simulation State (Fixed Opponent Discovery Order: [1st seen, 2nd seen, 3rd seen])
  const [activeOpponentKey, setActiveOpponentKey] = useState<string>('Zacian (Crowned)');
  const [isOpponentShadow, setIsOpponentShadow] = useState<boolean>(false);
  const [activeUserSlotIndex, setActiveUserSlotIndex] = useState<number>(0);
  const [userTurnsElapsed, setUserTurnsElapsed] = useState<number>(0);
  const [oppTurnsElapsed, setOppTurnsElapsed] = useState<number>(0);
  const [userEnergy, setUserEnergy] = useState<number>(36);
  const [oppEnergy, setOppEnergy] = useState<number>(40);
  const [userShields, setUserShields] = useState<number>(2);
  const [oppShields, setOppShields] = useState<number>(2);

  // v2.33: Dual 50s Countdown State Machines, Dynamic Color Coding & Pokéball Faint Tracking
  const [playerSwapEndTimeMs, setPlayerSwapEndTimeMs] = useState<number>(0);
  const [oppSwapEndTimeMs, setOppSwapEndTimeMs] = useState<number>(0);
  const [playerPokeballCount, setPlayerPokeballCount] = useState<number>(3);
  const [oppPokeballCount, setOppPokeballCount] = useState<number>(3);
  const [playerFaintedSlots, setPlayerFaintedSlots] = useState<boolean[]>([false, false, false]);
  const [oppFaintedSlots, setOppFaintedSlots] = useState<boolean[]>([false, false, false]);
  const [isPlayerTurnOne, setIsPlayerTurnOne] = useState<boolean>(true);
  const [isOppTurnOne, setIsOppTurnOne] = useState<boolean>(true);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  // Phase 2: Clock Synchronization (t_0) & Live Timeline Event Logger
  const [battleClockAnchorMs, setBattleClockAnchorMs] = useState<number>(() => Date.now());
  const [battleTimelineEvents, setBattleTimelineEvents] = useState<BattleTimelineEvent[]>([]);
  const [lastClearedTimelineEvents, setLastClearedTimelineEvents] = useState<BattleTimelineEvent[]>([]);
  const [lastClearedBattleDurationSec, setLastClearedBattleDurationSec] = useState<number | undefined>(undefined);

  const getRelativeBattleSeconds = (anchorOverrideMs?: number) => {
    const t0 = anchorOverrideMs ?? battleClockAnchorMs;
    if (!t0 || t0 <= 0) return 0.0;
    return Number((Math.max(0, Date.now() - t0) / 1000.0).toFixed(2));
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 200);
    return () => clearInterval(timer);
  }, []);

  const playerSwapRemainingSec = Math.max(0, Math.ceil((playerSwapEndTimeMs - nowMs) / 1000));
  const oppSwapRemainingSec = Math.max(0, Math.ceil((oppSwapEndTimeMs - nowMs) / 1000));

  // Scanned Opponents (Fixed Discovery Order: Slot 0 = 1st Seen, Slot 1 = 2nd Seen, Slot 2 = 3rd Seen)
  const [scannedOpponents, setScannedOpponents] = useState<string[]>(['Zacian (Crowned)', 'Yveltal', 'Entei']);
  const [lastClearedOpponents, setLastClearedOpponents] = useState<string[]>([]);
  const [lastClearedLeadMatchup, setLastClearedLeadMatchup] = useState<'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE'>('NEUTRAL');
  const [activeOpponentSlotIndex, setActiveOpponentSlotIndex] = useState<number>(0);
  const [isWaitingOpponent, setIsWaitingOpponent] = useState<boolean>(false);
  const [isBattleActive, setIsBattleActive] = useState<boolean>(true);
  const [showOpponentPicker, setShowOpponentPicker] = useState<boolean>(false);
  const [showStartBattleMenu, setShowStartBattleMenu] = useState<boolean>(false);
  const [manualLeadMatchupOverride, setManualLeadMatchupOverride] = useState<'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE' | null>(null);
  const [startBattleToast, setStartBattleToast] = useState<string | null>(null);
  const [selectedOpponentLeague, setSelectedOpponentLeague] = useState<'AUTO' | LeagueType>('AUTO');

  // Scrape GBL Season dates from ScrapedDuck API on startup
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.min.json')
      .then((r) => r.json())
      .then((arr) => {
        if (!Array.isArray(arr)) return;
        const scraped: GblSeasonInfo[] = [];
        for (const ev of arr) {
          if (ev?.eventType === 'season' || ev?.heading === 'Season') {
            const sMs = new Date(ev.start).getTime();
            const eMs = new Date(ev.end).getTime();
            if (!Number.isNaN(sMs) && !Number.isNaN(eMs)) {
              scraped.push({
                eventID: ev.eventID || 'season',
                name: ev.name || 'GBL Season',
                startMs: sMs,
                endMs: eMs,
                rawStart: ev.start,
                rawEnd: ev.end
              });
            }
          }
        }
        if (scraped.length > 0) {
          const mergedMap = new Map<string, GblSeasonInfo>();
          DEFAULT_SEASONS_FALLBACK.forEach((s) => mergedMap.set(s.eventID, s));
          scraped.forEach((s) => mergedMap.set(s.eventID, s));
          const merged = Array.from(mergedMap.values()).sort((a, b) => b.startMs - a.startMs);
          setSeasonsList(merged);
          try {
            localStorage.setItem('gbl_scraped_seasons_v1', JSON.stringify(merged));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  // Auto-sync PvPoke gamemaster.json + 4 league rankings JSONs on startup
  useEffect(() => {
    let mounted = true;
    syncPvPokeDataAndRankings()
      .then((res) => {
        if (!mounted) return;
        const gl = res.rankingsCount['GREAT LEAGUE'] || 0;
        const ul = res.rankingsCount['ULTRA LEAGUE'] || 0;
        const ml = res.rankingsCount['MASTER LEAGUE'] || 0;
        const mega = res.rankingsCount['MEGA MASTER LEAGUE'] || 0;
        const totalRanked = gl + ul + ml + mega;
        const nowStr = new Date().toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit'
        });
        setDbTelemetry(getPvPokeDatabaseTelemetry());
        if (totalRanked > 0) {
          setLastSyncedAt(nowStr);
          try {
            localStorage.setItem('gbl_last_sync_timestamp', nowStr);
          } catch {}
          setPvPokeSyncStatus(
            `Last Updated: ${nowStr} • GameMaster: ${res.syncedCount} Pokémon • GL: ${gl} • UL: ${ul} • ML: ${ml} • Mega: ${mega}`
          );
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const handleManualPvPokeSync = async () => {
    setIsSyncingPvPoke(true);
    setPvPokeSyncStatus('Syncing gamemaster + GL/UL/ML/Mega rankings...');
    try {
      const res = await syncPvPokeDataAndRankings();
      const gl = res.rankingsCount['GREAT LEAGUE'] || 0;
      const ul = res.rankingsCount['ULTRA LEAGUE'] || 0;
      const ml = res.rankingsCount['MASTER LEAGUE'] || 0;
      const mega = res.rankingsCount['MEGA MASTER LEAGUE'] || 0;
      const totalRanked = gl + ul + ml + mega;
      const nowStr = new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
      setDbTelemetry(getPvPokeDatabaseTelemetry());
      if (totalRanked > 0) {
        setLastSyncedAt(nowStr);
        try {
          localStorage.setItem('gbl_last_sync_timestamp', nowStr);
        } catch {}
      }
      setPvPokeSyncStatus(
        totalRanked > 0
          ? `Last Updated: ${nowStr} • GameMaster: ${res.syncedCount} Pokémon • GL: ${gl} • UL: ${ul} • ML: ${ml} • Mega: ${mega}`
          : `Loaded ${res.syncedCount} species (offline fallback)`
      );
    } catch {
      setPvPokeSyncStatus('Sync failed — using cached rankings');
    } finally {
      setIsSyncingPvPoke(false);
    }
  };

  const handleMovePreset = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= presets.length || toIndex >= presets.length) {
      return;
    }
    setPresets((prev) => {
      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
  };

  // Preset Create / Edit Dialog State
  const [isNewPresetOpen, setIsNewPresetOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetLeague, setNewPresetLeague] = useState<LeagueType>('GREAT LEAGUE');
  const [p1Name, setP1Name] = useState('Clodsire');
  const [p1Cp, setP1Cp] = useState(1494);
  const [p1Ivs, setP1Ivs] = useState('');
  const [p1Fast, setP1Fast] = useState('Poison Sting');
  const [p1C1, setP1C1] = useState('Earthquake');
  const [p1C2, setP1C2] = useState('Stone Edge');

  const [p2Name, setP2Name] = useState('Feraligatr');
  const [p2Cp, setP2Cp] = useState(1498);
  const [p2Ivs, setP2Ivs] = useState('');
  const [p2Fast, setP2Fast] = useState('Shadow Claw');
  const [p2C1, setP2C1] = useState('Hydro Cannon');
  const [p2C2, setP2C2] = useState('Ice Beam');

  const [p3Name, setP3Name] = useState('Mandibuzz');
  const [p3Cp, setP3Cp] = useState(1496);
  const [p3Ivs, setP3Ivs] = useState('');
  const [p3Fast, setP3Fast] = useState('Snarl');
  const [p3C1, setP3C1] = useState('Dark Pulse');
  const [p3C2, setP3C2] = useState('Aerial Ace');

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

  // Actions for Overlay: Start Battle (clears opponents & matrix immediately, activates 1 Hz OCR, switches button to Stop Battle)
  const handleStartBattle = () => {
    setLastClearedOpponents([]);
    setLastClearedTimelineEvents([]);
    setLastClearedBattleDurationSec(undefined);
    setScannedOpponents([]);
    setActiveOpponentSlotIndex(0);
    setIsWaitingOpponent(true);
    setIsBattleActive(true);
    setActiveOpponentKey('Waiting...');
    setIsOpponentShadow(false);
    setManualLeadMatchupOverride(null);
    setShowStartBattleMenu(false);
    setShowOpponentPicker(false);
    setUserTurnsElapsed(0);
    setOppTurnsElapsed(0);
    setUserEnergy(0);
    setOppEnergy(0);
    // Phase 2: Reset clock anchor (initialized when opponent lead is recognized) & timeline events
    setBattleClockAnchorMs(0);
    setBattleTimelineEvents([]);
    // v2.33: Reset swap timers, shields, and Pokéball faint state to initial (0s Ready, 3 balls, 2 shields)
    setPlayerSwapEndTimeMs(0);
    setOppSwapEndTimeMs(0);
    setPlayerPokeballCount(3);
    setOppPokeballCount(3);
    setUserShields(2);
    setOppShields(2);
    setPlayerFaintedSlots([false, false, false]);
    setOppFaintedSlots([false, false, false]);
    setIsPlayerTurnOne(true);
    setIsOppTurnOne(true);
  };

  // Stop Battle: pauses battle & opens the Win/Loss log option bar
  const handleStopBattle = () => {
    setShowOpponentPicker(false);
    if (!isWaitingOpponent && scannedOpponents.length > 0) {
      setLastClearedOpponents([...scannedOpponents]);
      setLastClearedLeadMatchup(currentLeadMatchup);
      setLastClearedTimelineEvents([...battleTimelineEvents]);
      setLastClearedBattleDurationSec(getRelativeBattleSeconds());
    }
    setIsBattleActive(false);
    setShowStartBattleMenu(true);
  };

  // Dismiss post-stop log bar without logging
  const handleSkipLoggingStoppedBattle = () => {
    setShowStartBattleMenu(false);
    setIsBattleActive(false);
    setLastClearedOpponents([]);
    setLastClearedTimelineEvents([]);
    setLastClearedBattleDurationSec(undefined);
    setScannedOpponents([]);
    setActiveOpponentSlotIndex(0);
    setIsWaitingOpponent(true);
    setActiveOpponentKey('Waiting...');
    setIsOpponentShadow(false);
    setManualLeadMatchupOverride(null);
    setUserTurnsElapsed(0);
    setOppTurnsElapsed(0);
    setUserEnergy(0);
    setOppEnergy(0);
    setBattleClockAnchorMs(0);
    setBattleTimelineEvents([]);
    setPlayerSwapEndTimeMs(0);
    setOppSwapEndTimeMs(0);
    setPlayerPokeballCount(3);
    setOppPokeballCount(3);
    setUserShields(2);
    setOppShields(2);
    setPlayerFaintedSlots([false, false, false]);
    setOppFaintedSlots([false, false, false]);
  };

  // Fixed Opponent Discovery Order: [1st seen, 2nd seen, 3rd seen] NEVER reorders when swapping active opponent!
  const handleSwapActiveOpponent = (name: string) => {
    const wasWaiting = isWaitingOpponent;
    const prevBase = getBaseSpeciesKey(activeOpponentKey);
    const targetBase = getBaseSpeciesKey(name);

    setActiveOpponentKey(name);
    setIsWaitingOpponent(false);
    setIsBattleActive(true);
    setShowOpponentPicker(false);
    setShowStartBattleMenu(false);
    setLastClearedOpponents([]);
    setOppTurnsElapsed(0);
    setOppEnergy(0);

    // State Machine:
    // Turn 1 lead spawn (wasWaiting) starts at 0s Ready and initializes Clock Anchor t_0 = 0.00s.
    // Subsequent True Tactical Swap (!wasWaiting && species changed && prior slot not fainted) resets to 50s.
    if (wasWaiting) {
      setBattleClockAnchorMs(Date.now());
      setBattleTimelineEvents([]);
      setOppSwapEndTimeMs(0);
      setOppPokeballCount(3);
      setOppFaintedSlots([false, false, false]);
    } else if (targetBase !== prevBase) {
      const prevOppMon = scannedOpponents[activeOpponentSlotIndex] || activeOpponentKey;
      const isFaintSwitch = !!oppFaintedSlots[activeOpponentSlotIndex];
      const relT = getRelativeBattleSeconds();
      if (!isFaintSwitch) {
        setOppSwapEndTimeMs(Date.now() + 50000);
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'SWAP',
            actor: 'opp',
            t: relT,
            pokemonIn: name,
            pokemonOut: prevOppMon,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields
          }
        ]);
      } else {
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'FAINT',
            actor: 'opp',
            t: relT,
            pokemonFainted: prevOppMon,
            pokemonIn: name,
            pokemonOut: prevOppMon,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields
          }
        ]);
      }
    }
    setIsOppTurnOne(false);

    setScannedOpponents((prev) => {
      const existingIdx = prev.findIndex((n) => getBaseSpeciesKey(n) === targetBase);
      let resolvedSlot = 0;
      let nextList = prev;
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = name;
        resolvedSlot = existingIdx;
        nextList = updated;
      } else if (prev.length < 3) {
        const appended = [...prev, name];
        resolvedSlot = appended.length - 1;
        nextList = appended;
      } else {
        // Replace currently active slot in-place without shifting the other slots
        const replaced = [...prev];
        const targetSlot = Math.max(0, Math.min(activeOpponentSlotIndex, 2));
        replaced[targetSlot] = name;
        resolvedSlot = targetSlot;
        nextList = replaced;
      }
      setActiveOpponentSlotIndex(resolvedSlot);
      // Resurrection Guard: Any Pokémon entering the field is alive
      setOppFaintedSlots((prevFainted) => {
        if (!prevFainted[resolvedSlot]) return prevFainted;
        const nextFainted = [...prevFainted];
        nextFainted[resolvedSlot] = false;
        setOppPokeballCount(Math.max(1, 3 - nextFainted.filter(Boolean).length));
        return nextFainted;
      });
      return nextList;
    });
  };

  // Player Lead/Roster Switch with Resurrection Guard
  const handleSelectUserSlot = (slotIdx: number) => {
    if (playerFaintedSlots[slotIdx]) {
      setPlayerFaintedSlots((prev) => {
        const next = [...prev];
        next[slotIdx] = false;
        setPlayerPokeballCount(Math.max(1, 3 - next.filter(Boolean).length));
        return next;
      });
    }
    if (slotIdx === activeUserSlotIndex) return;
    const isPrevFainted = !!playerFaintedSlots[activeUserSlotIndex];
    const prevUserMon = activePreset?.pokemon[activeUserSlotIndex]?.name || '';
    const nextUserMon = activePreset?.pokemon[slotIdx]?.name || '';
    if (!isWaitingOpponent) {
      const relT = getRelativeBattleSeconds();
      if (!isPrevFainted) {
        setPlayerSwapEndTimeMs(Date.now() + 50000);
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'SWAP',
            actor: 'user',
            t: relT,
            pokemonIn: nextUserMon,
            pokemonOut: prevUserMon,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields
          }
        ]);
      } else {
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'FAINT',
            actor: 'user',
            t: relT,
            pokemonFainted: prevUserMon,
            pokemonIn: nextUserMon,
            pokemonOut: prevUserMon,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields
          }
        ]);
      }
    }
    setIsPlayerTurnOne(false);
    setActiveUserSlotIndex(slotIdx);
  };

  const handleSimulatePlayerSwap = () => {
    const liveNext = [1, 2].map((offset) => (activeUserSlotIndex + offset) % 3).find((idx) => !playerFaintedSlots[idx]);
    const nextSlot = liveNext !== undefined ? liveNext : (activeUserSlotIndex + 1) % 3;
    const prevUserMon = activePreset?.pokemon[activeUserSlotIndex]?.name || 'Lead';
    const nextUserMon = activePreset?.pokemon[nextSlot]?.name || 'Swap';
    setPlayerFaintedSlots((prev) => {
      if (!prev[nextSlot] && !prev[activeUserSlotIndex]) return prev;
      const next = [...prev];
      next[nextSlot] = false;
      next[activeUserSlotIndex] = false;
      setPlayerPokeballCount(Math.max(1, 3 - next.filter(Boolean).length));
      return next;
    });
    if (!isWaitingOpponent) {
      const relT = getRelativeBattleSeconds();
      setBattleTimelineEvents((prevEv) => [
        ...prevEv,
        {
          type: 'SWAP',
          actor: 'user',
          t: relT,
          pokemonIn: nextUserMon,
          pokemonOut: prevUserMon,
          userShieldsRemaining: userShields,
          oppShieldsRemaining: oppShields
        }
      ]);
    }
    setPlayerSwapEndTimeMs(Date.now() + 50000);
    setIsPlayerTurnOne(false);
    setActiveUserSlotIndex(nextSlot);
    setStartBattleToast(`Player Tactical Swap -> ${nextUserMon} (50s timer)`);
    setTimeout(() => setStartBattleToast(null), 1800);
  };

  const handleSimulateOpponentSwap = () => {
    if (scannedOpponents.length > 1) {
      const len = scannedOpponents.length;
      const liveNext = [1, 2]
        .map((offset) => (activeOpponentSlotIndex + offset) % len)
        .find((idx) => !oppFaintedSlots[idx]);
      const nextSlot = liveNext !== undefined ? liveNext : (activeOpponentSlotIndex + 1) % len;
      const prevOppMon = scannedOpponents[activeOpponentSlotIndex] || activeOpponentKey;
      const nextOppMon = scannedOpponents[nextSlot];
      setOppFaintedSlots((prev) => {
        if (!prev[nextSlot] && !prev[activeOpponentSlotIndex]) return prev;
        const next = [...prev];
        next[nextSlot] = false;
        next[activeOpponentSlotIndex] = false;
        setOppPokeballCount(Math.max(1, 3 - next.filter(Boolean).length));
        return next;
      });
      if (!isWaitingOpponent) {
        const relT = getRelativeBattleSeconds();
        setBattleTimelineEvents((prevEv) => [
          ...prevEv,
          {
            type: 'SWAP',
            actor: 'opp',
            t: relT,
            pokemonIn: nextOppMon,
            pokemonOut: prevOppMon,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields
          }
        ]);
      }
      setActiveOpponentSlotIndex(nextSlot);
      setActiveOpponentKey(nextOppMon);
    }
    setOppSwapEndTimeMs(Date.now() + 50000);
    setIsOppTurnOne(false);
    setStartBattleToast(`Opponent Tactical Swap (50s timer reset)`);
    setTimeout(() => setStartBattleToast(null), 1800);
  };

  const handleSimulatePlayerFaint = () => {
    const faintedMon = activePreset?.pokemon[activeUserSlotIndex]?.name || 'Lead';
    setPlayerFaintedSlots((prev) => {
      const updated = [...prev];
      updated[activeUserSlotIndex] = true;
      return updated;
    });
    setPlayerPokeballCount((prev) => Math.max(0, prev - 1));
    const nextLiveIdx = [0, 1, 2].find((idx) => idx !== activeUserSlotIndex && !playerFaintedSlots[idx]);
    const nextMon = nextLiveIdx !== undefined ? activePreset?.pokemon[nextLiveIdx]?.name || null : null;
    if (nextLiveIdx !== undefined) {
      setActiveUserSlotIndex(nextLiveIdx);
    }
    if (!isWaitingOpponent) {
      const relT = getRelativeBattleSeconds();
      setBattleTimelineEvents((prevEv) => [
        ...prevEv,
        {
          type: 'FAINT',
          actor: 'user',
          t: relT,
          pokemonFainted: faintedMon,
          pokemonIn: nextMon,
          pokemonOut: faintedMon,
          userShieldsRemaining: userShields,
          oppShieldsRemaining: oppShields
        }
      ]);
    }
    // Faint Replacement: Do NOT reset swap clock (preserve existing timer)
    setStartBattleToast(`Player Faint Replacement (-1 Pokéball, Timer Preserved)`);
    setTimeout(() => setStartBattleToast(null), 2000);
  };

  const handleSimulateOpponentFaint = () => {
    const faintedOpp = scannedOpponents[activeOpponentSlotIndex] || activeOpponentKey;
    setOppFaintedSlots((prev) => {
      const updated = [...prev];
      updated[activeOpponentSlotIndex] = true;
      return updated;
    });
    setOppPokeballCount((prev) => Math.max(0, prev - 1));
    const nextLiveIdx = scannedOpponents.findIndex((_, idx) => idx !== activeOpponentSlotIndex && !oppFaintedSlots[idx]);
    const nextOpp = nextLiveIdx >= 0 ? scannedOpponents[nextLiveIdx] : null;
    if (nextLiveIdx >= 0) {
      setActiveOpponentSlotIndex(nextLiveIdx);
      setActiveOpponentKey(scannedOpponents[nextLiveIdx]);
    }
    if (!isWaitingOpponent) {
      const relT = getRelativeBattleSeconds();
      setBattleTimelineEvents((prevEv) => [
        ...prevEv,
        {
          type: 'FAINT',
          actor: 'opp',
          t: relT,
          pokemonFainted: faintedOpp,
          pokemonIn: nextOpp,
          pokemonOut: faintedOpp,
          userShieldsRemaining: userShields,
          oppShieldsRemaining: oppShields
        }
      ]);
    }
    // Faint Replacement: Do NOT reset swap clock (preserve existing timer)
    setStartBattleToast(`Opponent Faint Replacement (-1 Pokéball, Timer Preserved)`);
    setTimeout(() => setStartBattleToast(null), 2000);
  };

  const handleUsePlayerShield = () => {
    // Species Changed = NO: Shield Used updates shield state, NEVER alters life or swap clocks
    const nextShields = Math.max(0, userShields - 1);
    const shieldNum = userShields >= 2 ? 1 : 2;
    const activeMon = activePreset?.pokemon[activeUserSlotIndex]?.name || 'Lead';
    if (!isWaitingOpponent && userShields > 0) {
      const relT = getRelativeBattleSeconds();
      setBattleTimelineEvents((prevEv) => [
        ...prevEv,
        {
          type: 'SHIELD',
          actor: 'user',
          t: relT,
          shieldNumber: shieldNum,
          activePokemon: activeMon,
          pokemonShielded: activeMon,
          userShieldsRemaining: nextShields,
          oppShieldsRemaining: oppShields
        }
      ]);
    }
    setUserShields(nextShields);
    setStartBattleToast(`🛡️ Player Shield Used (${nextShields} left)`);
    setTimeout(() => setStartBattleToast(null), 1800);
  };

  const handleUseOpponentShield = () => {
    // Species Changed = NO: Shield Used updates shield state, NEVER alters life or swap clocks
    const nextShields = Math.max(0, oppShields - 1);
    const shieldNum = oppShields >= 2 ? 1 : 2;
    const activeOppMon = scannedOpponents[activeOpponentSlotIndex] || activeOpponentKey;
    if (!isWaitingOpponent && oppShields > 0) {
      const relT = getRelativeBattleSeconds();
      setBattleTimelineEvents((prevEv) => [
        ...prevEv,
        {
          type: 'SHIELD',
          actor: 'opp',
          t: relT,
          shieldNumber: shieldNum,
          activePokemon: activeOppMon,
          pokemonShielded: activeOppMon,
          userShieldsRemaining: userShields,
          oppShieldsRemaining: nextShields
        }
      ]);
    }
    setOppShields(nextShields);
    setStartBattleToast(`🛡️ Opponent Shield Used (${nextShields} left)`);
    setTimeout(() => setStartBattleToast(null), 1800);
  };

  const handleResetTimersAndBalls = () => {
    setBattleClockAnchorMs(Date.now());
    setBattleTimelineEvents([]);
    setPlayerSwapEndTimeMs(0);
    setOppSwapEndTimeMs(0);
    setPlayerPokeballCount(3);
    setOppPokeballCount(3);
    setUserShields(2);
    setOppShields(2);
    setPlayerFaintedSlots([false, false, false]);
    setOppFaintedSlots([false, false, false]);
    setIsPlayerTurnOne(true);
    setIsOppTurnOne(true);
    setStartBattleToast(`Match Reset (3 Balls, 2 Shields, t_0 = 0.00s)`);
    setTimeout(() => setStartBattleToast(null), 1800);
  };

  const handleSelectOpponent = (name: string) => {
    handleSwapActiveOpponent(name);
  };

  const handleSwapNextBenchOpponent = () => {
    if (scannedOpponents.length <= 1) return;
    const nextSlot = (activeOpponentSlotIndex + 1) % scannedOpponents.length;
    const nextActive = scannedOpponents[nextSlot];
    setActiveOpponentSlotIndex(nextSlot);
    setActiveOpponentKey(nextActive);
    setIsWaitingOpponent(false);
    setOppTurnsElapsed(0);
    setOppEnergy(0);
  };

  const activeOpponentLeague = selectedOpponentLeague === 'AUTO' ? (activePreset?.league || 'MASTER LEAGUE') : selectedOpponentLeague;
  const currentTopOpponents: TopOpponentInfo[] = PVPOKE_TOP_OPPONENTS[activeOpponentLeague] || PVPOKE_TOP_OPPONENTS['MASTER LEAGUE'] || [];

  // Active Pokémon stats scaled for the active League CP and user IVs (auto-defaulting to PvPoke IVs if blank)
  const safeActiveOppSlot = Math.max(0, Math.min(activeOpponentSlotIndex, Math.max(0, scannedOpponents.length - 1)));
  const activeOpponentName = (!isWaitingOpponent && scannedOpponents.length > 0)
    ? (scannedOpponents[safeActiveOppSlot] || scannedOpponents[0])
    : activeOpponentKey;
  const rawActiveOpponent = POKEMON_DATABASE[activeOpponentName] || POKEMON_DATABASE[activeOpponentKey] || POKEMON_DATABASE['Zacian (Crowned)'];
  const activeOpponent = useMemo(() => {
    return computeEffectiveStatsForLeague(rawActiveOpponent, activeOpponentLeague, undefined, undefined, isOpponentShadow);
  }, [rawActiveOpponent, activeOpponentLeague, isOpponentShadow, pvPokeSyncStatus]);

  // Auto-calculated Lead Matchup (Slot 0 1st-seen opponent vs Your Lead p1)
  const currentLeadMatchup: 'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE' = useMemo(() => {
    if (manualLeadMatchupOverride) return manualLeadMatchupOverride;
    if (isWaitingOpponent || scannedOpponents.length === 0) return lastClearedLeadMatchup || 'NEUTRAL';
    const firstSeenOpp = scannedOpponents[0];
    const m = calculateShieldMatrix(
      firstSeenOpp,
      activePreset.pokemon.map((p) => p.name),
      safeActiveOppSlot === 0 && isOpponentShadow,
      activePreset.league
    );
    const tokens = (m.p1 || 'W,N,L').split(',');
    const oneShield = (tokens[1] || tokens[0] || 'N').trim().toUpperCase();
    if (oneShield === 'SW' || oneShield === 'W') return 'FAVORABLE';
    if (oneShield === 'SL' || oneShield === 'L') return 'NEGATIVE';
    return 'NEUTRAL';
  }, [manualLeadMatchupOverride, isWaitingOpponent, scannedOpponents, activePreset, safeActiveOppSlot, isOpponentShadow, lastClearedLeadMatchup]);

  const handleCycleLeadMatchup = () => {
    const next =
      currentLeadMatchup === 'FAVORABLE'
        ? 'NEUTRAL'
        : currentLeadMatchup === 'NEUTRAL'
        ? 'NEGATIVE'
        : 'FAVORABLE';
    setManualLeadMatchupOverride(next);
  };

  const handleLogBattleFromOverlay = (result: 'WIN' | 'LOSS') => {
    const now = Date.now();
    const oppsToLog = (!isWaitingOpponent && scannedOpponents.length > 0)
      ? [...scannedOpponents]
      : [...lastClearedOpponents];
    const eventsToLog = (!isWaitingOpponent && battleTimelineEvents.length > 0)
      ? [...battleTimelineEvents]
      : [...lastClearedTimelineEvents];
    const durationSec = (!isWaitingOpponent && battleClockAnchorMs > 0)
      ? getRelativeBattleSeconds()
      : lastClearedBattleDurationSec;
    const userFaintsCount = Math.max(
      playerFaintedSlots.filter(Boolean).length,
      eventsToLog.filter((e) => e.type === 'FAINT' && e.actor === 'user').length
    );
    const oppFaintsCount = Math.max(
      oppFaintedSlots.filter(Boolean).length,
      eventsToLog.filter((e) => e.type === 'FAINT' && e.actor === 'opp').length
    );
    const userMons = activePreset.pokemon.map((p) => p.name);
    const qualityMeta = calculateBattleQuality(
      userMons,
      oppsToLog,
      activePreset.league,
      undefined,
      undefined,
      result,
      eventsToLog.length > 0 ? eventsToLog : undefined,
      oppsToLog.length > 0
        ? {
            totalDurationSec: durationSec,
            userFaints: userFaintsCount,
            oppFaints: oppFaintsCount,
            userShieldsRemaining: userShields,
            oppShieldsRemaining: oppShields
          }
        : undefined
    );
    const newEntry: WebBattleLogEntry = {
      id: `log-${now}-${Math.random().toString(36).slice(2, 7)}`,
      timestampMs: now,
      league: activePreset.league,
      presetId: activePreset.id,
      userTeamName: activePreset.name,
      userPokemon: userMons,
      opponents: oppsToLog,
      result,
      leadMatchup: currentLeadMatchup,
      bmfScore: qualityMeta ? qualityMeta.pPre : null,
      execWae: qualityMeta ? qualityMeta.execWae : null,
      badges: qualityMeta ? [qualityMeta.badgeLabel] : [],
      flags: qualityMeta ? qualityMeta.contextualFlags : [],
      quality: qualityMeta,
      timelineEvents: eventsToLog,
      battleDurationSec: durationSec,
      userFaints: userFaintsCount,
      oppFaints: oppFaintsCount,
      userShieldsRemaining: userShields,
      oppShieldsRemaining: oppShields,
      deviceId,
      updatedAt: now
    };
    saveBattleLogsToStorage([newEntry, ...battleLogs]);
    setLastClearedOpponents([]);
    setLastClearedTimelineEvents([]);
    setLastClearedBattleDurationSec(undefined);
    setLastClearedLeadMatchup('NEUTRAL');
    if (!disableBattleToasts) {
      setStartBattleToast(result === 'WIN' ? '🏆 Win Logged!' : '💀 Loss Logged!');
      setTimeout(() => setStartBattleToast(null), 1100);
    }
    handleSkipLoggingStoppedBattle();
  };

  const activeUserSlot = activePreset?.pokemon[activeUserSlotIndex] || activePreset?.pokemon[0];
  const userLeadName = activeUserSlot?.name || 'Palkia (Origin)';
  const isUserShadow = userLeadName.toLowerCase().includes('shadow');
  const rawUserActivePokemon = POKEMON_DATABASE[userLeadName] || POKEMON_DATABASE['Palkia (Origin)'] || POKEMON_DATABASE['Dialga (Origin)'];
  const userActivePokemon = useMemo(() => {
    return computeEffectiveStatsForLeague(
      rawUserActivePokemon,
      activePreset?.league || activeOpponentLeague,
      activeUserSlot?.cp,
      activeUserSlot?.ivs,
      isUserShadow
    );
  }, [rawUserActivePokemon, activePreset?.league, activeOpponentLeague, activeUserSlot?.cp, activeUserSlot?.ivs, isUserShadow, pvPokeSyncStatus]);

  const availableForms = useMemo(() => {
    return getAvailableFormsForPokemon(activeOpponent.name);
  }, [activeOpponent.name]);

  const handleCycleForm = () => {
    if (availableForms.length <= 1) return;
    const idx = availableForms.indexOf(activeOpponent.name);
    const nextForm = availableForms[(idx + 1) % availableForms.length];
    handleSelectOpponent(nextForm);
  };

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
      oppCountMode,
      activePreset?.league || activeOpponentLeague,
      activePreset.pokemon,
      enable4ChargedMoves
    );
  }, [activeOpponent, userLeadName, activePreset, isOpponentShadow, userFastTurns, userFastMoveName, myCustomChargedMoves, oppCountMode, activeOpponentLeague, enable4ChargedMoves]);

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
      oppMoveTimingInfo.maxHorizonTurns,
      activePreset?.league || activeOpponentLeague,
      activeUserSlot,
      enable4ChargedMoves
    );
  }, [userLeadName, activeOpponent, myCustomChargedMoves, oppReadyTaps, isOpponentShadow, userFastTurns, userFastMoveName, scannedOpponents, oppMoveTimingInfo.maxHorizonTurns, activePreset?.league, activeOpponentLeague, activeUserSlot, enable4ChargedMoves]);

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

  const applyLeagueTop3TemplateToForm = (league: LeagueType) => {
    const top3 = getLeagueTop3Template(league);
    setP1Name(top3[0].name);
    setP1Cp(top3[0].cp);
    setP1Ivs('');
    setP1Fast(top3[0].fastMove);
    setP1C1(top3[0].chargedMove1);
    setP1C2(top3[0].chargedMove2);

    setP2Name(top3[1].name);
    setP2Cp(top3[1].cp);
    setP2Ivs('');
    setP2Fast(top3[1].fastMove);
    setP2C1(top3[1].chargedMove1);
    setP2C2(top3[1].chargedMove2);

    setP3Name(top3[2].name);
    setP3Cp(top3[2].cp);
    setP3Ivs('');
    setP3Fast(top3[2].fastMove);
    setP3C1(top3[2].chargedMove1);
    setP3C2(top3[2].chargedMove2);
  };

  const handleAutoFillSlotMoves = (
    slotIdx: 1 | 2 | 3,
    rawName: string,
    league: LeagueType,
    customIvs?: string
  ) => {
    const rec = getRecommendedMovesForPokemon(rawName, league, customIvs);
    if (!rec) return;
    if (slotIdx === 1) {
      if (!p1Fast.trim()) setP1Fast(rec.fastMove);
      if (!p1C1.trim()) setP1C1(rec.chargedMove1);
      if (!p1C2.trim()) setP1C2(rec.chargedMove2);
      if (!p1Cp || p1Cp <= 0) setP1Cp(rec.cp);
    } else if (slotIdx === 2) {
      if (!p2Fast.trim()) setP2Fast(rec.fastMove);
      if (!p2C1.trim()) setP2C1(rec.chargedMove1);
      if (!p2C2.trim()) setP2C2(rec.chargedMove2);
      if (!p2Cp || p2Cp <= 0) setP2Cp(rec.cp);
    } else {
      if (!p3Fast.trim()) setP3Fast(rec.fastMove);
      if (!p3C1.trim()) setP3C1(rec.chargedMove1);
      if (!p3C2.trim()) setP3C2(rec.chargedMove2);
      if (!p3Cp || p3Cp <= 0) setP3Cp(rec.cp);
    }
  };

  const handleSelectAutocompletePokemon = (slotIdx: 1 | 2 | 3, opt: PokemonAutocompleteOption) => {
    const customIvs = slotIdx === 1 ? p1Ivs : slotIdx === 2 ? p2Ivs : p3Ivs;
    const rec = getRecommendedMovesForPokemon(opt.name, newPresetLeague, customIvs);
    const fast = rec?.fastMove || opt.fastMove;
    const c1 = rec?.chargedMove1 || opt.chargedMove1;
    const c2 = rec?.chargedMove2 || opt.chargedMove2;
    const cp = rec?.cp || opt.cp;

    if (slotIdx === 1) {
      setP1Name(opt.name);
      setP1Fast(fast);
      setP1C1(c1);
      setP1C2(c2);
      setP1Cp(cp);
    } else if (slotIdx === 2) {
      setP2Name(opt.name);
      setP2Fast(fast);
      setP2C1(c1);
      setP2C2(c2);
      setP2Cp(cp);
    } else {
      setP3Name(opt.name);
      setP3Fast(fast);
      setP3C1(c1);
      setP3C2(c2);
      setP3Cp(cp);
    }
    setActiveAutocompleteSlot(null);
    setAutocompleteHighlightIdx(0);
  };

  const slot1Suggestions = useMemo(
    () => (activeAutocompleteSlot === 1 ? getPokemonAutocompleteSuggestions(p1Name, newPresetLeague, 18) : []),
    [activeAutocompleteSlot, p1Name, newPresetLeague]
  );
  const slot2Suggestions = useMemo(
    () => (activeAutocompleteSlot === 2 ? getPokemonAutocompleteSuggestions(p2Name, newPresetLeague, 18) : []),
    [activeAutocompleteSlot, p2Name, newPresetLeague]
  );
  const slot3Suggestions = useMemo(
    () => (activeAutocompleteSlot === 3 ? getPokemonAutocompleteSuggestions(p3Name, newPresetLeague, 18) : []),
    [activeAutocompleteSlot, p3Name, newPresetLeague]
  );

  const openCreatePresetModal = () => {
    const defaultLeague = activePreset?.league || 'GREAT LEAGUE';
    setEditingPresetId(null);
    setNewPresetName('');
    setNewPresetLeague(defaultLeague);
    applyLeagueTop3TemplateToForm(defaultLeague);
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
      setP1Ivs(s1.ivs || '');
      setP1Fast(s1.fastMove);
      setP1C1(s1.chargedMove1);
      setP1C2(s1.chargedMove2);
    }
    if (s2) {
      setP2Name(s2.name);
      setP2Cp(s2.cp);
      setP2Ivs(s2.ivs || '');
      setP2Fast(s2.fastMove);
      setP2C1(s2.chargedMove1);
      setP2C2(s2.chargedMove2);
    }
    if (s3) {
      setP3Name(s3.name);
      setP3Cp(s3.cp);
      setP3Ivs(s3.ivs || '');
      setP3Fast(s3.fastMove);
      setP3C1(s3.chargedMove1);
      setP3C2(s3.chargedMove2);
    }
    setIsNewPresetOpen(true);
  };

  // Handle Preset Creation or Editing (auto-fills any blank moves or CP from PvPoke recommendations)
  const handleCreatePreset = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = editingPresetId || `preset-${Date.now()}`;
    const top3 = getLeagueTop3Template(newPresetLeague);

    const resolveSlot = (
      id: string,
      rawName: string,
      rawCp: number,
      rawFast: string,
      rawC1: string,
      rawC2: string,
      rawIvs: string,
      fallback: TeamMember
    ): TeamMember => {
      const finalName = rawName.trim() || fallback.name;
      const cleanIvs = rawIvs.trim() || undefined;
      const rec = getRecommendedMovesForPokemon(finalName, newPresetLeague, cleanIvs);
      return {
        id,
        name: finalName,
        cp: rawCp > 0 ? rawCp : rec?.cp || fallback.cp,
        fastMove: rawFast.trim() || rec?.fastMove || fallback.fastMove,
        chargedMove1: rawC1.trim() || rec?.chargedMove1 || fallback.chargedMove1,
        chargedMove2: rawC2.trim() || rec?.chargedMove2 || fallback.chargedMove2,
        ivs: cleanIvs
      };
    };

    const savedPreset: TeamPreset = {
      id: targetId,
      name: newPresetName.trim() || `${newPresetLeague} Custom`,
      league: newPresetLeague,
      pokemon: [
        resolveSlot('p1', p1Name, p1Cp, p1Fast, p1C1, p1C2, p1Ivs, top3[0]),
        resolveSlot('p2', p2Name, p2Cp, p2Fast, p2C1, p2C2, p2Ivs, top3[1]),
        resolveSlot('p3', p3Name, p3Cp, p3Fast, p3C1, p3C2, p3Ivs, top3[2])
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
      return;
    }
    const target = presets.find((p) => p.id === id);
    if (target) {
      saveDeletedTeamsTrashToStorage([target, ...deletedTeamsTrash.filter((t) => t.id !== id)]);
      setDeletedTeamIds((prev) => {
        const next = Array.from(new Set([...prev, id]));
        try {
          localStorage.setItem('gbl_deleted_team_ids_v1', JSON.stringify(next));
        } catch {}
        return next;
      });
    }
    const updated = presets.filter(p => p.id !== id);
    setPresets(updated);
    if (selectedPresetId === id) {
      setSelectedPresetId(updated[0].id);
    }
    if (target) {
      triggerUndoBanner(`🗑️ Team '${target.name}' moved to Trash`, () => {
        restoreTeamPresetsFromTrash([target]);
      });
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
      a.download = 'SilphScope_PvP_v2.33_Android_Project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
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
              src={`${import.meta.env.BASE_URL}favicon.svg`}
              alt="SilphScope PvP Icon"
              className="w-10 h-10 rounded-xl shadow-lg shadow-sky-500/20 border border-sky-500/30"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base md:text-lg tracking-tight text-white">SilphScope PvP</h1>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  v2.97 • Android Native Overlay
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Real-Time 3x3 Matchup Matrix, Lead Tracking, Interactive Replay &amp; Multi-Device Delta Sync for Pokémon GO PvP
              </p>
            </div>
          </div>

          {/* Navigation Tabs & Donation Button */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <nav className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800 text-xs font-semibold flex-wrap">
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
                <span>⚔️ Teams</span>
                <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-sky-400 border border-slate-700">
                  {presets.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'settings'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>⚙️ Settings</span>
              </button>
              <button
                onClick={() => setActiveTab('battle_log')}
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
                  activeTab === 'battle_log'
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Target className="w-3.5 h-3.5" />
                <span>📜 Battle Log</span>
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
              title="Support SilphScope PvP on Buy Me a Coffee"
            >
              <span>☕ Buy Me a Coffee</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        {/* Interactive Quick Undo Toast Banner */}
        {undoBanner && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-amber-950/90 border border-amber-400/60 shadow-lg flex items-center justify-between gap-3">
            <span className="text-xs font-bold text-amber-200">{undoBanner.message}</span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const fn = undoBanner.onUndo;
                  setUndoBanner(null);
                  fn();
                }}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs transition"
              >
                ♻️ UNDO
              </button>
              <button
                type="button"
                onClick={() => setUndoBanner(null)}
                className="px-2 py-1 text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 1: INTERACTIVE BATTLE ARENA & FLOATING OVERLAY SIMULATOR
           ========================================================================= */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left: Phone Screen Canvas with Floating HUD */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-3 px-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">Overlay HUD:</span>
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-400/40">
                    Sky Trench 3×3 Matrix
                  </span>
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

                {/* Top Opponent & Player Headers (Matching Pokémon GO Battle HUD) */}
                <div className="relative z-10 px-4 pt-1 flex justify-between items-start">
                  {/* Player Header */}
                  <div className="bg-slate-900/80 backdrop-blur-md rounded-xl p-2.5 border border-slate-700/60 shadow-lg w-[145px]">
                    <div className="flex justify-between items-center text-[10.5px]">
                      <span className="font-bold text-slate-200 truncate">{userActivePokemon.name.split(' ')[0]}*</span>
                      <span className="font-semibold text-slate-400">CP 4624</span>
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
                      FLOATING OVERLAY OPTION 1: Top-Left Sky Trench OR Minimized App-Icon Bubble
                     ========================================================================= */}
                  {isOverlayVisible && isOverlayMinimized && (
                    <div
                      onMouseDown={onDragStart}
                      onTouchStart={onDragStart}
                      onClick={() => {
                        if (!didMoveDuringDrag) {
                          setIsOverlayMinimized(false);
                        }
                      }}
                      title="Drag bubble anywhere • Tap to restore overlay & resume 1 Hz OCR"
                      style={{
                        top: `${overlayPos.y}px`,
                        left: `${overlayPos.x}px`
                      }}
                      className={`absolute z-30 w-12 h-12 rounded-full bg-slate-950 border-2 border-sky-400 shadow-[0_4px_16px_rgba(0,0,0,0.85),0_0_10px_rgba(56,189,248,0.5)] flex items-center justify-center cursor-pointer active:scale-95 transition-transform ${
                        isDragging ? 'ring-2 ring-amber-400' : ''
                      }`}
                    >
                      <img
                        src={`${import.meta.env.BASE_URL}favicon.svg`}
                        alt="SilphScope PvP Minimized Bubble"
                        className="w-9 h-9 rounded-full pointer-events-none select-none"
                      />
                      <span className="absolute -bottom-2 px-1 py-0.2 rounded bg-amber-500 text-slate-950 font-black text-[7px] uppercase tracking-tighter shadow">
                        OCR Paused
                      </span>
                    </div>
                  )}

                  {isOverlayVisible && !isOverlayMinimized && (
                    <div 
                      className={`absolute z-30 rounded-lg p-1.5 shadow-lg transition-all ${
                        isDragging ? 'ring-2 ring-sky-400' : ''
                      }`}
                      style={{
                        top: `${overlayPos.y}px`,
                        left: `${overlayPos.x}px`,
                        width: '286px',
                        transform: `scale(${(overlayScalePct / 78).toFixed(4)})`,
                        transformOrigin: 'top left',
                        background: `rgba(10, 14, 22, ${((100 - overlayTransparencyPct) / 100).toFixed(3)})`,
                        borderColor: `rgba(255, 255, 255, ${Math.max(0.05, ((100 - overlayTransparencyPct) / 100) * 0.55).toFixed(3)})`,
                        borderWidth: '1px',
                        borderStyle: 'solid',
                        backdropFilter: overlayTransparencyPct >= 96 ? 'none' : 'blur(3px)',
                        WebkitBackdropFilter: overlayTransparencyPct >= 96 ? 'none' : 'blur(3px)',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.98), 0 0 4px rgba(0, 0, 0, 0.95)'
                      }}
                    >
                      {/* Header row (Upper-left sword icon minimizes to bubble & pauses OCR) */}
                      <div className="flex items-center justify-between pb-1 border-b border-white/15 gap-1">
                        <div className="font-extrabold text-[10.5px] text-amber-100 flex items-center gap-1 truncate min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsOverlayMinimized(true);
                            }}
                            className="px-1 py-0.2 rounded bg-sky-500/20 hover:bg-sky-500/40 border border-sky-400/60 text-white text-[10px] leading-tight shrink-0 shadow-sm active:scale-90 transition"
                            title="Minimize overlay to floating app-icon bubble & pause OCR"
                          >
                            ⚔️
                          </button>
                          {isWaitingOpponent || scannedOpponents.length === 0 ? (
                            <>
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block shrink-0" />
                              <span className="text-emerald-200">WAITING FOR OPPONENT...</span>
                              <span className="text-amber-300 font-semibold text-[9px]">(1 Hz OCR Active)</span>
                            </>
                          ) : (
                            <>
                              <span className="truncate">VS {isOpponentShadow ? 'S-' : ''}{activeOpponent.name.toUpperCase()}</span>
                              <span className="text-amber-300 font-bold text-[8.5px] font-mono shrink-0 bg-black/35 px-1 rounded border border-amber-400/30">
                                {oppFastInfo.telemetry}
                              </span>
                            </>
                          )}
                        </div>
                        {/* v2.33: Opponent Swap Clock (Top-Right Header badge replacing redundant fast-move telemetry) */}
                        {!isWaitingOpponent && scannedOpponents.length > 0 && (
                          <span
                            className={`font-mono font-extrabold text-[8px] px-1.5 py-0.5 rounded border leading-none transition-colors shrink-0 ${
                              oppSwapRemainingSec <= 0
                                ? 'text-[#FF3B30] bg-red-950/60 border-red-500/60 shadow-[0_0_6px_rgba(255,59,48,0.35)]'
                                : oppSwapRemainingSec < 10
                                ? 'text-[#FFD700] bg-amber-950/60 border-amber-400/60'
                                : 'text-white bg-black/45 border-white/40'
                            }`}
                            title="Opponent Swap Countdown (50s countdown, resets on True Swap)"
                          >
                            Opp Swap: {oppSwapRemainingSec}s
                          </span>
                        )}
                      </div>

                      {/* Action Toolbar: Start Battle, Swap Opponent, Shadow Toggle, Form Cycler, and Active Lead Switch */}
                      <div
                        className="flex items-center justify-between gap-1 p-1 rounded border border-white/10 my-1"
                        style={{
                          background: `rgba(0, 0, 0, ${(((100 - overlayTransparencyPct) / 100) * 0.65).toFixed(3)})`
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (isBattleActive) {
                                handleStopBattle();
                              } else {
                                handleStartBattle();
                              }
                            }}
                            className={`font-bold text-[8px] px-1.5 py-0.5 rounded border transition active:scale-95 ${
                              isBattleActive
                                ? 'bg-red-600/60 hover:bg-red-600/75 text-white border-red-300 shadow-[0_0_5px_rgba(239,68,68,0.5)]'
                                : 'bg-emerald-500/35 hover:bg-emerald-500/50 text-emerald-100 border-emerald-400/75'
                            }`}
                            title={
                              isBattleActive
                                ? 'Stop current battle and open option to log Win/Loss'
                                : 'Immediately reset opponent list & empty matrix to start a new battle'
                            }
                          >
                            {startBattleToast || (isBattleActive ? '🛑 Stop Battle' : '⚔️ Start Battle')}
                          </button>
                          <button
                            onClick={() => {
                              setShowStartBattleMenu(false);
                              setShowOpponentPicker(!showOpponentPicker);
                            }}
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
                              onClick={() => handleSelectUserSlot(idx)}
                              className={`text-[8px] font-bold px-1 py-0.5 rounded border transition ${
                                activeUserSlotIndex === idx && !playerFaintedSlots[idx]
                                  ? 'bg-emerald-500/40 text-white border-emerald-400'
                                  : playerFaintedSlots[idx]
                                  ? 'bg-slate-900/30 text-slate-500 border-white/10 opacity-35 line-through'
                                  : 'bg-slate-900/50 text-slate-200 border-white/20 hover:bg-slate-800'
                              }`}
                              title={`${member.name}${playerFaintedSlots[idx] ? ' (Fainted)' : ''}`}
                            >
                              {member.name.replace(/^Shadow\s+/i, 'S-').replace(/^Kanto\s+/i, '').split(' ')[0].slice(0, 5)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* v2.33: Pokéball Counts, Shield Counts & Quick Simulation Controls */}
                      <div className="flex flex-col gap-0.5 px-1 py-0.5 bg-black/35 rounded border border-white/10 text-[7px] font-mono my-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-bold">You:</span>
                            <span className="flex items-center tracking-tighter" title={`Player Pokéballs: ${playerPokeballCount}/3 remaining`}>
                              {[0, 1, 2].map((i) => (
                                <span key={i} className={i < playerPokeballCount ? 'text-red-500' : 'text-slate-600 opacity-40'}>●</span>
                              ))}
                            </span>
                            <span className="text-pink-400 font-bold ml-0.5" title={`Player Shields: ${userShields}/2 remaining`}>
                              🛡️{userShields}
                            </span>
                            <button
                              type="button"
                              onClick={handleSimulatePlayerSwap}
                              className="px-1 py-0.2 rounded bg-sky-500/20 hover:bg-sky-500/40 text-sky-200 border border-sky-400/30"
                              title="Simulate True Swap for Player (resets to 50s)"
                            >
                              Swap P
                            </button>
                            <button
                              type="button"
                              onClick={handleSimulatePlayerFaint}
                              className="px-1 py-0.2 rounded bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-400/30"
                              title="Simulate Player Faint (-1 ball, dims column, preserves swap timer)"
                            >
                              Faint P
                            </button>
                            <button
                              type="button"
                              onClick={handleUsePlayerShield}
                              className="px-1 py-0.2 rounded bg-pink-500/20 hover:bg-pink-500/40 text-pink-200 border border-pink-400/30"
                              title="Simulate Player Shield Used (-1 shield, never alters life or swap timer)"
                            >
                              Shld P
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={handleResetTimersAndBalls}
                            className="px-1 py-0.2 rounded bg-slate-700/50 hover:bg-slate-600 text-slate-300 border border-slate-500/30 ml-auto"
                            title="Reset all swap clocks to 0s (Ready), restore 3 Pokéballs and 2 Shields"
                          >
                            ↺
                          </button>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 font-bold">Opp:</span>
                            <span className="flex items-center tracking-tighter" title={`Opponent Pokéballs: ${oppPokeballCount}/3 remaining`}>
                              {[0, 1, 2].map((i) => (
                                <span key={i} className={i < oppPokeballCount ? 'text-red-500' : 'text-slate-600 opacity-40'}>●</span>
                              ))}
                            </span>
                            <span className="text-pink-400 font-bold ml-0.5" title={`Opponent Shields: ${oppShields}/2 remaining`}>
                              🛡️{oppShields}
                            </span>
                            <button
                              type="button"
                              onClick={handleSimulateOpponentSwap}
                              className="px-1 py-0.2 rounded bg-sky-500/20 hover:bg-sky-500/40 text-sky-200 border border-sky-400/30"
                              title="Simulate True Swap for Opponent (resets to 50s)"
                            >
                              Swap Opp
                            </button>
                            <button
                              type="button"
                              onClick={handleSimulateOpponentFaint}
                              className="px-1 py-0.2 rounded bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-400/30"
                              title="Simulate Opponent Faint (-1 ball, dims column, preserves swap timer)"
                            >
                              Faint Opp
                            </button>
                            <button
                              type="button"
                              onClick={handleUseOpponentShield}
                              className="px-1 py-0.2 rounded bg-pink-500/20 hover:bg-pink-500/40 text-pink-200 border border-pink-400/30"
                              title="Simulate Opponent Shield Used (-1 shield, never alters life or swap timer)"
                            >
                              Shld Opp
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* In-Overlay Post-Stop Log Result Action Menu (Lead Matchup + Win/Loss/Skip) */}
                      {showStartBattleMenu && (
                        <div className="flex items-center justify-between gap-1 bg-slate-950/95 border border-sky-400/75 rounded p-1 my-1 shadow-xl text-[7.5px]">
                          <button
                            type="button"
                            onClick={handleCycleLeadMatchup}
                            className={`px-1.5 py-0.5 rounded font-extrabold border transition ${
                              currentLeadMatchup === 'FAVORABLE'
                                ? 'bg-emerald-600/35 border-emerald-400 text-emerald-200'
                                : currentLeadMatchup === 'NEGATIVE'
                                ? 'bg-red-600/35 border-red-400 text-red-200'
                                : 'bg-slate-700/50 border-slate-400 text-slate-200'
                            }`}
                            title="Tap to cycle Lead Matchup (Auto-detected from 1st-seen opponent vs your Lead)"
                          >
                            Lead: {currentLeadMatchup === 'FAVORABLE' ? 'Fav' : currentLeadMatchup === 'NEGATIVE' ? 'Neg' : 'Neu'}
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleLogBattleFromOverlay('WIN')}
                              className="px-1.5 py-0.5 rounded font-extrabold bg-emerald-600/45 hover:bg-emerald-500/60 border border-emerald-300 text-emerald-100"
                            >
                              🏆 Win
                            </button>
                            <button
                              type="button"
                              onClick={() => handleLogBattleFromOverlay('LOSS')}
                              className="px-1.5 py-0.5 rounded font-extrabold bg-red-600/45 hover:bg-red-500/60 border border-red-300 text-red-100"
                            >
                              💀 Loss
                            </button>
                            <button
                              type="button"
                              onClick={handleSkipLoggingStoppedBattle}
                              className="px-1.5 py-0.5 rounded font-bold bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white"
                              title="Dismiss without logging"
                            >
                              ✕ Skip
                            </button>
                          </div>
                        </div>
                      )}

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

                      {/* 3v3 Matchup Matrix Dots (FIXED Discovery Order: #1 1st seen, #2 2nd seen, #3 3rd seen) */}
                      <div className="my-1 py-1 px-1.5 bg-black/20 rounded flex flex-col gap-0.5 text-[9.5px]">
                        {isWaitingOpponent || scannedOpponents.length === 0 ? (
                          <div className="text-[9px] text-slate-200 flex items-center justify-between py-1 px-1.5 bg-black/35 rounded border border-white/10">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span>1 Hz OCR scanning opponent &amp; active lead...</span>
                            </div>
                            <span className="text-[8px] text-amber-300 font-mono">Standby</span>
                          </div>
                        ) : (
                          scannedOpponents.map((oppName, idx) => {
                            const isActiveSlot = idx === safeActiveOppSlot;
                            const matrix = calculateShieldMatrix(
                              oppName,
                              activePreset.pokemon.map(p => p.name),
                              isActiveSlot && isOpponentShadow
                            );
                            const fullOppDisplay = (isActiveSlot && isOpponentShadow ? 'S-' : '') + oppName;
                            const p1Init = activePreset.pokemon[0]?.name.charAt(0) || 'D';
                            const p2Init = activePreset.pokemon[1]?.name.charAt(0) || 'L';
                            const p3Init = activePreset.pokemon[2]?.name.charAt(0) || 'K';

                            const isOppFainted = !!oppFaintedSlots[idx];
                            return (
                              <div
                                key={`${oppName}-${idx}`}
                                onClick={() => handleSwapActiveOpponent(oppName)}
                                className={`flex items-center justify-start gap-1.5 px-1.5 py-0.5 rounded cursor-pointer transition ${
                                  isOppFainted
                                    ? 'opacity-35 line-through bg-black/20'
                                    : isActiveSlot
                                    ? 'bg-sky-500/25 border border-sky-400/50 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                                    : 'hover:bg-white/10 border border-transparent'
                                }`}
                                title={isOppFainted ? `#${idx + 1} Seen: ${oppName} (Fainted)` : isActiveSlot ? `#${idx + 1} Seen: ${oppName} (Active on field)` : `Click to set #${idx + 1} (${oppName}) as active opponent (keeps fixed #1/#2/#3 order)`}
                              >
                                <div className="flex items-center gap-1 w-[100px] min-w-[100px] max-w-[100px] shrink-0">
                                  <span className={`text-[8px] font-bold shrink-0 ${isOppFainted ? 'text-slate-500' : isActiveSlot ? 'text-sky-300' : 'text-slate-400'}`}>
                                    #{idx + 1}
                                  </span>
                                  <span className={`font-bold truncate text-[9.5px] ${isOppFainted ? 'text-slate-400 line-through' : 'text-slate-100'}`} title={fullOppDisplay}>
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
                                const isFainted = !isActv && !!playerFaintedSlots[slotIdx];
                                return (
                                  <span
                                    key={slotIdx}
                                    className={`py-0.5 leading-none transition ${
                                      isFainted
                                        ? 'opacity-35 text-[#5A6577] line-through'
                                        : isActv
                                        ? 'bg-sky-500/25 text-sky-200 border-t border-x border-sky-400/80 rounded-t shadow-[0_0_6px_rgba(56,189,248,0.25)]'
                                        : 'text-slate-400'
                                    }`}
                                    title={isFainted ? `${memberName} (Fainted)` : memberName}
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

                                  {/* Right: 3-Pokemon Team Damage % Columns with Vertical Active Highlight & Faint Column Dimming */}
                                  <div className="grid grid-cols-3 w-[84px] items-center text-center font-mono shrink-0">
                                    {row.teamDamages.map((cell, cIdx) => {
                                      const isActv = cIdx === activeUserSlotIndex;
                                      const isFainted = !isActv && !!playerFaintedSlots[cIdx];
                                      const textCls =
                                        isFainted
                                          ? 'text-[#5A6577] opacity-35'
                                          : cell.tier === 'resist'
                                          ? 'text-emerald-300'
                                          : cell.tier === 'weak'
                                          ? 'text-red-300'
                                          : 'text-amber-200';
                                      return (
                                        <div
                                          key={cIdx}
                                          className={`py-0.5 text-[7.5px] font-extrabold leading-tight ${textCls} ${
                                            isFainted
                                              ? 'bg-slate-950/40 opacity-35'
                                              : isActv
                                              ? `bg-sky-500/25 border-x border-sky-400/80 shadow-[inset_0_0_6px_rgba(56,189,248,0.25)] ${
                                                  isLastRow ? 'border-b rounded-b' : ''
                                                }`
                                              : 'bg-slate-900/40'
                                          }`}
                                          title={isFainted ? `${cell.name} (Fainted)` : `${cell.name}: ${cell.dmgPct}%`}
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

                          {/* My Attacks Section Header + 3-Opponent Column Headers & Player Swap Clock */}
                          <div className="grid grid-cols-[44px_1fr_84px] items-center gap-1 px-1 pt-1">
                            <span className="text-[7.5px] font-extrabold text-slate-400 uppercase tracking-wider col-span-2 flex items-center justify-between pr-1">
                              <span className="flex items-center gap-1.5">
                                <span>My Attacks</span>
                                <span
                                  className={`font-mono font-extrabold text-[7px] px-1 py-0.2 rounded border leading-none transition-colors shrink-0 ${
                                    playerSwapRemainingSec <= 0
                                      ? 'text-[#00FF00] bg-emerald-950/60 border-emerald-500/60 shadow-[0_0_6px_rgba(0,255,0,0.35)]'
                                      : playerSwapRemainingSec < 10
                                      ? 'text-[#FFD700] bg-amber-950/60 border-amber-400/60'
                                      : 'text-white bg-black/45 border-white/40'
                                  }`}
                                  title="Player Swap Countdown (50s countdown, resets on True Swap)"
                                >
                                  Swap: {playerSwapRemainingSec}s
                                </span>
                              </span>
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
                                const isActv = oppIdx === safeActiveOppSlot;
                                const isFainted = !isActv && !!oppFaintedSlots[oppIdx];
                                return (
                                  <span
                                    key={oppIdx}
                                    onClick={() => oppName && handleSwapActiveOpponent(oppName)}
                                    className={`py-0.5 leading-none transition ${oppName ? 'cursor-pointer' : ''} ${
                                      isFainted
                                        ? 'opacity-35 text-[#5A6577] line-through'
                                        : isActv
                                        ? 'bg-sky-500/25 text-sky-200 border-t border-x border-sky-400/80 rounded-t shadow-[0_0_6px_rgba(56,189,248,0.25)]'
                                        : 'text-slate-400'
                                    }`}
                                    title={isFainted ? `${oppName} (Fainted)` : oppName}
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

                                  {/* Right: 3-Opponent Outgoing Damage % Columns with Vertical Active Highlight & Faint Dimming */}
                                  <div className="grid grid-cols-3 w-[84px] items-center text-center font-mono shrink-0">
                                    {row.oppDamages.map((cell, cIdx) => {
                                      const isActv = cIdx === safeActiveOppSlot;
                                      const isFainted = !isActv && !!oppFaintedSlots[cIdx];
                                      const textCls = isFainted
                                        ? 'text-[#5A6577] opacity-35'
                                        : cell.isEmpty
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
                                            isFainted
                                              ? 'bg-slate-950/40 opacity-35'
                                              : isActv
                                              ? `bg-sky-500/25 border-x border-sky-400/80 shadow-[inset_0_0_6px_rgba(56,189,248,0.25)] ${
                                                  isLastRow ? 'border-b rounded-b' : ''
                                                }`
                                              : 'bg-slate-900/40'
                                          }`}
                                          title={isFainted ? `${cell.name} (Fainted)` : cell.isEmpty ? 'Unscanned opponent slot' : `${cell.name}: ${cell.dmgPct}%`}
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
                <div className="mb-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
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

                {/* App Setting: Opponent Charged Moves Shown in Overlay (3 vs 4 Charged Moves) */}
                <div className="mb-3 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200">
                      Opponent Charged Moves in Overlay
                    </span>
                    <span className="text-[10px] font-mono text-sky-400">
                      {enable4ChargedMoves ? 'Official + Top 2 Usage' : 'Official + Top Usage'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800">
                    <button
                      onClick={() => handleSetEnable4ChargedMoves(false)}
                      className={`py-1.5 px-2 rounded-md text-xs font-bold transition ${
                        !enable4ChargedMoves
                          ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      3 Charged Moves (Default)
                    </button>
                    <button
                      onClick={() => handleSetEnable4ChargedMoves(true)}
                      className={`py-1.5 px-2 rounded-md text-xs font-bold transition ${
                        enable4ChargedMoves
                          ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      4 Charged Moves
                    </button>
                  </div>
                </div>

                {/* Live PvPoke GameMaster & 4-League Rankings Status Card */}
                <div className="mb-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">
                        PvPoke Live Database &amp; 4-League Status
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        Last Updated: <strong className="text-emerald-400">{lastSyncedAt}</strong>
                      </span>
                    </div>
                    <button
                      onClick={handleManualPvPokeSync}
                      disabled={isSyncingPvPoke}
                      className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 text-[11px] font-bold flex items-center gap-1 transition shrink-0"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncingPvPoke ? 'animate-spin' : ''}`} />
                      <span>{isSyncingPvPoke ? 'Syncing...' : 'Sync PvPoke'}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] font-mono">
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[9px]">GameMaster</span>
                      <strong className="text-white">{dbTelemetry.gmCount}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-sky-400 block text-[9px]">GL (1500)</span>
                      <strong className="text-white">{dbTelemetry.glCount}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-amber-400 block text-[9px]">UL (2500)</span>
                      <strong className="text-white">{dbTelemetry.ulCount}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-purple-400 block text-[9px]">ML (10000)</span>
                      <strong className="text-white">{dbTelemetry.mlCount}</strong>
                    </div>
                    <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
                      <span className="text-emerald-400 block text-[9px]">Mega ML</span>
                      <strong className="text-white">{dbTelemetry.megaCount}</strong>
                    </div>
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

                {/* App Setting: Overlay Background Transparency (0% - 100%, Default 72%) */}
                <div className="mb-4 p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-slate-200 block">
                        Overlay Background Transparency
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Adjusts background panel only — text &amp; move bars stay 100% readable
                      </span>
                    </div>
                    <button
                      onClick={() => handleSetOverlayTransparencyPct(72)}
                      className="text-xs font-mono font-bold text-sky-400 hover:text-sky-300 transition shrink-0"
                      title="Click to reset to 72% Default"
                    >
                      {overlayTransparencyPct === 72 ? '72% (Default)' : `${overlayTransparencyPct}%`}
                    </button>
                  </div>

                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={2}
                    value={overlayTransparencyPct}
                    onChange={(e) => handleSetOverlayTransparencyPct(Number(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />

                  {/* Transparency Bounds & 72% Default Tick Mark */}
                  <div className="relative h-4 text-[10px] font-mono text-slate-400">
                    <span className="absolute left-0">0% (Solid)</span>
                    <button
                      type="button"
                      onClick={() => handleSetOverlayTransparencyPct(72)}
                      style={{ left: '72%', transform: 'translateX(-50%)' }}
                      className="absolute text-sky-400 hover:text-sky-300 font-bold transition"
                      title="Reset to 72% Default"
                    >
                      ▲ 72% Default
                    </button>
                    <span className="absolute right-0">100% (Clear)</span>
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
                    {(['MEGA MASTER LEAGUE', 'MASTER LEAGUE', 'ULTRA LEAGUE', 'GREAT LEAGUE'] as const).map((lg) => (
                      <button
                        key={lg}
                        onClick={() => setSelectedOpponentLeague(lg)}
                        className={`px-2.5 py-1 rounded-lg font-bold border transition shrink-0 ${
                          selectedOpponentLeague === lg
                            ? 'bg-sky-500/20 border-sky-400 text-sky-200 shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {lg === 'MEGA MASTER LEAGUE' ? 'MEGA ML' : lg.split(' ')[0]}
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
                  Drag cards by the grip handle (or use ↑/↓) to rearrange team order. Type any Pokémon base name in the Team Builder to autocomplete Base, Shadow, and Alternate Forms with PvPoke rankings moves!
                </p>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-emerald-400 font-semibold">
                  <span>✓ {pvPokeSyncStatus}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  onClick={() => setShowTeamsTrashModal(true)}
                  className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition"
                  title="Restore accidentally deleted team presets"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Trash ({deletedTeamsTrash.length})</span>
                </button>
                <button
                  onClick={handleManualPvPokeSync}
                  disabled={isSyncingPvPoke}
                  className="py-2.5 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-bold text-xs flex items-center gap-1.5 transition"
                  title="Fetch latest PvPoke gamemaster.json + GL/UL/ML/Mega Master rankings JSONs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPvPoke ? 'animate-spin' : ''}`} />
                  <span>{isSyncingPvPoke ? 'Syncing Rankings...' : 'Sync PvPoke + Rankings'}</span>
                </button>
                <button
                  onClick={openCreatePresetModal}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create New Preset</span>
                </button>
              </div>
            </div>

            {/* Presets Grid (Supports Drag-and-Drop Reordering) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {presets.map((preset, presetIdx) => {
                const isSelected = preset.id === selectedPresetId;
                const isDragged = draggedPresetIndex === presetIdx;
                const isDragOver = dragOverPresetIndex === presetIdx && draggedPresetIndex !== presetIdx;
                return (
                  <div
                    key={preset.id}
                    draggable
                    onDragStart={(e) => {
                      setDraggedPresetIndex(presetIdx);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(presetIdx));
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverPresetIndex !== presetIdx) {
                        setDragOverPresetIndex(presetIdx);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverPresetIndex === presetIdx) {
                        setDragOverPresetIndex(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const fromIdx =
                        draggedPresetIndex !== null
                          ? draggedPresetIndex
                          : parseInt(e.dataTransfer.getData('text/plain'), 10);
                      if (!Number.isNaN(fromIdx) && fromIdx !== presetIdx) {
                        handleMovePreset(fromIdx, presetIdx);
                      }
                      setDraggedPresetIndex(null);
                      setDragOverPresetIndex(null);
                    }}
                    onDragEnd={() => {
                      setDraggedPresetIndex(null);
                      setDragOverPresetIndex(null);
                    }}
                    className={`rounded-2xl p-5 border transition-all flex flex-col justify-between cursor-grab active:cursor-grabbing ${
                      isDragged ? 'opacity-45 scale-[0.98]' : ''
                    } ${
                      isDragOver
                        ? 'ring-2 ring-amber-400 border-amber-400 bg-slate-900'
                        : isSelected
                        ? 'bg-gradient-to-b from-sky-950/60 to-slate-900 border-sky-400 shadow-xl shadow-sky-500/10'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="text-slate-500 hover:text-slate-300 cursor-grab active:cursor-grabbing p-0.5 rounded"
                            title="Drag to rearrange team preset order"
                          >
                            <GripVertical className="w-4 h-4" />
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                            preset.league === 'MEGA MASTER LEAGUE'
                              ? 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30'
                              : preset.league === 'MASTER LEAGUE'
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/20'
                              : preset.league === 'ULTRA LEAGUE'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                              : 'bg-sky-500/15 text-sky-300 border-sky-400/30'
                          }`}>
                            {preset.league}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={presetIdx === 0}
                            onClick={() => handleMovePreset(presetIdx, presetIdx - 1)}
                            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            title="Move Team Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            disabled={presetIdx === presets.length - 1}
                            onClick={() => handleMovePreset(presetIdx, presetIdx + 1)}
                            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed transition"
                            title="Move Team Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
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
                              <div className="flex items-center gap-1.5">
                                {member.ivs && (
                                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    IV {member.ivs}
                                  </span>
                                )}
                                <span className="text-[11px] font-mono font-bold text-sky-400">
                                  CP {member.cp}
                                </span>
                              </div>
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
                        Order: <strong className="text-slate-200">#{presetIdx + 1}</strong> • League: <strong className="text-slate-200">{preset.league}</strong>
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

            {/* Modal Dialog for Creating or Editing Preset & Moves (Team Builder UI with Pop-Down Autocomplete) */}
            {isNewPresetOpen && (
              <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 my-8">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                    <h3 className="font-bold text-base text-white flex items-center gap-2">
                      <Plus className="w-4 h-4 text-emerald-400" />
                      <span>{editingPresetId ? 'Edit Team, Moves & IVs' : 'Create Custom GBL Team Preset'}</span>
                    </h3>
                    <button
                      onClick={() => {
                        setIsNewPresetOpen(false);
                        setEditingPresetId(null);
                        setActiveAutocompleteSlot(null);
                      }}
                      className="text-slate-400 hover:text-white text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400 mb-3">
                    Type a Pokémon name (e.g. <strong className="text-sky-300">Giratina</strong>, <strong className="text-sky-300">Ninetales</strong>, <strong className="text-sky-300">Feraligatr</strong>, <strong className="text-sky-300">Zacian</strong>) to open the autocomplete menu with <strong className="text-purple-300">Shadow</strong> and <strong className="text-amber-300">Alternate Form</strong> options and auto-fill PvPoke recommended moves!
                  </p>

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
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-400"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                          League Category
                        </label>
                        <select
                          value={newPresetLeague}
                          onChange={(e) => {
                            const nextL = e.target.value as LeagueType;
                            setNewPresetLeague(nextL);
                            if (!editingPresetId) {
                              applyLeagueTop3TemplateToForm(nextL);
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-400"
                        >
                          <option value="GREAT LEAGUE">GREAT LEAGUE (Max 1500 CP)</option>
                          <option value="ULTRA LEAGUE">ULTRA LEAGUE (Max 2500 CP)</option>
                          <option value="MASTER LEAGUE">MASTER LEAGUE (No CP Limit)</option>
                          <option value="MEGA MASTER LEAGUE">MEGA MASTER LEAGUE (Megas &amp; Primals)</option>
                        </select>
                      </div>
                    </div>

                    {/* Slot 1 */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-sky-400">Slot 1 (Lead Pokémon, IVs &amp; Moveset)</span>
                        <button
                          type="button"
                          onClick={() => {
                            const rec = getRecommendedMovesForPokemon(p1Name, newPresetLeague, p1Ivs);
                            if (rec) {
                              setP1Name(rec.name);
                              setP1Fast(rec.fastMove);
                              setP1C1(rec.chargedMove1);
                              setP1C2(rec.chargedMove2);
                              setP1Cp(rec.cp);
                            }
                          }}
                          className="text-[10px] text-sky-400 hover:text-sky-300 font-semibold"
                        >
                          Auto-Fill PvPoke Moves
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2 relative">
                          <input
                            type="text"
                            value={p1Name}
                            onFocus={() => {
                              setActiveAutocompleteSlot(1);
                              setAutocompleteHighlightIdx(0);
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              setP1Name(val);
                              setActiveAutocompleteSlot(1);
                              setAutocompleteHighlightIdx(0);
                              const rec = getRecommendedMovesForPokemon(val, newPresetLeague, p1Ivs);
                              if (rec) {
                                if (!p1Fast.trim()) setP1Fast(rec.fastMove);
                                if (!p1C1.trim()) setP1C1(rec.chargedMove1);
                                if (!p1C2.trim()) setP1C2(rec.chargedMove2);
                                if (!p1Cp || p1Cp <= 0) setP1Cp(rec.cp);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (activeAutocompleteSlot !== 1 || slot1Suggestions.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAutocompleteHighlightIdx((prev) => (prev + 1) % slot1Suggestions.length);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAutocompleteHighlightIdx((prev) => (prev - 1 + slot1Suggestions.length) % slot1Suggestions.length);
                              } else if (e.key === 'Enter') {
                                const chosen = slot1Suggestions[autocompleteHighlightIdx] || slot1Suggestions[0];
                                if (chosen) {
                                  e.preventDefault();
                                  handleSelectAutocompletePokemon(1, chosen);
                                }
                              } else if (e.key === 'Escape') {
                                setActiveAutocompleteSlot(null);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setActiveAutocompleteSlot((prev) => (prev === 1 ? null : prev));
                              }, 180);
                              handleAutoFillSlotMoves(1, p1Name, newPresetLeague, p1Ivs);
                            }}
                            placeholder="Type Pokémon (e.g. Giratina, Ninetales)"
                            autoComplete="off"
                            className="w-full bg-slate-900 border border-slate-700 focus:border-sky-400 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white"
                            required
                          />
                          {activeAutocompleteSlot === 1 && slot1Suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-xl bg-slate-900 border border-sky-500/50 shadow-2xl divide-y divide-slate-800/80">
                              {slot1Suggestions.map((opt, idx) => (
                                <button
                                  key={opt.name}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectAutocompletePokemon(1, opt);
                                  }}
                                  className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition ${
                                    idx === autocompleteHighlightIdx
                                      ? 'bg-sky-500/25 text-white'
                                      : 'hover:bg-slate-800/90 text-slate-200'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-xs text-white truncate">{opt.name}</span>
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                                          opt.isShadow
                                            ? 'bg-purple-500/25 text-purple-200 border-purple-400/50'
                                            : opt.isAlternateForm
                                            ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                                            : 'bg-slate-800 text-slate-300 border-slate-700'
                                        }`}
                                      >
                                        {opt.formBadge}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {opt.fastMove} • {opt.chargedMove1} / {opt.chargedMove2}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-sky-400 shrink-0">
                                    CP {opt.cp}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          type="number"
                          value={p1Cp || ''}
                          onChange={(e) => setP1Cp(parseInt(e.target.value) || 0)}
                          placeholder="CP (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={p1Ivs}
                          onChange={(e) => setP1Ivs(e.target.value)}
                          placeholder="IVs (opt)"
                          title="Optional Atk/Def/HP IVs (e.g. 0/15/15). Defaults to PvPoke IVs if blank."
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p1Fast}
                          onChange={(e) => setP1Fast(e.target.value)}
                          placeholder="Fast Move (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p1C1}
                          onChange={(e) => setP1C1(e.target.value)}
                          placeholder="Charged 1 (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p1C2}
                          onChange={(e) => setP1C2(e.target.value)}
                          placeholder="Charged 2 (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                    </div>

                    {/* Slot 2 */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-purple-400">Slot 2 (Safe Swap, IVs &amp; Moveset)</span>
                        <button
                          type="button"
                          onClick={() => {
                            const rec = getRecommendedMovesForPokemon(p2Name, newPresetLeague, p2Ivs);
                            if (rec) {
                              setP2Name(rec.name);
                              setP2Fast(rec.fastMove);
                              setP2C1(rec.chargedMove1);
                              setP2C2(rec.chargedMove2);
                              setP2Cp(rec.cp);
                            }
                          }}
                          className="text-[10px] text-purple-400 hover:text-purple-300 font-semibold"
                        >
                          Auto-Fill PvPoke Moves
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2 relative">
                          <input
                            type="text"
                            value={p2Name}
                            onFocus={() => {
                              setActiveAutocompleteSlot(2);
                              setAutocompleteHighlightIdx(0);
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              setP2Name(val);
                              setActiveAutocompleteSlot(2);
                              setAutocompleteHighlightIdx(0);
                              const rec = getRecommendedMovesForPokemon(val, newPresetLeague, p2Ivs);
                              if (rec) {
                                if (!p2Fast.trim()) setP2Fast(rec.fastMove);
                                if (!p2C1.trim()) setP2C1(rec.chargedMove1);
                                if (!p2C2.trim()) setP2C2(rec.chargedMove2);
                                if (!p2Cp || p2Cp <= 0) setP2Cp(rec.cp);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (activeAutocompleteSlot !== 2 || slot2Suggestions.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAutocompleteHighlightIdx((prev) => (prev + 1) % slot2Suggestions.length);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAutocompleteHighlightIdx((prev) => (prev - 1 + slot2Suggestions.length) % slot2Suggestions.length);
                              } else if (e.key === 'Enter') {
                                const chosen = slot2Suggestions[autocompleteHighlightIdx] || slot2Suggestions[0];
                                if (chosen) {
                                  e.preventDefault();
                                  handleSelectAutocompletePokemon(2, chosen);
                                }
                              } else if (e.key === 'Escape') {
                                setActiveAutocompleteSlot(null);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setActiveAutocompleteSlot((prev) => (prev === 2 ? null : prev));
                              }, 180);
                              handleAutoFillSlotMoves(2, p2Name, newPresetLeague, p2Ivs);
                            }}
                            placeholder="Type Pokémon (e.g. Feraligatr, Marowak)"
                            autoComplete="off"
                            className="w-full bg-slate-900 border border-slate-700 focus:border-purple-400 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white"
                            required
                          />
                          {activeAutocompleteSlot === 2 && slot2Suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-xl bg-slate-900 border border-purple-500/50 shadow-2xl divide-y divide-slate-800/80">
                              {slot2Suggestions.map((opt, idx) => (
                                <button
                                  key={opt.name}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectAutocompletePokemon(2, opt);
                                  }}
                                  className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition ${
                                    idx === autocompleteHighlightIdx
                                      ? 'bg-purple-500/25 text-white'
                                      : 'hover:bg-slate-800/90 text-slate-200'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-xs text-white truncate">{opt.name}</span>
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                                          opt.isShadow
                                            ? 'bg-purple-500/25 text-purple-200 border-purple-400/50'
                                            : opt.isAlternateForm
                                            ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                                            : 'bg-slate-800 text-slate-300 border-slate-700'
                                        }`}
                                      >
                                        {opt.formBadge}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {opt.fastMove} • {opt.chargedMove1} / {opt.chargedMove2}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-purple-300 shrink-0">
                                    CP {opt.cp}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          type="number"
                          value={p2Cp || ''}
                          onChange={(e) => setP2Cp(parseInt(e.target.value) || 0)}
                          placeholder="CP (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={p2Ivs}
                          onChange={(e) => setP2Ivs(e.target.value)}
                          placeholder="IVs (opt)"
                          title="Optional Atk/Def/HP IVs (e.g. 0/15/15). Defaults to PvPoke IVs if blank."
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p2Fast}
                          onChange={(e) => setP2Fast(e.target.value)}
                          placeholder="Fast Move (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p2C1}
                          onChange={(e) => setP2C1(e.target.value)}
                          placeholder="Charged 1 (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p2C2}
                          onChange={(e) => setP2C2(e.target.value)}
                          placeholder="Charged 2 (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                    </div>

                    {/* Slot 3 */}
                    <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400">Slot 3 (Closer, IVs &amp; Moveset)</span>
                        <button
                          type="button"
                          onClick={() => {
                            const rec = getRecommendedMovesForPokemon(p3Name, newPresetLeague, p3Ivs);
                            if (rec) {
                              setP3Name(rec.name);
                              setP3Fast(rec.fastMove);
                              setP3C1(rec.chargedMove1);
                              setP3C2(rec.chargedMove2);
                              setP3Cp(rec.cp);
                            }
                          }}
                          className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold"
                        >
                          Auto-Fill PvPoke Moves
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2 relative">
                          <input
                            type="text"
                            value={p3Name}
                            onFocus={() => {
                              setActiveAutocompleteSlot(3);
                              setAutocompleteHighlightIdx(0);
                            }}
                            onChange={(e) => {
                              const val = e.target.value;
                              setP3Name(val);
                              setActiveAutocompleteSlot(3);
                              setAutocompleteHighlightIdx(0);
                              const rec = getRecommendedMovesForPokemon(val, newPresetLeague, p3Ivs);
                              if (rec) {
                                if (!p3Fast.trim()) setP3Fast(rec.fastMove);
                                if (!p3C1.trim()) setP3C1(rec.chargedMove1);
                                if (!p3C2.trim()) setP3C2(rec.chargedMove2);
                                if (!p3Cp || p3Cp <= 0) setP3Cp(rec.cp);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (activeAutocompleteSlot !== 3 || slot3Suggestions.length === 0) return;
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAutocompleteHighlightIdx((prev) => (prev + 1) % slot3Suggestions.length);
                              } else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAutocompleteHighlightIdx((prev) => (prev - 1 + slot3Suggestions.length) % slot3Suggestions.length);
                              } else if (e.key === 'Enter') {
                                const chosen = slot3Suggestions[autocompleteHighlightIdx] || slot3Suggestions[0];
                                if (chosen) {
                                  e.preventDefault();
                                  handleSelectAutocompletePokemon(3, chosen);
                                }
                              } else if (e.key === 'Escape') {
                                setActiveAutocompleteSlot(null);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setActiveAutocompleteSlot((prev) => (prev === 3 ? null : prev));
                              }, 180);
                              handleAutoFillSlotMoves(3, p3Name, newPresetLeague, p3Ivs);
                            }}
                            placeholder="Type Pokémon (e.g. Zacian, Weezing)"
                            autoComplete="off"
                            className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 focus:outline-none rounded-lg px-2.5 py-1.5 text-xs text-white"
                            required
                          />
                          {activeAutocompleteSlot === 3 && slot3Suggestions.length > 0 && (
                            <div className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto rounded-xl bg-slate-900 border border-amber-500/50 shadow-2xl divide-y divide-slate-800/80">
                              {slot3Suggestions.map((opt, idx) => (
                                <button
                                  key={opt.name}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    handleSelectAutocompletePokemon(3, opt);
                                  }}
                                  className={`w-full px-2.5 py-1.5 text-left flex items-center justify-between gap-2 transition ${
                                    idx === autocompleteHighlightIdx
                                      ? 'bg-amber-500/25 text-white'
                                      : 'hover:bg-slate-800/90 text-slate-200'
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-bold text-xs text-white truncate">{opt.name}</span>
                                      <span
                                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                                          opt.isShadow
                                            ? 'bg-purple-500/25 text-purple-200 border-purple-400/50'
                                            : opt.isAlternateForm
                                            ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                                            : 'bg-slate-800 text-slate-300 border-slate-700'
                                        }`}
                                      >
                                        {opt.formBadge}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 truncate">
                                      {opt.fastMove} • {opt.chargedMove1} / {opt.chargedMove2}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-amber-300 shrink-0">
                                    CP {opt.cp}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          type="number"
                          value={p3Cp || ''}
                          onChange={(e) => setP3Cp(parseInt(e.target.value) || 0)}
                          placeholder="CP (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                        />
                        <input
                          type="text"
                          value={p3Ivs}
                          onChange={(e) => setP3Ivs(e.target.value)}
                          placeholder="IVs (opt)"
                          title="Optional Atk/Def/HP IVs (e.g. 0/15/15). Defaults to PvPoke IVs if blank."
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={p3Fast}
                          onChange={(e) => setP3Fast(e.target.value)}
                          placeholder="Fast Move (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p3C1}
                          onChange={(e) => setP3C1(e.target.value)}
                          placeholder="Charged 1 (Auto)"
                          className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white"
                        />
                        <input
                          type="text"
                          value={p3C2}
                          onChange={(e) => setP3C2(e.target.value)}
                          placeholder="Charged 2 (Auto)"
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
                          setActiveAutocompleteSlot(null);
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
            PAGE 2: DEDICATED OVERLAY & DATABASE SETTINGS PAGE
           ========================================================================= */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto space-y-5">
            {/* 3-Page Quick Switcher Banner */}
            <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Settings className="w-5 h-5 text-sky-400" />
                  <span>Overlay &amp; Database Settings</span>
                </h2>
                <p className="text-xs text-slate-400">
                  Dedicated settings page matching the 3-page Android main app layout (Teams • Settings • Battle Log).
                </p>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                <button
                  onClick={() => setActiveTab('presets')}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition"
                >
                  ⚔️ Teams
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="px-3 py-1.5 rounded-lg bg-sky-500 text-white shadow-sm"
                >
                  ⚙️ Settings
                </button>
                <button
                  onClick={() => setActiveTab('battle_log')}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition"
                >
                  📜 Battle Log
                </button>
              </div>
            </div>

            {/* PvPoke Live Database & 4-League Sync Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-bold text-white block">
                    PvPoke Live Database &amp; 4-League Rankings
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Last Updated: <strong className="text-emerald-400">{lastSyncedAt}</strong>
                  </span>
                </div>
                <button
                  onClick={handleManualPvPokeSync}
                  disabled={isSyncingPvPoke}
                  className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0 shadow-lg shadow-sky-600/20"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingPvPoke ? 'animate-spin' : ''}`} />
                  <span>{isSyncingPvPoke ? 'Syncing...' : 'Sync PvPoke'}</span>
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2 text-center text-xs font-mono">
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">GameMaster</span>
                  <strong className="text-white text-sm">{dbTelemetry.gmCount}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-sky-400 block text-[10px]">GL (1500)</span>
                  <strong className="text-white text-sm">{dbTelemetry.glCount}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-amber-400 block text-[10px]">UL (2500)</span>
                  <strong className="text-white text-sm">{dbTelemetry.ulCount}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-purple-400 block text-[10px]">ML (10000)</span>
                  <strong className="text-white text-sm">{dbTelemetry.mlCount}</strong>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-emerald-400 block text-[10px]">Mega ML</span>
                  <strong className="text-white text-sm">{dbTelemetry.megaCount}</strong>
                </div>
              </div>
            </div>

            {/* Retroactive Battle Log Damage & Win Quality Reparse Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-bold text-emerald-400 block">
                    Reparse Completed Battles (Damage &amp; WAE)
                  </span>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    {reparseBattlesStatus}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleReparseAllCompletedBattles(false)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition shrink-0 shadow-lg shadow-emerald-600/20"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>🔄 Reparse All</span>
                </button>
              </div>
            </div>

            {/* Opponent Move Count Basis & 4 Charged Moves Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Opponent Move Count Basis</span>
                  <span className="text-[10px] font-mono text-sky-400">Turn-Aligned</span>
                </div>
                <p className="text-xs text-slate-400">
                  Choose whether opponent move bars count your fast attacks or the opponent&apos;s fast attacks.
                </p>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    onClick={() => handleSetOppCountMode('my_fasts')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                      oppCountMode === 'my_fasts'
                        ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    My Fasts (Default)
                  </button>
                  <button
                    onClick={() => handleSetOppCountMode('opp_fasts')}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                      oppCountMode === 'opp_fasts'
                        ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Their Fasts
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Opponent Charged Moves</span>
                  <span className="text-[10px] font-mono text-sky-400">
                    {enable4ChargedMoves ? '4 Moves Shown' : '3 Moves (Default)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Show PvPoke&apos;s 2 official moves + top 1 usage move (3 Moves) or top 2 usage moves (4 Moves).
                </p>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                  <button
                    onClick={() => handleSetEnable4ChargedMoves(false)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                      !enable4ChargedMoves
                        ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    3 Moves (Default)
                  </button>
                  <button
                    onClick={() => handleSetEnable4ChargedMoves(true)}
                    className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                      enable4ChargedMoves
                        ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    4 Moves
                  </button>
                </div>
              </div>
            </div>

            {/* Battle Toast Messages Setting */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-white">Battle Toast Messages</span>
                <span className="text-[10px] font-mono text-sky-400">
                  {disableBattleToasts ? 'Toasts Off' : 'Toasts On (Default)'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Enable or disable floating toast popups during battle (Battle Start/Stop, Switches &amp; Logs).
              </p>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  onClick={() => handleSetDisableBattleToasts(false)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    !disableBattleToasts
                      ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Toasts On (Default)
                </button>
                <button
                  onClick={() => handleSetDisableBattleToasts(true)}
                  className={`py-2 px-2 rounded-lg text-xs font-bold transition ${
                    disableBattleToasts
                      ? 'bg-sky-500/25 border border-sky-400/70 text-sky-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Toasts Off
                </button>
              </div>
            </div>

            {/* Overlay Size Slider */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-white block">
                    Overlay Size (% of Screen Width)
                  </span>
                  <span className="text-xs text-slate-400">
                    Proportionally scales the floating overlay container, fonts, and move timing bars.
                  </span>
                </div>
                <button
                  onClick={() => handleSetOverlayScalePct(78)}
                  className="text-xs font-mono font-bold text-sky-400 hover:text-sky-300 transition"
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
                className="w-full accent-sky-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="relative h-4 text-[10px] font-mono text-slate-400">
                <span className="absolute left-0">50%</span>
                <button
                  type="button"
                  onClick={() => handleSetOverlayScalePct(78)}
                  style={{ left: '56%', transform: 'translateX(-50%)' }}
                  className="absolute text-sky-400 hover:text-sky-300 font-bold transition"
                >
                  ▲ 78% Default
                </button>
                <span className="absolute right-0">100%</span>
              </div>
            </div>

            {/* Overlay Background Transparency Slider */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-white block">
                    Overlay Background Transparency
                  </span>
                  <span className="text-xs text-slate-400">
                    Adjusts only the background panel opacity while keeping text and move bars 100% readable.
                  </span>
                </div>
                <button
                  onClick={() => handleSetOverlayTransparencyPct(72)}
                  className="text-xs font-mono font-bold text-sky-400 hover:text-sky-300 transition"
                >
                  {overlayTransparencyPct === 72 ? '72% (Default)' : `${overlayTransparencyPct}%`}
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={2}
                value={overlayTransparencyPct}
                onChange={(e) => handleSetOverlayTransparencyPct(Number(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
              />
              <div className="relative h-4 text-[10px] font-mono text-slate-400">
                <span className="absolute left-0">0% (Solid)</span>
                <button
                  type="button"
                  onClick={() => handleSetOverlayTransparencyPct(72)}
                  style={{ left: '72%', transform: 'translateX(-50%)' }}
                  className="absolute text-sky-400 hover:text-sky-300 font-bold transition"
                >
                  ▲ 72% Default
                </button>
                <span className="absolute right-0">100% (Clear)</span>
              </div>
            </div>

            {/* Multi-Device Cloud & Delta Sync Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-white block">
                    ☁️ Multi-Device Auto Delta Sync (Teams + Battle Logs)
                  </span>
                  <span className="text-xs text-slate-400">
                    Sign in with GitHub once on each device. Each user&apos;s logs sync privately to their own GitHub account across unlimited devices.
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Per-User Vault
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href="https://github.com/settings/tokens/new?description=SilphScope+PvP+Cloud+Sync&scopes=gist,repo"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/20"
                >
                  🔑 Login with GitHub (Generate Sync Token)
                </a>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="password"
                  value={githubGistToken}
                  onChange={(e) => {
                    setGithubGistToken(e.target.value);
                    try {
                      localStorage.setItem('gbl_sync_github_token', e.target.value);
                    } catch {}
                  }}
                  placeholder="GitHub OAuth / Personal Access Token (Auto-filled on Android Login)"
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500"
                />
                <input
                  type="text"
                  value={githubGistId}
                  onChange={(e) => {
                    setGithubGistId(e.target.value);
                    try {
                      localStorage.setItem('gbl_sync_github_gist_id', e.target.value);
                    } catch {}
                  }}
                  placeholder="Optional Gist Vault ID (Auto-discovered per user account)"
                  className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 font-mono"
                />
              </div>

              <div className="text-[11px] font-mono text-emerald-400">
                Status: {lastCloudSyncStatus}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={isSyncingCloud}
                  onClick={async () => {
                    const tok = githubGistToken.trim();
                    if (!tok) {
                      alert('Tap "🔑 Login with GitHub" above to generate a token, or use Export/Import Bundle.');
                      return;
                    }
                    setIsSyncingCloud(true);
                    setLastCloudSyncStatus('Reconciling deltas with GitHub Gist...');
                    try {
                      let mergedLogs = [...battleLogs];
                      let mergedPresets = [...presets];
                      let mergedTombstones = new Set<string>(deletedLogIds);
                      let activeGistId = githubGistId.trim();

                      if (activeGistId) {
                        const getRes = await fetch(`https://api.github.com/gists/${activeGistId}`, {
                          headers: {
                            Authorization: `Bearer ${tok}`,
                            Accept: 'application/vnd.github+json'
                          }
                        });
                        if (getRes.ok) {
                          const gistJson = await getRes.json();
                          const content = gistJson?.files?.['gbl_delta_sync_v2.json']?.content;
                          if (content) {
                            const remote = JSON.parse(content);
                            if (Array.isArray(remote.deletedLogIds)) {
                              remote.deletedLogIds.forEach((id: string) => mergedTombstones.add(id));
                            }
                            if (Array.isArray(remote.battleLogs)) {
                              const logMap = new Map<string, WebBattleLogEntry>();
                              mergedLogs.forEach((l) => {
                                if (!mergedTombstones.has(l.id)) logMap.set(l.id, l);
                              });
                              remote.battleLogs.forEach((r: WebBattleLogEntry) => {
                                if (!r?.id || mergedTombstones.has(r.id)) return;
                                const existing = logMap.get(r.id);
                                if (!existing || (r.updatedAt || r.timestampMs) > (existing.updatedAt || existing.timestampMs)) {
                                  logMap.set(r.id, r);
                                }
                              });
                              mergedLogs = Array.from(logMap.values()).sort((a, b) => b.timestampMs - a.timestampMs);
                            }
                            if (Array.isArray(remote.teamPresets)) {
                              const pMap = new Map<string, TeamPreset>();
                              mergedPresets.forEach((p) => pMap.set(p.id, p));
                              remote.teamPresets.forEach((rp: TeamPreset) => {
                                if (rp?.id) pMap.set(rp.id, rp);
                              });
                              mergedPresets = Array.from(pMap.values());
                            }
                          }
                        }
                      }

                      saveBattleLogsToStorage(mergedLogs);
                      setPresets(mergedPresets);
                      const tombArr = Array.from(mergedTombstones);
                      setDeletedLogIds(tombArr);
                      localStorage.setItem('gbl_deleted_log_ids_v1', JSON.stringify(tombArr));

                      const bundleStr = JSON.stringify(
                        {
                          schemaVersion: 2,
                          exportedAt: Date.now(),
                          deviceId,
                          teamPresets: mergedPresets,
                          battleLogs: mergedLogs,
                          deletedLogIds: tombArr
                        },
                        null,
                        2
                      );

                      const url = activeGistId
                        ? `https://api.github.com/gists/${activeGistId}`
                        : 'https://api.github.com/gists';
                      const upRes = await fetch(url, {
                        method: activeGistId ? 'PATCH' : 'POST',
                        headers: {
                          Authorization: `Bearer ${tok}`,
                          Accept: 'application/vnd.github+json',
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          description: 'SilphScope PvP v2.33 Multi-Device Delta Sync Vault',
                          public: false,
                          files: {
                            'gbl_delta_sync_v2.json': { content: bundleStr }
                          }
                        })
                      });
                      if (upRes.ok) {
                        const upJson = await upRes.json();
                        if (upJson.id) {
                          setGithubGistId(upJson.id);
                          localStorage.setItem('gbl_sync_github_gist_id', upJson.id);
                        }
                        const ts = `${new Date().toLocaleTimeString()} • ${mergedLogs.length} battles, ${mergedPresets.length} teams`;
                        setLastCloudSyncStatus(`Synced ${ts}`);
                        localStorage.setItem('gbl_last_cloud_sync_ts', `Synced ${ts}`);
                      } else {
                        setLastCloudSyncStatus(`Sync HTTP ${upRes.status}`);
                      }
                    } catch (err: any) {
                      setLastCloudSyncStatus(`Sync error: ${err?.message || 'failed'}`);
                    } finally {
                      setIsSyncingCloud(false);
                    }
                  }}
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition"
                >
                  {isSyncingCloud ? 'Syncing...' : '🔄 Sync Now'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const bundle = JSON.stringify(
                      {
                        schemaVersion: 2,
                        exportedAt: Date.now(),
                        deviceId,
                        teamPresets: presets,
                        battleLogs,
                        deletedLogIds
                      },
                      null,
                      2
                    );
                    navigator.clipboard.writeText(bundle);
                    setLastCloudSyncStatus('Delta Sync Bundle copied to clipboard!');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 text-xs font-bold transition"
                >
                  📤 Copy Delta Bundle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportBundleText('');
                    setShowImportBundleModal(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold transition"
                >
                  📥 Import &amp; Reconcile Bundle
                </button>
              </div>
            </div>

            {/* 5-Tier 0s/1s/2s Matchup Rating Thresholds Card (Bottom of Settings) */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    <span>🎯 5-Tier 0s/1s/2s Matchup Thresholds (SW, W, N, L, SL)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Configure rating cutoffs used to compute 0s/1s/2s matchup codes and lead classifications. Defaults shown in ().
                  </p>
                </div>
                <button
                  type="button"
                  onClick={restoreDefaultTierThresholds}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition shrink-0"
                >
                  ↺ Restore Defaults (620 / 530 / 470 / 380)
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                <div>• <strong className="text-emerald-400">SW</strong> = Strong Win (rating &gt;= {tierThresholds.swMin}) <span className="text-slate-500">(Default: 620)</span></div>
                <div>• <strong className="text-green-300">W</strong>  = Win ({tierThresholds.wMin} &lt;= rating &lt; {tierThresholds.swMin}) <span className="text-slate-500">(Default: 530 &lt;= rating &lt; 620)</span></div>
                <div>• <strong className="text-slate-400">N</strong>  = Neutral / Grey ({tierThresholds.lMax} &lt; rating &lt; {tierThresholds.wMin}) <span className="text-slate-500">(Default: 470 &lt; rating &lt; 530)</span></div>
                <div>• <strong className="text-rose-300">L</strong>  = Loss ({tierThresholds.slMax} &lt; rating &lt;= {tierThresholds.lMax}) <span className="text-slate-500">(Default: 380 &lt; rating &lt;= 470)</span></div>
                <div>• <strong className="text-rose-500">SL</strong> = Strong Loss (rating &lt;= {tierThresholds.slMax}) <span className="text-slate-500">(Default: &lt;= 380)</span></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-emerald-400 mb-1">
                    SW Strong Win &gt;= (620)
                  </label>
                  <input
                    type="number"
                    value={tierThresholds.swMin}
                    placeholder="(620)"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateTierThresholds({ ...tierThresholds, swMin: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-green-300 mb-1">
                    W Win &gt;= (530)
                  </label>
                  <input
                    type="number"
                    value={tierThresholds.wMin}
                    placeholder="(530)"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateTierThresholds({ ...tierThresholds, wMin: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-rose-300 mb-1">
                    L Loss &lt;= (470)
                  </label>
                  <input
                    type="number"
                    value={tierThresholds.lMax}
                    placeholder="(470)"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateTierThresholds({ ...tierThresholds, lMax: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-rose-500 mb-1">
                    SL Strong Loss &lt;= (380)
                  </label>
                  <input
                    type="number"
                    value={tierThresholds.slMax}
                    placeholder="(380)"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val)) {
                        updateTierThresholds({ ...tierThresholds, slMax: val });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            PAGE 3: GBL BATTLE LOG, SEASON EXPORT & INTERACTIVE POST-GAME REPLAY
           ========================================================================= */}
        {activeTab === 'battle_log' && (() => {
          const nowMs = Date.now();
          const currentSeason =
            seasonsList.find((s) => nowMs >= s.startMs && nowMs <= s.endMs) || seasonsList[0] || DEFAULT_SEASONS_FALLBACK[0];
          const currIdx = seasonsList.indexOf(currentSeason);
          const prevSeason =
            currIdx >= 0 && currIdx + 1 < seasonsList.length
              ? seasonsList[currIdx + 1]
              : DEFAULT_SEASONS_FALLBACK[1];

          const filterByRange = (
            entries: WebBattleLogEntry[],
            rangeCode: 'DAY' | 'WEEK' | 'CURRENT_SEASON' | 'PREVIOUS_SEASON' | 'ALL'
          ) => {
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
            return entries.filter((e) => {
              const leagueOk = logFilterLeague === 'ALL LEAGUES' || e.league.toUpperCase() === logFilterLeague.toUpperCase();
              const teamOk =
                logFilterTeamId === 'ALL TEAMS' ||
                e.presetId === logFilterTeamId ||
                e.userTeamName === presets.find((p) => p.id === logFilterTeamId)?.name;
              const timeOk =
                rangeCode === 'DAY'
                  ? e.timestampMs >= startOfToday.getTime()
                  : rangeCode === 'WEEK'
                  ? e.timestampMs >= sevenDaysAgo
                  : rangeCode === 'CURRENT_SEASON'
                  ? e.timestampMs >= currentSeason.startMs && e.timestampMs <= currentSeason.endMs
                  : rangeCode === 'PREVIOUS_SEASON'
                  ? e.timestampMs >= prevSeason.startMs && e.timestampMs <= prevSeason.endMs
                  : true;
              return leagueOk && teamOk && timeOk;
            });
          };

          const filteredLogs = filterByRange(battleLogs, logFilterTimeframe);
          const wins = filteredLogs.filter((e) => e.result === 'WIN').length;
          const losses = filteredLogs.filter((e) => e.result === 'LOSS').length;
          const total = wins + losses;
          const winRate = total > 0 ? Math.round((wins * 100) / total) : 0;
          const favCount = filteredLogs.filter((e) => e.leadMatchup === 'FAVORABLE').length;
          const neuCount = filteredLogs.filter((e) => e.leadMatchup === 'NEUTRAL').length;
          const negCount = filteredLogs.filter((e) => e.leadMatchup === 'NEGATIVE').length;
          const aggregateWae = calculateAggregateWAE(filteredLogs, presets);

          // Group filtered logs by day for daily section headers with WAE
          const groupedByDay: Array<{ dayLabel: string; entries: WebBattleLogEntry[] }> = [];
          const dayMap = new Map<string, WebBattleLogEntry[]>();
          filteredLogs.forEach((entry) => {
            const dLabel = new Date(entry.timestampMs).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            const existing = dayMap.get(dLabel);
            if (existing) {
              existing.push(entry);
            } else {
              const arr = [entry];
              dayMap.set(dLabel, arr);
              groupedByDay.push({ dayLabel: dLabel, entries: arr });
            }
          });

          const formatExportPokemonName = (rawName: string): string => {
            let working = (rawName || '').trim();
            if (!working) return '';
            if (/^(unknown|waiting\.\.\.)$/i.test(working)) return working;

            let isShadow = false;
            let megaPrimalSuffix = '';

            const parenShadowRegex = /\(\s*shadow\s*\)/gi;
            if (parenShadowRegex.test(working)) {
              isShadow = true;
              working = working.replace(parenShadowRegex, ' ').trim();
            }

            const leadingShadowRegex = /^shadow[\s_-]+(?!rider\b)/i;
            if (leadingShadowRegex.test(working)) {
              isShadow = true;
              working = working.replace(leadingShadowRegex, '').trim();
            }

            const trailingShadowRegex = /[\s_-]+shadow$/i;
            if (trailingShadowRegex.test(working)) {
              isShadow = true;
              working = working.replace(trailingShadowRegex, '').trim();
            }

            if (
              working.length > 1 &&
              working.endsWith('S') &&
              /[a-z]/.test(working.slice(0, -1)) &&
              !/_MEGA_S$/i.test(working)
            ) {
              isShadow = true;
              working = working.slice(0, -1).trim();
            }

            const parenForms: string[] = [];
            const parenRegex = /\(([^)]+)\)/g;
            let match: RegExpExecArray | null;
            while ((match = parenRegex.exec(working)) !== null) {
              const inside = match[1].trim();
              if (!inside || /^(base|shadow)$/i.test(inside)) continue;
              const megaParenMatch = inside.match(/^mega(?:[\s_-]+([xy]))?$/i);
              if (megaParenMatch) {
                megaPrimalSuffix = megaParenMatch[1] ? `_MEGA_${megaParenMatch[1].toUpperCase()}` : '_MEGA';
              } else if (/^primal$/i.test(inside)) {
                megaPrimalSuffix = '_PRIMAL';
              } else if (/^[xy]$/i.test(inside) && /^mega[\s_-]+/i.test(working)) {
                megaPrimalSuffix = `_MEGA_${inside.toUpperCase()}`;
              } else {
                parenForms.push(inside);
              }
            }
            let basePart = working.replace(parenRegex, ' ').replace(/\s+/g, ' ').trim();
            let formPart = parenForms.join('_');

            const trailingMegaPrimalMatch = basePart.match(/^(.+?)[\s_-]+(mega(?:[\s_-]+[xy])?|primal)$/i);
            if (trailingMegaPrimalMatch) {
              basePart = trailingMegaPrimalMatch[1].trim();
              const mpRaw = trailingMegaPrimalMatch[2].trim();
              if (/^primal$/i.test(mpRaw)) {
                megaPrimalSuffix = '_PRIMAL';
              } else {
                const xy = mpRaw.match(/([xy])$/i);
                megaPrimalSuffix = xy ? `_MEGA_${xy[1].toUpperCase()}` : '_MEGA';
              }
            }

            const prefixFormRegex =
              /^(dusk[\s_-]+mane|dawn[\s_-]+wings|single[\s_-]+strike|rapid[\s_-]+strike|crowned[\s_-]+sword|crowned[\s_-]+shield|ice[\s_-]+rider|shadow[\s_-]+rider|galarian[\s_-]+standard|galarian[\s_-]+zen|paldean[\s_-]+combat|paldean[\s_-]+blaze|paldean[\s_-]+aqua|blue[\s_-]+striped|red[\s_-]+striped|white[\s_-]+striped|east[\s_-]+sea|west[\s_-]+sea|full[\s_-]+belly|pom[\s_-]+pom|kanto|kantonian|alolan|alola|galarian|galar|hisuian|hisui|paldean|paldea|unovan|unova|johto|hoenn|sinnoh|kalos|altered|origin|origine|therian|incarnate|crowned|hero|black|white|single|rapid|mega|primal|defense|attack|speed|normal|aria|pirouette|complete|unbound|confined|resolute|ordinary|sky|land|bloodmoon|armored|apex|wash|heat|frost|mow|fan|sunny|rainy|snowy|plant|trash|burn|chill|douse|shock|midnight|midday|dusk|baile|pau|pa'u|sensu|zen|standard|combat|blaze|aqua|hangry)[\s_-]+(.+)$/i;
            const prefixMatch = basePart.match(prefixFormRegex);
            if (prefixMatch) {
              const extractedPrefix = prefixMatch[1].trim();
              let remainingBase = prefixMatch[2].trim();
              if (/^mega$/i.test(extractedPrefix)) {
                const megaXYMatch = remainingBase.match(/^(.+?)[\s_-]+([xy])$/i);
                if (megaXYMatch) {
                  remainingBase = megaXYMatch[1].trim();
                  megaPrimalSuffix = `_MEGA_${megaXYMatch[2].toUpperCase()}`;
                } else if (!megaPrimalSuffix) {
                  megaPrimalSuffix = '_MEGA';
                }
                basePart = remainingBase;
              } else if (/^primal$/i.test(extractedPrefix)) {
                megaPrimalSuffix = '_PRIMAL';
                basePart = remainingBase;
              } else {
                basePart = remainingBase;
                formPart = formPart ? `${extractedPrefix}_${formPart}` : extractedPrefix;
              }
            } else {
              const sandyMatch = basePart.match(/^(sandy)[\s_-]+(wormadam.*)$/i);
              if (sandyMatch) {
                const extractedPrefix = sandyMatch[1].trim();
                basePart = sandyMatch[2].trim();
                formPart = formPart ? `${extractedPrefix}_${formPart}` : extractedPrefix;
              }
            }

            if (megaPrimalSuffix) {
              isShadow = false;
            }

            let normBase = basePart
              .toLowerCase()
              .replace(/[\s-]+/g, '_')
              .replace(/_+/g, '_')
              .replace(/^_+|_+$/g, '');

            if (normBase === 'giratine') normBase = 'giratina';
            else if (normBase.startsWith('giratine_')) normBase = 'giratina_' + normBase.slice('giratine_'.length);
            if (normBase === 'ninetails') normBase = 'ninetales';
            else if (normBase.startsWith('ninetails_')) normBase = 'ninetales_' + normBase.slice('ninetails_'.length);

            const normForm = formPart
              .toLowerCase()
              .replace(/[\s-]+/g, '_')
              .replace(/_+/g, '_')
              .replace(/^_+|_+$/g, '');

            const combined =
              normForm && normForm !== 'base' && !normBase.endsWith(`_${normForm}`)
                ? `${normBase}_${normForm}`
                : normBase;

            if (megaPrimalSuffix) {
              return `${combined}${megaPrimalSuffix}`;
            }
            return isShadow ? `${combined}S` : combined;
          };

          const resolveUserTeamInfo = (entry: WebBattleLogEntry) => {
            const matchedPreset = presets.find(
              (p) =>
                (entry.presetId && p.id === entry.presetId) ||
                p.name.toLowerCase() === (entry.userTeamName || '').toLowerCase()
            );
            const tName = (entry.userTeamName || '').trim() || matchedPreset?.name || 'My Team';
            const directMons = (entry.userPokemon || []).map((m) => m.trim()).filter(Boolean);
            const presetMons = (matchedPreset?.pokemon || []).map((p) => p.name.trim()).filter(Boolean);
            const rawMons = directMons.length > 0 ? directMons : presetMons.length > 0 ? presetMons : [tName];
            const mons = rawMons.map((m) => formatExportPokemonName(m));
            const monsBracket = `[${mons.join(' ')}]`;
            const groupKey = `${tName.toLowerCase()}||${mons.join(' ').toLowerCase()}`;
            return { teamName: tName, mons, monsBracket, groupKey };
          };

          const buildCopyGblText = (
            rangeCode: 'DAY' | 'WEEK' | 'CURRENT_SEASON' | 'PREVIOUS_SEASON' | 'ALL' = logFilterTimeframe
          ) => {
            const list = [...filterByRange(battleLogs, rangeCode)].sort((a, b) => b.timestampMs - a.timestampMs);
            if (list.length === 0) {
              const chosenPreset =
                logFilterTeamId !== 'ALL TEAMS'
                  ? presets.find((p) => p.id === logFilterTeamId)
                  : presets.find((p) => p.isSelected) || presets[0];
              const fallbackMons = (chosenPreset?.pokemon || [])
                .map((p) => formatExportPokemonName(p.name.trim()))
                .filter(Boolean);
              return fallbackMons.length > 0 ? `[${fallbackMons.join(' ')}]` : '[My Team]';
            }

            const teamGroups = new Map<string, WebBattleLogEntry[]>();
            list.forEach((b) => {
              const info = resolveUserTeamInfo(b);
              const existing = teamGroups.get(info.monsBracket);
              if (existing) {
                existing.push(b);
              } else {
                teamGroups.set(info.monsBracket, [b]);
              }
            });

            const sortedBlocks = Array.from(teamGroups.entries()).sort((a, b) => {
              const maxA = Math.max(...a[1].map((x) => x.timestampMs));
              const maxB = Math.max(...b[1].map((x) => x.timestampMs));
              return maxB - maxA;
            });

            return sortedBlocks
              .map(([monsBracket, entries]) => {
                const sortedEntries = [...entries].sort((a, b) => b.timestampMs - a.timestampMs);
                const rows = sortedEntries.map((entry) => {
                  const oppList = (entry.opponents || [])
                    .map((o) => formatExportPokemonName(o.trim()))
                    .filter(Boolean);
                  const oppStr = oppList.length > 0 ? oppList.join(' ') : 'Unknown';
                  const wl = entry.result === 'WIN' ? 'W' : 'L';
                  return `${oppStr} ${wl}`;
                });
                return [monsBracket, ...rows].join('\n');
              })
              .join('\n\n');
          };

          const buildPlainTextSummary = (
            rangeCode: 'DAY' | 'WEEK' | 'CURRENT_SEASON' | 'PREVIOUS_SEASON' | 'ALL'
          ) => {
            const list = [...filterByRange(battleLogs, rangeCode)].sort((a, b) => b.timestampMs - a.timestampMs);
            const w = list.filter((e) => e.result === 'WIN').length;
            const l = list.filter((e) => e.result === 'LOSS').length;
            const tot = w + l;
            const pct = tot > 0 ? Math.round((w * 100) / tot) : 0;
            const fv = list.filter((e) => e.leadMatchup === 'FAVORABLE').length;
            const nu = list.filter((e) => e.leadMatchup === 'NEUTRAL').length;
            const ng = list.filter((e) => e.leadMatchup === 'NEGATIVE').length;
            const waeInfo = calculateAggregateWAE(list, presets);
            const rangeTitle =
              rangeCode === 'DAY'
                ? 'Day (Today)'
                : rangeCode === 'WEEK'
                ? 'This Week (Last 7 Days)'
                : rangeCode === 'CURRENT_SEASON'
                ? `Current Season (${currentSeason.name})`
                : rangeCode === 'PREVIOUS_SEASON'
                ? `Previous Season (${prevSeason.name})`
                : 'All Time';
            const teamName =
              logFilterTeamId === 'ALL TEAMS'
                ? 'All Teams'
                : presets.find((p) => p.id === logFilterTeamId)?.name || 'Selected Team';
            const leagueHeader = logFilterLeague === 'ALL LEAGUES' ? 'All Leagues' : logFilterLeague;
            const lines: string[] = [
              `SilphScope PvP Battle Log — ${leagueHeader}`,
              `Team: ${teamName}`,
              `Range: ${rangeTitle}`,
              `Overall Record: ${w}W - ${l}L (${pct}%) • Leads: ${fv} Fav / ${nu} Neu / ${ng} Neg • WAE: ${waeInfo.formatted} • Luck: ${waeInfo.luckFormatted}`
            ];
            if (list.length === 0) {
              lines.push('', 'No battles logged in this timeframe.');
              return lines.join('\n');
            }
            const dayGroups: Array<{ dayStr: string; items: WebBattleLogEntry[] }> = [];
            const dMap = new Map<string, WebBattleLogEntry[]>();
            list.forEach((b) => {
              const dStr = new Date(b.timestampMs).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              });
              const existing = dMap.get(dStr);
              if (existing) {
                existing.push(b);
              } else {
                const arr = [b];
                dMap.set(dStr, arr);
                dayGroups.push({ dayStr: dStr, items: arr });
              }
            });

            dayGroups.forEach(({ dayStr, items }) => {
              const dayTeamsMap = new Map<string, WebBattleLogEntry[]>();
              items.forEach((b) => {
                const tInfo = resolveUserTeamInfo(b);
                const existing = dayTeamsMap.get(tInfo.groupKey);
                if (existing) {
                  existing.push(b);
                } else {
                  dayTeamsMap.set(tInfo.groupKey, [b]);
                }
              });

              const sortedDayTeams = Array.from(dayTeamsMap.values()).sort((a, b) => {
                if (b.length !== a.length) return b.length - a.length;
                const maxA = Math.max(...a.map((x) => x.timestampMs));
                const maxB = Math.max(...b.map((x) => x.timestampMs));
                return maxB - maxA;
              });

              sortedDayTeams.forEach((teamItems) => {
                const tInfo = resolveUserTeamInfo(teamItems[0]);
                const dw = teamItems.filter((e) => e.result === 'WIN').length;
                const dl = teamItems.filter((e) => e.result === 'LOSS').length;
                const dtot = dw + dl;
                const dpct = dtot > 0 ? Math.round((dw * 100) / dtot) : 0;
                const dfv = teamItems.filter((e) => e.leadMatchup === 'FAVORABLE').length;
                const dnu = teamItems.filter((e) => e.leadMatchup === 'NEUTRAL').length;
                const dng = teamItems.filter((e) => e.leadMatchup === 'NEGATIVE').length;
                const dwae = calculateAggregateWAE(teamItems, presets);
                lines.push(
                  '',
                  `=== ${dayStr} - ${tInfo.teamName} ${tInfo.monsBracket} Daily Record: ${dw}W - ${dl}L (${dpct}%) [Leads: ${dfv} Fav, ${dnu} Neu, ${dng} Neg] • WAE: ${dwae.formatted} • Luck: ${dwae.luckFormatted} ===`
                );
                [...teamItems]
                  .sort((a, b) => b.timestampMs - a.timestampMs)
                  .forEach((b) => {
                    const wl = b.result === 'WIN' ? 'W' : 'L';
                    const leadTag =
                      b.leadMatchup === 'FAVORABLE' ? 'Fav' : b.leadMatchup === 'NEGATIVE' ? 'Neg' : 'Neu';
                    const q = resolveLogEntryQuality(b, presets);
                    const matchWinTag = q ? `${Math.round(q.pWin * 100)}%` : '—%';
                    const oppList = (b.opponents || [])
                      .map((o) => formatExportPokemonName(o.trim()))
                      .filter(Boolean);
                    const oppStr = oppList.length > 0 ? oppList.join(' ') : 'Unknown';
                    lines.push(`${wl} (Lead:${leadTag} Match:${matchWinTag}): ${oppStr}`);
                  });
              });
            });
            return lines.join('\n');
          };

          return (
            <div className="max-w-4xl mx-auto space-y-5">
              {/* 3-Page Quick Switcher Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Target className="w-5 h-5 text-sky-400" />
                    <span>📜 GBL Battle Log, Season Export &amp; Interactive Replay</span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Click any battle card (or <strong>🔍 Replay</strong>) to inspect the interactive 3v3 overlay matrix and analyze swap/shield decisions!
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold shrink-0">
                  <button
                    onClick={() => setActiveTab('presets')}
                    className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    ⚔️ Teams
                  </button>
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white transition"
                  >
                    ⚙️ Settings
                  </button>
                  <button
                    onClick={() => setActiveTab('battle_log')}
                    className="px-3 py-1.5 rounded-lg bg-sky-500 text-white shadow-sm"
                  >
                    📜 Battle Log
                  </button>
                </div>
              </div>

              {/* Filter & Export Controls Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">League Filter</label>
                    <select
                      value={logFilterLeague}
                      onChange={(e) => setLogFilterLeague(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                    >
                      <option value="ALL LEAGUES">ALL LEAGUES</option>
                      <option value="GREAT LEAGUE">GREAT LEAGUE</option>
                      <option value="ULTRA LEAGUE">ULTRA LEAGUE</option>
                      <option value="MASTER LEAGUE">MASTER LEAGUE</option>
                      <option value="MEGA MASTER LEAGUE">MEGA MASTER LEAGUE</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Team Preset Filter</label>
                    <select
                      value={logFilterTeamId}
                      onChange={(e) => setLogFilterTeamId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                    >
                      <option value="ALL TEAMS">All Teams ({presets.length})</option>
                      {presets.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.league.split(' ')[0]})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                      Timeframe (ScrapedDuck Seasons)
                    </label>
                    <select
                      value={logFilterTimeframe}
                      onChange={(e) => setLogFilterTimeframe(e.target.value as any)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                    >
                      <option value="DAY">Day (Today)</option>
                      <option value="WEEK">Week (Last 7 Days)</option>
                      <option value="CURRENT_SEASON">Current Season ({currentSeason.name})</option>
                      <option value="PREVIOUS_SEASON">Previous Season ({prevSeason.name})</option>
                      <option value="ALL">All Time</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const gblText = buildCopyGblText(logFilterTimeframe);
                        navigator.clipboard.writeText(gblText);
                        setCopiedFile(true);
                        setTimeout(() => setCopiedFile(false), 2000);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-sky-600/25 hover:bg-sky-600/40 border border-sky-400/50 text-sky-200 text-xs font-bold transition"
                    >
                      {copiedFile ? '✓ Copied GBL!' : '📋 Copy GBL'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setExportFormatMode('STANDARD');
                        setExportPromptAction('SHARE');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/40 border border-emerald-400/50 text-emerald-200 text-xs font-bold transition"
                    >
                      📤 Share Log Summary
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('settings')}
                      className="px-3 py-1.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/40 border border-purple-400/50 text-purple-200 text-xs font-bold transition"
                    >
                      ☁️ Multi-Device Cloud Sync
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBattlesTrashModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 text-xs font-bold transition"
                    >
                      🗑️ Trash ({deletedBattlesTrash.length})
                    </button>
                    {battleLogs.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearBattleLogs}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-bold transition"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Summary Metrics Row (5-Stat Responsive Grid: Record, Lead Matchups, Win Rate, Exec WAE, Matchup Luck) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center shadow-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    RECORD (W - L)
                  </span>
                  <strong className="text-base sm:text-lg font-extrabold text-white">
                    {wins}W - {losses}L ({total})
                  </strong>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center shadow-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    LEAD MATCHUPS
                  </span>
                  <strong className="text-xs sm:text-sm font-extrabold text-sky-400">
                    {favCount} Fav • {neuCount} Neu • {negCount} Neg
                  </strong>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center shadow-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    WIN RATE
                  </span>
                  <strong className="text-base sm:text-lg font-extrabold text-amber-400">{winRate}%</strong>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center shadow-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    EXEC WAE
                  </span>
                  <strong
                    style={{
                      color:
                        aggregateWae.waePct === null
                          ? '#94a3b8'
                          : aggregateWae.waePct >= 0
                          ? '#4ade80'
                          : '#f43f5e'
                    }}
                    className="text-base sm:text-lg font-extrabold"
                  >
                    {aggregateWae.formatted}
                  </strong>
                </div>
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-center shadow-xl col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    MATCHUP LUCK
                  </span>
                  <strong
                    style={{
                      color:
                        aggregateWae.luckPct === null
                          ? '#94a3b8'
                          : aggregateWae.luckPct > 50
                          ? '#38bdf8'
                          : aggregateWae.luckPct < 50
                          ? '#fb923c'
                          : '#94a3b8'
                    }}
                    className="text-base sm:text-lg font-extrabold"
                  >
                    {aggregateWae.luckFormatted}
                  </strong>
                </div>
              </div>

              {/* Battle Log List Container */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-white">
                    Logged Battles ({filteredLogs.length}) • Tap any battle to open Interactive Overlay Replay
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    Season: {currentSeason.name} (Start {currentSeason.rawStart.slice(0, 10)})
                  </span>
                </div>

                {filteredLogs.length === 0 ? (
                  <div className="p-6 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-2">
                    <div className="text-sm font-bold text-white">
                      📜 No Battles Logged in Selected Filter
                    </div>
                    <p className="text-slate-400 leading-relaxed">
                      In the floating overlay, tap <strong>⚔️ Start Battle</strong> when a match begins and <strong>🛑 Stop Battle</strong> when it ends to record a <strong>🏆 Win</strong> or <strong>💀 Loss</strong> with auto-detected <strong>Lead Matchup (Fav / Neu / Neg)</strong>, <strong>Quality of Win/Loss (WAE)</strong>, and fixed <strong>[1st seen, 2nd seen, 3rd seen]</strong> opponent order!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {groupedByDay.map((dayGroup) => {
                      const dWins = dayGroup.entries.filter((e) => e.result === 'WIN').length;
                      const dLosses = dayGroup.entries.filter((e) => e.result === 'LOSS').length;
                      const dTotal = dWins + dLosses;
                      const dPct = dTotal > 0 ? Math.round((dWins * 100) / dTotal) : 0;
                      const dFav = dayGroup.entries.filter((e) => e.leadMatchup === 'FAVORABLE').length;
                      const dNeu = dayGroup.entries.filter((e) => e.leadMatchup === 'NEUTRAL').length;
                      const dNeg = dayGroup.entries.filter((e) => e.leadMatchup === 'NEGATIVE').length;
                      const dWae = calculateAggregateWAE(dayGroup.entries, presets);

                      return (
                        <div key={dayGroup.dayLabel} className="space-y-2">
                          <div className="px-2 py-1 text-[11.5px] font-bold text-sky-400 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80">
                            <span>
                              📅 {dayGroup.dayLabel} — Daily Record: {dWins}W - {dLosses}L ({dPct}%) • Leads: {dFav} Fav / {dNeu} Neu / {dNeg} Neg • WAE:{' '}
                              <span
                                style={{
                                  color:
                                    dWae.waePct === null
                                      ? '#94a3b8'
                                      : dWae.waePct >= 0
                                      ? '#4ade80'
                                      : '#f43f5e'
                                }}
                              >
                                {dWae.formatted}
                              </span>
                              {' '}• Luck:{' '}
                              <span
                                style={{
                                  color:
                                    dWae.luckPct === null
                                      ? '#94a3b8'
                                      : dWae.luckPct > 50
                                      ? '#38bdf8'
                                      : dWae.luckPct < 50
                                      ? '#fb923c'
                                      : '#94a3b8'
                                }}
                              >
                                {dWae.luckFormatted}
                              </span>
                            </span>
                          </div>

                          {dayGroup.entries.map((entry) => {
                            const isWin = entry.result === 'WIN';
                            const leadLabel =
                              entry.leadMatchup === 'FAVORABLE'
                                ? 'Fav'
                                : entry.leadMatchup === 'NEGATIVE'
                                ? 'Neg'
                                : 'Neu';
                            const quality = resolveLogEntryQuality(entry, presets);
                            const bmfPct = quality ? Math.round(quality.pPre * 100) : null;
                            const execWaeVal = quality
                              ? typeof quality.execWae === 'number'
                                ? quality.execWae
                                : quality.deltaQ
                              : null;
                            const deltaQSign = execWaeVal !== null && execWaeVal >= 0 ? '+' : '';
                            const deltaQText =
                              execWaeVal !== null ? `${deltaQSign}${(execWaeVal * 100).toFixed(1)}%` : null;

                            const getBadgeStyle = (label?: string): { bg: string; text: string; border: string } => {
                              switch (label) {
                                case 'Clutch Win':
                                  return {
                                    bg: 'rgba(34, 211, 238, 0.16)',
                                    text: '#22d3ee',
                                    border: 'rgba(34, 211, 238, 0.45)'
                                  };
                                case 'Skill Win':
                                  return {
                                    bg: 'rgba(74, 222, 128, 0.16)',
                                    text: '#4ade80',
                                    border: 'rgba(74, 222, 128, 0.45)'
                                  };
                                case 'Blunder Loss':
                                  return {
                                    bg: 'rgba(244, 63, 94, 0.16)',
                                    text: '#f43f5e',
                                    border: 'rgba(244, 63, 94, 0.45)'
                                  };
                                case 'Tough Loss':
                                  return {
                                    bg: 'rgba(251, 146, 60, 0.16)',
                                    text: '#fb923c',
                                    border: 'rgba(251, 146, 60, 0.45)'
                                  };
                                default:
                                  return {
                                    bg: 'rgba(148, 163, 184, 0.15)',
                                    text: '#94a3b8',
                                    border: 'rgba(148, 163, 184, 0.4)'
                                  };
                              }
                            };

                            const getContextualFlagClass = (flag: string): string => {
                              if (flag.includes('Double Shield Pocket')) {
                                return 'bg-rose-500/15 text-rose-300 border-rose-400/40';
                              }
                              if (flag.includes('Shield in Pocket')) {
                                return 'bg-amber-500/15 text-amber-300 border-amber-400/40';
                              }
                              if (flag.includes('Clean Sweep')) {
                                return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40';
                              }
                              if (flag.includes('Shield Advantage')) {
                                return 'bg-sky-500/15 text-sky-300 border-sky-400/40';
                              }
                              return 'bg-amber-500/15 text-amber-300 border-amber-400/40';
                            };

                            const badgeStyle = getBadgeStyle(quality?.badgeLabel);
                            const contextualFlags: string[] = quality?.contextualFlags || entry.flags || [];

                            return (
                              <div
                                key={entry.id}
                                onClick={() => {
                                  setReplayLogEntry(entry);
                                  setReplayUserIdx(0);
                                  setReplayOppIdx(0);
                                  setReplayOppShadow(false);
                                }}
                                className="p-3.5 rounded-xl bg-slate-950 hover:bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`px-2 py-0.5 rounded font-extrabold text-[10px] border ${
                                        isWin
                                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                      }`}
                                    >
                                      {isWin ? '🏆 WIN' : '💀 LOSS'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const nextLead: 'FAVORABLE' | 'NEUTRAL' | 'NEGATIVE' =
                                          entry.leadMatchup === 'FAVORABLE'
                                            ? 'NEUTRAL'
                                            : entry.leadMatchup === 'NEUTRAL'
                                            ? 'NEGATIVE'
                                            : 'FAVORABLE';
                                        const updated = battleLogs.map((b) =>
                                          b.id === entry.id ? { ...b, leadMatchup: nextLead, updatedAt: Date.now() } : b
                                        );
                                        saveBattleLogsToStorage(updated);
                                      }}
                                      className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                                        entry.leadMatchup === 'FAVORABLE'
                                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                          : entry.leadMatchup === 'NEGATIVE'
                                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                          : 'bg-slate-800 text-slate-300 border-slate-700'
                                      }`}
                                      title="Click to toggle Lead Matchup (Fav / Neu / Neg)"
                                    >
                                      Lead: {leadLabel} ↻
                                    </button>
                                    <span className="font-bold text-sky-400">
                                      {entry.league}
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-400">
                                      {new Date(entry.timestampMs).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                  </div>

                                  <div className="text-slate-200">
                                    <span className="text-slate-400">Team:</span>{' '}
                                    <strong className="text-white">{entry.userTeamName}</strong>{' '}
                                    <span className="text-slate-400">({(entry.userPokemon || []).join(' / ')})</span>
                                  </div>
                                  <div className="text-amber-200">
                                    <span className="text-slate-400">Opponents (1st → 2nd → 3rd):</span>{' '}
                                    <strong>
                                      {entry.opponents.length > 0
                                        ? entry.opponents.map((o, i) => `#${i + 1} ${o}`).join('  •  ')
                                        : 'None Scanned'}
                                    </strong>
                                  </div>

                                  {/* Phase 3: Primary Performance Badge & Contextual Event Flags (Pills) Container */}
                                  <div className="pt-0.5 flex items-center gap-1.5 flex-wrap">
                                    {quality ? (
                                      <>
                                        <span
                                          style={{
                                            backgroundColor: badgeStyle.bg,
                                            color: badgeStyle.text,
                                            borderColor: badgeStyle.border
                                          }}
                                          className="px-2.5 py-0.5 rounded-md font-extrabold text-[10.5px] border inline-flex items-center gap-1"
                                        >
                                          <span>{quality.badgeLabel}</span>
                                          <span>•</span>
                                          <span>BMF: {bmfPct}%</span>
                                          <span>•</span>
                                          <span>WAE: {deltaQText}</span>
                                        </span>
                                        {contextualFlags.map((flag) => (
                                          <span
                                            key={flag}
                                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getContextualFlagClass(flag)}`}
                                          >
                                            {flag}
                                          </span>
                                        ))}
                                      </>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-900 text-slate-500 border border-slate-800">
                                        Unranked (Incomplete Match — 2nd Opponent Unseen)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div
                                  className="flex items-center gap-1.5 shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setReplayLogEntry(entry);
                                      setReplayUserIdx(0);
                                      setReplayOppIdx(0);
                                      setReplayOppShadow(false);
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/35 border border-sky-400/50 text-sky-200 font-bold text-[11px] transition"
                                  >
                                    🔍 Replay
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingLogEntry({ ...entry })}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/35 border border-amber-400/50 text-amber-200 font-bold text-[11px] transition"
                                  >
                                    ✏️ Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSingleBattleLog(entry)}
                                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/35 border border-rose-400/50 text-rose-200 font-bold text-[11px] transition"
                                    title="Move battle to Trash"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Timeframe Summary Export Prompt Modal */}
              {exportPromptAction && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h3 className="font-bold text-sm text-white">
                        {exportPromptAction === 'COPY' ? '📋 Copy Battle Log Summary' : '📤 Share Battle Log Summary'}
                      </h3>
                      <button
                        onClick={() => setExportPromptAction(null)}
                        className="text-slate-400 hover:text-white font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 font-mono text-[10.5px] text-slate-300 whitespace-pre-wrap max-h-36 overflow-y-auto">
                      {buildPlainTextSummary(logFilterTimeframe)}
                    </div>

                    <p className="text-xs text-slate-300">
                      Select timeframe to {exportPromptAction === 'COPY' ? 'copy' : 'share'}:
                    </p>
                    <div className="space-y-2">
                      {(
                        [
                          { code: 'DAY', label: 'Day (Today)' },
                          { code: 'WEEK', label: 'Week (Last 7 Days)' },
                          { code: 'CURRENT_SEASON', label: `Current Season (${currentSeason.name})` },
                          { code: 'PREVIOUS_SEASON', label: `Previous Season (${prevSeason.name})` },
                          { code: 'ALL', label: 'All Time' }
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.code}
                          type="button"
                          onClick={async () => {
                            const text = buildPlainTextSummary(opt.code);
                            navigator.clipboard.writeText(text);
                            if (exportPromptAction === 'SHARE' && navigator.share) {
                              try {
                                await navigator.share({ title: 'SilphScope PvP Battle Log', text });
                              } catch {}
                            }
                            setExportPromptAction(null);
                          }}
                          className="w-full py-2.5 px-3 rounded-xl bg-slate-950 hover:bg-sky-500/20 border border-slate-800 hover:border-sky-400 text-left text-xs font-bold text-white flex items-center justify-between transition"
                        >
                          <span>{opt.label}</span>
                          <span className="text-[10px] font-mono text-sky-400">
                            {filterByRange(battleLogs, opt.code).length} battles →
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Edit Logged Battle Modal */}
              {editingLogEntry && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <h3 className="font-bold text-sm text-white">✏️ Edit Logged Battle</h3>
                      <button
                        onClick={() => setEditingLogEntry(null)}
                        className="text-slate-400 hover:text-white font-bold"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditingLogEntry({ ...editingLogEntry, result: 'WIN' })}
                        className={`py-2 rounded-xl font-bold border ${
                          editingLogEntry.result === 'WIN'
                            ? 'bg-emerald-600/35 border-emerald-400 text-emerald-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        🏆 WIN
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingLogEntry({ ...editingLogEntry, result: 'LOSS' })}
                        className={`py-2 rounded-xl font-bold border ${
                          editingLogEntry.result === 'LOSS'
                            ? 'bg-rose-600/35 border-rose-400 text-rose-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400'
                        }`}
                      >
                        💀 LOSS
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs">
                      {(['FAVORABLE', 'NEUTRAL', 'NEGATIVE'] as const).map((lm) => (
                        <button
                          key={lm}
                          type="button"
                          onClick={() => setEditingLogEntry({ ...editingLogEntry, leadMatchup: lm })}
                          className={`py-1.5 rounded-xl font-bold border text-[11px] ${
                            editingLogEntry.leadMatchup === lm
                              ? 'bg-sky-500/30 border-sky-400 text-sky-200'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          Lead: {lm.slice(0, 3)}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-2 text-xs">
                      {[0, 1, 2].map((slotIdx) => (
                        <div key={slotIdx}>
                          <label className="block text-[10px] text-slate-400 mb-0.5">
                            Opponent #{slotIdx + 1} ({slotIdx === 0 ? '1st Seen Lead' : slotIdx === 1 ? '2nd Seen Swap' : '3rd Seen Closer'})
                          </label>
                          <input
                            type="text"
                            value={editingLogEntry.opponents[slotIdx] || ''}
                            onChange={(e) => {
                              const nextOpps = [...editingLogEntry.opponents];
                              nextOpps[slotIdx] = e.target.value;
                              setEditingLogEntry({
                                ...editingLogEntry,
                                opponents: nextOpps.filter((x) => x.trim().length > 0)
                              });
                            }}
                            placeholder={`Opponent #${slotIdx + 1}`}
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => setEditingLogEntry(null)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const recomputedQuality = resolveLogEntryQuality(
                            { ...editingLogEntry, quality: undefined },
                            presets
                          );
                          const updated = battleLogs.map((b) =>
                            b.id === editingLogEntry.id
                              ? {
                                  ...editingLogEntry,
                                  bmfScore: recomputedQuality ? recomputedQuality.pPre : null,
                                  execWae: recomputedQuality ? recomputedQuality.execWae : null,
                                  badges: recomputedQuality ? [recomputedQuality.badgeLabel] : [],
                                  flags: recomputedQuality ? recomputedQuality.contextualFlags : [],
                                  quality: recomputedQuality,
                                  updatedAt: Date.now()
                                }
                              : b
                          );
                          saveBattleLogsToStorage(updated);
                          setEditingLogEntry(null);
                        }}
                        className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Interactive Post-Game Overlay Replay Inspector Modal */}
              {replayLogEntry && (() => {
                const replayTeamNames =
                  replayLogEntry.userPokemon && replayLogEntry.userPokemon.length === 3
                    ? replayLogEntry.userPokemon
                    : activePreset.pokemon.map((p) => p.name);
                const replayOpps =
                  replayLogEntry.opponents && replayLogEntry.opponents.length > 0
                    ? replayLogEntry.opponents
                    : ['Zacian (Crowned)'];
                const safeUserSlot = Math.max(0, Math.min(replayUserIdx, replayTeamNames.length - 1));
                const safeOppSlot = Math.max(0, Math.min(replayOppIdx, replayOpps.length - 1));
                const activeReplayUserMon = replayTeamNames[safeUserSlot] || 'Palkia (Origin)';
                const activeReplayOppMon = replayOpps[safeOppSlot] || replayOpps[0];
                const rawOpp = POKEMON_DATABASE[activeReplayOppMon] || POKEMON_DATABASE['Zacian (Crowned)'];
                const effOpp = computeEffectiveStatsForLeague(
                  rawOpp,
                  (replayLogEntry.league as LeagueType) || 'GREAT LEAGUE',
                  undefined,
                  undefined,
                  replayOppShadow
                );
                const recUser = getRecommendedMovesForPokemon(
                  activeReplayUserMon,
                  (replayLogEntry.league as LeagueType) || 'GREAT LEAGUE'
                );
                const userFast = recUser?.fastMove || 'Dragon Breath';
                const userTurns = FAST_MOVE_TURN_LOOKUP[userFast.toLowerCase()] || 2;
                const userCharged = [recUser?.chargedMove1 || 'Aqua Tail', recUser?.chargedMove2 || 'Spacial Rend'];
                const replayOppTiming = calculateOpponentMoveTimingRows(
                  effOpp,
                  activeReplayUserMon,
                  replayTeamNames,
                  replayOppShadow,
                  userTurns,
                  userFast,
                  userCharged,
                  oppCountMode,
                  (replayLogEntry.league as LeagueType) || 'GREAT LEAGUE',
                  undefined,
                  enable4ChargedMoves
                );
                const replayMyTiming = calculateMyMoveTimingRows(
                  activeReplayUserMon,
                  effOpp,
                  userCharged,
                  replayOppTiming.rows.map((r) => r.myTapAtReady),
                  replayOppShadow,
                  userTurns,
                  userFast,
                  replayOpps,
                  replayOppTiming.maxHorizonTurns,
                  (replayLogEntry.league as LeagueType) || 'GREAT LEAGUE',
                  undefined,
                  enable4ChargedMoves
                );

                return (
                  <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-sky-500/50 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div>
                          <h3 className="font-bold text-sm text-white flex items-center gap-2">
                            <span>🔍 Post-Game Interactive Overlay Replay</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                                replayLogEntry.result === 'WIN'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-rose-500/20 text-rose-300'
                              }`}
                            >
                              {replayLogEntry.result}
                            </span>
                          </h3>
                          <p className="text-[11px] text-slate-400">
                            Tap any of your 3 Pokémon or any of the 3 opponents (#1, #2, #3) below to inspect shield scenarios, move counts &amp; swap options!
                          </p>
                        </div>
                        <button
                          onClick={() => setReplayLogEntry(null)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold"
                        >
                          ✕ Close
                        </button>
                      </div>

                      {/* Interactive Overlay HUD Replica */}
                      <div className="rounded-xl bg-slate-950 border border-sky-400/40 p-3 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-amber-300">
                              VS #{safeOppSlot + 1} {replayOppShadow ? 'S-' : ''}{activeReplayOppMon}
                            </span>
                            <button
                              type="button"
                              onClick={() => setReplayOppShadow(!replayOppShadow)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                replayOppShadow
                                  ? 'bg-purple-600/50 border-purple-300 text-white'
                                  : 'bg-slate-900 border-slate-700 text-purple-300'
                              }`}
                            >
                              Shadow: {replayOppShadow ? 'ON' : 'OFF'}
                            </button>
                          </div>
                          <div className="flex items-center gap-1">
                            {replayTeamNames.map((mName, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setReplayUserIdx(idx)}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                                  safeUserSlot === idx
                                    ? 'bg-emerald-500/35 border-emerald-400 text-white'
                                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                                }`}
                              >
                                {mName.split(' ')[0].slice(0, 6)}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* 3v3 Matchup Matrix (Fixed 1st/2nd/3rd seen order) */}
                        <div className="space-y-1 bg-slate-900/70 p-2 rounded-lg border border-slate-800">
                          {replayOpps.map((oppName, idx) => {
                            const isActv = idx === safeOppSlot;
                            const m = calculateShieldMatrix(oppName, replayTeamNames, isActv && replayOppShadow);
                            return (
                              <div
                                key={`${oppName}-${idx}`}
                                onClick={() => setReplayOppIdx(idx)}
                                className={`flex items-center justify-between px-2 py-1 rounded cursor-pointer transition ${
                                  isActv
                                    ? 'bg-sky-500/25 border border-sky-400/60'
                                    : 'hover:bg-slate-800/70 border border-transparent'
                                }`}
                              >
                                <span className="font-bold text-white">
                                  <span className="text-sky-400 mr-1">#{idx + 1}</span>
                                  {oppName}
                                </span>
                                <div className="flex items-center gap-2 font-mono text-[10px]">
                                  <span>{replayTeamNames[0]?.charAt(0) || '1'}: {renderTierDots(m.p1)}</span>
                                  <span>{replayTeamNames[1]?.charAt(0) || '2'}: {renderTierDots(m.p2)}</span>
                                  <span>{replayTeamNames[2]?.charAt(0) || '3'}: {renderTierDots(m.p3)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Opponent Attacks vs Your 3 Team Members */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                            <span>Opponent Charged Moves ({activeReplayOppMon})</span>
                            <span>Damage vs {replayTeamNames.map((n) => n.slice(0, 3)).join(' / ')}</span>
                          </div>
                          {replayOppTiming.rows.map((r) => (
                            <div
                              key={r.name}
                              className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded px-2 py-1 text-[11px]"
                            >
                              <div>
                                <strong className="text-amber-300">{r.name}</strong>{' '}
                                <span className="text-slate-400 font-mono">({r.energy}e / {r.displayReadyCount}f)</span>
                              </div>
                              <div className="flex items-center gap-2 font-mono">
                                {r.teamDamages.map((td, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className={`px-1.5 py-0.5 rounded ${
                                      cIdx === safeUserSlot
                                        ? 'bg-sky-500/25 border border-sky-400/60 text-white font-bold'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {td.dmgPct}%
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Your Active Pokemon Attacks vs 3 Opponents */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase">
                            <span>Your Moves ({activeReplayUserMon})</span>
                            <span>Damage vs #1 / #2 / #3</span>
                          </div>
                          {replayMyTiming.map((r) => (
                            <div
                              key={r.name}
                              className="flex items-center justify-between bg-slate-900/80 border border-slate-800 rounded px-2 py-1 text-[11px]"
                            >
                              <div>
                                <strong className="text-sky-300">{r.name}</strong>{' '}
                                <span className="text-slate-400 font-mono">({r.energy}e / {r.myTapsNeeded}f)</span>
                              </div>
                              <div className="flex items-center gap-2 font-mono">
                                {r.oppDamages.map((od, cIdx) => (
                                  <span
                                    key={cIdx}
                                    className={`px-1.5 py-0.5 rounded ${
                                      cIdx === safeOppSlot
                                        ? 'bg-sky-500/25 border border-sky-400/60 text-white font-bold'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {od.isEmpty ? '—' : `${od.dmgPct}%`}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* Import & Reconcile Delta Sync Bundle Modal */}
        {showImportBundleModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-white">📥 Import &amp; Reconcile Delta Sync Bundle</h3>
                <button
                  onClick={() => setShowImportBundleModal(false)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>
              <textarea
                rows={7}
                value={importBundleText}
                onChange={(e) => setImportBundleText(e.target.value)}
                placeholder="Paste JSON bundle exported from your other device..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs font-mono text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportBundleModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const remote = JSON.parse(importBundleText);
                      const mergedTombstones = new Set<string>(deletedLogIds);
                      if (Array.isArray(remote.deletedLogIds)) {
                        remote.deletedLogIds.forEach((id: string) => mergedTombstones.add(id));
                      }
                      const logMap = new Map<string, WebBattleLogEntry>();
                      battleLogs.forEach((l) => {
                        if (!mergedTombstones.has(l.id)) logMap.set(l.id, l);
                      });
                      if (Array.isArray(remote.battleLogs)) {
                        remote.battleLogs.forEach((r: WebBattleLogEntry) => {
                          if (!r?.id || mergedTombstones.has(r.id)) return;
                          const existing = logMap.get(r.id);
                          if (!existing || (r.updatedAt || r.timestampMs) > (existing.updatedAt || existing.timestampMs)) {
                            logMap.set(r.id, r);
                          }
                        });
                      }
                      const mergedLogs = Array.from(logMap.values()).sort((a, b) => b.timestampMs - a.timestampMs);
                      saveBattleLogsToStorage(mergedLogs);

                      if (Array.isArray(remote.teamPresets)) {
                        const pMap = new Map<string, TeamPreset>();
                        presets.forEach((p) => pMap.set(p.id, p));
                        remote.teamPresets.forEach((rp: TeamPreset) => {
                          if (rp?.id) pMap.set(rp.id, rp);
                        });
                        setPresets(Array.from(pMap.values()));
                      }
                      const tombArr = Array.from(mergedTombstones);
                      setDeletedLogIds(tombArr);
                      localStorage.setItem('gbl_deleted_log_ids_v1', JSON.stringify(tombArr));
                      setLastCloudSyncStatus(`Reconciled bundle (${mergedLogs.length} battles)`);
                      setShowImportBundleModal(false);
                    } catch {
                      alert('Invalid Delta Sync JSON bundle.');
                    }
                  }}
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                >
                  Reconcile Deltas
                </button>
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

        {/* Deleted Teams Trash Bin Modal */}
        {showTeamsTrashModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-white">
                  🗑️ Deleted Teams Trash Bin ({deletedTeamsTrash.length})
                </h3>
                <button
                  onClick={() => setShowTeamsTrashModal(false)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>
              {deletedTeamsTrash.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No deleted teams in Trash. Any team you delete can be restored from here anytime.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {deletedTeamsTrash.map((t) => (
                    <div
                      key={t.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white">
                          {t.name}{' '}
                          <span className="text-[10px] text-sky-400 font-mono">({t.league})</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {t.pokemon.map((p) => p.name).join(' / ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => restoreTeamPresetsFromTrash([t])}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                        >
                          ♻️ Restore
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveDeletedTeamsTrashToStorage(deletedTeamsTrash.filter((x) => x.id !== t.id))
                          }
                          className="px-2 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[11px]"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                {deletedTeamsTrash.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        restoreTeamPresetsFromTrash(deletedTeamsTrash);
                        setShowTeamsTrashModal(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      ♻️ Restore All ({deletedTeamsTrash.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDeletedTeamsTrashToStorage([])}
                      className="px-3 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-bold"
                    >
                      🗑️ Empty Trash
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setShowTeamsTrashModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deleted Battles Trash Bin Modal */}
        {showBattlesTrashModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h3 className="font-bold text-sm text-white">
                  🗑️ Deleted Battles Trash Bin ({deletedBattlesTrash.length})
                </h3>
                <button
                  onClick={() => setShowBattlesTrashModal(false)}
                  className="text-slate-400 hover:text-white font-bold"
                >
                  ✕
                </button>
              </div>
              {deletedBattlesTrash.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No deleted battles in Trash. Any battle you delete or clear can be restored from here anytime.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {deletedBattlesTrash.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span className={b.result === 'WIN' ? 'text-emerald-400' : 'text-rose-400'}>
                            {b.result === 'WIN' ? '🏆 WIN' : '💀 LOSS'}
                          </span>
                          <span>• {b.userTeamName}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Vs: {b.opponents.length > 0 ? b.opponents.join(', ') : 'Unknown'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => restoreBattleLogsFromTrash([b])}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                        >
                          ♻️ Restore
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            saveDeletedBattlesTrashToStorage(deletedBattlesTrash.filter((x) => x.id !== b.id))
                          }
                          className="px-2 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 text-rose-300 font-bold text-[11px]"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between items-center pt-2 border-t border-slate-800">
                {deletedBattlesTrash.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        restoreBattleLogsFromTrash(deletedBattlesTrash);
                        setShowBattlesTrashModal(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold"
                    >
                      ♻️ Restore All ({deletedBattlesTrash.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => saveDeletedBattlesTrashToStorage([])}
                      className="px-3 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 text-xs font-bold"
                    >
                      🗑️ Empty Trash
                    </button>
                  </div>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setShowBattlesTrashModal(false)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-center text-xs text-slate-500">
        SilphScope PvP v2.33 Overlay • Built with Kotlin, WindowManager TYPE_APPLICATION_OVERLAY, MediaProjection in-memory frame capture, and ML Kit Text Recognition.
      </footer>
    </div>
  );
}
