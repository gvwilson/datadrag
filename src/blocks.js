// Block geometry constants
export const W = 120;       // standard block width in pixels
export const H = 60;        // standard block height in pixels
export const W_WIDE = 240;  // canvas width for data-science blocks (csv, filter, show)
export const H_WIDE = 80;   // canvas height for data-science blocks
export const BUMP = 14;     // height of convex tab / depth of concave notch
export const KNOB_R = 12;   // radius of connection knobs

// Block type definitions
export const BLOCK_TYPES = {
  csv:         { label: 'CSV',         top: 'flat',   bottom: 'concave', knobs: ['out0'],             wide: true },
  filter:      { label: 'Filter',      top: 'convex', bottom: 'concave', knobs: ['out0'],             wide: true },
  select:      { label: 'Select',      top: 'convex', bottom: 'concave', knobs: ['out0'],             wide: true },
  sort:        { label: 'Sort',        top: 'convex', bottom: 'concave', knobs: ['out0'],             wide: true },
  groupby:     { label: 'Group By',    top: 'convex', bottom: 'concave', knobs: ['out0'],             wide: true },
  summarize:   { label: 'Summarize',   top: 'convex', bottom: 'concave', knobs: ['out0'],             wide: true },
  mutate:      { label: 'Mutate',      top: 'convex', bottom: 'concave', knobs: ['out0'],             wide: true },
  slice:       { label: 'Slice',       top: 'convex', bottom: 'concave', knobs: ['out0'],             wide: true },
  deduplicate: { label: 'Unique',       top: 'convex', bottom: 'concave', knobs: ['out0'],             wide: true },
  join:        { label: 'Join',        top: 'flat',   bottom: 'concave', knobs: ['in0','in1','out0'], wide: true },
  show:        { label: 'Show',        top: 'convex', bottom: 'concave', knobs: [],                  wide: true },
};

// Rendered width/height of a block type on the canvas.
export function blockW(type) { return BLOCK_TYPES[type]?.wide ? W_WIDE : W; }
export function blockH(type) { return BLOCK_TYPES[type]?.wide ? H_WIDE : H; }

// SVG path for a block drawn at origin (0,0); use a <g transform="translate(x,y)"> to position it.
// Convex top: middle of top edge bows upward by BUMP pixels.
// Concave bottom: middle of bottom edge bows upward by BUMP pixels (notch).
// Optional w/h override lets the palette always render at standard size.
export function blockPath(type, w = blockW(type), h = blockH(type)) {
  const { top, bottom } = BLOCK_TYPES[type];
  const topEdge = top === 'convex'
    ? `M 0,0 Q ${w / 2},${-BUMP} ${w},0`
    : `M 0,0 L ${w},0`;
  const bottomEdge = bottom === 'concave'
    ? `L ${w},${h} Q ${w / 2},${h - BUMP} 0,${h}`
    : `L ${w},${h} L 0,${h}`;
  return `${topEdge} ${bottomEdge} Z`;
}

// Knob positions relative to block origin (0,0).
// Fan-in: two input knobs on the top edge (triangular indents, tip at y=KNOB_R).
// Fan-out: one output knob on the right edge (triangular outdent, tip at x=W+KNOB_R).
export function knobPositions(type, w = blockW(type), h = blockH(type)) {
  const { knobs } = BLOCK_TYPES[type];
  return knobs.map((id, i) => {
    if (id.startsWith('in')) {
      return { id, x: Math.round(w * (i + 1) / (knobs.length + 1)), y: KNOB_R, shape: 'indent' };
    } else {
      return { id, x: w + KNOB_R, y: h / 2, shape: 'outdent' };
    }
  });
}

// Can this block type start a connection (has output knobs)?
export function canInitiateConnect(type) {
  return BLOCK_TYPES[type].knobs.some(k => k.startsWith('out'));
}

// Can this block type receive a connection (has input knobs)?
export function canReceiveConnect(type) {
  return BLOCK_TYPES[type].knobs.some(k => k.startsWith('in'));
}
