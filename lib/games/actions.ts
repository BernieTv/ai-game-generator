"use server"

import { auth } from "@clerk/nextjs/server"
import { generateId, type UIMessage } from "ai"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { isGameModelId } from "@/lib/agent/models"
import { db, games } from "@/lib/db"
import { authorizeGame } from "@/lib/games/authorize"
import { endGameSession } from "@/lib/games/end-session"
import { TITLE_MAX_LENGTH, titleFromPrompt } from "@/lib/games/titles"
import { errorFields, log } from "@/lib/log"
import { deleteGameSandboxes } from "@/lib/sandbox/game-sandbox"

const promptSchema = z
  .string()
  .trim()
  .min(3, "Describe your game in a few words.")
  .max(4000)

/**
 * Creates a game with the opening prompt already stored as its first message,
 * then opens it. The game page sees a thread ending in a user message and asks
 * the agent for the first reply.
 */
export async function createGame(prompt: string, modelId: string) {
  const { userId, orgId } = await auth()

  if (!userId || !orgId) {
    throw new Error("Choose or create a workspace first.")
  }

  const text = promptSchema.parse(prompt)
  const opening: UIMessage = {
    id: generateId(),
    role: "user",
    parts: [{ type: "text", text }],
  }

  const [game] = await db
    .insert(games)
    .values({
      orgId,
      createdBy: userId,
      title: titleFromPrompt(text),
      messages: [opening],
    })
    .returning({ id: games.id })

  log.info("Created game", { "game.id": game.id, "organization.id": orgId })

  const model = isGameModelId(modelId) ? `?model=${modelId}` : ""

  revalidatePath("/studio", "layout")
  redirect(`/studio/games/${game.id}${model}`)
}

export async function renameGame(gameId: string, title: string) {
  const { orgId } = await authorizeGame(gameId, "renameGame")
  const next = z.string().trim().min(1).max(TITLE_MAX_LENGTH).parse(title)

  await db
    .update(games)
    .set({ title: next })
    .where(and(eq(games.id, gameId), eq(games.orgId, orgId)))

  revalidatePath("/studio", "layout")
}

/**
 * Deletes a game: stops its agent, deletes its sandboxes, then the row. The row
 * goes last because it is the only handle a retry has if a sandbox delete fails.
 */
export async function deleteGame(gameId: string) {
  const { game, orgId } = await authorizeGame(gameId, "deleteGame")

  await endGameSession(gameId)

  try {
    await deleteGameSandboxes(gameId, game.sandboxId)
  } catch (error) {
    log.error("Game delete stopped: sandbox cleanup failed", {
      "game.id": gameId,
      ...errorFields(error),
    })
    throw new Error("Could not delete the game's sandbox. Please try again.")
  }

  await db.delete(games).where(and(eq(games.id, gameId), eq(games.orgId, orgId)))

  revalidatePath("/studio", "layout")
  redirect("/studio")
}
