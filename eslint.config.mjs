import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTs from "eslint-config-next/typescript"

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".trigger/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Plain browser JS seeded into game sandboxes; it never runs in the app.
    "game-runtime/**",
  ]),
])
