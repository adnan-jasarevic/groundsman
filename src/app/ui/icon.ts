import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

// One authored set: 24px grid, 1.75 stroke, round caps.
const PATHS = {
  close: 'M6 6l12 12M18 6L6 18',
  alert: 'M12 4l9 16H3L12 4zM12 10v4M12 17.5v.01',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  hourglass: 'M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9',
  refresh: 'M20 11a8 8 0 00-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0014.5 4.5L20 16M20 20v-4h-4',
  device: 'M4 5h16v11H4zM9 20h6M12 16v4',
  target: 'M12 20a8 8 0 100-16 8 8 0 000 16zM12 15a3 3 0 100-6 3 3 0 000 6zM12 2v3M12 19v3M2 12h3M19 12h3',
  bench: 'M4 12h16M6 12v6M18 12v6M5 8h14',
  arrow: 'M5 12h14M13 6l6 6-6 6',
} as const;

export type IconName = keyof typeof PATHS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'icon', 'aria-hidden': 'true' },
  template: `<svg viewBox="0 0 24 24" [attr.width]="size()" [attr.height]="size()" fill="none"
    stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path [attr.d]="d()" /></svg>`,
  styles: `:host { display: inline-flex; flex: none; }`,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(16);
  protected readonly d = computed(() => PATHS[this.name()]);
}
