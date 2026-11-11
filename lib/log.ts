/**
 * Structured logging shared by the web app and the Trigger.dev worker.
 *
 * Lines are single JSON objects so Railway, Trigger.dev and any log drain can
 * index them. Prompt text and game source never go in here, only ids, counts
 * and timings.
 */
type Fields = Record<string, string | number | boolean | null | undefined>

type Level = "debug" | "info" | "warn" | "error"

function write(level: Level, message: string, fields?: Fields) {
  const line = JSON.stringify({
    level,
    message,
    ...fields,
    time: new Date().toISOString(),
  })

  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export const log = {
  debug: (message: string, fields?: Fields) => {
    if (process.env.NODE_ENV !== "production") write("debug", message, fields)
  },
  info: (message: string, fields?: Fields) => write("info", message, fields),
  warn: (message: string, fields?: Fields) => write("warn", message, fields),
  error: (message: string, fields?: Fields) => write("error", message, fields),
}

/** Error details as flat log fields. */
export function errorFields(error: unknown): Fields {
  if (error instanceof Error) {
    return { "error.type": error.name, "error.message": error.message }
  }

  return { "error.message": String(error) }
}

/** Milliseconds since `start` (a `performance.now()` reading). */
export function since(start: number): number {
  return Math.round(performance.now() - start)
}
