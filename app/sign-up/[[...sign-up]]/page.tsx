import { SignUp } from "@clerk/nextjs"
import Link from "next/link"

import { Logo } from "@/components/logo"

export const metadata = { title: "Create your account" }

export default function SignUpPage() {
  return (
    <main className="hero-glow flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/" aria-label="Playforge home">
        <Logo />
      </Link>
      <SignUp />
    </main>
  )
}
