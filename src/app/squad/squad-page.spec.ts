import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { FICTIONAL_SAVE } from '../../testing/fictional-save';
import { App } from '../app';
import { routes } from '../app.routes';
import { SaveFile } from '../domain/models';
import { PlanStore, SAVE } from '../state/plan-store';
import { readSave } from '../state/save-storage';

const mine: SaveFile = { ...FICTIONAL_SAVE, sample: undefined };

describe('Squad and the edit sheet', () => {
  let router: Router;
  let store: PlanStore;

  async function open(url: string) {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl(url);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  beforeEach(() => {
    localStorage.clear();
    // jsdom has no modal dialogs; enough of one for the flow.
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), { provide: SAVE, useValue: null }],
    });
    router = TestBed.inject(Router);
    store = TestBed.inject(PlanStore);
    store.applyImport(mine, [], true);
  });

  it('lists the squad by position group and filters by name', async () => {
    const { fixture, el } = await open('/squad');
    const groups = [...el.querySelectorAll('.sq tr.group')].map((r) => r.textContent!.trim());
    expect(groups[0]).toMatch(
      /^Goalkeepers\s+3\s+avg age 24\.0 · 0 expire this season · 1 next season$/,
    );
    expect(el.querySelectorAll('.sq tbody tr:not(.group)').length).toBe(mine.players.length);

    type(el.querySelector('.search input')!, 'hallstrom');
    await fixture.whenStable();
    const rows = el.querySelectorAll('.sq tbody tr:not(.group)');
    expect(rows.length).toBe(1);
    expect(rows[0].textContent).toContain('Mats Hallström');
  });

  it('sums up the squad and shows figures instead of stars', async () => {
    const { el } = await open('/squad');
    const sum = Object.fromEntries(
      [...el.querySelectorAll('.sq-sum div')].map((d) => [
        d.querySelector('dt')!.textContent,
        d.querySelector('dd')!.textContent,
      ]),
    );
    expect(sum).toEqual({
      Players: '28',
      'Average age': '25.0',
      'Expire this season': '3',
      'Expire next season': '9',
      'Aged 33 or older': '2',
    });

    const row = [...el.querySelectorAll('.sq tbody tr')].find((r) =>
      r.textContent!.includes('Nuno Ferreira'),
    )!;
    const cells = [...row.querySelectorAll('td')].map((td) => td.textContent!.trim());
    expect(cells.slice(0, 4)).toEqual(['AM (C) M (C), ST (C)', '24', '4.0', '4.5']);
    expect(row.querySelector('app-stars')).toBeNull();
  });

  it('draws each contract as a runway across the planned seasons', async () => {
    const { el } = await open('/squad');
    const runway = (name: string) => {
      const row = [...el.querySelectorAll('.sq tbody tr')].find((r) =>
        r.textContent!.includes(name),
      )!;
      return [...row.querySelectorAll('.run i')].map((i) => i.getAttribute('data-state'));
    };
    expect(runway('Mats Hallström')).toEqual(['critical', 'gone', 'gone', 'gone']);
    expect(runway('Rui Teixeira')).toEqual(['on', 'warning', 'gone', 'gone']);
    expect(runway('Dániel Varga')).toEqual(['on', 'on', 'on', 'on']);

    store.setSeason(2027);
    TestBed.tick();
    expect(runway('Rui Teixeira')).toEqual(['on', 'critical', 'gone', 'gone']);
  });

  it('edits a player, keeps it after a reload and marks it as edited', async () => {
    const { fixture, el } = await open('/squad');
    (el.querySelector('[aria-label="Edit Mats Hallström"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    const dialog = el.querySelector('dialog.editor') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.querySelector('h2')?.textContent).toContain('Mats Hallström');

    type(dialog.querySelector('#ef-contract')!, '2030-06-30');
    await fixture.whenStable();
    expect(dialog.textContent).toContain('FM says 30 Jun 2027');

    (dialog.querySelector('button[type=submit]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(dialog.open).toBe(false);
    expect(readSave(mine.id)?.players.find((p) => p.id === 'p06')?.contractExpires).toBe(
      '2030-06-30',
    );
    const row = [...el.querySelectorAll('.sq tbody tr')].find((r) =>
      r.textContent!.includes('Hallström'),
    )!;
    expect(row.textContent).toContain('Edited');
    expect(row.textContent).toContain('2030');
  });

  it("says what's missing before adding a player, then adds them", async () => {
    const { fixture, el } = await open('/squad');
    (el.querySelector('.squad-tools .btn.primary') as HTMLButtonElement).click();
    await fixture.whenStable();
    const dialog = el.querySelector('dialog.editor') as HTMLDialogElement;
    const submit = dialog.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(submit.textContent).toContain('Add to squad');

    submit.click();
    await fixture.whenStable();
    expect(dialog.textContent).toContain("Add the player's name.");
    expect(dialog.textContent).toContain('Pick at least one position.');
    expect(dialog.open).toBe(true);

    type(dialog.querySelector('#ef-name')!, 'Jamie Hart');
    type(dialog.querySelector('#ef-age')!, '19');
    (dialog.querySelector('[aria-label="ST (C), not played. Add"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    submit.click();
    await fixture.whenStable();

    expect(dialog.open).toBe(false);
    expect(el.textContent).toContain('Jamie Hart');
    expect(el.textContent).toContain('added by you');
    expect(store.notice()).toBe('J. Hart added to the squad, on the bench');
  });

  it('opens the same sheet from the player panel on the pitch', async () => {
    const { fixture, el } = await open('/depth-chart');
    store.selectedId.set('p06');
    await fixture.whenStable();
    const edit = [...el.querySelectorAll('.detail .btn')].find((b) =>
      b.textContent?.includes('Edit'),
    );
    (edit as HTMLButtonElement).click();
    await fixture.whenStable();
    expect((el.querySelector('dialog.editor') as HTMLDialogElement).open).toBe(true);

    const remove = el.querySelector('dialog.editor .text-btn.danger') as HTMLButtonElement;
    remove.click();
    await fixture.whenStable();
    expect(store.byId().has('p06')).toBe(false);
    expect(el.querySelector('.notice')?.textContent).toContain('removed from the squad');
  });
});
