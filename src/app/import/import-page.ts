import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  formatStars,
  Player,
  POSITION_LABEL,
  PositionCode,
  seasonLabel,
  SeasonStyle,
} from '../domain/models';
import { PlanStore, tierName } from '../state/plan-store';
import { SaveLibrary } from '../state/save-library';
import { suggestName } from '../state/save-storage';
import { Icon } from '../ui/icon';
import {
  buildSave,
  guessCurrentSeason,
  guessSeasonStyle,
  ImportPreview,
  planImport,
  StayingPlayer,
} from './import-plan';
import { COLUMNS, ImportError, parseSquad, SquadImport } from './parse-squad';

const MAX_BYTES = 5_000_000;
const FORMAT_NAME = { html: 'web page', text: 'text', csv: 'CSV' } as const;

interface Loaded {
  result: SquadImport;
  fileName: string;
}

@Component({
  selector: 'app-import-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, RouterLink],
  templateUrl: './import-page.html',
  host: { class: 'page' },
})
export class ImportPage {
  protected readonly store = inject(PlanStore);
  private readonly router = inject(Router);
  private readonly library = inject(SaveLibrary);

  protected readonly loaded = signal<Loaded | null>(null);
  protected readonly error = signal('');
  protected readonly dragOver = signal(false);
  protected readonly pasteOpen = signal(false);
  protected readonly pasteText = signal('');
  protected readonly showAllProblems = signal(false);
  protected readonly showUnchanged = signal(false);
  /** Hand edits the user wants FM's value for, as "playerId:field". */
  protected readonly useFm = signal<ReadonlySet<string>>(new Set());
  /** Removed players to bring back, by FM name. */
  protected readonly bringBack = signal<ReadonlySet<string>>(new Set());

  protected readonly club = signal('');
  /** Typed by the user; until then the name follows the club. */
  protected readonly typedName = signal<string | null>(null);
  protected readonly style = signal<SeasonStyle>('split');
  protected readonly season = signal<number | null>(null);

  /** The open save, which an import can update; a sample squad doesn't count. */
  protected readonly current = computed(() =>
    this.store.hasSave() && !this.store.save().sample ? this.store.save() : null,
  );

  /** Update the open save, or start a new one. "Add save" links here with ?as=new. */
  protected readonly target = signal<'update' | 'new'>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('as') === 'new' ? 'new' : 'update',
  );
  protected readonly asNew = computed(() => this.target() === 'new' || !this.current());

  /** The squad an import would replace, or none when it starts a new save. */
  private readonly existing = computed(() => (this.asNew() ? null : this.current()));

  protected readonly suggestedName = computed(() =>
    suggestName(
      this.club() || 'New save',
      this.library.saves().map((s) => s.name),
    ),
  );
  protected readonly saveName = computed(() => this.typedName() ?? this.suggestedName());

  protected readonly preview = computed<ImportPreview | null>(() => {
    const loaded = this.loaded();
    return loaded
      ? planImport(loaded.result.players, this.existing(), loaded.result.issues, {
          useFm: this.useFm(),
          bringBack: this.bringBack(),
        })
      : null;
  });

  /** Players with changes first. On phones the unchanged ones stay folded until asked for. */
  protected readonly stayingOrdered = computed(() => {
    const staying = this.preview()?.staying ?? [];
    const flagged = (s: StayingPlayer) => s.unread || s.changes.length > 0;
    return [...staying.filter(flagged), ...staying.filter((s) => !flagged(s))];
  });

  protected readonly unchangedCount = computed(
    () => (this.preview()?.staying ?? []).filter((s) => !s.unread && !s.changes.length).length,
  );

  protected readonly fileLine = computed(() => {
    const loaded = this.loaded();
    if (!loaded) return '';
    const n = loaded.result.players.length;
    return `FM27 ${FORMAT_NAME[loaded.result.format]} export · ${n} ${n === 1 ? 'player' : 'players'}`;
  });

  protected readonly problems = computed(() => {
    const loaded = this.loaded();
    const preview = this.preview();
    if (!loaded || !preview) return [];
    const lines = loaded.result.issues.map((i) => {
      if (i.row === 0) return i.message;
      const who = i.player ? `${i.player}, row ${i.row}` : `Row ${i.row}`;
      return `${who}: ${i.message}${i.skipped ? ' Not imported.' : ''}`;
    });
    if (preview.abilityRanges) {
      const n = preview.abilityRanges;
      lines.push(`${n} ${n === 1 ? 'player has' : 'players have'} ability as a range. The low end is used.`);
    }
    const missing = loaded.result.missing.filter((k) => k !== 'info');
    if (missing.length) {
      lines.push(
        `This view has no ${missing.map((k) => COLUMNS[k].label).join(', ')} column. Those fields stay blank.`,
      );
    }
    return lines;
  });

  protected readonly splitLabel = computed(() => seasonLabel(this.season() ?? 2026, 'split'));
  protected readonly calendarLabel = computed(() => seasonLabel(this.season() ?? 2026, 'calendar'));

  protected readonly canImport = computed(
    () =>
      !!this.preview()?.players.length &&
      this.club().trim() !== '' &&
      (!this.asNew() || this.saveName().trim() !== '') &&
      this.season() !== null &&
      this.season()! >= 1900 &&
      this.season()! <= 2300,
  );

  /** Edits kept as they are, for the footer. */
  protected readonly keptEdits = computed(
    () => (this.preview()?.edits ?? []).filter((e) => !e.useFm).length,
  );

  protected readonly hasYours = computed(() => {
    const pv = this.preview();
    return !!pv && (pv.edits.length > 0 || pv.addedKept.length > 0 || pv.removedSeen.length > 0);
  });

  protected readonly footNote = computed(() => {
    const preview = this.preview();
    if (!preview) return '';
    const kept = this.keptEdits();
    const edits = kept ? ` Your ${kept === 1 ? 'edit is' : `${kept} edits are`} kept.` : '';
    return this.baseNote(preview) + edits;
  });

  private baseNote(preview: ImportPreview): string {
    if (this.asNew() && this.current()) {
      return `Groundsman builds a first depth chart for this save. ${this.current()!.name} stays as it is.`;
    }
    if (preview.firstImport) return 'Groundsman builds a first depth chart from this squad.';
    return preview.leaving.length
      ? "Your depth chart keeps everyone who's staying. Leavers come off it."
      : "Your depth chart keeps everyone who's staying.";
  }

  protected pickEdit(key: string, fm: boolean): void {
    this.useFm.update((set) => {
      const next = new Set(set);
      if (fm) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  protected toggleBack(name: string): void {
    this.bringBack.update((set) => {
      const next = new Set(set);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  protected onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.readFile(file);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) void this.readFile(file);
  }

  protected readPaste(): void {
    this.read(this.pasteText(), 'pasted text');
  }

  protected chooseAnother(): void {
    this.loaded.set(null);
    this.error.set('');
    this.showAllProblems.set(false);
    this.showUnchanged.set(false);
    this.useFm.set(new Set());
    this.bringBack.set(new Set());
  }

  protected cancel(): void {
    this.chooseAnother();
    if (this.store.hasSave()) void this.router.navigate(['/depth-chart']);
  }

  protected setTarget(target: 'update' | 'new'): void {
    this.target.set(target);
    const loaded = this.loaded();
    // The club box follows the choice: the open save's club for an update, blank for a new save.
    if (loaded && this.club() === (target === 'new' ? this.current()?.club : '')) {
      this.club.set(target === 'new' ? '' : (this.current()?.club ?? ''));
    }
  }

  protected setStyle(style: SeasonStyle): void {
    const players = this.loaded()?.result.players ?? [];
    // Follow the guess across a style change unless the season was typed in.
    if (this.season() === guessCurrentSeason(players, this.style())) {
      this.season.set(guessCurrentSeason(players, style) ?? this.season());
    }
    this.style.set(style);
  }

  protected setSeason(event: Event): void {
    const value = (event.target as HTMLInputElement).valueAsNumber;
    this.season.set(Number.isInteger(value) ? value : null);
  }

  protected confirm(): void {
    const preview = this.preview();
    const loaded = this.loaded();
    if (!preview || !loaded || !this.canImport()) return;
    const save = buildSave(
      preview,
      {
        name: this.asNew() ? this.saveName() : this.existing()!.name,
        club: this.club(),
        seasonStyle: this.style(),
        currentSeason: this.season()!,
        fileName: loaded.fileName,
      },
      this.existing(),
    );
    this.store.applyImport(
      save,
      preview.leaving.map((p) => p.id),
      this.asNew(),
    );
    this.chooseAnother();
    void this.router.navigate(['/depth-chart']);
  }

  protected positions(p: Player): string {
    return (Object.entries(p.positions) as [PositionCode, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([code]) => POSITION_LABEL[code])
      .join(', ');
  }

  protected year(p: Player): string {
    return p.contractExpires ? p.contractExpires.slice(0, 4) : '';
  }

  /** Ability and potential as FM's figures: "3.0 → 4.0". */
  protected figures(p: Player): string {
    return `${formatStars(p.ability)} → ${formatStars(p.potential, p.potentialMax)}`;
  }

  /** Where a leaver sits in the current plan, e.g. "D (L) starter · WB (L) backup". */
  protected placesOf(p: Player): string {
    return this.store
      .slotsOf(p.id)
      .map((pl) => `${this.store.slotLabel(pl.slotId)} ${tierName(pl.tier)}`)
      .join(' · ');
  }

  private async readFile(file: File): Promise<void> {
    if (file.size > MAX_BYTES) {
      this.fail('That file is too big to be a squad view. Export a single squad view from FM.');
      return;
    }
    try {
      this.read(await file.text(), file.name);
    } catch {
      this.fail("That file couldn't be opened. Try exporting it from FM again.");
    }
  }

  private read(text: string, fileName: string): void {
    let result: SquadImport;
    try {
      result = parseSquad(text);
    } catch (e) {
      this.fail(
        e instanceof ImportError
          ? e.message
          : "That doesn't look like an FM squad export. Save the squad view as a web page, text or CSV and try again.",
      );
      return;
    }
    if (!result.players.length) {
      this.fail('No players could be read from that export. Check it is a squad view with a Player column.');
      return;
    }
    const existing = this.existing();
    const style = guessSeasonStyle(result.players) ?? existing?.seasonStyle ?? 'split';
    this.error.set('');
    this.pasteText.set('');
    this.pasteOpen.set(false);
    this.club.set(existing?.club ?? this.club());
    this.typedName.set(null);
    this.style.set(style);
    this.season.set(
      guessCurrentSeason(result.players, style) ?? existing?.currentSeason ?? new Date().getFullYear(),
    );
    this.loaded.set({ result, fileName });
  }

  private fail(message: string): void {
    this.loaded.set(null);
    this.error.set(message);
  }
}
