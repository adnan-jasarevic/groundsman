import { guessDateOrder, parseDate, parsePositions, parseStars } from './fm-values';

describe('parsePositions', () => {
  it.each([
    ['GK', ['GK']],
    ['D (C)', ['DC']],
    ['D (RLC)', ['DR', 'DL', 'DC']],
    ['D/WB/AM (R)', ['DR', 'WBR', 'AMR']],
    ['D (RC), WB (R)', ['DR', 'DC', 'WBR']],
    ['D (R), DM, M (C)', ['DR', 'DM', 'MC']],
    ['DM, M/AM (C)', ['DM', 'MC', 'AMC']],
    ['M (C), AM (LC)', ['MC', 'AML', 'AMC']],
    ['AM (R), ST (C)', ['AMR', 'ST']],
    ['ST', ['ST']],
  ])('reads %s', (value, expected) => {
    expect(parsePositions(value)).toEqual(expected);
  });

  it.each(['', 'Striker', 'D', 'XX (C)', 'WB (C)'])('rejects %j', (value) => {
    expect(parsePositions(value)).toBeNull();
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
