import { computed, Injectable, signal } from '@angular/core';
import { GameVersion, SaveFile } from '../domain/models';
import { BackupEntry, localDate } from './backup';
import {
  Library,
  readLibrary,
  readPlans,
  readSave,
  removeSave,
  storageAvailable,
  storageBytes,
  StoredPlans,
  writeLibrary,
  writePlans,
  writeSave,
} from './save-storage';

/** What the switcher and the saves screen show without loading every squad. */
export interface SaveSummary {
  id: string;
  name: string;
  club: string;
  shortCode: string;
  game: GameVersion;
  dataAsOf: string;
  players: number;
}

/** Why this browser isn't keeping changes: storage blocked outright, or full. */
export type StorageProblem = 'unavailable' | 'full' | null;

function summarise(save: SaveFile): SaveSummary {
  return {
    id: save.id,
    name: save.name,
    club: save.club,
    shortCode: save.shortCode,
    game: save.game,
    dataAsOf: save.dataAsOf,
    players: save.players.length,
  };
}

/** The saves kept in this browser. PlanStore holds the one that's open. */
@Injectable({ providedIn: 'root' })
export class SaveLibrary {
  private readonly library = signal<Library>(readLibrary());
  private readonly summaries = signal<Map<string, SaveSummary>>(this.readSummaries());

  readonly saves = computed(() =>
    this.library().ids.flatMap((id) => {
      const s = this.summaries().get(id);
      return s ? [s] : [];
    }),
  );
  readonly activeId = computed(() => this.library().activeId);
  readonly lastBackup = computed(() => this.library().lastBackup);
  readonly problem = signal<StorageProblem>(storageAvailable() ? null : 'unavailable');
  /** Bumped on every write so the size readout follows along. */
  private readonly writes = signal(0);
  readonly bytes = computed(() => (this.writes(), storageBytes()));

  /** The save to open on start: the last one used. */
  active(): SaveFile | null {
    const id = this.activeId();
    return id ? readSave(id) : null;
  }

  entry(id: string): BackupEntry | null {
    const save = readSave(id);
    return save ? { save, plans: readPlans(id) } : null;
  }

  setActive(id: string): void {
    this.commit({ ...this.library(), activeId: id });
  }

  /** Adds saves (an import as a new save, or a restore) and their plans. Returns false if storage refused. */
  add(entries: BackupEntry[]): boolean {
    let ok = true;
    for (const { save, plans } of entries) {
      ok = writeSave(save) && ok;
      if (plans) ok = writePlans(save.id, plans) && ok;
    }
    const ids = [...this.library().ids, ...entries.map((e) => e.save.id)];
    ok = this.commit({ ...this.library(), ids }) && ok;
    this.refresh(entries.map((e) => e.save));
    return this.report(ok);
  }

  /** Stores a changed save that's already in the list (a re-import or a rename). */
  put(save: SaveFile): boolean {
    const ok = writeSave(save);
    this.refresh([save]);
    return this.report(ok);
  }

  putPlans(id: string, plans: StoredPlans): boolean {
    return this.report(writePlans(id, plans));
  }

  remove(id: string): void {
    removeSave(id);
    const ids = this.library().ids.filter((x) => x !== id);
    const activeId = this.library().activeId === id ? (ids[0] ?? null) : this.library().activeId;
    this.commit({ ...this.library(), ids, activeId });
    const next = new Map(this.summaries());
    next.delete(id);
    this.summaries.set(next);
  }

  markBackedUp(now = new Date()): void {
    this.commit({ ...this.library(), lastBackup: localDate(now) });
  }

  private commit(library: Library): boolean {
    this.library.set(library);
    return this.report(writeLibrary(library));
  }

  private refresh(saves: SaveFile[]): void {
    const next = new Map(this.summaries());
    for (const save of saves) next.set(save.id, summarise(save));
    this.summaries.set(next);
  }

  /** Remembers whether the last write landed, so the screens can say when it didn't. */
  private report(ok: boolean): boolean {
    this.writes.update((n) => n + 1);
    if (ok) {
      if (this.problem() === 'full') this.problem.set(null);
    } else {
      this.problem.set(storageAvailable() ? 'full' : 'unavailable');
    }
    return ok;
  }

  private readSummaries(): Map<string, SaveSummary> {
    const map = new Map<string, SaveSummary>();
    for (const id of this.library().ids) {
      const save = readSave(id);
      if (save) map.set(id, summarise(save));
    }
    return map;
  }
}
