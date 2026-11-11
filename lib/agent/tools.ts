import path from "node:path"

import type { FileInfo, Sandbox } from "@daytona/sdk"
import { tool } from "ai"
import { z } from "zod"

import { GAME_DIR, resolveGamePath, toGamePath, ToolInputError } from "@/lib/agent/paths"
import { errorFields, log, since } from "@/lib/log"
import { getGameSandbox } from "@/lib/sandbox/game-sandbox"

/** Per-file cap. Keeps reads cheap and nudges the agent toward small modules. */
export const MAX_FILE_BYTES = 128_000

export const ASK_PLAYER = "ask_player"

export const QUESTION_TOPICS = [
  "loop",
  "goal",
  "challenge",
  "controls",
  "world",
  "look",
  "feel",
] as const

/**
 * A design question for the player, answered with buttons in the chat.
 *
 * It has no `execute`: the call ends the turn with the result pending, the
 * player picks an option, and the client sends the answer back as the tool
 * output, which starts the next turn. The run is suspended while it waits.
 */
const askPlayer = tool({
  description:
    "Ask the player one multiple-choice design question and wait for the answer. Use it to settle what the game is before building it. One question per call; ask the next one after the answer arrives.",
  inputSchema: z.object({
    topic: z
      .enum(QUESTION_TOPICS)
      .describe(
        "Which part of the game this decides: loop (the repeated action), goal (win/lose/score), challenge (what pushes back), controls, world (setting and layout), look (art direction), feel (pace, juice, sound)."
      ),
    question: z.string().describe("One short sentence, in the player's terms."),
    options: z
      .array(
        z.object({
          id: z.string().describe('Short unique lowercase id, e.g. "twin-stick".'),
          label: z.string().describe("A few words, like a button."),
          description: z
            .string()
            .describe("One sentence on what this choice means for the game."),
        })
      )
      .min(2)
      .max(4)
      .describe("2-4 genuinely different options, each one you would be happy to build."),
  }),
  outputSchema: z.object({
    optionId: z.string(),
    label: z.string(),
  }),
})

/**
 * The agent's toolset for one game.
 *
 * The game id is closed over rather than passed by the model, so a tool can
 * only ever touch this game's sandbox. Recoverable mistakes (a missing file, an
 * ambiguous edit, a path outside the game) come back as plain results the model
 * reads and corrects; infrastructure failures throw and end the turn.
 */
export function createGameTools(gameId: string) {
  let sandboxPromise: Promise<Sandbox> | undefined

  const sandbox = () => {
    sandboxPromise ??= getGameSandbox(gameId).catch((error: unknown) => {
      sandboxPromise = undefined
      throw error
    })

    return sandboxPromise
  }

  const pathArg = z
    .string()
    .describe(
      'Path relative to the game directory, e.g. "index.html" or "src/player.js".'
    )

  return {
    list_files: tool({
      description:
        "List files in the game directory with their sizes. Start every turn with this to see what exists.",
      inputSchema: z.object({
        path: z
          .string()
          .optional()
          .describe("Subdirectory to list. Defaults to the whole game."),
      }),
      execute: ({ path: input }) =>
        run("list_files", gameId, input, async () => {
          const target = resolveGamePath(input ?? ".", { allowRoot: true })
          const box = await sandbox()

          if (target !== GAME_DIR && !(await stat(box, target))) {
            return `No directory at ${toGamePath(target)}.`
          }

          const entries = await box.fs.listFiles(target, { depth: 5 })
          const lines = entries
            .filter((entry) => !entry.isDir)
            .map((entry) => {
              const full = entry.path ?? path.posix.join(target, entry.name)
              return `${toGamePath(full)} (${entry.size} bytes)`
            })
            .sort()

          return lines.length > 0 ? lines.join("\n") : "The directory is empty."
        }),
    }),

    read_file: tool({
      description:
        "Read a file from the game directory. Always read a file before editing it: what is on disk is what the player is running.",
      inputSchema: z.object({ path: pathArg }),
      execute: ({ path: input }) =>
        run("read_file", gameId, input, async () => {
          const target = resolveGamePath(input)
          const box = await sandbox()
          const info = await stat(box, target)

          if (!info) return `No file at ${toGamePath(target)}.`
          if (info.isDir) return `${toGamePath(target)} is a directory. Use list_files.`
          if (info.size > MAX_FILE_BYTES) {
            return `${toGamePath(target)} is ${info.size} bytes, over the ${MAX_FILE_BYTES} byte limit. Split it into smaller modules.`
          }

          return (await box.fs.downloadFile(target)).toString("utf8")
        }),
    }),

    write_file: tool({
      description:
        "Create a file or replace its entire contents. Parent folders are created automatically. For changes to part of an existing file, use edit_file.",
      inputSchema: z.object({
        path: pathArg,
        content: z.string().describe("The complete file contents."),
      }),
      execute: ({ path: input, content }) =>
        run("write_file", gameId, input, async () => {
          const target = resolveGamePath(input)

          if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
            throw new ToolInputError(
              `That content is over the ${MAX_FILE_BYTES} byte limit. Split it into smaller modules.`
            )
          }

          const box = await sandbox()
          const directory = path.posix.dirname(target)

          if (directory !== GAME_DIR) {
            await box.process.executeCommand(`mkdir -p '${directory}'`)
          }

          await box.fs.uploadFile(Buffer.from(content, "utf8"), target)

          return `Wrote ${toGamePath(target)} (${content.split("\n").length} lines).`
        }),
    }),

    edit_file: tool({
      description:
        "Replace an exact snippet in an existing file. Prefer this over write_file for targeted changes so the rest of the file stays untouched.",
      inputSchema: z.object({
        path: pathArg,
        find: z
          .string()
          .describe(
            "Exact text to replace, including whitespace. Must occur exactly once unless replace_all is true; include surrounding lines to make it unique."
          ),
        replace: z
          .string()
          .describe("Replacement text. Empty string deletes the snippet."),
        replace_all: z
          .boolean()
          .optional()
          .describe("Replace every occurrence (for renames)."),
      }),
      execute: ({ path: input, find, replace, replace_all: replaceAll }) =>
        run("edit_file", gameId, input, async () => {
          const target = resolveGamePath(input)

          if (find === "") throw new ToolInputError("find cannot be empty.")

          const box = await sandbox()
          const info = await stat(box, target)

          if (!info || info.isDir) return `No file at ${toGamePath(target)}.`

          const content = (await box.fs.downloadFile(target)).toString("utf8")
          const count = content.split(find).length - 1

          if (count === 0) {
            return `That text is not in ${toGamePath(target)}. Read the file and copy the snippet exactly.`
          }

          if (count > 1 && !replaceAll) {
            return `That text occurs ${count} times in ${toGamePath(target)}. Add surrounding lines to make it unique, or set replace_all.`
          }

          const updated = replaceAll
            ? content.split(find).join(replace)
            : content.replace(find, () => replace)

          await box.fs.uploadFile(Buffer.from(updated, "utf8"), target)

          return `Edited ${toGamePath(target)} (${count} replacement${count === 1 ? "" : "s"}).`
        }),
    }),

    delete_file: tool({
      description:
        "Delete a file or folder the game no longer uses. Never delete index.html, report.js or engine/.",
      inputSchema: z.object({ path: pathArg }),
      execute: ({ path: input }) =>
        run("delete_file", gameId, input, async () => {
          const target = resolveGamePath(input)
          const box = await sandbox()
          const info = await stat(box, target)

          if (!info) return `No file at ${toGamePath(target)}.`

          await box.fs.deleteFile(target, info.isDir)

          return `Deleted ${toGamePath(target)}.`
        }),
    }),

    [ASK_PLAYER]: askPlayer,
  }
}

export type GameTools = ReturnType<typeof createGameTools>

/** Runs one tool call: turns `ToolInputError` into a result and logs the call. */
async function run(
  name: string,
  gameId: string,
  target: string | undefined,
  body: () => Promise<string>
): Promise<string> {
  const start = performance.now()
  const fields = { "tool.name": name, "game.id": gameId, "tool.path": target }

  try {
    const result = await body()
    log.info("Tool call", { ...fields, duration_ms: since(start) })
    return result
  } catch (error) {
    if (error instanceof ToolInputError) {
      log.warn("Tool call refused", { ...fields, "tool.refusal": error.message })
      return error.message
    }

    log.error("Tool call failed", {
      ...fields,
      ...errorFields(error),
      duration_ms: since(start),
    })
    throw error
  }
}

/** File metadata, or null when nothing is at the path. */
async function stat(sandbox: Sandbox, fullPath: string): Promise<FileInfo | null> {
  try {
    return await sandbox.fs.getFileDetails(fullPath)
  } catch {
    return null
  }
}
