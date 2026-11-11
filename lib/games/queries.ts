import "server-only"

import { auth } from "@clerk/nextjs/server"
import { and, desc, eq } from "drizzle-orm"

import { db, games, type Game } from "@/lib/db"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type GameSummary = Pick<Game, "id" | "title" | "updatedAt">

/** The active organization's games, most recently created first. */
export async function listGames(): Promise<GameSummary[]> {
  const { orgId } = await auth()

  if (!orgId) return []

  return db
    .select({ id: games.id, title: games.title, updatedAt: games.updatedAt })
    .from(games)
    .where(eq(games.orgId, orgId))
    .orderBy(desc(games.createdAt))
    .limit(200)
}

/**
 * A game in the caller's active organization. Games in other organizations
 * are indistinguishable from games that do not exist.
 */
export async function getGame(id: string): Promise<Game | undefined> {
  const { orgId } = await auth()

  if (!orgId || !UUID.test(id)) return undefined

  const [game] = await db
    .select()
    .from(games)
    .where(and(eq(games.id, id), eq(games.orgId, orgId)))
    .limit(1)

  return game
}
