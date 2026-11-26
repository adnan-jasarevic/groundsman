import { SaveFile } from '../domain/models';
import { newSaveId, StoredPlans } from './save-storage';

/** One save with its depth charts, as it travels in a backup file. */
export interface BackupEntry {
  save: SaveFile;
  plans: StoredPlans | null;
}

export interface BackupFile {
  app: 'groundsman';
  kind: 'backup';
  version: 1;
  exportedAt: string;
  saves: BackupEntry[];
}

export class BackupError extends Error {}

/** "2026-11-25" in the user's own time zone. */
export function localDate(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function makeBackup(saves: BackupEntry[], now = new Date()): BackupFile {
  return { app: 'groundsman', kind: 'backup', version: 1, exportedAt: now.toISOString(), saves };
}

/** "groundsman-backup-2026-11-25.json", or "groundsman-harju-athletic-2026-11-25.json" for one save. */
export function backupFileName(oneSave: string | null, now = new Date()): string {
  const date = localDate(now);
  const slug = oneSave
    ?.normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `groundsman-${slug || 'backup'}-${date}.json`;
}

const NOT_A_BACKUP = "That file isn't a Groundsman backup. Choose a .json file made with Back up.";

/** Reads a backup file's text. Throws BackupError with a message for the user. */
export function parseBackup(text: string): BackupEntry[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError(NOT_A_BACKUP);
  }
  if (!isObject(data) || data['app'] !== 'groundsman' || data['kind'] !== 'backup') {
    throw new BackupError(NOT_A_BACKUP);
  }
  if (typeof data['version'] !== 'number' || data['version'] > 1) {
    throw new BackupError(
      'This backup was made by a newer Groundsman. Reload the page and try again.',
    );
  }
  const saves = data['saves'];
  if (!Array.isArray(saves) || !saves.length)
    throw new BackupError('This backup has no saves in it.');
  return saves.map((entry, i) => {
    if (!isObject(entry) || !isSave(entry['save'])) {
      throw new BackupError(`Save ${i + 1} in this backup is damaged, so nothing was restored.`);
    }
    const save = entry['save'];
    return {
      save: { ...save, name: save.name || save.club, dataNote: save.dataNote ?? '' },
      plans: isPlans(entry['plans']) ? entry['plans'] : null,
    };
  });
}

/**
 * Gives restored saves room next to the ones already here. A save that is
 * already here comes in as a copy named "… (restored)"; nothing is overwritten.
 */
export function placeRestored(
  entries: BackupEntry[],
  here: { id: string; name: string }[],
): BackupEntry[] {
  const ids = new Set(here.map((s) => s.id));
  const names = new Set(here.map((s) => s.name.toLowerCase()));
  return entries.map(({ save, plans }) => {
    let { id, name } = save;
    if (ids.has(id)) {
      id = newSaveId();
      name = `${save.name} (restored)`;
      for (let n = 2; names.has(name.toLowerCase()); n++) name = `${save.name} (restored ${n})`;
    }
    ids.add(id);
    names.add(name.toLowerCase());
    return { save: { ...save, id, name, sample: undefined }, plans };
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlayer(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value['id'] === 'string' &&
    typeof value['name'] === 'string' &&
    typeof value['age'] === 'number' &&
    isObject(value['positions']) &&
    typeof value['ability'] === 'number' &&
    typeof value['potential'] === 'number'
  );
}

function isSave(value: unknown): value is SaveFile {
  return (
    isObject(value) &&
    typeof value['id'] === 'string' &&
    value['id'] !== '' &&
    typeof value['club'] === 'string' &&
    typeof value['shortCode'] === 'string' &&
    ['FM24', 'FM26', 'FM27'].includes(value['game'] as string) &&
    ['split', 'calendar'].includes(value['seasonStyle'] as string) &&
    typeof value['currentSeason'] === 'number' &&
    typeof value['dataAsOf'] === 'string' &&
    Array.isArray(value['players']) &&
    value['players'].every(isPlayer) &&
    Array.isArray(value['shortlist']) &&
    value['shortlist'].every(isPlayer)
  );
}

function isPlans(value: unknown): value is StoredPlans {
  return (
    isObject(value) &&
    typeof value['formationId'] === 'string' &&
    typeof value['tiers'] === 'number' &&
    isObject(value['plans'])
  );
}

/** "Never backed up", "Backed up today", "Last backup yesterday", "Last backup 12 days ago". */
export function lastBackupText(iso: string | null, now = new Date()): string {
  if (!iso) return 'Never backed up';
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = iso.split('-').map(Number);
  const days = Math.round((today - Date.UTC(y, m - 1, d)) / 86_400_000);
  if (days <= 0) return 'Backed up today';
  if (days === 1) return 'Last backup yesterday';
  return `Last backup ${days} days ago`;
}

/** Hands the browser a backup file to save. */
export function downloadBackup(
  entries: BackupEntry[],
  oneSave: string | null,
  now = new Date(),
): void {
  const blob = new Blob([JSON.stringify(makeBackup(entries, now), null, 1)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFileName(oneSave, now);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
