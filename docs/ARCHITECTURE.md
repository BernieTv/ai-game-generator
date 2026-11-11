# Architecture and design notes

This document explains _why_ Playforge is built the way it is: the constraints, the trade-offs, and the boundaries that keep it safe.

## Goals

1. **Long-running agent work must not depend on an open HTTP request.** A build is dozens of model steps and tool calls over several minutes.
2. **Model-generated code must never run on our servers.** It is written to, and served from, an isolated sandbox.
3. **Every cent of model spend is attributable** to a workspace, exactly once.
4. **The player co-designs the game**, so the agent asks structured questions before it writes code.

## Components

### Web app (Next.js 16)

- **Server Components** read data directly (`lib/games/queries.ts`), always scoped to the organization in the Clerk session.
- **Server Actions** handle all writes (`createGame`, `renameGame`, `deleteGame`) and the two chat-session actions (`startGameSession`, `mintGameSessionToken`). Server Actions can be called by direct POST, so each one re-authorizes through `authorizeGame` and never trusts an org id from the client.
- **`proxy.ts`** (Next 16's renamed middleware) protects `/studio/**` and `/api/games/**` with Clerk.

### Agent worker (Trigger.dev `chat.agent`)

`trigger/game-agent.ts` defines one durable chat agent. The chat id **is** the game id, so each game has exactly one long-lived session.

| Hook              | Responsibility                                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| `hydrateMessages` | Reload the thread from Postgres (the source of truth) and merge a genuinely new user message.                        |
| `onChatStart`     | First message only: create and seed the Daytona sandbox before streaming starts.                                     |
| `onTurnStart`     | Persist the thread (it may contain a fresh `ask_player` answer) and refuse the turn if the workspace has no credits. |
| `run`             | `streamText` with the system prompt, tools, a step limit and per-step billing.                                       |
| `onTurnComplete`  | Save the thread and the stream cursor in one statement.                                                              |

Why not a Next.js route handler? Route handlers are bounded by request timeouts and die when the client disconnects. Trigger.dev runs continue independently, suspend (at no compute cost) while waiting for the player to answer a question, and let any tab resume the stream from a cursor.

### Tools

| Tool                                                                | Notes                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_files`, `read_file`, `write_file`, `edit_file`, `delete_file` | Operate on `/home/daytona/game` only. A 128 KB per-file cap keeps reads cheap and code modular.                                                                                                                                              |
| `ask_player`                                                        | No `execute`. The call ends the step with a pending tool call. The UI renders it as a question card, and the answer is submitted as the tool output (`addToolOutput`), which automatically triggers the next turn (`sendAutomaticallyWhen`). |

Tool errors fall into two classes:

- `ToolInputError` (bad path, ambiguous edit, missing file) returns a message to the model, which corrects itself on the next step.
- Anything else (sandbox down, network) is thrown and fails the turn visibly.

### Sandboxes (Daytona)

- Created lazily on a game's first message, labelled `{ app: "playforge", gameId }`, auto-stopped after 20 idle minutes.
- Seeded from `game-runtime/`: a placeholder `index.html`, the `report.js` error reporter, and the `engine/` toolkit.
- The preview is a `python3 -m http.server` inside the sandbox, exposed through a **signed preview URL**. A signed URL is needed because iframes cannot send custom auth headers. The URL expires after an hour and is refetched on every turn.
- Deletion looks sandboxes up **by label** as well as by the id stored on the row. This catches orphans left by a crash between "create sandbox" and "save id".

### Preview and error reporting

```text
GamePreview (app)                         iframe (sandbox origin)
    │  GET /api/games/:id/preview  ──►  start server, sign URL
    │  <iframe src=signed-url>
    │                                     report.js captures onerror,
    │  ◄── {type:"playforge:error"} ────  unhandledrejection, console.error
    │  ── {type:"playforge:ping"} ────►
    │  ◄── {type:"playforge:status"} ──   (all errors so far + ready flag)
```

Messages are accepted only when `event.source` is our own iframe's `contentWindow`. The "Ask agent to fix" button sends the error list to the agent as a normal user message.

## Data model

```text
games
  id uuid PK · org_id · created_by · title
  messages jsonb (UIMessage[])         ← whole thread, rewritten each turn
  chat_access_token · chat_last_event_id  ← resume cursor, written with messages
  sandbox_id · created_at · updated_at
  index (org_id, created_at desc)

credit_ledger
  id uuid PK · org_id · entry_key · amount bigint (micro-USD) · reason · created_at
  unique (org_id, entry_key)
```

Storing the thread inline is a deliberate simplification: a game has exactly one conversation, and it is always loaded and saved whole. If threads grew very large, they would move to a `messages` table with pagination.

## Billing

- **Units:** micro-dollars in `bigint`. No floating point touches money.
- **Pricing:** `priceStep` (`lib/billing/pricing.ts`) prices uncached input, cache reads, cache writes and output separately at list price, and rounds up.
- **Charging:** per model step in `onStepEnd`, keyed `step:<responseId>`. A step retried by the infrastructure collides on the unique key instead of charging twice.
- **Policy:** credit is checked **before** a turn starts, never mid-turn. A half-written game is a worse outcome than a few cents of overdraft.
- **Plans:** `syncPlanCredits` reads the workspace's Clerk Billing subscription and inserts one grant per paid month (`plan:<item>:month:<n>`). The operation is idempotent, so it can run on every billing page view and whenever the balance looks empty.

## Security boundaries

| Boundary                | Enforcement                                                                                                                                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant isolation        | Org id always comes from the Clerk session. Every query filters on it, and a foreign game returns 404.                                                                     |
| Agent filesystem access | `resolveGamePath`: allow-list characters, `path.posix.resolve`, then a prefix check on `GAME_DIR/`. Unit-tested against traversal and sibling-prefix tricks.               |
| Shell injection         | The only shell interpolation of a model-influenced value is `mkdir -p '<dir>'`, and that directory has already passed the character allow-list (no quotes, spaces or `$`). |
| Generated code          | Runs only inside the sandbox and in a cross-origin iframe, never on the app's servers or origin.                                                                           |
| Secrets                 | `TRIGGER_SECRET_KEY`, `ANTHROPIC_API_KEY` and `DAYTONA_API_KEY` stay server-side. The browser only gets short-lived, session-scoped Trigger.dev tokens.                    |
| Logs                    | Structured, with ids, counts and timings only. Prompts and game code are never logged.                                                                                     |

## Trade-offs and possible improvements

- **Static prompt for caching.** Engine docs live in the system prompt, which costs tokens once per cache window but keeps every turn cache-friendly.
- **Inline thread storage.** Simple and fast for typical games; see above for scaling.
- **No end-to-end tests against the live model.** These would be slow and costly. The next step would be Playwright tests with a mocked model provider and an in-memory sandbox fake.
