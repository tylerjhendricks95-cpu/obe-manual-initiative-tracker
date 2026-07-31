import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "esnext", // THIS TELLS ESBUILD TO ALLOW TOP-LEVEL AWAIT
  },
  server: {
    cors: true,
  },
});
