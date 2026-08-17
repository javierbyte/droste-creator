import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from javier.xyz/droste-creator via a vercel rewrite to
// javierbyte.github.io/droste-creator.
export default defineConfig({
  base: '/droste-creator/',
  plugins: [react()],
  build: { outDir: 'dist' },
});
