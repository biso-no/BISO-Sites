type StatusToken = {
  label: string
  className: string
}

type StatusTokenRecord = Record<string, StatusToken>

const DEFAULT_STATUS_TOKENS: StatusTokenRecord = {
  published: { label: "Published", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  draft: { label: "Draft", className: "bg-amber-100 text-amber-700 border-amber-200" },
  archived: { label: "Archived", className: "bg-slate-100 text-slate-700 border-slate-200" },
  closed: { label: "Closed", className: "bg-slate-200 text-slate-700 border-slate-300" },
  cancelled: { label: "Cancelled", className: "bg-rose-100 text-rose-700 border-rose-200" },
}

const LOCALE_LABELS: Record<string, string> = {
  en: "🇬🇧 EN",
  no: "🇳🇴 NO",
}

export const parseJSONSafe = <T extends Record<string, unknown> = Record<string, unknown>>(
  value: string | null | undefined,
  fallback: T = {} as T
): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

export const getUniqueLocales = (references: Array<{ locale?: string }> | undefined | null): string[] => {
  if (!references?.length) return []
  return Array.from(
    new Set(
      references
        .map((ref) => ref.locale?.trim())
        .filter((locale): locale is string => Boolean(locale && locale.length))
    )
  )
}

export const getLocaleLabel = (locale: string) => LOCALE_LABELS[locale] ?? locale.toUpperCase()

export const getStatusToken = (
  status: string,
  overrides?: StatusTokenRecord
): StatusToken => {
  const normalized = status?.toLowerCase()
  const tokens = { ...DEFAULT_STATUS_TOKENS, ...(overrides ?? {}) }
  return tokens[normalized] ?? {
    label: status,
    className: "bg-primary/10 text-primary-80 border-primary/20",
  }
}

export const formatPercentage = (completed: number, total: number) => {
  if (total <= 0) return "0%"
  return `${Math.round((completed / total) * 100)}%`
}
