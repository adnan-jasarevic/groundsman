export type PositionCode =
  | 'GK'
  | 'DR'
  | 'DC'
  | 'DL'
  | 'WBR'
  | 'WBL'
  | 'DM'
  | 'MR'
  | 'MC'
  | 'ML'
  | 'AMR'
  | 'AMC'
  | 'AML'
  | 'ST';

export const POSITION_LABEL: Record<PositionCode, string> = {
  GK: 'GK',
  DR: 'D (R)',
  DC: 'D (C)',
  DL: 'D (L)',
  WBR: 'WB (R)',
  WBL: 'WB (L)',
  DM: 'DM',
  MR: 'M (R)',
  MC: 'M (C)',
  ML: 'M (L)',
  AMR: 'AM (R)',
  AMC: 'AM (C)',
  AML: 'AM (L)',
  ST: 'ST (C)',
};

/** FM position familiarity, from Natural (4) down to Unconvincing (1). */
export type Familiarity = 1 | 2 | 3 | 4;

export const FAMILIARITY_LABEL: Record<Familiarity, string> = {
  4: 'Natural',
  3: 'Accomplished',
  2: 'Competent',
  1: 'Unconvincing',
};

export type GameVersion = 'FM24' | 'FM26' | 'FM27';

export interface Player {
  id: string;
  name: string;
  /** Age at the start of the save's current season. */
  age: number;
  nationality: string;
  positions: Partial<Record<PositionCode, Familiarity>>;
  /** Scout-style stars, 0.5 to 5 in half steps. */
  ability: number;
  potential: number;
  /** Contract runs until 30 June of this year. Absent for shortlist targets. */
  contractEnd?: number;
  /** True for shortlist targets who are not at the club yet. */
  target?: boolean;
}

export interface FormationSlot {
  id: string;
  position: PositionCode;
  /** Anchor on the pitch in percent, attack towards the top. */
  x: number;
  y: number;
  line: 'attack' | 'midfield' | 'defence' | 'goal';
}

export interface Formation {
  id: string;
  name: string;
  slots: FormationSlot[];
}

export interface SaveFile {
  id: string;
  club: string;
  shortCode: string;
  game: GameVersion;
  /** Start year of the current in-game season, e.g. 2026 for 2026/27. */
  currentSeason: number;
  lastImport: string;
  synthetic: boolean;
  players: Player[];
  shortlist: Player[];
}

export interface DepthPlan {
  formationId: string;
  tiers: number;
  /** Ordered player ids per formation slot; index 0 is the starter. */
  slots: Record<string, string[]>;
}

export function seasonLabel(startYear: number): string {
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
}
