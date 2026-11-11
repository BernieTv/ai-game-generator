import { cn } from "@/lib/utils"

/** The Playforge mark: a faceted cube with a spark, plus an optional wordmark. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <defs>
        <linearGradient id="pf-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.72 0.19 300)" />
          <stop offset="1" stopColor="oklch(0.55 0.22 270)" />
        </linearGradient>
        <linearGradient id="pf-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="oklch(0.82 0.14 210)" />
          <stop offset="1" stopColor="oklch(0.62 0.16 240)" />
        </linearGradient>
      </defs>
      <path d="M16 3 28 10 16 17 4 10Z" fill="url(#pf-a)" />
      <path d="M4 10 16 17v12L4 22Z" fill="url(#pf-b)" opacity="0.9" />
      <path d="M28 10 16 17v12l12-7Z" fill="url(#pf-a)" opacity="0.75" />
      <path
        d="M22.5 19.5 24 16l1.5 3.5L29 21l-3.5 1.5L24 26l-1.5-3.5L19 21Z"
        fill="white"
        opacity="0.95"
      />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 font-semibold tracking-tight",
        className
      )}
    >
      <LogoMark />
      <span className="text-lg">Playforge</span>
    </span>
  )
}
