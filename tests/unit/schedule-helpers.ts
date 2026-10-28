// Shared helpers for the schedule tests: climate fixtures and the readable golden line format.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { analyzeClimate } from '../../src/domain/climate/compute';
import type { ClimateProfile } from '../../src/domain/climate/types';
import { partsFromDay, type DayNum, type DayRange } from '../../src/domain/dates';
import type { PlantSchedule, ScheduleWindow } from '../../src/domain/schedule/windows';

export const PLACES = ['canton-oh', 'melbourne', 'phoenix', 'brisbane', 'singapore', 'edinburgh'] as const;
export type Place = (typeof PLACES)[number];

const profiles = new Map<string, ClimateProfile>();

/** The climate profile of a fixture place (30 years of Open-Meteo data, 1995-2024). */
export function profileOf(slug: Place): ClimateProfile {
  let p = profiles.get(slug);
  if (!p) {
    const url = new URL(`../fixtures/climate/${slug}.json.gz`, import.meta.url);
    const f = JSON.parse(gunzipSync(readFileSync(url)).toString('utf8')) as {
      name: string;
      lat: number;
      lon: number;
      elevation: number;
      start: string;
      tmin: (number | null)[];
      tmax: (number | null)[];
    };
    p = analyzeClimate({
      start: f.start,
      tmin: f.tmin,
      tmax: f.tmax,
      place: { name: f.name, lat: f.lat, lon: f.lon, elevationM: f.elevation },
      asOf: '2026-10-28',
    }).profile;
    profiles.set(slug, p);
  }
  return p;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Mar 04", with the year when it differs from the season's main year. */
export function md(d: DayNum, year?: number): string {
  const { year: y, month, day } = partsFromDay(d);
  const base = `${MONTHS[month - 1]} ${String(day).padStart(2, '0')}`;
  return year !== undefined && y !== year ? `${base} ${y}` : base;
}

export function rng(r: DayRange, year?: number): string {
  return `${md(r.start, year)} to ${md(r.end, year)}`;
}

const VERB = { transplant: 'out', direct: 'sow', plant: 'plant' } as const;

/** One line per window, plus one per not-viable window. */
export function goldenLines(place: string, s: PlantSchedule): string[] {
  const y = s.season;
  const lines: string[] = [];
  for (const w of s.windows) lines.push(windowLine(place, s.plantId, w, y));
  for (const n of s.notViable) lines.push(`${place} ${s.plantId} ${n.kind}${n.method ? ` ${n.method}` : ''}: not viable (${n.reason.code})`);
  return lines;
}

function windowLine(place: string, plantId: string, w: ScheduleWindow, y: number): string {
  const parts: string[] = [];
  if (w.indoor) parts.push(`indoor ${rng(w.indoor, y)}`);
  parts.push(`${VERB[w.method]} ${rng(w.bedIn, y)}`);
  parts.push(`pick ${rng(w.harvest, y)}`);
  if (w.rounds) parts.push(`rounds ${w.rounds.map((d) => md(d, y)).join(', ')}`);
  if (w.reasons.some((r) => r.code === 'season-long')) parts.push('spring through fall');
  if (w.yearly && w.yearly.length > 1) parts.push(`yearly from ${w.yearly[0]!.season}`);
  const warn = w.warnings.map((r) => r.code).filter((c) => c !== 'approximate');
  if (warn.length) parts.push(`warn ${[...new Set(warn)].join(' ')}`);
  return `${place} ${plantId} ${w.kind} ${w.method}: ${parts.join(', ')}`;
}
