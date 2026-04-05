import { describe, it, expect } from 'vitest';
import { generateScad } from '../src/lib/scad-generator.js';

describe('generateScad', () => {
  const params = {
    totalHeight: 96,
    topPostSpacing: 36,
    numRisers: 13,
    actualRiserHeight: 96 / 13,
    numTreads: 12,
    treadDepth: 11.125,
    totalRun: 12 * 11.125,
    stairAngle: 35,
    stairWidth: 36,
    numStringers: 4,
    stringerOC: 16,
    deckingThickness: 1.5,
    riserBoardThickness: 1.5,
    rimJoistWidth: 9.25,
    stringerStockWidth: 11.25,
    stringerStockThickness: 1.5,
    sillPlateThickness: 1.5,
    postSize: 3.5,
    padAboveGrade: 1,
    concreteBelow: 3,
    gravelDepth: 6,
    padSideClearance: 2,
    padWidth: 40,
    padDepth: 22.25,
    bottomDrop: 2.0,
    topTreadReduction: 1.5,
    postHeight: 42,
  };

  it('returns a non-empty string', () => {
    const scad = generateScad(params);
    expect(typeof scad).toBe('string');
    expect(scad.length).toBeGreaterThan(100);
  });

  it('contains the main staircase module call', () => {
    const scad = generateScad(params);
    expect(scad).toContain('staircase();');
  });

  it('contains all structural component modules', () => {
    const scad = generateScad(params);
    const requiredModules = [
      'module ground_plane',
      'module concrete_pad',
      'module sill_plate',
      'module bottom_posts',
      'module post_bases',
      'module stringer_at',  // stringer built with difference()
      'module blocking',
      'module tension_ties',
      'module treads',
      'module risers',
      'module stringer_hangers',
      'module rim_joist',
      'module deck_surface',
      'module top_posts',
    ];
    for (const mod of requiredModules) {
      expect(scad).toContain(mod);
    }
  });

  it('includes color assignments for different materials', () => {
    const scad = generateScad(params);
    expect(scad).toContain('concrete_color');
    expect(scad).toContain('stringer_color');
    expect(scad).toContain('hardware_color');
    expect(scad).toContain('decking_color');
    expect(scad).toContain('post_color');
  });

  it('uses the correct number of stringers', () => {
    const scad = generateScad(params);
    expect(scad).toContain('num_stringers = 4');
  });

  it('uses the correct number of treads', () => {
    const scad = generateScad(params);
    expect(scad).toContain('num_treads = 12');
  });
});
