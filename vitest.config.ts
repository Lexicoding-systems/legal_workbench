import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    include: ["src/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/parse-json.ts",
        "src/modules/parsing/chunker.ts",
        "src/modules/generation/generator.utils.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
