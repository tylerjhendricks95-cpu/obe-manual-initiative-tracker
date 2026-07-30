import { defineConfig } from "vite";

export default defineConfig({
  // Allows Owlbear Rodeo to iframe your extension during dev/prod
  server: {
    cors: true
  }
});
