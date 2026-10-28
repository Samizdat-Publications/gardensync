// Patches: how many plants fit in a rectangle of squares, or in a pot.
//
// A planting in a grid bed is a patch: a rectangle of cells plus a count. The count starts from the
// plant's square-foot density and the gardener may edit it. Density comes in two shapes:
// - { perSquare: n }: n plants in every square (16 carrots, 4 lettuces, 1 tomato), so a 4 x 8 bed of
//   carrots is one patch of 16 x 32 = 512.
// - { squares: [a, b] }: one plant needs an a x b block of squares (a winter squash needs 3 x 3).
//   The count is how many whole blocks fit, trying the block both ways round.
//
// Vessels (pots, grow bags, buckets, towers) have no squares. A plant fits when the vessel holds at
// least its minimum soil volume; how many fit is its per-vessel figure, or one per minimum volume.
import type { Cells, GridBed, Vessel } from '../doc/schema';
import type { Plant } from '../plants/schema';
import { formatVolume, type Units } from '../units';

/** Width and height in squares. */
export interface Size {
  w: number;
  h: number;
}

/** The plant count a patch of these cells holds at the plant's density. */
export function defaultCount(plant: Plant, cells: Size): number {
  const { density } = plant;
  if ('perSquare' in density) return density.perSquare * cells.w * cells.h;
  const [a, b] = density.squares;
  const upright = Math.floor(cells.w / a) * Math.floor(cells.h / b);
  const turned = Math.floor(cells.w / b) * Math.floor(cells.h / a);
  return Math.max(upright, turned);
}

/** The smallest patch that holds one plant: one square, or the plant's block of squares. */
export function minCells(plant: Plant): Size {
  const { density } = plant;
  if ('perSquare' in density) return { w: 1, h: 1 };
  const [a, b] = density.squares;
  return { w: a, h: b };
}

/** Why a plant and a vessel do not suit each other. */
export type VesselWarning =
  | { kind: 'not-suited' }
  | { kind: 'too-small'; needLitres: number; haveLitres: number };

export interface VesselFit {
  /** The plant can grow in this vessel. */
  ok: boolean;
  /** How many plants the vessel holds. 0 when the plant is not suited to containers. */
  maxCount: number;
  warning?: VesselWarning;
}

/**
 * Whether a plant suits a vessel and how many it holds. A plant with `container: null` is not
 * suited to containers at all. A vessel smaller than the plant's minimum volume gets a too-small
 * warning (maxCount still says how many the gardener would be squeezing in, at least one).
 * Towers hold one plant per pocket.
 */
export function vesselFit(plant: Plant, vessel: Vessel): VesselFit {
  const c = plant.container;
  if (c === null) return { ok: false, maxCount: 0, warning: { kind: 'not-suited' } };
  const maxCount =
    vessel.kind === 'tower' && vessel.pockets !== undefined
      ? vessel.pockets
      : (c.perVessel ?? Math.max(1, Math.floor(vessel.litres / c.minLitres)));
  if (vessel.litres < c.minLitres) {
    return { ok: false, maxCount, warning: { kind: 'too-small', needLitres: c.minLitres, haveLitres: vessel.litres } };
  }
  return { ok: true, maxCount };
}

/** A vessel warning as a sentence, in the gardener's units. */
export function vesselWarningText(warning: VesselWarning, plantName: string, units: Units): string {
  if (warning.kind === 'not-suited') return `${plantName} is not suited to growing in containers.`;
  return `${plantName} needs at least ${formatVolume(warning.needLitres, units)} of soil, and this one holds ${formatVolume(warning.haveLitres, units)}.`;
}

/** A cell's key, for sets and maps: "col,row". */
export function cellKey(col: number, row: number): string {
  return `${col},${row}`;
}

/** The keys of every cell in a patch, row by row. */
export function cellKeys(cells: Cells): string[] {
  const keys: string[] = [];
  for (let r = cells.row; r < cells.row + cells.h; r++) {
    for (let c = cells.col; c < cells.col + cells.w; c++) keys.push(cellKey(c, r));
  }
  return keys;
}

/** The patch lies wholly inside the bed. */
export function cellsInBounds(bed: Pick<GridBed, 'cols' | 'rows'>, cells: Cells): boolean {
  return (
    cells.col >= 0 && cells.row >= 0 && cells.w >= 1 && cells.h >= 1 &&
    cells.col + cells.w <= bed.cols && cells.row + cells.h <= bed.rows
  );
}

/** The two patches share at least one cell. */
export function cellsOverlap(a: Cells, b: Cells): boolean {
  return a.col < b.col + b.w && b.col < a.col + a.w && a.row < b.row + b.h && b.row < a.row + a.h;
}
