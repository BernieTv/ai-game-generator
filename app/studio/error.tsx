"use client"

import * as Sentry from "@sentry/nextjs"
import { TriangleAlertIcon } from "lucide-react"
import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export default function StudioError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <TriangleAlertIcon className="size-8 text-amber-500" />
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The studio hit an unexpected error. Your games are safe; try again.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  )
}
