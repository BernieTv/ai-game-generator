import { PricingTable } from "@clerk/nextjs"
import { auth } from "@clerk/nextjs/server"
import { CoinsIcon, InfinityIcon, ZapIcon } from "lucide-react"

import { MODEL_RATES } from "@/lib/billing/pricing"
import { getBalance } from "@/lib/billing/ledger"
import { formatCredits, FREE_CREDITS, MONTHLY_PLAN_CREDITS } from "@/lib/billing/money"
import { syncPlanCredits } from "@/lib/billing/subscription"
import { GAME_MODELS } from "@/lib/agent/models"

export const metadata = { title: "Billing" }

export default async function BillingPage() {
  const { orgId } = await auth()

  // Picks up a subscription started since the last turn.
  if (orgId) await syncPlanCredits(orgId)

  const balance = await getBalance(orgId)

  return (
    <>
      <header className="flex h-12 shrink-0 items-center border-b px-4">
        <h1 className="text-sm font-medium">Billing</h1>
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl space-y-12 px-4 py-10 sm:px-6">
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-card p-5 sm:col-span-1">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CoinsIcon className="size-4" /> Available credits
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
                {formatCredits(balance)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-5 text-sm sm:col-span-2">
              <p className="font-medium">How credits work</p>
              <ul className="mt-2 space-y-1.5 text-muted-foreground">
                <li className="flex gap-2">
                  <ZapIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  Every workspace starts with {formatCredits(FREE_CREDITS)} free. Each
                  model step is charged at Anthropic list price for the tokens it used.
                </li>
                <li className="flex gap-2">
                  <InfinityIcon className="mt-0.5 size-4 shrink-0 text-primary" />
                  The Builder plan adds {formatCredits(MONTHLY_PLAN_CREDITS)} every month,
                  and unused credits roll over. A build that has started always finishes,
                  even if it dips below zero.
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight">Model prices</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              USD per million tokens. Prompt caching keeps repeat turns cheap.
            </p>
            <div className="mt-4 overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Model</th>
                    <th className="px-4 py-2 text-right font-medium">Input</th>
                    <th className="px-4 py-2 text-right font-medium">Cached input</th>
                    <th className="px-4 py-2 text-right font-medium">Output</th>
                  </tr>
                </thead>
                <tbody>
                  {GAME_MODELS.map((model) => {
                    const rates = MODEL_RATES[model.id]
                    return (
                      <tr key={model.id} className="border-t">
                        <td className="px-4 py-2 font-medium">{model.name}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          ${rates.input.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          ${rates.cacheRead.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          ${rates.output.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold tracking-tight">Plans</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Plans belong to the workspace. Use the switcher in the sidebar to choose
              which workspace you are billing.
            </p>
            <div className="mt-6">
              <PricingTable for="organization" />
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
