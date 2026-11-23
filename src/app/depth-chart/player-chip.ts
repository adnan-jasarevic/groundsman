import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Player, PositionCode } from '../domain/models';
import { contractState, familiarityFor, surname } from '../domain/projection';
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
      <app-stars [ability]="player().ability" [potential]="player().potential" [size]="10" />
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
  protected readonly state = computed(() => contractState(this.player(), this.store.season()));
  protected readonly fam = computed(() => familiarityFor(this.player(), this.position()));
  protected readonly tierKind = computed(() =>
    this.tier() === 0 ? 'starter' : this.tier() === 1 ? 'backup' : 'depth',
  );

  protected readonly contractText = computed(() => {
    const p = this.player();
    if (this.state() === 'left') return `Left Jun ${String(p.contractEnd! % 100).padStart(2, '0')}`;
    return `'${String(p.contractEnd! % 100).padStart(2, '0')}`;
  });

  protected readonly aria = computed(() => {
    const p = this.player();
    const contract = p.target
      ? 'shortlist target'
      : this.state() === 'left'
        ? `contract ended June ${p.contractEnd}, no longer at the club`
        : `contract until June ${p.contractEnd}${this.state() === 'critical' ? ', ends this season' : this.state() === 'warning' ? ', 2 years left' : ''}`;
    return `${p.name}, ${this.slotLabel()} ${tierName(this.tier())}, ${contract}. Show details`;
  });
}
