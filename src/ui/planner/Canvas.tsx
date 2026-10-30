// The garden canvas: one SVG in real units (cm) with viewBox pan and zoom, and fixed-size HTML
// labels laid over it (ledger 11: SVG text shrinks with zoom, so names, counts and rulers are HTML).
//
// Input: Pointer Events for mouse, touch and pen. Drag on the ground pans, wheel zooms to the cursor,
// two fingers pinch. Tapping picks a planting, a bed or a pot; while placing, tapping a square
// plants immediately (minCells footprint). Dragging across squares paints a bigger patch. The
// keyboard does all of it too: the plan is a role="application" with a square cursor (arrows),
// Enter or Space plants at the cursor, Escape cancels, + and - to zoom, 0 to fit, Shift+arrows to
// move a selected bed. Delete/Backspace removes the selected planting.
//
// Level of detail: a patch is one rectangle with a few glyphs and a count, never one node per plant,
// and the drawing is memoised so a pan or zoom only changes the viewBox and the label offsets.
import { useEffect, useMemo, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import type { JSX } from 'preact';
import type { Cells, Container, GridBed, Planting, Vessel } from '../../domain/doc/schema';
import { COMPANIONS } from '../../domain/plants/library';
import type { Plant } from '../../domain/plants/schema';
import { minCells } from '../../domain/layout/patch';
import { formatLength } from '../../domain/units';
import { garden, units } from '../appState';
import { Glyph } from '../components/Glyph';
import { fmtDay, fmtNear, fmtSpan, inSentence } from '../format';
import { placingPlantId, selection, shownDay } from '../uiState';
import { candidate, type Candidate } from './candidate';
import { containers, footprints, intervalOfP, phasesOfP, plantLookup, present, upcoming } from './derived';
import {
  cellAt,
  cellsBetween,
  cellToSquare,
  cellsName,
  cellsNear,
  cellsRect,
  colName,
  footprintSquares,
  panBy,
  squareName,
  squareToCell,
  viewBoxOf,
  zoomAt,
  type Cell,
  type Rect,
} from './geometry';
import { attemptPlant, clearSquares, finishPaint, fitAll, paintTo, placeAtCell, placeInVessel, selectAt, zoomBy } from './interactions';
import { act, canvasFocused, clashCard, cursor, draft, dragPreview, lod, paletteDrag, plantingMove, stopPlacing, view, viewport, type Draft, type PaletteDragState } from './plannerState';
import { defaultMethod } from './placement';
import { propose, resolutions } from './resolve';

const frameOf = (c: GridBed) => (c.kind === 'in-ground' ? 0 : c.kind === 'window-box' || c.kind === 'trough' ? 4 : 6);
const frameFill = (c: GridBed) => (c.kind === 'window-box' ? 'var(--c-pot)' : c.kind === 'trough' ? 'var(--c-bag)' : 'var(--c-timber)');

function companionOf(a: string, b: string) {
  return COMPANIONS.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.slice(0, 2).replace(/^./, (c) => c.toUpperCase());
}

/** Cells of a patch to draw glyphs in: spread evenly, at most `cap`. */
function glyphCells(cells: Cells, cap: number): Cell[] {
  const all: Cell[] = [];
  for (let r = 0; r < cells.h; r++) for (let c = 0; c < cells.w; c++) all.push({ col: cells.col + c, row: cells.row + r });
  if (all.length <= cap) return all;
  const out: Cell[] = [];
  for (let i = 0; i < cap; i++) out.push(all[Math.floor(((i + 0.5) * all.length) / cap)]!);
  return out;
}

const NS = { 'vector-effect': 'non-scaling-stroke' } as const;

interface LayerInput {
  cellCm: number;
  list: Container[];
  presentMap: Map<string, Planting[]>;
  upcomingMap: Map<string, Planting[]>;
  plantOf: (id: string) => Plant | undefined;
  sel: { kind: 'planting' | 'container'; id: string } | null;
  cand: Candidate | null;
  d: Draft;
  level: 0 | 1 | 2 | 3;
  drag: { id: string; dx: number; dy: number } | null;
  cur: { containerId: string; sx: number; sy: number } | null;
  focused: boolean;
  palDrag: typeof paletteDrag.value;
  plantMove: typeof plantingMove.value;
}

function drawLayer(i: LayerInput): JSX.Element {
  const { cellCm, level } = i;
  const glyphCap = level === 0 ? 1 : level === 1 ? 4 : level === 2 ? 12 : 24;
  const takenIds = new Set(i.cand?.taken.map((t) => t.planting.id));
  return (
    <g>
      {i.list.map((c) => {
        const off = i.drag && i.drag.id === c.id ? i.drag : null;
        const body = c.form === 'grid' ? drawBed(c, i, glyphCap, takenIds) : drawVessel(c, i);
        return (
          <g key={c.id} data-container={c.name} data-container-id={c.id} transform={off ? `translate(${off.dx} ${off.dy})` : undefined}>
            {body}
          </g>
        );
      })}
    </g>
  );

  function drawBed(c: GridBed, i: LayerInput, cap: number, taken: Set<string>): JSX.Element {
    const sq = footprintSquares(c);
    const r = { x: c.x, y: c.y, w: sq.w * cellCm, h: sq.h * cellCm };
    const t = frameOf(c);
    let grid = '';
    if (level > 0) {
      for (let k = 1; k < sq.w; k++) grid += `M${r.x + k * cellCm} ${r.y}V${r.y + r.h}`;
      for (let k = 1; k < sq.h; k++) grid += `M${r.x} ${r.y + k * cellCm}H${r.x + r.w}`;
    }
    const here = i.presentMap.get(c.id) ?? [];
    const upcomingHere = i.upcomingMap.get(c.id) ?? [];
    const placingHere = i.cand && i.d.containerId === c.id && i.cand.cells;
    const selC = i.sel?.kind === 'container' && i.sel.id === c.id;

    // Palette drag snap preview for this bed.
    const palSnap = i.palDrag?.snap?.containerId === c.id ? i.palDrag.snap : null;
    // Planting move preview for this bed.
    const moveSnap = i.plantMove?.targetContainerId === c.id ? i.plantMove : null;

    return (
      <>
        {t > 0 ? <rect x={r.x - t} y={r.y - t} width={r.w + 2 * t} height={r.h + 2 * t} rx={2} fill={frameFill(c)} /> : null}
        <rect class="bed-soil" x={r.x} y={r.y} width={r.w} height={r.h} fill={level === 0 ? 'var(--c-soil)' : 'url(#gs-soil)'} stroke={t === 0 ? 'var(--c-timber)' : 'none'} stroke-dasharray={t === 0 ? '6 4' : undefined} stroke-width={t === 0 ? 1.5 : 0} {...NS} />
        {grid ? <path d={grid} stroke="var(--c-soil-grid)" stroke-width={1} fill="none" {...NS} /> : null}
        {here.map((p) => drawPatch(c, p, cap))}
        {upcomingHere.map((p) => drawUpcomingPatch(c, p))}
        {i.cand
          ? i.cand.taken
              .filter((tk) => tk.planting.containerId === c.id && tk.planting.cells && taken.has(tk.planting.id))
              .map((tk) => {
                const pr = cellsRect(c, cellCm, tk.planting.cells!);
                const shown = here.some((p) => p.id === tk.planting.id);
                return (
                  <rect
                    key={`t${tk.planting.id}`}
                    x={pr.x + 2}
                    y={pr.y + 2}
                    width={pr.w - 4}
                    height={pr.h - 4}
                    rx={3}
                    fill="url(#gs-taken)"
                    stroke="var(--c-muted)"
                    stroke-width={shown ? 0 : 1.5}
                    stroke-dasharray={shown ? undefined : '4 3'}
                    {...NS}
                  />
                );
              })
          : null}
        {level > 0 ? drawCompanions(c, here) : null}
        {placingHere ? drawChosen(c, i.cand!) : null}
        {palSnap ? drawSnapPreview(c, palSnap.cells, palSnap.proposal.clashes.length > 0 ? 'clash' : 'free') : null}
        {moveSnap ? drawMovePreview(c, moveSnap.targetCells, moveSnap.proposal?.clashes.length ? 'clash' : 'free') : null}
        {selC ? <rect x={r.x - t} y={r.y - t} width={r.w + 2 * t} height={r.h + 2 * t} rx={3} fill="none" class="ring-sel-bed" {...NS} /> : null}
        {i.focused && i.cur && i.cur.containerId === c.id ? (
          <rect x={r.x + i.cur.sx * cellCm + 1} y={r.y + i.cur.sy * cellCm + 1} width={cellCm - 2} height={cellCm - 2} fill="none" class="cursor-ring" {...NS} />
        ) : null}
      </>
    );
  }

  function drawPatch(c: GridBed, p: Planting, cap: number): JSX.Element | null {
    const plant = i.plantOf(p.plantId);
    if (!plant || !p.cells) return null;
    // Hide the source of a planting being moved.
    if (i.plantMove?.plantingId === p.id) return null;
    const pr = cellsRect(c, cellCm, p.cells);
    const color = plant.glyph.color;
    const sel = i.sel?.kind === 'planting' && i.sel.id === p.id;
    const blocks = 'squares' in plant.density;
    const cells = blocks || level === 0 ? [] : glyphCells(p.cells, cap);
    const single = cells.length === 0;
    const gs = single ? Math.min(Math.min(pr.w, pr.h) * 0.6, cellCm * 2) : cellCm * 0.62;
    return (
      <g key={p.id} class="patch" data-plant={p.plantId} data-planting-id={p.id}>
        <rect x={pr.x + 2} y={pr.y + 2} width={pr.w - 4} height={pr.h - 4} rx={3} fill={color} fill-opacity={0.22} stroke={color} stroke-width={1.5} {...NS} />
        {single ? (
          <Glyph form={plant.glyph.form} color={color} x={pr.x + pr.w / 2 - gs / 2} y={pr.y + pr.h / 2 - gs / 2} size={gs} />
        ) : (
          cells.map((cell) => {
            const cr = cellsRect(c, cellCm, { col: cell.col, row: cell.row, w: 1, h: 1 });
            return <Glyph key={`${cell.col},${cell.row}`} form={plant.glyph.form} color={color} x={cr.x + (cellCm - gs) / 2} y={cr.y + (cellCm - gs) / 2} size={gs} />;
          })
        )}
        {sel ? <rect x={pr.x - 1} y={pr.y - 1} width={pr.w + 2} height={pr.h + 2} rx={4} fill="none" class="ring-halo" {...NS} /> : null}
        {sel ? <rect x={pr.x - 1} y={pr.y - 1} width={pr.w + 2} height={pr.h + 2} rx={4} fill="none" class="ring-ink" {...NS} /> : null}
      </g>
    );
  }

  function drawUpcomingPatch(c: GridBed, p: Planting): JSX.Element | null {
    const plant = i.plantOf(p.plantId);
    if (!plant || !p.cells) return null;
    if (i.plantMove?.plantingId === p.id) return null;
    const pr = cellsRect(c, cellCm, p.cells);
    const color = plant.glyph.color;
    const sel = i.sel?.kind === 'planting' && i.sel.id === p.id;
    return (
      <g key={`up${p.id}`} class="patch-upcoming" data-plant={p.plantId} data-planting-id={p.id}>
        <rect x={pr.x + 2} y={pr.y + 2} width={pr.w - 4} height={pr.h - 4} rx={3} fill={color} fill-opacity={0.12} stroke={color} stroke-opacity={0.45} stroke-width={1.5} stroke-dasharray="4 3" {...NS} />
        {sel ? <rect x={pr.x - 1} y={pr.y - 1} width={pr.w + 2} height={pr.h + 2} rx={4} fill="none" class="ring-halo" {...NS} /> : null}
        {sel ? <rect x={pr.x - 1} y={pr.y - 1} width={pr.w + 2} height={pr.h + 2} rx={4} fill="none" class="ring-ink" {...NS} /> : null}
      </g>
    );
  }

  function drawCompanions(c: GridBed, here: Planting[]): JSX.Element[] {
    const out: JSX.Element[] = [];
    for (let a = 0; a < here.length; a++) {
      for (let b = a + 1; b < here.length; b++) {
        const pa = here[a]!;
        const pb = here[b]!;
        if (!pa.cells || !pb.cells || pa.plantId === pb.plantId || !cellsNear(pa.cells, pb.cells, 1)) continue;
        const comp = companionOf(pa.plantId, pb.plantId);
        if (!comp) continue;
        const ra = cellsRect(c, cellCm, pa.cells);
        const rb = cellsRect(c, cellCm, pb.cells);
        const { x1, y1, x2, y2, mx, my } = linkBetween(ra, rb, cellCm);
        const good = comp.kind === 'good';
        const k = cellCm * 0.09;
        out.push(
          <g key={`${pa.id}-${pb.id}`} class={good ? 'link link-friend' : 'link link-foe'}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke-width={3} stroke-linecap="round" stroke-dasharray={good ? undefined : '5 4'} {...NS} />
            <circle cx={mx} cy={my} r={cellCm * 0.24} fill="var(--c-halo)" />
            <circle cx={mx} cy={my} r={cellCm * 0.19} class="link-badge" />
            <path
              d={good ? `M${mx - k} ${my}H${mx + k}M${mx} ${my - k}V${my + k}` : `M${mx - k} ${my - k}L${mx + k} ${my + k}M${mx + k} ${my - k}L${mx - k} ${my + k}`}
              stroke="var(--c-panel)"
              stroke-width={1.8}
              stroke-linecap="round"
              {...NS}
            />
          </g>,
        );
      }
    }
    return out;
  }

  function drawChosen(c: GridBed, cand: Candidate): JSX.Element {
    const cr = cellsRect(c, cellCm, cand.cells!);
    const bad = cand.problems.length > 0 || (cand.needsAnyway && !i.d.allowClash);
    return (
      <rect
        class={bad ? 'chosen chosen-bad' : 'chosen'}
        x={cr.x + 1}
        y={cr.y + 1}
        width={cr.w - 2}
        height={cr.h - 2}
        rx={3}
        stroke-width={3}
        stroke-dasharray="7 5"
        {...NS}
      />
    );
  }

  function drawSnapPreview(c: GridBed, cells: Cells, state: 'free' | 'clash'): JSX.Element {
    const cr = cellsRect(c, cellCm, cells);
    if (state === 'clash') {
      return (
        <rect
          class="snap-clash-strong"
          x={cr.x + 1}
          y={cr.y + 1}
          width={cr.w - 2}
          height={cr.h - 2}
          rx={3}
          {...NS}
        />
      );
    }
    return (
      <rect
        class="chosen snap-free"
        x={cr.x + 1}
        y={cr.y + 1}
        width={cr.w - 2}
        height={cr.h - 2}
        rx={3}
        stroke-width={3}
        stroke-dasharray="7 5"
        {...NS}
      />
    );
  }

  function drawMovePreview(c: GridBed, cells: Cells, state: 'free' | 'clash'): JSX.Element {
    const cr = cellsRect(c, cellCm, cells);
    return (
      <rect
        class={state === 'free' ? 'chosen snap-free' : 'chosen snap-clash chosen-bad'}
        x={cr.x + 1}
        y={cr.y + 1}
        width={cr.w - 2}
        height={cr.h - 2}
        rx={3}
        stroke-width={3}
        stroke-dasharray="5 3"
        opacity={0.85}
        {...NS}
      />
    );
  }

  function drawVessel(c: Vessel, i: LayerInput): JSX.Element {
    const r = c.diameterCm / 2;
    const here = i.presentMap.get(c.id) ?? [];
    const glyphs: { p: Planting; plant: Plant }[] = [];
    for (const p of here) {
      const plant = i.plantOf(p.plantId);
      if (!plant) continue;
      for (let k = 0; k < Math.min(p.count, 3) && glyphs.length < 5; k++) glyphs.push({ p, plant });
    }
    const gs = glyphs.length <= 1 ? r * 1.0 : r * 0.62;
    const selC = i.sel?.kind === 'container' && i.sel.id === c.id;
    const selP = i.sel?.kind === 'planting' && here.some((p) => p.id === i.sel!.id);
    const placing = i.d.containerId === c.id && placingPlantId.value !== null;
    const palOver = i.palDrag?.snap?.containerId === c.id;
    return (
      <>
        <circle cx={c.x} cy={c.y} r={r} fill={c.kind === 'pot' ? 'var(--c-pot)' : 'var(--c-bag)'} />
        <circle class="bed-soil" cx={c.x} cy={c.y} r={r * 0.84} fill={level === 0 ? 'var(--c-soil)' : 'url(#gs-soil)'} />
        {c.kind === 'tower'
          ? Array.from({ length: Math.min(c.pockets ?? 6, 24) }, (_, k) => {
              const a = (k / Math.min(c.pockets ?? 6, 24)) * Math.PI * 2;
              return <circle key={k} cx={c.x + Math.cos(a) * r * 0.92} cy={c.y + Math.sin(a) * r * 0.92} r={r * 0.06} fill="var(--c-soil-speck)" />;
            })
          : null}
        {glyphs.map((gl, k) => {
          const n = glyphs.length;
          const a = (k / n) * Math.PI * 2 - Math.PI / 2;
          const rr = n === 1 ? 0 : r * 0.42;
          return (
            <g key={`${gl.p.id}${k}`} class="patch" data-plant={gl.p.plantId} data-planting-id={gl.p.id}>
              <Glyph form={gl.plant.glyph.form} color={gl.plant.glyph.color} x={c.x + Math.cos(a) * rr - gs / 2} y={c.y + Math.sin(a) * rr - gs / 2} size={gs} />
            </g>
          );
        })}
        {placing || palOver ? <circle class="chosen" cx={c.x} cy={c.y} r={r * 0.84} stroke-width={3} stroke-dasharray="7 5" {...NS} /> : null}
        {selC || selP ? <circle cx={c.x} cy={c.y} r={r + 3} fill="none" class="ring-halo" {...NS} /> : null}
        {selC || selP ? <circle cx={c.x} cy={c.y} r={r + 3} fill="none" class="ring-ink" {...NS} /> : null}
        {i.focused && i.cur && i.cur.containerId === c.id ? <circle cx={c.x} cy={c.y} r={r + 7} fill="none" class="cursor-ring" {...NS} /> : null}
      </>
    );
  }
}

/** A short companion line across the boundary between two patches, and the badge's spot. */
function linkBetween(a: Rect, b: Rect, cell: number) {
  const ca = { x: a.x + a.w / 2, y: a.y + a.h / 2 };
  const cb = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  let mx: number;
  let my: number;
  let dx = 0;
  let dy = 0;
  if (oy > 0) {
    mx = a.x + a.w <= b.x ? (a.x + a.w + b.x) / 2 : (b.x + b.w + a.x) / 2;
    my = Math.max(a.y, b.y) + oy / 2;
    dx = cell * 0.7;
  } else if (ox > 0) {
    my = a.y + a.h <= b.y ? (a.y + a.h + b.y) / 2 : (b.y + b.h + a.y) / 2;
    mx = Math.max(a.x, b.x) + ox / 2;
    dy = cell * 0.7;
  } else {
    mx = (ca.x + cb.x) / 2;
    my = (ca.y + cb.y) / 2;
    const len = Math.hypot(cb.x - ca.x, cb.y - ca.y) || 1;
    dx = ((cb.x - ca.x) / len) * cell * 0.6;
    dy = ((cb.y - ca.y) / len) * cell * 0.6;
  }
  return { x1: mx - dx, y1: my - dy, x2: mx + dx, y2: my + dy, mx, my };
}

// ---- Fixed-size labels over the plan ----------------------------------------------------------

/** CSS position of a plane point inside the label layer (which carries --vx, --vy, --s). */
function at(x: number, y: number, dxPx = 0, dyPx = 0): Record<string, string> {
  return {
    left: `calc((${x} - var(--vx)) * var(--s) * 1px + ${dxPx}px)`,
    top: `calc((${y} - var(--vy)) * var(--s) * 1px + ${dyPx}px)`,
  };
}

function drawLabels(i: LayerInput): JSX.Element {
  const { cellCm, level } = i;
  const out: JSX.Element[] = [];
  // Build a map from planting id to { name, bedIn, bedOut } for taken-label enrichment.
  const iof = intervalOfP.value;
  const takenInfo = new Map<string, { name: string; bedIn: number; bedOut: number | null }>();
  if (i.cand) {
    for (const t of i.cand.taken) {
      const name = i.plantOf(t.planting.plantId)?.name ?? 'Plant';
      const interval = iof(t.planting);
      if (interval) takenInfo.set(t.planting.id, { name, bedIn: interval.bedIn, bedOut: interval.bedOut });
    }
  }

  for (const c of i.list) {
    const off = i.drag && i.drag.id === c.id ? i.drag : { dx: 0, dy: 0 };
    if (c.form === 'grid') {
      const sq = footprintSquares(c);
      const x0 = c.x + off.dx;
      const y0 = c.y + off.dy;
      if (level >= 1) {
        for (let col = 0; col < c.cols; col++) {
          const { sx, sy } = cellToSquare(c, { col, row: 0 });
          const side = c.rotation === 0 ? 'top' : c.rotation === 90 ? 'right' : c.rotation === 180 ? 'bottom' : 'left';
          out.push(ruler(`c${c.id}${col}`, colName(col), side, x0, y0, sx, sy, cellCm, sq.w, sq.h, frameOf(c)));
        }
        for (let row = 0; row < c.rows; row++) {
          const { sx, sy } = cellToSquare(c, { col: 0, row });
          const side = c.rotation === 0 ? 'left' : c.rotation === 90 ? 'top' : c.rotation === 180 ? 'right' : 'bottom';
          out.push(ruler(`r${c.id}${row}`, String(row + 1), side, x0, y0, sx, sy, cellCm, sq.w, sq.h, frameOf(c)));
        }
      }
      for (const p of i.presentMap.get(c.id) ?? []) {
        const plant = i.plantOf(p.plantId);
        if (!plant || !p.cells || level === 0) continue;
        const pr = cellsRect(c, cellCm, p.cells);
        const wide = p.cells.w >= 2 || level >= 3;
        const name = level >= 2 && wide ? plant.name : initials(plant.name);
        out.push(
          <span key={`n${p.id}`} class="lbl lbl-name" style={{ ...at(pr.x + off.dx, pr.y + off.dy, 5, 4), maxWidth: `calc(${pr.w} * var(--s) * 1px - 10px)` }}>
            {name}
          </span>,
        );
        if (level >= 2 || p.cells.w * p.cells.h >= 2) {
          out.push(
            <span key={`k${p.id}`} class="lbl lbl-count" style={at(pr.x + pr.w + off.dx, pr.y + pr.h + off.dy, -5, -5)}>
              {p.count}
            </span>,
          );
        }
      }
      // Upcoming-planting labels: faint "Tomato from May 4".
      if (level >= 1) {
        const iof2 = intervalOfP.value;
        for (const p of i.upcomingMap.get(c.id) ?? []) {
          const plant2 = i.plantOf(p.plantId);
          if (!plant2 || !p.cells) continue;
          const pr2 = cellsRect(c, cellCm, p.cells);
          const interval2 = iof2(p);
          if (!interval2) continue;
          out.push(
            <span
              key={`ul${p.id}`}
              class="lbl lbl-upcoming"
              style={{ ...at(pr2.x + off.dx, pr2.y + off.dy, 4, 4), maxWidth: `calc(${pr2.w} * var(--s) * 1px - 8px)` }}
            >
              {plant2.name} from {fmtNear(interval2.bedIn, shownDay.value)}
            </span>,
          );
        }
      }
      if (i.cand && level >= 2) {
        const shown = new Set((i.presentMap.get(c.id) ?? []).map((p) => p.id));
        for (const t of i.cand.taken) {
          if (t.planting.containerId !== c.id || !t.planting.cells || !takenInfo.has(t.planting.id)) continue;
          if (shown.has(t.planting.id) && level < 3) continue;
          const tc = t.planting.cells;
          // Drop the label when the patch is a single cell (the hatch still marks it as taken).
          if (tc.w === 1 && tc.h === 1 && level < 3) continue;
          const pr = cellsRect(c, cellCm, tc);
          const info = takenInfo.get(t.planting.id)!;
          // Show "Tomato from May 4" or "Radish until Jun 9" — never bare dates.
          let shortLabel: string;
          if (info.bedOut === null) {
            shortLabel = `${info.name} (perennial)`;
          } else if (!shown.has(t.planting.id)) {
            // Planting is not in the ground on the shown day: show "from [bedIn]"
            shortLabel = `${info.name} from ${fmtDay(info.bedIn)}`;
          } else {
            // Planting is in the ground but ends during the new one's time: show "until [bedOut]"
            shortLabel = `${info.name} until ${fmtDay(info.bedOut)}`;
          }
          out.push(
            <span
              key={`t${t.planting.id}`}
              class="lbl lbl-taken"
              style={{ ...at(pr.x + off.dx, pr.y + pr.h + off.dy, 2, -2), maxWidth: `calc(${pr.w} * var(--s) * 1px - 4px)` }}
            >
              {shortLabel}
            </span>,
          );
        }
      }
      // Palette drag snap label.
      const palSnap = i.palDrag?.snap?.containerId === c.id ? i.palDrag.snap : null;
      if (palSnap && level >= 1 && i.palDrag) {
        const pr = cellsRect(c, cellCm, palSnap.cells);
        const plant = i.palDrag.plant;
        const hasClash = palSnap.proposal.clashes.length > 0;
        let snapLabel = hasClash ? 'Clashes here' : `${plant.name} here`;
        if (hasClash && palSnap.proposal.clashes.length > 0) {
          const clashName = i.plantOf(palSnap.proposal.clashes[0]!.with.plantId)?.name;
          if (clashName) snapLabel = `${clashName} is here`;
        }
        out.push(
          <span
            key="pal-snap-lbl"
            class={`lbl lbl-snap${hasClash ? ' lbl-snap-clash' : ' lbl-snap-free'}`}
            style={{ ...at(pr.x + off.dx, pr.y + pr.h + off.dy, 2, -2), maxWidth: `calc(${pr.w} * var(--s) * 1px - 4px)` }}
          >
            {snapLabel}
          </span>,
        );
      }
    }
  }
  return <>{out}</>;
}

function ruler(key: string, text: string, side: 'top' | 'right' | 'bottom' | 'left', x0: number, y0: number, sx: number, sy: number, cell: number, w: number, h: number, t: number): JSX.Element {
  let x = x0 + (sx + 0.5) * cell;
  let y = y0 + (sy + 0.5) * cell;
  if (side === 'top') y = y0 - t;
  if (side === 'bottom') y = y0 + h * cell + t;
  if (side === 'left') x = x0 - t;
  if (side === 'right') x = x0 + w * cell + t;
  return (
    <span key={key} class={`lbl lbl-ruler ruler-${side}`} style={at(x, y)}>
      {text}
    </span>
  );
}

// ---- The component ------------------------------------------------------------------------------

export function Canvas({ descriptionId }: { descriptionId: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const app = useRef<HTMLDivElement>(null);
  const g = garden.value!;
  const v = view.value;
  const size = viewport.value;
  const level = lod.value;
  const list = containers.value;
  const presentMap = present.value;
  const plantOf = plantLookup.value;
  const sel = selection.value;
  const cand = candidate.value;
  const d = draft.value;
  const drag = dragPreview.value;
  const cur = cursor.value;
  const focused = canvasFocused.value;
  const u = units.value;
  const palDragState = paletteDrag.value;
  const plantMoveState = plantingMove.value;

  // Hover tooltip state.
  const hoverInfo = useSignal<{ name: string; count: number; dates: string; x: number; y: number } | null>(null);

  // Size the view to the element, and fit the garden the first time.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const newW = Math.round(r.width);
      const newH = Math.round(r.height);
      const was = viewport.value;
      const cv = view.value;
      // Keep the viewBox top-left corner fixed when the canvas is already laid out, so the plan
      // does not jump under the pointer when a drag from the palette opens the placement panel.
      if (was.w !== 0 && cv) {
        const oldVbX = cv.cx - was.w / 2 / cv.s;
        const oldVbY = cv.cy - was.h / 2 / cv.s;
        view.value = { ...cv, cx: oldVbX + newW / 2 / cv.s, cy: oldVbY + newH / 2 / cv.s };
      }
      viewport.value = { w: newW, h: newH };
      if (!cv || was.w === 0) fitAll();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel zoom needs a non-passive listener to keep the page from scrolling.
  useEffect(() => {
    const el = app.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const cv = view.value;
      if (!cv) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
      view.value = zoomAt(cv, viewport.value, Math.exp(-e.deltaY * unit * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Palette drag: global pointer listeners while dragging from the palette.
  // We use paletteDrag.subscribe() rather than a useEffect/useLayoutEffect so the listeners
  // are registered synchronously the moment paletteDrag.value becomes non-null. Preact Signals
  // defers component re-renders to requestAnimationFrame, so any effect hook fires too late:
  // in WebKit, pointer events from the drag reach the document before the rAF fires and the
  // listener is registered. signal.subscribe() fires synchronously inside the same JS task as
  // the signal write, guaranteeing the listeners are in place for the very next pointer event.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const state = paletteDrag.value;
      if (!state) return;
      const snap = computePaletteDragSnap(e.clientX, e.clientY, app.current);
      paletteDrag.value = { ...state, screenX: e.clientX, screenY: e.clientY, snap };
    };
    const onUp = (e: PointerEvent) => {
      const state = paletteDrag.value;
      paletteDrag.value = null;
      const snap = state?.snap ?? null;
      if (snap) {
        attemptPlant(snap.containerId, snap.cells, e.clientX, e.clientY);
      }
    };
    let registered = false;
    const unsubscribe = paletteDrag.subscribe((state) => {
      if (state !== null && !registered) {
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
        registered = true;
      } else if (state === null && registered) {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        registered = false;
      }
    });
    return () => {
      unsubscribe();
      if (registered) {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
      }
    };
  }, []);

  const upcomingMap = upcoming.value;
  const input: LayerInput = { cellCm: g.cellCm, list, presentMap, upcomingMap, plantOf, sel, cand, d, level, drag, cur, focused, palDrag: palDragState, plantMove: plantMoveState };
  const layer = useMemo(() => drawLayer(input), [g, list, presentMap, upcomingMap, plantOf, sel, cand, d, level, drag, cur, focused, palDragState, plantMoveState]);
  // Beds show their size under the name; pots show what is in them on the day shown.
  const sizeText = (c: Container) => {
    if (c.form === 'grid') return `${formatLength(c.rows * g.cellCm, u)} by ${formatLength(c.cols * g.cellCm, u)}`;
    const here = presentMap.get(c.id) ?? [];
    return here.length ? here.map((p) => `${plantOf(p.plantId)?.name ?? 'Plant'} ${p.count}`).join(', ') : formatLength(c.diameterCm, u);
  };
  const labels = useMemo(() => drawLabels(input), [g, list, presentMap, upcomingMap, plantOf, cand, level, drag, palDragState]);

  const vb = v && size.w > 0 ? viewBoxOf(v, size) : { x: 0, y: 0, w: 100, h: 100 };
  const s = v?.s ?? 1;
  const paper = g.cellCm * s * (level === 0 ? 5 : 1);
  const vars = `--vx:${vb.x};--vy:${vb.y};--s:${s}`;

  // ---- Pointer gestures -----------------------------------------------------------------------
  /** Planting captured at mouse/pen pointerdown, stored until movement exceeds 6 px. */
  interface TapPlantingTarget { planting: Planting; plant: Plant; c: GridBed; grabOffsetCol: number; grabOffsetRow: number }
  const gesture = useRef<
    | null
    | { kind: 'tap'; id: number; x: number; y: number; moved: boolean; type: string; plantingTarget?: TapPlantingTarget }
    | { kind: 'paint'; id: number; bedId: string }
    | { kind: 'move'; id: number; c: Container; cell: Cell | null; x: number; y: number }
    | { kind: 'move-planting'; id: number; plantingId: string; containerId: string; sourceCells: Cells; plant: Plant; grabOffsetCol: number; grabOffsetRow: number }
    | { kind: 'pinch'; dist: number; mid: { x: number; y: number }; view: NonNullable<typeof v> }
  >(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  // Touch long-press: 350 ms hold on a planting starts a move gesture.
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressData = useRef<{ pointerId: number; planting: Planting; plant: Plant; c: GridBed; grabOffsetCol: number; grabOffsetRow: number } | null>(null);

  const local = (e: PointerEvent) => {
    const r = app.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toPlane = (p: { x: number; y: number }) => {
    const cv = view.value!;
    const b = viewBoxOf(cv, viewport.value);
    return { x: b.x + p.x / cv.s, y: b.y + p.y / cv.s };
  };

  type Hit = { c: Container; cell: Cell | null } | null;
  const hitTest = (px: number, py: number): Hit => {
    const all = containers.value;
    for (let k = all.length - 1; k >= 0; k--) {
      const c = all[k]!;
      if (c.form === 'vessel') {
        if (Math.hypot(px - c.x, py - c.y) <= c.diameterCm / 2 + 2) return { c, cell: null };
      }
    }
    for (let k = all.length - 1; k >= 0; k--) {
      const c = all[k]!;
      if (c.form !== 'grid') continue;
      const cell = cellAt(c, g.cellCm, px, py);
      if (cell) return { c, cell };
      const r = footprints.value.get(c.id);
      const t = frameOf(c) + 2;
      if (r && px >= r.x - t && px <= r.x + r.w + t && py >= r.y - t && py <= r.y + r.h + t) return { c, cell: null };
    }
    return null;
  };

  /** Find a planting under the plane point: one in the ground on the day shown, else one planned there. */
  const plantingAt = (px: number, py: number): { planting: Planting; plant: Plant; c: GridBed } | null => {
    for (const c of list) {
      if (c.form !== 'grid') continue;
      const here = [...(upcomingMap.get(c.id) ?? []), ...(presentMap.get(c.id) ?? [])];
      for (let k = here.length - 1; k >= 0; k--) {
        const p = here[k]!;
        if (!p.cells) continue;
        const pr = cellsRect(c, g.cellCm, p.cells);
        if (px >= pr.x && px <= pr.x + pr.w && py >= pr.y && py <= pr.y + pr.h) {
          const plant = plantOf(p.plantId);
          if (plant) return { planting: p, plant, c };
        }
      }
    }
    return null;
  };

  const setCursorFrom = (hit: Hit) => {
    if (!hit) return;
    if (hit.c.form === 'grid' && hit.cell) {
      const { sx, sy } = cellToSquare(hit.c, hit.cell);
      cursor.value = { containerId: hit.c.id, sx, sy };
    } else if (hit.c.form === 'vessel') cursor.value = { containerId: hit.c.id, sx: 0, sy: 0 };
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!view.value || e.button > 0) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    app.current?.setPointerCapture?.(e.pointerId);
    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()] as [{ x: number; y: number }, { x: number; y: number }];
      const [a, b] = pts;
      gesture.current = { kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, view: view.value };
      return;
    }
    const pl = toPlane(p);
    const hit = hitTest(pl.x, pl.y);
    const placing = placingPlantId.value !== null;

    // While placing, any pointer on a grid cell starts a paint gesture (touch included).
    if (placing && hit?.c.form === 'grid' && hit.cell) {
      draft.value = { ...draft.value, containerId: hit.c.id, start: hit.cell, end: hit.cell, phase: 'started' };
      gesture.current = { kind: 'paint', id: e.pointerId, bedId: hit.c.id };
      setCursorFrom(hit);
      return;
    }

    const s0 = selection.value;
    const underPointer = placing ? null : plantingAt(pl.x, pl.y);

    // Container move (mouse, selected container), but a drag that starts on a planting moves the
    // planting: the bed moves from its frame, label or empty squares.
    if (!placing && hit && !underPointer && e.pointerType === 'mouse' && s0?.kind === 'container' && s0.id === hit.c.id) {
      gesture.current = { kind: 'move', id: e.pointerId, c: hit.c, cell: hit.cell, x: pl.x, y: pl.y };
      return;
    }

    // For mouse/pen, capture any planting under the pointer: if the pointer moves more than 6 px
    // the tap gesture upgrades to move-planting; a click without moving selects normally.
    let tapPlantingTarget: TapPlantingTarget | undefined;
    if (!placing && (e.pointerType === 'mouse' || e.pointerType === 'pen')) {
      const found = underPointer;
      if (found?.planting.cells) {
        const grabbedCell = cellAt(found.c, g.cellCm, pl.x, pl.y);
        tapPlantingTarget = {
          planting: found.planting,
          plant: found.plant,
          c: found.c,
          grabOffsetCol: grabbedCell ? grabbedCell.col - found.planting.cells.col : 0,
          grabOffsetRow: grabbedCell ? grabbedCell.row - found.planting.cells.row : 0,
        };
      }
    }

    // Touch long-press (350 ms) on a planting starts a move-planting gesture.
    if (!placing && e.pointerType === 'touch') {
      const found = underPointer;
      if (found?.planting.cells) {
        const grabbedCell = cellAt(found.c, g.cellCm, pl.x, pl.y);
        longPressData.current = {
          pointerId: e.pointerId,
          planting: found.planting,
          plant: found.plant,
          c: found.c,
          grabOffsetCol: grabbedCell ? grabbedCell.col - found.planting.cells.col : 0,
          grabOffsetRow: grabbedCell ? grabbedCell.row - found.planting.cells.row : 0,
        };
        longPressTimer.current = setTimeout(() => {
          const data = longPressData.current;
          longPressData.current = null;
          longPressTimer.current = null;
          if (!data?.planting.cells) return;
          gesture.current = {
            kind: 'move-planting',
            id: data.pointerId,
            plantingId: data.planting.id,
            containerId: data.c.id,
            sourceCells: data.planting.cells,
            plant: data.plant,
            grabOffsetCol: data.grabOffsetCol,
            grabOffsetRow: data.grabOffsetRow,
          };
        }, 350);
      }
    }

    gesture.current = { kind: 'tap', id: e.pointerId, x: p.x, y: p.y, moved: false, type: e.pointerType, plantingTarget: tapPlantingTarget };
  };

  const onPointerMove = (e: PointerEvent) => {
    const gs = gesture.current;
    if (!gs || !pointers.current.has(e.pointerId)) return;
    const p = local(e);
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, p);
    if (gs.kind === 'pinch') {
      const pts = [...pointers.current.values()];
      if (pts.length < 2) return;
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const z = zoomAt(gs.view, viewport.value, dist / gs.dist, gs.mid.x, gs.mid.y);
      view.value = panBy(z, mid.x - gs.mid.x, mid.y - gs.mid.y);
      return;
    }
    if (gs.kind === 'tap') {
      const dist = Math.hypot(p.x - gs.x, p.y - gs.y);
      if (dist < 6) return;
      // Cancel the touch long-press when the finger moves more than 8 px.
      if (gs.type === 'touch' && longPressTimer.current !== null && dist > 8) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
        longPressData.current = null;
      }
      // First significant move on a planting (mouse/pen): become a move-planting gesture.
      if (!gs.moved && gs.plantingTarget) {
        const { planting, plant, c, grabOffsetCol, grabOffsetRow } = gs.plantingTarget;
        gesture.current = {
          kind: 'move-planting',
          id: gs.id,
          plantingId: planting.id,
          containerId: c.id,
          sourceCells: planting.cells!,
          plant,
          grabOffsetCol,
          grabOffsetRow,
        };
        return;
      }
      gs.moved = true;
      view.value = panBy(view.value!, p.x - prev.x, p.y - prev.y);
      hoverInfo.value = null;
      return;
    }
    if (gs.kind === 'paint') {
      const pl = toPlane(p);
      const c = containers.value.find((x) => x.id === gs.bedId);
      if (c?.form !== 'grid') return;
      const cell = cellAt(c, g.cellCm, pl.x, pl.y);
      if (cell) paintTo(c.id, cell);
      return;
    }
    if (gs.kind === 'move') {
      const pl = toPlane(p);
      const step = g.cellCm / 4;
      dragPreview.value = { id: gs.c.id, dx: Math.round((pl.x - gs.x) / step) * step, dy: Math.round((pl.y - gs.y) / step) * step };
      return;
    }
    if (gs.kind === 'move-planting') {
      const pl = toPlane(p);
      const hit = hitTest(pl.x, pl.y);
      if (hit?.c.form === 'grid' && hit.cell) {
        const sc = gs.sourceCells;
        // Keep the grabbed cell under the pointer by subtracting the grab offset.
        const targetCells: Cells = { col: hit.cell.col - gs.grabOffsetCol, row: hit.cell.row - gs.grabOffsetRow, w: sc.w, h: sc.h };
        const gardenVal = garden.value;
        if (gardenVal) {
          const container = gardenVal.containers.find((c) => c.id === hit.c.id);
          if (container?.form === 'grid') {
            const iof = intervalOfP.value;
            const p0 = gardenVal.plantings.find((p) => p.id === gs.plantingId);
            if (p0) {
              const existing = gardenVal.plantings.filter((p) => p.id !== gs.plantingId);
              const fakeReq = { plant: gs.plant, method: p0.method, bed: container, cells: targetCells, from: 0 as number };
              const proposal = propose({ ...fakeReq, from: iof(p0)?.bedIn ?? 0 }, { ...gardenVal, plantings: existing }, plantOf);
              plantingMove.value = {
                plantingId: gs.plantingId,
                sourceContainerId: gs.containerId,
                sourceCells: gs.sourceCells,
                targetContainerId: hit.c.id,
                targetCells,
                proposal: proposal,
              };
            }
          }
        }
      } else {
        plantingMove.value = null;
      }
      return;
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    const gs = gesture.current;
    pointers.current.delete(e.pointerId);
    // Cancel a pending long-press when the finger lifts.
    if (longPressTimer.current !== null) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      longPressData.current = null;
    }
    if (!gs) return;
    if (gs.kind === 'pinch') {
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    gesture.current = null;

    if (gs.kind === 'paint') {
      const d2 = draft.value;
      const wasDrag = d2.start && d2.end && (d2.start.col !== d2.end.col || d2.start.row !== d2.end.row);
      if (wasDrag) {
        finishPaint(e.clientX, e.clientY);
      } else {
        // Single-cell click: plant at minCells.
        const cell = d2.start;
        const cid = d2.containerId;
        draft.value = { ...draft.value, phase: 'none', start: null, end: null };
        if (cell && cid) placeAtCell(cid, cell, e.clientX, e.clientY);
      }
      return;
    }

    if (gs.kind === 'move') {
      const pv = dragPreview.value;
      dragPreview.value = null;
      if (pv && (pv.dx !== 0 || pv.dy !== 0)) {
        const c = gs.c;
        act(
          { type: 'updateContainer', gardenId: g.id, containerId: c.id, patch: { x: round2(c.x + pv.dx), y: round2(c.y + pv.dy) } },
          `move ${c.name}`,
          `Moved ${c.name}.`,
        );
      } else {
        selectAt(gs.c, gs.cell);
      }
      return;
    }

    if (gs.kind === 'move-planting') {
      const mv = plantingMove.value;
      plantingMove.value = null;
      if (mv && (mv.targetContainerId !== mv.sourceContainerId || mv.targetCells.col !== mv.sourceCells.col || mv.targetCells.row !== mv.sourceCells.row)) {
        const gardenVal = garden.value;
        if (gardenVal && mv.proposal && mv.proposal.clashes.length === 0 && !mv.proposal.problem) {
          act(
            { type: 'updatePlanting', gardenId: gardenVal.id, plantingId: mv.plantingId, patch: { containerId: mv.targetContainerId, cells: mv.targetCells } },
            `move ${gs.plant.name.toLowerCase()}`,
            `Moved ${gs.plant.name.toLowerCase()}.`,
          );
        } else if (mv.proposal?.clashes.length) {
          showToastMsg(`${gs.plant.name} clashes at that spot.`);
        }
      } else {
        // No move: select the planting (handles long-press-then-lift and click-without-drag).
        selection.value = { kind: 'planting', id: gs.plantingId };
      }
      return;
    }

    if (gs.kind === 'tap' && !gs.moved && e.type === 'pointerup') {
      const pl = toPlane(local(e));
      const hit = hitTest(pl.x, pl.y);
      tapOn(hit, e.clientX, e.clientY);
      setCursorFrom(hit);
    }
  };

  const tapOn = (hit: Hit, screenX = 0, screenY = 0) => {
    if (placingPlantId.value !== null) {
      if (hit?.c.form === 'grid' && hit.cell) placeAtCell(hit.c.id, hit.cell, screenX, screenY);
      else if (hit?.c.form === 'vessel') placeInVessel(hit.c.id);
      return;
    }
    if (!hit) {
      selection.value = null;
      return;
    }
    selectAt(hit.c, hit.cell);
  };

  // ---- Hover tooltip -------------------------------------------------------------------------
  const onPointerMoveHover = (e: PointerEvent) => {
    if (gesture.current || placingPlantId.value !== null || paletteDrag.value !== null) {
      hoverInfo.value = null;
      return;
    }
    const pl = toPlane(local(e));
    const found = plantingAt(pl.x, pl.y);
    if (found) {
      const iof = intervalOfP.value;
      const phases = phasesOfP.value(found.planting);
      let dates = '';
      if (phases) {
        dates = phases.bedOut !== null ? fmtSpan(phases.bedIn, phases.bedOut, shownDay.value) : `from ${fmtNear(phases.bedIn, shownDay.value)}`;
      }
      hoverInfo.value = { name: found.plant.name, count: found.planting.count, dates, x: e.clientX, y: e.clientY };
    } else {
      hoverInfo.value = null;
    }
  };

  // ---- Keyboard ------------------------------------------------------------------------------
  const onKeyDown = (e: KeyboardEvent) => {
    const all = [...containers.value].sort((a, b) => {
      const ra = footprints.value.get(a.id)!;
      const rb = footprints.value.get(b.id)!;
      return ra.y - rb.y || ra.x - rb.x;
    });
    if (all.length === 0) return;
    const k = e.key;
    const sel0 = selection.value;

    if (e.shiftKey && k.startsWith('Arrow') && sel0?.kind === 'container' && placingPlantId.value === null) {
      const c = g.containers.find((x) => x.id === sel0.id);
      if (!c) return;
      e.preventDefault();
      const step = g.cellCm;
      const dx = k === 'ArrowLeft' ? -step : k === 'ArrowRight' ? step : 0;
      const dy = k === 'ArrowUp' ? -step : k === 'ArrowDown' ? step : 0;
      act({ type: 'updateContainer', gardenId: g.id, containerId: c.id, patch: { x: round2(c.x + dx), y: round2(c.y + dy) } }, `move ${c.name}`, undefined, { coalesceKey: `move-${c.id}` });
      return;
    }
    canvasFocused.value = true;
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      cursor.value = stepCursor(cursor.value, k, all, g.cellCm);
      return;
    }
    if (k === 'Enter' || k === ' ') {
      e.preventDefault();
      const c0 = cursor.value ?? { containerId: all[0]!.id, sx: 0, sy: 0 };
      cursor.value = c0;
      const c = all.find((x) => x.id === c0.containerId);
      if (!c) return;
      tapOn({ c, cell: c.form === 'grid' ? squareToCell(c, c0.sx, c0.sy) : null });
      return;
    }
    if (k === 'Escape') {
      if (clashCard.value) {
        e.preventDefault();
        clashCard.value = null;
        return;
      }
      if (placingPlantId.value !== null) {
        e.preventDefault();
        if (draft.value.phase !== 'none') clearSquares();
        else stopPlacing();
      } else if (selection.value) {
        e.preventDefault();
        selection.value = null;
      }
      return;
    }
    if ((k === 'Delete' || k === 'Backspace') && placingPlantId.value === null && sel0?.kind === 'planting') {
      e.preventDefault();
      const planting = g.plantings.find((p) => p.id === sel0.id);
      if (planting) {
        const plant = plantOf(planting.plantId);
        const name = plant ? inSentence(plant.name) : 'plant';
        const res = act({ type: 'removePlanting', gardenId: g.id, plantingId: planting.id }, `pull out ${name}`, `Pulled out ${name}.`);
        if (res.ok) selection.value = null;
      }
      return;
    }
    if (k === '+' || k === '=') zoomBy(1.25);
    else if (k === '-' || k === '_') zoomBy(0.8);
    else if (k === '0') fitAll();
  };

  const announce = cursorText(cur, list, presentMap, plantOf, g.cellCm, cand, d);
  const placing = placingPlantId.value !== null;
  const hover = hoverInfo.value;

  return (
    <div class="canvas-wrap" ref={wrap}>
      <div
        ref={app}
        class={`canvas-app${placing ? ' is-placing' : ''}`}
        role="application"
        aria-roledescription="garden plan"
        aria-label={`Plan of ${g.name}`}
        aria-describedby={`${descriptionId} canvas-keys`}
        tabIndex={0}
        style={{
          backgroundSize: `${paper}px ${paper}px`,
          backgroundPosition: `${-vb.x * s}px ${-vb.y * s}px`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => { onPointerMove(e); onPointerMoveHover(e); }}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => { hoverInfo.value = null; }}
        onKeyDown={onKeyDown}
        onFocus={(e) => {
          if (!(e.currentTarget as HTMLElement).matches(':focus-visible')) return;
          canvasFocused.value = true;
          if (!cursor.value && list[0]) cursor.value = { containerId: list[0].id, sx: 0, sy: 0 };
        }}
        onBlur={() => {
          canvasFocused.value = false;
        }}
      >
        <svg class="canvas-svg" viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} aria-hidden="true" focusable="false">
          <defs>
            <pattern id="gs-soil" width="10" height="10" patternUnits="userSpaceOnUse">
              <rect width="10" height="10" fill="var(--c-soil)" />
              <circle cx="3" cy="3" r="0.8" fill="var(--c-soil-speck)" />
              <circle cx="7.5" cy="7.5" r="0.7" fill="var(--c-soil-speck)" />
            </pattern>
            <pattern id="gs-taken" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="var(--c-paper)" fill-opacity="0.35" />
              <path d="M0 0V7" stroke="var(--c-muted)" stroke-width="1.4" opacity="0.55" />
            </pattern>
          </defs>
          {layer}
        </svg>
        <span id="canvas-keys" class="visually-hidden">
          Arrow keys (up, down, left, right) move between squares and from one bed or pot to the next. Enter or Space plants at the cursor while placing, or picks what is there. Escape cancels. Plus and minus zoom, 0 shows the whole garden. Shift and an arrow key moves a selected bed. Delete or Backspace pulls out the selected planting.
        </span>
        <span class="visually-hidden" aria-live="polite">
          {focused ? announce : ''}
        </span>
      </div>
      <div class="canvas-labels" aria-hidden="true" style={vars}>
        {labels}
      </div>
      <div class="canvas-tags" style={vars}>
        {list.map((c) => {
          const r = footprints.value.get(c.id);
          if (!r) return null;
          const off = drag && drag.id === c.id ? drag : { dx: 0, dy: 0 };
          const isGrid = c.form === 'grid';
          const frameT = c.form === 'grid' ? frameOf(c) : 0;
          const st = isGrid ? at(r.x + off.dx, r.y + off.dy - frameT, -frameT * s, level >= 1 ? -20 : -6) : at(c.x + off.dx, r.y + r.h + off.dy, 0, 6);
          const selected = sel?.kind === 'container' && sel.id === c.id;
          return (
            <button
              key={c.id}
              type="button"
              class={`bed-tag${isGrid ? '' : ' bed-tag-vessel'}`}
              style={st}
              aria-pressed={selected}
              onClick={() => (selection.value = { kind: 'container', id: c.id })}
            >
              <strong>{c.name}</strong>
              <span class="muted">{sizeText(c)}</span>
            </button>
          );
        })}
      </div>
      <div class="canvas-zoom" role="group" aria-label="Zoom">
        <button type="button" class="btn btn-icon zoom-btn" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(1.25)}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M9 3V15M3 9H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
        <button type="button" class="btn btn-icon zoom-btn" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(0.8)}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M3 9H15" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
        <button type="button" class="btn btn-icon zoom-btn" aria-label="Show the whole garden" title="Show the whole garden" onClick={() => fitAll()}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M2 6V2H6M12 2H16V6M16 12V16H12M6 16H2V12" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round" />
          </svg>
        </button>
      </div>
      <NorthAndScale cellCm={g.cellCm} s={s} />
      {hover ? (
        <div
          class="patch-tooltip"
          role="tooltip"
          aria-hidden="true"
          style={{ position: 'fixed', left: `${hover.x + 14}px`, top: `${hover.y - 10}px` }}
        >
          <strong>{hover.name}</strong>
          {hover.count > 0 ? <span>, {hover.count}</span> : null}
          {hover.dates ? <span> {hover.dates}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Compute the snap position for a palette drag at the given client coordinates. */
function computePaletteDragSnap(clientX: number, clientY: number, canvasEl: HTMLElement | null): PaletteDragState['snap'] {
  if (!canvasEl) return null;
  const state = paletteDrag.value;
  if (!state) return null;
  const g = garden.value;
  const v = view.value;
  if (!g || !v) return null;

  const rect = canvasEl.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;

  const localX = clientX - rect.left;
  const localY = clientY - rect.top;
  // Compute the viewBox correctly even if the ResizeObserver has not yet updated view.value.
  //
  // Our ResizeObserver policy keeps the viewBox TOP-LEFT CORNER FIXED when the canvas resizes
  // (see the ro = new ResizeObserver(…) block). So the top-left of the viewBox is invariant
  // under resize, regardless of whether view.value has been updated yet.
  //
  // To exploit this: compute the stored top-left from view.value + viewport.value (which are
  // always consistent with each other), then extend it to the live canvas size from
  // getBoundingClientRect. This eliminates the race condition in WebKit where the ResizeObserver
  // fires AFTER the pointer event, causing view.value to be stale relative to the live size.
  const storedSize = viewport.value;
  const storedVb = viewBoxOf(v, storedSize);
  // storedVb.x/y is the invariant top-left corner; w/h use the live canvas pixel size.
  const liveSize = { w: rect.width, h: rect.height };
  const vb = { x: storedVb.x, y: storedVb.y, w: liveSize.w / v.s, h: liveSize.h / v.s };
  const planeX = vb.x + localX / v.s;
  const planeY = vb.y + localY / v.s;

  for (const c of containers.value) {
    if (c.form !== 'grid') continue;
    const cell = cellAt(c, g.cellCm, planeX, planeY);
    if (cell) {
      const plant = state.plant;
      const min = minCells(plant);
      const cells: Cells = { col: cell.col, row: cell.row, w: min.w, h: min.h };
      const method = defaultMethod(plant);
      const iof = intervalOfP.value;
      void iof; // used inside propose via garden
      const proposal = propose({ plant, method, bed: c, cells, from: shownDay.value }, g, plantLookup.value);
      return { containerId: c.id, cells, proposal };
    }
  }
  return null;
}

function showToastMsg(text: string): void {
  // Import act from plannerState via closure - act is already imported above.
  // Use the toast signal directly since act requires an op.
  import('./plannerState').then(({ showToast }) => showToast(text)).catch(() => undefined);
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function NorthAndScale({ cellCm, s }: { cellCm: number; s: number }) {
  const u = units.value;
  const steps = [1, 2, 5, 10, 20, 50, 100];
  const k = steps.find((n) => n * cellCm * s >= 48) ?? 100;
  const px = Math.min(160, k * cellCm * s);
  return (
    <div class="canvas-legend">
      <div class="north">
        <svg width="34" height="34" viewBox="-17 -17 34 34" aria-hidden="true">
          <circle r="15" fill="var(--c-panel)" stroke="var(--c-line)" />
          <path d="M0 -11L5 4L0 1L-5 4Z" fill="var(--c-ink)" />
        </svg>
        <span>N</span>
        <span class="visually-hidden">North is up</span>
      </div>
      <div class="scale">
        <span class="scale-bar" style={{ width: `${px}px` }} aria-hidden="true" />
        <span>1 square = {formatLength(cellCm, u)}</span>
      </div>
    </div>
  );
}

function stepCursor(
  cur: { containerId: string; sx: number; sy: number } | null,
  key: string,
  all: Container[],
  cellCm: number,
): { containerId: string; sx: number; sy: number } {
  void cellCm;
  const first = all[0]!;
  if (!cur || !all.some((c) => c.id === cur.containerId)) return { containerId: first.id, sx: 0, sy: 0 };
  const idx = all.findIndex((c) => c.id === cur.containerId);
  const c = all[idx]!;
  const sq = c.form === 'grid' ? footprintSquares(c) : { w: 1, h: 1 };
  let { sx, sy } = cur;
  if (key === 'ArrowLeft') sx--;
  if (key === 'ArrowRight') sx++;
  if (key === 'ArrowUp') sy--;
  if (key === 'ArrowDown') sy++;
  if (sx >= 0 && sy >= 0 && sx < sq.w && sy < sq.h) return { containerId: c.id, sx, sy };
  const forward = key === 'ArrowRight' || key === 'ArrowDown';
  const next = all[(idx + (forward ? 1 : all.length - 1)) % all.length]!;
  const nsq = next.form === 'grid' ? footprintSquares(next) : { w: 1, h: 1 };
  return forward ? { containerId: next.id, sx: 0, sy: 0 } : { containerId: next.id, sx: nsq.w - 1, sy: nsq.h - 1 };
}

function cursorText(
  cur: { containerId: string; sx: number; sy: number } | null,
  list: Container[],
  presentMap: Map<string, Planting[]>,
  plantOf: (id: string) => Plant | undefined,
  cellCm: number,
  cand: Candidate | null,
  d: Draft,
): string {
  void cellCm;
  if (!cur) return '';
  const c = list.find((x) => x.id === cur.containerId);
  if (!c) return '';
  const here = presentMap.get(c.id) ?? [];
  if (c.form === 'vessel') {
    const what = here.map((p) => `${plantOf(p.plantId)?.name ?? 'a plant'}, ${p.count}`).join('; ');
    return `${c.name}: ${what || 'empty'}`;
  }
  const cell = squareToCell(c, cur.sx, cur.sy);
  const p = here.find((x) => x.cells && cell.col >= x.cells.col && cell.col < x.cells.col + x.cells.w && cell.row >= x.cells.row && cell.row < x.cells.row + x.cells.h);
  let text = `${c.name}, ${squareName(cell)}: ${p ? `${plantOf(p.plantId)?.name ?? 'a plant'}, ${p.count} plants` : 'free'}`;
  if (cand && d.containerId === c.id && cand.cells) text += `. Chosen ${cellsName(cand.cells)}, ${cand.count} ${inSentence(cand.plant.name)}`;
  return text;
}
