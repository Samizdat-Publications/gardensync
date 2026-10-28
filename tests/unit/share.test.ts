// Share links: round trip, size, what is left out, and hostile input.
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import type { ClimateProfile } from '../../src/domain/climate/types';
import { migrateV7Export } from '../../src/domain/doc/migrate-v7';
import { GardenSchema, type Garden, type Planting } from '../../src/domain/doc/schema';
import { MAX_SHARE_BYTES, SHARE_PREFIX, decodeShare, encodeShare } from '../../src/domain/doc/share';

const CLIMATE: ClimateProfile = {
  source: 'manual',
  place: { name: 'Testville', lat: 40.7989, lon: -81.3784, elevationM: 320 },
  hemisphere: 'north',
  warmestMonth: 7,
  frostClass: 'frost',
  frostYearsShare: 1,
  lastFrost: { p50: '04-20', p90: '05-05' },
  firstFrost: { p50: '10-15', p10: '10-01' },
  firstHardFrost: { minus2: '10-25', minus5: '11-10' },
  extremeMinC: -21,
  zone: '6a',
  asOf: '2026-10-28',
};

/** A migrated demo with records and a climate added, so the exclusions have something to exclude. */
function richGarden(): Garden {
  let n = 0;
  const file = JSON.parse(readFileSync(join(__dirname, '..', 'fixtures', 'v7', 'salsa-pizza.export.json'), 'utf8')) as unknown;
  const r = migrateV7Export(file, { today: '2026-10-28', newId: () => `id${++n}` });
  if ('error' in r) throw new Error(r.error);
  const g = r.garden;
  return {
    ...g,
    climate: CLIMATE,
    series: [{ id: 'series1', plantId: 'cilantro', everyDays: 21 }],
    customPlants: [{ id: 'roma', name: 'Roma', parent: 'tomato', category: 'vegetable', frost: 'tender', maturity: { days: 80, from: 'transplant' } }],
    plantings: g.plantings.map((p, i) => (i === 0 ? { ...p, notes: 'Café note', actual: { bedIn: '2026-05-10' } } : p)),
    harvests: [{ id: 'h1', plantId: 'tomato', date: '2026-08-01', grams: 500 }],
    journal: [{ id: 'j1', date: '2026-06-01', text: 'Private note' }],
    taskState: { 'tomato-transplant': '2026-05-10' },
  };
}

/** The garden as a recipient should see it. */
function shared(g: Garden, climate: ClimateProfile | null): Garden {
  const { legacy: _legacy, ...rest } = g;
  return { ...rest, climate, harvests: [], journal: [], taskState: {} };
}

/** A typical 3-bed garden: three 4 x 8 beds, every square planted, with random UUID ids. */
function threeBeds(): Garden {
  const crops = ['tomato', 'basil', 'pepper', 'lettuce', 'carrot', 'onion', 'kale', 'marigold'];
  const containers = [0, 1, 2].map((i) => ({
    id: randomUUID(),
    form: 'grid' as const,
    kind: 'raised-bed' as const,
    name: `Bed ${i + 1}`,
    x: i * 150,
    y: 0,
    cols: 8,
    rows: 4,
    rotation: 0 as const,
  }));
  const plantings: Planting[] = containers.flatMap((c, ci) =>
    Array.from({ length: 32 }, (_, k) => ({
      id: randomUUID(),
      containerId: c.id,
      plantId: crops[(k + ci) % crops.length] as string,
      cells: { col: k % 8, row: Math.floor(k / 8), w: 1, h: 1 },
      count: 1 + (k % 4),
      method: 'direct' as const,
      anchor: { kind: 'auto' as const, window: 'spring' as const, season: 2027, offsetDays: 0 },
    })),
  );
  return {
    id: randomUUID(),
    name: 'Back garden',
    createdAt: '2026-10-28',
    cellCm: 30.48,
    climate: null,
    containers,
    plantings,
    series: [],
    harvests: [],
    journal: [],
    customPlants: [],
    taskState: {},
  };
}

async function deflateRaw(bytes: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64url');
/** A hand-made share text around any JSON value. */
async function shareOf(value: unknown): Promise<string> {
  return SHARE_PREFIX + b64url(await deflateRaw(new TextEncoder().encode(JSON.stringify(value))));
}

describe('share links', () => {
  it('round trips the plan and leaves out records and location', async () => {
    const g = richGarden();
    const text = await encodeShare(g, { includeLocation: false });
    expect(text.startsWith(SHARE_PREFIX)).toBe(true);
    expect(text).toMatch(/^g1\.[A-Za-z0-9_-]+$/);
    const r = await decodeShare(text);
    if ('error' in r) throw new Error(r.error);
    expect(r.garden).toEqual(shared(g, null));
    expect(v.safeParse(GardenSchema, r.garden).success).toBe(true);
    const inflatedText = JSON.stringify(r.garden);
    expect(inflatedText).not.toContain('Private note');
    expect(inflatedText).not.toContain('Testville');
  });

  it('includes the location only when asked, rounded to 0.1 degree', async () => {
    const g = richGarden();
    const r = await decodeShare(await encodeShare(g, { includeLocation: true }));
    if ('error' in r) throw new Error(r.error);
    const place = { ...CLIMATE.place!, lat: 40.8, lon: -81.4 };
    expect(r.garden).toEqual(shared(g, { ...CLIMATE, place }));
    // The sender's garden is untouched.
    expect(g.climate?.place?.lat).toBe(40.7989);
  });

  it('encodes a typical 3-bed garden in under 8 KB', async () => {
    const text = await encodeShare(threeBeds(), { includeLocation: false });
    expect(text.length).toBeLessThan(8 * 1024);
  });

  it('accepts a whole URL or a hash', async () => {
    const text = await encodeShare(threeBeds(), { includeLocation: false });
    for (const wrapped of [`#share=${text}`, `https://gardensync.example/#share=${text}`, ` ${text} `]) {
      expect('garden' in (await decodeShare(wrapped))).toBe(true);
    }
  });

  it('rejects garbage', async () => {
    const valid = await encodeShare(threeBeds(), { includeLocation: false });
    const cases = [
      '',
      'hello',
      'g1.',
      'g1.!!!!',
      'g1.' + b64url(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9])),
      valid.slice(0, valid.length - 40),
      await shareOf('just a string'),
      await shareOf({ v: 2, name: 'Future' }),
      await shareOf({ v: 1, name: '' }),
      SHARE_PREFIX + b64url(await deflateRaw(new Uint8Array([0xff, 0xfe, 0x00]))),
      null as unknown as string,
    ];
    for (const text of cases) {
      const r = await decodeShare(text);
      expect('error' in r, String(text).slice(0, 30)).toBe(true);
    }
  });

  it('rejects a plan that points at beds or plants that do not exist', async () => {
    const g = threeBeds();
    const payload = { v: 1, ...shared(g, null) };
    const orphan = { ...payload, plantings: [{ ...g.plantings[0]!, containerId: 'nowhere' }] };
    const unknownPlant = { ...payload, plantings: [{ ...g.plantings[0]!, plantId: 'triffid' }] };
    expect(await decodeShare(await shareOf(orphan))).toMatchObject({ error: expect.stringContaining('bed') });
    expect(await decodeShare(await shareOf(unknownPlant))).toMatchObject({ error: expect.stringContaining('triffid') });
  });

  it('rejects oversized input and zip bombs', async () => {
    expect('error' in (await decodeShare('g1.' + 'A'.repeat(300_000)))).toBe(true);
    // A few KB that inflate to more than the cap.
    const bomb = SHARE_PREFIX + b64url(await deflateRaw(new Uint8Array(MAX_SHARE_BYTES * 4).fill(0x20)));
    expect(bomb.length).toBeLessThan(16 * 1024);
    const r = await decodeShare(bomb);
    expect(r).toMatchObject({ error: expect.stringContaining('more than a garden plan') });
  });
});
