import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const port = parseInt(process.env.VITE_PORT || process.env.PORT || env.VITE_PORT || '3000', 10);
  const backendPort = process.env.BACKEND_PORT || env.BACKEND_PORT || '8080';

  return {
    plugins: [react()],
    build: {
      outDir: '../cmd/cortex/dist',
      emptyOutDir: true,
    },
    server: {
      host: '0.0.0.0',
      port: port,
      strictPort: false, // Automatically picks the next free port if occupied
      proxy: {
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
          ws: true,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});