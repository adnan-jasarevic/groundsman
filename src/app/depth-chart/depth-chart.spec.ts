import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { FICTIONAL_SAVE } from '../../testing/fictional-save';
import { App } from '../app';
import { routes } from '../app.routes';
import { SaveFile } from '../domain/models';
import { PlanStore, SAVE } from '../state/plan-store';

const mine: SaveFile = { ...FICTIONAL_SAVE, sample: undefined };

describe('Depth chart position cards', () => {
  let store: PlanStore;

  async function open() {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/depth-chart');
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function card(el: HTMLElement, label: string): HTMLElement {
    return el.querySelector(`section.slot[aria-label="${label}"]`)!;
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), { provide: SAVE, useValue: null }],
    });
    store = TestBed.inject(PlanStore);
    store.applyImport(mine, [], true);
  });

  it('shows each tier as figures: tier, name, age, ability, potential and contract', async () => {
    const { el } = await open();
    const rows = [...card(el, 'D (C) right').querySelectorAll('.chip')].map((c) =>
      [...c.querySelectorAll('span:not(.icon)')].map((s) => s.textContent!.trim()),
    );
    expect(rows[0]).toEqual(['1', 'Hallström', '33', '3.0', '3.0', '2027']);
    expect(card(el, 'D (C) right').querySelector('.chip .age.old')).not.toBeNull();
    expect(el.querySelector('app-stars')).toBeNull();
  });

  it('says how deep a position is now and two seasons on', async () => {
    const { el } = await open();
    expect(card(el, 'ST (C)').querySelector('.depth')!.textContent!.trim()).toBe(
      '3 deep · 2 in 28/29',
    );
    expect(card(el, 'AM (L)').querySelector('.depth.thin')!.textContent!.trim()).toBe(
      '2 deep · 1 in 28/29',
    );
  });

  it('counts players under contract per position and season', async () => {
    const { el } = await open();
    const row = [...el.querySelectorAll('.cover tbody tr')].find(
      (r) => r.querySelector('th')!.textContent!.replace(/\s+/g, ' ').trim() === 'D (C) right',
    )!;
    const cells = [...row.querySelectorAll('td')];
    expect(cells.map((c) => c.textContent!.trim())).toEqual(['3', '1', '1', '0']);
    expect(cells.map((c) => c.getAttribute('data-n'))).toEqual([null, '1', '1', '0']);
  });
});
