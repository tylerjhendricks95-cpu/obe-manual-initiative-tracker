import { defineConfig } from "vite";

export default defineConfig({
  base: "./", // ENSURES GITHUB PAGES LOADS CSS & JS RELATIVE PATHS CORRECTLY
  build: {
    target: "esnext",
  },
  server: {
    cors: true,
  },
});
