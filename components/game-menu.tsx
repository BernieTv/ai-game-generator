"use client"

import { EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { useState, useTransition } from "react"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/dialog"
import { Menu, MenuItem } from "@/components/ui/menu"
import { Spinner } from "@/components/ui/spinner"
import { deleteGame, renameGame } from "@/lib/games/actions"
import { TITLE_MAX_LENGTH } from "@/lib/games/titles"

export function GameMenu({ gameId, title }: { gameId: string; title: string }) {
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null)
  const [name, setName] = useState(title)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const close = () => {
    if (!pending) {
      setDialog(null)
      setError(null)
    }
  }

  return (
    <>
      <Menu label="Game options" trigger={<EllipsisIcon className="size-4" />}>
        {(closeMenu) => (
          <>
            <MenuItem
              onClick={() => {
                closeMenu()
                setName(title)
                setDialog("rename")
              }}
            >
              <PencilIcon /> Rename
            </MenuItem>
            <MenuItem
              destructive
              onClick={() => {
                closeMenu()
                setDialog("delete")
              }}
            >
              <Trash2Icon /> Delete
            </MenuItem>
          </>
        )}
      </Menu>

      <Dialog
        open={dialog === "rename"}
        onOpenChange={(open) => !open && close()}
        title="Rename game"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            startTransition(async () => {
              try {
                await renameGame(gameId, name)
                setDialog(null)
              } catch {
                setError("Could not rename the game.")
              }
            })
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={TITLE_MAX_LENGTH}
            autoFocus
            aria-label="Game title"
            className="h-9 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Spinner />} Save
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && close()}
        title="Delete this game?"
        description="The chat, the sandbox and all of the game's files will be permanently deleted."
      >
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await deleteGame(gameId)
                } catch {
                  setError("Could not delete the game. Please try again.")
                }
              })
            }
          >
            {pending && <Spinner />} Delete game
          </Button>
        </div>
      </Dialog>
    </>
  )
}
