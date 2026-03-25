// Browser stub for node:stream — only needed by arquero's file-loading paths
// which are never reached when CSV text is provided directly.
export class Readable {
  static toWeb() { throw new Error('node:stream is not available in the browser'); }
}
