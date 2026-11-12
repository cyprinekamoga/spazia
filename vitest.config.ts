import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for pure logic (prices, emails, search, SEO). Database tests:
// scripts/db-test.sh. Edge function tests: npm run test:functions (Deno).
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts", "netlify/**/*.test.ts"],
    environment: "node",
  },
});
