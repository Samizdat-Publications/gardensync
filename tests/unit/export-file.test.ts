import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseImportFile, toExportFile } from '../../src/domain/doc/exportFile';
import { applyOp } from '../../src/domain/doc/ops';
import { emptyDoc } from '../../src/domain/doc/schema';
import { starterOps } from '../../src/domain/doc/starters';

let n = 0;
const opts = { today: '2027-02-01', newId: () => `x${n++}` };

function sampleDoc() {
  const res = applyOp(emptyDoc(), {
    type: 'batch',
    ops: starterOps({ kind: 'first-bed', gardenId: 'g1', name: 'Back garden', today: '2027-02-01', units: 'imperial', climate: null, newId: () => `id${n++}` }),
  });
  if (!res.ok) throw new Error(res.error);
  return res.doc;
}

describe('export files', () => {
  it('round-trips a document', () => {
    const doc = sampleDoc();
    const res = parseImportFile(toExportFile(doc, '2027-02-01T10:00:00Z', '8.0.0'), opts);
    expect(res.kind).toBe('doc');
    if (res.kind === 'doc') expect(res.doc).toEqual(doc);
  });

  it('reads a 7.x export as a new garden', () => {
    const text = readFileSync('tests/fixtures/v7/beginner-starter.export.json', 'utf8');
    const res = parseImportFile(text, opts);
    expect(res.kind).toBe('v7');
    if (res.kind === 'v7') expect(res.report.containers).toBeGreaterThan(0);
  });

  it('explains what is wrong with a bad file instead of throwing', () => {
    expect(parseImportFile('not json', opts)).toMatchObject({ kind: 'error' });
    expect(parseImportFile('{"format":"gardensync","schemaVersion":99}', opts)).toMatchObject({ kind: 'error', message: expect.stringMatching(/newer/) });
    const doc = sampleDoc();
    const broken = JSON.parse(toExportFile(doc, 't', '8'));
    broken.doc.gardens[0].plantings[0].containerId = 'missing';
    expect(parseImportFile(JSON.stringify(broken), opts)).toMatchObject({ kind: 'error', message: expect.stringMatching(/fit together/) });
    expect(parseImportFile('x'.repeat(6 * 1024 * 1024), opts)).toMatchObject({ kind: 'error', message: expect.stringMatching(/too large/) });
  });
});
