import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FORMATIONS } from '../domain/formations';
import { FormationSlot, Player, POSITION_LABEL, PositionCode } from '../domain/models';
import { Flag, shortName } from '../domain/projection';
import { MAX_TIERS, MIN_TIERS, PlanStore, tierName } from '../state/plan-store';
import { Icon, IconName } from '../ui/icon';
import { Stars } from '../ui/stars';
import { PlayerChip } from './player-chip';
import { PlayerDetail } from './player-detail';

const BENCH = 'bench';
const SHORTLIST = 'shortlist';

@Component({
  selector: 'app-depth-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, PlayerChip, PlayerDetail, Stars, Icon],
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

  /** Bumped on every season change so the mow sweep replays; 0 means never run. */
  protected readonly mowKey = signal(0);

  /** Slots in reading order: attack to goal, left to right. Used by the phone list. */
  protected readonly orderedSlots = computed(() =>
    [...this.store.formation().slots].sort((a, b) => a.y - b.y || a.x - b.x),
  );

  /** Each formation row gets ~18.5% of the pitch; keep the deepest stack inside it. */
  protected readonly pitchMin = computed(() => Math.round((22 + this.store.tiers() * 32 + 8) / 0.185));

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

  protected bestPositions(p: Player): string {
    return (Object.entries(p.positions) as [PositionCode, number][])
      .filter(([, f]) => f >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([c]) => POSITION_LABEL[c])
      .join(', ');
  }

  protected contractYear(p: Player): string {
    return p.contractExpires ? `'${p.contractExpires.slice(2, 4)}` : '';
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
