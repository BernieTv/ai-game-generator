"use client"

import { OrganizationSwitcher, UserButton } from "@clerk/nextjs"
import { CoinsIcon, Gamepad2Icon, MenuIcon, PlusIcon, XIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"

import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme"
import { buttonVariants } from "@/components/ui/button"
import type { GameSummary } from "@/lib/games/queries"
import { cn } from "@/lib/utils"

export function StudioSidebar({
  games,
  credits,
  lowCredits,
}: {
  games: GameSummary[]
  /** Pre-formatted balance, e.g. "$1.84". */
  credits: string
  lowCredits: boolean
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  // Close the mobile drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname)

  if (lastPath !== pathname) {
    setLastPath(pathname)
    setOpen(false)
  }

  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4 md:hidden">
        <Link href="/studio" aria-label="Playforge studio">
          <Logo />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="inline-flex size-9 items-center justify-center rounded-md hover:bg-accent"
        >
          <MenuIcon className="size-5" />
        </button>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r bg-sidebar transition-transform md:static md:z-auto md:w-64 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/studio" aria-label="Playforge studio">
            <Logo />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
            className="inline-flex size-8 items-center justify-center rounded-md hover:bg-accent md:hidden"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <div className="px-3">
          <Link
            href="/studio"
            className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start")}
          >
            <PlusIcon />
            New game
          </Link>
        </div>

        <nav className="mt-4 flex min-h-0 flex-1 flex-col" aria-label="Your games">
          <p className="px-5 pb-1 text-xs font-medium text-muted-foreground">Games</p>
          <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
            {games.length === 0 && (
              <li className="px-2 py-3 text-sm text-muted-foreground">
                No games yet. Describe one to get started.
              </li>
            )}
            {games.map((game) => {
              const href = `/studio/games/${game.id}`
              const active = pathname === href

              return (
                <li key={game.id}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                      active && "bg-accent font-medium text-accent-foreground"
                    )}
                  >
                    <Gamepad2Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{game.title}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="space-y-3 border-t p-3">
          <Link
            href="/studio/billing"
            className={cn(
              "flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm transition-colors hover:bg-accent",
              pathname === "/studio/billing" && "bg-accent"
            )}
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <CoinsIcon className="size-4" />
              Credits
            </span>
            <span
              className={cn("font-medium tabular-nums", lowCredits && "text-destructive")}
            >
              {credits}
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <OrganizationSwitcher
                hidePersonal
                afterSelectOrganizationUrl="/studio"
                afterCreateOrganizationUrl="/studio"
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    organizationSwitcherTrigger: "w-full justify-between",
                  },
                }}
              />
            </div>
            <ThemeToggle />
            <UserButton />
          </div>
        </div>
      </aside>
    </>
  )
}
