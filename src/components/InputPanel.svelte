<script>
  let {
    totalHeight = $bindable(),
    topPostSpacing = $bindable(),
    riserHeight = $bindable(),
    treadDepth = $bindable(),
    stringerOC = $bindable(),
    stringerPosition = $bindable(),
    deckingThickness = $bindable(),
    riserBoardThickness = $bindable(),
    rimJoistWidth = $bindable(),
    sillPlateThickness = $bindable(),
    padAboveGrade = $bindable(),
    concreteBelow = $bindable(),
    gravelDepth = $bindable(),
    padSideClearance = $bindable(),
    padBackExtension = $bindable(),
    postBase = $bindable(),
    tensionTie = $bindable(),
    stringerHanger = $bindable(),
  } = $props();

  let sections = $state({
    site: true,
    geometry: true,
    materials: false,
    pad: false,
    hardware: false,
  });

  function toggle(section) {
    sections[section] = !sections[section];
  }
</script>

<div class="input-panel">
  <h2>Stairmaster</h2>

  <!-- Site Measurements -->
  <button class="section-header" onclick={() => toggle('site')}>
    <span>{sections.site ? '▾' : '▸'}</span> Site Measurements
  </button>
  {#if sections.site}
    <div class="section-body">
      <label>
        <span>Grade to deck top (in)</span>
        <input type="number" bind:value={totalHeight} step="0.25" min="12" />
      </label>
      <label>
        <span>Post spacing (in)</span>
        <input type="number" bind:value={topPostSpacing} step="0.25" min="24" />
      </label>
    </div>
  {/if}

  <!-- Stair Geometry -->
  <button class="section-header" onclick={() => toggle('geometry')}>
    <span>{sections.geometry ? '▾' : '▸'}</span> Stair Geometry
  </button>
  {#if sections.geometry}
    <div class="section-body">
      <label>
        <span>Target riser height (in)</span>
        <input type="number" bind:value={riserHeight} step="0.125" min="4" max="8" />
      </label>
      <label>
        <span>Tread depth (in)</span>
        <input type="number" bind:value={treadDepth} step="0.125" min="9" />
      </label>
      <label>
        <span>Max stringer OC</span>
        <div class="toggle-group">
          <button class:active={stringerOC === 12} onclick={() => stringerOC = 12}>12"</button>
          <button class:active={stringerOC === 16} onclick={() => stringerOC = 16}>16"</button>
        </div>
      </label>
      <label>
        <span>Stringers</span>
        <div class="toggle-group">
          <button class:active={stringerPosition === 'inside'} onclick={() => stringerPosition = 'inside'}>Inside posts</button>
          <button class:active={stringerPosition === 'outside'} onclick={() => stringerPosition = 'outside'}>Outside posts</button>
        </div>
      </label>
    </div>
  {/if}

  <!-- Materials -->
  <button class="section-header" onclick={() => toggle('materials')}>
    <span>{sections.materials ? '▾' : '▸'}</span> Materials
  </button>
  {#if sections.materials}
    <div class="section-body">
      <label>
        <span>Decking thickness (in)</span>
        <input type="number" bind:value={deckingThickness} step="0.25" min="0.75" />
      </label>
      <label>
        <span>Riser board thickness (in)</span>
        <input type="number" bind:value={riserBoardThickness} step="0.25" min="0.75" />
      </label>
      <label>
        <span>Rim joist width (in)</span>
        <input type="number" bind:value={rimJoistWidth} step="0.25" min="5.5" />
      </label>
      <label>
        <span>Sill plate thickness (in)</span>
        <input type="number" bind:value={sillPlateThickness} step="0.25" min="0.75" />
      </label>
    </div>
  {/if}

  <!-- Concrete Pad -->
  <button class="section-header" onclick={() => toggle('pad')}>
    <span>{sections.pad ? '▾' : '▸'}</span> Concrete Pad
  </button>
  {#if sections.pad}
    <div class="section-body">
      <label>
        <span>Above grade (in)</span>
        <input type="number" bind:value={padAboveGrade} step="0.25" min="0" />
      </label>
      <label>
        <span>Concrete below grade (in)</span>
        <input type="number" bind:value={concreteBelow} step="0.5" min="2" />
      </label>
      <label>
        <span>Gravel depth (in)</span>
        <input type="number" bind:value={gravelDepth} step="0.5" min="4" />
      </label>
      <label>
        <span>Pad side clearance (in)</span>
        <input type="number" bind:value={padSideClearance} step="0.5" min="0" />
      </label>
      <label>
        <span>Pad back extension (in)</span>
        <input type="number" bind:value={padBackExtension} step="1" min="0" />
      </label>
    </div>
  {/if}

  <!-- Hardware -->
  <button class="section-header" onclick={() => toggle('hardware')}>
    <span>{sections.hardware ? '▾' : '▸'}</span> Hardware
  </button>
  {#if sections.hardware}
    <div class="section-body">
      <label>
        <span>Post base</span>
        <input type="text" bind:value={postBase} />
      </label>
      <label>
        <span>Tension tie</span>
        <input type="text" bind:value={tensionTie} />
      </label>
      <label>
        <span>Stringer hanger</span>
        <input type="text" bind:value={stringerHanger} />
      </label>
    </div>
  {/if}
</div>

<style>
  .input-panel {
    padding: 16px;
    overflow-y: auto;
    height: 100%;
  }
  h2 {
    margin: 0 0 16px;
    font-size: 1.2em;
    color: #e2e8f0;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    margin-bottom: 2px;
    background: #1e293b;
    border: none;
    border-radius: 6px;
    color: #60a5fa;
    font-weight: 600;
    font-size: 0.9em;
    cursor: pointer;
    text-align: left;
  }
  .section-header:hover { background: #334155; }
  .section-body {
    padding: 8px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85em;
    color: #cbd5e1;
  }
  input[type="number"], input[type="text"] {
    width: 80px;
    padding: 4px 8px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #fbbf24;
    text-align: right;
    font-family: monospace;
  }
  input[type="text"] {
    width: 140px;
    text-align: left;
  }
  .toggle-group {
    display: flex;
    gap: 4px;
  }
  .toggle-group button {
    padding: 4px 12px;
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.85em;
  }
  .toggle-group button.active {
    background: #60a5fa;
    color: #0f172a;
    font-weight: 600;
  }
</style>
