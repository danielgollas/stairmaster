<script>
  import { onMount, onDestroy } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
  import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
  import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
  import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
  import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
  import { N8AOPass } from 'n8ao';
  import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
  import { buildScene } from '../lib/scene-builder.js';
  import { loadCamera, saveCamera } from '../lib/persistence.js';

  let { sceneParams = null, visibility = {}, viewMode = 'side', faceMode = 'color', aoMode = 'off', aoParams = {}, resetCamera = 0 } = $props();

  let canvas;
  let renderer, scene, camera, controls;
  let composer = null;
  let sceneGroup = null; // Scaled group: inches → meters
  let currentMeshes = {};
  let hasInitialFit = false;
  let currentAoMode = 'off';
  let useComposer = false;

  const IN_TO_M = 1 / 39.37; // inches to meters scale factor

  function init() {
    renderer = new THREE.WebGLRenderer({ antialias: true, canvas, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0xd4e6f1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    scene = new THREE.Scene();
    sceneGroup = new THREE.Group();
    sceneGroup.scale.setScalar(IN_TO_M);
    scene.add(sceneGroup);

    // Low ambient so bump/normal detail shows through
    scene.add(new THREE.AmbientLight(0xffffff, 0.15));

    // Hemisphere light: sky bounce (blue-ish) + ground bounce (warm)
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x806040, 0.3);
    scene.add(hemi);

    // Key light — warm sun, high and to the right-front
    const key = new THREE.DirectionalLight(0xfff0d6, 1.4);
    key.position.set(4, -3, 8);
    scene.add(key);

    // Fill light — cool, opposite side, softer
    const fill = new THREE.DirectionalLight(0xd6e8ff, 0.5);
    fill.position.set(-5, 2, 3);
    scene.add(fill);

    // Bounce light — from below/front to catch undersides
    const bounce = new THREE.DirectionalLight(0xffe8cc, 0.25);
    bounce.position.set(1, -4, -1);
    scene.add(bounce);

    // Rim/back light — behind and above for edge separation
    const rim = new THREE.DirectionalLight(0xffffff, 0.35);
    rim.position.set(-3, 6, -4);
    scene.add(rim);

    camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.01, 50);
    camera.up.set(0, 0, 1);
    camera.position.set(-40, -60, 40);

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.addEventListener('change', requestRender);

    setView(viewMode);
  }

  function setupComposer(mode, params) {
    if (composer) {
      composer.dispose();
      composer = null;
    }
    currentAoMode = mode;
    useComposer = ['ssao', 'sao', 'n8ao'].includes(mode);

    if (!useComposer) return;

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    composer = new EffectComposer(renderer);

    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);

    if (mode === 'ssao') {
      const p = params || {};
      const ssaoPass = new SSAOPass(scene, camera, w, h);
      ssaoPass.kernelRadius = p.kernelRadius ?? 4;
      ssaoPass.minDistance = p.minDistance ?? 0.0005;
      ssaoPass.maxDistance = p.maxDistance ?? 0.05;
      ssaoPass.output = SSAOPass.OUTPUT.Default;
      composer.addPass(ssaoPass);
    } else if (mode === 'sao') {
      const p = params || {};
      const saoPass = new SAOPass(scene, camera);
      saoPass.params.saoBias = p.bias ?? 1.0;
      saoPass.params.saoIntensity = p.intensity ?? 0.006;
      saoPass.params.saoScale = p.scale ?? 3;
      saoPass.params.saoKernelRadius = p.kernelRadius ?? 30;
      saoPass.params.saoMinResolution = 0;
      saoPass.params.saoBlur = true;
      saoPass.params.saoBlurRadius = p.blurRadius ?? 6;
      saoPass.params.saoBlurStdDev = 3;
      saoPass.params.saoBlurDepthCutoff = 0.01;
      composer.addPass(saoPass);
    } else if (mode === 'n8ao') {
      // N8AOPass replaces RenderPass — remove the one we just added
      composer.passes = [];
      const p = params || {};
      const n8aoPass = new N8AOPass(scene, camera, w, h);
      n8aoPass.configuration.aoRadius = p.aoRadius ?? 5.0;
      n8aoPass.configuration.distanceFalloff = p.distanceFalloff ?? 2.0;
      n8aoPass.configuration.intensity = p.intensity ?? 3.0;
      n8aoPass.configuration.aoSamples = p.aoSamples ?? 16;
      n8aoPass.configuration.denoiseSamples = p.denoiseSamples ?? 8;
      n8aoPass.configuration.denoiseRadius = p.denoiseRadius ?? 6;
      n8aoPass.configuration.gammaCorrection = true;
      composer.addPass(n8aoPass);
    }

    // N8AOPass handles its own output; SSAO/SAO need OutputPass
    if (mode !== 'n8ao') {
      const outputPass = new OutputPass();
      composer.addPass(outputPass);
    }

    // SMAA anti-aliasing as final pass (MSAA doesn't work with EffectComposer)
    const smaaPass = new SMAAPass(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
    composer.addPass(smaaPass);
  }

  function setView(mode) {
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const s = IN_TO_M; // scale factor for positions

    if (controls) controls.dispose();

    if (mode === '3d') {
      camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 50);
      camera.up.set(0, 0, 1);
      camera.position.set(-40 * s, -60 * s, 40 * s);
    } else {
      const frustum = 40 * s;
      const aspect = w / h;
      camera = new THREE.OrthographicCamera(
        -frustum * aspect, frustum * aspect, frustum, -frustum, -50, 50
      );
      camera.up.set(0, 0, 1);
      if (mode === 'side') {
        camera.position.set(30 * s, -100 * s, 15 * s);
      } else {
        camera.position.set(-100 * s, 18 * s, 15 * s);
      }
    }

    // Restore saved camera if available and valid
    const savedCam = loadCamera(mode);
    const maxDist = 10;
    let restored = false;
    if (savedCam && savedCam.position) {
      const dist = Math.sqrt(savedCam.position[0] ** 2 + savedCam.position[1] ** 2 + savedCam.position[2] ** 2);
      if (dist > 0.01 && dist < maxDist) {
        camera.position.fromArray(savedCam.position);
        restored = true;
      }
    }

    const defaultTarget = new THREE.Vector3(30 * s, 18 * s, 15 * s);
    camera.lookAt(defaultTarget);

    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.target.copy(defaultTarget);

    // Disable rotation in orthographic views — pan and zoom only
    if (mode !== '3d') {
      controls.enableRotate = false;
    }

    if (restored && savedCam.target) {
      const tDist = Math.sqrt(savedCam.target[0] ** 2 + savedCam.target[1] ** 2 + savedCam.target[2] ** 2);
      if (tDist < maxDist) {
        controls.target.fromArray(savedCam.target);
      }
    }

    controls.addEventListener('change', () => {
      requestRender();
      saveCamera(mode, {
        position: camera.position.toArray(),
        target: controls.target.toArray(),
      });
    });
    controls.update();

    // Rebuild composer with new camera
    setupComposer(currentAoMode, aoParams);

    requestRender();
  }

  function rebuildMeshes(params) {
    for (const name in currentMeshes) {
      sceneGroup.remove(currentMeshes[name]);
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
      sceneGroup.add(mesh);
    }

    if (!hasInitialFit) {
      hasInitialFit = true;
      // Bounding box in world space (already scaled to meters)
      const bbox = new THREE.Box3();
      for (const m of Object.values(currentMeshes)) {
        if (m.visible) bbox.expandByObject(m);
      }
      if (!bbox.isEmpty()) {
        const center = bbox.getCenter(new THREE.Vector3());
        controls.target.copy(center);
        if (camera.isPerspectiveCamera) {
          const size = bbox.getSize(new THREE.Vector3());
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
    if (!renderer || !canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      if (camera.isPerspectiveCamera) {
        camera.aspect = w / h;
      } else {
        const f = 40 * IN_TO_M;
        const a = w / h;
        camera.left = -f * a; camera.right = f * a;
        camera.top = f; camera.bottom = -f;
      }
      camera.updateProjectionMatrix();
      if (composer) composer.setSize(w, h);
    }
    controls.update();

    if (useComposer && composer) {
      const annotationKeys = ['dimensions', 'grid', 'measureGrid', 'boardOverlay'];

      // Pass 1: Hide annotations, render geometry with AO via composer
      const hiddenAnnotations = [];
      for (const [name, mesh] of Object.entries(currentMeshes)) {
        if (annotationKeys.includes(name) && mesh.visible) {
          mesh.visible = false;
          hiddenAnnotations.push(mesh);
        }
      }
      composer.render();

      // Pass 2: Hide geometry, show only annotations on top
      if (hiddenAnnotations.length > 0) {
        // Hide all geometry
        const hiddenGeometry = [];
        for (const [name, mesh] of Object.entries(currentMeshes)) {
          if (!annotationKeys.includes(name) && mesh.visible) {
            mesh.visible = false;
            hiddenGeometry.push(mesh);
          }
        }
        // Show annotations
        for (const m of hiddenAnnotations) m.visible = true;

        renderer.autoClear = false;
        renderer.clearDepth();
        renderer.render(scene, camera);
        renderer.autoClear = true;

        // Restore geometry visibility
        for (const m of hiddenGeometry) m.visible = true;
      }
    } else {
      renderer.render(scene, camera);
    }
  }

  onMount(() => {
    init();
    requestRender();
    window.addEventListener('resize', requestRender);
  });

  onDestroy(() => {
    window.removeEventListener('resize', requestRender);
    if (controls) controls.dispose();
    if (composer) composer.dispose();
    if (renderer) renderer.dispose();
  });

  $effect(() => {
    if (sceneParams && renderer && canvas) rebuildMeshes(sceneParams);
  });

  $effect(() => {
    const vis = visibility;
    Object.values(vis);
    for (const [name, mesh] of Object.entries(currentMeshes)) {
      mesh.visible = vis[name] !== false;
    }
    requestRender();
  });

  let lastViewMode = null;
  $effect(() => {
    if (renderer && canvas && viewMode !== lastViewMode) {
      lastViewMode = viewMode;
      setView(viewMode);
    }
  });

  let lastReset = 0;
  $effect(() => {
    if (renderer && canvas && resetCamera > lastReset) {
      lastReset = resetCamera;
      // Clear saved camera for this view mode and force default
      saveCamera(viewMode, null);
      lastViewMode = null; // force setView to re-run
      setView(viewMode);
    }
  });

  $effect(() => {
    // Re-setup composer when aoMode or aoParams change
    const mode = aoMode;
    const params = aoParams;
    if (renderer && canvas) {
      setupComposer(mode, params);
      requestRender();
    }
  });
</script>

<div class="viewport-container">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .viewport-container { width: 100%; height: 100%; min-height: 400px; position: relative; }
  canvas { width: 100%; height: 100%; display: block; }
</style>
