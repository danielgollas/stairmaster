import { IRC_LIMITS } from './constants.js';

/**
 * Check parameters against IRC residential stair code.
 * Returns an array of warning objects (informational, non-blocking).
 */
export function checkIRC(params) {
  const { actualRiserHeight, treadDepth, stairWidth, throat, riserVariance } = params;
  const warnings = [];

  if (actualRiserHeight > IRC_LIMITS.maxRiserHeight) {
    warnings.push({
      code: 'RISER_TOO_HIGH',
      message: `Riser height ${actualRiserHeight.toFixed(3)}" exceeds IRC max of ${IRC_LIMITS.maxRiserHeight}"`,
      severity: 'warning',
    });
  }

  if (actualRiserHeight < IRC_LIMITS.minRiserHeight) {
    warnings.push({
      code: 'RISER_TOO_LOW',
      message: `Riser height ${actualRiserHeight.toFixed(3)}" is below IRC min of ${IRC_LIMITS.minRiserHeight}"`,
      severity: 'warning',
    });
  }

  if (treadDepth < IRC_LIMITS.minTreadDepth) {
    warnings.push({
      code: 'TREAD_TOO_SHALLOW',
      message: `Tread depth ${treadDepth}" is below IRC min of ${IRC_LIMITS.minTreadDepth}"`,
      severity: 'warning',
    });
  }

  if (stairWidth < IRC_LIMITS.minStairWidth) {
    warnings.push({
      code: 'WIDTH_TOO_NARROW',
      message: `Stair width ${stairWidth}" is below IRC min of ${IRC_LIMITS.minStairWidth}"`,
      severity: 'warning',
    });
  }

  if (riserVariance > IRC_LIMITS.maxRiserVariance) {
    warnings.push({
      code: 'RISER_VARIANCE',
      message: `Riser variance ${riserVariance.toFixed(3)}" exceeds IRC max of ${IRC_LIMITS.maxRiserVariance}"`,
      severity: 'warning',
    });
  }

  if (throat < IRC_LIMITS.minThroat) {
    warnings.push({
      code: 'THROAT_TOO_THIN',
      message: `Stringer throat ${throat.toFixed(2)}" is below recommended min of ${IRC_LIMITS.minThroat}"`,
      severity: 'warning',
    });
  }

  return warnings;
}
