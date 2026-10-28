import { describe, expect, it } from 'vitest';
import { fmtRange, inSentence } from '../../src/ui/format';

describe('plant names mid-sentence', () => {
  it('lower-cases ordinary names and keeps proper adjectives', () => {
    expect(inSentence('Lettuce')).toBe('lettuce');
    expect(inSentence('Swiss chard')).toBe('Swiss chard');
    expect(inSentence('French marigold')).toBe('French marigold');
    expect(inSentence('Brussels sprouts')).toBe('Brussels sprouts');
    // Only whole words count: "Thaiish" is not "Thai".
    expect(inSentence('Thaiish basil')).toBe('thaiish basil');
  });
});

describe('date ranges', () => {
  it('says "all year round" for a window that spans the year', () => {
    expect(fmtRange(100, 464)).toBe('all year round');
  });
});
