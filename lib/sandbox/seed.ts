import { readdir } from "node:fs/promises"
import path from "node:path"

import type { FileUpload } from "@daytona/sdk"

/**
 * The starter files copied into every new sandbox: the placeholder page, the
 * error reporter the preview talks to, and the three.js engine toolkit.
 *
 * Read from disk at runtime, so `trigger.config.ts` copies the folder into the
 * worker deployment with `additionalFiles`.
 */
const RUNTIME_DIR = path.join(process.cwd(), "game-runtime")

export async function readSeedFiles(destination: string): Promise<{
  folders: string[]
  files: FileUpload[]
}> {
  const entries = await readdir(RUNTIME_DIR, { recursive: true, withFileTypes: true })
  const folders: string[] = []
  const files: FileUpload[] = []

  for (const entry of entries) {
    const source = path.join(entry.parentPath, entry.name)
    const target = path.posix.join(
      destination,
      ...path.relative(RUNTIME_DIR, source).split(path.sep)
    )

    if (entry.isDirectory()) {
      folders.push(target)
    } else if (entry.isFile()) {
      files.push({ source, destination: target })
    }
  }

  // Parents before children: an upload does not create missing directories.
  folders.sort((a, b) => a.length - b.length)

  return { folders, files }
}
