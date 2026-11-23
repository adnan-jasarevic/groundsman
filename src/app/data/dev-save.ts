import { Player, SaveFile } from '../domain/models';

// Illustrative development squad: Manchester United first team, 2026/27.
// Names, squad, ages, nationalities and main positions follow ESPN's 2026/27
// squad page as of 22 Nov 2026. Contract end years, secondary positions,
// familiarity and star ratings are estimates for development only and are not
// verified. A real FM import replaces all of this.
const players: Player[] = [
  // Goalkeepers
  { id: 'mu01', name: 'Senne Lammens', age: 24, nationality: 'BEL', positions: { GK: 4 }, ability: 3.5, potential: 4, contractEnd: 2030 },
  { id: 'mu12', name: 'Karl Darlow', age: 36, nationality: 'WAL', positions: { GK: 4 }, ability: 2.5, potential: 2.5, contractEnd: 2027 },
  { id: 'mu22', name: 'Tom Heaton', age: 40, nationality: 'ENG', positions: { GK: 4 }, ability: 2, potential: 2, contractEnd: 2027 },
  { id: 'mu45', name: 'Dermot Mee', age: 24, nationality: 'NIR', positions: { GK: 4 }, ability: 1.5, potential: 2.5, contractEnd: 2027 },

  // Defenders
  { id: 'mu02', name: 'Diogo Dalot', age: 27, nationality: 'POR', positions: { DR: 4, WBR: 3, DL: 3 }, ability: 3.5, potential: 3.5, contractEnd: 2028 },
  { id: 'mu03', name: 'Noussair Mazraoui', age: 29, nationality: 'MAR', positions: { DR: 4, WBR: 3, DL: 3, DM: 2 }, ability: 3.5, potential: 3.5, contractEnd: 2028 },
  { id: 'mu04', name: 'Matthijs de Ligt', known: 'de Ligt', age: 27, nationality: 'NED', positions: { DC: 4 }, ability: 3.5, potential: 3.5, contractEnd: 2029 },
  { id: 'mu05', name: 'Harry Maguire', age: 33, nationality: 'ENG', positions: { DC: 4 }, ability: 3, potential: 3, contractEnd: 2027 },
  { id: 'mu06', name: 'Lisandro Martínez', age: 28, nationality: 'ARG', positions: { DC: 4, DL: 3 }, ability: 3.5, potential: 3.5, contractEnd: 2027 },
  { id: 'mu13', name: 'Patrick Dorgu', age: 22, nationality: 'DEN', positions: { WBL: 4, DL: 4, AML: 3 }, ability: 3, potential: 4, contractEnd: 2030 },
  { id: 'mu15', name: 'Leny Yoro', age: 21, nationality: 'FRA', positions: { DC: 4 }, ability: 3, potential: 4.5, contractEnd: 2029 },
  { id: 'mu23', name: 'Luke Shaw', age: 31, nationality: 'ENG', positions: { DL: 4, DC: 3, WBL: 3 }, ability: 3, potential: 3, contractEnd: 2027 },
  { id: 'mu26', name: 'Ayden Heaven', age: 20, nationality: 'ENG', positions: { DC: 4, DL: 2 }, ability: 2.5, potential: 4, contractEnd: 2030 },
  { id: 'mu41', name: 'Harry Amass', age: 19, nationality: 'ENG', positions: { DL: 4, WBL: 3 }, ability: 2.5, potential: 4, contractEnd: 2029 },
  { id: 'mu56', name: 'Jaydan Kamason', age: 19, nationality: 'ENG', positions: { DR: 3, WBR: 3 }, ability: 1.5, potential: 3, contractEnd: 2027 },
  { id: 'mu57', name: 'Daniel Armer', age: 19, nationality: 'SCO', positions: { DR: 3, DC: 2 }, ability: 1.5, potential: 3, contractEnd: 2027 },

  // Midfielders
  { id: 'mu07', name: 'Mason Mount', age: 27, nationality: 'ENG', positions: { AMC: 4, MC: 3, AML: 2 }, ability: 3, potential: 3, contractEnd: 2028 },
  { id: 'mu08', name: 'Bruno Fernandes', age: 32, nationality: 'POR', positions: { AMC: 4, MC: 4 }, ability: 4, potential: 4, contractEnd: 2027 },
  { id: 'mu17', name: 'Andrey Santos', age: 22, nationality: 'BRA', positions: { MC: 4, DM: 3 }, ability: 3, potential: 4, contractEnd: 2031 },
  { id: 'mu18', name: 'Youri Tielemans', age: 29, nationality: 'BEL', positions: { MC: 4, DM: 3, AMC: 3 }, ability: 3.5, potential: 3.5, contractEnd: 2029 },
  { id: 'mu20', name: 'Carlos Baleba', age: 22, nationality: 'CMR', positions: { DM: 4, MC: 4 }, ability: 3.5, potential: 4.5, contractEnd: 2031 },
  { id: 'mu25', name: 'Manuel Ugarte', age: 25, nationality: 'URU', positions: { DM: 4, MC: 3 }, ability: 3, potential: 3.5, contractEnd: 2029 },
  { id: 'mu37', name: 'Kobbie Mainoo', age: 21, nationality: 'ENG', positions: { MC: 4, DM: 3, AMC: 3 }, ability: 3, potential: 4.5, contractEnd: 2027 },
  { id: 'mu38', name: 'Jack Fletcher', known: 'J. Fletcher', age: 19, nationality: 'ENG', positions: { MC: 3, AMC: 3 }, ability: 1.5, potential: 3.5, contractEnd: 2028 },
  { id: 'mu39', name: 'Tyler Fletcher', known: 'T. Fletcher', age: 19, nationality: 'SCO', positions: { DM: 3, MC: 3 }, ability: 1.5, potential: 3, contractEnd: 2028 },

  // Forwards
  { id: 'mu09', name: 'Marcus Rashford', age: 29, nationality: 'ENG', positions: { AML: 4, ST: 3 }, ability: 3, potential: 3.5, contractEnd: 2028 },
  { id: 'mu10', name: 'Matheus Cunha', age: 27, nationality: 'BRA', positions: { AMC: 4, ST: 4, AML: 3 }, ability: 3.5, potential: 3.5, contractEnd: 2030 },
  { id: 'mu11', name: 'Joshua Zirkzee', age: 25, nationality: 'NED', positions: { ST: 4, AMC: 3 }, ability: 3, potential: 3, contractEnd: 2029 },
  { id: 'mu16', name: 'Amad Diallo', known: 'Amad', age: 24, nationality: 'CIV', positions: { AMR: 4, AML: 3 }, ability: 3.5, potential: 4, contractEnd: 2030 },
  { id: 'mu19', name: 'Bryan Mbeumo', age: 27, nationality: 'CMR', positions: { AMR: 4, ST: 3 }, ability: 4, potential: 4, contractEnd: 2030 },
  { id: 'mu27', name: 'Tynan Thompson', age: 18, nationality: 'ENG', positions: { AML: 3, ST: 2 }, ability: 1.5, potential: 3.5, contractEnd: 2030 },
  { id: 'mu30', name: 'Benjamin Šeško', age: 23, nationality: 'SVN', positions: { ST: 4 }, ability: 3.5, potential: 4.5, contractEnd: 2030 },
  { id: 'mu31', name: 'Shea Lacey', age: 19, nationality: 'ENG', positions: { AMR: 3, AMC: 2 }, ability: 2, potential: 3.5, contractEnd: 2028 },
];

// Example shortlist for trying the drag-in flow. These are placeholders, not
// reported transfer targets.
const shortlist: Player[] = [
  { id: 't01', name: 'Jarrad Branthwaite', age: 24, nationality: 'ENG', positions: { DC: 4, DL: 2 }, ability: 3.5, potential: 4, target: true },
  { id: 't02', name: 'Elliot Anderson', age: 24, nationality: 'ENG', positions: { MC: 4, DM: 3, AMC: 3 }, ability: 3.5, potential: 4, target: true },
  { id: 't03', name: 'Nico Williams', age: 24, nationality: 'ESP', positions: { AML: 4, AMR: 3 }, ability: 3.5, potential: 4, target: true },
];

export const DEV_SAVE: SaveFile = {
  id: 'dev-man-utd-2026',
  club: 'Manchester United',
  shortCode: 'MU',
  game: 'FM27',
  currentSeason: 2026,
  dataAsOf: '2026-11-22',
  dataNote: 'Development data, ratings estimated',
  players,
  shortlist,
};
