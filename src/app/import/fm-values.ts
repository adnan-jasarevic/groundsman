import { PositionCode } from '../domain/models';

/** A star rating as FM shows it: one value ("3.5") or a scouted range ("2.0-3.0"). */
export interface StarRange {
  min: number;
  max: number;
}

const SIDED: Record<string, Partial<Record<string, PositionCode>>> = {
  D: { R: 'DR', C: 'DC', L: 'DL' },
  WB: { R: 'WBR', L: 'WBL' },
  M: { R: 'MR', C: 'MC', L: 'ML' },
  AM: { R: 'AMR', C: 'AMC', L: 'AML' },
  ST: { C: 'ST' },
};

const UNSIDED: Record<string, PositionCode> = { GK: 'GK', DM: 'DM' };

export interface ParsedPositions {
  codes: PositionCode[];
  /** Pieces that aren't a known position, e.g. "SW" or "WB (C)". */
  unread: string[];
}

/**
 * Reads FM position notation: roles joined by "/", then the sides in brackets,
 * with groups separated by commas, e.g. "D/WB/AM (R)", "D (RLC)", "D (C), DM".
 * Covers every position on FM's grid. Unknown pieces are returned in `unread`
 * so the rest of the string still counts.
 */
export function parsePositions(value: string): ParsedPositions {
  const codes: PositionCode[] = [];
  const unread: string[] = [];
  for (const part of value.split(',').map((p) => p.trim())) {
    if (!part) continue;
    const match = /^([A-Z/]+)\s*(?:\(([A-Z]+)\))?$/i.exec(part);
    if (!match) {
      unread.push(part);
      continue;
    }
    const sides = (match[2] ?? '').toUpperCase().split('').filter(Boolean);
    for (const written of match[1].split('/').filter(Boolean)) {
      const role = written.toUpperCase();
      if (UNSIDED[role]) {
        codes.push(UNSIDED[role]);
        continue;
      }
      const bySide = SIDED[role];
      // ST is always central, so FM sometimes leaves the side off.
      const roleSides = sides.length ? sides : role === 'ST' ? ['C'] : [];
      if (!bySide || !roleSides.length) {
        unread.push(sides.length ? `${written} (${sides.join('')})` : written);
        continue;
      }
      const badSides = roleSides.filter((side) => !bySide[side]);
      for (const side of roleSides) if (bySide[side]) codes.push(bySide[side]);
      if (badSides.length) unread.push(`${role} (${badSides.join('')})`);
    }
  }
  return { codes: [...new Set(codes)], unread };
}

/** "3.5" or "2.0-3.0", half stars from 0.5 to 5. */
export function parseStars(value: string): StarRange | null {
  const match = /^(\d(?:[.,]\d)?)(?:\s*-\s*(\d(?:[.,]\d)?))?$/.exec(value.trim());
  if (!match) return null;
  const min = toStar(match[1]);
  const max = match[2] === undefined ? min : toStar(match[2]);
  if (min === null || max === null || max < min) return null;
  return { min, max };
}

function toStar(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return n >= 0.5 && n <= 5 && Number.isInteger(n * 2) ? n : null;
}

export function parseAge(value: string): number | null {
  if (!/^\d{1,2}$/.test(value.trim())) return null;
  const age = Number(value);
  return age >= 10 && age <= 60 ? age : null;
}

export type DateOrder = 'dmy' | 'mdy';

/** Splits "30/11/2048" (also with "." or "-") into its three numbers. */
export function dateParts(value: string): [number, number, number] | null {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value.trim());
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

/** Day first unless a date can only be read month first. */
export function guessDateOrder(values: string[]): DateOrder {
  let dmy = false;
  let mdy = false;
  for (const value of values) {
    const parts = dateParts(value);
    if (!parts) continue;
    if (parts[0] > 12) dmy = true;
    if (parts[1] > 12) mdy = true;
  }
  return mdy && !dmy ? 'mdy' : 'dmy';
}

/** Returns an ISO date (YYYY-MM-DD) or null if the date isn't real. */
export function parseDate(value: string, order: DateOrder): string | null {
  const parts = dateParts(value);
  if (!parts) return null;
  const [day, month] = order === 'dmy' ? [parts[0], parts[1]] : [parts[1], parts[0]];
  const year = parts[2];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  )
    return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** FM prints "-" or nothing when it has no value. */
export function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === '' || value.trim() === '-';
}
