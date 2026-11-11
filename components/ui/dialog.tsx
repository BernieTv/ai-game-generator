"use client"

import { XIcon } from "lucide-react"
import { useEffect, useRef } from "react"

import { cn } from "@/lib/utils"

/**
 * A modal built on the native <dialog> element: focus trapping, Escape to
 * close and the backdrop come from the browser.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === ref.current) onOpenChange(false)
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-popover p-0 text-popover-foreground shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm",
        className
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <XIcon className="size-4" />
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  )
}
