import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { 
    port: 3000,
    proxy: {
      '/socket.io': {
        target: 'ws://localhost:3001', // Assuming your Node server runs on 3001
        ws: true,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  base: '/family-tree/'
});