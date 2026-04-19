<script>
  import { DEFAULTS, MATERIALS } from './lib/constants.js';
  import { computeStairGeometry, computePadDimensions, computeStringerProfile } from './lib/calculations.js';
  import { checkIRC } from './lib/code-checks.js';
  import { generateScad } from './lib/scad-generator.js';
  import { DEFAULT_MATERIALS, MATERIAL_GROUPS } from './lib/materials.js';
  import { loadState, saveState } from './lib/persistence.js';
  import InputPanel from './components/InputPanel.svelte';
  import Viewport from './components/Viewport.svelte';
  import CutGuide from './components/CutGuide.svelte';
  import OutputPanel from './components/OutputPanel.svelte';

  // Default texture settings per role
  const defaultTextureSettings = {};
  for (const g of MATERIAL_GROUPS) {
    defaultTextureSettings[g.key] = {
      rotation: 0, scaleU: 1, scaleV: 1, mapping: 'uv',
      bumpScale: 0.08, roughness: 0.8, metalness: 0, normalScale: 1,
      colorTint: '#ffffff', emissive: 0, opacity: 1,
    };
  }

  // All persisted state with defaults
  const STATE_DEFAULTS = {
    totalHeight: 35,
    topPostSpacing: 36,
    riserHeight: DEFAULTS.riserHeight,
    treadDepth: DEFAULTS.treadDepth,
    stringerOC: DEFAULTS.stringerOC,
    stringerPosition: 'inside',
    deckingThickness: DEFAULTS.deckingThickness,
    riserBoardThickness: DEFAULTS.riserBoardThickness,
    rimJoistWidth: DEFAULTS.rimJoistWidth,
    sillPlateThickness: DEFAULTS.sillPlateThickness,
    padAboveGrade: DEFAULTS.padAboveGrade,
    concreteBelow: DEFAULTS.concreteBelow,
    gravelDepth: DEFAULTS.gravelDepth,
    padSideClearance: DEFAULTS.padSideClearance,
    padBackExtension: DEFAULTS.padBackExtension,
    postHeight: DEFAULTS.postHeight,
    postBase: DEFAULTS.postBase,
    tensionTie: DEFAULTS.tensionTie,
    stringerHanger: DEFAULTS.stringerHanger,
    viewMode: '3d',
    edgeMode: 'none',
    faceMode: 'white',
    aoMode: 'ssao',
    materialAssignments: { ...DEFAULT_MATERIALS },
    textureSettings: { ...defaultTextureSettings },
    aoParams: {
      ssao: { kernelRadius: 0.1, minDistance: 0.0001, maxDistance: 0.1 },
      sao: { intensity: 0.01, scale: 1, kernelRadius: 100, bias: 0.5, blurRadius: 8 },
      n8ao: { aoRadius: 0.11, distanceFalloff: 0.17, intensity: 15, aoSamples: 16, denoiseSamples: 18, denoiseRadius: 17 },
      aomap: { aoMapIntensity: 1.5 },
    },
    visibility: {
      blocking: true, boardOverlay: false, bottomPosts: true, concretePad: true, deckSurface: true, measureGrid: false,
      dimensions: true, grid: true, groundPlane: true, hogPanel: true, postBases: true,
      railingFrame: true, rimJoist: true, risers: true, sillPlate: true, stringerHangers: true,
      stringers: true, tensionTies: true, topPosts: true, treads: true,
    },
  };

  const saved = loadState(STATE_DEFAULTS);

  let totalHeight = $state(saved.totalHeight);
  let topPostSpacing = $state(saved.topPostSpacing);
  let riserHeight = $state(saved.riserHeight);
  let treadDepth = $state(saved.treadDepth);
  let stringerOC = $state(saved.stringerOC);
  let stringerPosition = $state(saved.stringerPosition);
  let deckingThickness = $state(saved.deckingThickness);
  let riserBoardThickness = $state(saved.riserBoardThickness);
  let rimJoistWidth = $state(saved.rimJoistWidth);
  let sillPlateThickness = $state(saved.sillPlateThickness);
  let padAboveGrade = $state(saved.padAboveGrade);
  let concreteBelow = $state(saved.concreteBelow);
  let gravelDepth = $state(saved.gravelDepth);
  let padSideClearance = $state(saved.padSideClearance);
  let padBackExtension = $state(saved.padBackExtension);
  let postHeight = $state(saved.postHeight);
  let postBase = $state(saved.postBase);
  let tensionTie = $state(saved.tensionTie);
  let stringerHanger = $state(saved.stringerHanger);
  let viewMode = $state(saved.viewMode);
  let edgeMode = $state(saved.edgeMode);
  let faceMode = $state(saved.faceMode);
  let aoMode = $state(saved.aoMode);
  let materialAssignments = $state(saved.materialAssignments);
  let textureSettings = $state(saved.textureSettings);
  let aoParams = $state(saved.aoParams);
  let visibility = $state(saved.visibility);

  // Persist all state on change — deep-serialize nested objects to trigger on inner changes
  $effect(() => {
    const snap = {
      totalHeight, topPostSpacing, riserHeight, treadDepth, stringerOC, stringerPosition,
      deckingThickness, riserBoardThickness, rimJoistWidth, sillPlateThickness,
      padAboveGrade, concreteBelow, gravelDepth, padSideClearance, padBackExtension,
      postHeight, postBase, tensionTie, stringerHanger,
      viewMode, edgeMode, faceMode, aoMode,
      materialAssignments: JSON.parse(JSON.stringify(materialAssignments)),
      textureSettings: JSON.parse(JSON.stringify(textureSettings)),
      aoParams: JSON.parse(JSON.stringify(aoParams)),
      visibility: JSON.parse(JSON.stringify(visibility)),
    };
    saveState(snap);
  });

  // Computed geometry
  let geometry = $derived(computeStairGeometry({
    totalHeight, topPostSpacing, riserHeight, treadDepth, stringerOC,
    deckingThickness, riserBoardThickness, rimJoistWidth, sillPlateThickness,
    padAboveGrade, stringerStockWidth: MATERIALS['2x12'].width,
    stringerStockThickness: MATERIALS['2x12'].thickness,
    stringerPosition, postSize: MATERIALS['4x4'].actual,
  }));

  let stringerProfile = $derived(computeStringerProfile({
    numTreads: geometry.numTreads,
    actualRiserHeight: geometry.actualRiserHeight,
    treadDepth, deckingThickness, riserBoardThickness,
    sillPlateThickness, padAboveGrade,
    stringerStockWidth: MATERIALS['2x12'].width,
  }));

  let padDims = $derived(computePadDimensions({
    topPostSpacing, padSideClearance, treadDepth,
    postSize: MATERIALS['4x4'].actual,
    seatCutLength: stringerProfile.seatCutLength,
    padAboveGrade, concreteBelow, gravelDepth,
    padBackExtension,
  }));

  let warnings = $derived(checkIRC({
    actualRiserHeight: geometry.actualRiserHeight,
    treadDepth,
    stairWidth: geometry.stairWidth,
    throat: geometry.throat,
    riserVariance: 0,
  }));

  // Params for scene building and .scad generation
  let sceneParams = $derived({
    totalHeight, topPostSpacing,
    numRisers: geometry.numRisers,
    actualRiserHeight: geometry.actualRiserHeight,
    numTreads: geometry.numTreads,
    treadDepth, totalRun: geometry.totalRun,
    stairAngle: geometry.stairAngle,
    stairWidth: geometry.stairWidth,
    numStringers: geometry.numStringers,
    actualOC: geometry.actualOC,
    outerStringerSpan: geometry.outerStringerSpan,
    effectiveWidth: geometry.effectiveWidth,
    stringerPosition,
    stringerOC, deckingThickness, riserBoardThickness,
    rimJoistWidth,
    stringerStockWidth: MATERIALS['2x12'].width,
    stringerStockThickness: MATERIALS['2x12'].thickness,
    sillPlateThickness, postSize: MATERIALS['4x4'].actual,
    padAboveGrade, concreteBelow, gravelDepth, padSideClearance,
    padWidth: padDims.padWidth, padDepth: padDims.padDepth,
    throat: geometry.throat,
    seatCutLength: stringerProfile.seatCutLength,
    bottomDrop: stringerProfile.bottomDrop,
    topTreadReduction: stringerProfile.topTreadReduction,
    postHeight,
    edgeMode,
    faceMode,
    aoMode,
    aoParams: aoParams[aoMode] || {},
    materialAssignments,
    textureSettings,
  });

  // .scad source for download (visibility-filtered)
  let downloadScadSource = $derived(generateScad(sceneParams, visibility));

  function downloadScad() {
    const blob = new Blob([downloadScadSource], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stairmaster.scad';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="app">
  <div class="panel left">
    <InputPanel
      bind:totalHeight bind:topPostSpacing
      bind:riserHeight bind:treadDepth bind:stringerOC bind:stringerPosition
      bind:deckingThickness bind:riserBoardThickness bind:rimJoistWidth
      bind:sillPlateThickness
      bind:padAboveGrade bind:concreteBelow bind:gravelDepth bind:padSideClearance bind:padBackExtension
      bind:postHeight bind:postBase bind:tensionTie bind:stringerHanger
      bind:visibility
      bind:edgeMode bind:faceMode bind:aoMode bind:aoParams bind:materialAssignments bind:textureSettings
    />
  </div>

  <div class="panel center">
    <div class="viewport-toolbar">
      <div class="view-toggle">
        <button class:active={viewMode === '3d'} onclick={() => viewMode = '3d'}>3D</button>
        <button class:active={viewMode === 'side'} onclick={() => viewMode = 'side'}>Side</button>
        <button class:active={viewMode === 'front'} onclick={() => viewMode = 'front'}>Front</button>
        <button class:active={viewMode === 'cut'} onclick={() => viewMode = 'cut'}>Cut Guide</button>
      </div>
      <div class="downloads">
        <button onclick={downloadScad}>⬇ .scad</button>
      </div>
    </div>
    {#if viewMode === 'cut'}
      <CutGuide {sceneParams} />
    {:else}
      <Viewport {sceneParams} {visibility} {viewMode} {faceMode} {aoMode} aoParams={aoParams[aoMode] || {}} />
    {/if}
  </div>

  <div class="panel right">
    <OutputPanel
      numRisers={geometry.numRisers}
      numTreads={geometry.numTreads}
      actualRiserHeight={geometry.actualRiserHeight}
      stairAngle={geometry.stairAngle}
      totalRun={geometry.totalRun}
      stringerLength={geometry.stringerLength}
      numStringers={geometry.numStringers}
      actualOC={geometry.actualOC}
      throat={geometry.throat}
      padWidth={padDims.padWidth}
      padDepth={padDims.padDepth}
      concreteThickness={padDims.concreteThickness}
      excavationDepth={padDims.excavationDepth}
      gravelCuFt={padDims.gravelCuFt}
      concreteCuFt={padDims.concreteCuFt}
      bags60lb={padDims.bags60lb}
      bags80lb={padDims.bags80lb}
      {warnings}
      {postBase}
      {tensionTie}
      {stringerHanger}
    />
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f172a;
    color: #e2e8f0;
  }
  .app {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }
  .panel {
    overflow-y: auto;
  }
  .left {
    width: 280px;
    flex-shrink: 0;
    border-right: 1px solid #1e293b;
  }
  .center {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .right {
    width: 260px;
    flex-shrink: 0;
    border-left: 1px solid #1e293b;
  }
  .viewport-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
  }
  .view-toggle {
    display: flex;
    gap: 4px;
  }
  .view-toggle button, .downloads button {
    padding: 4px 12px;
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.8em;
  }
  .view-toggle button.active {
    background: #60a5fa;
    color: #0f172a;
    font-weight: 600;
  }
  @media (max-width: 1024px) {
    .app { flex-direction: column; height: auto; }
    .left, .right { width: 100%; border: none; border-bottom: 1px solid #1e293b; }
    .center { min-height: 400px; }
  }
</style>
