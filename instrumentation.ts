import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (!process.env.SENTRY_DSN) return

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
    enableLogs: true,
    // Prompts and game source are user content; keep them out of events.
    sendDefaultPii: false,
  })
}

export const onRequestError = Sentry.captureRequestError
