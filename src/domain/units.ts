// Units: formatting and parsing measurements for the gardener's chosen system.
//
// Everything in the domain is metric: temperatures in degrees C, lengths in cm, areas in square cm,
// weights in grams, volumes in litres. Units are a display concern, so this module is the only place
// that knows about feet, ounces or gallons. Nothing here reads the locale: number formatting is
// plain (a dot for decimals, no thousands separators), so output is identical everywhere and safe
// to compare in tests.
//
// Two precisions for lengths:
// - 'exact' (the default) is for measurements the gardener reads off the plan or types in: imperial
//   inches to the nearest 1/4 below 2 ft, else feet and whole inches; metric mm below 1 cm, cm to
//   0.1 below 1 m, else m to 0.01.
// - 'prose' is for numbers inside sentences (plant notes), where a researched "0.6 cm deep" should
//   read as "1/4 in deep" rather than "0.236 in": the step grows with the size (1/8 in for the
//   tiniest seed depths, then 1/4, 1/2, whole inches, then feet to the nearest 6 in).

import { cToF } from './climate/zone';

export type Units = 'imperial' | 'metric';

const CM_PER_IN = 2.54;
const IN_PER_FT = 12;
const G_PER_OZ = 28.349523125;
const OZ_PER_LB = 16;
const L_PER_GAL = 3.785411784; // US liquid gallon
const CM2_PER_FT2 = 929.0304;

/** Round to a given number of decimals and drop trailing zeros: 1.50 -> "1.5", 2.00 -> "2". */
function trimmed(x: number, decimals: number): string {
  const f = 10 ** decimals;
  const r = Math.round(x * f) / f;
  // Avoid "-0" for tiny negative values that round to zero.
  return String(r === 0 ? 0 : r);
}

/** Round to the nearest multiple of step. */
function roundTo(x: number, step: number): number {
  return Math.round(x / step) * step;
}

// ---------------------------------------------------------------------------------------------
// Temperature

/** "70°F" or "21°C", to the whole degree. */
export function formatTemp(c: number, units: Units): string {
  return units === 'imperial' ? `${trimmed(cToF(c), 0)}°F` : `${trimmed(c, 0)}°C`;
}

// ---------------------------------------------------------------------------------------------
// Length

export interface LengthOptions {
  precision?: 'exact' | 'prose';
}

/** Whole inches plus a fraction in eighths, as "1 1/2" or "3/4" or "6". Input is already rounded. */
function inchesText(inches: number): string {
  const eighths = Math.round(inches * 8);
  const whole = Math.floor(eighths / 8);
  let num = eighths % 8;
  let den = 8;
  while (num !== 0 && num % 2 === 0) {
    num /= 2;
    den /= 2;
  }
  if (num === 0) return String(whole);
  return whole === 0 ? `${num}/${den}` : `${whole} ${num}/${den}`;
}

/** Feet and inches from a whole number of inches: "3 ft", "2 ft 6 in". */
function feetText(totalInches: number): string {
  const ft = Math.floor(totalInches / IN_PER_FT);
  const inch = totalInches - ft * IN_PER_FT;
  return inch === 0 ? `${ft} ft` : `${ft} ft ${inch} in`;
}

function formatImperialLength(cm: number, precision: 'exact' | 'prose'): string {
  const inches = cm / CM_PER_IN;
  if (precision === 'prose') {
    if (inches <= 0) return '0 in';
    if (inches < 3 / 16) return '1/8 in';
    let r: number;
    if (inches < 1) r = roundTo(inches, 0.25);
    else if (inches < 6) r = roundTo(inches, 0.5);
    else r = Math.round(inches);
    if (r < 24) return `${inchesText(r)} in`;
    // Two feet and over: to the nearest half foot.
    return feetText(roundTo(inches, 6));
  }
  if (inches < 24) {
    let r = roundTo(inches, 0.25);
    // A real but tiny length should not read as nothing.
    if (r === 0 && inches > 0) r = 0.25;
    if (r < 24) return `${inchesText(r)} in`;
  }
  return feetText(Math.round(inches));
}

function formatMetricLength(cm: number, precision: 'exact' | 'prose'): string {
  if (cm <= 0) return '0 cm';
  const mm = Math.round(cm * 10);
  if (mm < 10) return `${Math.max(1, mm)} mm`;
  const c = Math.round(cm * 10) / 10;
  if (c < 100) return `${trimmed(c, 1)} cm`;
  return `${trimmed(cm / 100, precision === 'prose' ? 1 : 2)} m`;
}

/** A length given in cm, for display. Negative lengths keep their sign. */
export function formatLength(cm: number, units: Units, opts: LengthOptions = {}): string {
  const precision = opts.precision ?? 'exact';
  if (cm < 0) return `-${formatLength(-cm, units, opts)}`;
  return units === 'imperial' ? formatImperialLength(cm, precision) : formatMetricLength(cm, precision);
}

// ---------------------------------------------------------------------------------------------
// Area

/** An area given in square cm: "32 sq ft" or "2.97 m²". Below 1 sq ft or 1 m², the smaller unit. */
export function formatArea(cm2: number, units: Units): string {
  if (units === 'imperial') {
    const ft2 = cm2 / CM2_PER_FT2;
    if (ft2 < 1) return `${trimmed(cm2 / (CM_PER_IN * CM_PER_IN), 0)} sq in`;
    return `${trimmed(ft2, ft2 < 10 ? 1 : 0)} sq ft`;
  }
  const m2 = cm2 / 10_000;
  if (m2 < 1) return `${trimmed(cm2, 0)} cm²`;
  return `${trimmed(m2, m2 < 10 ? 2 : 1)} m²`;
}

// ---------------------------------------------------------------------------------------------
// Weight

/**
 * A weight given in grams. Imperial: whole ounces under a pound ("12 oz", or tenths below 1 oz),
 * else pounds and ounces ("2 lb 4 oz"). Metric: whole grams under 1 kg, else kg to 0.1 ("1.2 kg").
 */
export function formatWeight(grams: number, units: Units): string {
  if (grams < 0) return `-${formatWeight(-grams, units)}`;
  if (units === 'imperial') {
    const oz = grams / G_PER_OZ;
    if (oz < 0.95) return `${trimmed(oz, 1)} oz`;
    const totalOz = Math.round(oz);
    if (totalOz < OZ_PER_LB) return `${totalOz} oz`;
    const lb = Math.floor(totalOz / OZ_PER_LB);
    const rest = totalOz - lb * OZ_PER_LB;
    return rest === 0 ? `${lb} lb` : `${lb} lb ${rest} oz`;
  }
  const g = Math.round(grams);
  if (g < 1000) return `${g} g`;
  return `${trimmed(grams / 1000, 1)} kg`;
}

/**
 * A rough weight for estimates such as typical yield: "about 10 lb", "about 4.5 kg". Rounded to
 * what a gardener would say: ounces under a pound, half pounds under 10 lb, whole pounds above.
 */
export function formatWeightApprox(grams: number, units: Units): string {
  if (units === 'imperial') {
    const oz = grams / 28.349523125;
    if (oz < 16) return `${Math.max(1, Math.round(oz))} oz`;
    const lb = oz / 16;
    return lb < 10 ? `${trimmed(Math.round(lb * 2) / 2, 1)} lb` : `${Math.round(lb)} lb`;
  }
  if (grams < 1000) return `${Math.max(10, Math.round(grams / 10) * 10)} g`;
  return `${trimmed(Math.round(grams / 100) / 10, 1)} kg`;
}

// ---------------------------------------------------------------------------------------------
// Volume

/** A soil volume given in litres: "3 gal" (US gallons) or "11 L". Gallons are rounded to whole
 * numbers from 3 up (pots are sold that way) and to half gallons below. */
export function formatVolume(litres: number, units: Units): string {
  if (units === 'imperial') {
    const gal = litres / L_PER_GAL;
    return gal >= 3 ? `${Math.round(gal)} gal` : `${trimmed(Math.round(gal * 2) / 2 || 0.5, 1)} gal`;
  }
  return `${trimmed(litres, litres < 10 ? 1 : 0)} L`;
}

// ---------------------------------------------------------------------------------------------
// Parsing what the gardener types

const LENGTH_UNITS: Record<string, number> = {
  mm: 0.1,
  millimetre: 0.1,
  millimetres: 0.1,
  millimeter: 0.1,
  millimeters: 0.1,
  cm: 1,
  centimetre: 1,
  centimetres: 1,
  centimeter: 1,
  centimeters: 1,
  m: 100,
  metre: 100,
  metres: 100,
  meter: 100,
  meters: 100,
  in: CM_PER_IN,
  inch: CM_PER_IN,
  inches: CM_PER_IN,
  '"': CM_PER_IN,
  '″': CM_PER_IN,
  ft: CM_PER_IN * IN_PER_FT,
  foot: CM_PER_IN * IN_PER_FT,
  feet: CM_PER_IN * IN_PER_FT,
  "'": CM_PER_IN * IN_PER_FT,
  '′': CM_PER_IN * IN_PER_FT,
};

const WEIGHT_UNITS: Record<string, number> = {
  g: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kgs: 1000,
  kilo: 1000,
  kilos: 1000,
  kilogram: 1000,
  kilograms: 1000,
  oz: G_PER_OZ,
  ounce: G_PER_OZ,
  ounces: G_PER_OZ,
  lb: G_PER_OZ * OZ_PER_LB,
  lbs: G_PER_OZ * OZ_PER_LB,
  pound: G_PER_OZ * OZ_PER_LB,
  pounds: G_PER_OZ * OZ_PER_LB,
};

// A number: "1.5", ".5", "1,5" (comma decimals), "1/2", or a mixed fraction "1 1/2".
const NUMBER = String.raw`(\d+\s+\d+/\d+|\d+/\d+|\d*[.,]\d+|\d+)`;
const PART = new RegExp(String.raw`^\s*${NUMBER}\s*([a-zA-Z]+|['"′″])?\s*`);

function parseNumber(s: string): number | null {
  const mixed = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s);
  if (mixed) {
    const den = Number(mixed[3]);
    return den === 0 ? null : Number(mixed[1]) + Number(mixed[2]) / den;
  }
  const frac = /^(\d+)\/(\d+)$/.exec(s);
  if (frac) {
    const den = Number(frac[2]);
    return den === 0 ? null : Number(frac[1]) / den;
  }
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a sequence of number-unit parts and add them up, in the base unit of `table`. A bare number
 * (no unit) is allowed only as the whole input, and only when `bareUnit` says what it means.
 * Returns null for anything unreadable.
 */
function parseMeasure(text: string, table: Record<string, number>, bareUnit?: string): number | null {
  let rest = text.trim().replace(/\s*\+\s*/g, ' ');
  if (rest === '') return null;
  let total = 0;
  let parts = 0;
  while (rest !== '') {
    const m = PART.exec(rest);
    if (!m) return null;
    const n = parseNumber(m[1]!.trim());
    if (n === null) return null;
    const unit = m[2]?.toLowerCase();
    let factor: number | undefined;
    if (unit === undefined) {
      // "2 lb 4" is not accepted: a bare number must stand alone.
      if (parts > 0 || m[0].length !== rest.length || bareUnit === undefined) return null;
      factor = table[bareUnit];
    } else {
      factor = table[unit];
    }
    if (factor === undefined) return null;
    total += n * factor;
    parts += 1;
    rest = rest.slice(m[0].length);
  }
  return total;
}

export type LengthUnit = 'mm' | 'cm' | 'm' | 'in' | 'ft';
export type WeightUnit = 'g' | 'kg' | 'oz' | 'lb';

/**
 * A length typed by the gardener, in cm: "3 ft", "18 in", "45 cm", "1.5 m", "3 ft 6 in", "3' 6\"",
 * "1 1/2 in". A bare number is read in `bareUnit` if given, otherwise rejected. null if unreadable.
 */
export function parseLength(text: string, bareUnit?: LengthUnit): number | null {
  return parseMeasure(text, LENGTH_UNITS, bareUnit);
}

/**
 * A weight typed by the gardener, in grams: "2 lb 4 oz", "1.5 lb", "600 g", "1.2 kg", "8 oz".
 * A bare number is read in `bareUnit` if given, otherwise rejected. null if unreadable.
 */
export function parseWeight(text: string, bareUnit?: WeightUnit): number | null {
  return parseMeasure(text, WEIGHT_UNITS, bareUnit);
}

// ---------------------------------------------------------------------------------------------
// Measurement tokens in plant notes

const NOTE_TOKEN = /\{(c|cm):(-?\d+(?:\.\d+)?)\}/g;

/**
 * Format the measurement tokens in a plant note: {c:21} is a temperature in C, {cm:0.6} a length
 * in cm. Lengths use prose rounding ("1/4 in", "5 ft"). Anything else in braces is left as it is.
 */
export function renderNoteTokens(text: string, units: Units): string {
  return text.replace(NOTE_TOKEN, (_all, kind: string, num: string) =>
    kind === 'c' ? formatTemp(Number(num), units) : formatLength(Number(num), units, { precision: 'prose' }),
  );
}
