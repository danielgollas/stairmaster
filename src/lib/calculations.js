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
    stringerStockThickness,
    stringerPosition,
    postSize,
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

  // Stringer positions determined by posts + max OC
  // Outer stringers at post positions (inside or outside)
  const st = stringerStockThickness || 1.5;
  const ps = postSize || 3.5;
  let outerStringerSpan;  // distance between outer stringer centers
  if (stringerPosition === 'outside') {
    // Outer stringers outside the posts
    outerStringerSpan = topPostSpacing + 2 * ps + st;
  } else {
    // Inside posts (default): outer stringers inside the post faces
    outerStringerSpan = topPostSpacing - st;
  }

  // Number of spans between stringers, ensuring OC ≤ stringerOC (max)
  const numSpans = Math.ceil(outerStringerSpan / stringerOC);
  const numStringers = numSpans + 1;
  const actualOC = outerStringerSpan / numSpans;

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
    actualOC,
    outerStringerSpan,
    // Effective width for treads/risers/sill/rim (outer stringer face to outer stringer face)
    effectiveWidth: outerStringerSpan + (stringerStockThickness || 1.5),
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
    postSize,
    treadDepth,
    seatCutLength,
    padAboveGrade,
    concreteBelow,
    gravelDepth,
    padBackExtension,
  } = params;

  // Pad must be at least as wide as outer faces of bottom posts + clearance
  const minWidth = topPostSpacing + 2 * (postSize || 3.5) + 2 * padSideClearance;
  const padWidth = Math.max(minWidth, topPostSpacing + 2 * padSideClearance);

  return {
    padWidth,
    padDepth: seatCutLength + treadDepth + (padBackExtension || 0),
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
