/** The three ways Football Manager prints a view: web page, text file and CSV. */
export type ExportFormat = 'html' | 'text' | 'csv';

export interface RawTable {
  format: ExportFormat;
  headers: string[];
  rows: string[][];
}

/** Works out the format from the content, since FM's file extensions can't be trusted (text exports are saved as .rtf). */
export function detectFormat(input: string): ExportFormat {
  if (/<table[\s>]/i.test(input)) return 'html';
  const firstLine = input.split(/\r?\n/).find((line) => line.trim() !== '') ?? '';
  return firstLine.trimStart().startsWith('|') ? 'text' : 'csv';
}

export function readTable(input: string): RawTable {
  const text = input.replace(/^\uFEFF/, '');
  const format = detectFormat(text);
  const grid =
    format === 'html' ? readHtml(text) : format === 'text' ? readText(text) : readCsv(text);
  const [headers = [], ...rows] = grid.filter((row) => row.some((cell) => cell !== ''));
  return { format, headers, rows };
}

function readHtml(input: string): string[][] {
  const doc = new DOMParser().parseFromString(input, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return [];
  return Array.from(table.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.querySelectorAll('th, td')).map((cell) => clean(cell.textContent ?? '')),
  );
}

function readText(input: string): string[][] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && !/^\|[\s-]*\|?$/.test(line))
    .map((line) => line.replace(/^\|/, '').replace(/\|$/, '').split('|').map(clean));
}

function readCsv(input: string): string[][] {
  const delimiter = guessDelimiter(input.split(/\r?\n/, 1)[0]);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(clean(cell));
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(clean(cell));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell !== '' || row.length) {
    row.push(clean(cell));
    rows.push(row);
  }
  return rows;
}

/** Comma, semicolon or tab, depending on the computer's regional settings. Counts only outside quotes. */
function guessDelimiter(headerLine: string): string {
  const counts = new Map<string, number>([
    [',', 0],
    [';', 0],
    ['\t', 0],
  ]);
  let quoted = false;
  for (const ch of headerLine) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && counts.has(ch)) counts.set(ch, counts.get(ch)! + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0][0];
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
