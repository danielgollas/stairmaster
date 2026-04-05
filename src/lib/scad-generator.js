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
