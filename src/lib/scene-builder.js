import * as THREE from 'three';
import { getTexturedMaterial, getDebugMaterial } from './materials.js';

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
  railing:   0xc49a3c,
  hogPanel:  0x666666,
  ground:    0x22c422,
  grid:      0x4d4d4d,
};

let _edgeMode = 'none';
let _faceMode = 'color';
let _aoMode = 'off';
let _aoMapIntensity = 1.5;
let _materialAssignments = {};
let _textureSettings = {};


function makeAoMap(width = 64, height = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  const border = 4;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, width, border);
  ctx.fillRect(0, height - border, width, border);
  ctx.fillRect(0, 0, border, height);
  ctx.fillRect(width - border, 0, border, height);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  const cr = 8;
  ctx.fillRect(0, 0, cr, cr);
  ctx.fillRect(width - cr, 0, cr, cr);
  ctx.fillRect(0, height - cr, cr, cr);
  ctx.fillRect(width - cr, height - cr, cr, cr);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let _aoMapTex = null;

function makeMesh(geo, color, opacity = 1, role = null) {
  let mat;
  // Post-processing AO modes need MeshStandardMaterial for proper depth/normals
  const needsStandard = ['ssao', 'sao', 'n8ao'].includes(_aoMode);

  switch (_faceMode) {
    case 'xray':
      mat = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: 0.15,
        flatShading: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      break;
    case 'white':
      mat = needsStandard
        ? new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0, transparent: opacity < 1, opacity })
        : new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true, transparent: opacity < 1, opacity });
      break;
    case 'textured': {
      // Try to use a real texture if a role is assigned
      const texId = role && _materialAssignments[role];
      const texSettings = role && _textureSettings[role];
      if (texId) {
        // Apply projection mapping if not default UV
        if (texSettings && texSettings.mapping && texSettings.mapping !== 'uv') {
          geo.computeVertexNormals();
          projectUVs(geo, texSettings.mapping);
        }
        mat = getTexturedMaterial(texId, texSettings);
        if (mat) {
          if (opacity < 1) { mat.transparent = true; mat.opacity = opacity; }
          break;
        }
      }
      mat = new THREE.MeshStandardMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        roughness: 0.7,
        metalness: 0.0,
      });
      break;
    }
    case 'normals':
    case 'bump':
    case 'diffuse': {
      const texId = role && _materialAssignments[role];
      const texSettings = role && _textureSettings[role];
      if (texId) {
        if (texSettings && texSettings.mapping && texSettings.mapping !== 'uv') {
          geo.computeVertexNormals();
          projectUVs(geo, texSettings.mapping);
        }
        mat = getDebugMaterial(texId, _faceMode, texSettings);
        if (mat) break;
      }
      mat = new THREE.MeshBasicMaterial({ color: 0x888888 });
      break;
    }
    default: { // 'color'
      if (needsStandard) {
        mat = new THREE.MeshStandardMaterial({
          color,
          transparent: opacity < 1,
          opacity,
          roughness: 0.8,
          metalness: 0.0,
        });
      } else {
        mat = new THREE.MeshPhongMaterial({
          color,
          transparent: opacity < 1,
          opacity,
          flatShading: true,
        });
      }
    }
  }

  // Apply baked AO map if aoMode is 'aomap'
  if (_aoMode === 'aomap') {
    if (!_aoMapTex) _aoMapTex = makeAoMap();
    // Upgrade to StandardMaterial if needed, preserving existing color
    if (!mat.isMeshStandardMaterial) {
      const existingColor = mat.color ? mat.color.getHex() : color;
      mat = new THREE.MeshStandardMaterial({
        color: existingColor,
        transparent: opacity < 1,
        opacity,
        roughness: 0.8,
        metalness: 0.0,
      });
    }
    mat.aoMap = _aoMapTex;
    mat.aoMapIntensity = _aoMapIntensity;
  }

  const mesh = new THREE.Mesh(geo, mat);

  if (_edgeMode !== 'none') {
    const edges = new THREE.EdgesGeometry(geo, 15);
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x1a1a1a,
      depthTest: _edgeMode === 'visible',
    });
    const line = new THREE.LineSegments(edges, edgeMat);
    mesh.add(line);
  }
  return mesh;
}

function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

/**
 * Recompute UV coordinates based on a projection mode using world-space positions.
 * @param {THREE.BufferGeometry} geo - must have position attribute
 * @param {string} mode - 'box' | 'cylinder' | 'planar'
 */
function projectUVs(geo, mode) {
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  if (!pos) return;

  const uv = geo.getAttribute('uv') || new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.set(pos.getX(i), pos.getY(i), pos.getZ(i));
    let u2, v2;

    if (mode === 'box' && nor) {
      // Tri-planar: pick dominant axis from normal, project the other two
      n.set(Math.abs(nor.getX(i)), Math.abs(nor.getY(i)), Math.abs(nor.getZ(i)));
      if (n.x >= n.y && n.x >= n.z) {
        u2 = v.y; v2 = v.z; // YZ plane
      } else if (n.y >= n.x && n.y >= n.z) {
        u2 = v.x; v2 = v.z; // XZ plane
      } else {
        u2 = v.x; v2 = v.y; // XY plane
      }
    } else if (mode === 'cylinder') {
      // Cylinder around Z axis
      const angle = Math.atan2(v.y, v.x);
      u2 = angle / (2 * Math.PI) + 0.5;
      v2 = v.z;
    } else {
      // Planar XZ
      u2 = v.x;
      v2 = v.z;
    }
    uv.setXY(i, u2, v2);
  }
  uv.needsUpdate = true;
  geo.setAttribute('uv', uv);
}

/**
 * Scale and optionally rotate UV coordinates.
 * @param {THREE.BufferGeometry} geo
 * @param {number} scale - world units per texture repeat (e.g. 12 = one repeat per 12")
 * @param {number} angle - rotation in radians (applied before scaling)
 */
function scaleUVs(geo, scale = 12, angle = 0) {
  const uv = geo.getAttribute('uv');
  if (!uv) return;
  const f = 1 / scale;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  for (let i = 0; i < uv.count; i++) {
    let u = uv.getX(i);
    let v = uv.getY(i);
    if (angle !== 0) {
      const ru = u * cosA - v * sinA;
      const rv = u * sinA + v * cosA;
      u = ru;
      v = rv;
    }
    uv.setX(i, u * f);
    uv.setY(i, v * f);
  }
  uv.needsUpdate = true;
}

/**
 * Build all stair components as separate Three.js meshes.
 * Returns { componentName: THREE.Object3D }
 *
 * Coordinate system: X = horizontal run, Y = width, Z = height (up)
 */
export function buildScene(p) {
  _edgeMode = p.edgeMode || 'none';
  _faceMode = p.faceMode || 'color';
  _aoMode = p.aoMode || 'off';
  _aoMapIntensity = (p.aoParams && p.aoParams.aoMapIntensity) ?? 1.5;
  _materialAssignments = p.materialAssignments || {};
  _textureSettings = p.textureSettings || {};
  _aoMapTex = null;
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

  // --- Measure Grid (1" XZ grid for side view with numbers every 5") ---
  const measureGridGroup = new THREE.Group();
  {
    // Determine extent: front of pad to back of deck
    const topTdMG = p.treadDepth - 2 * p.riserBoardThickness;
    const rimXMG = (p.numTreads - 1) * p.treadDepth + topTdMG + p.riserBoardThickness;
    const padFrontMG = -p.riserBoardThickness - (p.seatCutLength + p.treadDepth) / 2 - p.padDepth / 2;
    const deckBackMG = rimXMG + 1.5 + 24;  // rim joist + deck
    const xMin = Math.floor(padFrontMG / 5) * 5 - 5;
    const xMax = Math.ceil(deckBackMG / 5) * 5 + 5;
    const zMin = Math.floor(-(p.concreteBelow + p.gravelDepth) / 5) * 5 - 5;
    const zMax = Math.ceil((p.totalHeight + 10) / 5) * 5 + 5;

    // Position grid at the front stringer Y (slightly in front for visibility)
    const gridY = -2;

    // 1" grid lines
    const thinMat = new THREE.LineBasicMaterial({ color: 0x999999, transparent: true, opacity: 0.15 });
    const thickMat = new THREE.LineBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.3 });

    const thinPts = [];
    const thickPts = [];

    // Vertical lines (constant x)
    for (let x = xMin; x <= xMax; x++) {
      const pts = (x % 5 === 0) ? thickPts : thinPts;
      pts.push(new THREE.Vector3(x, gridY, zMin), new THREE.Vector3(x, gridY, zMax));
    }
    // Horizontal lines (constant z)
    for (let z = zMin; z <= zMax; z++) {
      const pts = (z % 5 === 0) ? thickPts : thinPts;
      pts.push(new THREE.Vector3(xMin, gridY, z), new THREE.Vector3(xMax, gridY, z));
    }

    if (thinPts.length > 0) {
      const thinGeo = new THREE.BufferGeometry().setFromPoints(thinPts);
      measureGridGroup.add(new THREE.LineSegments(thinGeo, thinMat));
    }
    if (thickPts.length > 0) {
      const thickGeo = new THREE.BufferGeometry().setFromPoints(thickPts);
      measureGridGroup.add(new THREE.LineSegments(thickGeo, thickMat));
    }

    // Numbers every 5" on the edges
    for (let x = xMin; x <= xMax; x += 5) {
      const label = makeTextSprite(`${x}`, '#555555', 28);
      label.position.set(x, gridY, zMin - 1.5);
      label.scale.set(2, 1, 1);
      measureGridGroup.add(label);
    }
    for (let z = zMin; z <= zMax; z += 5) {
      const label = makeTextSprite(`${z}`, '#555555', 28);
      label.position.set(xMin - 2, gridY, z);
      label.scale.set(2, 1, 1);
      measureGridGroup.add(label);
    }
  }
  meshes.measureGrid = measureGridGroup;

  // --- Ground plane ---
  const groundGeo = new THREE.PlaneGeometry(p.totalRun + 72, p.stairWidth + 48);
  const groundMat = new THREE.MeshPhongMaterial({ color: COLORS.ground, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.set(p.totalRun / 2, p.stairWidth / 2, 0);
  meshes.groundPlane = ground;

  // --- Concrete pad ---
  const padGroup = new THREE.Group();
  const padCenterY = p.stairWidth / 2;

  // Pad front edge: one tread depth in front of sill plate start (landing "tread")
  const padShift = -p.riserBoardThickness;
  const basePadDepth = p.seatCutLength + p.treadDepth;  // base depth without extension
  const padFrontX = padShift - basePadDepth / 2;        // front stays fixed
  const padBackX = padFrontX + p.padDepth;               // back extends with padBackExtension
  const padCenterX = (padFrontX + padBackX) / 2;

  // Gravel
  const gravelMesh = makeMesh(box(p.padDepth, p.padWidth, p.gravelDepth), COLORS.gravel, 1, 'gravel');
  gravelMesh.position.set(padCenterX, padCenterY, -(p.concreteBelow + p.gravelDepth / 2));
  padGroup.add(gravelMesh);

  // Concrete
  const concreteH = p.concreteBelow + p.padAboveGrade;
  const concreteMesh = makeMesh(box(p.padDepth, p.padWidth, concreteH), COLORS.concrete, 1, 'concrete');
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
  // Sill plate extends from padShift to the stringer heel (seatEndX)
  const riseC = p.actualRiserHeight;
  const runC = p.treadDepth;
  const hypC = Math.sqrt(riseC * riseC + runC * runC);
  const slopeC = riseC / runC;
  const topLineC = riseC - p.bottomDrop;
  const boardVertC = p.stringerStockWidth * hypC / runC;
  const botAtX0C = topLineC - boardVertC;
  const seatEndXC = -botAtX0C / slopeC;  // where bottom edge meets y=0 (stringer heel)
  // Sill left edge at padShift, right edge at seatEndXC
  const sillDepth = seatEndXC - padShift;
  const sillMesh = makeMesh(box(sillDepth, compWidth, p.sillPlateThickness), COLORS.sillPlate, 1, 'sillPlate');
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
  const lPost = makeMesh(box(ps, ps, postH), COLORS.post, 1, 'posts');
  lPost.position.set(postX, leftPostY + ps / 2, postBaseZ + postH / 2);
  postGroup.add(lPost);

  const rPost = makeMesh(box(ps, ps, postH), COLORS.post, 1, 'posts');
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
  const stairAngleRad = Math.atan2(p.actualRiserHeight, p.treadDepth);
  scaleUVs(baseGeo, 12, stairAngleRad);
  baseGeo.rotateX(Math.PI / 2);

  const seatZ = p.padAboveGrade + p.sillPlateThickness;

  for (let i = 0; i < p.numStringers; i++) {
    const y = firstStringerY + i * p.actualOC;
    const geo = baseGeo.clone();
    const mesh = makeMesh(geo, COLORS.stringer, 1, 'stringers');
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
    scaleUVs(boardGeo, 12, stairAngleRad);
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
    const block = makeMesh(box(blockThickness, blockLen, blockHeight), COLORS.blocking, 1, 'blocking');
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

    const front = makeMesh(box(boardW, compWidth, p.deckingThickness), COLORS.decking, 1, 'treads');
    front.position.set(treadStart + boardW / 2, compCenterY, nz + p.deckingThickness / 2);
    treadsGroup.add(front);

    const back = makeMesh(box(boardW, compWidth, p.deckingThickness), COLORS.decking, 1, 'treads');
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
    const fullBoard = makeMesh(box(p.riserBoardThickness, compWidth, Math.min(fullBoardH, riserH)), COLORS.riser, 1, 'risers');
    fullBoard.position.set(riserX + p.riserBoardThickness / 2, compCenterY, riserBottom + Math.min(fullBoardH, riserH) / 2);
    risersGroup.add(fullBoard);

    // Top piece: ripped 2x6 to fill remaining height
    if (ripH > 0.01) {
      const ripBoard = makeMesh(box(p.riserBoardThickness, compWidth, ripH), COLORS.riserRip, 1, 'risers');
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
  const rimMesh = makeMesh(box(1.5, compWidth, p.rimJoistWidth), COLORS.rimJoist, 1, 'rimJoist');
  rimMesh.position.set(rimX + 0.75, compCenterY, p.totalHeight - p.deckingThickness - p.rimJoistWidth / 2);
  meshes.rimJoist = rimMesh;

  // --- Deck surface ---
  // Deck boards are flush with the rim joist front face, extending back over the rim joist
  const deckMesh = makeMesh(box(24, p.stairWidth + 12, p.deckingThickness), COLORS.decking, 1, 'deckSurface');
  deckMesh.position.set(rimX + 12, p.stairWidth / 2, p.totalHeight - p.deckingThickness / 2);
  meshes.deckSurface = deckMesh;

  // --- Top posts ---
  // Top posts rise from the deck surface (top of decking), same height as bottom posts
  // from their walking surface. This keeps the rails parallel to the stringer slope.
  const topPostsGroup = new THREE.Group();
  const topPostZ = p.totalHeight;  // deck surface = top of decking

  const tlPost = makeMesh(box(ps, ps, postH), COLORS.post, 1, 'posts');
  tlPost.position.set(rimX + 1.5 + ps / 2, sillY - ps + ps / 2, topPostZ + postH / 2);
  topPostsGroup.add(tlPost);

  const trPost = makeMesh(box(ps, ps, postH), COLORS.post, 1, 'posts');
  trPost.position.set(rimX + 1.5 + ps / 2, sillY + p.topPostSpacing + ps / 2, topPostZ + postH / 2);
  topPostsGroup.add(trPost);

  meshes.topPosts = topPostsGroup;

  // --- Railing frame & hog panel ---
  // 2x4 frame: wide face (3.5") toward inside/outside, narrow face (1.5") up/down
  // Each rail is a Shape in XZ (side view) extruded along Y for width
  const railGroup = new THREE.Group();
  const hogGroup = new THREE.Group();
  {
    const rFace = 3.5;  // 2x4 wide face (faces inside/outside = Y depth)
    const rNarrow = 1.5; // 2x4 narrow face (up/down = Z height)
    const botInset = 3; // bottom rail 3" above post base
    const vInset = 3.5; // vertical members 3.5" from posts

    // Post positions
    const bpZ = p.padAboveGrade;          // bottom post base Z
    const bpTopZ = bpZ + postH;           // bottom post top Z
    const tpX = rimX + 1.5 + ps / 2;     // top post center X
    const tpZ = topPostZ;                 // top post base Z
    const tpTopZ = tpZ + postH;           // top post top Z

    // Inner faces of posts (the faces that face each other)
    const bpInnerX = postX + ps / 2;     // bottom post inner face
    const tpInnerX = tpX - ps / 2;       // top post inner face

    // Rail slope = stringer slope (rise/run per step) so rails are parallel to stringers
    const railSlope = p.actualRiserHeight / p.treadDepth;

    // Perpendicular board width = rFace (3.5"). On a slope, the vertical span is larger.
    // Perpendicular dist = verticalSpan / sqrt(1 + slope²), so:
    const railHyp = Math.sqrt(1 + railSlope * railSlope);
    const halfPerp = rFace / 2 * railHyp; // half the vertical span for rFace perpendicular

    // Top rail: top edge flush with bottom post top at the inner face
    // topEdge(x) = bpTopZ + (x - bpInnerX) * railSlope
    function topRailCenter(x) { return bpTopZ + (x - bpInnerX) * railSlope - halfPerp; }

    // Bottom rail: must clear the tread noses by 3.5"
    // Tread nose positions: each tread's top surface is at padAbove + (i+1)*rise
    // The nose X = i * treadDepth - riserBoardThickness (front overhang)
    // Find the tread nose that's closest to (or above) the rail slope line
    // and set the bottom rail so its bottom edge is 3.5" above the highest nose
    // relative to the slope line.
    const noseClearance = 3.5;
    let maxNoseZ = bpZ; // fallback
    for (let i = 0; i < p.numTreads; i++) {
      const noseX = i * p.treadDepth - p.riserBoardThickness;
      const noseZ = p.padAboveGrade + (i + 1) * p.actualRiserHeight;
      // Only consider noses within the rail span
      if (noseX >= bpInnerX && noseX <= tpInnerX) {
        // The rail bottom edge at this X would be at some Z.
        // We need: railBottomEdge(noseX) >= noseZ + noseClearance
        // railBottomEdge(x) = botRailBaseZ + (x - bpInnerX) * railSlope
        // We want the highest required botRailBaseZ across all noses:
        // botRailBaseZ >= noseZ + noseClearance - (noseX - bpInnerX) * railSlope
        const required = noseZ + noseClearance - (noseX - bpInnerX) * railSlope;
        maxNoseZ = Math.max(maxNoseZ, required);
      }
    }
    // botRailCenter: bottom edge at bpInnerX = maxNoseZ, center = maxNoseZ + halfPerp
    function botRailCenter(x) { return maxNoseZ + halfPerp + (x - bpInnerX) * railSlope; }

    // Helper: make an angled rail with vertical plumb cuts at post faces
    // The rail is angled, posts are vertical. At x=xCut, the rail cross-section
    // spans from centerZ - rFace/2 to centerZ + rFace/2. The cut is vertical (plumb).
    // Shape: 6-point polygon (bottom-left, bottom-right, top-right, top-left with
    // top/bottom edges following the slope, left/right edges vertical at post faces)
    function makeRail(xLeft, xRight, centerZfn, yCenter) {
      const zBotL = centerZfn(xLeft) - halfPerp;
      const zTopL = centerZfn(xLeft) + halfPerp;
      const zBotR = centerZfn(xRight) - halfPerp;
      const zTopR = centerZfn(xRight) + halfPerp;
      const shape = new THREE.Shape();
      shape.moveTo(xLeft, zBotL);   // bottom-left
      shape.lineTo(xRight, zBotR);  // bottom-right
      shape.lineTo(xRight, zTopR);  // top-right (plumb cut)
      shape.lineTo(xLeft, zTopL);   // top-left (plumb cut)
      const geo = new THREE.ExtrudeGeometry(shape, { depth: rNarrow, bevelEnabled: false });
      scaleUVs(geo, 12, Math.atan(railSlope));
      geo.rotateX(Math.PI / 2);
      const mesh = makeMesh(geo, COLORS.railing, 1, 'railing');
      mesh.position.set(0, yCenter + rNarrow / 2, 0);
      return mesh;
    }

    // Rails run from inner face to inner face (flush with posts)
    const railXLeft = bpInnerX;
    const railXRight = tpInnerX;

    // Slope shorthand for vertical member / hog panel calculations
    const slope = railSlope;

    // Center Z functions already defined: topRailCenter(x), botRailCenter(x)
    // Shorthand for vertical/hog calculations at specific x
    const topZ0 = topRailCenter(railXLeft);
    const botZ0 = botRailCenter(railXLeft);

    // Side Y positions (post center Y values)
    const sideYs = [
      leftPostY + ps / 2,   // left post center
      rightPostY + ps / 2,  // right post center
    ];

    for (const yc of sideYs) {
      // Top rail — flush with post inner faces
      railGroup.add(makeRail(railXLeft, railXRight, topRailCenter, yc));
      // Bottom rail — flush with post inner faces
      railGroup.add(makeRail(railXLeft, railXRight, botRailCenter, yc));

      // Vertical members: 2x4, rFace (3.5") facing in/out, rNarrow (1.5") in X
      // Angled cuts at top and bottom matching rail slope
      // The top cut meets the bottom of the top rail, bottom cut meets top of bottom rail.
      // At the cut, the rail has slope = railSlope. The vertical member's top/bottom
      // edges are angled cuts: left edge at x-rNarrow/2, right edge at x+rNarrow/2,
      // Z varies by rNarrow/2 * slope across the width.

      function makeVertical(vx, yCenter) {
        const halfW = rFace / 2; // 3.5" wide in X (wide face visible from side)
        // Z at left and right edges of the vertical member
        const zBotL = botRailCenter(vx - halfW) + halfPerp;
        const zBotR = botRailCenter(vx + halfW) + halfPerp;
        const zTopL = topRailCenter(vx - halfW) - halfPerp;
        const zTopR = topRailCenter(vx + halfW) - halfPerp;

        // Shape in XZ with rFace (3.5") in X, extruded rNarrow (1.5") in Y
        const shape = new THREE.Shape();
        shape.moveTo(vx - halfW, zBotL);
        shape.lineTo(vx + halfW, zBotR);
        shape.lineTo(vx + halfW, zTopR);
        shape.lineTo(vx - halfW, zTopL);
        const geo = new THREE.ExtrudeGeometry(shape, { depth: rNarrow, bevelEnabled: false });
        scaleUVs(geo, 12, Math.PI / 2);
        geo.rotateX(Math.PI / 2);
        const mesh = makeMesh(geo, COLORS.railing, 1, 'railing');
        mesh.position.set(0, yCenter + rNarrow / 2, 0);
        return mesh;
      }

      // Near bottom post: vInset from inner face
      const v1x = railXLeft + vInset;
      const v1zBot = botRailCenter(v1x) + halfPerp;
      const v1zTop = topRailCenter(v1x) - halfPerp;
      if (v1zTop > v1zBot) {
        railGroup.add(makeVertical(v1x, yc));
      }

      // Near top post: vInset from inner face
      const v2x = railXRight - vInset;
      const v2zBot = botRailCenter(v2x) + halfPerp;
      const v2zTop = topRailCenter(v2x) - halfPerp;
      if (v2zTop > v2zBot) {
        railGroup.add(makeVertical(v2x, yc));
      }

      // --- Hog panel: 1/8" wire, 4" grid, horizontal+vertical, clipped to frame ---
      const gridSp = 4;
      const wireY = yc; // post center

      // Inner frame edges (inside vertical members)
      const fxMin = v1x + rNarrow / 2;
      const fxMax = v2x - rNarrow / 2;
      // botEdge(x) = top of bottom rail at x
      // topEdge(x) = bottom of top rail at x
      // Both increase with x (positive slope)
      function botEdge(x) { return botRailCenter(x) + halfPerp; }
      function topEdge(x) { return topRailCenter(x) - halfPerp; }

      const wireR = 0.0625; // 1/8" diameter = 1/16" radius
      const wireMat = new THREE.MeshPhongMaterial({ color: COLORS.hogPanel });

      function addWire(x1, y1, z1, x2, y2, z2) {
        const dx = x2 - x1, dy = y2 - y1, dz = z2 - z1;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 0.1) return;
        const geo = new THREE.CylinderGeometry(wireR, wireR, len, 4, 1);
        geo.rotateX(Math.PI / 2);
        const mesh = new THREE.Mesh(geo, wireMat);
        mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
        const dir = new THREE.Vector3(dx, dy, dz).normalize();
        const up = new THREE.Vector3(0, 0, 1);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
        mesh.setRotationFromQuaternion(quat);
        hogGroup.add(mesh);
      }

      // Horizontal wires (z = constant, clipped to frame x range at that z)
      // Wire at height z is valid where: botEdge(x) <= z AND topEdge(x) >= z
      // botEdge(x) <= z  →  x <= (z - botEdge_at_0) / slope  →  x <= xBotLimit
      // topEdge(x) >= z  →  x <= (z - topEdge_at_0) / slope  →  x <= xTopLimit (if slope > 0... wait)
      // Actually: topEdge(x) >= z means the top rail bottom is above z.
      // topEdge increases with x (slope>0), so topEdge(x) >= z for x >= xTopLimit
      // botEdge(x) <= z means bottom rail top is below z.
      // botEdge increases with x, so botEdge(x) <= z for x <= xBotLimit
      // Valid range: x >= xTopLimit AND x <= xBotLimit
      const zLow = Math.min(botEdge(fxMin), botEdge(fxMax));
      const zHigh = Math.max(topEdge(fxMin), topEdge(fxMax));
      const zFirst = Math.ceil(zLow / gridSp) * gridSp;
      for (let z = zFirst; z <= zHigh; z += gridSp) {
        // Where does botEdge(x) = z? x = (z - botConst) / slope
        // botEdge(x) = maxNoseZ + 2*halfPerp + (x - bpInnerX) * slope
        const xBotCross = (z - maxNoseZ - 2 * halfPerp) / slope + bpInnerX;
        // Where does topEdge(x) = z? x = (z - topConst) / slope
        // topEdge(x) = bpTopZ - 2*halfPerp + (x - bpInnerX) * slope
        const xTopCross = (z - bpTopZ + 2 * halfPerp) / slope + bpInnerX;

        // Valid: botEdge(x) <= z → x <= xBotCross (rail hasn't risen above z yet)
        //        topEdge(x) >= z → x >= xTopCross (rail bottom is above z)
        const xa = Math.max(fxMin, xTopCross);
        const xb = Math.min(fxMax, xBotCross);
        if (xa < xb) {
          addWire(xa, wireY, z, xb, wireY, z);
        }
      }

      // Vertical wires (x = constant, clipped to frame z range at that x)
      const xFirst = Math.ceil(fxMin / gridSp) * gridSp;
      for (let x = xFirst; x <= fxMax; x += gridSp) {
        const zBot = botEdge(x);
        const zTop = topEdge(x);
        if (zBot < zTop) {
          addWire(x, wireY, zBot, x, wireY, zTop);
        }
      }
    }
  }
  meshes.railingFrame = railGroup;
  meshes.hogPanel = hogGroup;

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
  ctx.font = `300 ${fontSize}px sans-serif`;
  const metrics = ctx.measureText(text);
  const w = metrics.width + 16;
  const h = fontSize + 12;
  canvas.width = w;
  canvas.height = h;

  ctx.font = `300 ${fontSize}px sans-serif`;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
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

  // Per-riser height labels positioned next to each riser
  for (let i = 0; i < p.numRisers; i++) {
    const zFrom = p.padAboveGrade + i * p.actualRiserHeight;
    const zTo = p.padAboveGrade + (i + 1) * p.actualRiserHeight;
    const riserX = i * p.treadDepth - 3; // just in front of each riser
    const label = `${(zTo - zFrom).toFixed(2)}"`;
    group.add(makeDimLine(
      [riserX, dimY, zFrom],
      [riserX, dimY, zTo],
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

  // Where does the bottom edge meet y=0 (seat/sill plate level)?
  // botEdge(x) = botAtX0 + x * slopeRatio = 0  →  x = -botAtX0 / slopeRatio
  const seatEndX = -botAtX0 / slopeRatio;

  const pts = [];

  // 1. Seat cut: bottom edge meets sill plate level, horizontal to x=0
  pts.push([seatEndX, 0]);           // bottom edge meets seat level
  pts.push([0, 0]);                  // seat bearing to first riser

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
