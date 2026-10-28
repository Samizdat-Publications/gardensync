// Starter gardens for the first run: a first raised bed, a patio of pots, or an empty garden.
//
// They are built as ops so they go through the same checks as anything the gardener does, and they
// use auto anchors, so every date comes from the gardener's own climate. Ids come from the caller.
import type { ClimateProfile } from '../climate/types';
import { toDay, type IsoDate } from '../dates';
import { plantById } from '../plants/library';
import { nextWindow } from '../schedule/next';
import { methodSupported } from '../schedule/project';
import { midsummer, seasonOf } from '../schedule/seasons';
import type { Op } from './ops';
import type { Container, Garden, Planting } from './schema';

export type StarterKind = 'first-bed' | 'patio' | 'empty';

export interface StarterInput {
  kind: StarterKind;
  gardenId: string;
  name: string;
  today: IsoDate;
  units: 'imperial' | 'metric';
  climate: ClimateProfile | null;
  newId: () => string;
}

type PlantingSpec = Omit<Planting, 'id' | 'containerId' | 'anchor'> & { window?: 'spring' | 'perennial' };

/** The ops that create the starter garden, in order. Apply them as one batch. */
export function starterOps(input: StarterInput): Op[] {
  const { gardenId, newId } = input;
  const cellCm: Garden['cellCm'] = input.units === 'metric' ? 30 : 30.48;
  // Plan for the season still ahead: after midsummer the spring dates of this season have passed, so
  // a garden started in October is planned for next spring.
  const day = toDay(input.today);
  const thisSeason = input.climate ? seasonOf(input.climate, day) : Number(input.today.slice(0, 4));
  const season = input.climate && day > midsummer(input.climate, thisSeason) ? thisSeason + 1 : thisSeason;
  const ops: Op[] = [
    { type: 'addGarden', garden: { id: gardenId, name: input.name, createdAt: input.today, cellCm } },
    { type: 'setActiveGarden', gardenId },
  ];
  if (input.climate) ops.push({ type: 'setClimate', gardenId, climate: input.climate });

  const place = (container: Container, specs: PlantingSpec[]) => {
    ops.push({ type: 'addContainer', gardenId, container });
    for (const { window = 'spring', ...spec } of specs) {
      // Each crop goes into its next window from today, so nothing in a new garden is already late.
      // Perennials, and anything without a window ahead, keep the season's own window.
      const plant = plantById(spec.plantId);
      let method = spec.method;
      let next = input.climate && plant && window !== 'perennial' ? nextWindow(plant, input.climate, method, day, true) : null;
      // Too late to raise from seed? Nursery plants, as a gardener starting in late spring would buy.
      if (input.climate && plant && method === 'transplant' && methodSupported(plant, 'bought')) {
        const bought = nextWindow(plant, input.climate, 'bought', day);
        if (bought && (!next || next.bedIn > bought.bedIn + 14)) {
          method = 'bought';
          next = bought;
        }
      }
      ops.push({
        type: 'addPlanting',
        gardenId,
        planting: { ...spec, method, id: newId(), containerId: container.id, anchor: next ? next.anchor : { kind: 'auto', window, season, offsetDays: 0 } },
      });
    }
  };
  const cells = (col: number, row: number, w = 1, h = 1) => ({ col, row, w, h });

  if (input.kind === 'first-bed') {
    // A 4 by 8 bed: tall crops along one long side, greens and roots in front, flowers at the ends.
    place(
      { id: newId(), form: 'grid', kind: 'raised-bed', name: 'Bed 1', x: 0, y: 0, cols: 8, rows: 4, rotation: 0 },
      [
        { plantId: 'tomato', cells: cells(0, 0, 2, 1), count: 2, method: 'transplant' },
        { plantId: 'pepper', cells: cells(2, 0, 2, 1), count: 2, method: 'transplant' },
        { plantId: 'basil', cells: cells(4, 0), count: 4, method: 'transplant' },
        { plantId: 'pole-bean', cells: cells(5, 0, 3, 1), count: 24, method: 'direct' },
        { plantId: 'lettuce', cells: cells(0, 1, 2, 2), count: 16, method: 'direct' },
        { plantId: 'carrot', cells: cells(2, 1, 2, 2), count: 64, method: 'direct' },
        { plantId: 'bush-bean', cells: cells(4, 1, 2, 2), count: 36, method: 'direct' },
        { plantId: 'swiss-chard', cells: cells(6, 1, 2, 2), count: 16, method: 'direct' },
        { plantId: 'marigold', cells: cells(0, 3), count: 4, method: 'transplant' },
        { plantId: 'radish', cells: cells(1, 3, 2, 1), count: 32, method: 'direct' },
        { plantId: 'onion', cells: cells(3, 3, 3, 1), count: 27, method: 'plant' },
        { plantId: 'parsley', cells: cells(6, 3), count: 4, method: 'transplant' },
        { plantId: 'nasturtium', cells: cells(7, 3), count: 1, method: 'direct' },
      ],
    );
  } else if (input.kind === 'patio') {
    const pot = (name: string, x: number, diameterCm: number, litres: number): Container => ({
      id: newId(), form: 'vessel', kind: 'pot', name, x, y: 60, diameterCm, litres,
    });
    place(pot('Tomato pot', 40, 45, 40), [{ plantId: 'tomato', count: 1, method: 'transplant' }]);
    place(pot('Pepper pot', 130, 35, 20), [{ plantId: 'pepper', count: 1, method: 'transplant' }]);
    place(pot('Basil pot', 205, 25, 8), [{ plantId: 'basil', count: 2, method: 'transplant' }]);
    place(pot('Mint pot', 265, 30, 12), [{ plantId: 'mint', count: 1, method: 'plant', window: 'spring' }]);
    place(
      { id: newId(), form: 'grid', kind: 'window-box', name: 'Herb box', x: 20, y: 140, cols: 3, rows: 1, rotation: 0 },
      [
        { plantId: 'parsley', cells: cells(0, 0), count: 4, method: 'transplant' },
        { plantId: 'chives', cells: cells(1, 0), count: 4, method: 'transplant' },
        { plantId: 'thyme', cells: cells(2, 0), count: 1, method: 'transplant' },
      ],
    );
    place(
      { id: newId(), form: 'vessel', kind: 'grow-bag', name: 'Salad bag', x: 200, y: 160, diameterCm: 45, litres: 40 },
      [{ plantId: 'lettuce', count: 4, method: 'direct' }],
    );
  }
  return ops;
}
