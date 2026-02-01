import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "app"),
      "@games": path.resolve(__dirname, "data", "games"),
    },
  },
  test: {
    environment: "node",
  },
});
