import { getGame } from "@/lib/games/queries"
import { errorFields, log, since } from "@/lib/log"
import { getPreviewUrl } from "@/lib/sandbox/game-sandbox"

export const dynamic = "force-dynamic"

/**
 * Wakes the game's sandbox, ensures its static server is running, and returns
 * a short-lived signed URL for the preview iframe.
 *
 * `getGame` is scoped to the caller's organization, so another workspace's
 * game (or no session at all) is a plain 404.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/games/[id]/preview">
) {
  const start = performance.now()
  const { id } = await context.params
  const game = await getGame(id)

  if (!game) {
    return Response.json({ error: "Game not found." }, { status: 404 })
  }

  if (!game.sandboxId) {
    return Response.json({ error: "The game has no sandbox yet." }, { status: 409 })
  }

  try {
    const url = await getPreviewUrl(game.sandboxId)
    log.info("Served preview URL", { "game.id": id, duration_ms: since(start) })

    return Response.json({ url }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    log.error("Preview failed", { "game.id": id, ...errorFields(error) })

    return Response.json(
      { error: "The preview could not be started. Try again in a moment." },
      { status: 502 }
    )
  }
}
