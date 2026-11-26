'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppPhase,
  AuctionState,
  ClubPreset,
  GameConfig,
  TeamSetup,
} from '@/types/game';
import { CLUB_PRESETS } from '@/data/clubs';
import {
  autoCompleteSquads,
  createInitialAuctionState,
  finalizeTeamLineupDefaults,
  placeBid,
  resolveCurrentLot,
  resolveRTMDecision,
  submitSealedBid,
} from '@/lib/auction-engine';
import { LobbyPhase } from '@/components/phases/LobbyPhase';
import { AuctionPhase } from '@/components/phases/AuctionPhase';
import { TacticsPhase } from '@/components/phases/TacticsPhase';
import { MatchPhase } from '@/components/phases/MatchPhase';

interface SyncedRoomPayload {
  phase: AppPhase;
  config: GameConfig;
  teams: [TeamSetup, TeamSetup];
  auction: AuctionState | null;
}

export default function HomePage() {
  const [phase, setPhase] = useState<AppPhase>('lobby');
  const [config, setConfig] = useState<GameConfig>({
    playMode: 'local',
    roomCode: '',
    seed: 202601,
    startingPurse: 1000,
    eraFilter: 'mixed',
    stadiumId: 'etihad',
    weather: 'clear_night',
    knockoutFormat: 'single_leg',
    bidTimerSeconds: 10,
  });
  const [teams, setTeams] = useState<[TeamSetup, TeamSetup]>([
    {
      managerName: 'Manager 1',
      club: CLUB_PRESETS[1],
      purse: 1000,
      startingPurse: 1000,
      squad: [],
      mentality: 'Balanced',
      rtmAvailable: true,
    },
    {
      managerName: 'Manager 2',
      club: CLUB_PRESETS[0],
      purse: 1000,
      startingPurse: 1000,
      squad: [],
      mentality: 'Balanced',
      rtmAvailable: true,
    },
  ]);
  const [auction, setAuction] = useState<AuctionState | null>(null);
  const [matchKey, setMatchKey] = useState(1);

  const seqRef = useRef(0);

  const pushRoomUpdate = useCallback(
    async (
      nextPhase: AppPhase,
      nextConfig: GameConfig,
      nextTeams: [TeamSetup, TeamSetup],
      nextAuction: AuctionState | null
    ) => {
      const isOnlineMode =
        nextConfig.playMode === 'online_host' ||
        nextConfig.playMode === 'online_join';
      if (!isOnlineMode || !nextConfig.roomCode) return;
      seqRef.current += 1;
      try {
        await fetch(`/api/rooms/${encodeURIComponent(nextConfig.roomCode)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            seq: seqRef.current,
            payload: {
              phase: nextPhase,
              config: nextConfig,
              teams: nextTeams,
              auction: nextAuction,
            } satisfies SyncedRoomPayload,
          }),
        });
      } catch {
        // graceful offline tolerance
      }
    },
    []
  );

  // SSE subscription when in online room mode
  useEffect(() => {
    const isOnlineMode =
      config.playMode === 'online_host' || config.playMode === 'online_join';
    if (!isOnlineMode || !config.roomCode) return;
    const es = new EventSource(
      `/api/rooms/${encodeURIComponent(config.roomCode)}?stream=1`
    );
    es.onmessage = (msg) => {
      try {
        const snap = JSON.parse(msg.data) as {
          seq: number;
          payload?: SyncedRoomPayload;
        };
        if (snap.seq > seqRef.current && snap.payload) {
          seqRef.current = snap.seq;
          setPhase(snap.payload.phase);
          setConfig(snap.payload.config);
          setTeams(snap.payload.teams);
          setAuction(snap.payload.auction);
        }
      } catch {
        // ignore malformed heartbeat
      }
    };
    return () => {
      es.close();
    };
  }, [config.playMode, config.roomCode]);

  const handleStartAuction = (
    m1Name: string,
    m1Club: ClubPreset,
    m2Name: string,
    m2Club: ClubPreset,
    nextConfig: GameConfig
  ) => {
    const initialTeams: [TeamSetup, TeamSetup] = [
      {
        managerName: m1Name.trim() || 'Manager 1',
        club: m1Club,
        purse: nextConfig.startingPurse,
        startingPurse: nextConfig.startingPurse,
        squad: [],
        mentality: 'Balanced',
        rtmAvailable: true,
      },
      {
        managerName: m2Name.trim() || 'Manager 2',
        club: m2Club,
        purse: nextConfig.startingPurse,
        startingPurse: nextConfig.startingPurse,
        squad: [],
        mentality: 'Balanced',
        rtmAvailable: true,
      },
    ];
    const initialAuction = createInitialAuctionState(
      nextConfig.eraFilter,
      nextConfig.seed,
      initialTeams
    );
    setConfig(nextConfig);
    setTeams(initialTeams);
    setAuction(initialAuction);
    setPhase('auction');
    pushRoomUpdate('auction', nextConfig, initialTeams, initialAuction);
  };

  const handleJoinSyncedRoom = async (roomCode: string) => {
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}`);
      const data = (await res.json()) as {
        room: { seq: number; payload: SyncedRoomPayload } | null;
      };
      if (data.room?.payload) {
        seqRef.current = data.room.seq;
        setConfig({ ...data.room.payload.config, playMode: 'online_join', roomCode });
        setTeams(data.room.payload.teams);
        setAuction(data.room.payload.auction);
        setPhase(data.room.payload.phase);
      } else {
        setConfig((c) => ({ ...c, playMode: 'online_join', roomCode }));
      }
    } catch {
      // ignore
    }
  };

  const handleBid = (teamIdx: 0 | 1, amount: number): string | undefined => {
    if (!auction) return 'Auction not ready';
    const res = placeBid(auction, teams, teamIdx, amount);
    if (res.error) return res.error;
    setAuction(res.state);
    pushRoomUpdate(phase, config, teams, res.state);
    return undefined;
  };

  const handleHammer = () => {
    if (!auction) return;
    const res = resolveCurrentLot(auction, teams, false);
    setAuction(res.state);
    setTeams(res.teams);
    pushRoomUpdate(phase, config, res.teams, res.state);
  };

  const handleSkip = () => {
    if (!auction) return;
    const res = resolveCurrentLot(auction, teams, true);
    setAuction(res.state);
    setTeams(res.teams);
    pushRoomUpdate(phase, config, res.teams, res.state);
  };

  const handleRtmDecision = (exercise: boolean) => {
    if (!auction) return;
    const res = resolveRTMDecision(auction, teams, exercise);
    setAuction(res.state);
    setTeams(res.teams);
    pushRoomUpdate(phase, config, res.teams, res.state);
  };

  const handleSealedBid = (
    teamIdx: 0 | 1,
    amount: number
  ): string | undefined => {
    if (!auction) return 'No active auction';
    const res = submitSealedBid(auction, teams, teamIdx, amount);
    if (res.error) return res.error;
    setAuction(res.state);
    setTeams(res.teams);
    pushRoomUpdate(phase, config, res.teams, res.state);
    return undefined;
  };

  const handleAutoComplete = () => {
    if (!auction) return;
    const res = autoCompleteSquads(auction, teams);
    setAuction(res.state);
    setTeams(res.teams);
    pushRoomUpdate(phase, config, res.teams, res.state);
  };

  const handleProceedToTactics = () => {
    const finalized: [TeamSetup, TeamSetup] = [
      finalizeTeamLineupDefaults(teams[0]),
      finalizeTeamLineupDefaults(teams[1]),
    ];
    setTeams(finalized);
    setPhase('tactics');
    pushRoomUpdate('tactics', config, finalized, auction);
  };

  const handleUpdateTeam = (teamIdx: 0 | 1, updated: TeamSetup) => {
    const next: [TeamSetup, TeamSetup] = [...teams] as [TeamSetup, TeamSetup];
    next[teamIdx] = updated;
    setTeams(next);
    pushRoomUpdate(phase, config, next, auction);
  };

  const handleStartMatch = () => {
    setMatchKey((k) => k + 1);
    setPhase('match');
    pushRoomUpdate('match', config, teams, auction);
  };

  return (
    <main className="min-h-screen w-full ucl-starburst flex flex-col">
      {/* Global Top Stepper */}
      <header className="border-b border-slate-800/80 bg-slate-950/75 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center font-black text-xs text-slate-950">
              ★
            </div>
            <span className="font-black text-sm tracking-wide text-white">
              UCL <span className="text-cyan-400">MEGA-AUCTION</span> 3D
            </span>
          </div>

          <nav className="hidden sm:flex items-center gap-1.5 text-xs font-bold">
            {(
              [
                ['lobby', '1. Lobby'],
                ['auction', '2. Mega-Auction'],
                ['tactics', '3. 1-4-3-3 Tactics'],
                ['match', '4. 3D Match'],
              ] as const
            ).map(([p, label]) => (
              <span
                key={p}
                className={`px-3 py-1 rounded-full ${
                  phase === p
                    ? 'bg-cyan-400 text-slate-950 font-black'
                    : 'text-slate-400 bg-slate-900/70'
                }`}
              >
                {label}
              </span>
            ))}
          </nav>
        </div>
      </header>

      {phase === 'lobby' && (
        <LobbyPhase
          onStartAuction={handleStartAuction}
          onJoinSyncedRoom={handleJoinSyncedRoom}
        />
      )}

      {phase === 'auction' && auction && (
        <AuctionPhase
          auction={auction}
          teams={teams}
          bidTimerSeconds={config.bidTimerSeconds}
          roomCode={config.roomCode}
          isOnline={
            config.playMode === 'online_host' ||
            config.playMode === 'online_join'
          }
          isAiOpponent={config.playMode === 'vs_ai'}
          onBid={handleBid}
          onHammer={handleHammer}
          onSkip={handleSkip}
          onRtmDecision={handleRtmDecision}
          onSealedBid={handleSealedBid}
          onAutoComplete={handleAutoComplete}
          onProceedToTactics={handleProceedToTactics}
        />
      )}

      {phase === 'tactics' && (
        <TacticsPhase
          teams={teams}
          onUpdateTeam={handleUpdateTeam}
          onStartMatch={handleStartMatch}
        />
      )}

      {phase === 'match' && (
        <MatchPhase
          key={matchKey}
          teams={teams}
          config={config}
          onRematch={() => setMatchKey((k) => k + 1)}
          onNewTournament={() => setPhase('lobby')}
        />
      )}
    </main>
  );
}
