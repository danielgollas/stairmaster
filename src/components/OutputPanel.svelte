<script>
  import CodeWarnings from './CodeWarnings.svelte';

  let {
    numRisers = 0,
    numTreads = 0,
    actualRiserHeight = 0,
    stairAngle = 0,
    totalRun = 0,
    stringerLength = 0,
    numStringers = 0,
    actualOC = 0,
    throat = 0,
    padWidth = 0,
    padDepth = 0,
    concreteThickness = 0,
    excavationDepth = 0,
    warnings = [],
    postBase = '',
    tensionTie = '',
    stringerHanger = '',
  } = $props();

  function fmt(n, decimals = 2) {
    return typeof n === 'number' ? n.toFixed(decimals) : '—';
  }
</script>

<div class="output-panel">
  <div class="section">
    <h3>Computed Results</h3>
    <div class="row"><span>Risers</span><strong>{numRisers}</strong></div>
    <div class="row"><span>Treads</span><strong>{numTreads}</strong></div>
    <div class="row"><span>Actual riser</span><strong>{fmt(actualRiserHeight, 3)}"</strong></div>
    <div class="row"><span>Stair angle</span><strong>{fmt(stairAngle, 1)}&deg;</strong></div>
    <div class="row"><span>Total run</span><strong>{fmt(totalRun)}"</strong></div>
    <div class="row"><span>Stringer length</span><strong>{fmt(stringerLength)}"</strong></div>
    <div class="row"><span>Num stringers</span><strong>{numStringers}</strong></div>
    <div class="row"><span>Actual OC</span><strong>{fmt(actualOC)}"</strong></div>
    <div class="row"><span>Throat</span><strong>{fmt(throat)}"</strong></div>
    <div class="row"><span>Riser board</span><strong>2x6 + {fmt(actualRiserHeight - 5.5, 2)}" rip</strong></div>
  </div>

  <div class="section">
    <h3>Pad Dimensions</h3>
    <div class="row"><span>Width (W)</span><strong>{fmt(padWidth)}"</strong></div>
    <div class="row"><span>Depth (D)</span><strong>{fmt(padDepth)}"</strong></div>
    <div class="row"><span>Concrete</span><strong>{fmt(concreteThickness)}"</strong></div>
    <div class="row"><span>Excavation</span><strong>{fmt(excavationDepth)}"</strong></div>
  </div>

  <div class="section">
    <h3>Code Checks</h3>
    <CodeWarnings {warnings} />
  </div>

  <div class="section">
    <h3>Hardware</h3>
    <div class="hardware-item">Post bases: {postBase} (x2)</div>
    <div class="hardware-item">Tension ties: {tensionTie}</div>
    <div class="hardware-item">Stringer hangers: {stringerHanger}</div>
  </div>
</div>

<style>
  .output-panel {
    padding: 16px;
    overflow-y: auto;
    height: 100%;
  }
  .section {
    margin-bottom: 16px;
    background: #1e293b;
    border-radius: 6px;
    padding: 12px;
  }
  h3 {
    margin: 0 0 8px;
    color: #f472b6;
    font-size: 0.9em;
    font-weight: 600;
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
    font-size: 0.85em;
    color: #cbd5e1;
  }
  .row strong {
    color: #fbbf24;
    font-family: monospace;
  }
  .hardware-item {
    font-size: 0.8em;
    color: #94a3b8;
    line-height: 1.6;
  }
</style>
