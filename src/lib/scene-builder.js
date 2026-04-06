import * as THREE from 'three';

const COLORS = {
  concrete:  0xa6a6a6,
  gravel:    0x735a33,
  stringer:  0xd9a626,
  sillPlate: 0xb3801a,
  post:      0x996626,
  decking:   0x8c5a1a,
  riser:     0x804d14,
  riserRip:  0x6b3d0f,
  blocking:  0xbf8c33,
  hardware:  0xcc3333,
  rimJoist:  0xa67320,
  ground:    0x22c422,
  grid:      0x4d4d4d,
};

function makeMesh(geo, color, opacity = 1) {
  const mat = new THREE.MeshPhongMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    flatShading: true,
  });
  return new THREE.Mesh(geo, mat);
}

function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

/**
 * Build all stair components as separate Three.js meshes.
 * Returns { componentName: THREE.Object3D }
 *
 * Coordinate system: X = horizontal run, Y = width, Z = height (up)
 */
export function buildScene(p) {
  const meshes = {};

  // --- Grid ---
  const gridGroup = new THREE.Group();
  const gridMat = new THREE.LineBasicMaterial({ color: COLORS.grid, transparent: true, opacity: 0.5 });
  const gridPts = [];
  for (let x = -24; x <= p.totalRun + 48; x += 12) {
    gridPts.push(new THREE.Vector3(x, -24, -0.05), new THREE.Vector3(x, p.stairWidth + 24, -0.05));
  }
  for (let y = -24; y <= p.stairWidth + 24; y += 12) {
    gridPts.push(new THREE.Vector3(-24, y, -0.05), new THREE.Vector3(p.totalRun + 48, y, -0.05));
  }
  const gridGeo = new THREE.BufferGeometry().setFromPoints(gridPts);
  gridGroup.add(new THREE.LineSegments(gridGeo, gridMat));
  meshes.grid = gridGroup;

  // --- Ground plane ---
  const groundGeo = new THREE.PlaneGeometry(p.totalRun + 72, p.stairWidth + 48);
  const groundMat = new THREE.MeshPhongMaterial({ color: COLORS.ground, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(p.totalRun / 2, p.stairWidth / 2, 0);
  meshes.groundPlane = ground;

  // --- Concrete pad ---
  const padGroup = new THREE.Group();
  const padCenterY = p.stairWidth / 2;

  // Pad shifted left by rb so bottom riser board sits on sill plate
  const padShift = -p.riserBoardThickness;

  // Pad shifted left by half its depth so front half is the ground-level "tread"
  // Center x = padShift - padDepth/2 (left half extends forward as landing)
  const padCenterX = padShift;

  // Gravel
  const gravelMesh = makeMesh(box(p.padDepth, p.padWidth, p.gravelDepth), COLORS.gravel);
  gravelMesh.position.set(padCenterX, padCenterY, -(p.concreteBelow + p.gravelDepth / 2));
  padGroup.add(gravelMesh);

  // Concrete
  const concreteH = p.concreteBelow + p.padAboveGrade;
  const concreteMesh = makeMesh(box(p.padDepth, p.padWidth, concreteH), COLORS.concrete);
  concreteMesh.position.set(padCenterX, padCenterY, -p.concreteBelow + concreteH / 2);
  padGroup.add(concreteMesh);

  meshes.concretePad = padGroup;

  // --- Sill plate ---
  const sillY = (p.stairWidth - p.topPostSpacing) / 2;
  const ps = p.postSize;

  // Effective Y range for components that adapt to stringer position
  const firstStringerY = (p.stringerPosition === 'outside')
    ? sillY - ps - p.stringerStockThickness
    : sillY;
  const compStartY = firstStringerY;  // left edge of first outer stringer
  const compWidth = p.effectiveWidth;  // outer face to outer face
  const compCenterY = compStartY + compWidth / 2;
  const sillDepth = p.treadDepth;
  const sillMesh = makeMesh(box(sillDepth, compWidth, p.sillPlateThickness), COLORS.sillPlate);
  sillMesh.position.set(padShift + sillDepth / 2, compCenterY, p.padAboveGrade + p.sillPlateThickness / 2);
  meshes.sillPlate = sillMesh;

  // --- Bottom posts ---
  const postGroup = new THREE.Group();
  const postBaseZ = p.padAboveGrade;
  const postH = p.postHeight;
  const leftPostY = sillY - ps;
  const rightPostY = sillY + p.topPostSpacing;

  // Posts aligned with sill plate start — left face at padShift
  const postX = padShift + ps / 2;
  const lPost = makeMesh(box(ps, ps, postH), COLORS.post);
  lPost.position.set(postX, leftPostY + ps / 2, postBaseZ + postH / 2);
  postGroup.add(lPost);

  const rPost = makeMesh(box(ps, ps, postH), COLORS.post);
  rPost.position.set(postX, rightPostY + ps / 2, postBaseZ + postH / 2);
  postGroup.add(rPost);

  meshes.bottomPosts = postGroup;

  // --- Post bases (schematic plates) ---
  const basesGroup = new THREE.Group();
  const plateH = 0.25;
  const plateSize = ps + 1;

  const lBase = makeMesh(box(plateSize, plateSize, plateH), COLORS.hardware);
  lBase.position.set(postX, leftPostY + ps / 2, postBaseZ - plateH / 2);
  basesGroup.add(lBase);

  const rBase = makeMesh(box(plateSize, plateSize, plateH), COLORS.hardware);
  rBase.position.set(postX, rightPostY + ps / 2, postBaseZ - plateH / 2);
  basesGroup.add(rBase);

  meshes.postBases = basesGroup;

  // --- Stringers ---
  const stringerGroup = new THREE.Group();
  const stringerShape = buildStringerShape(p);
  const extSettings = { depth: p.stringerStockThickness, bevelEnabled: false };
  const baseGeo = new THREE.ExtrudeGeometry(stringerShape, extSettings);
  // Shape in XY extruded along +Z. We need: X→X(run), Y→Z(height), Z→Y(width)
  // rotateX(-PI/2): Y→-Z, Z→Y. So shape Y goes DOWN (wrong).
  // rotateX(PI/2): Y→Z, Z→-Y. Shape Y goes UP (correct), extrusion goes -Y.
  baseGeo.rotateX(Math.PI / 2);

  const seatZ = p.padAboveGrade + p.sillPlateThickness;

  for (let i = 0; i < p.numStringers; i++) {
    const y = firstStringerY + i * p.actualOC;
    const geo = baseGeo.clone();
    const mesh = makeMesh(geo, COLORS.stringer);
    mesh.position.set(0, y + p.stringerStockThickness, seatZ);
    stringerGroup.add(mesh);
  }

  meshes.stringers = stringerGroup;

  // --- Board overlay: 2x12x8' stock board aligned with stringer bottom edge ---
  const boardOverlayGroup = new THREE.Group();
  {
    const boardLen = 96;  // 8 feet
    const boardW = p.stringerStockWidth;  // 11.25"
    const rise = p.actualRiserHeight;
    const run = p.treadDepth;
    const drop = p.bottomDrop;
    const rb = p.riserBoardThickness;
    const hyp = Math.sqrt(rise * rise + run * run);
    const offX = boardW * rise / hyp;
    const offY = boardW * run / hyp;

    // Bottom edge: riser top line - sw*hyp/run (riser tops = board top edge)
    const slopeRatio = rise / run;
    const topLineY0 = rise - drop;
    const boardVert = boardW * hyp / run;
    const botAtSeat = topLineY0 - boardVert;

    // Board bottom-left corner at (0, botAtSeat)
    // Board extends along the slope for boardLen
    const dx = boardLen * run / hyp;   // horizontal extent
    const dy = boardLen * rise / hyp;  // vertical extent

    // Board with plumb cuts at both ends
    const boardShape = new THREE.Shape();
    boardShape.moveTo(0, botAtSeat);                              // bottom-left
    boardShape.lineTo(dx, botAtSeat + dy);                        // bottom-right
    boardShape.lineTo(dx, botAtSeat + dy + boardVert);             // top-right (plumb cut)
    boardShape.lineTo(0, botAtSeat + boardVert);                   // top-left (plumb cut)

    const boardGeo = new THREE.ExtrudeGeometry(boardShape, {
      depth: p.stringerStockThickness,
      bevelEnabled: false,
    });
    boardGeo.rotateX(Math.PI / 2);

    const boardMat = new THREE.MeshPhongMaterial({
      color: 0xd4a574,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const boardMesh = new THREE.Mesh(boardGeo, boardMat);
    boardMesh.position.set(0, firstStringerY + p.stringerStockThickness, seatZ);

    boardOverlayGroup.add(boardMesh);
  }
  meshes.boardOverlay = boardOverlayGroup;

  // --- Blocking ---
  const blockingGroup = new THREE.Group();
  // Blocking is 2x4 material: 1.5" thick x 3.5" tall, laid flat on sill plate
  const blockThickness = 1.5;  // 2x4 thickness
  const blockHeight = 3.5;     // 2x4 width (laid on edge)
  const blockZ = p.padAboveGrade + p.sillPlateThickness + blockHeight / 2;

  for (let i = 0; i < p.numStringers - 1; i++) {
    const yStart = firstStringerY + i * p.actualOC + p.stringerStockThickness;
    const blockLen = p.actualOC - p.stringerStockThickness;
    // Blocking left face aligns with post right face
    const blockX = padShift + ps + blockThickness / 2;
    const block = makeMesh(box(blockThickness, blockLen, blockHeight), COLORS.blocking);
    block.position.set(blockX, yStart + blockLen / 2, blockZ);
    blockingGroup.add(block);
  }

  meshes.blocking = blockingGroup;

  // --- Tension ties ---
  const tiesGroup = new THREE.Group();
  const tieW = 0.25, tieD = 3, tieH = 6;
  const tieZ = p.padAboveGrade + p.sillPlateThickness + tieH / 2;

  // Tension ties at the blocking/post interface — bolt through posts into blocking
  const tieX = padShift + ps + tieW / 2;  // on the blocking face (post right face)
  const lTie = makeMesh(box(tieW, tieD, tieH), COLORS.hardware);
  lTie.position.set(tieX, sillY + p.stringerStockThickness + tieD / 2, tieZ);
  tiesGroup.add(lTie);

  const rTie = makeMesh(box(tieW, tieD, tieH), COLORS.hardware);
  rTie.position.set(tieX, sillY + p.topPostSpacing - p.stringerStockThickness - tieD / 2, tieZ);
  tiesGroup.add(rTie);

  meshes.tensionTies = tiesGroup;

  // --- Treads ---
  const treadsGroup = new THREE.Group();
  const boardW = 5.5; // 2x6 width
  const gap = 0.125;

  // notchZ(i) = stringer horizontal cut level for notch i
  function notchZ(i) {
    return p.padAboveGrade + (i + 1) * p.actualRiserHeight - p.deckingThickness;
  }

  for (let i = 0; i < p.numTreads; i++) {
    const x = i * p.treadDepth;
    const nz = notchZ(i);

    // Tread boards overhang the front by rb to cover the riser below.
    // Top tread: back butts against rim joist at totalRun.
    const isTopTread = (i === p.numTreads - 1);
    const rimFace = p.totalRun - 1.5;  // rim joist front face
    const treadStart = isTopTread
      ? rimFace - (boardW + gap + boardW)
      : x - p.riserBoardThickness;

    const front = makeMesh(box(boardW, compWidth, p.deckingThickness), COLORS.decking);
    front.position.set(treadStart + boardW / 2, compCenterY, nz + p.deckingThickness / 2);
    treadsGroup.add(front);

    const back = makeMesh(box(boardW, compWidth, p.deckingThickness), COLORS.decking);
    back.position.set(treadStart + boardW + gap + boardW / 2, compCenterY, nz + p.deckingThickness / 2);
    treadsGroup.add(back);
  }

  meshes.treads = treadsGroup;

  // --- Risers ---
  const risersGroup = new THREE.Group();

  const fullBoardH = 5.5;  // 2x6 actual width used for riser boards

  for (let i = 0; i < p.numTreads; i++) {
    const riserX = i * p.treadDepth - p.riserBoardThickness;
    const sillTopZ = p.padAboveGrade + p.sillPlateThickness;
    const riserBottom = (i > 0) ? notchZ(i - 1) : sillTopZ;
    const riserTop = notchZ(i);
    const riserH = riserTop - riserBottom;
    const ripH = riserH - fullBoardH;

    // Single board spans full stair width
    // Bottom piece: full 2x6 (5.5")
    const fullBoard = makeMesh(box(p.riserBoardThickness, compWidth, Math.min(fullBoardH, riserH)), COLORS.riser);
    fullBoard.position.set(riserX + p.riserBoardThickness / 2, compCenterY, riserBottom + Math.min(fullBoardH, riserH) / 2);
    risersGroup.add(fullBoard);

    // Top piece: ripped 2x6 to fill remaining height
    if (ripH > 0.01) {
      const ripBoard = makeMesh(box(p.riserBoardThickness, compWidth, ripH), COLORS.riserRip);
      ripBoard.position.set(riserX + p.riserBoardThickness / 2, compCenterY, riserBottom + fullBoardH + ripH / 2);
      risersGroup.add(ripBoard);
    }
  }

  meshes.risers = risersGroup;

  // --- Stringer hangers ---
  const hangersGroup = new THREE.Group();

  for (let i = 0; i < p.numStringers; i++) {
    const y = firstStringerY + i * p.actualOC;
    const hanger = makeMesh(box(1, p.stringerStockThickness, 4), COLORS.hardware);
    hanger.position.set(p.totalRun - 0.5, y + p.stringerStockThickness / 2, p.totalHeight - p.deckingThickness - p.rimJoistWidth + 2);
    hangersGroup.add(hanger);
  }

  meshes.stringerHangers = hangersGroup;

  // --- Rim joist ---
  // Rim joist sits under the deck. Back face at totalRun, front face at totalRun - 1.5.
  const rimX = p.totalRun - 1.5;  // rim joist front face
  const rimMesh = makeMesh(box(1.5, compWidth, p.rimJoistWidth), COLORS.rimJoist);
  rimMesh.position.set(rimX + 0.75, compCenterY, p.totalHeight - p.deckingThickness - p.rimJoistWidth / 2);
  meshes.rimJoist = rimMesh;

  // --- Deck surface ---
  // Deck boards are flush with the rim joist front face, extending back over the rim joist
  const deckMesh = makeMesh(box(24, p.stairWidth + 12, p.deckingThickness), COLORS.decking);
  deckMesh.position.set(rimX + 12, p.stairWidth / 2, p.totalHeight - p.deckingThickness / 2);
  meshes.deckSurface = deckMesh;

  // --- Top posts ---
  const topPostsGroup = new THREE.Group();
  const topPostZ = p.totalHeight - p.deckingThickness;

  const tlPost = makeMesh(box(ps, ps, postH), COLORS.post);
  tlPost.position.set(rimX + 1.5 + ps / 2, sillY - ps + ps / 2, topPostZ + postH / 2);
  topPostsGroup.add(tlPost);

  const trPost = makeMesh(box(ps, ps, postH), COLORS.post);
  trPost.position.set(rimX + 1.5 + ps / 2, sillY + p.topPostSpacing + ps / 2, topPostZ + postH / 2);
  topPostsGroup.add(trPost);

  meshes.topPosts = topPostsGroup;

  // --- Dimensions ---
  meshes.dimensions = buildDimensions(p);

  return meshes;
}

/**
 * Create a text sprite for dimension labels.
 */
function makeTextSprite(text, color = '#ffffff', fontSize = 48) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${fontSize}px monospace`;
  const metrics = ctx.measureText(text);
  const w = metrics.width + 16;
  const h = fontSize + 12;
  canvas.width = w;
  canvas.height = h;

  ctx.font = `bold ${fontSize}px monospace`;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  // Scale sprite to reasonable world-space size
  const scale = Math.max(3, text.length * 0.8);
  sprite.scale.set(scale, scale * (h / w), 1);
  return sprite;
}

/**
 * Create a dimension line between two 3D points with end ticks and a label.
 */
function makeDimLine(from, to, label, color = 0x60a5fa, offset = null) {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({ color, depthTest: false });

  // Main line
  const pts = [new THREE.Vector3(...from), new THREE.Vector3(...to)];
  const lineGeo = new THREE.BufferGeometry().setFromPoints(pts);
  group.add(new THREE.Line(lineGeo, mat));

  // End ticks (small perpendicular lines)
  const dir = new THREE.Vector3().subVectors(pts[1], pts[0]).normalize();
  const tickLen = 1.0;
  // Find a perpendicular direction
  const up = new THREE.Vector3(0, 0, 1);
  let perp = new THREE.Vector3().crossVectors(dir, up);
  if (perp.length() < 0.01) {
    perp = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
  }
  perp.normalize().multiplyScalar(tickLen);

  for (const pt of pts) {
    const tickPts = [
      pt.clone().add(perp),
      pt.clone().sub(perp),
    ];
    const tickGeo = new THREE.BufferGeometry().setFromPoints(tickPts);
    group.add(new THREE.Line(tickGeo, mat));
  }

  // Label at midpoint
  const mid = new THREE.Vector3().addVectors(pts[0], pts[1]).multiplyScalar(0.5);
  if (offset) mid.add(new THREE.Vector3(...offset));
  const sprite = makeTextSprite(label, '#60a5fa');
  sprite.position.copy(mid);
  group.add(sprite);

  return group;
}

/**
 * Build all dimension annotations.
 */
function buildDimensions(p) {
  const group = new THREE.Group();
  const sillY = (p.stairWidth - p.topPostSpacing) / 2;
  const dimY = -8; // offset to side so dims don't overlap geometry

  // Total height: grade to deck top
  group.add(makeDimLine(
    [p.totalRun + 8, dimY, 0],
    [p.totalRun + 8, dimY, p.totalHeight],
    `${p.totalHeight.toFixed(1)}"`,
    0xf472b6
  ));

  // Total run
  group.add(makeDimLine(
    [0, dimY, -4],
    [p.totalRun, dimY, -4],
    `${p.totalRun.toFixed(1)}" run`,
    0x60a5fa
  ));

  // Per-riser height labels (finished surface to surface)
  // All risers = actualRiserHeight. Walking surfaces at padAbove + i*rise.
  const riserDimX = -6;
  for (let i = 0; i < p.numRisers; i++) {
    const zFrom = p.padAboveGrade + i * p.actualRiserHeight;
    const zTo = p.padAboveGrade + (i + 1) * p.actualRiserHeight;
    const label = `${(zTo - zFrom).toFixed(2)}" R${i + 1}`;
    group.add(makeDimLine(
      [riserDimX, dimY, zFrom],
      [riserDimX, dimY, zTo],
      label,
      0x34d399
    ));
  }

  // Per-tread horizontal measurements (riser outer face to riser outer face)
  for (let i = 0; i < p.numTreads; i++) {
    const xFrom = i * p.treadDepth;
    const xTo = (i + 1) * p.treadDepth;
    const z = p.padAboveGrade + (i + 1) * p.actualRiserHeight + 2;
    const label = `${p.treadDepth}" T${i + 1}`;
    group.add(makeDimLine(
      [xFrom, dimY, z],
      [xTo, dimY, z],
      label,
      0x60a5fa
    ));
  }

  // Stair angle
  const angleLabel = `${p.stairAngle.toFixed(1)}°`;
  const angleSprite = makeTextSprite(angleLabel, '#fbbf24');
  angleSprite.position.set(p.totalRun * 0.15, dimY, p.totalHeight * 0.08);
  group.add(angleSprite);

  // Pad width
  const padCenterX = p.padDepth / 2;
  const padZ = -p.concreteBelow - p.gravelDepth - 3;
  group.add(makeDimLine(
    [padCenterX, sillY - p.padSideClearance, padZ],
    [padCenterX, sillY + p.topPostSpacing + p.padSideClearance, padZ],
    `${p.padWidth.toFixed(1)}" W`,
    0x94a3b8
  ));

  // Pad depth
  group.add(makeDimLine(
    [0, sillY + p.topPostSpacing + p.padSideClearance + 3, padZ],
    [p.padDepth, sillY + p.topPostSpacing + p.padSideClearance + 3, padZ],
    `${p.padDepth.toFixed(1)}" D`,
    0x94a3b8
  ));

  // Stair width
  group.add(makeDimLine(
    [p.totalRun / 2, sillY, p.totalHeight + 5],
    [p.totalRun / 2, sillY + p.topPostSpacing, p.totalHeight + 5],
    `${p.stairWidth}" width`,
    0xfbbf24
  ));

  // --- Stringer sub-measurements (shown on step 2 for clarity) ---
  const seatZ = p.padAboveGrade + p.sillPlateThickness;
  const drop = p.bottomDrop;
  const rise = p.actualRiserHeight;
  const run = p.treadDepth;
  const rb = p.riserBoardThickness;
  const subY = dimY - 6;  // further offset so they don't overlap main dims

  if (p.numTreads >= 2) {
    // Use step index 1 (second step) for measurements
    const si = 1;
    // Notch position in world coords
    const notchX = si * run;
    const notchZ = seatZ + (si + 1) * rise - drop;
    const prevNotchZ = seatZ + si * rise - drop;

    // Stringer tread cut depth (horizontal)
    const treadCut = run - rb;
    group.add(makeDimLine(
      [notchX + rb, subY, notchZ - 0.5],
      [notchX + treadCut + rb, subY, notchZ - 0.5],
      `${treadCut.toFixed(2)}" cut`,
      0xe67e22
    ));

    // Stringer riser cut height (vertical)
    group.add(makeDimLine(
      [notchX - 1, subY, prevNotchZ],
      [notchX - 1, subY, notchZ],
      `${rise.toFixed(2)}" rise cut`,
      0xe67e22
    ));

    // Riser board pocket (horizontal, the rb gap)
    group.add(makeDimLine(
      [notchX, subY, notchZ + 1],
      [notchX + rb, subY, notchZ + 1],
      `${rb}" rb`,
      0xe67e22
    ));
  }

  // Throat dimension (perpendicular to slope)
  const throatSprite = makeTextSprite(`${p.throat.toFixed(2)}" throat`, '#e67e22');
  // Position near the middle of the stringer body
  const midX = p.totalRun * 0.4;
  const midZ = seatZ + 2 * rise - drop - p.stringerStockWidth * 0.3;
  throatSprite.position.set(midX, subY, midZ);
  group.add(throatSprite);

  // Seat length
  const seatEndX = p.stringerStockWidth * rise / Math.sqrt(rise * rise + run * run);
  const seatLen = seatEndX;
  const seatLabelSprite = makeTextSprite(`${seatLen.toFixed(1)}" seat`, '#e67e22');
  seatLabelSprite.position.set(-seatLen / 2, subY, seatZ - 1);
  group.add(seatLabelSprite);

  // Stringer stock width (board width)
  const swSprite = makeTextSprite(`${p.stringerStockWidth}" 2x12`, '#e67e22');
  swSprite.position.set(p.totalRun * 0.6, subY, seatZ + 3 * rise - drop - p.stringerStockWidth * 0.6);
  group.add(swSprite);

  return group;
}

/**
 * Build the stringer 2D profile as a Three.js Shape.
 * XY plane: x = horizontal run, y = vertical height.
 * y=0 is the seat level (sill plate top). All notch positions relative to seat.
 * CCW winding for Three.js outer contour.
 */
function buildStringerShape(p) {
  const rise = p.actualRiserHeight;
  const run = p.treadDepth;
  const n = p.numTreads;
  const drop = p.bottomDrop;
  const sw = p.stringerStockWidth;
  const rb = p.riserBoardThickness;

  // Notch heights relative to seat (y=0):
  // First notch at y = rise - drop (shortened by drop)
  // Subsequent notches spaced by rise
  function notchY(i) { return (i + 1) * rise - drop; }

  // Top plumb cut
  const topTd = run - 2 * rb;  // top tread cut depth
  const topX = (n - 1) * run + topTd + rb;  // plumb cut x
  const topY = notchY(n - 1);  // top of sawtooth

  // Riser tops (highest points of sawtooth) = board top edge.
  // Riser tops lie on line through (0, rise-drop) with slope rise/run.
  // Bottom edge = sw perpendicular below.
  const hyp = Math.sqrt(rise * rise + run * run);
  const slopeRatio = rise / run;

  // Riser top line at x=0: y = rise - drop
  const topLineY0 = rise - drop;
  // Board bottom edge = tip line - sw perpendicular = tip line - sw*hyp/run vertical
  const boardVertical = sw * hyp / run;
  const botAtX0 = topLineY0 - boardVertical;
  const botAtTop = botAtX0 + topX * slopeRatio;

  const pts = [];

  // 1. Left plumb cut at x=0: from bottom edge up to seat (y=0)
  pts.push([0, botAtX0]);            // bottom of left plumb
  pts.push([0, 0]);                  // seat level (sill plate top)

  // 2. Sawtooth: left to right (ascending)
  for (let i = 0; i < n; i++) {
    const treadY = notchY(i);
    const riserX = i * run;
    const td = (i === n - 1) ? run - 2 * rb : run - rb;
    pts.push([riserX, treadY]);              // riser top
    pts.push([riserX + td, treadY]);         // tread right end
    if (i < n - 1) {
      pts.push([(i + 1) * run, treadY]);     // fill gap to next riser
    }
  }

  // 3. Top plumb cut
  pts.push([topX, topY]);       // top of plumb cut
  pts.push([topX, botAtTop]);   // bottom of plumb cut

  // Auto-close: board bottom edge back to seat

  // Create shape
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i][0], pts[i][1]);
  }
  return shape;
}
