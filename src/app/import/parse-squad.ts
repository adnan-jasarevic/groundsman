import { Familiarity, PositionCode } from '../domain/models';
import {
  DateOrder,
  guessDateOrder,
  isBlank,
  parseAge,
  parseDate,
  parsePositions,
  parseStars,
  StarRange,
} from './fm-values';
import { ExportFormat, readTable } from './read-table';

/** A player as read from an FM export, before it becomes part of a save. */
export interface ImportedPlayer {
  name: string;
  age: number;
  positions: Partial<Record<PositionCode, Familiarity>>;
  nationality?: string;
  ability?: StarRange;
  potential?: StarRange;
  /** ISO date the contract expires. */
  contractExpires?: string;
  /** FM's Playing Time, e.g. "Star Player", "Breakthrough Prospect". */
  squadStatus?: string;
  /** FM's Inf column as printed, e.g. "Wnt", "HGN". */
  info?: string;
}

export type ColumnKey =
  | 'name'
  | 'position'
  | 'bestPosition'
  | 'age'
  | 'nationality'
  | 'ability'
  | 'potential'
  | 'contractExpires'
  | 'squadStatus'
  | 'info';

/** The header FM uses for each column, plus other names it goes by. */
export const COLUMNS: Record<ColumnKey, { label: string; aliases: string[]; required?: boolean }> =
  {
    name: { label: 'Player', aliases: ['player', 'name'], required: true },
    position: { label: 'Position', aliases: ['position', 'positions', 'pos'], required: true },
    age: { label: 'Age', aliases: ['age'], required: true },
    bestPosition: { label: 'Best Pos', aliases: ['best pos', 'best position'] },
    nationality: { label: 'Nation', aliases: ['nation', 'nat', 'nationality'] },
    ability: { label: 'Ability', aliases: ['ability'] },
    potential: { label: 'Potential', aliases: ['potential'] },
    contractExpires: { label: 'Expires', aliases: ['expires', 'contract expires', 'contract end'] },
    squadStatus: { label: 'Playing Time', aliases: ['playing time', 'squad status'] },
    info: { label: 'Inf', aliases: ['inf'] },
  };

const COLUMN_KEYS = Object.keys(COLUMNS) as ColumnKey[];

export interface ImportIssue {
  /** 1-based row in the export, not counting the header. */
  row: number;
  player?: string;
  column?: ColumnKey;
  value?: string;
  message: string;
  /** Skipped rows aren't imported; other issues just leave one field blank. */
  skipped: boolean;
}

export interface SquadImport {
  format: ExportFormat;
  players: ImportedPlayer[];
  /** Columns found, by key, with the header text the export used. */
  found: Partial<Record<ColumnKey, string>>;
  /** Useful columns the view doesn't have. */
  missing: ColumnKey[];
  issues: ImportIssue[];
  dateOrder: DateOrder;
}

export class ImportError extends Error {}

const normalise = (header: string) => header.toLowerCase().replace(/\s+/g, ' ').trim();

/** Reads an FM squad view (web page, text or CSV, any column order and set). */
export function parseSquad(input: string): SquadImport {
  if (!input.trim()) throw new ImportError('The export is empty.');
  const { format, headers, rows } = readTable(input);

  const index: Partial<Record<ColumnKey, number>> = {};
  const found: Partial<Record<ColumnKey, string>> = {};
  headers.forEach((header, i) => {
    const key = COLUMN_KEYS.find((k) => COLUMNS[k].aliases.includes(normalise(header)));
    if (key && index[key] === undefined) {
      index[key] = i;
      found[key] = header;
    }
  });

  const missing = COLUMN_KEYS.filter((k) => index[k] === undefined);
  const missingRequired = missing.filter((k) => COLUMNS[k].required);
  if (missingRequired.length) {
    const names = missingRequired.map((k) => COLUMNS[k].label).join(', ');
    throw new ImportError(
      `The export has no ${names} column. Add it to the view in FM and export again.`,
    );
  }
  if (!rows.length) throw new ImportError('The export has no players.');

  const cell = (row: string[], key: ColumnKey) =>
    index[key] === undefined ? undefined : row[index[key]!];
  const dateOrder = guessDateOrder(rows.map((r) => cell(r, 'contractExpires') ?? ''));
  const issues: ImportIssue[] = [];
  const players: ImportedPlayer[] = [];

  for (const [i, row] of rows.entries()) {
    const rowNo = i + 1;
    const name = cell(row, 'name') ?? '';
    const skip = (column: ColumnKey, message: string) =>
      issues.push({
        row: rowNo,
        player: name || undefined,
        column,
        value: cell(row, column),
        message,
        skipped: true,
      });
    const blankField = (column: ColumnKey, message: string) =>
      issues.push({
        row: rowNo,
        player: name,
        column,
        value: cell(row, column),
        message,
        skipped: false,
      });

    if (isBlank(name)) {
      skip('name', 'No player name.');
      continue;
    }
    const age = parseAge(cell(row, 'age') ?? '');
    if (age === null) {
      skip('age', 'Age is not a number.');
      continue;
    }
    const listed = parsePositions(cell(row, 'position') ?? '');
    if (!listed.codes.length) {
      skip('position', 'Position could not be read.');
      continue;
    }
    if (listed.unread.length) {
      blankField(
        'position',
        `Could not read ${listed.unread.join(', ')}. The other positions were kept.`,
      );
    }

    const positions: Partial<Record<PositionCode, Familiarity>> = {};
    for (const code of listed.codes) positions[code] = 3;
    const bestRaw = cell(row, 'bestPosition');
    if (!isBlank(bestRaw)) {
      const best = parsePositions(bestRaw!);
      if (best.codes.length === 1 && !best.unread.length) positions[best.codes[0]] = 4;
      else
        blankField(
          'bestPosition',
          'Best position could not be read, so no position is marked Natural.',
        );
    }

    const player: ImportedPlayer = { name, age, positions };

    const nation = cell(row, 'nationality');
    if (!isBlank(nation)) player.nationality = nation;

    for (const key of ['ability', 'potential'] as const) {
      const raw = cell(row, key);
      if (isBlank(raw)) continue;
      const stars = parseStars(raw!);
      if (stars) player[key] = stars;
      else blankField(key, `${COLUMNS[key].label} could not be read as stars.`);
    }

    const expiresRaw = cell(row, 'contractExpires');
    if (!isBlank(expiresRaw)) {
      const date = parseDate(expiresRaw!, dateOrder);
      if (date) player.contractExpires = date;
      else blankField('contractExpires', 'Contract expiry is not a date.');
    }

    const status = cell(row, 'squadStatus');
    if (!isBlank(status)) player.squadStatus = status;
    const info = cell(row, 'info');
    if (!isBlank(info)) player.info = info;

    players.push(player);
  }

  // Re-imports match players by name, so the same name twice needs a look.
  const seen = new Map<string, number>();
  players.forEach((p) => seen.set(p.name, (seen.get(p.name) ?? 0) + 1));
  for (const [name, count] of seen) {
    if (count > 1)
      issues.push({
        row: 0,
        player: name,
        column: 'name',
        message: `${count} players are called ${name}. Check them after importing.`,
        skipped: false,
      });
  }

  return { format, players, found, missing, issues, dateOrder };
}
