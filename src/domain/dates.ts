// Calendar dates without time zones.
//
// Everything in the domain works on integer day numbers (days since 1970-01-01) and ISO date strings
// (YYYY-MM-DD). Nothing here reads the clock or the local time zone, so results are identical in
// Ohio and in Melbourne. Never add or subtract on JS Date objects elsewhere in the domain.

/** Days since 1970-01-01. Day 0 is 1970-01-01. */
export type DayNum = number;
/** An ISO calendar date, YYYY-MM-DD. */
export type IsoDate = string;
/** A month and day with no year, MM-DD, e.g. "04-16". */
export type MonthDay = string;

const MS_PER_DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MD_RE = /^(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

/** Day number for a calendar date. Month is 1-12. Throws on an impossible date. */
export function dayFromParts(year: number, month: number, day: number): DayNum {
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Not a calendar date: ${year}-${month}-${day}`);
  }
  // setUTCFullYear, not Date.UTC: Date.UTC maps years 0 to 99 to 1900 to 1999.
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return Math.round(date.getTime() / MS_PER_DAY);
}

/**
 * The calendar date of a day number, by integer arithmetic (H. Hinnant's civil-from-days) rather
 * than a Date object: it runs in the schedule's inner loops, millions of times per garden.
 */
export function partsFromDay(d: DayNum): { year: number; month: number; day: number } {
  const z = d + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** Earliest and latest years an ISO date in a document may have. */
export const MIN_YEAR = 1000;
export const MAX_YEAR = 9999;

/** A real calendar date written YYYY-MM-DD, in the years 1000 to 9999. */
export function isIsoDate(s: string): boolean {
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return y >= MIN_YEAR && y <= MAX_YEAR && mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function toDay(iso: IsoDate): DayNum {
  const m = ISO_RE.exec(iso);
  if (!m) throw new RangeError(`Not an ISO date: ${iso}`);
  return dayFromParts(Number(m[1]), Number(m[2]), Number(m[3]));
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function toIso(d: DayNum): IsoDate {
  const { year, month, day } = partsFromDay(d);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/**
 * Today's date where the gardener is, from a Date the caller made (usually `new Date()`). This is
 * the one way the UI turns "now" into a calendar date: it reads the local calendar fields, so a
 * gardener in Melbourne at 7 am on the 3rd gets the 3rd, not the UTC date (the 2nd). The domain
 * itself never calls it; it takes "today" as an argument.
 */
export function isoFromLocal(date: Date): IsoDate {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(d: DayNum, n: number): DayNum {
  return d + n;
}

export function yearOf(d: DayNum): number {
  return partsFromDay(d).year;
}

/** 1-based day of the year. */
export function dayOfYear(d: DayNum): number {
  return d - dayFromParts(yearOf(d), 1, 1) + 1;
}

/** Day of the week, 0 = Monday ... 6 = Sunday (ISO order). 1970-01-01 was a Thursday. */
export function weekday(d: DayNum): number {
  return (((d + 3) % 7) + 7) % 7;
}

/** The Monday on or before d. */
export function startOfWeek(d: DayNum): DayNum {
  return d - weekday(d);
}

export function monthDayOf(d: DayNum): MonthDay {
  const { month, day } = partsFromDay(d);
  return `${pad(month)}-${pad(day)}`;
}

export function parseMonthDay(md: MonthDay): { month: number; day: number } {
  const m = MD_RE.exec(md);
  if (!m) throw new RangeError(`Not a month-day: ${md}`);
  const month = Number(m[1]);
  const day = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(2024, month)) {
    throw new RangeError(`Not a month-day: ${md}`);
  }
  return { month, day };
}

export function isMonthDay(s: string): boolean {
  try {
    parseMonthDay(s);
    return true;
  } catch {
    return false;
  }
}

/** The day a month-day falls on in a given year. Feb 29 becomes Feb 28 in common years. */
export function dayInYear(year: number, md: MonthDay): DayNum {
  const { month, day } = parseMonthDay(md);
  return dayFromParts(year, month, Math.min(day, daysInMonth(year, month)));
}

/** The first occurrence of a month-day strictly after day d. */
export function nextMonthDayAfter(d: DayNum, md: MonthDay): DayNum {
  const y = yearOf(d);
  const same = dayInYear(y, md);
  return same > d ? same : dayInYear(y + 1, md);
}

/**
 * Position of a month-day on a 365-day circle (0 = Jan 1), ignoring leap years. Used for climate
 * statistics, where Feb 29 is folded into Feb 28.
 */
export function circularDoy(md: MonthDay): number {
  const { month, day } = parseMonthDay(md);
  const clamped = month === 2 && day === 29 ? 28 : day;
  return dayFromParts(2023, month, clamped) - dayFromParts(2023, 1, 1);
}

/** Inverse of circularDoy, for 0..364. */
export function monthDayFromCircular(doy: number): MonthDay {
  const n = ((Math.round(doy) % 365) + 365) % 365;
  return monthDayOf(dayFromParts(2023, 1, 1) + n);
}

/** Inclusive date range. */
export interface DayRange {
  start: DayNum;
  end: DayNum;
}

export function rangeLength(r: DayRange): number {
  return r.end - r.start + 1;
}

export function inRange(r: DayRange, d: DayNum): boolean {
  return d >= r.start && d <= r.end;
}

export function rangesOverlap(a: DayRange, b: DayRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}
