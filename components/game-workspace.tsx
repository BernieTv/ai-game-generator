"use client"

import type { ChatSessionPersistedState } from "@trigger.dev/sdk/chat"
import type { UIMessage } from "ai"
import { Gamepad2Icon, MessageSquareIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"

import { ChatThread, type PreviewError } from "@/components/chat-thread"
import { GamePreview } from "@/components/game-preview"
import type { GameModelId } from "@/lib/agent/models"
import { cn } from "@/lib/utils"

/**
 * Chat and live preview side by side, with a draggable divider on desktop and
 * tabs on small screens.
 *
 * The thread stays mounted in the same place throughout: remounting it would
 * rebuild `useChat` from stale server props and re-request a reply the agent
 * already gave.
 */
export function GameWorkspace({
  gameId,
  initialMessages,
  initialModelId,
  initialSession,
  hasSandbox: initiallyHasSandbox,
  outOfCredits,
}: {
  gameId: string
  initialMessages: UIMessage[]
  initialModelId: GameModelId
  initialSession?: ChatSessionPersistedState
  hasSandbox: boolean
  outOfCredits: boolean
}) {
  const router = useRouter()
  const [revision, setRevision] = useState(0)
  const [hasSandbox, setHasSandbox] = useState(initiallyHasSandbox)
  const [previewErrors, setPreviewErrors] = useState<PreviewError[]>([])
  const [tab, setTab] = useState<"chat" | "game">("chat")
  const [split, setSplit] = useState(40)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleTurnComplete = useCallback(() => {
    setRevision((value) => value + 1)
    setHasSandbox(true)
    // Refresh server components so the sidebar's credit balance updates.
    router.refresh()
  }, [router])

  const startDrag = (event: React.PointerEvent) => {
    const container = containerRef.current
    if (!container) return

    event.preventDefault()
    const rect = container.getBoundingClientRect()

    const onMove = (move: PointerEvent) => {
      const percent = ((move.clientX - rect.left) / rect.width) * 100
      setSplit(Math.min(70, Math.max(25, percent)))
    }
    const onUp = () => {
      document.removeEventListener("pointermove", onMove)
      document.removeEventListener("pointerup", onUp)
      document.body.style.removeProperty("user-select")
    }

    document.body.style.userSelect = "none"
    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {hasSandbox && (
        <div className="flex shrink-0 border-b md:hidden" role="tablist">
          {(
            [
              ["chat", "Chat", MessageSquareIcon],
              ["game", "Game", Gamepad2Icon],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 border-b-2 border-transparent py-2 text-sm text-muted-foreground",
                tab === value && "border-primary font-medium text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
              {value === "game" && previewErrors.length > 0 && (
                <span className="size-2 rounded-full bg-amber-500" />
              )}
            </button>
          ))}
        </div>
      )}

      <div ref={containerRef} className="flex min-h-0 flex-1">
        <section
          aria-label="Chat"
          className={cn(
            "min-h-0 min-w-0 flex-1 md:flex-none",
            hasSandbox && tab !== "chat" && "hidden md:block"
          )}
          style={hasSandbox ? { flexBasis: `${split}%` } : { flexBasis: "100%" }}
        >
          <ChatThread
            gameId={gameId}
            initialMessages={initialMessages}
            initialModelId={initialModelId}
            initialSession={initialSession}
            outOfCredits={outOfCredits}
            previewErrors={previewErrors}
            onTurnComplete={handleTurnComplete}
          />
        </section>

        {hasSandbox && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panels"
              onPointerDown={startDrag}
              className="group relative hidden w-px cursor-col-resize bg-border md:block"
            >
              <span className="absolute inset-y-0 -right-1.5 -left-1.5 group-hover:bg-primary/20" />
            </div>
            <section
              aria-label="Game preview"
              className={cn(
                "min-h-0 min-w-0 flex-1",
                tab !== "game" && "hidden md:block"
              )}
            >
              <GamePreview
                gameId={gameId}
                revision={revision}
                onErrors={setPreviewErrors}
              />
            </section>
          </>
        )}
      </div>
    </div>
  )
}
