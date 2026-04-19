import * as THREE from 'three';

// Texture catalog — grouped by category
export const TEXTURE_CATALOG = {
  wood: [
    { id: 'wood_142', name: 'Weathered Oak', file: 'Texturelabs_Wood_142M.jpg' },
    { id: 'wood_148', name: 'Dark Weathered', file: 'Texturelabs_Wood_148M.jpg' },
    { id: 'wood_149', name: 'Natural Pine', file: 'Texturelabs_Wood_149M.jpg' },
    { id: 'wood_150', name: 'Cedar Grain', file: 'Texturelabs_Wood_150M.jpg' },
    { id: 'wood_185', name: 'Dark Rustic', file: 'Texturelabs_Wood_185M.jpg' },
    { id: 'wood_189', name: 'Rich Dark', file: 'Texturelabs_Wood_189M.jpg' },
    { id: 'wood_197', name: 'Orange Cedar', file: 'Texturelabs_Wood_197M.jpg' },
    { id: 'wood_198', name: 'Rough Textured', file: 'Texturelabs_Wood_198M.jpg' },
    { id: 'wood_232', name: 'Rough Sawn', file: 'Texturelabs_Wood_232M.jpg' },
    { id: 'wood_252', name: 'Weathered Grey', file: 'Texturelabs_Wood_252M.jpg' },
    { id: 'wood_259', name: 'Medium Brown', file: 'Texturelabs_Wood_259M.jpg' },
    { id: 'wood_264', name: 'Warm Pine', file: 'Texturelabs_Wood_264M.jpg' },
  ],
  concrete: [
    { id: 'concrete_134', name: 'Fine Aggregate', file: 'Texturelabs_Concrete_134M.jpg' },
    { id: 'concrete_135', name: 'Fine Grey', file: 'Texturelabs_Concrete_135M.jpg' },
    { id: 'concrete_138', name: 'Rough Aggregate', file: 'Texturelabs_Concrete_138M.jpg' },
    { id: 'concrete_145', name: 'Smooth Grey', file: 'Texturelabs_Concrete_145M.jpg' },
    { id: 'concrete_149', name: 'Aged Patina', file: 'Texturelabs_Concrete_149M.jpg' },
    { id: 'concrete_183', name: 'Dark Textured', file: 'Texturelabs_Concrete_183M.jpg' },
    { id: 'concrete_184', name: 'Dark Rough', file: 'Texturelabs_Concrete_184M.jpg' },
    {
      id: 'brushed_concrete',
      name: 'Brushed Concrete',
      file: 'brushed_concrete_03_4k.blend/textures/brushed_concrete_03_diff_4k.jpg',
      normal: 'brushed_concrete_03_4k.blend/textures/brushed_concrete_03_nor_gl_4k.exr',
      displacement: 'brushed_concrete_03_4k.blend/textures/brushed_concrete_03_disp_4k.png',
      roughness: 'brushed_concrete_03_4k.blend/textures/brushed_concrete_03_rough_4k.exr',
    },
  ],
  gravel: [
    { id: 'soil_136', name: 'Soil/Gravel', file: 'Texturelabs_Soil_136M.jpg' },
    {
      id: 'gravel_stones',
      name: 'Gravel Stones',
      file: 'gravel_stones_4k.blend/textures/gravel_stones_diff_4k.jpg',
      normal: 'gravel_stones_4k.blend/textures/gravel_stones_nor_gl_4k.exr',
      displacement: 'gravel_stones_4k.blend/textures/gravel_stones_disp_4k.png',
      roughness: 'gravel_stones_4k.blend/textures/gravel_stones_rough_4k.exr',
    },
  ],
};

// Default material assignments
export const DEFAULT_MATERIALS = {
  stringers: 'wood_259',
  treads: 'wood_264',
  risers: 'wood_149',
  posts: 'wood_185',
  blocking: 'wood_259',
  sillPlate: 'wood_150',
  rimJoist: 'wood_259',
  railing: 'wood_142',
  deckSurface: 'wood_264',
  concrete: 'brushed_concrete',
  gravel: 'gravel_stones',
};

// Material groups for UI dropdowns
export const MATERIAL_GROUPS = [
  { key: 'stringers', label: 'Stringers', category: 'wood' },
  { key: 'treads', label: 'Treads', category: 'wood' },
  { key: 'risers', label: 'Risers', category: 'wood' },
  { key: 'posts', label: 'Posts', category: 'wood' },
  { key: 'sillPlate', label: 'Sill Plate', category: 'wood' },
  { key: 'rimJoist', label: 'Rim Joist', category: 'wood' },
  { key: 'railing', label: 'Railing', category: 'wood' },
  { key: 'deckSurface', label: 'Deck Surface', category: 'wood' },
  { key: 'concrete', label: 'Concrete Pad', category: 'concrete' },
  { key: 'gravel', label: 'Gravel', category: 'gravel' },
];

// Texture/material cache
const textureCache = new Map();
const materialCache = new Map();
const loader = new THREE.TextureLoader();

function getBasePath() {
  return import.meta.env.BASE_URL + 'materials/';
}

function loadTexture(file) {
  const key = file;
  if (textureCache.has(key)) return textureCache.get(key);

  const url = getBasePath() + file;
  const tex = loader.load(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, tex);
  return tex;
}

/**
 * Generate a normal map from a diffuse texture using a Sobel filter.
 * Returns a THREE.CanvasTexture. The texture must be fully loaded first,
 * so we attach it via onLoad.
 */
function generateNormalMap(sourceTex, strength = 2.0) {
  const key = `normal_${sourceTex.id || sourceTex.uuid}_${strength}`;
  if (textureCache.has(key)) return textureCache.get(key);

  const canvas = document.createElement('canvas');
  const placeholder = new THREE.CanvasTexture(canvas);
  placeholder.wrapS = THREE.RepeatWrapping;
  placeholder.wrapT = THREE.RepeatWrapping;
  textureCache.set(key, placeholder);

  // Wait for source to load, then compute
  const img = sourceTex.image;
  function compute(image) {
    const w = image.width || image.naturalWidth;
    const h = image.height || image.naturalHeight;
    if (!w || !h) return;

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0, w, h);
    const src = ctx.getImageData(0, 0, w, h);
    const dst = ctx.createImageData(w, h);

    function gray(x, y) {
      x = ((x % w) + w) % w;
      y = ((y % h) + h) % h;
      const i = (y * w + x) * 4;
      return (src.data[i] * 0.299 + src.data[i + 1] * 0.587 + src.data[i + 2] * 0.114) / 255;
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Sobel filter
        const tl = gray(x - 1, y - 1), t = gray(x, y - 1), tr = gray(x + 1, y - 1);
        const l = gray(x - 1, y), r = gray(x + 1, y);
        const bl = gray(x - 1, y + 1), b = gray(x, y + 1), br = gray(x + 1, y + 1);

        const dx = (tr + 2 * r + br - tl - 2 * l - bl) * strength;
        const dy = (bl + 2 * b + br - tl - 2 * t - tr) * strength;
        const dz = 1.0;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const i = (y * w + x) * 4;
        dst.data[i] = ((dx / len) * 0.5 + 0.5) * 255;
        dst.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
        dst.data[i + 2] = ((dz / len) * 0.5 + 0.5) * 255;
        dst.data[i + 3] = 255;
      }
    }
    ctx.putImageData(dst, 0, 0);
    placeholder.needsUpdate = true;
  }

  if (img && (img.complete || img.width)) {
    compute(img);
  } else {
    sourceTex.image = sourceTex.image || new Image();
    sourceTex.addEventListener?.('load', () => { if (sourceTex.image) compute(sourceTex.image); });
    // Also try onUpdate for Three.js texture loading
    const origOnUpdate = sourceTex.onUpdate;
    sourceTex.onUpdate = () => {
      if (origOnUpdate) origOnUpdate();
      if (sourceTex.image && sourceTex.image.width) compute(sourceTex.image);
    };
  }

  return placeholder;
}

/**
 * Apply texture settings (rotation, scale) to all textures on a material.
 */
function applyTextureSettings(mat, settings) {
  if (!settings) return;
  const rot = (settings.rotation || 0) * Math.PI / 180;
  const su = settings.scaleU || 1;
  const sv = settings.scaleV || 1;

  const textures = [mat.map, mat.normalMap, mat.roughnessMap, mat.bumpMap];
  for (const tex of textures) {
    if (!tex) continue;
    tex.rotation = rot;
    tex.center.set(0.5, 0.5); // rotate around center
    tex.repeat.set(su, sv);
    tex.needsUpdate = true;
  }
}

/**
 * Get a PBR MeshStandardMaterial for a texture catalog entry.
 * @param {string} textureId - texture ID from the catalog
 * @param {object} settings - { rotation, scaleU, scaleV, mapping }
 */
export function getTexturedMaterial(textureId, settings) {
  // Build a cache key that includes settings so different configs get different materials
  const settingsKey = settings
    ? `${textureId}_r${settings.rotation}_su${settings.scaleU}_sv${settings.scaleV}_m${settings.mapping}_b${settings.bumpScale}_rg${settings.roughness}_mt${settings.metalness}_ns${settings.normalScale}_ct${settings.colorTint}_em${settings.emissive}_op${settings.opacity}`
    : textureId;

  if (materialCache.has(settingsKey)) return materialCache.get(settingsKey).clone();

  // Find the entry in the catalog
  let entry = null;
  for (const cat of Object.values(TEXTURE_CATALOG)) {
    entry = cat.find(e => e.id === textureId);
    if (entry) break;
  }
  if (!entry) return null;

  const diffuse = loadTexture(entry.file);
  diffuse.colorSpace = THREE.SRGBColorSpace;

  const matParams = {
    map: diffuse,
    roughness: 0.8,
    metalness: 0.0,
  };

  // Normal map: use dedicated file if available (non-EXR), else generate from diffuse
  if (entry.normal && !entry.normal.endsWith('.exr')) {
    const normalTex = loadTexture(entry.normal);
    normalTex.colorSpace = THREE.LinearSRGBColorSpace;
    matParams.normalMap = normalTex;
    matParams.normalScale = new THREE.Vector2(1, 1);
  } else {
    // Auto-generate normal map from diffuse via Sobel filter
    matParams.normalMap = generateNormalMap(diffuse, 2.0);
    matParams.normalScale = new THREE.Vector2(1, 1);
  }

  // Roughness map (skip EXR)
  if (entry.roughness && !entry.roughness.endsWith('.exr')) {
    const roughTex = loadTexture(entry.roughness);
    roughTex.colorSpace = THREE.LinearSRGBColorSpace;
    matParams.roughnessMap = roughTex;
    matParams.roughness = 1.0;
  }

  // Displacement as bump (skip EXR)
  if (entry.displacement && !entry.displacement.endsWith('.exr')) {
    const bumpTex = loadTexture(entry.displacement);
    bumpTex.colorSpace = THREE.LinearSRGBColorSpace;
    matParams.bumpMap = bumpTex;
    matParams.bumpScale = 0.15;
  } else {
    // Auto-generate bump from diffuse (reuse same texture as grayscale bump)
    matParams.bumpMap = diffuse;
    matParams.bumpScale = 0.08;
  }

  // Apply material property overrides from settings
  if (settings) {
    if (settings.bumpScale !== undefined) matParams.bumpScale = settings.bumpScale;
    if (settings.roughness !== undefined) matParams.roughness = settings.roughness;
    if (settings.metalness !== undefined) matParams.metalness = settings.metalness;
    if (settings.normalScale !== undefined && matParams.normalMap) {
      matParams.normalScale = new THREE.Vector2(settings.normalScale, settings.normalScale);
    }
    if (settings.colorTint && settings.colorTint !== '#ffffff') {
      matParams.color = new THREE.Color(settings.colorTint);
    }
    if (settings.emissive && settings.emissive > 0) {
      matParams.emissive = new THREE.Color(0xffffff);
      matParams.emissiveIntensity = settings.emissive;
    }
    if (settings.opacity !== undefined && settings.opacity < 1) {
      matParams.transparent = true;
      matParams.opacity = settings.opacity;
    }
  }

  const mat = new THREE.MeshStandardMaterial(matParams);
  applyTextureSettings(mat, settings);
  materialCache.set(settingsKey, mat);
  return mat.clone();
}

/**
 * Dispose all cached textures and materials.
 */
export function disposeAllMaterials() {
  for (const mat of materialCache.values()) mat.dispose();
  for (const tex of textureCache.values()) tex.dispose();
  materialCache.clear();
  textureCache.clear();
}
