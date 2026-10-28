// The assistant's tools: what the model may read and change in the gardener's garden.
//
// Reading tools answer at once. Editing tools never touch the real garden: they turn the request
// into an Op, apply it to a draft copy (so later calls in the same turn see the bed they just added),
// and queue it. When the turn ends the gardener sees the queued changes and applies them as one
// batch, one undo step, or throws them away. Every input is validated with valibot before it runs:
// the model's output is untrusted, the same as an imported file.
import type Anthropic from '@anthropic-ai/sdk';
import * as v from 'valibot';
import { isIsoDate, toDay, type DayNum, type IsoDate } from '../../domain/dates';
import { applyOp, type Op } from '../../domain/doc/ops';
import { GRID_KINDS, VESSEL_KINDS, type Container, type CustomPlant, type Garden, type GardenDoc, type Planting } from '../../domain/doc/schema';
import { conflictsFor } from '../../domain/layout/occupancy';
import { squaresLabel } from '../../domain/layout/labels';
import { defaultCount, minCells, vesselFit, vesselWarningText } from '../../domain/layout/patch';
import { allPlants, resolvePlant } from '../../domain/plants/resolve';
import { CATEGORIES, type Plant } from '../../domain/plants/schema';
import { plantingPhases, reasonText, tasksFor } from '../../domain/schedule';
import { formatVolume, type Units } from '../../domain/units';
import { fmtDay, fmtRange, inSentence } from '../format';
import { anchorFor, defaultMethod, makeIntervalOf, methodsFor, windowWords } from '../planner/placement';

export interface ToolContext {
  doc: GardenDoc;
  gardenId: string;
  today: IsoDate;
  units: Units;
  newId: () => string;
}

export interface ToolOutcome {
  /** Text the model reads back. */
  text: string;
  isError: boolean;
  /** For an editing tool that worked: the queued change, and the draft with it applied. */
  change?: { op: Op; summary: string; removes: boolean; doc: GardenDoc };
}

const Id = v.pipe(v.string(), v.regex(/^[A-Za-z0-9_-]{1,40}$/));
const Name = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80));
const Small = (min: number, max: number) => v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));

const INPUTS = {
  get_garden: v.object({}),
  find_plants: v.object({ query: v.pipe(v.string(), v.maxLength(80)) }),
  get_plant: v.object({ plant_id: Id }),
  get_tasks: v.object({ weeks: v.optional(Small(1, 12)) }),
  add_bed: v.object({
    name: Name,
    kind: v.picklist(GRID_KINDS),
    cols: Small(1, 60),
    rows: Small(1, 60),
  }),
  add_container: v.object({
    name: Name,
    kind: v.picklist(VESSEL_KINDS),
    litres: v.pipe(v.number(), v.minValue(1), v.maxValue(2000)),
  }),
  place_plant: v.object({
    container_id: Id,
    plant_id: Id,
    col: v.optional(Small(0, 59)),
    row: v.optional(Small(0, 59)),
    width: v.optional(Small(1, 60)),
    height: v.optional(Small(1, 60)),
    count: v.optional(Small(1, 10_000)),
    method: v.optional(v.picklist(['direct', 'transplant', 'plant', 'bought'])),
    date: v.optional(v.pipe(v.string(), v.check(isIsoDate, 'expected YYYY-MM-DD'))),
  }),
  remove_planting: v.object({ planting_id: Id }),
  remove_container: v.object({ container_id: Id }),
  add_custom_plant: v.object({
    name: Name,
    parent_id: v.optional(Id),
    category: v.picklist(CATEGORIES),
    frost: v.picklist(['tender', 'half-hardy', 'hardy']),
    days_to_maturity: Small(1, 2000),
    maturity_from: v.picklist(['sow', 'transplant']),
  }),
  add_note: v.object({ text: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2000)), container_id: v.optional(Id) }),
} as const;

export type ToolName = keyof typeof INPUTS;
const EDITING: ReadonlySet<ToolName> = new Set(['add_bed', 'add_container', 'place_plant', 'remove_planting', 'remove_container', 'add_custom_plant', 'add_note']);

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object' as const,
  properties,
  required,
  additionalProperties: false,
});
const int = (description: string, minimum: number, maximum: number) => ({ type: 'integer', description, minimum, maximum });

/** Definitions sent to the API. Descriptions are written for the model. */
export const TOOL_DEFS: Anthropic.Tool[] = [
  {
    name: 'get_garden',
    description:
      "The gardener's current garden: its location and frost dates, every bed and container with its id and size, and every planting with its id, plant, squares, count and dates. Call this before answering questions about the garden or proposing changes. It includes changes you queued earlier in this turn.",
    input_schema: obj({}),
  },
  {
    name: 'find_plants',
    description: 'Search the plant library (built-in crops, herbs, fruit, flowers, and the gardener\'s own custom plants) by name. Returns ids to use with other tools.',
    input_schema: obj({ query: { type: 'string', description: 'Part of a plant name, e.g. "tomato" or "basil".' } }, ['query']),
  },
  {
    name: 'get_plant',
    description: "One plant's growing facts and its planting windows worked out for this garden's climate.",
    input_schema: obj({ plant_id: { type: 'string' } }, ['plant_id']),
  },
  {
    name: 'get_tasks',
    description: 'The jobs due in the garden from today for the next few weeks, with the reason for each date.',
    input_schema: obj({ weeks: int('How many weeks ahead, default 2.', 1, 12) }),
  },
  {
    name: 'add_bed',
    description: 'Queue a new grid bed. Squares are 1 ft (imperial) or 30 cm (metric). It is placed to the right of the existing beds; the gardener can move it.',
    input_schema: obj(
      {
        name: { type: 'string' },
        kind: { type: 'string', enum: [...GRID_KINDS] },
        cols: int('Width in squares.', 1, 60),
        rows: int('Depth in squares.', 1, 60),
      },
      ['name', 'kind', 'cols', 'rows'],
    ),
  },
  {
    name: 'add_container',
    description: 'Queue a pot, grow bag, bucket or tower, measured by soil volume.',
    input_schema: obj(
      { name: { type: 'string' }, kind: { type: 'string', enum: [...VESSEL_KINDS] }, litres: { type: 'number', description: 'Soil volume in litres (1 US gallon = 3.785 L).' } },
      ['name', 'kind', 'litres'],
    ),
  },
  {
    name: 'place_plant',
    description:
      'Queue a planting in a bed or container. In a grid bed, give col and row (0-based, col 0 is column A) and the patch size in squares, or leave them out to use the first free spot of the smallest size. The count defaults to what the patch holds at square-foot spacing. Dates come from the next planting window from today unless you give a date, which pins it.',
    input_schema: obj(
      {
        container_id: { type: 'string' },
        plant_id: { type: 'string' },
        col: int('Left column, 0-based.', 0, 59),
        row: int('Top row, 0-based.', 0, 59),
        width: int('Patch width in squares.', 1, 60),
        height: int('Patch depth in squares.', 1, 60),
        count: int('Number of plants.', 1, 10000),
        method: { type: 'string', enum: ['direct', 'transplant', 'plant', 'bought'], description: 'direct: sow in place. transplant: raise indoors, then plant out. plant: sets, cloves, crowns. bought: nursery plants.' },
        date: { type: 'string', description: 'YYYY-MM-DD the planting goes in, only when the gardener asked for a specific day.' },
      },
      ['container_id', 'plant_id'],
    ),
  },
  {
    name: 'remove_planting',
    description: 'Queue removing a planting.',
    input_schema: obj({ planting_id: { type: 'string' } }, ['planting_id']),
  },
  {
    name: 'remove_container',
    description: 'Queue removing a bed or container and everything planted in it.',
    input_schema: obj({ container_id: { type: 'string' } }, ['container_id']),
  },
  {
    name: 'add_custom_plant',
    description:
      "Queue a custom plant or variety, for example from a seed packet. Give parent_id (the library crop it is a variety of) whenever there is one: every value you do not give is inherited from it. Returns the new plant's id.",
    input_schema: obj(
      {
        name: { type: 'string', description: 'e.g. "Sungold tomato".' },
        parent_id: { type: 'string' },
        category: { type: 'string', enum: [...CATEGORIES] },
        frost: { type: 'string', enum: ['tender', 'half-hardy', 'hardy'] },
        days_to_maturity: int('Days to maturity as printed.', 1, 2000),
        maturity_from: { type: 'string', enum: ['sow', 'transplant'], description: 'Whether the days count from sowing or from transplanting.' },
      },
      ['name', 'category', 'frost', 'days_to_maturity', 'maturity_from'],
    ),
  },
  {
    name: 'add_note',
    description: "Queue a dated note in the garden journal, optionally about one bed or container.",
    input_schema: obj({ text: { type: 'string' }, container_id: { type: 'string' } }, ['text']),
  },
];

export function isEditing(name: string): boolean {
  return EDITING.has(name as ToolName);
}

function gardenOf(ctx: ToolContext): Garden | undefined {
  return ctx.doc.gardens.find((g) => g.id === ctx.gardenId);
}

function lookupFor(g: Garden): (id: string) => Plant | undefined {
  return (id) => resolvePlant(id, g.customPlants)?.plant;
}

function describeContainer(c: Container, g: Garden, units: Units): string {
  if (c.form === 'grid') {
    const ft = g.cellCm === 30.48;
    return `${c.name} (id ${c.id}): ${c.kind}, ${c.cols} by ${c.rows} squares of ${ft ? '1 ft' : '30 cm'}`;
  }
  return `${c.name} (id ${c.id}): ${c.kind}, ${formatVolume(c.litres, units)}`;
}

function describePlanting(p: Planting, g: Garden): string {
  const plant = lookupFor(g)(p.plantId);
  const ph = plant ? plantingPhases(p, plant, g.climate) : null;
  const where = p.cells ? `squares ${squaresLabel(p.cells)}` : 'whole container';
  const dates = ph ? `in the bed ${fmtDay(ph.bedIn)} to ${ph.bedOut === null ? 'no end (perennial)' : fmtDay(ph.bedOut)}` : 'no dates (no window here)';
  return `- ${plant?.name ?? p.plantId} (planting id ${p.id}, plant id ${p.plantId}): ${p.count} plants, ${where}, ${p.method}, ${dates}`;
}

function gardenText(g: Garden, units: Units): string {
  const lines: string[] = [`Garden "${g.name}" (id ${g.id}). Units: ${units}.`];
  const c = g.climate;
  if (c) {
    const place = c.place ? c.place.name : 'typed-in frost dates, no town';
    lines.push(`Climate: ${place}. Frost class ${c.frostClass}.`);
  } else {
    lines.push('Climate: not set yet, so there are no planting windows. Ask the gardener to set their town in Settings.');
  }
  if (g.containers.length === 0) lines.push('No beds or containers yet.');
  for (const ct of g.containers) {
    lines.push(describeContainer(ct, g, units));
    for (const p of g.plantings.filter((p) => p.containerId === ct.id)) lines.push(describePlanting(p, g));
  }
  if (g.customPlants.length > 0) lines.push(`Custom plants: ${g.customPlants.map((p) => `${p.name} (id ${p.id})`).join(', ')}.`);
  return lines.join('\n');
}

function plantText(plant: Plant, g: Garden, today: DayNum): string {
  const facts = [
    `${plant.name} (id ${plant.id}, ${plant.latin}), ${plant.category}, ${plant.lifecycle}, frost ${plant.frost}.`,
    `Days to maturity: ${plant.maturity.days} from ${plant.maturity.from}.`,
    'perSquare' in plant.density ? `${plant.density.perSquare} per square.` : `One plant per ${plant.density.squares[0]} by ${plant.density.squares[1]} squares.`,
    `Ways to plant: ${methodsFor(plant).join(', ') || 'none'}.`,
  ];
  if (g.climate) {
    const choice = anchorFor(plant, g.climate, defaultMethod(plant), today)?.choice;
    facts.push(
      choice
        ? `Next window from today (${defaultMethod(plant)}): ${windowWords(choice)}, ${fmtRange(choice.window.bedIn.start, choice.window.bedIn.end)}.`
        : 'No planting window this season or next in this climate.',
    );
  }
  return facts.join('\n');
}

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

function nextBedX(g: Garden): number {
  let right = 0;
  for (const c of g.containers) {
    const w = c.form === 'grid' ? (c.rotation === 90 || c.rotation === 270 ? c.rows : c.cols) * g.cellCm : c.diameterCm;
    const left = c.form === 'grid' ? c.x : c.x - c.diameterCm / 2;
    right = Math.max(right, left + w);
  }
  return g.containers.length === 0 ? 0 : Math.round(right + 60);
}

/** Queue an op against the draft. Fails with the op's own validation message. */
function queue(ctx: ToolContext, op: Op, summary: string, text: string, removes = false): ToolOutcome {
  const res = applyOp(ctx.doc, op);
  if (!res.ok) return { text: `That change was not valid: ${res.error}`, isError: true };
  return { text: `${text} Queued for the gardener to review.`, isError: false, change: { op, summary, removes, doc: res.doc } };
}

function placePlant(input: v.InferOutput<(typeof INPUTS)['place_plant']>, g: Garden, ctx: ToolContext): ToolOutcome {
  const container = g.containers.find((c) => c.id === input.container_id);
  if (!container) return { text: `No bed or container has id ${input.container_id}. Call get_garden for the ids.`, isError: true };
  const plantOf = lookupFor(g);
  const plant = plantOf(input.plant_id);
  if (!plant) return { text: `No plant has id ${input.plant_id}. Use find_plants.`, isError: true };
  const ways = methodsFor(plant);
  const method = input.method ?? defaultMethod(plant);
  if (!ways.includes(method)) return { text: `${plant.name} can't go in by "${method}". It can: ${ways.join(', ')}.`, isError: true };
  const from = toDay(ctx.today);
  let anchor: Planting['anchor'];
  let when: string;
  if (input.date) {
    const d = toDay(input.date);
    if (d < from - 366 || d > from + 2 * 366) return { text: 'A pinned date must be within a year before today and two years after.', isError: true };
    anchor = { kind: 'pinned', bedIn: input.date };
    when = `going in on ${fmtDay(d)} (pinned)`;
  } else {
    const a = anchorFor(plant, g.climate, method, from);
    if (!a) return { text: `${plant.name} has no ${method} window this season or next in this garden's climate.`, isError: true };
    anchor = a.anchor;
    when = a.choice ? `going in from ${fmtDay(a.choice.bedIn)} (${windowWords(a.choice)})` : `going in on ${fmtDay(from)}`;
  }
  const whenShort = when.replace(/^going in /, '');
  const base: Planting = { id: ctx.newId(), containerId: container.id, plantId: plant.id, count: 1, method, anchor };

  if (container.form === 'vessel') {
    const fit = vesselFit(plant, container);
    const p = { ...base, count: input.count ?? 1 };
    if (fit.maxCount > 0 && p.count > fit.maxCount * 2) return { text: `${container.name} holds about ${fit.maxCount} ${plant.name}; ${p.count} is far too many.`, isError: true };
    const warn = fit.warning ? ` Note: ${vesselWarningText(fit.warning, plant.name, ctx.units)}` : '';
    return queue(ctx, { type: 'addPlanting', gardenId: g.id, planting: p }, `${plant.name}, ${plural(p.count, 'plant')}, in ${container.name}, ${whenShort}`, `${p.count} ${plant.name} in ${container.name}, ${when}.${warn}`);
  }

  const min = minCells(plant);
  const w = input.width ?? min.w;
  const h = input.height ?? min.h;
  if (w < min.w || h < min.h) return { text: `One ${plant.name} needs ${min.w} by ${min.h} squares.`, isError: true };
  const intervalOf = makeIntervalOf(g.climate, plantOf);
  const fits = (col: number, row: number) => {
    if (col + w > container.cols || row + h > container.rows) return false;
    const cand = { ...base, cells: { col, row, w, h } };
    return conflictsFor(cand, g.plantings, intervalOf, plantOf).every((c) => c.kind !== 'conflict');
  };
  let spot: { col: number; row: number } | null = null;
  if (input.col !== undefined || input.row !== undefined) {
    const col = input.col ?? 0;
    const row = input.row ?? 0;
    if (col + w > container.cols || row + h > container.rows) return { text: `That patch runs off ${container.name}, which is ${container.cols} by ${container.rows} squares.`, isError: true };
    const cand = { ...base, cells: { col, row, w, h } };
    const clash = conflictsFor(cand, g.plantings, intervalOf, plantOf).find((c) => c.kind === 'conflict');
    if (clash) return { text: `Those squares are taken then: ${clash.reason}`, isError: true };
    spot = { col, row };
  } else {
    outer: for (let row = 0; row < container.rows; row++) {
      for (let col = 0; col < container.cols; col++) {
        if (fits(col, row)) {
          spot = { col, row };
          break outer;
        }
      }
    }
    if (!spot) return { text: `${container.name} has no free ${w} by ${h} patch for ${plant.name} at that time.`, isError: true };
  }
  const cells = { ...spot, w, h };
  const holds = Math.max(1, defaultCount(plant, cells));
  if (input.count !== undefined && input.count > holds * 2) return { text: `Those squares hold about ${holds} ${plant.name} at square-foot spacing; ${input.count} is far too many.`, isError: true };
  const count = input.count ?? holds;
  const p: Planting = { ...base, cells, count };
  return queue(
    ctx,
    { type: 'addPlanting', gardenId: g.id, planting: p },
    `${plant.name}, ${plural(count, 'plant')}, ${container.name} squares ${squaresLabel(cells)}, ${whenShort}`,
    `${count} ${plant.name} in ${container.name}, squares ${squaresLabel(cells)}, ${when}. Planting id ${p.id}.`,
  );
}

/** Run one tool call against the draft. Never throws for bad input. */
export function runTool(name: string, rawInput: unknown, ctx: ToolContext): ToolOutcome {
  if (!Object.hasOwn(INPUTS, name)) return { text: `There is no tool called ${name}.`, isError: true };
  const parsed = v.safeParse(INPUTS[name as ToolName], rawInput ?? {});
  if (!parsed.success) {
    return { text: `The input did not match the tool: ${parsed.issues.map((i) => i.message).join('; ')}`, isError: true };
  }
  const g = gardenOf(ctx);
  if (!g) return { text: 'There is no active garden.', isError: true };
  const input: unknown = parsed.output;
  const today = toDay(ctx.today);

  switch (name as ToolName) {
    case 'get_garden':
      return { text: gardenText(g, ctx.units), isError: false };
    case 'find_plants': {
      const q = (input as { query: string }).query.trim().toLowerCase();
      const hits = allPlants(g.customPlants).filter((r) => !q || r.plant.name.toLowerCase().includes(q) || r.plant.id.includes(q));
      if (hits.length === 0) return { text: `No plant matches "${q}". The library has about 60 plants; try a simpler name, or add a custom plant.`, isError: false };
      return { text: hits.slice(0, 20).map((r) => `${r.plant.name} (id ${r.plant.id}, ${r.plant.category}${r.custom ? ', custom' : ''})`).join('\n'), isError: false };
    }
    case 'get_plant': {
      const plant = lookupFor(g)((input as { plant_id: string }).plant_id);
      if (!plant) return { text: 'No plant has that id. Use find_plants.', isError: true };
      return { text: plantText(plant, g, today), isError: false };
    }
    case 'get_tasks': {
      const weeks = (input as { weeks?: number }).weeks ?? 2;
      const plants = new Map(allPlants(g.customPlants).map((r) => [r.plant.id, r.plant]));
      const tasks = tasksFor(g, plants, today, today + weeks * 7).filter((t) => !t.done);
      if (tasks.length === 0) return { text: `Nothing due in the next ${weeks} weeks.`, isError: false };
      const text = tasks
        .slice(0, 40)
        .map((t) => `${t.until !== undefined ? fmtRange(t.date, t.until) : fmtDay(t.date)}: ${t.kind} ${plants.get(t.plantId)?.name ?? t.plantId} (${reasonText(t.reason, ctx.units)})`)
        .join('\n');
      return { text, isError: false };
    }
    case 'add_bed': {
      const i = input as v.InferOutput<(typeof INPUTS)['add_bed']>;
      const container: Container = { id: ctx.newId(), form: 'grid', kind: i.kind, name: i.name, x: nextBedX(g), y: 0, cols: i.cols, rows: i.rows, rotation: 0 };
      return queue(ctx, { type: 'addContainer', gardenId: g.id, container }, `New bed, ${i.name}, ${i.cols} by ${i.rows} squares`, `Bed ${i.name}, ${i.cols} by ${i.rows} squares, id ${container.id}.`);
    }
    case 'add_container': {
      const i = input as v.InferOutput<(typeof INPUTS)['add_container']>;
      const diameterCm = Math.min(300, Math.max(10, Math.round(Math.cbrt(i.litres * 1000 * 1.3))));
      const container: Container = { id: ctx.newId(), form: 'vessel', kind: i.kind, name: i.name, x: nextBedX(g) + diameterCm / 2, y: diameterCm / 2, diameterCm, litres: i.litres };
      return queue(ctx, { type: 'addContainer', gardenId: g.id, container }, `New ${i.kind.replace('-', ' ')}, ${i.name}, ${formatVolume(i.litres, ctx.units)}`, `${i.kind} ${i.name}, ${formatVolume(i.litres, ctx.units)}, id ${container.id}.`);
    }
    case 'place_plant':
      return placePlant(input as v.InferOutput<(typeof INPUTS)['place_plant']>, g, ctx);
    case 'remove_planting': {
      const id = (input as { planting_id: string }).planting_id;
      const p = g.plantings.find((x) => x.id === id);
      if (!p) return { text: `No planting has id ${id}.`, isError: true };
      const name = lookupFor(g)(p.plantId)?.name ?? p.plantId;
      const bed = g.containers.find((c) => c.id === p.containerId)?.name ?? 'its bed';
      const where = p.cells ? `${bed} squares ${squaresLabel(p.cells)}` : bed;
      return queue(ctx, { type: 'removePlanting', gardenId: g.id, plantingId: id }, `Remove ${name}, ${plural(p.count, 'plant')}, from ${where}`, `Remove ${name} (${p.count}) from ${where}.`, true);
    }
    case 'remove_container': {
      const id = (input as { container_id: string }).container_id;
      const c = g.containers.find((x) => x.id === id);
      if (!c) return { text: `No bed or container has id ${id}.`, isError: true };
      const n = g.plantings.filter((p) => p.containerId === id).length;
      return queue(ctx, { type: 'removeContainer', gardenId: g.id, containerId: id }, `Remove ${c.name}${n ? ` and its ${plural(n, 'planting')}` : ''}`, `Remove ${c.name}.`, true);
    }
    case 'add_custom_plant': {
      const i = input as v.InferOutput<(typeof INPUTS)['add_custom_plant']>;
      if (i.parent_id && !lookupFor(g)(i.parent_id)) return { text: `No plant has id ${i.parent_id} to be the parent.`, isError: true };
      const plant: CustomPlant = {
        id: ctx.newId(),
        name: i.name,
        ...(i.parent_id ? { parent: i.parent_id } : {}),
        category: i.category,
        frost: i.frost,
        maturity: { days: i.days_to_maturity, from: i.maturity_from },
      };
      return queue(ctx, { type: 'addCustomPlant', gardenId: g.id, plant }, `New plant, ${i.name}${i.parent_id ? `, a kind of ${inSentence(lookupFor(g)(i.parent_id)?.name ?? i.parent_id)}` : ''}: ${i.category}, ${i.frost}, ${i.days_to_maturity} days from ${i.maturity_from === 'sow' ? 'sowing' : 'transplanting'}`, `Custom plant ${i.name}, id ${plant.id}.`);
    }
    case 'add_note': {
      const i = input as v.InferOutput<(typeof INPUTS)['add_note']>;
      if (i.container_id && !g.containers.some((c) => c.id === i.container_id)) return { text: `No bed or container has id ${i.container_id}.`, isError: true };
      const entry = { id: ctx.newId(), date: ctx.today, text: i.text, ...(i.container_id ? { containerId: i.container_id } : {}) };
      return queue(ctx, { type: 'addJournal', gardenId: g.id, entry }, `Journal note: ${i.text}`, `Note for ${fmtDay(today)}.`);
    }
  }
}

