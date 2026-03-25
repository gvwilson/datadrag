import {
  W, H, BUMP, KNOB_R,
  BLOCK_TYPES, blockPath, knobPositions,
  canInitiateConnect, canReceiveConnect,
} from './blocks.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SNAP_DIST = 60; // large affordance makes stacking easy

const palette = document.getElementById('palette');
const svg = document.getElementById('canvas');
const ctxMenu = document.getElementById('ctx-menu');

// --- Application state ---
let state = { blocks: [], arrows: [], nextId: 1 };
let history = [];

// --- Interaction state ---
let drag = null;         // { ids: number[], pivotId, offsetX, offsetY }
let connect = null;      // { fromId, fromKnob, mx, my }
let lastDown = null;     // { blockId: number|null, arrowId: number|null }
let moved = false;
let historySaved = false;
let justShownMenu = false; // prevents the click event that triggers mouseup from hiding a freshly shown menu

// --- Helpers ---
const blockById = id => state.blocks.find(b => b.id === id);

function knobAbsPos(block, knobId) {
  const kp = knobPositions(block.type).find(k => k.id === knobId);
  return { x: block.x + kp.x, y: block.y + kp.y };
}

function stackChain(blockId) {
  const ids = [];
  let cur = blockById(blockId);
  while (cur) {
    ids.push(cur.id);
    cur = cur.stackBelow ? blockById(cur.stackBelow) : null;
  }
  return ids;
}

function blockAbove(blockId) {
  return state.blocks.find(b => b.stackBelow === blockId) ?? null;
}

function saveHistory() { history.push(JSON.stringify(state)); }

function undo() {
  if (!history.length) return;
  state = JSON.parse(history.pop());
  render();
}

// --- SVG element factory ---
function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// Render a knob as a triangle (indent or outdent) or circle.
function knobEl(knob) {
  const style = { fill: '#2980b9', stroke: 'white', 'stroke-width': 1.5 };
  if (knob.shape === 'indent') {
    // Triangle pointing down into the block; base on top edge (y=0), tip at (x, KNOB_R).
    return svgEl('polygon', { ...style,
      points: `${knob.x - KNOB_R},0 ${knob.x + KNOB_R},0 ${knob.x},${knob.y}` });
  }
  if (knob.shape === 'outdent') {
    // Triangle pointing right out of the block; base on right edge (x=W), tip at (W+KNOB_R, y).
    return svgEl('polygon', { ...style,
      points: `${W},${knob.y - KNOB_R} ${W},${knob.y + KNOB_R} ${knob.x},${knob.y}` });
  }
  return svgEl('circle', { ...style, cx: knob.x, cy: knob.y, r: KNOB_R });
}

// --- Render ---
function render() {
  [...svg.children].forEach(c => { if (c.tagName !== 'defs') c.remove(); });

  // Arrows: each wrapped in a <g data-arrow-id> with a wide transparent hit area
  for (const arrow of state.arrows) {
    const from = blockById(arrow.fromId);
    const to = blockById(arrow.toId);
    if (!from || !to) continue;
    const fp = knobAbsPos(from, arrow.fromKnob);
    const tp = knobAbsPos(to, arrow.toKnob);
    const g = svgEl('g', { 'data-arrow-id': arrow.id, cursor: 'pointer' });
    g.appendChild(svgEl('line', {          // wide transparent hit area
      x1: fp.x, y1: fp.y, x2: tp.x, y2: tp.y,
      stroke: 'transparent', 'stroke-width': 10, 'pointer-events': 'all',
    }));
    g.appendChild(svgEl('line', {          // visible arrow
      x1: fp.x, y1: fp.y, x2: tp.x, y2: tp.y,
      stroke: '#555', 'stroke-width': 2, 'marker-end': 'url(#arrow)',
      'pointer-events': 'none',
    }));
    svg.appendChild(g);
  }

  // Pending connection arrow (dashed)
  if (connect) {
    const from = blockById(connect.fromId);
    const fp = knobAbsPos(from, connect.fromKnob);
    svg.appendChild(svgEl('line', {
      x1: fp.x, y1: fp.y, x2: connect.mx, y2: connect.my,
      stroke: '#555', 'stroke-width': 2,
      'stroke-dasharray': '6,3', 'marker-end': 'url(#arrow)',
    }));
  }

  // Blocks (rendered on top of arrows)
  for (const block of state.blocks) {
    const g = svgEl('g', {
      transform: `translate(${block.x},${block.y})`,
      'data-block-id': block.id,
      cursor: 'pointer',
    });
    g.appendChild(svgEl('path', {
      d: blockPath(block.type), fill: '#e8f4fd', stroke: '#2980b9', 'stroke-width': 1.5,
    }));
    const text = svgEl('text', {
      x: W / 2, y: H / 2 + 5,
      'text-anchor': 'middle', 'font-size': 12, fill: '#333', 'pointer-events': 'none',
    });
    text.textContent = BLOCK_TYPES[block.type].label;
    g.appendChild(text);
    for (const knob of knobPositions(block.type)) {
      g.appendChild(knobEl(knob));
    }
    svg.appendChild(g);
  }
}

// --- Context menus ---
function showMenu(items, clientX, clientY) {
  ctxMenu.innerHTML = '';
  for (const item of items) {
    if (item.sep) {
      const d = document.createElement('div');
      d.className = 'menu-separator';
      ctxMenu.appendChild(d);
      continue;
    }
    const div = document.createElement('div');
    div.className = 'menu-item' + (item.cls ? ' ' + item.cls : '');
    div.textContent = item.text;
    if (item.fn) div.addEventListener('click', () => { hideMenu(); item.fn(); });
    ctxMenu.appendChild(div);
  }
  ctxMenu.style.left = clientX + 'px';
  ctxMenu.style.top = clientY + 'px';
  ctxMenu.classList.remove('hidden');
  // The mouseup that triggers this is followed by a click event on the same target.
  // Set a flag so that click event doesn't immediately hide the menu we just showed.
  justShownMenu = true;
  setTimeout(() => { justShownMenu = false; }, 0);
}

function hideMenu() { ctxMenu.classList.add('hidden'); }

function showBlockMenu(blockId, clientX, clientY) {
  const block = blockById(blockId);
  if (!block) return;
  const items = [
    { text: BLOCK_TYPES[block.type].label, cls: 'label' },
    { sep: true },
    { text: 'Delete', fn: () => deleteBlock(blockId) },
  ];
  if (canInitiateConnect(block.type)) items.push({ text: 'Connect', fn: () => startConnect(blockId) });
  showMenu(items, clientX, clientY);
}

function showArrowMenu(arrowId, clientX, clientY) {
  showMenu([
    { text: 'Connector', cls: 'label' },
    { sep: true },
    { text: 'Delete', fn: () => deleteArrow(arrowId) },
  ], clientX, clientY);
}

function showCanvasMenu(clientX, clientY) {
  showMenu([{ text: 'Undo', fn: undo }], clientX, clientY);
}

// --- Operations ---
function deleteBlock(id) {
  saveHistory();
  state.arrows = state.arrows.filter(a => a.fromId !== id && a.toId !== id);
  const above = blockAbove(id);
  if (above) above.stackBelow = null;
  state.blocks = state.blocks.filter(b => b.id !== id);
  render();
}

function deleteArrow(id) {
  saveHistory();
  state.arrows = state.arrows.filter(a => a.id !== id);
  render();
}

function startConnect(blockId) {
  const block = blockById(blockId);
  const knob = knobPositions(block.type).find(k => k.id.startsWith('out'));
  if (!knob) return;
  const pos = knobAbsPos(block, knob.id);
  connect = { fromId: blockId, fromKnob: knob.id, mx: pos.x, my: pos.y };
  render();
}

function completeConnect(toId) {
  const toBlock = blockById(toId);
  if (!toBlock || !canReceiveConnect(toBlock.type)) { connect = null; render(); return; }
  const usedKnobs = state.arrows.filter(a => a.toId === toId).map(a => a.toKnob);
  const freeKnob = knobPositions(toBlock.type).find(k => k.id.startsWith('in') && !usedKnobs.includes(k.id));
  if (!freeKnob) { connect = null; render(); return; }
  saveHistory();
  state.arrows.push({ id: state.nextId++, fromId: connect.fromId, fromKnob: connect.fromKnob, toId, toKnob: freeKnob.id });
  connect = null;
  render();
}

function trySnap() {
  const ids = drag.ids;
  const bottom = blockById(ids[ids.length - 1]);
  if (BLOCK_TYPES[bottom.type].bottom !== 'concave') return;
  for (const cand of state.blocks) {
    if (ids.includes(cand.id)) continue;
    if (BLOCK_TYPES[cand.type].top !== 'convex') continue;
    if (blockAbove(cand.id)) continue;
    const dx = (bottom.x + W / 2) - (cand.x + W / 2);
    const dy = (bottom.y + H) - cand.y;
    if (Math.abs(dx) < SNAP_DIST && Math.abs(dy) < SNAP_DIST) {
      const shiftX = cand.x - bottom.x;
      const shiftY = (cand.y - H) - bottom.y;
      for (const id of ids) { const b = blockById(id); b.x += shiftX; b.y += shiftY; }
      bottom.stackBelow = cand.id;
      return;
    }
  }
}

function moveStack(mx, my) {
  const pivot = blockById(drag.pivotId);
  const dx = (mx - drag.offsetX) - pivot.x;
  const dy = (my - drag.offsetY) - pivot.y;
  for (const id of drag.ids) { const b = blockById(id); b.x += dx; b.y += dy; }
}

// --- Palette (SVG shape previews) ---
// ViewBox covers full block geometry including knobs and convex-top bump
const PALETTE_VIEWBOX = `${-KNOB_R - 2} ${-BUMP - 2} ${W + (KNOB_R + 2) * 2} ${H + BUMP + KNOB_R + 4}`;

for (const [type, def] of Object.entries(BLOCK_TYPES)) {
  const div = document.createElement('div');
  div.className = 'palette-item';
  div.dataset.type = type;

  const preview = document.createElementNS(SVG_NS, 'svg');
  preview.setAttribute('viewBox', PALETTE_VIEWBOX);
  preview.setAttribute('class', 'palette-shape');
  preview.style.pointerEvents = 'none'; // drag events handled by the parent div

  preview.appendChild(svgEl('path', {
    d: blockPath(type), fill: '#e8f4fd', stroke: '#2980b9', 'stroke-width': 1.5,
  }));
  for (const knob of knobPositions(type)) {
    preview.appendChild(knobEl(knob));
  }
  div.appendChild(preview);

  const label = document.createElement('div');
  label.className = 'palette-label';
  label.textContent = def.label;
  div.appendChild(label);

  palette.appendChild(div);
}

palette.addEventListener('mousedown', e => {
  const item = e.target.closest('.palette-item');
  if (!item) return;
  e.preventDefault();
  hideMenu();
  const type = item.dataset.type;
  const rect = svg.getBoundingClientRect();
  saveHistory();
  const block = {
    id: state.nextId++, type,
    x: e.clientX - rect.left - W / 2,
    y: e.clientY - rect.top - H / 2,
    stackBelow: null,
  };
  state.blocks.push(block);
  drag = { ids: [block.id], pivotId: block.id, offsetX: W / 2, offsetY: H / 2 };
  lastDown = { blockId: block.id, arrowId: null };
  moved = true;       // treat palette drag as already in motion
  historySaved = true;
  render();
});

// --- SVG events ---
svg.addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  e.preventDefault();
  hideMenu();
  const rect = svg.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const blockEl = e.target.closest('[data-block-id]');
  const arrowEl = !blockEl ? e.target.closest('[data-arrow-id]') : null;
  const blockId = blockEl ? +blockEl.dataset.blockId : null;
  const arrowId = arrowEl ? +arrowEl.dataset.arrowId : null;
  lastDown = { blockId, arrowId };
  moved = false;
  historySaved = false;

  if (connect) return; // connection clicks handled in mouseup

  if (blockId !== null) {
    const block = blockById(blockId);
    drag = {
      ids: stackChain(blockId),
      pivotId: blockId,
      offsetX: mx - block.x,
      offsetY: my - block.y,
    };
  }
});

document.addEventListener('mousemove', e => {
  if (!drag && !connect) return;
  const rect = svg.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  if (drag) {
    if (!moved) {
      if (!historySaved) { saveHistory(); historySaved = true; }
      const above = blockAbove(drag.pivotId);
      if (above) above.stackBelow = null;
      moved = true;
    }
    moveStack(mx, my);
    render();
  }

  if (connect) {
    connect.mx = mx;
    connect.my = my;
    render();
  }
});

document.addEventListener('mouseup', e => {
  if (e.button !== 0) return;

  if (connect) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const blockEl = el?.closest('[data-block-id]');
    const toId = blockEl ? +blockEl.dataset.blockId : null;
    if (toId !== null && toId !== connect.fromId) completeConnect(toId);
    else { connect = null; render(); }
    return;
  }

  if (drag) {
    if (moved) trySnap();
    else if (lastDown?.blockId !== null) showBlockMenu(lastDown.blockId, e.clientX, e.clientY);
    drag = null;
    render();
    return;
  }

  if (!moved) {
    if (lastDown?.arrowId !== null && lastDown?.arrowId !== undefined) {
      showArrowMenu(lastDown.arrowId, e.clientX, e.clientY);
    } else if (lastDown?.blockId === null) {
      showCanvasMenu(e.clientX, e.clientY);
    }
  }
  lastDown = null;
});

document.addEventListener('click', e => {
  if (justShownMenu) return; // don't hide menu that was just shown by the triggering click
  if (!ctxMenu.contains(e.target)) hideMenu();
});

svg.addEventListener('contextmenu', e => e.preventDefault());

render();
