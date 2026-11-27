import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FORMATIONS } from '../domain/formations';
import { FormationSlot, Player, POSITION_LABEL, PositionCode } from '../domain/models';
import { ageAt, contractState, Flag, shortName } from '../domain/projection';
import { MAX_TIERS, MIN_TIERS, PlanStore, tierName } from '../state/plan-store';
import { Icon, IconName } from '../ui/icon';
import { potentialText, rating } from '../ui/figures';
import { PlayerChip } from './player-chip';
import { PlayerDetail } from './player-detail';

const BENCH = 'bench';
const SHORTLIST = 'shortlist';

@Component({
  selector: 'app-depth-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, PlayerChip, PlayerDetail, Icon],
  templateUrl: './depth-chart.html',
  host: { class: 'page' },
})
export class DepthChart {
  protected readonly store = inject(PlanStore);
  protected readonly formations = FORMATIONS;
  protected readonly tierChoices = Array.from({ length: MAX_TIERS - MIN_TIERS + 1 }, (_, i) => MIN_TIERS + i);
  protected readonly BENCH = BENCH;
  protected readonly SHORTLIST = SHORTLIST;
  protected readonly label = POSITION_LABEL;
  protected readonly short = shortName;
  protected readonly rating = rating;
  protected readonly potentialText = potentialText;

  /** Bumped on every season change so the mow sweep replays; 0 means never run. */
  protected readonly mowKey = signal(0);

  /** Slots in reading order: attack to goal, left to right. Used by the phone list. */
  protected readonly orderedSlots = computed(() =>
    [...this.store.formation().slots].sort((a, b) => a.y - b.y || a.x - b.x),
  );

  /** Each formation row gets ~18.5% of the pitch; keep the deepest card inside it. */
  protected readonly pitchMin = computed(() => Math.round((34 + this.store.tiers() * 28 + 10) / 0.185));

  /** Players under contract in each position, for every planned season. */
  protected readonly cover = computed(() => {
    const style = this.store.seasonStyle();
    return this.orderedSlots().map((slot) => {
      const players = this.players(slot);
      return {
        id: slot.id,
        label: POSITION_LABEL[slot.position],
        twin: this.twin(slot),
        counts: this.store
          .seasons()
          .map((season) => players.filter((p) => contractState(p, season, style) !== 'left').length),
      };
    });
  });

  /** "3 deep · 2 in 28/29": cover now and two seasons on (or the last planned season). */
  protected readonly depth = computed(() => {
    const seasons = this.store.seasons();
    const now = seasons.indexOf(this.store.season());
    const later = Math.min(now + 2, seasons.length - 1);
    const laterText = this.shortSeason(seasons[later]);
    return new Map(
      this.cover().map((row) => [row.id, { now: row.counts[now], later: row.counts[later], laterText }]),
    );
  });

  protected readonly placedTargets = computed(
    () => new Set(this.store.shortlist().filter((t) => this.store.placedIds().has(t.id)).map((t) => t.id)),
  );

  /** Critical and warning counts for the phone flags strip. */
  protected readonly flagCounts = computed(() => {
    const flags = this.store.flags();
    const critical = flags.filter((f) => f.severity === 'critical').length;
    return { critical, warning: flags.length - critical };
  });

  protected flagIcon(f: Flag): IconName {
    return f.kind === 'ageing' ? 'hourglass' : f.kind.startsWith('contract') ? 'clock' : 'alert';
  }

  protected players(slot: FormationSlot): Player[] {
    return (this.store.plan().slots[slot.id] ?? [])
      .map((id) => this.store.byId().get(id))
      .filter((p): p is Player => !!p);
  }

  protected empties(slot: FormationSlot): number[] {
    const used = (this.store.plan().slots[slot.id] ?? []).length;
    return Array.from({ length: Math.max(0, this.store.tiers() - used) }, (_, i) => used + i);
  }

  protected tierName = tierName;

  /** "left" / "right" / "centre" for twin positions, shown on the phone list. */
  protected twin(slot: FormationSlot): string {
    return this.store.slotLabel(slot.id).slice(POSITION_LABEL[slot.position].length).trim();
  }

  /** Accomplished or better; otherwise the one position they play best. */
  protected bestPositions(p: Player): string {
    const ranked = (Object.entries(p.positions) as [PositionCode, number][]).sort((a, b) => b[1] - a[1]);
    const good = ranked.filter(([, f]) => f >= 3);
    return (good.length ? good : ranked.slice(0, 1)).map(([c]) => POSITION_LABEL[c]).join(', ');
  }

  protected contractYear(p: Player): string {
    if (!p.contractExpires) return '';
    return this.store.contractOf(p) === 'left' ? 'Left' : p.contractExpires.slice(0, 4);
  }

  protected ageOf(p: Player): number {
    return ageAt(p, this.store.baseSeason(), this.store.season());
  }

  /** Short season names for the cover table: "26/27" or "2048". */
  protected shortSeason(season: number): string {
    const text = this.store.seasonText(season);
    return text.length > 4 ? text.slice(2) : text;
  }

  protected contractStateOf(p: Player): string {
    return this.store.contractOf(p);
  }

  protected setSeason(season: number): void {
    if (season === this.store.season()) return;
    this.store.setSeason(season);
    this.mowKey.update((k) => k + 1);
  }

  protected onSelect(event: Event, kind: 'formation' | 'tiers'): void {
    const value = (event.target as HTMLSelectElement).value;
    if (kind === 'formation') this.store.setFormation(value);
    else this.store.setTiers(Number(value));
  }

  protected acceptTargetsOnly = (drag: CdkDrag<string>) => !!this.store.byId().get(drag.data)?.target;
  protected acceptSquadOnly = (drag: CdkDrag<string>) => !this.store.byId().get(drag.data)?.target;

  protected drop(event: CdkDragDrop<string, string, string>): void {
    const id = event.item.data;
    const from = event.previousContainer.data;
    const to = event.container.data;
    const source = from === BENCH || from === SHORTLIST ? null : from;
    if (to === BENCH || to === SHORTLIST) {
      if (source) this.store.move(id, source, null, 0);
      return;
    }
    if (source === to && event.previousIndex === event.currentIndex) return;
    this.store.move(id, source, to, event.currentIndex);
  }
}
