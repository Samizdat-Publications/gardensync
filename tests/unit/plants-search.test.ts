import { describe, expect, it } from 'vitest';
import { PLANTS, plantById } from '../../src/domain/plants/library';
import { allPlants } from '../../src/domain/plants/resolve';
import { filterPlants, goodInPots, isEasy, matchesQuery, partShade, type LibraryFilter } from '../../src/ui/plants/search';

const list = allPlants([]);
const ids = (f: Partial<LibraryFilter>) =>
  filterPlants(list, { query: '', features: new Set(), categories: new Set(), canGoInNow: () => true, ...f }).map((r) => r.plant.id);
const p = (id: string) => plantById(id)!;

describe('search', () => {
  it('"tomato" finds tomato first, and not tomatillo', () => {
    const found = ids({ query: 'tomato' });
    expect(found[0]).toBe('tomato');
    expect(found).not.toContain('tomatillo');
  });

  it('plurals and capitals work', () => {
    expect(ids({ query: 'Tomatoes' })).toContain('tomato');
    expect(ids({ query: 'peas' })).toContain('pea');
  });

  it('finds by Latin name and by family, botanical or plain', () => {
    expect(ids({ query: 'lycopersicum' })).toEqual(['tomato']);
    const nightshades = ids({ query: 'nightshade' });
    expect(nightshades).toEqual(expect.arrayContaining(['tomato', 'pepper', 'eggplant', 'potato']));
    expect(nightshades).not.toContain('carrot');
    expect(ids({ query: 'solanaceae' }).sort()).toEqual(nightshades.sort());
  });

  it('"herb" finds herbs only', () => {
    const herbs = ids({ query: 'herbs' });
    expect(herbs).toContain('basil');
    expect(herbs.every((id) => p(id).category === 'herb')).toBe(true);
  });

  it('"pot" means plants for pots, not potatoes by name', () => {
    const pots = ids({ query: 'pot' });
    expect(pots.every((id) => p(id).container !== null)).toBe(true);
    expect(pots).not.toContain('pumpkin');
    expect(pots).toContain('lettuce');
  });

  it('"shade" finds plants that take part shade', () => {
    const shade = ids({ query: 'shade' });
    expect(shade.length).toBeGreaterThan(0);
    expect(shade.every((id) => partShade(p(id)))).toBe(true);
  });

  it('every word must match', () => {
    expect(ids({ query: 'herb pot' }).every((id) => p(id).category === 'herb' && p(id).container !== null)).toBe(true);
    expect(ids({ query: 'tomato zzz' })).toEqual([]);
  });

  it('finds by what a plant is planted from', () => {
    expect(ids({ query: 'cloves' })).toEqual(['garlic']);
  });

  it('an empty query keeps everything, in name order', () => {
    expect(ids({})).toEqual(list.map((r) => r.plant.id));
    expect(matchesQuery(p('kale'), '   ')).toBe(true);
  });
});

describe('filters', () => {
  it('"Good in pots" excludes plants with container null', () => {
    const pots = ids({ features: new Set(['pots']) });
    for (const id of ['pumpkin', 'parsnip', 'sweet-corn', 'watermelon', 'winter-squash']) expect(pots).not.toContain(id);
    expect(pots.length).toBe(PLANTS.filter((x) => x.container !== null).length);
  });

  it('"Easy first crops" are direct-sown annuals ready within 60 days', () => {
    const easy = ids({ features: new Set(['easy']) });
    expect(easy).toEqual(expect.arrayContaining(['radish', 'lettuce', 'bush-bean', 'pea', 'zucchini']));
    for (const id of ['tomato', 'asparagus', 'garlic', 'carrot', 'kale']) expect(easy).not.toContain(id);
    expect(isEasy(p('radish'))).toBe(true);
  });

  it('"Part shade" takes shade-tolerant plants', () => {
    const shade = ids({ features: new Set(['shade']) });
    expect(shade).toContain('lettuce');
    expect(shade).not.toContain('tomato');
  });

  it('"Can go in now" uses the given schedule test', () => {
    expect(ids({ features: new Set(['now']), canGoInNow: (x) => x.id === 'kale' })).toEqual(['kale']);
  });

  it('category chips combine as either-or, and with the other filters as and', () => {
    const both = ids({ categories: new Set(['herb', 'flower']) });
    expect(both.every((id) => ['herb', 'flower'].includes(p(id).category))).toBe(true);
    expect(both).toContain('basil');
    expect(both).toContain('marigold');
    const herbPots = ids({ categories: new Set(['herb']), features: new Set(['pots']) });
    expect(herbPots.every((id) => p(id).category === 'herb' && goodInPots(p(id)))).toBe(true);
  });
});
