import { OrganizationList } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"

import { Logo } from "@/components/logo"
import { StudioSidebar } from "@/components/studio-sidebar"
import { getBalance } from "@/lib/billing/ledger"
import { DOLLAR, formatCredits } from "@/lib/billing/money"
import { listGames } from "@/lib/games/queries"

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = await auth.protect()

  // Everything in the studio belongs to a workspace (a Clerk organization).
  if (!orgId) {
    return (
      <main className="hero-glow flex min-h-svh flex-col items-center justify-center gap-6 px-4 py-12 text-center">
        <Logo />
        <div className="max-w-md space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Pick a workspace</h1>
          <p className="text-sm text-muted-foreground">
            Games and credits belong to a workspace, so you can build alone or with your
            team. Create one to get your free starting credits.
          </p>
        </div>
        <OrganizationList
          hidePersonal
          afterSelectOrganizationUrl="/studio"
          afterCreateOrganizationUrl="/studio"
        />
      </main>
    )
  }

  const [games, balance] = await Promise.all([listGames(), getBalance(orgId)])

  return (
    <div className="flex h-svh flex-col md:flex-row">
      <StudioSidebar
        games={games}
        credits={formatCredits(balance)}
        lowCredits={balance < DOLLAR / 10n}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
