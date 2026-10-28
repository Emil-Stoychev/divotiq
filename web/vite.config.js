import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '')
  const apiPort = env.VITE_API_PORT || '3095'

  return {
    envDir: '../',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@store': path.resolve(__dirname, 'src/utils/stores'),
      },
    },
    css: {
      preprocessorOptions: {
        scss: { api: 'modern-compiler' },
      },
    },
    test: {
      environment: 'node',
      include: ['src/**/*.test.js'],
    },
    server: {
      port: 5190,
      proxy: {
        '/api': {
          // 127.0.0.1, not localhost: Node may resolve localhost to ::1 while the API binds IPv4.
          target: `http://127.0.0.1:${apiPort}`,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
  }
})
