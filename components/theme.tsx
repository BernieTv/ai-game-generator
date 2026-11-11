"use client"

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { ThemeProvider as NextThemes, useTheme } from "next-themes"
import { useSyncExternalStore } from "react"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemes>
  )
}

const subscribe = () => () => {}

/** Cycles dark → light → system. Renders a stable icon until mounted. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  )

  const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark"
  const Icon =
    !mounted || theme === "dark" ? MoonIcon : theme === "light" ? SunIcon : MonitorIcon

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Theme: ${mounted ? theme : "dark"}`}
      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="size-4" />
    </button>
  )
}
