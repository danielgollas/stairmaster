<script>
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

  let { sceneParams = null, visibility = {}, viewMode = 'side' } = $props();

  let canvas;
  let renderer, scene, camera, controls;
  let componentMeshes = {};  // { name: THREE.Object3D }
  let hasInitialFit = false;

  function setupScene() {
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x1e293b);

    scene = new THREE.Scene();

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(50, 100, 50);
    scene.add(directional);
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-50, 50, -50);
    scene.add(fill);

    updateCamera();

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.addEventListener('change', requestRender);
  }

  function updateCamera() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (viewMode === '3d') {
      camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
      camera.position.set(-80, 60, 120);
    } else {
      const frustum = 80;
      const aspect = width / height;
      camera = new THREE.OrthographicCamera(
        -frustum * aspect, frustum * aspect,
        frustum, -frustum,
        0.1, 10000
      );
      camera.up.set(0, 0, 1);
      if (viewMode === 'side') {
        camera.position.set(60, -500, 15);
        camera.lookAt(60, 0, 15);
      } else if (viewMode === 'front') {
        camera.position.set(-500, 18, 15);
        camera.lookAt(0, 18, 15);
      }
    }

    if (controls) {
      controls.object = camera;
      controls.update();
    }
  }

  function rebuildMeshes(params) {
    // Dynamically import to avoid SSR issues
    import('../lib/scene-builder.js').then(({ buildScene }) => {
      // Remove old meshes
      for (const name in componentMeshes) {
        scene.remove(componentMeshes[name]);
        // Dispose geometry/materials
        componentMeshes[name].traverse((child) => {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
      }

      // Build new meshes
      componentMeshes = buildScene(params);

      // Add to scene with current visibility
      for (const [name, mesh] of Object.entries(componentMeshes)) {
        mesh.visible = visibility[name] !== false;
        scene.add(mesh);
      }

      // Auto-fit camera on first build
      if (!hasInitialFit) {
        hasInitialFit = true;
        const box = new THREE.Box3();
        for (const mesh of Object.values(componentMeshes)) {
          if (mesh.visible) box.expandByObject(mesh);
        }
        if (!box.isEmpty()) {
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          if (controls) {
            controls.target.copy(center);
            controls.update();
          }
          if (camera.isPerspectiveCamera) {
            const maxDim = Math.max(size.x, size.y, size.z);
            camera.position.set(
              center.x - maxDim * 0.8,
              center.y + maxDim * 0.6,
              center.z + maxDim * 1.2
            );
          }
        }
      }

      requestRender();
    });
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

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== width || canvas.height !== height) {
      renderer.setSize(width, height, false);
      if (camera.isPerspectiveCamera) {
        camera.aspect = width / height;
      } else {
        const frustum = 80;
        const aspect = width / height;
        camera.left = -frustum * aspect;
        camera.right = frustum * aspect;
        camera.top = frustum;
        camera.bottom = -frustum;
      }
      camera.updateProjectionMatrix();
    }

    controls.update();
    renderer.render(scene, camera);
  }

  onMount(() => {
    setupScene();
    requestRender();
    window.addEventListener('resize', requestRender);
  });

  onDestroy(() => {
    window.removeEventListener('resize', requestRender);
    if (controls) controls.dispose();
    if (renderer) renderer.dispose();
  });

  // Rebuild meshes when params change
  $effect(() => {
    if (sceneParams && renderer) {
      rebuildMeshes(sceneParams);
    }
  });

  // Update visibility instantly (no rebuild)
  $effect(() => {
    const vis = visibility;
    for (const [name, mesh] of Object.entries(componentMeshes)) {
      mesh.visible = vis[name] !== false;
    }
    requestRender();
  });

  // Update camera on view mode change
  $effect(() => {
    viewMode;
    if (renderer) {
      updateCamera();
      requestRender();
    }
  });
</script>

<div class="viewport-container">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .viewport-container {
    width: 100%;
    height: 100%;
    min-height: 400px;
    position: relative;
  }
  canvas {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
