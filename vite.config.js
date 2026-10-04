import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Long-lived vendor chunks, so a deploy that only touches app code doesn't re-download them.
// (Recharts is only imported by the lazy Stats page, so it already gets its own async chunk.)
function vendorChunk(id) {
  if (!id.includes('node_modules')) return undefined
  if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react'
  if (id.includes('node_modules/@supabase/')) return 'supabase'
  return undefined
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/sunday-football/', // required for GitHub Pages
  build: {
    rollupOptions: {
      output: { manualChunks: vendorChunk },
    },
  },
})
