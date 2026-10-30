import { describe, expect, it } from 'vitest';
import { emptyDoc } from '../../src/domain/doc/schema';
import { applyOp } from '../../src/domain/doc/ops';
import { parseImportFile } from '../../src/domain/doc/exportFile';
import { keepLastExport, openCopyQuestion, openErrorText, sectionInView } from '../../src/ui/settings/model';

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

describe('settings: opening a saved copy asks first', () => {
  const withGardens = (...names: string[]) => {
    const res = applyOp(emptyDoc(), { type: 'batch', ops: names.map((name, i) => ({ type: 'addGarden' as const, garden: { id: `g${i}`, name, createdAt: '2027-05-01', cellCm: 30.48 } })) });
    if (!res.ok) throw new Error(res.error);
    return res.doc;
  };

  it('names what is replaced and what the copy holds, and says a backup is kept', () => {
    const q = openCopyQuestion(withGardens('Back garden'), withGardens('Allotment', 'Patio'));
    expect(q).toContain('replaces Back garden');
    expect(q).toContain('the gardens in the file: Allotment (no beds or pots yet) and Patio (no beds or pots yet)');
    expect(q).toContain('Backups');
  });
  it('counts the beds and pots in each garden', () => {
    expect(openCopyQuestion(withGardens('Back garden'), withGardens('Patio'))).toContain('Back garden (no beds or pots yet)');
  });
  it('shortens a long list of gardens', () => {
    const q = openCopyQuestion(withGardens('A', 'B', 'C', 'D', 'E'), withGardens('F'));
    expect(q).toContain('C (no beds or pots yet) and 2 more gardens with');
  });
  it('reads plainly when nothing is here yet', () => {
    expect(openCopyQuestion(emptyDoc(), withGardens('Patio'))).not.toContain('replaces');
  });
  it('has no em dashes', () => {
    expect(openCopyQuestion(withGardens('Back garden'), withGardens('Patio'))).not.toContain('\u2014');
  });
});

describe('settings: a file that is not a garden', () => {
  it('says so plainly, whatever the file is', () => {
    const plain = 'This file is not a GardenSync garden file. Nothing was changed.';
    const opts = { today: '2027-05-01', newId: () => 'x', tzOffsetMinutes: 0 };
    for (const text of ['{"hello":1}', 'not json at all', '[1,2,3]']) {
      const res = parseImportFile(text, opts);
      expect(res.kind).toBe('error');
      if (res.kind === 'error') expect(openErrorText(res.message)).toBe(plain);
    }
  });
  it('keeps a specific reason and adds that nothing changed', () => {
    expect(openErrorText('That copy was saved by a newer GardenSync. Update this one, then open it again.')).toBe(
      'That copy was saved by a newer GardenSync. Update this one, then open it again. Nothing was changed.',
    );
  });
});
