import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { fieldValue, fmValue, formatValue, sameValue, withValue } from '../domain/manual-edits';
import {
  Familiarity,
  FAMILIARITY_LABEL,
  FmField,
  formatStars,
  Player,
  POSITION_LABEL,
  PositionCode,
} from '../domain/models';
import { PlanStore } from '../state/plan-store';
import { Icon } from '../ui/icon';
import { AbilityBar } from '../ui/figures';
import { FamiliarityMeter } from '../ui/familiarity';
import { NgTemplateOutlet } from '@angular/common';

/** FM's position grid, attack at the top, as FM draws it. */
const PITCH_ROWS: (PositionCode | null)[][] = [
  [null, null, 'ST', null, null],
  ['AML', null, 'AMC', null, 'AMR'],
  ['ML', null, 'MC', null, 'MR'],
  ['WBL', null, 'DM', null, 'WBR'],
  ['DL', null, 'DC', null, 'DR'],
  [null, null, 'GK', null, null],
];

const STAR_STEPS = Array.from({ length: 10 }, (_, i) => (i + 1) / 2);

/** Squad statuses as FM names them, offered as suggestions. */
const SQUAD_STATUSES = [
  'Star Player',
  'Important Player',
  'Regular Starter',
  'Squad Player',
  'Impact Sub',
  'Fringe Player',
  'Breakthrough Prospect',
  'Hot Prospect',
  'Decent Young Player',
  'Youngster',
  'Not Needed',
];

const MIN_AGE = 14;
const MAX_AGE = 50;

type Problem = 'name' | 'age' | 'positions' | 'potential';

/**
 * The sheet for editing a squad player or adding one by hand. One sheet for
 * every screen, opened through PlanStore.edit().
 */
@Component({
  selector: 'app-player-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, AbilityBar, FamiliarityMeter, NgTemplateOutlet],
  templateUrl: './player-editor.html',
})
export class PlayerEditor {
  protected readonly store = inject(PlanStore);
  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('sheet');

  protected readonly rows = PITCH_ROWS;
  protected readonly steps = STAR_STEPS;
  protected readonly statuses = SQUAD_STATUSES;
  protected readonly label = POSITION_LABEL;
  protected readonly levels = [4, 3, 2, 1] as Familiarity[];
  protected readonly levelName = FAMILIARITY_LABEL;
  protected readonly stars = formatStars;
  protected readonly minAge = MIN_AGE;
  protected readonly maxAge = MAX_AGE;

  /** The player as stored before this edit, or null when adding one. */
  protected readonly base = computed(() => {
    const id = this.store.editing();
    return id && id !== 'new' ? (this.store.save().players.find((p) => p.id === id) ?? null) : null;
  });

  protected readonly name = signal('');
  protected readonly known = signal('');
  protected readonly age = signal('');
  protected readonly nationality = signal('');
  protected readonly squadStatus = signal('');
  protected readonly ability = signal(2);
  protected readonly potential = signal(2);
  protected readonly potentialMax = signal<number | null>(null);
  protected readonly contract = signal('');
  protected readonly positions = signal<Partial<Record<PositionCode, Familiarity>>>({});
  /** The position whose familiarity is being set. */
  protected readonly current = signal<PositionCode | null>(null);
  /** Problems show once Save has been tried. */
  protected readonly tried = signal(false);

  /** The form as a player, for saving and for comparing with FM. */
  protected readonly draft = computed<Player>(() => {
    const base = this.base();
    const player: Player = {
      ...(base ?? { id: newPlayerId(), nationality: '' }),
      name: this.name().trim().replace(/\s+/g, ' '),
      age: Number(this.age()),
      nationality: this.nationality().trim(),
      positions: this.positions(),
      ability: this.ability(),
      potential: this.potential(),
    } as Player;
    const known = this.known().trim();
    if (known) player.known = known;
    else delete player.known;
    const max = this.potentialMax();
    if (max !== null && max > player.potential) player.potentialMax = max;
    else delete player.potentialMax;
    if (this.contract()) player.contractExpires = this.contract();
    else delete player.contractExpires;
    const status = this.squadStatus().trim();
    if (status) player.squadStatus = status;
    else delete player.squadStatus;
    return player;
  });

  protected readonly problems = computed(() => {
    const out = new Set<Problem>();
    const p = this.draft();
    if (!p.name) out.add('name');
    if (!Number.isInteger(p.age) || p.age < MIN_AGE || p.age > MAX_AGE || this.age().trim() === '')
      out.add('age');
    if (!Object.keys(p.positions).length) out.add('positions');
    if (p.potential < p.ability) out.add('potential');
    return out;
  });

  protected readonly title = computed(() => this.base()?.name ?? 'Add a player');

  protected readonly potentialMaxSteps = computed(() =>
    STAR_STEPS.filter((s) => s > this.potential()),
  );

  constructor() {
    // Load the form whenever the sheet opens for someone, and open the dialog.
    effect(() => {
      const editing = this.store.editing();
      untracked(() => {
        const dialog = this.dialog().nativeElement;
        if (editing === null) {
          if (dialog.open) dialog.close();
          return;
        }
        this.fill(this.base());
        this.tried.set(false);
        afterNextRender(
          () => {
            if (!dialog.open) dialog.showModal();
          },
          { injector: this.injector },
        );
      });
    });
  }

  /** What FM says for a field, when the form now differs from it. Null when it doesn't. */
  protected fmSays(field: FmField): string | null {
    const base = this.base();
    if (!base || base.added) return null;
    const fm = fmValue(base, field);
    return sameValue(field, fieldValue(this.draft(), field), fm) ? null : formatValue(field, fm);
  }

  protected useFm(field: FmField): void {
    const base = this.base();
    if (!base) return;
    this.fill(withValue(this.draft(), field, fmValue(base, field)), field);
  }

  protected toggleSpot(code: PositionCode): void {
    if (!(code in this.positions())) {
      this.positions.update((p) => ({ ...p, [code]: 3 }));
    }
    this.current.set(code);
  }

  protected setLevel(level: Familiarity): void {
    const code = this.current();
    if (code) this.positions.update((p) => ({ ...p, [code]: level }));
  }

  protected removeCurrent(): void {
    const code = this.current();
    if (!code) return;
    this.positions.update((p) => {
      const next = { ...p };
      delete next[code];
      return next;
    });
    this.current.set(null);
  }

  protected spotLabel(code: PositionCode): string {
    const level = this.positions()[code];
    return level
      ? `${POSITION_LABEL[code]}, ${FAMILIARITY_LABEL[level]}`
      : `${POSITION_LABEL[code]}, not played. Add`;
  }

  protected setAbility(value: string): void {
    const ability = Number(value);
    this.ability.set(ability);
    // Potential is never below ability in FM.
    if (this.potential() < ability) this.potential.set(ability);
  }

  protected setPotential(value: string): void {
    this.potential.set(Number(value));
    const max = this.potentialMax();
    if (max !== null && max <= Number(value)) this.potentialMax.set(null);
  }

  protected setPotentialMax(value: string): void {
    this.potentialMax.set(value ? Number(value) : null);
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement | HTMLSelectElement).value;
  }

  protected submit(): void {
    this.tried.set(true);
    if (this.problems().size) {
      afterNextRender(
        () =>
          this.dialog()
            .nativeElement.querySelector<HTMLElement>(
              '[aria-invalid="true"], .pos-spots.invalid button',
            )
            ?.focus(),
        { injector: this.injector },
      );
      return;
    }
    this.store.savePlayer(this.draft());
  }

  protected remove(): void {
    const base = this.base();
    if (base) this.store.removePlayer(base.id);
  }

  protected cancel(): void {
    this.store.closeEditor();
  }

  /** Esc and the dialog's own close both end up here. */
  protected onClose(): void {
    if (this.store.editing() !== null) this.store.closeEditor();
  }

  /** Fills the form from a player, or one field of it. */
  private fill(player: Player | null, only?: FmField): void {
    const p = player;
    const want = (f: FmField) => !only || only === f;
    if (want('name')) this.name.set(p?.name ?? '');
    if (!only) this.known.set(p?.known ?? '');
    if (want('age')) this.age.set(p ? String(p.age) : '');
    if (want('nationality')) this.nationality.set(p?.nationality ?? '');
    if (want('squadStatus')) this.squadStatus.set(p?.squadStatus ?? '');
    if (want('ability')) this.ability.set(p?.ability ?? 2);
    if (want('potential')) {
      this.potential.set(p?.potential ?? 2);
      this.potentialMax.set(p?.potentialMax ?? null);
    }
    if (want('contractExpires')) this.contract.set(p?.contractExpires ?? '');
    if (want('positions')) {
      this.positions.set({ ...(p?.positions ?? {}) });
      const best = (Object.entries(p?.positions ?? {}) as [PositionCode, number][]).sort(
        (a, b) => b[1] - a[1],
      )[0];
      this.current.set(best?.[0] ?? null);
    }
  }
}

function newPlayerId(): string {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
