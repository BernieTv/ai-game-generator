"use client"

import { CheckIcon, ChevronDownIcon, CpuIcon } from "lucide-react"

import { Menu, MenuItem } from "@/components/ui/menu"
import { GAME_MODELS, getGameModel, type GameModelId } from "@/lib/agent/models"

export function ModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: GameModelId
  onChange: (id: GameModelId) => void
  disabled?: boolean
}) {
  const current = getGameModel(value)

  if (disabled) {
    return (
      <span className="inline-flex h-8 items-center gap-1.5 px-2 text-xs text-muted-foreground">
        <CpuIcon className="size-3.5" />
        {current.shortName}
      </span>
    )
  }

  return (
    <Menu
      label="Choose model"
      align="start"
      trigger={
        <span className="inline-flex items-center gap-1.5 px-2 text-xs font-medium whitespace-nowrap">
          <CpuIcon className="size-3.5" />
          {current.shortName}
          <ChevronDownIcon className="size-3" />
        </span>
      }
    >
      {(close) =>
        GAME_MODELS.map((model) => (
          <MenuItem
            key={model.id}
            onClick={() => {
              onChange(model.id)
              close()
            }}
            className="items-start py-2"
          >
            <CheckIcon
              className={model.id === value ? "mt-0.5 opacity-100" : "mt-0.5 opacity-0"}
            />
            <span className="flex flex-col">
              <span className="font-medium">{model.name}</span>
              <span className="text-xs text-muted-foreground">{model.description}</span>
            </span>
          </MenuItem>
        ))
      }
    </Menu>
  )
}
