// Fictional FM27 squad view in the three formats FM prints (web page, text, CSV).
// Every player is invented. The layout copies FM's output: a custom view with
// extra columns the importer ignores, star ranges, combined positions and
// day-first contract dates.

// prettier-ignore
export const FICTIONAL_HEADERS = [
  'Picked', 'Inf', 'Player', 'Position', 'Best Pos', 'Transfer Value', 'Best Role', 'Age',
  'Ability', 'Potential', 'Playing Time', 'Nation', 'Wage', 'Expires', 'Promises',
];

// prettier-ignore
export const FICTIONAL_ROWS: string[][] = [
  ['-', 'Wnt', 'Aleksi Rautio', 'GK', 'GK', '€1.5M - €2.4M', 'GK', '27', '3.0', '3.0', 'Regular Starter', 'FIN', '€9K p/w', '30/11/2049', '0'],
  ['-', 'HGN', 'Joonas Vähälä', 'D/WB/AM (R)', 'WB (R)', '€800K - €1.1M', 'WB', '24', '2.5', '3.0', 'Squad Player', 'FIN', '€4.5K p/w', '30/11/2048', '0'],
  ['-', 'Res', 'Patrik Lindgård', 'D (RLC)', 'D (L)', '€90K - €300K', 'FB', '19', '2.0', '2.0-3.0', 'Youngster', 'SWE', '€1.2K p/w', '30/11/2048', '0'],
  ['-', 'Wtg', 'Moussa Kanté-Rey', 'D (C), DM', 'D (C)', '€6M - €7.5M', 'BCB', '25', '4.0', '4.5', 'Star Player', 'SEN', '€31K p/w', '30/11/2051', '0'],
  ['-', 'Frt', 'Samu Eklund', 'DM, M/AM (C)', 'M (C)', '€1.1M - €1.9M', 'MPM', '30', '2.5', '2.5', 'Fringe Player', 'FIN', '€6.25K p/w', '30/11/2049', '1'],
  ['-', 'Wnt', 'Tiago', 'AM (R), ST (C)', 'ST (C)', '€12M - €14M', 'CHF', '22', '4.0', '4.0', 'Important Player', 'BRA', '€48K p/w', '30/11/2052', '0'],
  ['-', 'HGN', 'Eino Paasivirta', 'M (RC)', 'M (R)', '€2M - €3.4M', 'W', '18', '2.0', '3.5-4.0', 'Breakthrough Prospect', 'FIN', '€2.5K p/w', '30/11/2048', '0'],
  ['-', 'HGN', 'Kalle Nurmi', 'D/WB/AM (L)', 'D (L)', '€15K - €70K', 'IWB', '35', '1.5', '1.5', 'Emergency Backup', 'FIN', '€3K p/w', '30/11/2049', '0'],
];

/** FM's "Text file" print: a pipe table with dashed lines between rows, saved as .rtf. */
export function toFmText(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) =>
    '| ' + cells.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' | ';
  const divider = '| ' + '-'.repeat(widths.reduce((a, w) => a + w + 3, -1)) + '| ';
  return [line(headers), divider, ...rows.flatMap((r) => [line(r), divider])].join('\r\n') + '\r\n';
}

/** FM's "Web page" print. */
export function toFmHtml(headers: string[], rows: string[][]): string {
  const cells = (tag: string, values: string[]) =>
    values.map((v) => `\t<${tag}>${v}</${tag}>\n`).join('\n');
  return [
    '<html>\n<head>\n<title>First Team<br/></title>',
    '<style type ="text/css">\nbody,td,th {\nfont-family: Verdana;\n}\n</style>\n</head>\n<body>',
    '<center><B>First Team<br/>\n</center></B>\n<p>',
    '<table bordercolor="#000000" width="90%" align="center">',
    `<tr bgcolor="#EEEEEE">\n${cells('th', headers)}\n</tr>`,
    ...rows.map((r) => `<tr bgcolor="#EEEEEE">\n${cells('td', r)}\n</tr>`),
    '</table>\n</body>\n</html>',
  ].join('\r\n');
}

/** FM's CSV export: byte order mark, quotes only where a value holds the separator. */
export function toFmCsv(headers: string[], rows: string[][], separator = ','): string {
  const quote = (v: string) =>
    v.includes(separator) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
  return (
    '\uFEFF' + [headers, ...rows].map((r) => r.map(quote).join(separator)).join('\r\n') + '\r\n'
  );
}
