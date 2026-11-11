import { describe, expect, it } from "vitest"

import { GAME_DIR, resolveGamePath, toGamePath, ToolInputError } from "@/lib/agent/paths"

describe("resolveGamePath", () => {
  it("resolves relative paths inside the game directory", () => {
    expect(resolveGamePath("index.html")).toBe(`${GAME_DIR}/index.html`)
    expect(resolveGamePath("src/player.js")).toBe(`${GAME_DIR}/src/player.js`)
    expect(resolveGamePath("./src/../main.js")).toBe(`${GAME_DIR}/main.js`)
  })

  it("refuses paths that escape the game directory", () => {
    expect(() => resolveGamePath("../secret")).toThrow(ToolInputError)
    expect(() => resolveGamePath("src/../../etc/passwd")).toThrow(ToolInputError)
    expect(() => resolveGamePath("/etc/passwd")).toThrow(ToolInputError)
  })

  it("refuses unusual characters and empty paths", () => {
    expect(() => resolveGamePath("")).toThrow(ToolInputError)
    expect(() => resolveGamePath("  ")).toThrow(ToolInputError)
    expect(() => resolveGamePath("a b.js")).toThrow(ToolInputError)
    expect(() => resolveGamePath("$(rm -rf).js")).toThrow(ToolInputError)
    expect(() => resolveGamePath("x';touch y;'.js")).toThrow(ToolInputError)
  })

  it("only allows the root itself when asked", () => {
    expect(() => resolveGamePath(".")).toThrow(ToolInputError)
    expect(resolveGamePath(".", { allowRoot: true })).toBe(GAME_DIR)
  })

  it("accepts an absolute path that is inside the game directory", () => {
    expect(resolveGamePath(`${GAME_DIR}/main.js`)).toBe(`${GAME_DIR}/main.js`)
  })

  it("does not treat a sibling directory with the same prefix as inside", () => {
    expect(() => resolveGamePath(`${GAME_DIR}-evil/x.js`)).toThrow(ToolInputError)
  })
})

describe("toGamePath", () => {
  it("strips the game directory", () => {
    expect(toGamePath(`${GAME_DIR}/src/a.js`)).toBe("src/a.js")
    expect(toGamePath(GAME_DIR)).toBe(".")
  })
})
