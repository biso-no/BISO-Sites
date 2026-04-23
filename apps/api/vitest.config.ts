import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@repo": path.resolve(import.meta.dirname, "../../packages"),
    },
  },
  test: {
    environment: "node",
  },
});
