import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/set": "http://localhost:8888",
      "/get": "http://localhost:8888",
      "/history": "http://localhost:8888",
    },
  },
});