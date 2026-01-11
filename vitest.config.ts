import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Vitest Configuration
 *
 * Story 4.1, CRITICAL-1 FIX: 테스트 환경 설정
 *
 * @see https://vitest.dev/config/
 */
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".next", "out"],
    env: {
      NODE_ENV: "test",
      SKIP_ENV_VALIDATION: "true",
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        ".next/",
        "dist/",
        "**/*.config.{ts,js}",
        "**/types/**",
        "test.setup.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
