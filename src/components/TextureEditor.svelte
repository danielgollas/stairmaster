<script>
  let { settings = $bindable(), label = '', onclose = () => {} } = $props();

  let posX = $state(window.innerWidth - 360);
  let posY = $state(80);
  let dragging = $state(false);
  let dragOff = { x: 0, y: 0 };

  function onDragStart(e) {
    dragging = true;
    dragOff.x = e.clientX - posX;
    dragOff.y = e.clientY - posY;
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (!dragging) return;
    posX = Math.max(0, Math.min(window.innerWidth - 340, e.clientX - dragOff.x));
    posY = Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOff.y));
  }

  function onDragEnd() {
    dragging = false;
    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);
  }
</script>

  <div class="tex-editor" style="left:{posX}px; top:{posY}px;">
    <div class="tex-header" onmousedown={onDragStart} style="cursor: grab;">
      <span>{label}</span>
      <button class="close-btn" onclick={onclose}>X</button>
    </div>
    <div class="tex-body">
      <label title="Rotation of the texture in degrees">
        <span>Rotation</span>
        <div class="slider-row">
          <input type="range" min="0" max="360" step="0.5" bind:value={settings.rotation} />
          <input type="number" bind:value={settings.rotation} step="0.1" min="0" max="360" />
          <span class="unit">deg</span>
        </div>
      </label>
      <label title="Horizontal texture repeat scale. Higher = more repeats">
        <span>Scale U</span>
        <div class="slider-row">
          <input type="range" min="0.01" max="10" step="0.01" bind:value={settings.scaleU} />
          <input type="number" bind:value={settings.scaleU} step="0.01" min="0.01" max="50" />
        </div>
      </label>
      <label title="Vertical texture repeat scale. Higher = more repeats">
        <span>Scale V</span>
        <div class="slider-row">
          <input type="range" min="0.01" max="10" step="0.01" bind:value={settings.scaleV} />
          <input type="number" bind:value={settings.scaleV} step="0.01" min="0.01" max="50" />
        </div>
      </label>
      <label title="How the texture is projected onto the geometry">
        <span>Mapping</span>
        <select bind:value={settings.mapping}>
          <option value="uv">UV (default)</option>
          <option value="box">Box Projection</option>
          <option value="cylinder">Cylinder Projection</option>
          <option value="planar">Planar (XZ)</option>
        </select>
      </label>
      <div class="section-divider">Material</div>

      <label title="Strength of the bump/displacement effect. Higher values create deeper surface relief.">
        <span>Bump Strength</span>
        <div class="slider-row">
          <input type="range" min="0" max="2" step="0.01" bind:value={settings.bumpScale} />
          <input type="number" bind:value={settings.bumpScale} step="0.01" min="0" max="5" />
        </div>
      </label>
      <label title="Surface roughness. 0 = mirror-like, 1 = fully diffuse/matte.">
        <span>Roughness</span>
        <div class="slider-row">
          <input type="range" min="0" max="1" step="0.05" bind:value={settings.roughness} />
          <input type="number" bind:value={settings.roughness} step="0.05" min="0" max="1" />
        </div>
      </label>
      <label title="Metallic appearance. 0 = non-metal (wood, concrete), 1 = fully metallic.">
        <span>Metalness</span>
        <div class="slider-row">
          <input type="range" min="0" max="1" step="0.05" bind:value={settings.metalness} />
          <input type="number" bind:value={settings.metalness} step="0.05" min="0" max="1" />
        </div>
      </label>
      <label title="Normal map strength. Controls how pronounced the surface detail appears under lighting.">
        <span>Normal Strength</span>
        <div class="slider-row">
          <input type="range" min="0" max="10" step="0.1" bind:value={settings.normalScale} />
          <input type="number" bind:value={settings.normalScale} step="0.1" min="0" max="20" />
        </div>
      </label>
      <label title="Tint color multiplied over the texture. White = no tint.">
        <span>Color Tint</span>
        <div class="slider-row">
          <input type="color" bind:value={settings.colorTint} />
          <span class="unit">{settings.colorTint}</span>
        </div>
      </label>
      <label title="Self-illumination intensity. Makes the surface glow without external light.">
        <span>Emissive</span>
        <div class="slider-row">
          <input type="range" min="0" max="1" step="0.05" bind:value={settings.emissive} />
          <input type="number" bind:value={settings.emissive} step="0.05" min="0" max="1" />
        </div>
      </label>
      <label title="Transparency of the material. 1 = fully opaque.">
        <span>Opacity</span>
        <div class="slider-row">
          <input type="range" min="0.05" max="1" step="0.05" bind:value={settings.opacity} />
          <input type="number" bind:value={settings.opacity} step="0.05" min="0.05" max="1" />
        </div>
      </label>

      <div class="section-divider">Presets</div>

      <div class="presets">
        <div class="preset-buttons">
          <button onclick={() => {
            settings.rotation = 0; settings.scaleU = 1; settings.scaleV = 1; settings.mapping = 'uv';
            settings.bumpScale = 0.08; settings.roughness = 0.8; settings.metalness = 0;
            settings.normalScale = 1; settings.colorTint = '#ffffff'; settings.emissive = 0; settings.opacity = 1;
          }}>Reset All</button>
          <button onclick={() => { settings.roughness = 0.3; settings.metalness = 0; }}>Glossy</button>
          <button onclick={() => { settings.roughness = 1; settings.metalness = 0; }}>Matte</button>
          <button onclick={() => { settings.roughness = 0.2; settings.metalness = 0.8; }}>Metal</button>
          <button onclick={() => { settings.roughness = 0.85; settings.bumpScale = 0.2; }}>Worn</button>
        </div>
      </div>
    </div>
  </div>

<style>
  .tex-editor {
    position: fixed;
    z-index: 1000;
    background: #1e293b;
    border: 1px solid #475569;
    border-radius: 8px;
    width: 320px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    max-height: calc(100vh - 40px);
    overflow-y: auto;
  }
  .tex-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: #334155;
    font-size: 0.9em;
    font-weight: 600;
    color: #e2e8f0;
  }
  .close-btn {
    background: none;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.9em;
    padding: 2px 6px;
  }
  .close-btn:hover { color: #e2e8f0; }
  .tex-body {
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tex-body label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8em;
    color: #94a3b8;
    cursor: help;
  }
  .tex-body label > span:first-child {
    color: #cbd5e1;
    font-weight: 500;
  }
  .slider-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .slider-row input[type="range"] {
    flex: 1;
    accent-color: #60a5fa;
  }
  .slider-row input[type="number"] {
    width: 55px;
    padding: 2px 4px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 3px;
    color: #fbbf24;
    font-family: monospace;
    font-size: 0.95em;
    text-align: right;
  }
  .unit {
    font-size: 0.85em;
    color: #64748b;
    min-width: 24px;
  }
  .tex-body select {
    padding: 4px 8px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #fbbf24;
    font-family: monospace;
    font-size: 0.95em;
  }
  .section-divider {
    font-size: 0.75em;
    color: #60a5fa;
    font-weight: 600;
    border-top: 1px solid #334155;
    padding-top: 8px;
    margin-top: 2px;
  }
  input[type="color"] {
    width: 36px;
    height: 24px;
    border: 1px solid #334155;
    border-radius: 3px;
    background: none;
    padding: 0;
    cursor: pointer;
  }
  .presets {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.8em;
    color: #cbd5e1;
  }
  .preset-buttons {
    display: flex;
    gap: 4px;
  }
  .preset-buttons button {
    padding: 3px 8px;
    background: #334155;
    border: none;
    border-radius: 3px;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.85em;
  }
  .preset-buttons button:hover { background: #475569; color: #e2e8f0; }
</style>
