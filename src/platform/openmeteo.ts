// Open-Meteo, from the browser: town search (geocoding API) and 30 years of daily temperatures
// (historical archive API), turned into a ClimateProfile. Both APIs are free and need no key.
//
// fetch is injectable so tests never touch the network. Nothing here reads the clock: callers pass
// the run of years (see lastCompleteYears) and the asOf date. Every request has a time limit (10 s
// for the town search, 30 s for 30 years of temperatures), so a stalled connection ends in a
// 'timeout' error the UI can explain instead of a spinner that never stops.
import * as v from 'valibot';
import { analyzeClimate, type ClimatePlace } from '../domain/climate/compute';
import { MAX_PLACE_TEXT, type ClimateProfile } from '../domain/climate/types';
import { isIsoDate, parseMonthDay, toDay, type IsoDate } from '../domain/dates';

export const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
export const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';

/** The slice of fetch these calls use, so a test can pass a plain function. */
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal | undefined },
) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export type OpenMeteoErrorKind = 'network' | 'http' | 'bad-data' | 'aborted' | 'timeout';

/** Time limits, in milliseconds. */
export const GEOCODING_TIMEOUT_MS = 10_000;
export const ARCHIVE_TIMEOUT_MS = 30_000;

/**
 * Every failure is one of these, so the UI can say something useful: "network" (offline or the
 * request never completed), "http" (the API answered with an error status, in `status`),
 * "bad-data" (an answer we could not use), "aborted" (the caller cancelled), "timeout" (no full
 * answer within the time limit).
 */
export class OpenMeteoError extends Error {
  override readonly name = 'OpenMeteoError';
  constructor(
    readonly kind: OpenMeteoErrorKind,
    message: string,
    readonly status?: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

export interface PlaceHit extends ClimatePlace {
  /** Open-Meteo's place id. */
  id?: number;
  /** IANA time zone, e.g. "America/New_York". */
  timezone?: string;
}

export interface SearchOptions {
  fetch?: FetchLike;
  /** Result count, 1-100; default 8. */
  count?: number;
  /** Language for place names, e.g. "en". */
  language?: string;
  signal?: AbortSignal;
  /** Time limit in milliseconds; default GEOCODING_TIMEOUT_MS. */
  timeoutMs?: number;
}

export interface DailyTemps {
  start: IsoDate;
  tmin: (number | null)[];
  tmax: (number | null)[];
  /** The grid cell that answered. */
  lat: number;
  lon: number;
  elevationM?: number;
  timezone?: string;
}

const defaultFetch: FetchLike = (url, init) => globalThis.fetch(url, init);

function timeoutError(cause: unknown): OpenMeteoError {
  return new OpenMeteoError('timeout', 'Open-Meteo took too long to answer. Check the connection and try again.', undefined, { cause });
}

async function getJson(url: string, fetchFn: FetchLike, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
  const timer = AbortSignal.timeout(timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timer]) : timer;
  let res: Awaited<ReturnType<FetchLike>>;
  try {
    res = await fetchFn(url, { signal: combined });
  } catch (err) {
    if (signal?.aborted) throw new OpenMeteoError('aborted', 'The request was cancelled.', undefined, { cause: err });
    if (timer.aborted || (err instanceof Error && err.name === 'TimeoutError')) throw timeoutError(err);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new OpenMeteoError('aborted', 'The request was cancelled.', undefined, { cause: err });
    }
    throw new OpenMeteoError('network', 'Could not reach Open-Meteo. Check the connection and try again.', undefined, {
      cause: err,
    });
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    // The body is read under the same signal, so a stall here is a timeout or a cancel too.
    if (signal?.aborted) throw new OpenMeteoError('aborted', 'The request was cancelled.', undefined, { cause: err });
    if (timer.aborted) throw timeoutError(err);
    if (!res.ok) throw new OpenMeteoError('http', `Open-Meteo answered with HTTP ${res.status}.`, res.status);
    throw new OpenMeteoError('bad-data', 'Open-Meteo sent something that is not JSON.', undefined, { cause: err });
  }
  if (!res.ok) {
    const reason =
      typeof body === 'object' && body !== null && typeof (body as { reason?: unknown }).reason === 'string'
        ? (body as { reason: string }).reason
        : undefined;
    const msg =
      res.status === 429
        ? 'Open-Meteo is busy (too many requests). Try again in a minute.'
        : `Open-Meteo answered with HTTP ${res.status}${reason ? `: ${reason}` : '.'}`;
    throw new OpenMeteoError('http', msg, res.status);
  }
  return body;
}

const GeoResult = v.object({
  id: v.optional(v.number()),
  name: v.string(),
  latitude: v.number(),
  longitude: v.number(),
  elevation: v.optional(v.nullable(v.number())),
  timezone: v.optional(v.nullable(v.string())),
  country: v.optional(v.nullable(v.string())),
  admin1: v.optional(v.nullable(v.string())),
});
const GeoResponse = v.object({ results: v.optional(v.array(GeoResult)) });

/** Towns matching a name. Fewer than two characters returns no hits without a request. */
export async function searchPlaces(query: string, opts: SearchOptions = {}): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ name: q, count: String(opts.count ?? 8), format: 'json' });
  if (opts.language) params.set('language', opts.language);
  const body = await getJson(`${GEOCODING_URL}?${params}`, opts.fetch ?? defaultFetch, opts.timeoutMs ?? GEOCODING_TIMEOUT_MS, opts.signal);
  const parsed = v.safeParse(GeoResponse, body);
  if (!parsed.success) throw new OpenMeteoError('bad-data', 'The town search sent an answer we could not read.');
  // Names are cut to what ClimateProfileSchema accepts, so a hit can always become a profile.
  const cut = (t: string) => t.slice(0, MAX_PLACE_TEXT);
  return (parsed.output.results ?? []).map((r) => ({
    ...(r.id !== undefined ? { id: r.id } : {}),
    name: cut(r.name),
    ...(r.admin1 ? { region: cut(r.admin1) } : {}),
    ...(r.country ? { country: cut(r.country) } : {}),
    lat: r.latitude,
    lon: r.longitude,
    ...(typeof r.elevation === 'number' ? { elevationM: r.elevation } : {}),
    ...(r.timezone ? { timezone: r.timezone } : {}),
  }));
}

const NumOrNull = v.nullable(v.number());
const ArchiveResponse = v.object({
  latitude: v.number(),
  longitude: v.number(),
  elevation: v.optional(v.nullable(v.number())),
  timezone: v.optional(v.nullable(v.string())),
  daily: v.object({
    time: v.array(v.string()),
    temperature_2m_min: v.array(NumOrNull),
    temperature_2m_max: v.array(NumOrNull),
  }),
});

/**
 * The run of complete calendar years ending last year, e.g. [1996, 2025] on 2026-10-28. In the first
 * ten days of January the archive may not have all of last year yet, so the run ends a year earlier.
 */
export function lastCompleteYears(today: IsoDate, count = 30): [number, number] {
  if (!isIsoDate(today)) throw new RangeError(`Not an ISO date: ${today}`);
  const year = Number(today.slice(0, 4));
  const { month, day } = parseMonthDay(today.slice(5));
  const end = month === 1 && day <= 10 ? year - 2 : year - 1;
  return [end - count + 1, end];
}

const round1 = (x: number | null) => (x === null ? null : Math.round(x * 10) / 10);

/** Daily minimum and maximum temperatures for the given years, inclusive, in local time. */
export async function fetchDailyTemps(
  lat: number,
  lon: number,
  years: [number, number],
  opts: { fetch?: FetchLike; signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<DailyTemps> {
  const [from, to] = years;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from > to) {
    throw new RangeError(`Bad year range: ${from}-${to}`);
  }
  const start = `${String(from).padStart(4, '0')}-01-01`;
  const end = `${String(to).padStart(4, '0')}-12-31`;
  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start_date: start,
    end_date: end,
    daily: 'temperature_2m_min,temperature_2m_max',
    timezone: 'auto',
  });
  const body = await getJson(`${ARCHIVE_URL}?${params}`, opts.fetch ?? defaultFetch, opts.timeoutMs ?? ARCHIVE_TIMEOUT_MS, opts.signal);
  const parsed = v.safeParse(ArchiveResponse, body);
  if (!parsed.success) throw new OpenMeteoError('bad-data', 'The temperature archive sent an answer we could not read.');
  const { daily } = parsed.output;
  const expected = toDay(end) - toDay(start) + 1;
  if (
    daily.time[0] !== start ||
    daily.time.length !== expected ||
    daily.temperature_2m_min.length !== expected ||
    daily.temperature_2m_max.length !== expected
  ) {
    throw new OpenMeteoError('bad-data', 'The temperature archive sent fewer days than asked for.');
  }
  const tmin = daily.temperature_2m_min.map(round1);
  const tmax = daily.temperature_2m_max.map(round1);
  // Both series must be at least 90% complete: the frost dates come from the minimums, but the
  // monthly normals (and so every heat guard) need the maximums too.
  const present = (xs: (number | null)[]) => xs.filter((t) => t !== null).length;
  if (present(tmin) < expected * 0.9 || present(tmax) < expected * 0.9) {
    throw new OpenMeteoError('bad-data', 'The temperature archive has too many gaps for this place.');
  }
  return {
    start,
    tmin,
    tmax,
    lat: parsed.output.latitude,
    lon: parsed.output.longitude,
    ...(typeof parsed.output.elevation === 'number' ? { elevationM: parsed.output.elevation } : {}),
    ...(parsed.output.timezone ? { timezone: parsed.output.timezone } : {}),
  };
}

/** Download the temperatures for a place and compute its climate profile. */
export async function profileForPlace(
  place: ClimatePlace,
  years: [number, number],
  asOf: IsoDate,
  fetchFn: FetchLike = defaultFetch,
  signal?: AbortSignal,
): Promise<ClimateProfile> {
  const temps = await fetchDailyTemps(place.lat, place.lon, years, { fetch: fetchFn, ...(signal ? { signal } : {}) });
  try {
    return analyzeClimate({
      start: temps.start,
      tmin: temps.tmin,
      tmax: temps.tmax,
      place: {
        ...place,
        ...(place.elevationM === undefined && temps.elevationM !== undefined ? { elevationM: temps.elevationM } : {}),
      },
      years,
      asOf,
    }).profile;
  } catch (err) {
    throw new OpenMeteoError('bad-data', 'The temperatures for this place could not be turned into frost dates.', undefined, {
      cause: err,
    });
  }
}

// ---- 7-day forecast, for frost warnings ------------------------------------------------------------

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const FORECAST_TIMEOUT_MS = 10_000;

export interface NightForecast {
  /** Local calendar date of the night's day. */
  date: IsoDate;
  minC: number;
  /** Rain and snow, mm. */
  precipMm: number | null;
}

const ForecastResponse = v.object({
  daily: v.object({
    time: v.array(v.string()),
    temperature_2m_min: v.array(v.nullable(v.number())),
    precipitation_sum: v.optional(v.array(v.nullable(v.number()))),
  }),
});

/** The next 7 days' overnight lows at a place, in its own time zone. */
export async function fetchForecast(lat: number, lon: number, opts: { fetch?: FetchLike; signal?: AbortSignal } = {}): Promise<NightForecast[]> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    daily: 'temperature_2m_min,precipitation_sum',
    timezone: 'auto',
    forecast_days: '7',
  });
  const body = await getJson(`${FORECAST_URL}?${params}`, opts.fetch ?? defaultFetch, FORECAST_TIMEOUT_MS, opts.signal);
  const parsed = v.safeParse(ForecastResponse, body);
  if (!parsed.success) throw new OpenMeteoError('bad-data', 'The forecast was not in the expected form.');
  const d = parsed.output.daily;
  const out: NightForecast[] = [];
  d.time.forEach((date, i) => {
    const minC = d.temperature_2m_min[i];
    if (typeof minC === 'number' && isIsoDate(date)) out.push({ date, minC, precipMm: d.precipitation_sum?.[i] ?? null });
  });
  return out;
}
