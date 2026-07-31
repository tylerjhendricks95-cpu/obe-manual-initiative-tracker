import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext",
    cssCodeSplit: false, // Bundles all CSS into a single file for easy loading
  },
  css: {
    devSourcemap: true, // Helps locate CSS rules when inspecting elements
  },
  server: {
    cors: true,
  },
});
