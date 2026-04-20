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
      // Include rail diagrams in bounding box
      let maxY = layout.maxBy;
      if (railLayout) {
        // Four rail diagrams stacked below the stringer
        maxY = layout.maxBy + 10 + 4 * (3.5 + 14);
      }
      const totalW = layout.maxBx - layout.minBx + margin * 2;
      const totalH = maxY - layout.minBy + margin * 2;
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

  function printCutGuide() {
    if (!svgEl) return;

    const gEl = svgEl.querySelector('g');
    if (!gEl) return;
    const gClone = gEl.cloneNode(true);
    gClone.removeAttribute('transform');

    const margin = 8;
    const minX = layout.minBx - margin;
    const maxX = layout.maxBx + margin;
    const fullW = maxX - minX;

    // Build list of content blocks with their Y ranges
    const blocks = [];

    // Stringer block: from top of content to below the stringer
    blocks.push({
      label: 'Stringer (2x12)',
      yMin: layout.minBy - margin,
      yMax: layout.maxBy + 5,
    });

    // Rail blocks
    if (railLayout) {
      const rails = [railLayout.topRail, railLayout.botRail, railLayout.vert1, railLayout.vert2];
      rails.forEach((rail, ri) => {
        const railOy = layout.maxBy + 10 + ri * (rail.boardW + 14);
        blocks.push({
          label: rail.label,
          yMin: railOy - 3,
          yMax: railOy + rail.boardW + 10,
        });
      });
    }

    // A4 landscape usable area
    const pageW = 277; // mm
    const pageH = 180; // mm
    const scale = pageW / fullW;
    const pageContentH = pageH / scale;

    // Page 1: stringer, Page 2: all rails
    const pages = [];
    if (blocks.length > 0) {
      pages.push({ yMin: blocks[0].yMin, yMax: blocks[0].yMax });
    }
    if (blocks.length > 1) {
      pages.push({ yMin: blocks[1].yMin, yMax: blocks[blocks.length - 1].yMax });
    }

    const gHTML = gClone.outerHTML;
    const totalPages = pages.length;

    let html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Stairmaster Cut Guide</title>
<style>
  @page { size: A4 landscape; margin: 15mm; }
  body { margin: 0; font-family: sans-serif; }
  .page { page-break-after: always; }
  .page:last-child { page-break-after: avoid; }
  .page-header { font-size: 9pt; color: #666; margin-bottom: 3mm; }
  svg { display: block; width: ${pageW}mm; }
</style>
</head><body>`;

    pages.forEach((page, pi) => {
      const vH = page.yMax - page.yMin;
      const svgH = vH * scale;
      const viewBox = `${minX} ${page.yMin} ${fullW} ${vH}`;

      html += `<div class="page">
  <div class="page-header">Stairmaster Cut Guide — Page ${pi + 1} of ${totalPages}</div>
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" style="height:${svgH}mm">
    ${gHTML}
  </svg>
</div>`;
    });

    html += '</body></html>';

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.onload = () => win.print();
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

  // Compute the railing rail layout on a flat 2x4 board
  let railLayout = $derived.by(() => {
    if (!sceneParams) return null;
    const p = sceneParams;
    const ps = p.postSize;
    const rFace = 3.5;   // 2x4 wide face (height of rail cross-section)
    const rNarrow = 1.5;  // 2x4 narrow face
    const postH = p.postHeight;
    const noseClearance = 3.5;

    // Post positions (same as scene-builder)
    const padShift = -p.riserBoardThickness;
    const postX = padShift + ps / 2;
    const rimX = p.totalRun - 1.5;
    const tpX = rimX + 1.5 + ps / 2;
    const topPostZ = p.totalHeight - p.deckingThickness;

    const bpZ = p.padAboveGrade;
    const bpTopZ = bpZ + postH;
    const tpZ = topPostZ;
    const tpTopZ = tpZ + postH;

    const bpInnerX = postX + ps / 2;
    const tpInnerX = tpX - ps / 2;

    // Rail slope = stringer slope so rails are parallel to stringers
    const railSlope = p.actualRiserHeight / p.treadDepth;
    const railAngle = Math.atan(railSlope);
    const railHyp = Math.sqrt(1 + railSlope * railSlope);
    const halfPerp = rFace / 2 * railHyp; // vertical half-span for rFace perpendicular width

    // Bottom rail: clears tread noses by noseClearance
    let botRailBaseZ = bpZ; // fallback
    for (let i = 0; i < p.numTreads; i++) {
      const noseX = i * p.treadDepth - p.riserBoardThickness;
      const noseZ = p.padAboveGrade + (i + 1) * p.actualRiserHeight;
      if (noseX >= bpInnerX && noseX <= tpInnerX) {
        const required = noseZ + noseClearance - (noseX - bpInnerX) * railSlope;
        botRailBaseZ = Math.max(botRailBaseZ, required);
      }
    }

    function makeRailLayout(label, corners) {
      // corners: [{x, z}...] in installed frame (4 points, CCW from bottom-left)
      // The piece is cut from a 2x4 board laid flat.
      // Rotate so the piece's longest edge aligns with the board's long axis.

      const blX = corners[0].x, blZ = corners[0].z;
      const tlX = corners[1].x, tlZ = corners[1].z;
      const trX = corners[2].x, trZ = corners[2].z;
      const brX = corners[3].x, brZ = corners[3].z;

      // Find the longest edge to determine the board's long axis direction
      const candidates = [
        { dx: brX - blX, dz: brZ - blZ }, // bottom edge (bl→br)
        { dx: tlX - blX, dz: tlZ - blZ }, // left edge (bl→tl)
      ];
      const botLen = Math.sqrt(candidates[0].dx ** 2 + candidates[0].dz ** 2);
      const leftLen = Math.sqrt(candidates[1].dx ** 2 + candidates[1].dz ** 2);

      // Use the longer edge as the board's long axis
      const longEdge = botLen >= leftLen ? candidates[0] : candidates[1];
      const pieceAngle = Math.atan2(longEdge.dz, longEdge.dx);

      // Transform: rotate by -pieceAngle so the long edge becomes horizontal
      // Origin at bottom-left corner
      function toBoard(x, z) {
        const dx = x - blX;
        const dz = z - blZ;
        const bx = dx * Math.cos(pieceAngle) + dz * Math.sin(pieceAngle);
        const by = -dx * Math.sin(pieceAngle) + dz * Math.cos(pieceAngle);
        return { bx, by };
      }

      const pts = [
        toBoard(blX, blZ),  // bottom-left (should be ~(0, 0))
        toBoard(tlX, tlZ),  // top-left (plumb cut)
        toBoard(trX, trZ),  // top-right (plumb cut)
        toBoard(brX, brZ),  // bottom-right (should be ~(botLen, 0))
      ];

      // Board rectangle: the 2x4 stock that contains this shape
      let minBx = Infinity, maxBx = -Infinity, minBy = Infinity, maxBy = -Infinity;
      for (const pt of pts) {
        minBx = Math.min(minBx, pt.bx);
        maxBx = Math.max(maxBx, pt.bx);
        minBy = Math.min(minBy, pt.by);
        maxBy = Math.max(maxBy, pt.by);
      }

      // Shift points so the board top edge is at by=0
      for (const pt of pts) {
        pt.bx -= minBx;
        pt.by -= minBy;
      }

      const boardLeft = 0;
      const boardRight = maxBx - minBx;
      const boardW = maxBy - minBy; // should be ~rFace

      const cutMarks = pts;

      // Installed-frame lengths of each edge
      const edges = [
        { from: 0, to: 1, label: 'left plumb', len: Math.sqrt((tlX-blX)**2 + (tlZ-blZ)**2) },
        { from: 1, to: 2, label: 'top edge', len: Math.sqrt((trX-tlX)**2 + (trZ-tlZ)**2) },
        { from: 2, to: 3, label: 'right plumb', len: Math.sqrt((brX-trX)**2 + (brZ-trZ)**2) },
        { from: 3, to: 0, label: 'bottom edge', len: Math.sqrt((blX-brX)**2 + (blZ-brZ)**2) },
      ];

      return {
        label, pts, cutMarks, edges,
        boardLeft, boardRight, boardW,
        minBx: boardLeft, maxBx: boardRight, minBy: 0, maxBy: boardW,
        railAngle, botLen,
      };
    }

    // Top rail: top edge flush with bottom post top
    const topRailTopBp = bpTopZ;
    const topRailBotBp = bpTopZ - 2 * halfPerp;
    const topRailTopTp = bpTopZ + (tpInnerX - bpInnerX) * railSlope;
    const topRailBotTp = topRailTopTp - 2 * halfPerp;

    const topRail = makeRailLayout('Top Rail (2x4)', [
      { x: bpInnerX, z: topRailBotBp },      // bottom-left
      { x: bpInnerX, z: topRailTopBp },       // top-left
      { x: tpInnerX, z: topRailTopTp },       // top-right
      { x: tpInnerX, z: topRailBotTp },       // bottom-right
    ]);

    // Bottom rail
    const botRailTopBp = botRailBaseZ + 2 * halfPerp;
    const botRailBaseAtTp = botRailBaseZ + (tpInnerX - bpInnerX) * railSlope;
    const botRailTopTp = botRailBaseAtTp + 2 * halfPerp;

    const botRail = makeRailLayout('Bottom Rail (2x4)', [
      { x: bpInnerX, z: botRailBaseZ },       // bottom-left
      { x: bpInnerX, z: botRailTopBp },        // top-left
      { x: tpInnerX, z: botRailTopTp },        // top-right
      { x: tpInnerX, z: botRailBaseAtTp },     // bottom-right
    ]);

    // Vertical members: 2x4 with angled cuts at top and bottom
    // The vertical has its long axis in Z, with rNarrow (1.5") in X.
    // Top cut angle and bottom cut angle match the rail slope.
    // In installed frame: 4 corners at (vx +/- rNarrow/2, zBot/zTop with slope offset)
    const vInset = 3.5;
    const halfW = rFace / 2;

    function topRailBotAt(x) { return bpTopZ + (x - bpInnerX) * railSlope - 2 * halfPerp; }
    function botRailTopAt(x) { return botRailBaseZ + 2 * halfPerp + (x - bpInnerX) * railSlope; }

    // Near bottom post
    const v1x = bpInnerX + vInset;
    const v1 = makeRailLayout('Vertical near bottom post (2x4)', [
      { x: v1x - halfW, z: botRailTopAt(v1x - halfW) },   // bottom-left
      { x: v1x - halfW, z: topRailBotAt(v1x - halfW) },   // top-left
      { x: v1x + halfW, z: topRailBotAt(v1x + halfW) },   // top-right
      { x: v1x + halfW, z: botRailTopAt(v1x + halfW) },   // bottom-right
    ]);

    // Near top post
    const v2x = tpInnerX - vInset;
    const v2 = makeRailLayout('Vertical near top post (2x4)', [
      { x: v2x - halfW, z: botRailTopAt(v2x - halfW) },
      { x: v2x - halfW, z: topRailBotAt(v2x - halfW) },
      { x: v2x + halfW, z: topRailBotAt(v2x + halfW) },
      { x: v2x + halfW, z: botRailTopAt(v2x + halfW) },
    ]);

    return { topRail, botRail, vert1: v1, vert2: v2 };
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

    <div class="cut-toolbar">
      <button onclick={printCutGuide} title="Print or save as PDF">Print / PDF</button>
      <button onclick={resetView} title="Reset zoom and pan">Reset View</button>
    </div>

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

          <!-- Perpendicular lines from each cut vertex to nearest edge (tape + square method) -->
          {#each cutVertices as pt, i}
            {#if true}
              {@const dTop = pt.by}
              {@const dBot = L.sw - pt.by}
              {@const dLeft = pt.bx - L.boardLeft}
              {@const dRight = L.boardRight - pt.bx}
              {@const minD = Math.min(dTop, dBot, dLeft, dRight)}
              {@const perpDist = minD}
              <!-- Draw perpendicular line to nearest edge -->
              {#if minD === dTop && dTop > 0.3}
                <line x1={pt.bx} y1={pt.by} x2={pt.bx} y2={0}
                  stroke="#2980b9" stroke-width={0.06} stroke-dasharray="0.3,0.2" opacity={0.6} />
                <text x={pt.bx + 0.3} y={pt.by / 2} text-anchor="start" font-size={0.4} fill="#2980b9"
                  transform="rotate(-90, {pt.bx + 0.3}, {pt.by / 2})">
                  {fmtFrac(perpDist)}
                </text>
              {:else if minD === dBot && dBot > 0.3}
                <line x1={pt.bx} y1={pt.by} x2={pt.bx} y2={L.sw}
                  stroke="#c0392b" stroke-width={0.06} stroke-dasharray="0.3,0.2" opacity={0.6} />
                <text x={pt.bx + 0.3} y={(pt.by + L.sw) / 2} text-anchor="start" font-size={0.4} fill="#c0392b"
                  transform="rotate(-90, {pt.bx + 0.3}, {(pt.by + L.sw) / 2})">
                  {fmtFrac(perpDist)}
                </text>
              {:else if minD === dLeft && dLeft > 0.3}
                <line x1={pt.bx} y1={pt.by} x2={L.boardLeft} y2={pt.by}
                  stroke="#27ae60" stroke-width={0.06} stroke-dasharray="0.3,0.2" opacity={0.6} />
                <text x={(pt.bx + L.boardLeft) / 2} y={pt.by - 0.3} text-anchor="middle" font-size={0.4} fill="#27ae60">
                  {fmtFrac(perpDist)}
                </text>
              {:else if minD === dRight && dRight > 0.3}
                <line x1={pt.bx} y1={pt.by} x2={L.boardRight} y2={pt.by}
                  stroke="#8e44ad" stroke-width={0.06} stroke-dasharray="0.3,0.2" opacity={0.6} />
                <text x={(pt.bx + L.boardRight) / 2} y={pt.by - 0.3} text-anchor="middle" font-size={0.4} fill="#8e44ad">
                  {fmtFrac(perpDist)}
                </text>
              {/if}
            {/if}
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

        <!-- Rail cut diagrams -->
        {#if railLayout}
          {#each [railLayout.topRail, railLayout.botRail, railLayout.vert1, railLayout.vert2] as rail, ri}
            {@const railOy = L.maxBy + 10 + ri * (rail.boardW + 14)}
            {@const rMargin = 2}

            <!-- Title -->
            <text x={rail.boardLeft} y={railOy - 1.5}
              font-size={0.9} fill="#333" font-weight="bold">
              {rail.label} (qty: 2)
            </text>

            <!-- Board rectangle -->
            <rect
              x={rail.boardLeft}
              y={railOy}
              width={rail.boardRight - rail.boardLeft}
              height={rail.boardW}
              fill="#f5e6c8"
              stroke="#a0784c"
              stroke-width={0.5 / scale}
            />

            <!-- Cut shape -->
            <path
              d={'M ' + rail.pts.map(p => `${p.bx.toFixed(2)},${(p.by + railOy).toFixed(2)}`).join(' L ') + ' Z'}
              fill="rgba(180, 120, 40, 0.3)"
              stroke="#c0392b"
              stroke-width={0.8 / scale}
              stroke-dasharray="{2 / scale},{1 / scale}"
            />

            <!-- Labeled dots at each cut vertex -->
            {#each rail.cutMarks as pt, pi}
              {@const letter = String.fromCharCode(65 + pi)}
              {@const py = pt.by + railOy}
              <circle cx={pt.bx} cy={py} r={0.3} fill="#c0392b" />
              <text x={pt.bx + 0.5} y={py - 0.4} text-anchor="start" font-size={0.55} fill="#c0392b" font-weight="bold">
                {letter}
              </text>
            {/each}

            <!-- Board corner dots -->
            {#each [[rail.boardLeft, railOy], [rail.boardRight, railOy], [rail.boardRight, railOy + rail.boardW], [rail.boardLeft, railOy + rail.boardW]] as [cx, cy], ci}
              <circle {cx} {cy} r={0.25} fill="#333" />
            {/each}

            <!-- Perpendicular lines from each cut vertex to nearest edge -->
            {#each rail.cutMarks as pt, pi}
              {@const py = pt.by + railOy}
              {@const dTop = pt.by}
              {@const dBot = rail.boardW - pt.by}
              {@const dLeft = pt.bx - rail.boardLeft}
              {@const dRight = rail.boardRight - pt.bx}
              {@const minD = Math.min(dTop, dBot, dLeft, dRight)}
              {#if minD === dTop && dTop > 0.2}
                <line x1={pt.bx} y1={py} x2={pt.bx} y2={railOy}
                  stroke="#2980b9" stroke-width={0.06} stroke-dasharray="0.3,0.2" opacity={0.6} />
                <text x={pt.bx + 0.3} y={(py + railOy) / 2} text-anchor="start" font-size={0.4} fill="#2980b9"
                  transform="rotate(-90, {pt.bx + 0.3}, {(py + railOy) / 2})">
                  {fmtFrac(minD)}
                </text>
              {:else if minD === dBot && dBot > 0.2}
                <line x1={pt.bx} y1={py} x2={pt.bx} y2={railOy + rail.boardW}
                  stroke="#c0392b" stroke-width={0.06} stroke-dasharray="0.3,0.2" opacity={0.6} />
                <text x={pt.bx + 0.3} y={(py + railOy + rail.boardW) / 2} text-anchor="start" font-size={0.4} fill="#c0392b"
                  transform="rotate(-90, {pt.bx + 0.3}, {(py + railOy + rail.boardW) / 2})">
                  {fmtFrac(minD)}
                </text>
              {:else if minD === dLeft && dLeft > 0.2}
                <line x1={pt.bx} y1={py} x2={rail.boardLeft} y2={py}
                  stroke="#27ae60" stroke-width={0.06} stroke-dasharray="0.3,0.2" opacity={0.6} />
                <text x={(pt.bx + rail.boardLeft) / 2} y={py - 0.3} text-anchor="middle" font-size={0.4} fill="#27ae60">
                  {fmtFrac(minD)}
                </text>
              {:else if minD === dRight && dRight > 0.2}
                <line x1={pt.bx} y1={py} x2={rail.boardRight} y2={py}
                  stroke="#8e44ad" stroke-width={0.06} stroke-dasharray="0.3,0.2" opacity={0.6} />
                <text x={(pt.bx + rail.boardRight) / 2} y={py - 0.3} text-anchor="middle" font-size={0.4} fill="#8e44ad">
                  {fmtFrac(minD)}
                </text>
              {/if}
            {/each}

            <!-- Edge measurements between projected points on top and bottom edges -->
            {@const topProj = (() => {
              const s = new Set([rail.boardLeft, rail.boardRight]);
              for (const pt of rail.cutMarks) {
                if (pt.by <= rail.boardW / 2) s.add(Math.round(pt.bx * 100) / 100);
              }
              return [...s].sort((a,b) => a-b);
            })()}
            {@const botProj = (() => {
              const s = new Set([rail.boardLeft, rail.boardRight]);
              for (const pt of rail.cutMarks) {
                if (pt.by > rail.boardW / 2) s.add(Math.round(pt.bx * 100) / 100);
              }
              return [...s].sort((a,b) => a-b);
            })()}

            <!-- Top edge dims -->
            {#each topProj as bx, i}
              {#if i > 0}
                {@const prev = topProj[i-1]}
                {@const dist = bx - prev}
                {#if dist > 0.3}
                  {@const ey = railOy - 1}
                  <line x1={prev} y1={ey} x2={bx} y2={ey} stroke="#2980b9" stroke-width={0.08} />
                  <line x1={prev} y1={ey-0.3} x2={prev} y2={ey+0.3} stroke="#2980b9" stroke-width={0.08} />
                  <line x1={bx} y1={ey-0.3} x2={bx} y2={ey+0.3} stroke="#2980b9" stroke-width={0.08} />
                  <text x={(prev+bx)/2} y={ey-0.4} text-anchor="middle" font-size={0.45} fill="#2980b9">
                    {fmtFrac(dist)}
                  </text>
                {/if}
              {/if}
            {/each}

            <!-- Bottom edge dims -->
            {#each botProj as bx, i}
              {#if i > 0}
                {@const prev = botProj[i-1]}
                {@const dist = bx - prev}
                {#if dist > 0.3}
                  {@const ey = railOy + rail.boardW + 1}
                  <line x1={prev} y1={ey} x2={bx} y2={ey} stroke="#c0392b" stroke-width={0.08} />
                  <line x1={prev} y1={ey-0.3} x2={prev} y2={ey+0.3} stroke="#c0392b" stroke-width={0.08} />
                  <line x1={bx} y1={ey-0.3} x2={bx} y2={ey+0.3} stroke="#c0392b" stroke-width={0.08} />
                  <text x={(prev+bx)/2} y={ey+0.8} text-anchor="middle" font-size={0.45} fill="#c0392b">
                    {fmtFrac(dist)}
                  </text>
                {/if}
              {/if}
            {/each}

            <!-- Dimension lines between consecutive cut vertices -->
            {#each rail.edges as edge, ei}
              {@const p1 = rail.pts[edge.from]}
              {@const p2 = rail.pts[edge.to]}
              {@const dx = p2.bx - p1.bx}
              {@const dy = p2.by - p1.by}
              {@const len = Math.sqrt(dx*dx + dy*dy)}
              {#if len > 0.5}
                {@const ang = Math.atan2(dy, dx) * 180 / Math.PI}
                {@const nx = -dy/len}
                {@const ny = dx/len}
                {@const doff = 1.0}
                {@const d1x = p1.bx + nx*doff}
                {@const d1y = p1.by + railOy + ny*doff}
                {@const d2x = p2.bx + nx*doff}
                {@const d2y = p2.by + railOy + ny*doff}
                {@const mx = (d1x+d2x)/2}
                {@const my = (d1y+d2y)/2}
                {@const textAngle = ang > 90 || ang < -90 ? ang + 180 : ang}
                <line x1={p1.bx} y1={p1.by + railOy} x2={d1x} y2={d1y} stroke="#666" stroke-width={0.06} opacity={0.4} />
                <line x1={p2.bx} y1={p2.by + railOy} x2={d2x} y2={d2y} stroke="#666" stroke-width={0.06} opacity={0.4} />
                <line x1={d1x} y1={d1y} x2={d2x} y2={d2y} stroke="#333" stroke-width={0.08} />
                <text x={mx} y={my - 0.3} text-anchor="middle" font-size={0.45} fill="#333"
                  transform="rotate({textAngle}, {mx}, {my - 0.3})">
                  {fmtFrac(edge.len)} {edge.label}
                </text>
              {/if}
            {/each}

            <!-- Board width label -->
            <text x={rail.boardLeft - 2.5} y={railOy + rail.boardW / 2} text-anchor="middle" font-size={0.8} fill="#333"
              transform="rotate(-90, {rail.boardLeft - 2.5}, {railOy + rail.boardW / 2})">
              {rail.boardW}" (2x4)
            </text>
          {/each}
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
    display: flex;
    flex-direction: column;
  }
  .cut-toolbar {
    display: flex;
    gap: 8px;
    padding: 6px 12px;
    background: #f0f0f0;
    border-bottom: 1px solid #ccc;
    flex-shrink: 0;
  }
  .cut-toolbar button {
    padding: 4px 12px;
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #e2e8f0;
    cursor: pointer;
    font-size: 0.8em;
  }
  .cut-toolbar button:hover { background: #475569; }
  svg {
    display: block;
    flex: 1;
  }
</style>
