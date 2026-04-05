/**
 * Generate complete OpenSCAD source from stair parameters.
 * Returns a string of valid .scad code.
 */
export function generateScad(p, visibility = {}) {
  const v = {
    groundPlane: true, concretePad: true, sillPlate: true,
    bottomPosts: true, postBases: true, stringers: true,
    blocking: true, tensionTies: true, treads: true,
    risers: true, stringerHangers: true, rimJoist: true,
    deckSurface: true, topPosts: true, grid: true,
    ...visibility,
  };
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

// Colors — distinct per component type
concrete_color = [0.65, 0.65, 0.65];
gravel_color = [0.45, 0.35, 0.20];
stringer_color = [0.85, 0.65, 0.15];
sill_plate_color = [0.70, 0.50, 0.10];
post_color = [0.60, 0.40, 0.15];
decking_color = [0.55, 0.35, 0.10];
riser_color = [0.50, 0.30, 0.08];
blocking_color = [0.75, 0.55, 0.20];
hardware_color = [0.80, 0.20, 0.20];
rim_joist_color = [0.65, 0.45, 0.12];
ground_color = [0.13, 0.77, 0.13, 0.3];
grid_color = [0.3, 0.3, 0.3, 0.5];

${gridModule()}

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

${staircaseModule(v, p)}

staircase();
`;
}

function gridModule() {
  return `
module floor_grid() {
  color(grid_color)
  for (x = [-24 : 12 : total_run + 48]) {
    translate([x, -24, -0.05])
      cube([0.25, stair_width + 48, 0.05]);
  }
  for (y = [-24 : 12 : stair_width + 48]) {
    translate([-24, y, -0.05])
      cube([total_run + 72, 0.25, 0.05]);
  }
}`;
}

function groundPlaneModule() {
  return `
module ground_plane() {
  color(ground_color)
    translate([-24, -24, -0.1])
      cube([total_run + 72, stair_width + 48, 0.1]);
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
  color(sill_plate_color)
    translate([0, (stair_width - top_post_spacing) / 2, pad_above])
      cube([tread_depth, top_post_spacing, sill_plate_h]);
}`;
}

function bottomPostsModule() {
  return `
module bottom_posts() {
  color(post_color) {
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
  // Build stringer from cubes using difference() — avoids CGAL polygon issues
  // The stringer is a rotated board with rectangular notches cut out
  return `
module stringer_at(offset_y) {
  rise = actual_riser;
  run = tread_depth;
  angle = atan2(rise, run);
  hyp = sqrt(rise * rise + run * run);
  stair_run = num_treads * run;
  stair_rise = num_treads * rise - bottom_drop;
  board_len = sqrt(stair_rise * stair_rise + stair_run * stair_run) + stringer_w * 2;

  color(stringer_color)
  translate([0, offset_y, pad_above + sill_plate_h])
  difference() {
    // Full board along stair slope
    rotate([0, -angle, 0])
      translate([-stringer_w, 0, 0])
        cube([board_len, stringer_t, stringer_w]);

    // Cut notches: each is a cube at the tread/riser position
    for (i = [0 : num_treads - 1]) {
      td = i == num_treads - 1 ? run - top_tread_reduction : run;
      tread_z = (i + 1) * rise - bottom_drop;
      // Remove everything above each tread level, within the tread run
      translate([i * run - 0.01, -0.01, tread_z])
        cube([td + 0.02, stringer_t + 0.02, stringer_w + 10]);
    }

    // Trim below seat cut (z < 0)
    translate([-stringer_w * 3, -0.01, -stringer_w * 3])
      cube([stair_run + stringer_w * 6, stringer_t + 0.02, stringer_w * 3]);

    // Trim beyond top plumb cut (x > stair_run)
    translate([stair_run, -0.01, -stringer_w])
      cube([stringer_w * 3, stringer_t + 0.02, stair_rise + stringer_w * 6]);

    // Trim behind seat (x < 0)
    translate([-stringer_w * 3, -0.01, -stringer_w * 3])
      cube([stringer_w * 3, stringer_t + 0.02, stair_rise + stringer_w * 6]);
  }
}`;
}

function blockingModule() {
  return `
module blocking() {
  color(blocking_color)
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
  color(riser_color)
  for (i = [0 : num_treads - 1]) {
    x = i * tread_depth;
    z_bottom = pad_above + sill_plate_h + i * actual_riser - bottom_drop;
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
  color(rim_joist_color)
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
  color(post_color) {
    translate([total_run + 1.5, (stair_width - top_post_spacing) / 2 - post_size, total_height - decking_h])
      cube([post_size, post_size, post_height]);
    translate([total_run + 1.5, (stair_width + top_post_spacing) / 2, total_height - decking_h])
      cube([post_size, post_size, post_height]);
  }
}`;
}

function staircaseModule(v, p) {
  return `
module staircase() {
  ${v.grid ? 'floor_grid();' : ''}
  ${v.groundPlane ? 'ground_plane();' : ''}
  ${v.concretePad ? 'concrete_pad();' : ''}
  ${v.sillPlate ? 'sill_plate();' : ''}
  ${v.bottomPosts ? 'bottom_posts();' : ''}
  ${v.postBases ? 'post_bases();' : ''}

  ${v.stringers ? `// Stringers
  for (i = [0 : num_stringers - 1]) {
    y = (stair_width - top_post_spacing) / 2 + i * stringer_oc;
    stringer_at(y);
  }` : ''}

  ${v.blocking ? 'blocking();' : ''}
  ${v.tensionTies ? 'tension_ties();' : ''}
  ${v.treads ? 'treads();' : ''}
  ${v.risers ? 'risers();' : ''}
  ${v.stringerHangers ? 'stringer_hangers();' : ''}
  ${v.rimJoist ? 'rim_joist();' : ''}
  ${v.deckSurface ? 'deck_surface();' : ''}
  ${v.topPosts ? 'top_posts();' : ''}
}`;
}
