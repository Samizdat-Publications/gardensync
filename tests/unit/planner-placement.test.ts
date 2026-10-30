import { describe, expect, it } from 'vitest';
import { manualProfile } from '../../src/domain/climate/manual';
import { dayFromParts, toDay } from '../../src/domain/dates';
import type { Planting } from '../../src/domain/doc/schema';
import { conflictsFor } from '../../src/domain/layout/occupancy';
import { plantById } from '../../src/domain/plants/library';
import { plantingPhases } from '../../src/domain/schedule';
import { anchorFor, defaultMethod, makeIntervalOf, methodsFor, nextWindow, soonestWay, windowWords } from '../../src/ui/planner/placement';
import { profileOf } from './schedule-helpers';

const climate = manualProfile({ lastFrost: '04-20', firstFrost: '10-15', asOf: '2026-10-28' });
const lettuce = plantById('lettuce')!;
const tomato = plantById('tomato')!;
const garlic = plantById('garlic')!;
const plantOf = (id: string) => plantById(id);

describe('which way a plant goes in', () => {
  it('sows lettuce in place and raises tomatoes indoors', () => {
    expect(defaultMethod(lettuce)).toBe('direct');
    expect(defaultMethod(tomato)).toBe('transplant');
    expect(methodsFor(tomato)).toContain('bought');
    expect(methodsFor(tomato)).not.toContain('direct');
  });
});

describe('the next viable window from the day shown', () => {
  it('lands in this spring when spring is still ahead, and the anchor reproduces the day', () => {
    const from = dayFromParts(2027, 3, 1);
    const c = nextWindow(lettuce, climate, 'direct', from)!;
    expect(c).not.toBeNull();
    expect(c.bedIn).toBeGreaterThanOrEqual(from);
    expect(c.nextSeason).toBe(false);
    const p: Planting = { id: 'x', containerId: 'b', plantId: 'lettuce', cells: { col: 0, row: 0, w: 1, h: 1 }, count: 4, method: 'direct', anchor: c.anchor };
    expect(plantingPhases(p, lettuce, climate)!.bedIn).toBe(c.bedIn);
  });

  it('starts on the day shown when that day is inside a window', () => {
    const first = nextWindow(tomato, climate, 'transplant', dayFromParts(2027, 1, 1))!;
    const mid = first.window.bedIn.start + 3;
    if (first.window.bedIn.end >= mid) {
      const c = nextWindow(tomato, climate, 'transplant', mid)!;
      expect(c.bedIn).toBe(mid);
      expect(c.anchor.offsetDays).toBe(3);
    }
  });

  it('moves late-season tomatoes to next spring and says so', () => {
    const from = dayFromParts(2026, 10, 28);
    const c = nextWindow(tomato, climate, 'transplant', from)!;
    expect(c.nextSeason).toBe(true);
    expect(c.anchor.season).toBe(2027);
    expect(windowWords(c)).toBe("next spring's window");
  });

  it('offers garlic its overwinter window in the fall', () => {
    const c = nextWindow(garlic, climate, 'plant', dayFromParts(2026, 9, 1))!;
    expect(c.kind).toBe('overwinter');
    expect(windowWords(c)).toContain('overwinter');
  });

  it('works in a temperature-mode climate too', () => {
    const c = nextWindow(lettuce, profileOf('singapore'), 'direct', toDay('2027-01-10'));
    if (c) {
      const p: Planting = { id: 'x', containerId: 'b', plantId: 'lettuce', cells: { col: 0, row: 0, w: 1, h: 1 }, count: 4, method: 'direct', anchor: c.anchor };
      expect(plantingPhases(p, lettuce, profileOf('singapore'))?.bedIn).toBe(c.bedIn);
    }
  });

  it('pins the day itself when the garden has no climate yet', () => {
    const a = anchorFor(lettuce, null, 'direct', toDay('2027-05-01'))!;
    expect(a.anchor).toEqual({ kind: 'pinned', bedIn: '2027-05-01' });
  });

  it('finds the soonest way a plant goes in', () => {
    const w = soonestWay(lettuce, climate, dayFromParts(2027, 2, 1))!;
    expect(w.method).toBe('direct');
  });
});

describe('the schedule as occupancy intervals', () => {
  it('feeds conflictsFor with bed-in and bed-out days', () => {
    const intervalOf = makeIntervalOf(climate, plantOf);
    const from = dayFromParts(2027, 3, 1);
    const anchor = nextWindow(lettuce, climate, 'direct', from)!.anchor;
    const a: Planting = { id: 'a', containerId: 'b', plantId: 'lettuce', cells: { col: 0, row: 0, w: 2, h: 2 }, count: 16, method: 'direct', anchor };
    const b: Planting = { ...a, id: 'b2', cells: { col: 1, row: 1, w: 1, h: 1 }, count: 4 };
    const i = intervalOf(a)!;
    expect(i.bedOut).not.toBeNull();
    expect(i.bedOut!).toBeGreaterThan(i.bedIn);
    const clashes = conflictsFor(b, [a], intervalOf, plantOf);
    expect(clashes).toHaveLength(1);
    expect(clashes[0]!.kind).toBe('conflict');
  });
});

describe('a late planting after the window closes', () => {
  const c = manualProfile({ lastFrost: '04-20', firstFrost: '10-15', asOf: '2027-05-20' });
  it('offers peppers bought in late May this season, late, rather than next year', () => {
    const pepper = plantById('pepper')!;
    const from = dayFromParts(2027, 5, 28);
    const ch = nextWindow(pepper, c, 'bought', from)!;
    expect(ch.nextSeason).toBe(false);
    expect(ch.bedIn).toBe(from);
    expect(ch.late).toBe(true);
    expect(windowWords(ch)).toMatch(/^late in the/);
  });
  it('does not offer a late planting once there is no time left to crop', () => {
    const pepper = plantById('pepper')!;
    const ch = nextWindow(pepper, c, 'bought', dayFromParts(2027, 8, 20));
    expect(ch === null || ch.nextSeason).toBe(true);
  });
});

describe('garlic planted late in the fall', () => {
  it('still goes in this fall a week after its usual window, not next spring', () => {
    const c = manualProfile({ lastFrost: '04-20', firstFrost: '10-15', asOf: '2026-10-30' });
    const from = dayFromParts(2026, 10, 30);
    const ch = nextWindow(plantById('garlic')!, c, 'plant', from)!;
    expect(ch.kind).toBe('overwinter');
    expect(ch.bedIn).toBe(from);
    expect(ch.late).toBe(true);
  });
});

describe('a crop sown again and again (succession)', () => {
  const july = manualProfile({ lastFrost: '04-20', firstFrost: '10-15', asOf: '2027-07-15' });
  const phasesAt = (id: string, day: string) => {
    const plant = plantById(id)!;
    const c = nextWindow(plant, july, 'direct', toDay(day))!;
    const ph = plantingPhases({ id: 'x', containerId: 'b', plantId: id, count: 1, method: 'direct', anchor: c.anchor }, plant, july);
    return { c, ph };
  };

  it('sows carrots today when today is after the last round but still inside the window', () => {
    const { c, ph } = phasesAt('carrot', '2027-07-15');
    expect(c.nextSeason).toBe(false);
    expect(c.bedIn).toBe(toDay('2027-07-15'));
    expect(ph?.bedIn).toBe(toDay('2027-07-15'));
  });

  it('sows lettuce today between two rounds rather than waiting for the next round', () => {
    const { c, ph } = phasesAt('lettuce', '2027-07-15');
    expect(c.bedIn).toBe(toDay('2027-07-15'));
    expect(ph?.bedIn).toBe(toDay('2027-07-15'));
  });
});
