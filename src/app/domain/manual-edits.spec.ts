import {
  editedFields,
  fieldValue,
  fmName,
  fmValue,
  formatValue,
  recordEdit,
  sameValue,
  withValue,
} from './manual-edits';
import { Player } from './models';

const fromFm: Player = {
  id: 'p1',
  name: 'Tom Ashworth',
  age: 30,
  nationality: 'ENG',
  positions: { GK: 4 },
  ability: 3.5,
  potential: 3.5,
  contractExpires: '2028-06-30',
};

describe('recordEdit', () => {
  it("remembers FM's value for each field changed by hand", () => {
    const edited = recordEdit(fromFm, { ...fromFm, contractExpires: '2030-06-30', ability: 4 });
    expect(edited.fm).toEqual({ ability: 3.5, contractExpires: '2028-06-30' });
    expect(editedFields(edited)).toEqual(['ability', 'contractExpires']);
  });

  it("keeps FM's original value through a second edit", () => {
    const once = recordEdit(fromFm, { ...fromFm, contractExpires: '2030-06-30' });
    const twice = recordEdit(once, { ...once, contractExpires: '2031-06-30' });
    expect(twice.fm).toEqual({ contractExpires: '2028-06-30' });
  });

  it("forgets an edit once the value is back to FM's", () => {
    const once = recordEdit(fromFm, { ...fromFm, contractExpires: '2030-06-30' });
    const back = recordEdit(once, { ...once, contractExpires: '2028-06-30' });
    expect(back.fm).toBeUndefined();
  });

  it('records no FM value for a player FM never had one for', () => {
    const edited = recordEdit(fromFm, { ...fromFm, squadStatus: 'Rotation' });
    expect(edited.fm).toEqual({ squadStatus: null });
    expect(formatValue('squadStatus', edited.fm!.squadStatus)).toBe('None');
  });

  it('keeps players added by hand free of FM values', () => {
    const added = { ...fromFm, added: true };
    const edited = recordEdit(added, { ...added, ability: 1 });
    expect(edited.fm).toBeUndefined();
    expect(edited.added).toBe(true);
  });

  it('keeps the name on the pitch out of FM values, since FM has no such field', () => {
    expect(recordEdit(fromFm, { ...fromFm, known: 'Ashy' }).fm).toBeUndefined();
  });

  it('matches re-imports on the name FM uses', () => {
    const renamed = recordEdit(fromFm, { ...fromFm, name: 'Thomas Ashworth' });
    expect(fmName(renamed)).toBe('Tom Ashworth');
    expect(fmValue(renamed, 'name')).toBe('Tom Ashworth');
  });
});

describe('field values', () => {
  it('compares positions and potential ranges by content', () => {
    expect(sameValue('positions', { GK: 4, DC: 2 }, { DC: 2, GK: 4 })).toBe(true);
    expect(sameValue('positions', { GK: 4 }, { GK: 3 })).toBe(false);
    expect(sameValue('potential', { min: 3 }, { min: 3, max: 3 })).toBe(true);
    expect(sameValue('potential', { min: 3 }, { min: 3, max: 4 })).toBe(false);
  });

  it('round-trips every field through withValue', () => {
    const p = { ...fromFm, potentialMax: 4, squadStatus: 'Squad Player' };
    for (const f of ['potential', 'contractExpires', 'squadStatus', 'positions', 'age'] as const) {
      expect(
        sameValue(f, fieldValue(withValue(fromFm, f, fieldValue(p, f)), f), fieldValue(p, f)),
      ).toBe(true);
    }
    expect(withValue(p, 'contractExpires', null).contractExpires).toBeUndefined();
  });

  it('writes values the way people read them', () => {
    expect(formatValue('contractExpires', '2029-06-30')).toBe('30 Jun 2029');
    expect(formatValue('ability', 3.5)).toBe('3.5 stars');
    expect(formatValue('potential', { min: 2, max: 3 })).toBe('2.0–3.0 stars');
    expect(formatValue('positions', { DM: 3, MC: 4 })).toBe('M (C), DM');
  });
});
