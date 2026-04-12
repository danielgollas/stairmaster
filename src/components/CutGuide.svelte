<script>
  let { sceneParams = null } = $props();

  let svgWidth = $state(800);
  let svgHeight = $state(300);
  let container;
  let svgEl;

  // Pan and zoom state
  let viewX = $state(0);
  let viewY = $state(0);
  let viewW = $state(0);
  let viewH = $state(0);
  let isPanning = $state(false);
  let panStart = { x: 0, y: 0, vx: 0, vy: 0 };

  // Init view when layout changes
  $effect(() => {
    if (layout && viewW === 0) {
      const margin = 15;
      const totalW = layout.maxBx - layout.minBx + margin * 2;
      const totalH = layout.maxBy - layout.minBy + margin * 2;
      const s = Math.min(svgWidth / totalW, svgHeight / totalH, 8);
      viewX = 0;
      viewY = 0;
      viewW = totalW * s;
      viewH = totalH * s;
    }
  });

  function handleWheel(e) {
    e.preventDefault();
    const rect = svgEl.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width * viewW + viewX;
    const my = (e.clientY - rect.top) / rect.height * viewH + viewY;
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;
    const nw = viewW * factor;
    const nh = viewH * factor;
    viewX = mx - (mx - viewX) * factor;
    viewY = my - (my - viewY) * factor;
    viewW = nw;
    viewH = nh;
  }

  function handleMouseDown(e) {
    if (e.button !== 0) return;
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY, vx: viewX, vy: viewY };
  }

  function handleMouseMove(e) {
    if (!isPanning) return;
    const rect = svgEl.getBoundingClientRect();
    const dx = (e.clientX - panStart.x) / rect.width * viewW;
    const dy = (e.clientY - panStart.y) / rect.height * viewH;
    viewX = panStart.vx - dx;
    viewY = panStart.vy - dy;
  }

  function handleMouseUp() {
    isPanning = false;
  }

  function resetView() {
    viewW = 0;  // triggers re-init
  }

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

    // Simple sawtooth: inside corner → tread nose → inside corner → tread nose
    // Each tread is full `run` wide. Riser is full `rise` tall. No rb pockets.
    // 11 points total — path AND dots use the same points.
    const pts = [];

    // 1. Seat heel
    pts.push(toBoard(seatEndX, 0));
    // 2. Seat origin (first riser bottom)
    pts.push(toBoard(0, 0));

    // 3-10. Alternating: inside corner, tread nose
    for (let i = 0; i < n; i++) {
      const treadY = notchY(i);
      // Inside corner: where riser meets tread (same X as previous tread nose)
      pts.push(toBoard(i * run, treadY));
      // Tread nose: end of tread (same X as next riser)
      const noseX = (i === n - 1) ? topX : (i + 1) * run;
      pts.push(toBoard(noseX, treadY));
    }

    // 11. Plumb bottom
    pts.push(toBoard(topX, botAtX0 + topX * slopeRatio));

    // Path and dots are the same 11 points
    const cutMarks = pts;

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
      pts, cutMarks, boardBotLeft, boardBotRight, topPlumbTop, topPlumbBot,
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
      bind:this={svgEl}
      viewBox="{viewX} {viewY} {viewW} {viewH}"
      width="100%"
      height="100%"
      style="background: white; cursor: {isPanning ? 'grabbing' : 'grab'};"
      onwheel={handleWheel}
      onmousedown={handleMouseDown}
      onmousemove={handleMouseMove}
      onmouseup={handleMouseUp}
      onmouseleave={handleMouseUp}
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

        <!-- Cut lines (stringer outline) -->
        <path
          d={pathD(L.pts)}
          fill="rgba(180, 120, 40, 0.3)"
          stroke="#c0392b"
          stroke-width={0.8 / scale}
          stroke-dasharray="{2 / scale},{1 / scale}"
        />

        <!-- Edge measurements: project cut vertices onto each edge -->
        {#if true}
          {@const efs = 0.5}
          {@const eoff = 1.5}
          {@const etk = 0.3}

          <!-- Project each cut vertex onto its nearest edge only -->
          {@const edgeProjections = (() => {
            const top = new Set([L.boardLeft, L.boardRight]);
            const bot = new Set([L.boardLeft, L.boardRight]);
            const left = new Set([0, L.sw]);
            const right = new Set([0, L.sw]);
            for (const pt of L.cutMarks) {
              const dTop = pt.by;
              const dBot = L.sw - pt.by;
              const dLeft = pt.bx - L.boardLeft;
              const dRight = L.boardRight - pt.bx;
              const min = Math.min(dTop, dBot, dLeft, dRight);
              if (min === dTop) top.add(Math.round(pt.bx * 100) / 100);
              else if (min === dBot) bot.add(Math.round(pt.bx * 100) / 100);
              else if (min === dLeft) left.add(Math.round(Math.max(0, Math.min(L.sw, pt.by)) * 100) / 100);
              else right.add(Math.round(Math.max(0, Math.min(L.sw, pt.by)) * 100) / 100);
            }
            return {
              top: [...top].sort((a,b) => a-b),
              bot: [...bot].sort((a,b) => a-b),
              left: [...left].sort((a,b) => a-b),
              right: [...right].sort((a,b) => a-b),
            };
          })()}
          {@const edgeBxTop = edgeProjections.top}
          {@const edgeBxBot = edgeProjections.bot}
          {@const edgeByLeft = edgeProjections.left}
          {@const edgeByRight = edgeProjections.right}

          <!-- Top edge measurements -->
          {#each edgeBxTop as bx, i}
            {#if i > 0}
              {@const prev = edgeBxTop[i-1]}
              {@const dist = bx - prev}
              {#if dist > 0.3}
                <line x1={prev} y1={-eoff} x2={bx} y2={-eoff} stroke="#2980b9" stroke-width={0.08} />
                <line x1={prev} y1={-eoff-etk} x2={prev} y2={-eoff+etk} stroke="#2980b9" stroke-width={0.08} />
                <line x1={bx} y1={-eoff-etk} x2={bx} y2={-eoff+etk} stroke="#2980b9" stroke-width={0.08} />
                <line x1={prev} y1={0} x2={prev} y2={-eoff} stroke="#2980b9" stroke-width={0.05} opacity={0.3} />
                <line x1={bx} y1={0} x2={bx} y2={-eoff} stroke="#2980b9" stroke-width={0.05} opacity={0.3} />
                <text x={(prev+bx)/2} y={-eoff-0.4} text-anchor="middle" font-size={efs} fill="#2980b9">
                  {fmtFrac(dist)}
                </text>
              {/if}
            {/if}
          {/each}

          <!-- Bottom edge measurements -->
          {#each edgeBxBot as bx, i}
            {#if i > 0}
              {@const prev = edgeBxBot[i-1]}
              {@const dist = bx - prev}
              {#if dist > 0.3}
                <line x1={prev} y1={L.sw+eoff} x2={bx} y2={L.sw+eoff} stroke="#c0392b" stroke-width={0.08} />
                <line x1={prev} y1={L.sw+eoff-etk} x2={prev} y2={L.sw+eoff+etk} stroke="#c0392b" stroke-width={0.08} />
                <line x1={bx} y1={L.sw+eoff-etk} x2={bx} y2={L.sw+eoff+etk} stroke="#c0392b" stroke-width={0.08} />
                <line x1={prev} y1={L.sw} x2={prev} y2={L.sw+eoff} stroke="#c0392b" stroke-width={0.05} opacity={0.3} />
                <line x1={bx} y1={L.sw} x2={bx} y2={L.sw+eoff} stroke="#c0392b" stroke-width={0.05} opacity={0.3} />
                <text x={(prev+bx)/2} y={L.sw+eoff+0.8} text-anchor="middle" font-size={efs} fill="#c0392b">
                  {fmtFrac(dist)}
                </text>
              {/if}
            {/if}
          {/each}

          <!-- Left edge measurements -->
          {#each edgeByLeft as by, i}
            {#if i > 0}
              {@const prev = edgeByLeft[i-1]}
              {@const dist = by - prev}
              {#if dist > 0.3}
                <line x1={L.boardLeft-eoff} y1={prev} x2={L.boardLeft-eoff} y2={by} stroke="#27ae60" stroke-width={0.08} />
                <line x1={L.boardLeft-eoff-etk} y1={prev} x2={L.boardLeft-eoff+etk} y2={prev} stroke="#27ae60" stroke-width={0.08} />
                <line x1={L.boardLeft-eoff-etk} y1={by} x2={L.boardLeft-eoff+etk} y2={by} stroke="#27ae60" stroke-width={0.08} />
                <line x1={L.boardLeft} y1={prev} x2={L.boardLeft-eoff} y2={prev} stroke="#27ae60" stroke-width={0.05} opacity={0.3} />
                <line x1={L.boardLeft} y1={by} x2={L.boardLeft-eoff} y2={by} stroke="#27ae60" stroke-width={0.05} opacity={0.3} />
                <text x={L.boardLeft-eoff-0.5} y={(prev+by)/2+0.2} text-anchor="middle" font-size={efs} fill="#27ae60"
                  transform="rotate(-90, {L.boardLeft-eoff-0.5}, {(prev+by)/2+0.2})">
                  {fmtFrac(dist)}
                </text>
              {/if}
            {/if}
          {/each}

          <!-- Right edge measurements -->
          {#each edgeByRight as by, i}
            {#if i > 0}
              {@const prev = edgeByRight[i-1]}
              {@const dist = by - prev}
              {#if dist > 0.3}
                <line x1={L.boardRight+eoff} y1={prev} x2={L.boardRight+eoff} y2={by} stroke="#8e44ad" stroke-width={0.08} />
                <line x1={L.boardRight+eoff-etk} y1={prev} x2={L.boardRight+eoff+etk} y2={prev} stroke="#8e44ad" stroke-width={0.08} />
                <line x1={L.boardRight+eoff-etk} y1={by} x2={L.boardRight+eoff+etk} y2={by} stroke="#8e44ad" stroke-width={0.08} />
                <line x1={L.boardRight} y1={prev} x2={L.boardRight+eoff} y2={prev} stroke="#8e44ad" stroke-width={0.05} opacity={0.3} />
                <line x1={L.boardRight} y1={by} x2={L.boardRight+eoff} y2={by} stroke="#8e44ad" stroke-width={0.05} opacity={0.3} />
                <text x={L.boardRight+eoff+0.5} y={(prev+by)/2+0.2} text-anchor="middle" font-size={efs} fill="#8e44ad"
                  transform="rotate(90, {L.boardRight+eoff+0.5}, {(prev+by)/2+0.2})">
                  {fmtFrac(dist)}
                </text>
              {/if}
            {/if}
          {/each}

          <!-- Board width label -->
          <text x={L.boardLeft - 4} y={L.sw / 2} text-anchor="middle" font-size={1.2} fill="#333"
            transform="rotate(-90, {L.boardLeft - 4}, {L.sw / 2})">
            {L.sw}" (2x12)
          </text>
        {/if}

        <!-- Edge measurements: dots where cuts cross board edges, distances between them -->
        {#if true}
          {@const fs = 0.8}
          {@const dotR = 0.3}

          <!-- Build cut vertices analytically — each is an explicit point -->
          {@const cutVertices = (() => {
            const v = [];
            const tb = L.toBoard;

            // Use the 11 cut marks (subset of path points)
            for (const pt of L.cutMarks) {
              v.push(pt);
            }

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

          <!-- Draw all labeled dots -->
          {#each allPoints as pt}
            {@const color = pt.edge === 'corner' ? '#333' : '#c0392b'}
            <circle cx={pt.bx} cy={pt.by} r={dotR} fill={color} />
            <text x={pt.bx + 0.5} y={pt.by - 0.4} text-anchor="start" font-size={0.55} fill={color} font-weight="bold">
              {pt.letter}
            </text>
          {/each}

          <!-- Dimension lines between consecutive cut vertices, parallel to each segment -->
          {@const off = 1.2}
          {#each cutVertices as pt, i}
            {#if i > 0}
              {@const p1 = cutVertices[i-1]}
              {@const p2 = pt}
              {@const dx = p2.bx - p1.bx}
              {@const dy = p2.by - p1.by}
              {@const len = Math.sqrt(dx*dx + dy*dy)}
              {@const angle = Math.atan2(dy, dx) * 180 / Math.PI}
              <!-- Perpendicular normal for offset -->
              {@const nx = -dy/len}
              {@const ny = dx/len}
              <!-- Dimension line offset from the cut -->
              {@const d1x = p1.bx + nx*off}
              {@const d1y = p1.by + ny*off}
              {@const d2x = p2.bx + nx*off}
              {@const d2y = p2.by + ny*off}
              {@const mx = (d1x+d2x)/2}
              {@const my = (d1y+d2y)/2}
              <!-- Installed-frame distance (not board-frame) -->
              {@const instLen = (() => {
                // Compute distance in installed coords from the cut mark indices
                // Seat: seatEndX to 0, Risers: rise, Treads: run, Plumb: plumb length
                if (i === 1) return L.seatEndXCalc;  // seat
                if (i === cutVertices.length - 1) return L.topY - (L.botAtX0 + L.topX * L.slopeRatio);  // plumb
                // Odd indices (after seat): inside corners → treads
                // Even indices: tread noses → risers
                if (i % 2 === 0) return L.run;  // tread (full run)
                else return L.notchY(Math.floor((i-2)/2)) - (Math.floor((i-2)/2) > 0 ? L.notchY(Math.floor((i-2)/2)-1) : 0);  // riser
              })()}
              {@const label = (() => {
                if (i === 1) return fmtFrac(instLen) + ' seat';
                if (i === cutVertices.length - 1) return fmtFrac(instLen) + ' plumb';
                if (i % 2 === 0) return fmtFrac(instLen) + ' T' + (i/2);
                return fmtFrac(instLen) + ' R' + (Math.ceil(i/2));
              })()}
              <!-- Extension lines -->
              <line x1={p1.bx} y1={p1.by} x2={d1x} y2={d1y} stroke="#666" stroke-width={0.08} opacity={0.4} />
              <line x1={p2.bx} y1={p2.by} x2={d2x} y2={d2y} stroke="#666" stroke-width={0.08} opacity={0.4} />
              <!-- Dimension line -->
              <line x1={d1x} y1={d1y} x2={d2x} y2={d2y} stroke="#333" stroke-width={0.1} />
              <!-- Tick marks -->
              {@const tk = 0.4}
              <line x1={d1x-nx*tk/2} y1={d1y-ny*tk/2} x2={d1x+nx*tk/2} y2={d1y+ny*tk/2} stroke="#333" stroke-width={0.1} />
              <line x1={d2x-nx*tk/2} y1={d2y-ny*tk/2} x2={d2x+nx*tk/2} y2={d2y+ny*tk/2} stroke="#333" stroke-width={0.1} />
              <!-- Label rotated parallel to line -->
              {@const textAngle = angle > 90 || angle < -90 ? angle + 180 : angle}
              <text x={mx} y={my - 0.3} text-anchor="middle" font-size={0.55} fill="#333"
                transform="rotate({textAngle}, {mx}, {my - 0.3})">
                {label}
              </text>
            {/if}
          {/each}

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
