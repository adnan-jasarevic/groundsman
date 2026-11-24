import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { formatDate, formatMonthYear, Player, PositionCode } from '../domain/models';
import { familiarityFor, surname } from '../domain/projection';
import { PlanStore, tierName } from '../state/plan-store';
import { FamiliarityMeter } from '../ui/familiarity';
import { Icon } from '../ui/icon';
import { Stars } from '../ui/stars';

@Component({
  selector: 'app-player-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Stars, FamiliarityMeter, Icon],
  template: `
    <button type="button" class="chip" [attr.data-tier]="tierKind()" [class.left]="state() === 'left'"
      [class.target]="player().target" [class.selected]="store.selectedId() === player().id"
      [attr.aria-pressed]="store.selectedId() === player().id" [attr.aria-label]="aria()"
      (click)="store.selectedId.set(store.selectedId() === player().id ? null : player().id)">
      <span class="name" [attr.title]="player().name">{{ name() }}</span>
      <app-stars [ability]="player().ability" [potential]="player().potential"
        [potentialMax]="player().potentialMax" [size]="10" />
      @if (player().target) {
        <span class="contract target-mark"><app-icon name="target" [size]="14" /></span>
      } @else {
        <span class="contract" [attr.data-state]="state()">{{ contractText() }}</span>
      }
      <app-familiarity [level]="fam()" />
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
  protected readonly tierKind = computed(() =>
    this.tier() === 0 ? 'starter' : this.tier() === 1 ? 'backup' : 'depth',
  );

  protected readonly contractText = computed(() => {
    const expires = this.player().contractExpires;
    if (!expires) return '';
    if (this.state() === 'left') return `Left ${formatMonthYear(expires)}`;
    return `'${expires.slice(2, 4)}`;
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
    return `${p.name}, ${this.slotLabel()} ${tierName(this.tier())}, ${contract}. Show details`;
  });
}
