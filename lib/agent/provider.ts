import { anthropic } from "@ai-sdk/anthropic"

import type { GameModelId } from "@/lib/agent/models"

/**
 * Per-model `streamText` settings. Server-only in practice (the provider reads
 * ANTHROPIC_API_KEY), but without a `server-only` marker because the
 * Trigger.dev worker imports it.
 *
 * Building a game is long-horizon agentic coding, so the large models run at
 * high effort; Haiku is used for small tweaks and keeps its default.
 */
export function modelSettings(modelId: GameModelId) {
  switch (modelId) {
    case "claude-opus-5-5":
    case "claude-sonnet-5-5":
      return {
        model: anthropic(modelId),
        providerOptions: { anthropic: { effort: "high" as const } },
      }
    case "claude-haiku-5-5":
      return { model: anthropic(modelId) }
  }
}
