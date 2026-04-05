import { describe, it, expect } from 'vitest';
import { checkIRC } from '../src/lib/code-checks.js';

describe('checkIRC', () => {
  const validParams = {
    actualRiserHeight: 7.5,
    treadDepth: 11.125,
    stairWidth: 36,
    throat: 5.5,
    riserVariance: 0,
  };

  it('returns no warnings for valid parameters', () => {
    const warnings = checkIRC(validParams);
    expect(warnings).toEqual([]);
  });

  it('warns when riser height exceeds max', () => {
    const warnings = checkIRC({ ...validParams, actualRiserHeight: 8 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('RISER_TOO_HIGH');
  });

  it('warns when riser height is below min', () => {
    const warnings = checkIRC({ ...validParams, actualRiserHeight: 3.5 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('RISER_TOO_LOW');
  });

  it('warns when tread depth is below min', () => {
    const warnings = checkIRC({ ...validParams, treadDepth: 9 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('TREAD_TOO_SHALLOW');
  });

  it('warns when stair width is below min', () => {
    const warnings = checkIRC({ ...validParams, stairWidth: 30 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('WIDTH_TOO_NARROW');
  });

  it('warns when riser variance exceeds max', () => {
    const warnings = checkIRC({ ...validParams, riserVariance: 0.5 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('RISER_VARIANCE');
  });

  it('warns when throat is below min', () => {
    const warnings = checkIRC({ ...validParams, throat: 4 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('THROAT_TOO_THIN');
  });

  it('returns multiple warnings when multiple violations exist', () => {
    const warnings = checkIRC({
      actualRiserHeight: 8,
      treadDepth: 9,
      stairWidth: 30,
      throat: 4,
      riserVariance: 0.5,
    });
    expect(warnings).toHaveLength(5);
  });
});
