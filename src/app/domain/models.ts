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

/**
 * How the save's league counts seasons: 'split' runs over two years (2026/27,
 * most European leagues), 'calendar' runs within one year (2048, e.g. Finland).
 */
export type SeasonStyle = 'split' | 'calendar';

export interface Player {
  id: string;
  name: string;
  /** Name as fans use it on a team sheet, when the surname alone is wrong (e.g. "de Ligt", "Amad"). */
  known?: string;
  /** Age at the start of the save's current season. */
  age: number;
  nationality: string;
  positions: Partial<Record<PositionCode, Familiarity>>;
  /** Scout-style stars, 0.5 to 5 in half steps. */
  ability: number;
  /** Potential stars; the low end when FM shows a range. */
  potential: number;
  /** High end of the potential when FM shows a range such as 2.0-3.0. */
  potentialMax?: number;
  /** ISO date the contract expires, as recorded in FM. Absent for shortlist targets. */
  contractExpires?: string;
  /** FM's squad status (Playing Time), e.g. "Star Player". */
  squadStatus?: string;
  /** FM's Inf column as printed, e.g. "Wnt", "HGN". */
  info?: string;
  /** True for shortlist targets who are not at the club yet. */
  target?: boolean;
  /** Added by hand, not from an FM export. */
  added?: boolean;
  /**
   * FM's values for the fields the user changed by hand, so a re-import can
   * keep the edit and still show what FM says. Absent when nothing was edited.
   */
  fm?: FmValues;
}

/** Player fields that come from FM and can be changed by hand. */
export type FmField =
  | 'name'
  | 'age'
  | 'nationality'
  | 'positions'
  | 'ability'
  | 'potential'
  | 'contractExpires'
  | 'squadStatus';

/** FM's value per edited field. Null means FM had none (no contract date, no status). */
export interface FmValues {
  name?: string;
  age?: number;
  nationality?: string;
  positions?: Partial<Record<PositionCode, Familiarity>>;
  ability?: number;
  potential?: { min: number; max?: number };
  contractExpires?: string | null;
  squadStatus?: string | null;
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
  /** The user's name for this save, e.g. "Man Utd 2nd go". Starts as the club name. */
  name: string;
  club: string;
  shortCode: string;
  game: GameVersion;
  seasonStyle: SeasonStyle;
  /** Start year of the current in-game season, e.g. 2026 for 2026/27 or 2048 for 2048. */
  currentSeason: number;
  /** ISO date the squad data reflects. */
  dataAsOf: string;
  /** Where the data comes from, shown under the club name. */
  dataNote: string;
  players: Player[];
  shortlist: Player[];
  /** Built-in sample squad, not the user's own. An import replaces it outright. */
  sample?: boolean;
  /** FM names of players removed by hand. Re-imports leave them out until brought back. */
  removed?: string[];
}

export interface DepthPlan {
  formationId: string;
  tiers: number;
  /** Ordered player ids per formation slot; index 0 is the starter. */
  slots: Record<string, string[]>;
}

export function seasonLabel(startYear: number, style: SeasonStyle): string {
  if (style === 'calendar') return String(startYear);
  return `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`;
}

// prettier-ignore
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** "30 Nov 2048" (short) or "30 November 2048" (long) from an ISO date. */
export function formatDate(iso: string, month: 'short' | 'long' = 'short'): string {
  const [y, m, d] = iso.split('-').map(Number);
  const name = MONTHS[m - 1];
  return `${d} ${month === 'short' ? name.slice(0, 3) : name} ${y}`;
}

/** "Nov 48" for tight spaces. */
export function formatMonthYear(iso: string): string {
  const [y, m] = iso.split('-').map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${String(y % 100).padStart(2, '0')}`;
}

/** Stars as FM prints them: "4.0", or "2.0–3.0" for a range. */
export function formatStars(min: number, max?: number): string {
  return max !== undefined && max !== min ? `${min.toFixed(1)}–${max.toFixed(1)}` : min.toFixed(1);
}
