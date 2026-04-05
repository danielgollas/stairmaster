import { describe, it, expect } from 'vitest';
import { DEFAULTS, MATERIALS, IRC_LIMITS } from '../src/lib/constants.js';

describe('constants', () => {
  it('has all required default values', () => {
    expect(DEFAULTS.riserHeight).toBe(7.5);
    expect(DEFAULTS.treadDepth).toBe(11.125);
    expect(DEFAULTS.stringerOC).toBe(16);
    expect(DEFAULTS.deckingThickness).toBe(1.5);
    expect(DEFAULTS.riserBoardThickness).toBe(1.5);
    expect(DEFAULTS.rimJoistWidth).toBe(9.25);
    expect(DEFAULTS.sillPlateThickness).toBe(1.5);
    expect(DEFAULTS.padAboveGrade).toBe(1);
    expect(DEFAULTS.concreteBelow).toBe(3);
    expect(DEFAULTS.gravelDepth).toBe(6);
    expect(DEFAULTS.padSideClearance).toBe(2);
  });

  it('has material actual dimensions', () => {
    expect(MATERIALS['2x12'].width).toBe(11.25);
    expect(MATERIALS['2x12'].thickness).toBe(1.5);
    expect(MATERIALS['2x10'].width).toBe(9.25);
    expect(MATERIALS['2x6'].width).toBe(5.5);
    expect(MATERIALS['4x4'].actual).toBe(3.5);
  });

  it('has IRC code limits', () => {
    expect(IRC_LIMITS.maxRiserHeight).toBe(7.75);
    expect(IRC_LIMITS.minRiserHeight).toBe(4);
    expect(IRC_LIMITS.minTreadDepth).toBe(10);
    expect(IRC_LIMITS.minStairWidth).toBe(36);
    expect(IRC_LIMITS.maxRiserVariance).toBe(0.375);
    expect(IRC_LIMITS.minThroat).toBe(5);
  });
});
