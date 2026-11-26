import { FICTIONAL_SAVE } from '../../testing/fictional-save';
import { SaveFile } from '../domain/models';
import {
  buildSave,
  guessCurrentSeason,
  guessSeasonStyle,
  planImport,
  shortCode,
} from './import-plan';
import { ImportedPlayer } from './parse-squad';

const row = (over: Partial<ImportedPlayer> = {}): ImportedPlayer => ({
  name: 'New Player',
  age: 20,
  positions: { MC: 4 },
  ability: { min: 2.5, max: 2.5 },
  potential: { min: 3, max: 4 },
  contractExpires: '2049-11-30',
  ...over,
});

// The fictional squad as if the user had imported it before.
const mine: SaveFile = { ...FICTIONAL_SAVE, sample: false };
const ashworth = mine.players.find((p) => p.name === 'Tom Ashworth')!;

describe('planImport', () => {
  it('treats everyone as arriving on a first import', () => {
    const preview = planImport([row({ name: 'A' }), row({ name: 'B' })], null);
    expect(preview.firstImport).toBe(true);
    expect(preview.arriving.map((p) => p.name)).toEqual(['A', 'B']);
    expect(preview.staying).toEqual([]);
    expect(preview.leaving).toEqual([]);
  });

  it('ignores a sample squad', () => {
    const preview = planImport([row({ name: 'Tom Ashworth' })], FICTIONAL_SAVE);
    expect(preview.firstImport).toBe(true);
    expect(preview.leaving).toEqual([]);
  });

  it('matches by name, keeps ids and lists what changed', () => {
    const preview = planImport(
      [
        row({
          name: 'Tom Ashworth',
          positions: { GK: 4 },
          ability: { min: 3.5, max: 3.5 },
          potential: { min: 3.5, max: 3.5 },
          contractExpires: '2030-06-30',
        }),
        row({ name: 'Somebody New' }),
      ],
      mine,
    );
    const stay = preview.staying[0];
    expect(stay.player.id).toBe(ashworth.id);
    expect(stay.changes).toEqual([{ label: 'Contract', from: '30 Jun 2028', to: '30 Jun 2030' }]);
    expect(preview.arriving.map((p) => p.name)).toEqual(['Somebody New']);
    expect(preview.leaving.length).toBe(mine.players.length - 1);
    expect(preview.firstImport).toBe(false);
  });

  it('keeps a player whose row was skipped instead of treating them as gone', () => {
    const issues = [
      { row: 1, player: 'Tom Ashworth', column: 'position' as const, message: 'x', skipped: true },
    ];
    const preview = planImport([row({ name: 'Somebody New' })], mine, issues);
    expect(preview.leaving.map((p) => p.name)).not.toContain('Tom Ashworth');
    expect(preview.staying).toEqual([{ player: ashworth, changes: [], unread: true }]);
    expect(preview.players).toContain(ashworth);
  });

  it('keeps the stored value when a cell could not be read', () => {
    const issues = [
      { row: 1, player: 'Tom Ashworth', column: 'contractExpires' as const, message: 'x', skipped: false },
      { row: 1, player: 'Tom Ashworth', column: 'potential' as const, message: 'x', skipped: false },
    ];
    const imported = row({
      name: 'Tom Ashworth',
      positions: { GK: 4 },
      ability: { min: 3.5, max: 3.5 },
      potential: undefined,
      contractExpires: undefined,
    });
    const [stay] = planImport([imported], mine, issues).staying;
    expect(stay.player.contractExpires).toBe(ashworth.contractExpires);
    expect(stay.player.potential).toBe(ashworth.potential);
    expect(stay.changes).toEqual([]);
  });

  it('gives new players readable ids that never clash', () => {
    const preview = planImport([row({ name: 'Joël Müller' }), row({ name: 'Joël Müller' })], null);
    expect(preview.players.map((p) => p.id)).toEqual(['joel-muller', 'joel-muller-2']);
  });

  it('keeps potential ranges and uses the low end of an ability range', () => {
    const preview = planImport([row({ ability: { min: 2, max: 3 } })], null);
    const [p] = preview.players;
    expect(p.ability).toBe(2);
    expect([p.potential, p.potentialMax]).toEqual([3, 4]);
    expect(preview.abilityRanges).toBe(1);
  });
});

describe('buildSave', () => {
  it('names the save and keeps the shortlist on a re-import', () => {
    const preview = planImport([row()], mine);
    const save = buildSave(
      preview,
      {
        name: ' Harju 2nd go ',
        club: ' Harju Athletic ',
        seasonStyle: 'calendar',
        currentSeason: 2048,
        fileName: 'first-team.rtf',
      },
      mine,
    );
    expect(save).toMatchObject({
      id: mine.id,
      name: 'Harju 2nd go',
      club: 'Harju Athletic',
      shortCode: 'HA',
      seasonStyle: 'calendar',
      currentSeason: 2048,
      dataNote: 'Imported from first-team.rtf',
    });
    expect(save.shortlist).toBe(mine.shortlist);
    expect(save.sample).toBeUndefined();
  });

  it('gives a new save its own id and falls back to the club for its name', () => {
    const save = buildSave(
      planImport([row()], null),
      {
        name: '',
        club: 'Harju Athletic',
        seasonStyle: 'calendar',
        currentSeason: 2048,
        fileName: 'a.csv',
      },
      null,
    );
    expect(save.id).not.toBe(mine.id);
    expect(save.name).toBe('Harju Athletic');
    expect(save.shortlist).toEqual([]);
  });

  it('makes a short code from the club name', () => {
    expect(shortCode('Harju Athletic')).toBe('HA');
    expect(shortCode('Kuopion Palloseura Juniorit Ry')).toBe('KPJ');
    expect(shortCode('Ilves')).toBe('ILV');
  });
});

describe('season guesses', () => {
  it('spots calendar-year leagues from late-year contract ends', () => {
    expect(guessSeasonStyle([row({ contractExpires: '2048-11-30' }), row()])).toBe('calendar');
    expect(guessSeasonStyle([row({ contractExpires: '2027-06-30' })])).toBe('split');
    expect(guessSeasonStyle([row({ contractExpires: undefined })])).toBeUndefined();
  });

  it('takes the earliest season a contract ends in', () => {
    const rows = [row({ contractExpires: '2050-11-30' }), row({ contractExpires: '2048-11-30' })];
    expect(guessCurrentSeason(rows, 'calendar')).toBe(2048);
    expect(guessCurrentSeason([row({ contractExpires: '2027-06-30' })], 'split')).toBe(2026);
  });
});
