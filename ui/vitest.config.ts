import path from "node:path"
import { defineConfig } from "vitest/config"

// Tests for the plain TypeScript modules we add to Kamra's front end (ui/overlay).
export default defineConfig({
  resolve: { alias: { "@custom": path.resolve(__dirname, "overlay/src/custom") } },
  test: { environment: "node", include: ["tests/**/*.test.ts"] },
})
