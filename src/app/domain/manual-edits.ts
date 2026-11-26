import {
  FmField,
  FmValues,
  formatDate,
  formatStars,
  Player,
  POSITION_LABEL,
  PositionCode,
} from './models';

/** In the order the edit form and the import preview list them. */
export const FM_FIELDS: FmField[] = [
  'name',
  'age',
  'nationality',
  'squadStatus',
  'ability',
  'potential',
  'contractExpires',
  'positions',
];

export const FIELD_LABEL: Record<FmField, string> = {
  name: 'Name',
  age: 'Age',
  nationality: 'Nation',
  squadStatus: 'Squad status',
  ability: 'Ability',
  potential: 'Potential',
  contractExpires: 'Contract ends',
  positions: 'Positions',
};

type FieldValue = FmValues[FmField];

/** A field's value on a player, in the form FmValues stores it. */
export function fieldValue(player: Player, field: FmField): FieldValue {
  switch (field) {
    case 'potential':
      return player.potentialMax !== undefined && player.potentialMax > player.potential
        ? { min: player.potential, max: player.potentialMax }
        : { min: player.potential };
    case 'contractExpires':
      return player.contractExpires ?? null;
    case 'squadStatus':
      return player.squadStatus?.trim() || null;
    case 'positions':
      return { ...player.positions };
    default:
      return player[field];
  }
}

/** Sets a field from a stored value, on a copy of the player. */
export function withValue(player: Player, field: FmField, value: FieldValue): Player {
  const next: Player = { ...player };
  switch (field) {
    case 'potential': {
      const p = value as NonNullable<FmValues['potential']>;
      next.potential = p.min;
      if (p.max !== undefined && p.max > p.min) next.potentialMax = p.max;
      else delete next.potentialMax;
      break;
    }
    case 'contractExpires':
    case 'squadStatus':
      if (value) next[field] = value as string;
      else delete next[field];
      break;
    case 'positions':
      next.positions = { ...(value as Player['positions']) };
      break;
    default:
      (next as unknown as Record<string, unknown>)[field] = value;
  }
  return next;
}

export function sameValue(field: FmField, a: FieldValue, b: FieldValue): boolean {
  if (field === 'positions') {
    const x = (a ?? {}) as Record<string, number>;
    const y = (b ?? {}) as Record<string, number>;
    const keys = new Set([...Object.keys(x), ...Object.keys(y)]);
    return [...keys].every((k) => x[k] === y[k]);
  }
  if (field === 'potential') {
    const x = a as FmValues['potential'];
    const y = b as FmValues['potential'];
    return x?.min === y?.min && (x?.max ?? x?.min) === (y?.max ?? y?.min);
  }
  return (a ?? null) === (b ?? null);
}

/** What FM says for a field: the recorded value when it was edited, else the player's own. */
export function fmValue(player: Player, field: FmField): FieldValue {
  return player.fm && field in player.fm ? player.fm[field] : fieldValue(player, field);
}

/** The name FM uses for the player, which re-imports match on. */
export function fmName(player: Player): string {
  return player.fm?.name ?? player.name;
}

export function editedFields(player: Player): FmField[] {
  return FM_FIELDS.filter((f) => player.fm && f in player.fm);
}

/**
 * The player after a hand edit, remembering FM's value for every field that
 * now differs from it. Changing a field back to FM's value forgets the edit.
 * Players added by hand have no FM values to remember.
 */
export function recordEdit(before: Player, after: Player): Player {
  const next: Player = { ...after };
  delete next.fm;
  if (before.added) return { ...next, added: true };
  const fm: FmValues = {};
  for (const field of FM_FIELDS) {
    const fmVal = fmValue(before, field);
    if (!sameValue(field, fieldValue(next, field), fmVal)) {
      (fm as Record<string, unknown>)[field] = fmVal;
    }
  }
  return Object.keys(fm).length ? { ...next, fm } : next;
}

/** A field value as people read it: "30 Jun 2029", "3.5 stars", "M (C), DM". */
export function formatValue(field: FmField, value: FieldValue): string {
  switch (field) {
    case 'contractExpires':
      return value ? formatDate(value as string) : 'No date';
    case 'squadStatus':
      return (value as string | null) ?? 'None';
    case 'ability':
      return `${formatStars(value as number)} stars`;
    case 'potential': {
      const p = value as NonNullable<FmValues['potential']>;
      return `${formatStars(p.min, p.max)} stars`;
    }
    case 'positions':
      return positionsText(value as Player['positions']);
    default:
      return String(value ?? '');
  }
}

/** Positions from most to least familiar: "D (C), D (R)". */
export function positionsText(positions: Player['positions']): string {
  return (Object.entries(positions) as [PositionCode, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([code]) => POSITION_LABEL[code])
    .join(', ');
}
