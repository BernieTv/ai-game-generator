/**
 * The models a game can be built with, in picker order.
 *
 * Client-safe: ids, names and copy only. The provider instances that read
 * ANTHROPIC_API_KEY live in `./provider`, which only server code imports.
 */
export const GAME_MODELS = [
  {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    shortName: "Opus 5.5",
    description: "Most capable. Best for building a game from scratch.",
  },
  {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    shortName: "Sonnet 5.5",
    description: "Fast and strong. Great for iterating on a game.",
  },
  {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    shortName: "Haiku 5.5",
    description: "Quickest and cheapest. Best for small, specific tweaks.",
  },
] as const

export type GameModelId = (typeof GAME_MODELS)[number]["id"]

export const DEFAULT_MODEL_ID: GameModelId = "claude-opus-5-5"

export const GAME_MODEL_IDS = GAME_MODELS.map((model) => model.id) as [
  GameModelId,
  ...GameModelId[],
]

export function isGameModelId(value: unknown): value is GameModelId {
  return GAME_MODELS.some((model) => model.id === value)
}

export function getGameModel(id: GameModelId) {
  return GAME_MODELS.find((model) => model.id === id) ?? GAME_MODELS[0]
}
