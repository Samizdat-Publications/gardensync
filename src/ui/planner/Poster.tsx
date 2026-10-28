// The garden as a poster: every bed and pot to scale with what is planted in it on one day, and a
// list of those plantings with their dates. One SVG serves both printing and "Save a picture", so it
// is drawn from the garden data (not the on-screen canvas, whose labels are HTML) in fixed light
// colours that print well whatever theme the app is in.
import type { Container, Garden, Planting } from '../../domain/doc/schema';
import { squaresLabel } from '../../domain/layout/labels';
import type { PlantingPhases } from '../../domain/schedule';
import type { Plant } from '../../domain/plants/schema';
import { formatLength, formatVolume, type Units } from '../../domain/units';
import { Glyph } from '../components/Glyph';
import { fmtDay, fmtRange } from '../format';
import { boundsOf, cellsRect, containerFootprint, type Rect } from './geometry';

const INK = '#1c231d';
const MUTED = '#4d584e';
const SOIL = '#e7dcc9';
const TIMBER = '#8e6b46';
const POT = '#a85a36';
const PAPER = '#ffffff';

export interface PosterProps {
  garden: Garden;
  day: number;
  units: Units;
  plantOf: (id: string) => Plant | undefined;
  phasesOf: (p: Planting) => PlantingPhases | null;
  /** Plantings in the ground on `day`, per container id. */
  present: ReadonlyMap<string, readonly Planting[]>;
  id?: string;
}

function lineFor(p: Planting, plant: Plant | undefined, ph: PlantingPhases | null, c: Container): string {
  const name = plant?.name ?? p.plantId;
  const where = p.cells ? `${c.name} ${squaresLabel(p.cells)}` : c.name;
  const dates = ph ? `since ${fmtDay(ph.bedIn)}${ph.harvest ? `, pick ${fmtRange(ph.harvest.start, ph.harvest.end)}` : ''}` : '';
  return [`${name}, ${p.count}`, where, dates].filter(Boolean).join(' · ');
}

/** A label size that fits the patch: about 0.6 em a character, never bigger than the body text. */
function labelSize(label: string, width: number, u: number): number {
  return Math.min(0.85 * u, (width * 0.92) / (0.6 * label.length));
}

export function PlanPoster({ garden, day, units, plantOf, phasesOf, present, id }: PosterProps) {
  const rects = garden.containers.map((c) => containerFootprint(c, garden.cellCm));
  const b: Rect = boundsOf(rects) ?? { x: 0, y: 0, w: 240, h: 120 };
  // One text unit, in the plan's own centimetres, so text keeps its size relative to the garden.
  const u = Math.min(30, Math.max(5, Math.max(b.w, b.h) / 55));
  const W = Math.max(b.w, 80 * u);
  const pad = 3 * u;
  const lines: { text: string; color: string }[] = [];
  for (const c of garden.containers) {
    for (const p of present.get(c.id) ?? []) {
      const plant = plantOf(p.plantId);
      lines.push({ text: lineFor(p, plant, phasesOf(p), c), color: plant?.glyph.color ?? MUTED });
    }
  }
  const maxChars = Math.floor(W / (0.52 * u));
  const top = pad + 4.6 * u;
  const listTop = top + b.h + 3 * u;
  const H = listTop + (lines.length + 2) * 1.6 * u + pad;
  const ox = pad - b.x;
  const oy = top - b.y;

  return (
    <svg
      id={id}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W + 2 * pad} ${H}`}
      role="img"
      aria-label={`Plan of ${garden.name} on ${fmtDay(day)}`}
      font-family="system-ui, sans-serif"
      style={{ '--c-glyph-edge': '#2b2a24', background: PAPER }}
    >
      <rect x="0" y="0" width={W + 2 * pad} height={H} fill={PAPER} />
      <text x={pad} y={pad + 1.6 * u} font-size={2 * u} font-weight="800" fill={INK}>
        {garden.name} on {fmtDay(day)}
      </text>
      <text x={pad} y={pad + 2.9 * u} font-size={0.9 * u} fill={MUTED}>
        {`${garden.climate?.place ? `${garden.climate.place.name}. ` : ''}One square is ${formatLength(garden.cellCm, units)}.`}
      </text>
      <g transform={`translate(${ox} ${oy})`}>
        {garden.containers.map((c, i) => {
          const r = rects[i]!;
          const shown = present.get(c.id) ?? [];
          return (
            <g key={c.id}>
              {c.form === 'grid' ? (
                <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={2} fill={SOIL} stroke={TIMBER} stroke-width={Math.max(2, garden.cellCm / 10)} />
              ) : (
                <circle cx={c.x} cy={c.y} r={c.diameterCm / 2} fill={SOIL} stroke={c.kind === 'grow-bag' ? '#4a4f45' : POT} stroke-width={Math.max(2, c.diameterCm / 18)} />
              )}
              {shown.map((p) => {
                const plant = plantOf(p.plantId);
                if (!plant) return null;
                const pr = c.form === 'grid' && p.cells ? cellsRect(c, garden.cellCm, p.cells) : { x: r.x + r.w / 6, y: r.y + r.h / 6, w: (r.w * 2) / 3, h: (r.h * 2) / 3 };
                const g = Math.min(pr.w, pr.h) * 0.55;
                return (
                  <g key={p.id}>
                    <rect x={pr.x + 1.5} y={pr.y + 1.5} width={pr.w - 3} height={pr.h - 3} rx={3} fill={plant.glyph.color} fill-opacity="0.18" stroke={plant.glyph.color} stroke-width="1.5" />
                    <Glyph form={plant.glyph.form} color={plant.glyph.color} size={g} x={pr.x + (pr.w - g) / 2} y={pr.y + (pr.h - g) / 2 - 0.3 * u} />
                    <text x={pr.x + pr.w / 2} y={pr.y + pr.h - 0.5 * u} font-size={labelSize(`${plant.name} ${p.count}`, pr.w, u)} text-anchor="middle" font-weight="700" fill={INK}>
                      {plant.name} {p.count}
                    </text>
                  </g>
                );
              })}
              <text x={r.x} y={r.y - 0.5 * u} font-size={0.95 * u} font-weight="700" fill={INK}>
                {c.name}
                {c.form === 'vessel' ? `, ${formatVolume(c.litres, units)}` : ''}
              </text>
            </g>
          );
        })}
      </g>
      <text x={pad} y={listTop} font-size={1.1 * u} font-weight="800" fill={INK}>
        {lines.length === 0 ? 'Nothing is in the ground on this day.' : 'In the ground on this day'}
      </text>
      {lines.map((l, i) => (
        <g key={i}>
          <rect x={pad} y={listTop + (i + 0.7) * 1.6 * u} width={0.8 * u} height={0.8 * u} rx={0.2 * u} fill={l.color} />
          <text x={pad + 1.3 * u} y={listTop + (i + 1.2) * 1.6 * u} font-size={0.9 * u} fill={INK}>
            {l.text.length > maxChars ? `${l.text.slice(0, maxChars - 3)}...` : l.text}
          </text>
        </g>
      ))}
      <text x={pad} y={H - pad / 2} font-size={0.75 * u} fill={MUTED}>
        Made with GardenSync, a garden planner for home gardeners.
      </text>
    </svg>
  );
}
