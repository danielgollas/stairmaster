<script>
  let { warnings = [] } = $props();
</script>

<div class="warnings">
  {#if warnings.length === 0}
    <div class="all-clear">All code checks pass</div>
  {:else}
    {#each warnings as w}
      <div class="warning">{w.message}</div>
    {/each}
  {/if}
</div>

<style>
  .warnings { display: flex; flex-direction: column; gap: 4px; }
  .all-clear { color: #34d399; font-size: 0.8em; }
  .warning {
    color: #fbbf24;
    font-size: 0.8em;
    padding: 4px 8px;
    background: rgba(251, 191, 36, 0.1);
    border-radius: 4px;
  }
</style>
