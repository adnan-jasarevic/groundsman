import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { editedFields, positionsText } from '../domain/manual-edits';
import { Player, PositionCode } from '../domain/models';
import { ageAt } from '../domain/projection';
import { PlanStore, tierName } from '../state/plan-store';
import { Icon } from '../ui/icon';
import { Stars } from '../ui/stars';

type Group = 'gk' | 'def' | 'mid' | 'fwd';
type SortKey = 'name' | 'age' | 'ability' | 'contract';

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
  imports: [Icon, Stars],
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
        return { ...g, players };
      })
      .filter((s) => s.players.length);
  });

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

  protected positions(p: Player): string {
    return positionsText(p.positions);
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
