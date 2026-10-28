// Climate profiles from 30 years (1995-2024) of Open-Meteo archive temperatures for six places.
// Fixtures come from scripts/fetch-climate-fixture.mjs. The published figures these were checked
// against are in docs/v8/research/climate.md.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { analyzeClimate, daysWithinSeason, type ClimateAnalysis } from '../../src/domain/climate/compute';
import { monthMidDoy } from '../../src/domain/climate/tempCurve';
import { ClimateProfileSchema, type ClimateProfile } from '../../src/domain/climate/types';
import { circularDoy, monthDayFromCircular, parseMonthDay, type MonthDay } from '../../src/domain/dates';

interface Fixture {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  elevation: number;
  timezone: string;
  start: string;
  tmin: (number | null)[];
  tmax: (number | null)[];
}

const SLUGS = ['canton-oh', 'melbourne', 'phoenix', 'brisbane', 'singapore', 'edinburgh'] as const;
type Slug = (typeof SLUGS)[number];

function load(slug: Slug): Fixture {
  const url = new URL(`../fixtures/climate/${slug}.json.gz`, import.meta.url);
  return JSON.parse(gunzipSync(readFileSync(url)).toString('utf8')) as Fixture;
}

const analyses = new Map<Slug, ClimateAnalysis>();
function analysis(slug: Slug): ClimateAnalysis {
  let a = analyses.get(slug);
  if (!a) {
    const f = load(slug);
    a = analyzeClimate({
      start: f.start,
      tmin: f.tmin,
      tmax: f.tmax,
      place: { name: f.name, lat: f.lat, lon: f.lon, elevationM: f.elevation },
      asOf: '2026-10-28',
    });
    analyses.set(slug, a);
  }
  return a;
}
const profile = (slug: Slug): ClimateProfile => analysis(slug).profile;

/** Signed days from b to a on the circle, in -182..182. */
function circDiff(a: MonthDay, b: MonthDay): number {
  const d = (((circularDoy(a) - circularDoy(b)) % 365) + 365) % 365;
  return d > 182 ? d - 365 : d;
}
const month = (md: MonthDay | null) => (md === null ? null : parseMonthDay(md).month);

describe('climate fixtures', () => {
  it('cover 30 full years with no gaps', () => {
    for (const slug of SLUGS) {
      const f = load(slug);
      expect(f.start).toBe('1995-01-01');
      expect(f.tmin).toHaveLength(10958);
      expect(f.tmax).toHaveLength(10958);
      expect(analysis(slug).seasons).toHaveLength(29);
    }
  });

  it('produce profiles that pass the schema', () => {
    for (const slug of SLUGS) expect(() => v.parse(ClimateProfileSchema, profile(slug))).not.toThrow();
  });
});

describe('Canton, Ohio', () => {
  const p = () => profile('canton-oh');

  it('matches the planning numbers within a day', () => {
    expect(Math.abs(circDiff(p().lastFrost.p50!, '04-16'))).toBeLessThanOrEqual(1);
    expect(Math.abs(circDiff(p().lastFrost.p90!, '04-29'))).toBeLessThanOrEqual(1);
    expect(Math.abs(circDiff(p().firstFrost.p50!, '11-04'))).toBeLessThanOrEqual(1);
    expect(Math.abs(circDiff(p().firstFrost.p10!, '10-26'))).toBeLessThanOrEqual(1);
    expect(p().frostClass).toBe('frost');
  });

  it('is zone 6, on the 6a/6b line', () => {
    // USDA's 2023 map puts Canton in 6b (-5 to 0 F). The gridded mean extreme minimum here is
    // -20.7 C = -5.3 F, a third of a degree F into 6a. Reported, not forced: see climate.md.
    expect(p().zone).toBe('6a');
    expect(p().extremeMinC).toBeGreaterThan(-21.2);
    expect(p().extremeMinC).toBeLessThan(-20.0);
  });

  it('golden', () => {
    expect(p()).toEqual({
      source: 'computed',
      place: { name: 'Canton, Ohio', lat: 40.81, lon: -81.43, elevationM: 322 },
      years: [1995, 2024],
      hemisphere: 'north',
      warmestMonth: 7,
      frostClass: 'frost',
      frostYearsShare: 1,
      lastFrost: { p50: '04-16', p90: '04-29' },
      firstFrost: { p50: '11-04', p10: '10-26' },
      firstHardFrost: { minus2: '11-12', minus5: '12-01' },
      extremeMinC: -20.7,
      zone: '6a',
      monthly: {
        meanC: [-2.4, -1, 3.9, 10.1, 15.9, 20.8, 22.9, 22.3, 18.8, 12.4, 5.7, 0.6],
        minC: [-6.6, -5.8, -1.2, 4.6, 10.7, 15.9, 18.2, 17.6, 14.1, 8.1, 1.8, -3],
        maxC: [1.7, 3.8, 9.1, 15.6, 21.2, 25.6, 27.7, 26.9, 23.5, 16.8, 9.6, 4.1],
      },
      asOf: '2026-10-28',
    });
  });
});

describe('Melbourne', () => {
  const p = () => profile('melbourne');

  it('is marginal: frost in about a third of years, no median last frost', () => {
    expect(p().frostClass).toBe('marginal');
    expect(p().frostYearsShare).toBeGreaterThan(0.2);
    expect(p().frostYearsShare).toBeLessThan(0.45);
    expect(p().lastFrost.p50).toBeNull();
    expect(p().firstFrost.p50).toBeNull();
    expect(p().hemisphere).toBe('south');
  });

  it('golden', () => {
    const { monthly, ...rest } = p();
    expect(rest).toEqual({
      source: 'computed',
      place: { name: 'Melbourne, Victoria', lat: -37.79, lon: 144.94, elevationM: 21 },
      years: [1995, 2024],
      hemisphere: 'south',
      warmestMonth: 1,
      frostClass: 'marginal',
      frostYearsShare: 0.31,
      lastFrost: { p50: null, p90: '07-21' },
      firstFrost: { p50: null, p10: '07-09' },
      firstHardFrost: { minus2: null, minus5: null },
      extremeMinC: 0.4,
      zone: '10a',
      asOf: '2026-10-28',
    });
    expect(monthly!.minC[6]).toBe(6.5);
  });
});

describe('Brisbane and Singapore', () => {
  it('are frost-free', () => {
    for (const slug of ['brisbane', 'singapore'] as const) {
      const p = profile(slug);
      expect(p.frostClass).toBe('none');
      expect(p.frostYearsShare).toBe(0);
      expect(p.lastFrost).toEqual({ p50: null, p90: null });
      expect(p.firstFrost).toEqual({ p50: null, p10: null });
      expect(p.firstHardFrost).toEqual({ minus2: null, minus5: null });
    }
  });

  it('golden', () => {
    expect(profile('brisbane')).toMatchObject({ warmestMonth: 1, hemisphere: 'south', extremeMinC: 5.4, zone: '11a' });
    expect(profile('singapore')).toMatchObject({ warmestMonth: 5, hemisphere: 'north', extremeMinC: 22.7, zone: '13b' });
  });
});

describe('Phoenix', () => {
  const p = () => profile('phoenix');

  it('has light winter frost and hot summers', () => {
    expect(['frost', 'marginal']).toContain(p().frostClass);
    for (const md of [p().lastFrost.p50, p().lastFrost.p90]) expect([1, 2]).toContain(month(md));
    expect(month(p().firstFrost.p50)).toBe(12);
    expect(Math.max(...p().monthly!.maxC.slice(5, 8))).toBeGreaterThan(38);
  });

  it('golden', () => {
    const { monthly, ...rest } = p();
    expect(rest).toEqual({
      source: 'computed',
      place: { name: 'Phoenix, Arizona', lat: 33.43, lon: -112.03, elevationM: 335 },
      years: [1995, 2024],
      hemisphere: 'north',
      warmestMonth: 7,
      frostClass: 'frost',
      frostYearsShare: 0.862,
      // The winter's frosts cluster from late November to mid-February.
      lastFrost: { p50: '01-09', p90: '02-12' },
      firstFrost: { p50: '12-25', p10: '11-30' },
      firstHardFrost: { minus2: null, minus5: null },
      extremeMinC: -1.2,
      zone: '9b',
      asOf: '2026-10-28',
    });
    expect(monthly!.maxC[6]).toBe(40.9);
  });
});

describe('Edinburgh', () => {
  it('golden: mid-April last frost, mid-November first frost, cool summer', () => {
    const { monthly, ...rest } = profile('edinburgh');
    expect(rest).toEqual({
      source: 'computed',
      place: { name: 'Edinburgh, Scotland', lat: 55.92, lon: -3.13, elevationM: 73 },
      years: [1995, 2024],
      hemisphere: 'north',
      warmestMonth: 7,
      frostClass: 'frost',
      frostYearsShare: 1,
      lastFrost: { p50: '04-15', p90: '05-01' },
      firstFrost: { p50: '11-15', p10: '10-29' },
      firstHardFrost: { minus2: '12-08', minus5: null },
      extremeMinC: -5.6,
      zone: '9a',
      asOf: '2026-10-28',
    });
    // Short on warmth rather than on frost-free days: July averages under 15 C.
    expect(monthly!.meanC[6]).toBeLessThan(15);
    expect(Math.max(...monthly!.maxC)).toBeLessThan(19);
  });
});

describe('invariants on every fixture', () => {
  it('LF90 is on or after LF50, FF10 on or before FF50, and first frost before last, within the season', () => {
    for (const slug of SLUGS) {
      const p = profile(slug);
      const wMd = monthDayFromCircular(monthMidDoy(p.warmestMonth));
      const { p50: lf50, p90: lf90 } = p.lastFrost;
      const { p50: ff50, p10: ff10 } = p.firstFrost;
      if (lf50 !== null && lf90 !== null) expect(daysWithinSeason(wMd, lf50, lf90)).toBeGreaterThanOrEqual(0);
      if (ff50 !== null && lf50 !== null) expect(daysWithinSeason(wMd, ff50, lf50)).toBeGreaterThanOrEqual(0);
      if (ff10 !== null && lf90 !== null) expect(daysWithinSeason(wMd, ff10, lf90)).toBeGreaterThanOrEqual(0);
      if (ff50 !== null && ff10 !== null) expect(daysWithinSeason(wMd, ff10, ff50)).toBeGreaterThanOrEqual(0);
      // A null median with a non-null tail is fine; the reverse is impossible.
      if (lf50 !== null) expect(lf90).not.toBeNull();
      if (ff50 !== null) expect(ff10).not.toBeNull();
      const { minus2, minus5 } = p.firstHardFrost;
      if (ff50 !== null && minus2 !== null) expect(daysWithinSeason(wMd, ff50, minus2)).toBeGreaterThanOrEqual(0);
      if (minus2 !== null && minus5 !== null) expect(daysWithinSeason(wMd, minus2, minus5)).toBeGreaterThanOrEqual(0);
      // Per season, too: the first frost never comes after the last.
      for (const s of analysis(slug).seasons) {
        if (s.firstFrost !== null) expect(s.lastFrost! >= s.firstFrost).toBe(true);
        expect(s.firstFrost === null).toBe(s.lastFrost === null);
      }
    }
  });

  it('give the same answer in any process time zone', () => {
    // The check also runs this file under TZ=Australia/Melbourne; the goldens above must hold there.
    expect(profile('canton-oh').lastFrost.p50).toBe('04-16');
  });
});
