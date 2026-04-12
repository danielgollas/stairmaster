# Stairmaster Implementation Guide

This document describes the complete geometry, calculations, and rendering logic used in the Stairmaster deck stair construction calculator. It serves as the authoritative reference for any future session to understand how everything works.

## Architecture Overview

- **Stack**: Svelte 5 (runes) + Vite, Three.js for 3D rendering, SVG for cut guide
- **No server**: fully client-side static app
- **Rendering**: All 3D geometry built directly as Three.js meshes (no OpenSCAD WASM for rendering). OpenSCAD `.scad` file download still available.
- **Per-component visibility**: Each structural component is a separate Three.js mesh/group, toggled instantly via `mesh.visible`
- **Persistence**: Visibility settings saved to localStorage

## Key Files

```
src/
  lib/
    constants.js       — material dimensions, defaults, IRC limits
    calculations.js    — all stair math (pure functions)
    code-checks.js     — IRC validation warnings
    scad-generator.js  — generates .scad source (for download only)
    scene-builder.js   — builds all Three.js geometry + dimensions
  components/
    InputPanel.svelte  — left panel inputs
    Viewport.svelte    — 3D/2D viewer (Three.js)
    CutGuide.svelte    — stringer cut layout diagram (SVG)
    OutputPanel.svelte — computed results + materials
    CodeWarnings.svelte — IRC warning display
  App.svelte           — root: reactive state, wiring
```

## Coordinate System

In the 3D view (Three.js and scene-builder):
- **X** = horizontal run direction (left = approach, right = toward deck)
- **Y** = width direction (left-right when facing stairs)
- **Z** = vertical (up)
- **Origin**: approximately at the first riser position at grade level

## Core Calculations (`calculations.js`)

### Effective Rise

```
effectiveRise = totalHeight - padAboveGrade
```

The stair rise is measured from **pad surface** to **deck top**, not from grade. The pad's height above grade is the landing surface.

### Riser and Tread Counts

```
numRisers = round(effectiveRise / targetRiserHeight)
actualRiserHeight = effectiveRise / numRisers
numTreads = numRisers - 1
totalRun = numTreads * treadDepth
```

### Stair Angle

```
stairAngle = atan(effectiveRise / totalRun) in degrees
```

### Stringer Count (Post-Based)

Outer stringers are positioned relative to the posts (inside or outside):
- **Inside posts**: `outerStringerSpan = topPostSpacing - stringerThickness`
- **Outside posts**: `outerStringerSpan = topPostSpacing + 2*postSize + stringerThickness`

Internal stringers fill the span with `actualOC <= maxOC`:
```
numSpans = ceil(outerStringerSpan / maxOC)
numStringers = numSpans + 1
actualOC = outerStringerSpan / numSpans
```

### Bottom Drop

The stringer's first riser is shortened so finished risers are equal:
```
bottomDrop = deckingThickness + sillPlateThickness
```

This accounts for the sill plate raising the stringer and the tread decking adding height on top.

### Throat

```
notchDepth = (rise * run) / hypotenuse
throat = stringerStockWidth - notchDepth
```

Minimum recommended throat for 2x12: 5 inches.

### Pad Dimensions

```
padWidth = max(topPostSpacing + 2*postSize + 2*clearance, topPostSpacing + 2*clearance)
padDepth = seatCutLength + treadDepth + padBackExtension
```

Pad width always covers outer post faces. Back extension is configurable (default 6").

### Material Calculations

```
gravelCuFt = (padDepth * padWidth * gravelDepth) / 1728
concreteCuFt = (padDepth * padWidth * concreteThickness) / 1728
bags60lb = ceil(concreteCuFt / 0.45)
bags80lb = ceil(concreteCuFt / 0.6)
```

## Stringer Shape (`scene-builder.js :: buildStringerShape`)

The stringer profile is a 2D Three.js `Shape` in the XY plane, extruded along Z for thickness, then rotated into position.

### Shape Coordinate Frame

- **X** = horizontal run (installed position)
- **Y** = height (installed position)
- **y=0** = seat level = sill plate top

### Board Optimization

The stringer is cut from a 2x12 board. The sawtooth tips (riser tops) touch the board's top edge. The bottom edge is the full board width below:

```
topLineY0 = rise - drop        // riser top line at x=0
boardVertical = sw * hyp / run // vertical distance for sw perpendicular offset
botAtX0 = topLineY0 - boardVertical  // bottom edge y at x=0
```

The bottom edge at any x: `botEdge(x) = botAtX0 + x * slopeRatio`

### Seat Cut

Where the bottom edge meets y=0 (seat level):
```
seatEndX = -botAtX0 / slopeRatio
```

The seat is a horizontal surface from `(seatEndX, 0)` to `(0, 0)`.

### Sawtooth Notches

Each notch has an inside corner and a tread end:
```
notchY(i) = (i + 1) * rise - drop
```

For each notch i:
- **Inside corner**: `(i * run, notchY(i))` — where riser meets tread
- **Tread end**: `(i * run + td, notchY(i))` — end of tread cut

Tread cut depth: `td = run - rb` for standard treads, `td = run - 2*rb` for the top tread (rim joist acts as riser).

Between notches, fill-gap points at `((i+1)*run, notchY(i))` create the stringer material ledge where riser boards sit. These are in the 3D shape but NOT in the cut guide.

### Top Plumb Cut

```
topTd = run - 2 * rb  // top tread cut depth
topX = (n-1) * run + topTd + rb  // plumb cut x position
```

The plumb cut is vertical at `x = topX`, from `topY` down to `botAtTop`.

### Rim Joist Position

The rim joist face aligns with the stringer plumb cut:
```
rimX = totalRun - 1.5  // rim joist front face
```

Deck surface starts at `rimX` (flush with rim joist front face).

### Shape to World Transform

The shape is extruded by `stringerStockThickness` along Z, then rotated:
```
baseGeo.rotateX(Math.PI / 2)  // maps: shape Y → world Z, extrusion Z → world -Y
```

Mesh positioned at:
```
position.set(0, y + thickness, seatZ)  // seatZ = padAbove + sillPlate
```

`seatZ` maps shape `y=0` to the sill plate top in world Z.

## Component Positioning (`scene-builder.js`)

### Coordinate References

```
sillY = (stairWidth - topPostSpacing) / 2   // post inner face Y
padShift = -riserBoardThickness              // pad/sill shifted left for bottom riser
seatZ = padAboveGrade + sillPlateThickness   // sill plate top Z
```

### Tread Position (for step i)

```
notchZ(i) = padAboveGrade + (i+1) * actualRiserHeight - deckingThickness
treadTop = padAboveGrade + (i+1) * actualRiserHeight
```

Tread boards overhang the front by `riserBoardThickness` to cover the riser below. Top tread back butts against rim joist.

### Riser Position (for step i)

```
riserX = i * treadDepth - riserBoardThickness  // shifted forward to butt against tread
riserBottom = (i > 0) ? notchZ(i-1) : sillPlateTop
riserTop = notchZ(i)
```

Each riser is two boards: full 2x6 (5.5") + ripped piece to fill remaining height.

Risers span full `compWidth` (single board across, not cut between stringers).

### Sill Plate

Depth extends from `padShift` to `seatEndX` (the stringer heel):
```
sillDepth = seatEndXCalc - padShift
```

### Concrete Pad

Front edge fixed at `padShift - baseDepth/2`. Back extends by `padBackExtension`. Width covers outer post faces.

### Bottom Posts

Left face at `padShift` (sill plate start). Blocking left face aligns with post right face.

## Cut Guide (`CutGuide.svelte`)

### Board Coordinate Transform

The stringer (in installed XY coords) is rotated to lay flat on the board:

```javascript
function toBoard(x, y) {
  const ox = x;
  const oy = y - botAtX0;  // shift so board bottom = by=0
  const bx = ox * cos(angle) + oy * sin(angle);
  const by = -ox * sin(angle) + oy * cos(angle);
  return { bx, by };
}
```

- `bx` = position along the board length
- `by` = position across the board width (0 = bottom uncut edge, sw = top cut edge)

### 11 Cut Vertices

The cut guide uses a simplified sawtooth with exactly 11 points:

1. **Seat heel** — `toBoard(seatEndX, 0)`
2. **Seat origin** — `toBoard(0, 0)`
3-10. **4 notches** × 2 each:
   - Inside corner: `toBoard(i*run, notchY(i))`
   - Tread nose: `toBoard(noseX, notchY(i))` where noseX is `(i+1)*run` or `topX` for last
11. **Plumb bottom** — `toBoard(topX, botAtTop)`

The tread nose of notch i and the inside corner of notch i+1 share the same X in installed coords, creating a natural 90° corner (vertical riser between them).

**No fill-gap points** in the cut guide — the sawtooth uses full `run` for each tread. The fill-gap ledge is stringer material that remains after cutting, not a mark you make.

### Edge Measurements

Each cut vertex is projected onto its **nearest** board edge only:
- Distance to top (by), bottom (sw - by), left (bx - boardLeft), right (boardRight - bx)
- Projected onto the closest edge
- Measurements shown between consecutive projected points on each edge

### Perpendicular Distances

A dashed line from each cut vertex perpendicular to its nearest edge, with the distance labeled. This enables the **tape + square** marking method:
1. Measure along the edge to the projected point
2. Square 90° inward by the perpendicular distance

### Measurements Format

All measurements in fractional inches to the nearest 16th:
```javascript
function fmtFrac(val) {
  // Returns e.g. "9 5/8"" or "6 13/16""
  // Fractions simplified: 8/16 → 1/2, 4/16 → 1/4
}
```

### Zoom and Pan

SVG viewBox manipulation:
- Scroll wheel: zoom centered on cursor
- Click + drag: pan
- View state in `$state` variables (viewX, viewY, viewW, viewH)

## Construction Method Summary

1. **Concrete pad**: crushed gravel base + concrete, 1" above grade
2. **Post bases**: Simpson ABA44Z on cured concrete (pre-drilled)
3. **Sill plate**: 2x PT flat on pad, between posts
4. **Stringers**: 2x12 PT, notched, land on sill plate
5. **Blocking**: 2x4 between stringers at bottom, on sill plate
6. **Tension ties**: DTT2Z, post-to-stringer/blocking
7. **Treads**: 2× 2x6 + 1/8" gap per step, overhang front by rb
8. **Risers**: 2x6 + ripped piece, full width, butt against treads
9. **Rim joist**: 2x10, acts as final riser, stringer bears against via LSC hanger
10. **Deck surface**: flush with rim joist front face

## Key Design Decisions

- **effectiveRise** not totalHeight for riser calculation (pad surface is the landing)
- **bottomDrop** = decking + sillPlate (no padAboveGrade subtraction — handled in effectiveRise)
- **Stringer position.z = seatZ** (not seatZ + bottomDrop — drop is in the shape)
- **Tread cut shortened by rb** — riser board fits in the gap
- **Top tread cut shortened by 2×rb** — rim joist acts as the riser
- **Board overlay** aligned with riser tops (highest sawtooth points) at board top edge
- **All geometry in Three.js** — OpenSCAD only for .scad download
- **Visibility toggles** don't trigger re-render (purely mesh.visible)
