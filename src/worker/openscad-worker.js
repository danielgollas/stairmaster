import { createOpenSCAD } from 'openscad-wasm';

let instance = null;

async function init() {
  if (instance) return instance;
  instance = await createOpenSCAD({ noInitialRun: true });
  return instance;
}

self.onmessage = async function (e) {
  const { type, scadSource, id } = e.data;

  if (type === 'render') {
    try {
      const inst = await init();

      // Write the .scad source to the virtual filesystem
      inst.FS.writeFile('/input.scad', scadSource);

      // Render to STL
      inst.callMain(['/input.scad', '--enable=manifold', '-o', '/output.stl']);
      const stlData = inst.FS.readFile('/output.stl');

      // 2D views (side/front) are handled by Three.js orthographic camera,
      // not separate SVG projection. This avoids doubling WASM render time.

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

// Signal ready
init().then(() => {
  self.postMessage({ type: 'ready' });
}).catch((err) => {
  self.postMessage({ type: 'init-error', error: err.message || String(err) });
});
