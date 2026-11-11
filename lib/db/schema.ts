import type { UIMessage } from "ai"
import { sql } from "drizzle-orm"
import {
  bigint,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

/**
 * A game and its single conversation with the builder agent.
 *
 * The thread lives on the row (as `useChat` UI messages) because a game has
 * exactly one, and it is always read and written whole.
 */
export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Clerk organization id. Every query is scoped by it. */
    orgId: text("org_id").notNull(),
    /** Clerk user id of whoever created the game. */
    createdBy: text("created_by").notNull(),
    title: text("title").notNull(),
    messages: jsonb("messages")
      .$type<UIMessage[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    /**
     * Trigger.dev session state, written together with `messages` at the end of
     * every turn so a reloaded tab can resume a stream from the right event.
     */
    chatAccessToken: text("chat_access_token"),
    chatLastEventId: text("chat_last_event_id"),
    /** Daytona sandbox holding the game's files. Set on the first turn. */
    sandboxId: text("sandbox_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("games_org_created_idx").on(table.orgId, table.createdAt.desc())]
)

export type Game = typeof games.$inferSelect
export type NewGame = typeof games.$inferInsert

/**
 * Append-only credit ledger. The balance is the sum of an organization's rows
 * plus the free starting grant.
 *
 * Amounts are in micro-dollars (1/1,000,000 USD) so per-token prices stay exact
 * integers. `entryKey` makes every write idempotent: a retried charge for the
 * same model step, or a re-run grant for the same subscription month, collides
 * on the unique constraint instead of counting twice.
 */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: text("org_id").notNull(),
    entryKey: text("entry_key").notNull(),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("credit_ledger_org_entry_key").on(table.orgId, table.entryKey)]
)

export type CreditLedgerEntry = typeof creditLedger.$inferSelect
