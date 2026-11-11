# Deployment guide

Playforge has **two deployables** that share one database and one set of API keys:

| Deployable   | What runs there                                 | Where                               |
| ------------ | ----------------------------------------------- | ----------------------------------- |
| Web app      | Next.js UI, server actions, preview API         | **Railway** (recommended) or Vercel |
| Agent worker | `trigger/game-agent.ts`, the durable chat agent | **Trigger.dev Cloud**               |

Expect about 45 minutes the first time. Every service below has a free tier that is enough for a portfolio deployment. The only real cost is Anthropic API usage, which depends on how many games you build.

---

## Step 0: Before you start

- Node.js **22+** and npm installed locally (`node -v`).
- The repository cloned and dependencies installed:

  ```bash
  git clone https://github.com/BernieTv/ai-game-generator.git
  ```

  ```bash
  cd ai-game-generator && npm install
  ```

- A local env file to collect keys as you go:

  ```bash
  cp .env.example .env.local
  ```

---

## Step 1: Anthropic (the model)

1. Sign in at https://platform.claude.com and add a payment method under **Billing** (API usage is pay-as-you-go).
2. Go to **API keys**, click **Create key**, name it `playforge`.
3. Put it in `.env.local` as `ANTHROPIC_API_KEY`.

> Tip: set a monthly spend limit in the console so a public demo cannot surprise you.

## Step 2: Neon (Postgres database)

1. Create a project at https://console.neon.tech (any region close to where you will host).
2. On the project dashboard, click **Connect**.
   - With **Connection pooling ON**, copy the string into `DATABASE_URL`.
   - With **Connection pooling OFF**, copy the string into `DATABASE_URL_UNPOOLED`.
3. Create the tables:

   ```bash
   npm run db:push
   ```

   You should see `[✓] Changes applied`. The schema lives in `lib/db/schema.ts` (`games` and `credit_ledger`).

## Step 3: Clerk (auth, workspaces, billing)

1. Create an application at https://dashboard.clerk.com. Enable **Email** and, optionally, **Google** and **GitHub** sign-in.
2. **Configure → API keys:** copy the publishable key into `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and the secret key into `CLERK_SECRET_KEY`.
3. **Configure → Organizations:** turn Organizations **on**. Playforge calls them _workspaces_, and every game and credit balance belongs to one.
4. **Billing (optional, for paid plans):**
   1. Go to **Configure → Billing**, enable it, and use the development payment gateway while testing.
   2. Under **Plans → Organization plans**, create a plan (for example _Builder_) with a **monthly base fee** (for example $10).
   3. Each paid month grants `MONTHLY_PLAN_CREDITS` (defined in `lib/billing/money.ts`, default $10) to the workspace.

   If you skip Billing, every workspace still gets the free starting credits (`FREE_CREDITS`, default $2), and the billing page shows an empty plan table.

## Step 4: Daytona (game sandboxes)

1. Sign up at https://app.daytona.io.
2. Go to **Keys → Create key** with sandbox permissions.
3. Put it in `.env.local` as `DAYTONA_API_KEY`.

Sandboxes are created on a game's first message, auto-stop after 20 idle minutes, and restart on demand. They are deleted together with the game.

## Step 5: Trigger.dev (the agent worker)

1. Create an organization and a project at https://cloud.trigger.dev.
2. Copy the **project ref** (`proj_...`, under _Project settings_) into `TRIGGER_PROJECT_REF`.
3. Under **API keys**, copy the **DEV** secret key (`tr_dev_...`) into `TRIGGER_SECRET_KEY` for local use.
4. Log in with the CLI once:

   ```bash
   npx trigger.dev@latest login
   ```

## Step 6: Run everything locally (smoke test)

Terminal 1, the agent worker:

```bash
npm run trigger:dev
```

Terminal 2, the web app:

```bash
npm run dev
```

Open http://localhost:3000 and work through this checklist:

1. Sign up, then create a workspace.
2. Describe a game. The agent should ask design questions as clickable cards.
3. Answer the questions. File activity should stream in, and the preview panel should appear.
4. The sidebar credit balance should drop after each turn.

If this works locally, production differs only in keys and URLs.

---

## Step 7: Deploy the agent worker to Trigger.dev

1. In the Trigger.dev dashboard, open your project, switch the environment selector to **Production**, and go to **Environment variables**. Add the variables the worker needs:

   | Variable            | Value                                                       |
   | ------------------- | ----------------------------------------------------------- |
   | `DATABASE_URL`      | Neon pooled connection string                               |
   | `ANTHROPIC_API_KEY` | Anthropic key                                               |
   | `DAYTONA_API_KEY`   | Daytona key                                                 |
   | `CLERK_SECRET_KEY`  | Clerk **production** secret key (used to sync plan credits) |

2. Deploy from your machine:

   ```bash
   npm run trigger:deploy
   ```

   The deploy bundles `trigger/`, copies `game-runtime/` (the files seeded into every sandbox), and installs the Daytona SDK as a real dependency.

3. Copy the **PROD** secret key (`tr_prod_...`). The web app needs it in the next step.

> Optional: connect the GitHub repository in Trigger.dev (_Project settings → Git_) to redeploy the worker automatically on every push to `main`.

## Step 8: Deploy the web app to Railway

1. Push your code to GitHub. Then, at https://railway.com, go to **New project → Deploy from GitHub repo** and pick `ai-game-generator`.
2. Railway detects Next.js automatically. If you need to set the commands yourself:

   | Setting       | Value           |
   | ------------- | --------------- |
   | Build command | `npm run build` |
   | Start command | `npm start`     |

3. Open the service, go to **Variables → Raw editor**, and paste:

   ```bash
   NEXT_PUBLIC_APP_URL=https://<your-domain>
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/studio
   NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/studio
   DATABASE_URL=postgresql://...-pooler...
   ANTHROPIC_API_KEY=sk-ant-...
   TRIGGER_SECRET_KEY=tr_prod_...
   DAYTONA_API_KEY=dtn_...
   ```

   `NEXT_PUBLIC_*` values are baked in at build time, so redeploy after you change them.

4. Go to **Settings → Networking → Generate domain** (or add a custom domain).

### Alternative: Vercel

Import the repository at https://vercel.com/new, paste the same variables under **Settings → Environment Variables**, and deploy. No other changes are needed: agent turns run on Trigger.dev, not in serverless functions, so long builds are not affected by function time limits.

## Step 9: Switch Clerk to production

1. In Clerk, create a **production instance**, enter your domain, and add the DNS records Clerk lists at your DNS provider.
2. Re-enable **Organizations** (and **Billing**, with a live Stripe account, if you sell plans) on the production instance.
3. Replace the `pk_test`/`sk_test` keys with the `pk_live`/`sk_live` keys in Railway (or Vercel) and in the Trigger.dev production environment.

## Step 10: Optional Sentry

1. Create a **Next.js** project at https://sentry.io.
2. Set `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG` and `SENTRY_PROJECT` in Railway.
3. Add `SENTRY_AUTH_TOKEN` if you want readable stack traces from uploaded source maps.

Without these variables, Sentry stays disabled.

---

## Post-deploy checklist

- [ ] The landing page loads over HTTPS on your domain.
- [ ] Sign-up works, and creating a workspace lands you in `/studio`.
- [ ] A new game asks questions, builds, and shows a playable preview.
- [ ] The Trigger.dev dashboard shows `game-agent` runs in **Production**.
- [ ] The credit balance decreases after a turn, and the Billing page renders.
- [ ] Deleting a game removes its sandbox (check the Daytona dashboard).

## Troubleshooting

| Symptom                                         | Likely cause / fix                                                                                                                                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat spins forever after the first message      | The worker is not running or is deployed to a different environment. Locally, check `npm run trigger:dev`. In production, check that `TRIGGER_SECRET_KEY` is the **prod** key of the same project. |
| `Cannot find module 'form-data'` in worker logs | The worker was deployed without `trigger.config.ts` changes. Redeploy with `npm run trigger:deploy`.                                                                                               |
| Preview says "could not be started"             | The Daytona key is missing or invalid in the **web app** environment, or the sandbox is still booting. Click _Try again_.                                                                          |
| "Out of credits" right away                     | `CLERK_SECRET_KEY` is missing in the worker, or `FREE_CREDITS` was set to 0. Check the `credit_ledger` table with `npm run db:studio`.                                                             |
| `relation "games" does not exist`               | Run `npm run db:push` against the production database (set `DATABASE_URL_UNPOOLED` to it first).                                                                                                   |
| Clerk "Invalid host" on the production domain   | Add the domain in Clerk and complete the DNS records.                                                                                                                                              |
