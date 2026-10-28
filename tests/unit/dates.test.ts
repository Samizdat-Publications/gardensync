import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { HarvestSchema } from '../../src/domain/doc/schema';
import {
  addDays,
  circularDoy,
  dayFromParts,
  dayInYear,
  dayOfYear,
  isIsoDate,
  isoFromLocal,
  monthDayFromCircular,
  monthDayOf,
  nextMonthDayAfter,
  partsFromDay,
  startOfWeek,
  toDay,
  toIso,
  weekday,
} from '../../src/domain/dates';

describe('dates', () => {
  it('round-trips ISO dates', () => {
    for (const iso of ['1970-01-01', '2024-02-29', '2026-10-28', '2027-12-31', '1995-03-26']) {
      expect(toIso(toDay(iso))).toBe(iso);
    }
    expect(toDay('1970-01-01')).toBe(0);
  });

  it('is unaffected by daylight saving changes in the local time zone', () => {
    // US DST starts 2027-03-14; Melbourne DST ends 2027-04-04. Each must be exactly one day apart.
    expect(toDay('2027-03-15') - toDay('2027-03-14')).toBe(1);
    expect(toDay('2027-04-05') - toDay('2027-04-04')).toBe(1);
    expect(toIso(addDays(toDay('2027-03-13'), 2))).toBe('2027-03-15');
  });

  it('rejects impossible dates', () => {
    expect(isIsoDate('2027-02-29')).toBe(false);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(() => dayFromParts(2027, 13, 1)).toThrow();
  });

  it('clamps Feb 29 in common years', () => {
    expect(toIso(dayInYear(2027, '02-29'))).toBe('2027-02-28');
    expect(toIso(dayInYear(2028, '02-29'))).toBe('2028-02-29');
  });

  it('finds the next occurrence of a month-day', () => {
    expect(toIso(nextMonthDayAfter(toDay('2027-04-16'), '11-04'))).toBe('2027-11-04');
    expect(toIso(nextMonthDayAfter(toDay('2027-11-05'), '11-04'))).toBe('2028-11-04');
    // A southern spring frost in September is followed by a fall frost the next May.
    expect(toIso(nextMonthDayAfter(dayInYear(2027, '09-15'), '05-20'))).toBe('2028-05-20');
  });

  it('knows weekdays and week starts (Monday first)', () => {
    expect(weekday(toDay('2026-10-28'))).toBe(2); // a Wednesday
    expect(toIso(startOfWeek(toDay('2026-10-28')))).toBe('2026-10-26');
    expect(toIso(startOfWeek(toDay('2027-01-03')))).toBe('2026-12-28');
  });

  it('maps month-days onto a 365-day circle and back', () => {
    expect(circularDoy('01-01')).toBe(0);
    expect(circularDoy('12-31')).toBe(364);
    expect(circularDoy('02-29')).toBe(circularDoy('02-28'));
    expect(monthDayFromCircular(circularDoy('04-16'))).toBe('04-16');
    expect(monthDayFromCircular(-1)).toBe('12-31');
    expect(monthDayOf(toDay('2026-04-16'))).toBe('04-16');
    expect(dayOfYear(toDay('2026-01-01'))).toBe(1);
  });
});

describe('years 0 to 99 and the document range', () => {
  it('keeps years 0 to 99 where they are instead of moving them to 19xx', () => {
    for (const [y, m, dd] of [[50, 6, 15], [0, 1, 1], [99, 12, 31], [1, 3, 1]] as const) {
      expect(partsFromDay(dayFromParts(y, m, dd))).toEqual({ year: y, month: m, day: dd });
    }
    expect(toIso(dayFromParts(50, 6, 15))).toBe('0050-06-15');
    expect(dayFromParts(1999, 1, 1) - dayFromParts(99, 1, 1)).toBeGreaterThan(365 * 1800);
  });

  it('accepts ISO dates in the years 1000 to 9999 only, so the schema rejects the rest', () => {
    expect(isIsoDate('0999-12-31')).toBe(false);
    expect(isIsoDate('0050-06-15')).toBe(false);
    expect(isIsoDate('1000-01-01')).toBe(true);
    expect(isIsoDate('9999-12-31')).toBe(true);
    expect(v.safeParse(HarvestSchema, { id: 'h', plantId: 'kale', date: '0026-06-01' }).success).toBe(false);
  });

  it('agrees with the Date-based calendar across four centuries', () => {
    for (let d = dayFromParts(1890, 1, 1); d <= dayFromParts(2310, 1, 1); d += 13) {
      const date = new Date(d * 86_400_000);
      expect(partsFromDay(d)).toEqual({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
    }
  });
});

describe('isoFromLocal', () => {
  it('reads the local calendar, not the UTC one', () => {
    // Built from local fields, so the expected date holds in every time zone the tests run in.
    expect(isoFromLocal(new Date(2027, 2, 3, 7, 0))).toBe('2027-03-03');
    expect(isoFromLocal(new Date(2027, 11, 31, 23, 59))).toBe('2027-12-31');
    expect(isoFromLocal(new Date(2028, 0, 1, 0, 1))).toBe('2028-01-01');
  });
});
