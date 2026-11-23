import { FICTIONAL_SAVE } from '../../testing/fictional-save';
import { formationById } from './formations';
import { Player } from './models';
import { ageAt, autoAssign, contractState, isAgeing, seasonFlags } from './projection';

const player = (over: Partial<Player> = {}): Player => ({
  id: 'x',
  name: 'Test Player',
  age: 25,
  nationality: 'ENG',
  positions: { DC: 4 },
  ability: 3,
  potential: 3,
  contractEnd: 2030,
  ...over,
});

describe('contract state', () => {
  it('is yellow (warning) with 2 years left', () => {
    expect(contractState(player({ contractEnd: 2028 }), 2026)).toBe('warning');
  });

  it('is red (critical) with 1 year or less left', () => {
    expect(contractState(player({ contractEnd: 2027 }), 2026)).toBe('critical');
  });

  it('is fine with 3 or more years left', () => {
    expect(contractState(player({ contractEnd: 2029 }), 2026)).toBe('ok');
  });

  it('marks the player as gone once the contract has run out', () => {
    expect(contractState(player({ contractEnd: 2027 }), 2027)).toBe('left');
  });

  it('ignores shortlist targets', () => {
    expect(contractState(player({ contractEnd: undefined, target: true }), 2026)).toBe('ok');
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
    const kinds = seasonFlags(formation, plan, byId, 2026, 2026).map((f) => f.kind);
    expect(kinds).toContain('ageing');
    expect(kinds).toContain('contract-critical');
  });

  it('flags missing cover once leavers are gone', () => {
    const flags = seasonFlags(formation, plan, byId, 2026, 2027);
    expect(flags.some((f) => f.kind === 'no-cover' || f.kind === 'empty')).toBe(true);
  });
});
