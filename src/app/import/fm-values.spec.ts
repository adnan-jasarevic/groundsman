import { POSITION_LABEL, PositionCode } from '../domain/models';
import { guessDateOrder, parseDate, parsePositions, parseStars } from './fm-values';

describe('parsePositions', () => {
  const ALL = Object.keys(POSITION_LABEL) as PositionCode[];

  it.each(ALL)('reads %s on its own', (code) => {
    expect(parsePositions(POSITION_LABEL[code])).toEqual({ codes: [code], unread: [] });
  });

  it('reads every position in one string', () => {
    const { codes, unread } = parsePositions('GK, D/WB (RL), D (C), DM, M/AM (RLC), ST (C)');
    expect([...codes].sort()).toEqual([...ALL].sort());
    expect(unread).toEqual([]);
  });

  it.each([
    ['D (RLC)', ['DR', 'DL', 'DC']],
    ['D/WB/AM (R)', ['DR', 'WBR', 'AMR']],
    ['WB/M (L)', ['WBL', 'ML']],
    ['D (RL), WB (RL), DM', ['DR', 'DL', 'WBR', 'WBL', 'DM']],
    ['M/AM (RLC)', ['MR', 'ML', 'MC', 'AMR', 'AML', 'AMC']],
    ['AM (RLC), ST (C)', ['AMR', 'AML', 'AMC', 'ST']],
    ['DM, M (C)', ['DM', 'MC']],
    ['ST', ['ST']],
    ['d (c)', ['DC']],
  ])('reads %s', (value, expected) => {
    expect(parsePositions(value)).toEqual({ codes: expected, unread: [] });
  });

  it.each([
    ['SW, D (C)', ['DC'], ['SW']],
    ['WB (RC)', ['WBR'], ['WB (C)']],
    ['D/WB/XX (L)', ['DL', 'WBL'], ['XX (L)']],
    ['D, DM', ['DM'], ['D']],
    ['Striker', [], ['Striker']],
    ['', [], []],
  ])('keeps what it can read from %j', (value, codes, unread) => {
    expect(parsePositions(value)).toEqual({ codes, unread });
  });
});

describe('parseStars', () => {
  it('reads single values and ranges', () => {
    expect(parseStars('3.5')).toEqual({ min: 3.5, max: 3.5 });
    expect(parseStars('2.0-3.0')).toEqual({ min: 2, max: 3 });
    expect(parseStars('2,5')).toEqual({ min: 2.5, max: 2.5 });
  });

  it.each(['0', '5.5', '3.2', '4.0-3.0', 'six'])('rejects %j', (value) => {
    expect(parseStars(value)).toBeNull();
  });
});

describe('dates', () => {
  it('reads day-first dates and rejects dates that do not exist', () => {
    expect(parseDate('30/11/2048', 'dmy')).toBe('2048-11-30');
    expect(parseDate('1.7.2050', 'dmy')).toBe('2050-07-01');
    expect(parseDate('31/02/2049', 'dmy')).toBeNull();
    expect(parseDate('Nov 2049', 'dmy')).toBeNull();
  });

  it('assumes day first unless only month first fits', () => {
    expect(guessDateOrder(['01/06/2049', '05/07/2050'])).toBe('dmy');
    expect(guessDateOrder(['30/11/2049'])).toBe('dmy');
    expect(guessDateOrder(['11/30/2049'])).toBe('mdy');
  });
});
