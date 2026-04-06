<script>
  import { DEFAULTS, MATERIALS } from './lib/constants.js';
  import { computeStairGeometry, computePadDimensions, computeStringerProfile } from './lib/calculations.js';
  import { checkIRC } from './lib/code-checks.js';
  import { generateScad } from './lib/scad-generator.js';
  import InputPanel from './components/InputPanel.svelte';
  import Viewport from './components/Viewport.svelte';
  import OutputPanel from './components/OutputPanel.svelte';

  // Reactive input state
  let totalHeight = $state(35);
  let topPostSpacing = $state(36);
  let riserHeight = $state(DEFAULTS.riserHeight);
  let treadDepth = $state(DEFAULTS.treadDepth);
  let stringerOC = $state(DEFAULTS.stringerOC);
  let stringerPosition = $state('inside');
  let deckingThickness = $state(DEFAULTS.deckingThickness);
  let riserBoardThickness = $state(DEFAULTS.riserBoardThickness);
  let rimJoistWidth = $state(DEFAULTS.rimJoistWidth);
  let sillPlateThickness = $state(DEFAULTS.sillPlateThickness);
  let padAboveGrade = $state(DEFAULTS.padAboveGrade);
  let concreteBelow = $state(DEFAULTS.concreteBelow);
  let gravelDepth = $state(DEFAULTS.gravelDepth);
  let padSideClearance = $state(DEFAULTS.padSideClearance);
  let padBackExtension = $state(DEFAULTS.padBackExtension);

  let postBase = $state(DEFAULTS.postBase);
  let tensionTie = $state(DEFAULTS.tensionTie);
  let stringerHanger = $state(DEFAULTS.stringerHanger);

  let viewMode = $state('side');

  // Visibility toggles (alphabetical, persisted to localStorage)
  const defaultVisibility = {
    blocking: true, boardOverlay: false, bottomPosts: true, concretePad: true, deckSurface: true,
    dimensions: true, grid: true, groundPlane: true, postBases: true,
    rimJoist: true, risers: true, sillPlate: true, stringerHangers: true,
    stringers: true, tensionTies: true, topPosts: true, treads: true,
  };
  function loadVisibility() {
    try {
      const saved = localStorage.getItem('stairmaster-visibility');
      if (saved) return { ...defaultVisibility, ...JSON.parse(saved) };
    } catch {}
    return { ...defaultVisibility };
  }
  let visibility = $state(loadVisibility());
  $effect(() => {
    const vis = { ...visibility };
    try { localStorage.setItem('stairmaster-visibility', JSON.stringify(vis)); } catch {}
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
    postHeight: 42,
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
      bind:postBase bind:tensionTie bind:stringerHanger
    />
  </div>

  <div class="panel center">
    <div class="viewport-toolbar">
      <div class="view-toggle">
        <button class:active={viewMode === '3d'} onclick={() => viewMode = '3d'}>3D</button>
        <button class:active={viewMode === 'side'} onclick={() => viewMode = 'side'}>Side</button>
        <button class:active={viewMode === 'front'} onclick={() => viewMode = 'front'}>Front</button>
      </div>
      <div class="downloads">
        <button onclick={downloadScad}>⬇ .scad</button>
      </div>
    </div>
    <div class="visibility-bar">
      <div class="vis-buttons">
        <button onclick={() => { for (const k in visibility) visibility[k] = true; }}>All</button>
        <button onclick={() => { for (const k in visibility) visibility[k] = false; }}>None</button>
        <button onclick={() => { for (const k in visibility) visibility[k] = !visibility[k]; }}>Invert</button>
      </div>
      {#each Object.keys(visibility).sort() as key}
        <label class="vis-toggle">
          <input type="checkbox" bind:checked={visibility[key]} />
          <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
        </label>
      {/each}
    </div>
    <Viewport {sceneParams} {visibility} {viewMode} />
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
  .visibility-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    padding: 6px 12px;
    background: #0f172a;
    border-bottom: 1px solid #334155;
    font-size: 0.75em;
  }
  .vis-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    color: #94a3b8;
    cursor: pointer;
    text-transform: capitalize;
  }
  .vis-toggle input[type="checkbox"] {
    accent-color: #60a5fa;
    margin: 0;
  }
  .vis-buttons {
    display: flex;
    gap: 4px;
    margin-right: 8px;
  }
  .vis-buttons button {
    padding: 2px 8px;
    background: #334155;
    border: none;
    border-radius: 3px;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.85em;
  }
  .vis-buttons button:hover { background: #475569; }

  @media (max-width: 1024px) {
    .app { flex-direction: column; height: auto; }
    .left, .right { width: 100%; border: none; border-bottom: 1px solid #1e293b; }
    .center { min-height: 400px; }
  }
</style>
