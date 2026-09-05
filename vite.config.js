import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    outDir: "build/web",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1600,
  },
});
