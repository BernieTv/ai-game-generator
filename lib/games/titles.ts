export const TITLE_MAX_LENGTH = 80

/** A short sidebar title derived from the opening prompt. */
export function titleFromPrompt(prompt: string): string {
  const firstLine = prompt.trim().split("\n")[0]?.replace(/\s+/g, " ") ?? ""
  const cleaned = firstLine.replace(/^(make|build|create)\s+(me\s+)?(a|an)\s+/i, "")
  const title = cleaned.charAt(0).toUpperCase() + cleaned.slice(1)

  return truncateTitle(title || "Untitled game", 48)
}

export function truncateTitle(title: string, max = TITLE_MAX_LENGTH): string {
  return title.length > max ? `${title.slice(0, max - 1).trimEnd()}…` : title
}
