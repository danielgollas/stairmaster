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

// Colors
concrete_color = [0.6, 0.6, 0.6];
gravel_color = [0.36, 0.25, 0.13];
pt_lumber_color = [0.76, 0.60, 0.22];
decking_color = [0.63, 0.38, 0.04];
hardware_color = [0.86, 0.16, 0.16];
ground_color = [0.13, 0.77, 0.13, 0.3];

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

${staircaseModule(v)}

staircase();
`;
}

function gridModule() {
  return `
module floor_grid() {
  color([0.3, 0.3, 0.3, 0.5])
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
  hyp = sqrt(rise * rise + run * run);
  // Perpendicular offset for the board width (bottom edge offset from top edge)
  bx = -stringer_w * sin(angle);  // x component of perpendicular offset
  by = stringer_w * cos(angle);   // note: this goes "down" from top edge (negative in our coords, but we negate)

  color(pt_lumber_color)
  translate([0, offset_y, pad_above + sill_plate_h])
  // Rotate from XY polygon plane to XZ (standing up), then extrude along Y for thickness
  rotate([270, 0, 0]) {
    linear_extrude(height = stringer_t) {
      // Build polygon clockwise: sawtooth top edge (left to right), then bottom edge (right to left)
      // All coords in installed frame: x = horizontal, y = vertical (up)

      top_points = concat(
        // Start: seat cut at bottom-left of sawtooth
        [[0, -bottom_drop]],
        // Sawtooth notches going up (left to right)
        [for (i = [0 : num_treads - 1])
          each [
            [i * run, i * rise - bottom_drop],                                                           // riser bottom (inside corner)
            [i * run, (i + 1) * rise - bottom_drop],                                                    // riser top
            [i * run + (i == num_treads - 1 ? run - top_tread_reduction : run), (i + 1) * rise - bottom_drop]  // tread end
          ]
        ],
        // Plumb cut at top (vertical line up to where rim joist meets)
        [[num_treads * run, num_treads * rise - bottom_drop]]
      );

      // Bottom edge: parallel to the stair slope, offset by board width perpendicular
      // Goes from top-right back to bottom-left
      bot_right_x = num_treads * run - stringer_w * rise / hyp;
      bot_right_y = num_treads * rise - bottom_drop - stringer_w * run / hyp;
      bot_left_x = 0 - stringer_w * rise / hyp;
      bot_left_y = -bottom_drop - stringer_w * run / hyp;

      bottom_points = [
        [bot_right_x, bot_right_y],
        [bot_left_x, bot_left_y]
      ];

      polygon(concat(top_points, bottom_points));
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

function staircaseModule(v) {
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
    stringer(y);
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
