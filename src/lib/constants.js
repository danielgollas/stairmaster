export const MATERIALS = {
  '2x12': { thickness: 1.5, width: 11.25 },
  '2x10': { thickness: 1.5, width: 9.25 },
  '2x8':  { thickness: 1.5, width: 7.25 },
  '2x6':  { thickness: 1.5, width: 5.5 },
  '4x4':  { actual: 3.5 },
  '6x6':  { actual: 5.5 },
};

export const DEFAULTS = {
  // Stair geometry
  riserHeight: 7.5,
  treadDepth: 11.125,   // 2x 2x6 (5.5) + 1/8" gap
  stringerOC: 16,

  // Materials
  deckingThickness: 1.5,
  riserBoardThickness: 1.5,
  rimJoistWidth: 9.25,
  stringerStock: '2x12',
  sillPlateThickness: 1.5,
  postSize: '4x4',

  // Concrete pad
  padAboveGrade: 1,
  concreteBelow: 3,
  gravelDepth: 6,
  padSideClearance: 2,
  padBackExtension: 6,

  // Hardware
  postBase: 'Simpson ABA44Z',
  tensionTie: 'Simpson DTT2Z',
  stringerHanger: 'Simpson LSC',
};

export const IRC_LIMITS = {
  maxRiserHeight: 7.75,
  minRiserHeight: 4,
  minTreadDepth: 10,
  minStairWidth: 36,
  maxRiserVariance: 0.375,  // 3/8"
  minThroat: 5,
};
