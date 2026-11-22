import { TestBed } from '@angular/core/testing';
import { contractState } from '../domain/projection';
import { PlanStore } from './plan-store';

describe('PlanStore', () => {
  let store: PlanStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
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
    const stillHere = after.filter((id) => contractState(store.byId().get(id)!, 2027) !== 'left');
    const activeBefore = before.filter((id) => contractState(store.byId().get(id)!, 2027) !== 'left');
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
});
