"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

export default function GlobalError({
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
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "grid",
          placeItems: "center",
          minHeight: "100vh",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 20 }}>Something went wrong</h1>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 12, padding: "8px 16px", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
