// What the schedule says about a plant, in the words of the library and the plant card: one timing
// line per library card ("Plant out from May 17", "Sow now until Jul 20"), whether it can go in
// now, and the rows of the card's "When" section. Every date comes from plantSchedule (ledger item
// 4); nothing here is typed in. Pure functions, no DOM.
import type { ClimateProfile } from '../../domain/climate/types';
import { inRange, toDay, yearOf, type DayNum, type DayRange, type IsoDate } from '../../domain/dates';
import type { Plant } from '../../domain/plants/schema';
import { formatTemp, type Units } from '../../domain/units';
import { defaultMethod } from '../planner/placement';
import {
  formatDay,
  formatRange,
  plantSchedule,
  reasonText,
  scheduleMode,
  seasonOf,
  type Method,
  type PlantSchedule,
  type Reason,
  type ScheduleWindow,
  type WindowKind,
} from '../../domain/schedule';

const VERB: Record<Method, string> = { transplant: 'Plant out', direct: 'Sow', plant: 'Plant' };

/** True when the climate gives the schedule enough to work with. */
export function hasSchedule(profile: ClimateProfile | null | undefined): profile is ClimateProfile {
  return !!profile && scheduleMode(profile) !== 'none';
}

/** The season holding today and the one after it: together they always hold the next window. */
function nearSchedules(plant: Plant, profile: ClimateProfile, t: DayNum): PlantSchedule[] {
  const s = seasonOf(profile, t);
  return [plantSchedule(plant, profile, s), plantSchedule(plant, profile, s + 1)];
}

// ---- Without a climate: frost offsets in plain words -------------------------------------------

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** "6 weeks before your last frost", "1 to 4 weeks after your last frost". */
export function weeksPhrase([a, b]: readonly [number, number], anchor = 'your last frost'): string {
  const side = (w: number) => (w < 0 ? 'before' : 'after');
  if (a === 0 && b === 0) return `around ${anchor}`;
  if (a === b) return `${plural(Math.abs(a), 'week')} ${side(a)} ${anchor}`;
  if (a < 0 && b <= 0) return b === 0 ? `up to ${plural(-a, 'week')} before ${anchor}` : `${-b} to ${plural(-a, 'week')} before ${anchor}`;
  if (a >= 0 && b > 0) return a === 0 ? `from ${anchor} to ${plural(b, 'week')} after` : `${a} to ${plural(b, 'week')} after ${anchor}`;
  return `${plural(-a, 'week')} before to ${plural(b, 'week')} after ${anchor}`;
}

/** The library line when there is no climate yet: the guide's own offset from the last frost. */
export function offsetLine(plant: Plant): string {
  const m = plant.methods;
  if (m.direct) return `Sow ${weeksPhrase(m.direct.weeks)}`;
  if (m.transplant) return `Plant out ${weeksPhrase(m.transplant.weeks)}`;
  if (m.plant) return `Plant ${weeksPhrase(m.plant.weeks)}`;
  return 'Check the seed packet';
}

// ---- The library line ---------------------------------------------------------------------------

/**
 * One line of timing for a library card, for this garden's climate and today:
 * "Sow now until Jul 20", "Start indoors now, plant out from May 17", "Plant out from May 17",
 * "Not suited to this climate". Without a climate, the frost offset in words.
 */
export function timingLine(plant: Plant, profile: ClimateProfile | null | undefined, today: IsoDate): string {
  if (!hasSchedule(profile)) return offsetLine(plant);
  const t = toDay(today);
  const scheds = nearSchedules(plant, profile, t);
  const windows = scheds.flatMap((s) => s.windows);
  if (windows.length === 0) {
    return scheds.some((s) => s.notViable.some((n) => n.reason.code === 'schedule-error'))
      ? 'Dates could not be worked out'
      : 'Not suited to this climate';
  }
  // When two ways open on the same day, name the one the planner uses by default, so the library
  // and the garden's plant list say the same thing ("Sow from Mar 26", not "Plant out" in one place).
  const usual = defaultMethod(plant);
  windows.sort((a, b) => a.bedIn.start - b.bedIn.start || Number(a.method !== usual) - Number(b.method !== usual));
  const now = windows.find((w) => inRange(w.bedIn, t));
  if (now) return `${VERB[now.method]} now until ${formatDay(now.bedIn.end)}`;
  const indoorNow = windows.find((w) => w.indoor && inRange(w.indoor, t));
  if (indoorNow) return `Start indoors now, plant out from ${formatDay(indoorNow.bedIn.start)}`;
  const next = windows.find((w) => w.bedIn.start > t);
  if (next) return `${VERB[next.method]} from ${formatDay(next.bedIn.start)}${next.kind === 'fall' ? ' for fall' : ''}`;
  return 'Not suited to this climate';
}

/** True when today falls in a window for sowing, planting out, planting or starting seeds indoors. */
export function canGoInNow(plant: Plant, profile: ClimateProfile | null | undefined, today: IsoDate): boolean {
  if (!hasSchedule(profile)) return false;
  const t = toDay(today);
  return nearSchedules(plant, profile, t).some((s) =>
    s.windows.some((w) => inRange(w.bedIn, t) || (w.indoor !== undefined && inRange(w.indoor, t))),
  );
}

// ---- The plant card's "When" section ------------------------------------------------------------

/** The season the card shows: this one while any of its windows is still ahead, else the next. */
export function cardSchedule(plant: Plant, profile: ClimateProfile, today: IsoDate): PlantSchedule {
  const t = toDay(today);
  const s = seasonOf(profile, t);
  const cur = plantSchedule(plant, profile, s);
  return cur.windows.some((w) => w.bedIn.end >= t) ? cur : plantSchedule(plant, profile, s + 1);
}

/**
 * Gardener-friendly override for reason codes whose default text reads like an implementation note.
 * Returns a ready-to-display sentence, or null to fall back to reasonText.
 */
function gardenPhrase(r: Reason): string | null {
  if (r.code === 'fall-count-back') {
    const ref = formatDay(r.ref);
    const marker =
      r.refKind === 'frost-risk'
        ? `frost becomes likely around ${ref}`
        : r.refKind === 'first-frost'
          ? `the first frost (${ref})`
          : r.refKind === 'minus2'
            ? `the first hard frost (${ref})`
            : `the first hard freeze (${ref})`;
    return `Timed to give a crop before ${marker}${r.estimated ? ' (an estimate for this town)' : ''}.`;
  }
  return null;
}

/**
 * A reason as a sentence in the gardener's units: capital first letter, full stop at the end. The
 * domain's default text gives temperatures as "16 C"; they are shown as "61°F" or "16°C".
 */
export function sentence(r: Reason, units: Units = 'metric'): string {
  const override = gardenPhrase(r);
  if (override) return override;
  const t = reasonText(r, units);
  const s = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

export interface WhenRow {
  kind: 'indoor' | 'bed' | 'rounds' | 'pick' | 'yearly';
  dates: string;
  action: string;
  /** Why the schedule gave these dates, as sentences. */
  why: string;
}

export interface WhenWarning {
  text: string;
  frost: boolean;
}

export interface WhenBlock {
  /** null when the card has a single spring window, which needs no label. */
  title: string | null;
  rows: WhenRow[];
  warnings: WhenWarning[];
}

export interface WhenSection {
  blocks: WhenBlock[];
  /** Notes that apply to every window (frost dates only, approximate). */
  notes: string[];
  /** Windows that do not work here, with why. */
  notViable: { label: string; text: string; reason: Reason }[];
}

const KIND_LABEL: Record<WindowKind, string> = {
  spring: 'Spring',
  fall: 'For a fall crop',
  overwinter: 'Over winter',
  perennial: 'Planting',
  temperature: 'Planting time',
};
const METHOD_LABEL: Record<Method, string> = { transplant: 'from seedlings', direct: 'sown in place', plant: 'planted' };

const INDOOR_CODES = new Set<Reason['code']>(['indoor-start', 'harden-off']);
const PICK_CODES = new Set<Reason['code']>(['maturity', 'harvest-until', 'fall-heat-set', 'overwinter-harvest', 'perennial-harvest']);
const ROUND_CODES = new Set<Reason['code']>(['succession', 'succession-gap']);
/** Warnings said once for the whole section rather than under every window. */
const SECTION_CODES = new Set<Reason['code']>(['frost-only', 'approximate']);

/** A date range, with the year when it is not the year the window starts in. */
function datesText(r: DayRange, baseYear: number): string {
  const y = yearOf(r.end);
  return yearOf(r.start) !== baseYear || y !== baseYear ? `${formatRange(r)}, ${y}` : formatRange(r);
}

function bedAction(plant: Plant, method: Method): string {
  if (method === 'transplant') return 'Plant out';
  if (method === 'direct') return 'Sow outdoors';
  return plant.methods.plant ? `Plant ${plant.methods.plant.what}` : 'Plant';
}

function windowRows(plant: Plant, w: ScheduleWindow, units: Units): WhenRow[] {
  const why = (codes: (c: Reason['code']) => boolean) =>
    w.reasons
      .filter((r) => codes(r.code))
      .map((r) => sentence(r, units))
      .join(' ');
  const baseYear = yearOf(w.bedIn.start);
  const rows: WhenRow[] = [];
  if (w.indoor) {
    rows.push({ kind: 'indoor', dates: datesText(w.indoor, baseYear), action: 'Start seeds indoors', why: why((c) => INDOOR_CODES.has(c)) });
  }
  rows.push({
    kind: 'bed',
    dates: datesText(w.bedIn, baseYear),
    action: bedAction(plant, w.method),
    why: why((c) => !INDOOR_CODES.has(c) && !PICK_CODES.has(c) && !ROUND_CODES.has(c)),
  });
  if (w.rounds && w.rounds.length > 1) {
    const every = w.reasons.find((r) => r.code === 'succession');
    rows.push({
      kind: 'rounds',
      dates: every && every.code === 'succession' ? `Every ${every.everyDays} days` : `${w.rounds.length} rounds`,
      action: `${VERB[w.method]} on ${w.rounds.map(formatDay).join(', ')}`,
      why: why((c) => ROUND_CODES.has(c)),
    });
  }
  rows.push({ kind: 'pick', dates: datesText(w.harvest, baseYear), action: 'Pick', why: why((c) => PICK_CODES.has(c)) });
  const later = w.yearly?.[1];
  if (later) {
    rows.push({
      kind: 'yearly',
      dates: 'Every year after',
      action: `Pick about ${formatRange(later.harvest)}`,
      why: '',
    });
  }
  return rows;
}

export function whenSection(plant: Plant, sched: PlantSchedule, units: Units = 'metric'): WhenSection {
  const perKind = new Map<WindowKind, number>();
  for (const w of sched.windows) perKind.set(w.kind, (perKind.get(w.kind) ?? 0) + 1);
  const single = sched.windows.length === 1 && sched.windows[0]!.kind === 'spring';
  const seenTitles = new Map<string, number>();
  const notes = new Set<string>();
  // Track warnings shown in any block so the same text does not repeat across blocks.
  const seenWarnings = new Set<string>();
  const blocks: WhenBlock[] = sched.windows.map((w) => {
    let title: string | null = null;
    if (!single) {
      const base = (perKind.get(w.kind) ?? 0) > 1 ? `${KIND_LABEL[w.kind]}, ${METHOD_LABEL[w.method]}` : KIND_LABEL[w.kind];
      const n = (seenTitles.get(base) ?? 0) + 1;
      seenTitles.set(base, n);
      title = n > 1 ? `${base} (${n})` : base;
    }
    const warnings: WhenWarning[] = [];
    const seen = new Set<string>();
    for (const r of w.warnings) {
      const text = sentence(r, units);
      if (SECTION_CODES.has(r.code)) {
        notes.add(text);
        continue;
      }
      if (seen.has(text) || seenWarnings.has(text)) continue;
      seen.add(text);
      seenWarnings.add(text);
      warnings.push({ text, frost: r.code === 'frost-possible' });
    }
    return { title, rows: windowRows(plant, w, units), warnings };
  });
  const nv = new Set<string>();
  const notViable: WhenSection['notViable'] = [];
  for (const n of sched.notViable) {
    const text = sentence(n.reason, units);
    if (nv.has(text)) continue;
    nv.add(text);
    notViable.push({ label: n.method ? `${KIND_LABEL[n.kind]}, ${METHOD_LABEL[n.method]}` : KIND_LABEL[n.kind], text, reason: n.reason });
  }
  return { blocks, notes: [...notes], notViable };
}

/** Offsets for the card when there is no climate yet, one row per way in. */
export function offsetRows(plant: Plant): WhenRow[] {
  const m = plant.methods;
  const rows: WhenRow[] = [];
  if (m.indoor) {
    const [a, b] = m.indoor.ageWeeks;
    rows.push({ kind: 'indoor', dates: a === b ? plural(a, 'week') : `${a} to ${b} weeks`, action: 'Start seeds indoors', why: 'Before you plant out.' });
  }
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (m.transplant) rows.push({ kind: 'bed', dates: cap(weeksPhrase(m.transplant.weeks)), action: 'Plant out', why: '' });
  if (m.direct) rows.push({ kind: 'bed', dates: cap(weeksPhrase(m.direct.weeks)), action: 'Sow outdoors', why: '' });
  if (m.plant) rows.push({ kind: 'bed', dates: cap(weeksPhrase(m.plant.weeks)), action: `Plant ${m.plant.what}`, why: '' });
  if (plant.overwinter) {
    rows.push({ kind: 'bed', dates: cap(weeksPhrase(plant.overwinter.plantWeeks, 'your first fall frost')), action: 'Plant for next year', why: '' });
  }
  return rows;
}

// ---- Suggestions when a plant does not suit the climate ----------------------------------------

export type SuggestionKind = 'heat' | 'cool' | 'quick';

/**
 * Plants that do have dates here, for a plant that does not: heat lovers when it is too warm,
 * cool-weather crops when too cool, quicker crops when the season is too short. Same kind of plant
 * first. Empty when the reason gives nothing to suggest.
 */
export function suggestionsFor(
  plant: Plant,
  reason: Reason,
  candidates: readonly Plant[],
  profile: ClimateProfile,
  season: number,
  max = 2,
): { kind: SuggestionKind; plants: Plant[] } | null {
  let kind: SuggestionKind;
  let fits: (p: Plant) => boolean;
  let score: (p: Plant) => number;
  if (reason.code === 'too-hot') {
    kind = 'heat';
    fits = (p) => p.temp.maxC > plant.temp.maxC;
    score = (p) => -p.temp.maxC;
  } else if (reason.code === 'too-cool') {
    kind = 'cool';
    fits = (p) => p.temp.minC < plant.temp.minC;
    score = (p) => p.temp.minC;
  } else if (reason.code === 'too-short' || reason.code === 'no-room') {
    kind = 'quick';
    fits = (p) => p.maturity.days < plant.maturity.days && !p.perennial;
    score = (p) => p.maturity.days;
  } else {
    return null;
  }
  const found = candidates
    .filter((p) => p.id !== plant.id && fits(p) && plantSchedule(p, profile, season).windows.length > 0)
    .sort((a, b) => Number(b.category === plant.category) - Number(a.category === plant.category) || score(a) - score(b) || a.name.localeCompare(b.name))
    .slice(0, max);
  return found.length ? { kind, plants: found } : null;
}
