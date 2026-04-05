/**
 * Compute all stair geometry from input parameters.
 * All dimensions in inches, angles in degrees.
 */
export function computeStairGeometry(params) {
  const {
    totalHeight,
    topPostSpacing,
    riserHeight,
    treadDepth,
    stringerOC,
    stringerStockWidth,
  } = params;

  const numRisers = Math.round(totalHeight / riserHeight);
  const actualRiserHeight = totalHeight / numRisers;
  const numTreads = numRisers - 1;
  const totalRun = numTreads * treadDepth;
  const stairAngle = Math.atan(totalHeight / totalRun) * (180 / Math.PI);
  const stringerLength = Math.sqrt(totalHeight * totalHeight + totalRun * totalRun);
  const stairWidth = topPostSpacing;
  const numStringers = Math.ceil(stairWidth / stringerOC) + 1;

  // Throat: perpendicular distance from notch inside corner to uncut bottom edge
  const notchDepth =
    (actualRiserHeight * treadDepth) /
    Math.sqrt(actualRiserHeight * actualRiserHeight + treadDepth * treadDepth);
  const throat = stringerStockWidth - notchDepth;

  return {
    numRisers,
    actualRiserHeight,
    numTreads,
    totalRun,
    stairAngle,
    stringerLength,
    stairWidth,
    numStringers,
    throat,
    notchDepth,
  };
}

/**
 * Compute concrete pad dimensions.
 */
export function computePadDimensions(params) {
  const {
    topPostSpacing,
    padSideClearance,
    treadDepth,
    seatCutLength,
    padAboveGrade,
    concreteBelow,
    gravelDepth,
  } = params;

  return {
    padWidth: topPostSpacing + 2 * padSideClearance,
    padDepth: seatCutLength + treadDepth,
    concreteThickness: concreteBelow + padAboveGrade,
    excavationDepth: gravelDepth + concreteBelow,
  };
}

/**
 * Compute stringer profile geometry for OpenSCAD generation.
 */
export function computeStringerProfile(params) {
  const {
    numTreads,
    actualRiserHeight,
    treadDepth,
    deckingThickness,
    riserBoardThickness,
    sillPlateThickness,
    padAboveGrade,
    stringerStockWidth,
  } = params;

  // Bottom drop: accounts for tread thickness, sill plate raising the stringer,
  // and pad above grade raising the landing surface
  const bottomDrop = deckingThickness + sillPlateThickness - padAboveGrade;

  // Top tread cut is shortened by riser board thickness
  const topTreadReduction = riserBoardThickness;

  // Generate notch positions relative to the bottom-front of the stringer
  const notches = [];
  for (let i = 0; i < numTreads; i++) {
    notches.push({
      x: i * treadDepth,
      y: i * actualRiserHeight,
      treadDepth: i === numTreads - 1 ? treadDepth - topTreadReduction : treadDepth,
      riserHeight: actualRiserHeight,
    });
  }

  const seatCutLength = treadDepth;

  return {
    notches,
    bottomDrop,
    topTreadReduction,
    seatCutLength,
    stringerStockWidth,
  };
}
