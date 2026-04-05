import { createOpenSCAD } from 'openscad-wasm';

let openscad = null;

async function init() {
  if (openscad) return openscad;
  openscad = await createOpenSCAD({ noInitialRun: true });
  return openscad;
}

self.onmessage = async function (e) {
  const { type, scadSource, id } = e.data;

  if (type === 'render') {
    try {
      // Create a fresh instance for each render since callMain can only be called once
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

// Signal ready after first init succeeds (proves WASM loads)
init().then(() => {
  self.postMessage({ type: 'ready' });
}).catch((err) => {
  self.postMessage({ type: 'init-error', error: err.message || String(err) });
});
