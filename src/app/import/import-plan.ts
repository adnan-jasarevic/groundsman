import {
  fieldValue,
  FIELD_LABEL,
  fmName,
  formatValue,
  sameValue,
  withValue,
} from '../domain/manual-edits';
import {
  FmField,
  FmValues,
  formatDate,
  formatStars,
  Player,
  POSITION_LABEL,
  PositionCode,
  SaveFile,
  SeasonStyle,
} from '../domain/models';
import { lastSeason } from '../domain/projection';
import { newSaveId } from '../state/save-storage';
import { ColumnKey, ImportedPlayer, ImportIssue } from './parse-squad';

export interface ImportDetails {
  /** The save's own name, e.g. "Man Utd 2nd go". */
  name: string;
  club: string;
  seasonStyle: SeasonStyle;
  currentSeason: number;
  fileName: string;
}

export interface Change {
  label: string;
  from: string;
  to: string;
}

export interface StayingPlayer {
  player: Player;
  changes: Change[];
  /** Their row couldn't be read, so they stay exactly as they were. */
  unread?: boolean;
}

/** A field the user changed by hand where this export says something else. */
export interface KeptEdit {
  /** "playerId:field", the key ImportChoices.useFm takes. */
  key: string;
  playerId: string;
  name: string;
  field: FmField;
  label: string;
  yours: string;
  fm: string;
  /** True when the user picked FM's value for this import. */
  useFm: boolean;
}

/** What the user picked in the preview. Edits are kept and removals stay unless picked here. */
export interface ImportChoices {
  useFm: ReadonlySet<string>;
  bringBack: ReadonlySet<string>;
}

const NO_CHOICES: ImportChoices = { useFm: new Set(), bringBack: new Set() };

export interface ImportPreview {
  /** Every player the save will hold after the import. */
  players: Player[];
  arriving: Player[];
  staying: StayingPlayer[];
  leaving: Player[];
  /** True when there's no real squad yet to compare against. */
  firstImport: boolean;
  /** Ability shown as a range in FM; the low end is used. */
  abilityRanges: number;
  /** Hand edits where FM says something else. */
  edits: KeptEdit[];
  /** Players added by hand who aren't in the export. They stay. */
  addedKept: Player[];
  /** Players removed by hand who are in the export, by name, and whether they come back. */
  removedSeen: { name: string; back: boolean }[];
  /** FM names of removed players after this import. */
  removed: string[];
}

/**
 * Turns parsed export rows into the save's players. Re-imports match by name:
 * a matched player keeps their id (and so their places in the depth chart).
 * A read problem never costs data: a skipped row keeps that player as they were,
 * and an unreadable value keeps the one already stored.
 */
export function planImport(
  imported: ImportedPlayer[],
  existing: SaveFile | null,
  issues: ImportIssue[] = [],
  choices: ImportChoices = NO_CHOICES,
): ImportPreview {
  const current = existing && !existing.sample ? existing.players : [];
  const removedBefore = existing && !existing.sample ? (existing.removed ?? []) : [];
  const removed = new Set(removedBefore);
  const skipped = new Set(issues.filter((i) => i.skipped && i.player).map((i) => i.player!));
  const unreadable = new Map<string, Set<ColumnKey>>();
  for (const i of issues) {
    if (i.skipped || !i.player || !i.column || i.row === 0) continue;
    unreadable.set(i.player, (unreadable.get(i.player) ?? new Set()).add(i.column));
  }
  const unmatched = [...current];
  const usedIds = new Set(current.map((p) => p.id));
  const arriving: Player[] = [];
  const staying: StayingPlayer[] = [];
  const players: Player[] = [];
  // A column the view doesn't have says nothing about a hand edit.
  const absent = new Set(
    (['ability', 'potential', 'contractExpires', 'squadStatus', 'nationality'] as const).filter(
      (k) => imported.every((r) => r[k] === undefined),
    ),
  );
  const edits: KeptEdit[] = [];
  const removedSeen: { name: string; back: boolean }[] = [];
  let abilityRanges = 0;

  for (const row of imported) {
    if (removed.has(row.name)) {
      const back = choices.bringBack.has(row.name);
      removedSeen.push({ name: row.name, back });
      if (!back) continue;
      removed.delete(row.name);
    }
    if (row.ability && row.ability.max !== row.ability.min) abilityRanges++;
    const at = unmatched.findIndex((p) => fmName(p) === row.name);
    const before = at >= 0 ? unmatched.splice(at, 1)[0] : undefined;
    let player = toPlayer(row, before?.id ?? newId(row.name, usedIds), before);
    if (before) {
      const columns = unreadable.get(row.name);
      keepUnreadable(player, before, columns);
      if (before.fm) {
        const unknown = new Set<ColumnKey>([...absent, ...(columns ?? [])]);
        player = keepEdits(player, before, unknown, choices, edits);
      }
    }
    players.push(player);
    if (before) staying.push({ player, changes: changesBetween(before, player) });
    else arriving.push(player);
  }

  // Players whose rows were skipped haven't left, and neither have players
  // added by hand; keep them untouched.
  const leaving: Player[] = [];
  const addedKept: Player[] = [];
  for (const before of unmatched) {
    if (before.added) {
      players.push(before);
      addedKept.push(before);
    } else if (skipped.has(fmName(before))) {
      players.push(before);
      staying.push({ player: before, changes: [], unread: true });
    } else {
      leaving.push(before);
    }
  }

  return {
    players,
    arriving,
    staying,
    leaving,
    firstImport: current.length === 0,
    abilityRanges,
    edits,
    addedKept,
    removedSeen,
    removed: [...removed],
  };
}

/** The save an import produces: an update of `existing`, or a new save when it's null. */
export function buildSave(preview: ImportPreview, details: ImportDetails, existing: SaveFile | null): SaveFile {
  const club = details.club.trim();
  return {
    id: existing && !existing.sample ? existing.id : newSaveId(),
    name: details.name.trim() || club,
    club,
    shortCode: shortCode(club),
    game: 'FM27',
    seasonStyle: details.seasonStyle,
    currentSeason: details.currentSeason,
    dataAsOf: new Date().toISOString().slice(0, 10),
    dataNote: `Imported from ${details.fileName}`,
    players: preview.players,
    shortlist: existing && !existing.sample ? existing.shortlist : [],
    ...(preview.removed.length ? { removed: preview.removed } : {}),
  };
}

/** The export's column behind each field FM fills in. */
const FIELD_COLUMNS: Partial<Record<FmField, ColumnKey[]>> = {
  ability: ['ability'],
  potential: ['potential'],
  contractExpires: ['contractExpires'],
  positions: ['position', 'bestPosition'],
  squadStatus: ['squadStatus'],
  nationality: ['nationality'],
};

/**
 * Hand edits win over the export unless the user picked FM's value. An edit
 * FM now agrees with is no longer an edit. Where the export's value couldn't
 * be read, the edit and FM's earlier value both stand.
 */
function keepEdits(
  player: Player,
  before: Player,
  unreadable: Set<ColumnKey> | undefined,
  choices: ImportChoices,
  edits: KeptEdit[],
): Player {
  let next = player;
  const fm: FmValues = {};
  for (const field of Object.keys(before.fm!) as FmField[]) {
    const yours = fieldValue(before, field);
    if (FIELD_COLUMNS[field]?.some((c) => unreadable?.has(c))) {
      next = withValue(next, field, yours);
      (fm as Record<string, unknown>)[field] = before.fm![field];
      continue;
    }
    const fmNow = fieldValue(player, field);
    if (sameValue(field, yours, fmNow)) continue;
    const key = `${before.id}:${field}`;
    const useFm = choices.useFm.has(key);
    edits.push({
      key,
      playerId: before.id,
      name: before.name,
      field,
      label: FIELD_LABEL[field],
      yours: formatValue(field, yours),
      fm: formatValue(field, fmNow),
      useFm,
    });
    if (useFm) continue;
    next = withValue(next, field, yours);
    (fm as Record<string, unknown>)[field] = fmNow;
  }
  if (Object.keys(fm).length) next = { ...next, fm };
  return next;
}

/** Calendar-year leagues end contracts late in the year; split seasons mid-year. */
export function guessSeasonStyle(imported: ImportedPlayer[]): SeasonStyle | undefined {
  const months = imported.flatMap((p) => (p.contractExpires ? [Number(p.contractExpires.slice(5, 7))] : []));
  if (!months.length) return undefined;
  const late = months.filter((m) => m >= 10).length;
  return late > months.length / 2 ? 'calendar' : 'split';
}

/** The earliest season any contract runs out in: usually the current one. */
export function guessCurrentSeason(imported: ImportedPlayer[], style: SeasonStyle): number | undefined {
  const seasons = imported.flatMap((p) => (p.contractExpires ? [lastSeason(p.contractExpires, style)] : []));
  return seasons.length ? Math.min(...seasons) : undefined;
}

/** Up to three letters from the club's words: "Harju Athletic" → "HA". */
export function shortCode(club: string): string {
  const words = club.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

function toPlayer(row: ImportedPlayer, id: string, before?: Player): Player {
  const ability = row.ability?.min ?? 0;
  const potential = row.potential?.min ?? ability;
  const player: Player = {
    id,
    name: row.name,
    age: row.age,
    nationality: row.nationality ?? '',
    positions: row.positions,
    ability,
    potential,
  };
  if (before?.known) player.known = before.known;
  if (row.potential && row.potential.max > row.potential.min) player.potentialMax = row.potential.max;
  if (row.contractExpires) player.contractExpires = row.contractExpires;
  if (row.squadStatus) player.squadStatus = row.squadStatus;
  if (row.info) player.info = row.info;
  return player;
}

/** Where a value couldn't be read, the stored one stands. */
function keepUnreadable(player: Player, before: Player, columns?: Set<ColumnKey>): void {
  if (!columns) return;
  if (columns.has('contractExpires')) {
    if (before.contractExpires) player.contractExpires = before.contractExpires;
    else delete player.contractExpires;
  }
  if (columns.has('ability')) player.ability = before.ability;
  if (columns.has('potential')) {
    player.potential = before.potential;
    if (before.potentialMax !== undefined) player.potentialMax = before.potentialMax;
    else delete player.potentialMax;
  }
  if (columns.has('position') || columns.has('bestPosition')) player.positions = before.positions;
}

function changesBetween(before: Player, after: Player): Change[] {
  const changes: Change[] = [];
  const add = (label: string, from: string, to: string) => {
    if (from !== to) changes.push({ label, from, to });
  };
  const date = (iso?: string) => (iso ? formatDate(iso) : 'none');
  add('Contract', date(before.contractExpires), date(after.contractExpires));
  add('Ability', formatStars(before.ability), formatStars(after.ability));
  add(
    'Potential',
    formatStars(before.potential, before.potentialMax),
    formatStars(after.potential, after.potentialMax),
  );
  add('Status', before.squadStatus ?? 'none', after.squadStatus ?? 'none');
  add('Positions', positions(before), positions(after));
  return changes;
}

function positions(p: Player): string {
  return (Object.keys(p.positions) as PositionCode[])
    .sort()
    .map((c) => POSITION_LABEL[c])
    .join(', ');
}

function newId(name: string, used: Set<string>): string {
  const base =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'player';
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}
