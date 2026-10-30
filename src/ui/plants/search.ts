// Finding plants in the library: the search box and the filter chips. Pure functions, no DOM.
//
// Search matches every word typed against the plant's name, Latin name, family (botanical and plain,
// "Solanaceae" or "nightshade"), kind ("herb", "flower") and what it is planted from ("cloves").
// A few plain words are filters rather than text: "pot" or "container" finds plants that suit a
// pot, "shade" finds plants for part shade, "easy" finds easy first crops, "perennial" finds plants
// that come back. Plurals work ("tomatoes", "herbs").
import type { ResolvedPlant } from '../../domain/plants/resolve';
import type { Category, Plant } from '../../domain/plants/schema';
import { familyName } from './facts';

export type FeatureFilter = 'now' | 'easy' | 'pots' | 'shade';

export const FEATURE_FILTERS: readonly { id: FeatureFilter; label: string }[] = [
  { id: 'now', label: 'Can go in this week' },
  { id: 'easy', label: 'Easy first crops' },
  { id: 'pots', label: 'Good in pots' },
  { id: 'shade', label: 'Part shade' },
];

export const CATEGORY_FILTERS: readonly { id: Category; label: string }[] = [
  { id: 'vegetable', label: 'Vegetables' },
  { id: 'herb', label: 'Herbs' },
  { id: 'fruit', label: 'Fruit' },
  { id: 'flower', label: 'Flowers' },
];

/** Days from sowing to first harvest at or under which a direct-sown annual counts as easy. */
export const EASY_MAX_DAYS = 60;

/**
 * Easy first crops: annuals sown straight into the ground (no indoor start needed) that give a
 * first harvest within 60 days of sowing. Radish, lettuce, bush beans, peas, zucchini, marigolds.
 */
export function isEasy(p: Plant): boolean {
  return p.lifecycle !== 'perennial' && !p.perennial && !!p.methods.direct && p.maturity.from === 'sow' && p.maturity.days <= EASY_MAX_DAYS;
}

/** Suits a pot: the record gives a pot size. */
export function goodInPots(p: Plant): boolean {
  return p.container !== null;
}

/** Grows in part shade: wants part sun or shade, or copes with it. */
export function partShade(p: Plant): boolean {
  return p.sun === 'partial' || p.sun === 'shade' || p.shadeTolerant;
}

/** Plain words that act as filters when typed in the search box. */
const KEYWORDS: Readonly<Record<string, (p: Plant) => boolean>> = {
  pot: goodInPots,
  container: goodInPots,
  planter: goodInPots,
  balcony: goodInPots,
  shade: partShade,
  shady: partShade,
  shaded: partShade,
  easy: isEasy,
  beginner: isEasy,
  perennial: (p) => p.lifecycle === 'perennial',
  climbing: (p) => p.support === 'trellis',
  climber: (p) => p.support === 'trellis',
  trellis: (p) => p.support === 'trellis',
};

/** The word and the forms it may take without its plural ending. */
function forms(word: string): string[] {
  const out = [word];
  if (word.length > 3 && word.endsWith('es')) out.push(word.slice(0, -2));
  if (word.length > 2 && word.endsWith('s')) out.push(word.slice(0, -1));
  return out;
}

/** Lower case, accents off, so "Jalapeño" and "jalapeno" meet. */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function haystack(p: Plant): string {
  return fold([p.name, p.latin, p.family, familyName(p.family) ?? '', p.category, p.methods.plant?.what ?? ''].join(' '));
}

const hayCache = new WeakMap<Plant, string>();

/** True when every word of the query matches the plant. An empty query matches everything. */
export function matchesQuery(p: Plant, query: string): boolean {
  const words = fold(query).split(/[^a-z0-9-]+/).filter(Boolean);
  if (words.length === 0) return true;
  let hay = hayCache.get(p);
  if (hay === undefined) hayCache.set(p, (hay = haystack(p)));
  const h = hay;
  return words.every((w) => {
    const fs = forms(w);
    const kw = fs.map((f) => KEYWORDS[f]).find((k) => k !== undefined);
    if (kw) return kw(p);
    return fs.some((f) => h.includes(f));
  });
}

export interface LibraryFilter {
  query: string;
  features: ReadonlySet<FeatureFilter>;
  /** Kinds of plant; empty means every kind. */
  categories: ReadonlySet<Category>;
  /** For the "Can go in now" chip, which needs the schedule. */
  canGoInNow: (p: Plant) => boolean;
}

const FEATURE_TEST: Record<Exclude<FeatureFilter, 'now'>, (p: Plant) => boolean> = {
  easy: isEasy,
  pots: goodInPots,
  shade: partShade,
};

/**
 * The plants that pass the search and every chip that is on. Names that start with what was typed
 * come first, then the rest, each group in name order.
 */
export function filterPlants<T extends Pick<ResolvedPlant, 'plant'>>(list: readonly T[], f: LibraryFilter): T[] {
  const q = fold(f.query.trim());
  const out = list.filter(({ plant: p }) => {
    if (f.categories.size > 0 && !f.categories.has(p.category)) return false;
    for (const feat of f.features) {
      if (feat === 'now' ? !f.canGoInNow(p) : !FEATURE_TEST[feat](p)) return false;
    }
    return matchesQuery(p, q);
  });
  if (!q) return out;
  const starts = (p: Plant) => fold(p.name).startsWith(q) || fold(p.name).split(' ').some((w) => w.startsWith(q));
  return [...out.filter((r) => starts(r.plant)), ...out.filter((r) => !starts(r.plant))];
}
