"use client"

import { ArrowUpIcon, SparklesIcon } from "lucide-react"
import { useState, useTransition } from "react"

import { ModelPicker } from "@/components/model-picker"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { DEFAULT_MODEL_ID, type GameModelId } from "@/lib/agent/models"
import { createGame } from "@/lib/games/actions"
import { GAME_IDEAS } from "@/lib/games/ideas"

export function NewGameComposer({ outOfCredits }: { outOfCredits: boolean }) {
  const [prompt, setPrompt] = useState("")
  const [modelId, setModelId] = useState<GameModelId>(DEFAULT_MODEL_ID)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const canSubmit = prompt.trim().length >= 3 && !pending && !outOfCredits

  function submit() {
    if (!canSubmit) return

    setError(null)
    startTransition(async () => {
      try {
        // Redirects to the new game on success.
        await createGame(prompt, modelId)
      } catch {
        setError("Could not create the game. Please try again.")
      }
    })
  }

  return (
    <div className="flex w-full flex-col gap-5">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
        className="rounded-2xl border bg-card p-2 shadow-lg shadow-primary/5 transition-shadow focus-within:ring-[3px] focus-within:ring-ring/30"
      >
        <label htmlFor="new-game-prompt" className="sr-only">
          Describe your game
        </label>
        <textarea
          id="new-game-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault()
              submit()
            }
          }}
          placeholder="A game about a moth drifting toward a lantern…"
          rows={3}
          maxLength={4000}
          autoFocus
          disabled={pending}
          className="w-full resize-none bg-transparent px-3 py-2 text-base outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-2">
          <ModelPicker value={modelId} onChange={setModelId} disabled={pending} />
          <Button
            type="submit"
            size="icon-sm"
            disabled={!canSubmit}
            aria-label="Create game"
          >
            {pending ? <Spinner /> : <ArrowUpIcon />}
          </Button>
        </div>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {outOfCredits && (
        <p className="text-sm text-destructive">
          This workspace is out of credits. Add more on the Billing page to start a new
          game.
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-2">
        {GAME_IDEAS.map((idea) => (
          <button
            key={idea.label}
            type="button"
            onClick={() => setPrompt(idea.prompt)}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            <SparklesIcon className="size-3 text-primary" />
            {idea.label}
          </button>
        ))}
      </div>
    </div>
  )
}
