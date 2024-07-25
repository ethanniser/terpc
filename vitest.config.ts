import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    mockReset: true,
    coverage: {
      provider: "v8",
      include: ["**/src/**"],
      exclude: ["**/docs/**", "**/examples/**", "**/tooling/**"],
    },
  },
  esbuild: { target: "es2020" },
});
