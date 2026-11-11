import "server-only"

import { auth } from "@clerk/nextjs/server"

import type { Game } from "@/lib/db"
import { getGame } from "@/lib/games/queries"
import { log } from "@/lib/log"

/**
 * The first check of every server action that names a game.
 *
 * Server actions can be called by direct POST, so the game id is untrusted
 * input; the organization always comes from the session. `getGame` doubles as
 * the ownership check because it only resolves games in the caller's org.
 */
export async function authorizeGame(gameId: string, action: string) {
  const { userId, orgId } = await auth()

  if (!userId || !orgId) {
    log.warn("Rejected unauthenticated action", { action, "game.id": gameId })
    throw new Error("Unauthorized")
  }

  const game: Game | undefined = await getGame(gameId)

  if (!game) {
    log.warn("Rejected action on unknown game", {
      action,
      "game.id": gameId,
      "user.id": userId,
    })
    throw new Error("Not found")
  }

  return { game, userId, orgId }
}
