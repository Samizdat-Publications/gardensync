// Reading sizes the gardener types into the planner's fields, in their own units. Display goes
// through src/domain/units.ts; the unit words shown here are taken from its output so the two
// never disagree. (Volume parsing could move into units.ts beside parseLength and parseWeight.)
import { formatVolume, parseLength, parseWeight, type Units } from '../../domain/units';

const L_PER_GAL = 3.785411784;

/** The volume unit the gardener sees: whatever formatVolume writes after the number. */
export function volumeUnit(units: Units): string {
  return /[^\d.\s]+$/.exec(formatVolume(1, units))?.[0] ?? '';
}

/** A soil volume in the gardener's unit, in litres. */
export function toLitres(n: number, units: Units): number {
  return units === 'imperial' ? n * L_PER_GAL : n;
}

/** Litres in the gardener's unit, rounded to one decimal for a number field. */
export function fromLitres(l: number, units: Units): number {
  const v = units === 'imperial' ? l / L_PER_GAL : l;
  return Math.round(v * 10) / 10;
}

/** A length typed as "18 in", "1 ft 6 in", "45 cm" or a bare number in inches or cm. */
export function readLength(text: string, units: Units): number | null {
  return parseLength(text, units === 'imperial' ? 'in' : 'cm');
}

/** A weight typed as "2 lb 4 oz", "600 g" or a bare number in ounces or grams. */
export function readWeight(text: string, units: Units): number | null {
  return parseWeight(text, units === 'imperial' ? 'oz' : 'g');
}

/** "First letter up, full stop at the end": reason sentences from the schedule start lower case. */
export function sentence(text: string): string {
  const t = text.trim();
  if (!t) return t;
  const s = t[0]!.toUpperCase() + t.slice(1);
  return /[.!?]$/.test(s) ? s : `${s}.`;
}
