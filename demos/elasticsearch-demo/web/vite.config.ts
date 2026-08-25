import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxy "/api" -> FastAPI (localhost:8000) để frontend luôn gọi path
// tương đối "/api/..." giống hệt production (nginx proxy "/api" -> service "api").
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
