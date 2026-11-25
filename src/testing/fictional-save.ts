import { Player, SaveFile } from '../app/domain/models';

// Fictional test squad. Every club and player here is invented; specs use it
// so tests never depend on real players' details.
const players: Player[] = [
  { id: 'p01', name: 'Tom Ashworth', age: 30, nationality: 'ENG', positions: { GK: 4 }, ability: 3.5, potential: 3.5, contractExpires: '2028-06-30' },
  { id: 'p02', name: 'Kai Meier', age: 24, nationality: 'GER', positions: { GK: 4 }, ability: 3, potential: 3.5, contractExpires: '2029-06-30' },
  { id: 'p03', name: 'Oskar Lund', age: 18, nationality: 'NOR', positions: { GK: 4 }, ability: 1.5, potential: 3.5, contractExpires: '2030-06-30' },
  { id: 'p04', name: 'Jude Okafor', age: 25, nationality: 'NGA', positions: { DR: 4, WBR: 3 }, ability: 3.5, potential: 4, contractExpires: '2029-06-30' },
  { id: 'p05', name: 'Rui Teixeira', age: 29, nationality: 'POR', positions: { DR: 4, DC: 2, WBR: 3 }, ability: 3, potential: 3, contractExpires: '2028-06-30' },
  { id: 'p06', name: 'Mats Hallström', age: 33, nationality: 'SWE', positions: { DC: 4 }, ability: 3, potential: 3, contractExpires: '2027-06-30' },
  { id: 'p07', name: 'Dániel Varga', age: 26, nationality: 'HUN', positions: { DC: 4, DR: 2 }, ability: 4, potential: 4, contractExpires: '2030-06-30' },
  { id: 'p08', name: 'Liam Brennan', age: 27, nationality: 'IRL', positions: { DC: 4, DM: 2 }, ability: 3, potential: 3, contractExpires: '2029-06-30' },
  { id: 'p09', name: 'Sérgio Pereira', age: 28, nationality: 'BRA', positions: { DL: 4, WBL: 4 }, ability: 3, potential: 3, contractExpires: '2029-06-30' },
  { id: 'p10', name: 'Adam Kowal', age: 22, nationality: 'POL', positions: { DL: 4, WBL: 3, ML: 2 }, ability: 2.5, potential: 3.5, contractExpires: '2028-06-30' },
  { id: 'p11', name: 'Erik Lindqvist', age: 29, nationality: 'SWE', positions: { DM: 4, MC: 3 }, ability: 4, potential: 4, contractExpires: '2028-06-30' },
  { id: 'p12', name: 'Cédric Moreau', age: 26, nationality: 'FRA', positions: { DM: 4, MC: 4 }, ability: 3.5, potential: 3.5, contractExpires: '2029-06-30' },
  { id: 'p13', name: 'Femi Adeyemi', age: 23, nationality: 'NGA', positions: { DM: 3, MC: 3, DC: 3 }, ability: 3, potential: 4, contractExpires: '2030-06-30' },
  { id: 'p14', name: 'Nuno Ferreira', age: 24, nationality: 'POR', positions: { AMC: 4, MC: 3, ST: 2 }, ability: 4, potential: 4.5, contractExpires: '2030-06-30' },
  { id: 'p15', name: 'Ivan Novak', age: 27, nationality: 'CRO', positions: { AMC: 4, MC: 3 }, ability: 3, potential: 3, contractExpires: '2028-06-30' },
  { id: 'p16', name: 'Tariq Rahman', age: 17, nationality: 'ENG', positions: { AMC: 3, AMR: 2 }, ability: 2, potential: 4, contractExpires: '2031-06-30' },
  { id: 'p17', name: 'Yuto Sato', age: 27, nationality: 'JPN', positions: { AMR: 4, MR: 4, AML: 2 }, ability: 3.5, potential: 3.5, contractExpires: '2028-06-30' },
  { id: 'p18', name: 'Ben Hughes', age: 21, nationality: 'WAL', positions: { AMR: 3, MR: 4 }, ability: 2.5, potential: 3.5, contractExpires: '2029-06-30' },
  { id: 'p19', name: 'Karim Diallo', age: 23, nationality: 'SEN', positions: { AML: 4, ML: 3, ST: 2 }, ability: 3.5, potential: 4, contractExpires: '2029-06-30' },
  { id: 'p20', name: 'Pim Jansen', age: 26, nationality: 'NED', positions: { AML: 3, ML: 4 }, ability: 3, potential: 3, contractExpires: '2028-06-30' },
  { id: 'p21', name: 'Rafael Castellano', age: 28, nationality: 'ESP', positions: { ST: 4 }, ability: 4, potential: 4, contractExpires: '2029-06-30' },
  { id: 'p22', name: 'Wale Oyelaran', age: 25, nationality: 'NGA', positions: { ST: 4, AML: 2 }, ability: 3, potential: 3.5, contractExpires: '2028-06-30' },
  { id: 'p23', name: 'Harry Byrne', age: 18, nationality: 'IRL', positions: { ST: 3 }, ability: 2, potential: 4, contractExpires: '2030-06-30' },
  { id: 'p24', name: 'George Abbot', age: 31, nationality: 'ENG', positions: { MC: 3, DM: 2 }, ability: 2.5, potential: 2.5, contractExpires: '2027-06-30' },
  { id: 'p25', name: 'Marco Rossi', age: 34, nationality: 'ITA', positions: { DC: 3 }, ability: 2.5, potential: 2.5, contractExpires: '2027-06-30' },
  { id: 'p26', name: 'Vlad Popescu', age: 20, nationality: 'ROU', positions: { WBR: 3, DR: 2, MR: 2 }, ability: 2.5, potential: 3.5, contractExpires: '2029-06-30' },
  { id: 'p27', name: 'Conor Walsh', age: 17, nationality: 'IRL', positions: { DC: 2, DM: 2 }, ability: 1.5, potential: 3.5, contractExpires: '2031-06-30' },
  { id: 'p28', name: 'Daichi Ikeda', age: 22, nationality: 'JPN', positions: { MC: 3, AMC: 2 }, ability: 2.5, potential: 3, contractExpires: '2028-06-30' },
];

const shortlist: Player[] = [
  { id: 't01', name: 'Luca Haddad', age: 21, nationality: 'LBN', positions: { DC: 4, DR: 2 }, ability: 3, potential: 4.5, target: true },
  { id: 't02', name: 'Emil Strand', age: 24, nationality: 'DEN', positions: { DM: 4, MC: 3 }, ability: 3.5, potential: 4, target: true },
  { id: 't03', name: 'Iker Salazar', age: 19, nationality: 'ESP', positions: { AML: 4, AMR: 3 }, ability: 2.5, potential: 4.5, target: true },
];

export const FICTIONAL_SAVE: SaveFile = {
  id: 'sample-harrowgate',
  name: 'Harrowgate Town',
  club: 'Harrowgate Town',
  shortCode: 'HT',
  game: 'FM26',
  seasonStyle: 'split',
  currentSeason: 2026,
  dataAsOf: '2026-08-14',
  dataNote: 'Fictional test squad',
  players,
  shortlist,
  sample: true,
};
