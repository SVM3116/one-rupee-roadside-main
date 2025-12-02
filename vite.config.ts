import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// Check if HTTPS certificates exist
const certDir = path.resolve(__dirname, 'certs');
const keyPath = path.join(certDir, 'localhost.key');
const certPath = path.join(certDir, 'localhost.crt');
const hasCert = fs.existsSync(keyPath) && fs.existsSync(certPath);

// HTTPS configuration
const httpsConfig = hasCert ? {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath),
} : undefined;

if (!hasCert) {
  console.warn('⚠️  HTTPS certificates not found. Location features may be limited.');
  console.warn('   Run: generate-cert.bat (Windows) or ./generate-cert.sh (Mac/Linux)');
  console.warn('   Or access via: http://localhost:8080 (location may not work)');
} else {
  console.log('✅ HTTPS enabled - Location will work properly');
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: '/', // CRITICAL: Set base to '/' for Vercel
  server: {
    host: "0.0.0.0", // Allow access from network
    port: 8080,
    strictPort: true,
    https: httpsConfig, // Enable HTTPS if certificates exist
    // Proxy /api calls to backend to avoid CORS and connection issues in dev
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE || 'http://localhost:5000',
        changeOrigin: true,
        secure: false, // Allow self-signed certificates
        ws: true, // Enable WebSocket proxying if needed
        configure: (proxy, options) => {
          // optional: log proxy errors
          proxy.on('error', (err, req, res) => {
            // eslint-disable-next-line no-console
            console.error('[vite proxy] error', err && err.message);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Log proxy requests in dev
            if (mode === 'development') {
              // eslint-disable-next-line no-console
              console.log('[vite proxy]', req.method, req.url, '->', proxyReq.path);
            }
          });
        }
      }
    }
  },
  build: {
    outDir: 'dist', // Output directory
    assetsDir: 'assets', // Assets directory
    sourcemap: false, // Disable sourcemaps for production
    rollupOptions: {
      output: {
        manualChunks: undefined, // Let Vite handle chunking
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
