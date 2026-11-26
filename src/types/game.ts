export type Position = 'GK' | 'DEF' | 'MID' | 'FWD';

export type Role =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LW'
  | 'RW'
  | 'ST';

export type Era = 'modern' | 'icon' | 'reserve';

export type KitPattern =
  | 'solid'
  | 'stripes'
  | 'sash'
  | 'center'
  | 'sleeves'
  | 'hoops';

export type HairStyle =
  | 'short_fade'
  | 'curly_afro'
  | 'long_tied'
  | 'slicked'
  | 'buzzed';

export type BeardStyle = 'none' | 'stubble' | 'full' | 'goatee';

export interface PlayerStats {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
}

export interface PlayerAppearance {
  heightM: number;
  muscularity: number; // 0.85 .. 1.25
  skinTone: string;
  hairStyle: HairStyle;
  hairColor: string;
  beardStyle: BeardStyle;
  dominantFoot: 'R' | 'L';
}

export interface Player {
  id: string;
  name: string;
  pos: Position;
  role: Role;
  era: Era;
  club: string;
  flag: string;
  nationality: string;
  base: number; // Millions EUR
  ovr: number; // 62-98
  stats: PlayerStats;
  appearance: PlayerAppearance;
}

export interface SignedPlayer extends Player {
  paidPrice: number;
  squadNumber: number;
  isReserve?: boolean;
}

export type CrestShape = 'shield' | 'circle' | 'crest' | 'diamond';
export type CrestMotif = 'crown' | 'star' | 'wings' | 'stripes' | 'anchor' | 'cross';

export interface ClubPreset {
  id: string;
  name: string;
  code: string; // 3-letter scorebug code
  primary: string;
  secondary: string;
  accent: string;
  pattern: KitPattern;
  stadium: string;
  city: string;
  crestShape: CrestShape;
  crestMotif: CrestMotif;
}

export interface StadiumTemplate {
  id: string;
  name: string;
  city: string;
  club: string;
  capacity: number;
  seatColor: string;
  roofColor: string;
  turfToneA: string;
  turfToneB: string;
  floodlightTint: string;
}

export type WeatherCondition =
  | 'clear_night'
  | 'light_rain'
  | 'heavy_rain'
  | 'snow_flurry';

export type TacticalMentality =
  | 'High Press'
  | 'Balanced'
  | 'Counter-Attack'
  | 'Park the Bus';

export type KnockoutFormat = 'single_leg' | 'two_legged';
export type EraPoolFilter = 'mixed' | 'modern' | 'icon';
export type PlayMode = 'local' | 'vs_ai' | 'online_host' | 'online_join';

export interface TeamSetup {
  managerName: string;
  club: ClubPreset;
  purse: number;
  startingPurse: number;
  squad: SignedPlayer[];
  bench?: SignedPlayer[];
  captainId?: string;
  penaltyTakerId?: string;
  freeKickTakerId?: string;
  mentality: TacticalMentality;
  rtmAvailable: boolean;
}

export interface GameConfig {
  playMode: PlayMode;
  roomCode: string;
  seed: number;
  startingPurse: number;
  eraFilter: EraPoolFilter;
  stadiumId: string;
  weather: WeatherCondition;
  knockoutFormat: KnockoutFormat;
  firstLegScore?: { home: number; away: number };
  bidTimerSeconds: 5 | 10;
}

export interface SealedBidState {
  active: boolean;
  lot: Player | null;
  bids: [number | null, number | null];
  resolved: boolean;
  winnerIdx: 0 | 1 | null;
  winningAmount: number;
}

export interface AuctionLogEntry {
  id: string;
  round: number;
  message: string;
  type: 'bid' | 'sold' | 'unsold' | 'rtm' | 'sealed' | 'system';
  timestamp: number;
}

export interface AuctionState {
  pool: Player[];
  unsoldQueue: Player[];
  currentLot: Player | null;
  currentBid: number;
  highestBidder: 0 | 1 | null;
  round: number;
  lotIndex: number;
  totalInitialLots: number;
  rtmPending: {
    active: boolean;
    eligibleTeamIdx: 0 | 1 | null;
    lot: Player | null;
    winningBid: number;
    originalWinnerIdx: 0 | 1 | null;
  };
  sealedBid: SealedBidState;
  logs: AuctionLogEntry[];
  completed: boolean;
}

export type CameraMode =
  | 'broadcast'
  | 'tactical'
  | 'pitchside'
  | 'gk_pov'
  | 'replay';

export interface MatchEvent {
  id: string;
  minute: number;
  second: number;
  type:
    | 'kickoff'
    | 'goal'
    | 'save'
    | 'miss'
    | 'woodwork'
    | 'throw_in'
    | 'corner'
    | 'goal_kick'
    | 'free_kick'
    | 'penalty_awarded'
    | 'var_check'
    | 'substitution'
    | 'yellow_card'
    | 'red_card'
    | 'foul'
    | 'halftime'
    | 'fulltime'
    | 'extra_time'
    | 'penalty_shootout';
  teamIdx: 0 | 1;
  playerId?: string;
  playerName?: string;
  assistId?: string;
  assistName?: string;
  xg?: number;
  text: string;
}

export interface TeamMatchStats {
  goals: number;
  xg: number;
  shots: number;
  shotsOnTarget: number;
  saves: number;
  possessionTicks: number;
  passes: number;
  passesCompleted: number;
  tackles: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  corners: number;
  throwIns: number;
  freeKicks: number;
  penaltiesAwarded: number;
}

export interface PassLink {
  fromId: string;
  toId: string;
  count: number;
}

export interface ShotRecord {
  x: number;
  y: number;
  teamIdx: 0 | 1;
  shooterName: string;
  xg: number;
  outcome: 'goal' | 'save' | 'miss' | 'woodwork';
  minute: number;
}

export interface CareerTrophyRecord {
  id: string;
  date: string;
  winnerManager: string;
  winnerClub: string;
  winnerCode: string;
  runnerUpClub: string;
  scoreLine: string;
  penalties?: string;
  motmName: string;
  motmRating: number;
  stadium: string;
}

export type AppPhase = 'lobby' | 'auction' | 'tactics' | 'match';
