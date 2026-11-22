import { Formation } from './models';

// Anchors are mirrored across the pitch's centre line (x = 50).
const GK = { id: 'gk', position: 'GK', x: 50, y: 77.5, line: 'goal' } as const;

export const FORMATIONS: Formation[] = [
  {
    id: '4231w',
    name: '4-2-3-1 Wide',
    slots: [
      { id: 'st', position: 'ST', x: 50, y: 5.5, line: 'attack' },
      { id: 'aml', position: 'AML', x: 14, y: 23, line: 'attack' },
      { id: 'amc', position: 'AMC', x: 50, y: 23, line: 'attack' },
      { id: 'amr', position: 'AMR', x: 86, y: 23, line: 'attack' },
      { id: 'dml', position: 'DM', x: 33, y: 41.1, line: 'midfield' },
      { id: 'dmr', position: 'DM', x: 67, y: 41.1, line: 'midfield' },
      { id: 'dl', position: 'DL', x: 13, y: 59, line: 'defence' },
      { id: 'dcl', position: 'DC', x: 37.5, y: 59, line: 'defence' },
      { id: 'dcr', position: 'DC', x: 62.5, y: 59, line: 'defence' },
      { id: 'dr', position: 'DR', x: 87, y: 59, line: 'defence' },
      GK,
    ],
  },
  {
    id: '433dm',
    name: '4-3-3 DM Wide',
    slots: [
      { id: 'aml', position: 'AML', x: 15, y: 8.3, line: 'attack' },
      { id: 'st', position: 'ST', x: 50, y: 5.5, line: 'attack' },
      { id: 'amr', position: 'AMR', x: 85, y: 8.3, line: 'attack' },
      { id: 'mcl', position: 'MC', x: 32, y: 25.8, line: 'midfield' },
      { id: 'mcr', position: 'MC', x: 68, y: 25.8, line: 'midfield' },
      { id: 'dm', position: 'DM', x: 50, y: 42.4, line: 'midfield' },
      { id: 'dl', position: 'DL', x: 13, y: 59, line: 'defence' },
      { id: 'dcl', position: 'DC', x: 37.5, y: 59, line: 'defence' },
      { id: 'dcr', position: 'DC', x: 62.5, y: 59, line: 'defence' },
      { id: 'dr', position: 'DR', x: 87, y: 59, line: 'defence' },
      GK,
    ],
  },
  {
    id: '442',
    name: '4-4-2',
    slots: [
      { id: 'stl', position: 'ST', x: 36, y: 5.5, line: 'attack' },
      { id: 'str', position: 'ST', x: 64, y: 5.5, line: 'attack' },
      { id: 'ml', position: 'ML', x: 13, y: 28.6, line: 'midfield' },
      { id: 'mcl', position: 'MC', x: 37.5, y: 31.3, line: 'midfield' },
      { id: 'mcr', position: 'MC', x: 62.5, y: 31.3, line: 'midfield' },
      { id: 'mr', position: 'MR', x: 87, y: 28.6, line: 'midfield' },
      { id: 'dl', position: 'DL', x: 13, y: 57.2, line: 'defence' },
      { id: 'dcl', position: 'DC', x: 37.5, y: 57.2, line: 'defence' },
      { id: 'dcr', position: 'DC', x: 62.5, y: 57.2, line: 'defence' },
      { id: 'dr', position: 'DR', x: 87, y: 57.2, line: 'defence' },
      GK,
    ],
  },
  {
    id: '352',
    name: '3-5-2',
    slots: [
      { id: 'stl', position: 'ST', x: 36, y: 5.5, line: 'attack' },
      { id: 'str', position: 'ST', x: 64, y: 5.5, line: 'attack' },
      { id: 'mcl', position: 'MC', x: 32, y: 23, line: 'midfield' },
      { id: 'mcr', position: 'MC', x: 68, y: 23, line: 'midfield' },
      { id: 'wbl', position: 'WBL', x: 13, y: 37.8, line: 'midfield' },
      { id: 'dm', position: 'DM', x: 50, y: 40.6, line: 'midfield' },
      { id: 'wbr', position: 'WBR', x: 87, y: 37.8, line: 'midfield' },
      { id: 'dcl', position: 'DC', x: 22, y: 59, line: 'defence' },
      { id: 'dc', position: 'DC', x: 50, y: 59, line: 'defence' },
      { id: 'dcr', position: 'DC', x: 78, y: 59, line: 'defence' },
      GK,
    ],
  },
];

export function formationById(id: string): Formation {
  return FORMATIONS.find((f) => f.id === id) ?? FORMATIONS[0];
}
