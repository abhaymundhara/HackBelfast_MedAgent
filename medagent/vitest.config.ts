import path from "path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    testTimeout: 15_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
  },
});
