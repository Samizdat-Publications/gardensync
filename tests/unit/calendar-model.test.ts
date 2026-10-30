import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { manualProfile } from '../../src/domain/climate/manual';
import { partsFromDay, toIso } from '../../src/domain/dates';
import { BAR_GROUNDS, calendarSpan, contrastRatio, edgeColor, MIN_EDGE_CONTRAST, monthStarts, openingShift } from '../../src/ui/calendar/model';
import { profileOf } from './schedule-helpers';

const typed = manualProfile({ lastFrost: '04-16', firstFrost: '11-04', asOf: '2027-07-15' });

describe('calendar span', () => {
  for (const [name, c] of [
    ['typed frost dates', typed],
    ['Canton, Ohio', profileOf('canton-oh')],
  ] as const) {
    for (const year of [2027, 2028, 2029]) {
      it(`${name}: ${year} runs Jan 1 to Dec 31 with twelve months in order`, () => {
        const span = calendarSpan(c, year);
        expect(toIso(span.start)).toBe(`${year}-01-01`);
        expect(toIso(span.end)).toBe(`${year}-12-31`);
        const months = monthStarts(span).map((d) => partsFromDay(d));
        expect(months.map((m) => m.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(months.every((m) => m.year === year && m.day === 1)).toBe(true);
      });
    }
  }

  it('the leap year is one day longer, not shifted', () => {
    expect(calendarSpan(typed, 2028).end - calendarSpan(typed, 2028).start + 1).toBe(366);
    expect(calendarSpan(typed, 2027).end - calendarSpan(typed, 2027).start + 1).toBe(365);
  });

  it('southern seasons run from the same month every year, leap or not', () => {
    const c = profileOf('melbourne');
    const starts = [2026, 2027, 2028, 2029].map((s) => toIso(calendarSpan(c, s).start).slice(5));
    expect(new Set(starts).size).toBe(1);
    for (const s of [2026, 2027, 2028, 2029]) expect(monthStarts(calendarSpan(c, s))).toHaveLength(12);
  });
});

describe('opening season', () => {
  it('stays on this season while it has plantings, until midsummer is past', () => {
    expect(openingShift(3, 20, false)).toBe(0);
    expect(openingShift(20, 3, true)).toBe(0);
    expect(openingShift(5, 5, true)).toBe(0);
  });
  it('moves to next season when this one is empty, or after midsummer when next holds more', () => {
    expect(openingShift(0, 4, false)).toBe(1);
    expect(openingShift(1, 14, true)).toBe(1);
    expect(openingShift(0, 0, true)).toBe(0);
  });
});

describe('bar edges on the frost bands', () => {
  function tokens(): { light: string[]; dark: string[] } {
    const css = readFileSync('src/ui/styles/tokens.css', 'utf8');
    const read = (block: string) => ['--c-panel', '--c-frost-soft', '--c-frost-hatch'].map((k) => new RegExp(`${k}:\\s*(#[0-9a-f]{6})`, 'i').exec(block)![1]!.toLowerCase());
    const dark = css.slice(css.indexOf("[data-theme='dark']"));
    return { light: read(css), dark: read(dark) };
  }

  it('match the theme tokens', () => {
    expect(tokens()).toEqual({ light: [...BAR_GROUNDS.light], dark: [...BAR_GROUNDS.dark] });
  });

  it('keep a crop color that already stands out', () => {
    expect(edgeColor('#2f7d32', 'light')).toBe('#2f7d32');
    expect(edgeColor('#f2d23c', 'dark')).toBe('#f2d23c');
  });

  for (const crop of ['#f1ecdf', '#efeaf7', '#f2d23c', '#a8d58a', '#5b2d6e', '#2e6b3a', '#8e1b3a', '#4b5ea8']) {
    for (const theme of ['light', 'dark'] as const) {
      it(`${crop} gets an edge of 3:1 or better on every ${theme} ground`, () => {
        const edge = edgeColor(crop, theme);
        for (const g of BAR_GROUNDS[theme]) expect(contrastRatio(edge, g)).toBeGreaterThanOrEqual(MIN_EDGE_CONTRAST);
      });
    }
  }
});
