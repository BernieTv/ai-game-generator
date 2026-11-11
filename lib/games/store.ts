import type { UIMessage } from "ai"
import { eq } from "drizzle-orm"

import { db, games } from "@/lib/db/client"

/**
 * Game reads and writes used by the Trigger.dev agent.
 *
 * Looked up by id alone: the worker has no Clerk session, and a game id only
 * reaches it through a chat session the web app already authorized.
 */
export async function loadMessages(gameId: string): Promise<UIMessage[]> {
  const [game] = await db
    .select({ messages: games.messages })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  return game?.messages ?? []
}

export async function loadOrgId(gameId: string): Promise<string | undefined> {
  const [game] = await db
    .select({ orgId: games.orgId })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  return game?.orgId
}

export async function saveMessages(gameId: string, messages: UIMessage[]): Promise<void> {
  await db.update(games).set({ messages }).where(eq(games.id, gameId))
}

/**
 * Saves the thread and the stream cursor in one statement, so a reload can never
 * resume from a cursor that points past messages the row does not have.
 */
export async function saveTurn(params: {
  gameId: string
  messages: UIMessage[]
  chatAccessToken: string
  chatLastEventId: string | undefined
}): Promise<void> {
  await db
    .update(games)
    .set({
      messages: params.messages,
      chatAccessToken: params.chatAccessToken,
      chatLastEventId: params.chatLastEventId ?? null,
    })
    .where(eq(games.id, params.gameId))
}
