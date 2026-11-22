import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

function starPoints(cx: number, cy: number, outer: number, inner: number): [number, number][] {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (-90 + i * 36) * (Math.PI / 180);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
}

const PTS = starPoints(5, 5.3, 4.7, 1.95);
const FULL = 'M' + PTS.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L') + 'Z';
// Left half: top point, the five left-hand vertices, then the bottom inner point.
const LEFT = 'M' + [PTS[0], PTS[9], PTS[8], PTS[7], PTS[6], PTS[5]].map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L') + 'Z';

/** Ability as filled stars, potential as outlined stars beyond it, 5 max. */
@Component({
  selector: 'app-stars',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'stars', role: 'img', '[attr.aria-label]': 'label()' },
  template: `<svg [attr.viewBox]="'0 0 ' + 5 * 10.5 + ' 10.6'" [attr.height]="size()" [attr.width]="size() * 4.95">
    @for (s of stars(); track $index) {
      <g [attr.transform]="'translate(' + $index * 10.5 + ' 0)'">
        <path [attr.d]="full" class="base" [class.pot]="s.pot > 0" />
        @if (s.fill === 1) { <path [attr.d]="full" class="fill" /> }
        @if (s.fill === 0.5) { <path [attr.d]="left" class="fill" /> }
      </g>
    }
  </svg>`,
  styles: `
    :host { display: inline-flex; line-height: 0; }
    .base { fill: none; stroke: currentColor; stroke-width: 0.9; opacity: 0.22; }
    .base.pot { opacity: 0.85; }
    .fill { fill: var(--star-fill, currentColor); }
  `,
})
export class Stars {
  readonly ability = input.required<number>();
  readonly potential = input<number | null>(null);
  readonly size = input(10);
  protected readonly full = FULL;
  protected readonly left = LEFT;

  protected readonly stars = computed(() => {
    const a = this.ability();
    const p = this.potential() ?? a;
    return Array.from({ length: 5 }, (_, i) => ({
      fill: Math.max(0, Math.min(1, a - i)),
      pot: Math.max(0, Math.min(1, p - i)),
    }));
  });

  protected readonly label = computed(() => {
    const p = this.potential();
    return p !== null && p > this.ability()
      ? `${this.ability()} stars now, ${p} stars potential`
      : `${this.ability()} stars`;
  });
}
