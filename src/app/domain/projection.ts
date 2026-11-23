import { DepthPlan, Formation, Player, PositionCode, POSITION_LABEL } from './models';

export const AGEING_FROM = 33;

/**
 * Contract state at the start of a season (start year).
 * A contract ending 30 June of year Y runs out at the end of season (Y-1)/Y.
 * - left: the contract has already run out before this season starts
 * - critical: 1 year or less left (it ends at the end of this season)
 * - warning: 2 years left
 */
export type ContractState = 'ok' | 'warning' | 'critical' | 'left';

export function yearsLeft(contractEnd: number, season: number): number {
  return contractEnd - season;
}

export function contractState(player: Player, season: number): ContractState {
  if (player.contractEnd === undefined) return 'ok';
  const left = yearsLeft(player.contractEnd, season);
  if (left <= 0) return 'left';
  if (left <= 1) return 'critical';
  if (left === 2) return 'warning';
  return 'ok';
}

export function ageAt(player: Player, baseSeason: number, season: number): number {
  return player.age + (season - baseSeason);
}

export function isAgeing(age: number): boolean {
  return age >= AGEING_FROM;
}

export const GROWTH_UNTIL = 24;
export const DECLINE_FROM = 32;
export const STEADY_DECLINE_FROM = 34;
const MIN_ABILITY = 0.5;

/**
 * Projected ability, a planning estimate rather than a simulation:
 * - players under 24 grow half a star per season towards their potential
 * - from 24 to 31 they hold their level
 * - they lose half a star in the season they turn 32, hold at 33, and lose
 *   half a star every season from 34 on, never dropping below half a star
 */
export function abilityAt(player: Player, baseSeason: number, season: number): number {
  let ability = player.ability;
  for (let s = baseSeason; s < season; s++) {
    const age = ageAt(player, baseSeason, s);
    const next = age + 1;
    if (age < GROWTH_UNTIL) ability = Math.min(player.potential, ability + 0.5);
    else if (next === DECLINE_FROM || next >= STEADY_DECLINE_FROM) ability = Math.max(MIN_ABILITY, ability - 0.5);
  }
  return ability;
}

/** Projected potential: once a player has declined, his ceiling is his current level. */
export function potentialAt(player: Player, baseSeason: number, season: number): number {
  const ability = abilityAt(player, baseSeason, season);
  return ability < player.ability ? ability : player.potential;
}

export function familiarityFor(player: Player, position: PositionCode) {
  return player.positions[position] ?? 0;
}

/** Best-effort first plan for a formation: unique starters, then cover by familiarity and ability. */
export function autoAssign(formation: Formation, players: Player[], tiers: number): DepthPlan {
  const slots: Record<string, string[]> = {};
  const starters = new Set<string>();
  const coverUse = new Map<string, number>();
  const rank = (pos: PositionCode) => (a: Player, b: Player) =>
    familiarityFor(b, pos) - familiarityFor(a, pos) || b.ability - a.ability;

  for (const slot of formation.slots) {
    const pick = players
      .filter((p) => !starters.has(p.id) && familiarityFor(p, slot.position) >= 3)
      .sort(rank(slot.position))[0];
    slots[slot.id] = pick ? [pick.id] : [];
    if (pick) starters.add(pick.id);
  }

  for (let tier = 1; tier < tiers; tier++) {
    for (const slot of formation.slots) {
      const list = slots[slot.id];
      if (list.length !== tier) continue;
      const pick = players
        .filter(
          (p) =>
            !starters.has(p.id) &&
            !list.includes(p.id) &&
            familiarityFor(p, slot.position) >= 3 &&
            (coverUse.get(p.id) ?? 0) < 2,
        )
        .sort((a, b) => (coverUse.get(a.id) ?? 0) - (coverUse.get(b.id) ?? 0) || rank(slot.position)(a, b))[0];
      if (pick) {
        list.push(pick.id);
        coverUse.set(pick.id, (coverUse.get(pick.id) ?? 0) + 1);
      }
    }
  }

  return { formationId: formation.id, tiers, slots };
}

export type FlagKind = 'empty' | 'no-cover' | 'contract-critical' | 'contract-warning' | 'ageing';

export interface Flag {
  kind: FlagKind;
  severity: 'critical' | 'warning';
  text: string;
  slotId?: string;
}

/** Players who are still at the club in this season (left contracts and targets excluded). */
export function activeIds(ids: string[], byId: Map<string, Player>, season: number): string[] {
  return ids.filter((id) => {
    const p = byId.get(id);
    return p && contractState(p, season) !== 'left';
  });
}

export function seasonFlags(
  formation: Formation,
  plan: DepthPlan,
  byId: Map<string, Player>,
  baseSeason: number,
  season: number,
): Flag[] {
  const flags: Flag[] = [];
  const counted = new Set<string>();
  let critical = 0;
  let warning = 0;

  for (const slot of formation.slots) {
    const ids = plan.slots[slot.id] ?? [];
    const active = activeIds(ids, byId, season);
    const label = POSITION_LABEL[slot.position];
    if (active.length === 0) {
      flags.push({ kind: 'empty', severity: 'critical', text: `${label} has nobody left to play there`, slotId: slot.id });
    } else if (active.length === 1) {
      const leaver = ids.map((id) => byId.get(id)).find((p) => p && contractState(p, season) === 'left');
      flags.push({
        kind: 'no-cover',
        severity: 'critical',
        text: leaver ? `${label} has no backup after ${surname(leaver)} leaves` : `${label} has no backup`,
        slotId: slot.id,
      });
    }
    const starter = byId.get(active[0] ?? '');
    if (starter && !starter.target && isAgeing(ageAt(starter, baseSeason, season))) {
      flags.push({
        kind: 'ageing',
        severity: 'warning',
        text: `${label} starter ${surname(starter)} is ${ageAt(starter, baseSeason, season)}`,
        slotId: slot.id,
      });
    }
    for (const id of active) {
      if (counted.has(id)) continue;
      counted.add(id);
      const state = contractState(byId.get(id)!, season);
      if (state === 'critical') critical++;
      if (state === 'warning') warning++;
    }
  }

  const end = season + 1;
  if (critical)
    flags.push({
      kind: 'contract-critical',
      severity: 'critical',
      text: `${critical} ${critical === 1 ? 'contract ends' : 'contracts end'} June ${end}`,
    });
  if (warning)
    flags.push({
      kind: 'contract-warning',
      severity: 'warning',
      text: `${warning} ${warning === 1 ? 'contract has' : 'contracts have'} 2 years left`,
    });
  return flags;
}

export function surname(player: Player): string {
  if (player.known) return player.known;
  const parts = player.name.split(' ');
  return parts[parts.length - 1];
}

export function shortName(player: Player): string {
  if (player.known) return player.known;
  const parts = player.name.split(' ');
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : player.name;
}
