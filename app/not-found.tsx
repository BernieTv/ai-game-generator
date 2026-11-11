import Link from "next/link"

import { LogoMark } from "@/components/logo"
import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <main className="hero-glow flex min-h-svh flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoMark className="size-10" />
      <h1 className="text-2xl font-semibold tracking-tight">Nothing here</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This page or game does not exist, or it belongs to a different workspace.
      </p>
      <Link href="/studio" className={buttonVariants()}>
        Back to the studio
      </Link>
    </main>
  )
}
