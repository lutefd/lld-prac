import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const apiPort = process.env.PRACTICE_API_PORT || "3001";
const webPort = Number(process.env.PRACTICE_WEB_PORT || 5173);
const previewPort = Number(process.env.PRACTICE_PREVIEW_PORT || 4173);
const api = `http://127.0.0.1:${apiPort}`;
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: webPort,
    strictPort: true,
    proxy: { "/api": api },
  },
  preview: {
    host: "127.0.0.1",
    port: previewPort,
    proxy: { "/api": api },
  },
});
