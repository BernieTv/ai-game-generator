import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import * as schema from "./schema"

/**
 * Shared by the Next.js server and the Trigger.dev worker, which is why this
 * file carries no `server-only` marker (that marker throws outside React
 * Server Components). Next.js code imports `@/lib/db`, which adds it.
 *
 * The pool is created lazily so that importing a module that touches the
 * database (for example during `next build`) never requires DATABASE_URL.
 */
const globalForDb = globalThis as unknown as { playforgeDb?: ReturnType<typeof connect> }

function connect() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set")
  }

  return drizzle(new Pool({ connectionString, max: 10 }), { schema })
}

function getDb() {
  // Reused across hot reloads in development and across calls in production.
  globalForDb.playforgeDb ??= connect()

  return globalForDb.playforgeDb
}

export const db = new Proxy({} as ReturnType<typeof connect>, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver)
  },
})

export * from "./schema"
