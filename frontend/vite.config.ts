import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  if (mode === 'production') {
    if (env.VITE_USE_MOCK_API !== 'false') {
      throw new Error('Production build requires VITE_USE_MOCK_API=false')
    }
    if (!env.VITE_API_BASE_URL?.trim()) {
      throw new Error('Production build requires VITE_API_BASE_URL')
    }
  }

  return {
    plugins: [react(), tailwindcss()],
  }
})
