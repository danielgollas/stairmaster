# Stairmaster — Deck Stair Construction Calculator & Visualizer

## Overview

A client-side web application that computes and visualizes deck stair constructions. Users input site measurements and material options; the app dynamically calculates dimensions, validates against IRC building codes, and renders a parametric 3D model with orthographic 2D projections.

## Target Audience

General purpose — DIY homeowners, contractors, and carpenters planning deck stair builds.

## Architecture

**Stack:** Svelte + Vite (static site, no backend)

**Rendering:** OpenSCAD WASM running in a Web Worker

**Data flow:**
1. User changes input → Svelte reactive state updates
2. Computed values (step count, angle, warnings) update immediately from parameters — no WASM needed
3. Debounced: `.scad` source generated and sent to Web Worker via `postMessage`
4. Worker runs OpenSCAD WASM → produces STL (3D) and SVG (2D projection)
5. Main thread receives results → Three.js renders 3D model, SVG for 2D orthographic views

**Why Web Worker:** OpenSCAD WASM rendering blocks the thread. The worker keeps the UI responsive during renders. Vite makes worker setup trivial.

**WASM bundle:** ~15-20MB, cached after first load.

## UI Layout

Three-column desktop layout (stacks vertically on mobile):

**Left panel — Inputs** (collapsible sections):
- Site Measurements
- Stair Geometry
- Materials
- Concrete Pad
- Hardware

**Center — Viewport:**
- 3D OpenSCAD model rendered via Three.js (click-drag to orbit, scroll to zoom)
- View toggle: 3D | Side (orthographic) | Front (orthographic)
- Download buttons: `.scad`, `.stl`, `.svg`

**Right panel — Outputs:**
- Computed results (riser count, tread count, actual riser height, stair angle, total run, stringer length, number of stringers)
- Concrete pad dimensions
- IRC code check warnings (informational, non-blocking)
- Hardware summary

**Mobile (<1024px):** Inputs collapse into accordion at top, viewport fills width, results below.

## Data Model

### User Inputs (with defaults)

**Site Measurements:**
| Input | Default | Description |
|-------|---------|-------------|
| `totalHeight` | *required* | Grade to top of deck decking (inches) |
| `topPostSpacing` | *required* | Inside face to inside face of top railing posts (inches) |

**Stair Geometry:**
| Input | Default | Description |
|-------|---------|-------------|
| `riserHeight` | 7.5" | Target riser height — adjusted for even division of totalHeight |
| `treadDepth` | 11.125" | Two 2x6 boards (5.5" each) + 1/8" gap. No nosing. |
| `stringerOC` | 16" | On-center spacing (12" or 16") |

**Materials:**
| Input | Default | Description |
|-------|---------|-------------|
| `deckingThickness` | 1.5" | 2x6 decking boards |
| `riserBoardThickness` | 1.5" | 2x riser boards |
| `rimJoistWidth` | 9.25" | 2x10 rim joist (acts as top riser) |
| `stringerStock` | 2x12 | 1.5" x 11.25" PT lumber |
| `sillPlateThickness` | 1.5" | 2x PT flat on concrete pad |
| `postSize` | 4x4 | 3.5" x 3.5" actual |

**Concrete Pad:**
| Input | Default | Description |
|-------|---------|-------------|
| `padAboveGrade` | 1" | Concrete above grade level |
| `concreteBelow` | 3" | Concrete below grade level |
| `gravelDepth` | 6" | Crushed gravel under concrete |
| `padSideClearance` | 2" | Extra width each side beyond top post alignment |

**Hardware (configurable, these are defaults):**
| Input | Default | Description |
|-------|---------|-------------|
| `postBase` | Simpson ABA44Z | Post stand with concrete anchors |
| `tensionTie` | Simpson DTT2Z | Post-to-stringer/blocking connection |
| `stringerHanger` | Simpson LSC | Stringer-to-rim-joist hanger |

### Computed Outputs

**Stair calculations:**
- `numRisers` = round(totalHeight / riserHeight)
- `actualRiserHeight` = totalHeight / numRisers
- `numTreads` = numRisers - 1 (deck surface is top tread)
- `totalRun` = numTreads × treadDepth
- `stairAngle` = atan(totalHeight / totalRun)
- `stringerLength` = sqrt(totalHeight² + totalRun²)
- `stairWidth` = topPostSpacing (outer stringers align with inner faces of posts)
- `numStringers` = ceil(stairWidth / stringerOC) + 1

**Riser consistency check:**
All risers are measured finished-surface to finished-surface:
- `topRiser` = top tread decking surface to deck decking surface
- `bottomRiser` = concrete pad surface to first tread decking surface (accounts for sill plate raising the stringer)
- `middleRiser` = tread decking to tread decking
- The stringer is cut so that all three measure equally. The top stringer cut is reduced by one decking thickness; the bottom stringer cut accounts for the sill plate thickness.

**Concrete pad dimensions:**
- `padWidth` (W) = topPostSpacing + 2 × padSideClearance
- `padDepth` (D) = stringer seat cut length + one treadDepth (so you can step onto the pad like a tread)
- `concreteThickness` = concreteBelow + padAboveGrade (total: 4" with defaults)
- `excavationDepth` = gravelDepth + concreteBelow (total: 9" with defaults)

**IRC code warnings (informational only):**
- Riser height > 7.75" or < 4"
- Tread depth < 10"
- Stair width < 36"
- Riser variance > 3/8" between any two risers
- Stringer throat < 5" (insufficient remaining wood after notching)

## Stringer Geometry — Detailed

A stringer is cut from a 2x12 PT board (actual 1.5" x 11.25"). The finished profile viewed from the side consists of:

### Overall Shape
- An **uncut bottom edge** running straight along the board's length — this is the structural backbone.
- A **sawtooth pattern** cut from the top edge — the tread/riser notches.
- A **plumb cut at the top** (vertical when installed) — bears against the rim joist.
- A **seat cut at the bottom** (level + plumb) — sits flat on the sill plate/landing.

### Tread/Riser Notches (the "teeth")
Each notch is a right-angle cut from the top edge:
- **Level cut (tread cut):** Horizontal when installed. Length = `treadDepth` (unit run). The tread boards sit on this surface.
- **Plumb cut (riser cut):** Vertical when installed. Height = `actualRiserHeight` (unit rise). The riser board bears against this face.
- The two cuts meet at an inside corner at exactly 90 degrees.
- Walking up the stringer: riser (vertical) ��� tread (horizontal) → riser → tread, repeating.

### Angles on the Board
Given stair angle `theta = atan(unit_rise / unit_run)`:
- **Plumb lines** cross the board at angle `(90 - theta)` from the long edge.
- **Level lines** cross the board at angle `theta` from the long edge.
- All plumb cuts are parallel; all level cuts are parallel.

### Top Cut
- A single **plumb cut** — vertical when installed, flush against the rim joist.
- The last level cut (top tread position) corresponds to the deck surface — no tread board is installed here.
- The top tread cut on the stringer is shortened by the riser board thickness (1.5" for 2x material) since the riser board occupies space against the rim joist face.

### Bottom Cut — Seat Cut
A compound cut at the bottom creating an L-shape:
- **Level cut (bearing surface):** Horizontal, sits flat on the sill plate. Provides structural bearing.
- **Plumb cut (toe):** Vertical, faces the approach direction. May bear against a kickboard.

**Critical: tread thickness drop.** The entire bottom of the stringer is shortened by exactly the tread board thickness (1.5" for 2x6 decking). Without this, the first step would be taller than all others by the tread thickness. After the drop, the first riser on the stringer measures `unit_rise - tread_thickness`, but with the tread board installed on the first notch, the actual step-up from the landing equals `unit_rise`.

### Throat (Minimum Remaining Wood)
- The **throat** is the perpendicular distance from any notch inside corner to the uncut bottom edge.
- For a 2x12: minimum throat = **5 inches** (professional standard).
- With 11.25" board width and 5" throat, maximum notch depth = 6.25".
- The app should warn if the input rise/run combination produces a throat below 5".

### Riser Height Summary

| Position | Stringer Cut Height | Finished Surface-to-Surface |
|----------|--------------------|-----------------------------|
| Bottom (1st) | `unit_rise - tread_thickness` | `unit_rise` (tread adds back the difference) |
| Middle | `unit_rise` | `unit_rise` |
| Top (to deck) | `unit_rise` | `unit_rise` (deck surface is the tread) |

**Additional bottom adjustment:** The sill plate raises the stringer by `sillPlateThickness`. This must be accounted for so the bottom finished riser (pad surface → first tread decking) equals `unit_rise`. The bottom stringer cut is further adjusted: `first_riser_on_stringer = unit_rise - tread_thickness - sillPlateThickness + padAboveGrade`. The exact formula will be validated during implementation.

### Parametric Construction for OpenSCAD
1. Start with a 2D rectangle: 11.25" wide × stringer length.
2. Position at stair angle `theta`.
3. Cut N-1 rectangular notches from the top edge (each `treadDepth` wide × `unit_rise` tall).
4. Top: plumb cut flush for rim joist bearing. Shorten top tread by riser board thickness.
5. Bottom: level seat cut at dropped height + plumb toe cut.
6. Extrude to 1.5" depth for the 3D model.

## Construction Method

This models a specific deck stair construction technique:

1. **Concrete landing pad** at the base with crushed gravel substrate. Pad extends 1" above grade.
2. **Two bottom posts** aligned with top posts, attached to pad via **Simpson ABA44Z** post bases with concrete anchors (pre-drilled into cured concrete).
3. **Sill plate** (2x PT) sits flat on the concrete pad between the post bases. The stringer bottoms land on this sill plate.
4. **Blocking** is placed between stringers, flat on the sill plate.
5. **Tension ties (DTT2Z)** connect posts to the inner stringers and to the blocking between outer and inner stringers. (Reference: https://www.thisiscarpentry.com/2014/03/07/bottom-stair-post-and-stringer-deck-connections/)
6. **Stringers** are 2x12 PT with notched tread/riser cuts. Count determined by stair width and OC spacing.
7. **Treads** are two 2x6 boards with 1/8" gap per step. No nosing — treads are flush with riser face.
8. **Riser boards** (2x material) sit at each vertical stringer face, under the tread above.
9. **Rim joist** (2x10) acts as the top riser. Stringers attach to it via **Simpson LSC** stringer hangers.
10. **Deck decking** is flush with the rim joist front face, forming the top "tread."

## OpenSCAD Model

### Source Generation

JavaScript generates the full `.scad` source as a template string. Modules are defined as JS functions that return `.scad` code. This avoids WASM filesystem I/O and gives the Svelte app full control. Users can download the generated `.scad` file for desktop OpenSCAD.

### Module Hierarchy

```
staircase(params)
├── ground_plane()           — semi-transparent reference at grade
├── concrete_pad()           — pad + gravel, positioned relative to grade
├── sill_plate()             — flat on pad surface, between posts
├── bottom_posts()           — two posts aligned with top posts
├── post_bases()             — ABA44Z schematic rectangles
├── stringers()              — 2x12 with notched cuts, spaced at OC
├── blocking()               — between stringers at bottom on sill plate
├── tension_ties()           — DTT2Z schematic plates
├── treads()                 — two 2x6 per step with gap
├── risers()                 — riser boards at each vertical face
├── stringer_hangers()       — LSC schematic at rim joist
├── rim_joist()              — 2x10 acting as top riser
├── deck_surface()           — top decking
└── top_posts()              — two posts above deck
```

### Views

- **3D:** Default orbitable view via Three.js rendering of STL output
- **Side elevation:** Orthographic projection of the 3D model (right side view)
- **Front elevation:** Orthographic projection (front view)

All 2D views are camera-angle projections of the same 3D model — not separate drawings.

### Color Coding

| Color | Material |
|-------|----------|
| Gray | Concrete |
| Dark brown | Gravel |
| Golden | PT lumber (stringers, sill plate, posts) |
| Warm brown | Decking boards |
| Red | Hardware/metal |
| Semi-transparent green | Ground plane |

### Hardware Detail Level

Schematic for initial version — simple rectangular representations with labels. Realistic hardware geometry can be added later per-component.

## File Structure

```
stairmaster/
├── index.html
├── package.json
├── vite.config.js
├── src/
│   ├── main.js                  — Svelte app entry
│   ├── App.svelte               — Root layout (three-column)
│   ├── lib/
│   │   ├── calculations.js      — All stair math (pure functions)
│   │   ├── scad-generator.js    — Generates .scad source from params
│   │   ├── code-checks.js       — IRC validation warnings
│   │   └── constants.js         — Material dimensions, defaults
│   ├── components/
│   │   ├── InputPanel.svelte    — Left panel with input sections
│   │   ├── Viewport.svelte      — Center 3D/2D viewer
│   │   ├── OutputPanel.svelte   — Right panel with results
│   │   └── CodeWarnings.svelte  — IRC warning display
│   └── worker/
│       └── openscad-worker.js   — Web Worker running OpenSCAD WASM
├── public/
│   └── openscad.wasm            — OpenSCAD WASM binary
└── docs/
    └── superpowers/specs/
        └── 2026-04-04-stairmaster-design.md
```

## Future Work (Out of Scope for V1)

- Railing design and calculation
- Materials list / cut list generation
- Cost estimation
- Multiple construction techniques
- Detailed hardware models (realistic Simpson connector geometry)
- Print-friendly blueprint export
