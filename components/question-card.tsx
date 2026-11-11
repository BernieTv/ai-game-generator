"use client"

import { CircleCheckIcon, CircleHelpIcon } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type Question = {
  topic?: string
  question: string
  options: { id: string; label: string; description?: string }[]
}

/** Reads an ask_player input defensively: it may still be streaming in. */
export function parseQuestion(input: unknown): Question | undefined {
  if (typeof input !== "object" || input === null) return undefined

  const { topic, question, options } = input as Record<string, unknown>

  if (typeof question !== "string" || !Array.isArray(options)) return undefined

  const parsed = options.flatMap((option) => {
    if (typeof option !== "object" || option === null) return []
    const { id, label, description } = option as Record<string, unknown>
    if (typeof id !== "string" || typeof label !== "string") return []
    return [
      {
        id,
        label,
        description: typeof description === "string" ? description : undefined,
      },
    ]
  })

  return parsed.length > 0
    ? { topic: typeof topic === "string" ? topic : undefined, question, options: parsed }
    : undefined
}

/**
 * A design question from the agent. Active while unanswered; afterwards it
 * shows the chosen option.
 */
export function QuestionCard({
  question,
  answer,
  onAnswer,
}: {
  question: Question
  /** Label of the chosen option, once answered. */
  answer?: string
  /** Present only while the question can still be answered. */
  onAnswer?: (option: { id: string; label: string }) => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (answer !== undefined || !onAnswer) {
    return (
      <div className="w-full rounded-xl border bg-card/60 p-3 text-sm">
        <p className="text-muted-foreground">{question.question}</p>
        {answer !== undefined && (
          <p className="mt-1 flex items-center gap-1.5 font-medium">
            <CircleCheckIcon className="size-4 text-success" />
            {answer}
          </p>
        )}
      </div>
    )
  }

  const choice = question.options.find((option) => option.id === selected)

  return (
    <fieldset className="w-full rounded-xl border border-primary/40 bg-card p-4 shadow-sm">
      <legend className="sr-only">{question.question}</legend>
      <div className="flex items-start gap-2">
        <CircleHelpIcon className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          {question.topic && (
            <p className="text-xs font-medium tracking-wide text-primary uppercase">
              {question.topic}
            </p>
          )}
          <p className="font-medium">{question.question}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2">
        {question.options.map((option) => (
          <label
            key={option.id}
            className={cn(
              "flex cursor-pointer flex-col rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/60",
              selected === option.id && "border-primary bg-accent"
            )}
          >
            <input
              type="radio"
              name={`question-${question.question}`}
              value={option.id}
              checked={selected === option.id}
              onChange={() => setSelected(option.id)}
              className="sr-only"
            />
            <span className="font-medium">{option.label}</span>
            {option.description && (
              <span className="text-xs text-muted-foreground">{option.description}</span>
            )}
          </label>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          size="sm"
          disabled={!choice || submitted}
          onClick={() => {
            if (!choice) return
            setSubmitted(true)
            onAnswer({ id: choice.id, label: choice.label })
          }}
        >
          Continue
        </Button>
      </div>
    </fieldset>
  )
}
