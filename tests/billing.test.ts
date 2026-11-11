import type { LanguageModelUsage } from "ai"
import { describe, expect, it } from "vitest"

import { DOLLAR, formatCredits } from "@/lib/billing/money"
import { priceStep } from "@/lib/billing/pricing"
import { monthsBetween } from "@/lib/billing/subscription"

function usage(partial: Partial<LanguageModelUsage>): LanguageModelUsage {
  return {
    inputTokens: undefined,
    outputTokens: undefined,
    totalTokens: undefined,
    inputTokenDetails: {
      noCacheTokens: undefined,
      cacheReadTokens: undefined,
      cacheWriteTokens: undefined,
    },
    outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
    ...partial,
  } as LanguageModelUsage
}

describe("priceStep", () => {
  it("prices a million Opus output tokens at list price", () => {
    expect(priceStep("claude-opus-5-5", usage({ outputTokens: 1_000_000 }))).toBe(
      20n * DOLLAR
    )
  })

  it("prices uncached input when there is no cache breakdown", () => {
    expect(priceStep("claude-sonnet-5-5", usage({ inputTokens: 1_000_000 }))).toBe(
      2n * DOLLAR
    )
  })

  it("prices each cache class separately", () => {
    const cost = priceStep(
      "claude-opus-5-5",
      usage({
        inputTokens: 3_000_000,
        inputTokenDetails: {
          noCacheTokens: 1_000_000,
          cacheReadTokens: 1_000_000,
          cacheWriteTokens: 1_000_000,
        },
      })
    )
    // $4 fresh + $0.20 cache read + $5 cache write
    expect(cost).toBe(9_200_000n)
  })

  it("rounds fractions of a micro-dollar up", () => {
    expect(priceStep("claude-haiku-5-5", usage({ outputTokens: 1 }))).toBe(1n)
  })

  it("charges nothing for an empty step", () => {
    expect(priceStep("claude-opus-5-5", usage({}))).toBe(0n)
  })
})

describe("formatCredits", () => {
  it("formats dollars and cents", () => {
    expect(formatCredits(0n)).toBe("$0.00")
    expect(formatCredits(1_234_567n)).toBe("$1.23")
    expect(formatCredits(1_234n * DOLLAR)).toBe("$1,234.00")
  })

  it("shows overdrafts as negative", () => {
    expect(formatCredits(-50_000n)).toBe("-$0.05")
    expect(formatCredits(-1n)).toBe("$0.00")
  })
})

describe("monthsBetween", () => {
  it("counts a month once its day of month is reached", () => {
    const start = new Date(Date.UTC(2026, 0, 15))
    expect(monthsBetween(start, new Date(Date.UTC(2026, 1, 14)))).toBe(0)
    expect(monthsBetween(start, new Date(Date.UTC(2026, 1, 15)))).toBe(1)
    expect(monthsBetween(start, new Date(Date.UTC(2027, 0, 15)))).toBe(12)
  })
})
