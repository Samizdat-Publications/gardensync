// Planting windows for six real places, checked against published extension guidance.
// The guidance, the computed dates and the differences are written up in
// docs/v8/research/schedule-validation.md. The golden files under __goldens__ hold one readable
// line per window for every plant in the library, season 2027; update them only after checking the
// change against that guidance.
import { describe, expect, it } from 'vitest';
import { manualProfile } from '../../src/domain/climate/manual';
import { toDay, toIso, type DayNum } from '../../src/domain/dates';
import { PLANTS, plantById } from '../../src/domain/plants/library';
import { reasonText, type Reason } from '../../src/domain/schedule/reasons';
import type { Plant } from '../../src/domain/plants/schema';
import { daysToHarvest, plantSchedule, type PlantSchedule, type ScheduleWindow } from '../../src/domain/schedule/windows';
import { goldenLines, PLACES, profileOf, type Place } from './schedule-helpers';

const plant = (id: string) => {
  const p = plantById(id);
  if (!p) throw new Error(`no plant ${id}`);
  return p;
};
const sched = (id: string, place: Place, season = 2027) => plantSchedule(plant(id), profileOf(place), season);
const win = (s: PlantSchedule, kind: ScheduleWindow['kind'], method?: ScheduleWindow['method']) =>
  s.windows.find((w) => w.kind === kind && (method === undefined || w.method === method));
const d = (iso: string) => toDay(iso);
const isoOf = (n: DayNum) => toIso(n);
const covers = (w: ScheduleWindow | undefined, iso: string) => !!w && w.bedIn.start <= d(iso) && w.bedIn.end >= d(iso);
const EM_DASH = String.fromCharCode(0x2014);
const codes = (rs: Reason[]) => rs.map((r) => r.code);
/** Every sowing day a schedule offers for a method: window ranges plus succession rounds. */
function sowingDays(s: PlantSchedule, method: ScheduleWindow['method']): DayNum[] {
  const days = new Set<DayNum>();
  for (const w of s.windows.filter((x) => x.method === method)) {
    for (let x = w.bedIn.start; x <= w.bedIn.end; x++) days.add(x);
    for (const r of w.rounds ?? []) days.add(r);
  }
  return [...days].sort((a, b) => a - b);
}

describe('goldens: every plant, every fixture place, season 2027', () => {
  for (const place of PLACES) {
    it(place, async () => {
      const lines = PLANTS.flatMap((p) => goldenLines(place, plantSchedule(p, profileOf(place), 2027)));
      await expect(lines.join('\n') + '\n').toMatchFileSnapshot(`./__goldens__/schedule-${place}.txt`);
    });
  }
});

describe('Canton, Ohio (frost mode)', () => {
  it('tomato goes out in mid to late May, seeds started from late March', () => {
    // OSU HYG-1624: central Ohio transplant about May 20, northern Ohio a week later.
    const w = win(sched('tomato', 'canton-oh'), 'spring', 'transplant')!;
    expect(isoOf(w.bedIn.start)).toBe('2027-05-17');
    expect(w.bedIn.end).toBeLessThanOrEqual(d('2027-05-31'));
    expect(isoOf(w.indoor!.start)).toBe('2027-03-22');
    expect(codes(w.reasons)).toContain('soil-warm');
    expect(codes(w.warnings)).toContain('frost-possible');
  });

  it('peas: sown in March, plus a fall window in August', () => {
    const s = sched('pea', 'canton-oh');
    const spring = win(s, 'spring', 'direct')!;
    expect(isoOf(spring.bedIn.start)).toBe('2027-03-05');
    const fall = win(s, 'fall', 'direct')!;
    expect([isoOf(fall.bedIn.start), isoOf(fall.bedIn.end)]).toEqual(['2027-08-01', '2027-08-22']);
  });

  it('lettuce: spring rounds, a summer gap, then fall rounds', () => {
    const s = sched('lettuce', 'canton-oh');
    const spring = win(s, 'spring', 'direct')!;
    const fall = win(s, 'fall', 'direct')!;
    expect(spring.rounds!.length).toBeGreaterThanOrEqual(4);
    expect(fall.rounds!.length).toBeGreaterThanOrEqual(3);
    const lastSpring = spring.rounds!.at(-1)!;
    const firstFall = fall.rounds![0]!;
    expect(lastSpring).toBeLessThan(d('2027-06-01'));
    expect(firstFall).toBeGreaterThan(d('2027-07-01'));
    expect(codes(spring.reasons)).toContain('succession-gap');
  });

  it('garlic: planted mid-October to mid-November, lifted mid-June to early July', () => {
    // OSU Athens calendar: plant in October. Penn State: most varieties ready by mid-July.
    const w = win(sched('garlic', 'canton-oh'), 'overwinter')!;
    expect([isoOf(w.bedIn.start), isoOf(w.bedIn.end)]).toEqual(['2026-10-13', '2026-11-10']);
    expect([isoOf(w.harvest.start), isoOf(w.harvest.end)]).toEqual(['2027-06-18', '2027-07-09']);
  });

  it('succession rounds sit inside their own windows; touching runs merge into one', () => {
    for (const place of PLACES) {
      for (const p of PLANTS) {
        for (const w of plantSchedule(p, profileOf(place), 2027).windows) {
          for (const r of w.rounds ?? []) {
            expect(r).toBeGreaterThanOrEqual(w.bedIn.start);
            expect(r).toBeLessThanOrEqual(w.bedIn.end);
          }
        }
      }
    }
    const spinach = sched('spinach', 'canton-oh');
    expect([isoOf(win(spinach, 'spring', 'direct')!.bedIn.end), isoOf(win(spinach, 'fall', 'direct')!.bedIn.start)]).toEqual(['2027-05-04', '2027-08-02']);
    const carrot = sched('carrot', 'canton-oh');
    expect(win(carrot, 'fall', 'direct')).toBeUndefined();
    expect(codes(win(carrot, 'spring', 'direct')!.reasons)).toContain('season-long');
  });

  it('spinach: early spring and fall', () => {
    const s = sched('spinach', 'canton-oh');
    expect(win(s, 'spring', 'direct')!.bedIn.start).toBe(d('2027-03-05'));
    const fall = win(s, 'fall', 'direct')!;
    expect(fall.rounds![0]).toBeLessThanOrEqual(d('2027-09-01'));
    expect(fall.bedIn.end).toBeLessThanOrEqual(d('2027-10-03'));
  });

  it('kale: spring and fall, harvest into late fall', () => {
    const s = sched('kale', 'canton-oh');
    // Picking ends the day before the median -5 C freeze (Dec 1).
    expect(win(s, 'spring', 'transplant')!.harvest.end).toBe(d('2027-11-30'));
    expect(covers(win(s, 'fall', 'direct'), '2027-08-10')).toBe(true);
  });

  it('every window says why, in plain words with no em dash', () => {
    for (const place of PLACES) {
      for (const p of PLANTS) {
        const s = plantSchedule(p, profileOf(place), 2027);
        for (const w of s.windows) {
          expect(w.reasons.length).toBeGreaterThan(0);
          for (const r of [...w.reasons, ...w.warnings]) expect(reasonText(r)).not.toContain(EM_DASH);
        }
        for (const n of s.notViable) expect(reasonText(n.reason)).not.toContain(EM_DASH);
      }
    }
  });
});

describe('Melbourne (marginal frost, temperature mode)', () => {
  it('is approximate', () => {
    const s = sched('tomato', 'melbourne');
    expect(s.mode).toBe('temperature');
    expect(s.approximate).toBe(true);
  });

  it('tomato planting window includes early November', () => {
    expect(covers(win(sched('tomato', 'melbourne'), 'temperature'), '2027-11-05')).toBe(true);
  });

  it('garlic goes in in autumn and is lifted in early summer', () => {
    const w = win(sched('garlic', 'melbourne'), 'overwinter')!;
    expect(w.bedIn.start).toBeGreaterThanOrEqual(d('2027-03-01'));
    expect(w.bedIn.end).toBeLessThanOrEqual(d('2027-05-31'));
    expect(w.harvest.start).toBeGreaterThanOrEqual(d('2027-11-01'));
    // Melbourne's coolest month averages under 10 C: enough natural chill.
    expect(codes(w.reasons)).not.toContain('pre-chill');
  });

  it('lettuce: autumn, winter and spring sowings; midsummer ones carry a shade warning', () => {
    // Sustainable Gardening Australia gives lettuce "all year round" in temperate zones, with shade
    // in the hot months; so midsummer is flagged, not removed (schedule-validation.md).
    const s = sched('lettuce', 'melbourne');
    const days = sowingDays(s, 'direct');
    for (const iso of ['2028-04-15', '2027-07-20', '2027-10-15']) expect(days).toContain(d(iso));
    const w = win(s, 'temperature', 'direct')!;
    const shade = w.warnings.find((x) => x.code === 'hot-weather-shade');
    expect(shade && shade.code === 'hot-weather-shade' && shade.from <= d('2027-12-31') && shade.to >= d('2027-12-31')).toBe(true);
  });
});

describe('Phoenix (heat is the limit)', () => {
  it('tomato: late winter to early spring, and none from June to mid-July', () => {
    const s = sched('tomato', 'phoenix');
    const spring = win(s, 'spring', 'transplant')!;
    expect(isoOf(spring.bedIn.start)).toBe('2027-02-12');
    expect(spring.bedIn.end).toBeLessThanOrEqual(d('2027-03-20'));
    expect(codes(spring.reasons)).toContain('early-for-heat');
    for (const w of s.windows) expect(w.bedIn.start > d('2027-07-14') || w.bedIn.end < d('2027-06-01')).toBe(true);
    // The UA Maricopa calendar's late-summer transplanting (Jul 15 to Aug 1) shows up as a fall window.
    const fall = win(s, 'fall', 'transplant')!;
    expect(fall.bedIn.start).toBeLessThanOrEqual(d('2027-07-25'));
    expect(codes(fall.reasons)).toContain('fall-heat-set');
  });

  it('lettuce: sowings from September to February, none in June or July', () => {
    const days = sowingDays(sched('lettuce', 'phoenix'), 'direct');
    expect(days.some((x) => x >= d('2027-09-01') && x <= d('2027-09-30'))).toBe(true);
    expect(days.some((x) => x >= d('2027-02-01') && x <= d('2027-02-28'))).toBe(true);
    expect(days.some((x) => x >= d('2027-06-01') && x <= d('2027-07-31'))).toBe(false);
  });

  it('kale harvest stops in the heat of late spring', () => {
    expect(win(sched('kale', 'phoenix'), 'spring', 'transplant')!.harvest.end).toBeLessThan(d('2027-06-15'));
  });
});

describe('Brisbane (frost-free)', () => {
  it('lettuce is viable in May, not in January', () => {
    const days = sowingDays(sched('lettuce', 'brisbane'), 'direct');
    expect(days).toContain(d('2028-05-15'));
    expect(days).not.toContain(d('2028-01-15'));
  });
});

describe('Singapore (equatorial)', () => {
  it('lettuce and peas are not viable, for heat', () => {
    for (const id of ['lettuce', 'pea']) {
      const s = sched(id, 'singapore');
      expect(s.windows).toHaveLength(0);
      expect(s.notViable.length).toBeGreaterThan(0);
      for (const n of s.notViable) expect(n.reason.code).toBe('too-hot');
    }
  });

  it('garlic needs pre-chilling', () => {
    const w = win(sched('garlic', 'singapore'), 'overwinter')!;
    expect(codes(w.reasons)).toContain('pre-chill');
  });
});

describe('Edinburgh (short, cool season)', () => {
  it('tomato only with a cool-summer warning', () => {
    const w = win(sched('tomato', 'edinburgh'), 'spring', 'transplant')!;
    expect(codes(w.warnings)).toContain('cool-summer');
  });

  it('peas and potatoes are fine', () => {
    const pea = win(sched('pea', 'edinburgh'), 'spring', 'direct')!;
    expect(pea.bedIn.start).toBeGreaterThanOrEqual(d('2027-03-01'));
    expect(pea.bedIn.start).toBeLessThanOrEqual(d('2027-04-15'));
    expect(pea.warnings).toHaveLength(0);
    const potato = win(sched('potato', 'edinburgh'), 'spring', 'plant')!;
    expect(potato.bedIn.start).toBeLessThanOrEqual(d('2027-03-31'));
    expect(potato.harvest.start).toBeGreaterThanOrEqual(d('2027-06-01'));
    expect(potato.harvest.end).toBeLessThanOrEqual(d('2027-07-31'));
  });
});

describe('manual profile (frost dates only)', () => {
  const p = manualProfile({ lastFrost: '04-16', firstFrost: '11-04', asOf: '2026-10-28' });

  it('runs in frost-only mode with the heat and soil guards off', () => {
    const s = plantSchedule(plant('tomato'), p, 2027);
    expect(s.mode).toBe('frost-only');
    const w = win(s, 'spring', 'transplant')!;
    // LF90 is LF50 + 14 for typed-in dates; no soil guard without temperatures.
    expect(isoOf(w.bedIn.start)).toBe('2027-04-30');
    expect(codes(w.reasons)).not.toContain('soil-warm');
    expect(codes(w.warnings)).toContain('frost-only');
    for (const x of PLANTS) {
      for (const ww of plantSchedule(x, p, 2027).windows) {
        expect(codes(ww.reasons).filter((c) => c === 'heat-trimmed' || c === 'soil-warm' || c === 'fall-heat-set')).toEqual([]);
      }
    }
  });

  it('with no frost dates and no temperatures there is no schedule', () => {
    const none = { ...p, lastFrost: { p50: null, p90: null }, firstFrost: { p50: null, p10: null } };
    const s = plantSchedule(plant('tomato'), none, 2027);
    expect(s.mode).toBe('none');
    expect(s.notViable[0]!.reason.code).toBe('needs-town');
  });
});

describe('seasons either side', () => {
  it('season S+1 is season S moved by a year, give or take a day', () => {
    for (const place of PLACES) {
      const a = sched('lettuce', place, 2027);
      const b = sched('lettuce', place, 2028);
      expect(b.windows.length).toBe(a.windows.length);
      a.windows.forEach((w, i) => {
        const shift = b.windows[i]!.bedIn.start - w.bedIn.start;
        expect(Math.abs(shift - 365)).toBeLessThanOrEqual(1);
      });
    }
  });
});

describe('harvest caps are exclusive, and reasons agree with ranges', () => {
  it('every window that says when picking ends names the day its harvest range ends', () => {
    let checked = 0;
    for (const place of PLACES) {
      for (const p of PLANTS) {
        for (const w of plantSchedule(p, profileOf(place), 2027).windows) {
          const until = w.reasons.filter((r) => r.code === 'harvest-until');
          expect(until.length, `${place} ${p.id} ${w.kind}`).toBeLessThanOrEqual(1);
          for (const r of until) {
            expect(r.day, `${place} ${p.id} ${w.kind} ${w.method}`).toBe(w.harvest.end);
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(400);
  });

  it('a frost-capped harvest ends the day before the frost, and says so', () => {
    const s = sched('kale', 'canton-oh');
    const w = win(s, 'spring', 'transplant')!;
    const r = w.reasons.find((x) => x.code === 'harvest-until')!;
    expect(r).toMatchObject({ cap: 'minus5', day: d('2027-11-30') });
    expect(reasonText(r)).toBe('harvest until about Nov 30, just before the usual first -5 C freeze');
  });
});

describe('days to harvest after a transplant', () => {
  it('never puts the harvest before bed-in, however old the seedlings', () => {
    const lettuce = plantById('lettuce')!;
    const quick: Plant = { ...lettuce, id: 'quick', maturity: { days: 20, from: 'sow' }, methods: { ...lettuce.methods, indoor: { ageWeeks: [6, 8] } } };
    expect(daysToHarvest(quick, 'transplant')).toBe(7);
    expect(daysToHarvest(quick, 'direct')).toBe(20);
    for (const place of PLACES) {
      for (const w of plantSchedule(quick, profileOf(place), 2027).windows) {
        expect(w.harvest.start - w.bedIn.start, place).toBeGreaterThanOrEqual(7);
      }
    }
    // An ordinary crop is unchanged: 50 days from sowing, less 4 weeks indoors, plus a week.
    expect(daysToHarvest(lettuce, 'transplant')).toBe(50 - 7 * 4 + 7);
  });
});
