import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import stylex from '@stylexjs/unplugin';

export default defineConfig({
  plugins: [
    stylex.vite({
      dev: process.env.NODE_ENV !== 'production',
      runtimeInjection: false,
      useCSSLayers: { before: ['reset'] },
      unstable_moduleResolution: { type: 'commonJS', rootDir: process.cwd() },
    }),
    solid(),
  ],
  server: {
    port: 4878,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4877', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  preview: {
    port: 4879,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:4877', rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
});
