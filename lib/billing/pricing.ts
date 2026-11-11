import type { LanguageModelUsage } from "ai"

import type { GameModelId } from "@/lib/agent/models"

/**
 * Anthropic list prices in USD per million tokens.
 * Cache writes use the 5-minute TTL rate (1.25x input).
 */
type Rates = { input: number; cacheRead: number; cacheWrite: number; output: number }

export const MODEL_RATES = {
  "claude-opus-5-5": { input: 4, cacheRead: 0.2, cacheWrite: 5, output: 20 },
  "claude-sonnet-5-5": { input: 2, cacheRead: 0.1, cacheWrite: 2.5, output: 10 },
  "claude-haiku-5-5": { input: 0.1, cacheRead: 0.01, cacheWrite: 0.125, output: 0.5 },
} satisfies Record<GameModelId, Rates>

const MICROS_PER_DOLLAR = 1_000_000

/** A $/MTok rate as micro-dollars per million tokens, an exact integer. */
function micros(dollarsPerMillion: number): bigint {
  return BigInt(Math.round(dollarsPerMillion * MICROS_PER_DOLLAR))
}

function tokens(count: number | undefined): bigint {
  return count && count > 0 ? BigInt(Math.floor(count)) : 0n
}

/**
 * The cost of one model step in micro-dollars, rounded up so the ledger never
 * undercharges.
 *
 * Providers that do not report a cache breakdown only give `inputTokens`; in
 * that case every input token is priced at the uncached rate.
 */
export function priceStep(modelId: GameModelId, usage: LanguageModelUsage): bigint {
  const rates = MODEL_RATES[modelId]
  const details = usage.inputTokenDetails
  const hasBreakdown =
    details?.noCacheTokens !== undefined ||
    details?.cacheReadTokens !== undefined ||
    details?.cacheWriteTokens !== undefined

  const fresh = hasBreakdown ? tokens(details?.noCacheTokens) : tokens(usage.inputTokens)

  const total =
    fresh * micros(rates.input) +
    tokens(details?.cacheReadTokens) * micros(rates.cacheRead) +
    tokens(details?.cacheWriteTokens) * micros(rates.cacheWrite) +
    tokens(usage.outputTokens) * micros(rates.output)

  const perMillion = 1_000_000n

  return (total + perMillion - 1n) / perMillion
}
