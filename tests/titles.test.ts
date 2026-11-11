import { describe, expect, it } from "vitest"

import { titleFromPrompt, truncateTitle } from "@/lib/games/titles"

describe("titleFromPrompt", () => {
  it("drops a leading 'make a' and capitalises", () => {
    expect(titleFromPrompt("make a racing game on mars")).toBe("Racing game on mars")
  })

  it("uses only the first line", () => {
    expect(titleFromPrompt("Moth game\nwith lanterns")).toBe("Moth game")
  })

  it("falls back for empty prompts", () => {
    expect(titleFromPrompt("   ")).toBe("Untitled game")
  })

  it("truncates long prompts", () => {
    expect(titleFromPrompt("a".repeat(100))).toHaveLength(48)
  })
})

describe("truncateTitle", () => {
  it("leaves short titles alone", () => {
    expect(truncateTitle("Short")).toBe("Short")
  })

  it("adds an ellipsis when cut", () => {
    expect(truncateTitle("abcdefghij", 5)).toBe("abcd…")
  })
})
