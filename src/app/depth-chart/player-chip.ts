import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FAMILIARITY_LABEL, Familiarity, formatDate, Player, PositionCode } from '../domain/models';
import { ageAt, familiarityFor, isAgeing, surname } from '../domain/projection';
import { PlanStore, tierName } from '../state/plan-store';
import { potentialText, rating } from '../ui/figures';
import { Icon } from '../ui/icon';

/** One tier of a position card: tier, name, age, ability, potential and contract in fixed columns. */
@Component({
  selector: 'app-player-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  template: `
    <button type="button" class="chip" [attr.data-tier]="tierKind()" [class.left]="state() === 'left'"
      [class.target]="player().target" [class.selected]="store.selectedId() === player().id"
      [attr.aria-pressed]="store.selectedId() === player().id" [attr.aria-label]="aria()"
      (click)="store.selectedId.set(store.selectedId() === player().id ? null : player().id)">
      <span class="t">{{ tier() + 1 }}</span>
      <span class="name" [attr.title]="player().name">
        @if (player().target) { <app-icon name="target" [size]="12" /> }
        {{ name() }}
        @if (famShort(); as f) { <small class="fam">{{ f }}</small> }
      </span>
      <span class="age" [class.old]="ageing()">{{ age() }}</span>
      <span class="abl">{{ ability() }}</span>
      <span class="pot">{{ potential() }}</span>
      @if (player().target) {
        <span class="contract">Target</span>
      } @else {
        <span class="contract" [attr.data-state]="state()">{{ contractText() }}</span>
      }
    </button>
  `,
})
export class PlayerChip {
  protected readonly store = inject(PlanStore);
  readonly player = input.required<Player>();
  readonly tier = input.required<number>();
  readonly position = input.required<PositionCode>();
  readonly slotLabel = input('');

  protected readonly name = computed(() => surname(this.player()));
  protected readonly state = computed(() => this.store.contractOf(this.player()));
  protected readonly fam = computed(() => familiarityFor(this.player(), this.position()));
  protected readonly age = computed(() =>
    ageAt(this.player(), this.store.baseSeason(), this.store.season()),
  );
  protected readonly ageing = computed(() => !this.player().target && isAgeing(this.age()));
  protected readonly ability = computed(() => rating(this.player().ability));
  protected readonly potential = computed(() => potentialText(this.player()));
  protected readonly tierKind = computed(() =>
    this.tier() === 0 ? 'starter' : this.tier() === 1 ? 'backup' : 'depth',
  );

  /** "Acc", "Com", "Unc" or "Awk" when the player isn't a natural here. */
  protected readonly famShort = computed(() => {
    const level = this.fam();
    if (level >= 4) return '';
    return level > 0 ? FAMILIARITY_LABEL[level as Familiarity].slice(0, 3) : 'Awk';
  });

  protected readonly contractText = computed(() => {
    const expires = this.player().contractExpires;
    if (!expires) return '–';
    return this.state() === 'left' ? 'Left' : expires.slice(0, 4);
  });

  protected readonly aria = computed(() => {
    const p = this.player();
    const until = p.contractExpires ? formatDate(p.contractExpires, 'long') : '';
    const contract = p.target
      ? 'shortlist target'
      : !until
        ? 'no contract date'
        : this.state() === 'left'
          ? `contract ended ${until}, no longer at the club`
          : `contract until ${until}${this.state() === 'critical' ? ', ends this season' : this.state() === 'warning' ? ', 2 years left' : ''}`;
    const fam = this.fam() >= 4 ? '' : `, ${this.fam() > 0 ? FAMILIARITY_LABEL[this.fam() as Familiarity].toLowerCase() : 'awkward'} here`;
    return `${p.name}, ${this.slotLabel()} ${tierName(this.tier())}, age ${this.age()}, ability ${this.ability()}, potential ${this.potential()}${fam}, ${contract}. Show details`;
  });
}
