import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Player, POSITION_LABEL } from '../domain/models';
import {
  ageAt,
  ContractState,
  contractState,
  isAgeing,
  seasonFlags,
  seasonsLeft,
  shortName,
} from '../domain/projection';
import { PlanStore } from '../state/plan-store';
import { Icon } from '../ui/icon';

/** One player as they stand in one season. */
interface Entry {
  player: Player;
  name: string;
  age: number;
  ageing: boolean;
  contract: ContractState;
}

interface Cell {
  season: number;
  players: Entry[];
  /** Players who were here last season and are gone in this one. */
  gone: string[];
  thin: 'empty' | 'no-cover' | null;
}

interface Row {
  id: string;
  label: string;
  twin: string;
  /** The current starter, shown under the position on phones. */
  starter: string;
  cells: Cell[];
}

const CONTRACT_TEXT: Partial<Record<ContractState, string>> = {
  critical: 'last season of contract',
  warning: '2 years left on contract',
};

@Component({
  selector: 'app-timeline-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon, NgTemplateOutlet, RouterLink],
  templateUrl: './timeline-page.html',
  host: { class: 'page' },
})
export class TimelinePage {
  protected readonly store = inject(PlanStore);

  /** The position opened on a phone to show its names. */
  protected readonly open = signal<string | null>(null);

  protected readonly seasons = computed(() =>
    this.store.seasons().map((season, i) => {
      const flags = seasonFlags(
        this.store.formation(),
        this.store.plan(),
        this.store.byId(),
        this.store.baseSeason(),
        season,
        this.store.seasonStyle(),
      );
      const critical = flags.filter((f) => f.severity === 'critical').length;
      return {
        season,
        label: this.store.seasonText(season),
        short: this.store.seasonText(season).slice(2),
        now: i === 0,
        critical,
        warning: flags.length - critical,
      };
    }),
  );

  /** Formation positions in reading order (attack to goal, left to right), like the depth chart. */
  protected readonly rows = computed<Row[]>(() =>
    [...this.store.formation().slots]
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((slot) => {
        const ids = this.store.plan().slots[slot.id] ?? [];
        const players = ids.map((id) => this.store.byId().get(id)).filter((p): p is Player => !!p);
        const label = POSITION_LABEL[slot.position];
        const cells = this.cells(players);
        return {
          id: slot.id,
          label,
          twin: this.store.slotLabel(slot.id).slice(label.length).trim(),
          starter: cells[0].players[0]?.name ?? '',
          cells: cells.map((c) => ({
            ...c,
            thin: c.players.length === 0 ? 'empty' : c.players.length === 1 ? 'no-cover' : null,
          })),
        };
      }),
  );

  /** Squad players with no place in this formation's plan, strongest first. */
  protected readonly unplaced = computed(() => this.cells(this.store.bench()));

  protected contractNote(state: ContractState): string | undefined {
    return CONTRACT_TEXT[state];
  }

  protected toggle(id: string): void {
    this.open.update((now) => (now === id ? null : id));
  }

  private cells(players: Player[]): Omit<Cell, 'thin'>[] {
    const style = this.store.seasonStyle();
    const base = this.store.baseSeason();
    return this.store.seasons().map((season) => ({
      season,
      players: players
        .filter((p) => contractState(p, season, style) !== 'left')
        .map((p) => {
          const age = ageAt(p, base, season);
          return {
            player: p,
            name: shortName(p),
            age,
            ageing: !p.target && isAgeing(age),
            contract: contractState(p, season, style),
          };
        }),
      gone:
        season === base
          ? []
          : players.filter((p) => seasonsLeft(p, season, style) === 0).map(shortName),
    }));
  }
}
