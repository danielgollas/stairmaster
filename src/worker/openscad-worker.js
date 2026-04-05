import { createOpenSCAD } from 'openscad-wasm';

// Warm up: create first instance to cache the WASM module
let warmPromise = createOpenSCAD({ noInitialRun: true });

self.onmessage = async function (e) {
  const { type, scadSource, id } = e.data;

  if (type === 'render') {
    try {
      // Ensure WASM module is cached from warmup
      await warmPromise;

      // Create fresh instance (fast after first — WASM module is cached)
      const scad = await createOpenSCAD({ noInitialRun: true });
      const result = await scad.renderToStl(scadSource);

      // renderToStl returns a string (ASCII STL), convert to ArrayBuffer
      const encoder = new TextEncoder();
      const stlData = encoder.encode(result);

      self.postMessage({
        type: 'result',
        id,
        stl: stlData.buffer,
      }, [stlData.buffer]);

    } catch (err) {
      self.postMessage({
        type: 'error',
        id,
        error: err.message || String(err),
      });
    }
  }
};

// Signal ready after warmup
warmPromise.then(() => {
  self.postMessage({ type: 'ready' });
}).catch((err) => {
  self.postMessage({ type: 'init-error', error: err.message || String(err) });
});
