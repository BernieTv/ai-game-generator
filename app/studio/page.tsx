import { auth } from "@clerk/nextjs/server"

import { LogoMark } from "@/components/logo"
import { NewGameComposer } from "@/components/new-game-composer"
import { getBalance } from "@/lib/billing/ledger"

export const metadata = { title: "Studio" }

export default async function StudioHome() {
  const { orgId } = await auth()
  const balance = await getBalance(orgId)

  return (
    <main className="hero-glow flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-12">
      <div className="flex w-full max-w-2xl flex-col items-center gap-8 text-center">
        <LogoMark className="size-12" />
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            What should we build today?
          </h1>
          <p className="text-balance text-muted-foreground">
            Racers, shooters, puzzles, whole worlds. Describe it in your own words and the
            agent will design it with you, then build it.
          </p>
        </div>
        <NewGameComposer outOfCredits={balance <= 0n} />
      </div>
    </main>
  )
}
