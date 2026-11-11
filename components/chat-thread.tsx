"use client"

import { useChat } from "@ai-sdk/react"
import type { ChatSessionPersistedState } from "@trigger.dev/sdk/chat"
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react"
import {
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
  type UIMessageChunk,
} from "ai"
import { ArrowDownIcon, ArrowUpIcon, BugIcon, SquareIcon } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { LogoMark } from "@/components/logo"
import { ModelPicker } from "@/components/model-picker"
import { parseQuestion, QuestionCard } from "@/components/question-card"
import { ToolActivity } from "@/components/tool-activity"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { GameModelId } from "@/lib/agent/models"
import { mintGameSessionToken, startGameSession } from "@/lib/games/chat-actions"
import { cn } from "@/lib/utils"
import type { gameAgent } from "@/trigger/game-agent"

const ASK_PLAYER = "ask_player"

export type PreviewError = {
  message: string
  source?: string
  line?: number
  column?: number
}

/**
 * The conversation with the builder agent.
 *
 * Messages stream over a Trigger.dev session rather than an HTTP route: the
 * transport starts (or rejoins) the game's session through a server action,
 * refreshes its token through another, and resumes a live stream after a
 * reload from the cursor stored on the game row.
 */
export function ChatThread({
  gameId,
  initialMessages,
  initialModelId,
  initialSession,
  outOfCredits,
  previewErrors,
  onTurnComplete,
}: {
  gameId: string
  initialMessages: UIMessage[]
  initialModelId: GameModelId
  initialSession?: ChatSessionPersistedState
  outOfCredits: boolean
  previewErrors: PreviewError[]
  onTurnComplete: () => void
}) {
  const [draft, setDraft] = useState("")
  const [modelId, setModelId] = useState<GameModelId>(initialModelId)
  const clientData = useMemo(() => ({ modelId }), [modelId])

  const transport = useTriggerChatTransport<typeof gameAgent>({
    task: "game-agent",
    accessToken: ({ chatId }) => mintGameSessionToken(chatId),
    startSession: ({ chatId, clientData }) => startGameSession({ chatId, clientData }),
    clientData,
    sessions: initialSession ? { [gameId]: initialSession } : undefined,
  })

  // When the page loads on a thread that already ends in a finished assistant
  // reply, a resumed stream can open with a `start` chunk for that same
  // message, which would reset it on screen. Drop just that chunk.
  const [resumedMessageId] = useState(() => {
    const last = initialMessages.at(-1)
    return last?.role === "assistant" ? last.id : undefined
  })

  const chatTransport = useMemo(
    () => ({
      sendMessages: transport.sendMessages,
      reconnectToStream: async (
        options: Parameters<typeof transport.reconnectToStream>[0]
      ) => {
        const stream = await transport.reconnectToStream(options)
        return stream && resumedMessageId
          ? stream.pipeThrough(skipRestart(resumedMessageId))
          : stream
      },
    }),
    [transport, resumedMessageId]
  )

  const { messages, sendMessage, addToolOutput, stop, status, error } = useChat({
    id: gameId,
    messages: initialMessages,
    transport: chatTransport,
    // Answering ask_player completes the tool call; send it automatically so
    // the agent continues without an extra click.
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    resume: Boolean(initialSession),
    onFinish: onTurnComplete,
  })

  // A new game arrives with its opening prompt stored as the last message:
  // request the first reply exactly once.
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) return
    requested.current = true

    if (!outOfCredits && initialMessages.at(-1)?.role === "user") {
      void sendMessage()
    }
  }, [initialMessages, outOfCredits, sendMessage])

  const busy = status === "submitted" || status === "streaming"
  const waitingForAnswer = Boolean(
    messages
      .at(-1)
      ?.parts.some(
        (part) =>
          isToolUIPart(part) &&
          getToolName(part) === ASK_PLAYER &&
          part.state === "input-available"
      )
  )

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy || outOfCredits) return
    void sendMessage({ text: trimmed })
    setDraft("")
  }

  const handleStop = useCallback(() => {
    void transport.stopGeneration(gameId)
    void stop()
  }, [transport, gameId, stop])

  const fixErrors = () => {
    const details = previewErrors
      .slice(0, 5)
      .map(
        (e) =>
          `- ${e.message}${e.source ? ` (${e.source}:${e.line ?? "?"}:${e.column ?? "?"})` : ""}`
      )
      .join("\n")
    send(
      `The game preview reported these runtime errors. Please find the cause and fix them:\n${details}`
    )
  }

  const { viewportRef, atBottom, scrollToBottom } = useStickToBottom(messages)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1">
        <div ref={viewportRef} className="h-full overflow-y-auto">
          <ol className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
            {messages.map((message) => (
              <li key={message.id}>
                {message.role === "user" ? (
                  <UserMessage message={message} />
                ) : (
                  <AssistantMessage
                    message={message}
                    onAnswer={(toolCallId, option) =>
                      void addToolOutput({
                        tool: ASK_PLAYER,
                        toolCallId,
                        output: { optionId: option.id, label: option.label },
                      })
                    }
                    canAnswer={!busy && !outOfCredits}
                  />
                )}
              </li>
            ))}
            {status === "submitted" && (
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner /> Thinking…
              </li>
            )}
          </ol>
        </div>
        {!atBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            aria-label="Scroll to latest message"
            className="absolute bottom-3 left-1/2 inline-flex size-8 -translate-x-1/2 items-center justify-center rounded-full border bg-background shadow-md hover:bg-accent"
          >
            <ArrowDownIcon className="size-4" />
          </button>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-3xl shrink-0 flex-col gap-2 px-4 pb-4">
        {outOfCredits ? (
          <Notice tone="error">
            This workspace is out of credits.{" "}
            <Link
              href="/studio/billing"
              className="font-medium underline underline-offset-4"
            >
              Add credits
            </Link>{" "}
            to keep building.
          </Notice>
        ) : error ? (
          <Notice tone="error">
            {error.message || "Something went wrong. Try sending your message again."}
          </Notice>
        ) : null}

        {previewErrors.length > 0 && !busy && !outOfCredits && (
          <Notice tone="warn">
            <span className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <BugIcon className="size-4 shrink-0" />
                The game reported {previewErrors.length} runtime error
                {previewErrors.length === 1 ? "" : "s"}.
              </span>
              <Button size="sm" variant="outline" onClick={fixErrors}>
                Ask agent to fix
              </Button>
            </span>
          </Notice>
        )}

        <form
          onSubmit={(event) => {
            event.preventDefault()
            send(draft)
          }}
          className="rounded-2xl border bg-card p-2 shadow-sm focus-within:ring-[3px] focus-within:ring-ring/30"
        >
          <label htmlFor="chat-input" className="sr-only">
            Message the builder
          </label>
          <textarea
            id="chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                send(draft)
              }
            }}
            rows={2}
            placeholder={
              waitingForAnswer
                ? "Pick an option above, or type your own answer…"
                : "Ask for a change, a new level, better controls…"
            }
            disabled={outOfCredits}
            className="w-full resize-none bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between">
            <ModelPicker value={modelId} onChange={setModelId} disabled={busy} />
            {busy ? (
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                onClick={handleStop}
                aria-label="Stop"
              >
                <SquareIcon className="fill-current" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon-sm"
                disabled={!draft.trim() || outOfCredits}
                aria-label="Send"
              >
                <ArrowUpIcon />
              </Button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function UserMessage({ message }: { message: UIMessage }) {
  const text = message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")

  return (
    <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm whitespace-pre-wrap text-primary-foreground">
      {text}
    </div>
  )
}

function AssistantMessage({
  message,
  onAnswer,
  canAnswer,
}: {
  message: UIMessage
  onAnswer: (toolCallId: string, option: { id: string; label: string }) => void
  canAnswer: boolean
}) {
  return (
    <div className="flex gap-3">
      <LogoMark className="mt-0.5 size-6 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {message.parts.map((part, index) => {
          if (part.type === "text") {
            return part.text.trim() ? (
              <p key={index} className="text-sm leading-relaxed whitespace-pre-wrap">
                {part.text}
              </p>
            ) : null
          }

          if (!isToolUIPart(part)) return null

          const name = getToolName(part)

          if (name === ASK_PLAYER) {
            const question = parseQuestion(part.input)
            if (!question) return null

            const output =
              part.state === "output-available"
                ? (part.output as { label?: unknown })
                : undefined
            const answer = typeof output?.label === "string" ? output.label : undefined

            return (
              <QuestionCard
                key={part.toolCallId}
                question={question}
                answer={answer}
                onAnswer={
                  part.state === "input-available" && canAnswer
                    ? (option) => onAnswer(part.toolCallId, option)
                    : undefined
                }
              />
            )
          }

          return (
            <ToolActivity
              key={part.toolCallId}
              name={name}
              state={part.state}
              input={part.input}
              errorText={part.state === "output-error" ? part.errorText : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}

function Notice({
  tone,
  children,
}: {
  tone: "error" | "warn"
  children: React.ReactNode
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "error"
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
      )}
    >
      {children}
    </div>
  )
}

function skipRestart(messageId: string) {
  return new TransformStream<UIMessageChunk, UIMessageChunk>({
    transform(chunk, controller) {
      if (chunk.type === "start" && chunk.messageId === messageId) return
      controller.enqueue(chunk)
    },
  })
}

/** Keeps the thread pinned to the newest message unless the reader scrolled up. */
function useStickToBottom(dependency: unknown) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [atBottom, setAtBottom] = useState(true)
  const pinned = useRef(true)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onScroll = () => {
      const near = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80
      pinned.current = near
      setAtBottom(near)
    }

    viewport.addEventListener("scroll", onScroll, { passive: true })
    return () => viewport.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport && pinned.current) viewport.scrollTop = viewport.scrollHeight
  }, [dependency])

  const scrollToBottom = useCallback(() => {
    const viewport = viewportRef.current
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" })
  }, [])

  return { viewportRef, atBottom, scrollToBottom }
}
