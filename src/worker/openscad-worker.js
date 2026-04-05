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
      const scad = await init();
      const inst = scad.getInstance();

      // Write the .scad source to the virtual filesystem
      inst.FS.writeFile('/input.scad', scadSource);

      // Render to STL
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

// Signal ready
init().then(() => {
  self.postMessage({ type: 'ready' });
}).catch((err) => {
  self.postMessage({ type: 'init-error', error: err.message || String(err) });
});
