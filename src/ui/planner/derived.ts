// Values the planner works out from the garden and the day shown. Computed signals, so they are
// worked out once per change of the garden or the day, never per frame of a pan or zoom. The
// schedule itself is memoised in the domain; these only avoid redoing the loops around it.
import { computed } from '@preact/signals';
import type { Container, Planting } from '../../domain/doc/schema';
import { occupiedAt, type PlantOf } from '../../domain/layout/occupancy';
import { rotationWarnings, type RotationWarning } from '../../domain/layout/rotation';
import type { Plant } from '../../domain/plants/schema';
import { resolvePlant } from '../../domain/plants/resolve';
import { toDay } from '../../domain/dates';
import { garden, today } from '../appState';
import { selection, shownDay } from '../uiState';
import { containerFootprint, type Rect } from './geometry';
import { makeIntervalOf, makePhasesOf } from './placement';

/** Plant lookup for the active garden (built-in and custom). */
export const plantLookup = computed<PlantOf>(() => {
  const custom = garden.value?.customPlants ?? [];
  return (id: string): Plant | undefined => resolvePlant(id, custom)?.plant;
});

export const intervalOfP = computed(() => makeIntervalOf(garden.value?.climate ?? null, plantLookup.value));
export const phasesOfP = computed(() => makePhasesOf(garden.value?.climate ?? null, plantLookup.value));

/** Containers in drawing order: grid beds first (they are big), then pots on top. */
export const containers = computed<Container[]>(() => {
  const list = garden.value?.containers ?? [];
  return [...list.filter((c) => c.form === 'grid'), ...list.filter((c) => c.form === 'vessel')];
});

export const footprints = computed<Map<string, Rect>>(() => {
  const g = garden.value;
  const out = new Map<string, Rect>();
  if (!g) return out;
  for (const c of g.containers) out.set(c.id, containerFootprint(c, g.cellCm));
  return out;
});

/** Plantings in the ground on the day shown, by container. */
export const present = computed<Map<string, Planting[]>>(() => {
  const g = garden.value;
  const out = new Map<string, Planting[]>();
  if (!g) return out;
  const day = shownDay.value;
  const iof = intervalOfP.value;
  for (const c of g.containers) out.set(c.id, occupiedAt(c, g.plantings, day, iof).present);
  return out;
});

/** Plantings per container, whatever the day. */
export const plantingsByContainer = computed<Map<string, Planting[]>>(() => {
  const out = new Map<string, Planting[]>();
  for (const p of garden.value?.plantings ?? []) {
    const list = out.get(p.containerId);
    if (list) list.push(p);
    else out.set(p.containerId, [p]);
  }
  return out;
});

export const rotation = computed<RotationWarning[]>(() => {
  const g = garden.value;
  if (!g) return [];
  const phases = phasesOfP.value;
  return rotationWarnings(g, plantLookup.value, (p) => phases(p)?.season ?? null);
});

export const selectedPlanting = computed<Planting | null>(() => {
  const s = selection.value;
  if (s?.kind !== 'planting') return null;
  return garden.value?.plantings.find((p) => p.id === s.id) ?? null;
});

export const selectedContainer = computed<Container | null>(() => {
  const s = selection.value;
  const g = garden.value;
  if (!s || !g) return null;
  if (s.kind === 'container') return g.containers.find((c) => c.id === s.id) ?? null;
  const p = g.plantings.find((x) => x.id === s.id);
  return p ? (g.containers.find((c) => c.id === p.containerId) ?? null) : null;
});

/** Plantings not yet in the ground on the day shown but going in within the next 300 days. */
export const upcoming = computed<Map<string, Planting[]>>(() => {
  const g = garden.value;
  const out = new Map<string, Planting[]>();
  if (!g) return out;
  const day = shownDay.value;
  const iof = intervalOfP.value;
  for (const c of g.containers) {
    const list: Planting[] = [];
    for (const p of g.plantings) {
      if (p.containerId !== c.id) continue;
      const interval = iof(p);
      if (!interval) continue;
      if (interval.bedIn > day && interval.bedIn <= day + 300) {
        list.push(p);
      }
    }
    if (list.length > 0) out.set(c.id, list);
  }
  return out;
});

/**
 * When nothing is in the ground today but plantings are coming (a garden started in the fall for
 * next spring), the day within the next ten months with the most plantings in the ground, so the
 * planner can offer to show it. null otherwise.
 */
export const busiestAhead = computed<{ first: number; best: number } | null>(() => {
  const g = garden.value;
  if (!g) return null;
  const t = toDay(today.value);
  const iof = intervalOfP.value;
  const spans = g.plantings.map(iof).filter((i): i is NonNullable<typeof i> => i !== null);
  if (spans.some((i) => i.bedIn <= t && (i.bedOut === null || t < i.bedOut))) return null;
  const ahead = spans.filter((i) => i.bedIn > t && i.bedIn <= t + 300);
  if (ahead.length === 0) return null;
  let best = ahead[0]!.bedIn;
  let most = 0;
  for (const s of ahead.map((i) => i.bedIn).sort((a, b) => a - b)) {
    const n = spans.filter((i) => i.bedIn <= s && (i.bedOut === null || s < i.bedOut)).length;
    if (n > most) {
      most = n;
      best = s;
    }
  }
  return { first: Math.min(...ahead.map((i) => i.bedIn)), best };
});
