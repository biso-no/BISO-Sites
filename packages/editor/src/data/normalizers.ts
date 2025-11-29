import type { NormalizedItem } from "./types";

type RowData = Record<string, unknown>;
type TranslationData = Record<string, unknown>;

/** Get translated content from translation_refs */
function getTranslation(
  row: RowData,
  locale?: string
): TranslationData | undefined {
  const translations = row.translation_refs as TranslationData[] | undefined;
  if (!translations?.length) {
    return;
  }
  const match = translations.find((t) => t.locale === locale);
  return match ?? translations[0];
}

/** Extract ID from row */
function extractId(row: RowData): string {
  return (row.$id as string) || String(row.id || "");
}

/** Normalize event data */
export function normalizeEvent(row: RowData, locale?: string): NormalizedItem {
  const translation = getTranslation(row, locale);
  const title = (translation?.title as string) || (row.title as string) || "";
  const description =
    (translation?.description as string) || (row.description as string) || "";

  return {
    id: extractId(row),
    title,
    description,
    subtitle: description?.slice(0, 100),
    image: row.image as string | undefined,
    href: `/events/${row.$id}`,
    date: row.start_date as string | undefined,
    endDate: row.end_date as string | undefined,
    location: row.location as string | undefined,
    category: row.category as string | undefined,
    metadata: {
      price: row.price,
      memberOnly: row.member_only,
      ticketUrl: row.ticket_url,
    },
    raw: row,
  };
}

/** Normalize news data */
export function normalizeNews(row: RowData, locale?: string): NormalizedItem {
  const translation = getTranslation(row, locale);
  const title = (translation?.title as string) || (row.title as string) || "";
  const description =
    (translation?.description as string) || (row.description as string) || "";

  return {
    id: extractId(row),
    title,
    description,
    subtitle: description?.slice(0, 100),
    image: row.image as string | undefined,
    href: `/news/${row.$id}`,
    date: row.$createdAt as string | undefined,
    badge: row.sticky ? "Featured" : undefined,
    metadata: { sticky: row.sticky, author: row.author },
    raw: row,
  };
}

/** Normalize job data */
export function normalizeJob(row: RowData, locale?: string): NormalizedItem {
  const translation = getTranslation(row, locale);
  const title = (translation?.title as string) || (row.title as string) || "";
  const description =
    (translation?.description as string) || (row.description as string) || "";
  const metadata =
    typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata;
  const meta = (metadata || {}) as RowData;

  return {
    id: extractId(row),
    title,
    description,
    subtitle: (meta.department as string) || (row.department as string),
    image: meta.image as string | undefined,
    href: `/jobs/${row.slug}`,
    date: meta.deadline as string | undefined,
    location: meta.location as string | undefined,
    category: meta.type as string | undefined,
    badge: meta.paid ? "Paid" : "Volunteer",
    metadata: meta,
    raw: row,
  };
}

/** Normalize partner data */
export function normalizePartner(row: RowData): NormalizedItem {
  return {
    id: extractId(row),
    title: row.name as string,
    image: row.image_url as string | undefined,
    href: row.url as string | undefined,
    category: row.level as string | undefined,
    raw: row,
  };
}

/** Normalize department data */
export function normalizeDepartment(
  row: RowData,
  locale?: string
): NormalizedItem {
  const translation = getTranslation(row, locale);
  const title =
    (translation?.title as string) || (row.Name as string) || "";
  const description = (translation?.description as string) || "";

  return {
    id: extractId(row),
    title,
    description,
    image: row.logo as string | undefined,
    href: `/students/${row.Id}`,
    category: row.type as string | undefined,
    raw: row,
  };
}

/** Normalize team member data */
export function normalizeTeamMember(row: RowData): NormalizedItem {
  return {
    id: extractId(row),
    title: row.name as string,
    subtitle: row.role as string | undefined,
    image: row.imageUrl as string | undefined,
    raw: row,
  };
}

/** Normalize product data */
export function normalizeProduct(row: RowData, locale?: string): NormalizedItem {
  const translation = getTranslation(row, locale);
  const title = (translation?.title as string) || (row.title as string) || "";
  const description =
    (translation?.description as string) || (row.description as string) || "";

  return {
    id: extractId(row),
    title,
    description,
    image: row.image as string | undefined,
    href: `/shop/${row.slug}`,
    category: row.category as string | undefined,
    metadata: {
      price: row.regular_price,
      memberPrice: row.member_price,
      stock: row.stock,
    },
    raw: row,
  };
}

/** Normalize membership data */
export function normalizeMembership(row: RowData): NormalizedItem {
  return {
    id: extractId(row),
    title: row.name as string,
    category: row.category as string | undefined,
    metadata: {
      price: row.price,
      startDate: row.startDate,
      expiryDate: row.expiryDate,
    },
    raw: row,
  };
}

/** Normalize page data */
export function normalizePage(row: RowData, locale?: string): NormalizedItem {
  const translation = getTranslation(row, locale);

  return {
    id: extractId(row),
    title: (translation?.title as string) || (row.title as string) || "",
    description: translation?.description as string | undefined,
    href: `/${row.slug}`,
    raw: row,
  };
}

/** Generic fallback normalizer */
export function normalizeGeneric(row: RowData): NormalizedItem {
  const id = extractId(row);
  return {
    id,
    title: (row.title as string) || (row.name as string) || id,
    description: row.description as string | undefined,
    image:
      (row.image as string) ||
      (row.image_url as string) ||
      (row.logo as string),
    raw: row,
  };
}

/** Table-to-normalizer map */
const NORMALIZERS: Record<
  string,
  (row: RowData, locale?: string) => NormalizedItem
> = {
  events: normalizeEvent,
  news: normalizeNews,
  jobs: normalizeJob,
  partners: normalizePartner,
  departments: normalizeDepartment,
  team: normalizeTeamMember,
  products: normalizeProduct,
  memberships: normalizeMembership,
  pages: normalizePage,
};

/**
 * Normalize a row from any table to common NormalizedItem shape
 */
export function normalizeItem(
  table: string,
  row: RowData,
  locale?: string
): NormalizedItem {
  const normalizer = NORMALIZERS[table];
  if (normalizer) {
    return normalizer(row, locale);
  }
  return normalizeGeneric(row);
}
