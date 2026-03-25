// Browser stub for node:fs/promises — arquero's file-loading paths are never
// called when CSV text is provided directly (as we do via FileReader).
export function open() { throw new Error('node:fs/promises is not available in the browser'); }
