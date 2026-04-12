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

        <!-- Detailed measurements for each cut -->
        {#if true}
        {@const tk = 0.6}
        {@const dimOff = 1.8}
        {#each L.notches as notch, i}
          {@const riserX = notch.riserX}
          {@const treadY = notch.treadY}
          {@const prevY = i > 0 ? L.notchY(i - 1) : 0}
          {@const td = notch.td}
          {@const rb = L.rb}

          <!-- Tread cut: dimension line with ticks -->
          {@const tS = L.toBoard(riserX + rb, treadY)}
          {@const tE = L.toBoard(riserX + td, treadY)}
          {@const tDx = tE.bx - tS.bx}
          {@const tDy = tE.by - tS.by}
          {@const tHyp = Math.sqrt(tDx*tDx + tDy*tDy)}
          {@const tNx = -tDy/tHyp}
          {@const tNy = tDx/tHyp}
          <!-- Extension lines from cut to dimension line -->
          <line x1={tS.bx} y1={tS.by} x2={tS.bx+tNx*dimOff} y2={tS.by+tNy*dimOff}
            stroke="#2980b9" stroke-width={0.15/scale} opacity={0.5} />
          <line x1={tE.bx} y1={tE.by} x2={tE.bx+tNx*dimOff} y2={tE.by+tNy*dimOff}
            stroke="#2980b9" stroke-width={0.15/scale} opacity={0.5} />
          <!-- Dimension line -->
          {@const dS_bx = tS.bx+tNx*(dimOff-0.3)}
          {@const dS_by = tS.by+tNy*(dimOff-0.3)}
          {@const dE_bx = tE.bx+tNx*(dimOff-0.3)}
          {@const dE_by = tE.by+tNy*(dimOff-0.3)}
          <line x1={dS_bx} y1={dS_by} x2={dE_bx} y2={dE_by}
            stroke="#2980b9" stroke-width={0.25/scale} />
          <!-- Tick marks -->
          <line x1={dS_bx-tNx*tk/2} y1={dS_by-tNy*tk/2} x2={dS_bx+tNx*tk/2} y2={dS_by+tNy*tk/2}
            stroke="#2980b9" stroke-width={0.25/scale} />
          <line x1={dE_bx-tNx*tk/2} y1={dE_by-tNy*tk/2} x2={dE_bx+tNx*tk/2} y2={dE_by+tNy*tk/2}
            stroke="#2980b9" stroke-width={0.25/scale} />
          <text x={(dS_bx+dE_bx)/2+tNx*0.8} y={(dS_by+dE_by)/2+tNy*0.8}
            text-anchor="middle" font-size={1.1} fill="#2980b9">
            {fmtFrac(td)} T{i+1}
          </text>

          <!-- Riser cut: dimension line with ticks -->
          {@const rB = L.toBoard(riserX, prevY)}
          {@const rT = L.toBoard(riserX, treadY)}
          {@const rDx = rT.bx - rB.bx}
          {@const rDy = rT.by - rB.by}
          {@const rHyp = Math.sqrt(rDx*rDx + rDy*rDy)}
          {@const rNx = -rDy/rHyp}
          {@const rNy = rDx/rHyp}
          <line x1={rB.bx} y1={rB.by} x2={rB.bx-tNx*dimOff} y2={rB.by-tNy*dimOff}
            stroke="#e67e22" stroke-width={0.15/scale} opacity={0.5} />
          <line x1={rT.bx} y1={rT.by} x2={rT.bx-tNx*dimOff} y2={rT.by-tNy*dimOff}
            stroke="#e67e22" stroke-width={0.15/scale} opacity={0.5} />
          {@const rdS_bx = rB.bx-tNx*(dimOff-0.3)}
          {@const rdS_by = rB.by-tNy*(dimOff-0.3)}
          {@const rdE_bx = rT.bx-tNx*(dimOff-0.3)}
          {@const rdE_by = rT.by-tNy*(dimOff-0.3)}
          <line x1={rdS_bx} y1={rdS_by} x2={rdE_bx} y2={rdE_by}
            stroke="#e67e22" stroke-width={0.25/scale} />
          <line x1={rdS_bx+rNx*tk/2} y1={rdS_by+rNy*tk/2} x2={rdS_bx-rNx*tk/2} y2={rdS_by-rNy*tk/2}
            stroke="#e67e22" stroke-width={0.25/scale} />
          <line x1={rdE_bx+rNx*tk/2} y1={rdE_by+rNy*tk/2} x2={rdE_bx-rNx*tk/2} y2={rdE_by-rNy*tk/2}
            stroke="#e67e22" stroke-width={0.25/scale} />
          <text x={(rdS_bx+rdE_bx)/2-tNx*0.8} y={(rdS_by+rdE_by)/2-tNy*0.8}
            text-anchor="middle" font-size={1.1} fill="#e67e22">
            {fmtFrac(treadY - prevY)} R{i+1}
          </text>

          <!-- Small notch marks at cut intersections on the board edge -->
          <!-- Tick at riser top (where riser meets tread) -->
          {@const rTick = L.toBoard(riserX, treadY)}
          <circle cx={rTick.bx} cy={rTick.by} r={0.4} fill="#c0392b" />
          <!-- Tick at tread end -->
          {@const tTick = L.toBoard(riserX + td, treadY)}
          <circle cx={tTick.bx} cy={tTick.by} r={0.4} fill="#c0392b" />
          <!-- Tick at riser bottom -->
          {@const rBTick = L.toBoard(riserX, prevY)}
          <circle cx={rBTick.bx} cy={rBTick.by} r={0.4} fill="#c0392b" />
        {/each}

        <!-- Seat bearing dimension with ticks -->
        {#if true}
          {@const seatLen = L.seatEndXCalc}
          {@const sS = L.seatEnd}
          {@const sE = L.seatOrigin}
          {@const sDx = sE.bx - sS.bx}
          {@const sDy = sE.by - sS.by}
          {@const sHyp = Math.sqrt(sDx*sDx + sDy*sDy)}
          {@const sNx = -sDy/sHyp}
          {@const sNy = sDx/sHyp}
          <!-- Extension lines -->
          <line x1={sS.bx} y1={sS.by} x2={sS.bx+sNx*dimOff} y2={sS.by+sNy*dimOff}
            stroke="#27ae60" stroke-width={0.15/scale} opacity={0.5} />
          <line x1={sE.bx} y1={sE.by} x2={sE.bx+sNx*dimOff} y2={sE.by+sNy*dimOff}
            stroke="#27ae60" stroke-width={0.15/scale} opacity={0.5} />
          {@const sdS_bx = sS.bx+sNx*(dimOff-0.3)}
          {@const sdS_by = sS.by+sNy*(dimOff-0.3)}
          {@const sdE_bx = sE.bx+sNx*(dimOff-0.3)}
          {@const sdE_by = sE.by+sNy*(dimOff-0.3)}
          <line x1={sdS_bx} y1={sdS_by} x2={sdE_bx} y2={sdE_by}
            stroke="#27ae60" stroke-width={0.3/scale} />
          <line x1={sdS_bx+sNx*tk/2} y1={sdS_by+sNy*tk/2} x2={sdS_bx-sNx*tk/2} y2={sdS_by-sNy*tk/2}
            stroke="#27ae60" stroke-width={0.3/scale} />
          <line x1={sdE_bx+sNx*tk/2} y1={sdE_by+sNy*tk/2} x2={sdE_bx-sNx*tk/2} y2={sdE_by-sNy*tk/2}
            stroke="#27ae60" stroke-width={0.3/scale} />
          <text x={(sdS_bx+sdE_bx)/2+sNx*1} y={(sdS_by+sdE_by)/2+sNy*1}
            text-anchor="middle" font-size={1.2} fill="#27ae60">
            {fmtFrac(seatLen)} seat
          </text>
        {/if}

        <!-- Top plumb cut dimension with ticks -->
        {#if true}
          {@const pT = L.toBoard(L.topX, L.topY)}
          {@const pB = L.toBoard(L.topX, L.botAtX0 + L.topX * L.slopeRatio)}
          {@const pLen = L.topY - (L.botAtX0 + L.topX * L.slopeRatio)}
          {@const pDx = pT.bx - pB.bx}
          {@const pDy = pT.by - pB.by}
          {@const pHyp = Math.sqrt(pDx*pDx + pDy*pDy)}
          {@const pNx = pDy/pHyp}
          {@const pNy = -pDx/pHyp}
          <!-- Extension lines to board edges -->
          <line x1={pT.bx} y1={pT.by} x2={pT.bx+pNx*dimOff} y2={pT.by+pNy*dimOff}
            stroke="#27ae60" stroke-width={0.15/scale} opacity={0.5} />
          <line x1={pB.bx} y1={pB.by} x2={pB.bx+pNx*dimOff} y2={pB.by+pNy*dimOff}
            stroke="#27ae60" stroke-width={0.15/scale} opacity={0.5} />
          {@const pdS_bx = pB.bx+pNx*(dimOff-0.3)}
          {@const pdS_by = pB.by+pNy*(dimOff-0.3)}
          {@const pdE_bx = pT.bx+pNx*(dimOff-0.3)}
          {@const pdE_by = pT.by+pNy*(dimOff-0.3)}
          <line x1={pdS_bx} y1={pdS_by} x2={pdE_bx} y2={pdE_by}
            stroke="#27ae60" stroke-width={0.3/scale} />
          <line x1={pdS_bx-pNx*tk/2} y1={pdS_by-pNy*tk/2} x2={pdS_bx+pNx*tk/2} y2={pdS_by+pNy*tk/2}
            stroke="#27ae60" stroke-width={0.3/scale} />
          <line x1={pdE_bx-pNx*tk/2} y1={pdE_by-pNy*tk/2} x2={pdE_bx+pNx*tk/2} y2={pdE_by+pNy*tk/2}
            stroke="#27ae60" stroke-width={0.3/scale} />
          <text x={(pdS_bx+pdE_bx)/2+pNx*1.2} y={(pdS_by+pdE_by)/2+pNy*1.2}
            text-anchor="middle" font-size={1.2} fill="#27ae60">
            {fmtFrac(pLen)} plumb
          </text>
          <!-- Dashed lines from plumb cut to board edges -->
          <line x1={pT.bx} y1={pT.by} x2={pT.bx} y2={0}
            stroke="#c0392b" stroke-width={0.15/scale} stroke-dasharray="{0.5/scale},{0.5/scale}" opacity={0.3} />
          <line x1={pB.bx} y1={pB.by} x2={pB.bx} y2={L.sw}
            stroke="#c0392b" stroke-width={0.15/scale} stroke-dasharray="{0.5/scale},{0.5/scale}" opacity={0.3} />
        {/if}

        <!-- Seat cut lines to board edges -->
        {#if true}
          <line x1={L.seatEnd.bx} y1={L.seatEnd.by} x2={L.seatEnd.bx} y2={L.sw}
            stroke="#c0392b" stroke-width={0.15/scale} stroke-dasharray="{0.5/scale},{0.5/scale}" opacity={0.3} />
          <line x1={L.seatOrigin.bx} y1={L.seatOrigin.by} x2={L.seatOrigin.bx} y2={0}
            stroke="#c0392b" stroke-width={0.15/scale} stroke-dasharray="{0.5/scale},{0.5/scale}" opacity={0.3} />
        {/if}

        <!-- Bottom edge (uncut) label -->
        <text x={(L.boardLeft + L.boardRight) / 2} y={L.sw + 6}
          text-anchor="middle" font-size={1.5} fill="#7f8c8d">
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
