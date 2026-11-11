import { auth } from "@clerk/nextjs/server"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { GameMenu } from "@/components/game-menu"
import { GameWorkspace } from "@/components/game-workspace"
import { DEFAULT_MODEL_ID, isGameModelId } from "@/lib/agent/models"
import { getBalance } from "@/lib/billing/ledger"
import { getGame } from "@/lib/games/queries"

export async function generateMetadata({
  params,
}: PageProps<"/studio/games/[id]">): Promise<Metadata> {
  const game = await getGame((await params).id)
  return { title: game?.title ?? "Game" }
}

export default async function GamePage({
  params,
  searchParams,
}: PageProps<"/studio/games/[id]">) {
  const { orgId } = await auth()
  const { id } = await params
  const [game, balance] = await Promise.all([getGame(id), getBalance(orgId)])

  if (!game) notFound()

  const { model } = await searchParams

  return (
    <>
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b px-4">
        <h1 className="truncate text-sm font-medium">{game.title}</h1>
        <GameMenu gameId={game.id} title={game.title} />
      </header>
      <GameWorkspace
        // A different game is a different conversation: remount everything.
        key={game.id}
        gameId={game.id}
        initialMessages={game.messages}
        initialModelId={isGameModelId(model) ? model : DEFAULT_MODEL_ID}
        hasSandbox={game.sandboxId !== null}
        outOfCredits={balance <= 0n}
        initialSession={
          game.chatAccessToken
            ? {
                publicAccessToken: game.chatAccessToken,
                lastEventId: game.chatLastEventId ?? undefined,
              }
            : undefined
        }
      />
    </>
  )
}
