import { describe, expect, it } from 'vitest';
import {
  bedFootprint,
  boundsOf,
  cellAt,
  cellToSquare,
  cellsBetween,
  cellsName,
  cellsNear,
  cellsRect,
  colName,
  fitView,
  freeSpot,
  panBy,
  planeToScreen,
  rectsOverlap,
  screenToPlane,
  squareToCell,
  viewBoxOf,
  zoomAt,
  type BedShape,
} from '../../src/ui/planner/geometry';

const bed = (rotation: 0 | 90 | 180 | 270, cols = 8, rows = 4): BedShape => ({ x: 100, y: 50, cols, rows, rotation });

describe('bed footprints and squares', () => {
  it('turns the footprint a quarter turn at 90 and 270 degrees', () => {
    expect(bedFootprint(bed(0), 30)).toEqual({ x: 100, y: 50, w: 240, h: 120 });
    expect(bedFootprint(bed(90), 30)).toEqual({ x: 100, y: 50, w: 120, h: 240 });
    expect(bedFootprint(bed(270), 30)).toEqual({ x: 100, y: 50, w: 120, h: 240 });
  });

  it('maps cells to screen squares and back for every rotation', () => {
    for (const r of [0, 90, 180, 270] as const) {
      const b = bed(r);
      for (let col = 0; col < b.cols; col++) {
        for (let row = 0; row < b.rows; row++) {
          const { sx, sy } = cellToSquare(b, { col, row });
          expect(squareToCell(b, sx, sy)).toEqual({ col, row });
        }
      }
    }
  });

  it('puts column A down the right-hand side at 90 degrees, as migration does', () => {
    // A quarter turn clockwise: columns run down the screen, rows run from right to left.
    expect(cellToSquare(bed(90), { col: 0, row: 0 })).toEqual({ sx: 3, sy: 0 });
    expect(cellToSquare(bed(90), { col: 7, row: 3 })).toEqual({ sx: 0, sy: 7 });
  });

  it('hit tests the square under a point and refuses points outside', () => {
    const b = bed(0);
    expect(cellAt(b, 30, 100, 50)).toEqual({ col: 0, row: 0 });
    expect(cellAt(b, 30, 100 + 30 * 2.5, 50 + 30 * 1.1)).toEqual({ col: 2, row: 1 });
    expect(cellAt(b, 30, 99, 60)).toBeNull();
    expect(cellAt(b, 30, 100 + 240, 60)).toBeNull();
    expect(cellAt(bed(90), 30, 100 + 5, 50 + 5)).toEqual({ col: 0, row: 3 });
  });

  it('draws a patch where its cells are, at any rotation', () => {
    const cells = { col: 2, row: 1, w: 2, h: 2 };
    expect(cellsRect(bed(0), 30, cells)).toEqual({ x: 160, y: 80, w: 60, h: 60 });
    expect(cellsRect(bed(180), 30, cells)).toEqual({ x: 100 + 4 * 30, y: 50 + 1 * 30, w: 60, h: 60 });
    const wide = { col: 0, row: 0, w: 3, h: 1 };
    expect(cellsRect(bed(90), 30, wide)).toEqual({ x: 100 + 3 * 30, y: 50, w: 30, h: 90 });
  });
});

describe('rectangle selection', () => {
  it('normalises two corners in any order', () => {
    expect(cellsBetween({ col: 3, row: 2 }, { col: 1, row: 0 })).toEqual({ col: 1, row: 0, w: 3, h: 3 });
    expect(cellsBetween({ col: 1, row: 1 }, { col: 1, row: 1 })).toEqual({ col: 1, row: 1, w: 1, h: 1 });
  });

  it('names squares with column letters and row numbers', () => {
    expect(colName(0)).toBe('A');
    expect(colName(25)).toBe('Z');
    expect(colName(26)).toBe('AA');
    expect(colName(59)).toBe('BH');
    expect(cellsName({ col: 2, row: 0, w: 2, h: 2 })).toBe('C1 to D2');
    expect(cellsName({ col: 0, row: 3, w: 1, h: 1 })).toBe('A4');
  });

  it('counts patches within one square as neighbours', () => {
    const a = { col: 0, row: 0, w: 2, h: 2 };
    expect(cellsNear(a, { col: 2, row: 0, w: 1, h: 1 })).toBe(true);
    expect(cellsNear(a, { col: 2, row: 2, w: 1, h: 1 })).toBe(true);
    expect(cellsNear(a, { col: 3, row: 0, w: 1, h: 1 })).toBe(false);
  });
});

describe('the view', () => {
  const size = { w: 800, h: 400 };

  it('fits a rectangle with a margin and centres it', () => {
    const v = fitView({ x: 0, y: 0, w: 244, h: 122 }, size, 48);
    expect(v.cx).toBe(122);
    expect(v.cy).toBe(61);
    expect(v.s).toBeCloseTo(Math.min(704 / 244, 304 / 122));
    const vb = viewBoxOf(v, size);
    expect(vb.x).toBeLessThan(0);
    expect(vb.y).toBeLessThan(0);
  });

  it('falls back to a plain view with nothing to fit', () => {
    expect(fitView(null, size)).toEqual({ cx: 0, cy: 0, s: 1 });
  });

  it('keeps the point under the cursor fixed while zooming', () => {
    const v = { cx: 100, cy: 50, s: 2 };
    const before = screenToPlane(v, size, 600, 100);
    const z = zoomAt(v, size, 1.5, 600, 100);
    expect(z.s).toBeCloseTo(3);
    const after = screenToPlane(z, size, 600, 100);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it('clamps the zoom', () => {
    expect(zoomAt({ cx: 0, cy: 0, s: 10 }, size, 100, 0, 0).s).toBe(12);
    expect(zoomAt({ cx: 0, cy: 0, s: 0.05 }, size, 0.001, 0, 0).s).toBe(0.02);
  });

  it('pans with the finger and round-trips screen and plane points', () => {
    const v = panBy({ cx: 0, cy: 0, s: 2 }, 20, -10);
    expect(v).toEqual({ cx: -10, cy: 5, s: 2 });
    const p = planeToScreen(v, size, 30, 40);
    const back = screenToPlane(v, size, p.x, p.y);
    expect(back.x).toBeCloseTo(30);
    expect(back.y).toBeCloseTo(40);
  });
});

describe('a free spot for a new bed', () => {
  it('starts at the origin in an empty garden', () => {
    expect(freeSpot([], 100, 100)).toEqual({ x: 0, y: 0 });
  });

  it('never overlaps what is there, with the gap kept', () => {
    const existing = [
      { x: 0, y: 0, w: 244, h: 122 },
      { x: 0, y: 140, w: 91, h: 30 },
    ];
    const spot = freeSpot(existing, 60, 60, 30);
    const box = { ...spot, w: 60, h: 60 };
    for (const r of existing) expect(rectsOverlap(r, box, 29.9)).toBe(false);
    expect(spot).toEqual({ x: 274, y: 0 });
  });

  it('goes below once the row is wide enough', () => {
    const existing = [{ x: 0, y: 0, w: 1000, h: 100 }];
    expect(freeSpot(existing, 900, 100, 30)).toEqual({ x: 0, y: 130 });
  });

  it('bounds several rectangles', () => {
    expect(boundsOf([{ x: 0, y: 0, w: 10, h: 10 }, { x: -5, y: 20, w: 10, h: 5 }])).toEqual({ x: -5, y: 0, w: 15, h: 25 });
  });
});
