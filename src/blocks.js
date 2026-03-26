// Block geometry constants
export const W = 120;       // standard block width
export const H = 40;        // standard block height (reduced; non-wide blocks currently unused)
export const W_WIDE = 240;  // wide block width
export const H_WIDE = 66;   // wide block height
export const TAB_H = 8;     // height of rectangular tab / depth of rectangular notch
export const TAB_W = 40;    // width of rectangular tab / notch
export const KNOB_R = 12;   // radius of connection knobs

// Block type definitions
export const BLOCK_TYPES = {
  csv:         { label: 'CSV',         top: 'flat',   bottom: 'concave', knobs: ['out0', 'out1'],          wide: true },
  filter:      { label: 'Filter',      top: 'convex', bottom: 'concave', knobs: ['out0', 'out1'],          wide: true },
  select:      { label: 'Select',      top: 'convex', bottom: 'concave', knobs: ['out0', 'out1'],          wide: true },
  sort:        { label: 'Sort',        top: 'convex', bottom: 'concave', knobs: ['out0', 'out1'],          wide: true },
  groupby:     { label: 'Group By',    top: 'convex', bottom: 'concave', knobs: ['out0', 'out1'],          wide: true },
  summarize:   { label: 'Summarize',   top: 'convex', bottom: 'concave', knobs: ['out0', 'out1'],          wide: true },
  mutate:      { label: 'Mutate',      top: 'convex', bottom: 'concave', knobs: ['out0', 'out1'],          wide: true },
  slice:       { label: 'Slice',       top: 'convex', bottom: 'concave', knobs: ['out0', 'out1'],          wide: true },
  deduplicate: { label: 'Unique',      top: 'convex', bottom: 'concave', knobs: ['out0', 'out1'],          wide: true },
  join:        { label: 'Join',        top: 'flat',   bottom: 'concave', knobs: ['in0','in1','out0','out1'], wide: true },
  show:        { label: 'Show',        top: 'convex', bottom: 'concave', knobs: [],                        wide: true },
};

// Rendered width/height of a block type on the canvas.
export function blockW(type) { return BLOCK_TYPES[type]?.wide ? W_WIDE : W; }
export function blockH(type) { return BLOCK_TYPES[type]?.wide ? H_WIDE : H; }

// SVG path for a block drawn at origin (0,0); use a <g transform="translate(x,y)"> to position it.
//
// Convex top: a shallow rectangular tab protrudes TAB_H px above y=0, centred on the block width.
// Concave bottom: a matching rectangular notch is cut TAB_H px up from y=h, centred on the block width.
// When stacked, the tab of the lower block fits exactly into the notch of the upper block.
//
// Optional w/h override lets callers render at a different size (kept for future use).
export function blockPath(type, w = blockW(type), h = blockH(type)) {
  const { top, bottom } = BLOCK_TYPES[type];
  const tl = (w - TAB_W) / 2;  // tab left x
  const tr = (w + TAB_W) / 2;  // tab right x

  const topEdge = top === 'convex'
    ? `M 0,0 L ${tl},0 L ${tl},${-TAB_H} L ${tr},${-TAB_H} L ${tr},0 L ${w},0`
    : `M 0,0 L ${w},0`;

  const bottomEdge = bottom === 'concave'
    ? `L ${w},${h} L ${tr},${h} L ${tr},${h - TAB_H} L ${tl},${h - TAB_H} L ${tl},${h} L 0,${h}`
    : `L ${w},${h} L 0,${h}`;

  return `${topEdge} ${bottomEdge} Z`;
}

// Knob positions relative to block origin (0,0).
// in knobs: triangular indents on the top edge (base at y=0, tip at y=KNOB_R).
// out0: triangular outdent on the right edge (tip at x = w + KNOB_R).
// out1: triangular outdent on the left edge  (tip at x = -KNOB_R).
export function knobPositions(type, w = blockW(type), h = blockH(type)) {
  const { knobs } = BLOCK_TYPES[type];
  return knobs.map((id, i) => {
    if (id.startsWith('in')) {
      return { id, x: Math.round(w * (i + 1) / (knobs.length + 1)), y: KNOB_R, shape: 'indent' };
    } else if (id === 'out1') {
      return { id, x: -KNOB_R, y: h / 2, shape: 'outdent-left' };
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
