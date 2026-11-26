import {
  AuctionLogEntry,
  AuctionState,
  EraPoolFilter,
  Player,
  Position,
  SignedPlayer,
  TeamSetup,
} from '@/types/game';
import {
  createReservePlayer,
  filterPlayersByEra,
  FORMATION_SLOTS,
  POSITION_QUOTAS,
} from '@/data/players';
import { fisherYatesShuffle, mulberry32 } from './prng';

export function countPositions(squad: SignedPlayer[]): Record<Position, number> {
  const counts: Record<Position, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const pl of squad) {
    counts[pl.pos] += 1;
  }
  return counts;
}

export function canTeamBidOnPlayer(
  team: TeamSetup,
  player: Player,
  bidAmount: number
): { ok: boolean; reason?: string } {
  if (team.squad.length >= 11) {
    return { ok: false, reason: 'Squad is already 11/11 full' };
  }
  const counts = countPositions(team.squad);
  if (counts[player.pos] >= POSITION_QUOTAS[player.pos]) {
    return {
      ok: false,
      reason: `${player.pos} quota (${POSITION_QUOTAS[player.pos]}) is full`,
    };
  }
  if (bidAmount > team.purse) {
    return { ok: false, reason: `Insufficient purse (€${team.purse}M left)` };
  }
  if (bidAmount < 1) {
    return { ok: false, reason: 'Bid must be at least €1M' };
  }
  return { ok: true };
}

export function getEffectiveBasePrice(player: Player, round: number): number {
  if (round <= 1) return player.base;
  const factor = Math.max(0.45, 1 - (round - 1) * 0.25);
  return Math.max(5, Math.round(player.base * factor));
}

function makeLog(
  round: number,
  message: string,
  type: AuctionLogEntry['type']
): AuctionLogEntry {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    round,
    message,
    type,
    timestamp: Date.now(),
  };
}

function shouldTriggerSealedBid(
  lot: Player | null,
  teams: [TeamSetup, TeamSetup]
): boolean {
  if (!lot || lot.ovr < 96) return false;
  const can0 = canTeamBidOnPlayer(teams[0], lot, lot.base).ok;
  const can1 = canTeamBidOnPlayer(teams[1], lot, lot.base).ok;
  return can0 && can1;
}

export function createInitialAuctionState(
  eraFilter: EraPoolFilter,
  seed: number,
  teams: [TeamSetup, TeamSetup]
): AuctionState {
  const rng = mulberry32(seed);
  const shuffled = fisherYatesShuffle(filterPlayersByEra(eraFilter), rng);
  const firstLot = shuffled[0] ?? null;
  const restPool = shuffled.slice(1);
  const sealedActive = shouldTriggerSealedBid(firstLot, teams);

  return {
    pool: restPool,
    unsoldQueue: [],
    currentLot: firstLot,
    currentBid: firstLot ? firstLot.base : 0,
    highestBidder: null,
    round: 1,
    lotIndex: firstLot ? 1 : 0,
    totalInitialLots: shuffled.length,
    rtmPending: {
      active: false,
      eligibleTeamIdx: null,
      lot: null,
      winningBid: 0,
      originalWinnerIdx: null,
    },
    sealedBid: {
      active: sealedActive,
      lot: sealedActive ? firstLot : null,
      bids: [null, null],
      resolved: false,
      winnerIdx: null,
      winningAmount: 0,
    },
    logs: [
      makeLog(
        1,
        `Mega-Auction live! ${shuffled.length} players in pool (Seed #${seed}).`,
        'system'
      ),
      ...(sealedActive && firstLot
        ? [
            makeLog(
              1,
              `MARQUEE SEALED-BID ROUND triggered for OVR ${firstLot.ovr} Prime Icon ${firstLot.name}!`,
              'sealed'
            ),
          ]
        : []),
    ],
    completed: firstLot === null,
  };
}

export function placeBid(
  state: AuctionState,
  teams: [TeamSetup, TeamSetup],
  teamIdx: 0 | 1,
  amount: number
): { state: AuctionState; error?: string } {
  if (state.completed || !state.currentLot) {
    return { state, error: 'No active lot' };
  }
  if (state.rtmPending.active) {
    return { state, error: 'Resolve RTM card first' };
  }
  if (state.sealedBid.active && !state.sealedBid.resolved) {
    return { state, error: 'Submit sealed bid in the Marquee Power Round' };
  }

  const lot = state.currentLot;
  const team = teams[teamIdx];
  const minAllowed =
    state.highestBidder === null
      ? getEffectiveBasePrice(lot, state.round)
      : state.currentBid + 1;

  if (state.highestBidder === teamIdx) {
    return { state, error: 'Already holding highest bid' };
  }
  if (amount < minAllowed) {
    return { state, error: `Minimum valid bid is €${minAllowed}M` };
  }

  const check = canTeamBidOnPlayer(team, lot, amount);
  if (!check.ok) {
    return { state, error: check.reason };
  }

  return {
    state: {
      ...state,
      currentBid: amount,
      highestBidder: teamIdx,
      logs: [
        makeLog(
          state.round,
          `${team.club.code} bids €${amount}M for ${lot.name}`,
          'bid'
        ),
        ...state.logs.slice(0, 49),
      ],
    },
  };
}

function assignPlayerToTeam(
  team: TeamSetup,
  player: Player,
  price: number,
  isReserve = false
): TeamSetup {
  const nextSquad: SignedPlayer[] = [
    ...team.squad,
    {
      ...player,
      paidPrice: price,
      squadNumber: team.squad.length + 1,
      isReserve,
    },
  ];
  return {
    ...team,
    purse: Math.max(0, team.purse - price),
    squad: nextSquad,
  };
}

function advanceToNextLot(
  state: AuctionState,
  teams: [TeamSetup, TeamSetup],
  extraLogs: AuctionLogEntry[]
): AuctionState {
  if (teams[0].squad.length >= 11 && teams[1].squad.length >= 11) {
    return {
      ...state,
      currentLot: null,
      completed: true,
      logs: [
        makeLog(state.round, 'Both squads reached 11/11! Auction concluded.', 'system'),
        ...extraLogs,
        ...state.logs.slice(0, 48),
      ],
    };
  }

  let nextPool = [...state.pool];
  let nextUnsold = [...state.unsoldQueue];
  let nextRound = state.round;
  let nextLotIndex = state.lotIndex + 1;

  if (nextPool.length === 0) {
    if (nextUnsold.length === 0) {
      return {
        ...state,
        currentLot: null,
        completed: true,
        logs: [
          makeLog(state.round, 'All lots exhausted. Ready for Auto-Complete or Tactics.', 'system'),
          ...extraLogs,
          ...state.logs.slice(0, 48),
        ],
      };
    }
    nextPool = nextUnsold;
    nextUnsold = [];
    nextRound += 1;
    nextLotIndex = 1;
    extraLogs.unshift(
      makeLog(
        nextRound,
        `Round ${nextRound} Accelerated Re-Queue (${nextPool.length} unsold lots, reduced base prices)!`,
        'system'
      )
    );
  }

  // Skip lots where neither team has an open positional slot
  let nextLot: Player | null = null;
  while (nextPool.length > 0) {
    const candidate = nextPool.shift()!;
    const need0 =
      teams[0].squad.length < 11 &&
      countPositions(teams[0].squad)[candidate.pos] < POSITION_QUOTAS[candidate.pos];
    const need1 =
      teams[1].squad.length < 11 &&
      countPositions(teams[1].squad)[candidate.pos] < POSITION_QUOTAS[candidate.pos];
    if (need0 || need1) {
      nextLot = candidate;
      break;
    } else {
      nextUnsold.push(candidate);
    }
  }

  if (!nextLot) {
    return {
      ...state,
      pool: [],
      unsoldQueue: nextUnsold,
      currentLot: null,
      completed: true,
      logs: [
        makeLog(nextRound, 'No remaining positional matches. Ready to finalize XIs.', 'system'),
        ...extraLogs,
        ...state.logs.slice(0, 48),
      ],
    };
  }

  const sealedActive = shouldTriggerSealedBid(nextLot, teams);
  if (sealedActive) {
    extraLogs.unshift(
      makeLog(
        nextRound,
        `MARQUEE SEALED-BID ROUND: OVR ${nextLot.ovr} ${nextLot.name} (${nextLot.club})!`,
        'sealed'
      )
    );
  }

  return {
    ...state,
    pool: nextPool,
    unsoldQueue: nextUnsold,
    currentLot: nextLot,
    currentBid: getEffectiveBasePrice(nextLot, nextRound),
    highestBidder: null,
    round: nextRound,
    lotIndex: nextLotIndex,
    rtmPending: {
      active: false,
      eligibleTeamIdx: null,
      lot: null,
      winningBid: 0,
      originalWinnerIdx: null,
    },
    sealedBid: {
      active: sealedActive,
      lot: sealedActive ? nextLot : null,
      bids: [null, null],
      resolved: false,
      winnerIdx: null,
      winningAmount: 0,
    },
    logs: [...extraLogs, ...state.logs].slice(0, 50),
  };
}

export function resolveCurrentLot(
  state: AuctionState,
  teams: [TeamSetup, TeamSetup],
  forceSkip = false
): { state: AuctionState; teams: [TeamSetup, TeamSetup] } {
  if (!state.currentLot || state.completed) {
    return { state, teams };
  }

  const lot = state.currentLot;
  if (forceSkip || state.highestBidder === null) {
    const nextUnsold = [...state.unsoldQueue, lot];
    const log = makeLog(
      state.round,
      `${lot.name} went UNSOLD and re-queues for next round.`,
      'unsold'
    );
    const nextState = advanceToNextLot(
      { ...state, unsoldQueue: nextUnsold },
      teams,
      [log]
    );
    return { state: nextState, teams };
  }

  const winnerIdx = state.highestBidder;
  const otherIdx: 0 | 1 = winnerIdx === 0 ? 1 : 0;
  const otherTeam = teams[otherIdx];

  // Check Right-to-Match (RTM) eligibility
  const rtmEligible =
    otherTeam.rtmAvailable &&
    lot.club.toLowerCase() === otherTeam.club.name.toLowerCase() &&
    canTeamBidOnPlayer(otherTeam, lot, state.currentBid).ok;

  if (rtmEligible) {
    return {
      state: {
        ...state,
        rtmPending: {
          active: true,
          eligibleTeamIdx: otherIdx,
          lot,
          winningBid: state.currentBid,
          originalWinnerIdx: winnerIdx,
        },
        logs: [
          makeLog(
            state.round,
            `RTM ALERT: ${otherTeam.club.code} holds a Right-to-Match card for club icon ${lot.name} at €${state.currentBid}M!`,
            'rtm'
          ),
          ...state.logs.slice(0, 49),
        ],
      },
      teams,
    };
  }

  const nextTeams: [TeamSetup, TeamSetup] = [...teams] as [TeamSetup, TeamSetup];
  nextTeams[winnerIdx] = assignPlayerToTeam(teams[winnerIdx], lot, state.currentBid);

  const soldLog = makeLog(
    state.round,
    `SOLD! ${lot.name} (${lot.pos} ${lot.ovr}) joins ${teams[winnerIdx].club.code} for €${state.currentBid}M!`,
    'sold'
  );
  const nextState = advanceToNextLot(state, nextTeams, [soldLog]);
  return { state: nextState, teams: nextTeams };
}

export function resolveRTMDecision(
  state: AuctionState,
  teams: [TeamSetup, TeamSetup],
  exerciseRTM: boolean
): { state: AuctionState; teams: [TeamSetup, TeamSetup] } {
  const { active, eligibleTeamIdx, lot, winningBid, originalWinnerIdx } =
    state.rtmPending;
  if (!active || eligibleTeamIdx === null || !lot || originalWinnerIdx === null) {
    return { state, teams };
  }

  const nextTeams: [TeamSetup, TeamSetup] = [...teams] as [TeamSetup, TeamSetup];
  let log: AuctionLogEntry;

  if (exerciseRTM) {
    nextTeams[eligibleTeamIdx] = {
      ...assignPlayerToTeam(teams[eligibleTeamIdx], lot, winningBid),
      rtmAvailable: false,
    };
    log = makeLog(
      state.round,
      `RTM EXERCISED! ${teams[eligibleTeamIdx].club.code} matches €${winningBid}M and steals ${lot.name}!`,
      'rtm'
    );
  } else {
    nextTeams[originalWinnerIdx] = assignPlayerToTeam(
      teams[originalWinnerIdx],
      lot,
      winningBid
    );
    log = makeLog(
      state.round,
      `RTM declined. ${lot.name} SOLD to ${teams[originalWinnerIdx].club.code} for €${winningBid}M!`,
      'sold'
    );
  }

  const clearedState: AuctionState = {
    ...state,
    rtmPending: {
      active: false,
      eligibleTeamIdx: null,
      lot: null,
      winningBid: 0,
      originalWinnerIdx: null,
    },
  };
  return {
    state: advanceToNextLot(clearedState, nextTeams, [log]),
    teams: nextTeams,
  };
}

export function submitSealedBid(
  state: AuctionState,
  teams: [TeamSetup, TeamSetup],
  teamIdx: 0 | 1,
  amount: number
): { state: AuctionState; teams: [TeamSetup, TeamSetup]; error?: string } {
  const sb = state.sealedBid;
  if (!sb.active || !sb.lot || sb.resolved) {
    return { state, teams, error: 'No active sealed-bid round' };
  }
  const base = getEffectiveBasePrice(sb.lot, state.round);
  if (amount < base) {
    return { state, teams, error: `Sealed bid must be at least €${base}M` };
  }
  const check = canTeamBidOnPlayer(teams[teamIdx], sb.lot, amount);
  if (!check.ok) {
    return { state, teams, error: check.reason };
  }

  const nextBids: [number | null, number | null] = [...sb.bids] as [
    number | null,
    number | null
  ];
  nextBids[teamIdx] = amount;

  if (nextBids[0] === null || nextBids[1] === null) {
    return {
      state: {
        ...state,
        sealedBid: { ...sb, bids: nextBids },
        logs: [
          makeLog(
            state.round,
            `${teams[teamIdx].club.code} locked in their secret sealed bid.`,
            'sealed'
          ),
          ...state.logs.slice(0, 49),
        ],
      },
      teams,
    };
  }

  // Both sealed bids submitted -> resolve immediately!
  const b0 = nextBids[0];
  const b1 = nextBids[1];
  let winnerIdx: 0 | 1 = b0 >= b1 ? 0 : 1;
  if (b0 === b1) {
    // Tie-breaker: manager with higher remaining purse wins
    winnerIdx = teams[0].purse >= teams[1].purse ? 0 : 1;
  }
  const winningAmount = winnerIdx === 0 ? b0 : b1;
  const nextTeams: [TeamSetup, TeamSetup] = [...teams] as [TeamSetup, TeamSetup];
  nextTeams[winnerIdx] = assignPlayerToTeam(teams[winnerIdx], sb.lot, winningAmount);

  const revealLog = makeLog(
    state.round,
    `SEALED-BID REVEAL: ${teams[0].club.code} (€${b0}M) vs ${teams[1].club.code} (€${b1}M) → ${teams[winnerIdx].club.code} wins ${sb.lot.name} for €${winningAmount}M!`,
    'sealed'
  );

  const nextState = advanceToNextLot(state, nextTeams, [revealLog]);
  return { state: nextState, teams: nextTeams };
}

/**
 * Two-Pass Auto-Completion (Section 5):
 * Pass 1: Greedy OVR-sorted assignment from remaining pool within remaining purse & open positional slots.
 * Pass 2: OVR 62-64 Youth Academy Reserve fill so unsold superstars never leak for free.
 */
export function autoCompleteSquads(
  state: AuctionState,
  teams: [TeamSetup, TeamSetup]
): { state: AuctionState; teams: [TeamSetup, TeamSetup] } {
  const remainingPlayers = [
    ...(state.currentLot ? [state.currentLot] : []),
    ...state.pool,
    ...state.unsoldQueue,
  ].sort((a, b) => b.ovr - a.ovr);

  const nextTeams: [TeamSetup, TeamSetup] = [
    { ...teams[0], squad: [...teams[0].squad] },
    { ...teams[1], squad: [...teams[1].squad] },
  ];

  const takenIds = new Set<string>([
    ...nextTeams[0].squad.map((p) => p.id),
    ...nextTeams[1].squad.map((p) => p.id),
  ]);

  // Pass 1: Greedy OVR-sorted assignment within remaining purse (alternating pick order)
  let turn: 0 | 1 = nextTeams[0].squad.length <= nextTeams[1].squad.length ? 0 : 1;
  let progress = true;
  while (progress) {
    progress = false;
    for (let step = 0; step < 2; step++) {
      const idx: 0 | 1 = ((turn + step) % 2) as 0 | 1;
      const team = nextTeams[idx];
      if (team.squad.length >= 11) continue;

      const candidate = remainingPlayers.find(
        (pl) =>
          !takenIds.has(pl.id) &&
          canTeamBidOnPlayer(team, pl, getEffectiveBasePrice(pl, state.round)).ok
      );
      if (candidate) {
        const price = getEffectiveBasePrice(candidate, state.round);
        nextTeams[idx] = assignPlayerToTeam(team, candidate, price);
        takenIds.add(candidate.id);
        progress = true;
      }
    }
    turn = turn === 0 ? 1 : 0;
  }

  // Pass 2: OVR 62-64 Youth Academy Reserve fill for empty slots
  const positions: Position[] = ['GK', 'DEF', 'MID', 'FWD'];
  for (let idx = 0; idx < 2; idx++) {
    let team = nextTeams[idx];
    for (const pos of positions) {
      const counts = countPositions(team.squad);
      const needed = POSITION_QUOTAS[pos] - counts[pos];
      for (let k = 0; k < needed; k++) {
        const slot = FORMATION_SLOTS.find(
          (s) => s.pos === pos && !team.squad.some((p) => p.role === s.preferredRoles[0])
        );
        const role = slot ? slot.preferredRoles[0] : pos === 'GK' ? 'GK' : pos === 'DEF' ? 'CB' : pos === 'MID' ? 'CM' : 'ST';
        const reserve = createReservePlayer(pos, role, k + team.squad.length, team.club.code);
        team = assignPlayerToTeam(team, reserve, 0, true);
      }
    }
    nextTeams[idx] = finalizeTeamLineupDefaults(team);
  }

  return {
    state: {
      ...state,
      pool: [],
      unsoldQueue: [],
      currentLot: null,
      completed: true,
      logs: [
        makeLog(
          state.round,
          'Two-Pass Auto-Complete finalized both 11/11 squads (Youth Reserves padded open slots).',
          'system'
        ),
        ...state.logs.slice(0, 49),
      ],
    },
    teams: nextTeams,
  };
}

export function sortSquadToFormation(squad: SignedPlayer[]): SignedPlayer[] {
  const pool = [...squad];
  const arranged: SignedPlayer[] = [];
  for (const slot of FORMATION_SLOTS) {
    // Prefer exact role match in position, fallback to any matching position
    let idx = pool.findIndex(
      (pl) => pl.pos === slot.pos && slot.preferredRoles.includes(pl.role)
    );
    if (idx === -1) {
      idx = pool.findIndex((pl) => pl.pos === slot.pos);
    }
    if (idx === -1) idx = 0;
    if (pool.length > 0) {
      const [picked] = pool.splice(idx, 1);
      arranged.push({
        ...picked,
        squadNumber: arranged.length + 1,
      });
    }
  }
  return arranged;
}

export function finalizeTeamLineupDefaults(team: TeamSetup): TeamSetup {
  const sorted = sortSquadToFormation(team.squad);
  if (sorted.length === 0) return team;

  const captain = [...sorted].sort((a, b) => b.ovr - a.ovr)[0];
  const penalty = [...sorted].sort((a, b) => b.stats.sho - a.stats.sho)[0];
  const freeKick = [...sorted].sort(
    (a, b) =>
      b.stats.pas * 0.6 + b.stats.sho * 0.4 -
      (a.stats.pas * 0.6 + a.stats.sho * 0.4)
  )[0];

  const defaultBench: SignedPlayer[] =
    team.bench && team.bench.length > 0
      ? team.bench
      : ([
          ['DEF', 'CB'],
          ['MID', 'CM'],
          ['FWD', 'ST'],
        ] as const).map(([pos, role], idx) => ({
          ...createReservePlayer(pos, role, 20 + idx, team.club.code),
          ovr: 76 + idx * 2,
          stats:
            pos === 'DEF'
              ? { pac: 80, sho: 58, pas: 74, dri: 72, def: 81, phy: 82 }
              : pos === 'MID'
              ? { pac: 79, sho: 74, pas: 82, dri: 81, def: 72, phy: 76 }
              : { pac: 86, sho: 81, pas: 74, dri: 83, def: 42, phy: 77 },
          name: `${team.club.code} Impact ${role}`,
          paidPrice: 0,
          squadNumber: 12 + idx,
          isReserve: true,
        }));

  return {
    ...team,
    squad: sorted,
    bench: defaultBench,
    captainId: team.captainId && sorted.some((p) => p.id === team.captainId)
      ? team.captainId
      : captain.id,
    penaltyTakerId:
      team.penaltyTakerId && sorted.some((p) => p.id === team.penaltyTakerId)
        ? team.penaltyTakerId
        : penalty.id,
    freeKickTakerId:
      team.freeKickTakerId && sorted.some((p) => p.id === team.freeKickTakerId)
        ? team.freeKickTakerId
        : freeKick.id,
  };
}

export function computeTeamAverageOvr(squad: SignedPlayer[]): number {
  if (squad.length === 0) return 0;
  return Math.round(
    (squad.reduce((acc, p) => acc + p.ovr, 0) / squad.length) * 10
  ) / 10;
}

/**
 * Budget-aware AI Transfer Director for single-player "vs AI CPU Manager" mode.
 */
export function computeAIBidDecision(
  state: AuctionState,
  teams: [TeamSetup, TeamSetup],
  aiIdx: 0 | 1 = 1
): { shouldBid: boolean; amount: number } {
  const lot = state.currentLot;
  if (!lot || state.completed || state.highestBidder === aiIdx) {
    return { shouldBid: false, amount: 0 };
  }
  const aiTeam = teams[aiIdx];
  const slotsLeft = Math.max(1, 11 - aiTeam.squad.length);
  const minNext =
    state.highestBidder === null
      ? getEffectiveBasePrice(lot, state.round)
      : state.currentBid + 5;

  if (!canTeamBidOnPlayer(aiTeam, lot, minNext).ok) {
    return { shouldBid: false, amount: 0 };
  }

  // Reserve a modest buffer for remaining open slots
  const reserveBuffer = (slotsLeft - 1) * 12;
  const maxSpendable = Math.max(0, aiTeam.purse - reserveBuffer);
  const ovrFactor = Math.max(0.75, (lot.ovr - 75) / 14);
  const fairCeiling = Math.round(lot.base * (1.15 + ovrFactor * 0.45));

  if (minNext <= Math.min(maxSpendable, fairCeiling)) {
    const jump = lot.ovr >= 93 && minNext + 10 <= fairCeiling ? minNext + 10 : minNext;
    return { shouldBid: true, amount: Math.min(aiTeam.purse, jump) };
  }
  return { shouldBid: false, amount: 0 };
}
