// Block geometry constants
export const W = 120;    // block width in pixels
export const H = 60;     // block height in pixels
export const BUMP = 14;  // height of convex tab / depth of concave notch
export const KNOB_R = 6; // radius of connection knobs

// Block type definitions
export const BLOCK_TYPES = {
  input:    { label: 'Input',    top: 'flat',   bottom: 'concave', knobs: [] },
  output:   { label: 'Output',   top: 'convex', bottom: 'flat',    knobs: [] },
  pipeline: { label: 'Pipeline', top: 'convex', bottom: 'concave', knobs: [] },
  'fan-in': { label: 'Fan-in',   top: 'flat',   bottom: 'concave', knobs: ['in0', 'in1'] },
  'fan-out':{ label: 'Fan-out',  top: 'convex', bottom: 'concave', knobs: ['out0'] },
};

// SVG path for a block drawn at origin (0,0); use a <g transform="translate(x,y)"> to position it.
// Convex top: middle of top edge bows upward by BUMP pixels.
// Concave bottom: middle of bottom edge bows upward by BUMP pixels (notch).
export function blockPath(type) {
  const { top, bottom } = BLOCK_TYPES[type];
  const topEdge = top === 'convex'
    ? `M 0,0 Q ${W / 2},${-BUMP} ${W},0`
    : `M 0,0 L ${W},0`;
  const bottomEdge = bottom === 'concave'
    ? `L ${W},${H} Q ${W / 2},${H - BUMP} 0,${H}`
    : `L ${W},${H} L 0,${H}`;
  return `${topEdge} ${bottomEdge} Z`;
}

// Knob positions relative to block origin (0,0).
// Fan-in: two input knobs on the left side.
// Fan-out: one output knob on the right side.
export function knobPositions(type) {
  const { knobs } = BLOCK_TYPES[type];
  return knobs.map((id, i) => {
    if (id.startsWith('in')) {
      return { id, x: 0, y: Math.round(H * (i + 1) / (knobs.length + 1)) };
    } else {
      return { id, x: W, y: H / 2 };
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
