"use server"

import { auth as triggerAuth } from "@trigger.dev/sdk"
import { chat, type ChatStartSessionParams } from "@trigger.dev/sdk/ai"

import { canStartTurn, OUT_OF_CREDITS } from "@/lib/billing/ledger"
import { authorizeGame } from "@/lib/games/authorize"
import { errorFields, log } from "@/lib/log"
import type { gameAgent } from "@/trigger/game-agent"

const startSession = chat.createStartSessionAction<typeof gameAgent>("game-agent")

/**
 * Creates (or rejoins) the game's chat session and returns a session-scoped
 * token. Idempotent per chat id, so two tabs converge on one session.
 */
export async function startGameSession(params: ChatStartSessionParams<typeof gameAgent>) {
  const { orgId } = await authorizeGame(params.chatId, "startGameSession")

  // Refuse before a run exists; the agent checks again on every turn.
  if (!(await canStartTurn(orgId))) {
    throw new Error(OUT_OF_CREDITS)
  }

  try {
    return await startSession(params)
  } catch (error) {
    log.error("Could not start chat session", {
      "game.id": params.chatId,
      ...errorFields(error),
    })
    throw error
  }
}

/**
 * Mints a fresh read/write token for one game's session. Called by the
 * transport after a 401/403, and runs on the server so TRIGGER_SECRET_KEY never
 * reaches the browser.
 */
export async function mintGameSessionToken(chatId: string) {
  await authorizeGame(chatId, "mintGameSessionToken")

  return triggerAuth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}
