// The Open-Meteo client against a fake fetch. No network.
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ClimateProfileSchema } from '../../src/domain/climate/types';
import {
  ARCHIVE_TIMEOUT_MS,
  GEOCODING_TIMEOUT_MS,
  fetchDailyTemps,
  lastCompleteYears,
  OpenMeteoError,
  profileForPlace,
  searchPlaces,
  type FetchLike,
} from '../../src/platform/openmeteo';
import { circularDoy, monthDayOf, toDay, toIso } from '../../src/domain/dates';

function fakeFetch(respond: (url: URL) => { status?: number; body?: unknown; throws?: Error; notJson?: boolean }) {
  const calls: URL[] = [];
  const fn: FetchLike = async (url) => {
    const u = new URL(url);
    calls.push(u);
    const r = respond(u);
    if (r.throws) throw r.throws;
    const status = r.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (r.notJson) throw new SyntaxError('Unexpected token <');
        return r.body;
      },
    };
  };
  return { fn, calls };
}

async function rejection(p: Promise<unknown>): Promise<OpenMeteoError> {
  try {
    await p;
  } catch (err) {
    expect(err).toBeInstanceOf(OpenMeteoError);
    return err as OpenMeteoError;
  }
  throw new Error('expected a rejection');
}

const CANTON_HIT = {
  id: 5149222,
  name: 'Canton',
  latitude: 40.79895,
  longitude: -81.37845,
  elevation: 322,
  timezone: 'America/New_York',
  country: 'United States',
  admin1: 'Ohio',
};

describe('searchPlaces', () => {
  it('asks the geocoding API for 8 results and maps them', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { results: [CANTON_HIT, { name: 'Canton', latitude: 23.1, longitude: 113.3 }] } }));
    const hits = await searchPlaces('  Canton ', { fetch: fn });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.origin + calls[0]!.pathname).toBe('https://geocoding-api.open-meteo.com/v1/search');
    expect(calls[0]!.searchParams.get('name')).toBe('Canton');
    expect(calls[0]!.searchParams.get('count')).toBe('8');
    expect(hits).toEqual([
      {
        id: 5149222,
        name: 'Canton',
        region: 'Ohio',
        country: 'United States',
        lat: 40.79895,
        lon: -81.37845,
        elevationM: 322,
        timezone: 'America/New_York',
      },
      { name: 'Canton', lat: 23.1, lon: 113.3 },
    ]);
  });

  it('returns nothing for no hits and sends nothing for a one-letter query', async () => {
    const { fn, calls } = fakeFetch(() => ({ body: { generationtime_ms: 0.5 } }));
    expect(await searchPlaces('Zzyzxqq', { fetch: fn })).toEqual([]);
    expect(await searchPlaces('C', { fetch: fn })).toEqual([]);
    expect(calls).toHaveLength(1);
  });

  it('types its failures', async () => {
    const offline = fakeFetch(() => ({ throws: new TypeError('Failed to fetch') }));
    expect((await rejection(searchPlaces('Canton', { fetch: offline.fn }))).kind).toBe('network');

    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const cancelled = fakeFetch(() => ({ throws: abort }));
    expect((await rejection(searchPlaces('Canton', { fetch: cancelled.fn }))).kind).toBe('aborted');

    const busy = fakeFetch(() => ({ status: 429, body: { error: true, reason: 'Too many' } }));
    const e429 = await rejection(searchPlaces('Canton', { fetch: busy.fn }));
    expect(e429.kind).toBe('http');
    expect(e429.status).toBe(429);

    const broken = fakeFetch(() => ({ status: 400, body: { error: true, reason: 'Parameter count must be 1-100' } }));
    const e400 = await rejection(searchPlaces('Canton', { fetch: broken.fn }));
    expect(e400.status).toBe(400);
    expect(e400.message).toContain('Parameter count');

    const html = fakeFetch(() => ({ status: 502, notJson: true }));
    expect((await rejection(searchPlaces('Canton', { fetch: html.fn }))).status).toBe(502);

    const garbled = fakeFetch(() => ({ body: { results: [{ name: 'Canton' }] } }));
    expect((await rejection(searchPlaces('Canton', { fetch: garbled.fn }))).kind).toBe('bad-data');
  });
});

/** A fake archive answer: a sinusoid with frost from mid-November to mid-March. */
function archiveBody(url: URL) {
  const start = url.searchParams.get('start_date')!;
  const end = url.searchParams.get('end_date')!;
  const time: string[] = [];
  const tmin: (number | null)[] = [];
  const tmax: (number | null)[] = [];
  for (let d = toDay(start); d <= toDay(end); d++) {
    const doy = circularDoy(monthDayOf(d));
    const t = 5 + 10 * Math.cos((2 * Math.PI * (doy - circularDoy('07-16'))) / 365);
    time.push(toIso(d));
    tmin.push(Math.round(t * 100) / 100);
    tmax.push(Math.round((t + 10) * 100) / 100);
  }
  return {
    latitude: 40.808434,
    longitude: -81.43466,
    elevation: 322,
    timezone: 'America/New_York',
    daily_units: { time: 'iso8601', temperature_2m_min: '°C', temperature_2m_max: '°C' },
    daily: { time, temperature_2m_min: tmin, temperature_2m_max: tmax },
  };
}

describe('fetchDailyTemps and profileForPlace', () => {
  it('works out the last 30 complete years from a date passed in', () => {
    expect(lastCompleteYears('2026-10-28')).toEqual([1996, 2025]);
    expect(lastCompleteYears('2027-01-05')).toEqual([1996, 2025]);
    expect(lastCompleteYears('2027-01-11')).toEqual([1997, 2026]);
    expect(() => lastCompleteYears('2026-13-01')).toThrow();
  });

  it('requests the archive for whole years in local time', async () => {
    const { fn, calls } = fakeFetch((u) => ({ body: archiveBody(u) }));
    const temps = await fetchDailyTemps(40.7989, -81.3784, [1996, 2025], { fetch: fn });
    const q = calls[0]!.searchParams;
    expect(calls[0]!.origin + calls[0]!.pathname).toBe('https://archive-api.open-meteo.com/v1/archive');
    expect(q.get('start_date')).toBe('1996-01-01');
    expect(q.get('end_date')).toBe('2025-12-31');
    expect(q.get('daily')).toBe('temperature_2m_min,temperature_2m_max');
    expect(q.get('timezone')).toBe('auto');
    expect(temps.start).toBe('1996-01-01');
    expect(temps.tmin).toHaveLength(toDay('2025-12-31') - toDay('1996-01-01') + 1);
    expect(temps.lat).toBe(40.808434);
  });

  it('rejects a short or gappy answer as bad data', async () => {
    const short = fakeFetch((u) => {
      const b = archiveBody(u);
      b.daily.time.pop();
      return { body: b };
    });
    expect((await rejection(fetchDailyTemps(1, 2, [2000, 2001], { fetch: short.fn }))).kind).toBe('bad-data');

    const gappy = fakeFetch((u) => {
      const b = archiveBody(u);
      b.daily.temperature_2m_min = b.daily.temperature_2m_min.map((t, i) => (i % 5 === 0 ? null : t));
      return { body: b };
    });
    expect((await rejection(fetchDailyTemps(1, 2, [2000, 2001], { fetch: gappy.fn }))).kind).toBe('bad-data');
  });

  it('builds a profile for a place', async () => {
    const { fn } = fakeFetch((u) => ({ body: archiveBody(u) }));
    const p = await profileForPlace({ name: 'Canton', region: 'Ohio', lat: 40.79895, lon: -81.37845 }, [1996, 2025], '2026-10-28', fn);
    expect(p.source).toBe('computed');
    expect(p.place).toEqual({ name: 'Canton', region: 'Ohio', lat: 40.8, lon: -81.38, elevationM: 322 });
    expect(p.years).toEqual([1996, 2025]);
    expect(p.lastFrost).toEqual({ p50: '03-16', p90: '03-16' });
    expect(p.firstFrost).toEqual({ p50: '11-15', p10: '11-15' });
    expect(p.asOf).toBe('2026-10-28');
  });

  it('passes network failures through typed', async () => {
    const { fn } = fakeFetch(() => ({ throws: new TypeError('Failed to fetch') }));
    const err = await rejection(profileForPlace({ name: 'X', lat: 0, lon: 0 }, [1996, 2025], '2026-10-28', fn));
    expect(err.kind).toBe('network');
  });
});

describe('gaps, time limits and long names', () => {
  it('counts gaps in the maximums as well as the minimums', async () => {
    const gappyMax = fakeFetch((u) => {
      const b = archiveBody(u);
      b.daily.temperature_2m_max = b.daily.temperature_2m_max.map((t, i) => (i % 5 === 0 ? null : t));
      return { body: b };
    });
    const err = await rejection(fetchDailyTemps(1, 2, [2000, 2001], { fetch: gappyMax.fn }));
    expect(err.kind).toBe('bad-data');
    expect(err.message).toMatch(/gaps/);
  });

  /** A fetch that never answers, but gives up when its signal fires, as the real one does. */
  const stalled: FetchLike = (_url, init) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    });

  it('gives up with a timeout error when Open-Meteo does not answer', async () => {
    const search = await rejection(searchPlaces('Canton', { fetch: stalled, timeoutMs: 20 }));
    expect(search.kind).toBe('timeout');
    expect(search.message).toMatch(/too long/);
    expect((await rejection(fetchDailyTemps(1, 2, [2000, 2001], { fetch: stalled, timeoutMs: 20 }))).kind).toBe('timeout');
  });

  it('still reports a cancel by the caller as aborted, not as a timeout', async () => {
    const ctl = new AbortController();
    const p = searchPlaces('Canton', { fetch: stalled, signal: ctl.signal, timeoutMs: 10_000 });
    ctl.abort();
    expect((await rejection(p)).kind).toBe('aborted');
  });

  it('uses 10 s for the town search and 30 s for the archive by default', () => {
    expect(GEOCODING_TIMEOUT_MS).toBe(10_000);
    expect(ARCHIVE_TIMEOUT_MS).toBe(30_000);
  });

  it('caps place names so every hit can become a valid profile', async () => {
    const long = 'X'.repeat(500);
    const { fn } = fakeFetch(() => ({ body: { results: [{ ...CANTON_HIT, name: long, admin1: long, country: long }] } }));
    const [hit] = await searchPlaces('Canton', { fetch: fn });
    expect(hit!.name).toHaveLength(120);
    expect(hit!.region).toHaveLength(120);
    expect(hit!.country).toHaveLength(120);
    const profile = { source: 'manual', hemisphere: 'north', warmestMonth: 7, frostClass: 'frost', frostYearsShare: 1,
      lastFrost: { p50: '04-20', p90: '05-05' }, firstFrost: { p50: '10-15', p10: '10-01' }, firstHardFrost: { minus2: null, minus5: null },
      extremeMinC: null, zone: null, asOf: '2026-10-28' };
    expect(v.safeParse(ClimateProfileSchema, { ...profile, place: { name: 'X'.repeat(120), lat: 0, lon: 0 } }).success).toBe(true);
    expect(v.safeParse(ClimateProfileSchema, { ...profile, place: { name: 'X'.repeat(121), lat: 0, lon: 0 } }).success).toBe(false);
    expect(v.safeParse(ClimateProfileSchema, { ...profile, place: { name: 'X', region: long, lat: 0, lon: 0 } }).success).toBe(false);
  });
});
