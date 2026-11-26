import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { FICTIONAL_HEADERS, FICTIONAL_ROWS, toFmText } from '../../testing/fm-exports';
import { App } from '../app';
import { routes } from '../app.routes';
import { PlanStore, SAVE } from '../state/plan-store';
import { SaveLibrary } from '../state/save-library';

describe('Import from FM', () => {
  let router: Router;

  async function open(url: string) {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl(url);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), { provide: SAVE, useValue: null }],
    });
    router = TestBed.inject(Router);
  });

  it('sends a first-time visitor to the import screen', async () => {
    const { el } = await open('/depth-chart');
    expect(router.url).toBe('/import');
    expect(el.querySelector('h1')?.textContent).toContain('Import from FM');
    expect(el.querySelector('.save')).toBeNull();
  });

  it('reads a pasted export, previews it and imports it', async () => {
    const { fixture, el } = await open('/import');
    (el.querySelector('.paste .text-btn') as HTMLButtonElement).click();
    await fixture.whenStable();

    const box = el.querySelector('textarea')!;
    box.value = toFmText(FICTIONAL_HEADERS, FICTIONAL_ROWS);
    box.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    (el.querySelector('.paste .btn') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(el.querySelector('.file-chip')?.textContent).toContain('FM27 text export · 8 players');
    expect(el.querySelector('.board-col h2')?.textContent).toContain('8');
    const seasonInput = el.querySelector('input[type=number]') as HTMLInputElement;
    expect(seasonInput.value).toBe('2048');
    expect(el.querySelector('.segmented .on')?.textContent).toContain('2048 (season in one year)');
    expect(el.querySelector('.segmented label')?.textContent).toContain('2048/49');

    const importBtn = el.querySelector('.import-foot .btn.primary') as HTMLButtonElement;
    expect(importBtn.disabled).toBe(true); // no club yet

    const club = el.querySelector('input[type=text]') as HTMLInputElement;
    club.value = 'Harju Athletic';
    club.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(importBtn.disabled).toBe(false);
    importBtn.click();
    await fixture.whenStable();

    expect(router.url).toBe('/depth-chart');
    const store = TestBed.inject(PlanStore);
    expect(store.save().club).toBe('Harju Athletic');
    expect(store.seasonText(store.season())).toBe('2048');
    expect(
      TestBed.inject(SaveLibrary)
        .saves()
        .map((s) => s.players),
    ).toEqual([8]);
    expect(el.querySelector('.save')?.textContent).toContain('Harju Athletic');

    // The phone header's Import button hides itself on the import screen.
    expect(el.querySelector('.rail-import')?.classList.contains('on')).toBe(false);
    await router.navigateByUrl('/import');
    await fixture.whenStable();
    expect(el.querySelector('.rail-import')?.classList.contains('on')).toBe(true);
  });

  it('explains what is wrong with an export it cannot use', async () => {
    const { fixture, el } = await open('/import');
    (el.querySelector('.paste .text-btn') as HTMLButtonElement).click();
    await fixture.whenStable();
    const box = el.querySelector('textarea')!;
    box.value = 'Name,Club\nSomeone,Somewhere';
    box.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    (el.querySelector('.paste .btn') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(el.querySelector('.import-error')?.textContent).toContain(
      'The export has no Position or Age columns.',
    );
  });
});
