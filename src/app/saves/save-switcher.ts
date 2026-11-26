import { ChangeDetectionStrategy, Component, ElementRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDate } from '../domain/models';
import { lastBackupText } from '../state/backup';
import { PlanStore } from '../state/plan-store';
import { SaveLibrary, SaveSummary } from '../state/save-library';
import { Icon } from '../ui/icon';

/** The save card in the rail. It opens a list of saves to switch between. */
@Component({
  selector: 'app-save-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  host: {
    class: 'switcher',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close(true)',
  },
  template: `
    <button
      type="button"
      class="save"
      [attr.aria-expanded]="open()"
      aria-controls="save-list"
      (click)="toggle()"
      [title]="store.save().name + ' · ' + subline()"
    >
      <span class="crest" aria-hidden="true">{{ store.save().shortCode }}</span>
      <span class="save-text">
        <strong>{{ store.save().name }}</strong>
        <small>{{ subline() }}</small>
      </span>
      <app-icon name="chevron" class="save-chevron" />
      <span class="sr-only">, switch save</span>
    </button>

    @if (open()) {
      <div class="switch-panel" id="save-list">
        @if (library.saves().length) {
          <ul class="switch-saves" aria-label="Saves in this browser">
            @for (s of library.saves(); track s.id) {
              <li>
                <button
                  type="button"
                  class="switch-save"
                  [class.on]="s.id === store.save().id"
                  [attr.aria-current]="s.id === store.save().id ? 'true' : null"
                  (click)="pick(s)"
                  [title]="s.name + ' · ' + details(s)"
                >
                  <span class="crest small" aria-hidden="true">{{ s.shortCode }}</span>
                  <span class="save-text">
                    <strong>{{ s.name }}</strong>
                    <small>{{ details(s) }}</small>
                  </span>
                  @if (s.id === store.save().id) {
                    <app-icon name="check" class="switch-check" />
                  }
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="switch-empty">
            {{
              store.save().sample
                ? 'Sample squad. Import from FM to add your own save.'
                : 'No saves yet.'
            }}
          </p>
        }
        <div class="switch-actions">
          <a
            class="switch-action"
            routerLink="/import"
            [queryParams]="{ as: 'new' }"
            (click)="close()"
          >
            <app-icon name="plus" /> Add save
          </a>
          <a class="switch-action" routerLink="/saves" (click)="close()">
            <app-icon name="stack" />
            <span class="save-text"
              >Saves &amp; backup<small>{{ backup() }}</small></span
            >
          </a>
        </div>
      </div>
    }
  `,
})
export class SaveSwitcher {
  protected readonly store = inject(PlanStore);
  protected readonly library = inject(SaveLibrary);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly open = signal(false);

  protected subline(): string {
    const save = this.store.save();
    return save.name !== save.club
      ? `${save.club} · ${save.game}`
      : `${save.game} · ${save.dataNote}`;
  }

  protected details(s: SaveSummary): string {
    const club = s.name !== s.club ? `${s.club} · ` : '';
    return `${club}${s.game} · ${s.dataAsOf ? formatDate(s.dataAsOf) : 'no date'}`;
  }

  protected backup(): string {
    return lastBackupText(this.library.lastBackup());
  }

  protected toggle(): void {
    this.open.update((o) => !o);
  }

  protected pick(s: SaveSummary): void {
    this.store.switchTo(s.id);
    this.close(true);
  }

  close(focusCard = false): void {
    if (!this.open()) return;
    this.open.set(false);
    if (focusCard) this.host.nativeElement.querySelector<HTMLElement>('.save')?.focus();
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node)) this.close();
  }
}
