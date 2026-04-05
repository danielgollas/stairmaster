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

  let viewMode = $state('side');
  let stlData = $state(null);
  let workerReady = $state(false);
  let rendering = $state(false);

  // Visibility toggles
  let visibility = $state({
    grid: true, groundPlane: true, concretePad: true, sillPlate: true,
    bottomPosts: true, postBases: true, stringers: true,
    blocking: true, tensionTies: true, treads: true,
    risers: true, stringerHangers: true, rimJoist: true,
    deckSurface: true, topPosts: true,
  });

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

  // Shared params object for scad generation
  let scadParams = $derived({
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
  });

  // Full model for WASM rendering (always all components visible)
  let renderScadSource = $derived(generateScad(scadParams));

  // Visibility-filtered source for download only
  let downloadScadSource = $derived(generateScad(scadParams, visibility));

  // Web Worker
  let worker;
  let renderId = 0;
  let debounceTimer = null;

  $effect(() => {
    worker = new Worker(
      new URL('./worker/openscad-worker.js', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e) => {
      if (e.data.type === 'ready') {
        workerReady = true;
      } else if (e.data.type === 'result') {
        // Only accept the latest render
        if (e.data.id === renderId) {
          stlData = e.data.stl;
          rendering = false;
        }
      } else if (e.data.type === 'error') {
        console.error('OpenSCAD error:', e.data.error);
        rendering = false;
      }
    };
    return () => { worker.terminate(); };
  });

  // Debounced render: only triggers on dimensional changes (renderScadSource),
  // NOT on visibility toggles
  $effect(() => {
    const source = renderScadSource; // capture dependency — excludes visibility
    const ready = workerReady;
    if (!ready) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      renderId++;
      rendering = true;
      worker.postMessage({ type: 'render', scadSource: source, id: renderId });
    }, 600);
  });

  function downloadScad() {
    const blob = new Blob([downloadScadSource], { type: 'text/plain' });
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
    <div class="visibility-bar">
      <div class="vis-buttons">
        <button onclick={() => { for (const k in visibility) visibility[k] = true; }}>All</button>
        <button onclick={() => { for (const k in visibility) visibility[k] = false; }}>None</button>
        <button onclick={() => { for (const k in visibility) visibility[k] = !visibility[k]; }}>Invert</button>
      </div>
      {#each Object.entries(visibility) as [key, val]}
        <label class="vis-toggle">
          <input type="checkbox" bind:checked={visibility[key]} />
          <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
        </label>
      {/each}
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
