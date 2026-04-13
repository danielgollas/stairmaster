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
    postHeight = $bindable(),
    postBase = $bindable(),
    tensionTie = $bindable(),
    stringerHanger = $bindable(),
    visibility = $bindable(),
    edgeMode = $bindable(),
    faceMode = $bindable(),
    aoMode = $bindable(),
    aoParams = $bindable(),
  } = $props();

  const visTree = {
    'Structure': ['stringers', 'blocking', 'sillPlate', 'rimJoist'],
    'Railing': ['railingFrame', 'hogPanel'],
    'Surfaces': ['treads', 'risers', 'deckSurface'],
    'Foundation': ['concretePad', 'groundPlane'],
    'Posts': ['bottomPosts', 'topPosts'],
    'Hardware': ['postBases', 'tensionTies', 'stringerHangers'],
    'Annotations': ['dimensions', 'grid', 'measureGrid', 'boardOverlay'],
  };

  let visOpen = $state({});

  function toggleVis(section) {
    visOpen[section] = !visOpen[section];
  }

  function camelToLabel(key) {
    return key.replace(/([A-Z])/g, ' $1').trim().toLowerCase();
  }

  function isGroupAllOn(keys) {
    return keys.every(k => visibility[k] !== false);
  }

  function toggleGroup(keys) {
    const allOn = isGroupAllOn(keys);
    for (const k of keys) visibility[k] = !allOn;
  }

  let sections = $state({
    site: true,
    geometry: true,
    materials: false,
    pad: false,
    hardware: false,
    render: true,
    display: true,
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
        <span>Post height (in)</span>
        <input type="number" bind:value={postHeight} step="1" min="30" max="60" />
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

  <!-- Render -->
  <button class="section-header" onclick={() => toggle('render')}>
    <span>{sections.render ? '▾' : '▸'}</span> Render
  </button>
  {#if sections.render}
    <div class="section-body">
      <label>
        <span title="How polygon edges are drawn on meshes">Edges</span>
        <select bind:value={edgeMode} class="render-select">
          <option value="none">None</option>
          <option value="visible">Visible</option>
          <option value="backface">Backface</option>
        </select>
      </label>
      <label>
        <span title="Surface shading style for all geometry">Faces</span>
        <select bind:value={faceMode} class="render-select">
          <option value="color">Color</option>
          <option value="white">White</option>
          <option value="textured">Textured</option>
          <option value="xray">X-Ray</option>
        </select>
      </label>
      <label>
        <span title="Ambient occlusion darkens creases and contact areas for depth">AO</span>
        <select bind:value={aoMode} class="render-select">
          <option value="off">Off</option>
          <option value="ssao">SSAO</option>
          <option value="sao">SAO</option>
          <option value="n8ao">N8AO</option>
          <option value="aomap">AO Map</option>
        </select>
      </label>

      {#if aoMode === 'ssao'}
        <div class="ao-params">
          <span class="ao-params-title">SSAO Parameters</span>
          <label title="Radius of the sampling hemisphere in world units (meters). Larger values darken wider areas but can cause halos.">
            <span>Kernel radius</span>
            <input type="number" bind:value={aoParams.ssao.kernelRadius} step="0.01" min="0.01" max="1" />
          </label>
          <label title="Minimum depth difference to count as occlusion. Prevents self-shadowing on flat surfaces.">
            <span>Min distance</span>
            <input type="number" bind:value={aoParams.ssao.minDistance} step="0.00001" min="0" max="0.001" />
          </label>
          <label title="Maximum depth difference to count as occlusion. Limits how far apart surfaces can be and still darken each other.">
            <span>Max distance</span>
            <input type="number" bind:value={aoParams.ssao.maxDistance} step="0.001" min="0.0001" max="0.1" />
          </label>
        </div>
      {/if}

      {#if aoMode === 'sao'}
        <div class="ao-params">
          <span class="ao-params-title">SAO Parameters</span>
          <label title="Strength of the darkening effect. Higher values make shadows more pronounced.">
            <span>Intensity</span>
            <input type="number" bind:value={aoParams.sao.intensity} step="0.001" min="0" max="0.1" />
          </label>
          <label title="World-space scale of the AO sampling pattern. Adjusts how the algorithm interprets scene distances.">
            <span>Scale</span>
            <input type="number" bind:value={aoParams.sao.scale} step="0.5" min="0.5" max="20" />
          </label>
          <label title="Sampling radius in pixels. Larger values capture wider occlusion but are slower.">
            <span>Kernel radius</span>
            <input type="number" bind:value={aoParams.sao.kernelRadius} step="5" min="5" max="100" />
          </label>
          <label title="Depth bias to prevent artifacts on flat surfaces. Increase if you see banding.">
            <span>Bias</span>
            <input type="number" bind:value={aoParams.sao.bias} step="0.1" min="0" max="5" />
          </label>
          <label title="Blur radius for smoothing the AO. Higher values reduce noise but soften detail.">
            <span>Blur radius</span>
            <input type="number" bind:value={aoParams.sao.blurRadius} step="1" min="0" max="20" />
          </label>
        </div>
      {/if}

      {#if aoMode === 'n8ao'}
        <div class="ao-params">
          <span class="ao-params-title">N8AO Parameters</span>
          <label title="World-space radius of AO sampling in meters. Controls how far the algorithm looks for occluding geometry.">
            <span>AO radius</span>
            <input type="number" bind:value={aoParams.n8ao.aoRadius} step="0.01" min="0.01" max="1" />
          </label>
          <label title="How quickly occlusion fades with distance. Lower values keep AO tighter to contact areas.">
            <span>Distance falloff</span>
            <input type="number" bind:value={aoParams.n8ao.distanceFalloff} step="0.01" min="0.01" max="1" />
          </label>
          <label title="Overall strength of the AO darkening effect.">
            <span>Intensity</span>
            <input type="number" bind:value={aoParams.n8ao.intensity} step="0.5" min="0.5" max="10" />
          </label>
          <label title="Number of samples per pixel for AO calculation. More samples = less noise but slower.">
            <span>AO samples</span>
            <input type="number" bind:value={aoParams.n8ao.aoSamples} step="4" min="4" max="64" />
          </label>
          <label title="Number of samples for the denoising pass. More samples = smoother result.">
            <span>Denoise samples</span>
            <input type="number" bind:value={aoParams.n8ao.denoiseSamples} step="2" min="2" max="32" />
          </label>
          <label title="Pixel radius of the denoising blur. Larger values smooth more aggressively.">
            <span>Denoise radius</span>
            <input type="number" bind:value={aoParams.n8ao.denoiseRadius} step="1" min="1" max="24" />
          </label>
        </div>
      {/if}

      {#if aoMode === 'aomap'}
        <div class="ao-params">
          <span class="ao-params-title">AO Map Parameters</span>
          <label title="How strongly the baked edge-darkening texture affects the surface. Higher = darker edges.">
            <span>Map intensity</span>
            <input type="number" bind:value={aoParams.aomap.aoMapIntensity} step="0.1" min="0" max="5" />
          </label>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Display -->
  <button class="section-header" onclick={() => toggle('display')}>
    <span>{sections.display ? '▾' : '▸'}</span> Display
  </button>
  {#if sections.display}
    <div class="section-body vis-tree">
      <div class="vis-global">
        <button onclick={() => { for (const k in visibility) visibility[k] = true; }}>All</button>
        <button onclick={() => { for (const k in visibility) visibility[k] = false; }}>None</button>
        <button onclick={() => { for (const k in visibility) visibility[k] = !visibility[k]; }}>Invert</button>
      </div>
      {#each Object.entries(visTree) as [group, keys]}
        <div class="vis-group">
          <button class="vis-group-header" onclick={() => toggleVis(group)}>
            <span class="vis-arrow">{visOpen[group] ? '▾' : '▸'}</span>
            <input type="checkbox" checked={isGroupAllOn(keys)} onclick={(e) => { e.stopPropagation(); toggleGroup(keys); }} />
            <span>{group}</span>
          </button>
          {#if visOpen[group]}
            <div class="vis-group-body">
              {#each keys as key}
                <label class="vis-leaf">
                  <input type="checkbox" bind:checked={visibility[key]} />
                  <span>{camelToLabel(key)}</span>
                </label>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
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
  .render-select {
    width: 100px;
    padding: 3px 6px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #fbbf24;
    font-family: monospace;
    font-size: 0.95em;
    cursor: pointer;
  }
  .ao-params {
    margin-top: 4px;
    padding: 6px 8px;
    background: #1e293b;
    border-radius: 4px;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .ao-params-title {
    font-size: 0.75em;
    color: #60a5fa;
    font-weight: 600;
    margin-bottom: 2px;
  }
  .ao-params label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.78em;
    color: #94a3b8;
    cursor: help;
  }
  .ao-params input[type="number"] {
    width: 65px;
    padding: 2px 4px;
    font-size: 0.95em;
  }
  .vis-tree {
    gap: 4px;
  }
  .vis-global {
    display: flex;
    gap: 4px;
    margin-bottom: 4px;
  }
  .vis-global button {
    padding: 2px 8px;
    background: #334155;
    border: none;
    border-radius: 3px;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.8em;
  }
  .vis-global button:hover { background: #475569; }
  .vis-group-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 3px 0;
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.8em;
  }
  .vis-group-header:hover { color: #e2e8f0; }
  .vis-arrow { font-size: 0.7em; width: 10px; }
  .vis-group-header input[type="checkbox"] {
    accent-color: #60a5fa;
    margin: 0;
  }
  .vis-group-body {
    padding-left: 24px;
  }
  .vis-leaf {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 0;
    font-size: 0.78em;
    color: #94a3b8;
    cursor: pointer;
  }
  .vis-leaf input[type="checkbox"] {
    accent-color: #60a5fa;
    margin: 0;
  }
  .vis-leaf:hover { color: #e2e8f0; }
</style>
