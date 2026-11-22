import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FAMILIARITY_LABEL, Familiarity } from '../domain/models';

/** Four rising bars, filled up to the familiarity level. Reads on turf and on chalk. */
@Component({
  selector: 'app-familiarity',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'fam', role: 'img', '[attr.aria-label]': 'label()' },
  template: `<svg viewBox="0 0 13 10" width="13" height="10">
    @for (b of bars; track b) {
      <rect [attr.x]="b * 3.4" [attr.y]="8 - b * 2.2" width="2.3" [attr.height]="2 + b * 2.2" rx="0.6"
        [class.on]="b < level()" />
    }
  </svg>`,
  styles: `
    :host { display: inline-flex; line-height: 0; }
    rect { fill: currentColor; opacity: 0.25; }
    rect.on { opacity: 1; }
  `,
})
export class FamiliarityMeter {
  readonly level = input.required<number>();
  protected readonly bars = [0, 1, 2, 3];
  protected readonly label = computed(() =>
    this.level() > 0 ? `Familiarity: ${FAMILIARITY_LABEL[this.level() as Familiarity]}` : 'Familiarity: Awkward',
  );
}
