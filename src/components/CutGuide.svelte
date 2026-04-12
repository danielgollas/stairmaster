<script>
  let { sceneParams = null } = $props();

  let svgWidth = $state(800);
  let svgHeight = $state(300);
  let container;

  // Compute the stringer layout on a flat board
  let layout = $derived.by(() => {
    if (!sceneParams) return null;
    const p = sceneParams;
    const rise = p.actualRiserHeight;
    const run = p.treadDepth;
    const n = p.numTreads;
    const drop = p.bottomDrop;
    const sw = p.stringerStockWidth;
    const rb = p.riserBoardThickness;
    const hyp = Math.sqrt(rise * rise + run * run);
    const slopeRatio = rise / run;

    // Board top edge = riser top line through (0, rise-drop) with slope rise/run
    const topLineY0 = rise - drop;
    const boardVertical = sw * hyp / run;

    // Bottom edge
    const botAtX0 = topLineY0 - boardVertical;

    // Seat end (where bottom edge meets y=0)
    const seatEndX = -botAtX0 / slopeRatio;

    // Top plumb cut
    const topTd = run - 2 * rb;
    const topX = (n - 1) * run + topTd + rb;
    const topY = (n) * rise - drop;

    // Stringer total length along the slope (from seat end to top plumb)
    const stringerRunX = topX - 0;  // shape x range: 0 to topX (plus seat extends further)

    // Notch positions (in the installed frame)
    function notchY(i) { return (i + 1) * rise - drop; }

    const notches = [];
    for (let i = 0; i < n; i++) {
      const treadY = notchY(i);
      const riserX = i * run;
      const td = (i === n - 1) ? run - 2 * rb : run - rb;
      notches.push({ riserX, treadY, td });
    }

    // Board length along slope: from the leftmost point to the rightmost
    const leftX = Math.min(0, seatEndX);  // seat may extend left
    const rightX = topX;
    const boardLength = (rightX - leftX) / Math.cos(Math.atan(rise / run));

    // For the flat board view, we rotate the stringer so the board is horizontal.
    // The stair angle rotates the board. On a flat board:
    // - The long axis is horizontal (the board length)
    // - The board is 11.25" wide (perpendicular = vertical in the diagram)
    // - The cut lines are drawn rotated by -stairAngle onto the board

    const angle = Math.atan2(rise, run);  // stair angle in radians

    // Transform a point from installed coords (x, y) to board coords (bx, by)
    // where bx = along the board, by = across the board width
    // The board's bottom edge aligns with the stringer's bottom edge.
    // Rotate by -angle around the bottom-left corner of the board.
    function toBoard(x, y) {
      // First offset so the bottom edge at the seat is at the origin
      const ox = x;
      const oy = y - botAtX0;  // shift so bottom edge at x=0 starts at by=0
      // Rotate by -angle
      const bx = ox * Math.cos(angle) + oy * Math.sin(angle);
      const by = -ox * Math.sin(angle) + oy * Math.cos(angle);
      return { bx, by };
    }

    // Key points in board coords
    const seatEnd = toBoard(seatEndX, 0);
    const seatOrigin = toBoard(0, 0);
    const topPlumbTop = toBoard(topX, topY);
    const topPlumbBot = toBoard(topX, botAtX0 + topX * slopeRatio);

    // Board corners (bottom edge)
    const boardBotLeft = toBoard(seatEndX, botAtX0 + seatEndX * slopeRatio);  // should be (something, 0)
    const boardBotRight = toBoard(topX, botAtX0 + topX * slopeRatio);

    // Notch points in board coords
    const notchPts = notches.map(notch => ({
      riserBot: toBoard(notch.riserX, notch.riserX > 0 ? notchY(notches.indexOf(notch) - 1) || 0 : 0),
      riserTop: toBoard(notch.riserX, notch.treadY),
      treadEnd: toBoard(notch.riserX + notch.td, notch.treadY),
      fillEnd: toBoard(notch.riserX + notch.td + rb, notch.treadY),
    }));

    // Build SVG path for the stringer outline on the board
    const pts = [];

    // Seat
    pts.push(toBoard(seatEndX, 0));
    pts.push(toBoard(0, 0));

    // Sawtooth
    for (let i = 0; i < n; i++) {
      const treadY = notchY(i);
      const riserX = i * run;
      const td = (i === n - 1) ? run - 2 * rb : run - rb;
      pts.push(toBoard(riserX, treadY));
      pts.push(toBoard(riserX + td, treadY));
      if (i < n - 1) {
        pts.push(toBoard((i + 1) * run, treadY));
      }
    }

    // Top plumb
    pts.push(toBoard(topX, topY));
    pts.push(toBoard(topX, botAtX0 + topX * slopeRatio));

    // Bottom edge back to seat (auto-close handled by SVG)

    // Find bounding box of all stringer points
    let minBx = Infinity, maxBx = -Infinity;
    for (const p of pts) {
      minBx = Math.min(minBx, p.bx);
      maxBx = Math.max(maxBx, p.bx);
    }
    // Include bottom edge points
    minBx = Math.min(minBx, boardBotLeft.bx, boardBotRight.bx);
    maxBx = Math.max(maxBx, boardBotLeft.bx, boardBotRight.bx);

    // Board spans the full extent of the stringer
    const boardLeft = minBx;
    const boardRight = maxBx;
    const minBy = 0;
    const maxBy = sw;

    return {
      pts, boardBotLeft, boardBotRight, topPlumbTop, topPlumbBot,
      seatEnd, seatOrigin,
      sw, boardLeft, boardRight,
      minBx, maxBx, minBy, maxBy,
      angle, rise, run, drop, rb, n, topX, topY, botAtX0, slopeRatio,
      notchY, toBoard, notches,
      seatEndXCalc: seatEndX,
    };
  });

  function pathD(points) {
    if (!points || points.length === 0) return '';
    return 'M ' + points.map(p => `${p.bx.toFixed(2)},${p.by.toFixed(2)}`).join(' L ') + ' Z';
  }
</script>

<div class="cut-guide" bind:this={container}>
  {#if layout}
    {@const L = layout}
    {@const margin = 15}
    {@const totalW = L.maxBx - L.minBx + margin * 2}
    {@const totalH = L.maxBy - L.minBy + margin * 2}
    {@const scale = Math.min(svgWidth / totalW, svgHeight / totalH, 8)}
    {@const ox = -L.minBx + margin}
    {@const oy = -L.minBy + margin}

    <svg
      viewBox="0 0 {totalW * scale} {totalH * scale}"
      width="100%"
      height="100%"
      style="background: white;"
    >
      <g transform="scale({scale}) translate({ox},{oy})">
        <!-- Board outline (rectangle covering full stringer extent) -->
        <rect
          x={L.boardLeft}
          y={0}
          width={L.boardRight - L.boardLeft}
          height={L.sw}
          fill="#f5e6c8"
          stroke="#a0784c"
          stroke-width={0.5 / scale}
        />

        <!-- 1" grid on the board -->
        {#each Array(Math.ceil(L.boardRight - L.boardLeft) + 1) as _, i}
          <line
            x1={L.boardLeft + i}
            y1={0}
            x2={L.boardLeft + i}
            y2={L.sw}
            stroke={i % 5 === 0 ? "#bbb" : "#ddd"}
            stroke-width={(i % 5 === 0 ? 0.3 : 0.15) / scale}
          />
        {/each}
        {#each Array(Math.ceil(L.sw) + 1) as _, i}
          <line
            x1={L.boardLeft}
            y1={i}
            x2={L.boardRight}
            y2={i}
            stroke={i % 5 === 0 ? "#bbb" : "#ddd"}
            stroke-width={(i % 5 === 0 ? 0.3 : 0.15) / scale}
          />
        {/each}

        <!-- Cut lines (stringer outline) -->
        <path
          d={pathD(L.pts)}
          fill="rgba(180, 120, 40, 0.3)"
          stroke="#c0392b"
          stroke-width={0.8 / scale}
          stroke-dasharray="{2 / scale},{1 / scale}"
        />

        <!-- Waste areas (outside the stringer, inside the board) -->
        <!-- Mark with X or hatching -->

        <!-- Dimension: board length -->
        <text
          x={(L.boardLeft + L.boardRight) / 2}
          y={L.sw + 3}
          text-anchor="middle"
          font-size={2.5}
          fill="#333"
        >
          {(L.boardRight - L.boardLeft).toFixed(1)}" board length
        </text>

        <!-- Dimension: board width -->
        <text
          x={L.boardLeft - 2}
          y={L.sw / 2}
          text-anchor="middle"
          font-size={2}
          fill="#333"
          transform="rotate(-90, {L.boardLeft - 2}, {L.sw / 2})"
        >
          {L.sw}" (2x12)
        </text>

        <!-- Detailed measurements for each cut -->
        {#each L.notches as notch, i}
          {@const riserX = notch.riserX}
          {@const treadY = notch.treadY}
          {@const prevY = i > 0 ? L.notchY(i - 1) : 0}
          {@const td = notch.td}
          {@const rb = L.rb}

          <!-- Tread cut dimension (horizontal cut on stringer) -->
          {@const tStart = L.toBoard(riserX + rb, treadY)}
          {@const tEnd = L.toBoard(riserX + td, treadY)}
          {@const tLen = Math.sqrt((tEnd.bx-tStart.bx)**2 + (tEnd.by-tStart.by)**2)}
          <line x1={tStart.bx} y1={tStart.by} x2={tEnd.bx} y2={tEnd.by}
            stroke="#2980b9" stroke-width={0.3/scale} />
          <text x={(tStart.bx+tEnd.bx)/2} y={(tStart.by+tEnd.by)/2 - 0.8}
            text-anchor="middle" font-size={1.2} fill="#2980b9">
            {td.toFixed(2)}" T{i+1}
          </text>

          <!-- Riser cut dimension (vertical cut on stringer) -->
          {@const rBot = L.toBoard(riserX, prevY)}
          {@const rTop = L.toBoard(riserX, treadY)}
          {@const rLen = treadY - prevY}
          <line x1={rBot.bx} y1={rBot.by} x2={rTop.bx} y2={rTop.by}
            stroke="#e67e22" stroke-width={0.3/scale} />
          <text x={(rBot.bx+rTop.bx)/2 - 1.5} y={(rBot.by+rTop.by)/2}
            text-anchor="middle" font-size={1.2} fill="#e67e22">
            {rLen.toFixed(2)}" R{i+1}
          </text>

          <!-- Riser board pocket (rb gap) -->
          {@const pStart = L.toBoard(riserX, treadY)}
          {@const pEnd = L.toBoard(riserX + rb, treadY)}
          <line x1={pStart.bx} y1={pStart.by} x2={pEnd.bx} y2={pEnd.by}
            stroke="#8e44ad" stroke-width={0.3/scale} />
          <text x={(pStart.bx+pEnd.bx)/2} y={(pStart.by+pEnd.by)/2 + 1.5}
            text-anchor="middle" font-size={1} fill="#8e44ad">
            {rb}"
          </text>
        {/each}

        <!-- Seat bearing dimension -->
        {#if true}
          {@const seatLen = L.seatEndXCalc}
          <line x1={L.seatEnd.bx} y1={L.seatEnd.by} x2={L.seatOrigin.bx} y2={L.seatOrigin.by}
            stroke="#27ae60" stroke-width={0.4/scale} />
          <text x={(L.seatEnd.bx+L.seatOrigin.bx)/2} y={(L.seatEnd.by+L.seatOrigin.by)/2 - 1}
            text-anchor="middle" font-size={1.3} fill="#27ae60">
            {seatLen.toFixed(1)}" seat
          </text>
        {/if}

        <!-- Top plumb cut dimension -->
        {#if true}
          {@const pTop = L.toBoard(L.topX, L.topY)}
          {@const pBot = L.toBoard(L.topX, L.botAtX0 + L.topX * L.slopeRatio)}
          {@const pLen = L.topY - (L.botAtX0 + L.topX * L.slopeRatio)}
          <line x1={pTop.bx} y1={pTop.by} x2={pBot.bx} y2={pBot.by}
            stroke="#27ae60" stroke-width={0.4/scale} />
          <text x={(pTop.bx+pBot.bx)/2 + 2} y={(pTop.by+pBot.by)/2}
            text-anchor="start" font-size={1.3} fill="#27ae60">
            {pLen.toFixed(1)}" plumb
          </text>
        {/if}

        <!-- Bottom edge (uncut) label -->
        <text x={(L.boardLeft + L.boardRight) / 2} y={L.sw + 6}
          text-anchor="middle" font-size={1.5} fill="#7f8c8d">
          bottom edge (uncut)
        </text>
      </g>
    </svg>
  {:else}
    <p>Loading...</p>
  {/if}
</div>

<style>
  .cut-guide {
    width: 100%;
    height: 100%;
    min-height: 300px;
    overflow: auto;
    background: white;
  }
  svg {
    display: block;
  }
</style>
