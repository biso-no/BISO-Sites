import type {
  ContentEntryLocaleRecord,
  ContentEntryRecord,
  EditorialQueryCollection,
} from "@repo/api/editorial";
import { type ClassValue, clsx } from "clsx";
import type { Locale } from "next-intl";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const _campusMap = {
  1: "Oslo",
  2: "Bergen",
  3: "Trondheim",
  4: "Stavanger",
  5: "National",
};

function _getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function _formatDateReadable(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export const isProd =
  process.env.VERCEL_ENV === "production" ||
  process.env.NODE_ENV === "production";

export function computeTranslationState(
  entry: ContentEntryRecord,
  locale: ContentEntryLocaleRecord
) {
  if (locale.locale === entry.sourceLocale) {
    return "source" as const;
  }

  const sourceLocale =
    entry.locales.find(
      (entryLocale) => entryLocale.locale === entry.sourceLocale
    ) ?? null;

  if (!sourceLocale) {
    return locale.translationStatus;
  }

  if (
    locale.sourceUpdatedAt &&
    new Date(locale.sourceUpdatedAt).getTime() <
      new Date(sourceLocale.updatedAt).getTime()
  ) {
    return "stale" as const;
  }

  return locale.translationStatus;
}

export function listManagedEditorialRelationOptions(
  collection: EditorialQueryCollection,
  locale: Locale
) {
  return runEditorialQuery(
    {
      collection,
      limit: 50,
      mode: "list",
      sort:
        collection === "events"
          ? { field: "start_date", direction: "asc" }
          : { field: "$createdAt", direction: "desc" },
    },
    { locale, viewerIsAuthenticated: true }
  );
}
