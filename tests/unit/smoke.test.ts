import { describe, expect, it } from 'vitest';
import { APP_VERSION } from '../../src/version';

describe('smoke', () => {
  it('has an 8.x version', () => {
    expect(APP_VERSION.startsWith('8.')).toBe(true);
  });

  it('runs in the time zone the check asked for', () => {
    if (process.env.TZ) {
      expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe(process.env.TZ);
    }
  });
});
