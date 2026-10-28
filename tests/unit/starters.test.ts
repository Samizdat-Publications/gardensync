import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { computeClimateProfile } from '../../src/domain/climate/compute';
import { checkDoc } from '../../src/domain/doc/check';
import { applyOp } from '../../src/domain/doc/ops';
import { DocSchema, emptyDoc } from '../../src/domain/doc/schema';
import { starterOps, type StarterKind } from '../../src/domain/doc/starters';
import { plantById } from '../../src/domain/plants/library';
import { plantingPhases, tasksFor } from '../../src/domain/schedule';
import { toDay } from '../../src/domain/dates';
import { profileOf } from './schedule-helpers';

const fixture = JSON.parse(gunzipSync(readFileSync('tests/fixtures/climate/canton-oh.json.gz')).toString());
const climate = computeClimateProfile({ start: fixture.start, tmin: fixture.tmin, tmax: fixture.tmax, asOf: '2027-01-15' });

function build(kind: StarterKind, units: 'imperial' | 'metric', withClimate: boolean) {
  let n = 0;
  const ops = starterOps({ kind, gardenId: 'g1', name: 'Back garden', today: '2027-01-15', units, climate: withClimate ? climate : null, newId: () => `id${n++}` });
  const res = applyOp(emptyDoc(), { type: 'batch', ops });
  if (!res.ok) throw new Error(res.error);
  return res.doc;
}

describe('starter gardens', () => {
  for (const kind of ['first-bed', 'patio', 'empty'] as const) {
    for (const units of ['imperial', 'metric'] as const) {
      it(`${kind} (${units}) builds a valid, consistent garden`, () => {
        const doc = build(kind, units, true);
        expect(v.safeParse(DocSchema, doc).success).toBe(true);
        expect(checkDoc(doc)).toEqual([]);
        expect(doc.settings.activeGardenId).toBe('g1');
        expect(doc.gardens[0]?.cellCm).toBe(units === 'metric' ? 30 : 30.48);
      });
    }
  }

  it('gives every starter planting real dates from the climate', () => {
    const doc = build('first-bed', 'imperial', true);
    const g = doc.gardens[0]!;
    expect(g.plantings.length).toBeGreaterThan(10);
    for (const p of g.plantings) {
      const phases = plantingPhases(p, plantById(p.plantId)!, g.climate);
      expect(phases, p.plantId).not.toBeNull();
    }
  });

  it('works before the gardener has given a town', () => {
    const doc = build('patio', 'imperial', false);
    expect(doc.gardens[0]?.climate).toBeNull();
    expect(checkDoc(doc)).toEqual([]);
  });

  it('plans a garden started after midsummer for next season', () => {
    let n = 0;
    const ops = starterOps({ kind: 'first-bed', gardenId: 'g1', name: 'G', today: '2026-10-28', units: 'imperial', climate, newId: () => `id${n++}` });
    const res = applyOp(emptyDoc(), { type: 'batch', ops });
    if (!res.ok) throw new Error(res.error);
    const anchors = res.doc.gardens[0]!.plantings.map((p) => (p.anchor.kind === 'auto' ? p.anchor.season : 0));
    expect(new Set(anchors)).toEqual(new Set([2027]));
  });
});

describe('a starter garden begun in any month has nothing already late', () => {
  for (const place of ['canton-oh', 'melbourne', 'phoenix', 'brisbane'] as const) {
    for (const today of ['2026-02-10', '2026-05-20', '2026-08-01', '2026-10-28']) {
      it(`${place}, started ${today}`, () => {
        const c = profileOf(place);
        let n = 0;
        const ops = starterOps({ kind: 'first-bed', gardenId: 'g1', name: 'G', today, units: 'imperial', climate: c, newId: () => `id${n++}` });
        const res = applyOp(emptyDoc(), { type: 'batch', ops });
        if (!res.ok) throw new Error(res.error);
        const t = toDay(today);
        for (const p of res.doc.gardens[0]!.plantings) {
          const ph = plantingPhases(p, plantById(p.plantId)!, c);
          if (!ph) continue;
          // Nothing goes in (or starts indoors) before the day the garden was made.
          expect(ph.indoor?.start ?? ph.bedIn, `${p.plantId}`).toBeGreaterThanOrEqual(t);
        }
      });
    }
  }
});

describe("a job's date always agrees with the reason it gives", () => {
  for (const place of ['canton-oh', 'edinburgh', 'phoenix'] as const) {
    for (const today of ['2026-03-01', '2026-04-14', '2026-06-10']) {
      it(`${place}, garden started ${today}`, () => {
        const c = profileOf(place);
        let n = 0;
        const ops = starterOps({ kind: 'first-bed', gardenId: 'g1', name: 'G', today, units: 'imperial', climate: c, newId: () => `id${n++}` });
        const res = applyOp(emptyDoc(), { type: 'batch', ops });
        if (!res.ok) throw new Error(res.error);
        const g = res.doc.gardens[0]!;
        const plants = new Map(g.plantings.map((p) => [p.plantId, plantById(p.plantId)!]));
        const t = toDay(today);
        for (const task of tasksFor(g, plants, t, t + 400)) {
          const r = task.reason;
          const label = `${task.plantId} ${task.kind} on ${task.date}`;
          if (r.code === 'frost-offset') {
            const weeks = (task.date - r.lastFrost) / 7;
            expect(weeks, label).toBeGreaterThanOrEqual(r.weeks[0] - 0.5);
            expect(weeks, label).toBeLessThanOrEqual(r.weeks[1] + 0.5);
          }
          if (r.code === 'late-planting') expect(task.date, label).toBeGreaterThan(r.usualEnd);
          if (r.code === 'held-to-lf90' || r.code === 'soil-warm') expect(task.date, label).toBeGreaterThanOrEqual(r.day);
        }
      });
    }
  }
});
