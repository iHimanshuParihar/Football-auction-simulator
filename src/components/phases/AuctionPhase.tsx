'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FastForward,
  Lock,
  Pause,
  Play,
  ShieldCheck,
  SkipForward,
  Timer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  AuctionState,
  ClubPreset,
  Position,
  TeamSetup,
} from '@/types/game';
import {
  canTeamBidOnPlayer,
  computeAIBidDecision,
  computeTeamAverageOvr,
  countPositions,
  getEffectiveBasePrice,
} from '@/lib/auction-engine';
import { CLUB_PRESETS } from '@/data/clubs';
import { POSITION_QUOTAS } from '@/data/players';
import { ClubCrest } from '@/components/ui/ClubCrest';
import { JerseyPreview } from '@/components/ui/JerseyPreview';
import { PlayerPortrait } from '@/components/ui/PlayerPortrait';
import { RadarChart } from '@/components/ui/RadarChart';
import { TurntablePlayer3D } from '@/components/three/TurntablePlayer3D';
import { audioEngine } from '@/lib/audio-engine';

interface AuctionPhaseProps {
  auction: AuctionState;
  teams: [TeamSetup, TeamSetup];
  bidTimerSeconds: 5 | 10;
  roomCode?: string;
  isOnline?: boolean;
  isAiOpponent?: boolean;
  onBid: (teamIdx: 0 | 1, amount: number) => string | undefined;
  onHammer: () => void;
  onSkip: () => void;
  onRtmDecision: (exercise: boolean) => void;
  onSealedBid: (teamIdx: 0 | 1, amount: number) => string | undefined;
  onAutoComplete: () => void;
  onProceedToTactics: () => void;
}

const POSITIONS: Position[] = ['GK', 'DEF', 'MID', 'FWD'];

interface LotCountdownTimerProps {
  durationSeconds: number;
  paused: boolean;
  hasHighestBidder: boolean;
  highestBidderCode?: string;
  onExpire: () => void;
}

const LotCountdownTimer: React.FC<LotCountdownTimerProps> = ({
  durationSeconds,
  paused,
  hasHighestBidder,
  highestBidderCode,
  onExpire,
}) => {
  const [msLeft, setMsLeft] = useState(durationSeconds * 1000);
  const expiredRef = useRef(false);
  const lastSecRef = useRef(durationSeconds);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setMsLeft((prev) => {
        const next = Math.max(0, prev - 100);
        const sec = Math.ceil(next / 1000);
        if (sec !== lastSecRef.current && sec <= 3 && sec > 0) {
          lastSecRef.current = sec;
          audioEngine.playSFX('tick');
        }
        if (next === 0 && !expiredRef.current) {
          expiredRef.current = true;
          queueMicrotask(() => {
            audioEngine.playSFX('gavel');
            onExpireRef.current();
          });
        }
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [paused]);

  const pct = (msLeft / (durationSeconds * 1000)) * 100;
  const secStr = (msLeft / 1000).toFixed(1);
  const urgent = msLeft <= 3000;

  return (
    <div className="rounded-xl bg-slate-950/85 border border-slate-700/80 p-3 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-bold text-slate-300">
          <Timer className={`w-4 h-4 ${urgent ? 'text-rose-400 animate-pulse' : 'text-cyan-400'}`} />
          {paused
            ? 'Timer Paused'
            : hasHighestBidder
            ? `Going to ${highestBidderCode} in`
            : 'No Bids — Auto-Pass in'}
        </span>
        <span
          className={`font-mono font-black text-base ${
            urgent ? 'text-rose-400' : 'text-cyan-300'
          }`}
        >
          {secStr}s
        </span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ${
            urgent
              ? 'bg-gradient-to-r from-rose-500 to-amber-400'
              : 'bg-gradient-to-r from-cyan-400 to-indigo-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

export const AuctionPhase: React.FC<AuctionPhaseProps> = ({
  auction,
  teams,
  bidTimerSeconds,
  roomCode,
  isOnline,
  isAiOpponent = false,
  onBid,
  onHammer,
  onSkip,
  onRtmDecision,
  onSealedBid,
  onAutoComplete,
  onProceedToTactics,
}) => {
  const [customBids, setCustomBids] = useState<[string, string]>(['', '']);
  const [sealedInputs, setSealedInputs] = useState<[string, string]>(['', '']);
  const [errors, setErrors] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [muted, setMuted] = useState(audioEngine.sfxMuted);
  const [timerPaused, setTimerPaused] = useState(false);

  const lot = auction.currentLot;
  const effectiveBase = lot ? getEffectiveBasePrice(lot, auction.round) : 0;
  const bothReady =
    teams[0].squad.length === 11 && teams[1].squad.length === 11;

  // Match player's origin club to a ClubPreset for displaying real club logo/badge
  const originClubPreset: ClubPreset = useMemo(() => {
    if (!lot) return CLUB_PRESETS[0];
    const match = CLUB_PRESETS.find(
      (c) => c.name.toLowerCase() === lot.club.toLowerCase()
    );
    return (
      match ?? {
        id: 'origin_fallback',
        name: lot.club,
        code: lot.club.slice(0, 3).toUpperCase(),
        primary: '#1d4ed8',
        secondary: '#0f172a',
        accent: '#38bdf8',
        pattern: 'solid',
        stadium: 'etihad',
        city: 'Europe',
        crestShape: 'shield',
        crestMotif: 'star',
      }
    );
  }, [lot]);

  const toggleMute = () => {
    audioEngine.sfxMuted = !audioEngine.sfxMuted;
    setMuted(audioEngine.sfxMuted);
  };

  const triggerBid = (teamIdx: 0 | 1, amount: number) => {
    const err = onBid(teamIdx, amount);
    const next: [string | null, string | null] = [...errors] as [
      string | null,
      string | null
    ];
    next[teamIdx] = err ?? null;
    setErrors(next);
    if (!err) audioEngine.playSFX('bid');
  };

  // Timer key resets automatically on new lot OR any new bid
  const timerKey = `${lot?.id ?? 'none'}_${auction.round}_${auction.currentBid}_${auction.highestBidder ?? 'none'}`;
  const isModalBlocking =
    auction.rtmPending.active ||
    (auction.sealedBid.active && !auction.sealedBid.resolved);

  // AI CPU Transfer Director auto-bidding for Manager 2 when vs_ai mode is active
  useEffect(() => {
    if (!isAiOpponent || auction.completed || timerPaused) return;
    if (auction.rtmPending.active && auction.rtmPending.eligibleTeamIdx === 1) {
      const t = setTimeout(() => {
        const shouldUse = (auction.rtmPending.lot?.ovr ?? 0) >= 88;
        audioEngine.playSFX('gavel');
        onRtmDecision(shouldUse);
      }, 1100);
      return () => clearTimeout(t);
    }
    if (auction.sealedBid.active && !auction.sealedBid.resolved && auction.sealedBid.bids[1] === null && auction.sealedBid.lot) {
      const sbLot = auction.sealedBid.lot;
      const t = setTimeout(() => {
        const base = getEffectiveBasePrice(sbLot, auction.round);
        const aiMax = Math.min(teams[1].purse, base + 25);
        if (aiMax >= base) {
          onSealedBid(1, aiMax);
          audioEngine.playSFX('bid');
        }
      }, 1050);
      return () => clearTimeout(t);
    }
    const decision = computeAIBidDecision(auction, teams, 1);
    if (!decision.shouldBid) return;
    const t = setTimeout(() => {
      const err = onBid(1, decision.amount);
      if (!err) audioEngine.playSFX('bid');
    }, 1150);
    return () => clearTimeout(t);
  }, [isAiOpponent, auction, teams, timerPaused, onBid, onRtmDecision, onSealedBid]);

  // Dual-console keyboard shortcuts (Q/W/E/R for M1, U/I/O/P for M2, Space to Pause/Resume)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (!lot || auction.completed || isModalBlocking) return;

      const k = e.key.toLowerCase();
      if (k === ' ') {
        e.preventDefault();
        setTimerPaused((p) => !p);
        return;
      }
      const nextBase = auction.highestBidder === null ? effectiveBase : auction.currentBid + 5;
      const map: Record<string, [0 | 1, number]> = {
        q: [0, nextBase],
        w: [0, auction.currentBid + 15],
        e: [0, auction.currentBid + 30],
        r: [0, teams[0].purse],
        u: [1, nextBase],
        i: [1, auction.currentBid + 15],
        o: [1, auction.currentBid + 30],
        p: [1, teams[1].purse],
      };
      const action = map[k];
      if (action && !(action[0] === 1 && isAiOpponent)) {
        const err = onBid(action[0], action[1]);
        if (!err) audioEngine.playSFX('bid');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lot, auction, teams, effectiveBase, isModalBlocking, isAiOpponent, onBid]);

  const renderTeamConsole = (teamIdx: 0 | 1) => {
    const team = teams[teamIdx];
    const counts = countPositions(team.squad);
    const isHolding = auction.highestBidder === teamIdx;
    const minNext =
      auction.highestBidder === null ? effectiveBase : auction.currentBid + 1;
    const baseOpen =
      auction.highestBidder === null ? effectiveBase : auction.currentBid + 5;

    const canBidBase = lot
      ? canTeamBidOnPlayer(team, lot, minNext).ok && !isHolding
      : false;

    return (
      <div
        className={`ucl-glass rounded-2xl p-4 flex flex-col gap-3 transition ${
          isHolding ? 'ring-2 ring-cyan-400 shadow-cyan-500/20' : ''
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <ClubCrest club={team.club} size={46} />
            <JerseyPreview club={team.club} size={40} number={teamIdx === 0 ? 10 : 7} />
            <div>
              <div className="text-xs text-slate-400 font-semibold">
                {team.managerName}
              </div>
              <div className="font-black text-white text-base flex items-center gap-2">
                {team.club.name}
                {team.rtmAvailable && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-[10px] text-amber-300 font-bold">
                    1 RTM
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-slate-400">
              Purse • Avg {computeTeamAverageOvr(team.squad) || '--'}
            </div>
            <div className="text-xl font-black text-emerald-400">
              €{team.purse}M
            </div>
          </div>
        </div>

        {/* Strict 1-4-3-3 Positional Quotas */}
        <div className="grid grid-cols-5 gap-1.5 text-center">
          <div className="rounded-lg bg-slate-900/90 py-1.5 border border-slate-800">
            <div className="text-[10px] text-slate-400">XI</div>
            <div className="text-xs font-black text-white">
              {team.squad.length}/11
            </div>
          </div>
          {POSITIONS.map((pos) => {
            const full = counts[pos] >= POSITION_QUOTAS[pos];
            const highlight = lot?.pos === pos && !full;
            return (
              <div
                key={pos}
                className={`rounded-lg py-1.5 border ${
                  full
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : highlight
                    ? 'bg-cyan-950/50 border-cyan-400/50 text-cyan-200'
                    : 'bg-slate-900/90 border-slate-800 text-slate-300'
                }`}
              >
                <div className="text-[10px]">{pos}</div>
                <div className="text-xs font-black">
                  {counts[pos]}/{POSITION_QUOTAS[pos]}
                </div>
              </div>
            );
          })}
        </div>

        {/* Simultaneous Uncapped Bidding Pad */}
        {lot && !auction.completed && !auction.sealedBid.active && (
          <div className="space-y-2">
            <div className="grid grid-cols-4 gap-1.5">
              <button
                type="button"
                disabled={!canBidBase || (teamIdx === 1 && isAiOpponent)}
                onClick={() =>
                  triggerBid(
                    teamIdx,
                    auction.highestBidder === null
                      ? effectiveBase
                      : auction.currentBid + 5
                  )
                }
                className="py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-35 text-slate-950 font-black text-xs transition cursor-pointer"
              >
                {auction.highestBidder === null ? `€${effectiveBase}M` : '+€5M'}{' '}
                <span className="opacity-65 text-[10px]">
                  [{teamIdx === 0 ? 'Q' : 'U'}]
                </span>
              </button>
              <button
                type="button"
                disabled={
                  (teamIdx === 1 && isAiOpponent) ||
                  isHolding ||
                  !canTeamBidOnPlayer(team, lot, baseOpen + 10).ok
                }
                onClick={() => triggerBid(teamIdx, auction.currentBid + 15)}
                className="py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-35 text-white font-black text-xs transition cursor-pointer"
              >
                +€15M{' '}
                <span className="opacity-70 text-[10px]">
                  [{teamIdx === 0 ? 'W' : 'I'}]
                </span>
              </button>
              <button
                type="button"
                disabled={
                  (teamIdx === 1 && isAiOpponent) ||
                  isHolding ||
                  !canTeamBidOnPlayer(team, lot, auction.currentBid + 30).ok
                }
                onClick={() => triggerBid(teamIdx, auction.currentBid + 30)}
                className="py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-35 text-white font-black text-xs transition cursor-pointer"
              >
                +€30M{' '}
                <span className="opacity-70 text-[10px]">
                  [{teamIdx === 0 ? 'E' : 'O'}]
                </span>
              </button>
              <button
                type="button"
                disabled={
                  (teamIdx === 1 && isAiOpponent) ||
                  !canBidBase ||
                  team.purse < minNext
                }
                onClick={() => triggerBid(teamIdx, team.purse)}
                className="py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-35 text-white font-black text-xs transition cursor-pointer"
              >
                ALL-IN{' '}
                <span className="opacity-70 text-[10px]">
                  [{teamIdx === 0 ? 'R' : 'P'}]
                </span>
              </button>
            </div>

            <div className="flex gap-1.5">
              <input
                type="number"
                min={minNext}
                max={team.purse}
                placeholder={`Custom €${minNext}M+`}
                value={customBids[teamIdx]}
                onChange={(e) => {
                  const next: [string, string] = [...customBids] as [
                    string,
                    string
                  ];
                  next[teamIdx] = e.target.value;
                  setCustomBids(next);
                }}
                className="flex-1 rounded-xl bg-slate-900 border border-slate-700 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={() => {
                  const amt = Number(customBids[teamIdx]);
                  if (amt > 0) triggerBid(teamIdx, amt);
                }}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white"
              >
                Bid €M
              </button>
            </div>

            {errors[teamIdx] && (
              <div className="text-[11px] text-rose-400 font-semibold">
                {errors[teamIdx]}
              </div>
            )}
          </div>
        )}

        {/* Signed Squad List */}
        <div className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-2.5 max-h-56 overflow-y-auto space-y-1.5">
          <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
            Signed Squad
          </div>
          {team.squad.length === 0 ? (
            <div className="text-xs text-slate-500 py-3 text-center">
              No signings yet
            </div>
          ) : (
            team.squad.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-xs bg-slate-900/90 rounded-lg px-2.5 py-1.5"
              >
                <div className="flex items-center gap-2 truncate pr-2">
                  <PlayerPortrait player={p} kitColor={team.club.primary} size={24} />
                  <JerseyPreview club={team.club} size={22} number={p.squadNumber} />
                  <span className="text-cyan-400 font-bold">
                    {p.role}
                  </span>
                  <span className="text-white font-semibold truncate">{p.name}</span>
                  {p.isReserve && (
                    <span className="text-[10px] text-amber-300">(Acad)</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-slate-300 font-bold">{p.ovr}</span>
                  <span className="text-emerald-400 font-bold">
                    €{p.paidPrice}M
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-5 space-y-4">
      {/* Top Status Bar */}
      <div className="ucl-glass rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/40 text-cyan-300 text-xs font-black">
            ROUND {auction.round}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-black">
            {bidTimerSeconds}s TIMER
          </span>
          <span className="text-xs text-slate-300 font-semibold">
            Lot #{auction.lotIndex} • Pool Left: {auction.pool.length} •
            Re-Queue: {auction.unsoldQueue.length}
          </span>
          {isOnline && roomCode && (
            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-200 text-xs font-mono font-bold">
              ROOM: {roomCode}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200"
            title="Toggle SFX Audio"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400" />
            )}
          </button>

          {!bothReady && (
            <button
              type="button"
              onClick={() => {
                audioEngine.playSFX('gavel');
                onAutoComplete();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-200 text-xs font-bold cursor-pointer"
            >
              <FastForward className="w-3.5 h-3.5" />
              Two-Pass Auto-Complete
            </button>
          )}

          {bothReady && (
            <button
              type="button"
              onClick={onProceedToTactics}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 text-xs font-black uppercase cursor-pointer"
            >
              Proceed to Tactical Whiteboard →
            </button>
          )}
        </div>
      </div>

      {/* Main 3-Column Auction Floor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-4">{renderTeamConsole(0)}</div>

        {/* Center Auction Stage */}
        <div className="lg:col-span-4 ucl-glass rounded-2xl p-4 space-y-3">
          {lot && !auction.completed ? (
            <>
              {/* Player Portrait + Club Logo/Badge + OVR */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <PlayerPortrait
                    player={lot}
                    kitColor={
                      auction.highestBidder !== null
                        ? teams[auction.highestBidder].club.primary
                        : originClubPreset.primary
                    }
                    size={58}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-cyan-400 font-bold">
                      <span>{lot.era === 'icon' ? '★ Prime Icon' : 'Modern Star'}</span>
                      <span>•</span>
                      <span className="truncate">{lot.club}</span>
                    </div>
                    <h2 className="text-lg font-black text-white truncate">
                      {lot.flag} {lot.name}
                    </h2>
                    <div className="text-[11px] text-slate-400">
                      {lot.nationality} • {lot.role} ({lot.pos})
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <ClubCrest club={originClubPreset} size={38} />
                  <JerseyPreview
                    club={
                      auction.highestBidder !== null
                        ? teams[auction.highestBidder].club
                        : originClubPreset
                    }
                    size={42}
                    number={lot.pos === 'GK' ? 1 : 10}
                    playerName={lot.name}
                  />
                  <div className="px-2.5 py-1.5 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-500 text-slate-950 font-black text-lg">
                    {lot.ovr}
                  </div>
                </div>
              </div>

              {/* 3D Turntable with Holographic Club Badge */}
              <TurntablePlayer3D
                player={lot}
                club={
                  auction.highestBidder !== null
                    ? teams[auction.highestBidder].club
                    : originClubPreset
                }
              />

              {/* Auto-Sell Countdown Timer (5s or 10s, last bid wins when timer ends) */}
              <LotCountdownTimer
                key={timerKey}
                durationSeconds={bidTimerSeconds}
                paused={timerPaused || isModalBlocking}
                hasHighestBidder={auction.highestBidder !== null}
                highestBidderCode={
                  auction.highestBidder !== null
                    ? teams[auction.highestBidder].club.code
                    : undefined
                }
                onExpire={() => {
                  if (auction.highestBidder !== null) {
                    onHammer();
                  } else {
                    onSkip();
                  }
                }}
              />

              {/* Bid Status + Highest Bidder Crest Badge + Radar Chart */}
              <div className="grid grid-cols-2 gap-2 items-center bg-slate-950/70 rounded-xl p-3 border border-slate-800">
                <div className="space-y-1.5">
                  <div className="text-[11px] text-slate-400">
                    {auction.highestBidder !== null
                      ? 'Leading Bid'
                      : 'Base Price'}
                  </div>
                  <div className="text-2xl font-black text-amber-300">
                    €{auction.currentBid}M
                  </div>
                  {auction.highestBidder !== null ? (
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900 border border-cyan-500/35">
                      <ClubCrest
                        club={teams[auction.highestBidder].club}
                        size={22}
                      />
                      <span className="text-xs font-black text-white">
                        {teams[auction.highestBidder].club.code}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">
                      Open bidding on M1 / M2
                    </div>
                  )}
                  <div className="text-[11px] text-slate-400">
                    {lot.appearance.heightM}m • {lot.appearance.dominantFoot} Foot
                  </div>
                </div>
                <RadarChart
                  stats={lot.stats}
                  size={165}
                  accentColor={
                    auction.highestBidder !== null
                      ? teams[auction.highestBidder].club.accent
                      : originClubPreset.accent
                  }
                />
              </div>

              {/* Timer Pause / Skip Controls (No manual Hammer Sold button!) */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTimerPaused((p) => !p)}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-200 font-bold text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {timerPaused ? (
                    <>
                      <Play className="w-3.5 h-3.5" /> Resume Timer
                    </>
                  ) : (
                    <>
                      <Pause className="w-3.5 h-3.5" /> Pause Timer
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onSkip}
                  className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip / Re-Queue
                </button>
              </div>
            </>
          ) : (
            <div className="py-12 text-center space-y-4">
              <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
              <h2 className="text-xl font-black text-white">
                Auction Floor Complete!
              </h2>
              <p className="text-xs text-slate-400">
                Both clubs are finalized at 11/11 in strict 1-4-3-3 positional
                structure.
              </p>
              <button
                type="button"
                onClick={onProceedToTactics}
                className="px-6 py-3 rounded-xl bg-emerald-400 text-slate-950 font-black text-sm cursor-pointer"
              >
                Open Tactical Whiteboard →
              </button>
            </div>
          )}
        </div>

        <div className="lg:col-span-4">{renderTeamConsole(1)}</div>
      </div>

      {/* Live Auction Logs */}
      <div className="ucl-glass rounded-2xl p-3 max-h-36 overflow-y-auto space-y-1">
        {auction.logs.map((entry) => (
          <div key={entry.id} className="text-xs flex items-center gap-2">
            <span className="text-slate-500 font-mono">R{entry.round}</span>
            <span
              className={
                entry.type === 'sold'
                  ? 'text-emerald-300 font-bold'
                  : entry.type === 'rtm' || entry.type === 'sealed'
                  ? 'text-amber-300 font-bold'
                  : entry.type === 'unsold'
                  ? 'text-slate-400'
                  : 'text-cyan-200'
              }
            >
              {entry.message}
            </span>
          </div>
        ))}
      </div>

      {/* RTM Modal */}
      {auction.rtmPending.active &&
        auction.rtmPending.lot &&
        auction.rtmPending.eligibleTeamIdx !== null && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="ucl-glass rounded-2xl max-w-md w-full p-6 space-y-4 border-amber-400/50">
              <div className="text-xs uppercase font-black tracking-widest text-amber-400">
                Right-To-Match (RTM) Card Triggered
              </div>
              <div className="flex items-center gap-3">
                <ClubCrest
                  club={teams[auction.rtmPending.eligibleTeamIdx].club}
                  size={44}
                />
                <h3 className="text-xl font-black text-white">
                  {teams[auction.rtmPending.eligibleTeamIdx].club.name} can steal{' '}
                  {auction.rtmPending.lot.name}!
                </h3>
              </div>
              <p className="text-sm text-slate-300">
                {auction.rtmPending.lot.name} belongs to your preset club (
                {auction.rtmPending.lot.club}). Match the winning bid of{' '}
                <span className="text-amber-300 font-black">
                  €{auction.rtmPending.winningBid}M
                </span>{' '}
                using your 1 RTM card?
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playSFX('gavel');
                    onRtmDecision(true);
                  }}
                  className="py-3 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase cursor-pointer"
                >
                  Exercise RTM (€{auction.rtmPending.winningBid}M)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playSFX('gavel');
                    onRtmDecision(false);
                  }}
                  className="py-3 rounded-xl bg-slate-800 text-slate-200 font-bold text-xs uppercase cursor-pointer"
                >
                  Decline RTM
                </button>
              </div>
            </div>
          </div>
        )}

      {/* Marquee Sealed-Bid Power Round Modal (OVR 96+ Prime Icons) */}
      {auction.sealedBid.active &&
        auction.sealedBid.lot &&
        !auction.sealedBid.resolved && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="ucl-glass rounded-2xl max-w-xl w-full p-6 space-y-4 border-indigo-400/50">
              <div className="flex items-center gap-2 text-xs uppercase font-black tracking-widest text-amber-300">
                <Lock className="w-4 h-4" />
                Marquee Sealed-Bid Power Round (OVR {auction.sealedBid.lot.ovr})
              </div>
              <div className="flex items-center gap-3">
                <PlayerPortrait
                  player={auction.sealedBid.lot}
                  kitColor={originClubPreset.primary}
                  size={60}
                />
                <div>
                  <h3 className="text-2xl font-black text-white">
                    {auction.sealedBid.lot.flag} {auction.sealedBid.lot.name}
                  </h3>
                  <div className="text-xs text-slate-400">
                    {auction.sealedBid.lot.club} • Base €{effectiveBase}M
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-300">
                Both managers enter a secret blind bid simultaneously. Higher
                bid wins immediately!
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {([0, 1] as const).map((idx) => {
                  const locked = auction.sealedBid.bids[idx] !== null;
                  return (
                    <div
                      key={idx}
                      className="rounded-xl bg-slate-900/90 border border-slate-700 p-4 space-y-2.5"
                    >
                      <div className="flex items-center gap-2 font-bold text-sm text-white">
                        <ClubCrest club={teams[idx].club} size={28} />
                        <span>
                          {teams[idx].club.code} — {teams[idx].managerName}
                        </span>
                      </div>
                      <div className="text-xs text-emerald-400">
                        Purse: €{teams[idx].purse}M
                      </div>
                      {locked ? (
                        <div className="py-2 text-center rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                          ✓ Secret Bid Locked
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="password"
                            inputMode="numeric"
                            placeholder={`€${effectiveBase}M+`}
                            value={sealedInputs[idx]}
                            onChange={(e) => {
                              const next: [string, string] = [
                                ...sealedInputs,
                              ] as [string, string];
                              next[idx] = e.target.value;
                              setSealedInputs(next);
                            }}
                            className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = Number(sealedInputs[idx]);
                              const err = onSealedBid(idx, val);
                              if (err) {
                                const nextErr: [string | null, string | null] =
                                  [...errors] as [string | null, string | null];
                                nextErr[idx] = err;
                                setErrors(nextErr);
                              } else {
                                audioEngine.playSFX('bid');
                              }
                            }}
                            className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-black text-xs"
                          >
                            Lock
                          </button>
                        </div>
                      )}
                      {errors[idx] && (
                        <div className="text-[11px] text-rose-400">
                          {errors[idx]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
    </div>
  );
};
