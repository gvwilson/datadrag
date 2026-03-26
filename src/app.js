import {
  KNOB_R,
  blockW, blockH,
  BLOCK_TYPES, blockPath, knobPositions,
  canInitiateConnect, canReceiveConnect,
} from './blocks.js';
import * as aq from './aq-browser.js';
import { BUILTIN_DATASETS } from './data.js';
import './styles.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const SNAP_DIST = 80; // large affordance makes stacking easy

// Assigned by init()
let palette, svg, ctxMenu, showModal, showTitle, showBody;

// --- Application state ---
let state = { blocks: [], arrows: [], nextId: 1 };
let history = [];

// Arquero tables loaded from CSV files; keyed by block id.
// Lives outside state so it isn't serialised into history JSON.
const csvTables = new Map();

// Tables deposited at join block inputs; keyed by "${joinId}:${knobId}".
const joinInputs = new Map();

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
  const isOut = knob.id.startsWith('out');
  const style = { fill: '#2980b9', 'data-knob-id': knob.id };
  if (isOut) style.cursor = 'crosshair';
  if (knob.shape === 'indent') {
    // Triangle pointing down into the block; base on top edge (y=0), tip at (x, KNOB_R).
    return svgEl('polygon', { ...style,
      points: `${knob.x - KNOB_R},0 ${knob.x + KNOB_R},0 ${knob.x},${knob.y}` });
  }
  if (knob.shape === 'outdent') {
    // Triangle pointing right; base on right edge (x=knob.x-KNOB_R), tip at (knob.x, y).
    const bx = knob.x - KNOB_R;
    return svgEl('polygon', { ...style,
      points: `${bx},${knob.y - KNOB_R} ${bx},${knob.y + KNOB_R} ${knob.x},${knob.y}` });
  }
  if (knob.shape === 'outdent-left') {
    // Triangle pointing left; base on left edge (x=knob.x+KNOB_R), tip at (knob.x, y).
    const bx = knob.x + KNOB_R;
    return svgEl('polygon', { ...style,
      points: `${bx},${knob.y - KNOB_R} ${bx},${knob.y + KNOB_R} ${knob.x},${knob.y}` });
  }
  return svgEl('circle', { ...style, cx: knob.x, cy: knob.y, r: KNOB_R });
}

// Placeholder text for text-expression wide blocks.
const EXPR_PLACEHOLDER = {
  select:    'col1, col2, ...',
  sort:      'col1, col2 desc, ...',
  groupby:   'col1, col2, ...',
  summarize: 'n = count(), avg = mean(age), ...',
  mutate:    'newcol = expression',
  join:      'left.col_a = right.col_b',
};

// Build a foreignObject containing HTML controls for a wide block.
function buildBlockControls(block) {
  const bw = blockW(block.type), bh = blockH(block.type);
  const fo = svgEl('foreignObject', { x: 4, y: 22, width: bw - 8, height: bh - 26 });
  const div = document.createElement('div');
  div.className = 'block-controls';

  if (block.type === 'csvupload') {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.csv';
    fileInput.className = 'block-file-input';
    fileInput.addEventListener('mousedown', e => { e.stopPropagation(); lastDown = null; });
    fileInput.addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      block.csvName = file.name;
      const text = await file.text();
      csvTables.set(block.id, aq.fromCSV(text));
      fileInput.dataset.loaded = file.name; // signals tests that async load is complete
    });
    const fileRow = document.createElement('div');
    fileRow.className = 'block-row';
    fileRow.appendChild(fileInput);
    div.appendChild(fileRow);

  } else if (block.type === 'dataset') {
    const select = document.createElement('select');
    select.className = 'block-builtin-select';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— choose dataset —';
    defaultOpt.disabled = true;
    defaultOpt.selected = true;
    select.appendChild(defaultOpt);
    for (const ds of BUILTIN_DATASETS) {
      const opt = document.createElement('option');
      opt.value = ds.value;
      opt.textContent = ds.label;
      select.appendChild(opt);
    }
    select.addEventListener('mousedown', e => { e.stopPropagation(); lastDown = null; });
    select.addEventListener('change', e => {
      const ds = BUILTIN_DATASETS.find(d => d.value === e.target.value);
      if (!ds) return;
      block.csvName = ds.value;
      csvTables.set(block.id, aq.fromCSV(ds.csv));
      select.dataset.loaded = ds.value; // signals tests that async load is complete
    });
    div.appendChild(select);

  } else if (block.type === 'filter') {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'block-expr-input';
    input.placeholder = "e.g. age > 65 and color == 'blue'";
    input.value = block.expr || '';
    input.addEventListener('mousedown', e => { e.stopPropagation(); lastDown = null; });
    input.addEventListener('input', e => { block.expr = e.target.value; });
    div.appendChild(input);

  } else if (block.type === 'show') {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'block-expr-input';
    input.value = block.showName ?? '';
    input.addEventListener('mousedown', e => { e.stopPropagation(); lastDown = null; });
    input.addEventListener('input', e => { block.showName = e.target.value; });
    div.appendChild(input);

  } else if (EXPR_PLACEHOLDER[block.type] !== undefined) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'block-expr-input';
    input.placeholder = EXPR_PLACEHOLDER[block.type];
    input.value = block.expr || '';
    input.addEventListener('mousedown', e => { e.stopPropagation(); lastDown = null; });
    input.addEventListener('input', e => { block.expr = e.target.value; });
    div.appendChild(input);

  } else if (block.type === 'slice') {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'block-expr-input';
    input.placeholder = 'rows to keep';
    input.min = 1;
    input.value = block.sliceN || '';
    input.addEventListener('mousedown', e => { e.stopPropagation(); lastDown = null; });
    input.addEventListener('input', e => { block.sliceN = e.target.value; });
    div.appendChild(input);

  } else if (block.type === 'deduplicate') {
    const span = document.createElement('span');
    span.style.cssText = 'font-size:11px;color:#666;';
    span.textContent = 'Remove duplicate rows';
    div.appendChild(span);
  }

  fo.appendChild(div);
  return fo;
}

// Returns the { bottomId, targetId } pair that would snap if the drag ended now, or null.
// bottomId = the block whose outputtable bottom receives the connection.
// targetId = the block whose inputtable top fits into that outputtable bottom.
function findSnapCandidate() {
  if (!drag || !moved) return null;
  const ids = drag.ids;

  // Case 1: bottom of dragged chain snaps above a stationary block.
  const bottom = blockById(ids[ids.length - 1]);
  if (BLOCK_TYPES[bottom.type].bottom === 'outputtable') {
    const bw = blockW(bottom.type), bh = blockH(bottom.type);
    for (const cand of state.blocks) {
      if (ids.includes(cand.id)) continue;
      if (BLOCK_TYPES[cand.type].top !== 'inputtable') continue;
      if (blockAbove(cand.id)) continue;
      const cw = blockW(cand.type);
      const dx = (bottom.x + bw / 2) - (cand.x + cw / 2);
      const dy = (bottom.y + bh) - cand.y;
      if (Math.abs(dx) < SNAP_DIST && Math.abs(dy) < SNAP_DIST) {
        return { bottomId: bottom.id, targetId: cand.id };
      }
    }
  }

  // Case 2: top of dragged chain snaps below a stationary block.
  const top = blockById(ids[0]);
  if (BLOCK_TYPES[top.type].top === 'inputtable') {
    const tw = blockW(top.type);
    for (const cand of state.blocks) {
      if (ids.includes(cand.id)) continue;
      if (BLOCK_TYPES[cand.type].bottom !== 'outputtable') continue;
      if (cand.stackBelow) continue;
      const cw = blockW(cand.type), ch = blockH(cand.type);
      const dx = (top.x + tw / 2) - (cand.x + cw / 2);
      const dy = top.y - (cand.y + ch);
      if (Math.abs(dx) < SNAP_DIST && Math.abs(dy) < SNAP_DIST) {
        return { bottomId: cand.id, targetId: top.id };
      }
    }
  }

  return null;
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
  const snapCand = findSnapCandidate();
  const snapIds = snapCand ? new Set([snapCand.bottomId, snapCand.targetId]) : new Set();
  for (const block of state.blocks) {
    const bw = blockW(block.type), bh = blockH(block.type);
    const g = svgEl('g', {
      transform: `translate(${block.x},${block.y})`,
      'data-block-id': block.id,
      cursor: 'pointer',
    });
    const hl = snapIds.has(block.id);
    g.appendChild(svgEl('path', {
      d: blockPath(block.type),
      fill: hl ? '#d5f5e3' : '#e8f4fd',
      stroke: hl ? '#27ae60' : '#2980b9',
      'stroke-width': hl ? 2.5 : 1.5,
    }));

    if (BLOCK_TYPES[block.type].wide) {
      // Wide blocks: small type label at top-left, HTML controls below
      const label = svgEl('text', {
        x: 8, y: 15,
        'font-size': 10, fill: '#888', 'font-weight': 'bold',
        'text-transform': 'uppercase', 'pointer-events': 'none',
      });
      label.textContent = BLOCK_TYPES[block.type].label.toUpperCase();
      g.appendChild(label);
      g.appendChild(buildBlockControls(block));
      // Render any knobs (e.g. out0 on csv, in0/in1 on join)
      for (const knob of knobPositions(block.type)) {
        g.appendChild(knobEl(knob));
      }
    } else {
      // Standard blocks: centred label
      const text = svgEl('text', {
        x: bw / 2, y: bh / 2 + 5,
        'text-anchor': 'middle', 'font-size': 12, fill: '#333', 'pointer-events': 'none',
      });
      text.textContent = BLOCK_TYPES[block.type].label;
      g.appendChild(text);
      for (const knob of knobPositions(block.type)) {
        g.appendChild(knobEl(knob));
      }
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
  const outKnobs = BLOCK_TYPES[block.type].knobs.filter(k => k.startsWith('out'));
  if (outKnobs.length === 1) {
    items.push({ text: 'Connect', fn: () => startConnect(blockId, outKnobs[0]) });
  } else if (outKnobs.length > 1) {
    items.push({ text: 'Connect →', fn: () => startConnect(blockId, 'out0') });
    items.push({ text: '← Connect', fn: () => startConnect(blockId, 'out1') });
  }
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
  state.arrows = state.arrows.filter(a => {
    if (a.fromId === id || a.toId === id) {
      joinInputs.delete(`${a.toId}:${a.toKnob}`);
    }
    return a.fromId !== id && a.toId !== id;
  });
  joinInputs.delete(`${id}:in0`);
  joinInputs.delete(`${id}:in1`);
  const above = blockAbove(id);
  if (above) above.stackBelow = null;
  state.blocks = state.blocks.filter(b => b.id !== id);
  render();
}

function deleteArrow(id) {
  saveHistory();
  const arrow = state.arrows.find(a => a.id === id);
  if (arrow) joinInputs.delete(`${arrow.toId}:${arrow.toKnob}`);
  state.arrows = state.arrows.filter(a => a.id !== id);
  render();
}

function startConnect(blockId, knobId) {
  const block = blockById(blockId);
  const knob = knobPositions(block.type).find(k => k.id === knobId);
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

  // Case 1: bottom of dragged chain snaps above a stationary block.
  const bottom = blockById(ids[ids.length - 1]);
  if (BLOCK_TYPES[bottom.type].bottom === 'outputtable') {
    const bw = blockW(bottom.type), bh = blockH(bottom.type);
    for (const cand of state.blocks) {
      if (ids.includes(cand.id)) continue;
      if (BLOCK_TYPES[cand.type].top !== 'inputtable') continue;
      if (blockAbove(cand.id)) continue;
      const cw = blockW(cand.type);
      const dx = (bottom.x + bw / 2) - (cand.x + cw / 2);
      const dy = (bottom.y + bh) - cand.y;
      if (Math.abs(dx) < SNAP_DIST && Math.abs(dy) < SNAP_DIST) {
        const shiftX = cand.x - bottom.x;
        const shiftY = (cand.y - bh) - bottom.y;
        for (const id of ids) { const b = blockById(id); b.x += shiftX; b.y += shiftY; }
        bottom.stackBelow = cand.id;
        return;
      }
    }
  }

  // Case 2: top of dragged chain snaps below a stationary block.
  const top = blockById(ids[0]);
  if (BLOCK_TYPES[top.type].top === 'inputtable') {
    const tw = blockW(top.type);
    for (const cand of state.blocks) {
      if (ids.includes(cand.id)) continue;
      if (BLOCK_TYPES[cand.type].bottom !== 'outputtable') continue;
      if (cand.stackBelow) continue;
      const cw = blockW(cand.type), ch = blockH(cand.type);
      const dx = (top.x + tw / 2) - (cand.x + cw / 2);
      const dy = top.y - (cand.y + ch);
      if (Math.abs(dx) < SNAP_DIST && Math.abs(dy) < SNAP_DIST) {
        const shiftX = cand.x - top.x;
        const shiftY = (cand.y + ch) - top.y;
        for (const id of ids) { const b = blockById(id); b.x += shiftX; b.y += shiftY; }
        cand.stackBelow = top.id;
        return;
      }
    }
  }
}

function moveStack(mx, my) {
  const pivot = blockById(drag.pivotId);
  const dx = (mx - drag.offsetX) - pivot.x;
  const dy = (my - drag.offsetY) - pivot.y;
  for (const id of drag.ids) { const b = blockById(id); b.x += dx; b.y += dy; }
}

// --- Execution engine ---

// Parse "col1, col2 desc" into an array of arquero orderby arguments.
function buildSortArgs(expr) {
  return expr.split(',').map(s => {
    const parts = s.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return null;
    const col = parts[0];
    return parts[1]?.toLowerCase() === 'desc' ? aq.desc(col) : col;
  }).filter(Boolean);
}

// Supported aggregate functions for summarize blocks.
const ROLLUP_OPS = new Set(['count', 'sum', 'mean', 'min', 'max', 'median', 'stdev', 'variance', 'valid', 'invalid', 'any', 'every']);

// Parse "n = count(), avg = mean(age)" into an arquero rollup definition object.
function buildRollupDef(expr) {
  const result = {};
  for (const part of expr.split(',')) {
    const m = part.trim().match(/^(\w+)\s*=\s*(\w+)\s*\(([^)]*)\)$/);
    if (!m) continue;
    const [, newCol, fn, arg] = m;
    if (!ROLLUP_OPS.has(fn)) continue;
    const colArg = arg.trim();
    result[newCol] = colArg ? aq.op[fn](colArg) : aq.op[fn]();
  }
  return result;
}

// Parse "newcol = expression" into { col, fn } for use with table.derive().
// The rhs expression uses the same transformations as buildFilterFn.
function buildMutateDef(expr) {
  const eqIdx = expr.indexOf('=');
  if (eqIdx < 0) return null;
  const col = expr.slice(0, eqIdx).trim();
  const rhs = expr.slice(eqIdx + 1).trim();
  if (!col || !rhs) return null;
  const KEYWORDS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
  const js = rhs
    .replace(/\band\b/gi, '&&')
    .replace(/\bor\b/gi, '||')
    .replace(/\bnot\b/gi, '!')
    .replace(/(?<![<>!=])=(?!=)/g, '===');
  const wrapped = js.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (m, name) =>
    KEYWORDS.has(name) ? name : `d['${name}']`
  );
  return { col, fn: new Function('d', `return (${wrapped})`) }; // eslint-disable-line no-new-func
}

// Transform a user-friendly filter expression into a JS predicate function.
// Handles: `and`→&&, `or`→||, `not`→!, bare `=`→===,
// and wraps bare identifiers as d['name'] so column names work without prefix.
function buildFilterFn(expr) {
  const KEYWORDS = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
  const js = expr
    .replace(/\band\b/gi, '&&')
    .replace(/\bor\b/gi, '||')
    .replace(/\bnot\b/gi, '!')
    .replace(/(?<![<>!=])=(?!=)/g, '===');
  // Wrap bare identifiers that aren't JS keywords with d['...'] so column
  // names are resolved against the row object without any `with` statement.
  // String literals (single or double quoted) are matched first and preserved
  // unchanged so that values like 'Chinstrap' are not incorrectly wrapped.
  const wrapped = js.replace(/('[^']*'|"[^"]*")|(\b([a-zA-Z_][a-zA-Z0-9_]*)\b)/g,
    (m, str, _ident, name) => str ?? (KEYWORDS.has(name) ? name : `d['${name}']`)
  );
  return new Function('d', `return (${wrapped})`); // eslint-disable-line no-new-func
}

// Process a chain of stacked blocks starting at `startBlock`, threading
// `initialTable` through each one.  Returns the final table, or null on error.
async function processChain(startBlock, initialTable) {
  let table = initialTable;
  let grouped = null;
  let cur = startBlock;
  while (cur) {
    try {
      if (cur.type === 'filter' && cur.expr) {
        table = table.filter(aq.escape(buildFilterFn(cur.expr)));
        grouped = null;
      } else if (cur.type === 'select' && cur.expr) {
        const cols = cur.expr.split(',').map(s => s.trim()).filter(Boolean);
        if (cols.length) { table = table.select(...cols); grouped = null; }
      } else if (cur.type === 'sort' && cur.expr) {
        const args = buildSortArgs(cur.expr);
        if (args.length) { table = table.orderby(...args); grouped = null; }
      } else if (cur.type === 'groupby' && cur.expr) {
        const cols = cur.expr.split(',').map(s => s.trim()).filter(Boolean);
        if (cols.length) grouped = table.groupby(...cols);
      } else if (cur.type === 'summarize' && cur.expr) {
        const rollup = buildRollupDef(cur.expr);
        if (Object.keys(rollup).length) {
          table = (grouped || table).rollup(rollup);
          grouped = null;
        }
      } else if (cur.type === 'mutate' && cur.expr) {
        const def = buildMutateDef(cur.expr);
        if (def) {
          const derive = {};
          derive[def.col] = aq.escape(def.fn);
          table = table.derive(derive);
          grouped = null;
        }
      } else if (cur.type === 'slice' && cur.sliceN) {
        const n = parseInt(cur.sliceN, 10);
        if (!isNaN(n) && n > 0) { table = table.slice(0, n); grouped = null; }
      } else if (cur.type === 'deduplicate') {
        table = table.dedupe();
        grouped = null;
      } else if (cur.type === 'show') {
        showDataframe(cur.showName, table);
      }
    } catch (err) {
      alert(`Error in ${BLOCK_TYPES[cur.type].label} block: ${err.message}`);
      return null;
    }
    // After processing this block, deposit the current table at any join inputs
    // connected via this block's out0 knob, then try to execute those joins.
    for (const arrow of state.arrows.filter(a => a.fromId === cur.id && a.fromKnob.startsWith('out'))) {
      joinInputs.set(`${arrow.toId}:${arrow.toKnob}`, table);
      await tryExecuteJoin(arrow.toId);
    }
    cur = cur.stackBelow ? blockById(cur.stackBelow) : null;
  }
  return table;
}

async function runStack(csvBlockId) {
  const initialTable = csvTables.get(csvBlockId);
  if (!initialTable) {
    alert('No CSV file loaded — please select a file first.');
    return;
  }
  await processChain(blockById(csvBlockId), initialTable);
}

// Parse "left.col_a = right.col_b" into { leftCol, rightCol }, or null.
function parseJoinCondition(expr) {
  const m = expr.trim().match(/^left\.(\w+)\s*=\s*right\.(\w+)$/i);
  return m ? { leftCol: m[1], rightCol: m[2] } : null;
}

// When a CSV block runs and deposits its table, attempt to execute the join.
// Fires only when both in0 and in1 inputs are present.
async function tryExecuteJoin(joinId) {
  const joinBlock = blockById(joinId);
  if (!joinBlock || joinBlock.type !== 'join') return;
  const leftTable  = joinInputs.get(`${joinId}:in0`);
  const rightTable = joinInputs.get(`${joinId}:in1`);
  if (!leftTable || !rightTable) return;
  const cond = parseJoinCondition(joinBlock.expr || '');
  if (!cond) {
    alert('Join block: enter a condition like  left.col_a = right.col_b');
    return;
  }
  let joined;
  try {
    joined = leftTable.join(rightTable, [[cond.leftCol], [cond.rightCol]]);
  } catch (err) {
    alert(`Join error: ${err.message}`);
    return;
  }
  // Start at the join block itself so processChain handles its out0 and stackBelow.
  await processChain(joinBlock, joined);
}

// Display an arquero table in the show modal.
function showDataframe(title, table) {
  showTitle.textContent = title;
  const cols = table.columnNames();
  const rows = table.objects({ limit: 200 }); // cap at 200 rows for display

  let html = '<table class="df-table"><thead><tr>';
  for (const col of cols) html += `<th>${col}</th>`;
  html += '</tr></thead><tbody>';
  for (const row of rows) {
    html += '<tr>';
    for (const col of cols) {
      const v = row[col];
      html += `<td>${v === null || v === undefined ? '' : v}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  if (table.numRows() > 200) {
    html += `<p class="df-truncated">Showing 200 of ${table.numRows()} rows</p>`;
  }
  showBody.innerHTML = html;
  showModal.classList.remove('hidden');
}

// --- Init ---
function init(container) {
  container.innerHTML = `
    <div id="palette"><h2>Blocks</h2></div>
    <div id="canvas-area">
      <button id="run-all-btn">Run</button>
      <svg id="canvas" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#555"/>
          </marker>
        </defs>
      </svg>
    </div>
    <div id="ctx-menu" class="hidden"></div>
    <div id="show-modal" class="hidden">
      <div id="show-overlay"></div>
      <div id="show-content">
        <div id="show-header">
          <h3 id="show-title"></h3>
          <button id="show-close" aria-label="Close">✕</button>
        </div>
        <div id="show-body"></div>
      </div>
    </div>
  `;

  palette   = container.querySelector('#palette');
  svg       = container.querySelector('#canvas');
  ctxMenu   = container.querySelector('#ctx-menu');
  showModal = container.querySelector('#show-modal');
  showTitle = container.querySelector('#show-title');
  showBody  = container.querySelector('#show-body');

  // Build palette
  for (const [type, def] of Object.entries(BLOCK_TYPES)) {
    const item = document.createElement('div');
    item.className = 'palette-item';
    item.dataset.type = type;
    item.textContent = def.label;
    palette.appendChild(item);
  }

  // Palette drag-to-create
  palette.addEventListener('mousedown', e => {
    const item = e.target.closest('.palette-item');
    if (!item) return;
    e.preventDefault();
    hideMenu();
    const type = item.dataset.type;
    const rect = svg.getBoundingClientRect();
    const bw = blockW(type), bh = blockH(type);
    saveHistory();
    const block = {
      id: state.nextId++, type,
      x: e.clientX - rect.left - bw / 2,
      y: e.clientY - rect.top - bh / 2,
      stackBelow: null,
    };
    if (type === 'show') {
      const n = state.blocks.filter(b => b.type === 'show').length + 1;
      block.showName = `Table ${n}`;
    }
    state.blocks.push(block);
    drag = { ids: [block.id], pivotId: block.id, offsetX: bw / 2, offsetY: bh / 2 };
    lastDown = { blockId: block.id, arrowId: null };
    moved = true;       // treat palette drag as already in motion
    historySaved = true;
    render();
  });

  // SVG interactions
  svg.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Clicks inside a foreignObject: inputs handle themselves; background clicks start a drag.
    if (e.target.closest('foreignObject')) {
      if (e.target.matches('input, button, select, textarea')) {
        lastDown = null; // prevent stale state from triggering a menu on release
      } else {
        const blockEl = e.target.closest('[data-block-id]');
        if (blockEl && !connect) {
          e.preventDefault();
          hideMenu();
          const blockId = +blockEl.dataset.blockId;
          const block = blockById(blockId);
          lastDown = { blockId, arrowId: null };
          moved = false;
          historySaved = false;
          drag = { ids: stackChain(blockId), pivotId: blockId, offsetX: mx - block.x, offsetY: my - block.y };
        }
      }
      return;
    }

    e.preventDefault();
    hideMenu();
    const blockEl = e.target.closest('[data-block-id]');
    const arrowEl = !blockEl ? e.target.closest('[data-arrow-id]') : null;
    const blockId = blockEl ? +blockEl.dataset.blockId : null;
    const arrowId = arrowEl ? +arrowEl.dataset.arrowId : null;
    lastDown = { blockId, arrowId };
    moved = false;
    historySaved = false;

    // Clicking an output knob triangle starts a connection immediately.
    const knobId = e.target.getAttribute('data-knob-id');
    if (knobId?.startsWith('out') && blockEl) {
      lastDown = null;
      startConnect(blockId, knobId);
      return;
    }

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

  svg.addEventListener('contextmenu', e => e.preventDefault());

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
      lastDown = null;
      render();
      return;
    }

    if (!moved && lastDown !== null) {
      const elAtPoint = document.elementFromPoint(e.clientX, e.clientY);
      if (!ctxMenu.contains(elAtPoint)) {
        if (lastDown.arrowId != null) {
          showArrowMenu(lastDown.arrowId, e.clientX, e.clientY);
        } else if (lastDown.blockId != null) {
          showBlockMenu(lastDown.blockId, e.clientX, e.clientY);
        } else {
          showCanvasMenu(e.clientX, e.clientY);
        }
      }
    }
    lastDown = null;
  });

  document.addEventListener('click', e => {
    if (justShownMenu) return; // don't hide menu that was just shown by the triggering click
    if (!ctxMenu.contains(e.target)) hideMenu();
  });

  container.querySelector('#show-close').addEventListener('click', () => {
    showModal.classList.add('hidden');
  });
  container.querySelector('#show-overlay').addEventListener('click', () => {
    showModal.classList.add('hidden');
  });
  container.querySelector('#run-all-btn').addEventListener('click', () => {
    for (const block of state.blocks) {
      if (block.type === 'csvupload' || block.type === 'dataset') runStack(block.id);
    }
  });

  render();
}

const _container = document.getElementById('datadrag');
if (_container) init(_container);
