import { describe, expect, it } from 'vitest';
import { adjustFrost, resetFrost } from '../../src/domain/climate/adjust';
import { manualProfile } from '../../src/domain/climate/manual';

const base = manualProfile({ lastFrost: '04-16', firstFrost: '11-04', asOf: '2027-01-01' });

describe('adjusting frost dates', () => {
  it('moves both quantiles of a date together and records the shift', () => {
    const later = adjustFrost(base, 'lastFrost', 7);
    expect(later.lastFrost.p50).toBe('04-23');
    expect(later.lastFrost.p90).toBe('05-07');
    expect(later.adjustedDays).toEqual({ lastFrost: 7, firstFrost: 0 });
    expect(later.firstFrost).toEqual(base.firstFrost);
  });

  it('wraps the year and resets exactly', () => {
    const p = adjustFrost(adjustFrost(base, 'firstFrost', 60), 'lastFrost', -14);
    expect(p.firstFrost.p50).toBe('01-03');
    const back = resetFrost(p);
    expect(back.lastFrost).toEqual(base.lastFrost);
    expect(back.firstFrost).toEqual(base.firstFrost);
    expect(back.adjustedDays).toBeUndefined();
  });

  it('refuses to move a date more than 60 days in total', () => {
    const far = adjustFrost(base, 'lastFrost', 56);
    expect(adjustFrost(far, 'lastFrost', 7)).toBe(far);
  });
});
