import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Set target to modern JS to support top-level await and modern features if needed
    target: "esnext",
  },
  server: {
    // Allows Owlbear Rodeo iframe to load your local development server smoothly
    cors: true,
  },
});
