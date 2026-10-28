import { describe, expect, it } from 'vitest';
import type { CustomPlant } from '../../src/domain/doc/schema';
import { PLANTS, plantById } from '../../src/domain/plants/library';
import { allPlants, CATEGORY_DEFAULTS, resolvePlant, wouldCreateCycle } from '../../src/domain/plants/resolve';
import { CATEGORIES, PlantSchema } from '../../src/domain/plants/schema';
import * as v from 'valibot';

const sungold: CustomPlant = {
  id: 'sungold',
  name: 'Sungold',
  parent: 'tomato',
  category: 'vegetable',
  frost: 'tender',
  maturity: { days: 57, from: 'transplant' },
};

const groundCherry: CustomPlant = {
  id: 'ground-cherry',
  name: 'Ground cherry',
  category: 'fruit',
  frost: 'tender',
  maturity: { days: 70, from: 'transplant' },
  family: 'Solanaceae',
};

describe('resolvePlant', () => {
  it('returns built-in plants as they are', () => {
    const r = resolvePlant('tomato', []);
    expect(r?.plant).toBe(plantById('tomato'));
    expect(r?.inheritedFrom).toBeNull();
    expect(r?.custom).toBe(false);
  });

  it('returns undefined for an unknown id', () => {
    expect(resolvePlant('triffid', [sungold])).toBeUndefined();
  });

  it('merges a variety over its parent', () => {
    const r = resolvePlant('sungold', [sungold])!;
    const tomato = plantById('tomato')!;
    expect(r.inheritedFrom).toBe('parent');
    expect(r.parentId).toBe('tomato');
    expect(r.custom).toBe(true);
    expect(r.plant.id).toBe('sungold');
    expect(r.plant.name).toBe('Sungold');
    expect(r.plant.maturity.days).toBe(57);
    expect(r.plant.family).toBe('Solanaceae');
    expect(r.plant.density).toEqual(tomato.density);
    expect(r.plant.notes).toEqual(tomato.notes);
    expect(r.plant.sources).toEqual(tomato.sources);
    expect(r.ownKeys).toEqual(expect.arrayContaining(['id', 'name', 'category', 'frost', 'maturity']));
    expect(r.ownKeys).not.toContain('parent');
    expect('parent' in r.plant).toBe(false);
  });

  it('follows a chain of custom parents', () => {
    const sungoldTall: CustomPlant = { ...sungold, id: 'sungold-tall', name: 'Sungold tall', parent: 'sungold', canopy: 'tall' };
    const r = resolvePlant('sungold-tall', [sungold, sungoldTall])!;
    expect(r.inheritedFrom).toBe('parent');
    expect(r.parentId).toBe('sungold');
    expect(r.plant.maturity.days).toBe(57);
    expect(r.plant.temp).toEqual(plantById('tomato')!.temp);
  });

  it('falls back to the category defaults without a parent', () => {
    const r = resolvePlant('ground-cherry', [groundCherry])!;
    expect(r.inheritedFrom).toBe('defaults');
    expect(r.plant.family).toBe('Solanaceae');
    expect(r.plant.lifecycle).toBe(CATEGORY_DEFAULTS.fruit.lifecycle);
    expect(r.plant.notes.sowing).toMatch(/general defaults/i);
    expect(r.plant.sources).toEqual([]);
  });

  it('falls back to the defaults when the parent is missing', () => {
    const orphan: CustomPlant = { ...sungold, id: 'orphan', parent: 'deleted-plant' };
    const r = resolvePlant('orphan', [orphan])!;
    expect(r.inheritedFrom).toBe('defaults');
    expect(r.plant.density).toEqual(CATEGORY_DEFAULTS.vegetable.density);
  });

  it('does not loop forever on a cycle of parents', () => {
    const a: CustomPlant = { ...sungold, id: 'a', name: 'Plant A', parent: 'b' };
    const b: CustomPlant = { ...sungold, id: 'b', name: 'Plant B', parent: 'a' };
    const self: CustomPlant = { ...sungold, id: 'self', name: 'Plant self', parent: 'self' };
    expect(resolvePlant('a', [a, b])?.plant.name).toBe('Plant A');
    expect(resolvePlant('b', [a, b])?.plant.name).toBe('Plant B');
    expect(resolvePlant('self', [self])?.inheritedFrom).toBe('defaults');
  });
});

describe('CATEGORY_DEFAULTS', () => {
  for (const cat of CATEGORIES) {
    it(`${cat} defaults are a valid plant apart from latin and sources`, () => {
      const d = CATEGORY_DEFAULTS[cat];
      expect(d.category).toBe(cat);
      const res = v.safeParse(PlantSchema, { ...d, latin: 'Generica', sources: [{ title: 'None', url: 'https://example.org' }] });
      expect(res.success, JSON.stringify(res.issues?.[0]?.message)).toBe(true);
      for (const n of Object.values(d.notes)) {
        expect(n).toMatch(/general defaults/i);
        expect(n).not.toMatch(/—/);
      }
    });
  }
});

describe('allPlants', () => {
  it('lists the library and the custom plants by name', () => {
    const list = allPlants([sungold, groundCherry]);
    expect(list).toHaveLength(PLANTS.length + 2);
    const names = list.map((r) => r.plant.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(list.find((r) => r.plant.id === 'sungold')?.custom).toBe(true);
  });
});

describe('wouldCreateCycle', () => {
  it('spots a parent chain that comes back', () => {
    const a: CustomPlant = { ...sungold, id: 'a', parent: 'tomato' };
    const b: CustomPlant = { ...sungold, id: 'b', parent: 'a' };
    expect(wouldCreateCycle('a', 'b', [a, b])).toBe(true);
    expect(wouldCreateCycle('a', 'a', [a, b])).toBe(true);
    expect(wouldCreateCycle('b', 'tomato', [a, b])).toBe(false);
  });
});
