import { TestBed } from '@angular/core/testing';
import { FICTIONAL_SAVE } from '../../testing/fictional-save';
import { SaveFile } from '../domain/models';
import { PlanStore, SAVE } from './plan-store';
import { SaveLibrary } from './save-library';
import { readLibrary, readPlans, readSave, suggestName } from './save-storage';

const mine: SaveFile = { ...FICTIONAL_SAVE, sample: undefined };
const other: SaveFile = { ...mine, id: 'other', name: 'Harrowgate 2nd go' };

describe('saves in this browser', () => {
  beforeEach(() => localStorage.clear());

  it('moves a squad stored before several saves into the list, keeping its plans', () => {
    const legacy = { ...mine, id: 'squad' } as Partial<SaveFile>;
    delete legacy.name;
    localStorage.setItem('groundsman.save', JSON.stringify(legacy));
    localStorage.setItem(
      'groundsman.plans.squad',
      JSON.stringify({ formationId: '442', tiers: 4, plans: {} }),
    );

    expect(readLibrary()).toEqual({ activeId: 'squad', ids: ['squad'], lastBackup: null });
    expect(readSave('squad')?.name).toBe('Harrowgate Town');
    expect(readPlans('squad')?.tiers).toBe(4);
    expect(localStorage.getItem('groundsman.save')).toBeNull();
  });

  it('suggests a name from the club that no save uses yet', () => {
    expect(suggestName('Harju', [])).toBe('Harju');
    expect(suggestName('Harju', ['harju', 'Harju 2'])).toBe('Harju 3');
  });

  describe('with the planner', () => {
    let store: PlanStore;
    let library: SaveLibrary;

    beforeEach(() => {
      TestBed.configureTestingModule({ providers: [{ provide: SAVE, useValue: null }] });
      library = TestBed.inject(SaveLibrary);
      store = TestBed.inject(PlanStore);
      store.applyImport(mine, [], true);
      TestBed.tick();
    });

    it('keeps each save to its own depth chart when switching', () => {
      store.move('p24', null, 'st', 0);
      TestBed.tick();
      store.applyImport(other, [], true);
      TestBed.tick();
      expect(store.save().name).toBe('Harrowgate 2nd go');
      expect(store.plan().slots['st'][0]).not.toBe('p24');

      store.switchTo(mine.id);
      expect(store.plan().slots['st'][0]).toBe('p24');
      expect(store.notice()).toBe('Switched to Harrowgate Town');
      expect(library.activeId()).toBe(mine.id);
      expect(library.saves().map((s) => s.name)).toEqual(['Harrowgate Town', 'Harrowgate 2nd go']);
    });

    it('renames a save without touching its club', () => {
      store.rename(mine.id, '  Long game  ');
      expect(store.save().name).toBe('Long game');
      expect(store.save().club).toBe('Harrowgate Town');
      expect(readSave(mine.id)?.name).toBe('Long game');
    });

    it('opens the next save after deleting the open one, and none after the last', () => {
      store.applyImport(other, [], true);
      store.deleteSave(other.id);
      expect(store.save().id).toBe(mine.id);
      expect(readSave(other.id)).toBeNull();

      store.deleteSave(mine.id);
      expect(store.hasSave()).toBe(false);
      expect(library.saves()).toEqual([]);
    });

    it('records the day of the last full backup', () => {
      expect(library.lastBackup()).toBeNull();
      library.markBackedUp(new Date(2026, 10, 25));
      expect(readLibrary().lastBackup).toBe('2026-11-25');
    });
  });
});
