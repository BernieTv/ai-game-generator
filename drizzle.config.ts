import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: ".env.local", quiet: true })

// Schema pushes need a direct connection: PgBouncer (the pooled URL) does not
// support the session-level statements drizzle-kit issues.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

if (!url) {
  throw new Error("Set DATABASE_URL_UNPOOLED (or DATABASE_URL) in .env.local")
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url },
})
