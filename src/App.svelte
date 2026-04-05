<script>
  import { DEFAULTS, MATERIALS } from './lib/constants.js';
  import { computeStairGeometry, computePadDimensions, computeStringerProfile } from './lib/calculations.js';
  import { checkIRC } from './lib/code-checks.js';
  import { generateScad } from './lib/scad-generator.js';
  import InputPanel from './components/InputPanel.svelte';
  import Viewport from './components/Viewport.svelte';
  import OutputPanel from './components/OutputPanel.svelte';

  // Reactive input state
  let totalHeight = $state(96);
  let topPostSpacing = $state(36);
  let riserHeight = $state(DEFAULTS.riserHeight);
  let treadDepth = $state(DEFAULTS.treadDepth);
  let stringerOC = $state(DEFAULTS.stringerOC);
  let deckingThickness = $state(DEFAULTS.deckingThickness);
  let riserBoardThickness = $state(DEFAULTS.riserBoardThickness);
  let rimJoistWidth = $state(DEFAULTS.rimJoistWidth);
  let sillPlateThickness = $state(DEFAULTS.sillPlateThickness);
  let padAboveGrade = $state(DEFAULTS.padAboveGrade);
  let concreteBelow = $state(DEFAULTS.concreteBelow);
  let gravelDepth = $state(DEFAULTS.gravelDepth);
  let padSideClearance = $state(DEFAULTS.padSideClearance);

  let postBase = $state(DEFAULTS.postBase);
  let tensionTie = $state(DEFAULTS.tensionTie);
  let stringerHanger = $state(DEFAULTS.stringerHanger);

  let viewMode = $state('3d');
  let stlData = $state(null);
  let workerReady = $state(false);
  let rendering = $state(false);

  // Computed geometry
  let geometry = $derived(computeStairGeometry({
    totalHeight, topPostSpacing, riserHeight, treadDepth, stringerOC,
    deckingThickness, riserBoardThickness, rimJoistWidth, sillPlateThickness,
    padAboveGrade, stringerStockWidth: MATERIALS['2x12'].width,
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
    seatCutLength: stringerProfile.seatCutLength,
    padAboveGrade, concreteBelow, gravelDepth,
  }));

  let warnings = $derived(checkIRC({
    actualRiserHeight: geometry.actualRiserHeight,
    treadDepth,
    stairWidth: geometry.stairWidth,
    throat: geometry.throat,
    riserVariance: 0,
  }));

  let scadSource = $derived(generateScad({
    totalHeight, topPostSpacing,
    numRisers: geometry.numRisers,
    actualRiserHeight: geometry.actualRiserHeight,
    numTreads: geometry.numTreads,
    treadDepth, totalRun: geometry.totalRun,
    stairAngle: geometry.stairAngle,
    stairWidth: geometry.stairWidth,
    numStringers: geometry.numStringers,
    stringerOC, deckingThickness, riserBoardThickness,
    rimJoistWidth,
    stringerStockWidth: MATERIALS['2x12'].width,
    stringerStockThickness: MATERIALS['2x12'].thickness,
    sillPlateThickness, postSize: MATERIALS['4x4'].actual,
    padAboveGrade, concreteBelow, gravelDepth, padSideClearance,
    padWidth: padDims.padWidth, padDepth: padDims.padDepth,
    bottomDrop: stringerProfile.bottomDrop,
    topTreadReduction: stringerProfile.topTreadReduction,
    postHeight: 42,
  }));

  // Web Worker
  let worker;
  let renderTimer;
  let renderId = 0;

  function initWorker() {
    worker = new Worker(
      new URL('./worker/openscad-worker.js', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e) => {
      if (e.data.type === 'ready') {
        workerReady = true;
        requestRender();
      } else if (e.data.type === 'result' && e.data.id === renderId) {
        stlData = e.data.stl;
        rendering = false;
      } else if (e.data.type === 'error') {
        console.error('OpenSCAD error:', e.data.error);
        rendering = false;
      }
    };
  }

  function requestRender() {
    if (!workerReady) return;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderId++;
      rendering = true;
      worker.postMessage({ type: 'render', scadSource, id: renderId });
    }, 500);
  }

  $effect(() => {
    initWorker();
    return () => { if (worker) worker.terminate(); };
  });

  // Re-render when scad source changes
  $effect(() => {
    scadSource;
    requestRender();
  });

  function downloadScad() {
    const blob = new Blob([scadSource], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stairmaster.scad';
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadStl() {
    if (!stlData) return;
    const blob = new Blob([stlData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stairmaster.stl';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="app">
  <div class="panel left">
    <InputPanel
      bind:totalHeight bind:topPostSpacing
      bind:riserHeight bind:treadDepth bind:stringerOC
      bind:deckingThickness bind:riserBoardThickness bind:rimJoistWidth
      bind:sillPlateThickness
      bind:padAboveGrade bind:concreteBelow bind:gravelDepth bind:padSideClearance
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
        <button onclick={downloadStl} disabled={!stlData}>⬇ .stl</button>
      </div>
      {#if rendering}
        <span class="rendering">Rendering...</span>
      {/if}
      {#if !workerReady}
        <span class="loading">Loading OpenSCAD WASM...</span>
      {/if}
    </div>
    <Viewport {stlData} {viewMode} />
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
      throat={geometry.throat}
      padWidth={padDims.padWidth}
      padDepth={padDims.padDepth}
      concreteThickness={padDims.concreteThickness}
      excavationDepth={padDims.excavationDepth}
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
  .downloads button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .rendering, .loading {
    font-size: 0.8em;
    color: #fbbf24;
    margin-left: auto;
  }

  @media (max-width: 1024px) {
    .app { flex-direction: column; height: auto; }
    .left, .right { width: 100%; border: none; border-bottom: 1px solid #1e293b; }
    .center { min-height: 400px; }
  }
</style>
