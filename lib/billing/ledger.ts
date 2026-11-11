import { eq, sql } from "drizzle-orm"

import { syncPlanCredits } from "@/lib/billing/subscription"
import { FREE_CREDITS } from "@/lib/billing/money"
import { creditLedger, db } from "@/lib/db/client"

/** Shown to the player verbatim when a turn is refused. */
export const OUT_OF_CREDITS =
  "Your workspace is out of credits. Add more on the Billing page to keep building."

/** An organization's balance in micro-dollars, including the free grant. */
export async function getBalance(orgId: string | null | undefined): Promise<bigint> {
  if (!orgId) {
    return FREE_CREDITS
  }

  const [row] = await db
    .select({ total: sql<string | null>`sum(${creditLedger.amount})` })
    .from(creditLedger)
    .where(eq(creditLedger.orgId, orgId))

  return FREE_CREDITS + BigInt(row?.total ?? 0)
}

/**
 * Charges one model step. Idempotent on the response id, so a retried write
 * of the same step is a no-op rather than a double charge.
 */
export async function chargeStep(params: {
  orgId: string
  responseId: string
  amount: bigint
  modelId: string
}): Promise<void> {
  if (params.amount <= 0n) {
    return
  }

  await db
    .insert(creditLedger)
    .values({
      orgId: params.orgId,
      entryKey: `step:${params.responseId}`,
      amount: -params.amount,
      reason: `model:${params.modelId}`,
    })
    .onConflictDoNothing()
}

/**
 * Whether the organization may start a new turn.
 *
 * A turn already in progress always finishes (a half-written game is worse
 * than a small overdraft), so this is only checked before a turn starts. When
 * the balance looks empty, paid plan months are synced first in case the
 * workspace subscribed since its last turn.
 */
export async function canStartTurn(orgId: string): Promise<boolean> {
  if ((await getBalance(orgId)) > 0n) {
    return true
  }

  await syncPlanCredits(orgId)

  return (await getBalance(orgId)) > 0n
}
