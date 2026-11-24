import { formatDate, formatStars, Player, POSITION_LABEL, PositionCode, SaveFile, SeasonStyle } from '../domain/models';
import { lastSeason } from '../domain/projection';
import { ColumnKey, ImportedPlayer, ImportIssue } from './parse-squad';

/** The id a save keeps across re-imports, until several saves are supported. */
export const SAVE_ID = 'squad';

export interface ImportDetails {
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
): ImportPreview {
  const current = existing && !existing.sample ? existing.players : [];
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
  let abilityRanges = 0;

  for (const row of imported) {
    if (row.ability && row.ability.max !== row.ability.min) abilityRanges++;
    const at = unmatched.findIndex((p) => p.name === row.name);
    const before = at >= 0 ? unmatched.splice(at, 1)[0] : undefined;
    const player = toPlayer(row, before?.id ?? newId(row.name, usedIds), before);
    if (before) keepUnreadable(player, before, unreadable.get(row.name));
    players.push(player);
    if (before) staying.push({ player, changes: changesBetween(before, player) });
    else arriving.push(player);
  }

  // Players whose rows were skipped haven't left; keep them untouched.
  const leaving: Player[] = [];
  for (const before of unmatched) {
    if (skipped.has(before.name)) {
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
  };
}

export function buildSave(preview: ImportPreview, details: ImportDetails, existing: SaveFile | null): SaveFile {
  const club = details.club.trim();
  return {
    id: SAVE_ID,
    club,
    shortCode: shortCode(club),
    game: 'FM27',
    seasonStyle: details.seasonStyle,
    currentSeason: details.currentSeason,
    dataAsOf: new Date().toISOString().slice(0, 10),
    dataNote: `Imported from ${details.fileName}`,
    players: preview.players,
    shortlist: existing && !existing.sample ? existing.shortlist : [],
  };
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
