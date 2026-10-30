import * as prover from './prover.js';

// Mate's searches, off the main thread: { id, fn, args } in, { id, result } out.
self.onmessage = ({ data: { id, fn, args } }) => self.postMessage({ id, result: prover[fn](...args) });
