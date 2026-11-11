import { chat, upsertIncomingMessage } from "@trigger.dev/sdk/ai"
import { stepCountIs, streamText } from "ai"
import { z } from "zod"

import { DEFAULT_MODEL_ID, GAME_MODEL_IDS } from "@/lib/agent/models"
import { systemPrompt } from "@/lib/agent/prompt"
import { modelSettings } from "@/lib/agent/provider"
import { createGameTools } from "@/lib/agent/tools"
import { canStartTurn, chargeStep, OUT_OF_CREDITS } from "@/lib/billing/ledger"
import { priceStep } from "@/lib/billing/pricing"
import { loadMessages, loadOrgId, saveMessages, saveTurn } from "@/lib/games/store"
import { errorFields, log, since } from "@/lib/log"
import { createGameSandbox } from "@/lib/sandbox/game-sandbox"

/** A build is a long read/write/verify loop; leave room for it. */
const MAX_STEPS = 60

/**
 * The only thing the browser controls about a turn is which model runs it, and
 * that is validated against the catalog here.
 */
const clientDataSchema = z
  .object({ modelId: z.enum(GAME_MODEL_IDS).optional() })
  .optional()

/**
 * One durable chat agent per game (the chat id is the game id).
 *
 * Turns run on Trigger.dev rather than in a Next.js route, so a long build
 * survives the player closing the tab, and a reload resumes the live stream.
 * The `games` row is the source of truth for the thread: it is re-read at the
 * top of every turn rather than trusting the copy in the browser.
 *
 * Authorization happens in the server actions that start a session or mint a
 * token (`lib/games/chat-actions.ts`); there is no Clerk session in here.
 */
export const gameAgent = chat.agent({
  id: "game-agent",
  clientDataSchema,

  hydrateMessages: async ({ chatId, trigger, incomingMessages }) => {
    const stored = await loadMessages(chatId)

    // Adds a genuinely new user message and ignores a replay of one the row
    // already has (a new game is stored with its opening prompt, and the
    // client re-sends it to request the first reply).
    upsertIncomingMessage(stored, { trigger, incomingMessages })

    return stored
  },

  // First message of a game: create and seed its sandbox before streaming, so
  // the first tool call finds it ready. Tools fall back to creating one if
  // this fails.
  onChatStart: async ({ chatId }) => {
    try {
      await createGameSandbox(chatId)
    } catch (error) {
      log.error("Could not create sandbox on chat start", {
        "game.id": chatId,
        ...errorFields(error),
      })
    }
  },

  onTurnStart: async ({ chatId, uiMessages }) => {
    // Persist before the turn runs: when this turn answers an ask_player
    // question, the answer only exists in `uiMessages` until now, and a build
    // can run for minutes.
    await saveMessages(chatId, uiMessages)

    const orgId = await loadOrgId(chatId)

    if (orgId && !(await canStartTurn(orgId))) {
      log.info("Refused turn: out of credits", {
        "game.id": chatId,
        "organization.id": orgId,
      })

      // Becomes an error chunk the player reads in the thread; the session
      // stays open so they can continue after topping up.
      throw new Error(OUT_OF_CREDITS)
    }
  },

  onTurnComplete: async ({
    chatId,
    uiMessages,
    chatAccessToken,
    lastEventId,
    clientData,
  }) => {
    const start = performance.now()

    await saveTurn({
      gameId: chatId,
      messages: uiMessages,
      chatAccessToken,
      chatLastEventId: lastEventId,
    })

    log.info("Turn complete", {
      "game.id": chatId,
      "model.id": clientData?.modelId ?? DEFAULT_MODEL_ID,
      "chat.messages": uiMessages.length,
      duration_ms: since(start),
    })
  },

  // Built per chat so every file tool is bound to this game's sandbox. Also
  // declared here (not only passed to streamText) so history from earlier
  // turns converts with the same tool set.
  tools: ({ chatId }) => createGameTools(chatId),

  run: async ({ messages, tools, signal, clientData, chatId }) => {
    // Nothing to answer: the thread already ends on the agent's own reply
    // (e.g. a double submit). Current Claude models reject assistant prefill,
    // so end quietly instead of failing at the provider.
    if (messages.at(-1)?.role === "assistant") {
      return
    }

    const modelId = clientData?.modelId ?? DEFAULT_MODEL_ID
    const orgId = await loadOrgId(chatId)

    return streamText({
      // Spread first so the options below win; it wires up the SDK's
      // prepareStep (compaction, steering, background injection).
      ...chat.toStreamTextOptions({ tools }),
      ...modelSettings(modelId),
      instructions: systemPrompt,
      messages,
      abortSignal: signal,
      stopWhen: stepCountIs(MAX_STEPS),
      // Bill per step, so a long build charges as it goes and a stopped or
      // crashed turn still pays for the work it did.
      onStepEnd: async ({ usage, response }) => {
        if (!orgId) return

        try {
          await chargeStep({
            orgId,
            responseId: response.id,
            amount: priceStep(modelId, usage),
            modelId,
          })
        } catch (error) {
          // Never fail a build halfway because of a ledger write.
          log.error("Could not charge step", {
            "game.id": chatId,
            "organization.id": orgId,
            ...errorFields(error),
          })
        }
      },
    })
  },
})
