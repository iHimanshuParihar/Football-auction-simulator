'use client';

import React, { useState } from 'react';
import { Award, Crosshair, Shield, Sparkles, Swords } from 'lucide-react';
import { TacticalMentality, TeamSetup } from '@/types/game';
import { FORMATION_SLOTS } from '@/data/players';
import { computeTeamAverageOvr } from '@/lib/auction-engine';
import { ClubCrest } from '@/components/ui/ClubCrest';
import { JerseyPreview } from '@/components/ui/JerseyPreview';
import { PlayerPortrait } from '@/components/ui/PlayerPortrait';

interface TacticsPhaseProps {
  teams: [TeamSetup, TeamSetup];
  onUpdateTeam: (teamIdx: 0 | 1, updated: TeamSetup) => void;
  onStartMatch: () => void;
}

const MENTALITIES: TacticalMentality[] = [
  'High Press',
  'Balanced',
  'Counter-Attack',
  'Park the Bus',
];

export const TacticsPhase: React.FC<TacticsPhaseProps> = ({
  teams,
  onUpdateTeam,
  onStartMatch,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<[number | null, number | null]>([
    null,
    null,
  ]);

  const handlePlayerClick = (teamIdx: 0 | 1, idx: number) => {
    const prev = selectedSlot[teamIdx];
    if (prev === null) {
      const next: [number | null, number | null] = [...selectedSlot] as [
        number | null,
        number | null
      ];
      next[teamIdx] = idx;
      setSelectedSlot(next);
      return;
    }

    if (prev !== idx) {
      const team = teams[teamIdx];
      const nextSquad = [...team.squad];
      const tmp = nextSquad[prev];
      nextSquad[prev] = nextSquad[idx];
      nextSquad[idx] = tmp;
      onUpdateTeam(teamIdx, { ...team, squad: nextSquad });
    }

    const cleared: [number | null, number | null] = [...selectedSlot] as [
      number | null,
      number | null
    ];
    cleared[teamIdx] = null;
    setSelectedSlot(cleared);
  };

  const renderTeamBoard = (teamIdx: 0 | 1) => {
    const team = teams[teamIdx];
    const avgOvr = computeTeamAverageOvr(team.squad);
    const activeIdx = selectedSlot[teamIdx];
    const activePlayer = activeIdx !== null ? team.squad[activeIdx] : null;

    return (
      <div className="ucl-glass rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ClubCrest club={team.club} size={46} />
            <div>
              <div className="text-xs text-cyan-400 font-bold uppercase">
                {team.managerName}
              </div>
              <h3 className="text-lg font-black text-white">{team.club.name}</h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] text-slate-400">Squad OVR</div>
              <div className="text-2xl font-black text-cyan-300">{avgOvr}</div>
            </div>
            <JerseyPreview club={team.club} size={52} number={10} />
          </div>
        </div>

        {/* Mentality Selector */}
        <div className="flex flex-wrap gap-1.5">
          {MENTALITIES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onUpdateTeam(teamIdx, { ...team, mentality: m })}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                team.mentality === m
                  ? 'bg-cyan-400 text-slate-950'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-700'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Visual 1-4-3-3 Pitch Whiteboard */}
        <div className="relative w-full h-80 rounded-2xl overflow-hidden border border-emerald-400/30 bg-gradient-to-b from-emerald-950 via-emerald-900/90 to-emerald-950 p-3">
          {/* Pitch Lines */}
          <div className="absolute inset-3 border border-white/25 rounded-lg pointer-events-none" />
          <div className="absolute left-3 right-3 top-1/2 h-px bg-white/25 pointer-events-none" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border border-white/25 pointer-events-none" />

          {FORMATION_SLOTS.map((slot, i) => {
            const pl = team.squad[i];
            if (!pl) return null;
            // Vertical orientation: GK at bottom (90%), ST at top (12%)
            const topPct = 92 - slot.x * 0.86;
            const leftPct = slot.y;
            const isSelected = activeIdx === i;
            const isCap = team.captainId === pl.id;
            const isPen = team.penaltyTakerId === pl.id;
            const isFk = team.freeKickTakerId === pl.id;

            return (
              <button
                key={slot.slotId}
                type="button"
                onClick={() => handlePlayerClick(teamIdx, i)}
                style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer transition ${
                  isSelected ? 'scale-110 z-20' : 'hover:scale-105 z-10'
                }`}
              >
                <div
                  className={`relative w-9 h-9 rounded-full flex items-center justify-center font-black text-xs border-2 shadow-lg ${
                    isSelected
                      ? 'border-amber-400 ring-2 ring-amber-300'
                      : 'border-white/80'
                  }`}
                  style={{
                    backgroundColor:
                      slot.pos === 'GK' ? '#059669' : team.club.primary,
                    color:
                      team.club.primary.toLowerCase() === '#f8fafc' ||
                      team.club.primary.toLowerCase() === '#ffffff' ||
                      team.club.primary.toLowerCase() === '#fde100'
                        ? '#020617'
                        : '#ffffff',
                  }}
                >
                  {pl.ovr}
                  {isCap && (
                    <span className="absolute -top-1.5 -right-1.5 px-1 rounded bg-amber-400 text-[9px] text-slate-950 font-black">
                      C
                    </span>
                  )}
                  {isPen && (
                    <span className="absolute -bottom-1.5 -left-1.5 px-1 rounded bg-cyan-400 text-[8px] text-slate-950 font-black">
                      P
                    </span>
                  )}
                  {isFk && (
                    <span className="absolute -bottom-1.5 -right-1.5 px-1 rounded bg-indigo-400 text-[8px] text-slate-950 font-black">
                      F
                    </span>
                  )}
                </div>
                <span className="mt-0.5 px-1.5 py-0.5 rounded bg-slate-950/85 text-[10px] font-bold text-white whitespace-nowrap max-w-[82px] truncate">
                  {pl.name.split(' ').slice(-1)[0]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Player Role Assignment Bar */}
        {activePlayer ? (
          <div className="rounded-xl bg-slate-900/95 border border-cyan-400/40 p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <PlayerPortrait
                player={activePlayer}
                kitColor={team.club.primary}
                size={40}
              />
              <div>
                <div className="text-xs font-black text-white">
                  {activePlayer.name} ({activePlayer.role} • {activePlayer.ovr})
                </div>
                <div className="text-[11px] text-slate-400">
                  Click another player to swap slots, or assign specialist role:
                </div>
              </div>
            </div>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateTeam(teamIdx, { ...team, captainId: activePlayer.id })
                }
                className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-[11px] flex items-center gap-1"
              >
                <Award className="w-3 h-3" /> Captain
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateTeam(teamIdx, {
                    ...team,
                    penaltyTakerId: activePlayer.id,
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-cyan-400 text-slate-950 font-black text-[11px] flex items-center gap-1"
              >
                <Crosshair className="w-3 h-3" /> Pen
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateTeam(teamIdx, {
                    ...team,
                    freeKickTakerId: activePlayer.id,
                  })
                }
                className="px-2.5 py-1 rounded-lg bg-indigo-400 text-slate-950 font-black text-[11px] flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> FK
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-400 flex items-center gap-2 bg-slate-900/60 rounded-xl px-3 py-2">
            <Shield className="w-4 h-4 text-cyan-400" />
            Click any player on the 1-4-3-3 board to swap positions or assign
            Captain / Penalty / Free-Kick duties.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 py-6 space-y-5">
      <div className="ucl-glass rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs uppercase font-bold tracking-widest text-cyan-400">
            Phase 3 • Tactical Whiteboard & Lineup Sheet
          </span>
          <h2 className="text-2xl font-black text-white">
            Confirm 1-4-3-3 Formations & Matchday Duties
          </h2>
        </div>

        <button
          type="button"
          onClick={onStartMatch}
          className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-sky-500 text-slate-950 font-black text-sm uppercase shadow-lg shadow-cyan-500/25 hover:brightness-110 transition cursor-pointer"
        >
          <Swords className="w-4 h-4" />
          Kick Off 3D UCL Broadcast →
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {renderTeamBoard(0)}
        {renderTeamBoard(1)}
      </div>
    </div>
  );
};
