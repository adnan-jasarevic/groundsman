import { FICTIONAL_SAVE } from '../../testing/fictional-save';
import { formationById } from './formations';
import { formatDate, formatStars, Player, seasonLabel } from './models';
import {
  ageAt,
  autoAssign,
  contractState,
  isAgeing,
  lastSeason,
  seasonFlags,
  seasonsLeft,
  shortName,
  surname,
} from './projection';

const player = (over: Partial<Player> = {}): Player => ({
  id: 'x',
  name: 'Test Player',
  age: 25,
  nationality: 'ENG',
  positions: { DC: 4 },
  ability: 3,
  potential: 3,
  contractExpires: '2030-06-30',
  ...over,
});

describe('contract state, split seasons (2026/27)', () => {
  const until = (contractExpires: string) => player({ contractExpires });

  it('is yellow (warning) with 2 years left', () => {
    expect(contractState(until('2028-06-30'), 2026, 'split')).toBe('warning');
  });

  it('is red (critical) with 1 year or less left', () => {
    expect(contractState(until('2027-06-30'), 2026, 'split')).toBe('critical');
  });

  it('is fine with 3 or more years left', () => {
    expect(contractState(until('2029-06-30'), 2026, 'split')).toBe('ok');
  });

  it('counts a contract ending mid-season as ending in that season', () => {
    expect(lastSeason('2027-01-31', 'split')).toBe(2026);
    expect(lastSeason('2027-12-31', 'split')).toBe(2027);
    expect(seasonsLeft(until('2027-12-31'), 2026, 'split')).toBe(2);
  });

  it('marks the player as gone once the contract has run out', () => {
    expect(contractState(until('2027-06-30'), 2027, 'split')).toBe('left');
  });

  it('ignores shortlist targets', () => {
    expect(contractState(player({ contractExpires: undefined, target: true }), 2026, 'split')).toBe(
      'ok',
    );
  });
});

describe('contract state, calendar seasons (2048)', () => {
  const until = (contractExpires: string) => player({ contractExpires });

  it('ends a contract in the season of its expiry year', () => {
    expect(lastSeason('2048-11-30', 'calendar')).toBe(2048);
    expect(contractState(until('2048-11-30'), 2048, 'calendar')).toBe('critical');
    expect(contractState(until('2049-11-30'), 2048, 'calendar')).toBe('warning');
    expect(contractState(until('2050-11-30'), 2048, 'calendar')).toBe('ok');
    expect(contractState(until('2048-11-30'), 2049, 'calendar')).toBe('left');
  });
});

describe('labels', () => {
  it('names seasons by the league style', () => {
    expect(seasonLabel(2026, 'split')).toBe('2026/27');
    expect(seasonLabel(2099, 'split')).toBe('2099/00');
    expect(seasonLabel(2048, 'calendar')).toBe('2048');
  });

  it('writes dates and stars as FM shows them', () => {
    expect(formatDate('2048-11-30')).toBe('30 Nov 2048');
    expect(formatDate('2027-06-30', 'long')).toBe('30 June 2027');
    expect(formatStars(4)).toBe('4.0');
    expect(formatStars(2, 3)).toBe('2.0–3.0');
    expect(formatStars(3, 3)).toBe('3.0');
  });
});

describe('names', () => {
  const named = (name: string, known?: string) => player({ name, known });

  it('uses the last word as the surname', () => {
    expect(surname(named('Tom Ashworth'))).toBe('Ashworth');
    expect(shortName(named('Tom Ashworth'))).toBe('T. Ashworth');
  });

  it('keeps particles with the surname', () => {
    expect(surname(named('Marco De Luca'))).toBe('De Luca');
    expect(surname(named('Jan van der Berg'))).toBe('van der Berg');
    expect(surname(named('João dos Santos'))).toBe('dos Santos');
    expect(surname(named('Salem Al Dawsari'))).toBe('Al Dawsari');
    expect(shortName(named('Jan van der Berg'))).toBe('J. van der Berg');
  });

  it('drops middle names from the short name', () => {
    expect(surname(named('Gabriel Fernando de Jesus'))).toBe('de Jesus');
    expect(shortName(named('Gabriel Fernando de Jesus'))).toBe('G. de Jesus');
  });

  it('never takes the first name into the surname', () => {
    expect(surname(named('Van Persie'))).toBe('Persie');
  });

  it('handles single names and stray spaces', () => {
    expect(surname(named('Danilo'))).toBe('Danilo');
    expect(shortName(named('Danilo'))).toBe('Danilo');
    expect(surname(named(' Marco  De Luca '))).toBe('De Luca');
  });

  it('prefers the name fans use when one is set', () => {
    expect(surname(named('Amad Diallo', 'Amad'))).toBe('Amad');
    expect(shortName(named('Amad Diallo', 'Amad'))).toBe('Amad');
  });
});

describe('age', () => {
  it('counts 33 and older as ageing', () => {
    expect(isAgeing(32)).toBe(false);
    expect(isAgeing(33)).toBe(true);
  });

  it('moves with the selected season', () => {
    expect(ageAt(player({ age: 31 }), 2026, 2028)).toBe(33);
  });
});

describe('auto plan and flags', () => {
  const formation = formationById('4231w');
  const plan = autoAssign(formation, FICTIONAL_SAVE.players, 3);
  const byId = new Map(FICTIONAL_SAVE.players.map((p) => [p.id, p]));

  it('fills every slot with a unique starter', () => {
    const starters = formation.slots.map((s) => plan.slots[s.id][0]);
    expect(starters.every(Boolean)).toBe(true);
    expect(new Set(starters).size).toBe(starters.length);
  });

  it('flags the ageing starter and expiring contracts in the current season', () => {
    const kinds = seasonFlags(formation, plan, byId, 2026, 2026, 'split').map((f) => f.kind);
    expect(kinds).toContain('ageing');
    expect(kinds).toContain('contract-critical');
  });

  it('names the date when the expiring contracts share one', () => {
    const flags = seasonFlags(formation, plan, byId, 2026, 2026, 'split');
    expect(flags.find((f) => f.kind === 'contract-critical')!.text).toMatch(
      /^\d+ contracts? ends? 30 Jun 2027$/,
    );
  });

  it('flags missing cover once leavers are gone', () => {
    const flags = seasonFlags(formation, plan, byId, 2026, 2027, 'split');
    expect(flags.some((f) => f.kind === 'no-cover' || f.kind === 'empty')).toBe(true);
  });

  it('names a leaver only in the season they go', () => {
    const at = (season: number) =>
      seasonFlags(formation, plan, byId, 2026, season, 'split').find((f) => f.slotId === 'dcr')
        ?.text;
    expect(at(2027)).toBe('D (C) has no backup after Hallström leaves');
    expect(at(2028)).toBe('D (C) has no backup');
  });
});
