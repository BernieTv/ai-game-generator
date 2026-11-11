"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

/** A small accessible dropdown menu: click to open, Escape or outside click to close. */
export function Menu({
  trigger,
  label,
  align = "end",
  children,
}: {
  trigger: React.ReactNode
  label: string
  align?: "start" | "end"
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("pointerdown", onPointer)
    document.addEventListener("keydown", onKey)

    return () => {
      document.removeEventListener("pointerdown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {trigger}
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "absolute top-full z-50 mt-1 min-w-44 animate-in rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg fade-in-0 zoom-in-95",
            align === "end" ? "right-0" : "left-0"
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({
  className,
  destructive,
  ...props
}: React.ComponentProps<"button"> & { destructive?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent [&_svg]:size-4",
        destructive && "text-destructive hover:bg-destructive/10",
        className
      )}
      {...props}
    />
  )
}
