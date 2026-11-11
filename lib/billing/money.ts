/** One US dollar in ledger units (micro-dollars). */
export const DOLLAR = 1_000_000n

/** Credits every organization starts with, so the app can be tried for free. */
export const FREE_CREDITS = 2n * DOLLAR

/** Credits added for each paid month of the Builder plan. */
export const MONTHLY_PLAN_CREDITS = 10n * DOLLAR

/**
 * A ledger amount as dollars, e.g. `$1.23` or `-$0.04`.
 *
 * Rounded toward zero to the cent, which never shows more credit than exists.
 */
export function formatCredits(amount: bigint): string {
  const negative = amount < 0n
  const cents = (negative ? -amount : amount) / (DOLLAR / 100n)
  const dollars = cents / 100n
  const remainder = (cents % 100n).toString().padStart(2, "0")
  const grouped = dollars.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")

  return `${negative && cents > 0n ? "-" : ""}$${grouped}.${remainder}`
}
