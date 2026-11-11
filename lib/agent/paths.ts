import path from "node:path"

/** Where a game's files live inside its sandbox; also what the preview serves. */
export const GAME_DIR = "/home/daytona/game"

const SAFE_PATH = /^[a-zA-Z0-9._/-]+$/

/**
 * A mistake the model can fix by calling the tool differently. Tools return the
 * message as their result instead of failing the turn.
 */
export class ToolInputError extends Error {}

/**
 * Resolves a model-supplied path to an absolute path inside `GAME_DIR`.
 *
 * This is the sandbox boundary for every file tool: absolute paths, `..`
 * climbs and unusual characters are all refused here, before anything reaches
 * the sandbox.
 */
export function resolveGamePath(
  input: string,
  options: { allowRoot?: boolean } = {}
): string {
  const trimmed = input.trim()

  if (trimmed === "") {
    throw new ToolInputError("path cannot be empty.")
  }

  if (!SAFE_PATH.test(trimmed)) {
    throw new ToolInputError(
      `"${trimmed}" is not a usable path. Use letters, digits, dots, dashes, underscores and slashes only.`
    )
  }

  const resolved = path.posix.resolve(GAME_DIR, trimmed)

  if (resolved !== GAME_DIR && !resolved.startsWith(`${GAME_DIR}/`)) {
    throw new ToolInputError(
      `"${trimmed}" is outside the game directory. Paths are relative to the game directory and must stay inside it.`
    )
  }

  if (resolved === GAME_DIR && !options.allowRoot) {
    throw new ToolInputError("That is the game directory itself. Name a file inside it.")
  }

  return resolved
}

/** A sandbox path as the model sees it: relative to the game directory. */
export function toGamePath(fullPath: string): string {
  return path.posix.relative(GAME_DIR, fullPath) || "."
}
