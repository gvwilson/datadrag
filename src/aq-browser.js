// Browser-safe arquero entry point.
// The import map in index.html resolves the bare specifiers (acorn,
// @uwdata/flechette, node:fs/promises, node:stream) that arquero's
// source imports.
export { fromCSV, table, from, op, escape, desc } from '../node_modules/arquero/src/index.js';
