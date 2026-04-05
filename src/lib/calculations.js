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
    padAboveGrade,
  } = params;

  // Effective stair rise: from pad surface to deck top.
  // The pad sits padAboveGrade above grade; that's the landing surface.
  const effectiveRise = totalHeight - padAboveGrade;
  const numRisers = Math.round(effectiveRise / riserHeight);
  const actualRiserHeight = effectiveRise / numRisers;
  const numTreads = numRisers - 1;
  const totalRun = numTreads * treadDepth;
  const stairAngle = Math.atan(effectiveRise / totalRun) * (180 / Math.PI);
  const stringerLength = Math.sqrt(effectiveRise * effectiveRise + totalRun * totalRun);
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

  // Bottom drop: the stringer's first riser cut is shortened so the finished
  // bottom riser (pad surface → first tread decking top) equals actualRiserHeight.
  // The sill plate raises the stringer; tread decking adds height on top.
  const bottomDrop = deckingThickness + sillPlateThickness;

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
