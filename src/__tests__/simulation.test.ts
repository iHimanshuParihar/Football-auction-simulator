import { describe, expect, it } from 'vitest';
import { CLUB_PRESETS, STADIUM_TEMPLATES } from '@/data/clubs';
import { CURATED_PLAYERS, POSITION_QUOTAS } from '@/data/players';
import {
  autoCompleteSquads,
  computeAIBidDecision,
  countPositions,
  createInitialAuctionState,
  finalizeTeamLineupDefaults,
  placeBid,
  resolveCurrentLot,
  resolveRTMDecision,
  submitSealedBid,
} from '@/lib/auction-engine';
import { MatchSimulationEngine } from '@/lib/match-engine';
import { fisherYatesShuffle, mulberry32 } from '@/lib/prng';
import { TeamSetup } from '@/types/game';

function makeTeams(): [TeamSetup, TeamSetup] {
  return [
    {
      managerName: 'Pep',
      club: CLUB_PRESETS[1], // Manchester City
      purse: 1000,
      startingPurse: 1000,
      squad: [],
      mentality: 'Balanced',
      rtmAvailable: true,
    },
    {
      managerName: 'Carlo',
      club: CLUB_PRESETS[0], // Real Madrid
      purse: 1000,
      startingPurse: 1000,
      squad: [],
      mentality: 'Balanced',
      rtmAvailable: true,
    },
  ];
}

describe('Data Catalog & Deterministic PRNG', () => {
  it('provides 130+ curated players, 24+ club presets, and 6+ stadiums', () => {
    expect(CURATED_PLAYERS.length).toBeGreaterThanOrEqual(130);
    expect(CLUB_PRESETS.length).toBeGreaterThanOrEqual(24);
    expect(STADIUM_TEMPLATES.length).toBeGreaterThanOrEqual(6);
  });

  it('produces identical shuffles for the same mulberry32 seed', () => {
    const a = fisherYatesShuffle([1, 2, 3, 4, 5, 6], mulberry32(4242));
    const b = fisherYatesShuffle([1, 2, 3, 4, 5, 6], mulberry32(4242));
    expect(a).toEqual(b);
  });
});

describe('Mega-Auction Engine', () => {
  it('handles bidding, RTM card trigger, and two-pass auto-complete to strict 1-4-3-3', () => {
    const teams = makeTeams();
    let state = createInitialAuctionState('mixed', 12345, teams);

    // If first lot is sealed-bid (OVR 96+), submit sealed bids first
    if (state.sealedBid.active && state.sealedBid.lot) {
      const base = state.sealedBid.lot.base;
      const r0 = submitSealedBid(state, teams, 0, base + 5);
      const r1 = submitSealedBid(r0.state, r0.teams, 1, base + 15);
      state = r1.state;
      teams[0] = r1.teams[0];
      teams[1] = r1.teams[1];
      expect(teams[1].squad.length).toBe(1);
    }

    // Complete via Two-Pass Auto-Complete and verify strict 1-4-3-3 quotas
    const completed = autoCompleteSquads(state, teams);
    for (const t of completed.teams) {
      expect(t.squad.length).toBe(11);
      const counts = countPositions(t.squad);
      expect(counts).toEqual(POSITION_QUOTAS);
    }
  });

  it('prevents overspending and pads broke managers with OVR 62-64 reserves', () => {
    const teams = makeTeams();
    teams[0].purse = 2; // Cannot afford any curated player
    const state = createInitialAuctionState('mixed', 777, teams);

    if (state.currentLot && !state.sealedBid.active) {
      const bidRes = placeBid(state, teams, 0, state.currentLot.base);
      expect(bidRes.error).toBeDefined();
    }

    const done = autoCompleteSquads(state, teams);
    expect(done.teams[0].squad.length).toBe(11);
    expect(done.teams[0].squad.every((p) => p.isReserve && p.ovr >= 62 && p.ovr <= 64)).toBe(true);
  });

  it('triggers and resolves Right-to-Match (RTM) for matching club icons', () => {
    const teams = makeTeams();
    const state = createInitialAuctionState('mixed', 999, teams);
    const realMadridPlayer = CURATED_PLAYERS.find(
      (p) => p.club === 'Real Madrid' && p.ovr < 96
    )!;
    const customState = {
      ...state,
      currentLot: realMadridPlayer,
      currentBid: realMadridPlayer.base,
      highestBidder: 0 as const,
      sealedBid: { ...state.sealedBid, active: false, lot: null },
    };

    const hammered = resolveCurrentLot(customState, teams, false);
    expect(hammered.state.rtmPending.active).toBe(true);
    expect(hammered.state.rtmPending.eligibleTeamIdx).toBe(1);

    const rtmDone = resolveRTMDecision(hammered.state, hammered.teams, true);
    expect(rtmDone.teams[1].squad.some((p) => p.id === realMadridPlayer.id)).toBe(true);
    expect(rtmDone.teams[1].rtmAvailable).toBe(false);
  });
});

describe('3D Match & Physics Simulation Engine', () => {
  it('initializes at 0-0 and deterministically simulates to fulltime/penalties', () => {
    const teams = makeTeams();
    const state = createInitialAuctionState('mixed', 555, teams);
    const done = autoCompleteSquads(state, teams);

    const simA = new MatchSimulationEngine(done.teams, 8888, 'clear_night', 'single_leg');
    const simB = new MatchSimulationEngine(done.teams, 8888, 'clear_night', 'single_leg');

    expect(simA.stats[0].goals).toBe(0);
    expect(simA.stats[1].goals).toBe(0);

    simA.startKickoff();
    simB.startKickoff();

    for (let i = 0; i < 4000 && (simA.period !== 'fulltime' || simB.period !== 'fulltime'); i++) {
      simA.step(0.05, 4);
      simB.step(0.05, 4);
      if (simA.period === 'halftime') simA.resumeSecondHalf();
      if (simB.period === 'halftime') simB.resumeSecondHalf();
    }

    expect(simA.stats[0].goals).toBe(simB.stats[0].goals);
    expect(simA.stats[1].goals).toBe(simB.stats[1].goals);
    expect(simA.period).toBe('fulltime');
    const setPieceEvents = simA.events.filter((e) =>
      ['throw_in', 'corner', 'free_kick', 'penalty_awarded', 'goal', 'save'].includes(e.type)
    );
    expect(setPieceEvents.length).toBeGreaterThan(3);
    const totalShots = simA.stats[0].shots + simA.stats[1].shots;
    const totalSaves = simA.stats[0].saves + simA.stats[1].saves;
    const totalFouls = simA.stats[0].fouls + simA.stats[1].fouls;
    const totalThrowIns = simA.stats[0].throwIns + simA.stats[1].throwIns;
    const totalCorners = simA.stats[0].corners + simA.stats[1].corners;
    expect(totalShots).toBeGreaterThanOrEqual(6);
    expect(totalSaves + totalFouls).toBeGreaterThanOrEqual(4);
    expect(totalThrowIns).toBeGreaterThanOrEqual(1);
    expect(totalCorners).toBeGreaterThanOrEqual(1);
  });

  it('propagates spring-mass goal net ripples cleanly', () => {
    const teams = makeTeams();
    const done = autoCompleteSquads(
      createInitialAuctionState('mixed', 202, teams),
      teams
    );
    const sim = new MatchSimulationEngine(done.teams, 101, 'heavy_rain', 'single_leg');
    sim.triggerNetRipple(0, 12, 6, 1.5);
    sim.step(0.03, 1);
    const maxDisp = Math.max(...Array.from(sim.nets[0].displacements));
    expect(maxDisp).toBeGreaterThan(0);
  });

  it('supports AI CPU auction bidding, 3-man impact bench, live substitutions, mentalities, and xG shot map tracking', () => {
    const teams = makeTeams();
    let state = createInitialAuctionState('mixed', 3131, teams);
    const nonSealedLot = CURATED_PLAYERS.find((p) => p.ovr >= 88 && p.ovr < 96)!;
    state = {
      ...state,
      currentLot: nonSealedLot,
      currentBid: 0,
      highestBidder: null,
      sealedBid: { ...state.sealedBid, active: false, lot: null },
    };

    const aiDecision = computeAIBidDecision(state, teams, 1);
    expect(aiDecision.shouldBid).toBe(true);
    expect(aiDecision.amount).toBeGreaterThanOrEqual(nonSealedLot.base);

    const completed = autoCompleteSquads(state, teams);
    const finalized0 = finalizeTeamLineupDefaults(completed.teams[0]);
    const finalized1 = finalizeTeamLineupDefaults(completed.teams[1]);
    expect(finalized0.squad.length).toBe(11);
    expect(finalized0.bench?.length).toBe(3);

    const sim = new MatchSimulationEngine(
      [finalized0, finalized1],
      9191,
      'clear_night',
      'single_leg',
      undefined,
      undefined,
      1
    );
    sim.startKickoff();
    sim.setMentality(0, 'High Press');
    expect(sim.getSnapshot().mentalities[0]).toBe('High Press');

    const outgoing = finalized0.squad.find((p) => p.pos === 'FWD') ?? finalized0.squad[10];
    const incoming = finalized0.bench![0];
    const subOk = sim.makeSubstitution(0, outgoing.id, incoming);
    expect(subOk).toBe(true);
    expect(sim.getSnapshot().subsUsed[0]).toBe(1);

    sim.simToFullTime();
    const snap = sim.getSnapshot();
    expect(snap.period).toBe('fulltime');
    expect(snap.shotsLog.length).toBeGreaterThanOrEqual(1);
    expect(snap.playerHeatmaps.length).toBe(22);
    expect(snap.playerHeatmaps.every((p) => p.rating >= 4.5 && p.stamina <= 100)).toBe(true);
  });

  it('moves the ball continuously during live passes and open play without teleport spawning', () => {
    const teams = makeTeams();
    const completed = autoCompleteSquads(
      createInitialAuctionState('mixed', 4040, teams),
      teams
    );
    const sim = new MatchSimulationEngine(completed.teams, 7070, 'clear_night', 'single_leg');
    sim.startKickoff();

    let maxOpenPlayJump = 0;
    let totalPassesAttempted = 0;
    let prevX = sim.ball.x;
    let prevY = sim.ball.y;
    let prevEventLen = sim.events.length;
    let wasSetPiece = false;

    for (let i = 0; i < 600; i++) {
      const prevGoals = sim.stats[0].goals + sim.stats[1].goals;
      const prevPeriod = sim.period;
      const prevReplay = sim.replayTimer;
      sim.step(0.05, 1);
      if (sim.period === 'halftime') sim.resumeSecondHalf();

      const nowGoals = sim.stats[0].goals + sim.stats[1].goals;
      const newEvents = sim.events.slice(prevEventLen);
      prevEventLen = sim.events.length;
      const isKickoffReset = prevReplay > 0 && sim.replayTimer === 0;
      const isDeadBallTransition =
        sim.setPiece !== null ||
        wasSetPiece ||
        isKickoffReset ||
        nowGoals !== prevGoals ||
        prevPeriod !== sim.period ||
        newEvents.some((e) =>
          ['corner', 'goal_kick', 'throw_in', 'free_kick', 'penalty_awarded', 'goal', 'kickoff'].includes(e.type)
        );

      if (!isDeadBallTransition) {
        const jump = Math.hypot(sim.ball.x - prevX, sim.ball.y - prevY);
        if (jump > maxOpenPlayJump) maxOpenPlayJump = jump;
      }

      wasSetPiece = sim.setPiece !== null;
      prevX = sim.ball.x;
      prevY = sim.ball.y;
      totalPassesAttempted = sim.stats[0].passes + sim.stats[1].passes;
    }

    expect(totalPassesAttempted).toBeGreaterThanOrEqual(5);
    expect(maxOpenPlayJump).toBeLessThan(4.5);
  });
});
