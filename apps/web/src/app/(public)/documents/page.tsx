import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { listPublishedDocuments } from "@/app/actions/documents";
import { getLocale } from "@/app/actions/locale";
import { isKnownCategory } from "@/components/documents/v2/document-categories";
import {
  DocumentRow,
  type DocumentRowLabels,
} from "@/components/documents/v2/document-row";
import { FeedSearch } from "@/components/ui/feed-search";
import { FilterChips } from "@/components/ui/filter-chips";
import { ListSkeleton } from "@/components/ui/loading-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { getUserPreferences } from "@/lib/auth-utils";
import { resolveRequestCampus } from "@/lib/campus-scope";
import { DOCUMENT_CATEGORIES, type PublicDocument } from "@/lib/documents";
import { resolveDocumentsFilters } from "@/lib/documents-filters";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("documents");
  return {
    // A campus- or category-scoped view of the same list, not a competing one.
    alternates: { canonical: "/documents" },
    title: `${t("title")} | BISO`,
    description: t("hero.subtitle"),
  };
}

type SearchParam = string | string[] | undefined;

type DocumentsSearchParams = Promise<{
  campus?: SearchParam;
  category?: SearchParam;
  q?: SearchParam;
}>;

const first = (value: SearchParam): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function matchesSearch(doc: PublicDocument, query: string): boolean {
  if (!query) {
    return true;
  }
  const needle = query.toLowerCase();
  return (
    doc.title.toLowerCase().includes(needle) ||
    (doc.description ?? "").toLowerCase().includes(needle)
  );
}

/**
 * Reads the request — the URL and the campus cookie — inside the Suspense
 * boundary, so the header above it is not held back by them.
 */
async function DocumentsList({
  searchParams,
}: {
  searchParams: DocumentsSearchParams;
}) {
  const [sp, prefs, t, locale] = await Promise.all([
    searchParams,
    getUserPreferences(),
    getTranslations("documents"),
    getLocale(),
  ]);

  // URL beats cookie beats "all", like every other campus-scoped route, so a
  // shared `/documents?campus=bergen` shows Bergen whatever the reader's own
  // cookie holds. National documents ride along with any campus.
  const campus = resolveRequestCampus(sp.campus, prefs?.campusId);
  if (campus === undefined) {
    notFound();
  }

  // `?category=` opens one shelf — the bylaws address and the About page link
  // straight to theirs. An unknown category falls back to every document.
  const { category } = resolveDocumentsFilters(
    { category: sp.category },
    campus
  );
  const query = first(sp.q)?.trim() ?? "";

  const all = await listPublishedDocuments({ campusId: campus });

  const counts = new Map<string, number>();
  for (const doc of all) {
    counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1);
  }
  // Every shelf that holds a document, in display order — plus the one the
  // link asked for, so a deep link to an empty shelf still shows where it is.
  const options = [
    { value: "all", label: t("categories.all") },
    ...DOCUMENT_CATEGORIES.filter(
      (value) => counts.has(value) || value === category
    ).map((value) => ({
      value,
      label: t(`categories.${value}`),
      count: counts.get(value) ?? 0,
    })),
  ];

  const rows = all
    .filter((doc) => category === "all" || doc.category === category)
    .filter((doc) => matchesSearch(doc, query));

  // The search keeps the shelf and the campus the visitor is looking at.
  const campusParam = first(sp.campus);
  const hidden: Record<string, string> = {};
  if (category !== "all") {
    hidden.category = category;
  }
  if (campusParam) {
    hidden.campus = campusParam;
  }

  const labels: DocumentRowLabels = {
    campus: t("row.campus"),
    category: (value) =>
      isKnownCategory(value) ? t(`categories.${value}`) : value,
    download: t("row.download"),
    previousVersions: (count) => t("row.previousVersions", { count }),
    updated: (date) => t("row.updated", { date }),
    view: t("row.view"),
  };

  const isFiltered = category !== "all" || query !== "";

  return (
    <>
      <div className="mb-10 flex flex-col gap-6">
        <FilterChips
          active={category}
          basePath="/documents"
          defaultValue="all"
          label={t("filter.label")}
          options={options}
          param="category"
          searchParams={sp}
        />
        <FeedSearch
          action="/documents"
          defaultValue={query}
          hidden={hidden}
          label={t("search")}
          name="q"
          placeholder={t("search")}
          submitLabel={t("searchSubmit")}
          surface="documents"
        />
      </div>

      {rows.length > 0 ? (
        <ul className="border-edge border-t">
          {rows.map((doc) => (
            <DocumentRow
              doc={doc}
              key={doc.$id}
              labels={labels}
              locale={locale}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <p className="type-body text-ink-muted">
            {all.length === 0 ? t("nonePublished") : t("empty")}
          </p>
          {isFiltered ? (
            <Link
              className="type-body-sm rounded-biso-sm text-ink-accent underline underline-offset-4 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
              href={
                campusParam
                  ? `/documents?campus=${encodeURIComponent(campusParam)}`
                  : "/documents"
              }
            >
              {t("clearFilters")}
            </Link>
          ) : null}
        </div>
      )}
    </>
  );
}

/**
 * Official BISO documents — the one place for governing documents (Branding
 * Committee, batch D): `?category=` and `?campus=` open a shelf, the current
 * version reads `v<version>`, and every earlier version stays downloadable.
 *
 * **PLACEHOLDER-014:** when RD-027 converted this page the `documents` table
 * held zero published rows, so the list, the chips and both per-row actions
 * were verified against fixtures rather than live data. The download route
 * (`/api/documents/[id]/download`) and the SharePoint link are main's.
 */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: DocumentsSearchParams;
}) {
  const [t, tCommon] = await Promise.all([
    getTranslations("documents"),
    getTranslations("common"),
  ]);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: tCommon("breadcrumbs.home"), href: "/" },
          { label: t("title") },
        ]}
        eyebrow={t("hero.eyebrow")}
        lede={t("hero.subtitle")}
        title={t("hero.title")}
      />
      <Section tone="paper">
        <Suspense fallback={<ListSkeleton />}>
          <DocumentsList searchParams={searchParams} />
        </Suspense>
      </Section>
    </>
  );
}
