import {
  EraPoolFilter,
  Player,
  PlayerAppearance,
  Position,
  Role,
} from '@/types/game';

export interface FormationSlot {
  slotId: string;
  label: string;
  pos: Position;
  preferredRoles: Role[];
  /** Normalized 0..100 pitch coordinates for Home attacking Left->Right */
  x: number;
  y: number;
  discipline: number;
}

export const FORMATION_SLOTS: FormationSlot[] = [
  { slotId: 'GK', label: 'GK', pos: 'GK', preferredRoles: ['GK'], x: 5.5, y: 50, discipline: 0.08 },
  { slotId: 'LB', label: 'LB', pos: 'DEF', preferredRoles: ['LB', 'CB'], x: 24, y: 16, discipline: 0.58 },
  { slotId: 'CB1', label: 'LCB', pos: 'DEF', preferredRoles: ['CB', 'CDM'], x: 20, y: 38, discipline: 0.48 },
  { slotId: 'CB2', label: 'RCB', pos: 'DEF', preferredRoles: ['CB', 'CDM'], x: 20, y: 62, discipline: 0.48 },
  { slotId: 'RB', label: 'RB', pos: 'DEF', preferredRoles: ['RB', 'CB'], x: 24, y: 84, discipline: 0.58 },
  { slotId: 'CDM', label: 'CDM', pos: 'MID', preferredRoles: ['CDM', 'CM'], x: 41, y: 50, discipline: 0.72 },
  { slotId: 'CM1', label: 'LCM', pos: 'MID', preferredRoles: ['CM', 'CAM', 'CDM'], x: 51, y: 30, discipline: 0.88 },
  { slotId: 'CM2', label: 'RCM', pos: 'MID', preferredRoles: ['CM', 'CAM', 'CDM'], x: 51, y: 70, discipline: 0.88 },
  { slotId: 'LW', label: 'LW', pos: 'FWD', preferredRoles: ['LW', 'ST', 'CAM'], x: 74, y: 19, discipline: 1.0 },
  { slotId: 'ST', label: 'ST', pos: 'FWD', preferredRoles: ['ST', 'LW', 'RW'], x: 80, y: 50, discipline: 1.0 },
  { slotId: 'RW', label: 'RW', pos: 'FWD', preferredRoles: ['RW', 'ST', 'CAM'], x: 74, y: 81, discipline: 1.0 },
];

export const POSITION_QUOTAS: Record<Position, number> = {
  GK: 1,
  DEF: 4,
  MID: 3,
  FWD: 3,
};

const SKIN_TONES = ['#f5d0b5', '#e4b38d', '#c68b59', '#8d5524', '#5c3818'];
const HAIR_COLORS = ['#18181b', '#3f2a1d', '#713f12', '#d4a34f', '#27272a'];

function makeAppearance(
  idx: number,
  overrides?: Partial<PlayerAppearance>
): PlayerAppearance {
  const styles: PlayerAppearance['hairStyle'][] = [
    'short_fade',
    'curly_afro',
    'long_tied',
    'slicked',
    'buzzed',
  ];
  const beards: PlayerAppearance['beardStyle'][] = [
    'none',
    'stubble',
    'full',
    'goatee',
  ];
  return {
    heightM: Number((1.73 + ((idx * 7) % 23) * 0.01).toFixed(2)),
    muscularity: Number((0.92 + ((idx * 5) % 20) * 0.012).toFixed(2)),
    skinTone: SKIN_TONES[idx % SKIN_TONES.length],
    hairStyle: styles[idx % styles.length],
    hairColor: HAIR_COLORS[(idx * 3) % HAIR_COLORS.length],
    beardStyle: beards[(idx * 2) % beards.length],
    dominantFoot: idx % 4 === 0 ? 'L' : 'R',
    ...overrides,
  };
}

function p(
  id: string,
  name: string,
  pos: Position,
  role: Role,
  era: 'modern' | 'icon',
  club: string,
  flag: string,
  nationality: string,
  base: number,
  ovr: number,
  stats: [number, number, number, number, number, number],
  idx: number,
  app?: Partial<PlayerAppearance>
): Player {
  return {
    id,
    name,
    pos,
    role,
    era,
    club,
    flag,
    nationality,
    base,
    ovr,
    stats: {
      pac: stats[0],
      sho: stats[1],
      pas: stats[2],
      dri: stats[3],
      def: stats[4],
      phy: stats[5],
    },
    appearance: makeAppearance(idx, app),
  };
}

export const CURATED_PLAYERS: Player[] = [
  // ================= GOALKEEPERS (8) =================
  p('gk_courtois', 'Thibaut Courtois', 'GK', 'GK', 'modern', 'Real Madrid', '🇧🇪', 'Belgium', 75, 91, [85, 89, 78, 90, 88, 90], 1, { heightM: 2.00, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('gk_donnarumma', 'Gianluigi Donnarumma', 'GK', 'GK', 'modern', 'Paris Saint-Germain', '🇮🇹', 'Italy', 72, 90, [88, 86, 76, 90, 87, 89], 2, { heightM: 1.96, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'stubble' }),
  p('gk_alisson', 'Alisson Becker', 'GK', 'GK', 'modern', 'Liverpool', '🇧🇷', 'Brazil', 70, 90, [86, 88, 86, 89, 88, 87], 3, { heightM: 1.93, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'full' }),
  p('gk_maignan', 'Mike Maignan', 'GK', 'GK', 'modern', 'AC Milan', '🇫🇷', 'France', 64, 89, [87, 85, 84, 89, 86, 86], 4, { heightM: 1.91, skinTone: '#8d5524', hairStyle: 'buzzed', beardStyle: 'goatee' }),
  p('gk_kobel', 'Gregor Kobel', 'GK', 'GK', 'modern', 'Borussia Dortmund', '🇨🇭', 'Switzerland', 60, 88, [86, 86, 75, 88, 86, 87], 5, { heightM: 1.95, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('gk_raya', 'David Raya', 'GK', 'GK', 'modern', 'Arsenal', '🇪🇸', 'Spain', 55, 87, [85, 84, 88, 87, 84, 82], 6, { heightM: 1.83, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('gk_yashin', 'Lev Yashin', 'GK', 'GK', 'icon', 'Real Madrid', '🏳️', 'USSR', 120, 95, [92, 91, 82, 95, 94, 92], 7, { heightM: 1.89, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'none' }),
  p('gk_buffon', 'Gianluigi Buffon', 'GK', 'GK', 'icon', 'Juventus', '🇮🇹', 'Italy', 110, 94, [89, 91, 80, 94, 93, 91], 8, { heightM: 1.92, skinTone: '#f5d0b5', hairStyle: 'long_tied', beardStyle: 'stubble' }),
  p('gk_neuer', 'Manuel Neuer', 'GK', 'GK', 'icon', 'Bayern Munich', '🇩🇪', 'Germany', 105, 93, [90, 90, 91, 92, 91, 92], 9, { heightM: 1.93, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('gk_casillas', 'Iker Casillas', 'GK', 'GK', 'icon', 'Real Madrid', '🇪🇸', 'Spain', 98, 92, [91, 89, 82, 93, 91, 84], 10, { heightM: 1.82, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'stubble' }),

  // ================= DEFENDERS (24) =================
  p('def_saliba', 'William Saliba', 'DEF', 'CB', 'modern', 'Arsenal', '🇫🇷', 'France', 90, 90, [84, 52, 78, 79, 91, 89], 11, { heightM: 1.92, skinTone: '#8d5524', hairStyle: 'buzzed', beardStyle: 'stubble' }),
  p('def_vandijk', 'Virgil van Dijk', 'DEF', 'CB', 'modern', 'Liverpool', '🇳🇱', 'Netherlands', 88, 90, [80, 62, 79, 76, 92, 92], 12, { heightM: 1.95, skinTone: '#c68b59', hairStyle: 'long_tied', beardStyle: 'full' }),
  p('def_bastoni', 'Alessandro Bastoni', 'DEF', 'CB', 'modern', 'Inter Milan', '🇮🇹', 'Italy', 82, 89, [78, 56, 84, 79, 89, 86], 13, { heightM: 1.90, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'stubble', dominantFoot: 'L' }),
  p('def_dias', 'Rúben Dias', 'DEF', 'CB', 'modern', 'Manchester City', '🇵🇹', 'Portugal', 84, 89, [75, 50, 77, 74, 91, 90], 14, { heightM: 1.87, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('def_rudiger', 'Antonio Rüdiger', 'DEF', 'CB', 'modern', 'Real Madrid', '🇩🇪', 'Germany', 80, 89, [85, 58, 74, 72, 89, 91], 15, { heightM: 1.90, skinTone: '#5c3818', hairStyle: 'buzzed', beardStyle: 'full' }),
  p('def_gabriel', 'Gabriel Magalhães', 'DEF', 'CB', 'modern', 'Arsenal', '🇧🇷', 'Brazil', 76, 88, [77, 56, 72, 70, 89, 90], 16, { heightM: 1.90, skinTone: '#c68b59', hairStyle: 'short_fade', beardStyle: 'full', dominantFoot: 'L' }),
  p('def_hakimi', 'Achraf Hakimi', 'DEF', 'RB', 'modern', 'Paris Saint-Germain', '🇲🇦', 'Morocco', 86, 88, [95, 76, 82, 85, 81, 80], 17, { heightM: 1.81, skinTone: '#c68b59', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('def_theo', 'Theo Hernández', 'DEF', 'LB', 'modern', 'AC Milan', '🇫🇷', 'France', 85, 88, [94, 77, 81, 84, 81, 87], 18, { heightM: 1.84, skinTone: '#e4b38d', hairStyle: 'slicked', beardStyle: 'stubble', dominantFoot: 'L' }),
  p('def_trent', 'Trent Alexander-Arnold', 'DEF', 'RB', 'modern', 'Real Madrid', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 84, 88, [78, 74, 93, 83, 80, 76], 19, { heightM: 1.80, skinTone: '#c68b59', hairStyle: 'curly_afro', beardStyle: 'none' }),
  p('def_davies', 'Alphonso Davies', 'DEF', 'LB', 'modern', 'Bayern Munich', '🇨🇦', 'Canada', 78, 87, [96, 70, 79, 86, 79, 80], 20, { heightM: 1.83, skinTone: '#5c3818', hairStyle: 'short_fade', beardStyle: 'none', dominantFoot: 'L' }),
  p('def_gvardiol', 'Joško Gvardiol', 'DEF', 'LB', 'modern', 'Manchester City', '🇭🇷', 'Croatia', 77, 87, [82, 68, 79, 80, 87, 88], 21, { heightM: 1.85, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'full', dominantFoot: 'L' }),
  p('def_kounde', 'Jules Koundé', 'DEF', 'RB', 'modern', 'FC Barcelona', '🇫🇷', 'France', 78, 87, [85, 55, 78, 81, 87, 84], 22, { heightM: 1.80, skinTone: '#8d5524', hairStyle: 'curly_afro', beardStyle: 'stubble' }),
  p('def_frimpong', 'Jeremie Frimpong', 'DEF', 'RB', 'modern', 'Bayer Leverkusen', '🇳🇱', 'Netherlands', 74, 86, [95, 74, 79, 87, 76, 75], 23, { heightM: 1.72, skinTone: '#5c3818', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('def_dimarco', 'Federico Dimarco', 'DEF', 'LB', 'modern', 'Inter Milan', '🇮🇹', 'Italy', 74, 86, [83, 76, 87, 83, 80, 76], 24, { heightM: 1.75, skinTone: '#f5d0b5', hairStyle: 'buzzed', beardStyle: 'stubble', dominantFoot: 'L' }),
  p('def_cubarsi', 'Pau Cubarsí', 'DEF', 'CB', 'modern', 'FC Barcelona', '🇪🇸', 'Spain', 72, 85, [78, 48, 85, 79, 86, 81], 25, { heightM: 1.84, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('def_araujo', 'Ronald Araújo', 'DEF', 'CB', 'modern', 'FC Barcelona', '🇺🇾', 'Uruguay', 76, 87, [86, 54, 71, 72, 88, 91], 26, { heightM: 1.92, skinTone: '#c68b59', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('def_maldini', 'Paolo Maldini', 'DEF', 'CB', 'icon', 'AC Milan', '🇮🇹', 'Italy', 145, 96, [88, 60, 84, 82, 97, 92], 27, { heightM: 1.86, skinTone: '#f5d0b5', hairStyle: 'long_tied', beardStyle: 'stubble', dominantFoot: 'L' }),
  p('def_beckenbauer', 'Franz Beckenbauer', 'DEF', 'CB', 'icon', 'Bayern Munich', '🇩🇪', 'Germany', 140, 95, [85, 76, 92, 88, 95, 88], 28, { heightM: 1.81, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'none' }),
  p('def_ramos', 'Sergio Ramos', 'DEF', 'CB', 'icon', 'Real Madrid', '🇪🇸', 'Spain', 120, 93, [83, 75, 81, 79, 93, 94], 29, { heightM: 1.84, skinTone: '#e4b38d', hairStyle: 'slicked', beardStyle: 'full' }),
  p('def_cafu', 'Cafu', 'DEF', 'RB', 'icon', 'AC Milan', '🇧🇷', 'Brazil', 115, 93, [94, 72, 86, 88, 88, 89], 30, { heightM: 1.76, skinTone: '#8d5524', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('def_rcarlos', 'Roberto Carlos', 'DEF', 'LB', 'icon', 'Real Madrid', '🇧🇷', 'Brazil', 125, 93, [95, 88, 86, 87, 86, 90], 31, { heightM: 1.68, skinTone: '#8d5524', hairStyle: 'buzzed', beardStyle: 'none', dominantFoot: 'L' }),
  p('def_lahm', 'Philipp Lahm', 'DEF', 'RB', 'icon', 'Bayern Munich', '🇩🇪', 'Germany', 110, 92, [86, 68, 89, 87, 91, 80], 32, { heightM: 1.70, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('def_nesta', 'Alessandro Nesta', 'DEF', 'CB', 'icon', 'AC Milan', '🇮🇹', 'Italy', 112, 92, [82, 50, 79, 77, 95, 89], 33, { heightM: 1.87, skinTone: '#f5d0b5', hairStyle: 'long_tied', beardStyle: 'stubble' }),
  p('def_puyol', 'Carles Puyol', 'DEF', 'CB', 'icon', 'FC Barcelona', '🇪🇸', 'Spain', 110, 92, [81, 56, 76, 75, 94, 95], 34, { heightM: 1.78, skinTone: '#e4b38d', hairStyle: 'curly_afro', beardStyle: 'stubble' }),

  // ================= MIDFIELDERS (24) =================
  p('mid_rodri', 'Rodri', 'MID', 'CDM', 'modern', 'Manchester City', '🇪🇸', 'Spain', 110, 92, [74, 83, 91, 87, 89, 90], 35, { heightM: 1.91, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('mid_bellingham', 'Jude Bellingham', 'MID', 'CAM', 'modern', 'Real Madrid', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 118, 92, [85, 88, 87, 91, 80, 88], 36, { heightM: 1.86, skinTone: '#c68b59', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('mid_pedri', 'Pedri', 'MID', 'CM', 'modern', 'FC Barcelona', '🇪🇸', 'Spain', 102, 90, [81, 75, 92, 93, 76, 74], 37, { heightM: 1.74, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('mid_wirtz', 'Florian Wirtz', 'MID', 'CAM', 'modern', 'Bayer Leverkusen', '🇩🇪', 'Germany', 100, 90, [84, 84, 90, 93, 62, 72], 38, { heightM: 1.77, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('mid_musiala', 'Jamal Musiala', 'MID', 'CAM', 'modern', 'Bayern Munich', '🇩🇪', 'Germany', 104, 90, [87, 83, 85, 95, 64, 71], 39, { heightM: 1.84, skinTone: '#c68b59', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('mid_valverde', 'Federico Valverde', 'MID', 'CM', 'modern', 'Real Madrid', '🇺🇾', 'Uruguay', 98, 90, [90, 86, 87, 86, 84, 87], 40, { heightM: 1.82, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('mid_palmer', 'Cole Palmer', 'MID', 'CAM', 'modern', 'Chelsea', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 92, 89, [82, 87, 89, 90, 56, 72], 41, { heightM: 1.85, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none', dominantFoot: 'L' }),
  p('mid_odegaard', 'Martin Ødegaard', 'MID', 'CAM', 'modern', 'Arsenal', '🇳🇴', 'Norway', 90, 89, [78, 82, 92, 90, 68, 72], 42, { heightM: 1.78, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'stubble', dominantFoot: 'L' }),
  p('mid_rice', 'Declan Rice', 'MID', 'CDM', 'modern', 'Arsenal', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 88, 89, [79, 76, 85, 83, 88, 89], 43, { heightM: 1.88, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('mid_vitinha', 'Vitinha', 'MID', 'CM', 'modern', 'Paris Saint-Germain', '🇵🇹', 'Portugal', 86, 88, [80, 79, 90, 91, 78, 75], 44, { heightM: 1.72, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('mid_barella', 'Nicolò Barella', 'MID', 'CM', 'modern', 'Inter Milan', '🇮🇹', 'Italy', 86, 88, [82, 79, 87, 88, 82, 82], 45, { heightM: 1.75, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('mid_foden', 'Phil Foden', 'MID', 'CAM', 'modern', 'Manchester City', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 90, 88, [84, 86, 87, 92, 58, 69], 46, { heightM: 1.71, skinTone: '#f5d0b5', hairStyle: 'buzzed', beardStyle: 'none', dominantFoot: 'L' }),
  p('mid_macallister', 'Alexis Mac Allister', 'MID', 'CM', 'modern', 'Liverpool', '🇦🇷', 'Argentina', 80, 87, [74, 82, 88, 86, 80, 80], 47, { heightM: 1.76, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'full' }),
  p('mid_kimmich', 'Joshua Kimmich', 'MID', 'CDM', 'modern', 'Bayern Munich', '🇩🇪', 'Germany', 84, 88, [74, 76, 91, 86, 84, 80], 48, { heightM: 1.77, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('mid_neves', 'João Neves', 'MID', 'CDM', 'modern', 'Paris Saint-Germain', '🇵🇹', 'Portugal', 76, 86, [81, 74, 87, 88, 84, 82], 49, { heightM: 1.74, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('mid_zidane', 'Zinedine Zidane', 'MID', 'CAM', 'icon', 'Real Madrid', '🇫🇷', 'France', 155, 96, [84, 90, 96, 97, 74, 88], 50, { heightM: 1.85, skinTone: '#e4b38d', hairStyle: 'buzzed', beardStyle: 'none' }),
  p('mid_modric', 'Luka Modrić', 'MID', 'CM', 'icon', 'Real Madrid', '🇭🇷', 'Croatia', 120, 93, [78, 82, 95, 94, 78, 76], 51, { heightM: 1.72, skinTone: '#f5d0b5', hairStyle: 'long_tied', beardStyle: 'none' }),
  p('mid_xavi', 'Xavi Hernández', 'MID', 'CM', 'icon', 'FC Barcelona', '🇪🇸', 'Spain', 130, 94, [76, 78, 97, 94, 76, 74], 52, { heightM: 1.70, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('mid_iniesta', 'Andrés Iniesta', 'MID', 'CM', 'icon', 'FC Barcelona', '🇪🇸', 'Spain', 132, 94, [80, 81, 95, 97, 70, 72], 53, { heightM: 1.71, skinTone: '#f5d0b5', hairStyle: 'buzzed', beardStyle: 'none' }),
  p('mid_pirlo', 'Andrea Pirlo', 'MID', 'CDM', 'icon', 'AC Milan', '🇮🇹', 'Italy', 122, 93, [72, 85, 97, 91, 77, 75], 54, { heightM: 1.77, skinTone: '#f5d0b5', hairStyle: 'long_tied', beardStyle: 'full' }),
  p('mid_gullit', 'Ruud Gullit', 'MID', 'CM', 'icon', 'AC Milan', '🇳🇱', 'Netherlands', 138, 94, [89, 90, 90, 91, 86, 94], 55, { heightM: 1.91, skinTone: '#8d5524', hairStyle: 'curly_afro', beardStyle: 'goatee' }),
  p('mid_matthaus', 'Lothar Matthäus', 'MID', 'CDM', 'icon', 'Bayern Munich', '🇩🇪', 'Germany', 132, 94, [87, 89, 91, 88, 91, 91], 56, { heightM: 1.74, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('mid_kdb', 'Kevin De Bruyne', 'MID', 'CAM', 'icon', 'Manchester City', '🇧🇪', 'Belgium', 125, 93, [78, 89, 97, 89, 69, 80], 57, { heightM: 1.81, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'none' }),
  p('mid_vieira', 'Patrick Vieira', 'MID', 'CDM', 'icon', 'Arsenal', '🇫🇷', 'France', 120, 92, [84, 80, 86, 86, 91, 94], 58, { heightM: 1.92, skinTone: '#5c3818', hairStyle: 'buzzed', beardStyle: 'none' }),

  // ================= FORWARDS (26) =================
  p('fwd_mbappe', 'Kylian Mbappé', 'FWD', 'ST', 'modern', 'Real Madrid', '🇫🇷', 'France', 145, 93, [98, 92, 83, 94, 40, 81], 59, { heightM: 1.78, skinTone: '#8d5524', hairStyle: 'buzzed', beardStyle: 'none' }),
  p('fwd_haaland', 'Erling Haaland', 'FWD', 'ST', 'modern', 'Manchester City', '🇳🇴', 'Norway', 140, 92, [90, 95, 72, 83, 46, 94], 60, { heightM: 1.95, skinTone: '#f5d0b5', hairStyle: 'long_tied', beardStyle: 'none', dominantFoot: 'L' }),
  p('fwd_yamal', 'Lamine Yamal', 'FWD', 'RW', 'modern', 'FC Barcelona', '🇪🇸', 'Spain', 135, 91, [91, 85, 89, 95, 42, 68], 61, { heightM: 1.80, skinTone: '#c68b59', hairStyle: 'curly_afro', beardStyle: 'none', dominantFoot: 'L' }),
  p('fwd_vini', 'Vinícius Júnior', 'FWD', 'LW', 'modern', 'Real Madrid', '🇧🇷', 'Brazil', 130, 91, [96, 86, 84, 95, 38, 74], 62, { heightM: 1.76, skinTone: '#5c3818', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('fwd_salah', 'Mohamed Salah', 'FWD', 'RW', 'modern', 'Liverpool', '🇪🇬', 'Egypt', 112, 90, [90, 90, 86, 91, 46, 78], 63, { heightM: 1.75, skinTone: '#c68b59', hairStyle: 'curly_afro', beardStyle: 'full', dominantFoot: 'L' }),
  p('fwd_saka', 'Bukayo Saka', 'FWD', 'RW', 'modern', 'Arsenal', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 105, 89, [88, 85, 87, 91, 62, 76], 64, { heightM: 1.78, skinTone: '#5c3818', hairStyle: 'short_fade', beardStyle: 'none', dominantFoot: 'L' }),
  p('fwd_kane', 'Harry Kane', 'FWD', 'ST', 'modern', 'Bayern Munich', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 108, 90, [74, 94, 87, 85, 49, 86], 65, { heightM: 1.88, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'stubble' }),
  p('fwd_lautaro', 'Lautaro Martínez', 'FWD', 'ST', 'modern', 'Inter Milan', '🇦🇷', 'Argentina', 98, 89, [84, 89, 77, 88, 52, 85], 66, { heightM: 1.74, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('fwd_raphinha', 'Raphinha', 'FWD', 'LW', 'modern', 'FC Barcelona', '🇧🇷', 'Brazil', 94, 89, [92, 85, 86, 90, 56, 76], 67, { heightM: 1.76, skinTone: '#c68b59', hairStyle: 'short_fade', beardStyle: 'stubble', dominantFoot: 'L' }),
  p('fwd_dembele', 'Ousmane Dembélé', 'FWD', 'RW', 'modern', 'Paris Saint-Germain', '🇫🇷', 'France', 92, 89, [94, 83, 86, 94, 41, 70], 68, { heightM: 1.78, skinTone: '#5c3818', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('fwd_lewandowski', 'Robert Lewandowski', 'FWD', 'ST', 'modern', 'FC Barcelona', '🇵🇱', 'Poland', 86, 88, [77, 92, 81, 86, 44, 85], 69, { heightM: 1.85, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'stubble' }),
  p('fwd_isak', 'Alexander Isak', 'FWD', 'ST', 'modern', 'Newcastle United', '🇸🇪', 'Sweden', 92, 88, [88, 88, 79, 89, 41, 78], 70, { heightM: 1.92, skinTone: '#8d5524', hairStyle: 'curly_afro', beardStyle: 'stubble' }),
  p('fwd_kvara', 'Khvicha Kvaratskhelia', 'FWD', 'LW', 'modern', 'Paris Saint-Germain', '🇬🇪', 'Georgia', 88, 88, [89, 84, 84, 93, 45, 76], 71, { heightM: 1.83, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('fwd_alvarez', 'Julián Álvarez', 'FWD', 'ST', 'modern', 'Atlético Madrid', '🇦🇷', 'Argentina', 86, 87, [86, 87, 83, 88, 56, 79], 72, { heightM: 1.70, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('fwd_leao', 'Rafael Leão', 'FWD', 'LW', 'modern', 'AC Milan', '🇵🇹', 'Portugal', 84, 87, [94, 82, 81, 91, 34, 81], 73, { heightM: 1.88, skinTone: '#5c3818', hairStyle: 'long_tied', beardStyle: 'none' }),
  p('fwd_messi', 'Lionel Messi', 'FWD', 'RW', 'icon', 'FC Barcelona', '🇦🇷', 'Argentina', 180, 98, [92, 96, 97, 99, 38, 72], 74, { heightM: 1.70, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'full', dominantFoot: 'L' }),
  p('fwd_cr7', 'Cristiano Ronaldo', 'FWD', 'ST', 'icon', 'Real Madrid', '🇵🇹', 'Portugal', 175, 97, [94, 98, 86, 94, 39, 90], 75, { heightM: 1.87, skinTone: '#e4b38d', hairStyle: 'slicked', beardStyle: 'none' }),
  p('fwd_pele', 'Pelé', 'FWD', 'ST', 'icon', 'Real Madrid', '🇧🇷', 'Brazil', 175, 98, [95, 97, 94, 97, 60, 86], 76, { heightM: 1.73, skinTone: '#5c3818', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('fwd_maradona', 'Diego Maradona', 'FWD', 'RW', 'icon', 'SSC Napoli', '🇦🇷', 'Argentina', 165, 97, [92, 94, 95, 99, 42, 82], 77, { heightM: 1.65, skinTone: '#e4b38d', hairStyle: 'curly_afro', beardStyle: 'none', dominantFoot: 'L' }),
  p('fwd_r9', 'Ronaldo Nazário', 'FWD', 'ST', 'icon', 'Inter Milan', '🇧🇷', 'Brazil', 160, 96, [97, 96, 84, 97, 44, 87], 78, { heightM: 1.83, skinTone: '#c68b59', hairStyle: 'buzzed', beardStyle: 'none' }),
  p('fwd_cruyff', 'Johan Cruyff', 'FWD', 'ST', 'icon', 'AFC Ajax', '🇳🇱', 'Netherlands', 155, 96, [92, 91, 95, 97, 46, 78], 79, { heightM: 1.78, skinTone: '#f5d0b5', hairStyle: 'long_tied', beardStyle: 'none' }),
  p('fwd_ronaldinho', 'Ronaldinho', 'FWD', 'LW', 'icon', 'FC Barcelona', '🇧🇷', 'Brazil', 150, 95, [92, 90, 93, 98, 40, 81], 80, { heightM: 1.82, skinTone: '#8d5524', hairStyle: 'long_tied', beardStyle: 'goatee' }),
  p('fwd_henry', 'Thierry Henry', 'FWD', 'LW', 'icon', 'Arsenal', '🇫🇷', 'France', 142, 94, [96, 93, 86, 93, 45, 83], 81, { heightM: 1.88, skinTone: '#5c3818', hairStyle: 'buzzed', beardStyle: 'goatee' }),
  p('gk_newer_ederson', 'Ederson', 'GK', 'GK', 'modern', 'Manchester City', '🇧🇷', 'Brazil', 64, 88, [86, 84, 92, 88, 86, 85], 83, { heightM: 1.88, skinTone: '#e4b38d', hairStyle: 'buzzed', beardStyle: 'stubble', dominantFoot: 'L' }),
  p('gk_oblak', 'Jan Oblak', 'GK', 'GK', 'modern', 'Atlético Madrid', '🇸🇮', 'Slovenia', 68, 89, [85, 89, 77, 89, 89, 88], 84, { heightM: 1.88, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'full' }),
  p('gk_terstegen', 'Marc-André ter Stegen', 'GK', 'GK', 'modern', 'FC Barcelona', '🇩🇪', 'Germany', 66, 89, [86, 88, 89, 90, 88, 86], 85, { heightM: 1.87, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'stubble' }),
  p('gk_emimartinez', 'Emiliano Martínez', 'GK', 'GK', 'modern', 'Aston Villa', '🇦🇷', 'Argentina', 65, 88, [86, 87, 82, 89, 87, 88], 86, { heightM: 1.95, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('gk_sommer', 'Yann Sommer', 'GK', 'GK', 'modern', 'Inter Milan', '🇨🇭', 'Switzerland', 58, 87, [88, 86, 84, 90, 86, 81], 87, { heightM: 1.83, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'stubble' }),
  p('gk_kahn', 'Oliver Kahn', 'GK', 'GK', 'icon', 'Bayern Munich', '🇩🇪', 'Germany', 112, 93, [90, 90, 78, 92, 93, 94], 88, { heightM: 1.88, skinTone: '#f5d0b5', hairStyle: 'long_tied', beardStyle: 'none' }),
  p('gk_schmeichel', 'Peter Schmeichel', 'GK', 'GK', 'icon', 'Manchester City', '🇩🇰', 'Denmark', 108, 93, [89, 90, 80, 92, 92, 94], 89, { heightM: 1.91, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('gk_vandersar', 'Edwin van der Sar', 'GK', 'GK', 'icon', 'AFC Ajax', '🇳🇱', 'Netherlands', 102, 92, [88, 89, 85, 92, 91, 88], 90, { heightM: 1.97, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'none' }),
  p('gk_cech', 'Petr Čech', 'GK', 'GK', 'icon', 'Chelsea', '🇨🇿', 'Czechia', 104, 92, [88, 89, 79, 92, 92, 90], 91, { heightM: 1.96, skinTone: '#f5d0b5', hairStyle: 'buzzed', beardStyle: 'none' }),

  // Additional Modern & Icon Defenders
  p('def_carvajal', 'Dani Carvajal', 'DEF', 'RB', 'modern', 'Real Madrid', '🇪🇸', 'Spain', 78, 88, [84, 68, 83, 83, 86, 84], 92, { heightM: 1.73, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'full' }),
  p('def_konate', 'Ibrahima Konaté', 'DEF', 'CB', 'modern', 'Liverpool', '🇫🇷', 'France', 78, 87, [84, 52, 74, 75, 88, 91], 93, { heightM: 1.94, skinTone: '#5c3818', hairStyle: 'buzzed', beardStyle: 'stubble' }),
  p('def_marquinhos', 'Marquinhos', 'DEF', 'CB', 'modern', 'Paris Saint-Germain', '🇧🇷', 'Brazil', 80, 88, [82, 54, 81, 79, 89, 84], 94, { heightM: 1.83, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('def_stones', 'John Stones', 'DEF', 'CB', 'modern', 'Manchester City', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 75, 87, [76, 56, 85, 82, 87, 83], 95, { heightM: 1.88, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('def_grimaldo', 'Alejandro Grimaldo', 'DEF', 'LB', 'modern', 'Bayer Leverkusen', '🇪🇸', 'Spain', 76, 87, [87, 79, 88, 86, 78, 74], 96, { heightM: 1.71, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'stubble', dominantFoot: 'L' }),
  p('def_robertson', 'Andy Robertson', 'DEF', 'LB', 'modern', 'Liverpool', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Scotland', 74, 86, [85, 65, 85, 82, 82, 81], 97, { heightM: 1.78, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none', dominantFoot: 'L' }),
  p('def_baresi', 'Franco Baresi', 'DEF', 'CB', 'icon', 'AC Milan', '🇮🇹', 'Italy', 135, 95, [85, 58, 86, 83, 97, 89], 98, { heightM: 1.76, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'none' }),
  p('def_zanetti', 'Javier Zanetti', 'DEF', 'RB', 'icon', 'Inter Milan', '🇦🇷', 'Argentina', 118, 93, [88, 70, 86, 87, 91, 90], 99, { heightM: 1.78, skinTone: '#e4b38d', hairStyle: 'slicked', beardStyle: 'none' }),
  p('def_terry', 'John Terry', 'DEF', 'CB', 'icon', 'Chelsea', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 112, 92, [74, 62, 78, 72, 94, 93], 100, { heightM: 1.87, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('def_ferdinand', 'Rio Ferdinand', 'DEF', 'CB', 'icon', 'Real Madrid', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 114, 92, [84, 54, 81, 78, 93, 91], 101, { heightM: 1.89, skinTone: '#c68b59', hairStyle: 'buzzed', beardStyle: 'stubble' }),
  p('def_cole', 'Ashley Cole', 'DEF', 'LB', 'icon', 'Chelsea', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 105, 91, [90, 65, 83, 85, 89, 82], 102, { heightM: 1.76, skinTone: '#c68b59', hairStyle: 'buzzed', beardStyle: 'none', dominantFoot: 'L' }),
  p('def_marcelo', 'Marcelo', 'DEF', 'LB', 'icon', 'Real Madrid', '🇧🇷', 'Brazil', 110, 91, [88, 78, 87, 93, 81, 80], 103, { heightM: 1.74, skinTone: '#c68b59', hairStyle: 'curly_afro', beardStyle: 'stubble', dominantFoot: 'L' }),
  p('def_alves', 'Dani Alves', 'DEF', 'RB', 'icon', 'FC Barcelona', '🇧🇷', 'Brazil', 110, 91, [90, 77, 88, 90, 82, 81], 104, { heightM: 1.72, skinTone: '#c68b59', hairStyle: 'buzzed', beardStyle: 'goatee' }),
  p('def_chiellini', 'Giorgio Chiellini', 'DEF', 'CB', 'icon', 'Juventus', '🇮🇹', 'Italy', 108, 91, [77, 50, 74, 70, 94, 94], 105, { heightM: 1.87, skinTone: '#f5d0b5', hairStyle: 'buzzed', beardStyle: 'stubble', dominantFoot: 'L' }),

  // Additional Modern & Icon Midfielders
  p('mid_bruno', 'Bruno Fernandes', 'MID', 'CAM', 'modern', 'Porto', '🇵🇹', 'Portugal', 88, 89, [78, 87, 91, 87, 70, 78], 106, { heightM: 1.79, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('mid_dejong', 'Frenkie de Jong', 'MID', 'CM', 'modern', 'FC Barcelona', '🇳🇱', 'Netherlands', 86, 88, [84, 71, 89, 91, 80, 81], 107, { heightM: 1.81, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'none' }),
  p('mid_camavinga', 'Eduardo Camavinga', 'MID', 'CDM', 'modern', 'Real Madrid', '🇫🇷', 'France', 82, 87, [85, 70, 85, 88, 84, 85], 108, { heightM: 1.82, skinTone: '#5c3818', hairStyle: 'long_tied', beardStyle: 'none', dominantFoot: 'L' }),
  p('mid_tchouameni', 'Aurélien Tchouaméni', 'MID', 'CDM', 'modern', 'Real Madrid', '🇫🇷', 'France', 82, 87, [80, 75, 84, 82, 86, 89], 109, { heightM: 1.87, skinTone: '#5c3818', hairStyle: 'buzzed', beardStyle: 'stubble' }),
  p('mid_gavi', 'Gavi', 'MID', 'CM', 'modern', 'FC Barcelona', '🇪🇸', 'Spain', 78, 86, [82, 72, 85, 89, 80, 84], 110, { heightM: 1.73, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('mid_calhanoglu', 'Hakan Çalhanoğlu', 'MID', 'CDM', 'modern', 'Inter Milan', '🇹🇷', 'Turkey', 80, 87, [73, 86, 91, 86, 78, 76], 111, { heightM: 1.78, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'full' }),
  p('mid_kroos', 'Toni Kroos', 'MID', 'CM', 'icon', 'Real Madrid', '🇩🇪', 'Germany', 124, 93, [68, 84, 97, 88, 76, 78], 112, { heightM: 1.83, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'none' }),
  p('mid_busquets', 'Sergio Busquets', 'MID', 'CDM', 'icon', 'FC Barcelona', '🇪🇸', 'Spain', 116, 92, [64, 65, 92, 88, 90, 86], 113, { heightM: 1.89, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('mid_gerrard', 'Steven Gerrard', 'MID', 'CM', 'icon', 'Liverpool', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 124, 93, [82, 91, 92, 86, 84, 90], 114, { heightM: 1.83, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('mid_lampard', 'Frank Lampard', 'MID', 'CAM', 'icon', 'Chelsea', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 118, 92, [76, 92, 90, 85, 76, 85], 115, { heightM: 1.84, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('mid_kaka', 'Kaká', 'MID', 'CAM', 'icon', 'AC Milan', '🇧🇷', 'Brazil', 132, 94, [93, 88, 90, 94, 48, 78], 116, { heightM: 1.86, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'none' }),
  p('mid_seedorf', 'Clarence Seedorf', 'MID', 'CM', 'icon', 'AC Milan', '🇳🇱', 'Netherlands', 116, 92, [84, 88, 90, 90, 81, 91], 117, { heightM: 1.76, skinTone: '#5c3818', hairStyle: 'long_tied', beardStyle: 'goatee' }),
  p('mid_beckham', 'David Beckham', 'MID', 'CM', 'icon', 'Real Madrid', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 115, 92, [80, 89, 96, 86, 68, 78], 118, { heightM: 1.83, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'stubble' }),
  p('mid_nedved', 'Pavel Nedvěd', 'MID', 'CAM', 'icon', 'Juventus', '🇨🇿', 'Czechia', 118, 92, [88, 90, 90, 90, 68, 86], 119, { heightM: 1.77, skinTone: '#f5d0b5', hairStyle: 'long_tied', beardStyle: 'none' }),

  // Additional Modern & Icon Forwards
  p('fwd_son', 'Son Heung-min', 'FWD', 'LW', 'modern', 'Real Madrid', '🇰🇷', 'South Korea', 90, 88, [90, 90, 82, 87, 44, 76], 120, { heightM: 1.84, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('fwd_osimhen', 'Victor Osimhen', 'FWD', 'ST', 'modern', 'SSC Napoli', '🇳🇬', 'Nigeria', 92, 88, [92, 88, 72, 84, 44, 88], 121, { heightM: 1.86, skinTone: '#5c3818', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('fwd_gyokeres', 'Viktor Gyökeres', 'FWD', 'ST', 'modern', 'Sporting CP', '🇸🇪', 'Sweden', 92, 88, [90, 89, 77, 85, 45, 92], 122, { heightM: 1.89, skinTone: '#f5d0b5', hairStyle: 'slicked', beardStyle: 'stubble' }),
  p('fwd_nicowilliams', 'Nico Williams', 'FWD', 'LW', 'modern', 'FC Barcelona', '🇪🇸', 'Spain', 88, 87, [95, 81, 82, 91, 40, 72], 123, { heightM: 1.81, skinTone: '#5c3818', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('fwd_olise', 'Michael Olise', 'FWD', 'RW', 'modern', 'Bayern Munich', '🇫🇷', 'France', 86, 87, [87, 84, 88, 91, 46, 72], 124, { heightM: 1.84, skinTone: '#8d5524', hairStyle: 'curly_afro', beardStyle: 'none', dominantFoot: 'L' }),
  p('fwd_griezmann', 'Antoine Griezmann', 'FWD', 'ST', 'modern', 'Atlético Madrid', '🇫🇷', 'France', 84, 88, [82, 88, 88, 89, 58, 75], 125, { heightM: 1.76, skinTone: '#f5d0b5', hairStyle: 'long_tied', beardStyle: 'none', dominantFoot: 'L' }),
  p('fwd_benzema', 'Karim Benzema', 'FWD', 'ST', 'icon', 'Real Madrid', '🇫🇷', 'France', 132, 93, [85, 93, 88, 91, 42, 84], 126, { heightM: 1.85, skinTone: '#e4b38d', hairStyle: 'buzzed', beardStyle: 'full' }),
  p('fwd_suarez', 'Luis Suárez', 'FWD', 'ST', 'icon', 'FC Barcelona', '🇺🇾', 'Uruguay', 134, 93, [85, 94, 84, 90, 48, 88], 127, { heightM: 1.82, skinTone: '#e4b38d', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('fwd_neymar', 'Neymar Jr.', 'FWD', 'LW', 'icon', 'FC Barcelona', '🇧🇷', 'Brazil', 142, 94, [92, 89, 90, 98, 36, 69], 128, { heightM: 1.75, skinTone: '#c68b59', hairStyle: 'short_fade', beardStyle: 'stubble' }),
  p('fwd_bale', 'Gareth Bale', 'FWD', 'RW', 'icon', 'Real Madrid', '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Wales', 128, 93, [96, 92, 86, 89, 58, 86], 129, { heightM: 1.85, skinTone: '#f5d0b5', hairStyle: 'long_tied', beardStyle: 'full', dominantFoot: 'L' }),
  p('fwd_rooney', 'Wayne Rooney', 'FWD', 'ST', 'icon', 'Arsenal', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'England', 124, 92, [86, 92, 87, 88, 56, 92], 130, { heightM: 1.76, skinTone: '#f5d0b5', hairStyle: 'buzzed', beardStyle: 'stubble' }),
  p('fwd_drogba', 'Didier Drogba', 'FWD', 'ST', 'icon', 'Chelsea', '🇨🇮', 'Ivory Coast', 122, 92, [86, 92, 79, 85, 48, 95], 131, { heightM: 1.89, skinTone: '#5c3818', hairStyle: 'long_tied', beardStyle: 'goatee' }),
  p('fwd_ibra', 'Zlatan Ibrahimović', 'FWD', 'ST', 'icon', 'AC Milan', '🇸🇪', 'Sweden', 130, 93, [84, 94, 84, 90, 40, 95], 132, { heightM: 1.95, skinTone: '#e4b38d', hairStyle: 'long_tied', beardStyle: 'full' }),
  p('fwd_delpiero', 'Alessandro Del Piero', 'FWD', 'ST', 'icon', 'Juventus', '🇮🇹', 'Italy', 120, 92, [85, 92, 89, 93, 38, 74], 133, { heightM: 1.74, skinTone: '#f5d0b5', hairStyle: 'short_fade', beardStyle: 'none' }),
  p('fwd_robben', 'Arjen Robben', 'FWD', 'RW', 'icon', 'Bayern Munich', '🇳🇱', 'Netherlands', 122, 92, [95, 90, 84, 94, 36, 74], 134, { heightM: 1.80, skinTone: '#f5d0b5', hairStyle: 'buzzed', beardStyle: 'none', dominantFoot: 'L' }),
];

export function filterPlayersByEra(era: EraPoolFilter): Player[] {
  if (era === 'modern') return CURATED_PLAYERS.filter((pl) => pl.era === 'modern');
  if (era === 'icon') return CURATED_PLAYERS.filter((pl) => pl.era === 'icon');
  return [...CURATED_PLAYERS];
}

export function createReservePlayer(
  pos: Position,
  role: Role,
  index: number,
  teamCode: string
): Player {
  const ovr = 62 + (index % 3); // strictly OVR 62-64 Youth Academy Reserve
  const baseStat = ovr;
  const stats =
    pos === 'GK'
      ? { pac: 60, sho: 61, pas: 59, dri: 64, def: 63, phy: 63 }
      : pos === 'DEF'
      ? { pac: 65, sho: 45, pas: 60, dri: 58, def: 65, phy: 66 }
      : pos === 'MID'
      ? { pac: 64, sho: 58, pas: 65, dri: 65, def: 58, phy: 62 }
      : { pac: 68, sho: 64, pas: 58, dri: 66, def: 38, phy: 61 };

  return {
    id: `res_${teamCode.toLowerCase()}_${pos.toLowerCase()}_${index}`,
    name: `${teamCode} Youth ${role} #${index + 1}`,
    pos,
    role,
    era: 'reserve',
    club: `${teamCode} Academy`,
    flag: '🎓',
    nationality: 'Academy',
    base: 1,
    ovr: baseStat,
    stats,
    appearance: makeAppearance(index + 90, { beardStyle: 'none' }),
  };
}
