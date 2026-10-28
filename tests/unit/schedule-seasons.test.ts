// Seasons, midsummer and the frost reference days of a season (SCHEDULE_SPEC.md section 1).
import { describe, expect, it } from 'vitest';
import { manualProfile } from '../../src/domain/climate/manual';
import { toDay, toIso } from '../../src/domain/dates';
import { coolRunBefore, midsummer, seasonLabel, seasonOf, seasonRefs } from '../../src/domain/schedule/seasons';
import { formatDay, formatRange } from '../../src/domain/schedule/reasons';
import { profileOf } from './schedule-helpers';

const iso = (d: number | null) => (d === null ? null : toIso(d));

describe('midsummer and frost reference days', () => {
  it('Canton 2027: LF50 Apr 16 and FF50 Nov 4 of the same year', () => {
    const r = seasonRefs(profileOf('canton-oh'), 2027);
    expect(iso(r.W)).toBe('2027-07-16');
    expect(iso(r.LF50)).toBe('2027-04-16');
    expect(iso(r.LF90)).toBe('2027-04-29');
    expect(iso(r.FF10)).toBe('2027-10-26');
    expect(iso(r.FF50)).toBe('2027-11-04');
    expect(iso(r.H2)).toBe('2027-11-12');
    expect(iso(r.H5)).toBe('2027-12-01');
    expect(r.end - r.start).toBe(364);
  });

  it('Phoenix 2027: a January last frost and a Christmas first frost', () => {
    const r = seasonRefs(profileOf('phoenix'), 2027);
    expect(iso(r.LF50)).toBe('2027-01-09');
    expect(iso(r.FF50)).toBe('2027-12-25');
  });

  it('southern seasons straddle the new year: Melbourne 2027 is midsummer Jan 2028', () => {
    const p = profileOf('melbourne');
    const r = seasonRefs(p, 2027);
    expect(iso(midsummer(p, 2027))).toBe('2028-01-16');
    expect(iso(r.LF90)).toBe('2027-07-21');
    expect(iso(r.FF10)).toBe('2028-07-09');
    expect(r.LF50).toBeNull();
    expect(seasonLabel(p, 2027)).toBe('2027-28');
    expect(seasonLabel(profileOf('canton-oh'), 2027)).toBe('2027');
  });

  it('a southern place with spring frost in October and fall frost in April', () => {
    const p = manualProfile({ lastFrost: '10-05', firstFrost: '04-20', hemisphere: 'south', asOf: '2026-10-28' });
    const r = seasonRefs(p, 2027);
    expect(iso(r.LF50)).toBe('2027-10-05');
    expect(iso(r.FF50)).toBe('2028-04-20');
  });
});

describe('seasonOf', () => {
  it('assigns each day to the season whose midsummer is nearest, across the new year', () => {
    const p = profileOf('canton-oh');
    expect(seasonOf(p, toDay('2027-01-13'))).toBe(2026);
    expect(seasonOf(p, toDay('2027-01-15'))).toBe(2027);
    expect(seasonOf(p, toDay('2027-07-16'))).toBe(2027);
    expect(seasonOf(p, toDay('2027-12-31'))).toBe(2027);
    const m = profileOf('melbourne');
    expect(seasonOf(m, toDay('2027-12-25'))).toBe(2027);
    expect(seasonOf(m, toDay('2027-06-01'))).toBe(2026);
  });

  it('covers every day exactly once over several years', () => {
    for (const p of [profileOf('canton-oh'), profileOf('brisbane')]) {
      let last = seasonOf(p, toDay('2025-01-01'));
      for (let d = toDay('2025-01-02'); d <= toDay('2031-12-31'); d++) {
        const s = seasonOf(p, d);
        expect(s === last || s === last + 1).toBe(true);
        last = s;
      }
    }
  });
});

describe('coolest months', () => {
  it('Canton: December to February; Melbourne: June to August', () => {
    const c = coolRunBefore(profileOf('canton-oh'), 2027)!;
    expect([iso(c.start), iso(c.end)]).toEqual(['2026-12-01', '2027-03-01']);
    const m = coolRunBefore(profileOf('melbourne'), 2027)!;
    expect([iso(m.start), iso(m.end)]).toEqual(['2027-06-01', '2027-09-01']);
  });
});

describe('date formatting', () => {
  it('reads "Apr 16"', () => {
    expect(formatDay(toDay('2027-04-16'))).toBe('Apr 16');
    expect(formatDay(toDay('2027-03-04'))).toBe('Mar 4');
    expect(formatRange({ start: toDay('2027-04-29'), end: toDay('2027-05-13') })).toBe('Apr 29 to May 13');
  });
});
