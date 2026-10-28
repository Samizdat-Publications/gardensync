// Climate maths on made-up series with known answers, plus the helpers around it.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { analyzeClimate, computeClimateProfile, median, quantile } from '../../src/domain/climate/compute';
import { manualProfile } from '../../src/domain/climate/manual';
import { interpolateMonthly, monthMidDoy, tempOn } from '../../src/domain/climate/tempCurve';
import { ClimateProfileSchema } from '../../src/domain/climate/types';
import { zoneFromExtremeMinC, zoneFromExtremeMinF, zoneRangeF } from '../../src/domain/climate/zone';
import { circularDoy, monthDayOf, parseMonthDay, toDay, toIso } from '../../src/domain/dates';

const START = '1995-01-01';
const END = '2024-12-31';
const N = toDay(END) - toDay(START) + 1;
const ASOF = '2026-10-28';

/** Build daily series from a function of (circular day 0-364, calendar year, ISO date). */
function series(fn: (doy: number, year: number, iso: string) => number) {
  const tmin: number[] = [];
  const tmax: number[] = [];
  const d0 = toDay(START);
  for (let i = 0; i < N; i++) {
    const d = d0 + i;
    const iso = toIso(d);
    const t = fn(circularDoy(monthDayOf(d)), Number(iso.slice(0, 4)), iso);
    tmin.push(t);
    tmax.push(t + 10);
  }
  return { start: START, tmin, tmax, asOf: ASOF };
}

/** Daily minimum A + B cos(2 pi (doy - peak) / 365): warmest at `peak`. */
const sinus = (A: number, B: number, peak: number) => (doy: number) => A + B * Math.cos((2 * Math.PI * (doy - peak)) / 365);

const JUL16 = circularDoy('07-16');
const JAN16 = circularDoy('01-16');

describe('quantiles', () => {
  it('use nearest rank and a rounded mean for even medians', () => {
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBe(9); // index round(8.1) = 8
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.1)).toBe(2); // index round(0.9) = 1
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 6])).toBe(3); // (2 + 3) / 2 = 2.5, rounded
    expect(median([-Infinity, 4])).toBe(-Infinity);
    expect(median([4, Infinity])).toBe(Infinity);
    expect(median([-Infinity, -Infinity, 3, 5])).toBe(-Infinity);
  });
});

describe('synthetic series', () => {
  it('a sinusoid that never reaches 0 C has no frost at all', () => {
    const p = computeClimateProfile(series(sinus(20, 5, JUL16)));
    expect(p.frostClass).toBe('none');
    expect(p.frostYearsShare).toBe(0);
    expect(p.lastFrost).toEqual({ p50: null, p90: null });
    expect(p.firstFrost).toEqual({ p50: null, p10: null });
    expect(p.firstHardFrost).toEqual({ minus2: null, minus5: null });
    expect(p.warmestMonth).toBe(7);
    expect(p.hemisphere).toBe('north');
    expect(p.extremeMinC).toBe(15);
    expect(p.zone).toBe('12b'); // 15 C = 59 F
    expect(() => v.parse(ClimateProfileSchema, p)).not.toThrow();
  });

  it('a sinusoid crossing 0 C gives the crossing days exactly', () => {
    // 5 + 10 cos(...) <= 0 when the day is 122 or more from Jul 16: Nov 15 through Mar 16.
    const p = computeClimateProfile(series(sinus(5, 10, JUL16)));
    expect(p.lastFrost).toEqual({ p50: '03-16', p90: '03-16' });
    expect(p.firstFrost).toEqual({ p50: '11-15', p10: '11-15' });
    expect(p.frostClass).toBe('frost');
    expect(p.frostYearsShare).toBe(1);
    // -2 C: cos <= -0.7, 137 days or more from Jul 16 = Nov 30. -5 C would need cos = -1 exactly,
    // which no whole day reaches (the coldest is -4.99996 C): never.
    expect(p.firstHardFrost).toEqual({ minus2: '11-30', minus5: null });
    expect(p.extremeMinC).toBeCloseTo(-5, 1);
  });

  it('ignores a single June outlier frost when taking the median', () => {
    // Frost dates that drift with the year so the ranks are distinct.
    const base = (doy: number, year: number) => sinus(5 + ((year % 7) - 3) * 0.6, 10, JUL16)(doy);
    const clean = computeClimateProfile(series(base));
    const outlier = computeClimateProfile(series((doy, year, iso) => (iso === '2010-06-10' ? -1 : base(doy, year))));
    expect(parseMonthDay(clean.lastFrost.p50!).month).toBe(3);
    const shift = circularDoy(outlier.lastFrost.p50!) - circularDoy(clean.lastFrost.p50!);
    expect(Math.abs(shift)).toBeLessThanOrEqual(3);
    expect(outlier.lastFrost.p90).toBe(clean.lastFrost.p90);
  });

  it('counts a frost-free year as infinitely early and infinitely late', () => {
    const warmSeason = (iso: string) => iso >= '2005-07-16' && iso <= '2006-07-15';
    const one = analyzeClimate(series((doy, _y, iso) => sinus(5, 10, JUL16)(doy) + (warmSeason(iso) ? 20 : 0)));
    expect(one.seasons.filter((s) => !s.anyFrost)).toHaveLength(1);
    expect(one.profile.frostYearsShare).toBeCloseTo(28 / 29, 3);
    expect(one.profile.lastFrost).toEqual({ p50: '03-16', p90: '03-16' });
    expect(one.profile.firstFrost).toEqual({ p50: '11-15', p10: '11-15' });

    // Frost-free in 15 of 29 seasons: medians become null, the risk tails remain.
    const mostly = computeClimateProfile(
      series((doy, _y, iso) => {
        const seasonYear = Number(iso.slice(0, 4)) - (iso.slice(5) < '07-16' ? 1 : 0);
        return sinus(5, 10, JUL16)(doy) + (seasonYear % 2 === 1 ? 20 : 0);
      }),
    );
    expect(mostly.frostClass).toBe('marginal');
    expect(mostly.lastFrost).toEqual({ p50: null, p90: '03-16' });
    expect(mostly.firstFrost).toEqual({ p50: null, p10: '11-15' });
  });

  it('handles a frost season that crosses the new year', () => {
    // 9.5 + 10 cos(...) <= 0 needs cos <= -0.95, 165 or more days from Jul 16: Dec 28 to Feb 1.
    const p = computeClimateProfile(series(sinus(9.5, 10, JUL16)));
    expect(p.firstFrost.p50).toBe('12-28');
    expect(p.lastFrost.p50).toBe('02-01');
  });

  /** A frost-free sinusoid (lowest 2 C) with a 5 C cold dip on the days `cold` picks. */
  const dipped = (peak: number, cold: (md: string) => boolean) =>
    series((doy, _y, iso) => sinus(12, 10, peak)(doy) - (cold(iso.slice(5)) ? 5 : 0));

  it('gives a first and a last frost when frosts cluster around the coldest point (Phoenix-like)', () => {
    const p = computeClimateProfile(dipped(JUL16, (md) => md >= '12-25' || md <= '01-20'));
    expect(p.warmestMonth).toBe(7);
    expect(p.firstFrost).toEqual({ p50: '12-25', p10: '12-25' });
    expect(p.lastFrost).toEqual({ p50: '01-20', p90: '01-20' });
    expect(p.frostClass).toBe('frost');
  });

  it('does the same for a southern winter clustered in July', () => {
    const p = computeClimateProfile(dipped(JAN16, (md) => md >= '07-01' && md <= '07-31'));
    expect(p.warmestMonth).toBe(1);
    expect(p.hemisphere).toBe('south');
    expect(p.firstFrost).toEqual({ p50: '07-01', p10: '07-01' });
    expect(p.lastFrost).toEqual({ p50: '07-31', p90: '07-31' });
  });

  it('a season with one frost night has first frost = last frost', () => {
    const p = computeClimateProfile(dipped(JUL16, (md) => md === '01-10'));
    expect(p.firstFrost.p50).toBe('01-10');
    expect(p.lastFrost.p50).toBe('01-10');
    expect(p.extremeMinC).toBeLessThanOrEqual(0);
  });

  it('works in the southern hemisphere with no special case', () => {
    // Warmest mid-January; varying winters put the last frost from August into October.
    const fn = (doy: number, year: number) => sinus(5 - ((year % 5) - 2) * 1.2, 10, JAN16)(doy);
    const p = computeClimateProfile(series(fn));
    expect(p.warmestMonth).toBe(1);
    expect(p.hemisphere).toBe('south');
    for (const md of [p.lastFrost.p50, p.lastFrost.p90]) expect([8, 9, 10]).toContain(parseMonthDay(md!).month);
    for (const md of [p.firstFrost.p50, p.firstFrost.p10]) expect([4, 5, 6]).toContain(parseMonthDay(md!).month);
    expect(circularDoy(p.lastFrost.p90!)).toBeGreaterThanOrEqual(circularDoy(p.lastFrost.p50!));
    expect(circularDoy(p.firstFrost.p10!)).toBeLessThanOrEqual(circularDoy(p.firstFrost.p50!));
  });

  it('takes the hemisphere from the latitude when a place is given', () => {
    const p = computeClimateProfile({ ...series(sinus(20, 5, JUL16)), place: { name: 'X', lat: -0.123456, lon: 10.987654 } });
    expect(p.hemisphere).toBe('south');
    expect(p.place).toEqual({ name: 'X', lat: -0.12, lon: 10.99 });
  });

  it('skips seasons cut off by the ends of the data and ones with big gaps', () => {
    const s = series(sinus(5, 10, JUL16));
    expect(analyzeClimate(s).seasons).toHaveLength(29);
    const gappy = { ...s, tmin: s.tmin.map((t, i) => (i >= 4000 && i < 4100 ? null : t)) };
    expect(analyzeClimate(gappy).seasons).toHaveLength(28);
    expect(() => computeClimateProfile({ ...s, tmin: s.tmin.slice(0, 300), tmax: s.tmax.slice(0, 300) })).toThrow();
  });
});

describe('tempOn', () => {
  const p = computeClimateProfile(series(sinus(5, 10, JUL16)));
  const m = p.monthly!;

  it('is exact at mid-month', () => {
    for (let month = 1; month <= 12; month++) {
      const md = monthDayOf(toDay('2023-01-01') + monthMidDoy(month));
      expect(tempOn(p, md, 'mean')).toBeCloseTo(m.meanC[month - 1]!, 10);
      expect(tempOn(p, md, 'min')).toBeCloseTo(m.minC[month - 1]!, 10);
      expect(tempOn(p, md, 'max')).toBeCloseTo(m.maxC[month - 1]!, 10);
    }
  });

  it('is continuous from December into January', () => {
    const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 23];
    const dec31 = interpolateMonthly(vals, circularDoy('12-31'));
    const jan1 = interpolateMonthly(vals, circularDoy('01-01'));
    const step = (1 - 23) / (monthMidDoy(1) + 365 - monthMidDoy(12));
    expect(jan1 - dec31).toBeCloseTo(step, 10);
    expect(dec31).toBeLessThan(23);
    expect(jan1).toBeGreaterThan(1);
    // Every day-to-day step around the whole circle is small.
    for (let d = 0; d < 365; d++) {
      expect(Math.abs(interpolateMonthly(vals, d + 1) - interpolateMonthly(vals, d))).toBeLessThan(0.8);
    }
  });

  it('is null without monthly normals', () => {
    expect(tempOn(manualProfile({ lastFrost: '04-20', firstFrost: '10-15', asOf: ASOF }), '07-01', 'mean')).toBeNull();
  });
});

describe('manualProfile', () => {
  it('adds the fixed margins', () => {
    const p = manualProfile({ lastFrost: '04-20', firstFrost: '10-15', asOf: ASOF });
    expect(p).toEqual({
      source: 'manual',
      hemisphere: 'north',
      warmestMonth: 7,
      frostClass: 'frost',
      frostYearsShare: 1,
      lastFrost: { p50: '04-20', p90: '05-04' },
      firstFrost: { p50: '10-15', p10: '10-05' },
      firstHardFrost: { minus2: null, minus5: null },
      extremeMinC: null,
      zone: null,
      asOf: ASOF,
    });
    expect(() => v.parse(ClimateProfileSchema, p)).not.toThrow();
  });

  it('wraps across the new year and infers the southern hemisphere', () => {
    const p = manualProfile({ lastFrost: '12-25', firstFrost: '01-05', asOf: ASOF });
    expect(p.lastFrost.p90).toBe('01-08');
    expect(p.firstFrost.p10).toBe('12-26');
    const south = manualProfile({ lastFrost: '09-20', firstFrost: '05-10', asOf: ASOF });
    expect(south.hemisphere).toBe('south');
    expect([1, 2]).toContain(south.warmestMonth);
  });

  it('keeps monthly normals, the place and a zone when given', () => {
    const monthly = computeClimateProfile(series(sinus(5, 10, JUL16))).monthly!;
    const p = manualProfile({
      lastFrost: '04-20',
      firstFrost: '10-15',
      place: { name: 'Y', lat: 40.12345, lon: -81.98765 },
      monthly,
      extremeMinC: -20,
      asOf: ASOF,
    });
    expect(p.monthly).toEqual(monthly);
    expect(p.warmestMonth).toBe(7);
    expect(p.place).toEqual({ name: 'Y', lat: 40.12, lon: -81.99 });
    expect(p.zone).toBe('6b');
    expect(() => manualProfile({ lastFrost: '13-01', firstFrost: '10-15', asOf: ASOF })).toThrow();
  });
});

describe('zones', () => {
  it('band the extreme minimum in 10 F zones and 5 F halves', () => {
    expect(zoneFromExtremeMinF(-5)).toBe('6b');
    expect(zoneFromExtremeMinF(-5.1)).toBe('6a');
    expect(zoneFromExtremeMinF(0)).toBe('7a');
    expect(zoneFromExtremeMinF(-60)).toBe('1a');
    expect(zoneFromExtremeMinF(-80)).toBe('1a');
    expect(zoneFromExtremeMinF(64.9)).toBe('13a');
    expect(zoneFromExtremeMinF(90)).toBe('13b');
    expect(zoneFromExtremeMinC(-20.7)).toBe('6a');
    expect(zoneFromExtremeMinC(-20.5)).toBe('6b');
    expect(zoneFromExtremeMinC(null)).toBeNull();
    expect(zoneRangeF('6b')).toEqual({ fromF: -5, toF: 0 });
    expect(zoneRangeF('1a')).toEqual({ fromF: -60, toF: -55 });
  });
});
