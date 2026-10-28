import { describe, expect, it } from 'vitest';
import { columnLetter, squaresLabel } from '../../src/domain/layout/labels';

describe('square labels', () => {
  it('names columns like a spreadsheet', () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(columnLetter)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  });
  it('names a square or a rectangle of squares', () => {
    expect(squaresLabel({ col: 2, row: 0, w: 1, h: 1 })).toBe('C1');
    expect(squaresLabel({ col: 2, row: 0, w: 2, h: 2 })).toBe('C1 to D2');
  });
});
