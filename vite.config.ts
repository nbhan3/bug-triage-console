import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// When the Express API server is running (npm run dev:server or npm run dev),
// Vite proxies /api/* to it so the API key stays server-side.
// In rules-only mode (no server running), LLM calls simply fail gracefully and
// the app continues with deterministic rules-only confidence.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
