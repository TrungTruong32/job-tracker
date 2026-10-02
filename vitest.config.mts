import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // Next.js guards server modules with "server-only"; outside Next it's a no-op.
    alias: { "server-only": fileURLToPath(new URL("./test/empty-module.ts", import.meta.url)) },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
})
