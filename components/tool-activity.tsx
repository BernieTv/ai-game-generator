import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"

import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

const VERBS: Record<string, [active: string, done: string]> = {
  list_files: ["Looking at files", "Looked at files"],
  read_file: ["Reading", "Read"],
  write_file: ["Writing", "Wrote"],
  edit_file: ["Editing", "Edited"],
  delete_file: ["Deleting", "Deleted"],
}

export type ToolState =
  | "input-streaming"
  | "input-available"
  | "approval-requested"
  | "approval-responded"
  | "output-available"
  | "output-error"
  | "output-denied"

function status(state: ToolState) {
  if (state === "output-available") return "done"
  if (state === "output-error" || state === "output-denied") return "failed"
  return "active"
}

function targetOf(input: unknown): string | undefined {
  if (typeof input !== "object" || input === null) return undefined
  const { path } = input as { path?: unknown }
  return typeof path === "string" && path !== "." ? path : undefined
}

/** One line per file operation: what the agent is doing to the game. */
export function ToolActivity({
  name,
  state,
  input,
  errorText,
}: {
  name: string
  state: ToolState
  input: unknown
  errorText?: string
}) {
  const current = status(state)
  const [active, done] = VERBS[name] ?? ["Working", "Done"]
  const target = targetOf(input)

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-muted-foreground",
        current === "failed" && "text-destructive"
      )}
      title={errorText}
    >
      {current === "active" ? (
        <Spinner className="size-3.5" />
      ) : current === "done" ? (
        <CircleCheckIcon className="size-3.5 text-success" />
      ) : (
        <CircleAlertIcon className="size-3.5" />
      )}
      <span>
        {current === "active" ? active : done}
        {target && (
          <code className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-foreground">
            {target}
          </code>
        )}
        {current === "failed" && " (failed)"}
      </span>
    </div>
  )
}
