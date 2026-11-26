import { TestBed } from '@angular/core/testing';
import { FICTIONAL_SAVE } from '../../testing/fictional-save';
import { contractState } from '../domain/projection';
import { PlanStore, SAVE } from './plan-store';
import { readSave } from './save-storage';

describe('PlanStore', () => {
  let store: PlanStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: SAVE, useValue: FICTIONAL_SAVE }] });
    store = TestBed.inject(PlanStore);
  });

  it('pushes out a player who has left before anyone still at the club', () => {
    store.setSeason(2027);
    const slot = 'dcr';
    const before = store.plan().slots[slot];
    expect(before.length).toBe(store.tiers());
    store.move('t01', null, slot, 0);
    const after = store.plan().slots[slot];
    expect(after[0]).toBe('t01');
    const stillHere = after.filter(
      (id) => contractState(store.byId().get(id)!, 2027, 'split') !== 'left',
    );
    const activeBefore = before.filter(
      (id) => contractState(store.byId().get(id)!, 2027, 'split') !== 'left',
    );
    for (const id of activeBefore) expect(stillHere).toContain(id);
  });

  it('offers an undo after rebuilding a plan', () => {
    store.move('p24', null, 'st', 0);
    const edited = store.plan().slots['st'];
    store.resetPlan();
    expect(store.plan().slots['st']).not.toEqual(edited);
    store.undo()!();
    expect(store.plan().slots['st']).toEqual(edited);
  });

  it('keeps places for players who stay and drops leavers on a re-import', () => {
    store.move('p24', null, 'st', 0);
    const leaver = store.plan().slots['st'].find((id) => id !== 'p24')!;
    const save = { ...FICTIONAL_SAVE, id: FICTIONAL_SAVE.id, sample: false };
    save.players = save.players.filter((p) => p.id !== leaver);
    store.applyImport(save, [leaver], false);

    expect(store.plan().slots['st'][0]).toBe('p24');
    expect(Object.values(store.plan().slots).flat()).not.toContain(leaver);
    expect(store.notice()).toBe(`Imported ${save.players.length} players from FM`);
    expect(readSave(save.id)?.players.length).toBe(save.players.length);
  });

  it('saves a hand edit and remembers what FM said', () => {
    const before = store.byId().get('p06')!;
    store.edit('p06');
    store.savePlayer({ ...before, contractExpires: '2030-06-30' });
    const after = store.byId().get('p06')!;
    expect(after.contractExpires).toBe('2030-06-30');
    expect(after.fm).toEqual({ contractExpires: before.contractExpires });
    expect(store.editing()).toBeNull();
    expect(store.notice()).toBe('M. Hallström saved');
  });

  it('adds a player by hand to the bench', () => {
    const count = store.save().players.length;
    store.savePlayer({
      id: 'm-new',
      name: 'Jamie Hart',
      age: 19,
      nationality: 'ENG',
      positions: { ST: 3 },
      ability: 2,
      potential: 3,
    });
    expect(store.save().players.length).toBe(count + 1);
    expect(store.byId().get('m-new')).toMatchObject({ added: true });
    expect(store.bench().map((p) => p.id)).toContain('m-new');
  });

  it('removes a player from the squad and every plan, with undo', () => {
    const id = store.plan().slots['st'][0];
    const name = store.byId().get(id)!.name;
    store.removePlayer(id);
    expect(store.byId().has(id)).toBe(false);
    expect(Object.values(store.plan().slots).flat()).not.toContain(id);
    expect(store.save().removed).toEqual([name]);
    store.undo()!();
    expect(store.byId().has(id)).toBe(true);
    expect(store.plan().slots['st'][0]).toBe(id);
    expect(store.save().removed).toBeUndefined();
  });
});
