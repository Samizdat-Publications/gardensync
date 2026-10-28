// Cross-reference checks: what DocSchema cannot see because it looks at one record at a time.
//
// DocSchema says each record is well formed. checkGarden and checkDoc say the records fit together:
// no two records in one list share an id, every planting sits in a bed or container that exists and
// grows a plant that exists (built-in or this garden's custom plant), grid plantings name squares
// inside their bed and vessel plantings name none, a pinned bed-out comes after its bed-in, series
// and succession links point at something, no custom plant reuses a built-in id or is based on
// itself through a loop of parents, and the active garden exists.
//
// Where the checks run:
// - applyOp (ops.ts) refuses an op whose result has a problem the document did not already have.
//   Problems a document arrived with (an old save, say) do not block unrelated edits.
// - decodeShare (share.ts) and the 7.x migration (migrate-v7.ts) refuse a garden with any problem.
// - loadDoc (platform/storage.ts) treats a saved document with problems like a damaged save, but
//   keeps it: it returns 'needs-repair' with the problems and repairDoc's copy.
//
// repairDoc fixes only what can be fixed without guessing: it drops plantings whose bed or plant is
// gone, clears links that point nowhere (a series, a harvest's planting, a journal entry's bed, the
// active garden), removes squares from a vessel planting, removes a pinned bed-out that is not after
// its bed-in, and drops a succession series for a plant that is gone. Duplicate ids, squares outside a
// bed or missing, a custom plant reusing a built-in id and parent loops need the gardener, so they are
// left and reported as remaining.
import { produce } from 'immer';
import { cellsInBounds } from '../layout/patch';
import { plantById } from '../plants/library';
import type { Garden, GardenDoc } from './schema';

export type ProblemCode =
  | 'duplicate-id'
  | 'missing-container'
  | 'unknown-plant'
  | 'cells-missing'
  | 'cells-outside'
  | 'cells-on-vessel'
  | 'bed-out-not-after-bed-in'
  | 'missing-series'
  | 'series-unknown-plant'
  | 'harvest-missing-planting'
  | 'journal-missing-container'
  | 'custom-shadows-built-in'
  | 'parent-cycle'
  | 'missing-active-garden';

export interface Problem {
  code: ProblemCode;
  /** The garden the problem is in; absent for problems with the document as a whole. */
  gardenId?: string;
  /** The id of the record the problem is on. */
  id: string;
  /** A plain sentence for the gardener. */
  message: string;
  /** repairDoc can fix it without guessing. */
  repairable: boolean;
  /** Identifies the problem across versions of a document (names can change; this does not). */
  key: string;
}

const LISTS = {
  containers: 'beds or containers',
  plantings: 'plantings',
  series: 'succession series',
  harvests: 'harvests',
  journal: 'journal entries',
  customPlants: 'custom plants',
} as const;

function problem(code: ProblemCode, gardenId: string | undefined, id: string, message: string, repairable: boolean, extra = ''): Problem {
  return {
    code,
    ...(gardenId !== undefined ? { gardenId } : {}),
    id,
    message,
    repairable,
    key: `${code}|${gardenId ?? ''}|${id}|${extra}`,
  };
}

/** Ids that appear more than once in a list, each once, in order of first repeat. */
function duplicates(list: readonly { id: string }[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const x of list) {
    if (seen.has(x.id)) dup.add(x.id);
    seen.add(x.id);
  }
  return [...dup];
}

/** Custom plants that are their own ancestor through `parent`. */
function cyclingPlants(garden: Garden): string[] {
  const byId = new Map(garden.customPlants.map((c) => [c.id, c]));
  const out: string[] = [];
  for (const c of garden.customPlants) {
    const seen = new Set<string>();
    let cur = c.parent;
    while (cur !== undefined && !seen.has(cur)) {
      if (cur === c.id) {
        out.push(c.id);
        break;
      }
      seen.add(cur);
      cur = byId.get(cur)?.parent;
    }
  }
  return out;
}

/** Every cross-reference problem in one garden, in a fixed order. An empty list means it hangs together. */
export function checkGarden(garden: Garden): Problem[] {
  const out: Problem[] = [];
  const g = garden.id;
  const name = `"${garden.name}"`;

  for (const [list, words] of Object.entries(LISTS) as [keyof typeof LISTS, string][]) {
    for (const id of duplicates(garden[list])) {
      out.push(problem('duplicate-id', g, id, `Two ${words} in ${name} share the id "${id}".`, false, list));
    }
  }

  const containers = new Map(garden.containers.map((c) => [c.id, c]));
  const customIds = new Set(garden.customPlants.map((c) => c.id));
  const knownPlant = (id: string) => customIds.has(id) || plantById(id) !== undefined;
  const seriesIds = new Set(garden.series.map((s) => s.id));
  const plantingIds = new Set(garden.plantings.map((p) => p.id));

  for (const p of garden.plantings) {
    const c = containers.get(p.containerId);
    if (!c) out.push(problem('missing-container', g, p.id, `A planting in ${name} is in a bed or container that is not there.`, true));
    if (!knownPlant(p.plantId)) out.push(problem('unknown-plant', g, p.id, `A planting in ${name} is of a plant GardenSync does not know (${p.plantId}).`, true));
    if (c?.form === 'grid') {
      if (!p.cells) out.push(problem('cells-missing', g, p.id, `A planting in ${c.name} has no squares.`, false));
      else if (!cellsInBounds(c, p.cells)) out.push(problem('cells-outside', g, p.id, `A planting sticks out past the edge of ${c.name}.`, false));
    } else if (c?.form === 'vessel' && p.cells) {
      out.push(problem('cells-on-vessel', g, p.id, `A planting in ${c.name} names squares, but containers have none.`, true));
    }
    if (p.anchor.kind === 'pinned' && p.anchor.bedOut !== undefined && p.anchor.bedOut <= p.anchor.bedIn) {
      out.push(problem('bed-out-not-after-bed-in', g, p.id, `A planting in ${name} comes out before it goes in.`, true));
    }
    if (p.seriesId !== undefined && !seriesIds.has(p.seriesId)) {
      out.push(problem('missing-series', g, p.id, `A planting in ${name} belongs to a succession series that is not there.`, true));
    }
  }

  for (const s of garden.series) {
    if (!knownPlant(s.plantId)) out.push(problem('series-unknown-plant', g, s.id, `A succession series in ${name} is of a plant GardenSync does not know (${s.plantId}).`, true));
  }
  for (const h of garden.harvests) {
    if (h.plantingId !== undefined && !plantingIds.has(h.plantingId)) {
      out.push(problem('harvest-missing-planting', g, h.id, `A harvest in ${name} is logged against a planting that is not there.`, true));
    }
  }
  for (const j of garden.journal) {
    if (j.containerId !== undefined && !containers.has(j.containerId)) {
      out.push(problem('journal-missing-container', g, j.id, `A journal entry in ${name} is about a bed or container that is not there.`, true));
    }
  }
  for (const c of garden.customPlants) {
    if (plantById(c.id)) out.push(problem('custom-shadows-built-in', g, c.id, `The custom plant ${c.name} uses the id of a built-in plant (${c.id}).`, false));
  }
  for (const id of cyclingPlants(garden)) {
    out.push(problem('parent-cycle', g, id, `The custom plant "${id}" is based on itself through other plants.`, false));
  }
  return out;
}

/** Every cross-reference problem in the document: duplicate garden ids, each garden, the active garden. */
export function checkDoc(doc: GardenDoc): Problem[] {
  const out: Problem[] = [];
  for (const id of duplicates(doc.gardens)) out.push(problem('duplicate-id', undefined, id, `Two gardens share the id "${id}".`, false, 'gardens'));
  for (const g of doc.gardens) out.push(...checkGarden(g));
  const active = doc.settings.activeGardenId;
  if (active !== null && !doc.gardens.some((g) => g.id === active)) {
    out.push(problem('missing-active-garden', undefined, active, 'The garden that was open is not there.', true));
  }
  return out;
}

const checked = new WeakMap<GardenDoc, Problem[]>();

/** checkDoc, remembered per document object (documents are immutable). */
export function problemsOf(doc: GardenDoc): Problem[] {
  let p = checked.get(doc);
  if (!p) checked.set(doc, (p = checkDoc(doc)));
  return p;
}

export interface Repair {
  /** A copy with every repairable problem fixed (the input is not changed). */
  doc: GardenDoc;
  /** What was fixed. */
  fixed: Problem[];
  /** What is still wrong and needs the gardener. */
  remaining: Problem[];
}

/** Fix what can be fixed without guessing; see the header. */
export function repairDoc(doc: GardenDoc): Repair {
  const before = checkDoc(doc);
  if (!before.some((p) => p.repairable)) return { doc, fixed: [], remaining: before };
  const repaired = produce(doc, (draft) => {
    for (const g of draft.gardens) {
      const containers = new Map(g.containers.map((c) => [c.id, c.form]));
      const customIds = new Set(g.customPlants.map((c) => c.id));
      const knownPlant = (id: string) => customIds.has(id) || plantById(id) !== undefined;

      g.series = g.series.filter((s) => knownPlant(s.plantId));
      const seriesIds = new Set(g.series.map((s) => s.id));
      g.plantings = g.plantings.filter((p) => containers.has(p.containerId) && knownPlant(p.plantId));
      for (const p of g.plantings) {
        if (containers.get(p.containerId) === 'vessel' && p.cells) delete p.cells;
        if (p.anchor.kind === 'pinned' && p.anchor.bedOut !== undefined && p.anchor.bedOut <= p.anchor.bedIn) delete p.anchor.bedOut;
        if (p.seriesId !== undefined && !seriesIds.has(p.seriesId)) delete p.seriesId;
      }
      const plantingIds = new Set(g.plantings.map((p) => p.id));
      for (const h of g.harvests) if (h.plantingId !== undefined && !plantingIds.has(h.plantingId)) delete h.plantingId;
      for (const j of g.journal) if (j.containerId !== undefined && !containers.has(j.containerId)) delete j.containerId;
    }
    const active = draft.settings.activeGardenId;
    if (active !== null && !draft.gardens.some((g) => g.id === active)) draft.settings.activeGardenId = draft.gardens[0]?.id ?? null;
  });
  const remaining = checkDoc(repaired);
  const left = new Set(remaining.map((p) => p.key));
  return { doc: repaired, fixed: before.filter((p) => !left.has(p.key)), remaining };
}
