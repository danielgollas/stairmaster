# Photorealistic Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat-color MeshPhongMaterial with procedural PBR textures (MeshStandardMaterial) for all structural components, making the 3D view look like real lumber, concrete, and metal.

**Architecture:** Create a `src/lib/materials.js` module that provides named PBR materials using Three.js procedural textures (CanvasTexture for wood grain, noise for concrete). The existing `makeMesh()` in `scene-builder.js` currently takes a hex color — we'll add a material-name path so callers can request a named material instead. A `renderMode` param (`'schematic'` | `'realistic'`) controls which path is used, so the user can toggle between the current flat look and PBR. We use MeshStandardMaterial + environment map for physically-based shading. No external image files — all textures are generated procedurally at startup.

**Tech Stack:** Three.js MeshStandardMaterial, CanvasTexture (procedural), PMREMGenerator (environment map for reflections)

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/materials.js` (create) | Procedural texture generators + named PBR material factory |
| `src/lib/scene-builder.js` (modify) | Accept `renderMode` param, use material names in `makeMesh()` |
| `src/components/Viewport.svelte` (modify) | Add environment map to scene, tone mapping on renderer |
| `src/App.svelte` (modify) | Add `renderMode` toggle, pass through `sceneParams` |

---

### Task 1: Material Factory Module

**Files:**
- Create: `src/lib/materials.js`

- [ ] **Step 1: Create the procedural wood grain texture generator**

```javascript
// src/lib/materials.js
import * as THREE from 'three';

/**
 * Generate a wood grain CanvasTexture.
 * @param {object} opts
 * @param {string} opts.baseColor - CSS color for the base tone (e.g. '#b87333')
 * @param {string} opts.grainColor - CSS color for the darker grain lines
 * @param {number} opts.grainDensity - Lines per 512px (default 40)
 * @param {number} opts.width - Texture width (default 512)
 * @param {number} opts.height - Texture height (default 512)
 * @returns {THREE.CanvasTexture}
 */
export function makeWoodTexture({
  baseColor = '#c4884d',
  grainColor = '#8b5e3c',
  grainDensity = 40,
  width = 512,
  height = 512,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Base fill
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  // Grain lines — slightly wavy horizontal lines
  ctx.strokeStyle = grainColor;
  ctx.globalAlpha = 0.3;
  const spacing = height / grainDensity;
  for (let i = 0; i < grainDensity; i++) {
    ctx.beginPath();
    const baseY = i * spacing + (Math.random() - 0.5) * spacing * 0.3;
    ctx.moveTo(0, baseY);
    for (let x = 0; x < width; x += 8) {
      const wobble = Math.sin(x * 0.02 + i) * 2 + (Math.random() - 0.5) * 1.5;
      ctx.lineTo(x, baseY + wobble);
    }
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.stroke();
  }

  // Knot spots (sparse)
  ctx.globalAlpha = 0.15;
  for (let k = 0; k < 3; k++) {
    const kx = Math.random() * width;
    const ky = Math.random() * height;
    const kr = 8 + Math.random() * 15;
    const grad = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
    grad.addColorStop(0, grainColor);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(kx - kr, ky - kr, kr * 2, kr * 2);
  }

  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Generate a concrete/gravel noise texture.
 */
export function makeConcreteTexture({
  baseColor = '#a0a0a0',
  noiseIntensity = 30,
  width = 256,
  height = 256,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * noiseIntensity;
    data[i] += noise;
    data[i + 1] += noise;
    data[i + 2] += noise;
  }
  ctx.putImageData(imgData, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Generate a brushed metal texture.
 */
export function makeMetalTexture({
  baseColor = '#888888',
  width = 256,
  height = 256,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);

  // Horizontal brush lines
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#ffffff';
  for (let y = 0; y < height; y += 2) {
    ctx.beginPath();
    ctx.moveTo(0, y + Math.random());
    ctx.lineTo(width, y + Math.random());
    ctx.lineWidth = 0.5 + Math.random();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
```

- [ ] **Step 2: Add the bump map generators and material cache**

Append to `src/lib/materials.js`:

```javascript
/**
 * Generate a simple bump map from a color texture by converting to grayscale.
 */
function makeBumpFromTexture(colorTex, strength = 0.5) {
  const src = colorTex.image;
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
    d[i] = d[i + 1] = d[i + 2] = gray;
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Material cache — lazily created, reused across rebuilds
let _cache = null;

/**
 * Get or create the full set of named PBR materials.
 * Returns a map: { materialName: THREE.MeshStandardMaterial }
 */
export function getMaterials() {
  if (_cache) return _cache;

  const ptWood = makeWoodTexture({ baseColor: '#b8863a', grainColor: '#7a5428' });
  const ptWoodBump = makeBumpFromTexture(ptWood);

  const deckWood = makeWoodTexture({ baseColor: '#9a6e30', grainColor: '#6b4c22', grainDensity: 35 });
  const deckWoodBump = makeBumpFromTexture(deckWood);

  const riserWood = makeWoodTexture({ baseColor: '#8b5a26', grainColor: '#5c3a18', grainDensity: 45 });

  const concreteTex = makeConcreteTexture({ baseColor: '#b0b0b0', noiseIntensity: 25 });
  const concreteBump = makeBumpFromTexture(concreteTex);

  const gravelTex = makeConcreteTexture({ baseColor: '#8a7550', noiseIntensity: 40 });

  const metalTex = makeMetalTexture({ baseColor: '#999999' });

  _cache = {
    stringer: new THREE.MeshStandardMaterial({
      map: ptWood, bumpMap: ptWoodBump, bumpScale: 0.3,
      roughness: 0.8, metalness: 0.0,
    }),
    sillPlate: new THREE.MeshStandardMaterial({
      map: ptWood, bumpMap: ptWoodBump, bumpScale: 0.3,
      roughness: 0.85, metalness: 0.0,
    }),
    post: new THREE.MeshStandardMaterial({
      map: ptWood, bumpMap: ptWoodBump, bumpScale: 0.25,
      roughness: 0.8, metalness: 0.0,
    }),
    blocking: new THREE.MeshStandardMaterial({
      map: ptWood, bumpMap: ptWoodBump, bumpScale: 0.2,
      roughness: 0.8, metalness: 0.0,
    }),
    decking: new THREE.MeshStandardMaterial({
      map: deckWood, bumpMap: deckWoodBump, bumpScale: 0.35,
      roughness: 0.75, metalness: 0.0,
    }),
    riser: new THREE.MeshStandardMaterial({
      map: riserWood, roughness: 0.8, metalness: 0.0,
    }),
    riserRip: new THREE.MeshStandardMaterial({
      map: riserWood, roughness: 0.8, metalness: 0.0,
    }),
    rimJoist: new THREE.MeshStandardMaterial({
      map: ptWood, bumpMap: ptWoodBump, bumpScale: 0.3,
      roughness: 0.8, metalness: 0.0,
    }),
    concrete: new THREE.MeshStandardMaterial({
      map: concreteTex, bumpMap: concreteBump, bumpScale: 0.4,
      roughness: 0.95, metalness: 0.0,
    }),
    gravel: new THREE.MeshStandardMaterial({
      map: gravelTex, roughness: 1.0, metalness: 0.0,
    }),
    hardware: new THREE.MeshStandardMaterial({
      map: metalTex, roughness: 0.4, metalness: 0.7,
      color: 0xcccccc,
    }),
    ground: new THREE.MeshStandardMaterial({
      color: 0x22c422, transparent: true, opacity: 0.2,
      roughness: 1.0, metalness: 0.0, side: THREE.DoubleSide,
    }),
  };

  return _cache;
}

/**
 * Dispose all cached materials and their textures.
 */
export function disposeMaterials() {
  if (!_cache) return;
  for (const mat of Object.values(_cache)) {
    if (mat.map) mat.map.dispose();
    if (mat.bumpMap) mat.bumpMap.dispose();
    mat.dispose();
  }
  _cache = null;
}
```

- [ ] **Step 3: Verify it loads without errors**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds (the module is importable but not yet used)

- [ ] **Step 4: Commit**

```bash
git add src/lib/materials.js
git commit -m "feat: add procedural PBR material factory for wood, concrete, metal"
```

---

### Task 2: Integrate Materials into Scene Builder

**Files:**
- Modify: `src/lib/scene-builder.js`

- [ ] **Step 1: Import materials and update makeMesh to accept a material name**

At the top of `src/lib/scene-builder.js`, add the import:

```javascript
import { getMaterials } from './materials.js';
```

Replace the existing `makeMesh` function:

```javascript
let _showEdges = false;
let _renderMode = 'schematic';

function makeMesh(geo, colorOrName, opacity = 1) {
  let mat;
  if (_renderMode === 'realistic' && typeof colorOrName === 'string') {
    const mats = getMaterials();
    mat = mats[colorOrName];
    if (!mat) {
      // Fallback to flat color if no named material exists
      mat = new THREE.MeshPhongMaterial({ color: 0x888888, flatShading: true });
    } else {
      mat = mat.clone(); // Clone so we can set per-mesh opacity
      if (opacity < 1) {
        mat.transparent = true;
        mat.opacity = opacity;
      }
    }
  } else {
    const color = typeof colorOrName === 'number' ? colorOrName : 0x888888;
    mat = new THREE.MeshPhongMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      flatShading: true,
    });
  }
  const mesh = new THREE.Mesh(geo, mat);
  if (_showEdges) {
    const edges = new THREE.EdgesGeometry(geo, 15);
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({
      color: 0x000000, transparent: true, opacity: 0.3,
    }));
    mesh.add(line);
  }
  return mesh;
}
```

Update `buildScene` to read `renderMode`:

```javascript
export function buildScene(p) {
  _showEdges = !!p.showEdges;
  _renderMode = p.renderMode || 'schematic';
  const meshes = {};
  // ...
```

- [ ] **Step 2: Replace color constants with material names throughout buildScene**

Change each `makeMesh(geo, COLORS.xxx)` call to `makeMesh(geo, _renderMode === 'realistic' ? 'materialName' : COLORS.xxx)`. To keep it DRY, add a helper:

```javascript
function colorOrMat(colorKey) {
  return _renderMode === 'realistic' ? colorKey : COLORS[colorKey];
}
```

Then replace calls like:
- `makeMesh(box(...), COLORS.gravel)` → `makeMesh(box(...), colorOrMat('gravel'))`
- `makeMesh(box(...), COLORS.concrete)` → `makeMesh(box(...), colorOrMat('concrete'))`
- `makeMesh(box(...), COLORS.sillPlate)` → `makeMesh(box(...), colorOrMat('sillPlate'))`
- `makeMesh(box(...), COLORS.post)` → `makeMesh(box(...), colorOrMat('post'))`
- `makeMesh(box(...), COLORS.hardware)` → `makeMesh(box(...), colorOrMat('hardware'))`
- `makeMesh(geo, COLORS.stringer)` → `makeMesh(geo, colorOrMat('stringer'))`
- `makeMesh(box(...), COLORS.blocking)` → `makeMesh(box(...), colorOrMat('blocking'))`
- `makeMesh(box(...), COLORS.decking)` → `makeMesh(box(...), colorOrMat('decking'))`
- `makeMesh(box(...), COLORS.riser)` → `makeMesh(box(...), colorOrMat('riser'))`
- `makeMesh(box(...), COLORS.riserRip)` → `makeMesh(box(...), colorOrMat('riserRip'))`
- `makeMesh(box(...), COLORS.rimJoist)` → `makeMesh(box(...), colorOrMat('rimJoist'))`

The ground plane and deck surface also need updating.

- [ ] **Step 3: Build and verify**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/scene-builder.js
git commit -m "feat: integrate PBR material names into scene builder with render mode switch"
```

---

### Task 3: Environment Map and Tone Mapping in Viewport

**Files:**
- Modify: `src/components/Viewport.svelte`

MeshStandardMaterial needs an environment map for realistic reflections, and the renderer needs tone mapping for proper HDR output.

- [ ] **Step 1: Add environment map generation and tone mapping**

In `Viewport.svelte`, update the `init()` function:

```javascript
import { PMREMGenerator } from 'three';
// (already importing * as THREE, so just use THREE.PMREMGenerator)

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, canvas, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0xd4e6f1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  scene = new THREE.Scene();

  // Generate a simple environment map from the scene lights
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();

  // Create a simple gradient environment
  const envScene = new THREE.Scene();
  envScene.add(new THREE.AmbientLight(0xffffff, 0.8));
  const envDir = new THREE.DirectionalLight(0xffffff, 1.0);
  envDir.position.set(50, 100, 50);
  envScene.add(envDir);
  // Sky-colored hemisphere
  envScene.background = new THREE.Color(0x87ceeb);
  const envMap = pmrem.fromScene(envScene, 0).texture;
  scene.environment = envMap;
  pmrem.dispose();

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(50, 100, 50);
  scene.add(dir);
  const fill = new THREE.DirectionalLight(0xffffff, 0.3);
  fill.position.set(-50, 50, -50);
  scene.add(fill);
  // ... rest of init unchanged
```

- [ ] **Step 2: Build and verify**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/components/Viewport.svelte
git commit -m "feat: add environment map and ACES tone mapping for PBR materials"
```

---

### Task 4: Render Mode Toggle in App

**Files:**
- Modify: `src/App.svelte`

- [ ] **Step 1: Add renderMode state and pass to sceneParams**

Add state variable near the other view state:

```javascript
let renderMode = $state('schematic');
```

Add `renderMode` to the `sceneParams` derived:

```javascript
let sceneParams = $derived({
  // ... existing params ...
  showEdges,
  renderMode,
});
```

- [ ] **Step 2: Add toggle button in the viewport toolbar**

Next to the Edges checkbox, add a render mode toggle:

```svelte
<div class="render-toggle">
  <button class:active={renderMode === 'schematic'} onclick={() => renderMode = 'schematic'}>Schematic</button>
  <button class:active={renderMode === 'realistic'} onclick={() => renderMode = 'realistic'}>Realistic</button>
</div>
```

Style it with the same `.view-toggle button` styles (it already covers this pattern).

- [ ] **Step 3: Build and test visually**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds

Run: `npx vite dev` and toggle between Schematic and Realistic modes in the browser.
Expected: Schematic shows flat colors (unchanged). Realistic shows wood grain on lumber, concrete texture on pad, metallic hardware.

- [ ] **Step 4: Commit**

```bash
git add src/App.svelte
git commit -m "feat: add schematic/realistic render mode toggle"
```

---

### Task 5: UV Coordinate Tuning

**Files:**
- Modify: `src/lib/scene-builder.js`

BoxGeometry auto-generates UV coordinates, but the procedural textures need to tile at the right scale so grain doesn't look stretched or tiled.

- [ ] **Step 1: Add a UV scaling helper**

After the `makeMesh` function in `scene-builder.js`:

```javascript
/**
 * Scale UV coordinates on a geometry so textures tile at a given world-space repeat.
 * @param {THREE.BufferGeometry} geo
 * @param {number} scaleU - world units per texture repeat in U
 * @param {number} scaleV - world units per texture repeat in V
 */
function scaleUVs(geo, scaleU, scaleV) {
  const uv = geo.getAttribute('uv');
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) {
    uv.setX(i, uv.getX(i) * scaleU);
    uv.setY(i, uv.getY(i) * scaleV);
  }
  uv.needsUpdate = true;
}
```

- [ ] **Step 2: Apply UV scaling to lumber components**

After creating each BoxGeometry for lumber (treads, risers, stringers, posts, blocking, sill plate, rim joist), call `scaleUVs` to make the wood grain tile at roughly 12" per repeat:

```javascript
// Example for tread boards:
const frontGeo = box(boardW, compWidth, p.deckingThickness);
scaleUVs(frontGeo, boardW / 12, compWidth / 12);
const front = makeMesh(frontGeo, colorOrMat('decking'));
```

Apply similar scaling for:
- Treads: `scaleUVs(geo, boardW / 12, compWidth / 12)`
- Risers: `scaleUVs(geo, riserBoardThickness / 6, compWidth / 12)`
- Posts: `scaleUVs(geo, ps / 6, ps / 6)`
- Sill plate: `scaleUVs(geo, sillDepth / 12, compWidth / 12)`
- Concrete pad: `scaleUVs(geo, padDepth / 24, padWidth / 24)`

- [ ] **Step 3: Build and verify**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/scene-builder.js
git commit -m "feat: scale UV coordinates for proper texture tiling on lumber and concrete"
```

---

### Task 6: Visual Polish and Fine-Tuning

**Files:**
- Modify: `src/lib/materials.js`
- Modify: `src/components/Viewport.svelte`

- [ ] **Step 1: Add shadow support to the renderer**

In `Viewport.svelte`, in `init()`:

```javascript
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

On the directional light:

```javascript
dir.castShadow = true;
dir.shadow.mapSize.width = 1024;
dir.shadow.mapSize.height = 1024;
dir.shadow.camera.near = 0.1;
dir.shadow.camera.far = 200;
dir.shadow.camera.left = -80;
dir.shadow.camera.right = 80;
dir.shadow.camera.top = 80;
dir.shadow.camera.bottom = -80;
```

- [ ] **Step 2: Enable castShadow/receiveShadow in makeMesh**

In `scene-builder.js`, add to `makeMesh()` just before the return:

```javascript
if (_renderMode === 'realistic') {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}
```

The ground plane should only receive shadows:

```javascript
ground.receiveShadow = true;
```

- [ ] **Step 3: Build and verify**

Run: `npx vite build 2>&1 | tail -5`
Expected: Build succeeds

Run `npx vite dev` in Realistic mode.
Expected: Shadows cast from stairs onto ground and between components. Wood grain visible on all lumber. Concrete has slight noise texture. Hardware has metallic sheen.

- [ ] **Step 4: Commit**

```bash
git add src/lib/materials.js src/lib/scene-builder.js src/components/Viewport.svelte
git commit -m "feat: add soft shadows and shadow casting for realistic render mode"
```
