import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { editedFields, positionsText } from '../domain/manual-edits';
import { POSITION_LABEL, Player, PositionCode } from '../domain/models';
import { ageAt, ContractState, contractState, isAgeing } from '../domain/projection';
import { PlanStore, tierName } from '../state/plan-store';
import { Icon } from '../ui/icon';
import { AbilityBar, potentialText, rating } from '../ui/figures';

type Group = 'gk' | 'def' | 'mid' | 'fwd';
type SortKey = 'name' | 'age' | 'ability' | 'potential' | 'contract';

const GROUPS: { id: Group; label: string; short: string }[] = [
  { id: 'gk', label: 'Goalkeepers', short: 'GK' },
  { id: 'def', label: 'Defenders', short: 'Defenders' },
  { id: 'mid', label: 'Midfielders', short: 'Midfielders' },
  { id: 'fwd', label: 'Forwards', short: 'Forwards' },
];

const GROUP_OF: Record<PositionCode, Group> = {
  GK: 'gk',
  DR: 'def',
  DC: 'def',
  DL: 'def',
  WBR: 'def',
  WBL: 'def',
  DM: 'mid',
  MR: 'mid',
  MC: 'mid',
  ML: 'mid',
  AMC: 'mid',
  AMR: 'fwd',
  AML: 'fwd',
  ST: 'fwd',
};

/** FM's order down the pitch, used to place a player by their best position. */
const POSITION_ORDER: PositionCode[] = [
  'GK',
  'DR',
  'DC',
  'DL',
  'WBR',
  'WBL',
  'DM',
  'MR',
  'MC',
  'ML',
  'AMR',
  'AMC',
  'AML',
  'ST',
];

function bestPosition(p: Player): PositionCode {
  const entries = Object.entries(p.positions) as [PositionCode, number][];
  entries.sort(
    (a, b) => b[1] - a[1] || POSITION_ORDER.indexOf(a[0]) - POSITION_ORDER.indexOf(b[0]),
  );
  return entries[0]?.[0] ?? 'ST';
}

/** Folds accents so "sesko" finds "Šeško". */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

@Component({
  selector: 'app-squad-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, AbilityBar],
  templateUrl: './squad-page.html',
  host: { class: 'page' },
})
export class SquadPage {
  protected readonly store = inject(PlanStore);
  protected readonly groups = GROUPS;

  protected readonly query = signal('');
  protected readonly group = signal<Group | 'all'>('all');
  protected readonly sort = signal<{ key: SortKey; dir: 1 | -1 } | null>(null);

  private readonly grouped = computed(() => {
    const map = new Map<Group, Player[]>(GROUPS.map((g) => [g.id, []]));
    for (const p of this.store.save().players) map.get(GROUP_OF[bestPosition(p)])!.push(p);
    return map;
  });

  protected readonly counts = computed(() => {
    const counts: Record<string, number> = { all: this.store.save().players.length };
    for (const [g, list] of this.grouped()) counts[g] = list.length;
    return counts;
  });

  protected readonly sections = computed(() => {
    const q = fold(this.query().trim());
    const sort = this.sort();
    return GROUPS.filter((g) => this.group() === 'all' || this.group() === g.id)
      .map((g) => {
        const players = this.grouped()
          .get(g.id)!
          .filter((p) => !q || fold(`${p.name} ${p.known ?? ''} ${p.nationality}`).includes(q));
        players.sort(
          (a, b) => (sort ? sort.dir * this.compare(a, b, sort.key) : 0) || this.byPlace(a, b),
        );
        return { ...g, players, tally: this.tally(players) };
      })
      .filter((s) => s.players.length);
  });

  /** Players still under contract in the selected season. */
  private readonly active = computed(() =>
    this.store.save().players.filter((p) => this.store.contractOf(p) !== 'left'),
  );

  /** The line above the table: size, age and what runs out soon. */
  protected readonly summary = computed(() => {
    const players = this.active();
    return {
      players: players.length,
      ...this.tally(players),
      ageing: players.filter((p) => isAgeing(this.age(p))).length,
    };
  });

  protected readonly rating = rating;
  protected readonly potentialText = potentialText;
  protected readonly isAgeing = isAgeing;

  protected readonly shown = computed(() =>
    this.sections().reduce((n, s) => n + s.players.length, 0),
  );

  protected setSort(key: SortKey): void {
    const now = this.sort();
    // Names start A to Z; numbers start with the highest.
    const first = key === 'name' ? 1 : -1;
    if (now?.key !== key) this.sort.set({ key, dir: first });
    else if (now.dir === first) this.sort.set({ key, dir: -first as 1 | -1 });
    else this.sort.set(null);
  }

  protected ariaSort(key: SortKey): string | null {
    const s = this.sort();
    if (s?.key !== key) return null;
    return s.dir === 1 ? 'ascending' : 'descending';
  }

  protected best(p: Player): string {
    return POSITION_LABEL[bestPosition(p)];
  }

  /** The player's other positions, strongest first. */
  protected others(p: Player): string {
    const best = bestPosition(p);
    const rest = { ...p.positions };
    delete rest[best];
    return positionsText(rest);
  }

  /** Average age and expiring contracts for a group of players. */
  private tally(players: Player[]): { avgAge: string; expiring: number; nextYear: number } {
    const here = players.filter((p) => this.store.contractOf(p) !== 'left');
    const ages = here.map((p) => this.age(p));
    return {
      avgAge: ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : '–',
      expiring: here.filter((p) => this.store.contractOf(p) === 'critical').length,
      nextYear: here.filter((p) => this.store.contractOf(p) === 'warning').length,
    };
  }

  /** Short season names for the contract runway: "26/27" or "2048". */
  protected shortSeason(season: number): string {
    const text = this.store.seasonText(season);
    return text.length > 4 ? text.slice(2) : text;
  }

  /**
   * One cell per planned season: under contract, gone, or the final season.
   * The final season takes the contract colour as seen from the selected season.
   */
  protected runway(p: Player): { season: number; state: 'on' | 'gone' | ContractState }[] {
    const now = this.store.contractOf(p);
    return this.store.seasons().map((season) => {
      const state = contractState(p, season, this.store.seasonStyle());
      if (state === 'left') return { season, state: 'gone' };
      if (state === 'critical' && (now === 'critical' || now === 'warning')) {
        return { season, state: now };
      }
      return { season, state: 'on' };
    });
  }

  protected runwayLabel(p: Player): string {
    if (!p.contractExpires) return 'No contract date';
    const left = this.runway(p).filter((c) => c.state !== 'gone').length;
    return `Under contract for ${left} of the ${this.store.seasons().length} planned seasons`;
  }

  protected age(p: Player): number {
    return ageAt(p, this.store.baseSeason(), this.store.season());
  }

  protected contractYear(p: Player): string {
    if (!p.contractExpires) return '–';
    return this.store.contractOf(p) === 'left' ? 'Left' : p.contractExpires.slice(0, 4);
  }

  protected edited(p: Player): boolean {
    return editedFields(p).length > 0;
  }

  /** "D (C) left, backup", plus a count of other places. */
  protected place(p: Player): string {
    const places = this.store.slotsOf(p.id);
    if (!places.length) return '';
    const first = `${this.store.slotLabel(places[0].slotId)}, ${tierName(places[0].tier)}`;
    return places.length > 1 ? `${first} +${places.length - 1}` : first;
  }

  protected setSeason(season: number): void {
    this.store.setSeason(season);
  }

  private compare(a: Player, b: Player, key: SortKey): number {
    switch (key) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'age':
        return a.age - b.age;
      case 'ability':
        return a.ability - b.ability || a.potential - b.potential;
      case 'potential':
        return (
          Math.max(a.potential, a.potentialMax ?? 0) - Math.max(b.potential, b.potentialMax ?? 0) ||
          a.ability - b.ability
        );
      case 'contract':
        return (a.contractExpires ?? '9999').localeCompare(b.contractExpires ?? '9999');
    }
  }

  /** Default order: down the pitch by best position, then strongest first. */
  private byPlace(a: Player, b: Player): number {
    return (
      POSITION_ORDER.indexOf(bestPosition(a)) - POSITION_ORDER.indexOf(bestPosition(b)) ||
      b.ability - a.ability ||
      a.name.localeCompare(b.name)
    );
  }
}
