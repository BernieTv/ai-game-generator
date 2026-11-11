import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** "3 minutes ago"-style relative time, without a date library. */
export function timeAgo(date: Date, now = new Date()): string {
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ]
  const format = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(-Math.round(seconds / size), unit)
  }

  return "just now"
}
