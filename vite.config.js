import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-utils': ['date-fns', 'lucide-react', 'react-hot-toast'],
          'vendor-charts': ['recharts'],
          'vendor-pdf-excel': ['jspdf', 'jspdf-autotable', 'exceljs', 'xlsx', 'file-saver'],
          'vendor-motion': ['framer-motion'],
        }
      }
    },
    chunkSizeWarningLimit: 800,
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
})
