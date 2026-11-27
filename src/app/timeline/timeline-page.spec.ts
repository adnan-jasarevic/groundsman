import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { FICTIONAL_SAVE } from '../../testing/fictional-save';
import { App } from '../app';
import { routes } from '../app.routes';
import { SaveFile } from '../domain/models';
import { PlanStore, SAVE } from '../state/plan-store';

const mine: SaveFile = { ...FICTIONAL_SAVE, sample: undefined };

describe('Season timeline', () => {
  let router: Router;

  async function open() {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl('/season-timeline');
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  /** The desktop row for a position, found by its header text. */
  function row(el: HTMLElement, header: RegExp): HTMLTableRowElement {
    return [...el.querySelectorAll<HTMLTableRowElement>('.tl-grid tbody tr')].find((r) =>
      header.test(r.querySelector('th')!.textContent!.replace(/\s+/g, ' ').trim()),
    )!;
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), { provide: SAVE, useValue: null }],
    });
    router = TestBed.inject(Router);
    TestBed.inject(PlanStore).applyImport(mine, [], true);
  });

  it('is in the nav and shows the current season and the next three', async () => {
    const { el } = await open();
    expect(el.querySelector('.nav a[aria-current="page"]')!.textContent).toBe('Season timeline');
    const heads = [...el.querySelectorAll('.tl-grid thead .tl-sl')].map((h) =>
      h.textContent!.trim(),
    );
    expect(heads).toEqual(['2026/27 Now', '2027/28', '2028/29', '2029/30']);
  });

  it('ages players, colours contracts and drops leavers', async () => {
    const { el } = await open();
    const cells = row(el, /^D \(C\) right$/).querySelectorAll('td');

    const now = cells[0].querySelector('.tl-chip.starter')!;
    expect(now.querySelector('.tl-nm')!.textContent).toBe('M. Hallström');
    expect(now.getAttribute('data-state')).toBe('critical');
    expect(now.querySelector('.tl-age.old')!.textContent).toContain('33');

    expect(cells[1].querySelector('.tl-chip.starter .tl-nm')!.textContent).toBe('L. Brennan');
    expect(cells[1].querySelector('.tl-chip.starter .tl-age')!.textContent).toContain('28');
    expect(cells[1].textContent).toContain('M. Hallström left');
    expect(cells[2].textContent).not.toContain('Hallström');
  });

  it('marks positions that run out of cover', async () => {
    const { el } = await open();
    const cells = row(el, /^D \(C\) right$/).querySelectorAll('td');
    expect([...cells].map((c) => c.classList.contains('worn'))).toEqual([false, true, true, true]);
    expect(cells[1].querySelector('.tag')!.textContent).toBe('No cover');
    expect(cells[3].querySelector('.tag')!.textContent).toBe('Empty');
  });

  it('lists squad players outside the plan', async () => {
    const { el } = await open();
    const unplaced = el.querySelector('.tl-unplaced td')!;
    expect(unplaced.querySelectorAll('.tl-chip').length).toBeGreaterThan(0);
    expect(unplaced.querySelector('.tl-chip.starter')).toBeNull();
  });

  it('opens a position on a phone to show the names', async () => {
    const { fixture, el } = await open();
    const button = [...el.querySelectorAll<HTMLButtonElement>('.tl-ph-row')].find(
      (b) => b.textContent!.includes('right') && b.textContent!.includes('Hallström'),
    )!;
    expect(
      [...button.querySelectorAll('.tl-ph-n')].map((n) =>
        n.textContent!.replace(/.*: /, '').trim(),
      ),
    ).toEqual(['3', '1', '1', '0']);
    button.click();
    await fixture.whenStable();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const detail = el.querySelector(`#${button.getAttribute('aria-controls')}`)!;
    expect(detail.textContent).toContain('Nobody');
  });
});
