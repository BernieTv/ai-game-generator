import { auth } from "@clerk/nextjs/server"
import {
  ArrowRightIcon,
  BoxIcon,
  CoinsIcon,
  GaugeIcon,
  MessagesSquareIcon,
  PlayIcon,
  RefreshCwIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "lucide-react"
import Link from "next/link"

import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const FEATURES = [
  {
    icon: MessagesSquareIcon,
    title: "Design brief, not guesswork",
    body: "Before writing code, the agent settles the loop, goal, controls and look with quick multiple-choice questions.",
  },
  {
    icon: BoxIcon,
    title: "A sandbox per game",
    body: "Every game gets an isolated Daytona sandbox. The agent can only read and write files inside its own game directory.",
  },
  {
    icon: PlayIcon,
    title: "Live, playable preview",
    body: "The game runs beside the chat and reloads after every turn. Runtime errors flow back so the agent can fix them.",
  },
  {
    icon: RefreshCwIcon,
    title: "Durable agent turns",
    body: "Turns run as Trigger.dev chat agents. Close the tab mid-build and the stream resumes where it left off.",
  },
  {
    icon: CoinsIcon,
    title: "Metered credits",
    body: "Each model step is priced from token usage and written to an idempotent ledger, with monthly plans via Clerk Billing.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Team workspaces",
    body: "Games, sandboxes and credits are scoped to Clerk organizations, so teams can build together.",
  },
]

const STEPS = [
  { title: "Describe", body: "Type a premise like “a moth drifting toward a lantern”." },
  { title: "Decide", body: "Answer three or four design questions with one click each." },
  {
    title: "Play",
    body: "Watch the agent write the game, then play and iterate in the browser.",
  },
]

const STACK = [
  "Next.js 16",
  "React 19",
  "TypeScript",
  "Claude (AI SDK)",
  "Trigger.dev",
  "Daytona",
  "three.js",
  "Neon Postgres",
  "Drizzle ORM",
  "Clerk",
  "Tailwind CSS 4",
  "Sentry",
]

export default async function LandingPage() {
  const { userId } = await auth()
  const primaryHref = userId ? "/studio" : "/sign-up"

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-40 border-b border-transparent bg-background/70 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Playforge home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="#features"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "hidden sm:inline-flex"
              )}
            >
              Features
            </a>
            <a
              href="#how"
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "hidden sm:inline-flex"
              )}
            >
              How it works
            </a>
            <ThemeToggle />
            {userId ? (
              <Link href="/studio" className={buttonVariants({ size: "sm" })}>
                Open studio
              </Link>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  Sign in
                </Link>
                <Link href="/sign-up" className={buttonVariants({ size: "sm" })}>
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="hero-glow relative overflow-hidden">
          <div className="grid-backdrop absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center px-4 pt-20 pb-24 text-center sm:px-6 sm:pt-28">
            <span className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <SparklesIcon className="size-3.5 text-primary" />
              Agentic three.js game builder, powered by Claude
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Describe a game.
              <br />
              <span className="bg-gradient-to-r from-primary to-sky-400 bg-clip-text text-transparent">
                Play it in minutes.
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-balance text-muted-foreground">
              Playforge turns a plain-English idea into a playable 3D browser game. An AI
              agent asks a few design questions, writes the code in its own cloud sandbox,
              and streams the result into a live preview you can keep refining.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Link href={primaryHref} className={buttonVariants({ size: "lg" })}>
                Start building free
                <ArrowRightIcon />
              </Link>
              <a
                href="#how"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                See how it works
              </a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Every workspace starts with free credits. No card required.
            </p>

            <div className="mt-16 w-full overflow-hidden rounded-2xl border bg-card/80 text-left shadow-2xl shadow-primary/10 backdrop-blur">
              <div className="flex items-center gap-1.5 border-b px-4 py-3">
                <span className="size-2.5 rounded-full bg-red-400/80" />
                <span className="size-2.5 rounded-full bg-amber-400/80" />
                <span className="size-2.5 rounded-full bg-emerald-400/80" />
                <span className="ml-3 text-xs text-muted-foreground">
                  playforge · Neon hover racer
                </span>
              </div>
              <div className="grid gap-0 md:grid-cols-5">
                <div className="space-y-3 border-b p-5 text-sm md:col-span-2 md:border-r md:border-b-0">
                  <div className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground">
                    A neon hover racer above a synthwave city
                  </div>
                  <div className="rounded-xl border bg-background p-3">
                    <p className="font-medium">How should the race be won?</p>
                    <div className="mt-2 grid gap-1.5">
                      <span className="rounded-md border border-primary bg-accent px-2 py-1 text-xs">
                        Beat the ghost lap time
                      </span>
                      <span className="rounded-md border px-2 py-1 text-xs text-muted-foreground">
                        Outlast rivals in elimination
                      </span>
                    </div>
                  </div>
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <GaugeIcon className="size-3.5" /> Wrote main.js, src/track.js,
                    src/ship.js
                  </p>
                </div>
                <div className="relative aspect-video md:col-span-3 md:aspect-auto">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,oklch(0.7_0.25_330/.55),transparent_55%),linear-gradient(180deg,oklch(0.18_0.06_290),oklch(0.12_0.04_280))]" />
                  <div className="absolute inset-x-0 bottom-0 h-1/2 [transform-origin:bottom] [transform:perspective(300px)_rotateX(60deg)] [background:repeating-linear-gradient(90deg,oklch(0.75_0.2_330/.5)_0_1px,transparent_1px_40px),repeating-linear-gradient(0deg,oklch(0.75_0.2_200/.45)_0_1px,transparent_1px_28px)]" />
                  <div className="absolute top-4 left-4 rounded-md bg-black/40 px-2 py-1 font-mono text-xs text-white">
                    LAP 2/3 · 01:12.48
                  </div>
                  <div className="absolute bottom-6 left-1/2 h-4 w-14 -translate-x-1/2 rounded-full bg-sky-300 shadow-[0_0_30px_8px_oklch(0.8_0.15_220/.7)]" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="mt-12 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="rounded-xl border bg-card p-6">
                <span className="inline-flex size-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                  {index + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="features" className="border-t bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <h2 className="text-center text-3xl font-semibold tracking-tight">
              Built like a real product
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
              Under the hood: a durable tool-using agent, isolated execution, metered
              billing and multi-tenant workspaces.
            </p>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="rounded-xl border bg-card p-6">
                  <feature.icon className="size-5 text-primary" />
                  <h3 className="mt-4 font-semibold">{feature.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-sm font-medium tracking-widest text-muted-foreground uppercase">
            Tech stack
          </h2>
          <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-2">
            {STACK.map((item) => (
              <li key={item} className="rounded-full border bg-card px-3 py-1 text-sm">
                {item}
              </li>
            ))}
          </ul>
          <Link
            href={primaryHref}
            className={cn(buttonVariants({ size: "lg" }), "mt-12")}
          >
            Build your first game
            <ArrowRightIcon />
          </Link>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <Logo className="text-foreground [&_svg]:size-5 [&>span]:text-sm" />
          <p>© {new Date().getFullYear()} Playforge. Built with Next.js and Claude.</p>
        </div>
      </footer>
    </div>
  )
}
