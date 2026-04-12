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

  // Format inches as whole + fraction to nearest 16th
  function fmtFrac(val) {
    const neg = val < 0;
    val = Math.abs(val);
    const whole = Math.floor(val);
    const remainder = val - whole;
    const sixteenths = Math.round(remainder * 16);
    if (sixteenths === 0) return (neg ? '-' : '') + whole + '"';
    if (sixteenths === 16) return (neg ? '-' : '') + (whole + 1) + '"';
    // Simplify fraction
    let num = sixteenths, den = 16;
    while (num % 2 === 0) { num /= 2; den /= 2; }
    if (whole === 0) return (neg ? '-' : '') + num + '/' + den + '"';
    return (neg ? '-' : '') + whole + ' ' + num + '/' + den + '"';
  }

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
          {fmtFrac(L.boardRight - L.boardLeft)} board length
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

        <!-- Edge measurements: dots where cuts cross board edges, distances between them -->
        {#if true}
          {@const fs = 0.8}
          {@const dotR = 0.3}

          <!-- Build cut vertices analytically — each is an explicit point -->
          {@const cutVertices = (() => {
            const v = [];
            const tb = L.toBoard;

            // Use the EXACT point objects from L.pts (same objects that draw the outline)
            // L.pts layout: [seatHeel, seatOrigin, R1top, T1end, fillgap?, R2top, T2end, ...]
            // Skip fill-gap points (every 3rd point after index 2, for n-1 times)
            const p = L.pts;
            // Indices of actual cut vertices:
            // 0=seatHeel, 1=seatOrigin
            v.push(p[0], p[1]);
            // For each notch: 2 points + optional fill-gap
            // Notch i starts at index 2 + i*3 (for i<n-1) or 2 + (n-1)*3 + (i-(n-1))*2
            let idx = 2;
            for (let i = 0; i < L.n; i++) {
              v.push(p[idx]);     // riser top / inside corner
              v.push(p[idx + 1]); // tread end
              idx += (i < L.n - 1) ? 3 : 2; // skip fill-gap for non-last notches
            }
            // Last 2: plumb top, plumb bottom — only include plumb bottom
            v.push(p[p.length - 1]); // plumb bottom

            return v;
          })()}

          <!-- All labeled points: 4 corners + cut vertices -->
          {@const allPoints = (() => {
            const points = [];
            points.push({ bx: L.boardLeft, by: 0, edge: 'corner' });
            points.push({ bx: L.boardRight, by: 0, edge: 'corner' });
            points.push({ bx: L.boardRight, by: L.sw, edge: 'corner' });
            points.push({ bx: L.boardLeft, by: L.sw, edge: 'corner' });
            for (const cv of cutVertices) {
              points.push({ bx: cv.bx, by: cv.by, edge: 'cut', label: cv.label });
            }
            let li = 0;
            for (const p of points) {
              p.letter = li < 26 ? String.fromCharCode(65 + li) : 'A' + String.fromCharCode(65 + li - 26);
              li++;
            }
            return points;
          })()}

          <!-- Edge measurements: only along bottom and left edges (most useful for layout) -->
          {@const botEdgePts = [L.boardLeft, L.boardRight]}
          {@const topEdgePts = [L.boardLeft, L.boardRight]}
          {@const leftEdgePts = [0, L.sw]}
          {@const rightEdgeCrossings = [0, L.sw]}

          <!-- Draw all labeled dots -->
          {#each allPoints as pt}
            {@const isEdge = pt.edge !== 'internal'}
            {@const r = isEdge ? dotR : dotR * 0.7}
            {@const color = pt.edge === 'bottom' ? '#c0392b' : pt.edge === 'top' ? '#2980b9' : pt.edge === 'left' ? '#27ae60' : '#c0392b'}
            <circle cx={pt.bx} cy={pt.by} r={r} fill={color} opacity={isEdge ? 1 : 0.6} />
            <!-- Letter label -->
            {@const lx = pt.edge === 'bottom' ? pt.bx : pt.edge === 'top' ? pt.bx : pt.edge === 'left' ? pt.bx - 1 : pt.bx + 0.6}
            {@const ly = pt.edge === 'bottom' ? pt.by + 0.9 : pt.edge === 'top' ? pt.by - 0.5 : pt.edge === 'left' ? pt.by : pt.by - 0.4}
            <text x={lx} y={ly} text-anchor="middle" font-size={0.6} fill={color} font-weight="bold">
              {pt.letter}
            </text>
          {/each}

          <!-- Measurements on bottom edge -->
          {#each botEdgePts as bx, i}
            {#if i > 0}
              {@const dist = bx - botEdgePts[i-1]}
              {#if dist > 0.5}
                <line x1={botEdgePts[i-1]} y1={L.sw+0.5} x2={bx} y2={L.sw+0.5}
                  stroke="#c0392b" stroke-width={0.15/scale} />
                <line x1={botEdgePts[i-1]} y1={L.sw+0.3} x2={botEdgePts[i-1]} y2={L.sw+0.7}
                  stroke="#c0392b" stroke-width={0.15/scale} />
                <line x1={bx} y1={L.sw+0.3} x2={bx} y2={L.sw+0.7}
                  stroke="#c0392b" stroke-width={0.15/scale} />
                <text x={(bx + botEdgePts[i-1]) / 2} y={L.sw + 1.5}
                  text-anchor="middle" font-size={fs} fill="#333">
                  {fmtFrac(dist)}
                </text>
              {/if}
            {/if}
          {/each}

          <!-- Measurements on top edge -->
          {#each topEdgePts as bx, i}
            {#if i > 0}
              {@const dist = bx - topEdgePts[i-1]}
              {#if dist > 0.5}
                <line x1={topEdgePts[i-1]} y1={-0.5} x2={bx} y2={-0.5}
                  stroke="#2980b9" stroke-width={0.15/scale} />
                <line x1={topEdgePts[i-1]} y1={-0.3} x2={topEdgePts[i-1]} y2={-0.7}
                  stroke="#2980b9" stroke-width={0.15/scale} />
                <line x1={bx} y1={-0.3} x2={bx} y2={-0.7}
                  stroke="#2980b9" stroke-width={0.15/scale} />
                <text x={(bx + topEdgePts[i-1]) / 2} y={-1.2}
                  text-anchor="middle" font-size={fs} fill="#333">
                  {fmtFrac(dist)}
                </text>
              {/if}
            {/if}
          {/each}

          <!-- Measurements on left edge -->
          {#each leftEdgePts as by, i}
            {#if i > 0}
              {@const dist = by - leftEdgePts[i-1]}
              {#if dist > 0.3}
                <line x1={L.boardLeft-0.5} y1={leftEdgePts[i-1]} x2={L.boardLeft-0.5} y2={by}
                  stroke="#27ae60" stroke-width={0.15/scale} />
                <line x1={L.boardLeft-0.3} y1={leftEdgePts[i-1]} x2={L.boardLeft-0.7} y2={leftEdgePts[i-1]}
                  stroke="#27ae60" stroke-width={0.15/scale} />
                <line x1={L.boardLeft-0.3} y1={by} x2={L.boardLeft-0.7} y2={by}
                  stroke="#27ae60" stroke-width={0.15/scale} />
                <text x={L.boardLeft - 1.5} y={(by + leftEdgePts[i-1]) / 2 + 0.3}
                  text-anchor="middle" font-size={fs} fill="#333"
                  transform="rotate(-90, {L.boardLeft - 1.5}, {(by + leftEdgePts[i-1]) / 2 + 0.3})">
                  {fmtFrac(dist)}
                </text>
              {/if}
            {/if}
          {/each}

          <!-- Measurements on right edge -->
          {#each rightEdgeCrossings as by, i}
            {#if i > 0}
              {@const dist = by - rightEdgeCrossings[i-1]}
              {#if dist > 0.3}
                <line x1={L.boardRight+0.5} y1={rightEdgeCrossings[i-1]} x2={L.boardRight+0.5} y2={by}
                  stroke="#8e44ad" stroke-width={0.15/scale} />
                <line x1={L.boardRight+0.3} y1={rightEdgeCrossings[i-1]} x2={L.boardRight+0.7} y2={rightEdgeCrossings[i-1]}
                  stroke="#8e44ad" stroke-width={0.15/scale} />
                <line x1={L.boardRight+0.3} y1={by} x2={L.boardRight+0.7} y2={by}
                  stroke="#8e44ad" stroke-width={0.15/scale} />
                <text x={L.boardRight + 1.5} y={(by + rightEdgeCrossings[i-1]) / 2 + 0.3}
                  text-anchor="middle" font-size={fs} fill="#333"
                  transform="rotate(90, {L.boardRight + 1.5}, {(by + rightEdgeCrossings[i-1]) / 2 + 0.3})">
                  {fmtFrac(dist)}
                </text>
              {/if}
            {/if}
          {/each}

          <!-- Cut labels on the stringer outline -->
          {#each L.notches as notch, i}
            {@const riserX = notch.riserX}
            {@const treadY = notch.treadY}
            {@const prevY = i > 0 ? L.notchY(i - 1) : 0}
            {@const td = notch.td}
            {@const tS = L.toBoard(riserX, treadY)}
            {@const tE = L.toBoard(riserX + td, treadY)}
            {@const rB = L.toBoard(riserX, prevY)}
            <text x={(tS.bx+tE.bx)/2} y={(tS.by+tE.by)/2 - 0.5}
              text-anchor="middle" font-size={fs} fill="#2980b9">
              {fmtFrac(td)} T{i+1}
            </text>
            <text x={(rB.bx+tS.bx)/2 - 0.8} y={(rB.by+tS.by)/2}
              text-anchor="end" font-size={fs} fill="#e67e22">
              {fmtFrac(treadY - prevY)} R{i+1}
            </text>
          {/each}

          <!-- Seat and plumb labels -->
          <text x={(L.seatEnd.bx+L.seatOrigin.bx)/2} y={(L.seatEnd.by+L.seatOrigin.by)/2 - 0.5}
            text-anchor="middle" font-size={fs} fill="#27ae60">
            {fmtFrac(L.seatEndXCalc)} seat
          </text>
          {#if true}
            {@const pTop = L.toBoard(L.topX, L.topY)}
            {@const pBot = L.toBoard(L.topX, L.botAtX0 + L.topX * L.slopeRatio)}
            {@const pLen = L.topY - (L.botAtX0 + L.topX * L.slopeRatio)}
            <text x={(pTop.bx+pBot.bx)/2 + 1.5} y={(pTop.by+pBot.by)/2}
              text-anchor="start" font-size={fs} fill="#27ae60">
              {fmtFrac(pLen)} plumb
            </text>
          {/if}

        <!-- Bottom edge (uncut) label -->
        <text x={(L.boardLeft + L.boardRight) / 2} y={L.sw + 3}
          text-anchor="middle" font-size={1} fill="#7f8c8d">
          bottom edge (uncut)
        </text>
        {/if}
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
