// Lint for the built-in plant library. Every plant file must pass this before it ships.
import { describe, expect, it } from 'vitest';
import { COMPANIONS, PLANTS, PLANTS_BY_ID } from '../../src/domain/plants/library';
import type { Plant } from '../../src/domain/plants/schema';

const MONTHS = /\b(Jan(uary)?|Feb(ruary)?|Mar(ch)?|Apr(il)?|May|June?|July?|Aug(ust)?|Sept?(ember)?|Oct(ober)?|Nov(ember)?|Dec(ember)?)\.?\s+\d/;
const PLACES = /\b(Ohio|Canton|Zone\s*\d|zone\s*\d|USDA|Midwest|Australia|UK|England|Florida|California|Texas)\b/;
const EM_DASH = /\u2014/;
// Measurements in notes are tokens the app formats for the gardener's units: {c:21} is a
// temperature in C, {cm:0.6} a length in cm. Bare units in prose are not allowed.
const TOKEN = /\{(c|cm):-?\d+(\.\d+)?\}/g;
const BARE_UNIT = /\u00b0|\d\s*(cm|mm|m|in|inch|inches|ft|feet|F|C)\b|[{}]/;

// GardenSync writes US English (decision D-A10). Common British spellings, with their usual
// endings, so "colours", "favourite", "fertiliser" and "organised" are caught too. Source titles are
// left alone: they are the pages' own titles.
const BRITISH = new RegExp(
  '\\b(' +
    [
      '\\w*colour\\w*',
      'flavour\\w*',
      'neighbour\\w*',
      'favour\\w*',
      'centre[sd]?',
      'metres?',
      'litres?',
      'fertilis\\w*',
      'organis\\w*',
      'recognis\\w*',
      'harbour\\w*',
      'mould\\w*',
      'grey\\w*',
      'aluminium',
      'programmes?',
      'sceptic\\w*',
      'plough\\w*',
      'storeys?',
      'tonnes?',
      'travell\\w*',
      'catalogue[sd]?',
      'vigour',
      // D-A10 also names "fall" for the season.
      'autumn\\w*',
    ].join('|') +
    ')\\b',
  'i',
);

const notesOf = (p: Plant) => [p.notes.sowing, p.notes.care, p.notes.harvest];

describe('plant library', () => {
  it('has plants', () => {
    expect(PLANTS.length).toBeGreaterThan(0);
  });

  it('has unique ids and names', () => {
    expect(new Set(PLANTS.map((p) => p.id)).size).toBe(PLANTS.length);
    expect(new Set(PLANTS.map((p) => p.name.toLowerCase())).size).toBe(PLANTS.length);
  });

  for (const p of PLANTS) {
    describe(p.id, () => {
      it('has notes with no absolute dates, place names or em dashes', () => {
        for (const n of notesOf(p)) {
          expect(n, `${p.id}: absolute date in "${n}"`).not.toMatch(MONTHS);
          expect(n, `${p.id}: place name in "${n}"`).not.toMatch(PLACES);
          expect(n, `${p.id}: em dash in "${n}"`).not.toMatch(EM_DASH);
          expect(n.replace(TOKEN, ''), `${p.id}: bare unit or bad token in "${n}"`).not.toMatch(BARE_UNIT);
        }
      });

      it('uses US spelling in its name and notes', () => {
        for (const t of [p.name, ...notesOf(p)]) {
          expect(t, `${p.id}: British spelling in "${t}"`).not.toMatch(BRITISH);
        }
      });

      it('cites at least two sources', () => {
        expect(p.sources.length).toBeGreaterThanOrEqual(2);
        expect(new Set(p.sources.map((s) => s.url)).size).toBe(p.sources.length);
      });

      it('has a consistent timeline', () => {
        if (p.methods.transplant) expect(p.methods.indoor, `${p.id}: transplant needs indoor ageWeeks`).toBeDefined();
        if (p.maturity.from === 'transplant') {
          expect(p.methods.transplant ?? p.methods.plant, `${p.id}: maturity from transplant but no transplant or plant method`).toBeDefined();
        }
        if (p.fruitSetMaxC !== undefined) expect(p.fruitSetMaxC).toBeGreaterThan(p.temp.maxC);
        if (p.lifecycle === 'perennial' && p.category !== 'flower' && p.category !== 'herb') {
          expect(p.perennial, `${p.id}: perennial crop needs a perennial block`).toBeDefined();
        }
        if (p.perennial) expect(p.lifecycle).toBe('perennial');
        if (p.overwinter) expect(p.frost).not.toBe('tender');
      });

      it('has a density that matches its spacing', () => {
        // Square-foot density and row spacing come from different traditions, so this is a sanity
        // band, not an equation: a 30 cm square holds roughly (30 / inRow)^2 plants.
        const implied = (30 / p.spacingCm.inRow) ** 2;
        if ('perSquare' in p.density) {
          expect(p.density.perSquare, `${p.id}: perSquare ${p.density.perSquare} vs spacing ${p.spacingCm.inRow} cm`).toBeLessThanOrEqual(Math.max(1, implied * 2.5));
          expect(p.density.perSquare).toBeGreaterThanOrEqual(Math.min(16, Math.floor(implied / 3)));
        } else {
          const [w, h] = p.density.squares;
          expect(w * h, `${p.id}: ${w}x${h} squares for one plant at ${p.spacingCm.inRow} cm`).toBeLessThanOrEqual(Math.max(1, Math.ceil(1 / implied) * 2.5));
        }
      });
    });
  }

  it('has companions that resolve, without duplicate pairs', () => {
    const seen = new Set<string>();
    for (const c of COMPANIONS) {
      expect(PLANTS_BY_ID.has(c.a), `unknown plant ${c.a}`).toBe(true);
      expect(PLANTS_BY_ID.has(c.b), `unknown plant ${c.b}`).toBe(true);
      expect(c.a, 'a plant cannot be its own companion').not.toBe(c.b);
      const key = [c.a, c.b].sort().join('|');
      expect(seen.has(key), `duplicate pair ${key}`).toBe(false);
      seen.add(key);
      expect(c.reason).not.toMatch(EM_DASH);
      expect(c.reason, `${key}: British spelling in "${c.reason}"`).not.toMatch(BRITISH);
    }
  });
});
