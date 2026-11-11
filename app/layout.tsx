import { ClerkProvider } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import type { Metadata, Viewport } from "next"

import { ThemeProvider } from "@/components/theme"
import { cn } from "@/lib/utils"

import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Playforge: describe a game, play it in seconds",
    template: "%s · Playforge",
  },
  description:
    "Playforge is an AI game studio. Describe a game in plain English and an agent built on Claude designs it with you, writes the three.js code in a cloud sandbox, and streams a playable 3D game into your browser.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#16151f" },
    { media: "(prefers-color-scheme: light)", color: "#fcfcfe" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(GeistSans.variable, GeistMono.variable, "font-sans")}
    >
      <body>
        <ClerkProvider appearance={{ theme: shadcn }}>
          <ThemeProvider>{children}</ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
