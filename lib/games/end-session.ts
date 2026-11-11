import "server-only"

import { runs, sessions } from "@trigger.dev/sdk"

import { errorFields, log } from "@/lib/log"

/**
 * Stops a deleted game's agent: cancels any running turn (so it stops calling
 * tools and spending credits) and closes the session (so no new turns start).
 * Never throws; the game is going away regardless.
 */
export async function endGameSession(gameId: string): Promise<void> {
  let currentRunId: string | null | undefined

  try {
    ;({ currentRunId } = await sessions.retrieve(gameId))
  } catch {
    // No session: the game was deleted before its first message.
    return
  }

  if (currentRunId) {
    try {
      await runs.cancel(currentRunId)
    } catch (error) {
      log.warn("Could not cancel run of deleted game", {
        "game.id": gameId,
        ...errorFields(error),
      })
    }
  }

  try {
    await sessions.close(gameId, { reason: "game deleted" })
  } catch (error) {
    log.warn("Could not close session of deleted game", {
      "game.id": gameId,
      ...errorFields(error),
    })
  }
}
