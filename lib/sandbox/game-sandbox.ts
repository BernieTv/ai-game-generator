import type { Sandbox } from "@daytona/sdk"
import { eq } from "drizzle-orm"

import { GAME_DIR } from "@/lib/agent/paths"
import { db, games } from "@/lib/db/client"
import { errorFields, log, since } from "@/lib/log"
import { daytona } from "@/lib/sandbox/daytona"
import { readSeedFiles } from "@/lib/sandbox/seed"

export const PREVIEW_PORT = 3000
export const PREVIEW_URL_TTL_SECONDS = 60 * 60

/** Idle sandboxes stop after this many minutes and restart on demand. */
const AUTO_STOP_MINUTES = 20

const SERVER_LOG = "/tmp/playforge-server.log"

/**
 * Creates a game's sandbox, seeds it, and records it on the game row.
 *
 * The id is saved last, so a row with a `sandboxId` always points at a seeded
 * sandbox. A crash in between leaves an orphan, which `deleteGameSandboxes`
 * still finds through the `gameId` label.
 */
export async function createGameSandbox(gameId: string): Promise<Sandbox> {
  const start = performance.now()
  const { folders, files } = await readSeedFiles(GAME_DIR)

  const sandbox = await daytona().create({
    labels: { app: "playforge", gameId },
    autoStopInterval: AUTO_STOP_MINUTES,
  })

  await sandbox.fs.createFolder(GAME_DIR, "755")

  for (const folder of folders) {
    await sandbox.fs.createFolder(folder, "755")
  }

  await sandbox.fs.uploadFiles(files)
  await db.update(games).set({ sandboxId: sandbox.id }).where(eq(games.id, gameId))

  log.info("Created sandbox", {
    "game.id": gameId,
    "sandbox.id": sandbox.id,
    "sandbox.seed_files": files.length,
    duration_ms: since(start),
  })

  return sandbox
}

/**
 * The game's sandbox, created if missing and started if it stopped while idle.
 * This is the single entry point the agent's tools use.
 */
export async function getGameSandbox(gameId: string): Promise<Sandbox> {
  const [game] = await db
    .select({ sandboxId: games.sandboxId })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1)

  if (!game) {
    throw new Error(`Game ${gameId} does not exist`)
  }

  if (!game.sandboxId) {
    return createGameSandbox(gameId)
  }

  return ensureStarted(await daytona().get(game.sandboxId))
}

async function ensureStarted(sandbox: Sandbox): Promise<Sandbox> {
  if (sandbox.state !== "started") {
    const start = performance.now()

    await sandbox.start()
    log.info("Restarted idle sandbox", {
      "sandbox.id": sandbox.id,
      duration_ms: since(start),
    })
  }

  return sandbox
}

/**
 * Deletes every sandbox belonging to a game, found by label (which also catches
 * orphans) plus the id on the row. Attempts all of them before throwing, so one
 * stubborn sandbox cannot strand the others.
 */
export async function deleteGameSandboxes(gameId: string, sandboxId?: string | null) {
  const found = new Map<string, Sandbox>()

  for await (const sandbox of daytona().list({ labels: { gameId } })) {
    found.set(sandbox.id, sandbox)
  }

  if (sandboxId && !found.has(sandboxId)) {
    try {
      found.set(sandboxId, await daytona().get(sandboxId))
    } catch (error) {
      log.warn("Sandbox on game row not found", {
        "sandbox.id": sandboxId,
        ...errorFields(error),
      })
    }
  }

  const failures: string[] = []

  for (const sandbox of found.values()) {
    if (sandbox.state === "destroyed" || sandbox.state === "destroying") continue

    try {
      await daytona().delete(sandbox)
    } catch (error) {
      failures.push(sandbox.id)
      log.error("Could not delete sandbox", {
        "sandbox.id": sandbox.id,
        ...errorFields(error),
      })
    }
  }

  if (failures.length > 0) {
    throw new Error(`Could not delete ${failures.length} sandbox(es) for game ${gameId}`)
  }
}

/**
 * Makes sure the sandbox's static file server is running and returns a signed
 * preview URL for it. Signed (rather than header-authenticated) because the
 * URL is loaded in an iframe, which cannot send custom headers.
 *
 * Idempotent: an already-running server is reused.
 */
export async function getPreviewUrl(sandboxId: string): Promise<string> {
  const sandbox = await ensureStarted(await daytona().get(sandboxId))

  if (!(await serverResponds(sandbox))) {
    await sandbox.process.executeCommand(
      `nohup python3 -m http.server ${PREVIEW_PORT} --directory ${GAME_DIR} > ${SERVER_LOG} 2>&1 &`
    )

    if (!(await serverResponds(sandbox, 10))) {
      const output = (await sandbox.process.executeCommand(`tail -n 20 ${SERVER_LOG}`))
        .result
      throw new Error(`Preview server did not start: ${output.trim() || "no output"}`)
    }
  }

  const { url } = await sandbox.getSignedPreviewUrl(PREVIEW_PORT, PREVIEW_URL_TTL_SECONDS)

  return url
}

/** One exec that lets curl do the waiting inside the sandbox. */
async function serverResponds(sandbox: Sandbox, retries = 0): Promise<boolean> {
  const { exitCode } = await sandbox.process.executeCommand(
    `curl -fsS -o /dev/null --max-time 2 --retry ${retries} --retry-connrefused --retry-delay 1 http://localhost:${PREVIEW_PORT}/`
  )

  return exitCode === 0
}
