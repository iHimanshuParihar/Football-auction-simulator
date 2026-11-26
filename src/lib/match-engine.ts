import { FORMATION_SLOTS } from '@/data/players';
import {
  MatchEvent,
  PassLink,
  ShotRecord,
  SignedPlayer,
  TacticalMentality,
  TeamMatchStats,
  TeamSetup,
  WeatherCondition,
} from '@/types/game';
import { clamp, mulberry32, weightedPick } from './prng';
import { computeTeamAverageOvr } from './auction-engine';

export type CelebrationStyle = 'knee_slide' | 'siuuu' | 'arms_wide' | 'jump_fist';
export type PlayerReaction = 'none' | 'hands_on_head' | 'appeal' | 'fist_pump';

export interface SimPlayerState {
  id: string;
  teamIdx: 0 | 1;
  slotIndex: number;
  player: SignedPlayer;
  /** Pitch coordinates: x in [0, 100], y in [0, 100] */
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: number; // radians
  stridePhase: number;
  kickTimer: number;
  diveTimer: number;
  diveDir: number;
  celebrating: boolean;
  celebrationStyle: CelebrationStyle;
  reactionType: PlayerReaction;
  reactionTimer: number;
  stamina: number;
  yellowCard: boolean;
  redCard: boolean;
  rating: number;
  goals: number;
  assists: number;
  heatmap: Array<{ x: number; y: number }>;
}

export interface BallState {
  x: number; // 0..100 (length 105m)
  y: number; // 0..100 (width 68m)
  z: number; // meters altitude
  vx: number;
  vy: number;
  vz: number;
  spinY: number; // Magnus lateral spin
  ownerId: string | null;
  passTargetId: string | null;
  passFlightTimer: number;
  lastTouchTeam: 0 | 1;
  lastTouchPlayerId: string | null;
  prevTouchPlayerId: string | null;
  trail: Array<{ x: number; y: number; z: number }>;
}

export interface GoalNetLattice {
  cols: number; // 24
  rows: number; // 12
  displacements: Float32Array;
  velocities: Float32Array;
}

export type MatchPeriod =
  | 'walkout'
  | 'first_half'
  | 'halftime'
  | 'second_half'
  | 'extra_first'
  | 'extra_second'
  | 'penalties'
  | 'fulltime';

export interface PenaltyKickRecord {
  round: number;
  teamIdx: 0 | 1;
  takerName: string;
  scored: boolean;
}

export type SetPieceKind =
  | 'throw_in'
  | 'corner'
  | 'goal_kick'
  | 'free_kick'
  | 'penalty';

export interface ActiveSetPiece {
  kind: SetPieceKind;
  teamIdx: 0 | 1;
  takerId: string;
  takerName: string;
  x: number;
  y: number;
  timer: number;
}

export interface GoalBannerInfo {
  scorer: SignedPlayer;
  assistName?: string;
  teamIdx: 0 | 1;
  minute: number;
  xg: number;
}

export interface ReplayFrame {
  ballX: number;
  ballY: number;
  ballZ: number;
  players: Array<{
    id: string;
    x: number;
    y: number;
    facing: number;
    stridePhase: number;
    diveTimer: number;
    diveDir: number;
  }>;
}

export interface VarCheckState {
  teamIdx: 0 | 1;
  scorerId: string;
  scorerName: string;
  lineX: number;
  defenderLineX: number;
  timer: number;
  outcome: 'pending' | 'confirmed' | 'disallowed';
  decisionShown: 'reviewing' | 'confirmed' | 'disallowed';
  xg: number;
  assistId?: string;
  assistName?: string;
}

export interface RefereeCardAlert {
  color: 'yellow' | 'red';
  playerId: string;
  playerName: string;
  teamIdx: 0 | 1;
  isSecondYellow?: boolean;
  timer: number;
}

export interface MatchSimSnapshot {
  period: MatchPeriod;
  minute: number;
  second: number;
  stats: [TeamMatchStats, TeamMatchStats];
  possessionPct: [number, number];
  events: MatchEvent[];
  penalties: PenaltyKickRecord[];
  penaltyScore: [number, number];
  replayTimer: number;
  replayPhase: 'celebration' | 'action_replay' | null;
  replayGoalTeam: 0 | 1 | null;
  goalBanner: GoalBannerInfo | null;
  varCheck: VarCheckState | null;
  subsUsed: [number, number];
  mentalities: [TacticalMentality, TacticalMentality];
  shotsLog: ShotRecord[];
  ballPos: { x: number; y: number };
  setPiece: ActiveSetPiece | null;
  refereeCardAlert: RefereeCardAlert | null;
  xgDanger: number; // 0..1 for crowd swell
  winnerIdx: 0 | 1 | 'draw' | null;
  motm: {
    name: string;
    teamIdx: 0 | 1;
    player: SignedPlayer;
    rating: number;
    goals: number;
    assists: number;
  } | null;
  playerHeatmaps: Array<{
    id: string;
    teamIdx: 0 | 1;
    name: string;
    role: string;
    squadNumber: number;
    rating: number;
    stamina: number;
    goals: number;
    assists: number;
    yellowCard: boolean;
    redCard: boolean;
    x: number;
    y: number;
    heatmap: Array<{ x: number; y: number }>;
  }>;
  topPassLinks: Array<{
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    teamIdx: 0 | 1;
    count: number;
  }>;
}

function emptyTeamStats(): TeamMatchStats {
  return {
    goals: 0,
    xg: 0,
    shots: 0,
    shotsOnTarget: 0,
    saves: 0,
    possessionTicks: 1,
    passes: 0,
    passesCompleted: 0,
    tackles: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    corners: 0,
    throwIns: 0,
    freeKicks: 0,
    penaltiesAwarded: 0,
  };
}

function mentalityShift(m: TacticalMentality): { linePush: number; press: number } {
  switch (m) {
    case 'High Press':
      return { linePush: 8, press: 1.25 };
    case 'Counter-Attack':
      return { linePush: -6, press: 0.85 };
    case 'Park the Bus':
      return { linePush: -13, press: 0.65 };
    default:
      return { linePush: 0, press: 1.0 };
  }
}

export class MatchSimulationEngine {
  public teams: [TeamSetup, TeamSetup];
  public players: SimPlayerState[] = [];
  public ball: BallState;
  public nets: [GoalNetLattice, GoalNetLattice];
  public stats: [TeamMatchStats, TeamMatchStats] = [emptyTeamStats(), emptyTeamStats()];
  public events: MatchEvent[] = [];
  public passLinks: Map<string, PassLink> = new Map();
  public period: MatchPeriod = 'walkout';
  public elapsedMatchSeconds = 0; // 0..5400 (or 7200 for ET)
  public replayTimer = 0;
  public replayGoalTeam: 0 | 1 | null = null;
  public replayScorerId: string | null = null;
  public goalBanner: (GoalBannerInfo & { timer: number }) | null = null;
  public varCheck: VarCheckState | null = null;
  public subsUsed: [number, number] = [0, 0];
  public shotsLog: ShotRecord[] = [];
  public setPiece: ActiveSetPiece | null = null;
  public refereeCardAlert: RefereeCardAlert | null = null;
  public xgDanger = 0;
  public penalties: PenaltyKickRecord[] = [];
  public penaltyScore: [number, number] = [0, 0];
  public winnerIdx: 0 | 1 | 'draw' | null = null;
  public weather: WeatherCondition;
  public knockoutFormat: 'single_leg' | 'two_legged';
  public firstLegScore?: { home: number; away: number };

  private rng: () => number;
  private homeShare: number;
  private actionCooldown = 0;
  private penaltyTimer = 0;
  private penaltyTurn = 0;
  private aiTeamIdx: 0 | 1 | null = null;
  private aiAdjustedAfter65 = false;
  private recentFrames: ReplayFrame[] = [];
  private replayPlaybackFrames: ReplayFrame[] = [];
  private onEventCb?: (evt: MatchEvent) => void;

  constructor(
    teams: [TeamSetup, TeamSetup],
    seed: number,
    weather: WeatherCondition,
    knockoutFormat: 'single_leg' | 'two_legged',
    firstLegScore?: { home: number; away: number },
    onEvent?: (evt: MatchEvent) => void,
    aiTeamIdx: 0 | 1 | null = null
  ) {
    this.teams = teams;
    this.aiTeamIdx = aiTeamIdx;
    this.rng = mulberry32(seed ^ 0x9e3779b9);
    this.weather = weather;
    this.knockoutFormat = knockoutFormat;
    this.firstLegScore = firstLegScore;
    this.onEventCb = onEvent;

    const homeOvr = computeTeamAverageOvr(teams[0].squad);
    const awayOvr = computeTeamAverageOvr(teams[1].squad);
    // Exact Section 6.3 HomeShare formula
    this.homeShare = clamp(0.5 + (homeOvr - awayOvr) * 0.018, 0.28, 0.72);

    this.ball = {
      x: 50,
      y: 50,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      spinY: 0,
      ownerId: null,
      passTargetId: null,
      passFlightTimer: 0,
      lastTouchTeam: 0,
      lastTouchPlayerId: null,
      prevTouchPlayerId: null,
      trail: [],
    };

    this.nets = [
      { cols: 24, rows: 12, displacements: new Float32Array(24 * 12), velocities: new Float32Array(24 * 12) },
      { cols: 24, rows: 12, displacements: new Float32Array(24 * 12), velocities: new Float32Array(24 * 12) },
    ];

    this.spawnPlayers();
  }

  private spawnPlayers(): void {
    this.players = [];
    for (let teamIdx = 0; teamIdx < 2; teamIdx++) {
      const tIdx = teamIdx as 0 | 1;
      const squad = this.teams[tIdx].squad;
      for (let slotIndex = 0; slotIndex < Math.min(11, squad.length); slotIndex++) {
        const slot = FORMATION_SLOTS[slotIndex];
        const x = tIdx === 0 ? slot.x : 100 - slot.x;
        const y = tIdx === 0 ? slot.y : 100 - slot.y;
        this.players.push({
          id: squad[slotIndex].id,
          teamIdx: tIdx,
          slotIndex,
          player: squad[slotIndex],
          x,
          y,
          vx: 0,
          vy: 0,
          facing: tIdx === 0 ? 0 : Math.PI,
          stridePhase: this.rng() * Math.PI * 2,
          kickTimer: 0,
          diveTimer: 0,
          diveDir: 1,
          celebrating: false,
          celebrationStyle: (['knee_slide', 'siuuu', 'arms_wide', 'jump_fist'] as const)[
            slotIndex % 4
          ],
          reactionType: 'none',
          reactionTimer: 0,
          stamina: 100,
          yellowCard: false,
          redCard: false,
          rating: 6.4,
          goals: 0,
          assists: 0,
          heatmap: [],
        });
      }
    }
  }

  public startKickoff(): void {
    if (this.period !== 'walkout') return;
    this.period = 'first_half';
    this.resetKickoffPositions(0);
    this.pushEvent({
      type: 'kickoff',
      teamIdx: 0,
      text: `KICKOFF! ${this.teams[0].club.name} gets us underway against ${this.teams[1].club.name}!`,
    });
  }

  public resumeSecondHalf(): void {
    if (this.period === 'halftime') {
      this.period = 'second_half';
      this.elapsedMatchSeconds = 45 * 60;
      this.resetKickoffPositions(1);
      this.pushEvent({
        type: 'kickoff',
        teamIdx: 1,
        text: `Second half underway! ${this.teams[1].club.name} kicks off.`,
      });
    }
  }

  public setMentality(teamIdx: 0 | 1, mentality: TacticalMentality): void {
    this.teams[teamIdx] = { ...this.teams[teamIdx], mentality };
  }

  public makeSubstitution(
    teamIdx: 0 | 1,
    outPlayerId: string,
    inPlayer: SignedPlayer
  ): boolean {
    if (this.subsUsed[teamIdx] >= 3) return false;
    const simPlayer = this.players.find(
      (p) => p.teamIdx === teamIdx && p.id === outPlayerId && !p.redCard
    );
    if (!simPlayer) return false;

    const oldName = simPlayer.player.name;
    simPlayer.id = inPlayer.id;
    simPlayer.player = inPlayer;
    simPlayer.stamina = 100;
    simPlayer.yellowCard = false;
    simPlayer.reactionType = 'fist_pump';
    simPlayer.reactionTimer = 1.3;
    this.subsUsed[teamIdx] += 1;

    const nextBench = (this.teams[teamIdx].bench ?? []).filter((b) => b.id !== inPlayer.id);
    this.teams[teamIdx] = { ...this.teams[teamIdx], bench: nextBench };

    this.pushEvent({
      type: 'substitution',
      teamIdx,
      playerId: inPlayer.id,
      playerName: inPlayer.name,
      text: `SUBSTITUTION (${this.teams[teamIdx].club.code}): ${inPlayer.name} replaces ${oldName}.`,
    });
    return true;
  }

  public simToFullTime(): void {
    if (this.period === 'walkout') this.startKickoff();
    let safety = 0;
    while (this.period !== 'fulltime' && safety < 15000) {
      safety += 1;
      if (this.replayTimer > 0) this.replayTimer = 0;
      if (this.refereeCardAlert) this.refereeCardAlert = null;
      this.step(0.05, 8);
      if (this.period === 'halftime') this.resumeSecondHalf();
    }
  }

  public getActiveReplayFrame(): ReplayFrame | null {
    if (this.varCheck && this.replayPlaybackFrames.length > 0) {
      // Loop final 20 frames leading up to the offside review point
      const tail = this.replayPlaybackFrames.slice(-22);
      const progress = (1 - Math.max(0, this.varCheck.timer) / 3.4) * 2.1;
      const idx = Math.min(
        tail.length - 1,
        Math.floor((progress % 1) * tail.length)
      );
      return tail[idx] ?? null;
    }
    if (
      this.replayTimer > 0 &&
      this.replayTimer <= 2.3 &&
      this.replayPlaybackFrames.length > 0
    ) {
      const progress = 1 - Math.max(0, this.replayTimer) / 2.3;
      const idx = Math.min(
        this.replayPlaybackFrames.length - 1,
        Math.floor(progress * this.replayPlaybackFrames.length)
      );
      return this.replayPlaybackFrames[idx] ?? null;
    }
    return null;
  }

  private captureReplayFrame(): void {
    const frame: ReplayFrame = {
      ballX: this.ball.x,
      ballY: this.ball.y,
      ballZ: this.ball.z,
      players: this.players.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        facing: p.facing,
        stridePhase: p.stridePhase,
        diveTimer: p.diveTimer,
        diveDir: p.diveDir,
      })),
    };
    this.recentFrames.push(frame);
    if (this.recentFrames.length > 48) {
      this.recentFrames.shift();
    }
  }

  private resetKickoffPositions(kickingTeam: 0 | 1): void {
    for (const p of this.players) {
      if (p.redCard) continue;
      const slot = FORMATION_SLOTS[p.slotIndex];
      const baseX = p.teamIdx === 0 ? Math.min(46, slot.x) : Math.max(54, 100 - slot.x);
      p.x = baseX;
      p.y = p.teamIdx === 0 ? slot.y : 100 - slot.y;
      p.vx = 0;
      p.vy = 0;
      p.celebrating = false;
    }
    this.ball.x = 50;
    this.ball.y = 50;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;
    this.ball.spinY = 0;
    this.ball.passTargetId = null;
    this.ball.passFlightTimer = 0;
    this.ball.trail = [];
    const striker = this.players.find(
      (p) => p.teamIdx === kickingTeam && p.slotIndex === 9 && !p.redCard
    );
    if (striker) {
      striker.x = kickingTeam === 0 ? 49 : 51;
      striker.y = 50;
      this.ball.ownerId = striker.id;
      this.ball.lastTouchTeam = kickingTeam;
      this.ball.lastTouchPlayerId = striker.id;
    }
  }

  public getMinute(): number {
    return Math.min(120, Math.floor(this.elapsedMatchSeconds / 60));
  }

  public getSecond(): number {
    return Math.floor(this.elapsedMatchSeconds % 60);
  }

  private pushEvent(partial: Omit<MatchEvent, 'id' | 'minute' | 'second'>): void {
    const evt: MatchEvent = {
      id: `${Date.now()}_${this.events.length}_${Math.floor(this.rng() * 999)}`,
      minute: this.getMinute(),
      second: this.getSecond(),
      ...partial,
    };
    this.events.unshift(evt);
    this.onEventCb?.(evt);
  }

  /**
   * Advances simulation by `dt` real seconds at `speedMultiplier` (1x, 2x, 4x).
   * In 1x mode, 1 real second = 18 match seconds (~5 minutes per 90m match),
   * keeping continuous 60fps 3D play crisp and engaging.
   */
  public step(dt: number, speedMultiplier = 1): void {
    const safeDt = Math.min(0.05, dt);
    this.stepNets(safeDt);

    if (this.period === 'walkout' || this.period === 'halftime' || this.period === 'fulltime') {
      return;
    }

    if (this.period === 'penalties') {
      this.stepPenalties(safeDt * speedMultiplier);
      return;
    }

    if (this.goalBanner) {
      this.goalBanner.timer = Math.max(0, this.goalBanner.timer - safeDt);
      if (this.goalBanner.timer === 0) this.goalBanner = null;
    }

    // Interactive VAR Offside Review Replay resolution
    if (this.varCheck) {
      this.varCheck.timer = Math.max(0, this.varCheck.timer - safeDt);
      if (this.varCheck.timer <= 1.2 && this.varCheck.decisionShown === 'reviewing') {
        this.varCheck.decisionShown = this.varCheck.outcome === 'disallowed' ? 'disallowed' : 'confirmed';
      }
      if (this.varCheck.timer === 0) {
        const vc = this.varCheck;
        this.varCheck = null;
        if (vc.outcome === 'disallowed') {
          const defTeam: 0 | 1 = vc.teamIdx === 0 ? 1 : 0;
          this.replayTimer = 0;
          this.replayGoalTeam = null;
          this.replayScorerId = null;
          this.goalBanner = null;
          for (const p of this.players) {
            p.celebrating = false;
          }
          this.scheduleSetPiece('free_kick', defTeam, vc.lineX, 50);
          this.pushEvent({
            type: 'var_check',
            teamIdx: vc.teamIdx,
            text: `VAR OVERTURN! ${vc.scorerName}'s goal is DISALLOWED for offside!`,
          });
        } else {
          this.finalizeValidGoal(vc);
        }
      }
      return;
    }

    // AI Manager tactical adaptation after 65'
    if (
      this.aiTeamIdx !== null &&
      !this.aiAdjustedAfter65 &&
      this.getMinute() >= 65
    ) {
      this.aiAdjustedAfter65 = true;
      const ai = this.aiTeamIdx;
      const opp: 0 | 1 = ai === 0 ? 1 : 0;
      if (this.stats[ai].goals < this.stats[opp].goals) {
        this.setMentality(ai, 'High Press');
      } else if (this.stats[ai].goals > this.stats[opp].goals) {
        this.setMentality(ai, 'Park the Bus');
      }
      const bench = this.teams[ai].bench ?? [];
      const tired = this.players
        .filter((p) => p.teamIdx === ai && !p.redCard && p.slotIndex > 0)
        .sort((a, b) => a.stamina - b.stamina)[0];
      if (bench.length > 0 && tired) {
        this.makeSubstitution(ai, tired.id, bench[0]);
      }
    }

    // Slow-motion Goal Replay & Celebration handling
    let simScale = speedMultiplier;
    if (this.replayTimer > 0) {
      this.replayTimer = Math.max(0, this.replayTimer - safeDt);
      simScale = 0.28; // dramatic slow motion
      this.stepGoalCelebration(safeDt);
      if (this.replayTimer === 0) {
        const concedingTeam: 0 | 1 = this.replayGoalTeam === 0 ? 1 : 0;
        this.replayGoalTeam = null;
        this.replayScorerId = null;
        this.resetKickoffPositions(concedingTeam);
      }
    }

    const matchSecAdvance = safeDt * 18 * simScale;
    this.elapsedMatchSeconds += matchSecAdvance;

    // Period transitions
    if (this.period === 'first_half' && this.elapsedMatchSeconds >= 45 * 60) {
      this.elapsedMatchSeconds = 45 * 60;
      this.period = 'halftime';
      this.pushEvent({
        type: 'halftime',
        teamIdx: 0,
        text: `HALF-TIME: ${this.teams[0].club.code} ${this.stats[0].goals} - ${this.stats[1].goals} ${this.teams[1].club.code}`,
      });
      return;
    }

    if (this.period === 'second_half' && this.elapsedMatchSeconds >= 90 * 60) {
      this.elapsedMatchSeconds = 90 * 60;
      if (this.isTieRequiringExtraTime()) {
        this.period = 'extra_first';
        this.resetKickoffPositions(0);
        this.pushEvent({
          type: 'extra_time',
          teamIdx: 0,
          text: `Level on aggregate! Match heads to EXTRA TIME (90' - 120')!`,
        });
        return;
      } else {
        this.finishMatch();
        return;
      }
    }

    if (this.period === 'extra_first' && this.elapsedMatchSeconds >= 105 * 60) {
      this.period = 'extra_second';
      this.resetKickoffPositions(1);
      this.pushEvent({
        type: 'extra_time',
        teamIdx: 1,
        text: `105' Extra Time Second Half underway!`,
      });
    }

    if (this.period === 'extra_second' && this.elapsedMatchSeconds >= 120 * 60) {
      this.elapsedMatchSeconds = 120 * 60;
      if (this.isTieRequiringExtraTime()) {
        this.period = 'penalties';
        this.penaltyTimer = 1.1;
        this.pushEvent({
          type: 'penalty_shootout',
          teamIdx: 0,
          text: `120' Still level! UEFA Champions League PENALTY SHOOTOUT!`,
        });
        return;
      } else {
        this.finishMatch();
        return;
      }
    }

    if (this.refereeCardAlert) {
      this.refereeCardAlert.timer = Math.max(0, this.refereeCardAlert.timer - safeDt);
      if (this.refereeCardAlert.timer === 0) {
        this.refereeCardAlert = null;
      } else {
        // Hold play briefly while referee displays Yellow/Red Card animation
        return;
      }
    }

    if (this.setPiece) {
      this.stepActiveSetPiece(safeDt * simScale);
      this.captureReplayFrame();
      return;
    }

    this.stepBallPhysics(safeDt * simScale);
    this.stepTacticalAI(safeDt * simScale);
    this.stepDiscreteMatchEvents(matchSecAdvance);
    if (this.replayTimer === 0 && !this.varCheck) {
      this.captureReplayFrame();
    }
  }

  private scheduleSetPiece(
    kind: SetPieceKind,
    teamIdx: 0 | 1,
    x: number,
    y: number
  ): void {
    const team = this.teams[teamIdx];
    const candidates = this.players.filter(
      (p) => p.teamIdx === teamIdx && !p.redCard
    );
    let taker: SimPlayerState | undefined;

    if (kind === 'goal_kick') {
      taker = candidates.find((p) => p.slotIndex === 0) ?? candidates[0];
    } else if (kind === 'penalty' && team.penaltyTakerId) {
      taker = candidates.find((p) => p.id === team.penaltyTakerId);
    } else if ((kind === 'free_kick' || kind === 'corner') && team.freeKickTakerId) {
      taker = candidates.find((p) => p.id === team.freeKickTakerId);
    }

    if (!taker) {
      const outfield = candidates.filter((p) => p.slotIndex > 0);
      taker = outfield.sort((a, b) => b.player.stats.pas - a.player.stats.pas)[0] ?? candidates[0];
    }
    if (!taker) return;

    taker.x = x;
    taker.y = y;
    taker.vx = 0;
    taker.vy = 0;
    this.ball.ownerId = null;
    this.ball.passTargetId = null;
    this.ball.passFlightTimer = 0;
    this.ball.trail = [];
    this.ball.x = x;
    this.ball.y = y;
    this.ball.z = 0;
    this.ball.vx = 0;
    this.ball.vy = 0;
    this.ball.vz = 0;

    this.setPiece = {
      kind,
      teamIdx,
      takerId: taker.id,
      takerName: taker.player.name,
      x,
      y,
      timer:
        kind === 'penalty'
          ? 1.55
          : kind === 'corner' || kind === 'throw_in'
            ? 1.35
            : 1.05,
    };
  }

  private stepActiveSetPiece(dt: number): void {
    const sp = this.setPiece;
    if (!sp) return;

    const taker = this.players.find((p) => p.id === sp.takerId);
    const attTeam = sp.teamIdx;
    const defTeam: 0 | 1 = attTeam === 0 ? 1 : 0;

    // Move players into realistic set-piece formations while waiting
    if (taker) {
      taker.x = sp.x;
      taker.y = sp.y;
      taker.facing = attTeam === 0 ? 0 : Math.PI;
    }

    if (sp.kind === 'corner') {
      const boxX = attTeam === 0 ? 90 : 10;
      for (const p of this.players) {
        if (p.id === sp.takerId || p.redCard || p.slotIndex === 0) continue;
        const tx = p.slotIndex >= 5 || p.teamIdx === defTeam
          ? boxX + ((p.slotIndex % 3) - 1) * 3.5
          : 50;
        const ty = 40 + (p.slotIndex % 5) * 5;
        this.movePlayerToward(p, tx, ty, dt, 1.1);
      }
    } else if (sp.kind === 'penalty') {
      const boxEdgeX = attTeam === 0 ? 79 : 21;
      for (const p of this.players) {
        if (p.id === sp.takerId || p.redCard || p.slotIndex === 0) continue;
        const ty = 30 + (p.slotIndex % 6) * 8;
        this.movePlayerToward(p, boxEdgeX, ty, dt, 1.1);
      }
    }

    sp.timer -= dt;
    if (sp.timer > 0) return;

    this.setPiece = null;
    if (!taker) return;

    if (sp.kind === 'throw_in' || sp.kind === 'goal_kick') {
      const targets = this.players.filter(
        (p) => p.teamIdx === attTeam && p.id !== taker.id && !p.redCard && p.slotIndex > 0
      );
      const sortedByDist = [...targets].sort(
        (a, b) => Math.hypot(a.x - taker.x, a.y - taker.y) - Math.hypot(b.x - taker.x, b.y - taker.y)
      );
      const realisticPool =
        sp.kind === 'throw_in' ? sortedByDist.slice(0, 4) : targets;
      const target = realisticPool.length
        ? weightedPick(realisticPool, (t) => Math.pow(t.player.stats.pas, 2), this.rng)
        : taker;
      if (target.id !== taker.id) {
        this.launchPass(taker, target, true, sp.kind === 'goal_kick' ? 5.6 : 2.2);
      } else {
        this.ball.ownerId = taker.id;
      }
      return;
    }

    if (sp.kind === 'corner') {
      const boxHeaders = this.players.filter(
        (p) => p.teamIdx === attTeam && p.id !== taker.id && !p.redCard && p.slotIndex >= 5
      );
      const header = boxHeaders.length
        ? weightedPick(boxHeaders, (h) => Math.pow(h.player.stats.phy + h.player.stats.sho, 2.2), this.rng)
        : taker;
      this.ball.spinY = sp.y < 50 ? 1.45 : -1.45;
      if (header.id !== taker.id) {
        this.launchPass(taker, header, true, 5.4);
      } else {
        this.executeShot(taker, attTeam, defTeam, 'from a whipped corner delivery');
      }
      return;
    }

    if (sp.kind === 'free_kick') {
      const goalDist = Math.abs((attTeam === 0 ? 100 : 0) - sp.x);
      if (goalDist <= 34) {
        taker.kickTimer = 0.4;
        this.ball.spinY = (this.rng() > 0.5 ? 1 : -1) * 1.65;
        this.executeShot(taker, attTeam, defTeam, 'with a curling direct free-kick');
      } else {
        const targets = this.players.filter(
          (p) => p.teamIdx === attTeam && p.id !== taker.id && !p.redCard && p.slotIndex > 0
        );
        const forwardTargets = targets.filter((t) =>
          attTeam === 0 ? t.x >= taker.x - 6 : t.x <= taker.x + 6
        );
        const pool = forwardTargets.length ? forwardTargets : targets;
        const target = pool.length
          ? weightedPick(pool, (t) => Math.pow(t.player.stats.pas + t.player.stats.dri, 1.8), this.rng)
          : taker;
        if (target.id !== taker.id) {
          this.launchPass(taker, target, true, 4.2);
        } else {
          this.ball.ownerId = taker.id;
        }
      }
      return;
    }

    if (sp.kind === 'penalty') {
      this.executePenaltyInMatch(taker, attTeam, defTeam);
    }
  }

  private executePenaltyInMatch(
    taker: SimPlayerState,
    attTeam: 0 | 1,
    defTeam: 0 | 1
  ): void {
    const oppGk = this.players.find((p) => p.teamIdx === defTeam && p.slotIndex === 0);
    const gkDef = oppGk ? oppGk.player.stats.def : 75;
    const pGoal = clamp(0.77 + (taker.player.stats.sho - gkDef) * 0.004, 0.58, 0.92);
    this.stats[attTeam].shots += 1;
    this.stats[attTeam].xg += 0.76;
    taker.kickTimer = 0.4;

    const goalX = attTeam === 0 ? 99.5 : 0.5;
    const goalY = 50 + (this.rng() > 0.5 ? 3.5 : -3.5);
    this.ball.ownerId = null;
    this.ball.vx = (goalX - taker.x) * 3.1;
    this.ball.vy = (goalY - taker.y) * 3.1;
    this.ball.vz = 2.6;

    if (this.rng() < pGoal) {
      this.stats[attTeam].shotsOnTarget += 1;
      this.stats[attTeam].goals += 1;
      taker.goals += 1;
      taker.celebrating = true;
      taker.rating = clamp(taker.rating + 1.0, 5, 10);
      if (oppGk) {
        oppGk.diveTimer = 0.75;
        oppGk.diveDir = goalY >= 50 ? -1 : 1;
      }
      this.triggerNetRipple(attTeam === 0 ? 1 : 0, 14, 6, 1.5);
      this.triggerGoalCelebration(taker, attTeam, undefined, 0.76);
      this.pushEvent({
        type: 'goal',
        teamIdx: attTeam,
        playerId: taker.id,
        playerName: taker.player.name,
        xg: 0.76,
        text: `PENALTY GOAL! ${taker.player.name} (${this.teams[attTeam].club.code}) buries it from 12 yards! (${this.stats[0].goals}-${this.stats[1].goals})`,
      });
    } else {
      this.stats[attTeam].shotsOnTarget += 1;
      this.stats[defTeam].saves += 1;
      if (oppGk) {
        oppGk.diveTimer = 0.75;
        oppGk.diveDir = goalY >= 50 ? 1 : -1;
        oppGk.rating = clamp(oppGk.rating + 0.8, 5, 10);
      }
      this.ball.ownerId = oppGk?.id ?? null;
      this.pushEvent({
        type: 'save',
        teamIdx: defTeam,
        playerId: oppGk?.id,
        playerName: oppGk?.player.name,
        xg: 0.76,
        text: `PENALTY SAVED! ${oppGk?.player.name ?? 'Keeper'} guesses right to deny ${taker.player.name}!`,
      });
    }
  }

  private isTieRequiringExtraTime(): boolean {
    let h = this.stats[0].goals;
    let a = this.stats[1].goals;
    if (this.knockoutFormat === 'two_legged' && this.firstLegScore) {
      h += this.firstLegScore.home;
      a += this.firstLegScore.away;
    }
    return h === a;
  }

  private finishMatch(): void {
    this.period = 'fulltime';
    let h = this.stats[0].goals;
    let a = this.stats[1].goals;
    if (this.knockoutFormat === 'two_legged' && this.firstLegScore) {
      h += this.firstLegScore.home;
      a += this.firstLegScore.away;
    }
    this.winnerIdx = h > a ? 0 : a > h ? 1 : 'draw';
    this.pushEvent({
      type: 'fulltime',
      teamIdx: this.winnerIdx === 1 ? 1 : 0,
      text: `FULL-TIME! ${this.teams[0].club.name} ${this.stats[0].goals} - ${this.stats[1].goals} ${this.teams[1].club.name}`,
    });
  }

  private stepPenalties(dt: number): void {
    this.penaltyTimer -= dt;
    if (this.penaltyTimer > 0) return;
    this.penaltyTimer = 1.4;

    const teamIdx: 0 | 1 = (this.penaltyTurn % 2) as 0 | 1;
    const round = Math.floor(this.penaltyTurn / 2) + 1;
    const takers = this.players
      .filter((p) => p.teamIdx === teamIdx && !p.redCard && p.slotIndex > 0)
      .sort((a, b) => b.player.stats.sho - a.player.stats.sho);
    const taker = takers[(round - 1) % takers.length];
    const oppGk = this.players.find((p) => p.teamIdx !== teamIdx && p.slotIndex === 0);

    const gkDef = oppGk ? oppGk.player.stats.def : 75;
    const prob = clamp(0.76 + (taker.player.stats.sho - gkDef) * 0.004, 0.55, 0.92);
    const scored = this.rng() < prob;

    if (scored) {
      this.penaltyScore[teamIdx] += 1;
      this.triggerNetRipple(teamIdx === 0 ? 1 : 0, 14, 6, 1.3);
    } else if (oppGk) {
      oppGk.diveTimer = 0.65;
      oppGk.diveDir = this.rng() > 0.5 ? 1 : -1;
    }

    this.penalties.push({
      round,
      teamIdx,
      takerName: taker.player.name,
      scored,
    });

    this.pushEvent({
      type: 'penalty_shootout',
      teamIdx,
      playerId: taker.id,
      playerName: taker.player.name,
      text: `PENALTY (${this.teams[teamIdx].club.code}): ${taker.player.name} ${scored ? 'SCORES!' : 'SAVED / MISSED!'} (${this.penaltyScore[0]} - ${this.penaltyScore[1]})`,
    });

    this.penaltyTurn += 1;

    // Check shootout decision after 5 rounds or unbeatable lead
    const kicks0 = this.penalties.filter((p) => p.teamIdx === 0).length;
    const kicks1 = this.penalties.filter((p) => p.teamIdx === 1).length;
    const rem0 = Math.max(0, 5 - kicks0);
    const rem1 = Math.max(0, 5 - kicks1);

    const lead0 = this.penaltyScore[0] - this.penaltyScore[1];
    const lead1 = this.penaltyScore[1] - this.penaltyScore[0];

    const decidedInFive =
      (kicks0 <= 5 && kicks1 <= 5 && (lead0 > rem1 || lead1 > rem0)) ||
      (kicks0 >= 5 && kicks0 === kicks1 && this.penaltyScore[0] !== this.penaltyScore[1]);

    if (decidedInFive) {
      this.winnerIdx = this.penaltyScore[0] > this.penaltyScore[1] ? 0 : 1;
      this.period = 'fulltime';
      this.pushEvent({
        type: 'fulltime',
        teamIdx: this.winnerIdx,
        text: `${this.teams[this.winnerIdx].club.name} WINS ${this.penaltyScore[0]} - ${this.penaltyScore[1]} ON PENALTIES!`,
      });
    }
  }

  private stepBallPhysics(dt: number): void {
    const b = this.ball;
    b.trail.push({ x: b.x, y: b.y, z: b.z });
    if (b.trail.length > 18) b.trail.shift();

    if (b.ownerId) {
      const owner = this.players.find((p) => p.id === b.ownerId);
      if (owner) {
        b.x = clamp(owner.x + Math.cos(owner.facing) * 1.1, 1, 99);
        b.y = clamp(owner.y + Math.sin(owner.facing) * 1.1, 1, 99);
        b.z = 0;
        b.vx = owner.vx;
        b.vy = owner.vy;
        b.vz = 0;
        return;
      }
      b.ownerId = null;
    }

    // Free flight: Gravity + Air Drag + Magnus Lateral Curve + Hydroplaning/Turf Friction
    const isPassingFlight = Boolean(b.passTargetId);
    const drag =
      b.z > 0.05
        ? isPassingFlight
          ? 0.996
          : 0.988
        : isPassingFlight
          ? 0.985
          : this.weather.includes('rain')
            ? 0.972
            : 0.96;
    // Magnus force perpendicular to horizontal velocity
    const magnusX = -b.vy * b.spinY * 0.45;
    const magnusY = b.vx * b.spinY * 0.45;

    b.vx = (b.vx + magnusX * dt) * Math.pow(drag, dt * 60);
    b.vy = (b.vy + magnusY * dt) * Math.pow(drag, dt * 60);

    if (b.z > 0 || b.vz !== 0) {
      b.vz -= 9.81 * dt;
      b.z += b.vz * dt;
      if (b.z <= 0) {
        b.z = 0;
        if (Math.abs(b.vz) > 1.8) {
          b.vz = -b.vz * 0.54;
        } else {
          b.vz = 0;
        }
      }
    }

    const nextX = b.x + b.vx * dt;
    const nextY = b.y + b.vy * dt;

    // Physical Touchline Out-of-Bounds -> THROW-IN
    if (!this.setPiece && (nextY <= 1.1 || nextY >= 98.9)) {
      const takerTeam: 0 | 1 = b.lastTouchTeam === 0 ? 1 : 0;
      this.stats[takerTeam].throwIns += 1;
      const throwY = nextY < 50 ? 2.2 : 97.8;
      this.scheduleSetPiece('throw_in', takerTeam, clamp(nextX, 8, 92), throwY);
      this.pushEvent({
        type: 'throw_in',
        teamIdx: takerTeam,
        text: `THROW-IN to ${this.teams[takerTeam].club.code} on the ${nextY < 50 ? 'far' : 'near'} touchline.`,
      });
      return;
    }

    // Physical Byline Out-of-Bounds outside goalposts -> CORNER KICK or GOAL KICK
    if (!this.setPiece && (nextX <= 0.45 || nextX >= 99.55) && Math.abs(nextY - 50) > 6.5) {
      const defTeamAtEnd: 0 | 1 = nextX <= 0.45 ? 0 : 1;
      const attTeamAtEnd: 0 | 1 = defTeamAtEnd === 0 ? 1 : 0;
      if (b.lastTouchTeam === defTeamAtEnd) {
        this.stats[attTeamAtEnd].corners += 1;
        const cornerX = defTeamAtEnd === 0 ? 1.5 : 98.5;
        const cornerY = nextY >= 50 ? 97.5 : 2.5;
        this.scheduleSetPiece('corner', attTeamAtEnd, cornerX, cornerY);
        this.pushEvent({
          type: 'corner',
          teamIdx: attTeamAtEnd,
          text: `CORNER KICK to ${this.teams[attTeamAtEnd].club.code} after the ball crosses the byline!`,
        });
      } else {
        const gkX = defTeamAtEnd === 0 ? 6 : 94;
        this.scheduleSetPiece('goal_kick', defTeamAtEnd, gkX, 50);
      }
      return;
    }

    b.x = clamp(nextX, 0.5, 99.5);
    b.y = clamp(nextY, 1.5, 98.5);

    // Physical pass reception & opponent interception check during ball flight (NO teleport snaps!)
    if (b.passTargetId) {
      b.passFlightTimer = Math.max(0, b.passFlightTimer - dt);
      const target = this.players.find((p) => p.id === b.passTargetId && !p.redCard);
      if (target) {
        const distToTarget = Math.hypot(target.x - b.x, target.y - b.y);
        if (distToTarget < 2.35 && b.z < 2.35) {
          b.ownerId = target.id;
          b.passTargetId = null;
          b.passFlightTimer = 0;
          b.lastTouchTeam = target.teamIdx;
          b.lastTouchPlayerId = target.id;
          b.z = 0;
          b.vz = 0;
          return;
        }
        // Check mid-flight interception by an opponent physically in the ball's path
        const interceptor = this.players.find(
          (p) =>
            p.teamIdx !== target.teamIdx &&
            !p.redCard &&
            p.slotIndex > 0 &&
            p.kickTimer <= 0 &&
            Math.hypot(p.x - b.x, p.y - b.y) < 1.55 &&
            b.z < 1.65
        );
        if (interceptor && this.rng() < 0.28) {
          this.stats[interceptor.teamIdx].tackles += 1;
          b.ownerId = interceptor.id;
          b.passTargetId = null;
          b.passFlightTimer = 0;
          b.prevTouchPlayerId = b.lastTouchPlayerId;
          b.lastTouchTeam = interceptor.teamIdx;
          b.lastTouchPlayerId = interceptor.id;
          interceptor.rating = clamp(interceptor.rating + 0.15, 5, 10);
          return;
        }
        if (b.passFlightTimer <= 0) {
          // Pass timer elapsed before arrival -> stays on the turf as a genuine loose ball
          b.passTargetId = null;
        }
      } else {
        b.passTargetId = null;
        b.passFlightTimer = 0;
      }
      return;
    }

    // Loose ball collection by any nearby active player
    if (b.z < 1.85) {
      let nearestLoose: SimPlayerState | null = null;
      let nearestDist = 1.9;
      for (const p of this.players) {
        if (p.redCard || p.kickTimer > 0) continue;
        const d = Math.hypot(p.x - b.x, p.y - b.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestLoose = p;
        }
      }
      if (nearestLoose) {
        b.ownerId = nearestLoose.id;
        b.prevTouchPlayerId = b.lastTouchPlayerId;
        b.lastTouchTeam = nearestLoose.teamIdx;
        b.lastTouchPlayerId = nearestLoose.id;
        b.z = 0;
        b.vz = 0;
      }
    }
  }

  private launchPass(
    fromPlayer: SimPlayerState,
    toPlayer: SimPlayerState,
    accurate = true,
    loftVz?: number
  ): void {
    const startX = clamp(fromPlayer.x + Math.cos(fromPlayer.facing) * 0.9, 1, 99);
    const startY = clamp(fromPlayer.y + Math.sin(fromPlayer.facing) * 0.9, 1.5, 98.5);
    const dist = Math.hypot(toPlayer.x - startX, toPlayer.y - startY);
    const flightDuration = clamp(dist / 30, 0.28, 1.05);

    let aimX = clamp(toPlayer.x + toPlayer.vx * flightDuration * 0.42, 2, 98);
    let aimY = clamp(toPlayer.y + toPlayer.vy * flightDuration * 0.42, 3, 97);
    if (!accurate) {
      aimX = clamp(aimX + (this.rng() - 0.5) * 14, 2, 98);
      aimY = clamp(aimY + (this.rng() - 0.5) * 14, 3, 97);
    }

    fromPlayer.facing = Math.atan2(aimY - fromPlayer.y, aimX - fromPlayer.x);
    fromPlayer.kickTimer = 0.28;

    this.ball.x = startX;
    this.ball.y = startY;
    this.ball.z = 0.08;
    this.ball.ownerId = null;
    this.ball.passTargetId = toPlayer.id;
    this.ball.passFlightTimer = flightDuration + 0.35;
    this.ball.prevTouchPlayerId = fromPlayer.id;
    this.ball.lastTouchPlayerId = fromPlayer.id;
    this.ball.lastTouchTeam = fromPlayer.teamIdx;

    // Slight drag compensation so the ball reaches the receiver smoothly along the pitch
    const dragBoost = 1.12;
    this.ball.vx = ((aimX - startX) / flightDuration) * dragBoost;
    this.ball.vy = ((aimY - startY) / flightDuration) * dragBoost;
    this.ball.vz = loftVz ?? (dist > 22 ? 4.4 : 0.65);
    if (!loftVz) {
      this.ball.spinY = (this.rng() - 0.5) * 0.42;
    }
  }

  private stepTacticalAI(dt: number): void {
    const b = this.ball;
    const shift0 = mentalityShift(this.teams[0].mentality);
    const shift1 = mentalityShift(this.teams[1].mentality);
    const owner = this.players.find((o) => o.id === b.ownerId);

    // Update offside lines
    const defs0 = this.players.filter((p) => p.teamIdx === 0 && p.slotIndex >= 1 && p.slotIndex <= 4 && !p.redCard);
    const defs1 = this.players.filter((p) => p.teamIdx === 1 && p.slotIndex >= 1 && p.slotIndex <= 4 && !p.redCard);
    const offside0 = defs0.length ? Math.min(...defs0.map((d) => d.x)) : 20;
    const offside1 = defs1.length ? Math.max(...defs1.map((d) => d.x)) : 80;

    // Identify closest active outfield chaser per team when ball is loose
    const findClosestChaser = (tIdx: 0 | 1): string | null => {
      let bestId: string | null = null;
      let bestDist = Infinity;
      for (const pl of this.players) {
        if (pl.teamIdx !== tIdx || pl.redCard || pl.slotIndex === 0) continue;
        const d = Math.hypot(pl.x - b.x, pl.y - b.y);
        if (d < bestDist) {
          bestDist = d;
          bestId = pl.id;
        }
      }
      return bestId;
    };
    const looseChaser0 = !owner && !b.passTargetId ? findClosestChaser(0) : null;
    const looseChaser1 = !owner && !b.passTargetId ? findClosestChaser(1) : null;

    for (const p of this.players) {
      if (p.redCard) continue;
      if (p.kickTimer > 0) p.kickTimer = Math.max(0, p.kickTimer - dt);
      if (p.diveTimer > 0) p.diveTimer = Math.max(0, p.diveTimer - dt);
      if (p.reactionTimer > 0) {
        p.reactionTimer = Math.max(0, p.reactionTimer - dt);
        if (p.reactionTimer === 0) p.reactionType = 'none';
      }

      const slot = FORMATION_SLOTS[p.slotIndex];
      const isHome = p.teamIdx === 0;
      const shift = isHome ? shift0 : shift1;
      const teamHasBall = owner?.teamIdx === p.teamIdx || b.lastTouchTeam === p.teamIdx;

      if (p.slotIndex === 0) {
        // Goalkeeper angle bisection between ball and goal center
        const goalX = isHome ? 2.5 : 97.5;
        const targetY = clamp(50 + (b.y - 50) * 0.24, 42, 58);
        const targetX = isHome ? clamp(goalX + (b.x - goalX) * 0.06, 2, 7.5) : clamp(goalX + (b.x - goalX) * 0.06, 92.5, 98);
        this.movePlayerToward(p, targetX, targetY, dt, 0.75);
        continue;
      }

      const baseTargetX = isHome ? slot.x : 100 - slot.x;
      const baseTargetY = isHome ? slot.y : 100 - slot.y;
      const dir = isHome ? 1 : -1;

      // Dynamic formation elasticity + possession width vs compact defending
      const widthSpread = teamHasBall ? 1.12 : 0.85;
      const ballPullX = (b.x - 50) * 0.44 * slot.discipline;
      const ballPullY = (b.y - 50) * 0.28 * slot.discipline;
      let targetX = baseTargetX + ballPullX + dir * shift.linePush;
      let targetY = 50 + (baseTargetY - 50) * widthSpread + ballPullY;

      // Overlapping full-backs (LB/RB) surge forward when team attacks
      if ((p.slotIndex === 1 || p.slotIndex === 4) && teamHasBall && (isHome ? b.x > 52 : b.x < 48)) {
        targetX += dir * 18;
      }

      // Fast wingers (PAC >= 90) make diagonal runs behind offside line when creative MID has ball
      if (
        owner &&
        owner.teamIdx === p.teamIdx &&
        owner.player.pos === 'MID' &&
        owner.player.stats.pas >= 90 &&
        p.player.pos === 'FWD' &&
        p.player.stats.pac >= 90
      ) {
        targetX = isHome ? Math.min(offside1 - 1.5, 89) : Math.max(offside0 + 1.5, 11);
        targetY = 50 + (baseTargetY - 50) * 0.65;
      }

      // If this player owns the ball, dribble intelligently toward space/goal; if receiving/chasing loose ball, run onto ball
      if (b.ownerId === p.id) {
        targetX = isHome ? 88 : 12;
        targetY = 50 + Math.sin(this.elapsedMatchSeconds * 0.08 + p.slotIndex) * 14;
      } else if (b.passTargetId === p.id || looseChaser0 === p.id || looseChaser1 === p.id) {
        targetX = b.x;
        targetY = b.y;
      } else {
        // Nearest chaser presses the ball
        const distToBall = Math.hypot(p.x - b.x, p.y - b.y);
        if (distToBall < 14 * shift.press && (!owner || owner.teamIdx !== p.teamIdx)) {
          targetX = b.x;
          targetY = b.y;
        }
      }

      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 4.5) {
        p.stamina = Math.max(35, p.stamina - dt * (1.2 - p.player.stats.phy * 0.006));
      }
      const staminaMod = 0.8 + (p.stamina / 100) * 0.2;
      const paceFactor = (0.74 + (p.player.stats.pac / 100) * 0.45) * staminaMod;
      this.movePlayerToward(p, clamp(targetX, 3, 97), clamp(targetY, 4, 96), dt, paceFactor);

      // Sample player heatmap sparsely
      if (this.rng() < 0.04) {
        p.heatmap.push({ x: Math.round(p.x), y: Math.round(p.y) });
        if (p.heatmap.length > 65) p.heatmap.shift();
      }
    }

    // Update xG danger meter based on ball proximity to goals
    const dangerLeft = clamp((24 - b.x) / 24, 0, 1);
    const dangerRight = clamp((b.x - 76) / 24, 0, 1);
    this.xgDanger = Math.max(dangerLeft, dangerRight);
  }

  private movePlayerToward(
    p: SimPlayerState,
    tx: number,
    ty: number,
    dt: number,
    speedFactor: number
  ): void {
    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.25) {
      p.vx *= 0.8;
      p.vy *= 0.8;
      return;
    }
    const maxSpeed = 9.5 * speedFactor;
    const stepSpeed = Math.min(maxSpeed, dist * 3.2);
    p.vx = (dx / dist) * stepSpeed;
    p.vy = (dy / dist) * stepSpeed;
    p.x = clamp(p.x + p.vx * dt, 1.5, 98.5);
    p.y = clamp(p.y + p.vy * dt, 2.5, 97.5);
    p.facing = Math.atan2(p.vy, p.vx);
    p.stridePhase += stepSpeed * dt * 1.4;
  }

  private stepDiscreteMatchEvents(matchSecDt: number): void {
    if (this.replayTimer > 0) return;

    this.actionCooldown -= matchSecDt;
    if (this.actionCooldown > 0) return;
    this.actionCooldown = 14.5; // ~370 tactical possessions per 90 mins regardless of speed multiplier

    const owner = this.players.find((p) => p.id === this.ball.ownerId && !p.redCard);
    if (!owner) {
      // Never teleport the ball while a pass is in flight or loose ball is moving
      if (this.ball.passTargetId || Math.hypot(this.ball.vx, this.ball.vy) > 1.8 || this.ball.z > 0.25) {
        return;
      }
      // Only attach settled dead ball to the nearest player physically right next to it
      let nearest: SimPlayerState | null = null;
      let nearestD = Infinity;
      for (const p of this.players) {
        if (p.redCard || p.slotIndex === 0) continue;
        const d = Math.hypot(p.x - this.ball.x, p.y - this.ball.y);
        if (d < nearestD) {
          nearestD = d;
          nearest = p;
        }
      }
      if (nearest && nearestD < 4.5) {
        this.ball.ownerId = nearest.id;
        this.ball.lastTouchTeam = nearest.teamIdx;
        this.ball.lastTouchPlayerId = nearest.id;
      }
      return;
    }

    const attTeam = owner.teamIdx;
    const defTeam: 0 | 1 = attTeam === 0 ? 1 : 0;
    this.stats[attTeam].possessionTicks += 1;

    const attackingGoalX = attTeam === 0 ? 100 : 0;
    const distToGoal = Math.abs(attackingGoalX - owner.x);

    // 1. Check interception / tackle / foul ONLY when a defender is actually near the ball carrier
    const defenders = this.players.filter((p) => p.teamIdx === defTeam && !p.redCard && p.slotIndex > 0);
    const closestDef = defenders.reduce(
      (best, d) => (Math.hypot(d.x - owner.x, d.y - owner.y) < Math.hypot(best.x - owner.x, best.y - owner.y) ? d : best),
      defenders[0]
    );
    const closestDefDist = closestDef
      ? Math.hypot(closestDef.x - owner.x, closestDef.y - owner.y)
      : Infinity;

    if (closestDef && closestDefDist < 7.5 && this.rng() < 0.26) {
      const tackler = closestDef;
      const stealChance = clamp(
        0.38 + (tackler.player.stats.def - owner.player.stats.dri) * 0.008,
        0.2,
        0.74
      );
      if (this.rng() < stealChance) {
        this.stats[defTeam].tackles += 1;
        this.ball.ownerId = tackler.id;
        this.ball.passTargetId = null;
        this.ball.prevTouchPlayerId = this.ball.lastTouchPlayerId;
        this.ball.lastTouchTeam = defTeam;
        this.ball.lastTouchPlayerId = tackler.id;
        tackler.rating = clamp(tackler.rating + 0.12, 5, 10);
        return;
      } else if (this.rng() < 0.28) {
        // Foul / Disciplinary Card / Free Kick / In-Match Penalty Check
        this.stats[defTeam].fouls += 1;
        const cardRoll = this.rng();
        if (cardRoll < 0.04 && !tackler.yellowCard) {
          tackler.redCard = true;
          this.stats[defTeam].redCards += 1;
          this.refereeCardAlert = {
            color: 'red',
            playerId: tackler.id,
            playerName: tackler.player.name,
            teamIdx: defTeam,
            timer: 2.6,
          };
          tackler.rating = clamp(tackler.rating - 1.4, 3, 10);
          this.pushEvent({
            type: 'red_card',
            teamIdx: defTeam,
            playerId: tackler.id,
            playerName: tackler.player.name,
            text: `RED CARD! ${tackler.player.name} (${this.teams[defTeam].club.code}) is sent off for a reckless challenge!`,
          });
        } else if (cardRoll < 0.34) {
          if (tackler.yellowCard) {
            tackler.redCard = true;
            this.stats[defTeam].redCards += 1;
            this.refereeCardAlert = {
              color: 'red',
              playerId: tackler.id,
              playerName: tackler.player.name,
              teamIdx: defTeam,
              isSecondYellow: true,
              timer: 2.6,
            };
            this.pushEvent({
              type: 'red_card',
              teamIdx: defTeam,
              playerId: tackler.id,
              playerName: tackler.player.name,
              text: `SECOND YELLOW & RED! ${tackler.player.name} (${this.teams[defTeam].club.code}) walks!`,
            });
          } else {
            tackler.yellowCard = true;
            this.stats[defTeam].yellowCards += 1;
            this.refereeCardAlert = {
              color: 'yellow',
              playerId: tackler.id,
              playerName: tackler.player.name,
              teamIdx: defTeam,
              timer: 2.4,
            };
            tackler.rating = clamp(tackler.rating - 0.3, 4, 10);
            this.pushEvent({
              type: 'yellow_card',
              teamIdx: defTeam,
              playerId: tackler.id,
              playerName: tackler.player.name,
              text: `YELLOW CARD: ${tackler.player.name} (${this.teams[defTeam].club.code}) booked for a late tackle.`,
            });
          }
        }

        // Foul reactions: nearby players appeal to the referee
        owner.reactionType = 'appeal';
        owner.reactionTimer = 1.4;
        tackler.reactionType = 'appeal';
        tackler.reactionTimer = 1.4;

        // Check if foul occurred inside defensive penalty box -> PENALTY KICK!
        const inBox = distToGoal < 16.5 && Math.abs(owner.y - 50) < 21;
        if (inBox && this.rng() < 0.45) {
          this.stats[attTeam].penaltiesAwarded += 1;
          const spotX = attTeam === 0 ? 89 : 11;
          this.scheduleSetPiece('penalty', attTeam, spotX, 50);
          this.pushEvent({
            type: 'penalty_awarded',
            teamIdx: attTeam,
            playerId: owner.id,
            playerName: owner.player.name,
            text: `PENALTY AWARDED! ${tackler.player.name} brings down ${owner.player.name} inside the area!`,
          });
        } else {
          this.stats[attTeam].freeKicks += 1;
          this.scheduleSetPiece('free_kick', attTeam, clamp(owner.x, 8, 92), clamp(owner.y, 8, 92));
          this.pushEvent({
            type: 'free_kick',
            teamIdx: attTeam,
            text: `FREE KICK to ${this.teams[attTeam].club.code} after a foul on ${owner.player.name}.`,
          });
        }
        return;
      }
    }

    // 1b. Touchline Throw-In check on wide wing play
    if ((owner.y <= 21 || owner.y >= 79) && this.rng() < 0.15) {
      this.stats[defTeam].throwIns += 1;
      const throwY = owner.y < 50 ? 2.2 : 97.8;
      this.scheduleSetPiece('throw_in', defTeam, clamp(owner.x, 8, 92), throwY);
      this.pushEvent({
        type: 'throw_in',
        teamIdx: defTeam,
        text: `THROW-IN to ${this.teams[defTeam].club.code} on the ${owner.y < 50 ? 'far' : 'near'} touchline.`,
      });
      return;
    }

    // 1c. Byline cross deflected behind for a Corner Kick
    if (distToGoal < 24 && Math.abs(owner.y - 50) > 20 && this.rng() < 0.14) {
      this.stats[attTeam].corners += 1;
      const cornerX = attTeam === 0 ? 98.5 : 1.5;
      const cornerY = owner.y >= 50 ? 97.5 : 2.5;
      this.scheduleSetPiece('corner', attTeam, cornerX, cornerY);
      this.pushEvent({
        type: 'corner',
        teamIdx: attTeam,
        playerId: owner.id,
        playerName: owner.player.name,
        text: `CORNER KICK! ${owner.player.name}'s dangerous low cross is turned behind!`,
      });
      return;
    }

    // 2. Shooting opportunity in attacking third! (~22-28 shots per 90 mins)
    if (distToGoal < 33 && this.rng() < 0.21) {
      this.executeShot(owner, attTeam, defTeam);
      return;
    }

    // 3. Progressive Pass weighted by PAS ^ 2.4 & sensible passing range
    if (this.rng() < 0.62) {
      const teammates = this.players.filter(
        (p) =>
          p.teamIdx === attTeam &&
          p.id !== owner.id &&
          !p.redCard &&
          Math.hypot(p.x - owner.x, p.y - owner.y) >= 4 &&
          Math.hypot(p.x - owner.x, p.y - owner.y) <= 55
      );
      if (teammates.length > 0) {
        const target = weightedPick(
          teammates,
          (tm) => {
            const d = Math.hypot(tm.x - owner.x, tm.y - owner.y);
            const rangeScore = d < 32 ? 1.45 : 0.85;
            const forwardBonus =
              attTeam === 0 ? (tm.x > owner.x - 6 ? 1.6 : 0.55) : tm.x < owner.x + 6 ? 1.6 : 0.55;
            return (
              Math.pow(tm.player.stats.pas * 0.4 + tm.player.stats.dri * 0.3 + tm.player.stats.sho * 0.3, 2.4) *
              rangeScore *
              forwardBonus
            );
          },
          this.rng
        );

        this.stats[attTeam].passes += 1;
        const passSuccess = clamp(0.68 + (owner.player.stats.pas - 70) * 0.006, 0.55, 0.94);
        const accurate = this.rng() < passSuccess;
        if (accurate) {
          this.stats[attTeam].passesCompleted += 1;
          const linkKey = `${owner.id}->${target.id}`;
          const prevLink = this.passLinks.get(linkKey);
          this.passLinks.set(linkKey, {
            fromId: owner.id,
            toId: target.id,
            count: (prevLink?.count ?? 0) + 1,
          });
        }
        this.launchPass(owner, target, accurate);
      }
    }
  }

  private executeShot(
    shooter: SimPlayerState,
    attTeam: 0 | 1,
    defTeam: 0 | 1,
    flavorNote = ''
  ): void {
    // Shoot strictly from the current ball carrier's real position (no random player warp)
    const chosenShooter = shooter;

    const oppGk = this.players.find((p) => p.teamIdx === defTeam && p.slotIndex === 0);
    const gkDef = oppGk ? oppGk.player.stats.def : 75;

    // Realistic UCL Shot Conversion & xG model
    const rawPGoal = 0.14 + (chosenShooter.player.stats.sho - gkDef) * 0.004;
    const pGoal = clamp(rawPGoal, 0.06, 0.28);
    const shotXg = clamp(pGoal * 0.92, 0.05, 0.35);

    this.stats[attTeam].shots += 1;
    this.stats[attTeam].xg += Number(shotXg.toFixed(2));
    chosenShooter.kickTimer = 0.35;

    // Launch 3D ball trajectory with Magnus curve
    const goalX = attTeam === 0 ? 99.5 : 0.5;
    const goalY = 50 + (this.rng() - 0.5) * 9.5;
    this.ball.ownerId = null;
    this.ball.vx = (goalX - chosenShooter.x) * 2.7;
    this.ball.vy = (goalY - chosenShooter.y) * 2.7;
    this.ball.vz = 3.6 + this.rng() * 3.8;
    this.ball.spinY = (this.rng() - 0.5) * 1.4;

    const roll = this.rng();
    if (roll < pGoal) {
      // Check for marginal VAR Offside Review (~18% of open-play goals)
      if (!flavorNote.includes('penalty') && this.rng() < 0.18) {
        const lineX = attTeam === 0 ? clamp(chosenShooter.x + 2, 76, 94) : clamp(chosenShooter.x - 2, 6, 24);
        const disallowed = this.rng() < 0.25;
        const defenderLineX = disallowed
          ? clamp(lineX + (attTeam === 0 ? -1.4 : 1.4), 5, 95)
          : clamp(lineX + (attTeam === 0 ? 1.4 : -1.4), 5, 95);
        this.replayPlaybackFrames = [...this.recentFrames];
        this.varCheck = {
          teamIdx: attTeam,
          scorerId: chosenShooter.id,
          scorerName: chosenShooter.player.name,
          lineX,
          defenderLineX,
          timer: 3.4,
          outcome: disallowed ? 'disallowed' : 'confirmed',
          decisionShown: 'reviewing',
          xg: Number(shotXg.toFixed(2)),
          assistId: this.ball.prevTouchPlayerId ?? undefined,
          assistName: this.players.find((p) => p.id === this.ball.prevTouchPlayerId && p.teamIdx === attTeam)?.player.name,
        };
        this.pushEvent({
          type: 'var_check',
          teamIdx: attTeam,
          playerId: chosenShooter.id,
          playerName: chosenShooter.player.name,
          text: `VAR CHECK: Reviewing potential offside on ${chosenShooter.player.name}...`,
        });
        return;
      }

      // GOAL!
      this.shotsLog.push({
        x: chosenShooter.x,
        y: chosenShooter.y,
        teamIdx: attTeam,
        shooterName: chosenShooter.player.name,
        xg: Number(shotXg.toFixed(2)),
        outcome: 'goal',
        minute: this.getMinute(),
      });
      this.stats[attTeam].shotsOnTarget += 1;
      this.stats[attTeam].goals += 1;
      chosenShooter.goals += 1;
      chosenShooter.celebrating = true;
      chosenShooter.rating = clamp(chosenShooter.rating + 1.15, 5, 10);

      let assister: SimPlayerState | undefined;
      if (this.ball.prevTouchPlayerId && this.ball.prevTouchPlayerId !== chosenShooter.id) {
        assister = this.players.find(
          (p) => p.id === this.ball.prevTouchPlayerId && p.teamIdx === attTeam
        );
      }
      if (!assister) {
        const creators = this.players.filter(
          (p) => p.teamIdx === attTeam && p.id !== chosenShooter.id && !p.redCard && p.slotIndex > 0
        );
        if (creators.length > 0 && this.rng() < 0.78) {
          assister = weightedPick(creators, (c) => Math.pow(c.player.stats.pas, 2.4), this.rng);
        }
      }
      if (assister) {
        assister.assists += 1;
        assister.rating = clamp(assister.rating + 0.65, 5, 10);
      }

      if (oppGk) {
        oppGk.diveTimer = 0.75;
        oppGk.diveDir = goalY >= 50 ? 1 : -1;
      }

      // Ripple spring-mass goal net!
      this.triggerNetRipple(
        attTeam === 0 ? 1 : 0,
        Math.floor(clamp(((goalY - 44) / 12) * 24, 2, 21)),
        Math.floor(clamp((this.ball.vz / 8) * 10, 2, 10)),
        1.5
      );

      this.triggerGoalCelebration(chosenShooter, attTeam, assister?.player.name, Number(shotXg.toFixed(2)));

      this.pushEvent({
        type: 'goal',
        teamIdx: attTeam,
        playerId: chosenShooter.id,
        playerName: chosenShooter.player.name,
        assistId: assister?.id,
        assistName: assister?.player.name,
        xg: Number(shotXg.toFixed(2)),
        text: `GOAL! ${chosenShooter.player.name} (${this.teams[attTeam].club.code}) scores${flavorNote ? ` ${flavorNote}` : ''}${assister ? ` — assist by ${assister.player.name}` : ''}! (${this.stats[0].goals}-${this.stats[1].goals})`,
      });
    } else if (roll < pGoal + 0.36) {
      // Goalkeeper Save -> either caught or tipped behind for a CORNER KICK!
      this.shotsLog.push({
        x: chosenShooter.x,
        y: chosenShooter.y,
        teamIdx: attTeam,
        shooterName: chosenShooter.player.name,
        xg: Number(shotXg.toFixed(2)),
        outcome: 'save',
        minute: this.getMinute(),
      });
      this.stats[attTeam].shotsOnTarget += 1;
      this.stats[defTeam].saves += 1;
      if (oppGk) {
        oppGk.diveTimer = 0.65;
        oppGk.diveDir = goalY >= 50 ? 1 : -1;
        oppGk.reactionType = 'fist_pump';
        oppGk.reactionTimer = 1.6;
        oppGk.rating = clamp(oppGk.rating + 0.35, 5, 10);
      }
      chosenShooter.reactionType = 'hands_on_head';
      chosenShooter.reactionTimer = 1.5;
      if (this.rng() < 0.42) {
        this.stats[attTeam].corners += 1;
        const cornerX = attTeam === 0 ? 98.5 : 1.5;
        const cornerY = goalY >= 50 ? 97.5 : 2.5;
        this.scheduleSetPiece('corner', attTeam, cornerX, cornerY);
        this.pushEvent({
          type: 'corner',
          teamIdx: attTeam,
          playerId: oppGk?.id,
          playerName: oppGk?.player.name,
          xg: Number(shotXg.toFixed(2)),
          text: `TIPPED BEHIND! ${oppGk?.player.name ?? 'Goalkeeper'} palms away ${chosenShooter.player.name}'s effort — CORNER KICK to ${this.teams[attTeam].club.code}!`,
        });
      } else {
        // Shot flies physically toward the keeper's gloves rather than snapping immediately
        if (oppGk) {
          this.launchPass(chosenShooter, oppGk, true, 2.2);
          this.ball.vz = 2.2;
        } else {
          this.ball.ownerId = null;
        }
        this.pushEvent({
          type: 'save',
          teamIdx: defTeam,
          playerId: oppGk?.id,
          playerName: oppGk?.player.name,
          xg: Number(shotXg.toFixed(2)),
          text: `BIG SAVE! ${oppGk?.player.name ?? 'Goalkeeper'} denies ${chosenShooter.player.name} at full stretch!`,
        });
      }
    } else if (roll < pGoal + 0.50) {
      // Woodwork!
      this.shotsLog.push({
        x: chosenShooter.x,
        y: chosenShooter.y,
        teamIdx: attTeam,
        shooterName: chosenShooter.player.name,
        xg: Number(shotXg.toFixed(2)),
        outcome: 'woodwork',
        minute: this.getMinute(),
      });
      this.ball.vx *= -0.45;
      this.ball.vz = 4.5;
      chosenShooter.reactionType = 'hands_on_head';
      chosenShooter.reactionTimer = 1.7;
      this.pushEvent({
        type: 'woodwork',
        teamIdx: attTeam,
        playerId: chosenShooter.id,
        playerName: chosenShooter.player.name,
        xg: Number(shotXg.toFixed(2)),
        text: `OFF THE WOODWORK! ${chosenShooter.player.name}'s curler rattles the crossbar!`,
      });
    } else {
      // Wide / Over -> Goal Kick or Corner
      this.shotsLog.push({
        x: chosenShooter.x,
        y: chosenShooter.y,
        teamIdx: attTeam,
        shooterName: chosenShooter.player.name,
        xg: Number(shotXg.toFixed(2)),
        outcome: 'miss',
        minute: this.getMinute(),
      });
      if (this.rng() < 0.25) {
        this.stats[attTeam].corners += 1;
        const cornerX = attTeam === 0 ? 98.5 : 1.5;
        const cornerY = goalY >= 50 ? 97.5 : 2.5;
        this.scheduleSetPiece('corner', attTeam, cornerX, cornerY);
        this.pushEvent({
          type: 'corner',
          teamIdx: attTeam,
          text: `Deflected wide! CORNER KICK awarded to ${this.teams[attTeam].club.code}.`,
        });
      } else {
        const gkX = defTeam === 0 ? 6 : 94;
        this.scheduleSetPiece('goal_kick', defTeam, gkX, 50);
        this.pushEvent({
          type: 'miss',
          teamIdx: attTeam,
          playerId: chosenShooter.id,
          playerName: chosenShooter.player.name,
          xg: Number(shotXg.toFixed(2)),
          text: `Close! ${chosenShooter.player.name} flashes a strike just wide — Goal Kick.`,
        });
      }
    }
  }

  private finalizeValidGoal(vc: VarCheckState): void {
    const scorer = this.players.find((p) => p.id === vc.scorerId);
    if (!scorer) return;
    this.shotsLog.push({
      x: scorer.x,
      y: scorer.y,
      teamIdx: vc.teamIdx,
      shooterName: scorer.player.name,
      xg: vc.xg,
      outcome: 'goal',
      minute: this.getMinute(),
    });
    this.stats[vc.teamIdx].shotsOnTarget += 1;
    this.stats[vc.teamIdx].goals += 1;
    scorer.goals += 1;
    scorer.rating = clamp(scorer.rating + 1.15, 5, 10);
    if (vc.assistId) {
      const assister = this.players.find((p) => p.id === vc.assistId);
      if (assister) {
        assister.assists += 1;
        assister.rating = clamp(assister.rating + 0.65, 5, 10);
      }
    }
    this.triggerNetRipple(vc.teamIdx === 0 ? 1 : 0, 12, 6, 1.5);
    this.triggerGoalCelebration(scorer, vc.teamIdx, vc.assistName, vc.xg);
    this.pushEvent({
      type: 'goal',
      teamIdx: vc.teamIdx,
      playerId: scorer.id,
      playerName: scorer.player.name,
      assistId: vc.assistId,
      assistName: vc.assistName,
      xg: vc.xg,
      text: `VAR CONFIRMED! GOAL STANDS for ${scorer.player.name} (${this.teams[vc.teamIdx].club.code})! (${this.stats[0].goals}-${this.stats[1].goals})`,
    });
  }

  private triggerGoalCelebration(
    scorer: SimPlayerState,
    attTeam: 0 | 1,
    assistName: string | undefined,
    xg: number
  ): void {
    const styles: SimPlayerState['celebrationStyle'][] = [
      'knee_slide',
      'siuuu',
      'arms_wide',
      'jump_fist',
    ];
    scorer.celebrating = true;
    scorer.celebrationStyle = styles[Math.floor(this.rng() * styles.length)];

    // Nearby teammates join celebration; conceding defenders react with disappointment
    const teammates = this.players.filter(
      (p) => p.teamIdx === attTeam && p.id !== scorer.id && !p.redCard && p.slotIndex > 0
    );
    for (const tm of teammates.slice(0, 3)) {
      tm.celebrating = true;
      tm.celebrationStyle = 'arms_wide';
    }
    const defenders = this.players.filter((p) => p.teamIdx !== attTeam && !p.redCard);
    for (const def of defenders.slice(0, 4)) {
      def.reactionType = 'hands_on_head';
      def.reactionTimer = 2.6;
    }

    this.replayPlaybackFrames = [...this.recentFrames];
    this.replayTimer = 4.4;
    this.replayGoalTeam = attTeam;
    this.replayScorerId = scorer.id;
    this.goalBanner = {
      scorer: scorer.player,
      assistName,
      teamIdx: attTeam,
      minute: this.getMinute(),
      xg,
      timer: 4.8,
    };
  }

  private stepGoalCelebration(dt: number): void {
    const scorer = this.players.find((p) => p.id === this.replayScorerId);
    if (!scorer) return;
    const cornerX = scorer.teamIdx === 0 ? 94 : 6;
    const cornerY = scorer.y >= 50 ? 90 : 10;

    if (scorer.celebrationStyle === 'knee_slide') {
      // Slide toward corner flag
      this.movePlayerToward(scorer, cornerX, cornerY, dt, 0.85);
    } else if (scorer.celebrationStyle === 'arms_wide') {
      this.movePlayerToward(scorer, cornerX, cornerY, dt, 1.05);
    } else {
      scorer.vx = 0;
      scorer.vy = 0;
    }

    for (const p of this.players) {
      if (p.celebrating && p.id !== scorer.id) {
        this.movePlayerToward(p, scorer.x, scorer.y, dt, 0.95);
      }
    }
  }

  public triggerNetRipple(
    goalIdx: 0 | 1,
    impactCol: number,
    impactRow: number,
    impulse: number
  ): void {
    const net = this.nets[goalIdx];
    for (let r = 1; r < net.rows - 1; r++) {
      for (let c = 1; c < net.cols - 1; c++) {
        const dist = Math.hypot(c - impactCol, r - impactRow);
        if (dist < 6) {
          const i = r * net.cols + c;
          net.velocities[i] += impulse * (1 - dist / 6) * 14;
        }
      }
    }
  }

  private stepNets(dt: number): void {
    const k = 42;
    const damping = 0.92;
    for (const net of this.nets) {
      const { cols, rows, displacements: d, velocities: v } = net;
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < cols - 1; c++) {
          const i = r * cols + c;
          const neighbors =
            d[(r - 1) * cols + c] +
            d[(r + 1) * cols + c] +
            d[r * cols + (c - 1)] +
            d[r * cols + (c + 1)] -
            4 * d[i];
          const restore = -k * d[i] + k * 0.45 * neighbors;
          v[i] = (v[i] + restore * dt) * damping;
        }
      }
      for (let i = 0; i < d.length; i++) {
        d[i] = clamp(d[i] + v[i] * dt, -1.2, 1.5);
      }
    }
  }

  public getPossessionPct(): [number, number] {
    const t0 = this.stats[0].possessionTicks;
    const t1 = this.stats[1].possessionTicks;
    const total = Math.max(1, t0 + t1);
    const p0 = Math.round((t0 / total) * 100);
    return [p0, 100 - p0];
  }

  public getManOfTheMatch(): SimPlayerState | null {
    if (this.players.length === 0) return null;
    return [...this.players].sort((a, b) => b.rating - a.rating)[0];
  }

  public getSnapshot(): MatchSimSnapshot {
    const motmPlayer = this.getManOfTheMatch();
    const topLinks = Array.from(this.passLinks.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 14)
      .map((link) => {
        const from = this.players.find((p) => p.id === link.fromId);
        const to = this.players.find((p) => p.id === link.toId);
        if (!from || !to) return null;
        return {
          fromX: from.x,
          fromY: from.y,
          toX: to.x,
          toY: to.y,
          teamIdx: from.teamIdx,
          count: link.count,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return {
      period: this.period,
      minute: this.getMinute(),
      second: this.getSecond(),
      stats: [{ ...this.stats[0] }, { ...this.stats[1] }],
      possessionPct: this.getPossessionPct(),
      events: [...this.events],
      penalties: [...this.penalties],
      penaltyScore: [...this.penaltyScore] as [number, number],
      replayTimer: this.replayTimer,
      replayPhase:
        this.replayTimer > 0
          ? this.replayTimer <= 2.3
            ? 'action_replay'
            : 'celebration'
          : null,
      replayGoalTeam: this.replayGoalTeam,
      goalBanner: this.goalBanner
        ? {
            scorer: this.goalBanner.scorer,
            assistName: this.goalBanner.assistName,
            teamIdx: this.goalBanner.teamIdx,
            minute: this.goalBanner.minute,
            xg: this.goalBanner.xg,
          }
        : null,
      ballPos: { x: this.ball.x, y: this.ball.y },
      varCheck: this.varCheck ? { ...this.varCheck } : null,
      subsUsed: [...this.subsUsed] as [number, number],
      mentalities: [this.teams[0].mentality, this.teams[1].mentality],
      shotsLog: [...this.shotsLog],
      setPiece: this.setPiece ? { ...this.setPiece } : null,
      refereeCardAlert: this.refereeCardAlert ? { ...this.refereeCardAlert } : null,
      xgDanger: this.xgDanger,
      winnerIdx: this.winnerIdx,
      motm: motmPlayer
        ? {
            name: motmPlayer.player.name,
            teamIdx: motmPlayer.teamIdx,
            player: motmPlayer.player,
            rating: motmPlayer.rating,
            goals: motmPlayer.goals,
            assists: motmPlayer.assists,
          }
        : null,
      playerHeatmaps: this.players.map((p) => ({
        id: p.id,
        teamIdx: p.teamIdx,
        name: p.player.name,
        role: p.player.role,
        squadNumber: p.player.squadNumber,
        rating: p.rating,
        stamina: p.stamina,
        goals: p.goals,
        assists: p.assists,
        yellowCard: p.yellowCard,
        redCard: p.redCard,
        x: p.x,
        y: p.y,
        heatmap: [...p.heatmap],
      })),
      topPassLinks: topLinks,
    };
  }
}
