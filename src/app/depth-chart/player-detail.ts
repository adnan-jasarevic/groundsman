import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Familiarity, FAMILIARITY_LABEL, POSITION_LABEL, PositionCode, seasonLabel } from '../domain/models';
import { abilityAt, ageAt, contractState, isAgeing, potentialAt, yearsLeft } from '../domain/projection';
import { PlanStore, tierName } from '../state/plan-store';
import { FamiliarityMeter } from '../ui/familiarity';
import { Icon } from '../ui/icon';
import { Stars } from '../ui/stars';

@Component({
  selector: 'app-player-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Stars, FamiliarityMeter, Icon],
  template: `
    @if (store.selected(); as p) {
      <section class="detail" aria-labelledby="detail-name">
        <header class="detail-head">
          <div>
            <h2 id="detail-name">{{ p.name }}</h2>
            <p class="muted">{{ p.nationality }} · {{ p.target ? 'Shortlist target' : store.save().club }}</p>
          </div>
          <button type="button" class="icon-btn" (click)="store.selectedId.set(null)" aria-label="Close player details">
            <app-icon name="close" [size]="18" />
          </button>
        </header>

        <dl class="facts">
          <div>
            <dt>Age in {{ seasonText() }}</dt>
            <dd class="num">{{ age() }} @if (ageing()) { <span class="tag warn">Ageing</span> }</dd>
          </div>
          <div>
            <dt>Ability · potential</dt>
            <dd><app-stars [ability]="ability()" [potential]="potential()" [size]="13" />
              <span class="num muted">{{ ability() }} · {{ potential() }}</span></dd>
          </div>
          <div class="wide">
            <dt>Contract</dt>
            <dd>
              @if (p.target) {
                Not at the club. Contract would be agreed on signing.
              } @else {
                <span class="contract-line" [attr.data-state]="contract()">{{ contractText() }}</span>
              }
            </dd>
          </div>
        </dl>

        <h3>Positions</h3>
        <ul class="positions">
          @for (pos of positions(); track pos.code) {
            <li><span>{{ pos.label }}</span><app-familiarity [level]="pos.level" /><span class="muted">{{ pos.text }}</span></li>
          }
        </ul>

        <h3>In this plan</h3>
        @if (places().length) {
          <ul class="places">
            @for (pl of places(); track pl.slotId) {
              <li>
                <span>{{ store.slotLabel(pl.slotId) }}, {{ tierLower(pl.tier) }}</span>
                <button type="button" class="text-btn" (click)="store.move(p.id, pl.slotId, null, 0)">
                  {{ p.target ? 'Take off' : 'Bench' }}
                </button>
              </li>
            }
          </ul>
        } @else {
          <p class="muted">{{ p.target ? 'Not placed yet.' : 'On the bench.' }}</p>
        }

        <form class="move" (submit)="$event.preventDefault(); moveTo()">
          <h3>Move</h3>
          <div class="move-row">
            <label class="field">
              <span>Position</span>
              <select (change)="moveSlot.set(sel($event))">
                @for (s of store.formation().slots; track s.id) {
                  <option [value]="s.id" [selected]="s.id === moveSlot()">{{ store.slotLabel(s.id) }}</option>
                }
              </select>
            </label>
            <label class="field">
              <span>Tier</span>
              <select (change)="moveTier.set(+sel($event))">
                @for (t of tierOptions(); track t) { <option [value]="t" [selected]="t === moveTier()">{{ tier(t) }}</option> }
              </select>
            </label>
          </div>
          <div class="move-row">
            <button type="submit" class="btn primary"><app-icon name="arrow" />Move here</button>
            @if (!p.target) {
              <button type="button" class="btn" (click)="store.addCover(p.id, moveSlot())">Also cover</button>
            }
          </div>
        </form>
      </section>
    }
  `,
})
export class PlayerDetail {
  protected readonly store = inject(PlanStore);
  protected readonly moveSlot = signal('st');
  protected readonly moveTier = signal(0);

  constructor() {
    // Preselect the move target: the player's current place, else his best position.
    effect(() => {
      const p = this.store.selected();
      if (!p) return;
      const place = untracked(() => this.store.slotsOf(p.id))[0];
      const slots = untracked(() => this.store.formation().slots);
      const best = [...slots].sort(
        (a, b) => (p.positions[b.position] ?? 0) - (p.positions[a.position] ?? 0),
      )[0];
      this.moveSlot.set(place?.slotId ?? best.id);
      this.moveTier.set(place?.tier ?? 0);
    });
  }

  protected readonly seasonText = computed(() => seasonLabel(this.store.season()));
  protected readonly age = computed(() => {
    const p = this.store.selected();
    return p ? ageAt(p, this.store.baseSeason(), this.store.season()) : 0;
  });
  protected readonly ageing = computed(() => isAgeing(this.age()));
  protected readonly ability = computed(() => {
    const p = this.store.selected();
    return p ? abilityAt(p, this.store.baseSeason(), this.store.season()) : 0;
  });
  protected readonly potential = computed(() => {
    const p = this.store.selected();
    return p ? potentialAt(p, this.store.baseSeason(), this.store.season()) : 0;
  });
  protected readonly contract = computed(() => {
    const p = this.store.selected();
    return p ? contractState(p, this.store.season()) : 'ok';
  });
  protected readonly contractText = computed(() => {
    const p = this.store.selected();
    if (!p || p.contractEnd === undefined) return '';
    const left = yearsLeft(p.contractEnd, this.store.season());
    if (left <= 0) return `Ended 30 June ${p.contractEnd}. No longer at the club.`;
    return `Until 30 June ${p.contractEnd} · ${left === 1 ? 'ends this season' : `${left} years left`}`;
  });

  protected readonly positions = computed(() => {
    const p = this.store.selected();
    if (!p) return [];
    return (Object.entries(p.positions) as [PositionCode, Familiarity][])
      .sort((a, b) => b[1] - a[1])
      .map(([code, level]) => ({ code, level, label: POSITION_LABEL[code], text: FAMILIARITY_LABEL[level] }));
  });

  protected readonly places = computed(() => {
    const p = this.store.selected();
    this.store.plan();
    return p ? this.store.slotsOf(p.id) : [];
  });

  protected readonly tierOptions = computed(() => Array.from({ length: this.store.tiers() }, (_, i) => i));

  protected tierLower = tierName;

  protected tier(t: number): string {
    const name = tierName(t);
    return name[0].toUpperCase() + name.slice(1);
  }

  protected sel(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  protected moveTo(): void {
    const p = this.store.selected();
    if (!p) return;
    const from = this.places()[0]?.slotId ?? null;
    this.store.move(p.id, from, this.moveSlot(), this.moveTier());
  }
}
