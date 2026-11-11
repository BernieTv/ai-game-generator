import { enginePrompt } from "./engine"
import { sandboxPrompt } from "./sandbox"
import { workflowPrompt } from "./workflow"

/**
 * The builder agent's system prompt: process, then environment, then toolkit.
 *
 * Static on purpose, so it stays byte-identical across turns and the provider
 * can serve it from the prompt cache.
 */
export const systemPrompt = [workflowPrompt, sandboxPrompt, enginePrompt].join("\n\n")
