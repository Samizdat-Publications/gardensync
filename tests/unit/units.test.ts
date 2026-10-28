import { describe, expect, it } from 'vitest';
import { plantById } from '../../src/domain/plants/library';
import {
  formatArea,
  formatLength,
  formatTemp,
  formatVolume,
  formatWeight,
  parseLength,
  parseWeight,
  renderNoteTokens,
} from '../../src/domain/units';

describe('formatTemp', () => {
  it('shows whole degrees in either system', () => {
    expect(formatTemp(21, 'imperial')).toBe('70°F');
    expect(formatTemp(21, 'metric')).toBe('21°C');
    expect(formatTemp(0, 'imperial')).toBe('32°F');
    expect(formatTemp(-12, 'imperial')).toBe('10°F');
    expect(formatTemp(-0.2, 'metric')).toBe('0°C');
  });
});

describe('formatLength', () => {
  it('gives inches to the nearest quarter below 2 ft', () => {
    expect(formatLength(2.54, 'imperial')).toBe('1 in');
    expect(formatLength(3.81, 'imperial')).toBe('1 1/2 in');
    expect(formatLength(0.6, 'imperial')).toBe('1/4 in');
    expect(formatLength(0.1, 'imperial')).toBe('1/4 in');
    expect(formatLength(45, 'imperial')).toBe('17 3/4 in');
    expect(formatLength(0, 'imperial')).toBe('0 in');
  });

  it('gives feet and inches from 2 ft', () => {
    expect(formatLength(60.96, 'imperial')).toBe('2 ft');
    expect(formatLength(121.92, 'imperial')).toBe('4 ft');
    expect(formatLength(243.84 + 15.24, 'imperial')).toBe('8 ft 6 in');
    // 60.8 cm is 23.94 in, which rounds up to 24 in, so it is shown as feet.
    expect(formatLength(60.8, 'imperial')).toBe('2 ft');
  });

  it('gives mm, cm or m in metric', () => {
    expect(formatLength(0.6, 'metric')).toBe('6 mm');
    expect(formatLength(7.5, 'metric')).toBe('7.5 cm');
    expect(formatLength(45, 'metric')).toBe('45 cm');
    expect(formatLength(121.92, 'metric')).toBe('1.22 m');
    expect(formatLength(300, 'metric')).toBe('3 m');
  });

  it('rounds sensibly for prose', () => {
    const prose = (cm: number) => formatLength(cm, 'imperial', { precision: 'prose' });
    expect(prose(0.3)).toBe('1/8 in');
    expect(prose(0.6)).toBe('1/4 in');
    expect(prose(2.5)).toBe('1 in');
    expect(prose(4)).toBe('1 1/2 in');
    expect(prose(7.5)).toBe('3 in');
    expect(prose(30)).toBe('12 in');
    expect(prose(45)).toBe('18 in');
    expect(prose(60)).toBe('2 ft');
    expect(prose(90)).toBe('3 ft');
    expect(prose(150)).toBe('5 ft');
    expect(prose(200)).toBe('6 ft 6 in');
    expect(formatLength(150, 'metric', { precision: 'prose' })).toBe('1.5 m');
  });
});

describe('formatArea, formatWeight, formatVolume', () => {
  it('formats areas', () => {
    // A 4 x 8 ft bed.
    expect(formatArea(4 * 8 * 929.0304, 'imperial')).toBe('32 sq ft');
    expect(formatArea(4 * 8 * 929.0304, 'metric')).toBe('2.97 m²');
    expect(formatArea(500, 'metric')).toBe('500 cm²');
    expect(formatArea(500, 'imperial')).toBe('78 sq in');
  });

  it('formats weights', () => {
    // 1020 g is 2.25 lb.
    expect(formatWeight(1020, 'imperial')).toBe('2 lb 4 oz');
    expect(formatWeight(340, 'imperial')).toBe('12 oz');
    expect(formatWeight(453.6, 'imperial')).toBe('1 lb');
    expect(formatWeight(10, 'imperial')).toBe('0.4 oz');
    expect(formatWeight(600, 'metric')).toBe('600 g');
    expect(formatWeight(1200, 'metric')).toBe('1.2 kg');
    expect(formatWeight(1000, 'metric')).toBe('1 kg');
    expect(formatWeight(999.7, 'metric')).toBe('1 kg');
  });

  it('formats volumes in US gallons or litres', () => {
    expect(formatVolume(11, 'imperial')).toBe('3 gal');
    expect(formatVolume(8, 'imperial')).toBe('2 gal');
    expect(formatVolume(3, 'imperial')).toBe('1 gal');
    expect(formatVolume(20, 'imperial')).toBe('5 gal');
    expect(formatVolume(75.7, 'imperial')).toBe('20 gal');
    expect(formatVolume(11, 'metric')).toBe('11 L');
    expect(formatVolume(7.5, 'metric')).toBe('7.5 L');
  });
});

describe('parsers', () => {
  it('reads lengths', () => {
    expect(parseLength('3 ft')).toBeCloseTo(91.44, 6);
    expect(parseLength('18 in')).toBeCloseTo(45.72, 6);
    expect(parseLength('45 cm')).toBe(45);
    expect(parseLength('1.5 m')).toBe(150);
    expect(parseLength('6 mm')).toBeCloseTo(0.6, 9);
    expect(parseLength('3 ft 6 in')).toBeCloseTo(106.68, 6);
    expect(parseLength(`3' 6"`)).toBeCloseTo(106.68, 6);
    expect(parseLength('1 1/2 in')).toBeCloseTo(3.81, 6);
    expect(parseLength('1,5 m')).toBe(150);
    expect(parseLength('  2FT ')).toBeCloseTo(60.96, 6);
  });

  it('refuses what it cannot read', () => {
    expect(parseLength('')).toBeNull();
    expect(parseLength('tall')).toBeNull();
    expect(parseLength('3 furlongs')).toBeNull();
    expect(parseLength('12')).toBeNull();
    expect(parseLength('12', 'in')).toBeCloseTo(30.48, 6);
    expect(parseLength('3 ft 6')).toBeNull();
    expect(parseLength('1/0 in')).toBeNull();
  });

  it('reads weights', () => {
    expect(parseWeight('2 lb 4 oz')).toBeCloseTo(1020.58, 1);
    expect(parseWeight('1.5 lb')).toBeCloseTo(680.39, 1);
    expect(parseWeight('600 g')).toBe(600);
    expect(parseWeight('1.2 kg')).toBe(1200);
    expect(parseWeight('8 oz')).toBeCloseTo(226.8, 1);
    expect(parseWeight('3 lbs')).toBeCloseTo(1360.78, 1);
    expect(parseWeight('2 ft')).toBeNull();
    expect(parseWeight('250', 'g')).toBe(250);
  });

  it('round-trips a formatted weight', () => {
    expect(formatWeight(parseWeight('2 lb 4 oz')!, 'imperial')).toBe('2 lb 4 oz');
  });
});

describe('renderNoteTokens', () => {
  const tomato = plantById('tomato')!;

  // The note text itself is research data and may be reworded, so check the measurements only.
  it('renders the tomato sowing note in imperial', () => {
    expect(tomato.notes.sowing).toContain('{cm:0.6} deep, at {c:21} to {c:27}');
    const out = renderNoteTokens(tomato.notes.sowing, 'imperial');
    expect(out).toContain('1/4 in deep, at 70°F to 81°F.');
    expect(out).toContain('nights stay above 50°F,');
    expect(out).not.toMatch(/[{}]/);
  });

  it('renders the tomato sowing note in metric', () => {
    const out = renderNoteTokens(tomato.notes.sowing, 'metric');
    expect(out).toContain('6 mm deep, at 21°C to 27°C.');
    expect(out).toContain('nights stay above 10°C,');
    expect(out).not.toMatch(/[{}]/);
  });

  it('leaves notes without tokens and unknown tokens alone', () => {
    expect(renderNoteTokens(tomato.notes.care, 'imperial')).toBe(tomato.notes.care);
    expect(renderNoteTokens('Keep {kg:2} and {c:hot} as they are, but {c:-4} is 25°F.', 'imperial')).toBe(
      'Keep {kg:2} and {c:hot} as they are, but 25°F is 25°F.',
    );
  });

  it('leaves no token behind in any plant note', () => {
    for (const id of ['carrot', 'winter-squash', 'asparagus', 'garlic']) {
      const p = plantById(id)!;
      for (const n of [p.notes.sowing, p.notes.care, p.notes.harvest]) {
        for (const units of ['imperial', 'metric'] as const) {
          expect(renderNoteTokens(n, units)).not.toMatch(/\{(c|cm):/);
        }
      }
    }
  });
});

describe('formatWeightApprox', () => {
  it('rounds estimates the way a gardener would say them', async () => {
    const { formatWeightApprox } = await import('../../src/domain/units');
    expect(formatWeightApprox(4500, 'imperial')).toBe('10 lb');
    expect(formatWeightApprox(1020, 'imperial')).toBe('2 lb');
    expect(formatWeightApprox(300, 'imperial')).toBe('11 oz');
    expect(formatWeightApprox(4500, 'metric')).toBe('4.5 kg');
    expect(formatWeightApprox(340, 'metric')).toBe('340 g');
  });
});
