import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  base: '/stairmaster/',
  plugins: [svelte()],
  optimizeDeps: {
    exclude: ['openscad-wasm'],
  },
  worker: {
    format: 'es',
  },
});
