// applyOp's backstop: an op whose result has a new cross-reference problem is refused. Every op
// already checks its own references, so no real op leaves one; the check module is replaced here so
// that a rename to "Trigger" appears to, which shows the refusal path on its own.
import { describe, expect, it, vi } from 'vitest';
import type { Problem } from '../../src/domain/doc/check';
import type { GardenDoc } from '../../src/domain/doc/schema';

vi.mock('../../src/domain/doc/check', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/domain/doc/check')>();
  const fake: Problem = { code: 'duplicate-id', gardenId: 'g1', id: 'x', message: 'Two beds or containers in "Trigger" share the id "x".', repairable: false, key: 'fake' };
  return { ...real, problemsOf: (doc: GardenDoc) => (doc.gardens.some((g) => g.name === 'Trigger') ? [fake] : real.problemsOf(doc)) };
});

const { applyOp } = await import('../../src/domain/doc/ops');
const { emptyDoc } = await import('../../src/domain/doc/schema');

describe('applyOp backstop', () => {
  it('refuses an op that would leave a new problem, and keeps the document as it was', () => {
    const added = applyOp(emptyDoc(), { type: 'addGarden', garden: { id: 'g1', name: 'Home', createdAt: '2026-10-28', cellCm: 30.48 } });
    if (!added.ok) throw new Error(added.error);
    const res = applyOp(added.doc, { type: 'renameGarden', gardenId: 'g1', name: 'Trigger' });
    expect(res).toEqual({ ok: false, error: 'Two beds or containers in "Trigger" share the id "x". That change was not made.' });
    expect(added.doc.gardens[0]?.name).toBe('Home');
  });
});
