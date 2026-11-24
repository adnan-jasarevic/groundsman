import {
  computed,
  effect,
  inject,
  Injectable,
  InjectionToken,
  isDevMode,
  signal,
} from '@angular/core';
import { DEV_SAVE } from '../data/dev-save';
import { formationById, FORMATIONS } from '../domain/formations';
import { DepthPlan, Player, POSITION_LABEL, SaveFile, seasonLabel } from '../domain/models';
import {
  autoAssign,
  ContractState,
  contractState,
  seasonFlags,
  shortName,
} from '../domain/projection';

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

const SAVE_KEY = 'groundsman.save';

/** The imported squad, kept in this browser. */
export function loadSave(): SaveFile | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as SaveFile) : null;
  } catch {
    return null;
  }
}

function persistSave(save: SaveFile): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

/**
 * The save the planner opens: the one saved in this browser, else the
 * development squad in development builds, else none. Specs provide their own.
 */
export const SAVE = new InjectionToken<SaveFile | null>('SAVE', {
  providedIn: 'root',
  factory: () => loadSave() ?? (isDevMode() ? DEV_SAVE : null),
});

/** Stand-in while there's no squad, so the planner's views stay empty rather than missing. */
const NO_SAVE: SaveFile = {
  id: 'none',
  club: '',
  shortCode: '',
  game: 'FM27',
  seasonStyle: 'split',
  currentSeason: new Date().getFullYear(),
  dataAsOf: '',
  dataNote: '',
  players: [],
  shortlist: [],
};

@Injectable({ providedIn: 'root' })
export class PlanStore {
  private readonly initial = inject(SAVE);
  readonly save = signal<SaveFile>(this.initial ?? NO_SAVE);
  /** False until a squad is imported (or a sample squad is loaded). */
  readonly hasSave = signal(this.initial !== null);
  readonly baseSeason = computed(() => this.save().currentSeason);
  readonly seasonStyle = computed(() => this.save().seasonStyle);
  readonly seasons = computed(() =>
    Array.from({ length: SEASONS_AHEAD + 1 }, (_, i) => this.baseSeason() + i),
  );
  readonly season = signal(this.save().currentSeason);

  private readonly stored = load(this.save().id);
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
    seasonFlags(
      this.formation(),
      this.plan(),
      this.byId(),
      this.baseSeason(),
      this.season(),
      this.seasonStyle(),
    ),
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
      if (!this.hasSave()) return;
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
          if (list[i] !== playerId && p && contractState(p, season, this.seasonStyle()) === 'left') {
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

  /**
   * Replaces the squad with an import. Players who left come off every plan;
   * everyone else keeps their places. Returns false if the browser refused to store it.
   */
  applyImport(save: SaveFile, leavingIds: string[]): boolean {
    const stored = persistSave(save);
    const leaving = new Set(leavingIds);
    const plans = save.id === this.save().id ? this.plans() : (load(save.id)?.plans ?? {});
    const cleaned: Record<string, DepthPlan> = {};
    for (const [id, plan] of Object.entries(plans)) {
      const slots: Record<string, string[]> = {};
      for (const [slot, ids] of Object.entries(plan.slots)) slots[slot] = ids.filter((pid) => !leaving.has(pid));
      cleaned[id] = { ...plan, slots };
    }
    this.save.set(save);
    this.hasSave.set(true);
    this.plans.set(cleaned);
    this.season.set(save.currentSeason);
    this.selectedId.set(null);
    const n = `${save.players.length} ${save.players.length === 1 ? 'player' : 'players'}`;
    this.say(
      stored
        ? `Imported ${n} from FM`
        : `Imported ${n}. This browser wouldn't store them, so they're gone when you close the tab`,
    );
    return stored;
  }

  isLeft(player: Player): boolean {
    return this.contractOf(player) === 'left';
  }

  /** Contract state in the selected season. */
  contractOf(player: Player): ContractState {
    return contractState(player, this.season(), this.seasonStyle());
  }

  /** "2026/27" or "2048", depending on the save's league. */
  seasonText(season: number): string {
    return seasonLabel(season, this.seasonStyle());
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
