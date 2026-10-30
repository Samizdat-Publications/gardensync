import { describe, expect, it } from 'vitest';
import { manualProfile } from '../../src/domain/climate/manual';
import { plantById } from '../../src/domain/plants/library';
import { PLANTS } from '../../src/domain/plants/library';
import { CATEGORY_DEFAULTS } from '../../src/domain/plants/resolve';
import {
  canGoInNow,
  cardSchedule,
  offsetLine,
  offsetRows,
  suggestionsFor,
  timingLine,
  weeksPhrase,
  whenSection,
} from '../../src/ui/plants/timing';
import { familyLine, factChips, neighborsOf, yieldText } from '../../src/ui/plants/facts';
import { profileOf } from './schedule-helpers';

const p = (id: string) => plantById(id)!;
const canton = () => profileOf('canton-oh');

describe('library timing line', () => {
  it('tomato in Canton says plant out from May, ahead of the season', () => {
    expect(timingLine(p('tomato'), canton(), '2027-01-15')).toMatch(/^Plant out from May \d+$/);
  });

  it('in the middle of a sowing window it says sow now until the end', () => {
    // Golden: canton-oh lettuce spring direct sow Mar 19 to May 14, transplant out Apr 02 to Apr 16.
    expect(timingLine(p('lettuce'), canton(), '2027-04-01')).toBe('Sow now until May 14');
    // Both ways are open on Apr 5; the line names the planner's usual way for lettuce, sowing.
    expect(timingLine(p('lettuce'), canton(), '2027-04-05')).toBe('Sow now until May 14');
    expect(timingLine(p('radish'), canton(), '2027-04-20')).toMatch(/^Sow now until /);
  });

  it('during the indoor start it says start indoors now', () => {
    // Golden: tomato indoor Mar 22 to Apr 19, out May 17.
    expect(timingLine(p('tomato'), canton(), '2027-04-01')).toBe('Start indoors now, plant out from May 17');
    expect(canGoInNow(p('tomato'), canton(), '2027-04-01')).toBe(true);
    expect(canGoInNow(p('tomato'), canton(), '2027-01-15')).toBe(false);
  });

  it('late in the year it looks ahead to next season', () => {
    expect(timingLine(p('tomato'), canton(), '2026-11-20')).toMatch(/^Plant out from May \d+$/);
  });

  it('a plant with no window says so', () => {
    expect(timingLine(p('pea'), profileOf('singapore'), '2027-03-01')).toBe('Not suited to this climate');
  });

  it('with no climate it gives the guide offset in words', () => {
    expect(timingLine(p('tomato'), null, '2027-01-15')).toBe('Plant out 1 to 4 weeks after your last frost');
    expect(offsetLine(p('tomato'))).toBe('Plant out 1 to 4 weeks after your last frost');
    expect(weeksPhrase([-6, -6])).toBe('6 weeks before your last frost');
    expect(weeksPhrase([-6, -2])).toBe('2 to 6 weeks before your last frost');
    expect(offsetRows(p('tomato')).map((r) => r.action)).toEqual(['Start seeds indoors', 'Plant out']);
  });

  it('typed frost dates work without temperatures', () => {
    const typed = manualProfile({ lastFrost: '04-20', firstFrost: '10-15', asOf: '2026-10-28' });
    expect(timingLine(p('tomato'), typed, '2027-01-15')).toMatch(/^Plant out from (Apr|May) \d+$/);
  });
});

describe('plant card when section', () => {
  it('tomato in Canton has indoor, plant out and pick rows, each with a reason', () => {
    const sched = cardSchedule(p('tomato'), canton(), '2027-01-15');
    expect(sched.season).toBe(2027);
    const s = whenSection(p('tomato'), sched);
    const spring = s.blocks[0]!;
    expect(spring.title).toBe('Spring');
    expect(spring.rows.map((r) => r.kind)).toEqual(['indoor', 'bed', 'pick']);
    expect(spring.rows[1]!.dates).toBe('May 17 to May 31');
    expect(spring.rows[1]!.why).toMatch(/last frost/);
    for (const r of spring.rows) expect(r.why.length).toBeGreaterThan(10);
    expect(spring.warnings.some((w) => w.frost && /^Frost possible from/.test(w.text))).toBe(true);
    // Reasons read as sentences.
    expect(spring.rows[2]!.why).toMatch(/^[A-Z].*\.$/);
  });

  it('temperatures in reasons follow the gardener units', () => {
    const sched = cardSchedule(p('tomato'), canton(), '2027-01-15');
    const f = whenSection(p('tomato'), sched, 'imperial').blocks[0]!.rows[1]!.why;
    const c = whenSection(p('tomato'), sched, 'metric').blocks[0]!.rows[1]!.why;
    expect(f).toMatch(/\(61°F\)/);
    expect(c).toMatch(/\(16°C\)/);
    expect(f).not.toMatch(/\d C\b/);
  });

  it('a succession crop gets its rounds', () => {
    const s = whenSection(p('lettuce'), cardSchedule(p('lettuce'), canton(), '2027-01-15'));
    const direct = s.blocks.find((b) => b.rows.some((r) => r.kind === 'rounds'))!;
    expect(direct.title).toBe('Spring, sown in place');
    expect(direct.rows.find((r) => r.kind === 'rounds')!.action).toMatch(/^Sow on Mar 19, /);
  });

  it('a too-warm plant has no blocks, a reason, and heat-loving suggestions that do have dates', () => {
    const sg = profileOf('singapore');
    const sched = cardSchedule(p('pea'), sg, '2027-03-01');
    const s = whenSection(p('pea'), sched);
    expect(s.blocks).toEqual([]);
    expect(s.notViable[0]!.reason.code).toBe('too-hot');
    expect(s.notViable[0]!.text).toMatch(/^Too warm here/);
    const sug = suggestionsFor(p('pea'), s.notViable[0]!.reason, PLANTS, sg, sched.season)!;
    expect(sug.kind).toBe('heat');
    expect(sug.plants.length).toBeGreaterThan(0);
    for (const x of sug.plants) expect(x.temp.maxC).toBeGreaterThan(p('pea').temp.maxC);
  });
});

describe('facts', () => {
  it('family in plain words, without the plant itself', () => {
    expect(familyLine(p('tomato'))).toBe('Nightshade family, with peppers, eggplant and potatoes');
    expect(familyLine(p('asparagus'))).toBe('Asparagus family');
    expect(familyLine(CATEGORY_DEFAULTS.vegetable)).toBeNull();
  });

  it('fact chips in plain words and the gardener units', () => {
    const t = factChips(p('tomato'), 'imperial').map((c) => c.text);
    expect(t).toEqual(['Killed by frost', 'Full sun', '1 per square', 'Needs a stake', 'Pot of 5 gal or more', 'About 10 lb a plant']);
    const m = factChips(p('tomato'), 'metric').map((c) => c.text);
    expect(m).toContain('Pot of 20 L or more');
    expect(m).toContain('About 4.5 kg a plant');
    expect(factChips(p('pumpkin'), 'metric').map((c) => c.text)).toContain('Takes 3 by 3 squares');
    expect(factChips(p('pumpkin'), 'metric').map((c) => c.text)).toContain('Not suited to pots');
    expect(factChips(p('radish'), 'metric').map((c) => c.text)).toContain('16 per square');
    expect(yieldText(p('melon'), 'metric')).toBe('About 3 fruit a plant');
  });

  it('neighbors come good first, with evidence', () => {
    const n = neighborsOf('tomato');
    expect(n.length).toBeGreaterThan(3);
    const firstBad = n.findIndex((x) => x.kind === 'bad');
    expect(n.slice(firstBad).every((x) => x.kind === 'bad')).toBe(true);
    expect(n.find((x) => x.otherId === 'potato')!.kind).toBe('bad');
    expect(n.find((x) => x.otherId === 'asparagus')!.evidence).toBe('traditional');
  });
});
