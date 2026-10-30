import { describe, expect, it } from 'vitest';
import { labelLines } from '../../src/ui/planner/Poster';

describe('poster patch labels', () => {
  it('keeps a short label on one line', () => {
    expect(labelLines('Tomato', 2, 60, 4)).toEqual(['Tomato 2']);
  });

  it('wraps a long name onto two lines at the same size instead of shrinking it', () => {
    // 24 units wide at size 4 holds about 10 characters a line.
    expect(labelLines('French marigold', 4, 24, 4)).toEqual(['French', 'marigold 4']);
  });

  it('never gives more than two lines, and cuts what still does not fit', () => {
    const lines = labelLines('Very long cultivar name here', 12, 24, 4);
    expect(lines).toHaveLength(2);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(10);
    expect(lines[1]).toMatch(/\.\.\.$/);
  });

  it('cuts a single word wider than the patch', () => {
    expect(labelLines('Nasturtiums', 1, 12, 4)).toEqual(['Na...', '1']);
  });
});
