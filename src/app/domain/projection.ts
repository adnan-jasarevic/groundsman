import {
  DepthPlan,
  Formation,
  formatDate,
  Player,
  PositionCode,
  POSITION_LABEL,
  SeasonStyle,
} from './models';

export const AGEING_FROM = 33;

/**
 * Contract state in a season (its start year).
 * - left: the contract ran out in an earlier season
 * - critical: 1 year or less left (it runs out this season)
 * - warning: 2 years left
 */
export type ContractState = 'ok' | 'warning' | 'critical' | 'left';

/**
 * The last season a contract covers: the season its expiry date falls in.
 * Split seasons turn over at the end of July, so 30 June 2027 is the last day of 2026/27.
 */
export function lastSeason(expires: string, style: SeasonStyle): number {
  const [year, month] = expires.split('-').map(Number);
  return style === 'split' && month <= 7 ? year - 1 : year;
}

/** Seasons left on the contract, counting this one. Undefined without a contract. */
export function seasonsLeft(player: Player, season: number, style: SeasonStyle): number | undefined {
  if (player.contractExpires === undefined) return undefined;
  return lastSeason(player.contractExpires, style) - season + 1;
}

export function contractState(player: Player, season: number, style: SeasonStyle): ContractState {
  const left = seasonsLeft(player, season, style);
  if (left === undefined) return 'ok';
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
export function activeIds(
  ids: string[],
  byId: Map<string, Player>,
  season: number,
  style: SeasonStyle,
): string[] {
  return ids.filter((id) => {
    const p = byId.get(id);
    return p && contractState(p, season, style) !== 'left';
  });
}

export function seasonFlags(
  formation: Formation,
  plan: DepthPlan,
  byId: Map<string, Player>,
  baseSeason: number,
  season: number,
  style: SeasonStyle,
): Flag[] {
  const flags: Flag[] = [];
  const counted = new Set<string>();
  const endingDates = new Set<string>();
  let critical = 0;
  let warning = 0;

  for (const slot of formation.slots) {
    const ids = plan.slots[slot.id] ?? [];
    const active = activeIds(ids, byId, season, style);
    const label = POSITION_LABEL[slot.position];
    if (active.length === 0) {
      flags.push({ kind: 'empty', severity: 'critical', text: `${label} has nobody left to play there`, slotId: slot.id });
    } else if (active.length === 1) {
      const leaver = ids.map((id) => byId.get(id)).find((p) => p && contractState(p, season, style) === 'left');
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
      const player = byId.get(id)!;
      const state = contractState(player, season, style);
      if (state === 'critical') {
        critical++;
        endingDates.add(player.contractExpires!);
      }
      if (state === 'warning') warning++;
    }
  }

  if (critical) {
    const when = endingDates.size === 1 ? formatDate([...endingDates][0]) : 'this season';
    flags.push({
      kind: 'contract-critical',
      severity: 'critical',
      text: `${critical} ${critical === 1 ? 'contract ends' : 'contracts end'} ${when}`,
    });
  }
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
