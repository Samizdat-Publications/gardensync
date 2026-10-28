#!/usr/bin/env node
// Download 30 years of daily minimum and maximum temperature for a place from the Open-Meteo
// historical archive and write it as a gzipped test fixture.
//
//   node scripts/fetch-climate-fixture.mjs                         # every place in PLACES below
//   node scripts/fetch-climate-fixture.mjs canton-oh               # one place from PLACES
//   node scripts/fetch-climate-fixture.mjs my-town "My Town" 51.5 -0.12   # any place
//
// Output: tests/fixtures/climate/<slug>.json.gz holding
//   {slug, name, lat, lon, elevation, timezone, start: "1995-01-01", tmin: (number|null)[], tmax: (number|null)[]}
// with temperatures in degrees C rounded to 0.1. lat, lon and elevation are the grid cell Open-Meteo
// answered with, not the coordinates asked for.
//
// The archive API is free and shared, so requests go one at a time with a pause between them.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const START = '1995-01-01';
const END = '2024-12-31';
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const PAUSE_MS = 1500;

export const PLACES = {
  'canton-oh': { name: 'Canton, Ohio', lat: 40.7989, lon: -81.3784 },
  melbourne: { name: 'Melbourne, Victoria', lat: -37.81, lon: 144.96 },
  phoenix: { name: 'Phoenix, Arizona', lat: 33.45, lon: -112.07 },
  brisbane: { name: 'Brisbane, Queensland', lat: -27.47, lon: 153.03 },
  singapore: { name: 'Singapore', lat: 1.35, lon: 103.82 },
  edinburgh: { name: 'Edinburgh, Scotland', lat: 55.95, lon: -3.19 },
};

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'tests', 'fixtures', 'climate');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const round1 = (x) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x * 10) / 10 : null);

async function fetchPlace(slug, { name, lat, lon }) {
  const url = new URL(ARCHIVE);
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    start_date: START,
    end_date: END,
    daily: 'temperature_2m_min,temperature_2m_max',
    timezone: 'auto',
  }).toString();

  let res;
  for (let attempt = 1; ; attempt++) {
    res = await fetch(url, { headers: { 'user-agent': 'GardenSync test-fixture script' } });
    if (res.ok) break;
    if (res.status === 429 && attempt < 4) {
      const wait = 60_000 * attempt;
      console.warn(`  ${slug}: rate limited, waiting ${wait / 1000} s`);
      await sleep(wait);
      continue;
    }
    throw new Error(`${slug}: HTTP ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  const time = body?.daily?.time;
  const tmin = body?.daily?.temperature_2m_min;
  const tmax = body?.daily?.temperature_2m_max;
  if (!Array.isArray(time) || !Array.isArray(tmin) || !Array.isArray(tmax)) {
    throw new Error(`${slug}: response has no daily arrays`);
  }
  if (time[0] !== START || tmin.length !== time.length || tmax.length !== time.length) {
    throw new Error(`${slug}: unexpected shape (first day ${time[0]}, ${time.length} days)`);
  }
  const fixture = {
    slug,
    name,
    lat: body.latitude,
    lon: body.longitude,
    elevation: body.elevation,
    timezone: body.timezone,
    start: START,
    tmin: tmin.map(round1),
    tmax: tmax.map(round1),
  };
  await mkdir(outDir, { recursive: true });
  const file = join(outDir, `${slug}.json.gz`);
  await writeFile(file, gzipSync(JSON.stringify(fixture), { level: 9 }));
  const nulls = fixture.tmin.filter((x) => x === null).length;
  console.log(`  ${slug}: ${time.length} days, ${nulls} null Tmin, grid ${body.latitude}, ${body.longitude} -> ${file}`);
}

async function main() {
  const [slug, name, lat, lon] = process.argv.slice(2);
  let jobs;
  if (!slug) jobs = Object.entries(PLACES);
  else if (name && lat && lon) jobs = [[slug, { name, lat: Number(lat), lon: Number(lon) }]];
  else if (PLACES[slug]) jobs = [[slug, PLACES[slug]]];
  else {
    console.error(`Unknown place "${slug}". Known: ${Object.keys(PLACES).join(', ')}, or pass slug name lat lon.`);
    process.exit(1);
  }
  for (let i = 0; i < jobs.length; i++) {
    if (i > 0) await sleep(PAUSE_MS);
    const [s, p] = jobs[i];
    await fetchPlace(s, p);
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
