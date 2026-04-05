<script>
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { buildScene } from '../lib/scene-builder.js';

  let { sceneParams = null, visibility = {}, viewMode = 'side' } = $props();

  let canvas;
  let renderer, scene, camera, controls;
  let currentMeshes = {};
  let hasInitialFit = false;

  function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x1e293b);

    scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(50, 100, 50);
    scene.add(dir);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-50, 50, -50);
    scene.add(fill);

    // Default camera + controls (will be replaced by setView)
    camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 10000);
    camera.up.set(0, 0, 1);
    camera.position.set(-40, -60, 40);

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.addEventListener('change', requestRender);

    setView(viewMode);
  }

  function setView(mode) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    // Dispose old controls
    if (controls) controls.dispose();

    if (mode === '3d') {
      camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 10000);
      camera.up.set(0, 0, 1);
      camera.position.set(-40, -60, 40);
    } else {
      const frustum = 40;
      const aspect = w / h;
      camera = new THREE.OrthographicCamera(
        -frustum * aspect, frustum * aspect, frustum, -frustum, -10000, 10000
      );
      camera.up.set(0, 0, 1);
      if (mode === 'side') {
        camera.position.set(30, -100, 15);
      } else {
        camera.position.set(-100, 18, 15);
      }
    }

    camera.lookAt(30, 18, 15);

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.target.set(30, 18, 15);
    controls.addEventListener('change', requestRender);
    controls.update();

    requestRender();
  }

  function rebuildMeshes(params) {
    for (const name in currentMeshes) {
      scene.remove(currentMeshes[name]);
      currentMeshes[name].traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
    }

    currentMeshes = buildScene(params);

    for (const [name, mesh] of Object.entries(currentMeshes)) {
      mesh.visible = visibility[name] !== false;
      scene.add(mesh);
    }

    if (!hasInitialFit) {
      hasInitialFit = true;
      const box = new THREE.Box3();
      for (const m of Object.values(currentMeshes)) {
        if (m.visible) box.expandByObject(m);
      }
      if (!box.isEmpty()) {
        const center = box.getCenter(new THREE.Vector3());
        controls.target.copy(center);
        if (camera.isPerspectiveCamera) {
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          camera.position.set(center.x - maxDim, center.y - maxDim * 0.8, center.z + maxDim * 0.6);
        }
        camera.lookAt(center);
        controls.update();
      }
    }

    requestRender();
  }

  let renderRequested = false;
  function requestRender() {
    if (!renderRequested) {
      renderRequested = true;
      requestAnimationFrame(render);
    }
  }

  function render() {
    renderRequested = false;
    if (!renderer) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      if (camera.isPerspectiveCamera) {
        camera.aspect = w / h;
      } else {
        const f = 40;
        const a = w / h;
        camera.left = -f * a; camera.right = f * a;
        camera.top = f; camera.bottom = -f;
      }
      camera.updateProjectionMatrix();
    }
    controls.update();
    renderer.render(scene, camera);
  }

  onMount(() => {
    init();
    requestRender();
    window.addEventListener('resize', requestRender);
  });

  onDestroy(() => {
    window.removeEventListener('resize', requestRender);
    if (controls) controls.dispose();
    if (renderer) renderer.dispose();
  });

  $effect(() => {
    if (sceneParams && renderer) rebuildMeshes(sceneParams);
  });

  $effect(() => {
    const vis = visibility;
    Object.values(vis);
    for (const [name, mesh] of Object.entries(currentMeshes)) {
      mesh.visible = vis[name] !== false;
    }
    requestRender();
  });

  $effect(() => {
    if (renderer) setView(viewMode);
  });
</script>

<div class="viewport-container">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .viewport-container { width: 100%; height: 100%; min-height: 400px; position: relative; }
  canvas { width: 100%; height: 100%; display: block; }
</style>
