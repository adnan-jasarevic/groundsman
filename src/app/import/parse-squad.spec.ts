import {
  FICTIONAL_HEADERS,
  FICTIONAL_ROWS,
  toFmCsv,
  toFmHtml,
  toFmText,
} from '../../testing/fm-exports';
import { ImportError, parseSquad } from './parse-squad';

const pick = (columns: string[]) => {
  const at = columns.map((c) => FICTIONAL_HEADERS.indexOf(c));
  return { headers: columns, rows: FICTIONAL_ROWS.map((r) => at.map((i) => r[i])) };
};

describe('parseSquad', () => {
  const formats = [
    ['web page', 'html', toFmHtml(FICTIONAL_HEADERS, FICTIONAL_ROWS)],
    ['text file', 'text', toFmText(FICTIONAL_HEADERS, FICTIONAL_ROWS)],
    ['CSV', 'csv', toFmCsv(FICTIONAL_HEADERS, FICTIONAL_ROWS)],
    ['CSV with semicolons', 'csv', toFmCsv(FICTIONAL_HEADERS, FICTIONAL_ROWS, ';')],
  ] as const;

  for (const [label, format, input] of formats) {
    it(`reads every player from a ${label} export`, () => {
      const result = parseSquad(input);
      expect(result.format).toBe(format);
      expect(result.players.length).toBe(FICTIONAL_ROWS.length);
      expect(result.issues).toEqual([]);
      expect(result.missing).toEqual([]);
      expect(result.players[3]).toEqual({
        name: 'Moussa Kanté-Rey',
        age: 25,
        positions: { DC: 4, DM: 3 },
        nationality: 'SEN',
        ability: { min: 4, max: 4 },
        potential: { min: 4.5, max: 4.5 },
        contractExpires: '2051-11-30',
        squadStatus: 'Star Player',
        info: 'Wtg',
      });
    });
  }

  it('gives the same result for all three formats', () => {
    const [html, text, csv] = formats.slice(0, 3).map(([, , input]) => parseSquad(input).players);
    expect(text).toEqual(html);
    expect(csv).toEqual(html);
  });

  it('keeps potential ranges as recorded', () => {
    const { players } = parseSquad(toFmCsv(FICTIONAL_HEADERS, FICTIONAL_ROWS));
    expect(players.find((p) => p.name === 'Eino Paasivirta')!.potential).toEqual({
      min: 3.5,
      max: 4,
    });
  });

  it('marks Best Pos as Natural and the other listed positions as Accomplished', () => {
    const { players } = parseSquad(toFmCsv(FICTIONAL_HEADERS, FICTIONAL_ROWS));
    expect(players.find((p) => p.name === 'Joonas Vähälä')!.positions).toEqual({
      DR: 3,
      WBR: 4,
      AMR: 3,
    });
    expect(players.find((p) => p.name === 'Patrik Lindgård')!.positions).toEqual({
      DR: 3,
      DL: 4,
      DC: 3,
    });
  });

  it('works with a different column set in a different order', () => {
    const { headers, rows } = pick(['Age', 'Position', 'Player', 'Nation']);
    const result = parseSquad(toFmText(headers, rows));
    expect(result.players[0]).toEqual({
      name: 'Aleksi Rautio',
      age: 27,
      positions: { GK: 3 },
      nationality: 'FIN',
    });
    expect(result.missing).toEqual([
      'bestPosition',
      'ability',
      'potential',
      'contractExpires',
      'squadStatus',
      'info',
    ]);
  });

  it('stops with a clear message when a required column is missing', () => {
    const { headers, rows } = pick(['Player', 'Nation', 'Expires']);
    expect(() => parseSquad(toFmCsv(headers, rows))).toThrow(
      new ImportError(
        'The export has no Position, Age column. Add it to the view in FM and export again.',
      ),
    );
  });

  it('rejects empty input', () => {
    expect(() => parseSquad('  ')).toThrow(ImportError);
  });

  it('skips unreadable rows and blanks unreadable fields, reporting both', () => {
    const rows = FICTIONAL_ROWS.slice(0, 3).map((r) => [...r]);
    rows[0][7] = 'unknown'; // age
    rows[1][13] = '31/02/2049'; // expiry
    rows[2][9] = 'six'; // potential
    const result = parseSquad(toFmCsv(FICTIONAL_HEADERS, rows));

    expect(result.players.map((p) => p.name)).toEqual(['Joonas Vähälä', 'Patrik Lindgård']);
    expect(result.players[0].contractExpires).toBeUndefined();
    expect(result.players[1].potential).toBeUndefined();
    expect(result.issues.map((i) => [i.row, i.column, i.skipped])).toEqual([
      [1, 'age', true],
      [2, 'contractExpires', false],
      [3, 'potential', false],
    ]);
  });

  it('reads month-first dates when the dates can only be month first', () => {
    const { headers, rows } = pick(['Player', 'Position', 'Age', 'Expires']);
    const usDates = rows.map((r) => [r[0], r[1], r[2], '11/30/2049']);
    const result = parseSquad(toFmCsv(headers, usDates));
    expect(result.dateOrder).toBe('mdy');
    expect(result.players[0].contractExpires).toBe('2049-11-30');
  });

  it('flags players who share a name, since re-imports match by name', () => {
    const rows = [FICTIONAL_ROWS[5], [...FICTIONAL_ROWS[5]]];
    const result = parseSquad(toFmCsv(FICTIONAL_HEADERS, rows));
    expect(result.players.length).toBe(2);
    expect(result.issues).toEqual([
      expect.objectContaining({ player: 'Tiago', column: 'name', skipped: false }),
    ]);
  });

  it('keeps the readable positions when part of the position is unknown', () => {
    const rows = [[...FICTIONAL_ROWS[3]], [...FICTIONAL_ROWS[0]]];
    rows[0][3] = 'SW, D (C), DM';
    rows[1][3] = 'SW';
    const result = parseSquad(toFmCsv(FICTIONAL_HEADERS, rows));

    expect(result.players.map((p) => p.name)).toEqual(['Moussa Kanté-Rey']);
    expect(result.players[0].positions).toEqual({ DC: 4, DM: 3 });
    expect(result.issues.map((i) => [i.row, i.column, i.skipped, i.message])).toEqual([
      [1, 'position', false, 'Could not read SW. The other positions were kept.'],
      [2, 'position', true, 'Position could not be read.'],
    ]);
  });

  it('treats "-" as no value', () => {
    const rows = [[...FICTIONAL_ROWS[0]]];
    rows[0][9] = '-';
    rows[0][13] = '-';
    const [player] = parseSquad(toFmCsv(FICTIONAL_HEADERS, rows)).players;
    expect(player.potential).toBeUndefined();
    expect(player.contractExpires).toBeUndefined();
  });
});
