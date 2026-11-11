import { Daytona } from "@daytona/sdk"

let client: Daytona | undefined

/** The Daytona client, created on first use so builds never need the key. */
export function daytona(): Daytona {
  if (!process.env.DAYTONA_API_KEY) {
    throw new Error("DAYTONA_API_KEY is not set")
  }

  client ??= new Daytona()

  return client
}
