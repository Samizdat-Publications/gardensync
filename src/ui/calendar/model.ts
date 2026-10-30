// Pure helpers behind the calendar screen: the months a season's chart spans, which season it opens
// on, and bar edge colors that stay visible on the frost bands. No DOM; unit tested.
import type { ClimateProfile } from '../../domain/climate/types';
import { circularDoy, dayFromParts, monthDayFromCircular, parseMonthDay, partsFromDay, type DayNum } from '../../domain/dates';
import { midsummer, midsummerMonthDay, onOrBefore } from '../../domain/schedule/seasons';

export interface Span {
  start: DayNum;
  /** Last day shown, inclusive. */
  end: DayNum;
}

/**
 * The twelve calendar months a season's chart shows: from the 1st of the month nearest to half a
 * year before midsummer, to the day before the same 1st a year later (365 or 366 days).
 *
 * The month is worked out on the common-year calendar, so a leap year cannot push it on: counting
 * 182 days back from Jul 16 lands on Jan 15 in 2027 but on Jan 16 in 2028, which used to round the
 * 2028 chart to Feb 1 and run it from Feb to Jan.
 */
export function calendarSpan(c: ClimateProfile, season: number): Span {
  const back = monthDayFromCircular(circularDoy(midsummerMonthDay(c)) - 182);
  const { month, day } = parseMonthDay(back);
  const startMonth = day <= 15 ? month : (month % 12) + 1;
  const start = onOrBefore(midsummer(c, season), `${String(startMonth).padStart(2, '0')}-01`);
  const p = partsFromDay(start);
  return { start, end: dayFromParts(p.year + 1, p.month, 1) - 1 };
}

/** The 1st of every month inside the span, in order. */
export function monthStarts(span: Span): DayNum[] {
  const out: DayNum[] = [];
  let { year, month } = partsFromDay(span.start);
  for (let d = dayFromParts(year, month, 1); d <= span.end; d = dayFromParts(year, month, 1)) {
    if (d >= span.start) out.push(d);
    if (++month > 12) {
      month = 1;
      year++;
    }
  }
  return out;
}

/**
 * Which season the chart opens on, as an offset from today's season. It stays on this season
 * unless that would hide most of the plan: when this season is empty and the next is not, or when
 * midsummer is past and the next season holds more plantings (a fall start with only garlic in the
 * ground this year and the whole spring plan next year).
 */
export function openingShift(thisCount: number, nextCount: number, pastMidsummer: boolean): 0 | 1 {
  if (nextCount === 0) return 0;
  if (thisCount === 0) return 1;
  return pastMidsummer && nextCount > thisCount ? 1 : 0;
}

// ---- Bar edges that keep their contrast --------------------------------------------------------

/**
 * What a bar sits on in each theme: the panel, the "frost likely" band and the darker stripe of the
 * "frost possible" hatch. These copy --c-panel, --c-frost-soft and --c-frost-hatch from
 * styles/tokens.css; a unit test keeps them in step.
 */
export const BAR_GROUNDS = {
  light: ['#ffffff', '#dce6f7', '#c3d3f2'],
  dark: ['#211c17', '#1e283a', '#2a3a57'],
} as const;

/** WCAG 2 non-text contrast: a bar's edge needs 3:1 against what it sits on. */
export const MIN_EDGE_CONTRAST = 3;

type Rgb = [number, number, number];

function parseHex(hex: string): Rgb | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('')}`;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return 1;
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * The crop's color if it already stands out on every ground, otherwise the same hue mixed toward
 * black (light theme) or white (dark theme) just far enough that it does.
 */
export function edgeColor(crop: string, theme: 'light' | 'dark'): string {
  const rgb = parseHex(crop);
  if (!rgb) return crop;
  const grounds = BAR_GROUNDS[theme];
  const ok = (hex: string) => grounds.every((g) => contrastRatio(hex, g) >= MIN_EDGE_CONTRAST);
  if (ok(crop)) return crop;
  const target = theme === 'light' ? 0 : 255;
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const mixed = toHex(rgb.map((v) => v + (target - v) * t) as Rgb);
    if (ok(mixed)) return mixed;
  }
  return toHex([target, target, target]);
}
