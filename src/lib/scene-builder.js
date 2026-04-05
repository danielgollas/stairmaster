import * as THREE from 'three';

const COLORS = {
  concrete:  0xa6a6a6,
  gravel:    0x735a33,
  stringer:  0xd9a626,
  sillPlate: 0xb3801a,
  post:      0x996626,
  decking:   0x8c5a1a,
  riser:     0x804d14,
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

  // Gravel
  const gravelMesh = makeMesh(box(p.padDepth, p.padWidth, p.gravelDepth), COLORS.gravel);
  gravelMesh.position.set(p.padDepth / 2, padCenterY, -(p.concreteBelow + p.gravelDepth / 2));
  padGroup.add(gravelMesh);

  // Concrete
  const concreteH = p.concreteBelow + p.padAboveGrade;
  const concreteMesh = makeMesh(box(p.padDepth, p.padWidth, concreteH), COLORS.concrete);
  concreteMesh.position.set(p.padDepth / 2, padCenterY, -p.concreteBelow + concreteH / 2);
  padGroup.add(concreteMesh);

  meshes.concretePad = padGroup;

  // --- Sill plate ---
  const sillY = (p.stairWidth - p.topPostSpacing) / 2;
  const sillMesh = makeMesh(box(p.treadDepth, p.topPostSpacing, p.sillPlateThickness), COLORS.sillPlate);
  sillMesh.position.set(p.treadDepth / 2, sillY + p.topPostSpacing / 2, p.padAboveGrade + p.sillPlateThickness / 2);
  meshes.sillPlate = sillMesh;

  // --- Bottom posts ---
  const postGroup = new THREE.Group();
  const postBaseZ = p.padAboveGrade;
  const postH = p.postHeight;
  const ps = p.postSize;
  const leftPostY = sillY - ps;
  const rightPostY = sillY + p.topPostSpacing;

  const lPost = makeMesh(box(ps, ps, postH), COLORS.post);
  lPost.position.set(-ps / 2, leftPostY + ps / 2, postBaseZ + postH / 2);
  postGroup.add(lPost);

  const rPost = makeMesh(box(ps, ps, postH), COLORS.post);
  rPost.position.set(-ps / 2, rightPostY + ps / 2, postBaseZ + postH / 2);
  postGroup.add(rPost);

  meshes.bottomPosts = postGroup;

  // --- Post bases (schematic plates) ---
  const basesGroup = new THREE.Group();
  const plateH = 0.25;
  const plateSize = ps + 1;

  const lBase = makeMesh(box(plateSize, plateSize, plateH), COLORS.hardware);
  lBase.position.set(-ps / 2, leftPostY + ps / 2, postBaseZ - plateH / 2);
  basesGroup.add(lBase);

  const rBase = makeMesh(box(plateSize, plateSize, plateH), COLORS.hardware);
  rBase.position.set(-ps / 2, rightPostY + ps / 2, postBaseZ - plateH / 2);
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
    const y = sillY + i * p.stringerOC;
    const geo = baseGeo.clone();
    const mesh = makeMesh(geo, COLORS.stringer);
    // position.z = seatZ: first notch y=(rise-drop) maps to z = seatZ+rise-drop
    // = padAbove + sillPlate + rise - (decking+sillPlate) = padAbove + rise - decking
    // = correct tread bottom position
    mesh.position.set(0, y + p.stringerStockThickness, seatZ);
    stringerGroup.add(mesh);
  }

  meshes.stringers = stringerGroup;

  // --- Blocking ---
  const blockingGroup = new THREE.Group();
  // Blocking is 2x4 material: 1.5" thick x 3.5" tall, laid flat on sill plate
  const blockThickness = 1.5;  // 2x4 thickness
  const blockHeight = 3.5;     // 2x4 width (laid on edge)
  const blockZ = p.padAboveGrade + p.sillPlateThickness + blockHeight / 2;

  for (let i = 0; i < p.numStringers - 1; i++) {
    const yStart = sillY + i * p.stringerOC + p.stringerStockThickness;
    const blockLen = p.stringerOC - p.stringerStockThickness;
    const block = makeMesh(box(blockThickness, blockLen, blockHeight), COLORS.blocking);
    block.position.set(blockThickness / 2, yStart + blockLen / 2, blockZ);
    blockingGroup.add(block);
  }

  meshes.blocking = blockingGroup;

  // --- Tension ties ---
  const tiesGroup = new THREE.Group();
  const tieW = 0.25, tieD = 3, tieH = 6;
  const tieZ = p.padAboveGrade + p.sillPlateThickness + tieH / 2;

  const lTie = makeMesh(box(tieW, tieD, tieH), COLORS.hardware);
  lTie.position.set(tieW / 2, sillY + p.stringerStockThickness + tieD / 2, tieZ);
  tiesGroup.add(lTie);

  const rTie = makeMesh(box(tieW, tieD, tieH), COLORS.hardware);
  rTie.position.set(tieW / 2, sillY + p.topPostSpacing - p.stringerStockThickness - tieD / 2, tieZ);
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

    // Tread boards sit on the stringer tread cut, butt against this step's riser board,
    // and overhang the front edge to cover the top of the riser board below.
    const overhang = p.riserBoardThickness;
    const isTopTread = (i === p.numTreads - 1);
    // Top tread's back board is narrower — it butts against the rim joist (final riser)
    const backBoardW = isTopTread ? boardW - p.riserBoardThickness : boardW;

    const front = makeMesh(box(boardW, p.stairWidth, p.deckingThickness), COLORS.decking);
    front.position.set(x - overhang + boardW / 2, p.stairWidth / 2, nz + p.deckingThickness / 2);
    treadsGroup.add(front);

    const back = makeMesh(box(backBoardW, p.stairWidth, p.deckingThickness), COLORS.decking);
    back.position.set(x - overhang + boardW + gap + backBoardW / 2, p.stairWidth / 2, nz + p.deckingThickness / 2);
    treadsGroup.add(back);
  }

  meshes.treads = treadsGroup;

  // --- Risers ---
  const risersGroup = new THREE.Group();

  for (let i = 0; i < p.numTreads; i++) {
    // Riser sits ON the stringer tread of the step below, butting against
    // the tread boards on its own step. Positioned one riserBoardThickness
    // forward so its back face meets the tread board front edge.
    const riserX = i * p.treadDepth - p.riserBoardThickness;
    const riserBottom = (i > 0) ? notchZ(i - 1) : p.padAboveGrade;
    const riserTop = notchZ(i);
    const riserH = riserTop - riserBottom;

    // Riser boards are cut to fit BETWEEN stringers
    for (let s = 0; s < p.numStringers - 1; s++) {
      const yStart = sillY + s * p.stringerOC + p.stringerStockThickness;
      const segLen = p.stringerOC - p.stringerStockThickness;
      const riser = makeMesh(box(p.riserBoardThickness, segLen, riserH), COLORS.riser);
      riser.position.set(riserX + p.riserBoardThickness / 2, yStart + segLen / 2, riserBottom + riserH / 2);
      risersGroup.add(riser);
    }
  }

  meshes.risers = risersGroup;

  // --- Stringer hangers ---
  const hangersGroup = new THREE.Group();

  for (let i = 0; i < p.numStringers; i++) {
    const y = sillY + i * p.stringerOC;
    const hanger = makeMesh(box(1, p.stringerStockThickness, 4), COLORS.hardware);
    hanger.position.set(p.totalRun - 0.5, y + p.stringerStockThickness / 2, p.totalHeight - p.deckingThickness - p.rimJoistWidth + 2);
    hangersGroup.add(hanger);
  }

  meshes.stringerHangers = hangersGroup;

  // --- Rim joist ---
  const rimMesh = makeMesh(box(1.5, p.stairWidth, p.rimJoistWidth), COLORS.rimJoist);
  rimMesh.position.set(p.totalRun + 0.75, p.stairWidth / 2, p.totalHeight - p.deckingThickness - p.rimJoistWidth / 2);
  meshes.rimJoist = rimMesh;

  // --- Deck surface ---
  const deckMesh = makeMesh(box(24, p.stairWidth + 12, p.deckingThickness), COLORS.decking);
  deckMesh.position.set(p.totalRun + 12, p.stairWidth / 2, p.totalHeight - p.deckingThickness / 2);
  meshes.deckSurface = deckMesh;

  // --- Top posts ---
  const topPostsGroup = new THREE.Group();
  const topPostZ = p.totalHeight - p.deckingThickness;

  const tlPost = makeMesh(box(ps, ps, postH), COLORS.post);
  tlPost.position.set(p.totalRun + 1.5 + ps / 2, sillY - ps + ps / 2, topPostZ + postH / 2);
  topPostsGroup.add(tlPost);

  const trPost = makeMesh(box(ps, ps, postH), COLORS.post);
  trPost.position.set(p.totalRun + 1.5 + ps / 2, sillY + p.topPostSpacing + ps / 2, topPostZ + postH / 2);
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
    // Top tread is shorter — butts against rim joist (final riser)
    const isTopTread = (i === p.numTreads - 1);
    const td = isTopTread ? p.treadDepth - p.riserBoardThickness : p.treadDepth;
    const xTo = xFrom + td;
    const z = p.padAboveGrade + (i + 1) * p.actualRiserHeight + 2;
    const label = `${td}" T${i + 1}`;
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

  return group;
}

/**
 * Build the stringer 2D profile as a Three.js Shape.
 * XY plane: x = horizontal run, y = vertical height above seat.
 *
 * The shape is a sawtooth on top with the board's bottom edge below.
 * CCW winding for Three.js outer contour.
 */
function buildStringerShape(p) {
  const rise = p.actualRiserHeight;
  const run = p.treadDepth;
  const n = p.numTreads;
  const drop = p.bottomDrop;
  const sw = p.stringerStockWidth;
  const topReduce = p.topTreadReduction;

  // Board bottom edge: parallel to the stair slope, offset perpendicular by board width.
  // The slope line passes through the notch inside corners with slope rise/run.
  // Perpendicular offset: dx = -sw*rise/hyp, dy = -sw*run/hyp
  const hyp = Math.sqrt(rise * rise + run * run);
  const offX = sw * rise / hyp;
  const offY = sw * run / hyp;

  const topX = n * run;    // x at top plumb cut (rim joist face)
  const topY = n * rise - drop;  // y at top of sawtooth

  // Board bottom edge: line through (-offX, -drop-offY) with slope rise/run.
  // Compute where it intersects x=0 (seat plumb toe) and x=topX (top plumb cut).
  const slopeRatio = rise / run;
  const botAtSeat = (-drop - offY) + offX * slopeRatio;   // y at x=0
  const botAtTop = botAtSeat + topX * slopeRatio;          // y at x=topX

  // The seat bearing sits flush on the sill plate at y = -drop.
  // Nothing extends below the seat level.
  // Where does the board bottom edge meet y = -drop (seat level)?
  const seatEndX = (-drop - botAtSeat) / slopeRatio;  // x where bottom edge meets seat level

  const pts = [];

  // 1. Seat cut: board bottom meets seat level, then horizontal bearing to first riser
  pts.push([seatEndX, -drop]);               // board bottom meets seat level
  pts.push([0, -drop]);                      // seat bearing to first riser (horizontal)

  // 2. Sawtooth: left to right (ascending)
  // The stringer tread cut is shortened by riserBoardThickness — the riser board
  // fits in the gap between the vertical face and the tread cut start.
  // Tread boards overhang the front to cover the riser board.
  const rb = p.riserBoardThickness;
  for (let i = 0; i < n; i++) {
    const treadY = (i + 1) * rise - drop;
    const riserX = i * run;
    const td = (i === n - 1) ? run - topReduce : run - rb;
    pts.push([riserX, treadY]);              // riser top (vertical face)
    pts.push([riserX + td, treadY]);         // tread right end (shortened)
    // Fill the rb gap to the next riser face (stringer material remains here
    // as a ledge for the next riser board to sit against)
    if (i < n - 1) {
      pts.push([(i + 1) * run, treadY]);     // horizontal to next riser face
    }
  }

  // 3. Top plumb cut (vertical at x=topX)
  pts.push([topX, topY]);       // top of plumb cut
  pts.push([topX, botAtTop]);   // bottom of plumb cut

  // Auto-close: (topX, botAtTop) → (seatEndX, -drop) = board bottom edge

  // Create shape
  const shape = new THREE.Shape();
  shape.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) {
    shape.lineTo(pts[i][0], pts[i][1]);
  }
  return shape;
}
