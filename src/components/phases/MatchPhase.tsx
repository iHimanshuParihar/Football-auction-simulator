'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  Camera,
  Copy,
  FastForward,
  Home,
  Mic,
  MicOff,
  Play,
  RotateCcw,
  Save,
  Sliders,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  CameraMode,
  GameConfig,
  MatchEvent,
  StadiumTemplate,
  TacticalMentality,
  TeamSetup,
} from '@/types/game';
import { STADIUM_TEMPLATES } from '@/data/clubs';
import {
  MatchSimSnapshot,
  MatchSimulationEngine,
} from '@/lib/match-engine';
import { Match3DCanvas } from '@/components/three/Match3DCanvas';
import { ClubCrest } from '@/components/ui/ClubCrest';
import { JerseyPreview } from '@/components/ui/JerseyPreview';
import { PlayerPortrait } from '@/components/ui/PlayerPortrait';
import { audioEngine } from '@/lib/audio-engine';
import { saveTrophyRecord } from '@/lib/storage';

interface MatchPhaseProps {
  teams: [TeamSetup, TeamSetup];
  config: GameConfig;
  onRematch: () => void;
  onNewTournament: () => void;
}

const CAMERAS: Array<{ id: CameraMode; label: string }> = [
  { id: 'broadcast', label: 'Broadcast Wide' },
  { id: 'tactical', label: 'Tactical Spider-Cam' },
  { id: 'pitchside', label: 'Pitchside Low' },
  { id: 'gk_pov', label: 'Goalkeeper POV' },
];

export const MatchPhase: React.FC<MatchPhaseProps> = ({
  teams,
  config,
  onRematch,
  onNewTournament,
}) => {
  const stadium: StadiumTemplate = useMemo(
    () =>
      STADIUM_TEMPLATES.find((s) => s.id === config.stadiumId) ??
      STADIUM_TEMPLATES[0],
    [config.stadiumId]
  );

  const [cameraMode, setCameraMode] = useState<CameraMode>('broadcast');
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [sfxMuted, setSfxMuted] = useState(audioEngine.sfxMuted);
  const [voiceMuted, setVoiceMuted] = useState(audioEngine.voiceMuted);
  const [heatmapPlayerId, setHeatmapPlayerId] = useState<string>(
    teams[0].squad[9]?.id ?? teams[0].squad[0]?.id ?? ''
  );
  const [showRadar, setShowRadar] = useState(true);
  const [showTacticsDrawer, setShowTacticsDrawer] = useState(false);
  const [subOutId, setSubOutId] = useState<[string, string]>([
    teams[0].squad[9]?.id ?? '',
    teams[1].squad[9]?.id ?? '',
  ]);
  const [copiedReport, setCopiedReport] = useState(false);
  const [savedTrophy, setSavedTrophy] = useState(false);

  const [engine] = useState(
    () =>
      new MatchSimulationEngine(
        teams,
        config.seed,
        config.weather,
        config.knockoutFormat,
        config.firstLegScore,
        (evt: MatchEvent) => {
          if (evt.type === 'goal') {
            audioEngine.playSFX('goal_roar');
            audioEngine.speakCommentary(evt.text, true);
          } else if (evt.type === 'kickoff') {
            audioEngine.playSFX('whistle');
            audioEngine.speakCommentary(evt.text, true);
          } else if (evt.type === 'halftime' || evt.type === 'fulltime') {
            audioEngine.playSFX('double_whistle');
            audioEngine.speakCommentary(evt.text, true);
          } else if (evt.type === 'yellow_card' || evt.type === 'red_card') {
            audioEngine.playSFX('card');
            audioEngine.speakCommentary(evt.text);
          } else if (evt.type === 'woodwork') {
            audioEngine.playSFX('post');
            audioEngine.speakCommentary(evt.text);
          } else if (evt.type === 'save') {
            audioEngine.playSFX('xg_swell');
            audioEngine.speakCommentary(evt.text);
          } else if (evt.type === 'penalty_awarded' || evt.type === 'corner' || evt.type === 'free_kick' || evt.type === 'var_check') {
            audioEngine.playSFX('whistle');
            audioEngine.speakCommentary(evt.text);
          }
        },
        config.playMode === 'vs_ai' ? 1 : null
      )
  );

  const [snapshot, setSnapshot] = useState<MatchSimSnapshot>(() =>
    engine.getSnapshot()
  );

  useEffect(() => {
    audioEngine.playSFX('anthem');
    return () => {
      audioEngine.stopSpeech();
    };
  }, []);

  // Broadcast keyboard shortcuts (1-4 Camera, Space Kickoff/2nd Half, M Mute)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (k === '1') setCameraMode('broadcast');
      else if (k === '2') setCameraMode('tactical');
      else if (k === '3') setCameraMode('pitchside');
      else if (k === '4') setCameraMode('gk_pov');
      else if (k === 'm') {
        audioEngine.sfxMuted = !audioEngine.sfxMuted;
        setSfxMuted(audioEngine.sfxMuted);
      } else if (k === ' ') {
        e.preventDefault();
        if (engine.period === 'walkout') {
          engine.startKickoff();
          setSnapshot(engine.getSnapshot());
        } else if (engine.period === 'halftime') {
          engine.resumeSecondHalf();
          setSnapshot(engine.getSnapshot());
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [engine]);

  const syncSnapshot = () => {
    setSnapshot(engine.getSnapshot());
  };

  const handleCopyMatchReport = () => {
    const goals = snapshot.events
      .filter((e) => e.type === 'goal')
      .slice()
      .reverse()
      .map((e) => `${e.minute}' ${e.playerName} (${teams[e.teamIdx].club.code})`)
      .join(', ');
    const report = [
      `UCL MATCH REPORT — ${stadium.name}`,
      `${teams[0].club.name} ${snapshot.stats[0].goals} - ${snapshot.stats[1].goals} ${teams[1].club.name}`,
      goals ? `Goals: ${goals}` : 'Goals: None',
      `Possession: ${snapshot.possessionPct[0]}% - ${snapshot.possessionPct[1]}% | xG: ${snapshot.stats[0].xg.toFixed(2)} - ${snapshot.stats[1].xg.toFixed(2)}`,
      `Shots (OT): ${snapshot.stats[0].shots}(${snapshot.stats[0].shotsOnTarget}) - ${snapshot.stats[1].shots}(${snapshot.stats[1].shotsOnTarget}) | Saves: ${snapshot.stats[0].saves} - ${snapshot.stats[1].saves}`,
      motm ? `MotM: ${motm.name} (${motm.rating.toFixed(1)})` : '',
    ]
      .filter(Boolean)
      .join('\n');
    navigator.clipboard?.writeText(report).catch(() => {});
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const handleSimToFullTime = () => {
    engine.simToFullTime();
    syncSnapshot();
  };

  const poss = snapshot.possessionPct;
  const motm = snapshot.motm;
  const clockStr = `${String(snapshot.minute).padStart(2, '0')}:${String(
    snapshot.second
  ).padStart(2, '0')}`;

  const aggHome =
    snapshot.stats[0].goals + (config.firstLegScore?.home ?? 0);
  const aggAway =
    snapshot.stats[1].goals + (config.firstLegScore?.away ?? 0);

  const handleSaveTrophy = () => {
    if (savedTrophy) return;
    const winIdx = snapshot.winnerIdx === 1 ? 1 : 0;
    const loseIdx = winIdx === 0 ? 1 : 0;
    saveTrophyRecord({
      id: `${Date.now()}`,
      date: new Date().toLocaleDateString(),
      winnerManager: teams[winIdx].managerName,
      winnerClub: teams[winIdx].club.name,
      winnerCode: teams[winIdx].club.code,
      runnerUpClub: teams[loseIdx].club.name,
      scoreLine: `${snapshot.stats[0].goals} - ${snapshot.stats[1].goals}`,
      penalties:
        snapshot.penalties.length > 0
          ? `${snapshot.penaltyScore[0]} - ${snapshot.penaltyScore[1]}`
          : undefined,
      motmName: motm?.name ?? 'Star Player',
      motmRating: motm?.rating ?? 8.5,
      stadium: stadium.name,
    });
    setSavedTrophy(true);
  };

  const heatmapPlayer =
    snapshot.playerHeatmaps.find((p) => p.id === heatmapPlayerId) ??
    snapshot.playerHeatmaps[0];

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-4 space-y-4">
      {/* Zero-Spoiler UCL Broadcast Scorebug */}
      <div className="ucl-glass rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <JerseyPreview club={teams[0].club} size={30} number={10} />
          <ClubCrest club={teams[0].club} size={38} />
          <span className="font-black text-white text-sm md:text-base">
            {teams[0].club.code}
          </span>
          <div className="px-4 py-1.5 rounded-xl bg-slate-950 border border-cyan-500/40 font-black text-xl text-white tracking-wider">
            {snapshot.stats[0].goals} - {snapshot.stats[1].goals}
          </div>
          <span className="font-black text-white text-sm md:text-base">
            {teams[1].club.code}
          </span>
          <ClubCrest club={teams[1].club} size={38} />
          <JerseyPreview club={teams[1].club} size={30} number={7} />

          {config.knockoutFormat === 'two_legged' && (
            <span className="text-xs px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-200 font-bold">
              AGG {aggHome} - {aggAway}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {snapshot.replayTimer > 0 && (
            <span className="px-2.5 py-1 rounded-lg bg-rose-500 text-white text-xs font-black animate-pulse">
              {snapshot.replayPhase === 'action_replay'
                ? 'UCL SLOW-MO GOAL REPLAY'
                : 'GOAL CELEBRATION'}
            </span>
          )}
          <span className="px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/35 text-cyan-300 font-mono font-black text-sm">
            {clockStr}
          </span>
          <span className="text-xs uppercase font-bold text-slate-300">
            {snapshot.period.replace('_', ' ')}
          </span>
        </div>

        {/* Audio & Speed Controls */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[1, 2, 4, 8].map((spd) => (
            <button
              key={spd}
              type="button"
              onClick={() => setSpeedMultiplier(spd)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-black cursor-pointer ${
                speedMultiplier === spd
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {spd}x
            </button>
          ))}
          {snapshot.period !== 'fulltime' && (
            <button
              type="button"
              onClick={handleSimToFullTime}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500/25 hover:bg-indigo-500/40 border border-indigo-400/40 text-indigo-200 text-xs font-bold cursor-pointer"
              title="Simulate remaining match to Full-Time"
            >
              <FastForward className="w-3.5 h-3.5" />
              Sim FT
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              audioEngine.sfxMuted = !audioEngine.sfxMuted;
              setSfxMuted(audioEngine.sfxMuted);
            }}
            className="p-2 rounded-lg bg-slate-800 text-slate-200"
            title="Toggle Stadium SFX"
          >
            {sfxMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              audioEngine.voiceMuted = !audioEngine.voiceMuted;
              if (audioEngine.voiceMuted) audioEngine.stopSpeech();
              setVoiceMuted(audioEngine.voiceMuted);
            }}
            className="p-2 rounded-lg bg-slate-800 text-slate-200"
            title="Toggle Voice Commentary"
          >
            {voiceMuted ? (
              <MicOff className="w-4 h-4 text-rose-400" />
            ) : (
              <Mic className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Main 3D Broadcast Viewport + Overlays */}
      <div className="relative">
        <Match3DCanvas
          engine={engine}
          stadium={stadium}
          cameraMode={cameraMode}
          weather={config.weather}
          speedMultiplier={speedMultiplier}
          onTick={syncSnapshot}
        />

        {/* Pre-Kickoff UCL Walkout Lower-Third Overlay */}
        {snapshot.period === 'walkout' && (
          <div className="absolute inset-0 bg-slate-950/78 backdrop-blur-sm rounded-2xl p-5 flex flex-col justify-between">
            <div className="text-center space-y-1">
              <div className="text-xs uppercase font-black tracking-[0.25em] text-cyan-400">
                UEFA Champions League • {stadium.name}
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-white">
                {teams[0].club.name} vs {teams[1].club.name}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto">
              {([0, 1] as const).map((idx) => (
                <div
                  key={idx}
                  className="rounded-xl bg-slate-900/90 border border-slate-700 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs font-black text-cyan-300">
                    <span className="inline-flex items-center gap-1.5">
                      <ClubCrest club={teams[idx].club} size={22} />
                      <JerseyPreview club={teams[idx].club} size={22} number={10} />
                      {teams[idx].club.name} XI ({teams[idx].mentality})
                    </span>
                    <span>Mgr: {teams[idx].managerName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {teams[idx].squad.slice(0, 11).map((pl) => (
                      <div
                        key={pl.id}
                        className="flex items-center gap-2 bg-slate-950/80 rounded-lg p-1.5 text-[11px]"
                      >
                        <PlayerPortrait
                          player={pl}
                          kitColor={teams[idx].club.primary}
                          size={28}
                        />
                        <div className="truncate">
                          <div className="font-bold text-white truncate">
                            {pl.name}
                            {teams[idx].captainId === pl.id ? ' (C)' : ''}
                          </div>
                          <div className="text-slate-400">
                            {pl.role} • OVR {pl.ovr}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => {
                  engine.startKickoff();
                  syncSnapshot();
                }}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-slate-950 font-black text-sm uppercase shadow-xl cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Blow Kickoff Whistle
              </button>
            </div>
          </div>
        )}

        {/* Goal Scorer Celebration Card with Real Face & Jersey */}
        {snapshot.goalBanner && snapshot.period !== 'fulltime' && (
          <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-[460px] ucl-glass rounded-2xl p-4 border-2 border-amber-400/75 shadow-2xl flex items-center gap-4 animate-bounce-once">
            <PlayerPortrait
              player={snapshot.goalBanner.scorer}
              kitColor={teams[snapshot.goalBanner.teamIdx].club.primary}
              size={78}
              preferRealPhoto={true}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs uppercase tracking-wider">
                  ⚽ GOAL! {snapshot.goalBanner.minute}&apos;
                </span>
                <span className="text-[11px] font-bold text-cyan-300">
                  {snapshot.goalBanner.xg.toFixed(2)} xG
                </span>
              </div>
              <div className="text-xl font-black text-white truncate mt-1">
                {snapshot.goalBanner.scorer.flag}{' '}
                {snapshot.goalBanner.scorer.name}
              </div>
              <div className="text-xs text-slate-300 truncate">
                {teams[snapshot.goalBanner.teamIdx].club.name}
                {snapshot.goalBanner.assistName
                  ? ` • Assist: ${snapshot.goalBanner.assistName}`
                  : ''}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <JerseyPreview
                club={teams[snapshot.goalBanner.teamIdx].club}
                size={54}
                number={snapshot.goalBanner.scorer.squadNumber}
                playerName={snapshot.goalBanner.scorer.name}
              />
              <ClubCrest
                club={teams[snapshot.goalBanner.teamIdx].club}
                size={26}
              />
            </div>
          </div>
        )}

        {/* Cinematic Replay Top Banner */}
        {snapshot.replayTimer > 0 && snapshot.period !== 'fulltime' && (
          <div className="pointer-events-none absolute top-3 right-3 px-3.5 py-1.5 rounded-xl bg-slate-950/88 border border-rose-400/70 shadow-2xl flex items-center gap-2 z-20">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="text-[11px] font-black uppercase tracking-wider text-white">
              {snapshot.replayPhase === 'action_replay'
                ? 'UCL Action Replay • Slow-Mo'
                : 'Live Goal Celebration'}
            </span>
          </div>
        )}

        {/* VAR Check Replay Broadcast Overlay */}
        {snapshot.varCheck && snapshot.period !== 'fulltime' && (
          <div
            className={`absolute top-14 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl border-2 shadow-2xl flex items-center gap-3 z-20 ${
              snapshot.varCheck.decisionShown === 'disallowed'
                ? 'bg-rose-950/95 border-rose-400'
                : snapshot.varCheck.decisionShown === 'confirmed'
                  ? 'bg-emerald-950/95 border-emerald-400'
                  : 'bg-indigo-950/94 border-cyan-400 animate-pulse'
            }`}
          >
            <ClubCrest club={teams[snapshot.varCheck.teamIdx].club} size={30} />
            <span
              className={`px-2.5 py-1 rounded-lg font-black text-xs uppercase ${
                snapshot.varCheck.decisionShown === 'disallowed'
                  ? 'bg-rose-400 text-slate-950'
                  : snapshot.varCheck.decisionShown === 'confirmed'
                    ? 'bg-emerald-400 text-slate-950'
                    : 'bg-cyan-400 text-slate-950'
              }`}
            >
              {snapshot.varCheck.decisionShown === 'disallowed'
                ? 'NO GOAL • OFFSIDE'
                : snapshot.varCheck.decisionShown === 'confirmed'
                  ? 'GOAL CONFIRMED'
                  : 'VAR REVIEW'}
            </span>
            <div className="text-xs">
              <div className="font-black text-white">
                {snapshot.varCheck.decisionShown === 'reviewing'
                  ? `Checking Offside Replay — ${snapshot.varCheck.scorerName}`
                  : snapshot.varCheck.decisionShown === 'disallowed'
                    ? `${snapshot.varCheck.scorerName} ruled marginally offside`
                    : `${snapshot.varCheck.scorerName} timed run onside!`}
              </div>
              <div className="text-cyan-200 flex items-center gap-2 text-[10px] font-bold">
                <span className="text-blue-300">■ Defender Line</span>
                <span>•</span>
                <span className="text-rose-300">■ Attacker Line</span>
              </div>
            </div>
          </div>
        )}

        {/* Live Set-Piece & Referee Disciplinary Card Callout */}
        {snapshot.setPiece && snapshot.period !== 'walkout' && (
          <div className="absolute top-4 left-4 px-4 py-2 rounded-xl bg-slate-950/92 border border-amber-400/70 shadow-xl flex items-center gap-2.5 animate-pulse">
            <ClubCrest club={teams[snapshot.setPiece.teamIdx].club} size={24} />
            <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[11px] uppercase">
              {snapshot.setPiece.kind.replace('_', ' ')}
            </span>
            <span className="text-xs font-bold text-white">
              {teams[snapshot.setPiece.teamIdx].club.code} •{' '}
              {snapshot.setPiece.takerName}
            </span>
          </div>
        )}

        {snapshot.refereeCardAlert && (() => {
          const alert = snapshot.refereeCardAlert;
          const cardedPlayer = teams[alert.teamIdx].squad.find(
            (p) => p.id === alert.playerId
          );
          return (
            <div
              className={`absolute top-4 right-4 px-4 py-3 rounded-2xl border-2 shadow-2xl flex items-center gap-3 z-20 ${
                alert.color === 'red'
                  ? 'bg-rose-950/95 border-rose-400'
                  : 'bg-amber-950/95 border-amber-400'
              }`}
            >
              {cardedPlayer && (
                <PlayerPortrait
                  player={cardedPlayer}
                  kitColor={teams[alert.teamIdx].club.primary}
                  size={42}
                />
              )}
              <div className="flex items-center gap-2">
                {alert.isSecondYellow && (
                  <span className="w-4 h-6 rounded-sm bg-amber-400 border border-white/40 shadow" />
                )}
                <span
                  className={`w-5 h-7 rounded-sm border border-white/50 shadow-lg ${
                    alert.color === 'red' ? 'bg-rose-500' : 'bg-amber-400'
                  }`}
                />
              </div>
              <div>
                <div className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                  <ClubCrest club={teams[alert.teamIdx].club} size={18} />
                  {alert.isSecondYellow
                    ? '2nd Yellow → RED CARD!'
                    : alert.color === 'red'
                      ? 'STRAIGHT RED CARD!'
                      : 'YELLOW CARD'}
                </div>
                <div className="text-[11px] font-bold text-slate-200">
                  {alert.playerName} ({teams[alert.teamIdx].club.code})
                </div>
              </div>
            </div>
          );
        })()}

        {/* Live Tactical 2D Radar Minimap */}
        {showRadar &&
          snapshot.period !== 'walkout' &&
          snapshot.period !== 'fulltime' && (
            <div className="hidden sm:block absolute bottom-4 right-4 w-44 h-28 rounded-xl bg-emerald-950/88 backdrop-blur-md border border-cyan-400/40 p-1.5 shadow-2xl pointer-events-none">
              <svg viewBox="0 0 100 66" className="w-full h-full">
                <rect
                  x="1"
                  y="1"
                  width="98"
                  height="64"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="0.9"
                />
                <line
                  x1="50"
                  y1="1"
                  x2="50"
                  y2="65"
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth="0.8"
                />
                <circle
                  cx="50"
                  cy="33"
                  r="9"
                  fill="none"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="0.8"
                />
                {snapshot.playerHeatmaps.map((pl) => (
                  <circle
                    key={pl.id}
                    cx={pl.x}
                    cy={(pl.y / 100) * 66}
                    r="2.1"
                    fill={teams[pl.teamIdx].club.primary}
                    stroke="#020617"
                    strokeWidth="0.55"
                  />
                ))}
                <circle
                  cx={snapshot.ballPos.x}
                  cy={(snapshot.ballPos.y / 100) * 66}
                  r="2.4"
                  fill="#facc15"
                  stroke="#ffffff"
                  strokeWidth="0.8"
                />
              </svg>
            </div>
          )}

        {/* Full-Time Broadcast Summary Banner Overlay */}
        {snapshot.period === 'fulltime' && (
          <div className="absolute inset-0 bg-slate-950/82 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center justify-center gap-4 text-center">
            <div className="text-xs uppercase font-black tracking-[0.25em] text-amber-300">
              Full-Time • {stadium.name}
            </div>
            <div className="flex items-center gap-5">
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <ClubCrest club={teams[0].club} size={56} />
                  <JerseyPreview club={teams[0].club} size={46} number={10} />
                </div>
                <span className="font-black text-white text-sm">
                  {teams[0].club.name}
                </span>
              </div>
              <div className="px-6 py-3 rounded-2xl bg-slate-900 border border-cyan-400/40 text-4xl md:text-5xl font-black text-white">
                {snapshot.stats[0].goals} - {snapshot.stats[1].goals}
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="flex items-center gap-2">
                  <JerseyPreview club={teams[1].club} size={46} number={7} />
                  <ClubCrest club={teams[1].club} size={56} />
                </div>
                <span className="font-black text-white text-sm">
                  {teams[1].club.name}
                </span>
              </div>
            </div>
            {snapshot.penalties.length > 0 && (
              <div className="text-sm font-black text-cyan-300">
                Penalties: {teams[0].club.code} {snapshot.penaltyScore[0]} -{' '}
                {snapshot.penaltyScore[1]} {teams[1].club.code}
              </div>
            )}
            <div className="flex flex-wrap justify-center gap-3 mt-1">
              <button
                type="button"
                onClick={onNewTournament}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-950 font-black text-xs uppercase shadow-lg cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Return to Lobby
              </button>
              <button
                type="button"
                onClick={onRematch}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Rematch
              </button>
            </div>
          </div>
        )}

        {/* Half-Time Overlay */}
        {snapshot.period === 'halftime' && (
          <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-4 p-6">
            <div className="text-xs uppercase tracking-widest text-cyan-400 font-black">
              Half-Time Interval
            </div>
            <div className="text-3xl font-black text-white">
              {teams[0].club.code} {snapshot.stats[0].goals} -{' '}
              {snapshot.stats[1].goals} {teams[1].club.code}
            </div>
            <button
              type="button"
              onClick={() => {
                engine.resumeSecondHalf();
                syncSnapshot();
              }}
              className="px-7 py-3 rounded-2xl bg-cyan-400 text-slate-950 font-black text-sm uppercase cursor-pointer"
            >
              Start Second Half →
            </button>
          </div>
        )}

        {/* Penalty Shootout Live Tracker */}
        {snapshot.period === 'penalties' && (
          <div className="absolute bottom-4 left-4 right-4 ucl-glass rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="font-black text-amber-300 text-sm">
              PENALTY SHOOTOUT: {teams[0].club.code} {snapshot.penaltyScore[0]}{' '}
              - {snapshot.penaltyScore[1]} {teams[1].club.code}
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {snapshot.penalties.map((pk, idx) => (
                <span
                  key={idx}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                    pk.scored
                      ? 'bg-emerald-500/25 text-emerald-300'
                      : 'bg-rose-500/25 text-rose-300'
                  }`}
                >
                  {teams[pk.teamIdx].club.code} {pk.scored ? '✓' : '✕'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Camera Director Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 ucl-glass rounded-2xl px-4 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            Camera Director:
          </span>
          {CAMERAS.map((cam) => (
            <button
              key={cam.id}
              type="button"
              onClick={() => setCameraMode(cam.id)}
              className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                cameraMode === cam.id
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {cam.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowRadar((r) => !r)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
              showRadar
                ? 'bg-emerald-500/25 border border-emerald-400/40 text-emerald-200'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            {showRadar ? 'Radar ON' : 'Radar OFF'}
          </button>
          <button
            type="button"
            onClick={() => setShowTacticsDrawer((d) => !d)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer ${
              showTacticsDrawer
                ? 'bg-amber-400 text-slate-950 font-black'
                : 'bg-slate-800 text-amber-300 hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            Live Bench &amp; Ratings
          </button>
        </div>

        {/* Scrolling Live Ticker */}
        <div className="overflow-hidden whitespace-nowrap max-w-md text-xs text-cyan-300 font-semibold">
          {snapshot.events[0]?.text ?? 'Matchday live in 3D WebGL'}
        </div>
      </div>

      {/* Live Tactics, Substitutions (3/3) & Player Ratings Drawer */}
      {showTacticsDrawer && (
        <div className="ucl-glass rounded-2xl p-4 grid grid-cols-1 lg:grid-cols-2 gap-4 border-amber-400/35">
          {([0, 1] as const).map((idx) => {
            const teamPlayers = snapshot.playerHeatmaps.filter((p) => p.teamIdx === idx);
            const bench = engine.teams[idx].bench ?? [];
            const activeMentality = snapshot.mentalities[idx];
            return (
              <div key={idx} className="rounded-xl bg-slate-900/90 border border-slate-700 p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-black text-sm text-white flex items-center gap-2">
                    <ClubCrest club={teams[idx].club} size={24} />
                    {teams[idx].club.code} Bench &amp; Tactics (Subs: {snapshot.subsUsed[idx]}/3)
                  </div>
                  <div className="flex gap-1">
                    {(['High Press', 'Balanced', 'Counter-Attack', 'Park the Bus'] as TacticalMentality[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          engine.setMentality(idx, m);
                          syncSnapshot();
                        }}
                        className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer ${
                          activeMentality === m
                            ? 'bg-cyan-400 text-slate-950'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {m.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {snapshot.subsUsed[idx] < 3 && bench.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 bg-slate-950/75 rounded-lg p-2">
                    <select
                      value={subOutId[idx]}
                      onChange={(e) => {
                        const next: [string, string] = [...subOutId] as [string, string];
                        next[idx] = e.target.value;
                        setSubOutId(next);
                      }}
                      className="rounded bg-slate-900 border border-slate-700 px-2 py-1 text-[11px] text-white"
                    >
                      {teamPlayers
                        .filter((p) => !p.redCard)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            Off: #{p.squadNumber} {p.name} ({Math.round(p.stamina)}% Stam)
                          </option>
                        ))}
                    </select>
                    <div className="flex flex-wrap gap-1">
                      {bench.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            engine.makeSubstitution(idx, subOutId[idx] || teamPlayers[9]?.id, b);
                            syncSnapshot();
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold cursor-pointer"
                        >
                          + {b.name} ({b.ovr})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                  {teamPlayers.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg bg-slate-950/80 px-2 py-1.5 text-[11px] flex items-center justify-between gap-1"
                    >
                      <div className="truncate">
                        <div className="font-bold text-white truncate">
                          {p.squadNumber}. {p.name.split(' ').slice(-1)[0]}
                        </div>
                        <div className="w-16 h-1 rounded bg-slate-800 mt-0.5 overflow-hidden">
                          <div
                            className={`h-full ${
                              p.stamina > 70
                                ? 'bg-emerald-400'
                                : p.stamina > 50
                                ? 'bg-amber-400'
                                : 'bg-rose-400'
                            }`}
                            style={{ width: `${Math.round(p.stamina)}%` }}
                          />
                        </div>
                      </div>
                      <span className="font-black text-cyan-300 shrink-0">
                        {p.rating.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Telemetry + Commentary Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Match Telemetry */}
        <div className="lg:col-span-5 ucl-glass rounded-2xl p-4 space-y-2.5">
          <div className="text-xs uppercase font-black tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Live Match Telemetry
          </div>
          {[
            ['Possession %', `${poss[0]}%`, `${poss[1]}%`],
            [
              'Expected Goals (xG)',
              snapshot.stats[0].xg.toFixed(2),
              snapshot.stats[1].xg.toFixed(2),
            ],
            [
              'Shots (On Target)',
              `${snapshot.stats[0].shots} (${snapshot.stats[0].shotsOnTarget})`,
              `${snapshot.stats[1].shots} (${snapshot.stats[1].shotsOnTarget})`,
            ],
            [
              'Goalkeeper Saves',
              `${snapshot.stats[0].saves}`,
              `${snapshot.stats[1].saves}`,
            ],
            [
              'Passes Completed',
              `${snapshot.stats[0].passesCompleted}/${snapshot.stats[0].passes}`,
              `${snapshot.stats[1].passesCompleted}/${snapshot.stats[1].passes}`,
            ],
            [
              'Corners / Throw-Ins',
              `${snapshot.stats[0].corners} / ${snapshot.stats[0].throwIns}`,
              `${snapshot.stats[1].corners} / ${snapshot.stats[1].throwIns}`,
            ],
            [
              'Free Kicks / Pens',
              `${snapshot.stats[0].freeKicks} / ${snapshot.stats[0].penaltiesAwarded}`,
              `${snapshot.stats[1].freeKicks} / ${snapshot.stats[1].penaltiesAwarded}`,
            ],
            [
              'Tackles / Fouls',
              `${snapshot.stats[0].tackles} / ${snapshot.stats[0].fouls}`,
              `${snapshot.stats[1].tackles} / ${snapshot.stats[1].fouls}`,
            ],
            [
              'Yellow / Red Cards',
              `${snapshot.stats[0].yellowCards}Y ${snapshot.stats[0].redCards}R`,
              `${snapshot.stats[1].yellowCards}Y ${snapshot.stats[1].redCards}R`,
            ],
          ].map(([label, v0, v1]) => (
            <div
              key={label}
              className="flex items-center justify-between text-xs bg-slate-900/80 rounded-lg px-3 py-2"
            >
              <span className="font-black text-white">{v0}</span>
              <span className="text-slate-400">{label}</span>
              <span className="font-black text-white">{v1}</span>
            </div>
          ))}
        </div>

        {/* Live Commentary Feed */}
        <div className="lg:col-span-7 ucl-glass rounded-2xl p-4 space-y-2">
          <div className="text-xs uppercase font-black tracking-wider text-cyan-400">
            Live Play-by-Play Commentary Log
          </div>
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
            {snapshot.events.map((ev) => (
              <div
                key={ev.id}
                className={`text-xs rounded-lg px-3 py-2 flex items-start gap-2 ${
                  ev.type === 'goal'
                    ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 font-bold'
                    : ev.type === 'red_card'
                    ? 'bg-rose-500/20 border border-rose-400/40 text-rose-100'
                    : ev.type === 'yellow_card'
                    ? 'bg-amber-500/15 border border-amber-400/30 text-amber-100'
                    : 'bg-slate-900/80 text-slate-200'
                }`}
              >
                <span className="font-mono text-cyan-400 shrink-0">
                  {ev.minute}&apos;
                </span>
                <span>{ev.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Post-Match Analytics: MotM, Heatmap, Pass Network & Trophy Save */}
      {snapshot.period === 'fulltime' && (
        <div className="ucl-glass rounded-2xl p-6 space-y-5 border-amber-400/40">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-amber-400" />
              <div>
                <div className="text-xs uppercase font-black tracking-widest text-amber-300">
                  Full-Time Verdict & Post-Match Analytics
                </div>
                <h3 className="text-2xl font-black text-white">
                  {snapshot.winnerIdx === 'draw'
                    ? 'UCL Classic Ends All Square!'
                    : `${teams[snapshot.winnerIdx ?? 0].club.name} Triumphs at ${stadium.name}!`}
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleCopyMatchReport}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-200 font-bold text-xs uppercase cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                {copiedReport ? 'Report Copied ✓' : 'Copy Match Report'}
              </button>
              <button
                type="button"
                onClick={handleSaveTrophy}
                disabled={savedTrophy}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs uppercase cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {savedTrophy ? 'Saved to Trophy Cabinet ✓' : 'Save to Trophy Cabinet'}
              </button>
              <button
                type="button"
                onClick={onRematch}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Rematch (Same XIs)
              </button>
              <button
                type="button"
                onClick={onNewTournament}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Return to Lobby
              </button>
            </div>
          </div>

          {/* Complete Full-Time Side-by-Side Stats Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl bg-slate-900/90 border border-slate-700 p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-black text-cyan-300 pb-1 border-b border-slate-800">
                <span>{teams[0].club.name}</span>
                <span className="text-slate-400">FULL-TIME MATCH STATS</span>
                <span>{teams[1].club.name}</span>
              </div>
              {[
                ['Goals', snapshot.stats[0].goals, snapshot.stats[1].goals],
                ['Expected Goals (xG)', Number(snapshot.stats[0].xg.toFixed(2)), Number(snapshot.stats[1].xg.toFixed(2))],
                ['Possession %', poss[0], poss[1]],
                ['Total Shots', snapshot.stats[0].shots, snapshot.stats[1].shots],
                ['Shots on Target', snapshot.stats[0].shotsOnTarget, snapshot.stats[1].shotsOnTarget],
                ['Goalkeeper Saves', snapshot.stats[0].saves, snapshot.stats[1].saves],
                ['Corners', snapshot.stats[0].corners, snapshot.stats[1].corners],
                ['Fouls Committed', snapshot.stats[0].fouls, snapshot.stats[1].fouls],
                ['Yellow Cards', snapshot.stats[0].yellowCards, snapshot.stats[1].yellowCards],
                ['Red Cards', snapshot.stats[0].redCards, snapshot.stats[1].redCards],
              ].map(([label, a, b]) => {
                const n0 = Number(a);
                const n1 = Number(b);
                const sum = Math.max(0.01, n0 + n1);
                const w0 = Math.round((n0 / sum) * 100);
                return (
                  <div key={String(label)} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-black text-white">{a}</span>
                      <span className="text-slate-400">{label}</span>
                      <span className="font-black text-white">{b}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden flex">
                      <div
                        className="h-full"
                        style={{ width: `${w0}%`, backgroundColor: teams[0].club.primary }}
                      />
                      <div
                        className="h-full flex-1"
                        style={{ backgroundColor: teams[1].club.primary }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl bg-slate-900/90 border border-slate-700 p-4 space-y-2.5">
              <div className="text-xs font-black text-cyan-300 pb-1 border-b border-slate-800">
                GOAL SCORERS &amp; KEY DISCIPLINE
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1.5">
                {snapshot.events.filter(
                  (e) => e.type === 'goal' || e.type === 'yellow_card' || e.type === 'red_card'
                ).length === 0 ? (
                  <div className="text-xs text-slate-400 py-4 text-center">
                    Goalless defensive masterclass with zero cards.
                  </div>
                ) : (
                  snapshot.events
                    .filter(
                      (e) =>
                        e.type === 'goal' ||
                        e.type === 'yellow_card' ||
                        e.type === 'red_card'
                    )
                    .slice()
                    .reverse()
                    .map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between text-xs bg-slate-950/80 rounded-lg px-3 py-2"
                      >
                        <span className="font-bold text-white">
                          {ev.type === 'goal'
                            ? '⚽'
                            : ev.type === 'yellow_card'
                            ? '🟨'
                            : '🟥'}{' '}
                          {ev.playerName ?? teams[ev.teamIdx].club.code}
                          {ev.assistName ? ` (ast. ${ev.assistName})` : ''}
                        </span>
                        <span className="font-mono text-cyan-400">
                          {ev.minute}&apos; ({teams[ev.teamIdx].club.code})
                        </span>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Man of the Match */}
            {motm && (
              <div className="rounded-xl bg-slate-900/90 border border-amber-400/30 p-4 flex items-center gap-3">
                <PlayerPortrait
                  player={motm.player}
                  kitColor={teams[motm.teamIdx].club.primary}
                  size={64}
                />
                <div>
                  <div className="text-[11px] uppercase font-black text-amber-300 flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" /> Man of the Match
                  </div>
                  <div className="text-lg font-black text-white">
                    {motm.player.name}
                  </div>
                  <div className="text-xs text-slate-300">
                    Rating{' '}
                    <span className="text-amber-300 font-black">
                      {motm.rating.toFixed(1)}
                    </span>{' '}
                    • {motm.goals}G {motm.assists}A
                  </div>
                </div>
              </div>
            )}

            {/* Player Heatmap */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-700 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-cyan-300">
                  Player Heatmap
                </span>
                <select
                  value={heatmapPlayerId}
                  onChange={(e) => setHeatmapPlayerId(e.target.value)}
                  className="rounded bg-slate-950 border border-slate-700 px-2 py-1 text-[11px] text-white max-w-[160px]"
                >
                  {snapshot.playerHeatmaps.map((p) => (
                    <option key={p.id} value={p.id}>
                      {teams[p.teamIdx].club.code}: {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <svg
                viewBox="0 0 100 66"
                className="w-full h-28 rounded-lg bg-emerald-950 border border-emerald-500/30"
              >
                <rect x="2" y="2" width="96" height="62" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                <line x1="50" y1="2" x2="50" y2="64" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                {heatmapPlayer?.heatmap.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x}
                    cy={(pt.y / 100) * 66}
                    r="4.2"
                    fill="#f97316"
                    opacity="0.22"
                  />
                ))}
              </svg>
            </div>

            {/* Pass Network */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-700 p-4 space-y-2">
              <div className="text-xs font-bold text-cyan-300">
                Top Passing Connections ({teams[0].club.code} &amp;{' '}
                {teams[1].club.code})
              </div>
              <svg
                viewBox="0 0 100 66"
                className="w-full h-28 rounded-lg bg-slate-950 border border-slate-700"
              >
                {snapshot.topPassLinks.map((link, idx) => (
                  <line
                    key={idx}
                    x1={link.fromX}
                    y1={(link.fromY / 100) * 66}
                    x2={link.toX}
                    y2={(link.toY / 100) * 66}
                    stroke={teams[link.teamIdx].club.primary}
                    strokeWidth={Math.min(3, 0.7 + link.count * 0.4)}
                    opacity="0.65"
                  />
                ))}
              </svg>
            </div>
          </div>

          {/* Interactive xG Shot Map (2D Pitch Plot) */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-700 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-cyan-300">
                xG Shot Map ({snapshot.shotsLog.length} Total Shots)
              </span>
              <div className="flex items-center gap-3 text-[11px] text-slate-300">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> Goal
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Saved
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" /> Woodwork
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block" /> Off Target
                </span>
              </div>
            </div>
            <svg
              viewBox="0 0 100 44"
              className="w-full h-36 rounded-xl bg-emerald-950 border border-emerald-500/30"
            >
              <rect x="2" y="2" width="96" height="40" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" />
              <line x1="50" y1="2" x2="50" y2="42" stroke="rgba(255,255,255,0.25)" strokeWidth="0.6" />
              <rect x="2" y="10" width="14" height="24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
              <rect x="84" y="10" width="14" height="24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
              {snapshot.shotsLog.map((s, idx) => (
                <circle
                  key={idx}
                  cx={s.x}
                  cy={(s.y / 100) * 44}
                  r={1.4 + s.xg * 4.5}
                  fill={
                    s.outcome === 'goal'
                      ? '#facc15'
                      : s.outcome === 'save'
                      ? '#22d3ee'
                      : s.outcome === 'woodwork'
                      ? '#fb7185'
                      : '#94a3b8'
                  }
                  opacity={s.outcome === 'goal' ? 0.95 : 0.65}
                  stroke="#020617"
                  strokeWidth="0.4"
                >
                  <title>{`${s.minute}' ${s.shooterName} (${teams[s.teamIdx].club.code}) — ${s.outcome.toUpperCase()} (${s.xg.toFixed(2)} xG)`}</title>
                </circle>
              ))}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};
