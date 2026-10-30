import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../../src/domain/doc/schema';
import { keepLastExport, sectionInView } from '../../src/ui/settings/model';

const withExport = (at?: string) => {
  const d = emptyDoc();
  return at === undefined ? d : { ...d, settings: { ...d.settings, lastExportAt: at } };
};

describe('settings: last download survives opening a copy', () => {
  it('keeps the download recorded here when the file has none', () => {
    expect(keepLastExport(withExport(), '2027-05-20').settings.lastExportAt).toBe('2027-05-20');
  });
  it('keeps the later of the two days', () => {
    expect(keepLastExport(withExport('2027-05-01'), '2027-05-20').settings.lastExportAt).toBe('2027-05-20');
    expect(keepLastExport(withExport('2027-06-01'), '2027-05-20').settings.lastExportAt).toBe('2027-06-01');
  });
  it('leaves a document alone when nothing was downloaded here', () => {
    const d = withExport('2027-05-01');
    expect(keepLastExport(d, undefined)).toBe(d);
    expect(keepLastExport(withExport(), undefined).settings.lastExportAt).toBeUndefined();
  });
});

describe('settings: the side menu follows the section in view', () => {
  // Five sections; the reading band runs from the top of an 800 px window to 240 px down.
  const at = (tops: number[], atBottom = false, requested: number | null = null) => sectionInView(tops, 0, 240, atBottom, requested, 800);
  it('marks the section whose heading is near the top', () => {
    expect(at([16, 900, 1300, 2000, 2400])).toBe(0);
    expect(at([-1200, -400, 120, 700, 1100])).toBe(2);
  });
  it('a short section scrolled to the top wins over the next heading in the band', () => {
    expect(at([16, 178, 500, 900, 1200], false, 0)).toBe(0);
  });
  it('marks the section being read through when no heading is in the band', () => {
    expect(at([-1200, -400, 250, 700, 1100])).toBe(1);
  });
  it('marks the data section while it is in view, not the climate section above it', () => {
    expect(at([-1500, -700, 150, 900, 1300], false, 0)).toBe(2);
    expect(at([-1500, -700, -100, 650, 1000], false, 0)).toBe(2);
  });
  it('at the bottom of the page, marks the section asked for if it shows, otherwise the last', () => {
    expect(at([-1500, -700, -100, 300, 600], true, 3)).toBe(3);
    expect(at([-1500, -700, -100, 300, 600], true, 0)).toBe(4);
    expect(at([-1500, -700, -100, 300, 600], true, null)).toBe(4);
  });
});
