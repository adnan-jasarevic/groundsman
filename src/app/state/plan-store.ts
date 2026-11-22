import { computed, effect, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { DEV_SAVE } from '../data/dev-save';
import { formationById, FORMATIONS } from '../domain/formations';
import { DepthPlan, Player, POSITION_LABEL, SaveFile } from '../domain/models';
import { autoAssign, contractState, seasonFlags, shortName } from '../domain/projection';

export const MIN_TIERS = 2;
export const MAX_TIERS = 5;
export const DEFAULT_TIERS = 3;
export const SEASONS_AHEAD = 3;

interface StoredPlans {
  formationId: string;
  tiers: number;
  plans: Record<string, DepthPlan>;
}

/** Local-only storage: the plan lives in this browser. */
function load(saveId: string): StoredPlans | null {
  try {
    const raw = localStorage.getItem(`groundsman.plans.${saveId}`);
    return raw ? (JSON.parse(raw) as StoredPlans) : null;
  } catch {
    return null;
  }
}

function persist(saveId: string, value: StoredPlans): void {
  try {
    localStorage.setItem(`groundsman.plans.${saveId}`, JSON.stringify(value));
  } catch {
    // Storage blocked or full: the plan keeps working for this session.
  }
}

/** The save the planner opens. Defaults to the development squad; specs provide their own. */
export const SAVE = new InjectionToken<SaveFile>('SAVE', { providedIn: 'root', factory: () => DEV_SAVE });

@Injectable({ providedIn: 'root' })
export class PlanStore {
  private readonly initial = inject(SAVE);
  readonly save = signal<SaveFile>(this.initial);
  readonly baseSeason = computed(() => this.save().currentSeason);
  readonly seasons = computed(() =>
    Array.from({ length: SEASONS_AHEAD + 1 }, (_, i) => this.baseSeason() + i),
  );
  readonly season = signal(this.initial.currentSeason);

  private readonly stored = load(this.initial.id);
  readonly formationId = signal(this.stored?.formationId ?? FORMATIONS[0].id);
  readonly tiers = signal(this.stored?.tiers ?? DEFAULT_TIERS);
  private readonly plans = signal<Record<string, DepthPlan>>(this.stored?.plans ?? {});

  readonly selectedId = signal<string | null>(null);
  readonly dragging = signal(false);
  /** Polite announcement for screen readers and the inline notice line. */
  readonly notice = signal('');
  /** One-step undo offered next to the notice, cleared by the next action. */
  readonly undo = signal<(() => void) | null>(null);

  readonly formation = computed(() => formationById(this.formationId()));

  readonly byId = computed(() => {
    const map = new Map<string, Player>();
    for (const p of [...this.save().players, ...this.save().shortlist]) map.set(p.id, p);
    return map;
  });

  readonly plan = computed<DepthPlan>(() => {
    const existing = this.plans()[this.formationId()];
    if (existing) return existing;
    return autoAssign(this.formation(), this.save().players, this.tiers());
  });

  readonly placedIds = computed(() => new Set(Object.values(this.plan().slots).flat()));

  readonly bench = computed(() =>
    this.save()
      .players.filter((p) => !this.placedIds().has(p.id))
      .sort((a, b) => b.ability - a.ability || a.name.localeCompare(b.name)),
  );

  readonly shortlist = computed(() => this.save().shortlist);

  readonly flags = computed(() =>
    seasonFlags(this.formation(), this.plan(), this.byId(), this.baseSeason(), this.season()),
  );

  /** Slots with one or no active player, drawn as worn turf: slot id to 'no-cover' or 'empty'. */
  readonly wornSlots = computed(() => {
    const map = new Map<string, 'no-cover' | 'empty'>();
    for (const f of this.flags()) {
      if (f.kind === 'no-cover' || f.kind === 'empty') map.set(f.slotId!, f.kind);
    }
    return map;
  });

  readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? (this.byId().get(id) ?? null) : null;
  });

  constructor() {
    effect(() => {
      persist(this.save().id, {
        formationId: this.formationId(),
        tiers: this.tiers(),
        plans: this.plans(),
      });
    });
  }

  slotsOf(playerId: string): { slotId: string; tier: number }[] {
    const out: { slotId: string; tier: number }[] = [];
    for (const slot of this.formation().slots) {
      const tier = (this.plan().slots[slot.id] ?? []).indexOf(playerId);
      if (tier >= 0) out.push({ slotId: slot.id, tier });
    }
    return out;
  }

  slotLabel(slotId: string): string {
    const slot = this.formation().slots.find((s) => s.id === slotId);
    if (!slot) return slotId;
    const twins = this.formation().slots.filter((s) => s.position === slot.position);
    const base = POSITION_LABEL[slot.position];
    if (twins.length < 2) return base;
    return `${base} ${twins.indexOf(slot) === 0 ? 'left' : twins.length === 3 && twins.indexOf(slot) === 1 ? 'centre' : 'right'}`;
  }

  setSeason(season: number): void {
    this.season.set(season);
  }

  setFormation(id: string): void {
    this.formationId.set(id);
    this.say(`Formation changed to ${formationById(id).name}`);
  }

  setTiers(tiers: number): void {
    const next = Math.min(MAX_TIERS, Math.max(MIN_TIERS, tiers));
    this.tiers.set(next);
    let dropped = 0;
    this.update((slots) => {
      for (const id of Object.keys(slots)) {
        dropped += Math.max(0, slots[id].length - next);
        slots[id] = slots[id].slice(0, next);
      }
    }, next);
    this.say(
      dropped
        ? `Depth set to ${next} tiers, ${dropped} ${dropped === 1 ? 'player' : 'players'} moved to the bench`
        : `Depth set to ${next} tiers`,
    );
  }

  /** Move a player between slots or to and from the bench (slot id null). */
  move(playerId: string, from: string | null, to: string | null, index: number): void {
    const player = this.byId().get(playerId);
    if (!player) return;
    let pushed: string | undefined;
    this.update((slots) => {
      if (from) slots[from] = slots[from].filter((id) => id !== playerId);
      if (!to) return;
      const list = slots[to].filter((id) => id !== playerId);
      list.splice(Math.min(index, list.length), 0, playerId);
      if (list.length > this.tiers()) {
        // Push out someone who has already left before anyone still at the club.
        const season = this.season();
        let at = -1;
        for (let i = list.length - 1; i >= 0; i--) {
          const p = this.byId().get(list[i]);
          if (list[i] !== playerId && p && contractState(p, season) === 'left') {
            at = i;
            break;
          }
        }
        if (at < 0) at = list.length - 1;
        pushed = list.splice(at, 1)[0];
      }
      slots[to] = list;
    });
    const name = shortName(player);
    if (!to) {
      this.say(
        player.target ? `${name} taken off the plan` : `${name} moved to the bench`,
      );
      return;
    }
    const where = `${this.slotLabel(to)}, ${tierName(this.plan().slots[to].indexOf(playerId))}`;
    let text = `${name} placed at ${where}`;
    if (pushed && pushed !== playerId) {
      const out = this.byId().get(pushed)!;
      text += `. ${shortName(out)} ${this.placedIds().has(pushed) ? 'dropped out of that position' : out.target ? 'taken off the plan' : 'moved to the bench'}`;
    }
    this.say(text);
  }

  /** Add a player as extra cover in another slot, keeping their current places. */
  addCover(playerId: string, to: string): void {
    const list = this.plan().slots[to] ?? [];
    const player = this.byId().get(playerId);
    if (!player || list.includes(playerId)) return;
    if (list.length >= this.tiers()) {
      this.say(`${this.slotLabel(to)} is full. Raise the depth or move someone out first`);
      return;
    }
    this.update((slots) => {
      slots[to] = [...slots[to], playerId];
    });
    this.say(`${shortName(player)} also covers ${this.slotLabel(to)}`);
  }

  resetPlan(): void {
    const id = this.formationId();
    const previous = this.plans()[id];
    this.plans.update((plans) => {
      const next = { ...plans };
      delete next[id];
      return next;
    });
    this.say(
      'Plan rebuilt from the squad',
      previous
        ? () => {
            this.plans.update((plans) => ({ ...plans, [id]: previous }));
            this.say('Your previous plan is back');
          }
        : null,
    );
  }

  isLeft(player: Player): boolean {
    return contractState(player, this.season()) === 'left';
  }

  private say(text: string, undo: (() => void) | null = null): void {
    this.notice.set(text);
    this.undo.set(undo);
  }

  private update(mutate: (slots: Record<string, string[]>) => void, tiers = this.tiers()): void {
    const current = this.plan();
    const slots: Record<string, string[]> = {};
    for (const slot of this.formation().slots) slots[slot.id] = [...(current.slots[slot.id] ?? [])];
    mutate(slots);
    this.plans.update((plans) => ({
      ...plans,
      [this.formationId()]: { formationId: this.formationId(), tiers, slots },
    }));
  }
}

export function tierName(tier: number): string {
  return tier === 0 ? 'starter' : tier === 1 ? 'backup' : `${['3rd', '4th', '5th'][tier - 2] ?? `${tier + 1}th`} choice`;
}
