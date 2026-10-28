// Planner geometry: where beds, squares and pots sit on the garden plane, and the view onto it.
//
// Everything is in centimetres on the garden plane (x to the right, y down), the same frame the
// document stores. A grid bed's x/y is the top-left corner of its footprint on the plane, after its
// rotation. Rotation is a quarter turn clockwise per 90 degrees: at 90 the bed's columns run down
// the screen and its rows run from right to left (the same rule migrate-v7.ts uses).
//
// The view is a centre point and a scale (screen px per cm). The SVG's viewBox and the fixed-size
// HTML labels laid over it both come from it, so they always agree. Pure functions, no DOM.
import type { Cells, Container, GridBed, Vessel } from '../../domain/doc/schema';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Cell {
  col: number;
  row: number;
}

export interface Size {
  w: number;
  h: number;
}

/** Centre of the view on the plane (cm) and its scale in screen px per cm. */
export interface View {
  cx: number;
  cy: number;
  s: number;
}

export type BedShape = Pick<GridBed, 'x' | 'y' | 'cols' | 'rows' | 'rotation'>;

export const MIN_SCALE = 0.02;
export const MAX_SCALE = 12;

const turned = (b: Pick<GridBed, 'rotation'>) => b.rotation === 90 || b.rotation === 270;

/** Footprint width and height of a bed in squares, after rotation. */
export function footprintSquares(b: BedShape): Size {
  return turned(b) ? { w: b.rows, h: b.cols } : { w: b.cols, h: b.rows };
}

/** The bed's footprint on the plane. */
export function bedFootprint(b: BedShape, cellCm: number): Rect {
  const sq = footprintSquares(b);
  return { x: b.x, y: b.y, w: sq.w * cellCm, h: sq.h * cellCm };
}

export function vesselFootprint(v: Pick<Vessel, 'x' | 'y' | 'diameterCm'>): Rect {
  const r = v.diameterCm / 2;
  return { x: v.x - r, y: v.y - r, w: v.diameterCm, h: v.diameterCm };
}

export function containerFootprint(c: Container, cellCm: number): Rect {
  return c.form === 'grid' ? bedFootprint(c, cellCm) : vesselFootprint(c);
}

/** The screen square (column sx, row sy of the footprint) a bed cell lands on. */
export function cellToSquare(b: BedShape, cell: Cell): { sx: number; sy: number } {
  const { col, row } = cell;
  switch (b.rotation) {
    case 90:
      return { sx: b.rows - 1 - row, sy: col };
    case 180:
      return { sx: b.cols - 1 - col, sy: b.rows - 1 - row };
    case 270:
      return { sx: row, sy: b.cols - 1 - col };
    default:
      return { sx: col, sy: row };
  }
}

/** The bed cell on a screen square of the footprint. */
export function squareToCell(b: BedShape, sx: number, sy: number): Cell {
  switch (b.rotation) {
    case 90:
      return { col: sy, row: b.rows - 1 - sx };
    case 180:
      return { col: b.cols - 1 - sx, row: b.rows - 1 - sy };
    case 270:
      return { col: b.cols - 1 - sy, row: sx };
    default:
      return { col: sx, row: sy };
  }
}

/** Where a rectangle of cells lies on the plane. */
export function cellsRect(b: BedShape, cellCm: number, cells: Cells): Rect {
  const a = cellToSquare(b, { col: cells.col, row: cells.row });
  const z = cellToSquare(b, { col: cells.col + cells.w - 1, row: cells.row + cells.h - 1 });
  const sx = Math.min(a.sx, z.sx);
  const sy = Math.min(a.sy, z.sy);
  const w = Math.abs(a.sx - z.sx) + 1;
  const h = Math.abs(a.sy - z.sy) + 1;
  return { x: b.x + sx * cellCm, y: b.y + sy * cellCm, w: w * cellCm, h: h * cellCm };
}

/** The bed cell under a point on the plane, or null when the point is outside the bed's squares. */
export function cellAt(b: BedShape, cellCm: number, px: number, py: number): Cell | null {
  const sq = footprintSquares(b);
  const sx = Math.floor((px - b.x) / cellCm);
  const sy = Math.floor((py - b.y) / cellCm);
  if (sx < 0 || sy < 0 || sx >= sq.w || sy >= sq.h) return null;
  return squareToCell(b, sx, sy);
}

/** The rectangle of cells with two corner cells, in either order. */
export function cellsBetween(a: Cell, b: Cell): Cells {
  const col = Math.min(a.col, b.col);
  const row = Math.min(a.row, b.row);
  return { col, row, w: Math.abs(a.col - b.col) + 1, h: Math.abs(a.row - b.row) + 1 };
}

/** Two patches are neighbours when they come within `reach` squares of each other (or overlap). */
export function cellsNear(a: Cells, b: Cells, reach = 1): boolean {
  return a.col - reach < b.col + b.w && b.col < a.col + a.w + reach && a.row - reach < b.row + b.h && b.row < a.row + a.h + reach;
}

export function inRect(r: Rect, px: number, py: number, pad = 0): boolean {
  return px >= r.x - pad && px <= r.x + r.w + pad && py >= r.y - pad && py <= r.y + r.h + pad;
}

export function rectsOverlap(a: Rect, b: Rect, gap = 0): boolean {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

/** The smallest rectangle holding all of them, or null for none. */
export function boundsOf(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ---- Names of squares ------------------------------------------------------------------------

/** Column letters: A to Z, then AA, AB and so on. */
export function colName(i: number): string {
  let n = i + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** "C1" for column 2, row 0. */
export function squareName(cell: Cell): string {
  return `${colName(cell.col)}${cell.row + 1}`;
}

/** "C1 to D2", or "C1" for a single square. */
export function cellsName(cells: Cells): string {
  const first = squareName(cells);
  if (cells.w === 1 && cells.h === 1) return first;
  return `${first} to ${squareName({ col: cells.col + cells.w - 1, row: cells.row + cells.h - 1 })}`;
}

// ---- The view --------------------------------------------------------------------------------

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** The plane rectangle a view shows in a viewport of the given size: the SVG viewBox. */
export function viewBoxOf(v: View, size: Size): Rect {
  const w = size.w / v.s;
  const h = size.h / v.s;
  return { x: v.cx - w / 2, y: v.cy - h / 2, w, h };
}

/** The plane point under a screen point (px from the viewport's top-left). */
export function screenToPlane(v: View, size: Size, px: number, py: number): { x: number; y: number } {
  const vb = viewBoxOf(v, size);
  return { x: vb.x + px / v.s, y: vb.y + py / v.s };
}

export function planeToScreen(v: View, size: Size, x: number, y: number): { x: number; y: number } {
  const vb = viewBoxOf(v, size);
  return { x: (x - vb.x) * v.s, y: (y - vb.y) * v.s };
}

/** A view that shows the whole rectangle with `marginPx` of room around it. */
export function fitView(r: Rect | null, size: Size, marginPx = 48): View {
  if (!r || size.w <= 0 || size.h <= 0) return { cx: 0, cy: 0, s: 1 };
  const availW = Math.max(40, size.w - 2 * marginPx);
  const availH = Math.max(40, size.h - 2 * marginPx);
  const s = clamp(Math.min(availW / Math.max(r.w, 1), availH / Math.max(r.h, 1)), MIN_SCALE, MAX_SCALE);
  return { cx: r.x + r.w / 2, cy: r.y + r.h / 2, s };
}

/** Zoom by a factor, keeping the plane point under screen point (px, py) where it is. */
export function zoomAt(v: View, size: Size, factor: number, px: number, py: number): View {
  const s = clamp(v.s * factor, MIN_SCALE, MAX_SCALE);
  const p = screenToPlane(v, size, px, py);
  const x0 = p.x - px / s;
  const y0 = p.y - py / s;
  return { cx: x0 + size.w / 2 / s, cy: y0 + size.h / 2 / s, s };
}

/** Pan by a screen distance: the garden moves with the finger. */
export function panBy(v: View, dx: number, dy: number): View {
  return { cx: v.cx - dx / v.s, cy: v.cy - dy / v.s, s: v.s };
}

// ---- Placing new beds ------------------------------------------------------------------------

/**
 * A top-left position for a new w x h footprint that keeps `gap` cm clear of every existing one.
 * Tries the spots to the right of and below each existing footprint, top row first, and keeps the
 * garden from stretching far to one side.
 */
export function freeSpot(existing: readonly Rect[], w: number, h: number, gap = 30): { x: number; y: number } {
  const all = boundsOf(existing);
  if (!all) return { x: 0, y: 0 };
  const maxRight = all.x + Math.max(all.w * 1.5, 600);
  const candidates: { x: number; y: number }[] = [];
  for (const r of existing) {
    candidates.push({ x: r.x + r.w + gap, y: r.y }, { x: r.x, y: r.y + r.h + gap });
  }
  candidates.push({ x: all.x, y: all.y + all.h + gap });
  candidates.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const c of candidates) {
    if (c.x + w > maxRight) continue;
    const box = { x: c.x, y: c.y, w, h };
    if (!existing.some((r) => rectsOverlap(r, box, gap - 0.001))) return { x: Math.round(c.x), y: Math.round(c.y) };
  }
  return { x: Math.round(all.x), y: Math.round(all.y + all.h + gap) };
}
