import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { formatDate } from '../domain/models';
import {
  BackupEntry,
  BackupError,
  downloadBackup,
  lastBackupText,
  parseBackup,
  placeRestored,
} from '../state/backup';
import { PlanStore } from '../state/plan-store';
import { SaveLibrary, SaveSummary } from '../state/save-library';
import { Icon } from '../ui/icon';

const MAX_BACKUP_BYTES = 20_000_000;

@Component({
  selector: 'app-saves-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  templateUrl: './saves-page.html',
  host: { class: 'page' },
})
export class SavesPage {
  protected readonly store = inject(PlanStore);
  protected readonly library = inject(SaveLibrary);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);

  protected readonly renamingId = signal<string | null>(null);
  protected readonly draftName = signal('');

  protected readonly deleting = signal<SaveSummary | null>(null);
  protected readonly confirmText = signal('');
  protected readonly backedUpFirst = signal(false);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('deleteDialog');

  /** Outcome of the last restore or delete, read out politely. */
  protected readonly status = signal('');
  protected readonly restoreError = signal('');

  protected readonly backupAge = computed(() => lastBackupText(this.library.lastBackup()));
  /** Saves exist and no backup is older than two weeks. */
  protected readonly backupStale = computed(() => {
    const last = this.library.lastBackup();
    if (!this.library.saves().length) return false;
    return !last || Date.now() - new Date(`${last}T00:00`).getTime() > 14 * 86_400_000;
  });

  protected readonly size = computed(() => {
    const kb = this.library.bytes() / 1024;
    return kb < 1000 ? `${Math.max(1, Math.round(kb))} KB` : `${(kb / 1024).toFixed(1)} MB`;
  });

  protected readonly canDelete = computed(() => {
    const save = this.deleting();
    return !!save && this.confirmText().trim() === save.name.trim();
  });

  protected details(s: SaveSummary): string {
    const club = s.name !== s.club ? `${s.club} · ` : '';
    const players = `${s.players} ${s.players === 1 ? 'player' : 'players'}`;
    return `${club}${s.game} · ${players} · data as of ${s.dataAsOf ? formatDate(s.dataAsOf) : 'unknown'}`;
  }

  protected isOpen(s: SaveSummary): boolean {
    return this.store.hasSave() && this.store.save().id === s.id;
  }

  protected openSave(s: SaveSummary): void {
    this.store.switchTo(s.id);
    void this.router.navigate(['/depth-chart']);
  }

  protected startRename(s: SaveSummary): void {
    this.renamingId.set(s.id);
    this.draftName.set(s.name);
    this.afterRender(() => document.querySelector<HTMLInputElement>('.rename-input')?.select());
  }

  protected finishRename(s: SaveSummary): void {
    const name = this.draftName().trim();
    if (!name) return;
    if (name !== s.name) {
      this.store.rename(s.id, name);
      this.status.set(`Renamed to ${name}`);
    }
    this.renamingId.set(null);
    this.refocus(s.id, 'rename');
  }

  protected cancelRename(s: SaveSummary): void {
    this.renamingId.set(null);
    this.refocus(s.id, 'rename');
  }

  protected backupAll(): void {
    const entries = this.library.saves().flatMap((s) => this.entryOf(s.id));
    if (!entries.length) return;
    downloadBackup(entries, null);
    this.library.markBackedUp();
    this.status.set(
      `Backup file saved with ${entries.length} ${entries.length === 1 ? 'save' : 'saves'}`,
    );
  }

  protected backupOne(s: SaveSummary): void {
    const entries = this.entryOf(s.id);
    if (!entries.length) return;
    downloadBackup(entries, s.name);
    if (this.deleting()?.id === s.id) this.backedUpFirst.set(true);
  }

  protected async onRestoreFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.status.set('');
    this.restoreError.set('');
    if (file.size > MAX_BACKUP_BYTES) {
      this.restoreError.set('That file is too big to be a Groundsman backup.');
      return;
    }
    let entries: BackupEntry[];
    try {
      entries = parseBackup(await file.text());
    } catch (e) {
      this.restoreError.set(
        e instanceof BackupError
          ? e.message
          : "That file couldn't be opened. Try choosing it again.",
      );
      return;
    }
    const placed = placeRestored(entries, this.library.saves());
    const stored = this.library.add(placed);
    if (!this.store.hasSave() || this.store.save().sample) this.store.switchTo(placed[0].save.id);
    const names = placed.map((e) => e.save.name).join(', ');
    const n = `${placed.length} ${placed.length === 1 ? 'save' : 'saves'}`;
    if (stored) this.status.set(`Restored ${n}: ${names}`);
    else
      this.restoreError.set(
        `Restored ${n}, but this browser wouldn't store them. They're gone when you close the tab.`,
      );
  }

  protected askDelete(s: SaveSummary): void {
    this.deleting.set(s);
    this.confirmText.set('');
    this.backedUpFirst.set(false);
    // Open once the contents render, so focus lands in the name box.
    this.afterRender(() => this.dialog().nativeElement.showModal());
  }

  protected confirmDelete(): void {
    const save = this.deleting();
    if (!save || !this.canDelete()) return;
    this.store.deleteSave(save.id);
    this.status.set(`Deleted ${save.name}`);
    this.dialog().nativeElement.close();
  }

  protected closeDialog(): void {
    this.dialog().nativeElement.close();
  }

  protected onDialogClosed(): void {
    const save = this.deleting();
    this.deleting.set(null);
    this.confirmText.set('');
    // Back to the row's Delete button, or to the list when the save is gone.
    if (save && this.library.saves().some((s) => s.id === save.id)) this.refocus(save.id, 'delete');
    else this.afterRender(() => document.querySelector<HTMLElement>('#saves-heading')?.focus());
  }

  private entryOf(id: string): BackupEntry[] {
    const entry = this.library.entry(id);
    return entry ? [entry] : [];
  }

  private refocus(id: string, action: string): void {
    this.afterRender(() =>
      document
        .querySelector<HTMLElement>(`[data-save="${CSS.escape(id)}"] [data-action="${action}"]`)
        ?.focus(),
    );
  }

  private afterRender(fn: () => void): void {
    afterNextRender(fn, { injector: this.injector });
  }
}
