import { DepthPlan, SaveFile } from '../domain/models';

/** Local-only storage: every save and its plans live in this browser's localStorage. */

export interface StoredPlans {
  formationId: string;
  tiers: number;
  plans: Record<string, DepthPlan>;
}

export interface Library {
  activeId: string | null;
  /** Saves in the order they were added. */
  ids: string[];
  /** ISO date of the last full backup. */
  lastBackup: string | null;
}

const LIBRARY_KEY = 'groundsman.library';
/** Before several saves, the one squad lived here. */
const LEGACY_SAVE_KEY = 'groundsman.save';
const saveKey = (id: string) => `groundsman.save.${id}`;
const plansKey = (id: string) => `groundsman.plans.${id}`;

const EMPTY: Library = { activeId: null, ids: [], lastBackup: null };

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** The list of saves, moving a squad stored before several saves existed into it. */
export function readLibrary(): Library {
  const stored = read<Library>(LIBRARY_KEY);
  if (stored) {
    const ids = stored.ids.filter((id) => readSave(id) !== null);
    const activeId =
      stored.activeId && ids.includes(stored.activeId) ? stored.activeId : (ids[0] ?? null);
    return { ids, activeId, lastBackup: stored.lastBackup ?? null };
  }
  const legacy = read<SaveFile>(LEGACY_SAVE_KEY);
  if (!legacy) return EMPTY;
  const save = { ...legacy, name: legacy.name || legacy.club };
  const library: Library = { activeId: save.id, ids: [save.id], lastBackup: null };
  // Plans already sit under the save's id, so only the squad and the list move.
  if (writeSave(save) && writeLibrary(library)) {
    try {
      localStorage.removeItem(LEGACY_SAVE_KEY);
    } catch {
      // Left behind; the library wins from now on.
    }
  }
  return library;
}

export function writeLibrary(library: Library): boolean {
  return write(LIBRARY_KEY, library);
}

export function readSave(id: string): SaveFile | null {
  return read<SaveFile>(saveKey(id));
}

export function writeSave(save: SaveFile): boolean {
  return write(saveKey(save.id), save);
}

export function readPlans(id: string): StoredPlans | null {
  return read<StoredPlans>(plansKey(id));
}

export function writePlans(id: string, plans: StoredPlans): boolean {
  return write(plansKey(id), plans);
}

export function removeSave(id: string): void {
  try {
    localStorage.removeItem(saveKey(id));
    localStorage.removeItem(plansKey(id));
  } catch {
    // Nothing more to do: storage is blocked.
  }
}

/** False when the browser blocks storage outright (some private modes, blocked site data). */
export function storageAvailable(): boolean {
  try {
    const probe = 'groundsman.probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

/** Rough size of Groundsman's data in this browser, in bytes (UTF-16, two per character). */
export function storageBytes(): number {
  try {
    let chars = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)!;
      if (!key.startsWith('groundsman.')) continue;
      chars += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
    return chars * 2;
  } catch {
    return 0;
  }
}

export function newSaveId(): string {
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** The club's name, or "Club 2", "Club 3"… when a save already uses it. */
export function suggestName(club: string, taken: string[]): string {
  const base = club.trim();
  const used = new Set(taken.map((n) => n.trim().toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let n = 2; ; n++) if (!used.has(`${base} ${n}`.toLowerCase())) return `${base} ${n}`;
}
