import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
    plugins: [
        react(),
        mode === 'development' && componentTagger(),
    ].filter(Boolean),
    base: "/",
    server: {
        host: "0.0.0.0",
        port: 8080,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        outDir: "dist",
        assetsDir: "assets",
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: undefined,
            },
        },
    },
}));
