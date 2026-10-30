// The planting being placed, worked out from the plant chosen and the squares or pot picked: its
// count, its dates (the next viable window from the day shown), and what it would clash with.
import { computed } from '@preact/signals';
import { fmtDay } from '../format';
import type { DayNum } from '../../domain/dates';
import type { Cells, Container, Planting } from '../../domain/doc/schema';
import { conflictsFor, intervalsOverlap, vesselLoad, type BedInterval, type Clash, type VesselLoad } from '../../domain/layout/occupancy';
import { defaultCount, minCells, vesselFit, vesselWarningText, type VesselFit } from '../../domain/layout/patch';
import type { Plant } from '../../domain/plants/schema';
import { plantingPhases, type PlantingPhases } from '../../domain/schedule';
import { garden, units } from '../appState';
import { placingPlantId, shownDay } from '../uiState';
import { intervalOfP, plantLookup } from './derived';
import { cellsBetween } from './geometry';
import { draft, methodNow } from './plannerState';
import { anchorFor, windowWords, type PlaceMethod, type WindowChoice } from './placement';

export interface Taken {
  planting: Planting;
  /** First free day, null when it holds the squares from year to year. */
  until: DayNum | null;
}

export interface Candidate {
  plant: Plant;
  method: PlaceMethod;
  container: Container | null;
  cells: Cells | null;
  /** The count it gets at the plant's density, or the vessel's room. */
  defaultCount: number;
  count: number;
  /** For vessels: how many fit. */
  maxCount: number | null;
  choice: WindowChoice | null;
  phases: PlantingPhases | null;
  /** "Sow Apr 2, spring window". */
  datesText: string;
  /** Problems that stop the planting. */
  problems: string[];
  /** Things worth saying that do not stop it. */
  warnings: string[];
  clashes: Clash[];
  load: VesselLoad | null;
  /** Clashes that need "Interplant anyway" (or "Plant anyway" for a crowded pot). */
  needsAnyway: boolean;
  /** Plantings in grid beds whose time in the ground overlaps this one's: their squares are taken. */
  taken: Taken[];
  /** The planting to add, without an id, when it can go in. */
  planting: Omit<Planting, 'id'> | null;
}

const PROBE = 'candidate';

export const candidate = computed<Candidate | null>(() => {
  const plantId = placingPlantId.value;
  const g = garden.value;
  if (!plantId || !g) return null;
  const plant = plantLookup.value(plantId);
  if (!plant) return null;
  const d = draft.value;
  const method = d.method ?? methodNow(plant);
  const from = shownDay.value;
  const climate = g.climate;
  const iof = intervalOfP.value;
  const problems: string[] = [];
  const warnings: string[] = [];

  const a = anchorFor(plant, climate, method, from);
  const container = d.containerId ? (g.containers.find((c) => c.id === d.containerId) ?? null) : null;

  let cells: Cells | null = null;
  let dflt = 0;
  let maxCount: number | null = null;
  let fit: VesselFit | null = null;
  if (container?.form === 'grid' && d.start) {
    cells = cellsBetween(d.start, d.end ?? d.start);
    dflt = defaultCount(plant, cells);
    if (dflt === 0) {
      const need = minCells(plant);
      problems.push(`${plant.name} needs ${need.w} by ${need.h} squares for each plant, and only ${cells.w} by ${cells.h} are chosen. Choose more squares, or a big pot.`);
    }
  } else if (container?.form === 'vessel') {
    fit = vesselFit(plant, container);
    maxCount = fit.maxCount;
    dflt = fit.maxCount;
    if (fit.warning) {
      const text = vesselWarningText(fit.warning, plant.name, units.value);
      if (fit.warning.kind === 'not-suited') problems.push(text);
      else warnings.push(text);
    }
  }
  const count = Math.max(0, Math.min(d.count ?? dflt, maxCount ?? 10_000));

  let choice: WindowChoice | null = null;
  let datesText = '';
  if (!a) {
    problems.push(`${plant.name} has no planting window here this season or next, so there are no dates to give.`);
  } else {
    choice = a.choice;
  }

  // The planting as it would be stored; a probe square stands in until squares are chosen.
  const base: Omit<Planting, 'id'> | null = a
    ? {
        containerId: container?.id ?? PROBE,
        plantId,
        ...(container?.form === 'vessel' ? {} : { cells: cells ?? { col: 0, row: 0, w: 1, h: 1 } }),
        count: Math.max(1, count),
        method,
        anchor: a.anchor,
      }
    : null;
  const probe: Planting | null = base ? { ...base, id: PROBE } : null;
  const phases = probe ? plantingPhases(probe, plant, climate) : null;
  if (a && !phases && climate) problems.push(`The dates for ${plant.name} could not be worked out this way. Try another way of growing it.`);
  if (phases) {
    const verb = method === 'direct' ? 'Sow' : method === 'plant' ? 'Plant' : 'Plant out';
    datesText = `${verb} ${fmtDay(phases.bedIn)}`;
    if (choice) datesText += `, ${windowWords(choice)}`;
    if (phases.harvest) datesText += `. Pick ${fmtDay(phases.harvest.start)} to ${fmtDay(phases.harvest.end)}`;
    datesText += '.';
    if (!climate) warnings.push('Add your town or frost dates in Settings to get planting dates. For now it goes in on the day shown.');
  }

  // Who else is in this bed while it would be.
  const taken: Taken[] = [];
  const ci: BedInterval | null = phases ? { bedIn: phases.bedIn, bedOut: phases.bedOut } : null;
  if (ci) {
    for (const p of g.plantings) {
      if (!p.cells) continue;
      const pi = iof(p);
      if (pi && intervalsOverlap(ci, pi)) taken.push({ planting: p, until: pi.bedOut });
    }
  }

  let clashes: Clash[] = [];
  let load: VesselLoad | null = null;
  if (probe && container && ci) {
    if (container.form === 'grid' && cells) clashes = conflictsFor(probe, g.plantings, iof, plantLookup.value);
    if (container.form === 'vessel' && fit && fit.maxCount > 0) {
      load = vesselLoad(probe, container, g.plantings, iof, plantLookup.value);
    }
  }
  const needsAnyway = clashes.some((c) => c.kind === 'conflict') || (load !== null && !load.ok);
  if (count < 1 && container && problems.length === 0) problems.push('Give it at least one plant.');

  const ready = !!base && !!container && (container.form === 'vessel' || !!cells) && problems.length === 0 && count >= 1 && (!needsAnyway || d.allowClash);
  const planting = ready && base ? { ...base, containerId: container!.id, count } : null;

  return {
    plant,
    method,
    container,
    cells,
    defaultCount: dflt,
    count,
    maxCount,
    choice,
    phases,
    datesText,
    problems,
    warnings,
    clashes,
    load,
    needsAnyway,
    taken,
    planting,
  };
});
