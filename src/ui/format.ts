// Display formatting for dates. Day numbers are UTC-based calendar days, so they are formatted in UTC
// to show the same calendar date the domain means.
import { dayInYear, toDay, type DayNum, type IsoDate, type MonthDay } from '../domain/dates';

const short = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const long = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' });
const withYear = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

const asDate = (d: DayNum) => new Date(d * 86_400_000);

/** "Apr 14" */
export function fmtDay(d: DayNum): string {
  return short.format(asDate(d));
}

/** "Apr 14" for a month-day, using a common year. */
export function fmtMonthDay(md: MonthDay): string {
  return fmtDay(dayInYear(2027, md));
}

/** "Wednesday, April 14" */
export function fmtLong(d: DayNum): string {
  return long.format(asDate(d));
}

/** "Apr 14, 2027" */
export function fmtWithYear(d: DayNum): string {
  return withYear.format(asDate(d));
}

const yearOfDay = (d: DayNum) => asDate(d).getUTCFullYear();

/** "Apr 14" in the same calendar year as `ref`, otherwise "Apr 14, 2028". */
export function fmtNear(d: DayNum, ref: DayNum): string {
  return yearOfDay(d) === yearOfDay(ref) ? fmtDay(d) : fmtWithYear(d);
}

/** "Apr 14 to Sep 12", with years on both ends when either falls outside the year of `ref`. */
export function fmtSpan(start: DayNum, end: DayNum, ref: DayNum): string {
  const y = yearOfDay(ref);
  const f = yearOfDay(start) === y && yearOfDay(end) === y ? fmtDay : fmtWithYear;
  return `${f(start)} to ${f(end)}`;
}

/** "Apr 14 to Apr 28", or a single day when they match. */
export function fmtRange(start: DayNum, end: DayNum): string {
  // A window that runs the whole year round would read "Jul 18 to Jul 17".
  if (end - start >= 364) return 'all year round';
  return start === end ? fmtDay(start) : `${fmtDay(start)} to ${fmtDay(end)}`;
}

export function dayOfIso(iso: IsoDate): DayNum {
  return toDay(iso);
}

// Words in plant names that keep their capital in the middle of a sentence.
const PROPER = /^(French|Swiss|Brussels|Italian|Thai|Chinese|Japanese|Mexican|English|Greek|Russian)\b/;

/** A plant name as it reads mid-sentence: "Sow lettuce", "Start French marigold". */
export function inSentence(name: string): string {
  return PROPER.test(name) ? name : name.charAt(0).toLowerCase() + name.slice(1);
}

/** Capitalises the first letter, for reasons that read as their own sentence. */
export function sentence(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
