import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatStars, Player } from '../domain/models';

/** FM's star value as a figure: 3 → "3.0", 3.5 → "3.5". */
export function rating(value: number): string {
  return value.toFixed(1);
}

/** Potential as a figure, or a range when FM gives one ("3.5–4.0"). */
export function potentialText(p: Pick<Player, 'potential' | 'potentialMax'>): string {
  return formatStars(p.potential, p.potentialMax ?? undefined);
}

/** Ability over potential on a five-star track. The figures beside it carry the meaning. */
@Component({
  selector: 'app-ability-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ability-bar', 'aria-hidden': 'true' },
  template: `<i class="pot" [style.width.%]="pot()"></i
    ><i class="now" [style.width.%]="now()"></i>`,
})
export class AbilityBar {
  readonly ability = input.required<number>();
  readonly potential = input.required<number>();
  readonly potentialMax = input<number | null | undefined>(null);
  protected readonly now = computed(() => (this.ability() / 5) * 100);
  protected readonly pot = computed(
    () => (Math.max(this.potential(), this.potentialMax() ?? 0) / 5) * 100,
  );
}
