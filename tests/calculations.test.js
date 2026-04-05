import { describe, it, expect } from 'vitest';
import {
  computeStairGeometry,
  computePadDimensions,
  computeStringerProfile,
} from '../src/lib/calculations.js';

describe('computeStairGeometry', () => {
  const base = {
    totalHeight: 96,
    topPostSpacing: 36,
    riserHeight: 7.5,
    treadDepth: 11.125,
    stringerOC: 16,
    deckingThickness: 1.5,
    riserBoardThickness: 1.5,
    rimJoistWidth: 9.25,
    sillPlateThickness: 1.5,
    padAboveGrade: 1,
    stringerStockWidth: 11.25,
  };

  it('computes number of risers by rounding totalHeight / target riser', () => {
    const result = computeStairGeometry(base);
    // effectiveRise = 96 - 1 = 95, 95/7.5 = 12.67 → 13
    expect(result.numRisers).toBe(13);
  });

  it('computes actual riser height from effective rise', () => {
    const result = computeStairGeometry(base);
    // effectiveRise = 95, 95/13 = 7.3077
    expect(result.actualRiserHeight).toBeCloseTo(95 / 13, 4);
  });

  it('computes numTreads as numRisers - 1', () => {
    const result = computeStairGeometry(base);
    expect(result.numTreads).toBe(12);
  });

  it('computes total run as numTreads * treadDepth', () => {
    const result = computeStairGeometry(base);
    expect(result.totalRun).toBeCloseTo(12 * 11.125, 4);
  });

  it('computes stair angle in degrees', () => {
    const result = computeStairGeometry(base);
    const expectedAngle = Math.atan(95 / (12 * 11.125)) * (180 / Math.PI);
    expect(result.stairAngle).toBeCloseTo(expectedAngle, 2);
  });

  it('computes stringer length as hypotenuse', () => {
    const result = computeStairGeometry(base);
    const totalRun = 12 * 11.125;
    const expectedLength = Math.sqrt(95 * 95 + totalRun * totalRun);
    expect(result.stringerLength).toBeCloseTo(expectedLength, 2);
  });

  it('computes stair width equal to topPostSpacing', () => {
    const result = computeStairGeometry(base);
    expect(result.stairWidth).toBe(36);
  });

  it('computes number of stringers using fence-post math', () => {
    const result = computeStairGeometry(base);
    // ceil(36 / 16) + 1 = 3 + 1 = 4
    expect(result.numStringers).toBe(4);
  });

  it('computes throat depth to expected value', () => {
    const result = computeStairGeometry(base);
    const rise = 95 / 13;
    const run = 11.125;
    const expectedNotchDepth = (rise * run) / Math.sqrt(rise * rise + run * run);
    const expectedThroat = 11.25 - expectedNotchDepth;
    expect(result.throat).toBeCloseTo(expectedThroat, 3);
  });

  it('handles exact division of effective rise by riserHeight', () => {
    // effectiveRise = 76 - 1 = 75, 75/7.5 = 10
    const exact = { ...base, totalHeight: 76, riserHeight: 7.5 };
    const result = computeStairGeometry(exact);
    expect(result.numRisers).toBe(10);
    expect(result.actualRiserHeight).toBe(7.5);
  });
});

describe('computePadDimensions', () => {
  it('computes pad width from post spacing + clearance', () => {
    const result = computePadDimensions({
      topPostSpacing: 36,
      padSideClearance: 2,
      treadDepth: 11.125,
      seatCutLength: 11.125,
      padAboveGrade: 1,
      concreteBelow: 3,
      gravelDepth: 6,
    });
    expect(result.padWidth).toBe(40);
  });

  it('computes pad depth from seat cut + one tread depth', () => {
    const result = computePadDimensions({
      topPostSpacing: 36,
      padSideClearance: 2,
      treadDepth: 11.125,
      seatCutLength: 11.125,
      padAboveGrade: 1,
      concreteBelow: 3,
      gravelDepth: 6,
    });
    expect(result.padDepth).toBeCloseTo(11.125 + 11.125, 4);
  });

  it('computes concrete thickness and excavation depth', () => {
    const result = computePadDimensions({
      topPostSpacing: 36,
      padSideClearance: 2,
      treadDepth: 11.125,
      seatCutLength: 11.125,
      padAboveGrade: 1,
      concreteBelow: 3,
      gravelDepth: 6,
    });
    expect(result.concreteThickness).toBe(4);
    expect(result.excavationDepth).toBe(9);
  });
});

describe('computeStringerProfile', () => {
  it('returns notch points for the stringer profile', () => {
    const profile = computeStringerProfile({
      numTreads: 3,
      actualRiserHeight: 7.5,
      treadDepth: 11.125,
      deckingThickness: 1.5,
      riserBoardThickness: 1.5,
      sillPlateThickness: 1.5,
      padAboveGrade: 1,
      stringerStockWidth: 11.25,
    });
    expect(profile.notches).toHaveLength(3);
    // bottomDrop = deckingThickness + sillPlateThickness = 1.5 + 1.5 = 3.0
    expect(profile.bottomDrop).toBe(3.0);
    expect(profile.topTreadReduction).toBe(1.5);
  });
});
