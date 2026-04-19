<script>
  let { settings = $bindable(), label = '', onclose = () => {} } = $props();
</script>

<div class="tex-editor-overlay" onclick={onclose}>
  <div class="tex-editor" onclick={(e) => e.stopPropagation()}>
    <div class="tex-header">
      <span>{label} Texture Settings</span>
      <button class="close-btn" onclick={onclose}>X</button>
    </div>
    <div class="tex-body">
      <label title="Rotation of the texture in degrees">
        <span>Rotation</span>
        <div class="slider-row">
          <input type="range" min="0" max="360" step="1" bind:value={settings.rotation} />
          <input type="number" bind:value={settings.rotation} step="1" min="0" max="360" />
          <span class="unit">deg</span>
        </div>
      </label>
      <label title="Horizontal texture repeat scale. Higher = more repeats">
        <span>Scale U</span>
        <div class="slider-row">
          <input type="range" min="0.1" max="5" step="0.05" bind:value={settings.scaleU} />
          <input type="number" bind:value={settings.scaleU} step="0.05" min="0.1" max="10" />
        </div>
      </label>
      <label title="Vertical texture repeat scale. Higher = more repeats">
        <span>Scale V</span>
        <div class="slider-row">
          <input type="range" min="0.1" max="5" step="0.05" bind:value={settings.scaleV} />
          <input type="number" bind:value={settings.scaleV} step="0.05" min="0.1" max="10" />
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
      <div class="presets">
        <span>Presets</span>
        <div class="preset-buttons">
          <button onclick={() => { settings.rotation = 0; settings.scaleU = 1; settings.scaleV = 1; settings.mapping = 'uv'; }}>Reset</button>
          <button onclick={() => { settings.rotation = 90; }}>90 deg</button>
          <button onclick={() => { settings.scaleU = 0.5; settings.scaleV = 0.5; }}>Half</button>
          <button onclick={() => { settings.scaleU = 2; settings.scaleV = 2; }}>Double</button>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .tex-editor-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  .tex-editor {
    background: #1e293b;
    border: 1px solid #475569;
    border-radius: 8px;
    width: 320px;
    overflow: hidden;
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
