import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    env: {
      VIBESQL_DEV_AUTH_BYPASS: "1",
      VIBESQL_DEV_AS_ADMIN: "1",
    },
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error vitest 4.x type defs lag behind runtime support
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
      "@clerk/nextjs/server": path.resolve(__dirname, "./src/test/mocks/clerk-server.ts"),
      "@clerk/nextjs": path.resolve(__dirname, "./src/test/mocks/clerk-server.ts"),
      "next/server": path.resolve(__dirname, "./src/test/mocks/next-server.ts"),
      "next/headers": path.resolve(__dirname, "./src/test/mocks/next-headers.ts"),
    },
  },
});
