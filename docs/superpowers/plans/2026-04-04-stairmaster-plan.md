# Stairmaster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side web app that computes and visualizes deck stair constructions using Svelte + OpenSCAD WASM.

**Architecture:** Svelte 5 + Vite static app. User inputs drive reactive computed outputs (pure JS math) and a parametric OpenSCAD model rendered via WASM in a Web Worker. Three.js displays the STL; orthographic camera angles provide 2D side/front views.

**Tech Stack:** Svelte 5 (runes), Vite, OpenSCAD WASM (`openscad-wasm`), Three.js, Vitest

---

## File Map

```
stairmaster/
├── index.html
├── package.json
├── vite.config.js
├── vitest.config.js
├── src/
│   ├── main.js
│   ├── App.svelte
│   ├── lib/
│   │   ├── constants.js         — material dimensions, defaults, IRC limits
│   │   ├── calculations.js      — all stair math (pure functions)
│   │   ├── code-checks.js       — IRC validation warnings
│   │   └── scad-generator.js    — generates .scad source from params
│   ├── components/
│   │   ├── InputPanel.svelte    — left panel with collapsible input sections
│   │   ├── Viewport.svelte      — center 3D/2D viewer (Three.js canvas)
│   │   ├── OutputPanel.svelte   — right panel with computed results
│   │   └── CodeWarnings.svelte  — IRC warning badges
│   └── worker/
│       └── openscad-worker.js   — Web Worker running OpenSCAD WASM
├── tests/
│   ├── calculations.test.js
│   ├── code-checks.test.js
│   └── scad-generator.test.js
└── public/
    └── (openscad wasm files copied at build time)
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `vitest.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/App.svelte`

- [ ] **Step 1: Initialize the project with Vite + Svelte**

```bash
cd /Users/dgollas/projects/stairmaster
npm create vite@latest . -- --template svelte
```

Select "Svelte" and "JavaScript" if prompted. This scaffolds the project.

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install three
npm install -D vitest
```

- [ ] **Step 3: Install OpenSCAD WASM**

```bash
npm install openscad-wasm
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.js`:

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
  },
});
```

- [ ] **Step 5: Configure Vite for WASM**

Update `vite.config.js` to handle the OpenSCAD WASM files. Replace its contents with:

```javascript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  optimizeDeps: {
    exclude: ['openscad-wasm'],
  },
  worker: {
    format: 'es',
  },
});
```

- [ ] **Step 6: Verify the dev server starts**

```bash
npm run dev
```

Expected: Vite dev server starts on localhost, default Svelte page loads.

- [ ] **Step 7: Verify tests run**

Create a smoke test at `tests/smoke.test.js`:

```javascript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

```bash
npx vitest run
```

Expected: 1 test passes.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold Svelte + Vite project with Three.js and OpenSCAD WASM"
```

---

### Task 2: Constants and Defaults

**Files:**
- Create: `src/lib/constants.js`
- Create: `tests/constants.test.js`

- [ ] **Step 1: Write the test**

Create `tests/constants.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { DEFAULTS, MATERIALS, IRC_LIMITS } from '../src/lib/constants.js';

describe('constants', () => {
  it('has all required default values', () => {
    expect(DEFAULTS.riserHeight).toBe(7.5);
    expect(DEFAULTS.treadDepth).toBe(11.125);
    expect(DEFAULTS.stringerOC).toBe(16);
    expect(DEFAULTS.deckingThickness).toBe(1.5);
    expect(DEFAULTS.riserBoardThickness).toBe(1.5);
    expect(DEFAULTS.rimJoistWidth).toBe(9.25);
    expect(DEFAULTS.sillPlateThickness).toBe(1.5);
    expect(DEFAULTS.padAboveGrade).toBe(1);
    expect(DEFAULTS.concreteBelow).toBe(3);
    expect(DEFAULTS.gravelDepth).toBe(6);
    expect(DEFAULTS.padSideClearance).toBe(2);
  });

  it('has material actual dimensions', () => {
    expect(MATERIALS['2x12'].width).toBe(11.25);
    expect(MATERIALS['2x12'].thickness).toBe(1.5);
    expect(MATERIALS['2x10'].width).toBe(9.25);
    expect(MATERIALS['2x6'].width).toBe(5.5);
    expect(MATERIALS['4x4'].actual).toBe(3.5);
  });

  it('has IRC code limits', () => {
    expect(IRC_LIMITS.maxRiserHeight).toBe(7.75);
    expect(IRC_LIMITS.minRiserHeight).toBe(4);
    expect(IRC_LIMITS.minTreadDepth).toBe(10);
    expect(IRC_LIMITS.minStairWidth).toBe(36);
    expect(IRC_LIMITS.maxRiserVariance).toBe(0.375);
    expect(IRC_LIMITS.minThroat).toBe(5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/constants.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement constants**

Create `src/lib/constants.js`:

```javascript
export const MATERIALS = {
  '2x12': { thickness: 1.5, width: 11.25 },
  '2x10': { thickness: 1.5, width: 9.25 },
  '2x8':  { thickness: 1.5, width: 7.25 },
  '2x6':  { thickness: 1.5, width: 5.5 },
  '4x4':  { actual: 3.5 },
  '6x6':  { actual: 5.5 },
};

export const DEFAULTS = {
  // Stair geometry
  riserHeight: 7.5,
  treadDepth: 11.125,   // 2x 2x6 (5.5) + 1/8" gap
  stringerOC: 16,

  // Materials
  deckingThickness: 1.5,
  riserBoardThickness: 1.5,
  rimJoistWidth: 9.25,
  stringerStock: '2x12',
  sillPlateThickness: 1.5,
  postSize: '4x4',

  // Concrete pad
  padAboveGrade: 1,
  concreteBelow: 3,
  gravelDepth: 6,
  padSideClearance: 2,

  // Hardware
  postBase: 'Simpson ABA44Z',
  tensionTie: 'Simpson DTT2Z',
  stringerHanger: 'Simpson LSC',
};

export const IRC_LIMITS = {
  maxRiserHeight: 7.75,
  minRiserHeight: 4,
  minTreadDepth: 10,
  minStairWidth: 36,
  maxRiserVariance: 0.375,  // 3/8"
  minThroat: 5,
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/constants.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.js tests/constants.test.js
git commit -m "feat: add material constants, defaults, and IRC limits"
```

---

### Task 3: Stair Calculations (Pure Math)

**Files:**
- Create: `src/lib/calculations.js`
- Create: `tests/calculations.test.js`

This is the core math engine. All functions are pure — no side effects, no DOM, no framework.

- [ ] **Step 1: Write tests for basic stair geometry**

Create `tests/calculations.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import {
  computeStairGeometry,
  computePadDimensions,
  computeStringerProfile,
} from '../src/lib/calculations.js';

describe('computeStairGeometry', () => {
  const base = {
    totalHeight: 96,
    topPostSpacing: 36,
    riserHeight: 7.5,
    treadDepth: 11.125,
    stringerOC: 16,
    deckingThickness: 1.5,
    riserBoardThickness: 1.5,
    rimJoistWidth: 9.25,
    sillPlateThickness: 1.5,
    padAboveGrade: 1,
    stringerStockWidth: 11.25,
  };

  it('computes number of risers by rounding totalHeight / target riser', () => {
    const result = computeStairGeometry(base);
    // 96 / 7.5 = 12.8 → rounds to 13
    expect(result.numRisers).toBe(13);
  });

  it('computes actual riser height as totalHeight / numRisers', () => {
    const result = computeStairGeometry(base);
    expect(result.actualRiserHeight).toBeCloseTo(96 / 13, 4);
  });

  it('computes numTreads as numRisers - 1', () => {
    const result = computeStairGeometry(base);
    expect(result.numTreads).toBe(12);
  });

  it('computes total run as numTreads * treadDepth', () => {
    const result = computeStairGeometry(base);
    expect(result.totalRun).toBeCloseTo(12 * 11.125, 4);
  });

  it('computes stair angle in degrees', () => {
    const result = computeStairGeometry(base);
    const expectedAngle = Math.atan(96 / (12 * 11.125)) * (180 / Math.PI);
    expect(result.stairAngle).toBeCloseTo(expectedAngle, 2);
  });

  it('computes stringer length as hypotenuse', () => {
    const result = computeStairGeometry(base);
    const totalRun = 12 * 11.125;
    const expectedLength = Math.sqrt(96 * 96 + totalRun * totalRun);
    expect(result.stringerLength).toBeCloseTo(expectedLength, 2);
  });

  it('computes stair width equal to topPostSpacing', () => {
    const result = computeStairGeometry(base);
    expect(result.stairWidth).toBe(36);
  });

  it('computes number of stringers using fence-post math', () => {
    const result = computeStairGeometry(base);
    // ceil(36 / 16) + 1 = 3 + 1 = 4
    expect(result.numStringers).toBe(4);
  });

  it('computes throat depth to expected value', () => {
    const result = computeStairGeometry(base);
    // With 13 risers: actualRiser = 96/13 ≈ 7.3846"
    // notchDepth = (rise * run) / sqrt(rise^2 + run^2)
    //            = (7.3846 * 11.125) / sqrt(7.3846^2 + 11.125^2)
    //            ≈ 82.155 / 13.352 ≈ 6.153
    // throat = 11.25 - 6.153 ≈ 5.097
    const rise = 96 / 13;
    const run = 11.125;
    const expectedNotchDepth = (rise * run) / Math.sqrt(rise * rise + run * run);
    const expectedThroat = 11.25 - expectedNotchDepth;
    expect(result.throat).toBeCloseTo(expectedThroat, 3);
  });

  it('handles exact division of totalHeight by riserHeight', () => {
    const exact = { ...base, totalHeight: 75, riserHeight: 7.5 };
    const result = computeStairGeometry(exact);
    expect(result.numRisers).toBe(10);
    expect(result.actualRiserHeight).toBe(7.5);
  });
});

describe('computePadDimensions', () => {
  it('computes pad width from post spacing + clearance', () => {
    const result = computePadDimensions({
      topPostSpacing: 36,
      padSideClearance: 2,
      treadDepth: 11.125,
      seatCutLength: 11.125,  // stringer seat cut horizontal length
      padAboveGrade: 1,
      concreteBelow: 3,
      gravelDepth: 6,
    });
    expect(result.padWidth).toBe(40);
  });

  it('computes pad depth from seat cut + one tread depth', () => {
    const result = computePadDimensions({
      topPostSpacing: 36,
      padSideClearance: 2,
      treadDepth: 11.125,
      seatCutLength: 11.125,
      padAboveGrade: 1,
      concreteBelow: 3,
      gravelDepth: 6,
    });
    expect(result.padDepth).toBeCloseTo(11.125 + 11.125, 4);
  });

  it('computes concrete thickness and excavation depth', () => {
    const result = computePadDimensions({
      topPostSpacing: 36,
      padSideClearance: 2,
      treadDepth: 11.125,
      seatCutLength: 11.125,
      padAboveGrade: 1,
      concreteBelow: 3,
      gravelDepth: 6,
    });
    expect(result.concreteThickness).toBe(4);
    expect(result.excavationDepth).toBe(9);
  });
});

describe('computeStringerProfile', () => {
  it('returns notch points for the stringer profile', () => {
    const profile = computeStringerProfile({
      numTreads: 3,
      actualRiserHeight: 7.5,
      treadDepth: 11.125,
      deckingThickness: 1.5,
      riserBoardThickness: 1.5,
      sillPlateThickness: 1.5,
      padAboveGrade: 1,
      stringerStockWidth: 11.25,
    });
    // Should have the right number of notch points
    // Each notch has a tread cut and riser cut forming a right angle
    expect(profile.notches).toHaveLength(3);
    // Bottom drop = deckingThickness + sillPlateThickness - padAboveGrade = 1.5 + 1.5 - 1 = 2.0
    expect(profile.bottomDrop).toBe(2.0);
    // Top tread shortened by riser board thickness
    expect(profile.topTreadReduction).toBe(1.5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/calculations.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement calculations**

Create `src/lib/calculations.js`:

```javascript
/**
 * Compute all stair geometry from input parameters.
 * All dimensions in inches, angles in degrees.
 */
export function computeStairGeometry(params) {
  const {
    totalHeight,
    topPostSpacing,
    riserHeight,
    treadDepth,
    stringerOC,
    deckingThickness,
    riserBoardThickness,
    rimJoistWidth,
    sillPlateThickness,
    padAboveGrade,
    stringerStockWidth,
  } = params;

  const numRisers = Math.round(totalHeight / riserHeight);
  const actualRiserHeight = totalHeight / numRisers;
  const numTreads = numRisers - 1;
  const totalRun = numTreads * treadDepth;
  const stairAngle = Math.atan(totalHeight / totalRun) * (180 / Math.PI);
  const stringerLength = Math.sqrt(totalHeight * totalHeight + totalRun * totalRun);
  const stairWidth = topPostSpacing;
  const numStringers = Math.ceil(stairWidth / stringerOC) + 1;

  // Throat: perpendicular distance from notch inside corner to uncut bottom edge
  // notchDepth (perpendicular to board edge) = (rise * run) / sqrt(rise^2 + run^2)
  const notchDepth =
    (actualRiserHeight * treadDepth) /
    Math.sqrt(actualRiserHeight * actualRiserHeight + treadDepth * treadDepth);
  const throat = stringerStockWidth - notchDepth;

  return {
    numRisers,
    actualRiserHeight,
    numTreads,
    totalRun,
    stairAngle,
    stringerLength,
    stairWidth,
    numStringers,
    throat,
    notchDepth,
  };
}

/**
 * Compute concrete pad dimensions.
 */
export function computePadDimensions(params) {
  const {
    topPostSpacing,
    padSideClearance,
    treadDepth,
    seatCutLength,
    padAboveGrade,
    concreteBelow,
    gravelDepth,
  } = params;

  return {
    padWidth: topPostSpacing + 2 * padSideClearance,
    padDepth: seatCutLength + treadDepth,
    concreteThickness: concreteBelow + padAboveGrade,
    excavationDepth: gravelDepth + concreteBelow,
  };
}

/**
 * Compute stringer profile geometry for OpenSCAD generation.
 * Returns notch positions, bottom drop, and top tread reduction.
 */
export function computeStringerProfile(params) {
  const {
    numTreads,
    actualRiserHeight,
    treadDepth,
    deckingThickness,
    riserBoardThickness,
    sillPlateThickness,
    padAboveGrade,
    stringerStockWidth,
  } = params;

  // Bottom drop: the stringer is shortened so the first finished riser
  // (pad surface → first tread decking) equals all other risers.
  // The sill plate raises the stringer; padAboveGrade raises the pad surface.
  // bottomDrop = deckingThickness + sillPlateThickness - padAboveGrade
  const bottomDrop = deckingThickness + sillPlateThickness - padAboveGrade;

  // Top tread cut is shortened by riser board thickness
  // (riser board sits against rim joist face)
  const topTreadReduction = riserBoardThickness;

  // Generate notch positions relative to the bottom-front of the stringer
  // Each notch is positioned at (x, y) where x is horizontal run, y is vertical rise
  const notches = [];
  for (let i = 0; i < numTreads; i++) {
    notches.push({
      x: i * treadDepth,
      y: i * actualRiserHeight,
      treadDepth: i === numTreads - 1 ? treadDepth - topTreadReduction : treadDepth,
      riserHeight: actualRiserHeight,
    });
  }

  // Seat cut length (horizontal bearing on sill plate)
  // At minimum the full tread depth for adequate bearing
  const seatCutLength = treadDepth;

  return {
    notches,
    bottomDrop,
    topTreadReduction,
    seatCutLength,
    stringerStockWidth,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/calculations.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calculations.js tests/calculations.test.js
git commit -m "feat: implement stair geometry calculations with TDD"
```

---

### Task 4: IRC Code Checks

**Files:**
- Create: `src/lib/code-checks.js`
- Create: `tests/code-checks.test.js`

- [ ] **Step 1: Write tests**

Create `tests/code-checks.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { checkIRC } from '../src/lib/code-checks.js';

describe('checkIRC', () => {
  const validParams = {
    actualRiserHeight: 7.5,
    treadDepth: 11.125,
    stairWidth: 36,
    throat: 5.5,
    riserVariance: 0,
  };

  it('returns no warnings for valid parameters', () => {
    const warnings = checkIRC(validParams);
    expect(warnings).toEqual([]);
  });

  it('warns when riser height exceeds max', () => {
    const warnings = checkIRC({ ...validParams, actualRiserHeight: 8 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('RISER_TOO_HIGH');
  });

  it('warns when riser height is below min', () => {
    const warnings = checkIRC({ ...validParams, actualRiserHeight: 3.5 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('RISER_TOO_LOW');
  });

  it('warns when tread depth is below min', () => {
    const warnings = checkIRC({ ...validParams, treadDepth: 9 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('TREAD_TOO_SHALLOW');
  });

  it('warns when stair width is below min', () => {
    const warnings = checkIRC({ ...validParams, stairWidth: 30 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('WIDTH_TOO_NARROW');
  });

  it('warns when riser variance exceeds max', () => {
    const warnings = checkIRC({ ...validParams, riserVariance: 0.5 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('RISER_VARIANCE');
  });

  it('warns when throat is below min', () => {
    const warnings = checkIRC({ ...validParams, throat: 4 });
    expect(warnings).toHaveLength(1);
    expect(warnings[0].code).toBe('THROAT_TOO_THIN');
  });

  it('returns multiple warnings when multiple violations exist', () => {
    const warnings = checkIRC({
      actualRiserHeight: 8,
      treadDepth: 9,
      stairWidth: 30,
      throat: 4,
      riserVariance: 0.5,
    });
    expect(warnings).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/code-checks.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement code checks**

Create `src/lib/code-checks.js`:

```javascript
import { IRC_LIMITS } from './constants.js';

/**
 * Check parameters against IRC residential stair code.
 * Returns an array of warning objects (informational, non-blocking).
 */
export function checkIRC(params) {
  const { actualRiserHeight, treadDepth, stairWidth, throat, riserVariance } = params;
  const warnings = [];

  if (actualRiserHeight > IRC_LIMITS.maxRiserHeight) {
    warnings.push({
      code: 'RISER_TOO_HIGH',
      message: `Riser height ${actualRiserHeight.toFixed(3)}" exceeds IRC max of ${IRC_LIMITS.maxRiserHeight}"`,
      severity: 'warning',
    });
  }

  if (actualRiserHeight < IRC_LIMITS.minRiserHeight) {
    warnings.push({
      code: 'RISER_TOO_LOW',
      message: `Riser height ${actualRiserHeight.toFixed(3)}" is below IRC min of ${IRC_LIMITS.minRiserHeight}"`,
      severity: 'warning',
    });
  }

  if (treadDepth < IRC_LIMITS.minTreadDepth) {
    warnings.push({
      code: 'TREAD_TOO_SHALLOW',
      message: `Tread depth ${treadDepth}" is below IRC min of ${IRC_LIMITS.minTreadDepth}"`,
      severity: 'warning',
    });
  }

  if (stairWidth < IRC_LIMITS.minStairWidth) {
    warnings.push({
      code: 'WIDTH_TOO_NARROW',
      message: `Stair width ${stairWidth}" is below IRC min of ${IRC_LIMITS.minStairWidth}"`,
      severity: 'warning',
    });
  }

  if (riserVariance > IRC_LIMITS.maxRiserVariance) {
    warnings.push({
      code: 'RISER_VARIANCE',
      message: `Riser variance ${riserVariance.toFixed(3)}" exceeds IRC max of ${IRC_LIMITS.maxRiserVariance}"`,
      severity: 'warning',
    });
  }

  if (throat < IRC_LIMITS.minThroat) {
    warnings.push({
      code: 'THROAT_TOO_THIN',
      message: `Stringer throat ${throat.toFixed(2)}" is below recommended min of ${IRC_LIMITS.minThroat}"`,
      severity: 'warning',
    });
  }

  return warnings;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/code-checks.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/code-checks.js tests/code-checks.test.js
git commit -m "feat: implement IRC code check warnings"
```

---

### Task 5: OpenSCAD Source Generator

**Files:**
- Create: `src/lib/scad-generator.js`
- Create: `tests/scad-generator.test.js`

This generates the complete `.scad` source string from parameters. Each structural component is a JS function returning an OpenSCAD module string.

- [ ] **Step 1: Write tests**

Create `tests/scad-generator.test.js`:

```javascript
import { describe, it, expect } from 'vitest';
import { generateScad } from '../src/lib/scad-generator.js';

describe('generateScad', () => {
  const params = {
    totalHeight: 96,
    topPostSpacing: 36,
    numRisers: 13,
    actualRiserHeight: 96 / 13,
    numTreads: 12,
    treadDepth: 11.125,
    totalRun: 12 * 11.125,
    stairAngle: 35,
    stairWidth: 36,
    numStringers: 4,
    stringerOC: 16,
    deckingThickness: 1.5,
    riserBoardThickness: 1.5,
    rimJoistWidth: 9.25,
    stringerStockWidth: 11.25,
    stringerStockThickness: 1.5,
    sillPlateThickness: 1.5,
    postSize: 3.5,
    padAboveGrade: 1,
    concreteBelow: 3,
    gravelDepth: 6,
    padSideClearance: 2,
    padWidth: 40,
    padDepth: 22.25,
    bottomDrop: 1.5,
    topTreadReduction: 1.5,
    postHeight: 42,
  };

  it('returns a non-empty string', () => {
    const scad = generateScad(params);
    expect(typeof scad).toBe('string');
    expect(scad.length).toBeGreaterThan(100);
  });

  it('contains the main staircase module call', () => {
    const scad = generateScad(params);
    expect(scad).toContain('staircase();');
  });

  it('contains all structural component modules', () => {
    const scad = generateScad(params);
    const requiredModules = [
      'module ground_plane',
      'module concrete_pad',
      'module sill_plate',
      'module bottom_posts',
      'module post_bases',
      'module stringer',
      'module blocking',
      'module tension_ties',
      'module treads',
      'module risers',
      'module stringer_hangers',
      'module rim_joist',
      'module deck_surface',
      'module top_posts',
    ];
    for (const mod of requiredModules) {
      expect(scad).toContain(mod);
    }
  });

  it('includes color assignments for different materials', () => {
    const scad = generateScad(params);
    // Concrete should be gray
    expect(scad).toMatch(/color\(\[0\.\d+,\s*0\.\d+,\s*0\.\d+/);
  });

  it('uses the correct number of stringers', () => {
    const scad = generateScad(params);
    // Should loop over numStringers (4)
    expect(scad).toContain('num_stringers = 4');
  });

  it('uses the correct number of treads', () => {
    const scad = generateScad(params);
    expect(scad).toContain('num_treads = 12');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/scad-generator.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the scad generator**

Create `src/lib/scad-generator.js`:

```javascript
/**
 * Generate complete OpenSCAD source from stair parameters.
 * Returns a string of valid .scad code.
 */
export function generateScad(p) {
  return `
// Stairmaster — Generated OpenSCAD Model
// All dimensions in inches

// Parameters
total_height = ${p.totalHeight};
top_post_spacing = ${p.topPostSpacing};
num_risers = ${p.numRisers};
actual_riser = ${p.actualRiserHeight};
num_treads = ${p.numTreads};
tread_depth = ${p.treadDepth};
total_run = ${p.totalRun};
stair_angle = ${p.stairAngle};
stair_width = ${p.stairWidth};
num_stringers = ${p.numStringers};
stringer_oc = ${p.stringerOC};
decking_h = ${p.deckingThickness};
riser_board_h = ${p.riserBoardThickness};
rim_joist_w = ${p.rimJoistWidth};
stringer_w = ${p.stringerStockWidth};
stringer_t = ${p.stringerStockThickness};
sill_plate_h = ${p.sillPlateThickness};
post_size = ${p.postSize};
pad_above = ${p.padAboveGrade};
concrete_below = ${p.concreteBelow};
gravel_depth = ${p.gravelDepth};
pad_clearance = ${p.padSideClearance};
pad_width = ${p.padWidth};
pad_depth = ${p.padDepth};
bottom_drop = ${p.bottomDrop};
top_tread_reduction = ${p.topTreadReduction};
post_height = ${p.postHeight};

// Colors
concrete_color = [0.6, 0.6, 0.6];
gravel_color = [0.36, 0.25, 0.13];
pt_lumber_color = [0.76, 0.60, 0.22];
decking_color = [0.63, 0.38, 0.04];
hardware_color = [0.86, 0.16, 0.16];
ground_color = [0.13, 0.77, 0.13, 0.3];

${groundPlaneModule()}

${concretePadModule()}

${sillPlateModule()}

${bottomPostsModule()}

${postBasesModule()}

${stringerModule()}

${blockingModule()}

${tensionTiesModule()}

${treadsModule()}

${risersModule()}

${stringerHangersModule()}

${rimJoistModule()}

${deckSurfaceModule()}

${topPostsModule()}

${staircaseModule()}

staircase();
`;
}

function groundPlaneModule() {
  return `
module ground_plane() {
  color(ground_color)
    translate([-50, -50, 0])
      cube([total_run + 150, stair_width + 100, 0.1]);
}`;
}

function concretePadModule() {
  return `
module concrete_pad() {
  // Gravel base
  color(gravel_color)
    translate([0, (stair_width - pad_width) / 2, -(concrete_below + gravel_depth)])
      cube([pad_depth, pad_width, gravel_depth]);
  // Concrete
  color(concrete_color)
    translate([0, (stair_width - pad_width) / 2, -concrete_below])
      cube([pad_depth, pad_width, concrete_below + pad_above]);
}`;
}

function sillPlateModule() {
  return `
module sill_plate() {
  color(pt_lumber_color)
    translate([0, (stair_width - top_post_spacing) / 2, pad_above])
      cube([tread_depth, top_post_spacing, sill_plate_h]);
}`;
}

function bottomPostsModule() {
  return `
module bottom_posts() {
  color(pt_lumber_color) {
    // Left post
    translate([-post_size, (stair_width - top_post_spacing) / 2 - post_size, pad_above])
      cube([post_size, post_size, post_height]);
    // Right post
    translate([-post_size, (stair_width + top_post_spacing) / 2, pad_above])
      cube([post_size, post_size, post_height]);
  }
}`;
}

function postBasesModule() {
  return `
module post_bases() {
  color(hardware_color) {
    // Left base plate
    translate([-post_size - 0.5, (stair_width - top_post_spacing) / 2 - post_size - 0.5, pad_above - 0.25])
      cube([post_size + 1, post_size + 1, 0.25]);
    // Right base plate
    translate([-post_size - 0.5, (stair_width + top_post_spacing) / 2 - 0.5, pad_above - 0.25])
      cube([post_size + 1, post_size + 1, 0.25]);
  }
}`;
}

function stringerModule() {
  return `
module stringer(offset_y) {
  rise = actual_riser;
  run = tread_depth;
  angle = atan(rise / run);

  color(pt_lumber_color)
  translate([0, offset_y, pad_above + sill_plate_h]) {
    // Build stringer as 2D polygon extruded to thickness
    linear_extrude(height = stringer_t) {
      // Bottom edge of stringer (straight line)
      // Top edge has sawtooth notches
      // We build the profile as a polygon

      // Start point: bottom-left of stringer at seat cut
      // The stringer runs from (0, 0) at the seat cut to (total_run, total_height - pad_above - sill_plate_h) at the rim joist

      effective_height = total_height - pad_above - sill_plate_h - decking_h;

      points = concat(
        // Bottom edge: two points along the uncut edge
        [[0, -bottom_drop],
         [total_run + stringer_w * cos(angle), effective_height - bottom_drop - stringer_w * sin(angle)]],

        // Top edge going back: plumb cut at top, then sawtooth
        [[total_run, effective_height - bottom_drop]],

        // Generate notch points for each tread (top to bottom)
        [for (i = [num_treads - 1 : -1 : 0])
          each [
            [i * run + (i == num_treads - 1 ? run - top_tread_reduction : run), i * rise + rise - bottom_drop],
            [i * run + (i == num_treads - 1 ? run - top_tread_reduction : run), i * rise - bottom_drop],
            [i * run, i * rise - bottom_drop]
          ]
        ],

        // Close at the seat cut
        [[0, -bottom_drop]]
      );

      polygon(points);
    }
  }
}`;
}

function blockingModule() {
  return `
module blocking() {
  color(pt_lumber_color)
  for (i = [0 : num_stringers - 2]) {
    y_start = (stair_width - top_post_spacing) / 2 + i * stringer_oc + stringer_t;
    block_len = stringer_oc - stringer_t;
    translate([0, y_start, pad_above + sill_plate_h])
      cube([tread_depth, block_len, stringer_w * 0.5]);
  }
}`;
}

function tensionTiesModule() {
  return `
module tension_ties() {
  color(hardware_color) {
    // Schematic plates at post-to-stringer connections
    // Left side
    translate([0, (stair_width - top_post_spacing) / 2 + stringer_t, pad_above + sill_plate_h])
      cube([0.25, 3, 6]);
    // Right side
    translate([0, (stair_width + top_post_spacing) / 2 - stringer_t - 3, pad_above + sill_plate_h])
      cube([0.25, 3, 6]);
  }
}`;
}

function treadsModule() {
  return `
module treads() {
  board_w = 5.5;  // 2x6 width
  gap = 0.125;
  color(decking_color)
  for (i = [0 : num_treads - 1]) {
    x = i * tread_depth;
    z = pad_above + sill_plate_h + (i + 1) * actual_riser - bottom_drop;
    // Front board
    translate([x, 0, z])
      cube([board_w, stair_width, decking_h]);
    // Back board
    translate([x + board_w + gap, 0, z])
      cube([board_w, stair_width, decking_h]);
  }
}`;
}

function risersModule() {
  return `
module risers() {
  color(decking_color)
  for (i = [0 : num_treads - 1]) {
    x = i * tread_depth;
    z_bottom = pad_above + sill_plate_h + i * actual_riser - bottom_drop;
    z_top = z_bottom + actual_riser;
    translate([x, 0, z_bottom])
      cube([riser_board_h, stair_width, actual_riser]);
  }
}`;
}

function stringerHangersModule() {
  return `
module stringer_hangers() {
  color(hardware_color)
  for (i = [0 : num_stringers - 1]) {
    y = (stair_width - top_post_spacing) / 2 + i * stringer_oc;
    translate([total_run - 0.5, y, total_height - decking_h - rim_joist_w])
      cube([1, stringer_t, 4]);
  }
}`;
}

function rimJoistModule() {
  return `
module rim_joist() {
  color(pt_lumber_color)
    translate([total_run, 0, total_height - decking_h - rim_joist_w])
      cube([1.5, stair_width, rim_joist_w]);
}`;
}

function deckSurfaceModule() {
  return `
module deck_surface() {
  color(decking_color)
    translate([total_run, 0, total_height - decking_h])
      cube([24, stair_width + 12, decking_h]);
}`;
}

function topPostsModule() {
  return `
module top_posts() {
  color(pt_lumber_color) {
    translate([total_run + 1.5, (stair_width - top_post_spacing) / 2 - post_size, total_height - decking_h])
      cube([post_size, post_size, post_height]);
    translate([total_run + 1.5, (stair_width + top_post_spacing) / 2, total_height - decking_h])
      cube([post_size, post_size, post_height]);
  }
}`;
}

function staircaseModule() {
  return `
module staircase() {
  ground_plane();
  concrete_pad();
  sill_plate();
  bottom_posts();
  post_bases();

  // Stringers
  for (i = [0 : num_stringers - 1]) {
    y = (stair_width - top_post_spacing) / 2 + i * stringer_oc;
    stringer(y);
  }

  blocking();
  tension_ties();
  treads();
  risers();
  stringer_hangers();
  rim_joist();
  deck_surface();
  top_posts();
}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/scad-generator.test.js
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/scad-generator.js tests/scad-generator.test.js
git commit -m "feat: implement OpenSCAD source generator with all structural modules"
```

---

### Task 6: OpenSCAD Web Worker

**Files:**
- Create: `src/worker/openscad-worker.js`

- [ ] **Step 1: Create the Web Worker**

Create `src/worker/openscad-worker.js`:

```javascript
import OpenSCAD from 'openscad-wasm';

let instance = null;

async function init() {
  if (instance) return instance;
  instance = await OpenSCAD({ noInitialRun: true });
  return instance;
}

self.onmessage = async function (e) {
  const { type, scadSource, id } = e.data;

  if (type === 'render') {
    try {
      const inst = await init();

      // Write the .scad source to the virtual filesystem
      inst.FS.writeFile('/input.scad', scadSource);

      // Render to STL
      inst.callMain(['/input.scad', '--enable=manifold', '-o', '/output.stl']);
      const stlData = inst.FS.readFile('/output.stl');

      // 2D views (side/front) are handled by Three.js orthographic camera,
      // not separate SVG projection. This avoids doubling WASM render time.

      self.postMessage({
        type: 'result',
        id,
        stl: stlData.buffer,
      }, [stlData.buffer]);

    } catch (err) {
      self.postMessage({
        type: 'error',
        id,
        error: err.message || String(err),
      });
    }
  }
};

// Signal ready
init().then(() => {
  self.postMessage({ type: 'ready' });
}).catch((err) => {
  self.postMessage({ type: 'init-error', error: err.message || String(err) });
});
```

- [ ] **Step 2: Commit**

```bash
git add src/worker/openscad-worker.js
git commit -m "feat: add OpenSCAD WASM Web Worker for background rendering"
```

---

### Task 7: Three.js Viewport Component

**Files:**
- Create: `src/components/Viewport.svelte`

- [ ] **Step 1: Create the Viewport component**

Create `src/components/Viewport.svelte`:

```svelte
<script>
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { STLLoader } from 'three/addons/loaders/STLLoader.js';

  let { stlData = null, viewMode = '3d' } = $props();

  let canvas;
  let renderer, scene, camera, controls, mesh;
  let animationId;

  function setupScene() {
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x1e293b);

    scene = new THREE.Scene();

    // Lighting
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(50, 100, 50);
    scene.add(directional);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-50, 50, -50);
    scene.add(fill);

    updateCamera();

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.addEventListener('change', requestRender);
  }

  function updateCamera() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (viewMode === '3d') {
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
      camera.position.set(-80, 60, 120);
    } else {
      const frustum = 80;
      const aspect = width / height;
      camera = new THREE.OrthographicCamera(
        -frustum * aspect, frustum * aspect,
        frustum, -frustum,
        0.1, 10000
      );
      if (viewMode === 'side') {
        camera.position.set(60, 50, 200);
        camera.lookAt(60, 50, 0);
      } else if (viewMode === 'front') {
        camera.position.set(-200, 50, 20);
        camera.lookAt(0, 50, 20);
      }
    }

    if (controls) {
      controls.object = camera;
      controls.update();
    }
  }

  function loadSTL(data) {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    if (!data) return;

    const loader = new STLLoader();
    const geometry = loader.parse(data);
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
      color: 0xc08020,
      specular: 0x222222,
      shininess: 20,
      flatShading: false,
    });
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Auto-fit camera to model bounds
    const box = new THREE.Box3().setFromObject(mesh);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (controls) {
      controls.target.copy(center);
      controls.update();
    }

    if (viewMode === '3d') {
      camera.position.set(
        center.x - maxDim * 0.8,
        center.y + maxDim * 0.6,
        center.z + maxDim * 1.2
      );
    }

    requestRender();
  }

  let renderRequested = false;
  function requestRender() {
    if (!renderRequested) {
      renderRequested = true;
      requestAnimationFrame(render);
    }
  }

  function render() {
    renderRequested = false;
    if (!renderer) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
      renderer.setSize(width, height, false);
      if (camera.isPerspectiveCamera) {
        camera.aspect = width / height;
      } else {
        const frustum = 80;
        const aspect = width / height;
        camera.left = -frustum * aspect;
        camera.right = frustum * aspect;
        camera.top = frustum;
        camera.bottom = -frustum;
      }
      camera.updateProjectionMatrix();
    }

    controls.update();
    renderer.render(scene, camera);
  }

  onMount(() => {
    setupScene();
    requestRender();
    window.addEventListener('resize', requestRender);
  });

  onDestroy(() => {
    window.removeEventListener('resize', requestRender);
    if (controls) controls.dispose();
    if (renderer) renderer.dispose();
  });

  $effect(() => {
    if (stlData && renderer) {
      loadSTL(stlData);
    }
  });

  $effect(() => {
    viewMode;  // track
    if (renderer) {
      updateCamera();
      requestRender();
    }
  });
</script>

<div class="viewport-container">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .viewport-container {
    width: 100%;
    height: 100%;
    min-height: 400px;
    position: relative;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Viewport.svelte
git commit -m "feat: add Three.js viewport with orbit controls and orthographic views"
```

---

### Task 8: Input Panel Component

**Files:**
- Create: `src/components/InputPanel.svelte`

- [ ] **Step 1: Create the InputPanel component**

Create `src/components/InputPanel.svelte`:

```svelte
<script>
  let {
    totalHeight = $bindable(),
    topPostSpacing = $bindable(),
    riserHeight = $bindable(),
    treadDepth = $bindable(),
    stringerOC = $bindable(),
    deckingThickness = $bindable(),
    riserBoardThickness = $bindable(),
    rimJoistWidth = $bindable(),
    sillPlateThickness = $bindable(),
    padAboveGrade = $bindable(),
    concreteBelow = $bindable(),
    gravelDepth = $bindable(),
    padSideClearance = $bindable(),
    postBase = $bindable(),
    tensionTie = $bindable(),
    stringerHanger = $bindable(),
  } = $props();

  let sections = $state({
    site: true,
    geometry: true,
    materials: false,
    pad: false,
    hardware: false,
  });

  function toggle(section) {
    sections[section] = !sections[section];
  }
</script>

<div class="input-panel">
  <h2>Stairmaster</h2>

  <!-- Site Measurements -->
  <button class="section-header" onclick={() => toggle('site')}>
    <span>{sections.site ? '▾' : '▸'}</span> Site Measurements
  </button>
  {#if sections.site}
    <div class="section-body">
      <label>
        <span>Grade to deck top (in)</span>
        <input type="number" bind:value={totalHeight} step="0.25" min="12" />
      </label>
      <label>
        <span>Post spacing (in)</span>
        <input type="number" bind:value={topPostSpacing} step="0.25" min="24" />
      </label>
    </div>
  {/if}

  <!-- Stair Geometry -->
  <button class="section-header" onclick={() => toggle('geometry')}>
    <span>{sections.geometry ? '▾' : '▸'}</span> Stair Geometry
  </button>
  {#if sections.geometry}
    <div class="section-body">
      <label>
        <span>Target riser height (in)</span>
        <input type="number" bind:value={riserHeight} step="0.125" min="4" max="8" />
      </label>
      <label>
        <span>Tread depth (in)</span>
        <input type="number" bind:value={treadDepth} step="0.125" min="9" />
      </label>
      <label>
        <span>Stringer OC</span>
        <div class="toggle-group">
          <button class:active={stringerOC === 12} onclick={() => stringerOC = 12}>12"</button>
          <button class:active={stringerOC === 16} onclick={() => stringerOC = 16}>16"</button>
        </div>
      </label>
    </div>
  {/if}

  <!-- Materials -->
  <button class="section-header" onclick={() => toggle('materials')}>
    <span>{sections.materials ? '▾' : '▸'}</span> Materials
  </button>
  {#if sections.materials}
    <div class="section-body">
      <label>
        <span>Decking thickness (in)</span>
        <input type="number" bind:value={deckingThickness} step="0.25" min="0.75" />
      </label>
      <label>
        <span>Riser board thickness (in)</span>
        <input type="number" bind:value={riserBoardThickness} step="0.25" min="0.75" />
      </label>
      <label>
        <span>Rim joist width (in)</span>
        <input type="number" bind:value={rimJoistWidth} step="0.25" min="5.5" />
      </label>
      <label>
        <span>Sill plate thickness (in)</span>
        <input type="number" bind:value={sillPlateThickness} step="0.25" min="0.75" />
      </label>
    </div>
  {/if}

  <!-- Concrete Pad -->
  <button class="section-header" onclick={() => toggle('pad')}>
    <span>{sections.pad ? '▾' : '▸'}</span> Concrete Pad
  </button>
  {#if sections.pad}
    <div class="section-body">
      <label>
        <span>Above grade (in)</span>
        <input type="number" bind:value={padAboveGrade} step="0.25" min="0" />
      </label>
      <label>
        <span>Concrete below grade (in)</span>
        <input type="number" bind:value={concreteBelow} step="0.5" min="2" />
      </label>
      <label>
        <span>Gravel depth (in)</span>
        <input type="number" bind:value={gravelDepth} step="0.5" min="4" />
      </label>
      <label>
        <span>Pad side clearance (in)</span>
        <input type="number" bind:value={padSideClearance} step="0.5" min="0" />
      </label>
    </div>
  {/if}

  <!-- Hardware -->
  <button class="section-header" onclick={() => toggle('hardware')}>
    <span>{sections.hardware ? '▾' : '▸'}</span> Hardware
  </button>
  {#if sections.hardware}
    <div class="section-body">
      <label>
        <span>Post base</span>
        <input type="text" bind:value={postBase} />
      </label>
      <label>
        <span>Tension tie</span>
        <input type="text" bind:value={tensionTie} />
      </label>
      <label>
        <span>Stringer hanger</span>
        <input type="text" bind:value={stringerHanger} />
      </label>
    </div>
  {/if}
</div>

<style>
  .input-panel {
    padding: 16px;
    overflow-y: auto;
    height: 100%;
  }
  h2 {
    margin: 0 0 16px;
    font-size: 1.2em;
    color: #e2e8f0;
  }
  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 12px;
    margin-bottom: 2px;
    background: #1e293b;
    border: none;
    border-radius: 6px;
    color: #60a5fa;
    font-weight: 600;
    font-size: 0.9em;
    cursor: pointer;
    text-align: left;
  }
  .section-header:hover { background: #334155; }
  .section-body {
    padding: 8px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85em;
    color: #cbd5e1;
  }
  input[type="number"], input[type="text"] {
    width: 80px;
    padding: 4px 8px;
    background: #0f172a;
    border: 1px solid #334155;
    border-radius: 4px;
    color: #fbbf24;
    text-align: right;
    font-family: monospace;
  }
  input[type="text"] {
    width: 140px;
    text-align: left;
  }
  .toggle-group {
    display: flex;
    gap: 4px;
  }
  .toggle-group button {
    padding: 4px 12px;
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.85em;
  }
  .toggle-group button.active {
    background: #60a5fa;
    color: #0f172a;
    font-weight: 600;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/InputPanel.svelte
git commit -m "feat: add input panel with collapsible sections"
```

---

### Task 9: Output Panel and Code Warnings Components

**Files:**
- Create: `src/components/OutputPanel.svelte`
- Create: `src/components/CodeWarnings.svelte`

- [ ] **Step 1: Create CodeWarnings component**

Create `src/components/CodeWarnings.svelte`:

```svelte
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
```

- [ ] **Step 2: Create OutputPanel component**

Create `src/components/OutputPanel.svelte`:

```svelte
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
    <div class="row"><span>Throat</span><strong>{fmt(throat)}"</strong></div>
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
```

- [ ] **Step 3: Commit**

```bash
git add src/components/OutputPanel.svelte src/components/CodeWarnings.svelte
git commit -m "feat: add output panel and code warnings components"
```

---

### Task 10: App Shell — Wire Everything Together

**Files:**
- Modify: `src/App.svelte`
- Modify: `src/main.js`
- Modify: `index.html`

- [ ] **Step 1: Update index.html**

Replace the contents of `index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Stairmaster — Deck Stair Calculator</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Update src/main.js**

Replace `src/main.js` with:

```javascript
import App from './App.svelte';
import { mount } from 'svelte';

const app = mount(App, { target: document.getElementById('app') });

export default app;
```

- [ ] **Step 3: Write the App shell**

Replace `src/App.svelte` with:

```svelte
<script>
  import { DEFAULTS, MATERIALS } from './lib/constants.js';
  import { computeStairGeometry, computePadDimensions, computeStringerProfile } from './lib/calculations.js';
  import { checkIRC } from './lib/code-checks.js';
  import { generateScad } from './lib/scad-generator.js';
  import InputPanel from './components/InputPanel.svelte';
  import Viewport from './components/Viewport.svelte';
  import OutputPanel from './components/OutputPanel.svelte';

  // Reactive input state
  let totalHeight = $state(96);
  let topPostSpacing = $state(36);
  let riserHeight = $state(DEFAULTS.riserHeight);
  let treadDepth = $state(DEFAULTS.treadDepth);
  let stringerOC = $state(DEFAULTS.stringerOC);
  let deckingThickness = $state(DEFAULTS.deckingThickness);
  let riserBoardThickness = $state(DEFAULTS.riserBoardThickness);
  let rimJoistWidth = $state(DEFAULTS.rimJoistWidth);
  let sillPlateThickness = $state(DEFAULTS.sillPlateThickness);
  let padAboveGrade = $state(DEFAULTS.padAboveGrade);
  let concreteBelow = $state(DEFAULTS.concreteBelow);
  let gravelDepth = $state(DEFAULTS.gravelDepth);
  let padSideClearance = $state(DEFAULTS.padSideClearance);

  let postBase = $state(DEFAULTS.postBase);
  let tensionTie = $state(DEFAULTS.tensionTie);
  let stringerHanger = $state(DEFAULTS.stringerHanger);

  let viewMode = $state('3d');
  let stlData = $state(null);
  let workerReady = $state(false);
  let rendering = $state(false);

  // Computed geometry
  let geometry = $derived(computeStairGeometry({
    totalHeight, topPostSpacing, riserHeight, treadDepth, stringerOC,
    deckingThickness, riserBoardThickness, rimJoistWidth, sillPlateThickness,
    padAboveGrade, stringerStockWidth: MATERIALS['2x12'].width,
  }));

  let stringerProfile = $derived(computeStringerProfile({
    numTreads: geometry.numTreads,
    actualRiserHeight: geometry.actualRiserHeight,
    treadDepth, deckingThickness, riserBoardThickness,
    sillPlateThickness, padAboveGrade,
    stringerStockWidth: MATERIALS['2x12'].width,
  }));

  let padDims = $derived(computePadDimensions({
    topPostSpacing, padSideClearance, treadDepth,
    seatCutLength: stringerProfile.seatCutLength,
    padAboveGrade, concreteBelow, gravelDepth,
  }));

  let warnings = $derived(checkIRC({
    actualRiserHeight: geometry.actualRiserHeight,
    treadDepth,
    stairWidth: geometry.stairWidth,
    throat: geometry.throat,
    riserVariance: 0,
  }));

  let scadSource = $derived(generateScad({
    totalHeight, topPostSpacing,
    numRisers: geometry.numRisers,
    actualRiserHeight: geometry.actualRiserHeight,
    numTreads: geometry.numTreads,
    treadDepth, totalRun: geometry.totalRun,
    stairAngle: geometry.stairAngle,
    stairWidth: geometry.stairWidth,
    numStringers: geometry.numStringers,
    stringerOC, deckingThickness, riserBoardThickness,
    rimJoistWidth,
    stringerStockWidth: MATERIALS['2x12'].width,
    stringerStockThickness: MATERIALS['2x12'].thickness,
    sillPlateThickness, postSize: MATERIALS['4x4'].actual,
    padAboveGrade, concreteBelow, gravelDepth, padSideClearance,
    padWidth: padDims.padWidth, padDepth: padDims.padDepth,
    bottomDrop: stringerProfile.bottomDrop,
    topTreadReduction: stringerProfile.topTreadReduction,
    postHeight: 42,
  }));

  // Web Worker
  let worker;
  let renderTimer;
  let renderId = 0;

  function initWorker() {
    worker = new Worker(
      new URL('./worker/openscad-worker.js', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = (e) => {
      if (e.data.type === 'ready') {
        workerReady = true;
        requestRender();
      } else if (e.data.type === 'result' && e.data.id === renderId) {
        stlData = e.data.stl;
        rendering = false;
      } else if (e.data.type === 'error') {
        console.error('OpenSCAD error:', e.data.error);
        rendering = false;
      }
    };
  }

  function requestRender() {
    if (!workerReady) return;
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      renderId++;
      rendering = true;
      worker.postMessage({ type: 'render', scadSource, id: renderId });
    }, 500);
  }

  $effect(() => {
    initWorker();
    return () => { if (worker) worker.terminate(); };
  });

  // Re-render when scad source changes
  $effect(() => {
    scadSource;  // track dependency
    requestRender();
  });

  function downloadScad() {
    const blob = new Blob([scadSource], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stairmaster.scad';
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadStl() {
    if (!stlData) return;
    const blob = new Blob([stlData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'stairmaster.stl';
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="app">
  <div class="panel left">
    <InputPanel
      bind:totalHeight bind:topPostSpacing
      bind:riserHeight bind:treadDepth bind:stringerOC
      bind:deckingThickness bind:riserBoardThickness bind:rimJoistWidth
      bind:sillPlateThickness
      bind:padAboveGrade bind:concreteBelow bind:gravelDepth bind:padSideClearance
      bind:postBase bind:tensionTie bind:stringerHanger
    />
  </div>

  <div class="panel center">
    <div class="viewport-toolbar">
      <div class="view-toggle">
        <button class:active={viewMode === '3d'} onclick={() => viewMode = '3d'}>3D</button>
        <button class:active={viewMode === 'side'} onclick={() => viewMode = 'side'}>Side</button>
        <button class:active={viewMode === 'front'} onclick={() => viewMode = 'front'}>Front</button>
      </div>
      <div class="downloads">
        <button onclick={downloadScad}>⬇ .scad</button>
        <button onclick={downloadStl} disabled={!stlData}>⬇ .stl</button>
      </div>
      {#if rendering}
        <span class="rendering">Rendering...</span>
      {/if}
      {#if !workerReady}
        <span class="loading">Loading OpenSCAD WASM...</span>
      {/if}
    </div>
    <Viewport {stlData} {viewMode} />
  </div>

  <div class="panel right">
    <OutputPanel
      numRisers={geometry.numRisers}
      numTreads={geometry.numTreads}
      actualRiserHeight={geometry.actualRiserHeight}
      stairAngle={geometry.stairAngle}
      totalRun={geometry.totalRun}
      stringerLength={geometry.stringerLength}
      numStringers={geometry.numStringers}
      throat={geometry.throat}
      padWidth={padDims.padWidth}
      padDepth={padDims.padDepth}
      concreteThickness={padDims.concreteThickness}
      excavationDepth={padDims.excavationDepth}
      {warnings}
      {postBase}
      {tensionTie}
      {stringerHanger}
    />
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #0f172a;
    color: #e2e8f0;
  }
  .app {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }
  .panel {
    overflow-y: auto;
  }
  .left {
    width: 280px;
    flex-shrink: 0;
    border-right: 1px solid #1e293b;
  }
  .center {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .right {
    width: 260px;
    flex-shrink: 0;
    border-left: 1px solid #1e293b;
  }
  .viewport-toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    background: #1e293b;
    border-bottom: 1px solid #334155;
  }
  .view-toggle {
    display: flex;
    gap: 4px;
  }
  .view-toggle button, .downloads button {
    padding: 4px 12px;
    background: #334155;
    border: none;
    border-radius: 4px;
    color: #94a3b8;
    cursor: pointer;
    font-size: 0.8em;
  }
  .view-toggle button.active {
    background: #60a5fa;
    color: #0f172a;
    font-weight: 600;
  }
  .rendering, .loading {
    font-size: 0.8em;
    color: #fbbf24;
    margin-left: auto;
  }

  @media (max-width: 1024px) {
    .app { flex-direction: column; height: auto; }
    .left, .right { width: 100%; border: none; border-bottom: 1px solid #1e293b; }
    .center { min-height: 400px; }
  }
</style>
```

- [ ] **Step 4: Clean up scaffolded files**

Remove any Vite-generated default files that are no longer needed:

```bash
rm -f src/app.css src/assets/svelte.svg src/lib/Counter.svelte
```

- [ ] **Step 5: Verify dev server runs**

```bash
npm run dev
```

Expected: App loads with three-column layout. Input panel on left, viewport in center (empty until WASM loads), output panel on right with computed values. Console may show WASM loading messages.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: wire up App shell with reactive state, worker, and all components"
```

---

### Task 11: Delete Smoke Test

**Files:**
- Delete: `tests/smoke.test.js`

- [ ] **Step 1: Remove the smoke test**

```bash
rm tests/smoke.test.js
```

- [ ] **Step 2: Run all tests to verify everything passes**

```bash
npx vitest run
```

Expected: All tests in `calculations.test.js`, `code-checks.test.js`, and `scad-generator.test.js` pass.

- [ ] **Step 3: Commit**

```bash
git rm tests/smoke.test.js
git commit -m "chore: remove smoke test"
```

---

### Task 12: Manual Integration Test and Fix Pass

**Files:**
- Potentially modify any file from above based on what breaks.

- [ ] **Step 1: Start dev server and test in browser**

```bash
npm run dev
```

Open in browser. Verify:
1. Input panel shows with all fields and defaults
2. Computed results update when inputs change
3. IRC warnings appear/disappear correctly
4. OpenSCAD WASM loads (check console for "ready" message)
5. 3D model renders after WASM loads
6. View toggle switches between 3D/Side/Front
7. Download .scad button works

- [ ] **Step 2: Fix any issues found**

Address bugs discovered during manual testing. Common issues to watch for:
- WASM file not found (may need to copy from `node_modules/openscad-wasm/`)
- Stringer polygon generation producing invalid geometry (test with simple 3-step stairs first)
- Three.js STL loading errors if binary STL format differs from expected

- [ ] **Step 3: Verify riser consistency math**

With default inputs (96" height, 7.5" target riser):
- Bottom finished riser (pad surface → first tread) should equal actual riser height
- Top finished riser (last tread → deck surface) should equal actual riser height
- Check the stringer profile visually in the side view

- [ ] **Step 4: Commit fixes**

```bash
git add -A
git commit -m "fix: integration fixes from manual testing"
```
