<script>
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { STLLoader } from 'three/addons/loaders/STLLoader.js';

  let { stlData = null, viewMode = 'side' } = $props();
  let hasInitialFit = false;

  let canvas;
  let renderer, scene, camera, controls, mesh;

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
      if (viewMode === 'side') {
        // Look along -Y axis: camera at large +Y, looking at Y=0
        // Model: X = run, Y = width, Z = height
        camera.position.set(60, 500, 20);
        camera.lookAt(60, 0, 20);
        camera.up.set(0, 0, 1);  // Z is up
      } else if (viewMode === 'front') {
        // Look along +X axis: camera at large -X, looking at X=0
        camera.position.set(-500, 18, 20);
        camera.lookAt(0, 18, 20);
        camera.up.set(0, 0, 1);  // Z is up
      }
    }

    if (controls) {
      controls.object = camera;
      controls.update();
    }
  }

  function loadSTL(data) {
    if (mesh) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
    }

    if (!data) return;

    const loader = new STLLoader();
    const geometry = loader.parse(data);
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
      color: 0xc08020,
      specular: 0x222222,
      shininess: 20,
      flatShading: false,
    });
    mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // Only auto-fit camera on first load, not on parameter changes
    if (!hasInitialFit) {
      hasInitialFit = true;
      const box = new THREE.Box3().setFromObject(mesh);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      if (controls) {
        controls.target.copy(center);
        controls.update();
      }

      if (camera.isPerspectiveCamera) {
        camera.position.set(
          center.x - maxDim * 0.8,
          center.y + maxDim * 0.6,
          center.z + maxDim * 1.2
        );
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

  $effect(() => {
    if (stlData && renderer) {
      loadSTL(stlData);
    }
  });

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
