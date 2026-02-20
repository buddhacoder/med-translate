import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  root: '.',
  plugins: [basicSsl()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/ws': {
        target: 'https://localhost:8443',
        ws: true,
        secure: false,  // accept self-signed cert
        changeOrigin: true,
      },
    },
  },
});
