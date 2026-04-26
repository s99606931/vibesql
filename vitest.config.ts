import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    environmentMatchGlobs: [
      ["src/app/api/**", "node"],
      ["src/lib/**", "node"],
      ["src/middleware.test.ts", "node"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      include: ["src/lib/**", "src/middleware.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
