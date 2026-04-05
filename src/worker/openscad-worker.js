import { createOpenSCAD } from 'openscad-wasm';

// Warm up: create first instance to cache the WASM module
let warmPromise = createOpenSCAD({ noInitialRun: true });

self.onmessage = async function (e) {
  const { type, scadSource, id } = e.data;

  if (type === 'render') {
    try {
      await warmPromise;

      // Fresh instance per render (callMain is one-shot, but WASM module is cached so this is fast)
      const scad = await createOpenSCAD({ noInitialRun: true });
      const inst = scad.getInstance();

      inst.FS.writeFile('/input.scad', scadSource);
      inst.callMain(['/input.scad', '--enable=manifold', '-o', '/output.stl']);
      const stlData = inst.FS.readFile('/output.stl');

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

warmPromise.then(() => {
  self.postMessage({ type: 'ready' });
}).catch((err) => {
  self.postMessage({ type: 'init-error', error: err.message || String(err) });
});
