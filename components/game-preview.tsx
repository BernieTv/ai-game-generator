"use client"

import {
  ExternalLinkIcon,
  MaximizeIcon,
  RotateCwIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import type { PreviewError } from "@/components/chat-thread"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

type State =
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "error"; message: string }

/**
 * The running game, in a sandboxed iframe pointed at the game's Daytona preview
 * URL. Reloads whenever `revision` changes (once per finished agent turn) and
 * relays runtime errors that the seeded report.js posts from inside the game.
 */
export function GamePreview({
  gameId,
  revision,
  onErrors,
}: {
  gameId: string
  revision: number
  onErrors: (errors: PreviewError[]) => void
}) {
  const [state, setState] = useState<State>({ kind: "loading" })
  const [frameKey, setFrameKey] = useState(0)
  const [frameLoading, setFrameLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const errorsRef = useRef<PreviewError[]>([])

  const resetErrors = useCallback(() => {
    errorsRef.current = []
    onErrors([])
  }, [onErrors])

  // Fetch (and so wake up) the preview server whenever a turn finishes.
  useEffect(() => {
    let cancelled = false

    async function load() {
      setState({ kind: "loading" })

      try {
        const response = await fetch(`/api/games/${gameId}/preview`, {
          cache: "no-store",
        })
        const body = (await response.json()) as { url?: string; error?: string }

        if (cancelled) return

        if (!response.ok || !body.url) {
          setState({
            kind: "error",
            message: body.error ?? "The preview is not available yet.",
          })
          return
        }

        resetErrors()
        setFrameLoading(true)
        setFrameKey((key) => key + 1)
        setState({ kind: "ready", url: body.url })
      } catch {
        if (!cancelled)
          setState({ kind: "error", message: "Could not reach the preview server." })
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [gameId, revision, attempt, resetErrors])

  // Errors reported from inside the game. Only messages from our own iframe
  // are trusted; the origin is the sandbox's and changes per game.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return

      const data = event.data as {
        type?: string
        error?: PreviewError
        errors?: PreviewError[]
      }

      if (
        data?.type === "playforge:error" &&
        data.error &&
        errorsRef.current.length < 10
      ) {
        errorsRef.current = [...errorsRef.current, data.error]
        onErrors(errorsRef.current)
      }

      if (
        data?.type === "playforge:status" &&
        Array.isArray(data.errors) &&
        data.errors.length > 0
      ) {
        errorsRef.current = data.errors.slice(0, 10)
        onErrors(errorsRef.current)
      }
    }

    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [onErrors])

  const reload = () => {
    resetErrors()
    setFrameLoading(true)
    setFrameKey((key) => key + 1)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-muted/30">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b px-3">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span
            className={
              state.kind === "ready" && !frameLoading
                ? "size-2 rounded-full bg-success"
                : "size-2 rounded-full bg-amber-400"
            }
          />
          Live preview
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={reload}
            disabled={state.kind !== "ready"}
            aria-label="Restart game"
          >
            <RotateCwIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void frameRef.current?.requestFullscreen?.()}
            disabled={state.kind !== "ready"}
            aria-label="Fullscreen"
          >
            <MaximizeIcon />
          </Button>
          {state.kind === "ready" && (
            <a
              href={state.url}
              target="_blank"
              rel="noreferrer"
              aria-label="Open in new tab"
              className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-accent [&_svg]:size-4"
            >
              <ExternalLinkIcon />
            </a>
          )}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-black">
        {state.kind === "ready" && (
          <iframe
            key={frameKey}
            ref={frameRef}
            src={state.url}
            title="Game preview"
            onLoad={() => {
              setFrameLoading(false)
              frameRef.current?.contentWindow?.postMessage(
                { type: "playforge:ping" },
                "*"
              )
            }}
            allow="fullscreen; gamepad; autoplay"
            sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-popups"
            className="absolute inset-0 size-full border-0"
          />
        )}

        {(state.kind === "loading" || (state.kind === "ready" && frameLoading)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/80 text-sm text-muted-foreground">
            <Spinner className="size-6" />
            Starting your game…
          </div>
        )}

        {state.kind === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-6 text-center text-sm">
            <TriangleAlertIcon className="size-6 text-amber-500" />
            <p className="max-w-xs text-muted-foreground">{state.message}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
