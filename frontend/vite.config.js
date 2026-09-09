import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The React app calls the ORIGINAL Express API routes (/set, /get) as
// relative paths, exactly like track.html and admin.html used to. This
// proxy forwards those calls to the backend (index.js, still on :8888)
// while you develop, so you don't need CORS config or absolute URLs.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/set": "http://localhost:8888",
      "/get": "http://localhost:8888",
    },
  },
});
