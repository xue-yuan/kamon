import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  // Path the site is served under; scripts/build-share-pages.mjs reads the same variable
  base: process.env.BASE_PATH || '/',
  plugins: [solid()],
  build: {
    // The bundle is mostly crest path data (src/data.js), ~300 kB gzipped
    chunkSizeWarningLimit: 900,
  },
})
