import { createClerkClient, type BillingSubscriptionItem } from "@clerk/backend"

import { MONTHLY_PLAN_CREDITS } from "@/lib/billing/money"
import { creditLedger, db } from "@/lib/db/client"
import { errorFields, log } from "@/lib/log"

/**
 * Turns an organization's Clerk Billing subscription into ledger credits.
 *
 * Every started month of a paid plan earns one `MONTHLY_PLAN_CREDITS` grant,
 * keyed by subscription item and month index, so running this any number of
 * times inserts each grant exactly once. Unused credits roll over because the
 * ledger never expires rows.
 *
 * Uses `@clerk/backend` directly rather than `@clerk/nextjs` so it also runs
 * inside the Trigger.dev worker.
 */
let clerk: ReturnType<typeof createClerkClient> | undefined

function client() {
  clerk ??= createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

  return clerk
}

const PAID_STATUSES = new Set<BillingSubscriptionItem["status"]>([
  "active",
  "past_due",
  "canceled",
  "ended",
  "expired",
])

/** Whole months between two dates, counting a month once its day is reached. */
export function monthsBetween(from: Date, to: Date): number {
  const months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth())

  return to.getUTCDate() < from.getUTCDate() ? months - 1 : months
}

function grantsFor(orgId: string, item: BillingSubscriptionItem) {
  if (!item.plan?.hasBaseFee || item.isFreeTrial || !PAID_STATUSES.has(item.status)) {
    return []
  }

  const now = Date.now()
  const paidUntil = Math.min(item.endedAt ?? item.pastDueAt ?? now, now)
  const months = monthsBetween(new Date(item.createdAt), new Date(paidUntil)) + 1

  return Array.from({ length: Math.max(months, 0) }, (_, month) => ({
    orgId,
    entryKey: `plan:${item.id}:month:${month}`,
    amount: MONTHLY_PLAN_CREDITS,
    reason: `plan:${item.plan?.slug ?? "paid"}`,
  }))
}

export async function syncPlanCredits(orgId: string): Promise<void> {
  try {
    const subscription = await client().billing.getOrganizationBillingSubscription(orgId)
    const grants = subscription.subscriptionItems.flatMap((item) =>
      grantsFor(orgId, item)
    )

    if (grants.length > 0) {
      await db.insert(creditLedger).values(grants).onConflictDoNothing()
    }
  } catch (error) {
    // No subscription, or Billing not enabled on the Clerk instance: the
    // organization simply has no plan credits yet.
    log.debug("No plan credits to sync", {
      "organization.id": orgId,
      ...errorFields(error),
    })
  }
}
