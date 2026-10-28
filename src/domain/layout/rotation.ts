// Crop rotation: a three-season rotation by plant family.
//
// Growing the same family in the same soil year after year builds up the pests and diseases that
// family suffers from (clubroot in brassicas, blight and nematodes in tomatoes and potatoes). The
// usual advice is to wait at least two seasons before the family returns. So a planting gets a
// warning when a planting of the same family grew in overlapping cells of the same bed in either of
// the two previous seasons. Family 'Other' is too broad to say anything about and never warns.
//
// Only grid beds are checked: a pot's soil is usually replaced, and vessels have no cells to compare.
// Which season a planting belongs to is the caller's business (seasonOf); the schedule knows it.
import type { Family } from '../plants/schema';
import type { Garden, Planting } from '../doc/schema';
import { cellsOverlap } from './patch';
import type { PlantOf } from './occupancy';

/** Seasons that must pass before a family comes back to the same squares. */
export const ROTATION_SEASONS = 2;

export interface RotationWarning {
  planting: Planting;
  /** The earlier planting of the same family in the same squares. */
  earlier: Planting;
  family: Family;
  /** 1 for last season, 2 for the season before. */
  seasonsAgo: number;
  reason: string;
}

/** Everyday names for the families, for sentences. */
const FAMILY_WORDS: Partial<Record<Family, string>> = {
  Alliaceae: 'the onion family',
  Amaranthaceae: 'the beet family',
  Apiaceae: 'the carrot family',
  Asteraceae: 'the daisy family',
  Brassicaceae: 'the cabbage family',
  Cucurbitaceae: 'the squash family',
  Fabaceae: 'the bean family',
  Lamiaceae: 'the mint family',
  Poaceae: 'the grass family',
  Rosaceae: 'the rose family',
  Solanaceae: 'the tomato family',
};

function familyText(f: Family): string {
  const word = FAMILY_WORDS[f];
  return word ? `${word} (${f})` : f;
}

/**
 * Rotation warnings for every planting in the garden's grid beds, in planting order. A planting is
 * warned once for each earlier planting of its family that it follows.
 */
export function rotationWarnings(
  garden: Garden,
  plantOf: PlantOf,
  seasonOf: (p: Planting) => number | null,
): RotationWarning[] {
  const gridIds = new Set(garden.containers.filter((c) => c.form === 'grid').map((c) => c.id));
  const out: RotationWarning[] = [];
  // seasonOf can mean working out a schedule, so it runs only for pairs that pass the cheap checks
  // (same bed, overlapping squares, same family), and at most once per planting.
  const seasons = new Map<Planting, number | null>();
  const season = (p: Planting) => {
    if (!seasons.has(p)) seasons.set(p, seasonOf(p));
    return seasons.get(p)!;
  };
  for (const p of garden.plantings) {
    if (!p.cells || !gridIds.has(p.containerId)) continue;
    const plant = plantOf(p.plantId);
    if (!plant || plant.family === 'Other') continue;
    for (const q of garden.plantings) {
      if (q.id === p.id || q.containerId !== p.containerId || !q.cells) continue;
      if (!cellsOverlap(p.cells, q.cells)) continue;
      const qPlant = plantOf(q.plantId);
      if (!qPlant || qPlant.family !== plant.family) continue;
      const pSeason = season(p);
      if (pSeason === null) break;
      const qSeason = season(q);
      if (qSeason === null) continue;
      const ago = pSeason - qSeason;
      if (ago < 1 || ago > ROTATION_SEASONS) continue;
      const when = ago === 1 ? 'last season' : 'two seasons ago';
      const same = qPlant.name === plant.name;
      const reason = same
        ? `${plant.name} grew in these squares ${when}. Waiting three seasons before ${familyText(plant.family)} comes back helps keep soil pests and diseases down.`
        : `${plant.name} is in ${familyText(plant.family)}, like the ${qPlant.name} that grew in these squares ${when}. Waiting three seasons before the family comes back helps keep soil pests and diseases down.`;
      out.push({ planting: p, earlier: q, family: plant.family, seasonsAgo: ago, reason });
    }
  }
  return out;
}
