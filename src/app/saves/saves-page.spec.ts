import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { FICTIONAL_SAVE } from '../../testing/fictional-save';
import { FICTIONAL_HEADERS, FICTIONAL_ROWS, toFmText } from '../../testing/fm-exports';
import { App } from '../app';
import { routes } from '../app.routes';
import { SaveFile } from '../domain/models';
import { makeBackup } from '../state/backup';
import { PlanStore, SAVE } from '../state/plan-store';
import { SaveLibrary } from '../state/save-library';

const mine: SaveFile = { ...FICTIONAL_SAVE, sample: undefined };
const other: SaveFile = { ...mine, id: 'other', name: 'Harrowgate 2nd go' };

describe('Saves & backup', () => {
  let router: Router;
  let store: PlanStore;
  let library: SaveLibrary;

  async function open(url: string) {
    const fixture = TestBed.createComponent(App);
    await router.navigateByUrl(url);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  }

  function type(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
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
    library = TestBed.inject(SaveLibrary);
    store.applyImport(mine, [], true);
    store.applyImport(other, [], true);
  });

  it('lists the saves and only deletes one once its name is typed', async () => {
    const { fixture, el } = await open('/saves');
    const rows = el.querySelectorAll('.save-row');
    expect(rows.length).toBe(2);
    expect(rows[1].textContent).toContain('Harrowgate 2nd go');
    expect(rows[1].textContent).toContain('Open');

    (rows[1].querySelector('[data-action=delete]') as HTMLButtonElement).click();
    await fixture.whenStable();
    const dialog = el.querySelector('dialog')!;
    expect(dialog.textContent).toContain('Delete Harrowgate 2nd go?');
    const confirm = dialog.querySelector('.btn.danger') as HTMLButtonElement;
    const box = dialog.querySelector('input') as HTMLInputElement;

    type(box, 'harrowgate 2nd go');
    await fixture.whenStable();
    expect(confirm.disabled).toBe(true);

    type(box, 'Harrowgate 2nd go');
    await fixture.whenStable();
    expect(confirm.disabled).toBe(false);
    confirm.click();
    await fixture.whenStable();

    expect(library.saves().map((s) => s.name)).toEqual(['Harrowgate Town']);
    expect(store.save().id).toBe(mine.id);
    expect(el.querySelector('.saves-notice')?.textContent).toContain('Deleted Harrowgate 2nd go');
  });

  it('restores a backup next to the saves already here', async () => {
    const { fixture, el } = await open('/saves');
    const file = new File(
      [JSON.stringify(makeBackup([{ save: mine, plans: null }]))],
      'backup.json',
    );
    const input = el.querySelector('.side-panel input[type=file]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r));
    await fixture.whenStable();

    expect(library.saves().map((s) => s.name)).toEqual([
      'Harrowgate Town',
      'Harrowgate 2nd go',
      'Harrowgate Town (restored)',
    ]);
    expect(el.querySelector('.saves-notice')?.textContent).toContain('Restored 1 save');
  });

  it('imports into a new save from Add save and leaves the open one alone', async () => {
    const { fixture, el } = await open('/import?as=new');
    expect(el.querySelector('.import-target .on')?.textContent).toContain('New save');

    (el.querySelector('.paste .text-btn') as HTMLButtonElement).click();
    await fixture.whenStable();
    type(el.querySelector('textarea')!, toFmText(FICTIONAL_HEADERS, FICTIONAL_ROWS));
    await fixture.whenStable();
    (el.querySelector('.paste .btn') as HTMLButtonElement).click();
    await fixture.whenStable();

    // A new save starts from nothing, so everyone is arriving.
    expect(el.querySelector('.board-col h2')?.textContent).toContain('Players');
    const [club, name] = Array.from(
      el.querySelectorAll<HTMLInputElement>('.import-band input[type=text]'),
    );
    type(club, 'Harju Athletic');
    await fixture.whenStable();
    expect(name.value).toBe('Harju Athletic');
    type(name, 'Harju long game');
    await fixture.whenStable();
    (el.querySelector('.import-foot .btn.primary') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(router.url).toBe('/depth-chart');
    expect(store.save().name).toBe('Harju long game');
    expect(library.saves().map((s) => [s.name, s.players])).toEqual([
      ['Harrowgate Town', mine.players.length],
      ['Harrowgate 2nd go', mine.players.length],
      ['Harju long game', 8],
    ]);
  });
});
