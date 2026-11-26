'use client';

import React, { useEffect, useState } from 'react';
import {
  Bot,
  CloudRain,
  Globe,
  Palette,
  Search,
  Shield,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { CLUB_PRESETS, STADIUM_TEMPLATES } from '@/data/clubs';
import { CURATED_PLAYERS } from '@/data/players';
import {
  CareerTrophyRecord,
  ClubPreset,
  EraPoolFilter,
  GameConfig,
  KitPattern,
  KnockoutFormat,
  Player,
  PlayMode,
  WeatherCondition,
} from '@/types/game';
import { ClubCrest } from '@/components/ui/ClubCrest';
import { JerseyPreview } from '@/components/ui/JerseyPreview';
import {
  loadCustomClubs,
  loadManagerPrefs,
  loadTrophyCabinet,
  saveCustomClub,
  saveManagerPrefs,
} from '@/lib/storage';

interface LobbyPhaseProps {
  onStartAuction: (
    m1Name: string,
    m1Club: ClubPreset,
    m2Name: string,
    m2Club: ClubPreset,
    config: GameConfig
  ) => void;
  onJoinSyncedRoom?: (roomCode: string) => void;
}

const KIT_PATTERNS: KitPattern[] = [
  'solid',
  'stripes',
  'sash',
  'center',
  'sleeves',
  'hoops',
];

export const LobbyPhase: React.FC<LobbyPhaseProps> = ({
  onStartAuction,
  onJoinSyncedRoom,
}) => {
  const [m1Name, setM1Name] = useState('Pep Guardiola');
  const [m2Name, setM2Name] = useState('Carlo Ancelotti');
  const [customClubs, setCustomClubs] = useState<ClubPreset[]>([]);
  const [m1Club, setM1Club] = useState<ClubPreset>(CLUB_PRESETS[1]); // Man City
  const [m2Club, setM2Club] = useState<ClubPreset>(CLUB_PRESETS[0]); // Real Madrid
  const [startingPurse, setStartingPurse] = useState(1000);
  const [eraFilter, setEraFilter] = useState<EraPoolFilter>('mixed');
  const [stadiumId, setStadiumId] = useState(STADIUM_TEMPLATES[0].id);
  const [weather, setWeather] = useState<WeatherCondition>('clear_night');
  const [knockoutFormat, setKnockoutFormat] =
    useState<KnockoutFormat>('single_leg');
  const [bidTimerSeconds, setBidTimerSeconds] = useState<5 | 10>(10);
  const [firstLegHome, setFirstLegHome] = useState(1);
  const [firstLegAway, setFirstLegAway] = useState(1);
  const [playMode, setPlayMode] = useState<PlayMode>('local');
  const [roomCode, setRoomCode] = useState('UCL26');

  const [showTrophies, setShowTrophies] = useState(false);
  const [trophies, setTrophies] = useState<CareerTrophyRecord[]>([]);
  const [showScout, setShowScout] = useState(false);
  const [scoutQuery, setScoutQuery] = useState('');
  const [scoutPlayers, setScoutPlayers] = useState<Player[]>([]);
  const [externalBio, setExternalBio] = useState<{
    source: string;
    playerName: string;
    nationality?: string;
    description?: string;
  } | null>(null);
  const [scoutLoading, setScoutLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setRoomCode(Math.random().toString(36).slice(2, 7).toUpperCase());
      setCustomClubs(loadCustomClubs());
      setTrophies(loadTrophyCabinet());
      const prefs = loadManagerPrefs();
      if (prefs) {
        setM1Name(prefs.m1Name);
        setM2Name(prefs.m2Name);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const allClubs = [...customClubs, ...CLUB_PRESETS];

  const handleLaunch = () => {
    saveManagerPrefs({ m1Name, m2Name });
    if (playMode === 'online_join' && onJoinSyncedRoom) {
      onJoinSyncedRoom(roomCode.trim().toUpperCase());
      return;
    }
    const seed = Math.floor(Math.random() * 900000) + 100000;
    onStartAuction(m1Name, m1Club, m2Name, m2Club, {
      playMode,
      roomCode: roomCode.trim().toUpperCase(),
      seed,
      startingPurse,
      eraFilter,
      stadiumId,
      weather,
      knockoutFormat,
      bidTimerSeconds,
      firstLegScore:
        knockoutFormat === 'two_legged'
          ? { home: firstLegHome, away: firstLegAway }
          : undefined,
    });
  };

  const handleScoutSearch = async (withEnrich: boolean) => {
    setScoutLoading(true);
    try {
      const url = `/api/players?era=${eraFilter}${
        withEnrich && scoutQuery ? `&enrich=1&q=${encodeURIComponent(scoutQuery)}` : ''
      }`;
      const res = await fetch(url);
      const data = await res.json();
      setScoutPlayers(data.players ?? []);
      setExternalBio(data.externalInfo ?? null);
    } catch {
      setExternalBio(null);
    } finally {
      setScoutLoading(false);
    }
  };

  const renderTeamCustomizer = (
    idx: 0 | 1,
    name: string,
    setName: (v: string) => void,
    club: ClubPreset,
    setClub: (c: ClubPreset) => void
  ) => (
    <div className="ucl-glass rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClubCrest club={club} size={52} />
          <div>
            <span className="text-xs uppercase tracking-widest text-cyan-400 font-bold">
              Manager {idx + 1} ({idx === 0 ? 'Home' : 'Away'})
            </span>
            <h3 className="text-lg font-extrabold text-white">{club.name}</h3>
          </div>
        </div>
        <JerseyPreview club={club} size={62} number={idx === 0 ? 10 : 7} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Manager Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl bg-slate-900/90 border border-slate-700 px-3 py-2 text-sm text-white focus:border-cyan-400 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">
            Club Identity (24+ Presets)
          </label>
          <select
            value={club.id}
            onChange={(e) => {
              const found = allClubs.find((c) => c.id === e.target.value);
              if (found) setClub({ ...found });
            }}
            className="w-full rounded-xl bg-slate-900/90 border border-slate-700 px-3 py-2 text-sm text-white focus:border-cyan-400 outline-none"
          >
            {allClubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Kit Customizer */}
      <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-3 space-y-2.5">
        <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
          <span className="flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-cyan-400" />
            Custom Kit & Colors
          </span>
          <button
            type="button"
            onClick={() => {
              const custom: ClubPreset = {
                ...club,
                id: `custom_${club.code}_${Date.now()}`,
                name: `${club.name} (Custom)`,
              };
              const updated = saveCustomClub(custom);
              setCustomClubs(updated);
              setClub(custom);
            }}
            className="text-cyan-400 hover:text-cyan-300 underline"
          >
            Save Preset
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {KIT_PATTERNS.map((pat) => (
            <button
              key={pat}
              type="button"
              onClick={() => setClub({ ...club, pattern: pat })}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                club.pattern === pat
                  ? 'bg-cyan-500 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {pat}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <label className="flex items-center gap-1.5">
            Primary
            <input
              type="color"
              value={club.primary}
              onChange={(e) => setClub({ ...club, primary: e.target.value })}
              className="w-7 h-6 rounded bg-transparent cursor-pointer"
            />
          </label>
          <label className="flex items-center gap-1.5">
            Secondary
            <input
              type="color"
              value={club.secondary}
              onChange={(e) => setClub({ ...club, secondary: e.target.value })}
              className="w-7 h-6 rounded bg-transparent cursor-pointer"
            />
          </label>
          <label className="flex items-center gap-1.5">
            Accent
            <input
              type="color"
              value={club.accent}
              onChange={(e) => setClub({ ...club, accent: e.target.value })}
              className="w-7 h-6 rounded bg-transparent cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-6 space-y-6">
      {/* Header Banner */}
      <div className="ucl-glass rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 text-xs font-bold tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            UCL Mega-Auction & Next-Gen 3D Match Simulator
          </div>
          <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white">
            Draft Your <span className="text-cyan-400">1-4-3-3</span> Galácticos.
            Command the 3D Pitch.
          </h1>
          <p className="text-sm text-slate-300 max-w-2xl">
            {CURATED_PLAYERS.length}+ modern 2026/27 superstars &amp; prime icons,
            dual-console uncapped bidding with 5s/10s countdown timer, RTM cards
            &amp; sealed-bid power rounds, and a Three.js broadcast 3D match
            engine.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={() => {
              setShowScout(true);
              handleScoutSearch(false);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 border border-slate-600 text-sm font-semibold text-slate-100 transition"
          >
            <Search className="w-4 h-4 text-cyan-400" />
            Scout Pool
          </button>
          <button
            type="button"
            onClick={() => setShowTrophies(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-sm font-semibold text-amber-200 transition"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            Trophy Cabinet ({trophies.length})
          </button>
        </div>
      </div>

      {/* Manager 1 & Manager 2 Setup */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {renderTeamCustomizer(0, m1Name, setM1Name, m1Club, setM1Club)}
        {renderTeamCustomizer(1, m2Name, setM2Name, m2Club, setM2Club)}
      </div>

      {/* Match & Auction Rules */}
      <div className="ucl-glass rounded-2xl p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="flex items-center justify-between text-xs text-slate-300 font-semibold mb-1.5">
            <span>Transfer Purse</span>
            <span className="text-cyan-400 font-bold">€{startingPurse}M</span>
          </label>
          <input
            type="range"
            min={750}
            max={1500}
            step={50}
            value={startingPurse}
            onChange={(e) => setStartingPurse(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
            <span>€750M</span>
            <span>€1,500M</span>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-300 font-semibold mb-1.5">
            Player Pool Era
          </label>
          <select
            value={eraFilter}
            onChange={(e) => setEraFilter(e.target.value as EraPoolFilter)}
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
          >
            <option value="mixed">
              All-Time Mixed ({CURATED_PLAYERS.length} Players)
            </option>
            <option value="modern">Modern 2026/27 Superstars</option>
            <option value="icon">Prime Retired Icons</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-300 font-semibold mb-1.5">
            3D Host Stadium
          </label>
          <select
            value={stadiumId}
            onChange={(e) => setStadiumId(e.target.value)}
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
          >
            {STADIUM_TEMPLATES.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name} ({st.capacity.toLocaleString()})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold mb-1.5">
            <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
            Weather & Pitch Physics
          </label>
          <select
            value={weather}
            onChange={(e) => setWeather(e.target.value as WeatherCondition)}
            className="w-full rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
          >
            <option value="clear_night">Clear UCL Floodlight Night</option>
            <option value="light_rain">Light Rain (Fast Slick Turf)</option>
            <option value="heavy_rain">Heavy Storm (Hydroplaning)</option>
            <option value="snow_flurry">Alpine Snow Flurry</option>
          </select>
        </div>
      </div>

      {/* Mode & Knockout Format + CTA */}
      <div className="ucl-glass rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900/90 p-1 rounded-xl border border-slate-700">
            <button
              type="button"
              onClick={() => setPlayMode('local')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                playMode === 'local'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Pass &amp; Play
            </button>
            <button
              type="button"
              onClick={() => {
                setPlayMode('vs_ai');
                if (m2Name === 'Carlo Ancelotti') setM2Name('AI Transfer Director');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                playMode === 'vs_ai'
                  ? 'bg-amber-400 text-slate-950'
                  : 'text-slate-300'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              vs AI CPU
            </button>
            <button
              type="button"
              onClick={() => setPlayMode('online_host')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                playMode === 'online_host'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              Host Online
            </button>
            <button
              type="button"
              onClick={() => setPlayMode('online_join')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                playMode === 'online_join'
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-300'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Join Room
            </button>
          </div>

          {(playMode === 'online_host' || playMode === 'online_join') && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Room Code:</span>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={8}
                className="w-28 rounded-lg bg-slate-900 border border-cyan-500/40 px-2.5 py-1.5 text-xs font-mono font-bold text-cyan-300 uppercase"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold">Bid Timer:</span>
            <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-700">
              {([5, 10] as const).map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setBidTimerSeconds(sec)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-black cursor-pointer ${
                    bidTimerSeconds === sec
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={knockoutFormat}
              onChange={(e) =>
                setKnockoutFormat(e.target.value as KnockoutFormat)
              }
              className="rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
            >
              <option value="single_leg">Single-Leg Final (ET + Pens)</option>
              <option value="two_legged">Two-Legged UCL Tie (Aggregate)</option>
            </select>
            {knockoutFormat === 'two_legged' && (
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <span>1st Leg:</span>
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={firstLegHome}
                  onChange={(e) => setFirstLegHome(Number(e.target.value))}
                  className="w-12 rounded bg-slate-900 border border-slate-700 px-1.5 py-1 text-center"
                />
                <span>-</span>
                <input
                  type="number"
                  min={0}
                  max={9}
                  value={firstLegAway}
                  onChange={(e) => setFirstLegAway(Number(e.target.value))}
                  className="w-12 rounded bg-slate-900 border border-slate-700 px-1.5 py-1 text-center"
                />
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleLaunch}
          className="px-7 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-500 hover:brightness-110 text-slate-950 font-black text-sm tracking-wide uppercase shadow-lg shadow-cyan-500/25 transition cursor-pointer"
        >
          {playMode === 'online_join'
            ? 'Join Synced Mega-Auction →'
            : 'Enter Mega-Auction Room →'}
        </button>
      </div>

      {/* Trophy Cabinet Modal */}
      {showTrophies && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="ucl-glass rounded-2xl max-w-2xl w-full p-6 max-h-[80vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-amber-300 flex items-center gap-2">
                <Trophy className="w-5 h-5" />
                UCL Career Trophy Cabinet
              </h2>
              <button
                type="button"
                onClick={() => setShowTrophies(false)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                Close
              </button>
            </div>
            {trophies.length === 0 ? (
              <p className="text-sm text-slate-400">
                No Champions League trophies recorded yet. Complete a match to
                immortalize the champions!
              </p>
            ) : (
              <div className="space-y-2.5">
                {trophies.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl bg-slate-900/90 border border-amber-400/20 p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-white text-sm">
                        {t.winnerClub} ({t.winnerManager}) def. {t.runnerUpClub}
                      </div>
                      <div className="text-xs text-slate-400">
                        {t.stadium} • MotM: {t.motmName} ({t.motmRating.toFixed(1)}) •{' '}
                        {t.date}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-amber-300">{t.scoreLine}</div>
                      {t.penalties && (
                        <div className="text-[11px] text-cyan-300">
                          Pens: {t.penalties}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scout Pool Modal */}
      {showScout && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="ucl-glass rounded-2xl max-w-4xl w-full p-6 max-h-[84vh] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-white">
                Player Pool Scout ({scoutPlayers.length} Players)
              </h2>
              <button
                type="button"
                onClick={() => setShowScout(false)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300"
              >
                Close
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={scoutQuery}
                onChange={(e) => setScoutQuery(e.target.value)}
                placeholder="Search player name (e.g. Lionel Messi, Jude Bellingham)..."
                className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-white"
              />
              <button
                type="button"
                onClick={() => handleScoutSearch(true)}
                disabled={scoutLoading}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
              >
                {scoutLoading ? 'Scouting...' : 'Enrich via Open Sports API'}
              </button>
            </div>
            {externalBio && (
              <div className="rounded-xl bg-cyan-950/50 border border-cyan-400/30 p-3 text-xs text-cyan-100">
                <span className="font-bold text-cyan-300">
                  [{externalBio.source}] {externalBio.playerName}
                </span>
                {externalBio.nationality ? ` (${externalBio.nationality})` : ''}:{' '}
                {externalBio.description ?? 'Verified open database match.'}
              </div>
            )}
            <div className="overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pr-1">
              {scoutPlayers
                .filter((pl) =>
                  pl.name.toLowerCase().includes(scoutQuery.toLowerCase())
                )
                .map((pl) => (
                  <div
                    key={pl.id}
                    className="rounded-xl bg-slate-900/90 border border-slate-800 p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-sm text-white">
                        {pl.flag} {pl.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {pl.role} • {pl.club} • Base €{pl.base}M
                      </div>
                    </div>
                    <span className="px-2 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 font-black text-xs">
                      {pl.ovr}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
